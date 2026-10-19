// Scans a mods/ directory and produces the ModsPayload consumed by the
// renderer. Runs in Node (used by both the Electron preload and the Vite dev
// server), so it has fs access and can transpile TS with Sucrase.
//
// Layout of a mod:
//   mods/<namespace>/
//     data/<category>/<name>.json                 -> ModDataFile
//     data/function/<kind>/<name>.ts              -> ModFunction (kind entity/tile/feature)
//     assets/images/<type>/<...>.png              -> ModAsset
//     override/<target_ns>/<category>/<name>.json -> ModDataFile replacing <target_ns>:<name>
//     override/<target_ns>/function/<kind>/<name>.ts
//     override/<target_ns>/images/<type>/<...>.png
//     patch/<target_ns>/<category>/<name>.json    -> ModDataFile merged into <target_ns>:<name>

const fs = require('fs');
const path = require('path');
const { transform } = require('sucrase');

const MIME = { '.png': 'image/png' };

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listDirs(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);
}

// Recursively collect files under `dir`, returning paths relative to `dir`.
function walk(dir, rel = '') {
    if (!fs.existsSync(dir)) return [];
    let out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const childRel = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) out = out.concat(walk(path.join(dir, e.name), childRel));
        else out.push(childRel);
    }
    return out;
}

// Transpile a TS mod function to CommonJS (no type-checking, microseconds).
// The 'imports' transform rewrites `import ... from '...'` into require() calls
// and `export default` into module.exports; the runtime intercepts require to
// return the Terrath API global. So a mod's `import { goTo } from '@/game/api'`
// becomes a lookup into the injected API, and its default export is captured.
function transpile(src) {
    return transform(src, { transforms: ['typescript', 'imports'] }).code;
}

function scanData(dataDir, out, extra) {
    for (const category of listDirs(dataDir)) {
        if (category === 'images') continue;
        const catDir = path.join(dataDir, category);
        for (const rel of walk(catDir)) {
            const full = path.join(catDir, rel);
            const name = rel.replace(/\.[^.]+$/, '');
            if (rel.endsWith('.json')) {
                // data/<category>/<...>/<name>.json -> category + subfoldered name
                out.data.push({ category, name, json: readJson(full), ...extra });
            } else if (rel.endsWith('.ts') && category === 'function' && !extra.patch) {
                // data/function/<kind>/<...>/<name>.ts: the first subfolder is the
                // kind (entity/feature/tile); the rest is the id within that kind.
                const slash = rel.indexOf('/');
                if (slash === -1) continue; // a .ts directly under function/ has no kind
                const kind = rel.slice(0, slash);
                const fnName = rel.slice(slash + 1).replace(/\.[^.]+$/, '');
                out.functions.push({
                    kind, name: fnName, jsSource: transpile(fs.readFileSync(full, 'utf8')), ...extra,
                });
            }
        }
    }
}

function scanImages(imagesDir, out, extra) {
    for (const type of listDirs(imagesDir)) {
        const typeDir = path.join(imagesDir, type);
        for (const rel of walk(typeDir)) {
            const ext = path.extname(rel).toLowerCase();
            if (!MIME[ext]) continue;
            const b64 = fs.readFileSync(path.join(typeDir, rel)).toString('base64');
            out.assets.push({
                type,
                name: rel.replace(/\.[^.]+$/, ''),
                dataUri: `data:${MIME[ext]};base64,${b64}`,
                ...extra,
            });
        }
    }
}

function scanMod(namespace, modDir) {
    const out = { namespace, data: [], assets: [], functions: [] };

    scanData(path.join(modDir, 'data'), out, {});
    scanImages(path.join(modDir, 'assets', 'images'), out, {});

    const overrideDir = path.join(modDir, 'override');
    for (const target of listDirs(overrideDir)) {
        scanData(path.join(overrideDir, target), out, { target });
        scanImages(path.join(overrideDir, target, 'images'), out, { target });
    }

    const patchDir = path.join(modDir, 'patch');
    for (const target of listDirs(patchDir)) {
        scanData(path.join(patchDir, target), out, { target, patch: true });
    }

    return out;
}

// Scans a mods root directory and returns { mods: LoadedMod[] }.
function scanMods(modsRoot) {
    const mods = [];
    for (const namespace of listDirs(modsRoot)) {
        try {
            mods.push(scanMod(namespace, path.join(modsRoot, namespace)));
        } catch (err) {
            // A broken mod must not crash the game; skip it and log.
            console.error(`[mods] failed to load "${namespace}":`, err.message);
        }
    }
    return { mods };
}

module.exports = { scanMods };

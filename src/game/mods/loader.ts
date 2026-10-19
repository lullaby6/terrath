// Renderer-side mod loader. Fetches the ModsPayload (from the Electron preload
// in the packaged app, or from the Vite dev HTTP endpoint in the browser),
// then turns it into the same shapes the base game uses, namespaced per mod.
//
// The result is merged on top of the base "terrath" content, so a mod either adds
// new ids (my_mod:ruby_ore) or overrides base ones (terrath:grass).

import { ModsPayload, LoadedMod, ModFunction } from '@/game/api/mods';
import { BASE_NAMESPACE } from '@/game/api/namespace';
import { evalModFunction } from './runtime';

export interface ModPatch {
    id: string;
    patch: Record<string, unknown>;
}

// Loaded, namespaced mod content ready to merge into the base registries.
export interface ModContent {
    // category -> { "ns:name": json }
    data: Record<string, Record<string, unknown>>;
    patches: Record<string, ModPatch[]>;
    // "ns:type/name" texture key -> data URI
    assets: Record<string, string>;
    // kind -> { "ns:name": evaluated function }
    functions: Record<string, Record<string, unknown>>;
}

type RefKind = 'asset' | 'tile' | 'feature' | 'noise' | 'biome' | 'entity' | 'particle'
    | 'fn:entity' | 'fn:tile' | 'fn:feature';
type RefSpec = RefKind | { each: Record<string, RefSpec> };

const REFS: Record<string, Record<string, RefSpec>> = {
    tile: { sprite: 'asset', variants: 'asset', base: 'tile', functions: 'fn:tile', walkParticles: 'particle' },
    feature: { tile: 'tile', on: 'tile', function: 'fn:feature' },
    noise: { layers: { each: { tile: 'tile' } } },
    biome: { noise: 'noise', features: 'feature' },
    entity: { sprite: 'asset', functions: 'fn:entity', walkParticles: 'particle' },
    world: { biomes: 'biome', spawns: { each: { entity: 'entity' } } },
};

// Fetches the raw payload from whichever source is available (or empty).
export async function fetchModsPayload(): Promise<ModsPayload> {
    const native = (globalThis as any).terrathNative;
    if (native?.loadMods) {
        return native.loadMods();
    }
    // Dev fallback: the Vite plugin serves the same payload over HTTP.
    try {
        const res = await fetch('/__mods');
        if (res.ok) return await res.json();
    } catch {
        // no mods source available (plain web build) — that's fine
    }
    return { mods: [] };
}

// Converts the raw payload into namespaced, ready-to-merge content.
export function buildModContent(payload: ModsPayload): ModContent {
    const content: ModContent = { data: {}, patches: {}, assets: {}, functions: {} };

    for (const mod of payload.mods) {
        const resolve = makeResolver(mod);
        addModData(content, mod, resolve);
        addModAssets(content, mod);
        addModFunctions(content, mod);
    }
    return content;
}

function makeResolver(mod: LoadedMod): (ref: string, kind: RefKind) => string {
    const own = new Map<RefKind, Set<string>>();
    const add = (kind: RefKind, name: string) => {
        if (!own.has(kind)) own.set(kind, new Set());
        own.get(kind)!.add(name);
    };
    for (const f of mod.data) if (!f.target) add(f.category as RefKind, f.name);
    for (const a of mod.assets) if (!a.target) add('asset', a.name);
    for (const fn of mod.functions) if (!fn.target) add(`fn:${fn.kind}` as RefKind, fn.name);

    return (ref, kind) => {
        if (ref.includes(':')) return ref;
        const ns = own.get(kind)?.has(ref) ? mod.namespace : BASE_NAMESPACE;
        return `${ns}:${ref}`;
    };
}

function resolveRefs(
    json: unknown, spec: Record<string, RefSpec>, resolve: (ref: string, kind: RefKind) => string,
): unknown {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return json;
    const out: Record<string, unknown> = { ...(json as Record<string, unknown>) };
    for (const [key, value] of Object.entries(out)) {
        const field = spec[key.endsWith('+') ? key.slice(0, -1) : key];
        if (!field) continue;
        if (typeof field === 'string') {
            if (typeof value === 'string') out[key] = resolve(value, field);
            else if (Array.isArray(value)) out[key] = value.map(v => (typeof v === 'string' ? resolve(v, field) : v));
        } else if (Array.isArray(value)) {
            out[key] = value.map(v => resolveRefs(v, field.each, resolve));
        }
    }
    return out;
}

function addModData(content: ModContent, mod: LoadedMod, resolve: (ref: string, kind: RefKind) => string): void {
    for (const file of mod.data) {
        const id = `${file.target ?? mod.namespace}:${file.name}`;
        const json = resolveRefs(file.json, REFS[file.category] ?? {}, resolve);
        if (file.patch) {
            (content.patches[file.category] ??= []).push({ id, patch: json as Record<string, unknown> });
        } else {
            (content.data[file.category] ??= {})[id] = json;
        }
    }
}

function addModAssets(content: ModContent, mod: LoadedMod): void {
    for (const asset of mod.assets) {
        content.assets[`${asset.target ?? mod.namespace}:${asset.name}`] = asset.dataUri;
    }
}

function addModFunctions(content: ModContent, mod: LoadedMod): void {
    for (const fn of mod.functions as ModFunction[]) {
        const bucket = (content.functions[fn.kind] ??= {});
        const id = `${fn.target ?? mod.namespace}:${fn.name}`;
        try {
            bucket[id] = evalModFunction(fn.jsSource);
        } catch (err) {
            console.error(`[mods] failed to eval ${id}`, err);
        }
    }
}

export function applyPatch(target: unknown, patch: Record<string, unknown>): unknown {
    const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
    for (const [key, value] of Object.entries(patch)) {
        if (key.endsWith('+')) {
            const field = key.slice(0, -1);
            const current = Array.isArray(out[field]) ? out[field] as unknown[] : [];
            out[field] = [...current, ...(Array.isArray(value) ? value : [value])];
        } else {
            out[key] = value;
        }
    }
    return out;
}

// Renderer-side mod loader. Fetches the ModsPayload (from the Electron preload
// in the packaged app, or from the Vite dev HTTP endpoint in the browser),
// then turns it into the same shapes the base game uses, namespaced per mod.
//
// The result is merged on top of the base "terrath" content, so a mod either adds
// new ids (my_mod:ruby_ore) or overrides base ones (terrath:grass).

import { ModsPayload, LoadedMod, ModFunction } from '@/game/api/mods';
import { evalModFunction } from './runtime';

// Loaded, namespaced mod content ready to merge into the base registries.
export interface ModContent {
    // category -> { "ns:name": json }
    data: Record<string, Record<string, unknown>>;
    // "ns:type/name" texture key -> data URI
    assets: Record<string, string>;
    // kind -> { "ns:name": evaluated function }
    functions: Record<string, Record<string, unknown>>;
}

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

// Namespaces one mod's texture name: type "block" + name "rock/1" under mod
// "my_mod" -> texture key "my_mod:rock/1". (Type folder is dropped, matching
// the base asset loader convention.)
function assetKey(namespace: string, name: string): string {
    return `${namespace}:${name}`;
}

// Converts the raw payload into namespaced, ready-to-merge content.
export function buildModContent(payload: ModsPayload): ModContent {
    const content: ModContent = { data: {}, assets: {}, functions: {} };

    for (const mod of payload.mods) {
        addModData(content, mod);
        addModAssets(content, mod);
        addModFunctions(content, mod);
    }
    return content;
}

function addModData(content: ModContent, mod: LoadedMod): void {
    for (const file of mod.data) {
        const bucket = (content.data[file.category] ??= {});
        bucket[`${mod.namespace}:${file.name}`] = file.json;
    }
}

function addModAssets(content: ModContent, mod: LoadedMod): void {
    for (const asset of mod.assets) {
        content.assets[assetKey(mod.namespace, asset.name)] = asset.dataUri;
    }
}

function addModFunctions(content: ModContent, mod: LoadedMod): void {
    for (const fn of mod.functions as ModFunction[]) {
        const bucket = (content.functions[fn.kind] ??= {});
        try {
            bucket[`${mod.namespace}:${fn.name}`] = evalModFunction(fn.jsSource);
        } catch (err) {
            console.error(`[mods] failed to eval ${mod.namespace}:${fn.name}`, err);
        }
    }
}

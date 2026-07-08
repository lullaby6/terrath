// Automatic data JSON loading with import.meta.glob (Vite).
// Returns a Record<"terrath:name", content>: base content lives in the reserved
// "terrath" namespace, so its keys match the namespaced ids used everywhere else.
// Subfolders are preserved in the name: tile/ore/coal.json -> "terrath:ore/coal".

import { BASE_NAMESPACE } from '@/game/api';

// Builds the namespaced record. The category is derived from the path itself
// (paths are always "./<category>/..."), and the sub-path within it becomes the
// id, preserving subfolders:
//   "./tile/ore/coal.json" -> "terrath:ore/coal"
//   "./tile/grass.json"    -> "terrath:grass"
// import.meta.glob needs a literal path, so each loader passes its own glob;
// the category string is not repeated.
function toRecord<T>(modules: Record<string, unknown>): Record<string, T> {
    const out: Record<string, T> = {};
    for (const [path, mod] of Object.entries(modules)) {
        // strip "./<category>/" (two leading path segments)
        const name = path.replace(/^\.\/[^/]+\//, '').replace(/\.json$/, '');
        out[`${BASE_NAMESPACE}:${name}`] = mod as T;
    }
    return out;
}

export function loadBiomes<T>(): Record<string, T> {
    return toRecord<T>(import.meta.glob('./biome/**/*.json', { eager: true, import: 'default' }));
}
export function loadNoises<T>(): Record<string, T> {
    return toRecord<T>(import.meta.glob('./noise/**/*.json', { eager: true, import: 'default' }));
}
export function loadFeatures<T>(): Record<string, T> {
    return toRecord<T>(import.meta.glob('./feature/**/*.json', { eager: true, import: 'default' }));
}
export function loadTiles<T>(): Record<string, T> {
    return toRecord<T>(import.meta.glob('./tile/**/*.json', { eager: true, import: 'default' }));
}
export function loadEntities<T>(): Record<string, T> {
    return toRecord<T>(import.meta.glob('./entity/**/*.json', { eager: true, import: 'default' }));
}

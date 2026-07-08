// Shared shape of loaded mods. Both mod sources (Electron preload via IPC, and
// the Vite dev HTTP endpoint) produce this exact structure, so the renderer's
// mod loader consumes it identically regardless of where it came from.

// One data file inside a mod: its category (tile/entity/biome/...), the base
// filename (without extension) and the parsed JSON content.
export interface ModDataFile {
    category: string;   // "tile", "entity", "biome", "feature", "noise"
    name: string;       // "ruby_ore" (filename without .json)
    json: unknown;      // parsed content
}

// One image asset inside a mod, already read as a data URI so it can be
// registered in Phaser without touching the filesystem.
export interface ModAsset {
    type: string;       // "block", "entity", ...  (top folder under images/)
    name: string;       // "ruby_ore" or "rock/1" (path after type, no extension)
    dataUri: string;    // "data:image/png;base64,..."
}

// One behavior function inside a mod, already transpiled from TS to plain JS
// source. The renderer evaluates it with the API injected as a global.
export interface ModFunction {
    kind: string;       // "function" | "feature_function" | "tile_function"
    name: string;       // "explode" (filename without extension)
    jsSource: string;   // transpiled JS (ESM-free, uses the Terrath global)
}

// A fully-read mod, namespaced by its folder name.
export interface LoadedMod {
    namespace: string;          // folder name, e.g. "my_mod"
    data: ModDataFile[];
    assets: ModAsset[];
    functions: ModFunction[];
}

// The complete payload handed to the renderer's mod loader.
export interface ModsPayload {
    mods: LoadedMod[];
}

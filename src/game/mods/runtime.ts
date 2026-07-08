// Runtime host for mod code. Mods can't use static `import` (they're evaluated
// at runtime from disk), so the whole game API is exposed as a global `Terrath`
// and mods read what they need from it:
//
//   const { goTo, PerlinNoise } = Terrath;
//   export default function myBehavior(entity, ctx) { ... }
//
// Sucrase transpiles a mod's TS to CommonJS (imports -> require, export default
// -> module.exports.default). We run that source in a function scope with a
// `require` that returns the Terrath API for any module id — so a mod's
// `import { goTo } from '@/game/api'` resolves to the injected API — plus
// `exports`/`module` to capture the default export.

import * as TerrathAPI from '@/game/api';

// Install the API global once, before any mod code runs.
export function installApiGlobal(): void {
    (globalThis as any).Terrath = TerrathAPI;
}

// Evaluates a transpiled mod-function source and returns its default export.
export function evalModFunction<T = unknown>(jsSource: string): T {
    const api = (globalThis as any).Terrath;
    // Any import a mod writes resolves to the API. (Mods import from the game's
    // API only; there is nothing else to resolve.)
    const require = (_id: string) => api;
    const module = { exports: {} as any };
    // eslint-disable-next-line no-new-func
    const factory = new Function('require', 'exports', 'module', 'Terrath', jsSource);
    factory(require, module.exports, module, api);
    return (module.exports.default ?? module.exports) as T;
}

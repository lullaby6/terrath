// Global singleton holding the loaded mod content. Populated once at startup
// (async: fetch payload + eval functions), then read synchronously by the
// scene — which keeps Phaser's preload/create free of async concerns.

import { fetchModsPayload, buildModContent, ModContent } from './loader';
import { installApiGlobal } from './runtime';

let content: ModContent = { data: {}, assets: {}, functions: {} };
let loaded = false;

// Loads and evaluates all mods. Call once before starting the Phaser game.
export async function initMods(): Promise<void> {
    installApiGlobal();
    const payload = await fetchModsPayload();
    content = buildModContent(payload);
    loaded = true;
    const count = payload.mods.length;
    if (count > 0) console.log(`[mods] loaded ${count} mod(s):`, payload.mods.map(m => m.namespace));
}

export function modContent(): ModContent {
    if (!loaded) console.warn('[mods] modContent() read before initMods() completed');
    return content;
}

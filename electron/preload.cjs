// Preload script: the only place with both Node access and a bridge to the
// renderer. It scans mods/ (fs + Sucrase) and hands the renderer a ready-made
// ModsPayload via a narrow, safe contextBridge API. The renderer never touches
// the filesystem, keeping contextIsolation intact.

const { contextBridge } = require('electron');
const path = require('path');
const { scanMods } = require('./mod-scanner.cjs');

// mods/ sits next to the executable (see main.cjs packaging layout).
// Prod: preload runs from inside app.asar, so use resourcesPath (mods live at
//       .../terrath/mods, one level up from .../terrath/resources).
// Dev:  __dirname is .../electron, mods are one level up (project root).
function modsRoot() {
    if (process.resourcesPath && process.resourcesPath.includes('resources')) {
        return path.join(process.resourcesPath, '..', 'mods');
    }
    return path.join(__dirname, '..', 'mods');
}

contextBridge.exposeInMainWorld('terrathNative', {
    // Returns the ModsPayload (see src/game/api/mods.ts). Synchronous read at
    // startup is fine — it happens once before the scene loads.
    loadMods() {
        try {
            return scanMods(modsRoot());
        } catch (err) {
            console.error('[mods] scan failed:', err);
            return { mods: [] };
        }
    },
});

// Dev-only Vite plugin: serves the same ModsPayload the Electron preload would
// produce, over HTTP at /__mods. Lets us test mods in the browser (npm run dev)
// without packaging an .exe. Uses the shared mod-scanner (fs + Sucrase).

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const { scanMods } = require('../electron/mod-scanner.cjs');

const modsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'mods');

export function modsDevPlugin() {
    return {
        name: 'terrath-mods-dev',
        configureServer(server) {
            server.middlewares.use('/__mods', (_req, res) => {
                let payload;
                try {
                    payload = scanMods(modsRoot);
                } catch (err) {
                    payload = { mods: [], error: String(err) };
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(payload));
            });
        },
    };
}

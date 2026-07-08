import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { modsDevPlugin } from './mods-plugin.mjs';

export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        port: 3000
    },
    plugins: [
        tsconfigPaths(),
        modsDevPlugin()
    ],
});

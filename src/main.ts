import '@/assets/styles/normalize.css';
import '@/assets/styles/reset.css';
import '@/assets/styles/style.css';

import StartGame from '@/game/main';
import { initMods } from '@/game/mods/registry';

document.addEventListener('DOMContentLoaded', async () => {
    // Load mods (data, assets, transpiled functions) before the game starts,
    // so the scene can consume everything synchronously.
    await initMods();
    StartGame('game-container');
});
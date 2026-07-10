import { Game as MainGame } from '@/game/scenes/Game';
import { WEBGL, Game, Scale, Types } from 'phaser';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
    type: WEBGL,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#028af8',
    pixelArt: true,
    // antialias: true,
    // antialiasGL: true,
    // roundPixels: true,
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: [
        MainGame
    ]
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
}

export default StartGame;

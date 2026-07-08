import { Scene } from 'phaser';
import { BASE_NAMESPACE } from '@/game/api';

// Automatic asset loading with import.meta.glob (Vite).
// Base images are registered under the "terrath" namespace so texture keys match
// the namespaced ids used everywhere (a tile's sprite "grass" -> "terrath:grass").
const images = import.meta.glob<string>('./images/**/*.png', {
    eager: true,
    import: 'default',
    query: '?url',
});

// Derives the namespaced texture key from the path, preserving subdirectories
// within type:
//   "./images/block/grass.png"   -> "terrath:grass"
//   "./images/block/rock/1.png"  -> "terrath:rock/1"
//   "./images/entity/player.png" -> "terrath:player"
function keyFromPath(path: string): string {
    // path = "./images/<type>/<...>.png"; take everything after <type>/.
    const parts = path.replace(/^\.\/images\//, '').split('/');
    parts.shift(); // discard the type (block, entity, ...)
    const name = parts.join('/').replace(/\.png$/, '');
    return `${BASE_NAMESPACE}:${name}`;
}

export function loadAllImages(scene: Scene): void {
    for (const [path, url] of Object.entries(images)) {
        scene.load.image(keyFromPath(path), url);
    }
}

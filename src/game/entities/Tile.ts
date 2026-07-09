import { Scene, GameObjects } from 'phaser';
import { resolveId } from '@/game/api';

// Tile layer: 'floor' = base ground layer; 'block' = goes above floor.
export type TileLayer = 'floor' | 'block';

// Fixed, very-negative depths for the ground layers, so they are ALWAYS drawn
// below Y-sorted objects (trees, entities) — even when those have a large
// negative world Y far from the origin. Y-sorted objects use their world Y
// directly as depth (lower on screen = drawn on top), which stays above these
// constants for any reachable position.
export const FLOOR_DEPTH = -2_000_000_000;
export const SMALL_BLOCK_DEPTH = -1_000_000_000;

// Unified tile definition (data/tile/*.json). Works for floors and blocks:
// the difference is the `layer` field. Everything is data-driven — adding
// a new tile is just creating a .json, no code changes.
export interface TileDef {
    layer: TileLayer;
    sprite: string;
    variants?: string[];   // alternative sprites (["rock/1", "rock/2"]); one random
    size?: number;         // sprite footprint in tiles (default 1). >1 draws an
    // oversized sprite anchored at its bottom tile, rising
    // upward/outward (e.g. a 2x2 tree). Collision stays 1 tile.
    base?: string;         // floor placed underneath when this block is a terrain
    // tile (e.g. water block sits on sand); id of a floor
    solid?: boolean;       // blocks movement physically (rock, etc)
    avoid?: boolean;       // pathfinding avoids it (water, etc)
    speedFactor?: number;  // speed multiplier when stepped on (default 1)
    functions?: string[];  // tile_functions with logic (sink, burn, ...) by name
    flip?: {
        horizontal?: boolean;
        vertical?: boolean;
        rotate?: boolean;
    };
}


// Deterministic random [0,1) from global coordinates.
// This way flip/variant is always the same even if the chunk reloads.
function hashRandom(gx: number, gy: number): number {
    let h = (gx * 374761393 + gy * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Picks the sprite texture key (namespaced): if variants exist, one random
// (deterministic by coordinate); otherwise the base sprite. The sprite ref in
// the tile def ("grass", "rock/1") is resolved to its texture key ("terrath:grass").
function pickSprite(config: TileDef, gx: number, gy: number): string {
    if (config.variants && config.variants.length > 0) {
        const i = Math.floor(hashRandom(gx + 7919, gy + 6271) * config.variants.length);
        return resolveId(config.variants[i]);
    }
    return resolveId(config.sprite);
}

// Generic tile: floor, block, decoration. Extends Image, handles automatic
// flip based on config and global coordinate (deterministic).
export class Tile extends GameObjects.Image {
    constructor(scene: Scene, x: number, y: number, size: number, config: TileDef, gx: number, gy: number) {
        super(scene, x, y, pickSprite(config, gx, gy));
        scene.add.existing(this);

        const footprint = config.size ?? 1;
        if (footprint > 1) {
            // Oversized sprite (e.g. tree): anchor at the bottom-center of its
            // tile so it rises upward, and center it horizontally over the tile.
            this.setOrigin(0.5, 1);
            this.setPosition(x, y + size / 2);
            this.setDisplaySize(size * footprint, size * footprint);
        } else {
            this.setOrigin(0.5, 0.5);
            this.setDisplaySize(size, size);
        }

        if (config.flip) {
            this.applyRandomFlip(config.flip, gx, gy);
        }
    }

    private applyRandomFlip(flipCfg: any, gx: number, gy: number): void {
        const { horizontal, vertical, rotate } = flipCfg;
        if (horizontal && hashRandom(gx, gy) < 0.5) this.setFlipX(true);
        if (vertical && hashRandom(gx + 1013, gy - 977) < 0.5) this.setFlipY(true);
        if (rotate) {
            const quarter = Math.floor(hashRandom(gx - 313, gy + 571) * 4);
            this.setAngle(quarter * 90);
        }
    }
}

// Solid tile: has a static physics body for collisions.
// IMPORTANT: must live directly in the scene (NOT inside a Container), or
// the body stays in local coordinates and collisions fail.
export class SolidBlock extends Tile {
    constructor(scene: Scene, x: number, y: number, size: number, config: TileDef, gx: number, gy: number) {
        super(scene, x, y, size, config, gx, gy);
        // Add static body: doesn't move, but collides.
        scene.physics.add.existing(this, true); // true = static
        const body = this.body as Phaser.Physics.Arcade.StaticBody;

        // The hitbox is ALWAYS one tile (the trunk / footprint), regardless of
        // an oversized sprite. For a big tile the sprite is anchored bottom-
        // center and rises; the solid part is the single tile at (x, y) it was
        // generated on. We position the static body directly in world space
        // rather than deriving it from the (scaled, offset) sprite.
        body.setSize(size, size);
        body.position.set(x - size / 2, y - size / 2);
        body.updateCenter();
    }
}

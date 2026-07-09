import { Scene } from 'phaser';
import {
    WorldGenerator, WorldConfig, GameConfig, BiomeDef, NoiseConfig, FeatureConfig,
} from '@/game/world/WorldGenerator';
import { ChunkManager } from '@/game/world/ChunkManager';
import { Entity, EntityStats, EntityWorld } from '@/game/entities/Entity';
import { TileDef } from '@/game/entities/Tile';
import { ENTITY_FUNCTIONS, FEATURE_FUNCTIONS, TILE_FUNCTIONS } from '@/game/api/registries';
import { resolveId, EntityFunction, FeatureFunction, TileFunction } from '@/game/api';
import { loadAllImages } from '@/game/assets/loader';
import { loadBiomes, loadNoises, loadTiles, loadFeatures, loadEntities } from '@/game/data/loader';
import { modContent } from '@/game/mods/registry';

import worldConfig from '@/game/data/world/earth.json';
import gameConfig from '@/game/config/game.json';
import cameraConfig from '@/game/config/camera.json';

export class Game extends Scene {
    private chunks!: ChunkManager;
    private solidBlocksGroup!: Phaser.Physics.Arcade.StaticGroup;
    private entities: Entity[] = [];
    private entityDefs!: Record<string, EntityStats>;
    private entityFunctions!: Record<string, EntityFunction>;
    private tileFunctions!: Record<string, TileFunction>;
    private world!: EntityWorld;

    constructor() {
        super('Game');
    }

    preload() {
        // Base images (bundled) + mod images (data URIs read from disk).
        loadAllImages(this);
        for (const [key, dataUri] of Object.entries(modContent().assets)) {
            this.load.image(key, dataUri);
        }
    }

    // Merges base content (Record<"terrath:id", T>) with a mod category so mod
    // ids add to, or override, the base ones.
    private withMods<T>(base: Record<string, T>, category: string): Record<string, T> {
        return { ...base, ...(modContent().data[category] as Record<string, T> ?? {}) };
    }

    create() {
        const tileDefs = this.withMods(loadTiles<TileDef>(), 'tile');
        this.entityDefs = this.withMods(loadEntities<EntityStats>(), 'entity');

        // Function registries: base ones under the "terrath" namespace, plus mod
        // ones (already "ns:name" keyed) of the matching kind, so refs resolve
        // the same way. The kind is the subfolder under data/function/.
        this.entityFunctions = mergeFunctions(ENTITY_FUNCTIONS, 'entity');
        this.tileFunctions = mergeFunctions(TILE_FUNCTIONS, 'tile');
        const featureFunctions = mergeFunctions<FeatureFunction>(FEATURE_FUNCTIONS, 'feature');

        const generator = new WorldGenerator(
            worldConfig as WorldConfig,
            gameConfig as GameConfig,
            this.withMods(loadBiomes<BiomeDef>(), 'biome'),
            this.withMods(loadNoises<NoiseConfig>(), 'noise'),
            this.withMods(loadFeatures<FeatureConfig>(), 'feature'),
            tileDefs,
            featureFunctions,
        );
        this.solidBlocksGroup = this.physics.add.staticGroup();
        this.chunks = new ChunkManager(this, generator, tileDefs, this.solidBlocksGroup);

        const ts = generator.gameConfig.tileSize;

        // World services for the entity functions.
        this.world = {
            tileSize: ts,
            isBlocked: (gx, gy) => this.chunks.isBlocked(gx, gy),
            nearestWithTag: (tag, fromX, fromY) => this.nearestWithTag(tag, fromX, fromY),
        };

        // Spawn entities from the world config (data-driven, no hardcoding).
        for (const spawn of (worldConfig as WorldConfig).spawns) {
            this.spawnEntity(spawn.entity, spawn.x, spawn.y);
        }

        // Camera follows the entity tagged "camera" (data-driven target).
        const cam = this.cameras.main;
        cam.setZoom(cameraConfig.zoom);
        const target = this.nearestWithTag('camera', 0, 0);
        if (target) {
            cam.startFollow(target, true, cameraConfig.followLerp, cameraConfig.followLerp);
        }

        this.chunks.update();
    }

    // Generic spawn: creates an Entity from its def (data/entity/<name>.json),
    // resolves its functions from the registry, and adds solid collision.
    // `name` may be unqualified ("player") or a full id ("terrath:player").
    private spawnEntity(name: string, x: number, y: number): Entity {
        const def = this.entityDefs[resolveId(name)];
        // Resolve the sprite ref to its namespaced texture key.
        const stats: EntityStats = { ...def, sprite: resolveId(def.sprite) };
        const behaviors = (stats.functions ?? [])
            .map(fn => this.entityFunctions[resolveId(fn)])
            .filter(Boolean);

        const entity = new Entity(this, x, y, stats, behaviors);
        entity.setDepth(y); // Y-sorted (depth = world Y); updated each frame
        this.physics.add.collider(entity, this.solidBlocksGroup);
        this.entities.push(entity);
        return entity;
    }

    // Nearest live entity with a given tag (for chase_target, etc).
    private nearestWithTag(tag: string, fromX: number, fromY: number): Entity | null {
        let best: Entity | null = null;
        let bestDist = Infinity;
        for (const e of this.entities) {
            if (!e.active || !e.hasTag(tag)) continue;
            const d = (e.x - fromX) ** 2 + (e.y - fromY) ** 2;
            if (d < bestDist) {
                bestDist = d;
                best = e;
            }
        }
        return best;
    }

    update(time: number, delta: number) {
        const ctx = { time, delta, world: this.world };
        for (const e of this.entities) {
            e.update(ctx);
            this.applyFloor(e, time, delta);
            // Y-sort with tall tiles (trees): depth = world Y, so a lower object
            // draws on top (tree above the entity covers it; one below is covered).
            e.setDepth(e.y);
        }
        this.chunks.update();
    }

    // Applies the tile effects to an entity standing on it: the declarative
    // speedFactor (engine-applied) plus any tile functions (logic). The block
    // above (e.g. water) is considered, and its speedFactor wins over the floor.
    private applyFloor(e: Entity, time: number, delta: number): void {
        const { floorDef, blockDef, blockName } = this.chunks.tilesAt(e.x, e.y);

        // Reset per-frame terrain modifiers to the entity's base values, then
        // let speedFactor / tile functions modify them (so effects revert when
        // the entity leaves the tile).
        const factor = blockDef?.speedFactor ?? floorDef?.speedFactor ?? 1;
        e.setMaxSpeed(e.speed * factor);
        e.setDrag(e.drag, e.drag);

        // Run tile functions from the block (if present) then the floor.
        for (const def of [blockDef, floorDef]) {
            if (!def?.functions) continue;
            const tileCtx = { tile: blockName ?? '', time, delta };
            for (const fn of def.functions) {
                this.tileFunctions[resolveId(fn)]?.(e, tileCtx);
            }
        }
    }
}

// Combines a base function registry (plain keys like "chase_target", promoted
// to the "terrath" namespace) with mod functions of the same kind (already
// "ns:name" keyed), so refs resolve identically for base and mod content.
function mergeFunctions<T>(base: Record<string, unknown>, kind: string): Record<string, T> {
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(base)) out[resolveId(k)] = v as T;
    Object.assign(out, (modContent().functions[kind] as Record<string, T>) ?? {});
    return out;
}

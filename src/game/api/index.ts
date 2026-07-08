// Public modding API. Everything under data/ imports from here (never from
// internal modules directly). This lets the game's internals be refactored
// without breaking mods, as long as this facade stays stable.
//
// It re-exports both game internals (entities, tiles, noise, pathfinding,
// helpers) AND the underlying Phaser engine, so mods can do anything from
// simple behaviors to fully custom rendering/physics.

// --- Phaser engine (for advanced mods) ---
export * as Phaser from 'phaser';
export { Scene, GameObjects, Physics, Math as PhaserMath, Input } from 'phaser';

// --- Entities ---
export { Entity } from '@/game/entities/Entity';
export type {
    EntityContext, EntityFunction, EntityWorld, EntityStats,
} from '@/game/entities/Entity';

// --- Tiles ---
export { Tile, SolidBlock } from '@/game/entities/Tile';
export type { TileDef, TileLayer } from '@/game/entities/Tile';

// --- World generation types ---
export type {
    TileName, NoiseConfig, NoiseLayer, FeatureConfig, BiomeDef, WorldConfig, GameConfig,
} from '@/game/world/WorldGenerator';

// --- Noise ---
export { PerlinNoise } from '@/game/world/Noise';

// --- Pathfinding ---
export { findPath, hasLineOfSight } from '@/game/world/Pathfinder';
export type { GridPoint } from '@/game/world/Pathfinder';

// --- Movement helpers (usable by entity functions) ---
export { accelerate, goTo } from './movement';

// --- Namespacing (Minecraft-style ns:id) ---
export { resolveId, splitId, BASE_NAMESPACE } from './namespace';

// --- Function registry types ---
export type { FeatureFunction, TileFunction, TileContext } from './registries';

// Auto-discovery of moddable functions via import.meta.glob. Each function
// file under data/function/<kind>/ is registered by its filename. A modder just
// drops a new .ts with a default export — no registry to edit.
//
// Convention: each function module has a DEFAULT export that is the function.
//   data/function/entity/chase_target.ts  -> default export -> key "chase_target"

import { EntityFunction } from '@/game/entities/Entity';

// A feature function decides if a feature appears at a tile.
export type FeatureFunction = (gx: number, gy: number, ctx: any) => boolean;

// Context passed to a tile function each frame.
export interface TileContext {
    tile: string;   // resolved id of the tile the entity is standing on
    time: number;   // current ms
    delta: number;  // ms since previous frame
}

// A tile function runs on an entity standing on a tile (slow, damage, etc).
export type TileFunction = (entity: any, ctx: TileContext) => void;

// Builds a name->export record from a glob map, using the filename as key.
function toRegistry<T>(modules: Record<string, unknown>): Record<string, T> {
    const out: Record<string, T> = {};
    for (const [path, mod] of Object.entries(modules)) {
        const name = path.split('/').pop()!.replace(/\.ts$/, '');
        out[name] = mod as T;
    }
    return out;
}

// Entity behavior functions (data/function/entity/*.ts, default export).
export const ENTITY_FUNCTIONS = toRegistry<EntityFunction>(
    import.meta.glob('../data/function/entity/*.ts', { eager: true, import: 'default' }),
);

// Feature generation functions (data/function/feature/*.ts, default export).
export const FEATURE_FUNCTIONS = toRegistry<FeatureFunction>(
    import.meta.glob('../data/function/feature/*.ts', { eager: true, import: 'default' }),
);

// Tile behavior functions (data/function/tile/*.ts, default export).
export const TILE_FUNCTIONS = toRegistry<TileFunction>(
    import.meta.glob('../data/function/tile/*.ts', { eager: true, import: 'default' }),
);

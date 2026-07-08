// Tile function: runs each frame on an entity standing on the tile. Registered
// by filename in TILE_FUNCTIONS (auto-discovered) and referenced from a tile's
// `functions` array. The `speedFactor` field is separate (declarative, applied
// by the engine); tile functions are for behavior with logic.
//
// Example: 'sink' — quicksand pulling the entity in. For now it clamps the
// entity to a crawl on top of the base speedFactor; real sinking comes later.

import { Entity, TileContext } from '@/game/api';

export default function sink(entity: Entity, _ctx: TileContext): void {
    // Extra slowdown beyond the tile's speedFactor (which the engine applies).
    entity.setMaxSpeed(entity.speed * 0.15);
}

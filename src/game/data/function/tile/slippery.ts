// Tile function: makes an entity slide (ice). Drops the entity's drag so it
// keeps its momentum and skids instead of stopping quickly. applyFloor resets
// drag to the entity's base each frame, so this only applies while on the tile.

import { Entity, TileContext } from '@/game/api';

export default function slippery(entity: Entity, _ctx: TileContext): void {
    // A fraction of the normal drag → the entity glides to a stop.
    entity.setDrag(entity.drag * 0.08, entity.drag * 0.08);
}

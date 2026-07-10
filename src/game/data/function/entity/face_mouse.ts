// Entity function: flips the sprite horizontally to face the mouse pointer.
// The pointer's screen position is converted to world space (via the camera)
// and compared to the entity's X. Assigned in player.json.

import { Entity, EntityContext } from '@/game/api';

export default function faceMouse(entity: Entity, _ctx: EntityContext): void {
    const scene = entity.scene;
    const pointer = scene.input.activePointer;
    // World X of the mouse (accounts for camera scroll and zoom).
    const worldX = scene.cameras.main.getWorldPoint(pointer.x, pointer.y).x;
    // Face right by default; flip when the mouse is to the left.
    entity.setFlipX(worldX < entity.x);
}

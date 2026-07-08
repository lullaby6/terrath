// Entity function: keyboard-controlled movement (arrow keys).
// Assigned in player.json → functions: ["player_movement"].

import { Entity, EntityContext, accelerate } from '@/game/api';

export default function playerMovement(entity: Entity, _ctx: EntityContext): void {
    // Cache the cursors in vars (createCursorKeys only once).
    if (!entity.vars.cursors) {
        entity.vars.cursors = entity.scene.input.keyboard!.createCursorKeys();
    }
    const cursors = entity.vars.cursors;

    let dx = 0;
    let dy = 0;
    if (cursors.left.isDown) dx -= 1;
    if (cursors.right.isDown) dx += 1;
    if (cursors.up.isDown) dy -= 1;
    if (cursors.down.isDown) dy += 1;
    accelerate(entity, dx, dy);
}

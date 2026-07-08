// Movement helpers shared by entity functions. They operate on an Entity
// using its Arcade physics body. Exposed via the modding API so functions in
// data/ can use them without reaching into internals.

import { Entity } from '@/game/entities/Entity';

// Accelerates the entity in direction (dx, dy) using its `acceleration`.
export function accelerate(entity: Entity, dx: number, dy: number): void {
    if (dx === 0 && dy === 0) {
        entity.setAcceleration(0, 0);
        return;
    }
    const len = Math.hypot(dx, dy);
    entity.setAcceleration((dx / len) * entity.acceleration, (dy / len) * entity.acceleration);
}

// Accelerates toward a world point. Returns true if already within tolerance px.
export function goTo(entity: Entity, x: number, y: number, tolerance = 4): boolean {
    const dx = x - entity.x;
    const dy = y - entity.y;
    if (Math.hypot(dx, dy) <= tolerance) {
        accelerate(entity, 0, 0);
        return true;
    }
    accelerate(entity, dx, dy);
    return false;
}

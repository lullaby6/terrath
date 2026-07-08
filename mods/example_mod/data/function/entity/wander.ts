// Example mod entity function: wanders in a slowly-changing direction.
// Reads the game API from the global Terrath (no static import at runtime).
import { Entity, EntityContext, accelerate } from '@/game/api';

export default function wander(entity: Entity, ctx: EntityContext): void {
    const v = entity.vars;
    if (v.wanderUntil === undefined || ctx.time > v.wanderUntil) {
        v.wanderUntil = ctx.time + 1000;
        v.wanderAngle = (v.wanderAngle ?? 0) + (Math.PI / 2);
    }
    accelerate(entity, Math.cos(v.wanderAngle), Math.sin(v.wanderAngle));
}

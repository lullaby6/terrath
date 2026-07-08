// Entity function: chases the nearest entity with a given tag using A*.
// Assigned in skeleton.json → functions: ["chase_target"] with attributes:
//   { "target_tag": "player", "follow_range": 300 }
// Zero hardcoding: a mod can make them chase something else by changing the tag.

import { Entity, EntityContext, findPath, hasLineOfSight, GridPoint, goTo, accelerate } from '@/game/api';

const REPATH_INTERVAL = 400; // ms between path recalculations

export default function chaseTarget(entity: Entity, ctx: EntityContext): void {
    const targetTag: string = entity.attributes.target_tag ?? 'player';
    const followRange: number = entity.attributes.follow_range ?? 0;
    const ts = ctx.world.tileSize;

    const target = ctx.world.nearestWithTag(targetTag, entity.x, entity.y);
    if (!target) {
        accelerate(entity, 0, 0);
        return;
    }

    // Only chase within follow range.
    const dist = Math.hypot(target.x - entity.x, target.y - entity.y);
    if (dist > followRange) {
        accelerate(entity, 0, 0);
        entity.vars.path = [];
        return;
    }

    const worldToTile = (px: number) => Math.floor(px / ts);
    const tileToWorld = (t: number) => t * ts + ts / 2;

    // Recalculate the path every REPATH_INTERVAL ms.
    if (ctx.time - (entity.vars.repathTimer ?? -Infinity) > REPATH_INTERVAL) {
        entity.vars.repathTimer = ctx.time;
        const start: GridPoint = { x: worldToTile(entity.x), y: worldToTile(entity.y) };
        const goal: GridPoint = { x: worldToTile(target.x), y: worldToTile(target.y) };
        const path = findPath(start, goal, ctx.world.isBlocked);
        entity.vars.path = path ?? [];
        // findPath includes the start tile in path[0]; skip it.
        entity.vars.pathIndex = (entity.vars.path.length > 1) ? 1 : 0;
    }

    const path: GridPoint[] = entity.vars.path ?? [];
    const pathIndex: number = entity.vars.pathIndex ?? 0;
    if (pathIndex >= path.length) {
        accelerate(entity, 0, 0);
        return;
    }

    // Path smoothing: aim for the furthest waypoint with line of sight.
    const myTile: GridPoint = { x: worldToTile(entity.x), y: worldToTile(entity.y) };
    let aim = pathIndex;
    for (let i = path.length - 1; i > pathIndex; i--) {
        if (hasLineOfSight(myTile, path[i], ctx.world.isBlocked)) {
            aim = i;
            break;
        }
    }

    const node = path[aim];
    const reached = goTo(entity, tileToWorld(node.x), tileToWorld(node.y), ts * 0.4);
    if (reached) entity.vars.pathIndex = aim + 1;
}

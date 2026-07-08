// A* on the infinite grid of world tiles.
// `isSolid(gx, gy)` indicates whether a tile blocks passage.

export interface GridPoint {
    x: number; // global tile coordinate
    y: number;
}

type SolidFn = (gx: number, gy: number) => boolean;

const key = (x: number, y: number) => `${x},${y}`;

// Neighbors in 8 directions (includes diagonals for more natural paths).
const DIRS = [
    { x: 1, y: 0, cost: 1 },
    { x: -1, y: 0, cost: 1 },
    { x: 0, y: 1, cost: 1 },
    { x: 0, y: -1, cost: 1 },
    { x: 1, y: 1, cost: Math.SQRT2 },
    { x: 1, y: -1, cost: Math.SQRT2 },
    { x: -1, y: 1, cost: Math.SQRT2 },
    { x: -1, y: -1, cost: Math.SQRT2 },
];

// Octile distance: admissible for 8-direction movement.
function heuristic(a: GridPoint, b: GridPoint): number {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

// Line of sight between two tiles (improved Bresenham): true if passable without
// cutting corners. Respects the rule: no diagonal passage between two solids.
// Used to smooth the path (skip waypoints reachable in a straight line).
export function hasLineOfSight(a: GridPoint, b: GridPoint, isSolid: SolidFn): boolean {
    let x0 = a.x, y0 = a.y;
    const x1 = b.x, y1 = b.y;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
        if (isSolid(x0, y0)) return false;
        if (x0 === x1 && y0 === y1) return true;

        const e2 = 2 * err;
        const moveX = e2 > -dy;
        const moveY = e2 < dx;

        // If moving diagonally, verify we don't cut a corner.
        if (moveX && moveY) {
            if (isSolid(x0 + sx, y0) || isSolid(x0, y0 + sy)) return false;
        }

        if (moveX) { err -= dy; x0 += sx; }
        if (moveY) { err += dx; y0 += sy; }
    }
}

// Returns the tile path from `start` to `goal` (inclusive), or null.
// `maxIterations` bounds the cost in the infinite world.
export function findPath(
    start: GridPoint,
    goal: GridPoint,
    isSolid: SolidFn,
    maxIterations = 400,
): GridPoint[] | null {
    if (isSolid(goal.x, goal.y)) return null;

    const open = new Map<string, GridPoint>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const cameFrom = new Map<string, string>();
    const nodes = new Map<string, GridPoint>();

    const startKey = key(start.x, start.y);
    open.set(startKey, start);
    nodes.set(startKey, start);
    gScore.set(startKey, 0);
    fScore.set(startKey, heuristic(start, goal));

    let iterations = 0;
    while (open.size > 0 && iterations++ < maxIterations) {
        // Open node with lowest fScore.
        let currentKey = '';
        let currentF = Infinity;
        for (const [k] of open) {
            const f = fScore.get(k) ?? Infinity;
            if (f < currentF) {
                currentF = f;
                currentKey = k;
            }
        }
        const current = open.get(currentKey)!;

        if (current.x === goal.x && current.y === goal.y) {
            return reconstruct(cameFrom, nodes, currentKey);
        }

        open.delete(currentKey);
        const currentG = gScore.get(currentKey) ?? Infinity;

        for (const d of DIRS) {
            const nx = current.x + d.x;
            const ny = current.y + d.y;
            if (isSolid(nx, ny)) continue;
            // Diagonally, don't cut corners: if either of the two adjacent orthogonal
            // tiles is solid, the diagonal is not passable.
            if (d.x !== 0 && d.y !== 0) {
                if (isSolid(current.x + d.x, current.y) || isSolid(current.x, current.y + d.y)) continue;
            }

            const nKey = key(nx, ny);
            const tentative = currentG + d.cost;
            if (tentative < (gScore.get(nKey) ?? Infinity)) {
                const node = { x: nx, y: ny };
                nodes.set(nKey, node);
                cameFrom.set(nKey, currentKey);
                gScore.set(nKey, tentative);
                fScore.set(nKey, tentative + heuristic(node, goal));
                if (!open.has(nKey)) open.set(nKey, node);
            }
        }
    }

    return null;
}

function reconstruct(
    cameFrom: Map<string, string>,
    nodes: Map<string, GridPoint>,
    endKey: string,
): GridPoint[] {
    const path: GridPoint[] = [];
    let k: string | undefined = endKey;
    while (k) {
        path.unshift(nodes.get(k)!);
        k = cameFrom.get(k);
    }
    return path;
}

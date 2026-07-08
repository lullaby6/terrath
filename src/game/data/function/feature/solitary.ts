// Feature function: solitary and scattered blocks (no groups).
// Uses deterministic random instead of Perlin noise.

export interface FeatureFunctionContext {
    density: number;
}

// Deterministic random by coordinate.
function hashRandom(gx: number, gy: number): number {
    let h = (gx * 374761393 + gy * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Appears randomly, without grouping (good for cacti, solitary trees, etc).
export default function solitary(gx: number, gy: number, ctx: FeatureFunctionContext): boolean {
    return hashRandom(gx, gy) < ctx.density;
}

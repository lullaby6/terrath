// Feature function: groups blocks into patches (Perlin noise).
// Exports a function that decides if a block should appear at (gx, gy).

import { PerlinNoise } from '@/game/api';

export interface FeatureFunctionContext {
    noise: PerlinNoise;
    scale: number;
    density: number;
}

// Appears where noise exceeds the threshold (in groups/patches).
export default function spreadGroup(gx: number, gy: number, ctx: FeatureFunctionContext): boolean {
    // Expand contrast so density is linear.
    const n = expand(ctx.noise.fractal(gx / ctx.scale, gy / ctx.scale, 2), 3);
    return n > 1 - ctx.density;
}

// Helper: expands contrast.
function expand(v: number, k: number): number {
    return Math.max(0, Math.min(1, (v - 0.5) * k + 0.5));
}

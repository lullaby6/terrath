// Feature function: patches that replace the floor (dark_grass, quicksand...).
// Groups into patches using Perlin noise, like spread_group, but used for
// floor-type features (not blocks). Separate so it can be tuned independently.

import { PerlinNoise } from '@/game/api';

export interface FeatureFunctionContext {
    noise: PerlinNoise;
    scale: number;
    density: number;
}

function expand(v: number, k: number): number {
    return Math.max(0, Math.min(1, (v - 0.5) * k + 0.5));
}

export default function patch(gx: number, gy: number, ctx: FeatureFunctionContext): boolean {
    const n = expand(ctx.noise.fractal(gx / ctx.scale, gy / ctx.scale, 2), 3);
    return n > 1 - ctx.density;
}

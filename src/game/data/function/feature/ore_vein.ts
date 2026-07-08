// Feature function for ore veins: small, sparse clusters. Unlike spread_group
// it does NOT expand contrast, so `density` maps to the raw noise threshold
// (density 0.02 = only the top 2% noise peaks appear). Combined with a small
// `scale`, this yields tiny clusters (a couple of tiles) that get rarer as
// density drops — ideal for gems like ruby/emerald.

import { PerlinNoise } from '@/game/api';

export interface FeatureFunctionContext {
    noise: PerlinNoise;
    scale: number;
    density: number;
}

export default function oreVein(gx: number, gy: number, ctx: FeatureFunctionContext): boolean {
    const n = ctx.noise.fractal(gx / ctx.scale, gy / ctx.scale, 2);
    return n > 1 - ctx.density;
}

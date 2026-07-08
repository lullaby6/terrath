// Feature function for rivers: winding connected lines instead of patches.
// Uses "ridged" noise — the places where the fractal crosses its midpoint form
// continuous serpentine contours. |noise - 0.5| < width picks a band around
// those crossings, giving natural river-like lines across the map.
//
// `density` controls the river width (a wider band = wider/longer rivers);
// `scale` controls how large and how gently the rivers meander.

import { PerlinNoise } from '@/game/api';

export interface FeatureFunctionContext {
    noise: PerlinNoise;
    scale: number;
    density: number;
}

export default function river(gx: number, gy: number, ctx: FeatureFunctionContext): boolean {
    const n = ctx.noise.fractal(gx / ctx.scale, gy / ctx.scale, 3);
    // Distance from the midpoint contour; small = on a river line.
    return Math.abs(n - 0.5) < ctx.density;
}

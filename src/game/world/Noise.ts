// Deterministic 2D Perlin noise seeded by a seed (world id).
// Based on Ken Perlin's classic implementation with a permutation table
// shuffled via a seeded PRNG (mulberry32) so the same id always generates
// the same world.

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
}

function grad(hash: number, x: number, y: number): number {
    // 8 gradients at the corners/edges of a square
    switch (hash & 7) {
        case 0: return x + y;
        case 1: return x - y;
        case 2: return -x + y;
        case 3: return -x - y;
        case 4: return x;
        case 5: return -x;
        case 6: return y;
        default: return -y;
    }
}

export class PerlinNoise {
    private perm: Uint8Array;

    constructor(seed: number) {
        const rand = mulberry32(seed);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        // Fisher-Yates shuffle with seeded PRNG
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            const tmp = p[i];
            p[i] = p[j];
            p[j] = tmp;
        }
        // Duplicated to avoid index overflow
        this.perm = new Uint8Array(512);
        for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }

    // Returns noise in the approximate range [-1, 1]
    noise(x: number, y: number): number {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);

        const u = fade(xf);
        const v = fade(yf);

        const p = this.perm;
        const aa = p[p[X] + Y];
        const ab = p[p[X] + Y + 1];
        const ba = p[p[X + 1] + Y];
        const bb = p[p[X + 1] + Y + 1];

        const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
        const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
        return lerp(x1, x2, v);
    }

    // Fractal noise (multiple octaves) normalized to [0, 1]
    fractal(x: number, y: number, octaves = 4, persistence = 0.5, lacunarity = 2): number {
        let amplitude = 1;
        let frequency = 1;
        let sum = 0;
        let max = 0;
        for (let i = 0; i < octaves; i++) {
            sum += this.noise(x * frequency, y * frequency) * amplitude;
            max += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        return (sum / max) * 0.5 + 0.5;
    }
}

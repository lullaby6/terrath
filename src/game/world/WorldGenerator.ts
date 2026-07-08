import { PerlinNoise } from './Noise';
import { TileDef } from '@/game/entities/Tile';
import { resolveId, FeatureFunction } from '@/game/api';

// Stretches a value [0,1] around 0.5 by a factor `k` and clips it.
function expand(v: number, k: number): number {
    return Math.max(0, Math.min(1, (v - 0.5) * k + 0.5));
}

// Tile name is a free string (the key of its .json in data/tile/).
// No hardcoded enum: adding a tile = creating a .json.
export type TileName = string;

// A height layer: uses tile `tile` for all height < `max`.
export interface NoiseLayer {
    tile: TileName;
    max: number;
}

// Config of a height noise file (e.g. noise/plains.json).
export interface NoiseConfig {
    scale: number;
    octaves: number;
    persistence: number;
    lacunarity: number;
    layers: NoiseLayer[];
}

// A feature: generation rule (data/feature/*.json). Places a `tile`
// above the floor (block) or replaces the floor (patch), depending on `function`.
export interface FeatureConfig {
    tile?: string;           // tile to place/use (block or replacement floor)
    on: string[];            // floors on which it can appear
    scale?: number;          // noise scale (for spread_group)
    density: number;         // fraction [0,1] of eligible area it covers
    function: string;        // feature function (spread_group, solitary, patch)
}

// Definition of a biome (data/biome/plains.json, etc.).
export interface SizeRange { min: number; max: number }

export interface BiomeDef {
    noise: string;        // reference to noise file (without extension)
    temperature: number;  // biome point on temperature axis [0,1]
    humidity: number;     // biome point on humidity axis [0,1]
    frequency: number;    // frequency of appearance
    size?: SizeRange;     // relative size of its regions (defaults to world.biomesSize)
    features?: string[];  // features (vegetation, rocks...) of this biome
}

// Global game config (config/game.json). Applies to ALL worlds
// (earth, heaven, hell...).
export interface GameConfig {
    tileSize: number;
    chunkSize: number;
    renderDistance: number;
}

// A single entity spawn described in a world config.
export interface SpawnDef {
    entity: string; // entity name/id to spawn
    x: number;
    y: number;
}

// Config of a specific world (world/earth.json). Unique to each world.
export interface WorldConfig {
    seed: number;
    climate: {
        temperatureScale: number;
        humidityScale: number;
        contrast: number; // expands the climate noise range (1 = no change)
    };
    biomesSize?: SizeRange; // default region size for biomes without their own
    biomes: string[];       // biome names to load
    spawns: SpawnDef[];     // entities to spawn when the world loads
}

// Fallback biome size if neither the biome nor the world config specify one.
const DEFAULT_BIOME_SIZE: SizeRange = { min: 1, max: 1 };

// A loaded feature with its own noise, bound to a biome.
interface LoadedFeature {
    config: FeatureConfig;
    isPatch: boolean;      // true = replaces floor; false = places block above
    tileName: string;      // resolved id of tile to place/use ("terrath:rock")
    on: string[];          // resolved ids of floors it can appear on
    noise: PerlinNoise;
    featureFunction: (gx: number, gy: number, ctx: any) => boolean;
}

interface LoadedBiome {
    name: string;
    def: BiomeDef;
    noise: NoiseConfig;
    heightNoise: PerlinNoise;
    weight: number; // appearance weight derived from frequency and size
    features: LoadedFeature[];
}

export class WorldGenerator {
    readonly config: WorldConfig;
    readonly gameConfig: GameConfig;
    private biomes: LoadedBiome[];
    private tileDefs: Record<string, TileDef>;
    private tempNoise: PerlinNoise;
    private humidNoise: PerlinNoise;

    constructor(
        config: WorldConfig,
        gameConfig: GameConfig,
        biomeConfigs: Record<string, BiomeDef>,
        noiseConfigs: Record<string, NoiseConfig>,
        featureConfigs: Record<string, FeatureConfig>,
        tileDefs: Record<string, TileDef>,
        featureFunctions: Record<string, FeatureFunction>,
    ) {
        this.config = config;
        this.gameConfig = gameConfig;
        this.tileDefs = tileDefs;

        // Derived seeds: each noise is independent but deterministic.
        this.tempNoise = new PerlinNoise(config.seed + 1);
        this.humidNoise = new PerlinNoise(config.seed + 2);

        // All refs in base content are resolved to full "terrath:id" ids here so
        // the hot path (sample) compares already-normalized ids. When mods land,
        // the loader will pass each def's own namespace as the resolve default.
        this.biomes = config.biomes.map((name, i) => {
            const def = biomeConfigs[resolveId(name)];
            // Size: biome's own, else the world default, else 1. Weight combines
            // frequency and average region size.
            const size = def.size ?? config.biomesSize ?? DEFAULT_BIOME_SIZE;
            const avgSize = (size.min + size.max) / 2;

            const features: LoadedFeature[] = (def.features ?? []).map((fname, fi) => {
                const fconfig = featureConfigs[resolveId(fname)];
                const tileName = fconfig.tile ? resolveId(fconfig.tile) : '';
                // It's a patch if its function is 'patch' or the tile is a floor.
                const isPatch = fconfig.function === 'patch'
                    || this.tileDefs[tileName]?.layer === 'floor';
                return {
                    config: fconfig,
                    isPatch,
                    tileName,
                    on: fconfig.on.map(t => resolveId(t)),
                    noise: new PerlinNoise(config.seed + 500 + i * 20 + fi),
                    featureFunction: featureFunctions[resolveId(fconfig.function)],
                };
            });

            return {
                name,
                def,
                noise: noiseConfigs[resolveId(def.noise)],
                heightNoise: new PerlinNoise(config.seed + 100 + i),
                weight: def.frequency * avgSize,
                features,
            };
        });
    }

    // Selects the biome based on local climate (temperature, humidity).
    // Distance in the T/H plane is divided by weight: a biome with more weight
    // "attracts" a larger area. Since biomes are at fixed points in the plane
    // and T/H are continuous and smooth, biomes at opposite corners
    // (desert hot+dry vs mountain cold+humid) are never adjacent.
    biomeAt(gx: number, gy: number): LoadedBiome {
        const { temperatureScale, humidityScale, contrast } = this.config.climate;
        // Fractal noise concentrates near 0.5; we expand contrast so temperature/humidity
        // use the full range [0,1] and corner biomes (desert, mountain) actually appear.
        const t = expand(this.tempNoise.fractal(gx / temperatureScale, gy / temperatureScale, 3), contrast);
        const h = expand(this.humidNoise.fractal(gx / humidityScale, gy / humidityScale, 3), contrast);

        let best = this.biomes[0];
        let bestScore = Infinity;
        for (const b of this.biomes) {
            const dt = t - b.def.temperature;
            const dh = h - b.def.humidity;
            const dist = (dt * dt + dh * dh) / b.weight;
            if (dist < bestScore) {
                bestScore = dist;
                best = b;
            }
        }
        return best;
    }

    private tileForHeight(biome: LoadedBiome, height: number): TileName {
        for (const layer of biome.noise.layers) {
            if (height < layer.max) return resolveId(layer.tile);
        }
        return resolveId(biome.noise.layers[biome.noise.layers.length - 1].tile);
    }

    // Base floor at global tile coordinates (can be negative).
    tileAt(gx: number, gy: number): TileName {
        const biome = this.biomeAt(gx, gy);
        return this.tileOf(biome, gx, gy);
    }

    private tileOf(biome: LoadedBiome, gx: number, gy: number): TileName {
        const c = biome.noise;
        const height = biome.heightNoise.fractal(gx / c.scale, gy / c.scale, c.octaves, c.persistence, c.lacunarity);
        return this.tileForHeight(biome, height);
    }

    // Does the feature `f` appear at (gx, gy)? (based on its featureFunction).
    private featureAppears(f: LoadedFeature, gx: number, gy: number): boolean {
        return f.featureFunction(gx, gy, {
            noise: f.noise,
            scale: f.config.scale,
            density: f.config.density,
        });
    }

    // Complete sampling of a tile. The process is:
    //   1. base floor from the biome's height noise;
    //   2. patches that REPLACE the floor;
    //   3. blocks that go ABOVE the floor (possibly already patched).
    // Returns tile names (ChunkManager resolves their TileDefs).
    sample(gx: number, gy: number): { floor: TileName; block: TileName | null } {
        const biome = this.biomeAt(gx, gy);
        let floor = this.tileOf(biome, gx, gy);

        // Phase 1 — patches: replace the floor. First one to apply wins.
        for (const f of biome.features) {
            if (!f.isPatch) continue;
            if (!f.on.includes(floor)) continue;
            if (this.featureAppears(f, gx, gy)) {
                floor = f.tileName;
                break;
            }
        }

        // A terrain block (e.g. water) can come straight from the height layers.
        // If the "floor" is actually a block with a `base`, split it: the base
        // becomes the floor and the block sits on top (sand under, water over).
        const floorDef = this.tileDefs[floor];
        if (floorDef?.layer === 'block' && floorDef.base) {
            return { floor: resolveId(floorDef.base), block: floor };
        }

        // Phase 2 — blocks: above the final floor. First one to apply wins.
        for (const f of biome.features) {
            if (f.isPatch) continue;
            if (!f.on.includes(floor)) continue;
            if (this.featureAppears(f, gx, gy)) {
                // If the placed block declares a `base` (e.g. water → sand),
                // that base replaces the floor beneath it too (lakes/rivers get
                // sand under the water, matching height-generated water).
                const blockDef = this.tileDefs[f.tileName];
                if (blockDef?.base) floor = resolveId(blockDef.base);
                return { floor, block: f.tileName };
            }
        }

        return { floor, block: null };
    }
}

import { Cameras } from 'phaser';
import { ParticleSystem } from './ParticleSystem';
import { ParticleSpawn } from '@/game/entities/Particle';

// A particle effect (data/particle/*.json): describes how to emit a small burst
// of particles at a point, given the emitter's facing direction. Fully
// data-driven so entities/tiles reference effects by name and mods can add more.
export interface ParticleEffectDef {
    count: number;            // particles per emission (or per foot for footprints)
    color: number | string;   // fill color ("#5a4632" or 0x5a4632)
    size: [number, number];    // [min, max] square size (px)
    alpha: number;             // start alpha
    alphaEnd?: number;         // end alpha (default 0 = fade out)
    scaleEnd?: number;         // end scale (default 1)
    lifetime: [number, number]; // [min, max] seconds
    speed?: [number, number];   // [min, max] px/s (0 = static, e.g. footprints)
    drag?: number;             // velocity damping per second
    spin?: number;             // max angular velocity (rad/s)
    // Direction mode of the emitted velocity:
    //   "static"  – no velocity (footprints stay put)
    //   "back"    – opposite the movement direction (dirt kicked backward)
    //   "radial"  – all directions (water splash)
    direction?: 'static' | 'back' | 'radial';
    // For footprints: lateral offset of the two feet from the center (px).
    footSpread?: number;
    // Emission timing (read by the walk emitter):
    //   continuous false (default) → one emission per "step" (every stepDist px)
    //   continuous true            → emits every frame at `rate` emissions/sec
    continuous?: boolean;
    rate?: number;   // emissions per second when continuous (default 20)
    depth: number;
}

// Deterministic-free small random helpers (particles need not be deterministic).
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const toColor = (c: number | string) =>
    typeof c === 'number' ? c : parseInt(c.replace('#', ''), 16);

// Emits one instance of an effect at (x, y). `dirX, dirY` is the emitter's
// (normalized) movement direction, used by "back" mode. Off-screen emissions
// are skipped entirely — no point spending pool/CPU on particles nobody sees.
export function emitEffect(
    system: ParticleSystem,
    def: ParticleEffectDef,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    camera: Cameras.Scene2D.Camera,
): void {
    // Cull: skip if the emission point is outside the camera view (+ margin so
    // fast particles heading into view aren't wrongly dropped).
    const m = 64;
    const v = camera.worldView;
    if (x < v.x - m || x > v.right + m || y < v.y - m || y > v.bottom + m) return;

    const color = toColor(def.color);
    const mode = def.direction ?? 'static';

    // Footprints: two static squares offset left/right of the facing line.
    if (mode === 'static' && def.footSpread) {
        const perpX = -dirY, perpY = dirX; // perpendicular to movement
        for (const side of [-1, 1]) {
            spawnOne(system, def, color,
                x + perpX * def.footSpread * side,
                y + perpY * def.footSpread * side,
                0, 0);
        }
        return;
    }

    for (let i = 0; i < def.count; i++) {
        let vx = 0, vy = 0;
        if (def.speed) {
            const spd = rand(def.speed[0], def.speed[1]);
            if (mode === 'back') {
                // Backward from movement, with a bit of spread.
                const a = Math.atan2(-dirY, -dirX) + rand(-0.5, 0.5);
                vx = Math.cos(a) * spd; vy = Math.sin(a) * spd;
            } else if (mode === 'radial') {
                const a = rand(0, Math.PI * 2);
                vx = Math.cos(a) * spd; vy = Math.sin(a) * spd;
            }
        }
        spawnOne(system, def, color, x, y, vx, vy);
    }
}

function spawnOne(
    system: ParticleSystem, def: ParticleEffectDef, color: number,
    x: number, y: number, vx: number, vy: number,
): void {
    const size = rand(def.size[0], def.size[1]);
    const props: ParticleSpawn = {
        x, y, size, color,
        alpha: def.alpha,
        rotation: rand(0, Math.PI * 2),
        vx, vy,
        drag: def.drag ?? 0,
        angularVelocity: def.spin ? rand(-def.spin, def.spin) : 0,
        lifetime: rand(def.lifetime[0], def.lifetime[1]),
        scaleEnd: def.scaleEnd ?? 1,
        alphaEnd: def.alphaEnd ?? 0,
        // depth = the particle's Y plus the config offset, so it Y-sorts with
        // entities (a small negative offset keeps footprints just under feet).
        depth: y + def.depth,
    };
    system.emit(props);
}

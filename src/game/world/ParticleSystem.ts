import { Scene, Scenes } from 'phaser';
import { Particle, ParticleSpawn } from '@/game/entities/Particle';

// Pooled particle manager. Pre-creates a fixed pool of Particle objects and
// recycles inactive ones via a free-list (O(1) acquire), so we never
// allocate/destroy at runtime. It ticks itself on the scene UPDATE event.
// Sizes come from config/particles.json.

export interface ParticleSystemConfig {
    poolSize: number;   // total particles pre-created
    maxActive: number;  // cap on simultaneously active particles
}

export class ParticleSystem {
    private pool: Particle[] = [];
    private freeList: Particle[] = [];
    private active = 0;
    private maxActive: number;

    constructor(scene: Scene, config: ParticleSystemConfig) {
        this.maxActive = config.maxActive;
        for (let i = 0; i < config.poolSize; i++) {
            const p = new Particle(scene);
            this.pool.push(p);
            this.freeList.push(p);
        }
        scene.events.on(Scenes.Events.UPDATE, this.tick, this);
        scene.events.once(Scenes.Events.SHUTDOWN, this.cleanup, this);
        scene.events.once(Scenes.Events.DESTROY, this.cleanup, this);
    }

    // Spawns one particle from the pool (no-op if the pool/cap is exhausted).
    emit(props: ParticleSpawn): void {
        if (this.active >= this.maxActive) return;
        let p: Particle | undefined;
        while ((p = this.freeList.pop())) {
            if (!p.active) break; // found a truly-free one
        }
        if (!p) return;
        p.spawn(props);
        this.active++;
    }

    private tick(_time: number, delta: number): void {
        const dt = delta / 1000; // Particle.tick works in seconds
        let count = 0;
        for (const p of this.pool) {
            if (!p.active) continue;
            p.tick(dt);
            if (p.active) count++;
            else this.freeList.push(p); // just died → reusable
        }
        this.active = count;
    }

    private cleanup(): void {
        this.pool = [];
        this.freeList = [];
    }
}

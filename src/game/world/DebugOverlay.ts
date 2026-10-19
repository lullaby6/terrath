import { Scene, GameObjects, Physics, Core, WEBGL } from 'phaser';
import { ChunkManager } from './ChunkManager';
import { DayNightCycle } from './DayNightCycle';
import { ParticleSystem } from './ParticleSystem';
import { Entity } from '@/game/entities/Entity';

export interface DebugConfig {
    toggleKey: string;
    startEnabled: boolean;
    refreshMs: number;
    showHitboxes: boolean;
    showChunkBorders: boolean;
}

export interface DebugSources {
    chunks: ChunkManager;
    particles: ParticleSystem;
    entities: () => Entity[];
    focus: () => Entity | undefined;
    dayNight?: DayNightCycle;
    seed: number;
}

const BORDER_DEPTH = 1_999_999_000;

export class DebugOverlay {
    private scene: Scene;
    private config: DebugConfig;
    private src: DebugSources;
    private enabled = false;
    private panel: HTMLDivElement;
    private borders: GameObjects.Graphics;

    private sinceRefresh = 0;
    private frames = 0;
    private worstDelta = 0;
    private stepStart = 0;
    private cpuTotal = 0;
    private cpuWorst = 0;

    constructor(scene: Scene, config: DebugConfig, src: DebugSources) {
        this.scene = scene;
        this.config = config;
        this.src = src;

        this.panel = document.createElement('div');
        Object.assign(this.panel.style, {
            position: 'fixed',
            zIndex: '1000',
            pointerEvents: 'none',
            padding: '6px 8px',
            background: 'rgba(0, 0, 0, 0.6)',
            color: '#e8e8e8',
            font: '12px/1.35 monospace',
            whiteSpace: 'pre',
            display: 'none',
        });
        document.body.appendChild(this.panel);

        this.borders = scene.add.graphics();
        this.borders.setDepth(BORDER_DEPTH);

        scene.input.keyboard!.on(`keydown-${config.toggleKey}`, this.toggle, this);
        scene.game.events.on(Core.Events.PRE_STEP, this.onPreStep, this);
        scene.game.events.on(Core.Events.POST_RENDER, this.onPostRender, this);
        scene.events.once('shutdown', this.destroy, this);
        scene.events.once('destroy', this.destroy, this);

        if (config.startEnabled) this.toggle();
    }

    toggle(): void {
        this.enabled = !this.enabled;
        this.panel.style.display = this.enabled ? 'block' : 'none';
        this.setHitboxes(this.enabled && this.config.showHitboxes);
        if (!this.enabled) this.borders.clear();
        this.sinceRefresh = this.config.refreshMs;
    }

    private onPreStep(): void {
        this.stepStart = performance.now();
    }

    private onPostRender(): void {
        if (!this.enabled) return;
        const ms = performance.now() - this.stepStart;
        this.cpuTotal += ms;
        this.cpuWorst = Math.max(this.cpuWorst, ms);
    }

    private setHitboxes(on: boolean): void {
        const world = this.scene.physics.world;
        if (on && !world.debugGraphic) world.createDebugGraphic();
        world.drawDebug = on;
        if (world.debugGraphic) {
            world.debugGraphic.setDepth(BORDER_DEPTH + 1);
            if (!on) world.debugGraphic.clear();
        }
    }

    update(delta: number): void {
        if (!this.enabled) return;
        this.frames++;
        this.worstDelta = Math.max(this.worstDelta, delta);
        this.sinceRefresh += delta;

        if (this.config.showChunkBorders) this.drawChunkBorders();

        if (this.sinceRefresh >= this.config.refreshMs) {
            this.panel.textContent = this.buildText();
            this.positionPanel();
            this.sinceRefresh = 0;
            this.frames = 0;
            this.worstDelta = 0;
            this.cpuTotal = 0;
            this.cpuWorst = 0;
        }
    }

    private drawChunkBorders(): void {
        const g = this.borders;
        const size = this.src.chunks.chunkPx;
        g.clear();
        g.lineStyle(1, 0xffff00, 0.6);
        for (const { cx, cy } of this.src.chunks.loadedChunks()) {
            g.strokeRect(cx * size, cy * size, size, size);
        }
    }

    private positionPanel(): void {
        const rect = this.scene.game.canvas.getBoundingClientRect();
        this.panel.style.left = `${rect.left + 4}px`;
        this.panel.style.top = `${rect.top + 4}px`;
    }

    private buildText(): string {
        const game = this.scene.game;
        const world = this.scene.physics.world;
        const cam = this.scene.cameras.main;
        const { chunks, particles } = this.src;
        const avgMs = this.sinceRefresh / Math.max(1, this.frames);
        const lines: string[] = [];

        lines.push(`FPS ${game.loop.actualFps.toFixed(0)}  (avg ${avgMs.toFixed(1)} ms, worst ${this.worstDelta.toFixed(1)} ms)`);
        lines.push(`CPU ${(this.cpuTotal / Math.max(1, this.frames)).toFixed(1)} ms/frame  (worst ${this.cpuWorst.toFixed(1)} ms)`);
        const mem = (performance as any).memory;
        if (mem) lines.push(`Heap ${(mem.usedJSHeapSize / 1048576).toFixed(0)} / ${(mem.jsHeapSizeLimit / 1048576).toFixed(0)} MB`);
        lines.push(`Renderer ${game.renderer.type === WEBGL ? 'WebGL' : 'Canvas'}  ${game.scale.width}x${game.scale.height}`);
        lines.push('');

        const s = chunks.stats();
        const all = this.src.entities();
        const alive = all.filter(e => e.active).length;
        lines.push(`Chunks ${s.chunks}  Tiles ${s.tiles}  Solid blocks ${s.solids}`);
        lines.push(`Entities ${alive} / ${all.length}`);
        lines.push(`Particles ${particles.activeCount} / ${particles.poolSize}`);
        lines.push(`Display list ${this.scene.children.length}  Bodies ${world.bodies.size} dyn, ${world.staticBodies.size} static`);
        lines.push('');

        const f = this.src.focus();
        if (f) {
            const ts = chunks.tileSize;
            const body = f.body as Physics.Arcade.Body;
            const { floorName, blockName } = chunks.tilesAt(f.x, f.y);
            lines.push(`Pos ${f.x.toFixed(1)}, ${f.y.toFixed(1)}`);
            lines.push(`Tile ${Math.floor(f.x / ts)}, ${Math.floor(f.y / ts)}  Chunk ${chunks.worldToChunk(f.x)}, ${chunks.worldToChunk(f.y)}`);
            lines.push(`Velocity ${body.velocity.length().toFixed(1)} / ${body.maxSpeed.toFixed(0)} px/s`);
            lines.push(`HP ${f.health} / ${f.maxHealth}`);
            lines.push(`Biome ${chunks.biomeAt(f.x, f.y)}`);
            lines.push(`Floor ${floorName}  Block ${blockName ?? '-'}`);
            lines.push('');
        }

        lines.push(`Camera ${cam.scrollX.toFixed(0)}, ${cam.scrollY.toFixed(0)}  zoom ${cam.zoom}`);
        const dn = this.src.dayNight?.state;
        if (dn) lines.push(`${dn.isDay ? 'Day' : 'Night'} ${(dn.progress * 100).toFixed(0)}%  darkness ${dn.darkness.toFixed(2)}`);
        lines.push(`Seed ${this.src.seed}`);
        lines.push(`[${this.config.toggleKey}] toggle debug`);

        return lines.join('\n');
    }

    private destroy(): void {
        this.scene.input.keyboard?.off(`keydown-${this.config.toggleKey}`, this.toggle, this);
        this.scene.game.events.off(Core.Events.PRE_STEP, this.onPreStep, this);
        this.scene.game.events.off(Core.Events.POST_RENDER, this.onPostRender, this);
        this.panel.remove();
    }
}

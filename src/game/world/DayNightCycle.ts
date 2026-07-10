import { Scene, GameObjects, Display } from 'phaser';
import { DayNightConfig } from './WorldGenerator';

// A full-screen darkening overlay whose opacity follows a day/night cycle.
// The overlay is a rectangle pinned to the camera (scrollFactor 0) at a very
// high depth, so it tints everything. Its alpha eases from 0 at midday up to
// `nightAlpha` at midnight, with smooth dawn/dusk transitions.

const OVERLAY_DEPTH = 2_000_000_000; // above every Y-sorted object

export class DayNightCycle {
    private scene: Scene;
    private config: DayNightConfig;
    private overlay: GameObjects.Rectangle;
    private cycleLength: number;
    private elapsed = 0;

    constructor(scene: Scene, config: DayNightConfig) {
        this.scene = scene;
        this.config = config;
        this.cycleLength = config.dayDuration + config.nightDuration;

        const cam = scene.cameras.main;
        this.overlay = scene.add.rectangle(
            0, 0, cam.width, cam.height,
            Display.Color.HexStringToColor(config.nightColor).color,
            1,
        );
        this.overlay.setOrigin(0, 0);
        this.overlay.setScrollFactor(0);   // pinned to the camera
        this.overlay.setDepth(OVERLAY_DEPTH);
        this.overlay.setAlpha(0);

        // Keep it covering the screen if the game is resized.
        scene.scale.on('resize', this.resize, this);
    }

    private resize(gameSize: { width: number; height: number }): void {
        this.overlay.setSize(gameSize.width, gameSize.height);
    }

    // Advances the cycle and updates the overlay opacity.
    update(delta: number): void {
        this.elapsed = (this.elapsed + delta) % this.cycleLength;
        this.overlay.setAlpha(this.darknessAt(this.elapsed));
    }

    // Darkness [0, nightAlpha] over the cycle: 0 during day, easing up through
    // dusk to nightAlpha across night, easing back down through dawn.
    private darknessAt(t: number): number {
        const { dayDuration, nightDuration, nightAlpha } = this.config;
        if (t < dayDuration) {
            // Day: dark only near the very end (dusk ramp over the last 20%).
            const duskStart = dayDuration * 0.8;
            if (t < duskStart) return 0;
            const k = (t - duskStart) / (dayDuration - duskStart); // 0..1
            return ease(k) * nightAlpha;
        }
        // Night: full dark, easing back to 0 over the last 20% (dawn ramp).
        const nt = t - dayDuration;
        const dawnStart = nightDuration * 0.8;
        if (nt < dawnStart) return nightAlpha;
        const k = (nt - dawnStart) / (nightDuration - dawnStart); // 0..1
        return (1 - ease(k)) * nightAlpha;
    }
}

// Smoothstep easing for gentle dawn/dusk transitions.
function ease(k: number): number {
    return k * k * (3 - 2 * k);
}

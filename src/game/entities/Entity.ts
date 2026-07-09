import { Scene, Physics } from 'phaser';

// Entity definition, loaded from data/entity/*.json.
export interface EntityStats {
    sprite: string;       // texture key
    health: number;
    speed: number;        // max speed (px/s)
    acceleration: number; // how fast it reaches max speed
    drag: number;         // friction: how fast it decelerates (momentum)
    scale: number;
    bodyScale?: number;   // hitbox size relative to the texture (default 0.9), so
                          // an entity fits through a 1-tile gap between solids
    attackDamage: number;
    tags?: string[];              // labels for filtering/targeting (e.g. "player", "enemy")
    functions?: string[];         // behavior functions run each frame, by name
    attributes?: Record<string, any>; // free-form params read by functions
}

// World services that entity functions may need. The scene provides it, so
// functions don't depend on the concrete scene.
export interface EntityWorld {
    tileSize: number;
    isBlocked: (gx: number, gy: number) => boolean;
    // Nearest live entity with the given tag (or null).
    nearestWithTag: (tag: string, fromX: number, fromY: number) => Entity | null;
}

// Context passed to each entity function on update.
export interface EntityContext {
    time: number;   // current ms
    delta: number;  // ms since previous frame
    world: EntityWorld;
}

// Signature of an entity function (data/function/*.ts).
export type EntityFunction = (entity: Entity, ctx: EntityContext) => void;

// Generic game entity. It's a MINIMAL container: only data (stats, tags,
// attributes) and physics. It has NO behavior logic — all of that (movement,
// AI, attack...) lives in data/function/ and operates on the entity via its
// public physics methods (inherited from Arcade.Sprite) and `vars`.
// A mod adds new enemies with just a .json + optionally a new function,
// without touching this class.
export class Entity extends Physics.Arcade.Sprite {
    maxHealth: number;
    health: number;
    speed: number;
    acceleration: number;
    drag: number;
    attackDamage: number;

    readonly tags: string[];
    readonly attributes: Record<string, any>;
    private behaviors: EntityFunction[];

    // Free-form state for functions to use (paths, timers, etc).
    readonly vars: Record<string, any> = {};

    constructor(scene: Scene, x: number, y: number, stats: EntityStats, behaviors: EntityFunction[]) {
        super(scene, x, y, stats.sprite);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.maxHealth = stats.health;
        this.health = stats.health;
        this.speed = stats.speed;
        this.acceleration = stats.acceleration;
        this.drag = stats.drag;
        this.attackDamage = stats.attackDamage;

        this.tags = stats.tags ?? [];
        this.attributes = stats.attributes ?? {};
        this.behaviors = behaviors;

        this.setScale(stats.scale);
        this.setDrag(stats.drag, stats.drag);        // friction → momentum
        // maxSpeed caps the velocity MAGNITUDE (not per-axis), so diagonal
        // movement isn't faster than orthogonal.
        this.setMaxSpeed(stats.speed);

        // Shrink the hitbox relative to the texture and re-center it, so the
        // entity can slip through a gap exactly one tile wide between solids.
        const bodyScale = stats.bodyScale ?? 0.9;
        this.body!.setSize(this.width * bodyScale, this.height * bodyScale, true);
    }

    // Caps the total speed (velocity magnitude), keeping diagonal == orthogonal.
    setMaxSpeed(speed: number): void {
        (this.body as Physics.Arcade.Body).maxSpeed = speed;
    }

    hasTag(tag: string): boolean {
        return this.tags.includes(tag);
    }

    get isAlive(): boolean {
        return this.health > 0;
    }

    // Runs all of this entity's behavior functions.
    update(ctx: EntityContext): void {
        for (const fn of this.behaviors) fn(this, ctx);
    }
}

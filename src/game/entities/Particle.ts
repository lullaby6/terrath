import { GameObjects, Scene } from 'phaser'

export type ParticleSpawn = {
    x: number
    y: number
    size: number
    color: number
    alpha: number
    rotation: number
    vx: number
    vy: number
    drag: number
    angularVelocity: number
    lifetime: number
    scaleEnd: number
    alphaEnd: number
    depth: number
}

export class Particle extends GameObjects.Rectangle {
    private vx = 0
    private vy = 0
    private dragFactor = 0
    private angularVel = 0
    private lifetime = 0
    private age = 0
    private scaleEnd = 1
    private baseAlpha = 1
    private alphaEnd = 0

    constructor(scene: Scene) {
        super(scene, 0, 0, 1, 1, 0xffffff, 1)
        scene.add.existing(this)
        this.setActive(false)
        this.setVisible(false)
    }

    spawn(props: ParticleSpawn) {
        this.setPosition(props.x, props.y)
        this.setSize(props.size, props.size)
        this.setScale(1)
        this.fillColor = props.color
        this.fillAlpha = props.alpha
        this.rotation = props.rotation
        this.setDepth(props.depth)

        this.vx = props.vx
        this.vy = props.vy
        this.dragFactor = props.drag
        this.angularVel = props.angularVelocity
        this.lifetime = props.lifetime
        this.age = 0
        this.scaleEnd = props.scaleEnd
        this.baseAlpha = props.alpha
        this.alphaEnd = props.alphaEnd

        this.setActive(true)
        this.setVisible(true)
    }

    tick(dt: number) {
        if (!this.active) return

        this.age += dt
        if (this.age >= this.lifetime) {
            this.setActive(false)
            this.setVisible(false)
            return
        }

        this.x += this.vx * dt
        this.y += this.vy * dt

        if (this.dragFactor > 0) {
            const factor = Math.max(0, 1 - this.dragFactor * dt)
            this.vx *= factor
            this.vy *= factor
        }

        this.rotation += this.angularVel * dt

        const t = this.age / this.lifetime
        const scale = 1 + (this.scaleEnd - 1) * t
        this.setScale(scale)
        this.fillAlpha = this.baseAlpha + (this.alphaEnd - this.baseAlpha) * t
    }
}

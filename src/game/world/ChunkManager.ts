import { Scene } from 'phaser';
import { WorldGenerator } from './WorldGenerator';
import { Tile, SolidBlock, TileDef, FLOOR_DEPTH, SMALL_BLOCK_DEPTH } from '@/game/entities/Tile';

const chunkKey = (cx: number, cy: number) => `${cx},${cy}`;

// A loaded chunk: the container with visual tiles, plus references to SolidBlocks
// (which live in the scene, not in the container, so their physics bodies
// use world coordinates).
interface LoadedChunk {
    container: Phaser.GameObjects.Container;
    solids: SolidBlock[];
}

// A chunk is a grid of chunkSize x chunkSize tiles, rendered inside
// a Container positioned in world coordinates.
export class ChunkManager {
    private scene: Scene;
    private generator: WorldGenerator;
    private tileDefs: Record<string, TileDef>;
    private solidBlocksGroup: Phaser.Physics.Arcade.StaticGroup;
    private loaded = new Map<string, LoadedChunk>();

    private chunkSize: number;
    readonly tileSize: number;
    private renderDistance: number;

    constructor(
        scene: Scene,
        generator: WorldGenerator,
        tileDefs: Record<string, TileDef>,
        solidBlocksGroup: Phaser.Physics.Arcade.StaticGroup,
    ) {
        this.scene = scene;
        this.generator = generator;
        this.tileDefs = tileDefs;
        this.solidBlocksGroup = solidBlocksGroup;
        this.chunkSize = generator.gameConfig.chunkSize;
        this.tileSize = generator.gameConfig.tileSize;
        this.renderDistance = generator.gameConfig.renderDistance;
    }

    // PHYSICAL collision: blocks if the floor or block above is solid.
    isSolid(gx: number, gy: number): boolean {
        const { floor, block } = this.generator.sample(gx, gy);
        return (this.tileDefs[floor]?.solid ?? false)
            || (block ? (this.tileDefs[block]?.solid ?? false) : false);
    }

    // PATHFINDING: avoids solids AND tiles with the avoid flag (water). The
    // block above counts too, so a non-solid water block is still avoided.
    isBlocked(gx: number, gy: number): boolean {
        const { floor, block } = this.generator.sample(gx, gy);
        const f = this.tileDefs[floor];
        const b = block ? this.tileDefs[block] : undefined;
        return (f?.solid ?? false) || (f?.avoid ?? false)
            || (b?.solid ?? false) || (b?.avoid ?? false);
    }

    // Speed multiplier at a world position: the block above (e.g. water) takes
    // precedence over the floor, since the entity is "in" it.
    speedFactorAt(px: number, py: number): number {
        const { floorDef, blockDef } = this.tilesAt(px, py);
        return blockDef?.speedFactor ?? floorDef?.speedFactor ?? 1;
    }

    // The floor and block TileDefs (plus the block id) at a world position.
    tilesAt(px: number, py: number): { floorDef?: TileDef; blockDef?: TileDef; blockName: string | null } {
        const gx = Math.floor(px / this.tileSize);
        const gy = Math.floor(py / this.tileSize);
        const { floor, block } = this.generator.sample(gx, gy);
        return {
            floorDef: this.tileDefs[floor],
            blockDef: block ? this.tileDefs[block] : undefined,
            blockName: block,
        };
    }

    // Chunk coordinate that contains a world position in px.
    private worldToChunk(px: number): number {
        return Math.floor(px / (this.chunkSize * this.tileSize));
    }

    private createChunk(cx: number, cy: number): LoadedChunk {
        const originX = cx * this.chunkSize * this.tileSize;
        const originY = cy * this.chunkSize * this.tileSize;
        const container = this.scene.add.container(originX, originY);
        // The whole ground layer (floors + small blocks) sits far below any
        // Y-sorted object, so entities/trees always draw on top regardless of
        // their world Y (which can be large and negative in an infinite world).
        container.setDepth(FLOOR_DEPTH);
        const solids: SolidBlock[] = [];

        const half = this.tileSize / 2;
        for (let ly = 0; ly < this.chunkSize; ly++) {
            for (let lx = 0; lx < this.chunkSize; lx++) {
                const gx = cx * this.chunkSize + lx;
                const gy = cy * this.chunkSize + ly;
                const { floor: floorName, block: blockName } = this.generator.sample(gx, gy);
                const floorDef = this.tileDefs[floorName];
                // Local coordinates (within the container) and world coordinates.
                const px = lx * this.tileSize + half;
                const py = ly * this.tileSize + half;

                // Floor: a Tile inside the container (depth is local: 0 = below
                // the container's small blocks; the container sits at FLOOR_DEPTH).
                if (floorDef) {
                    const floor = new Tile(this.scene, px, py, this.tileSize, floorDef, gx, gy);
                    floor.setDepth(0);
                    container.add(floor);
                }

                // Block above the floor.
                if (blockName) {
                    const blockDef = this.tileDefs[blockName];
                    if (blockDef) {
                        const big = (blockDef.size ?? 1) > 1;
                        if (blockDef.solid) {
                            // SolidBlock: goes DIRECTLY to the scene in world coordinates
                            // (not in the container) so its physics body works correctly.
                            const worldY = originY + py;
                            const block = new SolidBlock(this.scene, originX + px, worldY, this.tileSize, blockDef, gx, gy);
                            // Big sprites (trees) Y-sort with entities (depth = world Y);
                            // small solids sit just above the ground layer.
                            block.setDepth(big ? worldY : SMALL_BLOCK_DEPTH + 1);
                            this.solidBlocksGroup.add(block);
                            solids.push(block);
                        } else {
                            // Decorative block: inside the container (local depth 1).
                            const block = new Tile(this.scene, px, py, this.tileSize, blockDef, gx, gy);
                            block.setDepth(1);
                            container.add(block);
                        }
                    }
                }
            }
        }
        return { container, solids };
    }

    // Loads visible chunks around the camera and unloads distant ones.
    update(): void {
        const cam = this.scene.cameras.main;
        const centerX = cam.scrollX + cam.width / 2;
        const centerY = cam.scrollY + cam.height / 2;
        const ccx = this.worldToChunk(centerX);
        const ccy = this.worldToChunk(centerY);
        const r = this.renderDistance;

        const needed = new Set<string>();

        // Load chunks within render distance radius.
        for (let cy = ccy - r; cy <= ccy + r; cy++) {
            for (let cx = ccx - r; cx <= ccx + r; cx++) {
                const key = chunkKey(cx, cy);
                needed.add(key);
                if (!this.loaded.has(key)) {
                    this.loaded.set(key, this.createChunk(cx, cy));
                }
            }
        }

        // Unload chunks outside the radius: destroy container and SolidBlocks.
        for (const [key, chunk] of this.loaded) {
            if (!needed.has(key)) {
                chunk.container.destroy(true);
                for (const solid of chunk.solids) solid.destroy();
                this.loaded.delete(key);
            }
        }
    }
}

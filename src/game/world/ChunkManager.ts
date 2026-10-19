import { Scene, Textures } from 'phaser';
import { WorldGenerator } from './WorldGenerator';
import { Tile, SolidBlock, TileDef, FLOOR_DEPTH, SMALL_BLOCK_DEPTH, tileLook } from '@/game/entities/Tile';

const chunkKey = (cx: number, cy: number) => `${cx},${cy}`;

interface LoadedChunk {
    ground: Phaser.GameObjects.RenderTexture;
    tiles: number;
    extras: Tile[];
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
    tilesAt(px: number, py: number): {
        floorDef?: TileDef; blockDef?: TileDef; floorName: string; blockName: string | null;
    } {
        const gx = Math.floor(px / this.tileSize);
        const gy = Math.floor(py / this.tileSize);
        const { floor, block } = this.generator.sample(gx, gy);
        return {
            floorDef: this.tileDefs[floor],
            blockDef: block ? this.tileDefs[block] : undefined,
            floorName: floor,
            blockName: block,
        };
    }

    biomeAt(px: number, py: number): string {
        return this.generator.biomeAt(Math.floor(px / this.tileSize), Math.floor(py / this.tileSize)).name;
    }

    get chunkPx(): number {
        return this.chunkSize * this.tileSize;
    }

    loadedChunks(): { cx: number; cy: number }[] {
        const out: { cx: number; cy: number }[] = [];
        for (const key of this.loaded.keys()) {
            const [cx, cy] = key.split(',').map(Number);
            out.push({ cx, cy });
        }
        return out;
    }

    stats(): { chunks: number; tiles: number; solids: number } {
        let tiles = 0, solids = 0;
        for (const chunk of this.loaded.values()) {
            tiles += chunk.tiles;
            solids += chunk.solids.length;
        }
        return { chunks: this.loaded.size, tiles, solids };
    }

    // Chunk coordinate that contains a world position in px.
    worldToChunk(px: number): number {
        return Math.floor(px / (this.chunkSize * this.tileSize));
    }

    private createChunk(cx: number, cy: number): LoadedChunk {
        const originX = cx * this.chunkSize * this.tileSize;
        const originY = cy * this.chunkSize * this.tileSize;
        const chunkPx = this.chunkPx;
        const ground = this.scene.add.renderTexture(originX, originY, chunkPx, chunkPx);
        ground.texture.setWrap(Textures.WrapMode.CLAMP_TO_EDGE);
        ground.setOrigin(0, 0);
        // The whole ground layer (floors + small blocks) sits far below any
        // Y-sorted object, so entities/trees always draw on top regardless of
        // their world Y (which can be large and negative in an infinite world).
        ground.setDepth(FLOOR_DEPTH);
        const solids: SolidBlock[] = [];
        const extras: Tile[] = [];
        const decorations: { def: TileDef; px: number; py: number; gx: number; gy: number }[] = [];
        let tiles = 0;

        const half = this.tileSize / 2;
        for (let ly = 0; ly < this.chunkSize; ly++) {
            for (let lx = 0; lx < this.chunkSize; lx++) {
                const gx = cx * this.chunkSize + lx;
                const gy = cy * this.chunkSize + ly;
                const { floor: floorName, block: blockName } = this.generator.sample(gx, gy);
                const floorDef = this.tileDefs[floorName];
                const px = lx * this.tileSize + half;
                const py = ly * this.tileSize + half;

                if (floorDef) {
                    this.stampTile(ground, floorDef, px, py, gx, gy);
                    tiles++;
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
                        } else if (big) {
                            const block = new Tile(this.scene, originX + px, originY + py, this.tileSize, blockDef, gx, gy);
                            block.setDepth(SMALL_BLOCK_DEPTH);
                            extras.push(block);
                        } else {
                            decorations.push({ def: blockDef, px, py, gx, gy });
                        }
                    }
                }
            }
        }

        for (const d of decorations) {
            this.stampTile(ground, d.def, d.px, d.py, d.gx, d.gy);
            tiles++;
        }
        ground.render();

        return { ground, tiles, extras, solids };
    }

    private stampTile(
        target: Phaser.GameObjects.RenderTexture, def: TileDef, px: number, py: number, gx: number, gy: number,
    ): void {
        const look = tileLook(def, gx, gy);
        const frame = this.scene.textures.getFrame(look.key);
        if (!frame) return;
        target.stamp(look.key, undefined, px, py, {
            scaleX: (this.tileSize / frame.width) * (look.flipX ? -1 : 1),
            scaleY: (this.tileSize / frame.height) * (look.flipY ? -1 : 1),
            angle: look.angle,
        });
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
                chunk.ground.destroy();
                for (const extra of chunk.extras) extra.destroy();
                for (const solid of chunk.solids) solid.destroy();
                this.loaded.delete(key);
            }
        }
    }
}

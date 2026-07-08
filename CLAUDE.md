# Terrath - Code Guidelines

## Language Policy

**All code comments must be in English.**

This includes:
- Inline comments (`// ...`)
- Block comments (`/* ... */`)
- JSDoc/TSDoc comments (`/** ... */`)
- TODO/FIXME comments

### Examples

✅ Correct:
```typescript
// Load chunks within render distance.
const needed = new Set<string>();

/* Convert world coordinates to chunk coordinates. */
private worldToChunk(px: number): number {
```

❌ Incorrect:
```typescript
// Carga los chunks visibles.
const needed = new Set<string>();

/* Convierte coordenadas de mundo a coordenadas de chunk. */
private worldToChunk(px: number): number {
```

## Code Organization

- **World system**: `src/game/world/` - terrain, pathfinding, noise generation
- **Entities**: `src/game/entities/` - player, enemies, tiles
- **Data**: `src/game/data/` - loaders, feature functions, tile functions
- **Assets**: `src/game/assets/` - image loading
- **Scenes**: `src/game/scenes/` - game scenes
- **Config**: Configuration files in `src/game/config/` and `src/game/data/`

## Architecture Notes

- **World Generation**: Data-driven via JSON configs. Adding a new tile/biome/feature = creating a .json file
- **Physics**: Uses Phaser Arcade Physics with acceleration + drag for natural momentum
- **Rendering**: Tiles are rendered in Containers (chunks), which are positioned in world coordinates
- **Solid blocks**: Live in the scene directly (not in containers) so their physics bodies use world coordinates correctly
- **Pathfinding**: A* on the infinite tile grid with line-of-sight smoothing for natural movement

## Data-Driven Design

Core files are JSON-based, located in `src/game/data/`:
- `tile/` - tile definitions (sprites, collision, speed factors)
- `biome/` - biome definitions (noise, temperature, humidity)
- `noise/` - noise configurations (scale, octaves, persistence, lacunarity)
- `feature/` - world features (trees, rocks, water patches)
- `entity/` - entity stats (health, speed, damage)
- `world/` - world-specific config (seed, climate settings)
- `config/game.json` - global game settings

# Modding Terrath

Terrath is data-driven: almost everything in the world (tiles, biomes, terrain noise, world features, entities, particles) is described by JSON files, and behavior is written as small TypeScript functions. A mod is a folder with the same structure, loaded at startup and layered on top of the base game.

This guide covers where mods go, how ids work, every kind of content a mod can add, the scripting API, and the current limitations.

---

## Contents

1. [Quick start](#1-quick-start)
2. [Where mods live and how they load](#2-where-mods-live-and-how-they-load)
3. [Mod folder layout](#3-mod-folder-layout)
4. [Ids and namespaces](#4-ids-and-namespaces)
5. [Images](#5-images)
6. [Tiles](#6-tiles)
7. [Features (world decoration)](#7-features-world-decoration)
8. [Noise (terrain height)](#8-noise-terrain-height)
9. [Biomes](#9-biomes)
10. [Entities](#10-entities)
11. [Particles](#11-particles)
12. [The world](#12-the-world)
13. [Scripting: functions](#13-scripting-functions)
14. [The `Terrath` API](#14-the-terrath-api)
15. [Overrides and patches](#15-overrides-and-patches)
16. [Limitations](#16-limitations)
17. [Troubleshooting](#17-troubleshooting)
18. [Reference: base game ids](#18-reference-base-game-ids)

---

## 1. Quick start

A mod that adds a new solid "crystal" block with its own sprite:

```
mods/
  crystal_mod/
    assets/images/block/crystal.png
    data/tile/crystal.json
```

`data/tile/crystal.json`:

```json
{
    "layer": "block",
    "sprite": "crystal",
    "solid": true
}
```

The tile now exists as `crystal_mod:crystal`. To make it appear in the world, add a feature that places it and patch a base biome to use that feature:

```
mods/
  crystal_mod/
    assets/images/block/crystal.png
    data/tile/crystal.json
    data/feature/crystal_veins.json
    patch/terrath/biome/mountain.json
```

`data/feature/crystal_veins.json`:

```json
{
    "tile": "crystal",
    "on": ["ground/stone"],
    "scale": 4,
    "density": 0.05,
    "function": "ore_vein"
}
```

`patch/terrath/biome/mountain.json` (appends to the mountain biome's feature list):

```json
{
    "features+": ["crystal_veins"]
}
```

Run the game (`npm run dev` and open the browser, or the desktop app). The console prints:

```
[mods] loaded 1 mod(s): ["crystal_mod"]
```

Crystals now generate on stone in mountain biomes.

`mods/example_mod` in the repository is a complete working example: a new ore placed in mountains, and a wandering entity added to the world's spawns.

---

## 2. Where mods live and how they load

| How you run the game | Mods folder | Reload |
|---|---|---|
| Browser, dev server (`npm run dev`) | `mods/` in the project root, served at `/__mods` | Refresh the page |
| Desktop app, development (`npm run electron:dev`) | `mods/` in the project root | Restart the app |
| Desktop app, packaged | `mods/` next to the executable | Restart the app |
| Plain web build (`npm run build`) | Not supported (no filesystem access) | — |

At startup the game:

1. Scans every folder inside `mods/`, in alphabetical order. **The folder name is the mod's namespace.**
2. Reads every JSON file, PNG and `.ts` function in `data/`, `assets/images/`, `override/` and `patch/`.
3. Transpiles the TypeScript functions to JavaScript (types are stripped, not checked).
4. Resolves every id referenced in the mod's JSON files (see [Ids and namespaces](#4-ids-and-namespaces)).
5. Merges new content and overrides on top of the base content, then applies patches, before the world is generated.

When several mods touch the same id, mods load in alphabetical order: a later override replaces an earlier one, and patches are applied one after another.

A mod that fails to load is skipped and logged as `[mods] failed to load "<name>"`; it never crashes the game. A function that throws while being evaluated is logged as `[mods] failed to eval <ns>:<name>`.

---

## 3. Mod folder layout

```
mods/
  my_mod/                         <- namespace "my_mod"
    assets/
      images/
        <type>/<name>.png         <- texture "my_mod:<name>"
    data/
      tile/<name>.json            <- tile "my_mod:<name>"
      feature/<name>.json         <- feature "my_mod:<name>"
      noise/<name>.json           <- noise "my_mod:<name>"
      biome/<name>.json           <- biome "my_mod:<name>"
      entity/<name>.json          <- entity "my_mod:<name>"
      particle/<name>.json        <- particle effect "my_mod:<name>"
      world/<name>.json           <- world "my_mod:<name>" (not used yet, see The world)
      function/
        entity/<name>.ts          <- entity function "my_mod:<name>"
        tile/<name>.ts            <- tile function "my_mod:<name>"
        feature/<name>.ts         <- feature function "my_mod:<name>"
    override/
      <ns>/                       <- replace content of namespace <ns> (e.g. "terrath")
        <category>/<name>.json    <- replaces "<ns>:<name>"
        function/<kind>/<name>.ts <- replaces function "<ns>:<name>"
        images/<type>/<name>.png  <- replaces texture "<ns>:<name>"
    patch/
      <ns>/
        <category>/<name>.json    <- changes some fields of "<ns>:<name>"
```

- Subfolders are allowed and become part of the id: `data/tile/ore/crystal.json` → `my_mod:ore/crystal`.
- The category is always the first folder under `data/` (`tile`, `feature`, ...). Folder names are lowercase and must match exactly.
- Namespaces should be lowercase with underscores (`my_mod`). Don't name a mod `terrath`: that's the base game's namespace. To change base content, use [overrides and patches](#15-overrides-and-patches).

---

## 4. Ids and namespaces

Every piece of content has an id of the form `namespace:path`, Minecraft-style:

- Base game content: `terrath:ground/grass`, `terrath:ore/ruby`, `terrath:chase_target`.
- Your mod's content: `my_mod:crystal`, `my_mod:ore/crystal`, `my_mod:wander`.

**How references are resolved.** Wherever one of your JSON files references something (a sprite, a tile, a function, a particle...), an id **without** a colon is looked up like this:

1. If **your mod** defines that id (of the right kind), it refers to yours.
2. Otherwise it refers to the **base game** (`terrath`).

An id **with** a colon is used as written.

| Written in `my_mod` | Your mod has it? | Resolves to |
|---|---|---|
| `"crystal"` (as a tile) | yes, `data/tile/crystal.json` | `my_mod:crystal` |
| `"ground/grass"` (as a tile) | no | `terrath:ground/grass` |
| `"slime"` (as a sprite) | no `slime.png` in the mod | `terrath:slime` |
| `"other_mod:gem"` | — | `other_mod:gem` |

The lookup checks the right kind of content for each field: a tile's `sprite` looks among your images, a feature's `tile` among your tiles, an entity's `functions` among your entity functions, and so on. Content in your `override/` and `patch/` folders doesn't count as "yours" (it belongs to the namespace it targets).

Use the full form (`terrath:...`) when your mod defines something with the same name as a base id and you want the base one. To refer to another mod's content, always use its full id.

Ids are resolved when the mod loads, in these fields:

| Category | Fields |
|---|---|
| tile | `sprite`, `variants`, `base`, `functions`, `walkParticles` |
| feature | `tile`, `on`, `function` |
| noise | `layers[].tile` |
| biome | `noise`, `features` |
| entity | `sprite`, `functions`, `walkParticles` |
| world | `biomes`, `spawns[].entity` |

Other fields (like an entity's free-form `attributes`) are passed to your code as written. For example, `chase_target` reads `"target_tag": "player"` as a tag, not an id.

---

## 5. Images

PNG files under `assets/images/<type>/` become textures. The `<type>` folder (`block`, `entity`, `item`, `gui`, ...) is only for organization and is **dropped** from the key:

| File | Texture key |
|---|---|
| `assets/images/block/crystal.png` | `my_mod:crystal` |
| `assets/images/block/crystal/1.png` | `my_mod:crystal/1` |
| `assets/images/entity/goblin.png` | `my_mod:goblin` |

Because the type folder is dropped, `block/goblin.png` and `entity/goblin.png` would collide. Use distinct names.

Guidelines:

- Only `.png` is loaded.
- Base tiles are **8×8 px**; tiles are drawn at the tile size (32 px), so an 8×8 sprite is scaled ×4. Any size works for tiles, because they are stretched to fit the tile (or `size` tiles, see below).
- Entity sprites are drawn at `scale` (base entities use 8×8 sprites with `"scale": 4`).
- Use whole-number scales for crisp pixels.

---

## 6. Tiles

`data/tile/<name>.json`. A tile is either a **floor** (the ground layer) or a **block** (something on top of the floor: plants, ores, rocks, trees, water).

```json
{
    "layer": "block",
    "sprite": "crystal",
    "variants": ["crystal/1", "crystal/2"],
    "solid": true,
    "variation": { "horizontal": true }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `layer` | `"floor"` \| `"block"` | — | Ground layer or object on top of it. **Required.** |
| `sprite` | texture id | — | Texture to draw. **Required.** |
| `variants` | texture id[] | — | Alternative sprites; one is picked per tile (deterministic by position). |
| `size` | number | `1` | Sprite footprint in tiles. `> 1` draws a bigger sprite anchored at the bottom of its tile and rising upward (trees). Collision stays one tile. |
| `base` | tile id | — | For blocks: the floor placed underneath (water uses `"ground/sand"`). |
| `solid` | boolean | `false` | Blocks movement physically. |
| `avoid` | boolean | `false` | Pathfinding avoids it (water), even if not solid. |
| `speedFactor` | number | `1` | Speed multiplier while standing on it (`0.4` = 40% speed). A block's value beats the floor's. |
| `submerge` | number `0..1` | `0` | Fraction of an entity's sprite hidden from the bottom while on it (looks sunk). |
| `functions` | function id[] | — | [Tile functions](#tile-functions) run every frame on entities standing on it. |
| `walkParticles` | particle id[] | — | Overrides the walking entity's particles while on this tile (water splashes instead of footprints). |
| `variation` | object | — | Random visual variation per tile: `horizontal` / `vertical` (mirror), `rotate` (0/90/180/270°). Deterministic by position. |

How tiles are drawn:

- Floors and small non-solid blocks (flowers, grass) are baked into the chunk's ground texture and always draw under entities.
- Solid blocks are separate objects with a physics body. Solid blocks with `size > 1` (trees) are depth-sorted with entities, so the player can walk behind them.
- Non-solid blocks with `size > 1` draw above the ground but under entities.

Examples from the base game:

```json
// tile/ground/water.json — a block that sits on sand, slows and partly hides you, and splashes
{
    "layer": "block",
    "sprite": "water",
    "base": "ground/sand",
    "avoid": true,
    "speedFactor": 0.4,
    "submerge": 0.1,
    "walkParticles": ["water_splash"],
    "variation": { "horizontal": true, "vertical": true, "rotate": true }
}
```

```json
// tile/tree/oak.json — a 3-tile-tall solid tree
{
    "layer": "block",
    "sprite": "tree/oak",
    "size": 3,
    "solid": true,
    "variation": { "horizontal": true }
}
```

---

## 7. Features (world decoration)

`data/feature/<name>.json`. A feature is a placement rule: "put tile X on floors Y, with this density, using this distribution function". Biomes list the features they use.

```json
{
    "tile": "crystal",
    "on": ["ground/stone"],
    "scale": 4,
    "density": 0.05,
    "function": "ore_vein"
}
```

Features only generate in biomes that list them. To put yours in a base biome, patch it (see [Overrides and patches](#15-overrides-and-patches)):

```json
// patch/terrath/biome/mountain.json
{ "features+": ["crystal"] }
```

| Field | Type | Description |
|---|---|---|
| `tile` | tile id | Tile to place. |
| `on` | tile id[] | Floors where it may appear. |
| `density` | number `0..1` | How much of the eligible area it covers (meaning depends on the function). |
| `scale` | number | Noise scale: bigger = larger, smoother clusters. Used by noise-based functions. |
| `function` | function id | [Feature function](#feature-functions) that decides placement. |

**Patch or block?** If the feature's tile is a `floor` (or the function is `patch`), the feature **replaces the floor** (dark grass patches, quicksand). Otherwise it **places a block on top** of the floor.

Generation order for each tile:

1. Base floor from the biome's height noise.
2. Patch features, in the biome's order; the first that applies replaces the floor.
3. Block features, in the biome's order; the first that applies places its block. If that block has a `base`, the floor under it becomes that base.

Order matters: put rarer features (ores, trees) before common ones (grass) in the biome's list.

Built-in feature functions:

| Function | Distribution | Uses |
|---|---|---|
| `solitary` | Scattered single tiles (hash random). `density` = chance per tile. | Trees, cacti, shells |
| `spread_group` | Clusters from noise; `density` ≈ fraction covered. | Grass, flowers, rocks |
| `patch` | Like `spread_group`, for floor replacement. | Dark grass, quicksand |
| `ore_vein` | Small sparse clusters (noise peaks); `density` = raw threshold. | Ores, gems |
| `river` | Winding connected lines; `density` = width. | Rivers |

---

## 8. Noise (terrain height)

`data/noise/<name>.json`. Each biome uses one noise config to choose its **base floor** by height.

```json
{
    "scale": 16,
    "octaves": 4,
    "persistence": 0.5,
    "lacunarity": 2,
    "layers": [
        { "tile": "ground/water", "max": 0.4 },
        { "tile": "ground/sand",  "max": 0.42 },
        { "tile": "ground/grass", "max": 1 }
    ]
}
```

| Field | Description |
|---|---|
| `scale` | Size of terrain features in tiles. Bigger = broader hills/lakes. |
| `octaves` | Layers of detail (more = rougher). |
| `persistence` | How much each extra octave contributes (`0.5` is typical). |
| `lacunarity` | Frequency multiplier per octave (`2` is typical). |
| `layers` | Height bands, checked in order: the first with `height < max` wins. Height is in `0..1`. The last layer should use `"max": 1`. |

A layer's tile can be a block with a `base` (like water): it is split into the base floor plus the block on top.

---

## 9. Biomes

`data/biome/<name>.json`. A biome sits at a point on a temperature/humidity map; each spot of the world picks the closest biome.

```json
{
    "noise": "forest",
    "temperature": 0.5,
    "humidity": 0.7,
    "frequency": 1,
    "size": { "min": 10, "max": 20 },
    "features": ["tree/trees_dense", "flower/roses", "plant/short_grass", "plant/rocks"]
}
```

| Field | Type | Description |
|---|---|---|
| `noise` | noise id | Height noise that picks the base floor. |
| `temperature` | number `0..1` | Position on the temperature axis (0 cold, 1 hot). |
| `humidity` | number `0..1` | Position on the humidity axis (0 dry, 1 wet). |
| `frequency` | number | How often it appears relative to other biomes. |
| `size` | `{min, max}` | Relative region size; defaults to the world's `biomesSize`. |
| `features` | feature id[] | Features generated in this biome, in priority order. |

Only biomes listed in the world's `biomes` list are generated. To add your biome, patch the world:

```json
// patch/terrath/world/earth.json
{ "biomes+": ["crystal_desert"] }
```

Choose `temperature`/`humidity` so your biome has room on the climate map: a point close to an existing biome splits that biome's area.

---

## 10. Entities

`data/entity/<name>.json`. An entity is a physics sprite whose behavior is entirely defined by its [entity functions](#entity-functions).

```json
{
    "sprite": "goblin",
    "health": 8,
    "speed": 120,
    "acceleration": 800,
    "drag": 700,
    "scale": 4,
    "attackDamage": 3,
    "tags": ["enemy"],
    "functions": ["chase_target"],
    "attributes": { "target_tag": "player", "follow_range": 250 },
    "walkParticles": ["footprints"]
}
```

| Field | Type | Description |
|---|---|---|
| `sprite` | texture id | Texture. |
| `health` | number | Starting and max health. |
| `speed` | number | Max speed in px/s. |
| `acceleration` | number | How quickly it reaches max speed. |
| `drag` | number | Friction: how quickly it stops (gives momentum). |
| `scale` | number | Sprite scale. |
| `bodyScale` | number | Hitbox size relative to the sprite (default `0.9`). |
| `attackDamage` | number | Damage value for functions to use. |
| `tags` | string[] | Labels for targeting/filtering. `"camera"` makes the camera follow it; `"player"` is what enemies chase by default. |
| `functions` | function id[] | Behaviors run every frame, in order. |
| `attributes` | object | Free-form parameters read by functions (`entity.attributes.follow_range`). |
| `walkParticles` | particle id[] | Particles emitted while walking (overridden by tiles with `walkParticles`). |

Entities are spawned from the world's `spawns` list. To spawn yours, patch the world:

```json
// patch/terrath/world/earth.json
{ "spawns+": [{ "entity": "goblin", "x": 300, "y": 0 }] }
```

An unknown entity id in `spawns` is skipped with a `[world] unknown entity in spawns` warning.

---

## 11. Particles

`data/particle/<name>.json`. A particle effect is a small burst of colored squares, emitted while an entity walks (via `walkParticles` on an entity or tile).

```json
{
    "count": 5,
    "color": "#6b5335",
    "size": [2, 4],
    "alpha": 0.7,
    "alphaEnd": 0,
    "scaleEnd": 0.3,
    "lifetime": [0.3, 0.6],
    "speed": [40, 90],
    "drag": 4,
    "spin": 6,
    "direction": "back",
    "depth": -60
}
```

| Field | Type | Description |
|---|---|---|
| `count` | number | Particles per emission. |
| `color` | `"#rrggbb"` or number | Fill color. |
| `size` | `[min, max]` | Square size in px. |
| `alpha` / `alphaEnd` | number | Start / end opacity (end defaults to `0`, fade out). |
| `scaleEnd` | number | End scale (default `1`). |
| `lifetime` | `[min, max]` | Seconds. |
| `speed` | `[min, max]` | px/s. Omit for static particles. |
| `drag` | number | Velocity damping per second. |
| `spin` | number | Max rotation speed (rad/s). |
| `direction` | `"static"` \| `"back"` \| `"radial"` | No motion / opposite to movement / all directions. |
| `footSpread` | number | With `"static"`: emit two particles, one per foot, this many px apart (footprints). |
| `continuous` | boolean | `false` (default): one emission every step (~22 px walked). `true`: emits `rate` times per second while moving. |
| `rate` | number | Emissions per second when continuous (default `20`). |
| `depth` | number | Draw order offset from the emitter's Y (negative = under the entity's feet). **Required.** |

---

## 12. The world

The world the game generates is `terrath:earth` (`src/game/data/world/earth.json`). It sets the seed, climate, default biome size, day/night cycle, which biomes exist and which entities spawn.

```json
{
    "seed": 12345,
    "climate": { "temperatureScale": 48, "humidityScale": 48, "contrast": 2.5 },
    "biomesSize": { "min": 10, "max": 20 },
    "dayNight": { "dayDuration": 600000, "nightDuration": 600000, "nightColor": "#050819", "nightAlpha": 0.9 },
    "biomes": ["plains", "desert", "mountain", "ocean", "beach", "forest", "snow_plains", "snow_forest"],
    "spawns": [
        { "entity": "player", "x": 0, "y": 0 },
        { "entity": "skeleton", "x": 256, "y": 256 }
    ]
}
```

| Field | Description |
|---|---|
| `seed` | World seed. Same seed = same world. |
| `climate.temperatureScale` / `humidityScale` | Size of climate regions in tiles. Bigger = larger biome areas. |
| `climate.contrast` | Spreads climate values so corner biomes (very hot/dry, very cold/wet) appear. `1` = no change. |
| `biomesSize` | Default `size` for biomes that don't set one. |
| `dayNight` | Optional. Durations in ms; `nightColor` and `nightAlpha` tint the screen at midnight. |
| `biomes` | Biome ids to generate. |
| `spawns` | Entities created when the world loads (`x`, `y` in px). |

Mods change it with a patch (add biomes and spawns, change the seed or the day length) or replace it with an override:

```json
// patch/terrath/world/earth.json
{
    "biomes+": ["crystal_desert"],
    "spawns+": [{ "entity": "goblin", "x": 300, "y": 0 }],
    "dayNight": { "dayDuration": 120000, "nightDuration": 60000, "nightColor": "#050819", "nightAlpha": 0.9 }
}
```

A mod can also define its own world in `data/world/`, but the game always generates `terrath:earth` for now.

---

## 13. Scripting: functions

Functions are TypeScript files under `data/function/<kind>/`. Each file **default-exports one function**, registered as `my_mod:<filename>`. There are three kinds.

Mod scripts can't import arbitrary modules. **Every `import` resolves to the game API** (the same object as the global `Terrath`), so write imports from `'@/game/api'`:

```ts
import { Entity, EntityContext, accelerate } from '@/game/api';
// equivalent:  const { accelerate } = Terrath;
```

Types are stripped at load time and never checked, so a type error won't stop the mod, but a runtime error will.

### Entity functions

`data/function/entity/<name>.ts` — run **every frame** for each entity that lists them in `functions`.

```ts
import { Entity, EntityContext, accelerate } from '@/game/api';

export default function wander(entity: Entity, ctx: EntityContext): void {
    const v = entity.vars;
    if (v.turnAt === undefined || ctx.time > v.turnAt) {
        v.turnAt = ctx.time + 1000;
        v.angle = Math.random() * Math.PI * 2;
    }
    accelerate(entity, Math.cos(v.angle), Math.sin(v.angle));
}
```

Use it from an entity in your mod: `"functions": ["wander"]`.

`ctx` (`EntityContext`):

| Field | Description |
|---|---|
| `time` | Current time in ms. |
| `delta` | ms since the previous frame. |
| `world.tileSize` | Tile size in px (32). |
| `world.isBlocked(gx, gy)` | Whether a tile is solid or avoided (for pathfinding). |
| `world.nearestWithTag(tag, x, y)` | Nearest live entity with a tag, or `null`. |

Useful parts of `entity` (it's a Phaser Arcade sprite, so all of Phaser's sprite API is available too):

| Member | Description |
|---|---|
| `x`, `y` | Position (px). |
| `health`, `maxHealth`, `speed`, `acceleration`, `drag`, `attackDamage` | Stats from the JSON. |
| `tags`, `hasTag(tag)` | Tags. |
| `attributes` | The JSON `attributes` object. |
| `vars` | Free per-entity storage for your function's state (timers, paths...). Shared by all functions on that entity, so prefix your keys. |
| `isAlive` | `health > 0`. |
| `scene` | The Phaser scene (input, cameras, etc). |
| `body` | Arcade physics body (`velocity`, ...). |
| `setMaxSpeed(n)`, `setDrag(x, y)`, `setFlipX(b)`, ... | Phaser / entity methods. |

The engine resets max speed and drag to the entity's base values every frame before tile effects apply, so changing them in a function lasts one frame.

### Tile functions

`data/function/tile/<name>.ts` — run **every frame** on each entity standing on a tile that lists them in `functions`. Use them for effects with logic (the declarative `speedFactor`/`submerge` fields cover simple cases).

```ts
import { Entity, TileContext } from '@/game/api';

export default function bounce(entity: Entity, _ctx: TileContext): void {
    entity.setMaxSpeed(entity.speed * 1.5);
}
```

Use it from a tile in your mod: `"functions": ["bounce"]`.

`ctx` (`TileContext`): `tile` (id of the block the entity is on, or `""` if there is no block), `time`, `delta`.

Both the block's and the floor's functions run (block first). Effects are temporary: max speed and drag are reset each frame, so stepping off the tile ends them.

### Feature functions

`data/function/feature/<name>.ts` — decide whether a feature appears at a tile. They run during world generation for every tile, so keep them fast and **deterministic** (no `Math.random()`; the same coordinates must always give the same answer, or chunks will change when reloaded).

```ts
import { PerlinNoise } from '@/game/api';

interface Ctx { noise: PerlinNoise; scale: number; density: number }

export default function rings(gx: number, gy: number, ctx: Ctx): boolean {
    const n = ctx.noise.fractal(gx / ctx.scale, gy / ctx.scale, 2);
    return Math.abs(Math.sin(n * 20)) < ctx.density;
}
```

Use it from a feature in your mod: `"function": "rings"`.

Arguments: `gx`, `gy` are global tile coordinates (can be negative). `ctx.noise` is a `PerlinNoise` seeded per feature, and `ctx.scale` / `ctx.density` come from the feature's JSON.

---

## 14. The `Terrath` API

Everything below is available through `import { ... } from '@/game/api'` or the global `Terrath`.

| Export | Description |
|---|---|
| `Entity` | Entity class (see above). |
| `Tile`, `SolidBlock` | Tile game object classes. |
| `PerlinNoise` | `new PerlinNoise(seed)`; `.noise(x, y)` → about `-1..1`; `.fractal(x, y, octaves?, persistence?, lacunarity?)` → `0..1`. |
| `findPath(start, goal, isBlocked)` | A* on the tile grid. Returns `GridPoint[]` (including the start) or `null`. |
| `hasLineOfSight(a, b, isBlocked)` | Whether a straight line between two tiles is clear. |
| `accelerate(entity, dx, dy)` | Accelerate in a direction (normalized); `(0, 0)` stops accelerating. |
| `goTo(entity, x, y, tolerance = 4)` | Accelerate toward a world point; returns `true` once within `tolerance` px. |
| `resolveId(ref, ns = "terrath")`, `splitId(id)`, `BASE_NAMESPACE` | Id helpers. |
| `Phaser`, `Scene`, `GameObjects`, `Physics`, `PhaserMath`, `Input` | The Phaser 4 engine, for advanced mods. |
| Types | `EntityContext`, `EntityFunction`, `EntityWorld`, `EntityStats`, `TileDef`, `TileLayer`, `TileContext`, `TileFunction`, `FeatureFunction`, `NoiseConfig`, `NoiseLayer`, `FeatureConfig`, `BiomeDef`, `WorldConfig`, `GameConfig`, `GridPoint`, `TileName`. |

Example: an enemy that chases the nearest player using pathfinding is the base `chase_target` function (`src/game/data/function/entity/chase_target.ts`). It's a good template for AI.

---

## 15. Overrides and patches

Your `data/` folder only adds content under your own namespace. To change content that belongs to another namespace (usually the base game, `terrath`), use `override/` or `patch/`, with the target namespace as the first folder.

### Overrides: replace a whole file

`override/<ns>/<category>/<path>.json` replaces `<ns>:<path>` entirely:

```
mods/my_mod/override/terrath/tile/ground/grass.json  -> replaces terrath:ground/grass
mods/my_mod/override/terrath/entity/skeleton.json    -> replaces terrath:skeleton
```

The file replaces the **whole** definition, so copy the original from `src/game/data/` and edit it. Fields you leave out are gone.

Overrides also work for images and functions:

```
mods/my_mod/override/terrath/images/block/grass.png        -> retextures terrath:grass
mods/my_mod/override/terrath/function/entity/chase_target.ts -> replaces the base chase AI
```

A texture override is a resource pack: every tile or entity that uses that texture shows yours.

### Patches: change some fields

`patch/<ns>/<category>/<path>.json` is merged into the existing `<ns>:<path>`. Everything you don't mention stays as it is:

- `"field": value` replaces that field.
- `"field+": [...]` appends items to a list field (creating it if missing).

```json
// patch/terrath/entity/skeleton.json — faster skeletons that hunt from further away
{
    "speed": 140,
    "attributes": { "target_tag": "player", "follow_range": 500 }
}
```

```json
// patch/terrath/biome/forest.json — add your feature to the forest
{
    "features+": ["mushrooms"]
}
```

Notes:

- Replacing an object field (like `attributes`) replaces the whole object; it isn't merged key by key.
- `+` appends at the **end** of the list. For biome features, that means lowest priority (earlier features that match win).
- Patches apply after all overrides, so a patch also modifies another mod's override.
- If the target doesn't exist, the patch is skipped with `[mods] patch target not found: <category> <id>`.
- Patches only work on JSON data, not on images or functions.

Prefer patches over overrides: they keep working when the base file gains new fields, and several mods can patch the same file.

---

## 16. Limitations

| Goal | Possible? | How |
|---|---|---|
| Add tiles, features, noises, biomes, particles, entities, functions, images | Yes | Files in your mod's `data/` and `assets/`. |
| Put your features in base biomes | Yes | Patch the biome: `"features+"`. |
| Add biomes to the world / spawn entities | Yes | Patch `terrath:earth`: `"biomes+"`, `"spawns+"`. |
| Change or replace base content, textures and functions | Yes | [Overrides and patches](#15-overrides-and-patches). |
| Generate a different world than `terrath:earth` | No | The game always loads `terrath:earth` (patch or override it instead). |
| Change global config (`config/*.json`: tile size, camera, controls...) | No | Not loaded from mods. |
| Remove an item from a list (e.g. a base biome's feature) | No | Replace the whole list in a patch (`"features": [...]`). |
| Mods in the plain web build | No | Only in the dev server and the desktop app. |

---

## 17. Troubleshooting

**My mod doesn't load.** Check the browser/devtools console for `[mods] loaded N mod(s)` and `[mods] failed to ...`. Make sure the mod is a folder directly inside `mods/`, and that the JSON is valid (no trailing commas, no comments).

**A texture shows as missing (Phaser's missing-texture placeholder).** The `sprite` id doesn't match a texture key. Remember the image type folder is dropped (`assets/images/block/crystal.png` → `crystal`). Check the spelling and that the file is a `.png`.

**My tile/function/particle is ignored.** Check that the name matches your file exactly (including subfolders: `ore/crystal`), and that it's the right kind: a tile's `functions` only finds files in `data/function/tile/`.

**My patch does nothing.** Look for `[mods] patch target not found` in the console. The path after `patch/<ns>/` must match the target's id exactly (`patch/terrath/biome/forest.json` → `terrath:forest`; `patch/terrath/tile/ground/grass.json` → `terrath:ground/grass`).

**My entity doesn't appear.** It must be in the world's `spawns` (patch `terrath:earth`). Look for `[world] unknown entity in spawns` in the console.

**My feature never appears.** A feature only generates in biomes that list it, and only on floors in its `on` list. Check the order of the biome's features: an earlier feature that matches wins.

**Chunks look different every time they load.** A feature function isn't deterministic. Don't use `Math.random()` there; use `ctx.noise` or a hash of `gx, gy`.

**Changes don't show up.** In the browser, refresh the page. In the desktop app, restart it.

**Inspecting the world.** Press **P** in game for the debug overlay: it shows the tile, floor, block and biome under the player, chunk borders and hitboxes.

---

## 18. Reference: base game ids

All in the `terrath` namespace (so `ground/grass` means `terrath:ground/grass`).

**Tiles**
- `ground/`: `grass`, `dark_grass`, `dirt`, `sand`, `snow`, `stone`, `ice`, `quicksand`, `water`
- `flower/`: `dandelion`, `lilie`, `rose`, `tulip`
- `plant/`: `cactus`, `rock`, `sea_shell`, `short_grass`
- `ore/`: `amethyst`, `coal`, `copper`, `emerald`, `gold`, `iron`, `ruby`, `sapphire`
- `tree/`: `oak`

**Features**
- `tree/`: `trees_dense`, `trees_sparse`, `trees_snow`
- `flower/`: `dandelions`, `lilies`, `roses`, `tulips`
- `plant/`: `cactus`, `rocks`, `short_grass`
- `ore/`: `amethyst`, `coal`, `copper`, `emerald`, `gold`, `iron`, `ruby`, `sapphire`
- `patch/`: `dark_grass_patches`, `quicksand_patches`
- `water/`: `lakes`, `rivers`, `open_water`, `frozen_lakes`, `frozen_rivers`
- `beach/`: `sea_shells`

**Biomes / noises** (same names): `plains`, `forest`, `desert`, `mountain`, `ocean`, `beach`, `snow_plains`, `snow_forest`

**Entities:** `player`, `skeleton`

**Particles:** `footprints`, `dirt_burst`, `water_splash`

**Functions**
- Entity: `player_movement`, `face_mouse`, `chase_target`
- Tile: `sink`, `slippery`
- Feature: `solitary`, `spread_group`, `patch`, `ore_vein`, `river`

**Textures** (from `src/game/assets/images/`, type folder dropped): `grass`, `dark_grass`, `dirt`, `sand`, `snow`, `stone`, `ice`, `quicksand`, `water`, `brick`, `cactus`, `dandelion`, `lilie`, `rose`, `tulip`, `sea_shell`, `rock`, `rock/1`, `rock/2`, `short_grass`, `short_grass/1..3`, `tree/oak`, `ore/<amethyst|coal|copper|diamond|emerald|gold|iron|ruby|sapphire>`, `player`, `skeleton`, `knight`, `dog`, `rat`, `slime`, `snail`, `spider`, `crosshair`, `sword`

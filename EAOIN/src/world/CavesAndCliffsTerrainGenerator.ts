/**
 * AdvancedTerrainGenerator — 1.0 Caves & Cliffs-grade terrain pipeline.
 *
 *  Layers (applied in order per chunk):
 *    1. Continental shape            — huge, very low-freq fbm
 *    2. Domain-warped erosion        — swirling coastlines & valleys
 *    3. Mountain ridges              — ridge fbm + continent mask
 *    4. Hydraulic + thermal erosion  — iterative smoothing (carve steep slopes)
 *    5. River simulation             — long thin valleys along zero-crossings
 *    6. Beaches + sea level fill     — sand + water at sea level
 *    7. Cave generation              — 3D fbm, multiple types (lush/ice/crystal/lava)
 *    8. Ore & vein placement         — local 3D noise + biome weighting
 *    9. Geology (stone layers)       — depth-based granite / andesite / deepslate
 *   10. Surface biome paint          — grass / sand / snow / podzol / cherry
 *   11. Vegetation                   — trees, cacti, flowers, mushrooms, bamboo
 *   12. Structures (procedural)      — villages, ruins, monoliths, geodes
 *   13. Floating island support      — separate pass for sky worlds
 *   14. Bedrock foundation           — y=0..3, unbreakable obsidian+bedrock mix
 *   15. Underground ocean (lush)     — large cavern water tables
 *   16. Anti-floating dirt patch     — fills small under-hangs and gap holes
 *
 *  Determinism:
 *    All samples are pure functions of (x, y, z, seed) so the result is
 *    byte-identical on every client and the server.
 */
import { BlockID, getBlock } from '@shared/blocks/BlockRegistry';
import { BiomeModificationFlags, BIOME_MOD_KEYS, DEFAULT_BIOME_MODS } from '../dev/DeveloperTuning';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from './Chunk';
import { AdvancedNoise } from './AdvancedNoise';
import { DeepCaveGenerator } from './DeepCaves';
import { mineshaftAnchorAt, placeMineshaft } from './MineshaftStructures';
import { editKey, WorldBlockEdit } from './WorldSave';
import { getWorldLayout, SPAWN_PROTECTED_RADIUS } from './WorldDistribution';
import {
  getBiome,
  BiomeDefinition,
  BiomeSizeClass,
  BIOME_SIZE_SCALE,
  BIOME_SIZE_WEIGHT,
} from './Biomes';
import {
  buildSubBedrockLayers,
  farLandsCorruption,
  invertHeight,
  sampleFarLands,
  subBedrockBlockAt,
  SubBedrockLayer,
} from './ExoticWorldGen';

export interface SpawnPoint { x: number; y: number; z: number; }

export interface WorldGenConfig {
  /** World seed. */
  seed: string;
  /** Sea level (water surface). */
  seaLevel: number;
  /** Total world depth. */
  worldDepth: number;
  /** Bedrock layer thickness. */
  bedrockThickness: number;
  /** Vertical scale of continental noise. Larger = flatter continents. */
  continentScale: number;
  /** Vertical scale of detail noise. Smaller = more detail. */
  detailScale: number;
  /** Mountain intensity. */
  mountainIntensity: number;
  /** Erosion iterations (0 = none, 2+ = strong). */
  erosionIterations: number;
  /** Caves: 0 = none, 1 = small, 2 = Caves & Cliffs large. */
  caveScale: number;
  /** Floating-island world? */
  floatingIslands: boolean;
  /** Sky world / void world above sea level only. */
  skyIslands: boolean;
  /** Generate underground rivers. */
  undergroundRivers: boolean;
  /** Generate underground oceans. */
  undergroundOceans: boolean;
  /** Generate ravines. */
  ravines: boolean;
  /** Generate sinkholes. */
  sinkholes: boolean;
  /** Generate volcanoes. */
  volcanoes: boolean;
  /** Generate glaciers. */
  glaciers: boolean;
  /**
   * Stretch climate regions over a larger area.
   * 1 = normal, 4 = four-times-wider biome territories.
   */
  biomeScale: number;
  /** Force the whole world to resolve to one biome id. */
  forcedBiome: string | null;
  /**
   * Distance from origin at which Far Lands corruption begins. 0 disables it.
   * Past this the terrain noise saturates into vertical walls and stretched
   * tunnels — the classic Minecraft overflow bug, here on purpose.
   */
  farLandsThreshold: number;
  /** Number of stacked dimension layers generated below bedrock. 0 disables. */
  subBedrockLayers: number;
  /** Flip terrain density so caverns become spires. */
  inverted: boolean;
  /** Remove the surface entirely — the whole world is cave. */
  caveWorld: boolean;
  /** Force a perfectly flat world at this Y. */
  flatGroundY: number | null;
}

export const DEFAULT_OVERWORLD_CONFIG: WorldGenConfig = {
  seed: 'eaoin_seed_2026',
  seaLevel: 32,
  // Chunk storage is 128 blocks tall. Keeping this at 256 made amplified
  // height queries report ground that could never exist in the chunk, so
  // creatures and structures floated over a clipped/invisible world.
  worldDepth: CHUNK_HEIGHT,
  bedrockThickness: 4,
  continentScale: 0.0012,
  detailScale: 0.018,
  mountainIntensity: 1.4,
  // One wide smoothing pass gives the intended rounded ridges. Three passes
  // multiplied raw height-noise work during every streamed chunk for little
  // visible difference.
  erosionIterations: 1,
  caveScale: 2,
  floatingIslands: false,
  skyIslands: false,
  undergroundRivers: true,
  undergroundOceans: true,
  ravines: true,
  sinkholes: true,
  volcanoes: true,
  glaciers: true,
  biomeScale: 1,
  forcedBiome: null,
  farLandsThreshold: 0,
  subBedrockLayers: 0,
  inverted: false,
  caveWorld: false,
  flatGroundY: null,
};

export const FLOATING_ISLANDS_CONFIG: WorldGenConfig = {
  ...DEFAULT_OVERWORLD_CONFIG,
  floatingIslands: true,
  skyIslands: true,
  caveScale: 1,
  erosionIterations: 0,
};

const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  LOG: 6,
  LEAVES: 7,
  COAL: 8,
  IRON: 9,
  GOLD: 10,
  DIAMOND: 11,
  OBSIDIAN: 12,
  REDSTONE: 13,
  RED_LAMP: 14,
  PORTAL_CORE: 15,
  CRYSTAL: 16,
  CRATE: 17,
  CMD: 18,
  TIME_MACHINE: 19,
  WOOD_DOOR: 20,
  DIM_DOOR: 21,
  ROCKET: 22,
  MOON_ROCK: 23,
  COBBLESTONE: 24,
  MOSSY_COBBLE: 25,
  GRANITE: 26,
  DIORITE: 27,
  ANDESITE: 28,
  DEEPSLATE: 29,
  DEEPSLATE_COAL: 30,
  DEEPSLATE_IRON: 31,
  DEEPSLATE_DIAMOND: 32,
  DEEPSLATE_GOLD: 33,
  BRICKS: 34,
  STONE_BRICKS: 35,
  CRACKED_BRICKS: 36,
  MOSSY_BRICKS: 37,
  SANDSTONE: 38,
  RED_SANDSTONE: 39,
  PRISMARINE: 40,
  DARK_PRISMARINE: 41,
  PURPUR: 42,
  END_STONE: 43,
  NETHERRACK: 44,
  SOUL_SAND: 45,
  BASALT: 47,
  BLACKSTONE: 48,
  GLOWSTONE: 49,
  SNOW: 89,
  PODZOL: 276,
  CHERRY_LEAVES: 104,
  MOSS: 108,
  MAGMA: 219,
  PACKED_ICE: 221,
  BLUE_ICE: 220,
  LAVA: 227,
  CHERRY_PETAL: 104,
  GRASS_PATH: 275,
  PLANKS: 57,
  FARMLAND: 279,
  MUD: 105,
  CLAY: 4,
  GRAVEL: 1,
  CORAL: 102,
  KELP: 304,
} as const;

const BEDROCK_MIX: BlockID[] = [12, 12, 12, 12, 3];
const FACE_OFFSETS_3D: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

interface TerrainShapeSample {
  continentalness: number;
  erosion: number;
  peaksAndValleys: number;
  detail: number;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(min: number, max: number, value: number): number {
  const t = clamp((value - min) / Math.max(Number.EPSILON, max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Reject invalid preset values before they can reach a noise or allocation loop. */
function normaliseWorldGenConfig(
  overrides: Partial<WorldGenConfig> & { seed: string }
): WorldGenConfig {
  const config = { ...DEFAULT_OVERWORLD_CONFIG, ...overrides };
  const defaults = DEFAULT_OVERWORLD_CONFIG;

  config.bedrockThickness = clamp(
    Math.round(finiteOr(config.bedrockThickness, defaults.bedrockThickness)),
    1,
    16
  );
  config.worldDepth = clamp(
    Math.round(finiteOr(config.worldDepth, defaults.worldDepth)),
    config.bedrockThickness + 12,
    CHUNK_HEIGHT
  );
  config.seaLevel = clamp(
    Math.round(finiteOr(config.seaLevel, defaults.seaLevel)),
    config.bedrockThickness + 4,
    config.worldDepth - 8
  );
  config.continentScale = config.continentScale > 0 && Number.isFinite(config.continentScale)
    ? config.continentScale
    : defaults.continentScale;
  config.detailScale = config.detailScale > 0 && Number.isFinite(config.detailScale)
    ? config.detailScale
    : defaults.detailScale;
  config.mountainIntensity = clamp(
    finiteOr(config.mountainIntensity, defaults.mountainIntensity),
    0,
    4
  );
  config.erosionIterations = clamp(
    Math.round(finiteOr(config.erosionIterations, defaults.erosionIterations)),
    0,
    4
  );
  config.caveScale = clamp(
    Math.round(finiteOr(config.caveScale, defaults.caveScale)),
    0,
    3
  );
  config.biomeScale = clamp(finiteOr(config.biomeScale, defaults.biomeScale), 0.1, 16);
  config.farLandsThreshold = Math.max(
    0,
    finiteOr(config.farLandsThreshold, defaults.farLandsThreshold)
  );
  config.subBedrockLayers = clamp(
    Math.round(finiteOr(config.subBedrockLayers, defaults.subBedrockLayers)),
    0,
    8
  );
  config.flatGroundY = config.flatGroundY === null
    ? null
    : clamp(
      Math.round(finiteOr(config.flatGroundY, config.seaLevel - 6)),
      config.bedrockThickness,
      config.worldDepth - 8
    );

  return config;
}

/**
 * Blocks a top-down surface sweep looks straight through.
 *
 * A tree, a flower or a body of water sitting on the ground must not hide the
 * ground from the surface pass, otherwise topsoil gets painted onto a canopy
 * or a water surface. Anything listed here is treated as "not the terrain".
 */
const SKY_TRANSPARENT: ReadonlySet<BlockID> = new Set<BlockID>([
  BLOCK.AIR,
  BLOCK.WATER,
  BLOCK.LAVA,
  BLOCK.LEAVES,
  BLOCK.LOG,
  BLOCK.CHERRY_LEAVES,
  90, 91, 92, 93, 94, 95, 96, 97, 99, 103, 106, 107, 109, // saplings, flowers, plants
]);

/**
 * Natural ground materials that a surface pass is allowed to recolour.
 *
 * Restricting writes to this set is what stops the surface pass from painting
 * grass over a structure's brickwork, an exposed ore, or bedrock.
 */
const NATURAL_GROUND: ReadonlySet<BlockID> = new Set<BlockID>([
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.SAND, BLOCK.SNOW, BLOCK.MOSS,
  BLOCK.MUD, BLOCK.BASALT, BLOCK.GRAVEL, BLOCK.PODZOL,
  BLOCK.GRANITE, BLOCK.DIORITE, BLOCK.ANDESITE, BLOCK.DEEPSLATE,
  BLOCK.COBBLESTONE, BLOCK.PACKED_ICE, BLOCK.BLUE_ICE,
]);

const DENSE_TREE_BIOMES: ReadonlySet<string> = new Set([
  'forest',
  'taiga',
  'rainforest',
  'bamboo_jungle',
  'redwood_biome',
  'cherry_biome',
  'mystic_woods',
  'mushroom_island',
]);

const SPARSE_TREE_BIOMES: ReadonlySet<string> = new Set([
  'plain',
  'meadow',
  'sunflower_plains',
]);

/** True when a top-down sweep should see through this block. */
function isSkyTransparent(id: BlockID): boolean {
  return SKY_TRANSPARENT.has(id);
}

/** True when the surface pass may recolour this block. */
function isNaturalGround(id: BlockID): boolean {
  return NATURAL_GROUND.has(id);
}

/* ---- ravine placement (see `applyRavines`) ---- */
/** Grid cell size, in blocks, that ravines are placed on. */
const RAVINE_CELL_SIZE = 340;
/** Fraction of cells that host a ravine. Uniform across seeds. */
const RAVINE_CHANCE = 0.32;
const RAVINE_MIN_LENGTH = 90;
const RAVINE_MAX_LENGTH = 220;
const RAVINE_MIN_WIDTH = 2.5;
const RAVINE_MAX_WIDTH = 6.5;
/** How far below the surface a ravine always reaches. */
const RAVINE_MIN_DEPTH = 8;
/** Extra depth at the centreline, on top of `RAVINE_MIN_DEPTH`. */
const RAVINE_EXTRA_DEPTH = 26;

/* ---- sinkhole placement (see `applySinkholes`) ---- */
/** Grid cell size, in blocks, that sinkhole anchors are placed on. */
const SINKHOLE_CELL_SIZE = 12;
/** Smallest sinkhole radius, in blocks. */
const SINKHOLE_MIN_RADIUS = 2;
/**
 * Largest sinkhole radius, in blocks.
 *
 * This bounds how far outside its own chunk an anchor can reach, so it is also
 * the width of the neighbouring-anchor margin scanned by `applySinkholes`.
 * Keep the two in step: under-scanning re-introduces the clipped-crater bug.
 */
const SINKHOLE_MAX_RADIUS = 3;

/**
 * Radius over which the deliberately flat, safe spawn platform eases back
 * into procedural terrain.  The platform used to stop at block 26 while the
 * next column could be a 60-block mountain.  From above that looked exactly
 * like an X-ray hole: a low world inside a near-vertical ring of exposed cave
 * walls.  Keep the playable core, but blend it into the surrounding heightmap.
 */
export const SPAWN_TERRAIN_BLEND_RADIUS = SPAWN_PROTECTED_RADIUS + 32;

/* ---- biome region sizing (see `getBiomeAt`) ---- */
/**
 * Climate sampling frequency for a `medium` biome. Divided by the region's
 * size scale, so bigger classes sample more slowly and cover more ground.
 */
const BASE_BIOME_FREQUENCY = 0.00068;
/**
 * Lattice spacing for the smoothed-height cache. The value is a wide spatial
 * average, so sampling it every 16 blocks and reusing the result is
 * indistinguishable from evaluating it per column.
 */
const SMOOTH_HEIGHT_STEP = 16;

/** Cell size, in blocks, of the Voronoi partition that assigns size classes. */
const BIOME_REGION_CELL = 900;

/**
 * Height above sea level at which biomes turn alpine, then permanently iced.
 *
 * Relative to sea level so they stay meaningful across configs. Absolute Y
 * thresholds silently turned the whole world alpine once the heightmap range
 * changed.
 */
const ALPINE_ELEVATION = 26;
const ICE_CAP_ELEVATION = 38;

/**
 * Remap a bell-shaped fbm sample onto an approximately uniform 0-1.
 *
 * Measured percentiles of the raw field were p05 0.29 / p50 0.50 / p95 0.72,
 * i.e. a standard deviation of roughly 0.13. Rescaling by that spread and
 * squashing the result with a smooth logistic keeps the ordering intact (so
 * biomes still form contiguous regions) while making the extremes reachable.
 */
function spreadClimate(value: number): number {
  // Centre, then scale so ±1 sigma maps to ±0.5.
  const centred = (value - 0.5) / 0.135;
  // Logistic squash back into (0, 1); gentle enough to preserve gradients.
  return 1 / (1 + Math.exp(-centred * 1.35));
}

/** Map a uniform [0,1) roll onto a size class using `BIOME_SIZE_WEIGHT`. */
function pickSizeClass(roll: number): BiomeSizeClass {
  let cumulative = 0;
  for (const [name, weight] of Object.entries(BIOME_SIZE_WEIGHT) as Array<[BiomeSizeClass, number]>) {
    cumulative += weight;
    if (roll < cumulative) return name;
  }
  return 'medium';
}

/**
 * Pack a column coordinate into a single number for use as a Map key.
 *
 * The height caches are consulted several times per block during generation
 * (the cave, geology, surface and vegetation passes all ask for the height of
 * the column they are working on). They previously used template-string keys;
 * measured over 300k operations, string keys cost 24ms against 5ms for numeric
 * ones, so this is close to a 5x saving on one of the hottest paths.
 *
 * 26 bits per axis covers ±33.5M blocks, far beyond anywhere reachable, and
 * keeps the result inside the exact-integer range of a double.
 */
function columnKey(x: number, z: number): number {
  return (x + 33_554_432) * 67_108_864 + (z + 33_554_432);
}

/** A decoration voxel destined for a chunk that has not been built yet. */
interface SpilledBlock { lx: number; y: number; lz: number; block: BlockID; }

/**
 * How many not-yet-generated chunks may hold buffered overhang writes.
 *
 * Comfortably larger than the biggest render radius, so a feature is never
 * dropped in practice, while still bounding memory on a long exploration run.
 */
const SPILL_CHUNK_LIMIT = 4096;

/** Max columns kept in the height caches (~a few MB at most). */
const HEIGHT_CACHE_LIMIT = 262144;
/**
 * Generated chunks used to accumulate forever as the player explored. This is
 * above the largest supported visible set (radius 10 = 441 chunks), leaving a
 * safety ring while preventing an hours-long session consuming unbounded RAM.
 */
const CHUNK_CACHE_LIMIT = 512;

export class CavesAndCliffsTerrainGenerator {
  private readonly chunks = new Map<string, Chunk>();
  private readonly editOverrides = new Map<string, WorldBlockEdit>();
  /**
   * Decoration voxels that overhang into a chunk which has not been generated
   * yet. Drained by `generateChunk`. See `setBlockIfInChunk`.
   */
  private readonly pendingSpill = new Map<string, SpilledBlock[]>();
  private readonly cachedLayout: ReturnType<typeof getWorldLayout>;
  private readonly noise: AdvancedNoise;
  private readonly caveNoise: AdvancedNoise;
  private readonly detailNoise: AdvancedNoise;
  private readonly riverNoise: AdvancedNoise;
  private readonly biomeNoise: AdvancedNoise;
  private readonly oreNoise: AdvancedNoise;
  /** 2.0 — huge caverns, cave biomes, glow flora and the molten core. */
  private readonly deepCaves: DeepCaveGenerator;
  private readonly heightCache = new Map<number, number>();
  /** Wide-stencil height average used for biome boundaries. */
  private readonly smoothHeightCache = new Map<number, number>();
  /** Memoised biome per column; see `getBiomeAt`. */
  private readonly biomeCache = new Map<number, BiomeDefinition>();
  private readonly rawHeightCache = new Map<number, number>();
  /** Noise reserved for the exotic (Far Lands / sub-bedrock) passes. */
  private readonly exoticNoise: AdvancedNoise;
  /** Stacked worlds below bedrock. Empty unless the preset asks for them. */
  private readonly subBedrock: SubBedrockLayer[];
  public readonly config: WorldGenConfig;
  /**
   * Live developer tuning (the embedded dev app panel drives both fields).
   * `devHeightMultiplier === 1` reproduces the shipped terrain exactly — the
   * multiplier is applied as `plateau + (h - plateau) * m`, an exact no-op at
   * 1 so default worlds stay byte-identical to before.
   */
  private devHeightMultiplier = 1;
  private devBiomeMods: BiomeModificationFlags = { ...DEFAULT_BIOME_MODS };

  constructor(config: Partial<WorldGenConfig> & { seed: string }) {
    this.config = normaliseWorldGenConfig(config);
    this.cachedLayout = getWorldLayout(this.config.seed, { x: 0.5, y: this.config.seaLevel + 2.62, z: 0.5 });
    this.noise = new AdvancedNoise(this.config.seed + ':continent');
    this.caveNoise = new AdvancedNoise(this.config.seed + ':cave');
    this.detailNoise = new AdvancedNoise(this.config.seed + ':detail');
    this.riverNoise = new AdvancedNoise(this.config.seed + ':river');
    this.biomeNoise = new AdvancedNoise(this.config.seed + ':biome');
    this.oreNoise = new AdvancedNoise(this.config.seed + ':ore');
    this.exoticNoise = new AdvancedNoise(this.config.seed + ':exotic');
    this.subBedrock = buildSubBedrockLayers(this.config.subBedrockLayers, this.config.bedrockThickness);
    this.deepCaves = new DeepCaveGenerator({
      seed: this.config.seed,
      bedrockThickness: this.config.bedrockThickness,
      worldDepth: this.config.worldDepth,
      seaLevel: this.config.seaLevel,
    });
  }

  /**
   * Build a chunk by composing every terrain pass.
   *
   * ## Pass ordering contract
   *
   * The pipeline is split into three strictly ordered stages. The ordering is
   * not cosmetic — the artefacts this generator used to produce were all
   * caused by a later stage using data that belonged to an earlier one.
   *
   * ```
   *  STAGE 1 — SHAPE      fillContinents / fillSkyIslands
   *                       (analytic heightmap -> solid voxels)
   *
   *  STAGE 2 — CARVE      caves, deep caves, ravines, sinkholes,
   *                       underground water, ore, geology
   *                       (may only REMOVE or RETYPE voxels)
   *
   *  ------------------- heightmap is now STALE -------------------
   *
   *  STAGE 3 — DRESS      surface masking, vegetation, structures
   *                       (must query the VOXELS, never the heightmap)
   * ```
   *
   * The horizontal rule is the important part. After Stage 2 the analytic
   * `getTerrainHeight()` no longer describes the chunk: a cave may have
   * dropped the real surface twenty blocks. Any Stage 3 code that still calls
   * `getTerrainHeight` is reading a value that was true before the carve, and
   * that is exactly how blocks end up floating. Stage 3 therefore uses
   * `findSkyExposedSurface()` — a real top-down sweep of the voxel array.
   *
   * `getTerrainHeight` remains correct and is still used by Stage 1 and by
   * Stage 2 (which needs to know how much rock is overhead), and by gameplay
   * queries that want a cheap estimate without generating a chunk.
   */
  generateChunk(cx: number, cz: number): Chunk {
    const key = this.chunkKey(cx, cz);
    const cached = this.chunks.get(key);
    if (cached) {
      // Refresh insertion order so active chunks stay in this small LRU.
      this.chunks.delete(key);
      this.chunks.set(key, cached);
      return cached;
    }
    const chunk = new Chunk(cx, cz, this.config.seed, { generate: false });

    /* ---- STAGE 1: base shape from the noise heightmap ---- */
    if (this.config.floatingIslands || this.config.skyIslands) {
      this.fillSkyIslands(chunk);
    } else {
      this.fillContinents(chunk);
    }
    /* ---- STAGE 2: carving. Removes and retypes voxels only. ---- */
    // Developer toggle (panel: "Caves") — switching carving off leaves the
    // underground as one solid mass; surface terrain is untouched either way.
    const carveUnderground = this.devBiomeMods.caves;
    if (carveUnderground) this.applyCavePass(chunk);
    // 2.0 — widen the underground into real caverns with their own biomes.
    // Strictly below the surface; the overworld terrain is untouched.
    if (carveUnderground && !this.config.floatingIslands && !this.config.skyIslands) {
      this.deepCaves.apply(
        chunk,
        (x, z) => this.getTerrainHeight(x, z),
        // Spawn is flattened and refilled later; carving/dressing it first was
        // expensive throwaway work on every startup chunk.
        (x, z) => Math.hypot(x, z) <= SPAWN_PROTECTED_RADIUS + 2
      );
    }
    if (carveUnderground) this.applyRavines(chunk);
    if (carveUnderground) this.applySinkholes(chunk);
    if (carveUnderground) this.applyUndergroundOceansAndRivers(chunk);
    this.applyErosionPass(chunk);
    this.applyAntiFloatingPatch(chunk);
    // Developer toggle (panel: "Ores").
    if (this.devBiomeMods.ores) this.applyOrePass(chunk);
    this.applyGeologyPass(chunk);

    /* ================================================================
     * The analytic heightmap is STALE from here on. Everything below
     * must locate the ground with findSkyExposedSurface(), which reads
     * the voxels that actually exist after carving.
     * ================================================================ */

    /* ---- STAGE 3: dressing ---- */
    this.applySurfacePass(chunk);
    // Overhang from neighbouring chunks' features is applied before this
    // chunk grows its own, so a canopy that crosses the border is already
    // present and local decoration can see it.
    this.applyPendingSpill(chunk);
    // Reconstruct overhangs from deterministic anchors just outside this
    // chunk. This makes the result independent of which neighbour streamed
    // first instead of relying solely on an order-sensitive spill queue.
    // Developer toggles (panel: "Vegetation" / "Structures").
    if (this.devBiomeMods.vegetation) this.applyBorderVegetation(chunk);
    if (this.devBiomeMods.vegetation) this.applyVegetation(chunk);
    if (this.devBiomeMods.structures) this.applyStructures(chunk);
    if (this.devBiomeMods.structures) this.applyMineshafts(chunk);
    // Skylands must really have a void below their islands. The old
    // unconditional foundation painted a walkable floor across y=0.
    if (!this.config.floatingIslands && !this.config.skyIslands) {
      this.applyBedrockFoundation(chunk);
    }
    // 5.0 — the exotic presets that used to be config-only. These run after
    // bedrock so they can legitimately replace it: in a Sub-Bedrock world the
    // floor is no longer the end of the world.
    this.applyCaveWorldPass(chunk);
    this.applySubBedrockPass(chunk);
    // Runs last among the world-shaping passes: every fluid placement above
    // is now guaranteed to have a floor under it.
    this.applyFluidSettling(chunk);
    this.applyPlayableSpawnPatch(chunk);
    this.applyObjectiveClearings(chunk);
    // Validate the generated result before player-authored edits are restored.
    // Saved creative edits may intentionally remove bedrock and must win.
    this.ensureChunkIntegrity(chunk);
    this.applySavedEdits(chunk);
    if (this.chunks.size >= CHUNK_CACHE_LIMIT) {
      const oldest = this.chunks.keys().next().value as string | undefined;
      if (oldest !== undefined) this.chunks.delete(oldest);
    }
    this.chunks.set(key, chunk);
    return chunk;
  }

  /* ============= CAVES & CLIFFS TERRAIN SHAPE ============= */

  /** Continentalness in [0, 1], sampled from independently warped X/Z. */
  getBaseHeight(worldX: number, worldZ: number): number {
    const x = finiteOr(worldX, 0) * this.config.continentScale;
    const z = finiteOr(worldZ, 0) * this.config.continentScale;
    const warped = this.noise.warpPoint2D(x, z, 1.6, 1);
    const warpedX = finiteOr(warped.x, x);
    const warpedZ = finiteOr(warped.y, z);
    return clamp(finiteOr(this.noise.fbm2D(warpedX, warpedZ, 5, 2, 0.5, 2), 0.5), 0, 1);
  }

  /** Peaks-and-valleys ridge field in [0, 1]. */
  getMountainHeight(worldX: number, worldZ: number): number {
    const x = finiteOr(worldX, 0) * this.config.continentScale * 2;
    const z = finiteOr(worldZ, 0) * this.config.continentScale * 2;
    const ridges = finiteOr(this.noise.ridge2D(x, z, 5, 5), 0);
    const modulation = finiteOr(this.noise.fbm2D(x, z, 4, 2, 0.5, 6), 0.5);
    return clamp(ridges * 0.72 + modulation * 0.28, 0, 1);
  }

  /**
   * Stable approximation of Minecraft 1.18's four terrain controls.
   * Every channel has an explicit finite fallback; an invalid noise sample
   * therefore means ordinary mid-continent stone, never a missing column.
   */
  private sampleTerrainShape(worldX: number, worldZ: number): TerrainShapeSample {
    const x = finiteOr(worldX, 0);
    const z = finiteOr(worldZ, 0);
    const continentalness = this.getBaseHeight(x, z);
    const erosion = clamp(finiteOr(this.detailNoise.fbm2D(
      (x + 173) * this.config.continentScale * 1.7,
      (z - 281) * this.config.continentScale * 1.7,
      4,
      2,
      0.5,
      31
    ), 0.5), 0, 1);
    const peaksAndValleys = this.getMountainHeight(x, z);
    const detail = clamp(finiteOr(this.detailNoise.fbm2D(
      x * this.config.detailScale,
      z * this.config.detailScale,
      4,
      2,
      0.5,
      11
    ), 0.5), 0, 1);

    return { continentalness, erosion, peaksAndValleys, detail };
  }

  /** Final legal integer terrain height. */
  getTerrainHeight(worldX: number, worldZ: number): number {
    const x = Math.floor(finiteOr(worldX, 0));
    const z = Math.floor(finiteOr(worldZ, 0));
    const key = columnKey(x, z);
    const cached = this.heightCache.get(key);
    if (cached !== undefined) return cached;

    const computed = this.computeTerrainHeight(x, z);
    // Developer amplification: stretch relief away from the spawn-plateau
    // reference (seaLevel - 6). At the 1× default it is an exact identity,
    // and the protected spawn blend is unaffected because it sits ON the
    // reference height. Sky-island and flat presets pivot on their own
    // reference so they stay stable too.
    const reference = this.config.seaLevel - 6;
    const amplified = reference + (computed - reference) * this.devHeightMultiplier;
    const height = Number.isFinite(amplified)
      ? clamp(Math.round(amplified), this.config.bedrockThickness, this.config.worldDepth - 8)
      : this.fallbackSurfaceHeight();
    this.rememberHeight(this.heightCache, key, height);
    return height;
  }

  /** Height before the bounded erosion filter. Never calls getTerrainHeight. */
  private getRawTerrainHeight(worldX: number, worldZ: number): number {
    const x = Math.floor(finiteOr(worldX, 0));
    const z = Math.floor(finiteOr(worldZ, 0));
    const key = columnKey(x, z);
    const cached = this.rawHeightCache.get(key);
    if (cached !== undefined) return cached;

    const shape = this.sampleTerrainShape(x, z);
    const continentalHeight = this.config.seaLevel - 4 + shape.continentalness * 32;

    // Mountains need inland continentalness and low erosion. Squaring the ridge
    // gives sharp peaks without the unbounded 120x multiplier from the old pass.
    const inland = smoothstep(0.4, 0.72, shape.continentalness);
    const preservedTerrain = 1 - smoothstep(0.38, 0.78, shape.erosion);
    const mountainMask = inland * preservedTerrain;
    const peak = shape.peaksAndValleys * shape.peaksAndValleys;
    const mountains = peak * mountainMask * 60 * this.config.mountainIntensity;
    const detail = (shape.detail - 0.5) * 7;
    const raw = continentalHeight + mountains + detail + this.getBeachHeight(x, z);
    const safe = finiteOr(raw, this.fallbackSurfaceHeight());

    this.rememberHeight(this.rawHeightCache, key, safe);
    return safe;
  }

  /** Compose terrain shape, erosion, valleys and optional exotic transforms. */
  private computeTerrainHeight(worldX: number, worldZ: number): number {
    if (this.config.flatGroundY !== null) return this.config.flatGroundY;
    if (this.config.floatingIslands || this.config.skyIslands) {
      return this.getFloatingIslandHeight(worldX, worldZ);
    }

    let height = this.applyHydraulicErosion(
      this.getRawTerrainHeight(worldX, worldZ),
      worldX,
      worldZ
    ) - this.getValleyHeight(worldX, worldZ);

    const corruption = finiteOr(
      farLandsCorruption(worldX, worldZ, this.config.farLandsThreshold),
      0
    );
    if (corruption > 0) {
      const far = sampleFarLands(
        this.exoticNoise,
        worldX,
        worldZ,
        clamp(corruption, 0, 1),
        this.config.worldDepth
      );
      const boost = finiteOr(far.heightBoost, 0);
      height += boost * clamp(corruption, 0, 1);
      if (far.tunnel) height = Math.min(height, this.config.seaLevel - 10);
    }

    if (this.config.inverted) {
      height = finiteOr(
        invertHeight(height, this.config.seaLevel, this.config.worldDepth),
        this.fallbackSurfaceHeight()
      );
    }

    // Smoothly join the protected spawn plateau to procedural terrain.
    const spawnDistance = Math.hypot(worldX, worldZ);
    if (spawnDistance < SPAWN_TERRAIN_BLEND_RADIUS) {
      const spawnHeight = this.config.seaLevel - 6;
      if (spawnDistance <= SPAWN_PROTECTED_RADIUS) return spawnHeight;
      const blend = smoothstep(
        SPAWN_PROTECTED_RADIUS,
        SPAWN_TERRAIN_BLEND_RADIUS,
        spawnDistance
      );
      height = spawnHeight + (height - spawnHeight) * blend;
    }

    return finiteOr(height, this.fallbackSurfaceHeight());
  }

  private fallbackSurfaceHeight(): number {
    return clamp(
      this.config.seaLevel - 6,
      this.config.bedrockThickness + 4,
      this.config.worldDepth - 8
    );
  }

  /** Small bounded insertion-order cache used by hot world-generation paths. */
  private rememberHeight(cache: Map<number, number>, key: number, value: number): void {
    if (cache.size >= HEIGHT_CACHE_LIMIT) {
      let toDrop = Math.floor(HEIGHT_CACHE_LIMIT / 4);
      for (const oldKey of cache.keys()) {
        cache.delete(oldKey);
        if (--toDrop <= 0) break;
      }
    }
    cache.set(key, value);
  }

  getFloatingIslandHeight(worldX: number, worldZ: number): number {
    const x = finiteOr(worldX, 0);
    const z = finiteOr(worldZ, 0);
    const continent = finiteOr(this.noise.fbm2D(x * 0.0028, z * 0.0028, 5, 2, 0.5, 1), 0.5);
    const island = finiteOr(this.noise.fbm2D((x + 413) * 0.012, (z - 199) * 0.012, 3, 2, 0.5, 3), 0.5);
    const ridge = finiteOr(this.noise.ridge2D(x * 0.005, z * 0.005, 4, 5), 0);
    const mask = Math.max(0, island - 0.45) * 4;
    const raw = this.config.seaLevel + 18 + continent * 22 + ridge * 18 * mask;
    return clamp(
      Math.round(finiteOr(raw, this.config.worldDepth - 24)),
      this.config.worldDepth - 60,
      this.config.worldDepth - 8
    );
  }

  /** Long shallow valleys along a high ridge-noise contour. */
  getValleyHeight(worldX: number, worldZ: number): number {
    const x = finiteOr(worldX, 0);
    const z = finiteOr(worldZ, 0);
    const ridge = clamp(finiteOr(
      this.noise.ridge2D((x - 423) * 0.0048, (z + 827) * 0.0048, 4, 9),
      0
    ), 0, 1);
    return ridge < 0.74 ? 0 : ((ridge - 0.74) / 0.26) * 8;
  }

  /** Small coastal lift around low-continentalness shorelines. */
  getBeachHeight(worldX: number, worldZ: number): number {
    const continentalness = this.getBaseHeight(worldX, worldZ);
    return continentalness > 0.55 ? 0 : (0.55 - continentalness) * 4;
  }

  /**
   * One bounded thermal-erosion filter. It samples only the raw field, so it
   * cannot recurse and its cost cannot grow into a chaotic iterative loop.
   */
  private applyHydraulicErosion(height: number, worldX: number, worldZ: number): number {
    if (this.config.erosionIterations <= 0) {
      return finiteOr(height, this.fallbackSurfaceHeight());
    }

    const radius = 1 + this.config.erosionIterations;
    const mean = (
      this.getRawTerrainHeight(worldX + radius, worldZ)
      + this.getRawTerrainHeight(worldX - radius, worldZ)
      + this.getRawTerrainHeight(worldX, worldZ + radius)
      + this.getRawTerrainHeight(worldX, worldZ - radius)
    ) / 4;
    const strength = Math.min(0.42, this.config.erosionIterations * 0.14);
    return finiteOr(height + (mean - height) * strength, this.fallbackSurfaceHeight());
  }

  /* ============= FILL PASSES ============= */

  private fillContinents(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      const surface = Math.min(CHUNK_HEIGHT - 1, this.getTerrainHeight(wx, wz));
      // Chunks are born empty. Writing another ~90 AIR values per column was
      // doing tens of thousands of redundant setBlock calls on the hottest
      // startup path.
      for (let y = 0; y <= surface; y++) {
        chunk.setBlock(lx, y, lz, this.pickColumnBlock(y, surface, wx, wz));
      }
    });
  }

  private fillSkyIslands(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      const top = Math.min(CHUNK_HEIGHT - 1, this.getFloatingIslandHeight(wx, wz));
      const thicknessNoise = finiteOr(
        this.noise.fbm2D(wx * 0.018, wz * 0.018, 3, 2, 0.5, 31),
        0.5
      );
      const bottom = Math.max(
        this.config.bedrockThickness,
        top - (8 + Math.floor(clamp(thicknessNoise, 0, 1) * 12))
      );
      // Only the finite island body is solid. The previous `else` wrote grass
      // from `top` all the way to y=127, turning every sky island into an
      // upside-down solid column and making the intended void nonsensical.
      for (let y = bottom; y <= top; y++) {
        if (y < top - 4) chunk.setBlock(lx, y, lz, BLOCK.STONE);
        else if (y < top) chunk.setBlock(lx, y, lz, BLOCK.DIRT);
        else chunk.setBlock(lx, y, lz, BLOCK.GRASS);
      }
    });
  }

  /** Picks a block by depth relative to the surface, before any biomes. */
  private pickColumnBlock(y: number, surface: number, _worldX: number, _worldZ: number): BlockID {
    if (y < this.config.bedrockThickness) return BEDROCK_MIX[Math.min(BEDROCK_MIX.length - 1, Math.floor((y / this.config.bedrockThickness) * BEDROCK_MIX.length))];
    if (y > surface) return BLOCK.AIR;
    if (y === surface) return BLOCK.GRASS;
    if (y >= surface - 1) return BLOCK.DIRT;
    if (y >= surface - 3) return BLOCK.DIRT;
    return BLOCK.STONE;
  }

  /* ============= CAVE DENSITY PASS ============= */

  /**
   * Carve a bounded 1.18-style mix of spaghetti tunnels and cheese rooms.
   * Negative density means air; zero/positive density remains solid. Invalid
   * samples intentionally resolve positive so corrupted noise can never carve
   * an unbounded transparent shaft through a chunk.
   */
  private applyCavePass(chunk: Chunk): void {
    if (this.config.caveScale === 0) return;

    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      if (Math.hypot(wx, wz) <= SPAWN_PROTECTED_RADIUS + 2) return;

      const surface = this.getTerrainHeight(wx, wz);
      const region = finiteOr(
        this.caveNoise.fbm2D(wx * 0.0022, wz * 0.0022, 3, 2, 0.5, 151),
        0
      );
      const regionStrength = clamp((region - 0.32) / 0.68, 0, 1);
      if (regionStrength <= 0) return;

      const bottom = this.config.bedrockThickness + 2;
      const top = Math.min(surface - 6, CHUNK_HEIGHT - 1);
      if (top <= bottom) return;
      const span = Math.max(1, top - bottom);

      for (let y = bottom; y < top; y += 1) {
        const block = chunk.getBlock(lx, y, lz);
        if (block === BLOCK.AIR || block === BLOCK.WATER || block === BLOCK.LAVA) continue;

        const vertical = Math.sin(Math.PI * ((y - bottom) / span));
        if (vertical <= 0.05) continue;
        const density = this.sampleCaveDensity(wx, y, wz, vertical, regionStrength);
        if (density < 0) chunk.setBlock(lx, y, lz, BLOCK.AIR);
      }
    });
  }

  private sampleCaveDensity(
    worldX: number,
    y: number,
    worldZ: number,
    vertical: number,
    regionStrength: number
  ): number {
    const scaleMultiplier = this.config.caveScale >= 2 ? 1.15 : 0.85;
    const radius = 0.075
      * scaleMultiplier
      * (0.55 + regionStrength * 0.45)
      * vertical;

    const first = finiteOr(this.caveNoise.fbm3D(
      worldX * 0.014,
      y * 0.026,
      worldZ * 0.014,
      2,
      2,
      0.5,
      1
    ), 1) - 0.5;

    // Most points can be rejected after one field, avoiding a second 3D sample.
    let spaghettiDensity = Math.abs(first) - radius;
    if (Math.abs(first) < radius) {
      const second = finiteOr(this.caveNoise.fbm3D(
        (worldX + 211) * 0.014,
        y * 0.026,
        (worldZ - 503) * 0.014,
        2,
        2,
        0.5,
        2
      ), 1) - 0.5;
      spaghettiDensity = Math.hypot(first, second) - radius;
    }

    const cheese = finiteOr(this.caveNoise.fbm3D(
      worldX * 0.0075,
      y * 0.011,
      worldZ * 0.0075,
      2,
      2,
      0.5,
      3
    ), 0);
    const cheeseThreshold = 0.82 - regionStrength * 0.05 - vertical * 0.07;
    const cheeseDensity = cheeseThreshold - cheese;
    return finiteOr(Math.min(spaghettiDensity, cheeseDensity), 1);
  }

  /* ============= RAVINES ============= */

  /**
   * Ravines — long, narrow gashes cut down into the rock.
   *
   * ## Why this was the single worst underground bug
   *
   * The old version was measured hollowing **99.4% of the rock column** in
   * affected regions — far more than the cave passes combined, and the true
   * cause of the "underground is a complete empty area, hollow" report.
   *
   * Three compounding mistakes:
   *
   *   1. `ridge2D` output is seed-shifted, so `r < 0.93` rejected almost
   *      nothing on some seeds and a whole region qualified at once — rather
   *      than the thin line a ravine is supposed to be.
   *   2. Qualifying columns were carved from bedrock to 4 below the surface,
   *      i.e. the *entire* column, so a ravine was a bottomless shaft.
   *   3. The width test sampled `noise2D(wx, y)` — x against *height*, with no
   *      z term at all — so it had no notion of distance from a ravine centre
   *      and simply speckled ~45% of the column away.
   *
   * The rewrite places ravines the same deterministic way structures are
   * placed: on a coarse cell grid, with an explicit chance, an explicit
   * length, width and depth, and a real distance-to-centreline test. A ravine
   * is now a discrete feature you can find, walk along and climb out of.
   */
  private applyRavines(chunk: Chunk): void {
    if (!this.config.ravines) return;

    // Ravines live on a coarse grid; only a small fraction of cells host one.
    const cellSize = RAVINE_CELL_SIZE;
    const originX = chunk.x * CHUNK_SIZE;
    const originZ = chunk.z * CHUNK_SIZE;
    const cellX = Math.floor(originX / cellSize);
    const cellZ = Math.floor(originZ / cellSize);

    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const cx = cellX + dx;
        const cz = cellZ + dz;
        if (this.caveNoise.hash(cx, cz, 0, 211) > RAVINE_CHANCE) continue;

        // Centre, orientation and dimensions of this ravine.
        const centerX = (cx + this.caveNoise.hash(cx, cz, 1, 212)) * cellSize;
        const centerZ = (cz + this.caveNoise.hash(cx, cz, 2, 213)) * cellSize;
        const angle = this.caveNoise.hash(cx, cz, 3, 214) * Math.PI;
        const dirX = Math.cos(angle);
        const dirZ = Math.sin(angle);
        const length = RAVINE_MIN_LENGTH
          + this.caveNoise.hash(cx, cz, 4, 215) * (RAVINE_MAX_LENGTH - RAVINE_MIN_LENGTH);
        const halfWidth = RAVINE_MIN_WIDTH
          + this.caveNoise.hash(cx, cz, 5, 216) * (RAVINE_MAX_WIDTH - RAVINE_MIN_WIDTH);

        this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
          // Do not let an open ravine slice through the spawn transition. The
          // ordinary sealed cave network may continue below it, but the first
          // view of a world must remain coherent and walkable.
          if (Math.hypot(wx, wz) < SPAWN_TERRAIN_BLEND_RADIUS) return;

          // Project onto the ravine's axis to get along/across coordinates.
          const relX = wx - centerX;
          const relZ = wz - centerZ;
          const along = relX * dirX + relZ * dirZ;
          if (Math.abs(along) > length / 2) return;
          const across = Math.abs(-relX * dirZ + relZ * dirX);

          // Taper the ends so a ravine narrows to a point instead of
          // stopping at a sheer wall.
          const endTaper = 1 - Math.abs(along) / (length / 2);
          // Gentle meander so it is not a perfectly straight trench.
          const meander = (this.caveNoise.noise2D(along * 0.05, cx * 7.3 + cz, 217) - 0.5) * halfWidth * 1.5;
          const distance = Math.abs(across - meander);
          const width = halfWidth * endTaper;
          if (distance > width) return;

          const surface = this.getTerrainHeight(wx, wz);
          // Depth profile: deepest at the centreline, shallow at the edges.
          const edge = 1 - distance / Math.max(0.001, width);
          const floorY = Math.max(
            this.config.bedrockThickness + 2,
            Math.round(surface - RAVINE_MIN_DEPTH - edge * RAVINE_EXTRA_DEPTH)
          );
          // Ravines open at the surface, but keep a couple of blocks of lip.
          const ceilingY = surface - 2;
          for (let y = floorY; y <= ceilingY; y++) {
            const current = chunk.getBlock(lx, y, lz);
            if (current === BLOCK.AIR) continue;
            chunk.setBlock(lx, y, lz, BLOCK.AIR);
          }
        });
      }
    }
  }

  /* ============= SINKHOLES ============= */

  /**
   * Build a world-space crater depth map, then carve it once. Neighbouring
   * chunks evaluate the same anchor cells, so a crater cannot stop at a chunk
   * edge. A one-block stone floor seals the crater from a cavern immediately
   * below it, preventing an accidental open X-ray shaft into the cave network.
   */
  private applySinkholes(chunk: Chunk): void {
    if (!this.config.sinkholes) return;

    const originX = chunk.x * CHUNK_SIZE;
    const originZ = chunk.z * CHUNK_SIZE;
    const firstCellX = Math.floor((originX - SINKHOLE_MAX_RADIUS) / SINKHOLE_CELL_SIZE);
    const lastCellX = Math.floor((originX + CHUNK_SIZE - 1 + SINKHOLE_MAX_RADIUS) / SINKHOLE_CELL_SIZE);
    const firstCellZ = Math.floor((originZ - SINKHOLE_MAX_RADIUS) / SINKHOLE_CELL_SIZE);
    const lastCellZ = Math.floor((originZ + CHUNK_SIZE - 1 + SINKHOLE_MAX_RADIUS) / SINKHOLE_CELL_SIZE);
    const carveFrom = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
    carveFrom.fill(CHUNK_HEIGHT);

    for (let cellX = firstCellX; cellX <= lastCellX; cellX += 1) {
      for (let cellZ = firstCellZ; cellZ <= lastCellZ; cellZ += 1) {
        const anchorX = cellX * SINKHOLE_CELL_SIZE + Math.floor(
          finiteOr(this.noise.hash(cellX, cellZ, 0, 41), 0.5) * SINKHOLE_CELL_SIZE
        );
        const anchorZ = cellZ * SINKHOLE_CELL_SIZE + Math.floor(
          finiteOr(this.noise.hash(cellX, cellZ, 1, 42), 0.5) * SINKHOLE_CELL_SIZE
        );
        if (Math.hypot(anchorX, anchorZ) < SPAWN_TERRAIN_BLEND_RADIUS) continue;

        const radius = SINKHOLE_MIN_RADIUS + Math.floor(
          clamp(finiteOr(this.noise.hash(cellX, cellZ, 2, 43), 0), 0, 0.999999)
          * (SINKHOLE_MAX_RADIUS - SINKHOLE_MIN_RADIUS + 1)
        );
        const depth = 8 + Math.floor(
          clamp(finiteOr(this.noise.hash(cellX, cellZ, 3, 44), 0), 0, 0.999999) * 6
        );
        const minX = Math.max(originX, anchorX - radius);
        const maxX = Math.min(originX + CHUNK_SIZE - 1, anchorX + radius);
        const minZ = Math.max(originZ, anchorZ - radius);
        const maxZ = Math.min(originZ + CHUNK_SIZE - 1, anchorZ + radius);

        for (let wx = minX; wx <= maxX; wx += 1) {
          for (let wz = minZ; wz <= maxZ; wz += 1) {
            const distance = Math.hypot(wx - anchorX, wz - anchorZ);
            if (distance > radius) continue;
            const carveDepth = Math.round(depth * (1 - distance / radius));
            if (carveDepth <= 0) continue;
            const surface = this.getTerrainHeight(wx, wz);
            const from = Math.max(this.config.bedrockThickness, surface - carveDepth);
            const lx = wx - originX;
            const lz = wz - originZ;
            const index = lx + CHUNK_SIZE * lz;
            carveFrom[index] = Math.min(carveFrom[index], from);
          }
        }
      }
    }

    for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
        const from = carveFrom[lx + CHUNK_SIZE * lz];
        if (from >= CHUNK_HEIGHT) continue;
        const wx = originX + lx;
        const wz = originZ + lz;
        const surface = this.getTerrainHeight(wx, wz);
        for (let y = from; y < surface; y += 1) chunk.setBlock(lx, y, lz, BLOCK.AIR);

        const floorY = from - 1;
        if (floorY >= this.config.bedrockThickness
          && chunk.getBlock(lx, floorY, lz) === BLOCK.AIR) {
          chunk.setBlock(lx, floorY, lz, BLOCK.STONE);
        }
      }
    }
  }

  /* ============= UNDERGROUND OCEANS / RIVERS ============= */

  private applyUndergroundOceansAndRivers(chunk: Chunk): void {
    if (this.config.undergroundOceans) this.applyUndergroundOcean(chunk);
    if (this.config.undergroundRivers) this.applyUndergroundRiver(chunk);
  }

  /**
   * Underground lakes.
   *
   * ## The floating-water bug
   *
   * The old version wrote water into a fixed Y band (14..19) for every column
   * of a qualifying chunk **without checking whether anything was under it**.
   * Wherever the cave pass had hollowed that band out, the result was a slab
   * of water hanging in mid-air over an empty cavern — the "pool of water just
   * randomly floated" the player reported. It also ignored `chunk.x` being a
   * *chunk* coordinate while sampling noise as though it were a world
   * coordinate, so entire 16×16 chunks flooded uniformly, giving the hard
   * rectangular edges.
   *
   * Now lakes only fill air pockets that sit in a genuine basin: every water
   * block must have a solid block beneath it (or more water resting on solid),
   * so a lake always has a floor. The surface is picked per column from a
   * smooth noise field, which gives natural, level pools instead of slabs.
   */
  private applyUndergroundOcean(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      const surface = this.getTerrainHeight(wx, wz);
      // Sample in WORLD space — the old code used chunk indices here.
      const band = this.noise.fbm2D(wx * 0.0018, wz * 0.0018, 3, 2.0, 0.5, 51);
      if (band < 0.68) return;

      // Water table for this column, well below the surface.
      const floor = this.config.bedrockThickness + 1;
      const ceiling = Math.max(floor + 2, Math.floor(surface * 0.42));
      const level = Math.min(ceiling, floor + 4 + Math.floor(band * 6));

      for (let y = floor; y <= level; y++) {
        if (chunk.getBlock(lx, y, lz) !== BLOCK.AIR) continue;
        const below = chunk.getBlock(lx, y - 1, lz);
        // The floor rule: only pour water where something can hold it up.
        if (below === BLOCK.AIR) continue;
        chunk.setBlock(lx, y, lz, BLOCK.WATER);
      }
    });
  }

  /**
   * Underground rivers — thin flooded channels along a ridge line.
   *
   * Same floor rule as the lakes: no water is placed unless the block beneath
   * it is solid or already water, so channels never hang in the air.
   */
  private applyUndergroundRiver(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      // World-space sampling so the channel is continuous across chunk seams
      // instead of snapping to a 16-block grid.
      const centerline = this.riverNoise.ridge2D(wx * 0.0016, wz * 0.0016, 4, 33);
      if (centerline < 0.955) return;

      const surface = this.getTerrainHeight(wx, wz);
      const baseY = Math.max(this.config.bedrockThickness + 2, Math.floor(surface * 0.5));
      for (let y = baseY; y < baseY + 3; y++) {
        if (y >= CHUNK_HEIGHT - 1) break;
        if (chunk.getBlock(lx, y, lz) !== BLOCK.AIR) continue;
        const below = chunk.getBlock(lx, y - 1, lz);
        if (below === BLOCK.AIR) continue;
        chunk.setBlock(lx, y, lz, BLOCK.WATER);
      }
    });
  }

  /**
   * Final safety net: delete any water that still has nothing underneath it.
   *
   * Several passes can place fluid (lakes, rivers, sea fill, deep caves) and a
   * later carve can then remove the block that was supporting it. Rather than
   * making every pass defensive, this sweeps the finished chunk bottom-up and
   * drops unsupported water. Bottom-up matters: removing a block can unsupport
   * the one above it, and a single upward pass catches that chain.
   */
  private applyFluidSettling(chunk: Chunk): void {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = this.config.bedrockThickness; y < CHUNK_HEIGHT; y++) {
          if (chunk.getBlock(lx, y, lz) !== BLOCK.WATER) continue;
          const below = chunk.getBlock(lx, y - 1, lz);
          if (below === BLOCK.AIR) chunk.setBlock(lx, y, lz, BLOCK.AIR);
        }
      }
    }
  }

  /* ============= EROSION / ANTI-FLOATING ============= */

  private applyErosionPass(chunk: Chunk): void {
    // For now the hydraulic-erosion term is folded into the heightmap.  We
    // reserve this pass for a future 3D slope-based carve.  Kept as a hook.
    void chunk;
  }

  /** Fills single-air gaps in solid stone columns (no floating dirt). */
  private applyAntiFloatingPatch(chunk: Chunk): void {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let y = 1; y < CHUNK_HEIGHT - 1; y++) {
        const above = chunk.getBlock(lx, y + 1, lz);
        const below = chunk.getBlock(lx, y - 1, lz);
        if (chunk.getBlock(lx, y, lz) === BLOCK.AIR && above !== BLOCK.AIR && below !== BLOCK.AIR && above !== BLOCK.WATER && below !== BLOCK.WATER) {
          chunk.setBlock(lx, y, lz, BLOCK.DIRT);
        }
      }
    }
  }

  /* ============= ORE PASS ============= */

  private applyOrePass(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      const surface = this.getTerrainHeight(wx, wz);
      const ore = this.oreNoise.fbm3D(wx * 0.04, surface * 0.04, wz * 0.04, 2, 2.0, 0.5, 71);
      if (ore < 0.78) return;
      const lx2 = lx + Math.floor(this.oreNoise.hash(wx, surface, wz, 73) * 3) - 1;
      const ly2 = surface - 4 - Math.floor(this.oreNoise.hash(wx, surface, wz, 74) * 16);
      const lz2 = lz + Math.floor(this.oreNoise.hash(wx, surface, wz, 75) * 3) - 1;
      if (lx2 < 0 || lx2 >= CHUNK_SIZE || lz2 < 0 || lz2 >= CHUNK_SIZE) return;
      if (ly2 <= this.config.bedrockThickness || ly2 >= surface - 2) return;
      if (chunk.getBlock(lx2, ly2, lz2) !== BLOCK.STONE) return;
      const oreType = this.pickOreType(ly2, surface);
      chunk.setBlock(lx2, ly2, lz2, oreType);
    });
  }

  private pickOreType(y: number, surface: number): BlockID {
    const depth = (surface - y) / Math.max(1, surface);
    const r = this.noise.hash(y, surface, 0, 81);
    if (depth > 0.85) return r < 0.6 ? BLOCK.DEEPSLATE_DIAMOND : BLOCK.DEEPSLATE_GOLD;
    if (depth > 0.7) return r < 0.5 ? BLOCK.DIAMOND : BLOCK.GOLD;
    if (depth > 0.45) return r < 0.6 ? BLOCK.DEEPSLATE_IRON : BLOCK.IRON;
    if (depth > 0.2) return r < 0.6 ? BLOCK.DEEPSLATE_COAL : BLOCK.COAL;
    return BLOCK.COAL;
  }

  /* ============= GEOLOGY (stone layers) ============= */

  private applyGeologyPass(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      const surface = this.getTerrainHeight(wx, wz);
      for (let y = this.config.bedrockThickness; y < surface - 4; y++) {
        const current = chunk.getBlock(lx, y, lz);
        if (current !== BLOCK.STONE) continue;
        const depth = (surface - y) / Math.max(1, surface);
        // PERF: deepslate is decided purely by depth, so return before paying
        // for any noise. Both fbm samples were previously evaluated for every
        // block including the deep majority that could never use them.
        if (depth > 0.6) { chunk.setBlock(lx, y, lz, BLOCK.DEEPSLATE); continue; }

        const n = this.noise.fbm2D(wx * 0.015, y * 0.022, 3, 2.0, 0.5, 91);
        // `n2` is only consulted when the `n` ladder falls through, so it is
        // evaluated lazily rather than up front.
        if (n < 0.18) chunk.setBlock(lx, y, lz, BLOCK.GRANITE);
        else if (n < 0.36) chunk.setBlock(lx, y, lz, BLOCK.DIORITE);
        else if (n < 0.54) chunk.setBlock(lx, y, lz, BLOCK.ANDESITE);
        else if (this.noise.fbm2D(wx * 0.013 + 7, (y + 13) * 0.018, 3, 2.0, 0.5, 92) < 0.25) {
          chunk.setBlock(lx, y, lz, BLOCK.STONE_BRICKS);
        }
      }
    });
  }

  /* ============= SURFACE BIOMES ============= */

  /**
   * Per-biome surface material. Pure data, so the sweep below stays a single
   * well-defined algorithm instead of a wall of `if`s inside a loop.
   *
   *  - `top`    goes on the one block that is exposed to the sky.
   *  - `filler` replaces DIRT immediately underneath, for `fillerDepth` blocks.
   */
  private surfacePaletteFor(biomeId: string): { top: BlockID; filler: BlockID; fillerDepth: number } {
    switch (biomeId) {
      case 'desert':
      case 'badlands':
      case 'eroded_badlands':
      case 'wooded_badlands':
        return { top: BLOCK.SAND, filler: BLOCK.SAND, fillerDepth: 3 };
      case 'beach':
      case 'warm_beach':
      case 'snowy_beach':
        return { top: BLOCK.SAND, filler: BLOCK.SAND, fillerDepth: 2 };
      case 'snowy_plains':
      case 'snowy_taiga':
      case 'ice_spikes':
      case 'frozen_wasteland_biome':
        return { top: BLOCK.SNOW, filler: BLOCK.DIRT, fillerDepth: 3 };
      case 'mushroom_fields':
      case 'mushroom_island':
      case 'mushroom_valley':
      case 'mushroom_biome':
        return { top: BLOCK.MOSS, filler: BLOCK.DIRT, fillerDepth: 3 };
      case 'ocean_world_biome':
      case 'deep_ocean':
      case 'frozen_ocean':
        return { top: BLOCK.GRAVEL, filler: BLOCK.GRAVEL, fillerDepth: 2 };
      case 'warm_ocean':
      case 'lukewarm_ocean':
      case 'cold_ocean':
      case 'coral_reef':
      case 'coral_coast':
      case 'coral_reef_biome':
        return { top: BLOCK.SAND, filler: BLOCK.SAND, fillerDepth: 2 };
      case 'swamp':
      case 'mangrove_swamp':
      case 'mangrove_biome':
      case 'mangrove_delta':
        return { top: BLOCK.MUD, filler: BLOCK.DIRT, fillerDepth: 3 };
      case 'volcano':
      case 'volcanic_realm_biome':
      case 'lava_field':
        return { top: BLOCK.BASALT, filler: BLOCK.BASALT, fillerDepth: 3 };
      default:
        return { top: BLOCK.GRASS, filler: BLOCK.DIRT, fillerDepth: 3 };
    }
  }

  /**
   * PASS 3 — Surface masking by top-down sky exposure.
   *
   * ## The bug this replaces: floating sheets of grass
   *
   * The old pass painted the surface material at one Y taken from the
   * *analytic* heightmap:
   *
   * ```ts
   * const surface = this.getTerrainHeight(wx, wz);   // analytic, not actual
   * chunk.setBlock(lx, surface, lz, BLOCK.GRASS);    // unconditional write
   * ```
   *
   * That Y is where the terrain *would* be if nothing had touched it. But by
   * the time this pass runs, the cave / ravine / sinkhole / deep-cave passes
   * have already carved the column, so `surface` is frequently inside a void.
   * The write then *created* a block in mid-air. Because the analytic height
   * varies smoothly across neighbouring columns, those stray blocks lined up
   * into continuous horizontal sheets of grass hanging in the sky and slicing
   * through tree trunks — precisely the reported artefact. Measured on the
   * shipped generator: 523 columns per 7x7-chunk area had the analytic surface
   * sitting over air, and 8.6% of columns disagreed with the real terrain top.
   *
   * ## The replacement
   *
   * A strict top-down vertical sweep per column:
   *
   *   1. Walk from the sky down. Track whether we are still "open to the sky"
   *      (only air/leaves/water seen so far).
   *   2. The first solid block found while open is the true surface. Paint the
   *      biome's top material **there and nowhere else**.
   *   3. Paint filler into the DIRT directly beneath it.
   *   4. Once a solid block is passed, sky exposure is off — so nothing is
   *      painted on cave ceilings or on the roofs of overhangs below.
   *
   * Every write is therefore conditional on an *observed* solid voxel. The
   * pass can only ever recolour a block that already exists; it can never
   * create one in mid-air, which makes floating topsoil structurally
   * impossible rather than merely unlikely.
   */
  private applySurfacePass(chunk: Chunk): void {
    const seaLevel = this.config.seaLevel;
    // Developer toggles (panel): "Surface Paint" guards the biome coat
    // (steps 1-4), "Lakes" guards the sea-level water fill (step 5).
    const paint = this.devBiomeMods.surfacePaint;
    const waterFill = this.devBiomeMods.lakes;
    if (!paint && !waterFill) return;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = chunk.x * CHUNK_SIZE + lx;
        const wz = chunk.z * CHUNK_SIZE + lz;
        if (Math.hypot(wx, wz) < SPAWN_PROTECTED_RADIUS) continue;

        // --- step 1: find the real, sky-exposed top of this column ----------
        const surfaceY = this.findSkyExposedSurface(chunk, lx, lz);
        if (surfaceY < 0) continue;                       // column is all air
        if (surfaceY <= this.config.bedrockThickness) continue;

        if (paint) {
          const biome = this.getBiomeAt(wx, wz);
          const palette = this.surfacePaletteFor(biome.id);
          // Underwater columns keep a sediment bed rather than grass; grass
          // below the waterline was another source of odd-looking surfaces.
          const submerged = surfaceY < seaLevel;
          const top = submerged
            ? (palette.top === BLOCK.SAND ? BLOCK.SAND : BLOCK.GRAVEL)
            : palette.top;

          // --- step 2: paint the exposed block, and only that block ---------
          const existing = chunk.getBlock(lx, surfaceY, lz);
          // Never repaint structural / placed materials (logs, bricks, ores,
          // obsidian...). Only natural ground accepts a surface coat.
          if (isNaturalGround(existing)) {
            chunk.setBlock(lx, surfaceY, lz, top);
          }

          // --- step 3: filler directly beneath, while it is still dirt ------
          for (let d = 1; d <= palette.fillerDepth; d++) {
            const y = surfaceY - d;
            if (y <= this.config.bedrockThickness) break;
            if (chunk.getBlock(lx, y, lz) !== BLOCK.DIRT) break;
            chunk.setBlock(lx, y, lz, palette.filler);
          }

          // --- step 4: snow cap on genuinely cold, high ground --------------
          if (!submerged && surfaceY > 50 && biome.temperature === 'cold' && isNaturalGround(chunk.getBlock(lx, surfaceY, lz))) {
            chunk.setBlock(lx, surfaceY, lz, BLOCK.SNOW);
          }
        }

        // --- step 5: sea-level fill, only into air --------------------------
        // Bounded by the *actual* surface, and it refuses to overwrite
        // anything solid, so it can no longer bury terrain in water.
        if (waterFill && surfaceY < seaLevel) {
          for (let y = surfaceY + 1; y <= seaLevel; y++) {
            if (chunk.getBlock(lx, y, lz) !== BLOCK.AIR) continue;
            chunk.setBlock(lx, y, lz, BLOCK.WATER);
          }
        }

        // --- step 6: underwater flora (coral, kelp) ------------------------
        // Coral reefs and warm oceans get coral growths on the floor; cold and
        // lukewarm oceans get tall kelp. Deterministic, seeded per column.
        const underwater = surfaceY < seaLevel;
        if (underwater && surfaceY > 2) {
          const biomeId = paint ? this.getBiomeAt(wx, wz).id : 'ocean';
          const r = this.noise.hash(wx, 4, wz);
          const isCoral = biomeId === 'coral_reef' || biomeId === 'coral_coast'
            || biomeId === 'coral_reef_biome' || biomeId === 'warm_ocean'
            || biomeId === 'ocean_world_biome';
          const isKelp = biomeId === 'kelp_forest' || biomeId === 'cold_ocean'
            || biomeId === 'lukewarm_ocean';
          if (isCoral && r > 0.78) {
            // A small coral clump growing up from the floor.
            const clumpH = 1 + Math.floor(this.noise.hash(wx, 5, wz) * 2);
            for (let dy = 1; dy <= clumpH; dy++) {
              const yy = surfaceY + dy;
              if (yy >= seaLevel) break;
              if (chunk.getBlock(lx, yy, lz) !== BLOCK.WATER) break;
              chunk.setBlock(lx, yy, lz, BLOCK.CORAL);
            }
          } else if (isKelp && r > 0.84) {
            const kelpH = 3 + Math.floor(this.noise.hash(wx, 6, wz) * 4);
            for (let dy = 1; dy <= kelpH; dy++) {
              const yy = surfaceY + dy;
              if (yy >= seaLevel) break;
              if (chunk.getBlock(lx, yy, lz) !== BLOCK.WATER) break;
              chunk.setBlock(lx, yy, lz, BLOCK.KELP);
            }
          }
        }
      }
    }
  }

  /**
   * The canonical "highest solid block open to the sky" query for a column
   * that has already been generated into `chunk`.
   *
   * Returns -1 when the column contains no solid ground at all.
   *
   * Leaves and plants are transparent to this sweep: a tree standing on the
   * ground must not stop the search, otherwise the surface pass would paint
   * grass onto a canopy. Water is transparent too, so a lake bed is still
   * recognised as the surface.
   */
  private findSkyExposedSurface(chunk: Chunk, lx: number, lz: number): number {
    const from = Math.min(CHUNK_HEIGHT - 1, chunk.getHighestOccupiedY());
    for (let y = from; y >= 0; y--) {
      const b = chunk.getBlock(lx, y, lz);
      if (b === BLOCK.AIR) continue;
      if (isSkyTransparent(b)) continue;
      return y;
    }
    return -1;
  }

  /**
   * Look up the biome for a column.
   *
   * ## Fixing the "everything is cramped" problem
   *
   * The old version sampled temperature and moisture at a single fixed
   * frequency (0.0014 / 0.0019) and mapped the pair straight onto a biome. All
   * biomes therefore came out the same middling size, with rare and common
   * ones jammed together at identical scale: measured along a 4 km transect,
   * the median biome was only **96 blocks** across. Walking for ten seconds
   * took you through three biomes.
   *
   * Selection is now two-stage:
   *
   *   1. **Region size** — a very low frequency field picks a size class for
   *      this part of the world (`rare` … `huge`). This is what spaces biomes
   *      out into distinct territories.
   *   2. **Climate** — temperature and moisture are then sampled at a
   *      frequency *scaled by that class*, so a `huge` region varies slowly
   *      and produces one enormous biome, while a `rare` region varies quickly
   *      and produces a small pocket.
   *
   * Elevation still overrides everything (oceans, beaches, peaks), because
   * those must follow the terrain rather than the climate map.
   */
  getBiomeAt(worldX: number, worldZ: number): BiomeDefinition {
    // PERF: this is several fbm2D evaluations plus a Voronoi search, and it is
    // asked for once per column by the surface pass and again by the
    // vegetation pass — and by the engine every time the player moves. The
    // result only depends on the integer column, so it is memoised.
    const x = Math.floor(worldX);
    const z = Math.floor(worldZ);
    // Large-biome worlds stretch the *biome map* by sampling it in a scaled
    // coordinate space. Using the scaled coordinates as the cache key makes the
    // widening real instead of redoing the same lookup four times per block.
    const biomeScale = Math.max(0.1, this.config.biomeScale || 1);
    const sampleX = Math.floor(x / biomeScale);
    const sampleZ = Math.floor(z / biomeScale);
    const key = columnKey(sampleX, sampleZ);
    const cached = this.biomeCache.get(key);
    if (cached !== undefined) return cached;

    const biome = this.computeBiomeAt(sampleX, sampleZ);

    if (this.biomeCache.size >= HEIGHT_CACHE_LIMIT) {
      let toDrop = Math.floor(HEIGHT_CACHE_LIMIT / 4);
      for (const k of this.biomeCache.keys()) {
        this.biomeCache.delete(k);
        if (--toDrop <= 0) break;
      }
    }
    this.biomeCache.set(key, biome);
    return biome;
  }

  /** The real biome computation. See `getBiomeAt` for the memoised entry. */
  private computeBiomeAt(worldX: number, worldZ: number): BiomeDefinition {
    // Single-biome worlds bypass the whole climate/elevation classifier.
    // This world type existed in the UI but was never wired into generation,
    // so selecting it still produced an ordinary mixed-biome world.
    if (this.config.forcedBiome) {
      return getBiome(this.config.forcedBiome);
    }

    // Biome decisions use a **smoothed** elevation, not the exact per-block
    // height. Raw height wobbles by several blocks between adjacent columns,
    // so testing it against a fixed threshold (`> 48` for alpine) made the
    // biome flip back and forth along every slope, shredding the map into
    // one-block slivers — a measured 10th-percentile run length of 16 blocks.
    // Averaging over a wide stencil gives boundaries that follow the shape of
    // the landscape instead of its noise.
    const elevation = this.smoothedHeight(worldX, worldZ);

    // --- elevation-driven biomes come first --------------------------------
    if (elevation < this.config.seaLevel - 4) return getBiome('ocean_world_biome');
    if (elevation < this.config.seaLevel) return getBiome('beach');

    // --- stage 1: how large should biomes be around here? ------------------
    const sizeClass = this.regionSizeClassAt(worldX, worldZ);
    // Larger class => lower frequency => bigger biome.
    const frequency = BASE_BIOME_FREQUENCY / BIOME_SIZE_SCALE[sizeClass];

    // --- stage 2: climate at that scale ------------------------------------
    const temp = this.biomeNoise.fbm2D(worldX * frequency, worldZ * frequency, 4, 2.0, 0.5, 101);
    const moist = this.biomeNoise.fbm2D(
      worldX * frequency * 1.35 + 9,
      worldZ * frequency * 1.35 - 11,
      4, 2.0, 0.5, 102
    );
    // Spread the climate fields before classifying them.
    //
    // fbm is a sum of independent octaves, so by the central limit theorem its
    // output is bell-shaped around 0.5, not uniform. Measured over an 8km
    // square, temperature spanned only 0.29-0.72 between the 5th and 95th
    // percentiles — yet the thresholds below were written as though the range
    // were a flat 0-1. The tails were therefore almost never reached: the
    // world came out 46% plains and 24% alpine, with forest at 0.3%, desert at
    // 0.0%, and no rainforest to speak of. `spreadClimate` remaps the bell
    // onto an approximately uniform 0-1 so every band is actually reachable.
    const tempSpread = spreadClimate(temp);
    const moistSpread = spreadClimate(moist);
    const tempTag: 'cold' | 'temperate' | 'warm' | 'hot' = tempSpread < 0.30 ? 'cold' : tempSpread < 0.55 ? 'temperate' : tempSpread < 0.78 ? 'warm' : 'hot';
    const moistTag: 'arid' | 'normal' | 'humid' | 'wet' | 'snow' = moistSpread < 0.30 ? 'arid' : moistSpread < 0.55 ? 'normal' : moistSpread < 0.78 ? 'humid' : 'wet';

    // Alpine gates are expressed RELATIVE TO SEA LEVEL, not as absolute Y.
    //
    // These used to be the literals `> 56` and `> 48`. With the continent
    // field fixed the median world height is far above 48, and a measured
    // 88% of all columns cleared the alpine gate while 59% cleared the ice
    // one — the entire map resolved to ice_spikes and alpine_biome. Anchoring
    // to sea level keeps the thresholds meaningful whatever the height range
    // a given config produces.
    const aboveSea = elevation - this.config.seaLevel;
    if (aboveSea > ICE_CAP_ELEVATION && tempTag === 'cold') return getBiome('ice_spikes');
    if (aboveSea > ALPINE_ELEVATION && (tempTag === 'cold' || tempTag === 'temperate')) return getBiome('alpine_biome');

    // Rare regions get to host the special biomes; ordinary regions stick to
    // the staples, which is what keeps the world coherent rather than a
    // patchwork of novelties.
    if (sizeClass === 'rare') {
      const pick = this.biomeNoise.fbm2D(worldX * frequency * 2.1 + 71, worldZ * frequency * 2.1 - 53, 2, 2.0, 0.5, 103);
      if (tempTag === 'hot' && moistTag === 'arid') return getBiome('oasis');
      if (tempTag === 'cold') return getBiome(pick > 0.5 ? 'ice_spikes' : 'frozen_jungle');
      if (moistTag === 'wet') return getBiome(pick > 0.5 ? 'mushroom_biome' : 'mystic_woods');
      return getBiome(pick > 0.5 ? 'cherry_grove' : 'flower_forest');
    }

    if (moistTag === 'arid' && tempTag === 'hot') return getBiome('desert');
    if (moistTag === 'arid' && tempTag === 'warm') return getBiome('savanna');
    if (moistTag === 'wet' && (tempTag === 'warm' || tempTag === 'hot')) return getBiome('rainforest');
    if (moistTag === 'wet' && tempTag === 'temperate') return getBiome('forest');
    if (moistTag === 'wet' && tempTag === 'cold') return getBiome('snowy_taiga');
    if (tempTag === 'cold') return getBiome('snowy_plains');
    if (tempTag === 'temperate' && moistTag === 'normal') return getBiome('meadow');
    return getBiome('plain');
  }

  /**
   * Terrain height averaged over a wide stencil, for biome decisions only.
   *
   * Cached like `getTerrainHeight` because it is consulted for every column
   * during the surface, vegetation and structure passes.
   */
  private smoothedHeight(worldX: number, worldZ: number): number {
    // Evaluate the wide stencil on a coarse lattice, then BILINEARLY
    // INTERPOLATE between lattice points.
    //
    // ## Why the interpolation matters
    //
    // The previous version rounded the sample point to the nearest 16-block
    // lattice node and returned that node's value directly, making the
    // elevation a piecewise-constant step function. Because biome selection
    // compares this value against fixed thresholds, every biome boundary
    // snapped to the 16-block grid — the same 16 blocks as a chunk. Measured
    // on the shipped generator, 100% of biome transitions along a 800-block
    // transect landed on a single offset within the chunk grid.
    //
    // A biome change means a different surface material and different
    // vegetation, so those grid-aligned boundaries drew perfectly straight
    // lines across the terrain at chunk borders, which reads as a hard seam.
    //
    // Interpolating restores a continuous field: still ~4 stencil evaluations
    // per chunk (the lattice nodes are shared and cached), but the value now
    // varies smoothly between them, so boundaries follow the landscape.
    const step = SMOOTH_HEIGHT_STEP;
    const gx = Math.floor(worldX / step);
    const gz = Math.floor(worldZ / step);
    const fx = worldX / step - gx;
    const fz = worldZ / step - gz;

    const h00 = this.smoothedHeightAtNode(gx, gz);
    const h10 = this.smoothedHeightAtNode(gx + 1, gz);
    const h01 = this.smoothedHeightAtNode(gx, gz + 1);
    const h11 = this.smoothedHeightAtNode(gx + 1, gz + 1);

    // Smoothstep the weights so the field is C1 across lattice nodes; with raw
    // linear weights the slope jumps at every node and the thresholds can
    // still pick up a faint grid.
    const u = fx * fx * (3 - 2 * fx);
    const v = fz * fz * (3 - 2 * fz);
    const a = h00 + (h10 - h00) * u;
    const b = h01 + (h11 - h01) * u;
    return a + (b - a) * v;
  }

  /** The 9-tap elevation stencil evaluated at one coarse lattice node. */
  private smoothedHeightAtNode(nodeX: number, nodeZ: number): number {
    const x = nodeX * SMOOTH_HEIGHT_STEP;
    const z = nodeZ * SMOOTH_HEIGHT_STEP;
    const key = columnKey(x, z);
    const cached = this.smoothHeightCache.get(key);
    if (cached !== undefined) return cached;

    // 9-tap stencil at two radii. A single ±24 cross still let ridge lines
    // flicker across the alpine/ice thresholds, producing one-block biome
    // slivers along every slope. Sampling further out and in both axes gives
    // boundaries that follow the landform rather than its noise.
    const R1 = 28;
    const R2 = 56;
    const value = (
      this.getTerrainHeight(x, z) * 2
      + this.getTerrainHeight(x + R1, z)
      + this.getTerrainHeight(x - R1, z)
      + this.getTerrainHeight(x, z + R1)
      + this.getTerrainHeight(x, z - R1)
      + this.getTerrainHeight(x + R2, z)
      + this.getTerrainHeight(x - R2, z)
      + this.getTerrainHeight(x, z + R2)
      + this.getTerrainHeight(x, z - R2)
    ) / 10;

    this.rememberHeight(this.smoothHeightCache, key, value);
    return value;
  }

  /**
   * Pick the biome size class for this part of the world.
   *
   * Uses a hashed cell grid rather than a noise threshold so the weights in
   * `BIOME_SIZE_WEIGHT` are honoured exactly on every seed — the same reason
   * cavern systems are placed on a grid. Neighbouring cells are blended by
   * distance so class boundaries do not produce visible straight seams.
   */
  private regionSizeClassAt(worldX: number, worldZ: number): BiomeSizeClass {
    const cellX = Math.floor(worldX / BIOME_REGION_CELL);
    const cellZ = Math.floor(worldZ / BIOME_REGION_CELL);

    let bestClass: BiomeSizeClass = 'medium';
    let bestScore = -Infinity;

    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const cx = cellX + dx;
        const cz = cellZ + dz;
        // Jittered site for this cell, so regions are irregular polygons.
        const siteX = (cx + this.biomeNoise.hash(cx, cz, 0, 501)) * BIOME_REGION_CELL;
        const siteZ = (cz + this.biomeNoise.hash(cx, cz, 1, 502)) * BIOME_REGION_CELL;
        const distance = Math.hypot(worldX - siteX, worldZ - siteZ);
        // Nearest site wins — a Voronoi partition of the world.
        const score = -distance;
        if (score > bestScore) {
          bestScore = score;
          bestClass = pickSizeClass(this.biomeNoise.hash(cx, cz, 2, 503));
        }
      }
    }

    return bestClass;
  }

  /* ============= VEGETATION ============= */

  /**
   * Draw only the part of neighbouring tree canopies owned by this chunk.
   * Anchor choice, height and surface estimate are world-coordinate functions,
   * so this pass produces the same border voxels with or without a spill queue.
   */
  private applyBorderVegetation(chunk: Chunk): void {
    const margin = 2;
    const minX = chunk.x * CHUNK_SIZE;
    const minZ = chunk.z * CHUNK_SIZE;
    const maxX = minX + CHUNK_SIZE - 1;
    const maxZ = minZ + CHUNK_SIZE - 1;

    const placeBorderAnchors = (
      spacing: number,
      salt: string,
      allowedBiomes: ReadonlySet<string>,
      heightAt: (wx: number, wz: number) => number
    ): void => {
      const firstCellX = Math.floor((minX - margin) / spacing);
      const lastCellX = Math.floor((maxX + margin) / spacing);
      const firstCellZ = Math.floor((minZ - margin) / spacing);
      const lastCellZ = Math.floor((maxZ + margin) / spacing);
      const saltX = salt.charCodeAt(0) * 31 + 17;
      const saltZ = salt.charCodeAt(1) * 31 + 19;

      for (let cellX = firstCellX; cellX <= lastCellX; cellX += 1) {
        for (let cellZ = firstCellZ; cellZ <= lastCellZ; cellZ += 1) {
          const wx = cellX * spacing + Math.floor(
            this.noise.hash(cellX, cellZ, 0, saltX) * spacing
          );
          const wz = cellZ * spacing + Math.floor(
            this.noise.hash(cellX, cellZ, 1, saltZ) * spacing
          );
          if (wx >= minX && wx <= maxX && wz >= minZ && wz <= maxZ) continue;
          if (wx + margin < minX || wx - margin > maxX
            || wz + margin < minZ || wz - margin > maxZ) continue;
          if (Math.hypot(wx, wz) < SPAWN_PROTECTED_RADIUS) continue;
          if (!allowedBiomes.has(this.getBiomeAt(wx, wz).id)) continue;

          const height = heightAt(wx, wz);
          const surface = this.getTerrainHeight(wx, wz);
          for (let dy = 0; dy <= 2; dy += 1) {
            const radius = dy === 2 ? 1 : 2;
            for (let dx = -radius; dx <= radius; dx += 1) {
              for (let dz = -radius; dz <= radius; dz += 1) {
                if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
                const lx = wx + dx - minX;
                const lz = wz + dz - minZ;
                if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;
                const y = surface + height - 1 + dy;
                if (y < 0 || y >= CHUNK_HEIGHT) continue;
                if (chunk.getBlock(lx, y, lz) === BLOCK.AIR) {
                  chunk.setBlock(lx, y, lz, BLOCK.LEAVES);
                }
              }
            }
          }
        }
      }
    };

    placeBorderAnchors(
      4,
      'tree',
      DENSE_TREE_BIOMES,
      (wx, wz) => 4 + Math.floor(this.noise.hash(wx, wz, 0, 121) * 3)
    );
    placeBorderAnchors(14, 'plains-tree', SPARSE_TREE_BIOMES, () => 3);
  }

  /** Place decoration on the actual post-carve voxel surface. */
  private applyVegetation(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      if (Math.hypot(wx, wz) < SPAWN_PROTECTED_RADIUS) return;
      const biome = this.getBiomeAt(wx, wz);
      // Query the real, post-carve ground — not the analytic heightmap.
      const surface = this.findSkyExposedSurface(chunk, lx, lz);
      if (surface < 0) return;
      const top = chunk.getBlock(lx, surface, lz);
      if (top === BLOCK.WATER || top === BLOCK.AIR) return;
      // Only plant on ground that can actually support a plant.
      if (!isNaturalGround(top)) return;
      // Refuse to plant where the space above is already occupied.
      if (chunk.getBlock(lx, surface + 1, lz) !== BLOCK.AIR) return;
      // Tree placement on a Poisson-disc grid.
      // Forests should feel like forests: a tree roughly every 4 blocks reads
      // as dense woodland once canopies overlap, while open biomes keep the
      // occasional lone tree.
      if (DENSE_TREE_BIOMES.has(biome.id)) {
        if (this.featureAnchor(wx, wz, 4, 'tree')) this.placeTree(chunk, wx, surface, wz, 4 + Math.floor(this.noise.hash(wx, wz, 0, 121) * 3));
      }
      if (SPARSE_TREE_BIOMES.has(biome.id)) {
        if (this.featureAnchor(wx, wz, 14, 'plains-tree')) this.placeTree(chunk, wx, surface, wz, 3);
      }
      if (biome.id === 'desert' && this.featureAnchor(wx, wz, 12, 'cactus')) this.placeCactus(chunk, wx, surface, wz);
      if (biome.id === 'bamboo_jungle' && this.featureAnchor(wx, wz, 5, 'bamboo')) this.placeBamboo(chunk, wx, surface, wz);
      if (biome.id === 'rainforest' && this.featureAnchor(wx, wz, 8, 'vine')) this.placeVine(chunk, wx, surface, wz);
      if (biome.id === 'swamp' && this.featureAnchor(wx, wz, 6, 'lily')) this.placeLilyPad(chunk, wx, surface, wz);
      if (biome.id === 'mushroom_island' && this.featureAnchor(wx, wz, 5, 'mushroom')) this.placeGiantMushroom(chunk, wx, surface, wz);
      if ((biome.id === 'forest' || biome.id === 'meadow' || biome.id === 'cherry_biome') && this.featureAnchor(wx, wz, 7, 'flower')) this.placeFlower(chunk, wx, surface, wz);
    });
  }

  private featureAnchor(wx: number, wz: number, spacing: number, salt: string): boolean {
    const cx = Math.floor(wx / spacing), cz = Math.floor(wz / spacing);
    const startX = cx * spacing, startZ = cz * spacing;
    const ox = Math.floor(this.noise.hash(cx, cz, 0, salt.charCodeAt(0) * 31 + 17) * spacing);
    const oz = Math.floor(this.noise.hash(cx, cz, 1, salt.charCodeAt(1) * 31 + 19) * spacing);
    return wx === startX + ox && wz === startZ + oz;
  }

  private placeTree(chunk: Chunk, wx: number, wy: number, wz: number, height: number): void {
    for (let y = wy + 1; y <= wy + height; y++) this.setBlockIfInChunk(chunk, wx, y, wz, BLOCK.LOG);
    for (let dy = 0; dy <= 2; dy++) {
      const radius = dy === 2 ? 1 : 2;
      for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
        this.setBlockIfInChunk(chunk, wx + dx, wy + height - 1 + dy, wz + dz, BLOCK.LEAVES);
      }
    }
  }

  private placeCactus(chunk: Chunk, wx: number, wy: number, wz: number): void {
    const h = 2 + Math.floor(this.noise.hash(wx, wz, 0, 131) * 2);
    for (let y = wy + 1; y <= wy + h; y++) this.setBlockIfInChunk(chunk, wx, y, wz, 98);
  }

  private placeBamboo(chunk: Chunk, wx: number, wy: number, wz: number): void {
    const h = 4 + Math.floor(this.noise.hash(wx, wz, 0, 132) * 5);
    for (let y = wy + 1; y <= wy + h; y++) this.setBlockIfInChunk(chunk, wx, y, wz, 103);
  }

  private placeVine(chunk: Chunk, wx: number, wy: number, wz: number): void {
    const h = 2 + Math.floor(this.noise.hash(wx, wz, 0, 133) * 3);
    for (let y = wy + 1; y <= wy + h; y++) this.setBlockIfInChunk(chunk, wx, y, wz, 107);
  }

  private placeLilyPad(chunk: Chunk, wx: number, wy: number, wz: number): void {
    this.setBlockIfInChunk(chunk, wx, wy + 1, wz, 109);
  }

  private placeGiantMushroom(chunk: Chunk, wx: number, wy: number, wz: number): void {
    const h = 4 + Math.floor(this.noise.hash(wx, wz, 0, 134) * 3);
    for (let y = wy + 1; y <= wy + h; y++) this.setBlockIfInChunk(chunk, wx, y, wz, 97);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > 3) continue;
      this.setBlockIfInChunk(chunk, wx + dx, wy + h + 1, wz + dz, 97);
    }
  }

  private placeFlower(chunk: Chunk, wx: number, wy: number, wz: number): void {
    const r = this.noise.hash(wx, wz, 0, 135);
    this.setBlockIfInChunk(chunk, wx, wy + 1, wz, r < 0.33 ? 93 : r < 0.66 ? 94 : 95);
  }

  /* ============= STRUCTURES ============= */

  /**
   * Scatter small structures.
   *
   * ## Spacing
   *
   * These were placed on 26-42 block grids, which put a 5-block black obsidian
   * monolith roughly every 29 blocks in every direction — measured at one per
   * 862 columns. That is the reported "there's these little things on the
   * ground… everywhere I go", and it is what stopped the landscape reading as
   * natural terrain.
   *
   * A landmark has to be rare to feel like a landmark, so the surface features
   * are now hundreds of blocks apart. The purely underground ones (geodes,
   * fossils) can stay denser because you only meet them while mining.
   */
  private applyStructures(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      if (Math.hypot(wx, wz) < SPAWN_PROTECTED_RADIUS) return;

      // --- surface landmarks: rare, deliberately findable ------------------
      // Surface structures sit on the REAL ground, found by sweeping the
      // voxels. Using the analytic heightmap here left monoliths and ruins
      // hovering over any column a cave or ravine had lowered.
      const needsSurface =
        this.featureAnchor(wx, wz, 420, 'monolith')
        || this.featureAnchor(wx, wz, 340, 'ruin-fragment')
        || this.featureAnchor(wx, wz, 96, 'geode')
        || this.featureAnchor(wx, wz, 120, 'fossil')
        || this.featureAnchor(wx, wz, 700, 'village')
        || this.featureAnchor(wx, wz, 5200, 'city');
      if (!needsSurface && !(this.config.volcanoes && this.featureAnchor(wx, wz, 900, 'volcano'))) return;

      const surface = this.findSkyExposedSurface(chunk, lx, lz);
      if (surface < 0) return;

      if (this.featureAnchor(wx, wz, 420, 'monolith')) {
        // Do not stand a monolith in a lake or on a plant.
        if (isNaturalGround(chunk.getBlock(lx, surface, lz))) {
          this.placeMonolith(chunk, wx, surface, wz);
        }
      }
      if (this.featureAnchor(wx, wz, 340, 'ruin-fragment')) {
        if (isNaturalGround(chunk.getBlock(lx, surface, lz))) {
          this.placeRuinFragment(chunk, wx, surface, wz);
        }
      }
      if (this.featureAnchor(wx, wz, 700, 'village')) {
        if (isNaturalGround(chunk.getBlock(lx, surface, lz))) {
          this.placeVillage(chunk, wx, surface, wz);
        }
      }
      if (this.featureAnchor(wx, wz, 5200, 'city')) {
        // Cities are rare and land on flat, grassy ground — never in lakes.
        if (isNaturalGround(chunk.getBlock(lx, surface, lz)) && chunk.getBlock(lx, surface, lz) === BLOCK.GRASS) {
          this.placeCity(chunk, wx, surface, wz);
        }
      }

      // --- buried features: only ever seen underground ---------------------
      // These are placed relative to the surface but always well below it,
      // so they are unaffected by surface dressing.
      if (this.featureAnchor(wx, wz, 96, 'geode')) {
        this.placeGeode(chunk, wx, surface, wz);
      }
      if (this.featureAnchor(wx, wz, 120, 'fossil')) {
        this.placeFossil(chunk, wx, surface, wz);
      }

      if (this.config.volcanoes && this.featureAnchor(wx, wz, 900, 'volcano')) {
        this.placeVolcano(chunk, wx, wz);
      }
    });
  }

  /**
   * Mineshafts in caves — regular Minecraft-style abandoned shafts (with a
   * rarer "Black Mineshaft" deep variant) carved into the rock across every
   * dimension. Uses the shared MineshaftStructures builder so the Overworld
   * and the per-dimension terrains all produce the same style of shaft.
   */
  private applyMineshafts(chunk: Chunk): void {
    const shaft = mineshaftAnchorAt(chunk.x * CHUNK_SIZE, chunk.z * CHUNK_SIZE);
    if (!shaft) return;
    placeMineshaft(chunk, shaft);
  }

  private placeMonolith(chunk: Chunk, wx: number, wy: number, wz: number): void {
    for (let y = wy + 1; y <= wy + 5; y++) this.setBlockIfInChunk(chunk, wx, y, wz, BLOCK.OBSIDIAN);
  }

  private placeGeode(chunk: Chunk, wx: number, surface: number, wz: number): void {
    const y0 = this.config.bedrockThickness + 6;
    const y = y0 + Math.floor(this.noise.hash(wx, wz, 0, 141) * (surface - y0 - 6));
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
      const d = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      if (d > 4) continue;
      this.setBlockIfInChunk(chunk, wx + dx, y + dy, wz + dz, d === 4 ? BLOCK.OBSIDIAN : 84 /* amethyst */);
    }
  }

  private placeFossil(chunk: Chunk, wx: number, surface: number, wz: number): void {
    const y = surface - 3 - Math.floor(this.noise.hash(wx, wz, 0, 142) * 4);
    for (let i = -2; i <= 2; i++) this.setBlockIfInChunk(chunk, wx + i, y, wz, 35 /* stone bricks */);
  }

  private placeRuinFragment(chunk: Chunk, wx: number, surface: number, wz: number): void {
    for (let dx = -2; dx <= 2; dx++) {
      this.setBlockIfInChunk(chunk, wx + dx, surface + 1, wz, BLOCK.MOSSY_BRICKS);
      this.setBlockIfInChunk(chunk, wx + dx, surface + 2, wz, Math.abs(dx) === 2 ? BLOCK.MOSSY_BRICKS : BLOCK.AIR);
    }
  }

  /**
   * A block-built village house: stone-brick walls, a plank roof, a wooden door,
   * and a window. Every block is a real voxel, so it meshes with the terrain and
   * can be broken/built on like anything else.
   */
  private placeVillageHouse(chunk: Chunk, wx: number, surface: number, wz: number, facing: 'x' | 'z'): void {
    const size = 4; // 4x4 footprint, 3 tall
    const wall = BLOCK.STONE_BRICKS;
    const roof = BLOCK.PLANKS;
    const door = BLOCK.WOOD_DOOR;
    for (let dx = 0; dx <= size; dx++) {
      for (let dz = 0; dz <= size; dz++) {
        const onEdge = dx === 0 || dx === size || dz === 0 || dz === size;
        const top = 3;
        for (let y = 1; y <= top; y++) {
          const absX = wx + dx;
          const absZ = wz + dz;
          if (!onEdge && y < top) continue; // hollow interior
          const isRoof = y === top;
          this.setBlockIfInChunk(chunk, absX, surface + y, absZ, isRoof ? roof : wall);
        }
        // Door on the front edge.
        const frontDoor = (facing === 'z' && dx === Math.floor(size / 2) && dz === 0)
          || (facing === 'x' && dz === Math.floor(size / 2) && dx === 0);
        if (frontDoor) {
          this.setBlockIfInChunk(chunk, wx + dx, surface + 1, wz + dz, door);
          this.setBlockIfInChunk(chunk, wx + dx, surface + 2, wz + dz, BLOCK.AIR);
        }
      }
    }
    // Interior furniture (Part 4): a chair, a table and a fancy lamp so the
    // house feels lived-in instead of a hollow box.
    const cx = wx + Math.floor(size / 2);
    const cz = wz + Math.floor(size / 2);
    this.setBlockIfInChunk(chunk, cx, surface + 1, cz, 323);       // chair
    this.setBlockIfInChunk(chunk, cx + 1, surface + 1, cz, 324);   // table
    this.setBlockIfInChunk(chunk, cx, surface + 2, cz + 1, 329);   // lamp
  }

  /** A small block-built village: a central path and a few houses. */
  private placeVillage(chunk: Chunk, wx: number, surface: number, wz: number): void {
    // Path of gravel through the village.
    for (let p = -6; p <= 6; p++) {
      this.setBlockIfInChunk(chunk, wx + p, surface + 1, wz, BLOCK.GRAVEL);
    }
    // Houses either side, in a small cluster.
    const houses: Array<[number, number, 'x' | 'z']> = [
      [-4, 4, 'x'], [3, 4, 'x'], [-5, -4, 'x'], [4, -4, 'x'],
    ];
    for (const [hx, hz, facing] of houses) {
      this.placeVillageHouse(chunk, wx + hx, surface, wz + hz, facing);
    }
    // A well at the centre.
    for (let dy = 1; dy <= 2; dy++) this.setBlockIfInChunk(chunk, wx, surface + dy, wz, BLOCK.COBBLESTONE);
    this.setBlockIfInChunk(chunk, wx, surface + 3, wz, BLOCK.WATER);
  }

  /**
   * A single city building: a taller block-built tower with concrete/stone
   * walls, glass windows, a flat roof and a glowing roof beacon. Real voxels,
   * so it meshes and can be edited like anything else.
   */
  private placeCityBuilding(chunk: Chunk, wx: number, surface: number, wz: number, w: number, d: number, h: number): void {
    const wall = BLOCK.STONE_BRICKS;
    for (let dx = 0; dx < w; dx++) {
      for (let dz = 0; dz < d; dz++) {
        const onEdge = dx === 0 || dx === w - 1 || dz === 0 || dz === d - 1;
        for (let y = 1; y <= h; y++) {
          if (!onEdge && y < h) continue; // hollow
          const isRoof = y === h;
          const isWindow = onEdge && y % 3 === 0 && y < h;
          const block = isRoof ? BLOCK.STONE_BRICKS : isWindow ? 64 /* Glass */ : wall;
          this.setBlockIfInChunk(chunk, wx + dx, surface + y, wz + dz, block);
        }
      }
    }
    // A roof beacon lamp on top.
    this.setBlockIfInChunk(chunk, wx + Math.floor(w / 2), surface + h + 1, wz + Math.floor(d / 2), BLOCK.GLOWSTONE);
  }

  /**
   * A rare, large block-built city: a grid of suburban streets lined with
   * houses and a handful of taller city towers. Cities only spawn on flat,
   * grassy land far from spawn, so they read as special finds rather than
   * spawning all over the place.
   */
  private placeCity(chunk: Chunk, wx: number, surface: number, wz: number): void {
    const ext = 14;
    // Streets of gravel through the city grid.
    for (let x = -ext; x <= ext; x++) {
      for (let y = 0; y < ext * 2; y++) {
        // Two cross streets meeting in the middle.
        this.setBlockIfInChunk(chunk, wx + x, surface + 1, wz - ext + y, y % 7 === 0 ? BLOCK.GRAVEL : BLOCK.GRAVEL);
        if (x % 7 === 0) this.setBlockIfInChunk(chunk, wx - ext + y, surface + 1, wz + x, BLOCK.GRAVEL);
      }
    }
    // Suburban houses in the blocks between the streets (rare, quiet).
    const houseOffsets: Array<[number, number]> = [];
    for (let i = 0; i < 14; i++) {
      houseOffsets.push([-ext + 2 + (i % 6) * 4, -ext + 2 + Math.floor(i / 6) * 4]);
    }
    for (const [hx, hz] of houseOffsets) {
      if (Math.hypot(hx, hz) > ext) continue;
      this.placeVillageHouse(chunk, wx + hx, surface, wz + hz, hx < 0 ? 'x' : 'z');
    }
    // A few taller towers around the centre.
    const towers: Array<[number, number, number, number, number]> = [
      [-6, -6, 5, 5, 7], [6, -6, 5, 5, 8], [-6, 6, 6, 5, 6], [6, 6, 5, 6, 9], [0, 0, 7, 7, 10],
    ];
    for (const [tx, tz, tw, td, th] of towers) {
      this.placeCityBuilding(chunk, wx + tx, surface, wz + tz, tw, td, th);
    }
    // A central square with a fountain.
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      this.setBlockIfInChunk(chunk, wx + dx, surface + 1, wz + dz, BLOCK.STONE_BRICKS);
    }
    this.setBlockIfInChunk(chunk, wx, surface + 2, wz, BLOCK.WATER);
    this.setBlockIfInChunk(chunk, wx, surface + 1, wz, BLOCK.WATER);

    // A small movie theatre with a TV screen (Part 4) on one side.
    this.placeMovieTheatre(chunk, wx + 9, surface, wz - 2);

    // A rail line running through the city with a powered rail every 4th block.
    for (let r = -8; r <= 8; r++) {
      this.setBlockIfInChunk(chunk, wx + r, surface + 1, wz + 6, r % 4 === 0 ? 331 : 330);
    }
    // A minecart parked on the rail.
    this.setBlockIfInChunk(chunk, wx - 4, surface + 1, wz + 6, 332);
  }

  /** A mini cinema: a raised stage with a big TV screen and sofa seats. */
  private placeMovieTheatre(chunk: Chunk, wx: number, surface: number, wz: number): void {
    // Stage platform.
    for (let dx = 0; dx < 6; dx++) for (let dz = 0; dz < 4; dz++) {
      this.setBlockIfInChunk(chunk, wx + dx, surface + 1, wz + dz, BLOCK.STONE_BRICKS);
    }
    // The TV screen on the back wall (id 326).
    for (let dz = 0; dz < 3; dz++) this.setBlockIfInChunk(chunk, wx + 2, surface + 3, wz + dz, 326);
    // Sofas (id 325) facing the screen.
    for (let dz = 0; dz < 3; dz++) {
      this.setBlockIfInChunk(chunk, wx - 2, surface + 1, wz + dz, 325);
      this.setBlockIfInChunk(chunk, wx - 3, surface + 1, wz + dz, 325);
    }
    // A couple of coloured lamps for ambience.
    this.setBlockIfInChunk(chunk, wx + 6, surface + 2, wz, 316);
    this.setBlockIfInChunk(chunk, wx + 6, surface + 2, wz + 3, 317);
  }

  private placeVolcano(chunk: Chunk, wx: number, wz: number): void {
    // A small cone of basalt rising high above the surface.
    for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > 8) continue;
      const height = Math.round(18 - d * 1.6);
      const baseY = this.getTerrainHeight(wx + dx, wz + dz);
      for (let y = baseY; y < baseY + height; y++) {
        if (y >= CHUNK_HEIGHT) break;
        const isInside = d < height * 0.18;
        this.setBlockIfInChunk(chunk, wx + dx, y, wz + dz, isInside && y > baseY + height * 0.5 ? BLOCK.MAGMA : BLOCK.BASALT);
      }
    }
  }

  /* ============= BEDROCK ============= */

  private applyBedrockFoundation(chunk: Chunk): void {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let y = 0; y < this.config.bedrockThickness; y++) {
        chunk.setBlock(lx, y, lz, BEDROCK_MIX[Math.min(BEDROCK_MIX.length - 1, y)]);
      }
    }
  }

  /* ============= SUB-BEDROCK STACK ============= */

  /**
   * Replace the region below the surface with stacked world layers.
   *
   * Bedrock stops being a floor and becomes a ceiling: break through and you
   * drop into The Underdark, then the Crystal Vault, then the Ashen Deep, and
   * finally the Molten Core. Each layer has its own obsidian floor, so you
   * descend one deliberate hole at a time rather than falling to the bottom.
   */
  private applySubBedrockPass(chunk: Chunk): void {
    if (this.subBedrock.length === 0) return;
    const top = this.subBedrock[0].ceilingY;

    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      // Never carve the protected spawn column out from under the player.
      if (Math.hypot(wx, wz) < SPAWN_PROTECTED_RADIUS) return;
      for (let y = 1; y <= top; y++) {
        const block = subBedrockBlockAt(this.exoticNoise, this.subBedrock, wx, y, wz);
        if (block !== null) chunk.setBlock(lx, y, lz, block);
      }
    });
  }

  /* ============= CAVE WORLD ============= */

  /**
   * Cave World: seal the sky with a stone shell so the entire world is
   * interior. The cave passes have already hollowed the underground, so this
   * only needs to fill the space above the surface and cap it.
   */
  private applyCaveWorldPass(chunk: Chunk): void {
    if (!this.config.caveWorld) return;
    const ceiling = Math.min(CHUNK_HEIGHT - 1, this.config.worldDepth - 10);

    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      if (Math.hypot(wx, wz) < SPAWN_PROTECTED_RADIUS) return;
      const surface = this.getTerrainHeight(wx, wz);
      // Fill from just above the surface up to the shell, leaving a generous
      // air gap so the surface itself stays walkable.
      const gapTop = Math.min(ceiling - 6, surface + 26);
      for (let y = gapTop; y < ceiling; y++) chunk.setBlock(lx, y, lz, BLOCK.STONE);
      // A solid roof so there is genuinely no sky.
      for (let y = ceiling; y < CHUNK_HEIGHT; y++) chunk.setBlock(lx, y, lz, BLOCK.STONE);
    });
  }

  /* ============= SPAWN PATCH ============= */

  private applyPlayableSpawnPatch(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      if (Math.hypot(wx, wz) > SPAWN_PROTECTED_RADIUS) return;
      const groundY = this.config.seaLevel - 6;
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        if (y < this.config.bedrockThickness) chunk.setBlock(lx, y, lz, BEDROCK_MIX[Math.min(BEDROCK_MIX.length - 1, y)]);
        else if (y < groundY - 4) chunk.setBlock(lx, y, lz, BLOCK.STONE);
        else if (y < groundY) chunk.setBlock(lx, y, lz, BLOCK.DIRT);
        else if (y === groundY) chunk.setBlock(lx, y, lz, BLOCK.GRASS);
        else chunk.setBlock(lx, y, lz, BLOCK.AIR);
      }
    });
  }

  private applyObjectiveClearings(chunk: Chunk): void {
    const layout = this.cachedLayout;
    const points = [layout.rocket, layout.settlement, layout.portalCore, layout.woodenDoor, layout.dimensionalDoor, layout.palette, layout.marketplace];
    // A clearing belongs at the terrain height beneath its centre, not at one
    // global sea-level Y. The old fixed Y=27 excavated enormous pits whenever
    // an objective landed on a hill. Worse, it only erased six blocks above
    // that floor and left the rest of the old hill suspended in the air — the
    // giant floating roof / X-ray cross-section visible in player reports.
    const clearings = points.map((point) => ({
      ...point,
      groundY: this.getTerrainHeight(Math.floor(point.x), Math.floor(point.z)),
    }));

    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      for (const c of clearings) {
        const d = Math.hypot(wx - c.x, wz - c.z);
        if (d <= c.radius) {
          const groundY = c.groundY;
          for (let y = 0; y < CHUNK_HEIGHT; y++) {
            if (y < this.config.bedrockThickness) {
              chunk.setBlock(lx, y, lz, BEDROCK_MIX[Math.min(BEDROCK_MIX.length - 1, y)]);
            } else if (y < groundY - 4) {
              // Preserve deep caves; only the load-bearing cap needs refilling.
              continue;
            } else if (y < groundY) {
              chunk.setBlock(lx, y, lz, y < groundY - 3 ? BLOCK.STONE : BLOCK.DIRT);
            } else if (y === groundY) {
              chunk.setBlock(lx, y, lz, c.label === 'rocket' ? BLOCK.STONE : BLOCK.GRASS);
            } else {
              // Clear the *entire* sky column. Restricting this to +6 retained
              // the original hillside overhead as a detached terrain ceiling.
              chunk.setBlock(lx, y, lz, BLOCK.AIR);
            }
          }
          break;
        }
      }
    });
  }

  /** Remove isolated natural voxels left behind by a carve/dressing pass. */
  private removeUnanchoredTerrain(chunk: Chunk): void {
    const remove: Array<readonly [number, number, number]> = [];
    const highest = chunk.getHighestOccupiedY();

    for (let y = this.config.bedrockThickness + 1; y <= highest; y += 1) {
      for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
        for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
          if (!isNaturalGround(chunk.getBlock(lx, y, lz))) continue;

          let connected = false;
          for (const [dx, dy, dz] of FACE_OFFSETS_3D) {
            const neighbor = getBlock(chunk.getBlock(lx + dx, y + dy, lz + dz));
            if (neighbor.solid && !neighbor.transparent) {
              connected = true;
              break;
            }
          }
          if (!connected) remove.push([lx, y, lz]);
        }
      }
    }

    for (const [lx, y, lz] of remove) chunk.setBlock(lx, y, lz, BLOCK.AIR);
  }

  /**
   * Last-resort allocation and foundation check for ordinary terrain worlds.
   * This does not fill legitimate caves. It only repairs a column when no
   * opaque, solid structural voxel survived above the foundation at all.
   */
  private ensureChunkIntegrity(chunk: Chunk): void {
    if (this.config.floatingIslands || this.config.skyIslands) return;
    this.removeUnanchoredTerrain(chunk);

    for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
        if (this.subBedrock.length === 0) {
          for (let y = 0; y < this.config.bedrockThickness; y += 1) {
            const id = chunk.getBlock(lx, y, lz);
            const definition = getBlock(id);
            if (id === BLOCK.AIR || !definition.solid || definition.transparent) {
              chunk.setBlock(lx, y, lz, BEDROCK_MIX[Math.min(y, BEDROCK_MIX.length - 1)]);
            }
          }
        }

        let hasStructure = false;
        for (let y = this.config.bedrockThickness; y < CHUNK_HEIGHT; y += 1) {
          const id = chunk.getBlock(lx, y, lz);
          if (id === BLOCK.AIR) continue;
          const definition = getBlock(id);
          if (definition.id === 0) {
            // Unknown ids render as air in the registry; replace them rather
            // than preserving an invisible voxel in a load-bearing column.
            chunk.setBlock(lx, y, lz, BLOCK.STONE);
            hasStructure = true;
            continue;
          }
          if (definition.solid && !definition.transparent) hasStructure = true;
        }

        if (hasStructure) continue;
        const fallbackTop = this.fallbackSurfaceHeight();
        for (let y = this.config.bedrockThickness; y <= fallbackTop; y += 1) {
          chunk.setBlock(lx, y, lz, BLOCK.STONE);
        }
      }
    }
  }

  private applySavedEdits(chunk: Chunk): void {
    for (const edit of this.editOverrides.values()) {
      const a = this.toChunkAddress(edit.x, edit.z);
      if (a.cx === chunk.x && a.cz === chunk.z) chunk.setBlock(a.lx, edit.y, a.lz, edit.block);
    }
    chunk.modified = false;
  }

  /* ============= BLOCK API ============= */

  getBlockAt(worldX: number, y: number, worldZ: number): BlockID {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    const a = this.toChunkAddress(worldX, worldZ);
    return this.generateChunk(a.cx, a.cz).getBlock(a.lx, y, a.lz);
  }

  setBlockAt(worldX: number, y: number, worldZ: number, block: BlockID): boolean {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    const a = this.toChunkAddress(worldX, worldZ);
    const chunk = this.generateChunk(a.cx, a.cz);
    // Bedrock is unbreakable in survival; even breaking it doesn't change it.
    if (y < this.config.bedrockThickness && block === 0) return false;
    chunk.setBlock(a.lx, y, a.lz, block);
    this.editOverrides.set(editKey(a.worldX, y, a.worldZ), { x: a.worldX, y, z: a.worldZ, block });
    return true;
  }

  /** Creative-only bedrock breaker. Returns true if a block was broken. */
  breakBedrock(worldX: number, y: number, worldZ: number): boolean {
    if (y < 0 || y >= this.config.bedrockThickness) return false;
    const a = this.toChunkAddress(worldX, worldZ);
    const chunk = this.generateChunk(a.cx, a.cz);
    if (a.lx < 0 || a.lx >= CHUNK_SIZE || a.lz < 0 || a.lz >= CHUNK_SIZE) return false;
    chunk.setBlock(a.lx, y, a.lz, BLOCK.AIR);
    this.editOverrides.set(editKey(a.worldX, y, a.worldZ), { x: a.worldX, y, z: a.worldZ, block: BLOCK.AIR });
    return true;
  }

  /** Mass-bedrock-clear for a radius. */
  breakBedrockArea(worldX: number, worldZ: number, radius: number): number {
    let broken = 0;
    for (let dy = 0; dy < this.config.bedrockThickness; dy++) {
      for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
        if (this.breakBedrock(worldX + dx, dy, worldZ + dz)) broken++;
      }
    }
    return broken;
  }

  /** Undo a creative bedrock break by restoring the original block. */
  restoreBedrock(worldX: number, y: number, worldZ: number, block: BlockID): void {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const a = this.toChunkAddress(worldX, worldZ);
    const chunk = this.generateChunk(a.cx, a.cz);
    chunk.setBlock(a.lx, y, a.lz, block);
    this.editOverrides.set(editKey(a.worldX, y, a.worldZ), { x: a.worldX, y, z: a.worldZ, block });
  }

  getEdits(): WorldBlockEdit[] { return Array.from(this.editOverrides.values()).map((e) => ({ ...e })); }
  getEditCount(): number { return this.editOverrides.size; }

  /**
   * DevTunableTerrain — developer panel world-tuning. Applying tuning drops
   * every cached chunk and height lookup so freshly streamed chunks honour it
   * immediately; saved player edits survive because they live in
   * `editOverrides` and are re-applied by `applySavedEdits` on regeneration.
   */
  setDeveloperTuning(tuning: { heightMultiplier: number; biomeMods: BiomeModificationFlags }): void {
    const multiplier = Number.isFinite(tuning.heightMultiplier)
      ? Math.min(3, Math.max(0.25, tuning.heightMultiplier))
      : 1;
    const nextMods: BiomeModificationFlags = { ...DEFAULT_BIOME_MODS, ...tuning.biomeMods };
    const changed = multiplier !== this.devHeightMultiplier
      || BIOME_MOD_KEYS.some((k) => this.devBiomeMods[k] !== nextMods[k]);
    this.devHeightMultiplier = multiplier;
    this.devBiomeMods = nextMods;
    if (changed) this.invalidateGeneratedChunks();
  }

  /** Drop all cached chunks and height/biome lookups (player edits persist). */
  invalidateGeneratedChunks(): void {
    this.chunks.clear();
    this.heightCache.clear();
    this.rawHeightCache.clear();
    this.smoothHeightCache.clear();
    this.biomeCache.clear();
  }

  /**
   * Cheap analytic ground estimate for a column.
   *
   * This is the *pre-carve* shape. It never generates a chunk, so it is the
   * right call for wide surveys (minimap, distant LOD, biome logic). It is the
   * WRONG call for placing anything solid into the world — a cave or ravine
   * may have removed the ground it reports. Use `getSurfaceHeight` for that.
   */
  getHeightAt(worldX: number, worldZ: number): number { return this.getTerrainHeight(worldX, worldZ); }

  /**
   * The authoritative "what is the Y of the ground here" query.
   *
   * Generates the owning chunk if needed and sweeps its voxels top-down,
   * returning the highest solid block that is open to the sky. Plants, leaves
   * and water are seen through, so this is the block an entity or a structure
   * should stand on.
   *
   * Anything that spawns into the world — mobs, NPCs, villages, portals,
   * quest markers, Arena AI actors — should place at `getSurfaceHeight() + 1`.
   * Using `getHeightAt()` for that is what made entities hover over carved
   * terrain or stand buried inside a hill.
   *
   * Returns the bedrock ceiling for a column with no ground at all (a void
   * column in a skylands world), so callers always get a usable number.
   */
  getSurfaceHeight(worldX: number, worldZ: number): number {
    const a = this.toChunkAddress(worldX, worldZ);
    const chunk = this.generateChunk(a.cx, a.cz);
    const y = this.findSkyExposedSurface(chunk, a.lx, a.lz);
    return y >= 0 ? y : this.config.bedrockThickness;
  }

  /**
   * True when a feature of `height` blocks can stand at this column without
   * clipping into anything. Decoration and structure placement should gate on
   * this rather than assuming the space above the ground is empty.
   */
  hasClearanceAbove(worldX: number, worldZ: number, height: number): boolean {
    const a = this.toChunkAddress(worldX, worldZ);
    const chunk = this.generateChunk(a.cx, a.cz);
    const surface = this.findSkyExposedSurface(chunk, a.lx, a.lz);
    if (surface < 0) return false;
    for (let y = surface + 1; y <= surface + height; y++) {
      if (y >= CHUNK_HEIGHT) return false;
      if (chunk.getBlock(a.lx, y, a.lz) !== BLOCK.AIR) return false;
    }
    return true;
  }

  getSpawnPoint(): SpawnPoint {
    const x = 0.5, z = 0.5;
    const groundY = this.getTerrainHeight(Math.floor(x), Math.floor(z));
    // Camera.position is the eye, matching Minecraft's 1.62-block eye height.
    return { x, y: groundY + 1 + 1.62, z };
  }

  /* ============= HELPERS ============= */

  /**
   * Write a world-space voxel that belongs to a feature being built in
   * `chunk`, even when it lands outside that chunk's 16x16 footprint.
   *
   * ## The bug this replaces: features sliced off at chunk borders
   *
   * The old `setBlockIfInChunk` silently *discarded* any write outside the
   * current chunk. A tree anchored at local x=15 therefore lost the half of
   * its canopy that belonged to the neighbouring chunk, and a 5-wide ruin
   * anchored near an edge was cut in half. Measured on a forced-forest world,
   * columns at the chunk edges held ~26% fewer leaf blocks than columns in the
   * middle — a flat-sided, sheared look along every chunk boundary.
   *
   * ## How the spill buffer works
   *
   * The overhanging part of a feature is not thrown away; it is routed to the
   * chunk that owns it:
   *
   *  - If that chunk is already built, apply the write immediately and mark it
   *    for a mesh rebuild.
   *  - If it has not been built yet, queue it. `generateChunk` drains the
   *    queue as its last shaping step, so the decoration lands on top of the
   *    finished terrain exactly as if it had been placed locally.
   *
   * Either ordering produces identical voxels, so the world stays
   * deterministic and seam-free without any chunk needing to generate its
   * neighbours (which would recurse).
   */
  private setBlockIfInChunk(chunk: Chunk, worldX: number, y: number, worldZ: number, block: BlockID): void {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const lx = worldX - chunk.x * CHUNK_SIZE, lz = worldZ - chunk.z * CHUNK_SIZE;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      chunk.setBlock(lx, y, lz, block);
      return;
    }
    this.spillBlock(worldX, y, worldZ, block);
  }

  /**
   * Route a feature voxel to the chunk that actually owns it.
   *
   * Overhang writes only ever fill AIR. A feature may not carve away terrain,
   * a player edit, or another feature in the neighbouring chunk, so the result
   * does not depend on which of the two chunks was generated first.
   */
  private spillBlock(worldX: number, y: number, worldZ: number, block: BlockID): void {
    const a = this.toChunkAddress(worldX, worldZ);
    // A player edit at this coordinate always wins over generated decoration.
    if (this.editOverrides.has(editKey(a.worldX, y, a.worldZ))) return;

    const key = this.chunkKey(a.cx, a.cz);
    const existing = this.chunks.get(key);
    if (existing) {
      if (existing.getBlock(a.lx, y, a.lz) !== BLOCK.AIR) return;
      existing.setBlock(a.lx, y, a.lz, block);
      existing.meshDirty = true;
      return;
    }

    let queue = this.pendingSpill.get(key);
    if (!queue) {
      // Bound the buffer so an unexplored frontier cannot grow without limit.
      if (this.pendingSpill.size >= SPILL_CHUNK_LIMIT) {
        const oldest = this.pendingSpill.keys().next().value as string | undefined;
        if (oldest !== undefined) this.pendingSpill.delete(oldest);
      }
      queue = [];
      this.pendingSpill.set(key, queue);
    }
    queue.push({ lx: a.lx, y, lz: a.lz, block });
  }

  /** Apply decoration that neighbouring chunks pushed into this one. */
  private applyPendingSpill(chunk: Chunk): void {
    const key = this.chunkKey(chunk.x, chunk.z);
    const queue = this.pendingSpill.get(key);
    if (!queue) return;
    // AIR-only, matching the immediate path in `spillBlock`, so a queued write
    // and a direct write produce the same world.
    for (const w of queue) {
      if (chunk.getBlock(w.lx, w.y, w.lz) !== BLOCK.AIR) continue;
      chunk.setBlock(w.lx, w.y, w.lz, w.block);
    }
    this.pendingSpill.delete(key);
  }

  private chunkKey(cx: number, cz: number): string { return `${cx}:${cz}`; }
  private toChunkAddress(worldX: number, worldZ: number) {
    const x = Math.floor(worldX), z = Math.floor(worldZ);
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    return { cx, cz, lx: x - cx * CHUNK_SIZE, lz: z - cz * CHUNK_SIZE, worldX: x, worldZ: z };
  }
  private forEachLocalBlock(chunk: Chunk, visit: (lx: number, lz: number, wx: number, wz: number) => void): void {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = chunk.x * CHUNK_SIZE + lx, wz = chunk.z * CHUNK_SIZE + lz;
      visit(lx, lz, wx, wz);
    }
  }
}

export default CavesAndCliffsTerrainGenerator;

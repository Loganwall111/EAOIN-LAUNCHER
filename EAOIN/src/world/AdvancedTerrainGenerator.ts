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
import { BlockID } from '@shared/blocks/BlockRegistry';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from './Chunk';
import { AdvancedNoise } from './AdvancedNoise';
import { DeepCaveGenerator } from './DeepCaves';
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
  worldDepth: 256,
  bedrockThickness: 4,
  continentScale: 0.0012,
  detailScale: 0.018,
  mountainIntensity: 1.4,
  erosionIterations: 3,
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
  FARMLAND: 279,
  MUD: 105,
  CLAY: 4,
  GRAVEL: 1,
} as const;

const BEDROCK_MIX: BlockID[] = [12, 12, 12, 12, 3]; // Mostly obsidian-ish "bedrock" stand-in

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

/** Max columns kept in the height caches (~a few MB at most). */
const HEIGHT_CACHE_LIMIT = 262144;

export class AdvancedTerrainGenerator {
  private readonly chunks = new Map<string, Chunk>();
  private readonly editOverrides = new Map<string, WorldBlockEdit>();
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

  constructor(config: Partial<WorldGenConfig> & { seed: string }) {
    this.config = { ...DEFAULT_OVERWORLD_CONFIG, ...config };
    this.cachedLayout = getWorldLayout(this.config.seed, { x: 0.5, y: this.config.seaLevel + 1.95, z: 0.5 });
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

  /** Build a chunk by composing every terrain pass. */
  generateChunk(cx: number, cz: number): Chunk {
    const key = this.chunkKey(cx, cz);
    const cached = this.chunks.get(key);
    if (cached) return cached;
    const chunk = new Chunk(cx, cz, this.config.seed, { generate: false });
    if (this.config.floatingIslands || this.config.skyIslands) {
      this.fillSkyIslands(chunk);
    } else {
      this.fillContinents(chunk);
    }
    this.applyCavePass(chunk);
    // 2.0 — widen the underground into real caverns with their own biomes.
    // Strictly below the surface; the overworld terrain is untouched.
    if (!this.config.floatingIslands && !this.config.skyIslands) {
      this.deepCaves.apply(chunk, (x, z) => this.getTerrainHeight(x, z));
    }
    this.applyRavines(chunk);
    this.applySinkholes(chunk);
    this.applyUndergroundOceansAndRivers(chunk);
    this.applyErosionPass(chunk);
    this.applyAntiFloatingPatch(chunk);
    this.applyOrePass(chunk);
    this.applyGeologyPass(chunk);
    this.applySurfacePass(chunk);
    this.applyVegetation(chunk);
    this.applyStructures(chunk);
    this.applyBedrockFoundation(chunk);
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
    this.applySavedEdits(chunk);
    this.chunks.set(key, chunk);
    return chunk;
  }

  /* ============= HEIGHTMAP ============= */

  /** Continental height in [0, 1], warped for natural coastlines. */
  getBaseHeight(worldX: number, worldZ: number): number {
    const cx = worldX * this.config.continentScale;
    const cz = worldZ * this.config.continentScale;
    const warp = this.noise.warped2D(cx, cz, 1.6, 1);
    const continent = this.noise.fbm2D(warp * 1.2, warp * 1.2, 5, 2.0, 0.5, 2);
    return continent;
  }

  /** Mountain ridge height in [0, 1] for a given point. */
  getMountainHeight(worldX: number, worldZ: number): number {
    const cx = worldX * this.config.continentScale * 2.0;
    const cz = worldZ * this.config.continentScale * 2.0;
    const r = this.noise.ridge2D(cx, cz, 5, 5);
    const m = this.noise.fbm2D(cx, cz, 4, 2.0, 0.5, 6);
    return Math.max(0, r * 0.7 + m * 0.3);
  }

  /** Final terrain height in voxels, used everywhere. */
  getTerrainHeight(worldX: number, worldZ: number): number {
    const x = Math.floor(worldX), z = Math.floor(worldZ);
    const key = columnKey(x, z);
    const cached = this.heightCache.get(key);
    if (cached !== undefined) return cached;

    const h = Math.max(
      this.config.bedrockThickness,
      Math.min(this.config.worldDepth - 8, Math.round(this.computeTerrainHeight(x, z)))
    );
    this.rememberHeight(this.heightCache, key, h);
    return h;
  }

  /** Height before erosion smoothing. Never calls getTerrainHeight (no recursion). */
  private getRawTerrainHeight(worldX: number, worldZ: number): number {
    const x = Math.floor(worldX), z = Math.floor(worldZ);
    const key = columnKey(x, z);
    const cached = this.rawHeightCache.get(key);
    if (cached !== undefined) return cached;

    const continent = this.getBaseHeight(x, z);
    
    // Improved mountain noise for Caves & Cliffs style
    const mountainBase = this.noise.fbm2D(x * 0.0008, z * 0.0008, 6, 2.1, 0.48, 8);
    const mountainRidge = this.noise.ridge2D(x * 0.002, z * 0.002, 5, 12);
    
    // Mountain mask decides where peaks are
    const mountainMask = Math.pow(Math.max(0, mountainBase - 0.42) * 1.8, 2);
    
    // Continental baseline
    const baseHeight = this.config.seaLevel - 4 + continent * 32;
    
    // Mountain peaks: sharp ridges that rise high
    const mountainContribution = mountainRidge * mountainMask * 120 * this.config.mountainIntensity;

    const detail = this.detailNoise.fbm2D(x * this.config.detailScale, z * this.config.detailScale, 5, 2.0, 0.5, 11) * 3.5;
    const beach = this.getBeachHeight(x, z);

    const raw = baseHeight + mountainContribution + detail + beach;
    this.rememberHeight(this.rawHeightCache, key, raw);
    return raw;
  }

  /** Composes the raw heightmap, erosion and valley smoothing for one column. */
  private computeTerrainHeight(worldX: number, worldZ: number): number {
    if (this.config.flatGroundY !== null) return this.config.flatGroundY;
    if (this.config.floatingIslands || this.config.skyIslands) return this.getFloatingIslandHeight(worldX, worldZ);
    if (Math.hypot(worldX, worldZ) < SPAWN_PROTECTED_RADIUS + 2) return this.config.seaLevel - 6;

    let h = this.getRawTerrainHeight(worldX, worldZ);
    h = this.applyHydraulicErosion(h, worldX, worldZ);
    h -= this.getValleyHeight(worldX, worldZ);

    // --- Far Lands -------------------------------------------------------
    // Past the threshold the terrain stops being terrain and becomes
    // architecture: sheer walls hundreds of blocks tall with stretched
    // tunnels between them.
    const corruption = farLandsCorruption(worldX, worldZ, this.config.farLandsThreshold);
    if (corruption > 0) {
      const far = sampleFarLands(this.exoticNoise, worldX, worldZ, corruption, this.config.worldDepth);
      // Blend from normal terrain into the wall structure as corruption ramps.
      h = h * (1 - corruption) + (h + far.heightBoost) * corruption;
      if (far.tunnel) h = Math.min(h, this.config.seaLevel - 10);
    }

    // --- Inverted --------------------------------------------------------
    if (this.config.inverted) {
      h = invertHeight(h, this.config.seaLevel, this.config.worldDepth);
    }

    return h;
  }

  /** Small bounded LRU-ish cache so streaming does not recompute noise endlessly. */
  private rememberHeight(cache: Map<number, number>, key: number, value: number): void {
    if (cache.size >= HEIGHT_CACHE_LIMIT) {
      // Drop the oldest quarter of the cache instead of clearing everything,
      // so the chunk currently being meshed keeps its hot entries.
      let toDrop = Math.floor(HEIGHT_CACHE_LIMIT / 4);
      for (const k of cache.keys()) {
        cache.delete(k);
        if (--toDrop <= 0) break;
      }
    }
    cache.set(key, value);
  }

  getFloatingIslandHeight(worldX: number, worldZ: number): number {
    const continent = this.noise.fbm2D(worldX * 0.0028, worldZ * 0.0028, 5, 2.0, 0.5, 1);
    const island = this.noise.fbm2D((worldX + 413) * 0.012, (worldZ - 199) * 0.012, 3, 2.0, 0.5, 3);
    const ridge = this.noise.ridge2D(worldX * 0.005, worldZ * 0.005, 4, 5);
    const mask = Math.max(0, island - 0.45) * 4;
    const base = this.config.seaLevel + 18 + continent * 22 + ridge * 18 * mask;
    return Math.max(this.config.worldDepth - 60, Math.min(this.config.worldDepth - 8, Math.round(base)));
  }

  /** Soft valley smoothing — long shallow valleys between mountains. */
  getValleyHeight(worldX: number, worldZ: number): number {
    const v = this.noise.ridge2D((worldX - 423) * 0.0048, (worldZ + 827) * 0.0048, 4, 9);
    if (v < 0.74) return 0;
    return (v - 0.74) / 0.26 * 8;
  }

  /** Coastal beach height boost — lifts ground a bit near the sea. */
  getBeachHeight(worldX: number, worldZ: number): number {
    const h = this.getBaseHeight(worldX, worldZ);
    if (h > 0.55) return 0;
    return (0.55 - h) * 4;
  }

  /**
   * Hydraulic + thermal erosion approximation in 1D.
   *
   * Neighbour samples deliberately use the *raw* heightmap. Sampling the eroded
   * height here would make getTerrainHeight call itself for four neighbours,
   * which recursed forever and blew the stack (black screen on world load).
   */
  private applyHydraulicErosion(h: number, worldX: number, worldZ: number): number {
    if (this.config.erosionIterations <= 0) return h;
    // Slightly lower peaks and lift valleys using a smoothed sample.
    const step = 1.4;
    let eroded = h;
    for (let iter = 0; iter < this.config.erosionIterations; iter++) {
      const spread = step * (iter + 1);
      const a = this.getRawTerrainHeight(worldX + spread, worldZ);
      const b = this.getRawTerrainHeight(worldX - spread, worldZ);
      const c = this.getRawTerrainHeight(worldX, worldZ + spread);
      const d = this.getRawTerrainHeight(worldX, worldZ - spread);
      const mean = (a + b + c + d) / 4;
      const diff = eroded - mean;
      eroded = Math.max(this.config.bedrockThickness, eroded - Math.min(2, Math.max(0, diff) * 0.4));
    }
    return eroded;
  }

  /* ============= FILL PASSES ============= */

  private fillContinents(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      const surface = this.getTerrainHeight(wx, wz);
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const id = this.pickColumnBlock(y, surface, wx, wz);
        chunk.setBlock(lx, y, lz, id);
      }
    });
  }

  private fillSkyIslands(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      const top = this.getFloatingIslandHeight(wx, wz);
      const bottom = Math.max(this.config.bedrockThickness, top - (8 + Math.floor(this.noise.fbm2D(wx * 0.018, wz * 0.018, 3, 2.0, 0.5, 31) * 12)));
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        if (y < bottom) chunk.setBlock(lx, y, lz, BLOCK.AIR);
        else if (y < top - 4) chunk.setBlock(lx, y, lz, BLOCK.STONE);
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

  /* ============= CAVE PASS ============= */

  /**
   * Carve the cave network.
   *
   * ## What was wrong before
   *
   * The old pass produced a *hollow* underground: a survey of the shipped
   * generator found **52% of every rock column below the surface was air**.
   * That is why the underground read as "a complete empty area… like nothing
   * there, hollow". Two causes:
   *
   *   1. The tunnel test `|n1-0.5| + |n2-0.5| < threshold` compares a *sum of
   *      two independent fbm fields*, which is near 0.5 far more often than a
   *      proper distance test, so it carved enormous connected voids.
   *   2. It ran for the whole column with no falloff, and the deep-cave pass
   *      then widened the same space again.
   *
   * ## What it does now
   *
   * Two complementary, well-understood cave types, exactly like Minecraft:
   *
   *   - **Worm / spaghetti tunnels**: two ridged-noise fields, each turned
   *     into a *tube* by taking distance from a zero crossing. A point is
   *     hollow only where **both** tubes are narrow, which yields long,
   *     winding, genuinely connected passages rather than blobs.
   *   - **Cheese chambers**: sparse low-frequency 3D noise above a high
   *     threshold, giving the occasional real room to walk into.
   *
   * Both fade out near the surface and near bedrock, so the ground stays solid
   * and the world keeps a floor.
   */
  private applyCavePass(chunk: Chunk): void {
    if (this.config.caveScale === 0) return;
    const cs = this.config.caveScale;

    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      const surface = this.getTerrainHeight(wx, wz);
      // Regional mask: some areas are simply more caved than others, which is
      // what makes spelunking feel like finding something.
      const region = this.caveNoise.fbm2D(wx * 0.0022, wz * 0.0022, 3, 2.0, 0.5, 151);
      const regionDensity = Math.max(0, (region - 0.32) / 0.68);
      if (regionDensity <= 0) return;

      // Leave a solid cap under the surface so caves never break daylight.
      const yStart = this.config.bedrockThickness + 2;
      const yEnd = Math.min(surface - 6, CHUNK_HEIGHT - 1);
      if (yEnd <= yStart) return;

      const span = Math.max(1, yEnd - yStart);
      // Radius is constant per column apart from the vertical falloff, so hoist
      // everything that does not depend on y out of the loop.
      const radiusBase = 0.075 * (cs >= 2 ? 1.15 : 0.85) * (0.55 + regionDensity * 0.45);
      const roomBase = 0.82 - regionDensity * 0.05;

      for (let y = yStart; y < yEnd; y++) {
        const current = chunk.getBlock(lx, y, lz);
        // Never carve bedrock, and never carve into existing fluid.
        if (current === BLOCK.AIR || current === BLOCK.WATER || current === BLOCK.LAVA) continue;

        // Vertical falloff: 0 at the roof and at bedrock, 1 in the middle of
        // the rock column. Keeps the ground and the floor of the world solid.
        const t = (y - yStart) / span;
        const falloff = Math.sin(Math.PI * t);
        if (falloff <= 0.05) continue;

        let hollow = false;

        // --- worm tunnels ------------------------------------------------
        // Distance from the zero-crossing of each field defines a tube; the
        // intersection of two tubes is a winding passage.
        //
        // PERF: the two fbm3D calls are the single most expensive thing in
        // world generation. The first is evaluated, and the second is only
        // evaluated when the first is already inside the tube radius —
        // `w1*w1` alone can rule the point out, and it does for the vast
        // majority of blocks. That halves the noise work on this path.
        const radius = radiusBase * falloff;
        const radiusSq = radius * radius;
        const w1 = this.caveNoise.fbm3D(wx * 0.014, y * 0.026, wz * 0.014, 3, 2.0, 0.5, 1) - 0.5;
        if (w1 * w1 < radiusSq) {
          const w2 = this.caveNoise.fbm3D((wx + 211) * 0.014, y * 0.026, (wz - 503) * 0.014, 3, 2.0, 0.5, 2) - 0.5;
          if (w1 * w1 + w2 * w2 < radiusSq) hollow = true;
        }

        // --- cheese chambers ---------------------------------------------
        if (!hollow) {
          const room = this.caveNoise.fbm3D(wx * 0.0075, y * 0.011, wz * 0.0075, 3, 2.0, 0.5, 3);
          // High threshold => rare. Slightly easier to satisfy deeper down.
          if (room > roomBase - falloff * 0.07) hollow = true;
        }

        if (hollow) chunk.setBlock(lx, y, lz, BLOCK.AIR);
      }
    });
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

  private applySinkholes(chunk: Chunk): void {
    if (!this.config.sinkholes) return;
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      if (Math.hypot(wx, wz) < SPAWN_PROTECTED_RADIUS) return;
      const cellX = Math.floor(wx / 12);
      const cellZ = Math.floor(wz / 12);
      const startX = cellX * 12;
      const startZ = cellZ * 12;
      const ox = Math.floor(this.noise.hash(cellX, cellZ, 0, 41) * 12);
      const oz = Math.floor(this.noise.hash(cellX, cellZ, 1, 42) * 12);
      if (wx !== startX + ox || wz !== startZ + oz) return;
      const r = 2 + Math.floor(this.noise.hash(cellX, cellZ, 2, 43) * 2);
      const surface = this.getTerrainHeight(wx, wz);
      const depth = 8 + Math.floor(this.noise.hash(cellX, cellZ, 3, 44) * 6);
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > r) continue;
        const lx2 = lx + dx, lz2 = lz + dz;
        if (lx2 < 0 || lx2 >= CHUNK_SIZE || lz2 < 0 || lz2 >= CHUNK_SIZE) continue;
        for (let y = surface - Math.round(depth * (1 - d / r)); y < surface; y++) {
          if (y < this.config.bedrockThickness) continue;
          chunk.setBlock(lx2, y, lz2, BLOCK.AIR);
        }
      }
    });
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

  private applySurfacePass(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      if (Math.hypot(wx, wz) < SPAWN_PROTECTED_RADIUS) return;
      const surface = this.getTerrainHeight(wx, wz);
      if (surface <= this.config.bedrockThickness) return;
      const biome = this.getBiomeAt(wx, wz);
      const top = chunk.getBlock(lx, surface, lz);
      // Paint surface based on biome.
      if (biome.id === 'desert' || biome.id === 'badlands' || biome.id === 'eroded_badlands') {
        chunk.setBlock(lx, surface, lz, BLOCK.SAND);
        if (chunk.getBlock(lx, surface - 1, lz) === BLOCK.DIRT) chunk.setBlock(lx, surface - 1, lz, BLOCK.SAND);
        if (chunk.getBlock(lx, surface - 2, lz) === BLOCK.DIRT) chunk.setBlock(lx, surface - 2, lz, BLOCK.SAND);
      } else if (biome.id === 'snowy_plains' || biome.id === 'snowy_taiga' || biome.id === 'snowy_beach' || biome.id === 'ice_spikes' || biome.id === 'frozen_wasteland_biome') {
        chunk.setBlock(lx, surface, lz, BLOCK.SNOW);
      } else if (biome.id === 'mushroom_fields' || biome.id === 'mushroom_island' || biome.id === 'mushroom_valley') {
        chunk.setBlock(lx, surface, lz, BLOCK.MOSS);
      } else if (biome.id === 'cherry_grove' || biome.id === 'cherry_biome' || biome.id === 'cherry_valley') {
        chunk.setBlock(lx, surface, lz, BLOCK.CHERRY_LEAVES);
      } else if (biome.id === 'beach' || biome.id === 'warm_beach') {
        chunk.setBlock(lx, surface, lz, BLOCK.SAND);
      } else if (biome.id === 'ocean_world_biome' || biome.id === 'deep_ocean' || biome.id === 'frozen_ocean') {
        chunk.setBlock(lx, surface, lz, BLOCK.GRAVEL);
      } else if (biome.id === 'swamp' || biome.id === 'mangrove_swamp' || biome.id === 'mangrove_biome' || biome.id === 'mangrove_delta') {
        chunk.setBlock(lx, surface, lz, BLOCK.MUD);
      } else if (biome.id === 'badlands' || biome.id === 'eroded_badlands' || biome.id === 'wooded_badlands') {
        chunk.setBlock(lx, surface, lz, BLOCK.SAND);
      } else if (biome.id === 'volcano' || biome.id === 'volcanic_realm_biome' || biome.id === 'lava_field') {
        chunk.setBlock(lx, surface, lz, BLOCK.BASALT);
      } else {
        if (top === BLOCK.GRASS) {
          // leave as grass
        } else {
          chunk.setBlock(lx, surface, lz, BLOCK.GRASS);
        }
      }
      // Snow accumulation in cold biomes above 50.
      if (surface > 50 && biome.temperature === 'cold') {
        chunk.setBlock(lx, surface, lz, BLOCK.SNOW);
      }
      // Sea-level fill.
      if (surface < this.config.seaLevel) {
        for (let y = surface + 1; y <= this.config.seaLevel; y++) chunk.setBlock(lx, y, lz, BLOCK.WATER);
      }
    });
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

    if (elevation > 56 && tempTag === 'cold') return getBiome('ice_spikes');
    if (elevation > 48 && (tempTag === 'cold' || tempTag === 'temperate')) return getBiome('alpine_biome');

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
    // PERF: quantise to a 16-block lattice before caching.
    //
    // This is a 9-tap stencil, so it is 9 height lookups per call, and it is
    // consulted for every column by the surface, vegetation and biome passes.
    // Because the result is a wide average it barely changes between adjacent
    // blocks, so snapping the sample point to a coarse grid gives visually
    // identical boundaries while turning 256 evaluations per chunk into ~4.
    const x = Math.round(worldX / SMOOTH_HEIGHT_STEP) * SMOOTH_HEIGHT_STEP;
    const z = Math.round(worldZ / SMOOTH_HEIGHT_STEP) * SMOOTH_HEIGHT_STEP;
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

  private applyVegetation(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      if (Math.hypot(wx, wz) < SPAWN_PROTECTED_RADIUS) return;
      const biome = this.getBiomeAt(wx, wz);
      const surface = this.getTerrainHeight(wx, wz);
      const top = chunk.getBlock(lx, surface, lz);
      if (top === BLOCK.WATER || top === BLOCK.AIR) return;
      // Tree placement on a Poisson-disc grid.
      // Forests should feel like forests: a tree roughly every 4 blocks reads
      // as dense woodland once canopies overlap, while open biomes keep the
      // occasional lone tree.
      if (biome.id === 'forest' || biome.id === 'taiga' || biome.id === 'rainforest' || biome.id === 'bamboo_jungle' || biome.id === 'redwood_biome' || biome.id === 'cherry_biome' || biome.id === 'mystic_woods' || biome.id === 'mushroom_island') {
        if (this.featureAnchor(wx, wz, 4, 'tree')) this.placeTree(chunk, wx, surface, wz, 4 + Math.floor(this.noise.hash(wx, wz, 0, 121) * 3));
      }
      if (biome.id === 'plain' || biome.id === 'meadow' || biome.id === 'sunflower_plains') {
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
    this.forEachLocalBlock(chunk, (_lx, _lz, wx, wz) => {
      if (Math.hypot(wx, wz) < SPAWN_PROTECTED_RADIUS) return;

      // --- surface landmarks: rare, deliberately findable ------------------
      if (this.featureAnchor(wx, wz, 420, 'monolith')) {
        this.placeMonolith(chunk, wx, this.getTerrainHeight(wx, wz), wz);
      }
      if (this.featureAnchor(wx, wz, 340, 'ruin-fragment')) {
        this.placeRuinFragment(chunk, wx, this.getTerrainHeight(wx, wz), wz);
      }

      // --- buried features: only ever seen underground ---------------------
      if (this.featureAnchor(wx, wz, 96, 'geode')) {
        this.placeGeode(chunk, wx, this.getTerrainHeight(wx, wz), wz);
      }
      if (this.featureAnchor(wx, wz, 120, 'fossil')) {
        this.placeFossil(chunk, wx, this.getTerrainHeight(wx, wz), wz);
      }

      if (this.config.volcanoes && this.featureAnchor(wx, wz, 900, 'volcano')) {
        this.placeVolcano(chunk, wx, wz);
      }
    });
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
    const clearings = [layout.rocket, layout.settlement, layout.portalCore, layout.woodenDoor, layout.dimensionalDoor, layout.palette, layout.marketplace];
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      for (const c of clearings) {
        const d = Math.hypot(wx - c.x, wz - c.z);
        if (d <= c.radius) {
          const groundY = this.config.seaLevel - 5;
          for (let y = 0; y < CHUNK_HEIGHT; y++) {
            if (y < this.config.bedrockThickness) chunk.setBlock(lx, y, lz, BEDROCK_MIX[Math.min(BEDROCK_MIX.length - 1, y)]);
            else if (y < groundY - 3) chunk.setBlock(lx, y, lz, BLOCK.STONE);
            else if (y < groundY) chunk.setBlock(lx, y, lz, BLOCK.DIRT);
            else if (y === groundY) chunk.setBlock(lx, y, lz, c.label === 'rocket' ? BLOCK.STONE : BLOCK.GRASS);
            else if (y <= groundY + 6) chunk.setBlock(lx, y, lz, BLOCK.AIR);
          }
          break;
        }
      }
    });
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
  getHeightAt(worldX: number, worldZ: number): number { return this.getTerrainHeight(worldX, worldZ); }
  getSpawnPoint(): SpawnPoint {
    const x = 0.5, z = 0.5;
    const groundY = this.getTerrainHeight(Math.floor(x), Math.floor(z));
    return { x, y: groundY + 1.95, z };
  }

  /* ============= HELPERS ============= */

  private setBlockIfInChunk(chunk: Chunk, worldX: number, y: number, worldZ: number, block: BlockID): void {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const lx = worldX - chunk.x * CHUNK_SIZE, lz = worldZ - chunk.z * CHUNK_SIZE;
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
    chunk.setBlock(lx, y, lz, block);
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

export default AdvancedTerrainGenerator;

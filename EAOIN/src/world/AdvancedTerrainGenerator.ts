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
import { getBiome, BiomeDefinition } from './Biomes';

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
}

export const DEFAULT_OVERWORLD_CONFIG: WorldGenConfig = {
  seed: 'eaoin_seed_2026',
  seaLevel: 18,
  worldDepth: 128,
  bedrockThickness: 4,
  continentScale: 0.0018,
  detailScale: 0.022,
  mountainIntensity: 1.0,
  erosionIterations: 2,
  caveScale: 2,
  floatingIslands: false,
  skyIslands: false,
  undergroundRivers: true,
  undergroundOceans: true,
  ravines: true,
  sinkholes: true,
  volcanoes: true,
  glaciers: true,
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
  private readonly heightCache = new Map<string, number>();
  private readonly rawHeightCache = new Map<string, number>();
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
    const chunk = new Chunk(cx, cz, this.config.seed);
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
    const key = `${x}:${z}`;
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
    const key = `${x}:${z}`;
    const cached = this.rawHeightCache.get(key);
    if (cached !== undefined) return cached;

    const continent = this.getBaseHeight(x, z);
    const mountain = this.getMountainHeight(x, z);

    // Mountain mask — where on the continent mountains appear.
    const mountainMask = Math.max(0, this.noise.fbm2D(x * 0.0011, z * 0.0011, 4, 2.0, 0.5, 8) - 0.55) * 4;

    // Continental baseline (0..1) → block height (0..90).
    const baseHeight = this.config.seaLevel - 8 + continent * 22;
    const mountainContribution = mountain * mountainMask * 64 * this.config.mountainIntensity;

    const detail = this.detailNoise.fbm2D(x * this.config.detailScale, z * this.config.detailScale, 4, 2.0, 0.5, 11) * 2.6;
    const beach = this.getBeachHeight(x, z);

    const raw = baseHeight + mountainContribution + detail + beach;
    this.rememberHeight(this.rawHeightCache, key, raw);
    return raw;
  }

  /** Composes the raw heightmap, erosion and valley smoothing for one column. */
  private computeTerrainHeight(worldX: number, worldZ: number): number {
    if (this.config.floatingIslands || this.config.skyIslands) return this.getFloatingIslandHeight(worldX, worldZ);
    if (Math.hypot(worldX, worldZ) < SPAWN_PROTECTED_RADIUS + 2) return this.config.seaLevel - 6;

    let h = this.getRawTerrainHeight(worldX, worldZ);
    h = this.applyHydraulicErosion(h, worldX, worldZ);
    h -= this.getValleyHeight(worldX, worldZ);
    return h;
  }

  /** Small bounded LRU-ish cache so streaming does not recompute noise endlessly. */
  private rememberHeight(cache: Map<string, number>, key: string, value: number): void {
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

  private applyCavePass(chunk: Chunk): void {
    if (this.config.caveScale === 0) return;
    const cs = this.config.caveScale;
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      const surface = this.getTerrainHeight(wx, wz);
      if (surface < this.config.seaLevel - 4) return;
      // 3D cave noise — three independent samples combined for spaghetti caves.
      const yStart = this.config.bedrockThickness + 1;
      const yEnd = surface - 6;
      for (let y = yStart; y < yEnd; y++) {
        const n1 = this.caveNoise.fbm3D(wx * 0.045, y * 0.06, wz * 0.045, 3, 2.0, 0.5, 1);
        const n2 = this.caveNoise.fbm3D((wx + 211) * 0.030, y * 0.050, (wz - 503) * 0.030, 3, 2.0, 0.5, 2);
        const n3 = this.caveNoise.fbm3D((wx - 117) * 0.018, y * 0.030, (wz + 71) * 0.018, 3, 2.0, 0.5, 3);
        const cave = (n1 * 0.5 + n2 * 0.35 + n3 * 0.15);
        const surfaceProx = Math.max(0, (surface - y) / Math.max(1, surface));
        const threshold = cs === 1 ? 0.74 : 0.69;
        if (cave > threshold && surfaceProx > 0.18) chunk.setBlock(lx, y, lz, BLOCK.AIR);
      }
    });
  }

  /* ============= RAVINES ============= */

  private applyRavines(chunk: Chunk): void {
    if (!this.config.ravines) return;
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      // Use a thin-line noise: ravines are 1-block wide long cracks.
      const r = this.caveNoise.ridge2D(wx * 0.005, wz * 0.005, 4, 21);
      if (r < 0.93) return;
      const surface = this.getTerrainHeight(wx, wz);
      for (let y = this.config.bedrockThickness; y < surface - 4; y++) {
        const wide = this.caveNoise.noise2D(wx * 0.06, y * 0.06, 23) * 0.5 + 0.5;
        if (wide > 0.55) chunk.setBlock(lx, y, lz, BLOCK.AIR);
      }
      void wx; void wz;
    });
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

  private applyUndergroundOcean(chunk: Chunk): void {
    const baseY = 14;
    const bandX = this.noise.fbm2D(chunk.x * 0.02, chunk.z * 0.02, 3, 2.0, 0.5, 51);
    const inOcean = bandX > 0.62;
    if (!inOcean) return;
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      const surface = this.getTerrainHeight(wx, wz);
      for (let y = baseY; y < baseY + 5; y++) {
        if (y < this.config.bedrockThickness) continue;
        if (y < surface - 12) chunk.setBlock(lx, y, lz, BLOCK.WATER);
      }
    });
  }

  private applyUndergroundRiver(chunk: Chunk): void {
    const centerline = this.riverNoise.ridge2D(chunk.x * 0.0035, chunk.z * 0.0035, 4, 33);
    if (centerline < 0.86) return;
    this.forEachLocalBlock(chunk, (lx, lz, wx, wz) => {
      const surface = this.getTerrainHeight(wx, wz);
      const baseY = Math.max(this.config.bedrockThickness + 2, surface - 18);
      for (let y = baseY; y < baseY + 4; y++) {
        if (y < this.config.bedrockThickness) continue;
        chunk.setBlock(lx, y, lz, BLOCK.WATER);
      }
    });
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
        const n = this.noise.fbm2D(wx * 0.015, y * 0.022, 3, 2.0, 0.5, 91);
        const n2 = this.noise.fbm2D(wx * 0.013 + 7, (y + 13) * 0.018, 3, 2.0, 0.5, 92);
        if (depth > 0.6) chunk.setBlock(lx, y, lz, BLOCK.DEEPSLATE);
        else if (n < 0.18) chunk.setBlock(lx, y, lz, BLOCK.GRANITE);
        else if (n < 0.36) chunk.setBlock(lx, y, lz, BLOCK.DIORITE);
        else if (n < 0.54) chunk.setBlock(lx, y, lz, BLOCK.ANDESITE);
        else if (n2 < 0.25) chunk.setBlock(lx, y, lz, BLOCK.STONE_BRICKS);
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

  /** Look up a BiomeDefinition by interpolated climate. */
  getBiomeAt(worldX: number, worldZ: number): BiomeDefinition {
    const temp = this.biomeNoise.fbm2D(worldX * 0.0014, worldZ * 0.0014, 4, 2.0, 0.5, 101);
    const moist = this.biomeNoise.fbm2D(worldX * 0.0019 + 9, worldZ * 0.0019 - 11, 4, 2.0, 0.5, 102);
    const elevation = this.getTerrainHeight(worldX, worldZ);
    const tempTag: 'cold' | 'temperate' | 'warm' | 'hot' = temp < 0.30 ? 'cold' : temp < 0.55 ? 'temperate' : temp < 0.78 ? 'warm' : 'hot';
    const moistTag: 'arid' | 'normal' | 'humid' | 'wet' | 'snow' = moist < 0.30 ? 'arid' : moist < 0.55 ? 'normal' : moist < 0.78 ? 'humid' : 'wet';

    if (elevation < this.config.seaLevel - 4) return getBiome('ocean_world_biome');
    if (elevation < this.config.seaLevel) return getBiome('beach');
    if (elevation > 56 && tempTag === 'cold') return getBiome('ice_spikes');
    if (elevation > 48 && (tempTag === 'cold' || tempTag === 'temperate')) return getBiome('alpine_biome');
    if (moistTag === 'arid' && tempTag === 'hot') return getBiome('desert');
    if (moistTag === 'arid' && tempTag === 'warm') return getBiome('savanna');
    if (moistTag === 'wet' && (tempTag === 'warm' || tempTag === 'hot')) return getBiome('rainforest');
    if (moistTag === 'wet' && tempTag === 'temperate') return getBiome('forest');
    if (moistTag === 'wet' && tempTag === 'cold') return getBiome('snowy_taiga');
    if (tempTag === 'cold') return getBiome('snowy_plains');
    if (tempTag === 'temperate' && moistTag === 'normal') return getBiome('meadow');
    return getBiome('plain');
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
      if (biome.id === 'forest' || biome.id === 'taiga' || biome.id === 'rainforest' || biome.id === 'bamboo_jungle' || biome.id === 'redwood_biome' || biome.id === 'cherry_biome' || biome.id === 'mystic_woods' || biome.id === 'mushroom_island') {
        if (this.featureAnchor(wx, wz, 5, 'tree')) this.placeTree(chunk, wx, surface, wz, 4 + Math.floor(this.noise.hash(wx, wz, 0, 121) * 3));
      }
      if (biome.id === 'plain' || biome.id === 'meadow' || biome.id === 'sunflower_plains') {
        if (this.featureAnchor(wx, wz, 9, 'plains-tree')) this.placeTree(chunk, wx, surface, wz, 3);
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

  private applyStructures(chunk: Chunk): void {
    // Larger structures (villages, pyramids) are too big to spawn per-chunk.
    // We instead seed small things: monoliths, ruin fragments, geodes, fossils.
    this.forEachLocalBlock(chunk, (_lx, _lz, wx, wz) => {
      if (Math.hypot(wx, wz) < SPAWN_PROTECTED_RADIUS) return;
      if (this.featureAnchor(wx, wz, 30, 'monolith')) this.placeMonolith(chunk, wx, this.getTerrainHeight(wx, wz), wz);
      if (this.featureAnchor(wx, wz, 26, 'geode')) this.placeGeode(chunk, wx, this.getTerrainHeight(wx, wz), wz);
      if (this.featureAnchor(wx, wz, 36, 'fossil')) this.placeFossil(chunk, wx, this.getTerrainHeight(wx, wz), wz);
      if (this.featureAnchor(wx, wz, 42, 'ruin-fragment')) this.placeRuinFragment(chunk, wx, this.getTerrainHeight(wx, wz), wz);
      if (this.config.volcanoes && this.featureAnchor(wx, wz, 220, 'volcano')) this.placeVolcano(chunk, wx, wz);
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

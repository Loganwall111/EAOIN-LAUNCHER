/**
 * Terrain Generator — procedural overworld generation with multi-octave noise.
 *
 * ## The three bugs this file used to have
 *
 * 1. **Coordinate scaling.** `generateChunk` handed the work to
 *    `Chunk.generate()`, which derived its heights from `hash(seed + cx + cz)`
 *    and then from the *chunk-local* x only. Two consequences: the height was
 *    a step function of the chunk index (a hard vertical cut at every seam),
 *    and it had no Z term at all (long straight ridges). Meanwhile
 *    `getHeightAt` used a completely different formula on world coordinates,
 *    so gameplay queries and the actual voxels disagreed — entities were
 *    placed into thin air or buried. Both now read one shared
 *    `sampleColumn(worldX, worldZ)` that is a pure function of *world*
 *    position, so chunks tile seamlessly and the query matches the voxels.
 *
 * 2. **Voxel grid instantiation.** The column loop never validated the height
 *    before writing. A `NaN` from the old string-seeded noise (see
 *    `noise/Noise.ts`) made every comparison false, so the column was left
 *    entirely air — a pitch-black hole — and `Math.max(1, NaN)` is `NaN`, not
 *    1, so the "minimum height" guard did nothing. Heights are now clamped
 *    into `[MIN_SURFACE_Y, CHUNK_HEIGHT - 1]` with a non-finite fallback, and
 *    the loop is bounded by the clamped value so it can neither break early
 *    nor run past the array.
 *
 * 3. **Empty chunks.** Nothing distinguished "this chunk is legitimately all
 *    air" from "this chunk failed to generate". Chunks now always carry a
 *    bedrock floor, and `isChunkEmpty` gives the renderer an explicit,
 *    cheap check so it can skip the mesh without disturbing its neighbours.
 */
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from '../world/Chunk';
import { Noise } from './noise/Noise';

/** Block ids, matching shared/src/blocks/BlockRegistry. */
const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  BEDROCK: 12,
} as const;

/** Water surface height. Columns below this fill with water. */
export const SEA_LEVEL = 26;

/**
 * Lowest surface a column may have.
 *
 * Above the bedrock floor, so a column can never be nothing but void, and a
 * clamp rather than a `Math.max` on a possibly-`NaN` value.
 */
export const MIN_SURFACE_Y = 6;

/** Highest surface a column may have; leaves headroom below the chunk ceiling. */
export const MAX_SURFACE_Y = CHUNK_HEIGHT - 16;

/** Thickness of the unbreakable floor at the bottom of every chunk. */
const BEDROCK_THICKNESS = 2;

/** Depth of the soil layer under the surface block. */
const SOIL_DEPTH = 4;

/* --- noise frequencies, in cycles per block ---------------------------------
 * These are applied to WORLD coordinates. That is the whole point: a chunk is
 * just a window onto one continuous field, so the frequency must not be
 * expressed per chunk or the field restarts at every boundary.
 */
const CONTINENT_FREQUENCY = 0.0035;
const HILL_FREQUENCY = 0.012;
const DETAIL_FREQUENCY = 0.045;
const MOUNTAIN_FREQUENCY = 0.0045;
const CLIMATE_FREQUENCY = 0.0018;

export interface ColumnSample {
  /** Y of the topmost solid block. Always an integer in the legal range. */
  surfaceY: number;
  /** Block placed at `surfaceY`. */
  surfaceBlock: number;
  /** Climate value in [0, 1] used for the biome. */
  climate: number;
}

export class TerrainGenerator {
  private readonly noise: Noise;
  /** Separate field for mountains so peaks are not correlated with hills. */
  private readonly mountainNoise: Noise;
  /** Separate field for climate so biomes are not correlated with height. */
  private readonly climateNoise: Noise;

  constructor(private readonly seed: string) {
    // `Noise` now hashes a string seed itself; passing the raw seed used to
    // make every sample NaN. See noise/Noise.ts.
    this.noise = new Noise(seed);
    this.mountainNoise = new Noise(`${seed}:mountain`);
    this.climateNoise = new Noise(`${seed}:climate`);
  }

  /**
   * Fill a chunk from the shared heightmap.
   *
   * The chunk is constructed with `{ generate: false }` so the legacy
   * placeholder terrain — the per-chunk step function that produced the seams
   * — never runs and is never overwritten half-way.
   */
  generateChunk(cx: number, cz: number): Chunk {
    // Guard the chunk address itself. A NaN chunk coordinate (easy to produce
    // from a bad `Math.floor(x / CHUNK_SIZE)` upstream) would otherwise turn
    // every world coordinate into NaN and empty the whole chunk.
    const chunkX = Number.isFinite(cx) ? Math.trunc(cx) : 0;
    const chunkZ = Number.isFinite(cz) ? Math.trunc(cz) : 0;

    const chunk = new Chunk(chunkX, chunkZ, this.seed, { generate: false });

    const originX = chunkX * CHUNK_SIZE;
    const originZ = chunkZ * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        // World coordinates — the noise must never see chunk-local ones.
        const worldX = originX + lx;
        const worldZ = originZ + lz;
        this.fillColumn(chunk, lx, lz, worldX, worldZ);
      }
    }

    return chunk;
  }

  /**
   * Write one full column of voxels.
   *
   * Bottom-up and fully bounded: the loop range is derived from the clamped
   * surface height, so it cannot terminate early on a bad comparison and
   * cannot address outside the voxel array.
   */
  private fillColumn(chunk: Chunk, lx: number, lz: number, worldX: number, worldZ: number): void {
    const { surfaceY, surfaceBlock } = this.sampleColumn(worldX, worldZ);

    for (let y = 0; y < BEDROCK_THICKNESS; y++) {
      chunk.setBlock(lx, y, lz, BLOCK.BEDROCK);
    }

    const stoneTop = surfaceY - SOIL_DEPTH;
    for (let y = BEDROCK_THICKNESS; y <= stoneTop; y++) {
      chunk.setBlock(lx, y, lz, BLOCK.STONE);
    }
    for (let y = Math.max(BEDROCK_THICKNESS, stoneTop + 1); y < surfaceY; y++) {
      chunk.setBlock(lx, y, lz, BLOCK.DIRT);
    }
    if (surfaceY >= BEDROCK_THICKNESS) {
      chunk.setBlock(lx, surfaceY, lz, surfaceBlock);
    }

    // Sea fill. Bounded by the chunk ceiling so it can never write past the
    // array even if SEA_LEVEL is reconfigured upward.
    const waterTop = Math.min(SEA_LEVEL, CHUNK_HEIGHT - 1);
    for (let y = surfaceY + 1; y <= waterTop; y++) {
      chunk.setBlock(lx, y, lz, BLOCK.WATER);
    }
  }

  /**
   * The single source of truth for a column's shape.
   *
   * Everything — the voxel fill, `getHeightAt`, and the biome — goes through
   * here, which is what keeps the mesh and the gameplay queries consistent.
   */
  sampleColumn(worldX: number, worldZ: number): ColumnSample {
    // Reject non-finite input up front rather than letting it poison the
    // arithmetic; a NaN that reaches `Math.floor` stays NaN and silently
    // deletes the column.
    const x = Number.isFinite(worldX) ? worldX : 0;
    const z = Number.isFinite(worldZ) ? worldZ : 0;

    // Broad landmass shape. 5 octaves at a very low frequency.
    const continent = this.noise.fbm(x * CONTINENT_FREQUENCY, z * CONTINENT_FREQUENCY, 5);
    // Mid-scale rolling hills.
    const hills = this.noise.fbm(x * HILL_FREQUENCY, z * HILL_FREQUENCY, 4, 2.0, 0.5, 32);
    // Fine surface detail; low amplitude so it does not create spikes.
    const detail = this.noise.fbm(x * DETAIL_FREQUENCY, z * DETAIL_FREQUENCY, 2, 2.0, 0.5, 64);

    let height = SEA_LEVEL + 2 + continent * 14 + hills * 6 + detail * 1.5;

    // Mountains are masked so they occur in ranges rather than everywhere, and
    // the mask is squared for a smooth ramp into the foothills — a hard cutoff
    // here is what creates unclimbable walls.
    const mountainMask = this.mountainNoise.fbm01(
      x * MOUNTAIN_FREQUENCY,
      z * MOUNTAIN_FREQUENCY,
      4
    );
    if (mountainMask > 0.58) {
      const t = (mountainMask - 0.58) / 0.42;
      const ridge = this.mountainNoise.ridge(x * 0.006, z * 0.006, 4, 96);
      height += t * t * ridge * 34;
    }

    const surfaceY = this.clampSurface(height);

    return {
      surfaceY,
      surfaceBlock: this.surfaceBlockFor(surfaceY),
      climate: this.climateNoise.fbm01(x * CLIMATE_FREQUENCY, z * CLIMATE_FREQUENCY, 3),
    };
  }

  /**
   * Clamp a raw noise height into a legal, integral voxel Y.
   *
   * `Math.max(1, NaN)` returns `NaN`, so the old minimum-height guard did not
   * guard anything. Testing for finiteness first is the only correct order.
   */
  private clampSurface(height: number): number {
    if (!Number.isFinite(height)) return MIN_SURFACE_Y;
    const rounded = Math.round(height);
    if (rounded < MIN_SURFACE_Y) return MIN_SURFACE_Y;
    if (rounded > MAX_SURFACE_Y) return MAX_SURFACE_Y;
    return rounded;
  }

  /** Sand at the shoreline, stone on exposed peaks, grass in between. */
  private surfaceBlockFor(surfaceY: number): number {
    if (surfaceY <= SEA_LEVEL + 1) return BLOCK.SAND;
    if (surfaceY > SEA_LEVEL + 26) return BLOCK.STONE;
    return BLOCK.GRASS;
  }

  /**
   * Y of the topmost solid block at a world column.
   *
   * Reads the same field the voxels are built from, so a caller placing an
   * entity at `getHeightAt(x, z) + 1` lands on the ground rather than inside
   * it or above it.
   */
  getHeightAt(worldX: number, worldZ: number): number {
    return this.sampleColumn(Math.floor(worldX), Math.floor(worldZ)).surfaceY;
  }

  /**
   * Biome id for a world column.
   *
   * The old version sampled at `cx * 0.05` while being called with *chunk*
   * coordinates, so a biome region was a handful of chunks wide and snapped to
   * the chunk grid. It also compared a `[-1, 1]` value against thresholds that
   * only make sense in `[0, 1]`, which is why almost everything came back
   * "Ocean". This samples world coordinates against a `[0, 1]` field and
   * cross-checks against the real height.
   */
  generateBiome(worldX: number, worldZ: number): string {
    const { surfaceY, climate } = this.sampleColumn(Math.floor(worldX), Math.floor(worldZ));
    if (surfaceY <= SEA_LEVEL) return 'Ocean';
    if (surfaceY > SEA_LEVEL + 26) return 'Mountain';
    if (climate > 0.62) return 'Forest';
    if (climate < 0.34) return 'Desert';
    return 'Plains';
  }

  /**
   * True when a chunk holds no solid voxels at all.
   *
   * Exposed so the render layer can skip mesh construction for a void chunk
   * without having to guess from an empty vertex buffer. `getHighestOccupiedY`
   * is maintained incrementally by `Chunk.setBlock`, so this is O(1).
   */
  static isChunkEmpty(chunk: Chunk): boolean {
    return chunk.getHighestOccupiedY() < 0;
  }
}

export default TerrainGenerator;

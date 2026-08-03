import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from '../world/Chunk';
import { AetherTerrain, BackroomsTerrain } from '../dimensions/terrain/AetherBackroomsTerrain';
import { DimensionTerrainGenerator, dimensionArchetype } from '../dimensions/terrain/DimensionTerrain';

/** The part of either terrain generator needed by the chunk streamer. */
export interface OverworldChunkGenerator {
  generateChunk(cx: number, cz: number): Chunk;
}

/**
 * Owns the chunk generator selected for the active dimension.
 *
 * Keeping this in a constructed object is important for startup safety. The
 * first spawn chunks are requested immediately while GameCanvas initializes;
 * previously their callback referenced `const` generators declared later in
 * the function and threw a temporal-dead-zone ReferenceError before the render
 * loop could start. That left a black canvas with the React HUD still visible.
 */
export class DimensionChunkSource {
  private readonly aether: AetherTerrain;
  private readonly backrooms: BackroomsTerrain;
  private readonly dimensionTerrain = new Map<string, DimensionTerrainGenerator>();
  private activeDimension = 'overworld';

  constructor(
    private readonly seed: string,
    private readonly overworld: OverworldChunkGenerator
  ) {
    this.aether = new AetherTerrain({ seed, floorY: 30, ceilingY: 112 });
    this.backrooms = new BackroomsTerrain({ seed, floorY: 14, roomHeight: 5, levels: 4 });
  }

  getDimension(): string {
    return this.activeDimension;
  }

  setDimension(dimensionId: string): void {
    this.activeDimension = dimensionId;
  }

  /** True when the dimension has genuinely distinct terrain from the overworld. */
  hasOwnTerrain(dimensionId: string): boolean {
    return dimensionArchetype(dimensionId) !== 'hills'
      || dimensionId === 'aether'
      || dimensionId === 'backrooms';
  }

  private terrainFor(dimensionId: string): DimensionTerrainGenerator | null {
    if (dimensionId === 'overworld' || dimensionId === 'nature_dimension') return null;
    const cached = this.dimensionTerrain.get(dimensionId);
    if (cached) return cached;
    const gen = new DimensionTerrainGenerator(dimensionId, this.seed);
    this.dimensionTerrain.set(dimensionId, gen);
    return gen;
  }

  /** Bound callback so it can be passed directly to ChunkRenderManager. */
  readonly generateChunk = (cx: number, cz: number): Chunk => {
    const dim = this.activeDimension;

    // The Aether and Backrooms use their bespoke generators.
    if (dim === 'aether' || dim === 'backrooms') {
      const chunk = new Chunk(cx, cz, `${this.seed}:${dim}`, { generate: false });
      if (dim === 'aether') this.aether.generate(chunk);
      else this.backrooms.generate(chunk);
      return chunk;
    }

    // Every other dimension gets its own generated world.
    const dimensionGen = this.terrainFor(dim);
    if (dimensionGen) {
      const chunk = new Chunk(cx, cz, `${this.seed}:${dim}`, { generate: false });
      dimensionGen.generate(chunk);
      return chunk;
    }

    return this.overworld.generateChunk(cx, cz);
  };

  /**
   * Find the highest solid, non-fluid surface Y in the ACTIVE dimension at a
   * world column, so the player can be dropped onto the real ground instead of
   * spawning buried underground. Returns -1 when there is no solid ground.
   */
  getSurfaceHeightAt(worldX: number, worldZ: number): number {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const lx = worldX - cx * CHUNK_SIZE;
    const lz = worldZ - cz * CHUNK_SIZE;
    const chunk = this.generateChunk(cx, cz);
    for (let y = CHUNK_HEIGHT - 1; y >= 1; y--) {
      const id = chunk.getBlock(lx, y, lz);
      // Skip air and fluids (water/lava/toxic) to land on solid ground.
      if (id !== 0 && id !== 5 && id !== 227 && id !== 226) return y;
    }
    return -1;
  }

  /** Alias used by the creature spawner (CreatureTerrainSource interface). */
  getSurfaceHeight(worldX: number, worldZ: number): number {
    return this.getSurfaceHeightAt(worldX, worldZ);
  }

  /**
   * Voxel read in the ACTIVE dimension. This mirrors the overworld terrain's
   * `getBlockAt` so callers (creature spawning, raycasts) can treat every
   * dimension interchangeably instead of querying the overworld and burying
   * entities underground in a dimension with its own terrain.
   */
  getBlockAt(worldX: number, y: number, worldZ: number): number {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    const lx = worldX - cx * CHUNK_SIZE;
    const lz = worldZ - cz * CHUNK_SIZE;
    return this.generateChunk(cx, cz).getBlock(lx, y, lz);
  }

  /**
   * Biome id in the ACTIVE dimension. Overworld delegates to the overworld
   * terrain; a dimension with its own terrain reports the dimension id itself
   * (so species tagged 'humorous', 'void', 'nether', etc. can spawn there).
   *
   * The Nether reports its sub-biomes so the deeper fauna is genuinely tied to
   * where it lives: a column that grows a crimson forest (crimson stem/canopy)
   * → 'crimson_forest', a warped forest (warped stem/canopy) → 'warped_forest',
   * otherwise → 'nether' (the wastes). We scan the whole column rather than the
   * surface height because the nether has a solid bedrock roof on top, so the
   * "highest solid block" is the roof, not the forest floor.
   */
  getBiomeAt(worldX: number, worldZ: number): string {
    const dim = this.activeDimension;
    if (dim === 'nether') {
      const cx = Math.floor(worldX / CHUNK_SIZE);
      const cz = Math.floor(worldZ / CHUNK_SIZE);
      const lx = worldX - cx * CHUNK_SIZE;
      const lz = worldZ - cz * CHUNK_SIZE;
      const chunk = this.generateChunk(cx, cz);
      for (let y = CHUNK_HEIGHT - 1; y >= 1; y--) {
        const b = chunk.getBlock(lx, y, lz);
        if (b === 55) return 'crimson_forest'; // crimson stem / canopy
        if (b === 56) return 'warped_forest';  // warped stem / canopy
      }
      return 'nether';
    }
    if (!this.hasOwnTerrain(dim)) {
      const raw = (this.overworld as unknown as { getBiomeAt?: (x: number, z: number) => unknown }).getBiomeAt?.(worldX, worldZ);
      if (typeof raw === 'string') return raw;
      if (raw && typeof raw === 'object') {
        const def = raw as { id?: unknown; name?: unknown };
        return String(def.id ?? def.name ?? 'plains');
      }
      return 'plains';
    }
    return dim;
  }
}

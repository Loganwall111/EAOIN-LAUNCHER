import { Chunk } from '../world/Chunk';
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
}

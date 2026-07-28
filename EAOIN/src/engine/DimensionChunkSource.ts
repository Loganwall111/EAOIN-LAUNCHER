import { Chunk } from '../world/Chunk';
import { AetherTerrain, BackroomsTerrain } from '../dimensions/terrain/AetherBackroomsTerrain';

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

  /** Bound callback so it can be passed directly to ChunkRenderManager. */
  readonly generateChunk = (cx: number, cz: number): Chunk => {
    if (this.activeDimension !== 'aether' && this.activeDimension !== 'backrooms') {
      return this.overworld.generateChunk(cx, cz);
    }

    const chunk = new Chunk(cx, cz, `${this.seed}:${this.activeDimension}`, { generate: false });

    if (this.activeDimension === 'aether') this.aether.generate(chunk);
    else this.backrooms.generate(chunk);
    return chunk;
  };
}

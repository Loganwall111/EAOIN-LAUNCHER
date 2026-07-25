/**
 * SkyIslandsTerrain — Floating Land Mass Generation
 */
import { Chunk } from '../../world/Chunk';

export class SkyIslandsTerrain {
  generateChunk(cx: number, cz: number, seed: string): Chunk {
    const chunk = new Chunk(cx, cz, seed + '_sky');
    // Sky islands: floating islands with air gaps, unique flora
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const islandVal = Math.sin((cx + x) * 0.2) * Math.cos((cz + z) * 0.2);
        if (islandVal > 0.5) {
          // Floating island block
          chunk.setBlock(x, 64 + Math.floor(islandVal * 20), z, 1); // Grass-like for islands
          chunk.setBlock(x, 63 + Math.floor(islandVal * 20), z, 2); // Dirt base
        }
      }
    }
    return chunk;
  }
}

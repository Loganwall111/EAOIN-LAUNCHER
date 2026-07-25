/**
 * AbyssTerrain — Deep Underground Environment
 */
import { Chunk } from '../../world/Chunk';

export class AbyssTerrain {
  generateChunk(cx: number, cz: number, seed: string): Chunk {
    const chunk = new Chunk(cx, cz, seed + '_abyss');
    // Deep dark, rare resources, giant caves
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const depthVal = Math.sin((cx - x) * 0.15) * 0.8 + 0.2;
        const yLevel = 20 + Math.floor(depthVal * 80);
        chunk.setBlock(x, yLevel, z, 3); // Stone deeper
        chunk.setBlock(x, yLevel + 1, z, 0); // Air caves
        if (Math.random() < 0.01) {
          chunk.setBlock(x, yLevel - 1, z, 11); // Diamond ore in deep
        }
      }
    }
    return chunk;
  }
}

/**
 * BlockBreaker & BlockPlacer — Player block interaction
 */
import { Chunk } from '../world/Chunk';
import { BlockID, BLOCKS } from '@shared/blocks/BlockRegistry';

export class BlockBreaker {
  breakBlock(chunk: Chunk, x: number, y: number, z: number): BlockID | null {
    const block = chunk.getBlock(x, y, z);
    if (block === 0) return null;
    chunk.setBlock(x, y, z, 0);
    chunk.meshDirty = true;
    return block;
  }
}

export class BlockPlacer {
  placeBlock(chunk: Chunk, x: number, y: number, z: number, blockId: BlockID): boolean {
    if (chunk.getBlock(x, y, z) !== 0) return false; // Can't place on solid
    if (BLOCKS[blockId]?.solid === false && blockId !== 0) {
      // Special rules for non-solid
    }
    chunk.setBlock(x, y, z, blockId);
    chunk.meshDirty = true;
    return true;
  }
}

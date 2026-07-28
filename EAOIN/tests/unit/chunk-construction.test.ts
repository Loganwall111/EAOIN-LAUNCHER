import { describe, expect, it } from 'vitest';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from '../../src/world/Chunk';

describe('Chunk construction options', () => {
  it('skips placeholder terrain generation when requested', () => {
    const chunk = new Chunk(0, 0, 'empty', { generate: false });
    let solid = 0;
    for (let x = 0; x < CHUNK_SIZE; x += 1)
      for (let y = 0; y < CHUNK_HEIGHT; y += 1)
        for (let z = 0; z < CHUNK_SIZE; z += 1) if (chunk.getBlock(x, y, z) !== 0) solid += 1;
    expect(solid).toBe(0);
  });

  it('still generates legacy placeholder terrain by default', () => {
    const chunk = new Chunk(0, 0, 'legacy-default');
    let solid = 0;
    for (let x = 0; x < CHUNK_SIZE; x += 1)
      for (let y = 0; y < CHUNK_HEIGHT; y += 1)
        for (let z = 0; z < CHUNK_SIZE; z += 1) if (chunk.getBlock(x, y, z) !== 0) solid += 1;
    expect(solid).toBeGreaterThan(0);
  });

  it('preserves the full registered block id range instead of wrapping to air', () => {
    const chunk = new Chunk(0, 0, 'wide-ids', { generate: false });
    chunk.setBlock(1, 10, 1, 256);
    chunk.setBlock(2, 11, 2, 276);
    chunk.setBlock(3, 12, 3, 302);

    expect(chunk.getBlock(1, 10, 1)).toBe(256);
    expect(chunk.getBlock(2, 11, 2)).toBe(276);
    expect(chunk.getBlock(3, 12, 3)).toBe(302);
    expect(chunk.getHighestOccupiedY()).toBe(12);

    chunk.setBlock(3, 12, 3, 0);
    expect(chunk.getHighestOccupiedY()).toBe(11);
  });
});

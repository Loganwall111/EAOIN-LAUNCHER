import { describe, expect, it, vi } from 'vitest';
import { DimensionChunkSource } from '../../src/engine/DimensionChunkSource';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from '../../src/world/Chunk';

function countSolid(chunk: Chunk): number {
  let solid = 0;
  for (let x = 0; x < CHUNK_SIZE; x += 1) {
    for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
      for (let z = 0; z < CHUNK_SIZE; z += 1) {
        if (chunk.getBlock(x, y, z) !== 0) solid += 1;
      }
    }
  }
  return solid;
}

describe('DimensionChunkSource startup safety', () => {
  it('can generate the first overworld chunk immediately after construction', () => {
    const expected = new Chunk(0, 0, 'expected');
    const generateChunk = vi.fn(() => expected);
    const source = new DimensionChunkSource('startup-regression', { generateChunk });

    // Regression: GameCanvas requests this synchronously during initialization.
    // The old callback touched const generators declared later and threw before
    // Babylon's render loop started, producing a black canvas with a live HUD.
    expect(source.generateChunk(0, 0)).toBe(expected);
    expect(generateChunk).toHaveBeenCalledWith(0, 0);
  });

  it('switches to real standalone dimension generators', () => {
    const source = new DimensionChunkSource('dimensions', {
      generateChunk: (cx, cz) => new Chunk(cx, cz, 'overworld'),
    });

    source.setDimension('aether');
    const aether = source.generateChunk(0, 0);
    expect(source.getDimension()).toBe('aether');
    expect(countSolid(aether)).toBeGreaterThan(0);
    // The Aether must retain empty space below its floating islands.
    expect(aether.getBlock(0, 0, 0)).toBe(0);

    source.setDimension('backrooms');
    const backrooms = source.generateChunk(0, 0);
    expect(source.getDimension()).toBe('backrooms');
    expect(countSolid(backrooms)).toBeGreaterThan(0);
  });
});

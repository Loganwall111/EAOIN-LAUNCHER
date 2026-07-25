import { describe, it, expect } from 'vitest';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from '../../client/src/world/Chunk';
import { ChunkMeshBuilder } from '../../client/src/rendering/ChunkMeshBuilder';

describe('Chunk System', () => {
  it('creates chunk with correct dimensions', () => {
    const chunk = new Chunk(0, 0, 'test');
    expect(chunk.x).toBe(0);
    expect(chunk.z).toBe(0);
    expect(CHUNK_SIZE).toBe(16);
    expect(CHUNK_HEIGHT).toBe(128);
  });

  it('sets and gets blocks correctly', () => {
    const chunk = new Chunk(1, 2, 'test');
    chunk.setBlock(5, 10, 5, 1);
    expect(chunk.getBlock(5, 10, 5)).toBe(1);
  });

  it('returns air for out of bounds', () => {
    const chunk = new Chunk(0, 0, 'test');
    expect(chunk.getBlock(20, 5, 5)).toBe(0);
  });
});

describe('Mesh Builder', () => {
  it('builds mesh data with arrays', () => {
    const builder = new ChunkMeshBuilder();
    const chunk = new Chunk(0, 0, 'test');
    const mesh = builder.build(chunk);
    expect(mesh.vertices).toBeInstanceOf(Float32Array);
    expect(mesh.indices).toBeInstanceOf(Uint32Array);
  });
});

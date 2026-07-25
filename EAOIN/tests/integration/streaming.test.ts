import { describe, it, expect, beforeEach } from 'vitest';
import { Chunk } from '../../client/src/world/Chunk';
import { ChunkLoader } from '../../client/src/networking/ChunkLoader';
import { ChunkCache } from '../../client/src/rendering/ChunkRenderer';

describe('Chunk Streaming Integration', () => {
  let cache: ChunkCache;

  beforeEach(() => {
    cache = new ChunkCache();
  });

  it('loads chunk through streaming framework', async () => {
    const loader = new ChunkLoader(cache, {
      generateChunk: (cx: number, cz: number) => new Chunk(cx, cz, 'test'),
    } as any);
    loader.updateStream(0, 0);
    await new Promise((r) => setTimeout(r, 100));
    expect(cache.has(0, 0)).toBe(true);
  });
});

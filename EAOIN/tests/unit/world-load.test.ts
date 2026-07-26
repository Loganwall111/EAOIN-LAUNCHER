import { describe, it, expect } from 'vitest';
import AdvancedTerrainGenerator from '../../src/world/AdvancedTerrainGenerator';
import { ChunkRenderManager } from '../../src/rendering/ChunkRenderManager';

/**
 * Regression tests for the "black screen on entering the main world" bug.
 *
 * Two things went wrong together:
 *  1. getTerrainHeight() -> applyHydraulicErosion() -> getTerrainHeight() was
 *     unbounded mutual recursion, so the very first chunk threw a RangeError
 *     and no terrain mesh was ever produced (HUD visible, world black).
 *  2. The whole render radius was generated in one synchronous burst before the
 *     first frame, which is what made it hang for minutes rather than fail fast.
 */
describe('main world load', () => {
  it('computes terrain height without blowing the stack', () => {
    const terrain = new AdvancedTerrainGenerator({ seed: 'regression' });
    expect(() => terrain.getTerrainHeight(300, 300)).not.toThrow();
    const h = terrain.getTerrainHeight(300, 300);
    expect(Number.isFinite(h)).toBe(true);
    expect(h).toBeGreaterThan(0);
  });

  it('generates a chunk with solid, non-empty terrain', () => {
    const terrain = new AdvancedTerrainGenerator({ seed: 'regression' });
    const chunk = terrain.generateChunk(3, 3);
    let solid = 0;
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 128; y++) {
      if (chunk.getBlock(x, y, z) !== 0) solid++;
    }
    expect(solid).toBeGreaterThan(0);
  });

  it('is deterministic for a given seed', () => {
    const a = new AdvancedTerrainGenerator({ seed: 'same-seed' });
    const b = new AdvancedTerrainGenerator({ seed: 'same-seed' });
    for (const [x, z] of [[0, 0], [17, -42], [300, 300], [-901, 588]]) {
      expect(a.getTerrainHeight(x, z)).toBe(b.getTerrainHeight(x, z));
    }
  });

  it('streams the render radius incrementally instead of in one blocking burst', () => {
    const terrain = new AdvancedTerrainGenerator({ seed: 'streaming' });
    const manager = new ChunkRenderManager({} as never, new Map() as never);
    // Stub the GPU mesh build; we are asserting scheduling, not rendering.
    (manager as unknown as { rebuildChunk(cx: number, cz: number): void }).rebuildChunk = () => {};

    const radius = 4;
    const budget = 2;
    let first = manager.updateVisibleChunks(0, 0, radius, (cx, cz) => terrain.generateChunk(cx, cz), { budget });
    expect(first.loaded).toBe(budget);
    expect(first.pending).toBeGreaterThan(0);

    let frames = 1;
    while (manager.hasPendingChunks(0, 0, radius)) {
      first = manager.updateVisibleChunks(0, 0, radius, (cx, cz) => terrain.generateChunk(cx, cz), { budget });
      expect(first.loaded).toBeLessThanOrEqual(budget);
      frames++;
      expect(frames).toBeLessThan(1000);
    }

    const total = (radius * 2 + 1) ** 2;
    expect(manager.getStats().loadedChunks).toBe(total);
    expect(frames).toBeGreaterThanOrEqual(total / budget);
    expect(first.pending).toBe(0);
  });
});

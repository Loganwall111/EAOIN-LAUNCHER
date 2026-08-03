// @vitest-environment jsdom
/**
 * 2.0 — The Nether reports its sub-biomes so the deeper fauna spawns where it
 * belongs: crimson forests, warped forests, and the wastes.
 *
 * The nether has a solid bedrock roof on top, so biome detection must scan the
 * column for crimson (55) / warped (56) stems rather than trusting the "highest
 * solid block" (which is the roof).
 */
import { describe, it, expect } from 'vitest';
import { DimensionChunkSource } from '../../src/engine/DimensionChunkSource';
import { Chunk } from '../../src/world/Chunk';

const overworld = {
  generateChunk: (cx: number, cz: number) => new Chunk(cx, cz, 'o', { generate: false }),
};

describe('Nether sub-biome reporting', () => {
  it('classifies columns as crimson_forest, warped_forest or nether wastes', () => {
    const src = new DimensionChunkSource('seed123', overworld);
    src.setDimension('nether');
    const seen = new Set<string>();
    for (let x = 0; x < 40; x++) {
      for (let z = 0; z < 40; z += 2) {
        seen.add(src.getBiomeAt(x, z));
      }
    }
    expect(seen.has('crimson_forest')).toBe(true);
    expect(seen.has('warped_forest')).toBe(true);
    expect(seen.has('nether')).toBe(true);
    for (const b of seen) {
      expect(['crimson_forest', 'warped_forest', 'nether']).toContain(b);
    }
  });

  it('returns overworld biomes when not in the nether', () => {
    const src = new DimensionChunkSource('seed123', overworld);
    src.setDimension('crystal_realm');
    expect(src.getBiomeAt(5, 5)).toBe('crystal_realm');
  });
});

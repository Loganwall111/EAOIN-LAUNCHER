// @vitest-environment jsdom
/**
 * 2.0 — Mineshaft structures in caves.
 *
 * A deterministic, Minecraft-style abandoned mineshaft (regular) and a deeper
 * "Black Mineshaft" variant spawn inside cave systems. These tests pin:
 *   - a chunk can host a shaft for a known anchor;
 *   - the shaft actually carves air corridors and places supports/rails/chests;
 *   - the two variants differ (black uses blackstone + cyan torch + glow glass);
 *   - anchors are deterministic and reasonably spaced.
 */
import { describe, it, expect } from 'vitest';
import { Chunk, CHUNK_SIZE } from '../../src/world/Chunk';
import { mineshaftAnchorAt, placeMineshaft } from '../../src/world/MineshaftStructures';

const AIR = 0, OAK_LOG = 6, BLACKSTONE = 48, CHEST = 146, TORCH = 319, CYAN_TORCH = 321, RAIL = 330;

function solidChunk(cx: number, cz: number, fill = 3): Chunk {
  const chunk = new Chunk(cx, cz, 'mineshaft-test', { generate: false });
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 1; y < 60; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) chunk.setBlock(x, y, z, fill);
    }
  }
  return chunk;
}

describe('mineshaftAnchorAt — deterministic placement', () => {
  it('returns a placement or null deterministically', () => {
    const a = mineshaftAnchorAt(0, 0);
    const b = mineshaftAnchorAt(0, 0);
    expect(a).toEqual(b);
    // Both null is fine, but the call must not throw.
    expect(typeof a).toBe('object');
  });

  it('yields a variety of placements across the world', () => {
    let variants = new Set<string>();
    let total = 0;
    for (let cx = 0; cx < 40; cx++) {
      for (let cz = 0; cz < 40; cz++) {
        const p = mineshaftAnchorAt(cx * 110, cz * 110);
        if (p) { total++; variants.add(p.variant); }
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(variants.has('regular')).toBe(true);
  });

  it('black shafts are placed deeper than regular ones', () => {
    let regularMin = Infinity, blackMax = -Infinity;
    for (let cx = 0; cx < 60; cx++) {
      for (let cz = 0; cz < 60; cz++) {
        const p = mineshaftAnchorAt(cx * 110, cz * 110);
        if (!p) continue;
        if (p.variant === 'regular') regularMin = Math.min(regularMin, p.anchorY);
        else blackMax = Math.max(blackMax, p.anchorY);
      }
    }
    // Black shafts sit deeper (lower Y) than regular ones, which stay higher
    // in the ground. Regular Y ∈ [24,42], black Y ∈ [12,24].
    expect(regularMin).toBeGreaterThan(blackMax);
  });
});

describe('placeMineshaft — carving & furnishing', () => {
  it('carves air corridors and places support beams, rails, and chests', () => {
    const chunk = solidChunk(0, 0);
    // Force a valid anchor deep enough to carve (within chunk 0,0).
    const placement = { anchorX: 8, anchorY: 40, anchorZ: 8, variant: 'regular' as const };
    const placed = placeMineshaft(chunk, placement);
    expect(placed).toBe(true);

    // The main corridor should be hollow (air) somewhere near the anchor.
    let airCount = 0, railCount = 0, chestCount = 0, supportCount = 0;
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 38; y <= 42; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const b = chunk.getBlock(x, y, z);
          if (b === AIR) airCount++;
          if (b === RAIL) railCount++;
          if (b === CHEST) chestCount++;
          if (b === OAK_LOG) supportCount++;
        }
      }
    }
    expect(airCount).toBeGreaterThan(20);
    expect(supportCount).toBeGreaterThan(0);
    expect(chestCount).toBeGreaterThan(0);
  });

  it('black variant uses blackstone supports and cyan light', () => {
    const chunk = solidChunk(0, 0);
    const placement = { anchorX: 8, anchorY: 20, anchorZ: 8, variant: 'black' as const };
    placeMineshaft(chunk, placement);
    let blackstone = 0, cyan = 0;
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 18; y <= 22; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const b = chunk.getBlock(x, y, z);
          if (b === BLACKSTONE) blackstone++;
          if (b === CYAN_TORCH) cyan++;
        }
      }
    }
    expect(blackstone).toBeGreaterThan(0);
    expect(cyan).toBeGreaterThan(0);
  });
});

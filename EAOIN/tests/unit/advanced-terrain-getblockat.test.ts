/**
 * WORLD STARTUP regression — "terrain.getBlockAt is not a function".
 *
 * The engine's loading/render path (GameCanvas, CreatureManager, LogicRuntime,
 * VoxelWorldRenderer) queries voxels through `terrain.getBlockAt(x, y, z)`.
 * `AdvancedTerrainGenerator` (the stable default generator) was missing that
 * method, crashing world startup at 28% with a TypeError.
 *
 * These tests pin the exposed signature and the deterministic banded column
 * around the y = 64 surface:
 *   y > 64        → 0 (air block)
 *   y === 64      → 3 (solid surface block)
 *   60 <= y < 64  → 2 (subsurface dirt band)
 *   y < 60        → 1 (solid deep block)
 */
import { describe, it, expect } from 'vitest';
import AdvancedTerrainGenerator from '../../src/world/AdvancedTerrainGenerator';

const SEED = 'eaoin_seed_2026';

describe('AdvancedTerrainGenerator.getBlockAt', () => {
  // The banded y≈64 column documented below is the *fallback* terrain shape
  // (used when the full CavesAndCliffs pipeline is disabled), so pin it with
  // `experimentalCavesAndCliffs: false`. With the full generator on, getBlockAt
  // returns real generated voxels (verified by the world-load / worldgen
  // suites) rather than this simple analytic band.
  const terrain = new AdvancedTerrainGenerator({ seed: SEED, experimentalCavesAndCliffs: false });

  it('is exposed as a public (x, y, z) → number method', () => {
    expect(typeof terrain.getBlockAt).toBe('function');
    const id: number = terrain.getBlockAt(Math.floor(0.5), 64, Math.floor(-0.5));
    expect(Number.isInteger(id)).toBe(true);
  });

  it('returns 0 (air block) above the surface, y > 64', () => {
    expect(terrain.getBlockAt(0, 65, 0)).toBe(0);
    expect(terrain.getBlockAt(-512, 100, 512)).toBe(0);
    expect(terrain.getBlockAt(4096, 127, -4096)).toBe(0);
  });

  it('returns 3 (solid surface block) at y === 64', () => {
    expect(terrain.getBlockAt(0, 64, 0)).toBe(3);
    expect(terrain.getBlockAt(1234, 64, -987)).toBe(3);
  });

  it('returns 2 (dirt band) for 60 <= y < 64', () => {
    for (const y of [60, 61, 62, 63]) expect(terrain.getBlockAt(0, y, 0)).toBe(2);
  });

  it('returns 1 (solid deep block) below y < 60', () => {
    for (const y of [59, 32, 1, 0, -1]) expect(terrain.getBlockAt(0, y, 0)).toBe(1);
  });

  it('is deterministic for identical configs and steady across the horizontal plane', () => {
    const twin = new AdvancedTerrainGenerator({ seed: SEED, experimentalCavesAndCliffs: false });
    for (const y of [0, 59, 60, 64, 65]) {
      expect(twin.getBlockAt(777, y, -333)).toBe(terrain.getBlockAt(777, y, -333));
      expect(terrain.getBlockAt(-10000, y, 10000)).toBe(terrain.getBlockAt(10000, y, -10000));
    }
  });
});

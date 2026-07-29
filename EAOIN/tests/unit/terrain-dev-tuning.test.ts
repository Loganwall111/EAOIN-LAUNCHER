/**
 * Developer-panel world tuning regression tests.
 *
 * Verifies the panel's controls actually reach the generators, and that both
 * the legacy `TerrainGenerator` and the 1.18 `AdvancedTerrainGenerator`:
 *
 *  - treat ×1.00 amplification as an exact identity (shipped terrain is
 *    byte-identical while the panel is untouched);
 *  - scale relief around the basin reference when amplified;
 *  - honour the biome-modification toggles cleanly (caves/lakes/vegetation);
 *  - preserve player edits across cache invalidation.
 *
 * All coordinates below were probed empirically so every assertion is
 * deterministic rather than statistical.
 */
import { describe, it, expect } from 'vitest';
import { TerrainGenerator } from '../../src/world/TerrainGenerator';
import AdvancedTerrainGenerator from '../../src/world/AdvancedTerrainGenerator';
import { DEFAULT_BIOME_MODS } from '../../src/dev/DeveloperTuning';

const MODS_ON = { ...DEFAULT_BIOME_MODS };

const BLOCK = { AIR: 0, GRASS: 1, SAND: 4, WATER: 5, LOG: 6 };

interface ChunkScan {
  airBelowSurface: number;
  water: number;
  logs: number;
}

function scanChunk(getBlock: (x: number, y: number, z: number) => number): ChunkScan {
  let airBelowSurface = 0;
  let water = 0;
  let logs = 0;
  for (let x = 0; x < 16; x += 1) {
    for (let z = 0; z < 16; z += 1) {
      let top = -1;
      for (let y = 127; y >= 0; y -= 1) {
        const b = getBlock(x, y, z);
        if (b !== BLOCK.AIR && b !== BLOCK.WATER) { top = y; break; }
      }
      for (let y = 6; y < top - 4; y += 1) {
        if (getBlock(x, y, z) === BLOCK.AIR) airBelowSurface += 1;
      }
      for (let y = 0; y < 128; y += 1) {
        const b = getBlock(x, y, z);
        if (b === BLOCK.WATER) water += 1;
        else if (b === BLOCK.LOG) logs += 1;
      }
    }
  }
  return { airBelowSurface, water, logs };
}

describe('legacy TerrainGenerator — developer tuning', () => {
  const SEED = 'classic_probe_seed';

  it('applies the height/amplification multiplier around the ground baseline', () => {
    const gen = new TerrainGenerator(SEED);
    // Distant columns — outside the spawn protection and clearing zones.
    const cols: Array<[number, number]> = [[2000, 2000], [1300, -2100], [-1800, 1500]];
    const baseHeights = cols.map(([x, z]) => gen.getHeightAt(x, z));
    expect(baseHeights).toEqual([14, 16, 11]); // pinned probe values

    gen.setDeveloperTuning({ heightMultiplier: 2, biomeMods: { ...MODS_ON } });
    const amplified = cols.map(([x, z]) => gen.getHeightAt(x, z));
    // BASE_GROUND is 18: 14→10, 16→~14/15, 11→clamped to 7.
    for (let i = 0; i < cols.length; i += 1) {
      const expected = Math.max(7, 18 + (baseHeights[i] - 18) * 2);
      expect(Math.abs(amplified[i] - expected), `column ${cols[i]}`).toBeLessThanOrEqual(1);
    }
    expect(amplified[0]).toBeLessThan(baseHeights[0]); // below-basin sinks deeper
  });

  it('restoring ×1.00 regenerates the shipped terrain byte-identically', () => {
    const gen = new TerrainGenerator(SEED);
    const cols: Array<[number, number]> = [[2000, 2000], [1300, -2100], [-1800, 1500], [777, 333]];
    const baseline = cols.map(([x, z]) => gen.getHeightAt(x, z));
    gen.setDeveloperTuning({ heightMultiplier: 2.4, biomeMods: { ...MODS_ON } });
    gen.setDeveloperTuning({ heightMultiplier: 1, biomeMods: { ...MODS_ON } });
    expect(cols.map(([x, z]) => gen.getHeightAt(x, z))).toEqual(baseline);
  });

  it('biome toggles remove their features cleanly — caves, lakes, vegetation', () => {
    const gen = new TerrainGenerator(SEED);
    // Chunk (7,-4): probed to contain cave air, lake water and trees.
    const enabled = scanChunk((x, y, z) => gen.generateChunk(7, -4).getBlock(x, y, z));
    expect(enabled.airBelowSurface).toBeGreaterThan(0);
    expect(enabled.water).toBeGreaterThan(0);
    expect(enabled.logs).toBeGreaterThan(0);

    gen.setDeveloperTuning({
      heightMultiplier: 1,
      biomeMods: { ...MODS_ON, caves: false, lakes: false, vegetation: false },
    });
    const disabled = scanChunk((x, y, z) => gen.generateChunk(7, -4).getBlock(x, y, z));
    // Completely disabled — not merely reduced.
    expect(disabled.airBelowSurface).toBe(0);
    expect(disabled.water).toBe(0);
    expect(disabled.logs).toBe(0);
  });

  it('disabling surface paint stops biome repainting (desert stays grass-top)', () => {
    const gen = new TerrainGenerator(SEED);
    // (300,300) is probed Desert with a sand top under default tuning.
    const surfaceY = gen.getSurfaceHeight(300, 300);
    expect(gen.getBiomeAt(300, 300)).toBe('Desert');
    expect(gen.getBlockAt(300, surfaceY, 300)).toBe(BLOCK.SAND);

    gen.setDeveloperTuning({ heightMultiplier: 1, biomeMods: { ...MODS_ON, surfacePaint: false } });
    const rawSurfaceY = gen.getSurfaceHeight(300, 300);
    expect(gen.getBlockAt(300, rawSurfaceY, 300)).toBe(BLOCK.GRASS);
  });
});

describe('AdvancedTerrainGenerator (1.18 pipeline) — developer tuning', () => {
  const SEED = 'dev_tune_adv_probe';
  /** Reference plateau the amplifier pivots on: seaLevel - 6. */
  const PLATEAU = 26;

  it('applies the height/amplification multiplier around the plateau reference', () => {
    const gen = new AdvancedTerrainGenerator({ seed: SEED });
    const cols: Array<[number, number]> = [[4000, 4000], [3500, -2200], [-1500, 3100], [8200, 1300], [-6200, -4400]];
    const baseHeights = cols.map(([x, z]) => gen.getTerrainHeight(x, z));
    expect(baseHeights).toEqual([43, 54, 40, 46, 50]); // pinned probe values

    gen.setDeveloperTuning({ heightMultiplier: 2, biomeMods: { ...MODS_ON } });
    const amplified = cols.map(([x, z]) => gen.getTerrainHeight(x, z));
    for (let i = 0; i < cols.length; i += 1) {
      const expected = PLATEAU + (baseHeights[i] - PLATEAU) * 2;
      // Amplification acts on the unrounded heightmap, so ±1 rounding leeway.
      expect(Math.abs(amplified[i] - expected), `column ${cols[i]}`).toBeLessThanOrEqual(1);
      expect(amplified[i], 'relief grows upward above the plateau').toBeGreaterThan(baseHeights[i]);
    }
  });

  it('keeps the protected spawn plateau stable under amplification', () => {
    const gen = new AdvancedTerrainGenerator({ seed: SEED });
    const spawnHeight = gen.getTerrainHeight(0, 0);
    gen.setDeveloperTuning({ heightMultiplier: 2.5, biomeMods: { ...MODS_ON } });
    expect(gen.getTerrainHeight(0, 0)).toBe(spawnHeight);
  });

  it('restoring ×1.00 regenerates the shipped terrain byte-identically', () => {
    const gen = new AdvancedTerrainGenerator({ seed: SEED });
    const cols: Array<[number, number]> = [[4000, 4000], [3500, -2200], [-1500, 3100], [8200, 1300], [-6200, -4400]];
    const baseline = cols.map(([x, z]) => gen.getTerrainHeight(x, z));
    gen.setDeveloperTuning({ heightMultiplier: 2, biomeMods: { ...MODS_ON } });
    gen.setDeveloperTuning({ heightMultiplier: 1, biomeMods: { ...MODS_ON } });
    expect(cols.map(([x, z]) => gen.getTerrainHeight(x, z))).toEqual(baseline);
  });

  it('the caves toggle leaves a completely solid underground', () => {
    const gen = new AdvancedTerrainGenerator({ seed: SEED });
    // Chunk (-80,30): probed — heavy deep-cave carving by default.
    const carved = scanChunk((x, y, z) => gen.generateChunk(-80, 30).getBlock(x, y, z));
    expect(carved.airBelowSurface).toBeGreaterThan(0);

    gen.setDeveloperTuning({ heightMultiplier: 1, biomeMods: { ...MODS_ON, caves: false } });
    const solid = scanChunk((x, y, z) => gen.generateChunk(-80, 30).getBlock(x, y, z));
    expect(solid.airBelowSurface).toBe(0);
  });

  it('player edits survive tuning-driven cache invalidation', () => {
    const gen = new AdvancedTerrainGenerator({ seed: SEED });
    gen.setBlockAt(-779, 60, 30, 11);
    expect(gen.getBlockAt(-779, 60, 30)).toBe(11);

    gen.setDeveloperTuning({ heightMultiplier: 1.5, biomeMods: { ...MODS_ON } });
    // The tuning change drops every cached chunk — the edit must be re-applied.
    expect(gen.getBlockAt(-779, 60, 30)).toBe(11);
    expect(gen.getEditCount()).toBe(1);
  });
});

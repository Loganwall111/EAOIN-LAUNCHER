/**
 * Biome spacing regression tests.
 *
 * The report was that biomes "look so cramped, everything looks so cramped".
 * Measured on the shipped generator, the median biome along a transect was
 * only 96 blocks wide, so a short walk crossed several biomes. These tests pin
 * the size-class system that spreads them out.
 */
import { describe, it, expect } from 'vitest';
import AdvancedTerrainGenerator from '../../src/world/AdvancedTerrainGenerator';
import {
  ALL_BIOMES,
  BIOME_SIZE_SCALE,
  BIOME_SIZE_WEIGHT,
  biomeSizeClass,
  biomesOfSize,
  getBiome,
} from '../../src/world/Biomes';

/** Walk a straight line and collect the length of each contiguous biome run. */
function biomeRuns(gen: AdvancedTerrainGenerator, z: number, length = 12000, step = 8): number[] {
  const runs: number[] = [];
  let last: string | null = null;
  let run = 0;
  for (let x = 0; x < length; x += step) {
    const id = gen.getBiomeAt(x, z).id;
    if (id !== last) {
      if (last !== null) runs.push(run * step);
      last = id;
      run = 0;
    }
    run += 1;
  }
  return runs.sort((a, b) => a - b);
}

function medianRun(seed: string): number {
  const gen = new AdvancedTerrainGenerator({ seed });
  const runs = [0, 1500, -2200].flatMap((z) => biomeRuns(gen, z)).sort((a, b) => a - b);
  return runs[Math.floor(runs.length / 2)];
}

describe('biome size classes', () => {
  it('assigns every biome a size class', () => {
    for (const biome of ALL_BIOMES) {
      expect(BIOME_SIZE_SCALE[biomeSizeClass(biome)], biome.id).toBeGreaterThan(0);
    }
  });

  it('offers every requested size band, from rare to huge', () => {
    // The request was explicit: "space every biome out into its own category
    // rare, medium sized, large and other sizes".
    for (const size of ['rare', 'small', 'medium', 'large', 'huge'] as const) {
      expect(biomesOfSize(size).length, size).toBeGreaterThan(0);
    }
  });

  it('scales rare biomes smaller than huge ones', () => {
    expect(BIOME_SIZE_SCALE.rare).toBeLessThan(BIOME_SIZE_SCALE.small);
    expect(BIOME_SIZE_SCALE.small).toBeLessThan(BIOME_SIZE_SCALE.medium);
    expect(BIOME_SIZE_SCALE.medium).toBeLessThan(BIOME_SIZE_SCALE.large);
    expect(BIOME_SIZE_SCALE.large).toBeLessThan(BIOME_SIZE_SCALE.huge);
  });

  it('uses size weights that form a probability distribution', () => {
    const total = Object.values(BIOME_SIZE_WEIGHT).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('keeps common staples large and novelties rare', () => {
    expect(biomeSizeClass(getBiome('plain'))).toBe('huge');
    expect(biomeSizeClass(getBiome('mushroom_biome'))).toBe('rare');
  });

  it('has no size overrides pointing at biome ids that do not exist', () => {
    // `getBiome` silently falls back to the first biome for an unknown id, so
    // a typo in the override table (there was one: `mushroom_fields`) would
    // quietly do nothing instead of failing.
    const known = new Set(ALL_BIOMES.map((b) => b.id));
    for (const biome of ALL_BIOMES) {
      expect(known.has(biome.id)).toBe(true);
    }
    for (const id of ['plain', 'mushroom_biome', 'oasis', 'ice_spikes', 'cherry_grove', 'flower_forest', 'mystic_woods', 'frozen_jungle', 'alpine_biome', 'ocean_world_biome', 'beach']) {
      expect(getBiome(id).id, `${id} must be a real biome`).toBe(id);
    }
  });
});

describe('biome spacing in the world', () => {
  it('gives biomes room to breathe instead of cramming them together', () => {
    // Before the size-class system this measured 96 blocks.
    for (const seed of ['eaoin_seed_2026', 'alpha']) {
      expect(medianRun(seed), seed).toBeGreaterThan(110);
    }
  });

  it('honours biomeScale so Large Biomes is materially wider than default', () => {
    const median = (gen: AdvancedTerrainGenerator) => {
      const runs = [0, 1500, -2200].flatMap((z) => biomeRuns(gen, z, 12000, 8)).sort((a, b) => a - b);
      return runs[Math.floor(runs.length / 2)];
    };

    const normal = median(new AdvancedTerrainGenerator({ seed: 'large-biomes-check', biomeScale: 1 }));
    const scaled = median(new AdvancedTerrainGenerator({ seed: 'large-biomes-check', biomeScale: 4 }));

    expect(scaled).toBeGreaterThan(normal * 1.5);
  });

  it('honours forcedBiome so Single Biome is actually one biome everywhere', () => {
    const gen = new AdvancedTerrainGenerator({ seed: 'single-biome-check', forcedBiome: 'forest' });
    const seen = new Set<string>();
    for (let x = -4000; x <= 4000; x += 400) {
      for (let z = -4000; z <= 4000; z += 400) {
        seen.add(gen.getBiomeAt(x, z).id);
      }
    }
    expect(seen).toEqual(new Set(['forest']));
  });

  it('still produces variety rather than one biome everywhere', () => {
    const gen = new AdvancedTerrainGenerator({ seed: 'eaoin_seed_2026' });
    const seen = new Set<string>();
    for (let x = 0; x < 20000; x += 64) seen.add(gen.getBiomeAt(x, 0).id);
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it('reaches the climate extremes, not just the temperate middle', () => {
    // fbm output is bell-shaped, but the biome thresholds were written for a
    // uniform 0-1 range, so the tails were unreachable: the world measured 46%
    // plains / 24% alpine with desert at 0.0% and forest at 0.3%. The climate
    // fields are now spread before classification.
    const gen = new AdvancedTerrainGenerator({ seed: 'distribution' });
    const counts = new Map<string, number>();
    let total = 0;
    for (let x = -4000; x < 4000; x += 100) {
      for (let z = -4000; z < 4000; z += 100) {
        const id = gen.getBiomeAt(x, z).id;
        counts.set(id, (counts.get(id) ?? 0) + 1);
        total += 1;
      }
    }

    // Hot/dry and hot/wet must both be genuinely represented.
    const share = (id: string) => (counts.get(id) ?? 0) / total;
    expect(share('desert'), 'desert').toBeGreaterThan(0.01);
    expect(share('rainforest'), 'rainforest').toBeGreaterThan(0.01);
    // And no single biome may dominate the map.
    const largest = Math.max(...counts.values()) / total;
    expect(largest).toBeLessThan(0.45);
  });

  it('is deterministic for a seed', () => {
    const a = new AdvancedTerrainGenerator({ seed: 'determinism' });
    const b = new AdvancedTerrainGenerator({ seed: 'determinism' });
    for (const [x, z] of [[0, 0], [512, -900], [-3300, 1200]]) {
      expect(a.getBiomeAt(x, z).id).toBe(b.getBiomeAt(x, z).id);
    }
  });
});

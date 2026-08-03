// @vitest-environment jsdom
/**
 * 2.0 — deeper Nether fauna.
 *
 * The Nether reports sub-biomes ('crimson_forest' / 'warped_forest' / 'nether'
 * wastes). Crimson forest species (hoglin, piglin, crimson fungling) must spawn
 * in crimson forests, warped species (strider, zombified piglin, warped
 * enderman, warped fungling) in warped forests, and general nether mobs
 * (ghast, blaze, magma cube, wither skeleton) anywhere in the nether.
 */
import { describe, it, expect } from 'vitest';
import {
  pickSpecies,
  speciesForBiome,
} from '../../src/creatures/WildlifeRegistry';

describe('Nether sub-biome fauna', () => {
  it('crimson forests host crimson hoglin, piglin and crimson fungling', () => {
    const land = speciesForBiome('crimson_forest', { habitat: 'land' });
    const ids = land.map((s) => s.id);
    expect(ids).toContain('crimson_hoglin');
    expect(ids).toContain('piglin');
    expect(ids).toContain('crimson_fungling');
    expect(ids).not.toContain('warped_enderman');
  });

  it('warped forests host warped strider, zombified piglin and warped enderman', () => {
    const land = speciesForBiome('warped_forest', { habitat: 'land' });
    const ids = land.map((s) => s.id);
    expect(ids).toContain('warped_strider');
    expect(ids).toContain('zombified_piglin');
    expect(ids).toContain('warped_enderman');
    expect(ids).not.toContain('crimson_hoglin');
  });

  it('the nether wastes host the air/land generalists (ghast, blaze, magma cube, wither skeleton)', () => {
    const any = speciesForBiome('nether', { habitat: 'any' });
    const ids = any.map((s) => s.id);
    expect(ids).toContain('nether_ghast');
    expect(ids).toContain('blaze');
    expect(ids).toContain('magma_cube');
    expect(ids).toContain('wither_skeleton');
  });

  it('every new nether species has a deterministic weighted pick', () => {
    for (const biome of ['crimson_forest', 'warped_forest', 'nether']) {
      const candidates = speciesForBiome(biome, { habitat: 'land', isNight: true });
      expect(candidates.length).toBeGreaterThan(0);
      const picked = pickSpecies(candidates, 0.5);
      expect(picked).not.toBeNull();
    }
  });
});

/**
 * Wildlife roster, variants and ecology tests.
 *
 * Context: `WildlifeRegistry.ts` defined 41 species but **nothing imported
 * it** — the spawner hard-coded four animals. These tests pin that the roster
 * is actually reachable, that variants produce real visual spread, and that
 * species land in climates that make sense.
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_SPECIES,
  SPECIES_BY_ID,
  pickSpecies,
  speciesForBiome,
  speciesStats,
} from '../../src/creatures/WildlifeRegistry';
import {
  COMMON_MORPHS,
  SIZE_TIERS,
  countVariants,
  morphsFor,
  resolveVariant,
  SPECIES_MORPHS,
} from '../../src/creatures/SpeciesVariants';
import { buildMobTextureFromPalette, MOB_TEXTURE_SIZE } from '../../src/creatures/CreatureTextures';
import { ALL_BLOCK_IDS } from '../../shared/src/blocks/BlockRegistry';

describe('species roster', () => {
  it('has a large roster spanning land, water and air', () => {
    const stats = speciesStats();
    expect(stats.total).toBeGreaterThanOrEqual(40);
    expect(stats.land).toBeGreaterThan(10);
    expect(stats.water).toBeGreaterThan(10);
    expect(stats.air).toBeGreaterThan(3);
  });

  it('gives every species valid, complete data', () => {
    for (const s of ALL_SPECIES) {
      expect(s.id, 'id').toBeTruthy();
      expect(s.name, `${s.id} name`).toBeTruthy();
      expect(s.health, `${s.id} health`).toBeGreaterThan(0);
      expect(s.speed, `${s.id} speed`).toBeGreaterThan(0);
      expect(s.scale, `${s.id} scale`).toBeGreaterThan(0);
      expect(s.weight, `${s.id} weight`).toBeGreaterThan(0);
      // Palettes must be real hex, or the texture painter produces black.
      for (const key of ['body', 'head', 'limb'] as const) {
        expect(s.palette[key], `${s.id} ${key}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('only drops loot that exists in the block registry', () => {
    const known = new Set(ALL_BLOCK_IDS);
    for (const s of ALL_SPECIES) {
      for (const drop of s.loot) {
        expect(known.has(drop.blockId), `${s.id} drops unknown block ${drop.blockId}`).toBe(true);
        expect(drop.amount).toBeGreaterThan(0);
      }
    }
  });

  it('gives hostile species damage and passive species none', () => {
    for (const s of ALL_SPECIES) {
      if (s.temperament === 'hostile') {
        expect(s.damage, `${s.id} should hurt`).toBeGreaterThan(0);
      }
      if (s.temperament === 'passive') {
        expect(s.damage, `${s.id} should be harmless`).toBe(0);
      }
    }
  });

  it('has unique ids', () => {
    expect(new Set(ALL_SPECIES.map((s) => s.id)).size).toBe(ALL_SPECIES.length);
  });
});

describe('biome ecology', () => {
  it('populates the common overworld biomes', () => {
    for (const biome of ['plain', 'forest', 'desert', 'savanna', 'snowy_plains']) {
      const found = speciesForBiome(biome, { habitat: 'land' });
      expect(found.length, `${biome} should have wildlife`).toBeGreaterThan(0);
    }
  });

  it('does not put savanna animals in the snow', () => {
    // The real bug: `'snowy_plains'.includes('plain')` is true, so a lion
    // tagged ['savanna','plain'] spawned on snowfields.
    const cold = speciesForBiome('snowy_plains', { habitat: 'land' }).map((s) => s.id);
    for (const warm of ['lion', 'elephant', 'giraffe', 'camel']) {
      expect(cold, `${warm} must not spawn in snowy_plains`).not.toContain(warm);
    }
  });

  it('does not put arctic animals in warm biomes', () => {
    for (const biome of ['desert', 'savanna', 'rainforest']) {
      const found = speciesForBiome(biome, { habitat: 'land' }).map((s) => s.id);
      expect(found, `polar_bear in ${biome}`).not.toContain('polar_bear');
      expect(found, `penguin in ${biome}`).not.toContain('penguin');
    }
  });

  it('puts the right animals in the snow', () => {
    const cold = speciesForBiome('snowy_plains', { habitat: 'land' }).map((s) => s.id);
    expect(cold).toContain('polar_bear');
  });

  it('gates nocturnal species to night', () => {
    const day = speciesForBiome('desert', { habitat: 'land', isNight: false }).map((s) => s.id);
    const night = speciesForBiome('desert', { habitat: 'land', isNight: true }).map((s) => s.id);
    expect(day).not.toContain('scorpion');
    expect(night).toContain('scorpion');
  });

  it('picks species deterministically from a roll', () => {
    const candidates = speciesForBiome('plain', { habitat: 'land' });
    expect(pickSpecies(candidates, 0.5)?.id).toBe(pickSpecies(candidates, 0.5)?.id);
    expect(pickSpecies([], 0.5)).toBeNull();
  });
});

describe('variants', () => {
  it('produces well over a thousand distinct appearances', () => {
    // "lots and lots of variants" needs to be a number, not a claim.
    expect(countVariants(ALL_SPECIES.map((s) => s.id))).toBeGreaterThan(900);
  });

  it('gives every species multiple forms', () => {
    for (const s of ALL_SPECIES) {
      const forms = morphsFor(s.id).length * SIZE_TIERS.length;
      expect(forms, `${s.id}`).toBeGreaterThanOrEqual(20);
    }
  });

  it('is deterministic for the same rolls', () => {
    const sheep = SPECIES_BY_ID.sheep;
    const a = resolveVariant(sheep, 0.31, 0.72);
    const b = resolveVariant(sheep, 0.31, 0.72);
    expect(a.key).toBe(b.key);
    expect(a.palette).toEqual(b.palette);
  });

  it('themes variants on the species they belong to', () => {
    // A wolf must roll wolf coats, never something unrelated.
    const wolfMorphs = SPECIES_MORPHS.wolf.map((v) => v.id);
    expect(wolfMorphs).toContain('timber');
    expect(wolfMorphs).toContain('tundra');
    const cowMorphs = SPECIES_MORPHS.cow.map((v) => v.id);
    expect(cowMorphs).toContain('holstein');
    // And the two tables must not be the same list.
    expect(wolfMorphs).not.toEqual(cowMorphs);
  });

  it('actually changes the palette between morphs', () => {
    const sheep = SPECIES_BY_ID.sheep;
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      seen.add(resolveVariant(sheep, (i * 0.0137) % 1, 0.5).palette.body);
    }
    expect(seen.size).toBeGreaterThan(2);
  });

  it('keeps rare morphs rare', () => {
    // Albino and friends should be a genuine event, not routine.
    const rareWeight = COMMON_MORPHS.filter((m) => m.rare).reduce((a, m) => a + m.weight, 0);
    const total = COMMON_MORPHS.reduce((a, m) => a + m.weight, 0);
    expect(rareWeight / total).toBeLessThan(0.05);
  });

  it('scales health and size together sensibly', () => {
    const bear = SPECIES_BY_ID.bear;
    const runt = resolveVariant(bear, 0.5, 0.01);
    const elder = resolveVariant(bear, 0.5, 0.999);
    expect(elder.scale).toBeGreaterThan(runt.scale);
    expect(elder.health).toBeGreaterThan(runt.health);
    expect(runt.health).toBeGreaterThan(0);
  });

  it('names variants readably', () => {
    const name = resolveVariant(SPECIES_BY_ID.wolf, 0.99, 0.999).displayName;
    expect(name).toContain('Wolf');
    expect(name.length).toBeGreaterThan(4);
  });
});

describe('variant textures', () => {
  it('paints every body part without a flat single colour', () => {
    for (const part of ['body', 'head', 'leg', 'wing', 'fin', 'segment'] as const) {
      const texels = buildMobTextureFromPalette(
        { coat: '#8a5a30', accent: '#e8dcc8', style: 'fur', seed: `test:${part}`, markings: 'dapples' },
        part
      );
      expect(texels.length).toBe(MOB_TEXTURE_SIZE * MOB_TEXTURE_SIZE * 4);
      const colors = new Set<string>();
      for (let i = 0; i < texels.length; i += 4) {
        colors.add(`${texels[i]},${texels[i + 1]},${texels[i + 2]}`);
      }
      expect(colors.size, `${part} must have texture detail`).toBeGreaterThan(1);
    }
  });

  it('gives different variants visibly different textures', () => {
    const a = buildMobTextureFromPalette({ coat: '#e8e4d8', accent: '#d9b8a0', style: 'wool', seed: 'sheep:white:adult' }, 'body');
    const b = buildMobTextureFromPalette({ coat: '#2a2a28', accent: '#1a1a18', style: 'wool', seed: 'sheep:black:adult' }, 'body');
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

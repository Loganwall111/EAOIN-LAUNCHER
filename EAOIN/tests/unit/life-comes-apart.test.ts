/**
 * Regression tests for the "Life Comes Apart 2.0" systems.
 */
import { describe, it, expect } from 'vitest';
import { getSkyProfileForBiome, getSkyProfileForDimension, lerpSkyProfile, FOG_LOW, FOG_HEAVY } from '../../src/sky/SkyProfiles';
import { climateForBiome, createStarterHydration, drink, updateHydration, MAX_HYDRATION } from '../../src/player/Hydration';
import { speciesForBiome, pickSpecies, ALL_SPECIES, speciesStats } from '../../src/creatures/WildlifeRegistry';
import { WORLD_TYPES, seedForWorldType, worldTypeFromSeed, baseSeed, isLegacySkyWorldSeed } from '../../src/world/WorldTypes';
import { oceanStateForDepth, waveHeightAt, whirlpoolForce, zoneForDepth } from '../../src/world/OceanSystem';
import { Vector3 } from '@babylonjs/core';
import { createChipState, acquireChip, implantChip, usePower, resolveSnap, REALITY_POWERS } from '../../src/space/RealityChip';
import { ambienceForBiome } from '../../src/audio/AmbienceEngine';
import { runCommand } from '../../src/commands/CommandRuntime';
import { createDefaultSettings } from '../../src/settings/GameSettings';

describe('sky profiles', () => {
  it('keeps fog low by default and heavy only where intended', () => {
    // The brief: "the fog should be low not too high only swamps and other
    // areas it should be a bit higher".
    expect(getSkyProfileForBiome('plains').fogDensity).toBeLessThanOrEqual(FOG_LOW);
    expect(getSkyProfileForBiome('swamp').fogDensity).toBeGreaterThanOrEqual(FOG_HEAVY);
    expect(getSkyProfileForBiome('swamp').fogDensity)
      .toBeGreaterThan(getSkyProfileForBiome('plains').fogDensity * 4);
  });

  it('gives deserts a sandstorm and mountains a snowstorm', () => {
    expect(getSkyProfileForBiome('desert').weather).toBe('sandstorm');
    expect(getSkyProfileForBiome('mountain').weather).toBe('snowstorm');
    expect(getSkyProfileForBiome('snow').weather).toBe('snowstorm');
  });

  it('puts fireflies in swamps', () => {
    expect(getSkyProfileForBiome('swamp').weather).toBe('fireflies');
  });

  it('makes the desert sky brighter than temperate biomes', () => {
    // "the sky get so bright ... that you have to drink water to survive"
    expect(getSkyProfileForBiome('desert').ambientScale)
      .toBeGreaterThan(getSkyProfileForBiome('forest').ambientScale);
  });

  it('gives polar biomes the strongest aurora', () => {
    expect(getSkyProfileForBiome('snow').auroraStrength).toBe(1);
    expect(getSkyProfileForBiome('desert').auroraStrength).toBe(0);
  });

  it('resolves unknown biomes to a sane fallback instead of blanking', () => {
    const p = getSkyProfileForBiome('some_biome_that_does_not_exist');
    expect(p).toBeTruthy();
    expect(p.fogDensity).toBeGreaterThanOrEqual(0);
  });

  it('resolves every dimension to its own profile', () => {
    expect(getSkyProfileForDimension('nether').id).toBe('nether');
    expect(getSkyProfileForDimension('end').hasSun).toBe(false);
    expect(getSkyProfileForDimension('moon').showDeepSpace).toBe(true);
  });

  it('blends smoothly between profiles', () => {
    const a = getSkyProfileForBiome('plains');
    const b = getSkyProfileForBiome('swamp');
    const mid = lerpSkyProfile(a, b, 0.5);
    expect(mid.fogDensity).toBeGreaterThan(a.fogDensity);
    expect(mid.fogDensity).toBeLessThan(b.fogDensity);
  });
});

describe('hydration', () => {
  it('drains far faster in the desert than in a forest', () => {
    const base = createStarterHydration();
    const input = { deltaSeconds: 1, moving: true, sunExposure: 1 } as const;
    const desert = updateHydration(base, { ...input, climate: 'scorching' });
    const forest = updateHydration(base, { ...input, climate: 'temperate' });
    expect(desert.hydration).toBeLessThan(forest.hydration);
  });

  it('damages the player once fully parched', () => {
    const parched = { hydration: 0, parchedSeconds: 4 };
    const tick = updateHydration(parched, {
      deltaSeconds: 1, climate: 'scorching', moving: false, sunExposure: 1,
    });
    expect(tick.damage).toBeGreaterThan(0);
  });

  it('refills from water and never exceeds the cap', () => {
    const { state } = drink({ hydration: 90, parchedSeconds: 0 }, 50);
    expect(state.hydration).toBe(MAX_HYDRATION);
  });

  it('classifies desert biomes as scorching and snow as freezing', () => {
    expect(climateForBiome('desert')).toBe('scorching');
    expect(climateForBiome('badlands')).toBe('scorching');
    expect(climateForBiome('snowy_taiga')).toBe('freezing');
  });

  it('standing in water rehydrates you', () => {
    const tick = updateHydration({ hydration: 40, parchedSeconds: 0 }, {
      deltaSeconds: 1, climate: 'scorching', moving: false, sunExposure: 1, inWater: true,
    });
    expect(tick.hydration).toBeGreaterThan(40);
  });
});

describe('wildlife registry', () => {
  it('includes real-world land, ocean and air animals', () => {
    const ids = ALL_SPECIES.map((s) => s.id);
    for (const id of ['snake_check', 'rattlesnake', 'shark', 'whale', 'eagle', 'camel', 'elephant']) {
      if (id === 'snake_check') continue;
      expect(ids, `missing ${id}`).toContain(id);
    }
    const stats = speciesStats();
    expect(stats.total).toBeGreaterThan(30);
    expect(stats.water).toBeGreaterThan(8);
    expect(stats.air).toBeGreaterThan(3);
  });

  it('spawns snakes in deserts and sharks in oceans', () => {
    const desert = speciesForBiome('desert').map((s) => s.id);
    expect(desert).toContain('rattlesnake');
    const ocean = speciesForBiome('deep_ocean', { habitat: 'water' }).map((s) => s.id);
    expect(ocean).toContain('shark');
  });

  it('gates nocturnal species to night', () => {
    const day = speciesForBiome('cave', { isNight: false }).map((s) => s.id);
    const night = speciesForBiome('cave', { isNight: true }).map((s) => s.id);
    expect(day).not.toContain('bat');
    expect(night).toContain('bat');
  });

  it('picks deterministically from a weighted list', () => {
    const candidates = speciesForBiome('plains');
    expect(pickSpecies(candidates, 0.5)).not.toBeNull();
    expect(pickSpecies([], 0.5)).toBeNull();
  });
});

describe('world types', () => {
  it('offers flat, skylands, far lands and sub-bedrock', () => {
    const ids = WORLD_TYPES.map((t) => t.id);
    expect(ids).toContain('flat');
    expect(ids).toContain('skylands');
    expect(ids).toContain('far_lands');
    expect(ids).toContain('sub_bedrock');
  });

  it('round-trips the type through the seed', () => {
    const tagged = seedForWorldType('mySeed', 'far_lands');
    expect(worldTypeFromSeed(tagged)).toBe('far_lands');
    expect(baseSeed(tagged)).toBe('mySeed');
  });

  it('leaves default seeds untagged and still resolvable', () => {
    const seed = seedForWorldType('plain', 'default');
    expect(seed).toBe('plain');
    expect(worldTypeFromSeed(seed)).toBe('default');
  });

  it('does not mistake amplified worlds for skylands', () => {
    expect(worldTypeFromSeed('amplified__mySeed')).toBe('amplified');
    expect(isLegacySkyWorldSeed('amplified__mySeed')).toBe(false);
    expect(isLegacySkyWorldSeed('skylands__mySeed')).toBe(true);
    expect(isLegacySkyWorldSeed('floating_islands_old_seed')).toBe(true);
  });
});

describe('ocean system', () => {
  it('gets darker and foggier with depth', () => {
    const shallow = oceanStateForDepth(2, true);
    const deep = oceanStateForDepth(60, true);
    expect(deep.light).toBeLessThan(shallow.light);
    expect(deep.fogDensity).toBeGreaterThan(shallow.fogDensity);
    expect(deep.plankton).toBeGreaterThan(shallow.plankton);
  });

  it('names the depth zones', () => {
    expect(zoneForDepth(0).id).toBe('surface');
    expect(zoneForDepth(50).id).toBe('abyss');
    expect(zoneForDepth(200).id).toBe('trench');
  });

  it('produces a non-repeating wave surface', () => {
    const a = waveHeightAt(0, 0, 0);
    const b = waveHeightAt(0, 0, 3.1);
    expect(a).not.toBeCloseTo(b, 3);
  });

  it('whirlpools pull inward and downward', () => {
    const pool = { center: new Vector3(0, 18, 0), radius: 20, strength: 8 };
    const force = whirlpoolForce(pool, new Vector3(6, 18, 0));
    // Downward suck plus a tangential swirl.
    expect(force.y).toBeLessThan(0);
    expect(force.length()).toBeGreaterThan(0);
    // Outside the radius there should be no force at all.
    expect(whirlpoolForce(pool, new Vector3(80, 18, 0)).length()).toBe(0);
  });
});

describe('reality chip', () => {
  it('must be acquired then implanted before powers work', () => {
    let state = createChipState();
    expect(usePower(state, 'snap').ok).toBe(false);
    state = acquireChip(state).state;
    state = implantChip(state).state;
    expect(state.implanted).toBe(true);
    expect(usePower(state, 'snap').ok).toBe(true);
  });

  it('enforces cooldowns', () => {
    let state = implantChip(acquireChip(createChipState()).state).state;
    const first = usePower(state, 'teleport');
    expect(first.ok).toBe(true);
    const second = usePower(first.state, 'teleport');
    expect(second.ok).toBe(false);
  });

  it('grants every power in the game', () => {
    expect(REALITY_POWERS.length).toBeGreaterThanOrEqual(12);
    expect(REALITY_POWERS.map((p) => p.id)).toContain('snap');
  });

  it('snaps away half of reality by default', () => {
    expect(resolveSnap(100)).toBe(50);
    expect(resolveSnap(100, 1)).toBe(100);
  });
});

describe('ambience routing', () => {
  it('maps biomes and dimensions onto distinct soundscapes', () => {
    expect(ambienceForBiome('swamp')).toBe('swamp');
    expect(ambienceForBiome('nether_wastes')).toBe('nether');
    expect(ambienceForBiome('deep_ocean', { underwater: true })).toBe('underwater');
    expect(ambienceForBiome('snowy_taiga')).toBe('snow');
  });
});

describe('/gamemode command', () => {
  const base = { settings: createDefaultSettings(), time: { timeOfDay: 12, frozen: false }, lastMessage: '' };

  it('switches to creative so the creative inventory becomes reachable', () => {
    const result = runCommand('/gamemode creative', base);
    expect(result.ok).toBe(true);
    expect(result.gameModeChange).toBe('creative');
  });

  it('accepts Minecraft-style numeric and shorthand aliases', () => {
    expect(runCommand('/gamemode 1', base).gameModeChange).toBe('creative');
    expect(runCommand('/gamemode 0', base).gameModeChange).toBe('survival');
    expect(runCommand('/gmc', base).gameModeChange).toBe('creative');
  });

  it('rejects an unknown mode', () => {
    expect(runCommand('/gamemode banana', base).ok).toBe(false);
  });
});

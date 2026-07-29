/**
 * Developer tuning store regression tests — the bridge between the dev panel
 * sliders and the 1.18 terrain-noise variables, world clock and lighting rig.
 */
import { describe, it, expect } from 'vitest';
import { NullEngine, Scene } from '@babylonjs/core';
import {
  applyDeveloperTuningToTerrain,
  applyLightingPresetToScene,
  clampDeveloperTuning,
  DEFAULT_BIOME_MODS,
  DEFAULT_DEVELOPER_TUNING,
  DeveloperTuningStore,
  DevTunableTerrain,
  DAY_NIGHT_SPEED_MAX,
  DAY_NIGHT_SPEED_MIN,
  effectiveDayLengthSeconds,
  getLightingPreset,
  isDevTunableTerrain,
  LIGHTING_PRESETS,
  TERRAIN_AMPLIFICATION_MAX,
  TERRAIN_AMPLIFICATION_MIN,
  worldClockRatePerSecond,
  worldgenSignature,
} from '../../src/dev/DeveloperTuning';

const BASE_DAY_SECONDS = 1200; // the shipped 20-minute day

function tuning(overrides: Partial<typeof DEFAULT_DEVELOPER_TUNING> = {}) {
  return { ...DEFAULT_DEVELOPER_TUNING, ...overrides, biomeMods: { ...DEFAULT_BIOME_MODS, ...(overrides.biomeMods ?? {}) } };
}

describe('clampDeveloperTuning', () => {
  it('passes the default through untouched', () => {
    expect(clampDeveloperTuning({ ...DEFAULT_DEVELOPER_TUNING })).toEqual({
      ...DEFAULT_DEVELOPER_TUNING,
      biomeMods: { ...DEFAULT_BIOME_MODS },
    });
  });

  it('clamps terrain amplification to 0.25–3', () => {
    expect(clampDeveloperTuning(tuning({ terrainAmplification: 99 })).terrainAmplification).toBe(TERRAIN_AMPLIFICATION_MAX);
    expect(clampDeveloperTuning(tuning({ terrainAmplification: 0 })).terrainAmplification).toBe(TERRAIN_AMPLIFICATION_MIN);
    expect(clampDeveloperTuning(tuning({ terrainAmplification: NaN })).terrainAmplification).toBe(1);
    expect(clampDeveloperTuning(tuning({ terrainAmplification: Infinity })).terrainAmplification).toBe(1);
  });

  it('clamps day/night speed to 0.25–8', () => {
    expect(clampDeveloperTuning(tuning({ dayNightSpeed: 100 })).dayNightSpeed).toBe(DAY_NIGHT_SPEED_MAX);
    expect(clampDeveloperTuning(tuning({ dayNightSpeed: -3 })).dayNightSpeed).toBe(DAY_NIGHT_SPEED_MIN);
    expect(clampDeveloperTuning(tuning({ dayNightSpeed: NaN })).dayNightSpeed).toBe(1);
  });

  it('falls back to the vanilla preset for unknown ids', () => {
    expect(clampDeveloperTuning(tuning({ lightingPreset: 'rtx_ultra' as never })).lightingPreset).toBe('vanilla');
  });

  it('merges partial biome mods over the defaults', () => {
    const clamped = clampDeveloperTuning(tuning({ biomeMods: { caves: false } as never }));
    expect(clamped.biomeMods.caves).toBe(false);
    expect(clamped.biomeMods.lakes).toBe(true);
    expect(clamped.biomeMods.ores).toBe(true);
  });
});

describe('world clock math', () => {
  it('keeps the shipped 20-minute day at 1× speed — day length and 0.02 rate', () => {
    const t = tuning({ dayNightSpeed: 1 });
    expect(effectiveDayLengthSeconds(t, BASE_DAY_SECONDS)).toBe(1200);
    expect(worldClockRatePerSecond(t, BASE_DAY_SECONDS)).toBeCloseTo(0.02, 10);
  });

  it('halves the cycle at 2× speed and doubles the clock rate', () => {
    const t = tuning({ dayNightSpeed: 2 });
    expect(effectiveDayLengthSeconds(t, BASE_DAY_SECONDS)).toBe(600);
    expect(worldClockRatePerSecond(t, BASE_DAY_SECONDS)).toBeCloseTo(0.04, 10);
  });

  it('stretches the cycle at 0.25× speed', () => {
    const t = tuning({ dayNightSpeed: 0.25 });
    expect(effectiveDayLengthSeconds(t, BASE_DAY_SECONDS)).toBe(4800);
  });
});

describe('lighting presets', () => {
  it('every preset id resolves to its parameters', () => {
    for (const preset of LIGHTING_PRESETS) {
      expect(getLightingPreset(preset.id).id).toBe(preset.id);
    }
  });

  it('unknown ids fall back to vanilla', () => {
    expect(getLightingPreset('nope' as never).id).toBe('vanilla');
  });

  it('vanilla is an exact identity preset (exposure/contrast/fog = 1)', () => {
    const vanilla = getLightingPreset('vanilla');
    expect(vanilla.exposure).toBe(1);
    expect(vanilla.contrast).toBe(1);
    expect(vanilla.fogDensityScale).toBe(1);
  });

  it('applies exposure and contrast to a live scene', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.fogDensity = 0.01;

    const preset = applyLightingPresetToScene(scene, 'overcast');
    expect(scene.imageProcessingConfiguration.exposure).toBeCloseTo(preset.exposure, 5);
    expect(scene.imageProcessingConfiguration.contrast).toBeCloseTo(preset.contrast, 5);
    expect(scene.fogDensity).toBeCloseTo(0.01 * preset.fogDensityScale, 6);
    scene.dispose();
    engine.dispose();
  });
});

describe('worldgenSignature', () => {
  it('changes when terrain-relevant tuning changes', () => {
    const base = worldgenSignature(tuning());
    expect(worldgenSignature(tuning({ terrainAmplification: 2 }))).not.toBe(base);
    expect(worldgenSignature(tuning({ biomeMods: { ...DEFAULT_BIOME_MODS, caves: false } }))).not.toBe(base);
  });

  it('is stable across lighting/clock-only edits (no pointless regen)', () => {
    const base = worldgenSignature(tuning());
    expect(worldgenSignature(tuning({ lightingPreset: 'midnight' }))).toBe(base);
    expect(worldgenSignature(tuning({ dayNightSpeed: 4 }))).toBe(base);
    expect(worldgenSignature(tuning({ timeFrozen: true }))).toBe(base);
  });
});

describe('DevTunableTerrain bridge', () => {
  it('detects the contract', () => {
    const tunable: DevTunableTerrain = {
      setDeveloperTuning: () => {},
      invalidateGeneratedChunks: () => {},
    };
    expect(isDevTunableTerrain(tunable)).toBe(true);
    expect(isDevTunableTerrain({})).toBe(false);
    expect(isDevTunableTerrain(null)).toBe(false);
    expect(isDevTunableTerrain('terrain')).toBe(false);
    expect(isDevTunableTerrain({ setDeveloperTuning: () => {} })).toBe(false);
  });

  it('feeds the tuning snapshot into a generator', () => {
    const received: Array<{ heightMultiplier: number; biomeMods: Record<string, boolean> }> = [];
    const fake: DevTunableTerrain = {
      setDeveloperTuning: (t) => received.push(t as never),
      invalidateGeneratedChunks: () => {},
    };
    const ok = applyDeveloperTuningToTerrain(fake, tuning({ terrainAmplification: 1.7, biomeMods: { ...DEFAULT_BIOME_MODS, lakes: false } }));
    expect(ok).toBe(true);
    expect(received.length).toBe(1);
    expect(received[0].heightMultiplier).toBe(1.7);
    expect(received[0].biomeMods.lakes).toBe(false);
    expect(received[0].biomeMods.caves).toBe(true);
  });

  it('returns false for generators without the dev contract', () => {
    expect(applyDeveloperTuningToTerrain({}, tuning())).toBe(false);
  });
});

describe('DeveloperTuningStore', () => {
  it('patch replaces the snapshot object and notifies subscribers', () => {
    const store = new DeveloperTuningStore();
    const before = store.get();
    let notified = 0;
    store.subscribe(() => { notified += 1; });
    store.patch({ terrainAmplification: 1.5 });
    expect(notified).toBe(1);
    expect(store.get()).not.toBe(before);
    expect(store.get().terrainAmplification).toBe(1.5);
    // untouched fields carry over
    expect(store.get().lightingPreset).toBe('vanilla');
  });

  it('clamps values pushed through set', () => {
    const store = new DeveloperTuningStore();
    store.patch({ terrainAmplification: 42 });
    expect(store.get().terrainAmplification).toBe(TERRAIN_AMPLIFICATION_MAX);
  });

  it('does not notify for a no-op patch', () => {
    const store = new DeveloperTuningStore();
    let notified = 0;
    store.subscribe(() => { notified += 1; });
    store.patch({ terrainAmplification: 1, dayNightSpeed: 1 });
    expect(notified).toBe(0);
  });

  it('patchBiomeMod flips a single flag', () => {
    const store = new DeveloperTuningStore();
    store.patchBiomeMod('vegetation', false);
    expect(store.get().biomeMods.vegetation).toBe(false);
    expect(store.get().biomeMods.structures).toBe(true);
  });

  it('reset restores the defaults', () => {
    const store = new DeveloperTuningStore();
    store.patch({ terrainAmplification: 2.5, dayNightSpeed: 6, lightingPreset: 'midnight' });
    store.patchBiomeMod('ores', false);
    store.reset();
    expect(store.get()).toEqual(tuning());
  });

  it('unsubscribe stops notifications', () => {
    const store = new DeveloperTuningStore();
    let notified = 0;
    const unsub = store.subscribe(() => { notified += 1; });
    store.patch({ dayNightSpeed: 2 });
    unsub();
    store.patch({ dayNightSpeed: 4 });
    expect(notified).toBe(1);
  });
});

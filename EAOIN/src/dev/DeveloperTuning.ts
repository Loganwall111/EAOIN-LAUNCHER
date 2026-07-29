/**
 * DeveloperTuning — the live bridge between the developer app panel and the
 * engine's 1.18 terrain-noise variables, world clock and lighting rig.
 *
 * Every control in the panel writes into this store; the running scene
 * subscribes and applies changes on the next frame, so sliders preview live
 * instead of needing a world reload. Everything is clamped through one place
 * (`clampDeveloperTuning`) so an out-of-range value can never reach the
 * generators or the atmosphere clock.
 */
import { Scene } from '@babylonjs/core';

/* ---------------------------------------------------------------------- */
/* World tuning shape                                                      */
/* ---------------------------------------------------------------------- */

/** Biome/world features the developer panel can switch on and off cleanly. */
export interface BiomeModificationFlags {
  /** Underground cave & cavern carving (deep caves, ravines, sinkholes). */
  caves: boolean;
  /** Surface water bodies: lakes, ponds and sea-level fill. */
  lakes: boolean;
  /** Biome surface paint: grass/sand/snow top coat and filler layers. */
  surfacePaint: boolean;
  /** Trees, cacti, flowers and other vegetation placement. */
  vegetation: boolean;
  /** Procedural structures: ruins, boulders, villages. */
  structures: boolean;
  /** Ore veins and surface ore outcrops. */
  ores: boolean;
}

/** Named lighting looks the panel can apply in one click. */
export type LightingPresetID =
  | 'vanilla'
  | 'golden_hour'
  | 'bright_day'
  | 'overcast'
  | 'midnight';

export interface DeveloperWorldTuning {
  /**
   * Terrain height / amplification scale multiplier for the 1.18 noise
   * pipeline. 1 = the shipping terrain; >1 stretches relief away from the
   * basin reference height (AMPLIFIED-style mountains); <1 flattens toward
   * plains. Range 0.25–3.
   */
  terrainAmplification: number;
  /**
   * Day/night speed multiplier. 1 = the normal 20-minute day; the effective
   * cycle length is `baseDayLengthSeconds / dayNightSpeed`. Range 0.25–8.
   */
  dayNightSpeed: number;
  /** Freeze the world clock where it is (independent of `/time freeze`). */
  timeFrozen: boolean;
  /** One-click exposure/contrast/fog look applied to the scene. */
  lightingPreset: LightingPresetID;
  /** Master switches for biome/world modifications. */
  biomeMods: BiomeModificationFlags;
}

export const TERRAIN_AMPLIFICATION_MIN = 0.25;
export const TERRAIN_AMPLIFICATION_MAX = 3;
export const DAY_NIGHT_SPEED_MIN = 0.25;
export const DAY_NIGHT_SPEED_MAX = 8;

export const DEFAULT_BIOME_MODS: BiomeModificationFlags = {
  caves: true,
  lakes: true,
  surfacePaint: true,
  vegetation: true,
  structures: true,
  ores: true,
};

/** Every biome-mod flag, in stable UI order. */
export const BIOME_MOD_KEYS: readonly (keyof BiomeModificationFlags)[] = [
  'caves',
  'lakes',
  'surfacePaint',
  'vegetation',
  'structures',
  'ores',
];

/** UI labels + descriptions for each biome mod toggle. */
export const BIOME_MOD_LABELS: Record<keyof BiomeModificationFlags, { label: string; icon: string; description: string }> = {
  caves: { label: 'Caves & Caverns', icon: '🕳️', description: 'Underground carving: caves, deep caverns, ravines, sinkholes.' },
  lakes: { label: 'Lakes & Oceans', icon: '💧', description: 'Surface water bodies and sea-level fill.' },
  surfacePaint: { label: 'Surface Paint', icon: '🎨', description: 'Biome top coat: grass, sand, snow and filler layers.' },
  vegetation: { label: 'Vegetation', icon: '🌲', description: 'Trees, cacti, flowers and border overhang.' },
  structures: { label: 'Structures', icon: '🏛️', description: 'Ruins, boulders, villages and monoliths.' },
  ores: { label: 'Ore Distribution', icon: '⛏️', description: 'Underground ore veins and surface outcrops.' },
};

export const DEFAULT_DEVELOPER_TUNING: DeveloperWorldTuning = {
  terrainAmplification: 1,
  dayNightSpeed: 1,
  timeFrozen: false,
  lightingPreset: 'vanilla',
  biomeMods: { ...DEFAULT_BIOME_MODS },
};

const LIGHTING_PRESET_IDS: readonly LightingPresetID[] = [
  'vanilla',
  'golden_hour',
  'bright_day',
  'overcast',
  'midnight',
];

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}

export function clampDeveloperTuning(tuning: DeveloperWorldTuning): DeveloperWorldTuning {
  return {
    terrainAmplification: clampNumber(
      tuning.terrainAmplification, TERRAIN_AMPLIFICATION_MIN, TERRAIN_AMPLIFICATION_MAX,
      DEFAULT_DEVELOPER_TUNING.terrainAmplification
    ),
    dayNightSpeed: clampNumber(
      tuning.dayNightSpeed, DAY_NIGHT_SPEED_MIN, DAY_NIGHT_SPEED_MAX,
      DEFAULT_DEVELOPER_TUNING.dayNightSpeed
    ),
    timeFrozen: Boolean(tuning.timeFrozen),
    lightingPreset: LIGHTING_PRESET_IDS.includes(tuning.lightingPreset)
      ? tuning.lightingPreset
      : 'vanilla',
    biomeMods: { ...DEFAULT_BIOME_MODS, ...(tuning.biomeMods ?? {}) },
  };
}

/* ---------------------------------------------------------------------- */
/* Lighting presets                                                        */
/* ---------------------------------------------------------------------- */

export interface LightingPresetParams {
  id: LightingPresetID;
  label: string;
  description: string;
  /** Scene image-processing exposure multiplier. */
  exposure: number;
  /** Scene image-processing contrast multiplier. */
  contrast: number;
  /** Multiplies the atmosphere's per-frame fog density. */
  fogDensityScale: number;
}

export const LIGHTING_PRESETS: readonly LightingPresetParams[] = [
  {
    id: 'vanilla', label: 'Vanilla',
    description: 'Stock exposure, contrast and fog — the shipped look.',
    exposure: 1, contrast: 1, fogDensityScale: 1,
  },
  {
    id: 'golden_hour', label: 'Golden Hour',
    description: 'Warm, punchy low-sun look with thicker horizon haze.',
    exposure: 1.07, contrast: 1.08, fogDensityScale: 1.12,
  },
  {
    id: 'bright_day', label: 'Bright Day',
    description: 'Crisp high-exposure daylight with clearer air.',
    exposure: 1.14, contrast: 1.02, fogDensityScale: 0.85,
  },
  {
    id: 'overcast', label: 'Overcast',
    description: 'Soft, flat light with a heavy fog bank.',
    exposure: 0.97, contrast: 0.95, fogDensityScale: 1.38,
  },
  {
    id: 'midnight', label: 'Midnight',
    description: 'Darker, moodier grading for night-time inspection.',
    exposure: 0.9, contrast: 1.14, fogDensityScale: 1.2,
  },
];

export function getLightingPreset(id: LightingPresetID): LightingPresetParams {
  return LIGHTING_PRESETS.find((p) => p.id === id) ?? LIGHTING_PRESETS[0];
}

/**
 * Push the exposure/contrast half of a preset onto a live scene. Fog density
 * is scaled separately per frame (the atmosphere rewrites it every update),
 * so the scene subscription only owns the image-processing values.
 */
export function applyLightingPresetToScene(scene: Scene, presetId: LightingPresetID): LightingPresetParams {
  const preset = getLightingPreset(presetId);
  const config = scene.imageProcessingConfiguration;
  if (config) {
    config.exposure = preset.exposure;
    config.contrast = preset.contrast;
  }
  scene.fogDensity = scene.fogDensity * preset.fogDensityScale;
  return preset;
}

/* ---------------------------------------------------------------------- */
/* World clock math                                                        */
/* ---------------------------------------------------------------------- */

/** Real seconds a full day cycle lasts at this speed multiplier. */
export function effectiveDayLengthSeconds(tuning: DeveloperWorldTuning, baseDayLengthSeconds: number): number {
  return baseDayLengthSeconds / Math.max(DAY_NIGHT_SPEED_MIN, tuning.dayNightSpeed);
}

/** World-clock hours advanced per real second; `(24 / 1200) = 0.02` at 1×. */
export function worldClockRatePerSecond(tuning: DeveloperWorldTuning, baseDayLengthSeconds: number): number {
  return 24 / effectiveDayLengthSeconds(tuning, baseDayLengthSeconds);
}

/* ---------------------------------------------------------------------- */
/* Terrain bridge                                                          */
/* ---------------------------------------------------------------------- */

/** Generators that accept live developer world-tuning implement this. */
export interface DevTunableTerrain {
  setDeveloperTuning(tuning: {
    heightMultiplier: number;
    biomeMods: BiomeModificationFlags;
  }): void;
  /** Drop every cached chunk so regenerated terrain picks up the new tuning. */
  invalidateGeneratedChunks(): void;
}

/** Probe for the dev-tunable contract (legacy and advanced generators both implement it). */
export function isDevTunableTerrain(target: unknown): target is DevTunableTerrain {
  if (typeof target !== 'object' || target === null) return false;
  const t = target as Partial<DevTunableTerrain>;
  return typeof t.setDeveloperTuning === 'function' && typeof t.invalidateGeneratedChunks === 'function';
}

/** Feed one tuning snapshot into a generator. Safe on non-tunable targets. */
export function applyDeveloperTuningToTerrain(target: unknown, tuning: DeveloperWorldTuning): boolean {
  if (!isDevTunableTerrain(target)) return false;
  target.setDeveloperTuning({
    heightMultiplier: tuning.terrainAmplification,
    biomeMods: { ...tuning.biomeMods },
  });
  return true;
}

/**
 * Signature of the tuning fields that change generated voxels. Comparing two
 * signatures is how the game loop knows a slider moved far enough to warrant
 * a world rebuild — lighting/clock edits must never regenerate terrain.
 */
export function worldgenSignature(tuning: DeveloperWorldTuning): string {
  const m = tuning.biomeMods;
  return [
    tuning.terrainAmplification.toFixed(3),
    m.caves ? 1 : 0, m.lakes ? 1 : 0, m.surfacePaint ? 1 : 0,
    m.vegetation ? 1 : 0, m.structures ? 1 : 0, m.ores ? 1 : 0,
  ].join('|');
}

/* ---------------------------------------------------------------------- */
/* Store                                                                   */
/* ---------------------------------------------------------------------- */

export type DeveloperTuningListener = (tuning: DeveloperWorldTuning) => void;

/**
 * Tiny observable store. Snapshots are replaced (never mutated) so React's
 * `useSyncExternalStore` re-renders exactly when a control changes a value.
 */
export class DeveloperTuningStore {
  private snapshot: DeveloperWorldTuning = { ...DEFAULT_DEVELOPER_TUNING, biomeMods: { ...DEFAULT_BIOME_MODS } };
  private readonly listeners = new Set<DeveloperTuningListener>();

  get(): DeveloperWorldTuning {
    return this.snapshot;
  }

  set(next: DeveloperWorldTuning): void {
    const clamped = clampDeveloperTuning(next);
    if (JSON.stringify(clamped) === JSON.stringify(this.snapshot)) return;
    this.snapshot = clamped;
    this.emit();
  }

  patch(partial: Partial<DeveloperWorldTuning>): void {
    this.set({ ...this.snapshot, ...partial, biomeMods: { ...this.snapshot.biomeMods, ...(partial.biomeMods ?? {}) } });
  }

  patchBiomeMod(flag: keyof BiomeModificationFlags, enabled: boolean): void {
    this.patch({ biomeMods: { ...this.snapshot.biomeMods, [flag]: enabled } });
  }

  reset(): void {
    this.set({ ...DEFAULT_DEVELOPER_TUNING, biomeMods: { ...DEFAULT_BIOME_MODS } });
  }

  subscribe(listener: DeveloperTuningListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.snapshot);
  }
}

/** Process-wide store shared by the HUD panel and the running scene. */
export const developerTuningStore = new DeveloperTuningStore();

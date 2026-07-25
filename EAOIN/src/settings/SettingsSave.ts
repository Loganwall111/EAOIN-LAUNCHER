import { clampSettings, createDefaultSettings, GameSettings } from './GameSettings';

const STORAGE_KEY = 'eaoin:settings:v1';
const SCHEMA_VERSION = 2;

/**
 * Earlier playable builds persisted `rendererPreference: 'webgpu'` together
 * with `experimentalVulkanMode: true` and `experimentalShaders: true`. Those
 * pipelines are not stable on the current BabylonJS stack, so we forcibly
 * migrate any saved settings to the safe WebGL defaults.
 *
 * Returns the (possibly migrated) settings, a flag indicating whether a
 * migration happened, and the detected schema version.
 */
export interface LoadSettingsResult {
  settings: GameSettings;
  migrated: boolean;
  schemaVersion: number;
}

export function loadSettings(): GameSettings {
  return loadSettingsDetailed().settings;
}

export function loadSettingsDetailed(): LoadSettingsResult {
  const storage = getStorage();
  if (!storage) {
    return { settings: createDefaultSettings(), migrated: false, schemaVersion: SCHEMA_VERSION };
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return { settings: createDefaultSettings(), migrated: false, schemaVersion: SCHEMA_VERSION };
    }

    const parsed = JSON.parse(raw) as { schemaVersion?: number } & Partial<GameSettings>;
    const storedVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;
    const requiresMigration = storedVersion < SCHEMA_VERSION || isLegacyExperimentalBundle(parsed);

    if (!requiresMigration) {
      return {
        settings: clampSettings({ ...createDefaultSettings(), ...parsed }),
        migrated: false,
        schemaVersion: SCHEMA_VERSION,
      };
    }

    const migrated = migrateSettings(parsed);
    // Persist the migrated settings so we only pay the migration cost once.
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ ...migrated, schemaVersion: SCHEMA_VERSION }));
    } catch {
      // Non-fatal: best-effort persistence.
    }
    return { settings: migrated, migrated: true, schemaVersion: SCHEMA_VERSION };
  } catch {
    return { settings: createDefaultSettings(), migrated: false, schemaVersion: SCHEMA_VERSION };
  }
}

export function saveSettings(settings: GameSettings): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...clampSettings(settings), schemaVersion: SCHEMA_VERSION })
    );
  } catch {
    // Non-fatal: settings are quality-of-life only.
  }
}

/**
 * Resets any persisted settings to the current default bundle. Useful when a
 * downstream code path detects persistent instability (e.g. repeated render
 * crashes) and wants to guarantee a known-good baseline.
 */
export function resetPersistedSettings(): GameSettings {
  const storage = getStorage();
  const defaults = createDefaultSettings();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ ...defaults, schemaVersion: SCHEMA_VERSION }));
    } catch {
      // Non-fatal.
    }
  }
  return defaults;
}

function migrateSettings(stored: Partial<GameSettings>): GameSettings {
  // Older saves may have forced the experimental WebGPU/Vulkan pipeline. Those
  // are unsafe on the current BabylonJS release, so we always reset them to
  // the safe WebGL baseline regardless of what the user previously chose.
  const defaults = createDefaultSettings();
  return clampSettings({
    ...defaults,
    ...stored,
    rendererPreference: 'webgl',
    experimentalVulkanMode: false,
    experimentalShaders: false,
    postProcessEnabled: false,
    qualityPreset: stored.qualityPreset && stored.qualityPreset !== 'cinematic' ? stored.qualityPreset : 'balanced',
  });
}

function isLegacyExperimentalBundle(stored: Partial<GameSettings>): boolean {
  return (
    stored.rendererPreference === 'webgpu' ||
    stored.experimentalVulkanMode === true ||
    stored.experimentalShaders === true ||
    stored.postProcessEnabled === true
  );
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

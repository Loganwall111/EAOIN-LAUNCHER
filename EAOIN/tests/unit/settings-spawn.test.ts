import { describe, it, expect, beforeEach } from 'vitest';
import { createDefaultSettings } from '../../src/settings/GameSettings';
import { loadSettings, saveSettings, loadSettingsDetailed, resetPersistedSettings } from '../../src/settings/SettingsSave';
import { TerrainGenerator } from '../../src/world/TerrainGenerator';

const STORAGE_KEY = 'eaoin:settings:v1';

function withStubbedStorage<T>(run: () => T): T {
  const backing = new Map<string, string>();
  const stub: Storage = {
    get length() { return backing.size; },
    clear() { backing.clear(); },
    getItem(key: string) { return backing.has(key) ? backing.get(key)! : null; },
    key(index: number) { return Array.from(backing.keys())[index] ?? null; },
    removeItem(key: string) { backing.delete(key); },
    setItem(key: string, value: string) { backing.set(key, String(value)); },
  };
  const original = (globalThis as any).window;
  (globalThis as any).window = { localStorage: stub };
  try {
    return run();
  } finally {
    if (original === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = original;
    }
  }
}

describe('GameSettings defaults', () => {
  it('uses the safe WebGL baseline', () => {
    const defaults = createDefaultSettings();
    expect(defaults.rendererPreference).toBe('webgl');
    expect(defaults.experimentalVulkanMode).toBe(false);
    expect(defaults.experimentalShaders).toBe(false);
    expect(defaults.postProcessEnabled).toBe(false);
    expect(defaults.qualityPreset).toBe('balanced');
  });
});

describe('SettingsSave migration', () => {
  beforeEach(() => {
    withStubbedStorage(() => {
      window.localStorage.clear();
    });
  });

  it('returns safe defaults when no settings are stored', () => {
    const settings = withStubbedStorage(() => loadSettings());
    expect(settings.rendererPreference).toBe('webgl');
    expect(settings.experimentalVulkanMode).toBe(false);
  });

  it('migrates legacy WebGPU/Vulkan settings to the safe baseline', () => {
    const migrated = withStubbedStorage(() => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          rendererPreference: 'webgpu',
          experimentalVulkanMode: true,
          experimentalShaders: true,
          postProcessEnabled: true,
          qualityPreset: 'cinematic',
        })
      );
      const result = loadSettingsDetailed();
      expect(result.migrated).toBe(true);
      return result.settings;
    });

    expect(migrated.rendererPreference).toBe('webgl');
    expect(migrated.experimentalVulkanMode).toBe(false);
    expect(migrated.experimentalShaders).toBe(false);
    expect(migrated.postProcessEnabled).toBe(false);
    expect(migrated.qualityPreset).toBe('balanced');
  });

  it('persists the schema version after migration', () => {
    withStubbedStorage(() => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ rendererPreference: 'webgpu', experimentalVulkanMode: true })
      );
      loadSettings();
      const raw = window.localStorage.getItem(STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string);
      expect(parsed.schemaVersion).toBe(2);
      expect(parsed.rendererPreference).toBe('webgl');
      expect(parsed.experimentalVulkanMode).toBe(false);
    });
  });

  it('does not re-migrate settings that are already on the safe schema', () => {
    const result = withStubbedStorage(() => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...createDefaultSettings(), schemaVersion: 2 })
      );
      return loadSettingsDetailed();
    });
    expect(result.migrated).toBe(false);
  });

  it('resetPersistedSettings writes safe defaults', () => {
    withStubbedStorage(() => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ rendererPreference: 'webgpu', experimentalVulkanMode: true })
      );
      const fresh = resetPersistedSettings();
      expect(fresh.rendererPreference).toBe('webgl');
      expect(fresh.experimentalVulkanMode).toBe(false);
    });
  });

  it('saveSettings stores the schema version alongside settings', () => {
    withStubbedStorage(() => {
      saveSettings({ ...createDefaultSettings(), rendererPreference: 'auto' });
      const raw = window.localStorage.getItem(STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string);
      expect(parsed.schemaVersion).toBe(2);
      expect(parsed.rendererPreference).toBe('auto');
    });
  });
});

describe('TerrainGenerator.getSpawnPoint', () => {
  it('spawns the player safely on top of the protected spawn patch', () => {
    const generator = new TerrainGenerator('eaoin_test_seed');
    // Pre-generate the spawn chunk so getHeightAt has data to read.
    generator.generateChunk(0, 0);
    const spawn = generator.getSpawnPoint();
    const ground = generator.getHeightAt(0, 0);
    expect(spawn.y).toBeCloseTo(ground + 1.95, 5);
    // The protected spawn patch guarantees a solid grass block at the
    // expected surface height (Y=8) for the default seed.
    expect(ground).toBe(8);
    expect(spawn.x).toBe(0.5);
    expect(spawn.z).toBe(0.5);
  });
});

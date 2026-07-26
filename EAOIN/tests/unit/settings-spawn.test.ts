import { describe, it, expect, beforeEach } from 'vitest';
import { createDefaultSettings } from '../../src/settings/GameSettings';
import { loadSettings, saveSettings, loadSettingsDetailed, resetPersistedSettings } from '../../src/settings/SettingsSave';
import { TerrainGenerator } from '../../src/world/TerrainGenerator';
import AdvancedTerrainGenerator from '../../src/world/AdvancedTerrainGenerator';

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
  // The old assertion hardcoded ground Y=8, which was the sea level constant
  // rather than the spawn platform height. The protected spawn patch actually
  // builds its grass cap at SPAWN_GROUND_Y (12). Assert the invariants that
  // matter -- solid footing, clear headroom, above water, spawn sits on top --
  // instead of a magic number that silently drifts with worldgen tuning.
  const WATER_LEVEL = 8;
  const SEEDS = ['eaoin_test_seed', 'eaoin_seed_2026', 'classic_legacy', 'hello world'];

  it.each(SEEDS)('places the player on solid, clear ground above water (%s)', (seed) => {
    const generator = new TerrainGenerator(seed);
    generator.generateChunk(0, 0);

    const ground = generator.getHeightAt(0, 0);
    const spawn = generator.getSpawnPoint();

    expect(spawn.x).toBe(0.5);
    expect(spawn.z).toBe(0.5);
    expect(spawn.y).toBeCloseTo(ground + 1.95, 5);

    // Solid block underfoot, breathable space above, and never underwater.
    expect(generator.getBlockAt(0, ground, 0)).not.toBe(0);
    expect(generator.getBlockAt(0, ground + 1, 0)).toBe(0);
    expect(generator.getBlockAt(0, ground + 2, 0)).toBe(0);
    expect(ground).toBeGreaterThan(WATER_LEVEL);
  });

  it('reports the same spawn height as the advanced generator', () => {
    // Regression: the two generators must not disagree about spawn elevation,
    // otherwise the player falls or suffocates when the default world switches
    // between them.
    for (const seed of SEEDS) {
      const legacy = new TerrainGenerator(seed);
      legacy.generateChunk(0, 0);
      const advanced = new AdvancedTerrainGenerator({ seed });
      advanced.generateChunk(0, 0);

      expect(advanced.getHeightAt(0, 0)).toBe(legacy.getHeightAt(0, 0));
      expect(advanced.getSpawnPoint().y).toBeCloseTo(legacy.getSpawnPoint().y, 5);
    }
  });

  it('matches the real top solid block in the spawn column', () => {
    const generator = new TerrainGenerator('eaoin_test_seed');
    generator.generateChunk(0, 0);

    let topSolid = -1;
    for (let y = 127; y >= 0; y--) {
      if (generator.getBlockAt(0, y, 0) !== 0) { topSolid = y; break; }
    }
    expect(generator.getHeightAt(0, 0)).toBe(topSolid);
  });
});

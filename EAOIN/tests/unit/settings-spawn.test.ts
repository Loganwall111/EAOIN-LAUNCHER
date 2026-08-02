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
  it('uses the safe WebGL baseline with modern visuals enabled', () => {
    const defaults = createDefaultSettings();
    expect(defaults.rendererPreference).toBe('webgl');
    expect(defaults.experimentalVulkanMode).toBe(false);
    // Modern visual defaults (safe on WebGL): post-processing and ray tracing
    // are on, and the quality preset is 'quality'.
    expect(defaults.experimentalShaders).toBe(true);
    expect(defaults.postProcessEnabled).toBe(true);
    expect(defaults.qualityPreset).toBe('quality');
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

  it('migrates legacy WebGPU/Vulkan settings to the safe WebGL renderer', () => {
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

    // The renderer is always reset to safe WebGL, but the modern visual
    // defaults (post-processing, shaders) are preserved.
    expect(migrated.rendererPreference).toBe('webgl');
    expect(migrated.experimentalVulkanMode).toBe(false);
    expect(migrated.postProcessEnabled).toBe(true);
    expect(migrated.experimentalShaders).toBe(true);
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
    // Spawn Y is the camera/eye. Feet are 1.62 blocks below it and rest on
    // the top face (ground + 1), matching the runtime collision controller.
    expect(spawn.y).toBeCloseTo(ground + 1 + 1.62, 5);

    // Solid block underfoot, breathable space above, and never underwater.
    expect(generator.getBlockAt(0, ground, 0)).not.toBe(0);
    expect(generator.getBlockAt(0, ground + 1, 0)).toBe(0);
    expect(generator.getBlockAt(0, ground + 2, 0)).toBe(0);
    expect(ground).toBeGreaterThan(WATER_LEVEL);
  });

  it('gives every generator a spawn that is actually safe to stand in', () => {
    // This used to assert `advanced.getHeightAt(0,0) === legacy.getHeightAt(0,0)`,
    // i.e. that two deliberately different terrain algorithms — a simple
    // sine-based one and a full continental/erosion pipeline — produce
    // byte-identical elevations. That can never hold (it was failing with
    // 26 vs 12) and it is not what the player needs anyway.
    //
    // What actually matters is that whichever generator a world uses, the
    // spawn point it reports is somewhere you can stand: solid ground under
    // your feet, air for your body, and not inside water.
    for (const seed of SEEDS) {
      const legacy = new TerrainGenerator(seed);
      legacy.generateChunk(0, 0);
      const advanced = new AdvancedTerrainGenerator({ seed });
      advanced.generateChunk(0, 0);

      for (const [label, spawn, blockAt] of [
        ['legacy', legacy.getSpawnPoint(), (x: number, y: number, z: number) => legacy.getBlockAt(x, y, z)],
        ['advanced', advanced.getSpawnPoint(), (x: number, y: number, z: number) => advanced.getBlockAt(x, y, z)],
      ] as const) {
        const x = Math.floor(spawn.x);
        const z = Math.floor(spawn.z);
        // Camera Y is eye level; sample just beneath the feet to find support.
        const ground = Math.floor(spawn.y - 1.62 - 0.01);
        expect(blockAt(x, ground, z), `${seed}/${label} ground`).not.toBe(0);
        expect(blockAt(x, ground, z), `${seed}/${label} not in water`).not.toBe(5);
        expect(blockAt(x, ground + 1, z), `${seed}/${label} body`).toBe(0);
      }
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

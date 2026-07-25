import { clampSettings, createDefaultSettings, GameSettings } from './GameSettings';

const STORAGE_KEY = 'eaoin:settings:v1';

export function loadSettings(): GameSettings {
  const storage = getStorage();
  if (!storage) return createDefaultSettings();

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSettings();
    return clampSettings({ ...createDefaultSettings(), ...JSON.parse(raw) });
  } catch {
    return createDefaultSettings();
  }
}

export function saveSettings(settings: GameSettings): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(clampSettings(settings)));
  } catch {
    // Non-fatal: settings are quality-of-life only.
  }
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

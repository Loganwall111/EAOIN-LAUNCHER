/** PlayerSaveManager — seed-scoped local player progress persistence. */
import { InventoryStacks } from './InventoryState';
import { SurvivalStats } from './SurvivalState';
import { sanitizeToolInventory, ToolID, ToolInventory } from './ToolState';

export interface PlayerProgressSave {
  inventory: InventoryStacks;
  tools: ToolInventory;
  survivalStats: SurvivalStats;
  selectedTool: ToolID;
}

interface SerializedPlayerProgress extends PlayerProgressSave {
  version: 1;
  seed: string;
  savedAt: string;
}

const STORAGE_PREFIX = 'eaoin:player-progress:v1:';

export class PlayerSaveManager {
  constructor(private readonly seed: string) {}

  load(): Partial<PlayerProgressSave> | null {
    const storage = getStorage();
    if (!storage) return null;
    const raw = storage.getItem(this.storageKey());
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<SerializedPlayerProgress>;
      if (parsed.version !== 1 || parsed.seed !== this.seed) return null;
      return {
        inventory: sanitizeInventory(parsed.inventory),
        tools: sanitizeToolInventory(parsed.tools),
        survivalStats: sanitizeStats(parsed.survivalStats),
        selectedTool: sanitizeTool(parsed.selectedTool, sanitizeToolInventory(parsed.tools)),
      };
    } catch (error) {
      console.warn('[PlayerSave] Ignoring invalid player progress', error);
      return null;
    }
  }

  save(progress: PlayerProgressSave): void {
    const storage = getStorage();
    if (!storage) return;

    const payload: SerializedPlayerProgress = {
      version: 1,
      seed: this.seed,
      savedAt: new Date().toISOString(),
      inventory: sanitizeInventory(progress.inventory),
      tools: sanitizeToolInventory(progress.tools),
      survivalStats: sanitizeStats(progress.survivalStats),
      selectedTool: sanitizeTool(progress.selectedTool, progress.tools),
    };

    try {
      storage.setItem(this.storageKey(), JSON.stringify(payload));
    } catch (error) {
      console.warn('[PlayerSave] Failed to save player progress', error);
    }
  }

  clear(): void {
    PlayerSaveManager.clearSeed(this.seed);
  }

  static clearSeed(seed: string): void {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(`${STORAGE_PREFIX}${encodeURIComponent(seed)}`);
  }

  private storageKey(): string {
    return `${STORAGE_PREFIX}${encodeURIComponent(this.seed)}`;
  }
}

function sanitizeInventory(value: unknown): InventoryStacks {
  const inventory: InventoryStacks = {};
  if (!value || typeof value !== 'object') return inventory;

  for (const [key, rawAmount] of Object.entries(value)) {
    const id = Number(key);
    const amount = Number(rawAmount);
    if (Number.isInteger(id) && Number.isFinite(amount) && amount >= 0) {
      inventory[id] = Math.floor(amount);
    }
  }
  return inventory;
}

function sanitizeStats(value: unknown): SurvivalStats {
  if (!value || typeof value !== 'object') return { health: 100, food: 92, stamina: 100 };
  const stats = value as Partial<Record<keyof SurvivalStats, unknown>>;
  return {
    health: clamp(Number(stats.health ?? 100)),
    food: clamp(Number(stats.food ?? 92)),
    stamina: clamp(Number(stats.stamina ?? 100)),
  };
}

function sanitizeTool(value: unknown, tools: ToolInventory): ToolID {
  const tool = String(value ?? 'hand') as ToolID;
  return tools[tool] ? tool : 'hand';
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(100, value));
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

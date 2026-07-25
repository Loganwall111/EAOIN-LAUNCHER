/**
 * WorldSaveManager — lightweight local persistence for playable voxel edits.
 *
 * The generator remains deterministic; this stores only player-changed blocks by
 * world coordinate so edited worlds can be reconstructed from seed + edit log.
 */
import { BlockID } from '@shared/blocks/BlockRegistry';

export interface WorldBlockEdit {
  x: number;
  y: number;
  z: number;
  block: BlockID;
}

interface SerializedWorldEdits {
  version: 1;
  seed: string;
  savedAt: string;
  edits: WorldBlockEdit[];
}

export interface SaveResult {
  ok: boolean;
  count: number;
  message: string;
}

const STORAGE_PREFIX = 'eaoin:world-edits:v1:';

export class WorldSaveManager {
  constructor(private readonly seed: string) {}

  load(): WorldBlockEdit[] {
    const storage = getStorage();
    if (!storage) return [];

    const raw = storage.getItem(this.storageKey());
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as Partial<SerializedWorldEdits>;
      if (parsed.version !== 1 || parsed.seed !== this.seed || !Array.isArray(parsed.edits)) {
        return [];
      }

      return parsed.edits.filter(isValidEdit);
    } catch (error) {
      console.warn('[WorldSave] Ignoring invalid save data', error);
      return [];
    }
  }

  save(edits: WorldBlockEdit[]): SaveResult {
    const storage = getStorage();
    if (!storage) {
      return { ok: false, count: edits.length, message: 'Save unavailable in this browser context' };
    }

    const payload: SerializedWorldEdits = {
      version: 1,
      seed: this.seed,
      savedAt: new Date().toISOString(),
      edits: edits.map((edit) => ({ ...edit })),
    };

    try {
      storage.setItem(this.storageKey(), JSON.stringify(payload));
      return { ok: true, count: edits.length, message: `Saved ${edits.length} world edit${edits.length === 1 ? '' : 's'}` };
    } catch (error) {
      console.warn('[WorldSave] Failed to save world edits', error);
      return { ok: false, count: edits.length, message: 'Save failed: storage quota or permissions issue' };
    }
  }

  clear(): SaveResult {
    return WorldSaveManager.clearSeed(this.seed);
  }

  static clearSeed(seed: string): SaveResult {
    const storage = getStorage();
    if (!storage) {
      return { ok: false, count: 0, message: 'Reset unavailable in this browser context' };
    }

    storage.removeItem(`${STORAGE_PREFIX}${encodeURIComponent(seed)}`);
    return { ok: true, count: 0, message: 'World edits reset' };
  }

  private storageKey(): string {
    return `${STORAGE_PREFIX}${encodeURIComponent(this.seed)}`;
  }
}

export function editKey(x: number, y: number, z: number): string {
  return `${x}:${y}:${z}`;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isValidEdit(value: unknown): value is WorldBlockEdit {
  if (!value || typeof value !== 'object') return false;
  const edit = value as Record<string, unknown>;
  return (
    Number.isInteger(edit.x) &&
    Number.isInteger(edit.y) &&
    Number.isInteger(edit.z) &&
    Number.isInteger(edit.block) &&
    Number(edit.block) >= 0
  );
}

/**
 * GodMode — the "gift of a lifetime" unlocked by completing the ARG.
 *
 * 2.0 Update Part 2: unlocking the secret ending ("The Cosmic Girl Returns")
 * grants God Mode. It's an in-world edit mode that lets you customize every
 * aspect of the game at once — super edit, god flight, no damage, instant
 * build, and unlimited creative inventory — all toggled from one place.
 *
 * It is only available after you have collected all fragments AND read the
 * ending ticket (the two halves of the key), or via the creative/incredible
 * dev fallback.
 */
export interface GodModeState {
  unlocked: boolean;
  active: boolean;
  superEdit: boolean;
  godFlight: boolean;
  noDamage: boolean;
  instantBuild: boolean;
  unlimitedInventory: boolean;
}

const STORAGE_KEY = 'eaoin:god-mode:v1';

export function godModeDefaults(): GodModeState {
  return {
    unlocked: false,
    active: false,
    superEdit: false,
    godFlight: false,
    noDamage: false,
    instantBuild: false,
    unlimitedInventory: false,
  };
}

export class GodMode {
  private state: GodModeState;

  constructor() {
    this.state = this.load();
  }

  private load(): GodModeState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...godModeDefaults(), ...(JSON.parse(raw) as Partial<GodModeState>) };
      }
    } catch { /* ignore */ }
    return godModeDefaults();
  }

  private save(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch { /* ignore */ }
  }

  /** Unlock God Mode (called when the secret ending is reached). */
  unlock(): void {
    this.state.unlocked = true;
    this.save();
  }

  isUnlocked(): boolean {
    return this.state.unlocked;
  }

  isActive(): boolean {
    return this.state.active;
  }

  toggleActive(): boolean {
    if (!this.state.unlocked) return false;
    this.state.active = !this.state.active;
    this.save();
    return this.state.active;
  }

  set(key: keyof GodModeState, value: boolean): void {
    if (key === 'unlocked' || key === 'active') return;
    this.state[key] = value;
    this.save();
  }

  get(): GodModeState {
    return { ...this.state };
  }
}

let _god: GodMode | null = null;
export function getGodMode(): GodMode {
  if (!_god) _god = new GodMode();
  return _god;
}

/**
 * DeveloperAccess — the lock on the embedded developer app panel.
 *
 * ## Alpha Access lockdown
 *
 * During Alpha Access (`ALPHA_ACCESS_LOCKDOWN`) the panel stays completely
 * hidden for general players: no HUD button, no menu entry, no way to reach
 * the controls. The only route in is the developer trigger (backquote `` ` ``
 * or Ctrl+Shift+D):
 *
 *   - On a machine that already holds a developer grant (stored token, a
 *     signed-in dev build, or the Vite dev server), the panel **instantly
 *     opens** — one keypress, no ceremony.
 *   - Anywhere else the trigger reveals the lock gate: a single unlock-code
 *     field. The correct code grants access (and remembers the machine), the
 *     panel opens immediately, and everything stays dark for players.
 *
 * All state is observable so React renders straight from the controller.
 */

/**
 * While true, Alpha Access builds hide the panel from everyone who does not
 * hold a developer grant. Flip to false at full release to let modders in.
 */
export const ALPHA_ACCESS_LOCKDOWN = true;

/** The developer unlock code. Shared out-of-band with the team, never in UI. */
export const DEVELOPER_UNLOCK_CODE = 'Logan1234';
/** Legacy unlock code still accepted for existing developers. */
export const LEGACY_DEVELOPER_UNLOCK_CODE = 'EAOIN-118-DEV';

/** localStorage key that remembers a granted machine between sessions. */
export const DEVELOPER_ACCESS_STORAGE_KEY = 'eaoin.developerAccess';

/** Value written to storage when access is granted (version tag for revocation). */
const GRANT_TOKEN = 'granted:v1';

/** URL/search parameter that also grants access, e.g. `?developer=EAOIN-118-DEV`. */
export const DEVELOPER_ACCESS_URL_PARAM = 'developer';

export interface DeveloperAccessSnapshot {
  /** A developer grant is active on this session. */
  granted: boolean;
  /** The unlock-code gate is on screen (triggered without a grant). */
  gateOpen: boolean;
  /** The panel itself is open. Only ever true alongside `granted`. */
  panelOpen: boolean;
  /** Feedback after a failed unlock attempt, shown on the gate. */
  lastError: string | null;
}

export interface DeveloperAccessEnvironment {
  /** Persistent storage; pass null for an ephemeral (session-only) grant. */
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  /**
   * A runtime that is a developer by construction — typically the local Vite
   * dev server. Production player builds pass `false` here.
   */
  devRuntime: boolean;
  /** Current URL query string (for `?developer=...` grants); '' when unknown. */
  urlSearch: string;
}

export type DeveloperAccessListener = (snapshot: DeveloperAccessSnapshot) => void;

const LOCKED: DeveloperAccessSnapshot = {
  granted: false,
  gateOpen: false,
  panelOpen: false,
  lastError: null,
};

export class DeveloperAccessController {
  private snapshot: DeveloperAccessSnapshot = { ...LOCKED };
  private readonly listeners = new Set<DeveloperAccessListener>();

  constructor(private readonly env: DeveloperAccessEnvironment) {
    if (env.devRuntime || this.readStoredGrant() || this.readUrlGrant()) {
      this.snapshot = { ...LOCKED, granted: true };
    }
  }

  get(): DeveloperAccessSnapshot {
    return this.snapshot;
  }

  isGranted(): boolean {
    return this.snapshot.granted;
  }

  /**
   * The developer trigger (backquote / Ctrl+Shift+D).
   *
   * Granted → the panel toggles open instantly. Not granted → the lock gate
   * appears. During the Alpha Access lockdown this is the *only* way anything
   * developer-facing shows at all, and it still unlocks nothing for players.
   */
  trigger(): DeveloperAccessSnapshot {
    if (this.snapshot.granted) {
      return this.mutate({
        panelOpen: !this.snapshot.panelOpen,
        gateOpen: false,
        lastError: null,
      });
    }
    return this.mutate({ gateOpen: !this.snapshot.gateOpen, lastError: null, panelOpen: false });
  }

  /** Attempt an unlock from the gate. Returns true when access was granted. */
  submitCode(code: string): boolean {
    if (this.snapshot.granted) {
      this.mutate({ gateOpen: false, panelOpen: true, lastError: null });
      return true;
    }
    const normalized = code.trim().toUpperCase();
    if (normalized.length === 0) {
      this.mutate({ lastError: 'Enter the developer unlock code.' });
      return false;
    }
    const valid = normalized === DEVELOPER_UNLOCK_CODE.toUpperCase()
      || normalized === LEGACY_DEVELOPER_UNLOCK_CODE.toUpperCase();
    if (!valid) {
      this.mutate({ lastError: 'Access denied — incorrect developer code.' });
      return false;
    }
    this.persistGrant();
    this.mutate({ granted: true, gateOpen: false, panelOpen: true, lastError: null });
    return true;
  }

  /** Close gate and panel without revoking the grant. */
  dismiss(): void {
    if (this.snapshot.panelOpen || this.snapshot.gateOpen) {
      this.mutate({ panelOpen: false, gateOpen: false, lastError: null });
    }
  }

  /** Revoke access on this machine entirely. */
  lock(): void {
    try { this.env.storage?.removeItem(DEVELOPER_ACCESS_STORAGE_KEY); } catch { /* opaque origin */ }
    this.mutate({ ...LOCKED });
  }

  subscribe(listener: DeveloperAccessListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /* ------------------------------------------------------------------ */

  private mutate(patch: Partial<DeveloperAccessSnapshot>): DeveloperAccessSnapshot {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener(this.snapshot);
    return this.snapshot;
  }

  private readStoredGrant(): boolean {
    try {
      return this.env.storage?.getItem(DEVELOPER_ACCESS_STORAGE_KEY) === GRANT_TOKEN;
    } catch {
      return false;
    }
  }

  private readUrlGrant(): boolean {
    if (!this.env.urlSearch) return false;
    try {
      const params = new URLSearchParams(this.env.urlSearch);
      const value = params.get(DEVELOPER_ACCESS_URL_PARAM);
      return value !== null && value.trim().toUpperCase() === DEVELOPER_UNLOCK_CODE.toUpperCase();
    } catch {
      return false;
    }
  }

  private persistGrant(): void {
    try { this.env.storage?.setItem(DEVELOPER_ACCESS_STORAGE_KEY, GRANT_TOKEN); } catch { /* opaque origin */ }
  }
}

/** Detect the real browser runtime for the process-wide singleton. */
export function detectDeveloperAccessEnvironment(): DeveloperAccessEnvironment {
  let storage: DeveloperAccessEnvironment['storage'] = null;
  let urlSearch = '';
  if (typeof window !== 'undefined') {
    try { storage = window.localStorage; } catch { storage = null; }
    urlSearch = window.location?.search ?? '';
  }
  // Vite marks the local dev server with DEV; vitest runs MODE=test so the
  // singleton stays locked in the test harness exactly like a player build.
  let devRuntime = false;
  try {
    const meta = (import.meta as unknown as { env?: { DEV?: boolean; MODE?: string } }).env;
    devRuntime = Boolean(meta?.DEV) && meta?.MODE !== 'test';
  } catch {
    devRuntime = false;
  }
  return { storage, devRuntime, urlSearch };
}

/** Process-wide controller shared by the HUD panel and any future dev tools. */
export const developerAccess = new DeveloperAccessController(detectDeveloperAccessEnvironment());

/** Test hook: rebuild the singleton around a fresh (locked) environment. */
export function resetDeveloperAccessForTesting(env?: Partial<DeveloperAccessEnvironment>): DeveloperAccessController {
  developerAccess.lock();
  return new DeveloperAccessController({ storage: null, devRuntime: false, urlSearch: '', ...env });
}

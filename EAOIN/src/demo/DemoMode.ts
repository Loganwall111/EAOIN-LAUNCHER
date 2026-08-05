/**
 * DemoMode — the free "EAOIN Demo" edition (desktop only).
 *
 * A deliberately light, time-boxed build so people can taste the game without
 * reaching the ending or learning too much. The same web bundle powers both the
 * full game and the demo; the demo is only activated when the desktop wrapper
 * flags it (window.eaoinDesktop?.isDemo). In a normal browser / full desktop
 * build every function below is a no-op and the game is unchanged.
 *
 * Rules implemented:
 *   - SINGULARITY: a 30-minute session timer. When it elapses the journey is
 *     suspended. The session clock persists so quitting mid-session doesn't
 *     reset it.
 *   - ENDING: blocked. The Singularity journey stops before the monitor /
 *     passcode (secret ending), and the in-game endgame (Corrupted Lands /
 *     memory-shard finale) is not reachable in the demo.
 *   - EXPERIMENTAL / INCREDIBLE modes: a daily time allowance that resets each
 *     day at midnight local time. The allowance is consumed while playing those
 *     modes and replenishes the next day.
 */
import { BlockID } from '@shared/blocks/BlockRegistry';

export interface DemoInfo {
  isDemo: boolean;
  /** ms remaining in the Singularity session (0 when exhausted). */
  singularityRemainingMs: number;
  /** ms remaining in today's experimental-mode allowance (0 when exhausted). */
  experimentalRemainingMs: number;
  /** ms until midnight (daily reset) — experimental allowance replenishes then. */
  resetInMs: number;
}

/* ---- config ------------------------------------------------------------ */
export const DEMO_SINGULARITY_MINUTES = 30;
export const SINGULARITY_SESSION_MS = DEMO_SINGULARITY_MINUTES * 60 * 1000;
/** Daily allowance for Experimental / Incredible modes. */
export const EXPERIMENTAL_DAILY_MINUTES = 120;
export const EXPERIMENTAL_DAILY_MS = EXPERIMENTAL_DAILY_MINUTES * 60 * 1000;

/** In the demo, stop the Singularity journey before The House / The Monitor. */
export const DEMO_MAX_JOURNEY_WORLDS = 12;

/* ---- persistence helpers (guarded, SSR-safe) --------------------------- */
const KEY = {
  singularityStart: 'eaoin_demo_singularity_start',
  experimentalDay: 'eaoin_demo_exp_day',
  experimentalUsed: 'eaoin_demo_exp_used',
};

type Store = Pick<Storage, 'getItem' | 'setItem'>;
let store: Store | null = null;
export function setDemoStore(s: Store | null): void { store = s; }
function read(key: string): string | null {
  try { return store?.getItem(key) ?? null; } catch { return null; }
}
function write(key: string, value: string): void {
  try { store?.setItem(key, value); } catch { /* storage disabled */ }
}

/* ---- demo detection ---------------------------------------------------- */
export function isDemo(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as Window & { eaoinDesktop?: { isDemo?: boolean } }).eaoinDesktop?.isDemo);
}

/* ---- time helpers ------------------------------------------------------ */
function now(): number { return Date.now(); }
function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
export function msUntilMidnight(d = new Date()): number {
  const next = new Date(d);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, next.getTime() - d.getTime());
}

/* ---- singularity session (30 min) -------------------------------------- */
export function startSingularitySession(): void {
  if (!isDemo()) return;
  const start = Number(read(KEY.singularityStart)) || 0;
  const elapsed = start ? now() - start : 0;
  if (!start || elapsed > SINGULARITY_SESSION_MS) {
    write(KEY.singularityStart, String(now()));
  }
}

export function singularityRemainingMs(): number {
  if (!isDemo()) return Infinity;
  const start = Number(read(KEY.singularityStart)) || 0;
  if (!start) return SINGULARITY_SESSION_MS;
  return Math.max(0, SINGULARITY_SESSION_MS - (now() - start));
}

/** True once the Singularity demo session has run out. */
export function singularityExhausted(): boolean {
  return isDemo() && singularityRemainingMs() <= 0;
}

/* ---- experimental / incredible daily allowance ------------------------- */
function dayState() {
  const day = read(KEY.experimentalDay);
  if (day !== todayKey()) {
    write(KEY.experimentalDay, todayKey());
    write(KEY.experimentalUsed, '0');
    return 0;
  }
  return Number(read(KEY.experimentalUsed)) || 0;
}

/** Remaining experimental/incredible allowance for today (ms). */
export function experimentalRemainingMs(): number {
  if (!isDemo()) return Infinity;
  return Math.max(0, EXPERIMENTAL_DAILY_MS - dayState());
}

/** Consume demo play time spent in experimental/incredible modes. */
export function consumeExperimental(ms: number): void {
  if (!isDemo() || ms <= 0) return;
  const used = dayState() + ms;
  write(KEY.experimentalUsed, String(used));
}

/** True when the daily experimental/incredible allowance is used up. */
export function experimentalExhausted(): boolean {
  return isDemo() && experimentalRemainingMs() <= 0;
}

/* ---- ending / content gating ------------------------------------------- */
/** In the demo we hide the game's true ending (the Secret Ending). */
export function blockSecretEnding(): boolean {
  return isDemo();
}
/** In the demo, cap the Singularity journey to a "taste" of worlds. */
export function demoMaxJourneyStage(): number | null {
  return isDemo() ? DEMO_MAX_JOURNEY_WORLDS : null;
}

/** Full aggregate state for the HUD banner. */
export function getDemoInfo(): DemoInfo {
  if (!isDemo()) {
    return { isDemo: false, singularityRemainingMs: Infinity, experimentalRemainingMs: Infinity, resetInMs: 0 };
  }
  return {
    isDemo: true,
    singularityRemainingMs: singularityRemainingMs(),
    experimentalRemainingMs: experimentalRemainingMs(),
    resetInMs: msUntilMidnight(),
  };
}

/** Formatted mm:ss countdown helper for UI. */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return '∞';
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Block IDs that lead into the endgame story in the demo (no-op outside). */
export function demoBlockedContentBlocks(): Set<BlockID> {
  const empty = new Set<BlockID>();
  if (!isDemo()) return empty;
  // The Omni Creator (302) and God Mode Block (340) are endgame/secret-content
  // triggers we don't want demo players reaching.
  return new Set<BlockID>([302, 340]);
}

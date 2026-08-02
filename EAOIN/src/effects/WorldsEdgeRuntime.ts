/**
 * WorldsEdgeRuntime — the "World's Edge" world type mechanic.
 *
 * An exclusive survival world where the world literally has an end:
 *   - A hard **56-minute timer**; when it expires the whole world is consumed
 *     by the monster and the run ends.
 *   - Crossing the far **Edge** (distance from origin) triggers a tentacle grab:
 *     the player is pulled down, a cutscene flash plays, and they die to the
 *     world-eating monster.
 *   - The monster periodically **punches holes through reality**, corrupting the
 *     land (a nearby block column is corrupted) and pulling the player toward
 *     those rifts.
 *
 * Only effective in survival. In creative (via cheats) it is bypassed.
 */
export interface WorldsEdgeState {
  active: boolean;
  timeRemaining: number;   // seconds
  edgeDistance: number;    // world units to the Edge
  corrupted: number;       // how many reality holes the monster has torn
  message?: string;
}

/** Total survival time limit. */
export const WORLDS_EDGE_TIME = 56 * 60; // seconds
/** Distance from origin at which the Edge begins. */
export const WORLDS_EDGE_DISTANCE = 2600;

export class WorldsEdgeRuntime {
  private active = false;
  private timeRemaining = WORLDS_EDGE_TIME;
  private corrupted = 0;
  private lastWarn = 0;
  private nextTearAt = performance.now() + 40_000;
  private state: WorldsEdgeState = { active: false, timeRemaining: WORLDS_EDGE_TIME, edgeDistance: WORLDS_EDGE_DISTANCE, corrupted: 0 };

  setActive(active: boolean): void {
    this.active = active;
    if (active) {
      this.timeRemaining = WORLDS_EDGE_TIME;
      this.corrupted = 0;
      this.nextTearAt = performance.now() + 40_000;
    }
    this.state = { ...this.state, active, timeRemaining: this.timeRemaining, corrupted: this.corrupted };
  }

  isActive(): boolean { return this.active; }

  /**
   * Tick per frame. Returns actions for the engine to apply, or null.
   * `creative` bypasses the monster.
   */
  tick(deltaSeconds: number, distanceFromOrigin: number, creative: boolean, now: number): {
    message?: string;
    grabPlayer?: boolean;      // tentacle pull into a cutscene + death
    corruptAt?: { x: number; z: number };
    worldConsumed?: boolean;
  } | null {
    if (!this.active || creative) return null;
    const out: NonNullable<ReturnType<typeof this.tick>> = {};

    // Count down the timer.
    this.timeRemaining = Math.max(0, this.timeRemaining - deltaSeconds);
    this.state.timeRemaining = this.timeRemaining;

    // Crossed the Edge → monster grabs you.
    if (distanceFromOrigin > WORLDS_EDGE_DISTANCE) {
      out.grabPlayer = true;
      out.message = 'You crossed the World\u2019s Edge. Tentacles drag you down\u2026';
    }

    // Warn at key thresholds.
    const mins = Math.floor(this.timeRemaining / 60);
    if (this.timeRemaining <= 600 && mins !== this.lastWarn && (mins === 10 || mins === 5 || mins === 1)) {
      this.lastWarn = mins;
      out.message = `⚠ The world ends in ${mins} minute${mins === 1 ? '' : 's'} — cross the Edge only if you must.`;
    }

    // Timer expired → world consumed.
    if (this.timeRemaining <= 0) {
      out.worldConsumed = true;
      out.message = 'The world-eating monster has consumed everything.';
    }

    // Periodic reality tears that corrupt the land and pull the player.
    if (now >= this.nextTearAt) {
      this.nextTearAt = now + 30_000;
      this.corrupted += 1;
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 60;
      out.corruptAt = { x: Math.round(Math.cos(angle) * dist), z: Math.round(Math.sin(angle) * dist) };
      out.message = `🌀 The monster tears a hole through reality (corrupted: ${this.corrupted}).`;
    }

    this.state = { ...this.state, timeRemaining: this.timeRemaining, corrupted: this.corrupted };
    if (out.message) this.state.message = out.message;
    return Object.keys(out).length ? out : null;
  }

  getState(): WorldsEdgeState { return this.state; }
}

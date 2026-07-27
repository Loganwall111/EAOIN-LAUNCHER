/**
 * AdaptivePerformance — the thing that actually fixes "it's really laggy".
 *
 * Static quality presets are the wrong tool for a voxel sandbox, because the
 * cost of a frame varies enormously with where the player is standing. A
 * mountaintop at noon with 16-chunk view distance and a cave at midnight are
 * different games, performance-wise. A fixed preset must be tuned for the
 * worst case, which means the other 90% of the time you are leaving frames on
 * the table — or it is tuned for the average, and the hard cases stutter.
 *
 * So instead this measures the real frame time and steers three dials to hold
 * a target framerate:
 *
 *   1. **Render scale** — internal resolution. Cheapest, biggest win, and the
 *      least visible if you move it in small steps.
 *   2. **Render distance** — how many chunks are meshed and drawn.
 *   3. **Effect tier** — shadows / post stack / particle density.
 *
 * Design notes that matter:
 *
 *  - It steers on the **95th-percentile** frame time, not the mean. Stutter is
 *    what players feel; an average hides it completely.
 *  - Changes are **asymmetric**: drop quality fast (within ~0.5s of trouble),
 *    raise it slowly (only after several seconds of comfortable headroom).
 *    The reverse produces an oscillating, shimmering mess.
 *  - There is a **cooldown and a deadband** so it cannot hunt between two
 *    states forever.
 *  - Chunk-load spikes are excluded from the signal, otherwise streaming in a
 *    new region would permanently tank quality.
 */

export type EffectTier = 'minimal' | 'low' | 'medium' | 'high' | 'ultra';

export const EFFECT_TIERS: EffectTier[] = ['minimal', 'low', 'medium', 'high', 'ultra'];

export interface PerformanceBudget {
  /** Frames per second the tuner tries to hold. */
  targetFps: number;
  /** Never scale internal resolution below this fraction. */
  minRenderScale: number;
  maxRenderScale: number;
  /** Chunk radius bounds. */
  minRenderDistance: number;
  maxRenderDistance: number;
  minEffectTier: EffectTier;
  maxEffectTier: EffectTier;
}

export interface PerformanceState {
  renderScale: number;
  renderDistance: number;
  effectTier: EffectTier;
}

export interface PerformanceSample {
  /** Smoothed frames per second. */
  fps: number;
  /** 95th-percentile frame time in ms — the stutter signal. */
  frameTimeP95: number;
  /** Mean frame time in ms. */
  frameTimeMean: number;
  /** How much of the frame budget is being used, 1.0 = exactly on target. */
  budgetUsed: number;
}

export interface PerformanceAdjustment {
  changed: boolean;
  direction: 'up' | 'down' | 'hold';
  state: PerformanceState;
  /** Human-readable explanation, shown in the HUD/console when verbose. */
  reason: string;
}

/** Presets map to a starting point; the tuner moves from there. */
export const BUDGET_PRESETS: Record<string, PerformanceBudget> = {
  performance: {
    targetFps: 60,
    minRenderScale: 0.5, maxRenderScale: 1.0,
    minRenderDistance: 4, maxRenderDistance: 8,
    minEffectTier: 'minimal', maxEffectTier: 'medium',
  },
  balanced: {
    targetFps: 60,
    minRenderScale: 0.62, maxRenderScale: 1.0,
    minRenderDistance: 5, maxRenderDistance: 12,
    minEffectTier: 'low', maxEffectTier: 'high',
  },
  quality: {
    targetFps: 50,
    minRenderScale: 0.72, maxRenderScale: 1.0,
    minRenderDistance: 6, maxRenderDistance: 16,
    minEffectTier: 'medium', maxEffectTier: 'ultra',
  },
  cinematic: {
    targetFps: 40,
    minRenderScale: 0.8, maxRenderScale: 1.0,
    minRenderDistance: 8, maxRenderDistance: 20,
    minEffectTier: 'high', maxEffectTier: 'ultra',
  },
};

/** Frames of history used for the percentile. ~1.5s at 60fps. */
const WINDOW_SIZE = 90;
/** Don't act until the window has this many samples. */
const MIN_SAMPLES = 24;
/** Frame times above this are treated as hitches, not steady-state cost. */
const HITCH_THRESHOLD_MS = 250;
/** Seconds to wait after a downgrade before considering another change. */
const DOWNGRADE_COOLDOWN_S = 0.6;
/** Seconds of comfortable headroom required before upgrading. */
const UPGRADE_COOLDOWN_S = 4.0;
/** Fraction of budget above which we downgrade (1.12 = 12% over budget). */
const DOWNGRADE_THRESHOLD = 1.12;
/** Fraction of budget below which we may upgrade. */
const UPGRADE_THRESHOLD = 0.74;

export class AdaptivePerformance {
  private readonly frameTimes: number[] = [];
  private budget: PerformanceBudget;
  private state: PerformanceState;
  private cooldown = 0;
  private comfortableFor = 0;
  /** Frames to ignore after a deliberate change, so we measure the new state. */
  private settleFrames = 0;
  private lastSample: PerformanceSample = { fps: 60, frameTimeP95: 16.7, frameTimeMean: 16.7, budgetUsed: 1 };

  constructor(budget: PerformanceBudget, initial: PerformanceState) {
    this.budget = budget;
    this.state = {
      renderScale: clamp(initial.renderScale, budget.minRenderScale, budget.maxRenderScale),
      renderDistance: Math.round(clamp(initial.renderDistance, budget.minRenderDistance, budget.maxRenderDistance)),
      effectTier: clampTier(initial.effectTier, budget.minEffectTier, budget.maxEffectTier),
    };
  }

  getState(): PerformanceState {
    return { ...this.state };
  }

  getSample(): PerformanceSample {
    return { ...this.lastSample };
  }

  getBudget(): PerformanceBudget {
    return { ...this.budget };
  }

  /** Swap budgets when the player changes quality preset, keeping current dials in range. */
  setBudget(budget: PerformanceBudget): void {
    this.budget = budget;
    this.state = {
      renderScale: clamp(this.state.renderScale, budget.minRenderScale, budget.maxRenderScale),
      renderDistance: Math.round(clamp(this.state.renderDistance, budget.minRenderDistance, budget.maxRenderDistance)),
      effectTier: clampTier(this.state.effectTier, budget.minEffectTier, budget.maxEffectTier),
    };
    this.reset();
  }

  /** Forget history — call after a teleport, dimension change or preset swap. */
  reset(): void {
    this.frameTimes.length = 0;
    this.cooldown = 0;
    this.comfortableFor = 0;
    this.settleFrames = 20;
  }

  /**
   * Feed one frame.
   *
   * @param deltaMs   Milliseconds the last frame took.
   * @param busyFrame True when this frame did known one-off work (chunk mesh,
   *                  world load, dimension swap). Excluded from the signal so
   *                  streaming does not permanently degrade quality.
   */
  sample(deltaMs: number, busyFrame = false): void {
    if (this.settleFrames > 0) { this.settleFrames -= 1; return; }
    if (busyFrame || deltaMs > HITCH_THRESHOLD_MS || deltaMs <= 0) return;

    this.frameTimes.push(deltaMs);
    if (this.frameTimes.length > WINDOW_SIZE) this.frameTimes.shift();
  }

  /**
   * Decide whether to move a dial. Call once per frame with the frame delta in
   * seconds; it rate-limits itself internally.
   */
  update(deltaSeconds: number): PerformanceAdjustment {
    this.cooldown = Math.max(0, this.cooldown - deltaSeconds);

    if (this.frameTimes.length < MIN_SAMPLES) {
      return { changed: false, direction: 'hold', state: this.getState(), reason: 'Collecting frame samples' };
    }

    const targetFrameMs = 1000 / this.budget.targetFps;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    const budgetUsed = p95 / targetFrameMs;

    this.lastSample = {
      fps: 1000 / mean,
      frameTimeP95: p95,
      frameTimeMean: mean,
      budgetUsed,
    };

    // ---- over budget: shed load immediately -------------------------------
    if (budgetUsed > DOWNGRADE_THRESHOLD) {
      this.comfortableFor = 0;
      if (this.cooldown > 0) {
        return { changed: false, direction: 'hold', state: this.getState(), reason: 'Cooling down after last change' };
      }
      const reason = this.downgrade(budgetUsed);
      if (reason) {
        this.cooldown = DOWNGRADE_COOLDOWN_S;
        this.settleFrames = 20;
        this.frameTimes.length = 0;
        return { changed: true, direction: 'down', state: this.getState(), reason };
      }
      return { changed: false, direction: 'hold', state: this.getState(), reason: 'Already at minimum quality' };
    }

    // ---- comfortably under budget: consider giving quality back -----------
    if (budgetUsed < UPGRADE_THRESHOLD) {
      this.comfortableFor += deltaSeconds;
      if (this.comfortableFor >= UPGRADE_COOLDOWN_S && this.cooldown <= 0) {
        const reason = this.upgrade(budgetUsed);
        if (reason) {
          this.comfortableFor = 0;
          this.cooldown = DOWNGRADE_COOLDOWN_S;
          this.settleFrames = 20;
          this.frameTimes.length = 0;
          return { changed: true, direction: 'up', state: this.getState(), reason };
        }
        this.comfortableFor = 0;
        return { changed: false, direction: 'hold', state: this.getState(), reason: 'Already at maximum quality' };
      }
      return { changed: false, direction: 'hold', state: this.getState(), reason: 'Building confidence before upgrading' };
    }

    // ---- inside the deadband ----------------------------------------------
    this.comfortableFor = 0;
    return { changed: false, direction: 'hold', state: this.getState(), reason: 'Frame time on target' };
  }

  /**
   * Shed load in cost order: resolution first (cheapest to change, biggest
   * effect), then effects, then view distance last — cutting view distance is
   * the most obvious to the player, so it is the last resort.
   */
  private downgrade(budgetUsed: number): string | null {
    // A really severe overrun justifies a bigger resolution step.
    const step = budgetUsed > 1.6 ? 0.12 : 0.06;

    if (this.state.renderScale > this.budget.minRenderScale + 1e-6) {
      const next = Math.max(this.budget.minRenderScale, round2(this.state.renderScale - step));
      this.state.renderScale = next;
      return `Render scale → ${(next * 100).toFixed(0)}% (frame time ${this.lastSample.frameTimeP95.toFixed(1)}ms)`;
    }

    const tierIndex = EFFECT_TIERS.indexOf(this.state.effectTier);
    const minTierIndex = EFFECT_TIERS.indexOf(this.budget.minEffectTier);
    if (tierIndex > minTierIndex) {
      this.state.effectTier = EFFECT_TIERS[tierIndex - 1];
      return `Effects → ${this.state.effectTier}`;
    }

    if (this.state.renderDistance > this.budget.minRenderDistance) {
      this.state.renderDistance -= 1;
      return `Render distance → ${this.state.renderDistance} chunks`;
    }

    return null;
  }

  /** Restore in the reverse order, so the player gets view distance back first. */
  private upgrade(_budgetUsed: number): string | null {
    if (this.state.renderDistance < this.budget.maxRenderDistance) {
      this.state.renderDistance += 1;
      return `Render distance → ${this.state.renderDistance} chunks`;
    }

    const tierIndex = EFFECT_TIERS.indexOf(this.state.effectTier);
    const maxTierIndex = EFFECT_TIERS.indexOf(this.budget.maxEffectTier);
    if (tierIndex < maxTierIndex) {
      this.state.effectTier = EFFECT_TIERS[tierIndex + 1];
      return `Effects → ${this.state.effectTier}`;
    }

    if (this.state.renderScale < this.budget.maxRenderScale - 1e-6) {
      const next = Math.min(this.budget.maxRenderScale, round2(this.state.renderScale + 0.06));
      this.state.renderScale = next;
      return `Render scale → ${(next * 100).toFixed(0)}%`;
    }

    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                            effect tier resolution                          */
/* -------------------------------------------------------------------------- */

export interface EffectSettings {
  shadowsEnabled: boolean;
  shadowMapSize: number;
  bloomEnabled: boolean;
  depthOfFieldEnabled: boolean;
  ssaoEnabled: boolean;
  /** Multiplier on particle emit rates. */
  particleScale: number;
  /** Multiplier on the number of cloud instances. */
  cloudScale: number;
  /** Anti-aliasing samples for the post pipeline. */
  samples: number;
  /** Max creatures simulated at once. */
  creatureScale: number;
}

const EFFECT_SETTINGS: Record<EffectTier, EffectSettings> = {
  minimal: {
    shadowsEnabled: false, shadowMapSize: 512, bloomEnabled: false, depthOfFieldEnabled: false,
    ssaoEnabled: false, particleScale: 0.2, cloudScale: 0.3, samples: 1, creatureScale: 0.5,
  },
  low: {
    shadowsEnabled: false, shadowMapSize: 512, bloomEnabled: true, depthOfFieldEnabled: false,
    ssaoEnabled: false, particleScale: 0.45, cloudScale: 0.55, samples: 1, creatureScale: 0.7,
  },
  medium: {
    shadowsEnabled: true, shadowMapSize: 1024, bloomEnabled: true, depthOfFieldEnabled: false,
    ssaoEnabled: false, particleScale: 0.75, cloudScale: 0.8, samples: 2, creatureScale: 1.0,
  },
  high: {
    shadowsEnabled: true, shadowMapSize: 2048, bloomEnabled: true, depthOfFieldEnabled: false,
    ssaoEnabled: true, particleScale: 1.0, cloudScale: 1.0, samples: 2, creatureScale: 1.15,
  },
  ultra: {
    shadowsEnabled: true, shadowMapSize: 4096, bloomEnabled: true, depthOfFieldEnabled: true,
    ssaoEnabled: true, particleScale: 1.3, cloudScale: 1.25, samples: 4, creatureScale: 1.35,
  },
};

export function effectSettingsFor(tier: EffectTier): EffectSettings {
  return { ...EFFECT_SETTINGS[tier] };
}

/* -------------------------------------------------------------------------- */

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampTier(tier: EffectTier, min: EffectTier, max: EffectTier): EffectTier {
  const index = EFFECT_TIERS.indexOf(tier);
  const minIndex = EFFECT_TIERS.indexOf(min);
  const maxIndex = EFFECT_TIERS.indexOf(max);
  return EFFECT_TIERS[clamp(index, minIndex, maxIndex)];
}

export default AdaptivePerformance;

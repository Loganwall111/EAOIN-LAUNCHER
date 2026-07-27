/**
 * VoidLeviathan — the boss at the bottom of the black hole.
 *
 * This is the encounter the release notes previously listed as "not yet
 * built": the chip and the black-hole entry existed, but nothing was waiting
 * on the other side. This is the fight.
 *
 * Design:
 *
 *   Phase 1 — THE APPROACH   (100% → 70%)  Two tentacles. Slow sweeps.
 *   Phase 2 — THE GRASP      (70%  → 40%)  Four tentacles, faster, it grabs.
 *   Phase 3 — THE MAW        (40%  → 15%)  Six tentacles + the core opens and
 *                                          fires a void beam. The core is only
 *                                          vulnerable while the maw is open.
 *   Phase 4 — COLLAPSE       (15%  →  0%)  All eight tentacles thrash, the
 *                                          arena contracts, and the thing
 *                                          starts pulling reality in with it.
 *
 * The mechanic that makes it a fight rather than a damage sponge: **the core
 * is armoured except when the maw is open**, and the maw only opens after it
 * has performed a tentacle slam. So you bait a slam, dodge it, then punish.
 *
 * Everything here is deterministic given (seed, elapsed) so a replay or a
 * server-authoritative run produces the same encounter.
 */
import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';

export type LeviathanPhase = 1 | 2 | 3 | 4;

export type LeviathanEventKind =
  | 'spawned'
  | 'phase'
  | 'slam'
  | 'maw_open'
  | 'maw_close'
  | 'beam'
  | 'grab'
  | 'hit'
  | 'core_hit'
  | 'defeated';

export interface LeviathanEvent {
  kind: LeviathanEventKind;
  message: string;
  /** Damage to apply to the player, if any. */
  damage?: number;
  phase?: LeviathanPhase;
}

export interface LeviathanSnapshot {
  active: boolean;
  health: number;
  maxHealth: number;
  phase: LeviathanPhase;
  phaseName: string;
  /** True while the core can be damaged. */
  vulnerable: boolean;
  /** 0-1 how open the maw is, for the HUD. */
  mawOpen: number;
  tentacleCount: number;
  /** Distance from the player to the core. */
  distance: number;
}

const MAX_HEALTH = 4_000;
/** The core is only damageable while the maw is open. */
const CORE_DAMAGE_MULTIPLIER = 3.0;
/** Chip damage to armoured plating — deliberately poor, to teach the mechanic. */
const ARMOURED_DAMAGE_MULTIPLIER = 0.15;

const PHASE_NAMES: Record<LeviathanPhase, string> = {
  1: 'The Approach',
  2: 'The Grasp',
  3: 'The Maw',
  4: 'Collapse',
};

interface Tentacle {
  root: TransformNode;
  segments: Mesh[];
  /** Phase offset so they do not move in lockstep. */
  phase: number;
  /** Base angle around the core. */
  angle: number;
  length: number;
  /** Counts down while this tentacle is mid-slam. */
  slamTimer: number;
}

export class VoidLeviathan {
  private root: TransformNode | null = null;
  private core: Mesh | null = null;
  private maw: Mesh | null = null;
  private readonly tentacles: Tentacle[] = [];

  private active = false;
  private health = MAX_HEALTH;
  private phase: LeviathanPhase = 1;
  private elapsed = 0;
  /** Seconds until the next scripted attack. */
  private attackTimer = 4;
  /** Seconds the maw stays open after a slam. */
  private mawTimer = 0;
  private grabbedFor = 0;
  private defeated = false;

  position = new Vector3(0, -30, 0);

  /** Raised for every notable beat, so the HUD/audio can react. */
  onEvent: ((event: LeviathanEvent) => void) | null = null;

  constructor(private readonly scene: Scene, private readonly seed: string) {}

  /* ------------------------------------------------------------------ */
  /* lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  isActive(): boolean {
    return this.active;
  }

  isDefeated(): boolean {
    return this.defeated;
  }

  /** Summon the boss around a point — normally where the player fell in. */
  spawn(near: Vector3): void {
    if (this.active) return;
    this.dispose();

    this.active = true;
    this.defeated = false;
    this.health = MAX_HEALTH;
    this.phase = 1;
    this.elapsed = 0;
    this.attackTimer = 4;
    this.mawTimer = 0;
    this.grabbedFor = 0;
    this.position.copyFrom(near).addInPlace(new Vector3(0, -14, 34));

    this.root = new TransformNode('void_leviathan', this.scene);
    this.root.position.copyFrom(this.position);

    // --- the core ------------------------------------------------------
    const coreMaterial = new StandardMaterial('leviathan_core_mat', this.scene);
    coreMaterial.diffuseColor = new Color3(0.04, 0.02, 0.09);
    coreMaterial.emissiveColor = new Color3(0.22, 0.05, 0.42);
    coreMaterial.specularColor = new Color3(0.4, 0.2, 0.6);

    this.core = MeshBuilder.CreateIcoSphere('leviathan_core', { radius: 7, subdivisions: 3 }, this.scene);
    this.core.parent = this.root;
    this.core.material = coreMaterial;
    this.core.metadata = { leviathanPart: 'core' };

    // --- the maw, hidden inside until it opens --------------------------
    const mawMaterial = new StandardMaterial('leviathan_maw_mat', this.scene);
    mawMaterial.diffuseColor = new Color3(0.5, 0.02, 0.02);
    mawMaterial.emissiveColor = new Color3(0.9, 0.15, 0.05);
    this.maw = MeshBuilder.CreateSphere('leviathan_maw', { diameter: 6.4, segments: 12 }, this.scene);
    this.maw.parent = this.root;
    this.maw.material = mawMaterial;
    this.maw.scaling.setAll(0.01);
    this.maw.metadata = { leviathanPart: 'maw' };

    this.buildTentacles(2);
    this.emit({ kind: 'spawned', message: 'THE VOID LEVIATHAN STIRS.', phase: 1 });
    this.emit({ kind: 'phase', message: `Phase 1 — ${PHASE_NAMES[1]}`, phase: 1 });
  }

  dispose(): void {
    for (const tentacle of this.tentacles) {
      for (const segment of tentacle.segments) segment.dispose();
      tentacle.root.dispose();
    }
    this.tentacles.length = 0;
    this.core?.dispose(); this.core = null;
    this.maw?.dispose(); this.maw = null;
    this.root?.dispose(); this.root = null;
    this.active = false;
  }

  /* ------------------------------------------------------------------ */
  /* combat                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Damage the boss.
   *
   * The whole fight hinges on this: hitting the armoured shell barely scratches
   * it, hitting the open maw does triple damage. Players who never work that
   * out will run out of patience long before the boss runs out of health,
   * which is the intended lesson.
   */
  damage(amount: number, hitPart: 'core' | 'maw' | 'tentacle' = 'core'): LeviathanEvent {
    if (!this.active || this.defeated) {
      return { kind: 'hit', message: 'Nothing there to hit.' };
    }

    const vulnerable = this.mawTimer > 0;
    let multiplier = ARMOURED_DAMAGE_MULTIPLIER;
    if (hitPart === 'maw' && vulnerable) multiplier = CORE_DAMAGE_MULTIPLIER;
    else if (hitPart === 'tentacle') multiplier = 0.6;

    const dealt = Math.max(1, Math.round(amount * multiplier));
    this.health = Math.max(0, this.health - dealt);

    if (this.health <= 0) {
      this.defeated = true;
      this.active = false;
      const event: LeviathanEvent = {
        kind: 'defeated',
        message: 'THE VOID LEVIATHAN COLLAPSES INWARD. The Reality Chip is yours.',
      };
      this.emit(event);
      return event;
    }

    this.advancePhaseIfNeeded();

    const event: LeviathanEvent = multiplier >= CORE_DAMAGE_MULTIPLIER
      ? { kind: 'core_hit', message: `CRITICAL — ${dealt} to the exposed core! (${this.healthPercent()}%)` }
      : { kind: 'hit', message: `${dealt} damage — the plating absorbs most of it. Wait for the maw. (${this.healthPercent()}%)` };
    this.emit(event);
    return event;
  }

  private healthPercent(): number {
    return Math.ceil((this.health / MAX_HEALTH) * 100);
  }

  private advancePhaseIfNeeded(): void {
    const fraction = this.health / MAX_HEALTH;
    const next: LeviathanPhase =
      fraction > 0.70 ? 1 :
      fraction > 0.40 ? 2 :
      fraction > 0.15 ? 3 : 4;

    if (next === this.phase) return;
    this.phase = next;

    const tentacleTarget = next === 1 ? 2 : next === 2 ? 4 : next === 3 ? 6 : 8;
    this.buildTentacles(tentacleTarget);
    // Each phase escalates the tempo.
    this.attackTimer = Math.min(this.attackTimer, 2.5);

    this.emit({ kind: 'phase', message: `Phase ${next} — ${PHASE_NAMES[next]}`, phase: next });
  }

  /* ------------------------------------------------------------------ */
  /* per-frame                                                           */
  /* ------------------------------------------------------------------ */

  update(deltaSeconds: number, playerPosition: Vector3): LeviathanSnapshot {
    if (!this.active || !this.root) {
      return {
        active: false, health: this.health, maxHealth: MAX_HEALTH,
        phase: this.phase, phaseName: PHASE_NAMES[this.phase],
        vulnerable: false, mawOpen: 0, tentacleCount: 0, distance: Infinity,
      };
    }

    this.elapsed += deltaSeconds;

    // Drift toward the player, faster in later phases.
    const chaseSpeed = 1.2 + this.phase * 0.8;
    const toPlayer = playerPosition.subtract(this.root.position);
    const distance = toPlayer.length();
    if (distance > 26) {
      this.root.position.addInPlace(toPlayer.normalize().scale(chaseSpeed * deltaSeconds));
    }
    // Slow menacing rotation.
    this.root.rotation.y += deltaSeconds * 0.12 * this.phase;
    this.position.copyFrom(this.root.position);

    this.animateTentacles(deltaSeconds, playerPosition);

    // --- maw timing ------------------------------------------------------
    if (this.mawTimer > 0) {
      this.mawTimer -= deltaSeconds;
      const openness = Math.min(1, this.mawTimer / 0.6);
      if (this.maw) this.maw.scaling.setAll(0.01 + openness * 1.15);
      if (this.mawTimer <= 0) {
        if (this.maw) this.maw.scaling.setAll(0.01);
        this.emit({ kind: 'maw_close', message: 'The maw seals. Plating back in place.' });
      }
    }

    // --- grabbed ---------------------------------------------------------
    if (this.grabbedFor > 0) {
      this.grabbedFor -= deltaSeconds;
    }

    // --- attack scheduling ----------------------------------------------
    this.attackTimer -= deltaSeconds;
    if (this.attackTimer <= 0) {
      this.chooseAttack(distance);
      // Later phases attack more often.
      this.attackTimer = Math.max(1.6, 6.0 - this.phase * 1.1);
    }

    return {
      active: true,
      health: this.health,
      maxHealth: MAX_HEALTH,
      phase: this.phase,
      phaseName: PHASE_NAMES[this.phase],
      vulnerable: this.mawTimer > 0,
      mawOpen: this.mawTimer > 0 ? Math.min(1, this.mawTimer / 0.6) : 0,
      tentacleCount: this.tentacles.length,
      distance,
    };
  }

  /**
   * Pick the next attack.
   *
   * A slam always precedes the maw opening — that is the tell the player
   * learns to read and punish.
   */
  private chooseAttack(distance: number): void {
    const roll = this.hash(`attack:${Math.floor(this.elapsed * 10)}`);

    // Phase 3+ can fire the void beam at range.
    if (this.phase >= 3 && distance > 30 && roll > 0.62) {
      this.emit({
        kind: 'beam',
        message: 'VOID BEAM — get behind something.',
        damage: 18 + this.phase * 4,
      });
      return;
    }

    // Phase 2+ can grab if you are close.
    if (this.phase >= 2 && distance < 18 && roll > 0.74) {
      this.grabbedFor = 1.6;
      this.emit({
        kind: 'grab',
        message: 'A tentacle coils around you — break free!',
        damage: 10 + this.phase * 3,
      });
      return;
    }

    // The bread-and-butter slam, which then exposes the core.
    const target = this.tentacles[Math.floor(roll * this.tentacles.length) % Math.max(1, this.tentacles.length)];
    if (target) target.slamTimer = 0.9;

    this.emit({
      kind: 'slam',
      message: 'TENTACLE SLAM — dodge, then strike the maw.',
      damage: distance < 22 ? 12 + this.phase * 4 : 0,
    });

    // The recovery window: the maw hangs open and the core is exposed.
    const openDuration = Math.max(1.4, 3.2 - this.phase * 0.35);
    this.mawTimer = openDuration;
    this.emit({ kind: 'maw_open', message: 'The maw yawns open — THE CORE IS EXPOSED.' });
  }

  /* ------------------------------------------------------------------ */
  /* presentation                                                        */
  /* ------------------------------------------------------------------ */

  /** Grow or shrink the tentacle set to `count`. */
  private buildTentacles(count: number): void {
    while (this.tentacles.length > count) {
      const removed = this.tentacles.pop();
      if (!removed) break;
      for (const segment of removed.segments) segment.dispose();
      removed.root.dispose();
    }
    if (!this.root) return;

    const material = new StandardMaterial('leviathan_tentacle_mat', this.scene);
    material.diffuseColor = new Color3(0.06, 0.03, 0.12);
    material.emissiveColor = new Color3(0.10, 0.02, 0.20);

    while (this.tentacles.length < count) {
      const index = this.tentacles.length;
      const angle = (index / Math.max(1, count)) * Math.PI * 2;
      const root = new TransformNode(`leviathan_tentacle_${index}`, this.scene);
      root.parent = this.root;

      const segments: Mesh[] = [];
      const segmentCount = 7;
      for (let s = 0; s < segmentCount; s += 1) {
        const taper = 1 - s / segmentCount;
        const segment = MeshBuilder.CreateBox(
          `leviathan_tentacle_${index}_seg_${s}`,
          { width: 1.6 * taper + 0.4, height: 1.6 * taper + 0.4, depth: 3.2 },
          this.scene
        );
        segment.parent = root;
        segment.material = material;
        segment.position.z = s * 3.0;
        segment.metadata = { leviathanPart: 'tentacle' };
        segments.push(segment);
      }

      this.tentacles.push({
        root,
        segments,
        phase: this.hash(`tentacle:${index}`) * Math.PI * 2,
        angle,
        length: segmentCount * 3.0,
        slamTimer: 0,
      });
    }

    // Re-space existing tentacles evenly after a count change.
    this.tentacles.forEach((tentacle, index) => {
      tentacle.angle = (index / Math.max(1, this.tentacles.length)) * Math.PI * 2;
    });
  }

  /** Sinuous idle motion, with a fast overhead strike when slamming. */
  private animateTentacles(deltaSeconds: number, playerPosition: Vector3): void {
    for (const tentacle of this.tentacles) {
      const speed = 0.6 + this.phase * 0.25;
      const wave = this.elapsed * speed + tentacle.phase;

      tentacle.root.rotation.y = tentacle.angle + Math.sin(wave * 0.5) * 0.35;

      if (tentacle.slamTimer > 0) {
        tentacle.slamTimer -= deltaSeconds;
        // Whip down hard, then ease back.
        const t = 1 - Math.max(0, tentacle.slamTimer / 0.9);
        tentacle.root.rotation.x = -1.2 + t * 2.4;
      } else {
        tentacle.root.rotation.x = Math.sin(wave * 0.7) * 0.4 - 0.2;
      }

      // Each segment lags the one before it, which is what sells the sinuous
      // motion — a rigid rotation would read as a swinging plank.
      tentacle.segments.forEach((segment, s) => {
        const lag = wave - s * 0.45;
        segment.rotation.x = Math.sin(lag) * 0.22;
        segment.rotation.y = Math.cos(lag * 0.8) * 0.18;
      });

      void playerPosition;
    }
  }

  private emit(event: LeviathanEvent): void {
    try { this.onEvent?.(event); } catch { /* a bad listener must not break the fight */ }
  }

  /** Deterministic per-seed hash so encounters replay identically. */
  private hash(input: string): number {
    let h = 2166136261;
    const text = `${this.seed}:${input}`;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 0xffffffff;
  }
}

export default VoidLeviathan;

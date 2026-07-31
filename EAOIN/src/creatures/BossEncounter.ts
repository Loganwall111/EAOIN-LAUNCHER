/**
 * BossEncounter — makes the 38 entries in `BossRegistry` actually fightable.
 *
 * ## Why this exists
 *
 * `BossRegistry.ts` defines 38 bosses with health, damage, phases, abilities,
 * arenas and drops. Before this file, the only thing that imported it was
 * `HUD.tsx`, which listed them in a menu. **No boss could ever be fought** —
 * exactly the same dead-data problem the wildlife roster had.
 *
 * This runtime turns a `BossDef` into a real encounter:
 *
 *   - a scaled body built from the def's own `size` and `color`
 *   - a **phase system**: crossing a health threshold advances the phase,
 *     which raises damage, speeds up attacks and announces itself
 *   - **abilities on cooldown**, chosen from the def's own ability list, with
 *     real mechanical effects (melee slam, ranged volley, area pulse, summon)
 *   - a **health bar** feed for the HUD
 *   - **loot on death**, drawn from the def's drop list
 *
 * Everything is driven from the registry, so adding a boss stays a one-entry
 * change and all 38 work without bespoke code each.
 */
import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import { BossDef } from './BossRegistry';

/** What an ability did this tick, so the engine can react. */
export interface BossAbilityEvent {
  kind: 'melee' | 'projectile' | 'pulse' | 'summon';
  name: string;
  /** Damage to apply to the player, already distance-checked. */
  damage: number;
  /** Where the effect happened, for particles/audio. */
  position: Vector3;
  /** For 'summon': the species id to spawn, and how many. */
  summonSpecies?: string;
  summonCount?: number;
}

export interface BossState {
  def: BossDef;
  health: number;
  maxHealth: number;
  /** 1-based, up to `def.phases`. */
  phase: number;
  alive: boolean;
}

/** Minion species summoned per boss tier, themed to the roster. */
const SUMMON_BY_DIMENSION: Record<string, string> = {
  overworld: 'husk_wanderer',
  nether: 'ember_imp',
  end: 'shard_sentinel',
  volcanic_realm: 'ash_walker',
  frozen_wasteland: 'rime_lurker',
  crystal_realm: 'crystal_crawler',
  sky_kingdom: 'storm_harrier',
  ocean_world: 'tide_serpent',
  cosmic_void: 'void_drifter',
  machine_dimension: 'scrap_drone',
  prehistoric_world: 'raptor',
  toxic_wasteland: 'toxin_hound',
  undead_realm: 'bone_archer',
  spirit_realm: 'soul_wisp',
  ancient_civilization: 'rune_golem',
};

/**
 * Classify an ability name into a mechanic.
 *
 * The registry's abilities are flavour strings ("Wither Skull", "Tail Whip",
 * "Meteor Rain"). Rather than a 150-entry lookup, keywords map them onto the
 * four mechanics the runtime implements, so every boss's listed abilities do
 * something appropriate without hand-wiring each one.
 */
export function classifyAbility(name: string): BossAbilityEvent['kind'] {
  const n = name.toLowerCase();
  if (/summon|spawn|swarm|clone|raise|drone|egg|vex/.test(n)) return 'summon';
  if (/beam|bolt|skull|breath|spit|lance|missile|cannon|laser|shard|meteor|flare|lightning|ball/.test(n)) return 'projectile';
  if (/aura|wave|storm|pulse|blizzard|quake|nova|cloud|field|shield|roar|surge|erasure|collapse/.test(n)) return 'pulse';
  return 'melee';
}

/** Reach and base cooldown per mechanic. */
const ABILITY_PROFILE: Record<BossAbilityEvent['kind'], { reach: number; cooldownMs: number; scale: number }> = {
  melee: { reach: 4.5, cooldownMs: 1500, scale: 1.0 },
  projectile: { reach: 34, cooldownMs: 2400, scale: 0.75 },
  pulse: { reach: 12, cooldownMs: 4200, scale: 0.9 },
  summon: { reach: 40, cooldownMs: 9000, scale: 0 },
};

export class BossEncounter {
  private readonly root: TransformNode;
  private readonly parts: Mesh[] = [];
  private readonly materials: StandardMaterial[] = [];
  private health: number;
  private phase = 1;
  private alive = true;
  /** Next time each ability index may fire. */
  private readonly readyAt: number[];
  private bobPhase = 0;

  /** Fires when an ability resolves. */
  onAbility?: (event: BossAbilityEvent) => void;
  /** Fires when the boss changes phase. */
  onPhase?: (phase: number, def: BossDef) => void;
  /** Fires once on death, with the drop list from the registry. */
  onDefeated?: (def: BossDef, position: Vector3) => void;

  constructor(
    private readonly scene: Scene,
    readonly def: BossDef,
    spawnPosition: Vector3
  ) {
    this.health = def.health;
    this.readyAt = def.abilities.map(() => 0);

    this.root = new TransformNode(`boss_${def.id}`, scene);
    this.root.position = spawnPosition.clone();
    this.buildBody();
  }

  /* ---------------------------------------------------------------- */

  getState(): BossState {
    return {
      def: this.def,
      health: this.health,
      maxHealth: this.def.health,
      phase: this.phase,
      alive: this.alive,
    };
  }

  getPosition(): Vector3 {
    return this.root.position;
  }

  isAlive(): boolean {
    return this.alive;
  }

  /** Apply player damage. Returns the resulting state for the HUD. */
  damage(amount: number): { dead: boolean; phaseChanged: boolean; health: number } {
    if (!this.alive) return { dead: true, phaseChanged: false, health: 0 };

    this.health = Math.max(0, this.health - amount);

    // Hit feedback.
    this.root.scaling.setAll(1.04);
    window.setTimeout(() => {
      if (!this.root.isDisposed()) this.root.scaling.setAll(1);
    }, 80);

    // Phases are evenly spaced health bands: a 3-phase boss changes at 66%
    // and 33%. Derived from the def so every boss's `phases` count is honoured.
    const fraction = this.health / this.def.health;
    const nextPhase = Math.min(
      this.def.phases,
      Math.max(1, Math.ceil((1 - fraction) * this.def.phases) || 1)
    );
    let phaseChanged = false;
    if (nextPhase > this.phase) {
      this.phase = nextPhase;
      phaseChanged = true;
      this.onPhase?.(this.phase, this.def);
      // Each phase visibly changes the boss, so escalation is legible.
      this.applyPhaseAppearance();
    }

    if (this.health <= 0) {
      this.alive = false;
      this.onDefeated?.(this.def, this.root.position.clone());
    }

    return { dead: !this.alive, phaseChanged, health: this.health };
  }

  /**
   * Advance the fight.
   *
   * Moves toward the player, then fires whichever abilities are off cooldown
   * and in range. Cooldowns shorten with each phase.
   */
  update(deltaSeconds: number, playerPosition: Vector3): void {
    if (!this.alive) return;

    const now = performance.now();
    const toPlayer = playerPosition.subtract(this.root.position);
    const distance = toPlayer.length();

    // --- movement ---------------------------------------------------------
    // Bosses close distance but stop at melee range so they do not stand
    // inside the player.
    const speed = 1.4 + this.phase * 0.35;
    if (distance > 3.2) {
      const step = Math.min(distance - 3.0, speed * deltaSeconds);
      const direction = toPlayer.normalize();
      this.root.position.addInPlace(direction.scale(step));
    }
    // Always face the player.
    this.root.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    // A slow hover/breathe so a boss never looks like a static prop.
    this.bobPhase += deltaSeconds * (1.2 + this.phase * 0.3);
    this.root.position.y += Math.sin(this.bobPhase) * 0.004 * this.def.size.height;

    // --- abilities --------------------------------------------------------
    for (let i = 0; i < this.def.abilities.length; i += 1) {
      if (now < this.readyAt[i]) continue;

      const name = this.def.abilities[i];
      const kind = classifyAbility(name);
      const profile = ABILITY_PROFILE[kind];
      if (distance > profile.reach) continue;

      // Later phases attack faster — the standard escalation.
      const cooldown = profile.cooldownMs / (1 + (this.phase - 1) * 0.28);
      this.readyAt[i] = now + cooldown;

      const damage = Math.round(this.def.damage * profile.scale * (1 + (this.phase - 1) * 0.18));

      this.onAbility?.({
        kind,
        name,
        damage,
        position: this.root.position.clone(),
        summonSpecies: kind === 'summon'
          ? SUMMON_BY_DIMENSION[this.def.dimension] ?? 'husk_wanderer'
          : undefined,
        summonCount: kind === 'summon' ? 1 + this.phase : undefined,
      });
    }
  }

  dispose(): void {
    for (const part of this.parts) part.dispose();
    for (const material of this.materials) material.dispose();
    this.parts.length = 0;
    this.materials.length = 0;
    this.root.dispose();
  }

  /* ---------------------------------------------------------------- */

  /**
   * Build the boss body from its registry `size` and `color`.
   *
   * Deliberately generic: a core mass, a head, and tier-scaled detail, so all
   * 38 bosses get a readable silhouette proportional to their declared size
   * without a bespoke model each.
   */
  private buildBody(): void {
    const { width, height, depth } = this.def.size;
    const base = Color3.FromHexString(this.def.color);

    const bodyMat = this.material(`boss_${this.def.id}_body`, base, 0.28);
    const accentMat = this.material(
      `boss_${this.def.id}_accent`,
      Color3.Lerp(base, new Color3(1, 1, 1), 0.35),
      0.5
    );

    const core = MeshBuilder.CreateBox(`boss_${this.def.id}_core`, {
      width, height: height * 0.62, depth,
    }, this.scene);
    core.parent = this.root;
    core.position.y = height * 0.45;
    core.material = bodyMat;
    this.parts.push(core);

    const head = MeshBuilder.CreateBox(`boss_${this.def.id}_head`, {
      width: width * 0.5, height: height * 0.3, depth: depth * 0.5,
    }, this.scene);
    head.parent = this.root;
    head.position = new Vector3(0, height * 0.88, depth * 0.22);
    head.material = accentMat;
    this.parts.push(head);

    // Eyes — emissive, because a boss should be visible in a dark arena.
    const eyeMat = this.material(`boss_${this.def.id}_eye`, new Color3(1, 0.25, 0.15), 1.0);
    for (const side of [-1, 1]) {
      const eye = MeshBuilder.CreateBox(`boss_${this.def.id}_eye`, {
        width: width * 0.1, height: height * 0.05, depth: depth * 0.06,
      }, this.scene);
      eye.parent = head;
      eye.position = new Vector3(side * width * 0.14, height * 0.04, depth * 0.26);
      eye.material = eyeMat;
      this.parts.push(eye);
    }

    // Limbs, sized off the body so a 80-wide Planet Devourer and a 1.2-wide
    // Shadow King both look proportionate.
    for (const side of [-1, 1]) {
      const limb = MeshBuilder.CreateBox(`boss_${this.def.id}_limb`, {
        width: width * 0.18, height: height * 0.5, depth: depth * 0.18,
      }, this.scene);
      limb.parent = this.root;
      limb.position = new Vector3(side * width * 0.6, height * 0.28, 0);
      limb.material = bodyMat;
      this.parts.push(limb);
    }

    // --- NEXT-GEN premium boss silhouette detail ---------------------------
    // Static, higher-density geometry that makes the Earth Eater and every boss
    // read as a menacing, sculpted creature instead of a cube stack. Parented
    // to `head`/`core` so it rides the existing animation, tagged with the same
    // `bossId`, and never referenced by phase/ability logic — behaviour and the
    // damage/phase maths are untouched.
    const jaw = MeshBuilder.CreateBox(`boss_${this.def.id}_jaw`, {
      width: width * 0.42, height: height * 0.1, depth: depth * 0.4,
    }, this.scene);
    jaw.parent = head;
    jaw.position = new Vector3(0, -height * 0.14, depth * 0.24);
    jaw.material = accentMat;
    this.parts.push(jaw);

    for (const side of [-1, 1]) {
      const brow = MeshBuilder.CreateBox(`boss_${this.def.id}_brow`, {
        width: width * 0.16, height: height * 0.06, depth: depth * 0.14,
      }, this.scene);
      brow.parent = head;
      brow.position = new Vector3(side * width * 0.14, height * 0.12, depth * 0.24);
      brow.material = bodyMat;
      this.parts.push(brow);
    }

    // Dorsal armour plates down the back — the Earth Eater's signature ridge.
    for (const dz of [-0.22, 0, 0.22]) {
      const plate = MeshBuilder.CreateBox(`boss_${this.def.id}_plate`, {
        width: width * 0.24, height: height * 0.16, depth: depth * 0.14,
      }, this.scene);
      plate.parent = core;
      plate.position = new Vector3(0, height * 0.34, depth * dz);
      plate.material = accentMat;
      this.parts.push(plate);
    }

    for (const part of this.parts) {
      part.isPickable = true;
      part.checkCollisions = false;
      // The engine picks by this, exactly like creatures.
      part.metadata = { bossId: this.def.id };
    }
  }

  /** Each phase makes the boss angrier-looking. */
  private applyPhaseAppearance(): void {
    const intensity = Math.min(1, (this.phase - 1) / Math.max(1, this.def.phases - 1));
    for (const material of this.materials) {
      // Push emissive toward red as the fight escalates.
      material.emissiveColor = Color3.Lerp(
        material.emissiveColor,
        new Color3(0.8, 0.12, 0.08),
        intensity * 0.5
      );
    }
  }

  private material(name: string, color: Color3, emissive: number): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = color;
    material.emissiveColor = color.scale(emissive);
    material.specularColor = new Color3(0.05, 0.05, 0.05);
    this.materials.push(material);
    return material;
  }
}

export default BossEncounter;

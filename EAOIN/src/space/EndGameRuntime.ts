/**
 * EndGameRuntime — connects the end-game chain into one driven sequence.
 *
 * These pieces all existed and were tested individually, but nothing joined
 * them up, so in a real session none of it ever happened. This is the wiring:
 *
 *     black hole spawns  →  player crosses the horizon
 *                        →  dropped into the void
 *                        →  VOID LEVIATHAN fight
 *                        →  defeated
 *                        →  Reality Chip drops
 *                        →  implant it for 12 powers
 *
 * It also owns the ocean hookup (depth zones, waves, whirlpool forces and the
 * Bloop), because that shares the same "systems existed, nothing called them"
 * problem and the same per-frame budget.
 */
import { Camera, Scene, Vector3 } from '@babylonjs/core';
import { BlackHoleEncounter } from './BlackHoleEncounter';
import { VoidLeviathan, LeviathanEvent, LeviathanSnapshot } from './VoidLeviathan';
import { ChipState, acquireChip, createChipState, tickChip } from './RealityChip';
import {
  Bloop,
  OceanState,
  oceanStateForDepth,
  waveHeightAt,
  whirlpoolForce,
  whirlpoolNear,
  Whirlpool,
} from '../world/OceanSystem';

export interface EndGameOptions {
  seed: string;
  seaLevel: number;
}

export interface EndGameFrame {
  /** Ocean state at the player's depth; null when not near/under water. */
  ocean: OceanState | null;
  /** Wave surface height at the player's XZ, for boats and the shoreline. */
  waveHeight: number;
  /** The whirlpool currently affecting the player, if any. */
  whirlpool: Whirlpool | null;
  /** Velocity the whirlpool is imparting this frame. */
  whirlpoolForce: Vector3;
  /** 0-1 how loud the Bloop's call is. */
  bloopProximity: number;
  /** Live boss state; null when the Leviathan is not present. */
  leviathan: LeviathanSnapshot | null;
  chip: ChipState;
}

export type EndGameMessage = (text: string) => void;

export class EndGameRuntime {
  private readonly blackHole: BlackHoleEncounter;
  private readonly leviathan: VoidLeviathan;
  private readonly bloop: Bloop;
  private chip: ChipState = createChipState();

  /** Set once the player has been consumed and the fight has begun. */
  private inVoid = false;
  private chipDropped = false;
  /** Throttles the whirlpool warning so it does not spam every frame. */
  private whirlpoolWarned = false;
  private lastBloopCall = 0;

  onMessage: EndGameMessage | null = null;
  /** Raised when the player takes damage from a boss attack. */
  onPlayerDamage: ((amount: number, source: string) => void) | null = null;
  /** Raised when the player should be teleported into the void arena. */
  onEnterVoid: ((arenaCenter: Vector3) => void) | null = null;

  constructor(
    scene: Scene,
    camera: Camera,
    private readonly options: EndGameOptions
  ) {
    this.blackHole = new BlackHoleEncounter(scene, camera);
    // The late-game End black hole is the big Interstellar gargantua.
    this.blackHole.style = 'gargantua';
    this.leviathan = new VoidLeviathan(scene, options.seed);
    this.bloop = new Bloop(scene, options.seed);

    // --- the chain -------------------------------------------------------
    this.blackHole.onConsumed = () => this.enterVoid();
    this.leviathan.onEvent = (event) => this.handleLeviathanEvent(event);
    this.bloop.onSwallow = () => {
      this.say('THE BLOOP SWALLOWS YOU WHOLE. Everything goes dark, then wet.');
    };
  }

  attach(): void {
    this.blackHole.attach();
  }

  /* ------------------------------------------------------------------ */
  /* black hole → void → boss                                            */
  /* ------------------------------------------------------------------ */

  /** Summon the black hole. Normally triggered by late-game progression. */
  spawnBlackHole(position: Vector3): void {
    this.blackHole.spawn(position);
    this.say('A BLACK HOLE TEARS OPEN. Do not go near it. Or do.');
  }

  isBlackHoleActive(): boolean {
    return this.blackHole.isActive();
  }

  /** Called when the player crosses the event horizon. */
  private enterVoid(): void {
    if (this.inVoid) return;
    this.inVoid = true;

    const arena = new Vector3(0, 60, 0);
    this.say('You fall through. There is no bottom — and something down here is waiting.');
    this.onEnterVoid?.(arena);
    this.leviathan.spawn(arena);
  }

  /** Start the boss directly, for testing and for the `/leviathan` command. */
  summonLeviathan(near: Vector3): void {
    this.inVoid = true;
    this.leviathan.spawn(near);
  }

  /** Damage the boss. `part` decides whether the hit actually matters. */
  damageLeviathan(amount: number, part: 'core' | 'maw' | 'tentacle' = 'core'): LeviathanEvent {
    return this.leviathan.damage(amount, part);
  }

  isLeviathanActive(): boolean {
    return this.leviathan.isActive();
  }

  private handleLeviathanEvent(event: LeviathanEvent): void {
    this.say(event.message);
    if (event.damage && event.damage > 0) {
      this.onPlayerDamage?.(event.damage, 'Void Leviathan');
    }
    if (event.kind === 'defeated' && !this.chipDropped) {
      this.chipDropped = true;
      const result = acquireChip(this.chip);
      this.chip = result.state;
      this.say(result.message);
      this.say('Press J to implant the Reality Chip. Twelve powers come online.');
    }
  }

  /* ------------------------------------------------------------------ */
  /* the chip                                                            */
  /* ------------------------------------------------------------------ */

  getChip(): ChipState {
    return this.chip;
  }

  setChip(state: ChipState): void {
    this.chip = state;
  }

  /* ------------------------------------------------------------------ */
  /* per-frame                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Advance every end-game system.
   *
   * @param playerPosition mutated in place by the black hole's pull and by
   *        whirlpool drag, so the player really is moved by them.
   */
  update(deltaSeconds: number, playerPosition: Vector3, submergedBlockId: number): EndGameFrame {
    const { seaLevel } = this.options;

    // --- black hole ------------------------------------------------------
    this.blackHole.update(deltaSeconds, playerPosition);

    // --- boss ------------------------------------------------------------
    const leviathan = this.leviathan.isActive()
      ? this.leviathan.update(deltaSeconds, playerPosition)
      : null;

    // --- chip cooldowns --------------------------------------------------
    this.chip = tickChip(this.chip, deltaSeconds);

    // --- ocean -----------------------------------------------------------
    const submerged = submergedBlockId === 5;
    const depthBelowSea = seaLevel - playerPosition.y;
    const ocean = (submerged || depthBelowSea > 0)
      ? oceanStateForDepth(Math.max(0, depthBelowSea), submerged)
      : null;

    const time = performance.now() / 1000;
    const waveHeight = waveHeightAt(playerPosition.x, playerPosition.z, time);

    // --- whirlpools ------------------------------------------------------
    let force = Vector3.Zero();
    const pool = submerged
      ? whirlpoolNear(playerPosition.x, playerPosition.z, this.options.seed, seaLevel)
      : null;

    if (pool) {
      force = whirlpoolForce(pool, playerPosition);
      if (!force.equals(Vector3.Zero())) {
        // Actually drag the player. This is the part that was missing: the
        // force was computed correctly and then never applied to anything.
        playerPosition.addInPlace(force.scale(deltaSeconds));
        if (!this.whirlpoolWarned) {
          this.whirlpoolWarned = true;
          this.say('A WHIRLPOOL has you — swim across the current, not against it.');
        }
      }
    } else {
      this.whirlpoolWarned = false;
    }

    // --- the Bloop -------------------------------------------------------
    // It only exists in the deep, and it announces itself long before arrival.
    if (submerged && depthBelowSea > Bloop.MIN_DEPTH && !this.bloop.isActive()) {
      this.bloop.spawn(playerPosition, seaLevel);
    } else if (!submerged && this.bloop.isActive() && depthBelowSea < 4) {
      this.bloop.despawn();
    }

    const bloopState = this.bloop.update(deltaSeconds, playerPosition);
    if (bloopState.active && bloopState.proximity > 0.25) {
      // Call out roughly every 8 seconds as it closes in.
      this.lastBloopCall += deltaSeconds;
      if (this.lastBloopCall > 8) {
        this.lastBloopCall = 0;
        this.say(
          bloopState.proximity > 0.75
            ? 'THE BLOOP IS RIGHT THERE. Get out of the water.'
            : 'A vast, low call rolls through the water. Something enormous is coming.'
        );
      }
    }

    return {
      ocean,
      waveHeight,
      whirlpool: pool,
      whirlpoolForce: force,
      bloopProximity: bloopState.proximity,
      leviathan,
      chip: this.chip,
    };
  }

  dispose(): void {
    this.blackHole.dispose();
    this.leviathan.dispose();
    this.bloop.despawn();
  }

  private say(text: string): void {
    try { this.onMessage?.(text); } catch { /* never break the frame on a UI callback */ }
  }
}

export default EndGameRuntime;

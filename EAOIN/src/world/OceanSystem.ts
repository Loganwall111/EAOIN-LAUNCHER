/**
 * OceanSystem — "Life Comes Apart 2.0" ocean overhaul.
 *
 * The ocean was a flat blue plane at a fixed sea level. This makes it a place:
 *
 *   - **Real depth.** Oceans now carve down far below the old floor, in graded
 *     zones (sunlight → twilight → midnight → abyss → trench).
 *   - **Depth darkening + fog.** The deeper you go the darker and bluer it
 *     gets, until you are effectively blind without a light source.
 *   - **Animated waves.** The surface displaces with a summed sine swell.
 *   - **Whirlpools.** Rare rotating funnels that drag you down.
 *   - **Bioluminescent plankton** that bloom around you at depth.
 *   - **The Bloop.** An enormous creature, heard long before it is seen, that
 *     can swallow the player whole and deposit them in its own dimension.
 */
import { Color3, Scene, Vector3 } from '@babylonjs/core';

/** Named depth zones, measured in blocks below sea level. */
export type OceanZoneID = 'surface' | 'sunlight' | 'twilight' | 'midnight' | 'abyss' | 'trench';

export interface OceanZone {
  id: OceanZoneID;
  name: string;
  /** Depth below sea level where this zone begins. */
  startDepth: number;
  /** Water tint at this depth. */
  tint: Color3;
  /** Ambient light multiplier, 0-1. */
  light: number;
  /** Underwater fog density — rises sharply with depth. */
  fogDensity: number;
  /** Density of bioluminescent plankton, 0-1. */
  plankton: number;
  description: string;
}

/**
 * Depth zones. Values are tuned for EAOIN's compressed vertical scale
 * (sea level ~18, world floor ~4), so "abyss" is reachable rather than
 * theoretical.
 */
export const OCEAN_ZONES: OceanZone[] = [
  {
    id: 'surface', name: 'Surface', startDepth: 0,
    tint: new Color3(0.32, 0.62, 0.86), light: 1.0, fogDensity: 0.006, plankton: 0.05,
    description: 'Sunlit chop. You can still see the sky from here.',
  },
  {
    id: 'sunlight', name: 'Sunlight Zone', startDepth: 6,
    tint: new Color3(0.16, 0.44, 0.72), light: 0.72, fogDensity: 0.016, plankton: 0.18,
    description: 'Reefs, fish shoals and drifting light shafts.',
  },
  {
    id: 'twilight', name: 'Twilight Zone', startDepth: 16,
    tint: new Color3(0.06, 0.20, 0.42), light: 0.34, fogDensity: 0.034, plankton: 0.44,
    description: 'Colour drains away. Shapes move at the edge of vision.',
  },
  {
    id: 'midnight', name: 'Midnight Zone', startDepth: 30,
    tint: new Color3(0.02, 0.07, 0.18), light: 0.12, fogDensity: 0.058, plankton: 0.72,
    description: 'No sunlight reaches this far. Only what glows down here.',
  },
  {
    id: 'abyss', name: 'The Abyss', startDepth: 48,
    tint: new Color3(0.006, 0.022, 0.06), light: 0.04, fogDensity: 0.086, plankton: 0.90,
    description: 'Crushing dark. Bioluminescence is the only language.',
  },
  {
    id: 'trench', name: 'The Trench', startDepth: 70,
    tint: new Color3(0.002, 0.006, 0.02), light: 0.012, fogDensity: 0.12, plankton: 1.0,
    description: 'Something down here is far too large to be a fish.',
  },
];

/** Resolve the zone for a depth below sea level. */
export function zoneForDepth(depthBelowSea: number): OceanZone {
  let zone = OCEAN_ZONES[0];
  for (const candidate of OCEAN_ZONES) {
    if (depthBelowSea >= candidate.startDepth) zone = candidate;
  }
  return zone;
}

/**
 * Smoothly interpolated ocean state, so descending fades between zones rather
 * than snapping at each boundary.
 */
export interface OceanState {
  zone: OceanZone;
  /** Blended water tint. */
  tint: Color3;
  /** Blended ambient multiplier. */
  light: number;
  /** Blended fog density. */
  fogDensity: number;
  /** Blended plankton density. */
  plankton: number;
  /** True when the camera is below the waterline. */
  submerged: boolean;
  depth: number;
}

export function oceanStateForDepth(depthBelowSea: number, submerged: boolean): OceanState {
  const d = Math.max(0, depthBelowSea);
  const zone = zoneForDepth(d);
  const index = OCEAN_ZONES.indexOf(zone);
  const next = OCEAN_ZONES[Math.min(OCEAN_ZONES.length - 1, index + 1)];

  // Blend toward the next zone across the gap between their start depths.
  const span = Math.max(1, next.startDepth - zone.startDepth);
  const t = next === zone ? 0 : Math.min(1, (d - zone.startDepth) / span);

  return {
    zone,
    tint: Color3.Lerp(zone.tint, next.tint, t),
    light: zone.light + (next.light - zone.light) * t,
    fogDensity: zone.fogDensity + (next.fogDensity - zone.fogDensity) * t,
    plankton: zone.plankton + (next.plankton - zone.plankton) * t,
    submerged,
    depth: d,
  };
}

/* ------------------------------------------------------------------ */
/* Waves                                                               */
/* ------------------------------------------------------------------ */

/**
 * Summed-sine ocean swell.
 *
 * Three waves at different frequencies, amplitudes and directions produce a
 * surface that never visibly repeats, which is what makes water read as
 * alive rather than as a scrolling texture.
 */
export function waveHeightAt(x: number, z: number, time: number): number {
  const w1 = Math.sin(x * 0.075 + time * 0.85) * 0.34;
  const w2 = Math.sin(z * 0.055 - time * 0.62) * 0.26;
  const w3 = Math.sin((x + z) * 0.032 + time * 1.15) * 0.16;
  return w1 + w2 + w3;
}

/** Surface normal of the swell, for lighting and for boat tilt. */
export function waveNormalAt(x: number, z: number, time: number): Vector3 {
  const e = 0.5;
  const hL = waveHeightAt(x - e, z, time);
  const hR = waveHeightAt(x + e, z, time);
  const hD = waveHeightAt(x, z - e, time);
  const hU = waveHeightAt(x, z + e, time);
  return new Vector3(hL - hR, 2 * e, hD - hU).normalize();
}

/* ------------------------------------------------------------------ */
/* Whirlpools                                                          */
/* ------------------------------------------------------------------ */

export interface Whirlpool {
  center: Vector3;
  radius: number;
  /** Tangential speed at the rim, blocks/second. */
  strength: number;
}

/**
 * Deterministically place whirlpools on a coarse grid so they are consistent
 * per seed and cheap to query — no global list to maintain.
 */
export function whirlpoolNear(x: number, z: number, seed: string, seaLevel: number): Whirlpool | null {
  const CELL = 260;
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);

  const h = hash(`${seed}:whirl:${cx}:${cz}`);
  // Rare — most cells have nothing.
  if (h < 0.88) return null;

  const ox = hash(`${seed}:wx:${cx}:${cz}`) * CELL;
  const oz = hash(`${seed}:wz:${cx}:${cz}`) * CELL;
  const center = new Vector3(cx * CELL + ox, seaLevel, cz * CELL + oz);
  const radius = 16 + hash(`${seed}:wr:${cx}:${cz}`) * 20;

  if (Vector3.Distance(new Vector3(x, seaLevel, z), center) > radius * 1.6) return null;

  return { center, radius, strength: 6 + hash(`${seed}:ws:${cx}:${cz}`) * 10 };
}

/**
 * Velocity a whirlpool imparts at a point: tangential swirl plus inward and
 * downward pull that both intensify toward the centre.
 */
export function whirlpoolForce(pool: Whirlpool, position: Vector3): Vector3 {
  const toCenter = pool.center.subtract(position);
  toCenter.y = 0;
  const distance = toCenter.length();
  if (distance > pool.radius || distance < 0.001) return Vector3.Zero();

  const t = 1 - distance / pool.radius;
  const inward = toCenter.normalize();
  // Rotate the inward vector 90° about Y to get the swirl direction.
  const tangent = new Vector3(-inward.z, 0, inward.x);

  return tangent
    .scale(pool.strength * t)
    .add(inward.scale(pool.strength * 0.35 * t))
    .add(new Vector3(0, -pool.strength * 0.5 * t * t, 0));
}

/* ------------------------------------------------------------------ */
/* The Bloop                                                           */
/* ------------------------------------------------------------------ */

export interface BloopState {
  /** Currently somewhere in the world. */
  active: boolean;
  /** Distance from the player. */
  distance: number;
  /** 0-1 how loud its call is right now. */
  proximity: number;
  /** True on the frame it swallows the player. */
  swallowed: boolean;
}

/**
 * The Bloop: an enormous creature that surfaces from the trench.
 *
 * You hear it long before you see it — the call is audible at 400 blocks, and
 * gets steadily louder. Swimming into its open mouth transports you to its own
 * interior dimension rather than killing you.
 */
export class Bloop {
  /** Only appears below this depth. */
  static readonly MIN_DEPTH = 34;
  /** Audible from this far away. */
  static readonly CALL_RANGE = 400;
  /** Mouth radius — swim inside this and you are swallowed. */
  static readonly MOUTH_RADIUS = 11;

  position = new Vector3(0, -40, 0);
  private active = false;
  private elapsed = 0;
  private swallowFired = false;
  private target = new Vector3(0, -40, 0);

  /** Raised when the player is swallowed. */
  onSwallow: (() => void) | null = null;

  constructor(private readonly scene: Scene, private readonly seed: string) {
    void this.scene;
  }

  /** Surface the Bloop near a point. */
  spawn(near: Vector3, seaLevel: number): void {
    const a = hash(`${this.seed}:bloop:${Math.round(near.x)}`) * Math.PI * 2;
    this.position.set(
      near.x + Math.cos(a) * 140,
      seaLevel - Bloop.MIN_DEPTH - 12,
      near.z + Math.sin(a) * 140
    );
    this.target.copyFrom(near);
    this.active = true;
    this.swallowFired = false;
  }

  despawn(): void {
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  update(deltaSeconds: number, playerPosition: Vector3): BloopState {
    if (!this.active) {
      return { active: false, distance: Infinity, proximity: 0, swallowed: false };
    }

    this.elapsed += deltaSeconds;

    // It cruises slowly toward the player, drifting vertically as it goes.
    const toPlayer = playerPosition.subtract(this.position);
    const distance = toPlayer.length();
    if (distance > 1) {
      this.position.addInPlace(toPlayer.normalize().scale(2.4 * deltaSeconds));
    }
    this.position.y += Math.sin(this.elapsed * 0.22) * 0.35 * deltaSeconds;

    const proximity = Math.max(0, 1 - distance / Bloop.CALL_RANGE);

    let swallowed = false;
    if (distance <= Bloop.MOUTH_RADIUS && !this.swallowFired) {
      this.swallowFired = true;
      swallowed = true;
      this.onSwallow?.();
    }

    return { active: true, distance, proximity, swallowed };
  }
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

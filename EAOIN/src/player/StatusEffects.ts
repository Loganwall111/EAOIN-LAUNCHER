/**
 * StatusEffects — derives the player's active effects from real game state.
 *
 * This replaces the hardcoded demo list the HUD used to show. Everything here
 * is a pure function of survival stats, dimension, world time and flight mode,
 * so it is cheap to recompute each HUD tick and straightforward to unit test.
 */
import { SurvivalStats } from './SurvivalState';

export type EffectTone = 'good' | 'bad' | 'info';

export interface StatusEffect {
  id: string;
  icon: string;
  name: string;
  /** Short readout: a duration, magnitude, or "∞" for ambient effects. */
  detail: string;
  tone: EffectTone;
}

export interface EffectContext {
  survivalStats: SurvivalStats;
  /** Runtime dimension id, e.g. 'overworld' | 'nether' | 'moon'. */
  dimensionId: string;
  /** World clock, 0..24. */
  timeOfDay: number;
  flightEnabled: boolean;
  /** True when the player is standing near an active portal core. */
  nearPortal: boolean;
  /** Depth below sea level, used for the "deep underground" cue. */
  depthBelowSurface: number;
}

const LOW_HEALTH = 30;
const LOW_FOOD = 25;
const LOW_STAMINA = 20;
const HIGH_STAT = 95;

/** Formats a 0..100 stat as a compact percentage readout. */
function pct(value: number): string {
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}

/**
 * Computes the currently active effects, most urgent first.
 *
 * Ordering matters: the HUD rail is height-limited, so hazards must never be
 * pushed off the bottom by ambient buffs.
 */
export function deriveStatusEffects(context: EffectContext): StatusEffect[] {
  const { survivalStats, dimensionId, timeOfDay, flightEnabled, nearPortal, depthBelowSurface } = context;
  const bad: StatusEffect[] = [];
  const good: StatusEffect[] = [];
  const info: StatusEffect[] = [];

  /* ---- hazards ---- */
  if (survivalStats.health <= 0) {
    bad.push({ id: 'downed', icon: '💀', name: 'Downed', detail: 'respawn', tone: 'bad' });
  } else if (survivalStats.health < LOW_HEALTH) {
    bad.push({ id: 'wounded', icon: '🩸', name: 'Wounded', detail: pct(survivalStats.health), tone: 'bad' });
  }

  if (survivalStats.food <= 0) {
    bad.push({ id: 'starving', icon: '💀', name: 'Starving', detail: 'losing health', tone: 'bad' });
  } else if (survivalStats.food < LOW_FOOD) {
    bad.push({ id: 'hungry', icon: '🍗', name: 'Hungry', detail: pct(survivalStats.food), tone: 'bad' });
  }

  if (survivalStats.stamina < LOW_STAMINA) {
    bad.push({ id: 'exhausted', icon: '💨', name: 'Exhausted', detail: pct(survivalStats.stamina), tone: 'bad' });
  }

  /* ---- dimension traits ---- */
  if (dimensionId === 'nether') {
    bad.push({ id: 'heat', icon: '🔥', name: 'Scorching Heat', detail: 'nether', tone: 'bad' });
  }
  if (dimensionId === 'moon' || dimensionId === 'space') {
    good.push({ id: 'lowgrav', icon: '🌙', name: 'Low Gravity', detail: '∞', tone: 'good' });
  }
  if (dimensionId === 'crystal_realm') {
    good.push({ id: 'resonance', icon: '💠', name: 'Crystal Resonance', detail: '∞', tone: 'good' });
  }

  /* ---- buffs ---- */
  if (survivalStats.health >= HIGH_STAT && survivalStats.food >= HIGH_STAT) {
    good.push({ id: 'regen', icon: '❤️', name: 'Regeneration', detail: '∞', tone: 'good' });
  }
  if (survivalStats.stamina >= HIGH_STAT) {
    good.push({ id: 'vigour', icon: '⚡', name: 'Vigour', detail: '∞', tone: 'good' });
  }
  if (flightEnabled) {
    good.push({ id: 'flight', icon: '🕊️', name: 'Creative Flight', detail: '∞', tone: 'good' });
  }

  /* ---- ambient / situational ---- */
  const isNight = timeOfDay < 6 || timeOfDay >= 19;
  if (isNight) {
    info.push({ id: 'night', icon: '🌙', name: 'Nightfall', detail: 'mobs spawn', tone: 'info' });
  }
  if (depthBelowSurface > 24) {
    info.push({ id: 'deep', icon: '⛏️', name: 'Deep Underground', detail: `${Math.round(depthBelowSurface)}m`, tone: 'info' });
  }
  if (nearPortal) {
    info.push({ id: 'portal', icon: '🌀', name: 'Portal Nearby', detail: 'press P', tone: 'info' });
  }

  const all = [...bad, ...good, ...info];
  if (all.length === 0) {
    return [{ id: 'healthy', icon: '✅', name: 'Healthy', detail: 'no effects', tone: 'good' }];
  }
  return all;
}

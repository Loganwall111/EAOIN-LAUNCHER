/**
 * Hydration — "Life Comes Apart 2.0" thirst survival mechanic.
 *
 * Requested behaviour: the desert sky is punishingly bright and hot, so the
 * player has to drink water to survive out there. Thirst therefore is not a
 * flat global drain — it is driven by the biome's *heat* and by how exposed you
 * are, so a temperate forest barely moves the bar while a desert at midday
 * empties it fast.
 *
 * Drinking:
 *   - Stand in or next to a water block and press the drink key.
 *   - Water restores hydration; the desert `Oasis` biome is therefore a real
 *     survival objective rather than set dressing.
 *
 * Consequences of running dry mirror how the food bar already works: at zero
 * you take steady chip damage, and low hydration throttles stamina regen.
 */

/** Climate severity used to scale thirst drain. */
export type ClimateSeverity = 'temperate' | 'warm' | 'hot' | 'scorching' | 'freezing';

export const MAX_HYDRATION = 100;

export interface HydrationState {
  hydration: number;
  /** Seconds the player has been at zero hydration — drives damage ramp. */
  parchedSeconds: number;
}

export function createStarterHydration(): HydrationState {
  return { hydration: MAX_HYDRATION, parchedSeconds: 0 };
}

/** Hydration lost per second at rest, before movement and exposure scaling. */
const BASE_DRAIN: Record<ClimateSeverity, number> = {
  freezing: 0.12,
  temperate: 0.22,
  warm: 0.45,
  hot: 0.95,
  // Deserts at midday. Full bar to empty in a bit under two minutes of running.
  scorching: 1.6,
};

export interface HydrationTickInput {
  deltaSeconds: number;
  climate: ClimateSeverity;
  /** True while the player is moving — exertion costs more water. */
  moving: boolean;
  /** True while the player is sprinting/flying fast. */
  exerting?: boolean;
  /**
   * 0-1 how exposed to the sun the player is. 1 = open desert at noon,
   * 0 = underground or full night. Scales the heat component of the drain.
   */
  sunExposure: number;
  /** True while standing in water — you cool off and stop drying out. */
  inWater?: boolean;
}

export interface HydrationTickResult extends HydrationState {
  /** Damage to apply to health this tick. */
  damage: number;
  /** Multiplier applied to stamina regeneration, 0-1. */
  staminaScale: number;
  /** Set when the player crosses a warning threshold this tick. */
  warning?: string;
}

/**
 * Advance hydration by one tick.
 *
 * Kept pure so it is trivially unit-testable and so the render loop can call it
 * without worrying about hidden state.
 */
export function updateHydration(state: HydrationState, input: HydrationTickInput): HydrationTickResult {
  const { deltaSeconds, climate, moving, sunExposure } = input;

  let drain = BASE_DRAIN[climate] ?? BASE_DRAIN.temperate;

  // Exertion multiplier.
  if (input.exerting) drain *= 1.75;
  else if (moving) drain *= 1.35;

  // Sun exposure only amplifies genuinely hot climates — being in the sun in a
  // snowfield should not dehydrate you.
  const heatSensitive = climate === 'hot' || climate === 'scorching' || climate === 'warm';
  if (heatSensitive) drain *= 0.55 + Math.max(0, Math.min(1, sunExposure)) * 0.95;

  // Standing in water keeps you cool and topped up.
  if (input.inWater) drain = -6;

  const before = state.hydration;
  const hydration = clamp(before - drain * deltaSeconds);

  let parchedSeconds = state.parchedSeconds;
  let damage = 0;
  if (hydration <= 0) {
    parchedSeconds += deltaSeconds;
    // Ramps from 1.2 HP/s up to 3 HP/s the longer you stay parched.
    damage = Math.min(3.0, 1.2 + parchedSeconds * 0.08) * deltaSeconds;
  } else {
    parchedSeconds = 0;
  }

  // Dehydration throttles stamina recovery well before it starts hurting.
  const staminaScale = hydration > 45 ? 1 : hydration > 20 ? 0.6 : hydration > 0 ? 0.28 : 0.1;

  return {
    hydration,
    parchedSeconds,
    damage,
    staminaScale,
    warning: crossedWarning(before, hydration),
  };
}

/** Fire a message only on the tick the player crosses a threshold. */
function crossedWarning(before: number, after: number): string | undefined {
  const thresholds: Array<[number, string]> = [
    [50, 'Getting thirsty — find water'],
    [25, 'Dehydrated — you need to drink soon'],
    [10, 'Severely dehydrated — find water now!'],
    [0.001, 'Parched! You are taking damage from dehydration'],
  ];
  for (const [level, message] of thresholds) {
    if (before > level && after <= level) return message;
  }
  return undefined;
}

/** Restore hydration by drinking. Returns the new state and a message. */
export function drink(state: HydrationState, amount = 35): { state: HydrationState; message: string } {
  if (state.hydration >= MAX_HYDRATION - 0.5) {
    return { state, message: 'Already fully hydrated' };
  }
  const hydration = clamp(state.hydration + amount);
  return {
    state: { hydration, parchedSeconds: 0 },
    message: `Drank water — hydration ${Math.round(hydration)}%`,
  };
}

/**
 * Map a biome id/name onto a climate severity. Deliberately substring-based so
 * all 150+ biome ids resolve without an exhaustive table.
 */
export function climateForBiome(biomeId: string): ClimateSeverity {
  const key = biomeId.toLowerCase();
  if (/desert|badlands|dune|scorch|wasteland|sun_biome|solar|volcan|lava|nether|magma/.test(key)) {
    return 'scorching';
  }
  if (/savanna|mesa|canyon|oasis|arid|dry|jungle|rainforest|tropical/.test(key)) return 'hot';
  if (/beach|warm|swamp|mangrove|plains|meadow|coral/.test(key)) return 'warm';
  if (/snow|ice|frozen|tundra|arctic|glacier|alpine|taiga|peak/.test(key)) return 'freezing';
  return 'temperate';
}

/** Human-readable climate label for the HUD. */
export function climateLabel(climate: ClimateSeverity): string {
  switch (climate) {
    case 'scorching': return 'Scorching';
    case 'hot': return 'Hot';
    case 'warm': return 'Warm';
    case 'freezing': return 'Freezing';
    default: return 'Temperate';
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(MAX_HYDRATION, value));
}

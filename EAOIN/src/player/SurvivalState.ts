export interface SurvivalStats {
  health: number;
  food: number;
  stamina: number;
}

export const MAX_SURVIVAL_STAT = 100;

export function createStarterSurvivalStats(): SurvivalStats {
  return {
    health: MAX_SURVIVAL_STAT,
    food: 92,
    stamina: MAX_SURVIVAL_STAT,
  };
}

export function clampSurvivalStats(stats: SurvivalStats): SurvivalStats {
  return {
    health: clamp(stats.health),
    food: clamp(stats.food),
    stamina: clamp(stats.stamina),
  };
}

export function updateSurvivalLoop(stats: SurvivalStats, deltaSeconds: number, moving: boolean): SurvivalStats {
  const staminaDelta = moving ? -12 * deltaSeconds : (stats.food > 10 ? 18 : 6) * deltaSeconds;
  const foodDrain = (moving ? 0.028 : 0.012) * deltaSeconds;
  const healthDelta = stats.food <= 0 ? -1.2 * deltaSeconds : stats.food > 72 && stats.health < MAX_SURVIVAL_STAT ? 0.75 * deltaSeconds : 0;

  return clampSurvivalStats({
    health: stats.health + healthDelta,
    food: stats.food - foodDrain,
    stamina: stats.stamina + staminaDelta,
  });
}

export function applyDamage(stats: SurvivalStats, damage: number): SurvivalStats {
  if (damage <= 0) return stats;
  return clampSurvivalStats({
    ...stats,
    health: stats.health - damage,
  });
}

function clamp(value: number): number {
  return Math.max(0, Math.min(MAX_SURVIVAL_STAT, value));
}

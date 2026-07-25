/**
 * DimensionRules — Per-Dimension Physics & Environment
 */
export interface DimensionRules {
  gravity: number; // 1.0 = standard
  timeScale: number; // 1.0 = standard
  atmosphere: 'normal' | 'toxic' | 'none' | 'energy_field';
  physics: 'standard' | 'low_gravity' | 'modified';
  temperature: number;
  weatherEnabled: boolean;
  lightLevelModifier: number;
}

export const DEFAULT_RULES: DimensionRules = {
  gravity: 1.0,
  timeScale: 1.0,
  atmosphere: 'normal',
  physics: 'standard',
  temperature: 0.5,
  weatherEnabled: true,
  lightLevelModifier: 1.0,
};

export function applyDimensionPhysics(entityVelocity: { x: number; y: number; z: number }, rules: DimensionRules): { x: number; y: number; z: number } {
  return {
    x: entityVelocity.x,
    y: entityVelocity.y - (rules.gravity * 9.81 * 0.016), // Simplified gravity tick
    z: entityVelocity.z,
  };
}

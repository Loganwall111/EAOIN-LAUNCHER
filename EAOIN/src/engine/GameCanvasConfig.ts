import { BUDGET_PRESETS, effectSettingsFor, EffectTier, PerformanceBudget } from '../performance/AdaptivePerformance';
import { GameSettings } from '../settings/GameSettings';

export function effectTierForQualityPreset(qualityPreset: GameSettings['qualityPreset']): EffectTier {
  if (qualityPreset === 'performance') return 'low';
  if (qualityPreset === 'cinematic') return 'ultra';
  if (qualityPreset === 'quality') return 'high';
  return 'medium';
}

export function adaptiveBudgetForSettings(settings: GameSettings): PerformanceBudget {
  return {
    ...(BUDGET_PRESETS[settings.qualityPreset] ?? BUDGET_PRESETS.balanced),
    targetFps: settings.targetFps || 60,
  };
}

export function adaptiveBudgetKey(settings: GameSettings): string {
  return `${settings.qualityPreset}:${settings.targetFps}`;
}

export function shouldEnableAtmosphereParticles(settings: GameSettings, effectTier: EffectTier): boolean {
  return settings.particlesEnabled
    && !settings.reducedMotion
    && effectSettingsFor(effectTier).particleScale > 0.25;
}

export function rayTracingSettingsKey(settings: GameSettings): string {
  return [
    settings.rayTracingQuality,
    settings.rayTracedReflections ? '1' : '0',
    settings.rayTracedShadows ? '1' : '0',
    settings.rayTracedAO ? '1' : '0',
  ].join(':');
}

/**
 * Surface X-ray cutaway repair — pure resolution logic.
 *
 * Every block material sets `backFaceCulling = false`, so Babylon renders
 * both the outside and inside of every voxel face. A camera whose eye point
 * ends up *inside* a solid voxel (a fast fall landing a frame late, a
 * respawn placed a hair too low, or a doorway that regenerated solid after
 * an edit) is therefore always facing the block's own interior far face,
 * which stops the ray — the ground can no longer read as see-through.
 *
 * This does not replace collision resolution — `moveWithCollisions` still
 * handles swept movement — it is a same-frame safety net for the camera
 * already resting inside solid geometry with no velocity left to sweep
 * against, which sweeping collision alone cannot fix.
 *
 * Returns the corrected Y, or `null` when the camera was not penetrating
 * anything and no change is needed.
 */
export function resolveCameraPenetrationY(
  getBlockAt: (x: number, y: number, z: number) => number,
  eyeX: number,
  eyeY: number,
  eyeZ: number,
  chunkHeight: number,
  maxLift = 8
): number | null {
  const bx = Math.floor(eyeX);
  const bz = Math.floor(eyeZ);
  const by = Math.floor(eyeY);
  const insideId = getBlockAt(bx, by, bz);
  if (insideId === 0 || insideId === 5) return null; // air or water: nothing to fix
  // Climb until open headroom is found, capped so a fully solid column
  // (e.g. deep inside bedrock after a bad edit) cannot search forever.
  for (let y = by; y < by + maxLift && y < chunkHeight; y += 1) {
    const here = getBlockAt(bx, y, bz);
    if (here === 0 || here === 5) return y + 0.5;
  }
  return null;
}

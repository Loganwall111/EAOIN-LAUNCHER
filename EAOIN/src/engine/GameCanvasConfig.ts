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

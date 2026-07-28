import { describe, expect, it } from 'vitest';
import {
  adaptiveBudgetForSettings,
  adaptiveBudgetKey,
  effectTierForQualityPreset,
  rayTracingSettingsKey,
  shouldEnableAtmosphereParticles,
} from '../../src/engine/GameCanvasConfig';
import { createDefaultSettings } from '../../src/settings/GameSettings';

describe('GameCanvas runtime config helpers', () => {
  it('maps quality presets onto the intended effect tiers', () => {
    expect(effectTierForQualityPreset('performance')).toBe('low');
    expect(effectTierForQualityPreset('balanced')).toBe('medium');
    expect(effectTierForQualityPreset('quality')).toBe('high');
    expect(effectTierForQualityPreset('cinematic')).toBe('ultra');
  });

  it('builds the adaptive budget from the live settings target FPS', () => {
    const settings = { ...createDefaultSettings(), qualityPreset: 'quality' as const, targetFps: 72 };
    const budget = adaptiveBudgetForSettings(settings);
    expect(budget.targetFps).toBe(72);
    expect(budget.minEffectTier).toBe('medium');
    expect(budget.maxEffectTier).toBe('ultra');
  });

  it('changes the adaptive budget key when the quality preset or target fps changes', () => {
    const base = createDefaultSettings();
    expect(adaptiveBudgetKey({ ...base, qualityPreset: 'balanced', targetFps: 60 }))
      .not.toBe(adaptiveBudgetKey({ ...base, qualityPreset: 'quality', targetFps: 60 }));
    expect(adaptiveBudgetKey({ ...base, qualityPreset: 'balanced', targetFps: 60 }))
      .not.toBe(adaptiveBudgetKey({ ...base, qualityPreset: 'balanced', targetFps: 120 }));
  });

  it('keeps atmosphere particles disabled when accessibility or low FX tiers demand it', () => {
    const settings = createDefaultSettings();
    expect(shouldEnableAtmosphereParticles(settings, 'minimal')).toBe(false);
    expect(shouldEnableAtmosphereParticles({ ...settings, reducedMotion: true }, 'ultra')).toBe(false);
    expect(shouldEnableAtmosphereParticles({ ...settings, particlesEnabled: false }, 'ultra')).toBe(false);
    expect(shouldEnableAtmosphereParticles(settings, 'low')).toBe(true);
  });

  it('tracks every live ray-tracing toggle, not just quality', () => {
    const base = createDefaultSettings();
    const key = rayTracingSettingsKey(base);
    expect(rayTracingSettingsKey({ ...base, rayTracingQuality: 'high' })).not.toBe(key);
    expect(rayTracingSettingsKey({ ...base, rayTracedReflections: !base.rayTracedReflections })).not.toBe(key);
    expect(rayTracingSettingsKey({ ...base, rayTracedShadows: !base.rayTracedShadows })).not.toBe(key);
    expect(rayTracingSettingsKey({ ...base, rayTracedAO: !base.rayTracedAO })).not.toBe(key);
  });
});

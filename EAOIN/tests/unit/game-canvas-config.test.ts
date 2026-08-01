import { describe, expect, it } from 'vitest';
import {
  adaptiveBudgetForSettings,
  adaptiveBudgetKey,
  effectTierForQualityPreset,
  rayTracingSettingsKey,
  resolveCameraPenetrationY,
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
    // Default quality is now 'high'; changing it to a different level must
    // still change the runtime key.
    expect(rayTracingSettingsKey({ ...base, rayTracingQuality: 'ultra' })).not.toBe(key);
    expect(rayTracingSettingsKey({ ...base, rayTracedReflections: !base.rayTracedReflections })).not.toBe(key);
    expect(rayTracingSettingsKey({ ...base, rayTracedShadows: !base.rayTracedShadows })).not.toBe(key);
    expect(rayTracingSettingsKey({ ...base, rayTracedAO: !base.rayTracedAO })).not.toBe(key);
  });

  describe('resolveCameraPenetrationY — surface X-ray cutaway repair', () => {
    // A column that is solid stone from y=0..9, then open air above.
    const solidColumn = (x: number, y: number, z: number): number => {
      void x; void z;
      return y < 10 ? 3 /* stone */ : 0;
    };

    it('does nothing when the eye is in open air', () => {
      expect(resolveCameraPenetrationY(solidColumn, 5.5, 12.4, 5.5, 128)).toBeNull();
    });

    it('does nothing when the eye is underwater (water is not opaque)', () => {
      const withWater = (x: number, y: number, z: number): number =>
        y === 10 ? 5 /* water */ : solidColumn(x, y, z);
      expect(resolveCameraPenetrationY(withWater, 5.5, 10.4, 5.5, 128)).toBeNull();
    });

    it('lifts the eye above solid ground when the camera is stuck inside a block', () => {
      // Eye sits at y=4.3, deep inside the solid column: this is exactly the
      // "look down and see through the ground" state — a culled block face
      // with nothing behind it to stop the ray.
      const lifted = resolveCameraPenetrationY(solidColumn, 5.5, 4.3, 5.5, 128);
      expect(lifted).not.toBeNull();
      // Must land in the first open block above the solid column (y=10), not
      // merely nudge upward by a fraction and remain inside geometry.
      expect(lifted).toBe(10.5);
    });

    it('gives up within the search cap rather than searching forever on an all-solid column', () => {
      const allSolid = () => 3;
      expect(resolveCameraPenetrationY(allSolid, 0.5, 0.4, 0.5, 128, 8)).toBeNull();
    });

    it('never reports a fix at exactly the boundary between solid and open', () => {
      // Eye at y=9.9 is still inside the last solid layer (floor(9.9) === 9).
      const lifted = resolveCameraPenetrationY(solidColumn, 0.5, 9.9, 0.5, 128);
      expect(lifted).toBe(10.5);
      // Eye at y=10.1 is already in the open air above — no fix needed.
      expect(resolveCameraPenetrationY(solidColumn, 0.5, 10.1, 0.5, 128)).toBeNull();
    });
  });
});

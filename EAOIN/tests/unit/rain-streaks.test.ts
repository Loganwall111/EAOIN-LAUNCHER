/**
 * Regression test for the "solid white square blocks falling from the sky"
 * rain glitch.
 *
 * The old rain particle used Babylon's default camera-facing billboard mode
 * at a size big enough to read as an opaque square card. The fix orients
 * each particle along its own fall direction (`BILLBOARDMODE_STRETCHED`) and
 * stretches it into a thin, translucent diagonal streak instead.
 */
import { describe, it, expect } from 'vitest';
import { NullEngine, ParticleSystem, Scene } from '@babylonjs/core';
import { BiomeVFX } from '../../src/effects/BiomeVFX';

function makeScene(): { engine: NullEngine; scene: Scene } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  return { engine, scene };
}

describe('rain particle streaks', () => {
  it('orients rain along its fall direction instead of camera-facing squares', () => {
    const { engine, scene } = makeScene();
    const vfx = new BiomeVFX(scene, { enabled: true, quality: 1 });
    vfx.attach();
    vfx.setProfile('rain', []);

    const rain = scene.particleSystems.find((p) => p.name === 'biome_vfx_rain') as ParticleSystem;
    expect(rain, 'the rain particle system must exist').toBeTruthy();

    // The defining fix: stretched billboarding, not the default camera-facing
    // quad that read as a solid square.
    expect(rain.billboardMode).toBe(ParticleSystem.BILLBOARDMODE_STRETCHED);

    // Streaks must be visibly elongated (tall) and thin (narrow), not a
    // square card.
    expect(rain.minScaleY).toBeGreaterThan(rain.maxScaleX);
    expect(rain.maxScaleY).toBeGreaterThan(rain.minScaleY);
    expect(rain.maxScaleX).toBeGreaterThan(rain.minScaleX);

    // Translucent, not opaque white.
    expect(rain.color1.a).toBeLessThan(0.5);
    expect(rain.color2.a).toBeLessThan(0.5);

    // Standard (non-additive) alpha blending, so streaks don't blow out to a
    // solid white wash when many overlap.
    expect(rain.blendMode).toBe(ParticleSystem.BLENDMODE_STANDARD);

    // Falls at a consistent diagonal (wind-driven), not straight down.
    expect(rain.direction1.x).not.toBe(0);
    expect(rain.direction2.x).not.toBe(0);
    expect(rain.direction1.y).toBeLessThan(0);

    vfx.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('never enables rain and another weather stream at once', () => {
    const { engine, scene } = makeScene();
    const vfx = new BiomeVFX(scene, { enabled: true, quality: 1 });
    vfx.attach();
    vfx.setProfile('rain', []);

    const active = scene.particleSystems.filter((p) => p.isStarted() && p.emitRate > 0);
    // Only the rain stream should be live; everything else was stopped.
    expect(active.map((p) => p.name)).toEqual(['biome_vfx_rain']);

    vfx.dispose();
    scene.dispose();
    engine.dispose();
  });
});

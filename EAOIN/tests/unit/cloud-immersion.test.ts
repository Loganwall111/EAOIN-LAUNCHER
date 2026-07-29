/**
 * Regression tests for "when the player enters the cloud zone, their screen
 * must turn into a thick, sweeping, foggy mist (simulating an airplane
 * flying through real clouds)".
 */
import { describe, it, expect } from 'vitest';
import { Color3, NullEngine, Scene } from '@babylonjs/core';
import { VolumetricClouds, CLOUD_DECK_ALTITUDE, CLOUD_DECK_THICKNESS } from '../../src/sky/VolumetricClouds';

function makeClouds(coverage = 0.5): { engine: NullEngine; scene: Scene; clouds: VolumetricClouds } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const clouds = new VolumetricClouds(scene, 'immersion_seed', {
    coverage,
    tint: new Color3(1, 1, 1),
    windSpeed: 3,
  });
  clouds.attach();
  return { engine, scene, clouds };
}

describe('volumetric cloud immersion (airplane-in-weather effect)', () => {
  it('reports zero immersion far below or far above the deck', () => {
    const { engine, scene, clouds } = makeClouds();
    expect(clouds.getImmersion(0)).toBe(0);
    expect(clouds.getImmersion(CLOUD_DECK_ALTITUDE + CLOUD_DECK_THICKNESS * 3)).toBe(0);
    clouds.dispose(); scene.dispose(); engine.dispose();
  });

  it('reports full immersion in the dense middle of the deck', () => {
    const { engine, scene, clouds } = makeClouds();
    expect(clouds.getImmersion(CLOUD_DECK_ALTITUDE)).toBe(1);
    clouds.dispose(); scene.dispose(); engine.dispose();
  });

  it('ramps smoothly rather than snapping at the deck boundary', () => {
    const { engine, scene, clouds } = makeClouds();
    const farBelow = clouds.getImmersion(CLOUD_DECK_ALTITUDE - CLOUD_DECK_THICKNESS * 2.4);
    const approaching = clouds.getImmersion(CLOUD_DECK_ALTITUDE - CLOUD_DECK_THICKNESS * 0.9);
    const inside = clouds.getImmersion(CLOUD_DECK_ALTITUDE - CLOUD_DECK_THICKNESS * 0.2);
    const center = clouds.getImmersion(CLOUD_DECK_ALTITUDE);
    expect(farBelow).toBe(0);
    expect(approaching).toBeGreaterThan(farBelow);
    expect(inside).toBeGreaterThan(approaching);
    expect(center).toBeGreaterThanOrEqual(inside);
    // Every step must be monotonically non-decreasing approaching the core.
    expect(farBelow).toBeLessThanOrEqual(approaching);
    expect(approaching).toBeLessThanOrEqual(inside);
    clouds.dispose(); scene.dispose(); engine.dispose();
  });

  it('never reports immersion when there is no cloud coverage at all', () => {
    const { engine, scene, clouds } = makeClouds(0);
    expect(clouds.getImmersion(CLOUD_DECK_ALTITUDE)).toBe(0);
    clouds.dispose(); scene.dispose(); engine.dispose();
  });

  it('exposes a soft, light mist colour rather than a stark or dark tint', () => {
    const { engine, scene, clouds } = makeClouds();
    const mist = clouds.getMistColor();
    // Real cloud mist reads as bright and roughly neutral, not a saturated
    // or dark colour.
    expect(mist.r).toBeGreaterThan(0.5);
    expect(mist.g).toBeGreaterThan(0.5);
    expect(mist.b).toBeGreaterThan(0.5);
    clouds.dispose(); scene.dispose(); engine.dispose();
  });
});

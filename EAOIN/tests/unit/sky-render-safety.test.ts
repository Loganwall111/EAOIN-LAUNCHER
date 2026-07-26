/**
 * Regression tests for the "blue/white border surrounding the player" and
 * "sky way too bright" bugs.
 *
 * See BUGFIX_SKY_BORDER_AND_OVEREXPOSURE.md for the full write-up.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NullEngine, Scene, Vector3, StandardMaterial, Mesh, GlowLayer } from '@babylonjs/core';
import {
  DynamicSky,
  DEFAULT_SKY,
  CLOUD_LAYER_ALTITUDE,
  CLOUD_BIG_LAYER_ALTITUDE,
  STAR_LAYER_ALTITUDE,
  CLOUD_LAYER_MAX_ALPHA,
} from '../../src/sky/DynamicSky';
import { CinematicLighting, DEFAULT_CINEMATIC } from '../../src/rendering/CinematicLighting';
import { configureSceneLighting } from '../../src/rendering/SceneLighting';

function makeScene(): { engine: NullEngine; scene: Scene } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  return { engine, scene };
}

const SPAWN = { x: 0, y: 64, z: 0 } as never;

describe('DynamicSky layer geometry', () => {
  let scene: Scene;
  let sky: DynamicSky;

  beforeEach(() => {
    ({ scene } = makeScene());
    sky = new DynamicSky(scene, DEFAULT_SKY);
    sky.attach();
  });

  const layers = (): Array<[string, Mesh | null, number]> => [
    ['cloudLayer', sky.cloudLayer, CLOUD_LAYER_ALTITUDE],
    ['cloudBigLayer', sky.cloudBigLayer, CLOUD_BIG_LAYER_ALTITUDE],
    ['starField', sky.starField, STAR_LAYER_ALTITUDE],
  ];

  it('creates all three overhead sky layers', () => {
    for (const [name, layer] of layers()) {
      expect(layer, `${name} should exist`).not.toBeNull();
    }
  });

  it('rotates every sky layer flat instead of leaving it as a vertical wall', () => {
    // The original bug: CreatePlane() yields a plane in the XY plane facing +Z,
    // i.e. a wall standing in front of the camera. It must be laid flat.
    for (const [name, layer] of layers()) {
      expect(layer!.rotation.x, `${name} must be rotated flat`).toBeCloseTo(Math.PI / 2, 5);
    }
  });

  it('never marks a manually-positioned sky layer as infiniteDistance', () => {
    // infiniteDistance + per-frame camera positioning double-applies the camera
    // offset and drags the mesh into the near clip plane.
    for (const [name, layer] of layers()) {
      expect(layer!.infiniteDistance, `${name} must not be infiniteDistance`).toBe(false);
    }
  });

  it('keeps every sky layer far above the camera after an update', () => {
    const camera = new Vector3(120, 70, -85);
    sky.update(0.016, camera);

    for (const [name, layer, altitude] of layers()) {
      // Follows the camera horizontally...
      expect(layer!.position.x, `${name} x`).toBeCloseTo(camera.x, 5);
      expect(layer!.position.z, `${name} z`).toBeCloseTo(camera.z, 5);
      // ...but stays at a fixed clearance overhead, never at eye level.
      expect(layer!.position.y, `${name} y`).toBeCloseTo(camera.y + altitude, 5);
      expect(layer!.position.y - camera.y, `${name} clearance`).toBeGreaterThan(100);
    }
  });

  it('maintains clearance as the player climbs or descends', () => {
    for (const y of [8, 64, 128, 250]) {
      const camera = new Vector3(0, y, 0);
      sky.update(0.016, camera);
      for (const [name, layer] of layers()) {
        expect(layer!.position.y - camera.y, `${name} at y=${y}`).toBeGreaterThan(100);
      }
    }
  });

  it('excludes sky layers from picking and collision', () => {
    for (const [name, layer] of layers()) {
      expect(layer!.isPickable, `${name} pickable`).toBe(false);
      expect(layer!.checkCollisions, `${name} collides`).toBe(false);
    }
  });

  it('clamps cloud opacity so the sky is never fully occluded', () => {
    const cloudMat = sky.cloudLayer!.material as StandardMaterial;
    const bigMat = sky.cloudBigLayer!.material as StandardMaterial;
    expect(cloudMat.alpha).toBeLessThanOrEqual(CLOUD_LAYER_MAX_ALPHA);
    expect(bigMat.alpha).toBeLessThanOrEqual(CLOUD_LAYER_MAX_ALPHA);
  });

  it('hides the star field during the day', () => {
    sky.config.timeOfDay = 12;
    sky.config.dayLengthSeconds = 0; // freeze the clock for a deterministic check
    sky.update(0.016, new Vector3(0, 64, 0));
    const starMat = sky.starField!.material as StandardMaterial;
    expect(starMat.alpha).toBeLessThan(0.1);
  });
});

describe('Scene lighting is not duplicated', () => {
  it('adopts the existing sun, hemispheric light and glow layer', () => {
    const { scene } = makeScene();
    // Mirror GameCanvas's real init order: scene lighting rig, then the
    // 'voxel_bloom' glow layer, then CinematicLighting on top.
    configureSceneLighting(scene, SPAWN);
    new GlowLayer('voxel_bloom', scene, { blurKernelSize: 64 });

    const sunsBefore = scene.lights.filter((l) => l.getClassName() === 'DirectionalLight').length;
    const hemisBefore = scene.lights.filter((l) => l.getClassName() === 'HemisphericLight').length;
    const glowsBefore = scene.effectLayers.filter((l) => l.getClassName() === 'GlowLayer').length;

    const cinematic = new CinematicLighting(scene, DEFAULT_CINEMATIC);

    expect(cinematic.adoptedSun).toBe(true);
    expect(cinematic.adoptedHemi).toBe(true);
    expect(cinematic.adoptedGlow).toBe(true);

    const hemisAfter = scene.lights.filter((l) => l.getClassName() === 'HemisphericLight').length;
    const glowsAfter = scene.effectLayers.filter((l) => l.getClassName() === 'GlowLayer').length;

    // The moon is legitimately new; no *second* sun or hemi may appear.
    const sunsAfter = scene.lights.filter(
      (l) => l.getClassName() === 'DirectionalLight' && l.name !== 'moon_light'
    ).length;

    expect(sunsAfter).toBe(sunsBefore);
    expect(hemisAfter).toBe(hemisBefore);
    expect(glowsAfter).toBe(glowsBefore);
  });

  it('does not fight the adopted rig over sun intensity', () => {
    const { scene } = makeScene();
    const rig = configureSceneLighting(scene, SPAWN);
    const cinematic = new CinematicLighting(scene, DEFAULT_CINEMATIC);

    rig.sun.intensity = 0.5;
    cinematic.setTimeOfDay(12);

    // The owning rig's value must survive — CinematicLighting must not stomp it.
    expect(rig.sun.intensity).toBe(0.5);
  });

  it('still builds its own rig when the scene has no lights', () => {
    const { scene } = makeScene();
    const cinematic = new CinematicLighting(scene, DEFAULT_CINEMATIC);

    expect(cinematic.adoptedSun).toBe(false);
    expect(cinematic.adoptedHemi).toBe(false);
    expect(cinematic.sun).toBeTruthy();
    expect(cinematic.hemi).toBeTruthy();

    // And in that case it *is* responsible for driving the sun.
    cinematic.setTimeOfDay(12);
    expect(cinematic.sun.intensity).toBeGreaterThan(0);
  });
});

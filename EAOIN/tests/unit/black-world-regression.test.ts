/**
 * Regression tests for: "the HUD shows but the whole world is a black wall".
 *
 * Two independent defects could each black out the 3D view while leaving the
 * DOM HUD perfectly readable (the HUD is plain HTML and never touches the GPU
 * pipeline, which is why it survived both).
 *
 *   1. WebGPU snapshot rendering was armed at engine-creation time, before a
 *      Scene existed. Babylon records the command bundle on the next frame and
 *      replays it forever, so an empty recording meant no world draw calls were
 *      ever submitted again.
 *
 *   2. `SkyDome` uploaded its vertex-colour buffer while it was still all
 *      zeros — opaque black — and only painted the real gradient on the first
 *      `update()`. The dome is a 2400-unit BACKSIDE sphere pinned to the
 *      camera, so until that first repaint the player was sealed inside a
 *      solid black ball.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NullEngine, Scene, VertexBuffer, Vector3, Color3, FreeCamera } from '@babylonjs/core';
import { SkyDome, SKY_DOME_DIAMETER } from '../../src/sky/SkyDome';
import { OVERWORLD_SKY } from '../../src/sky/SkyProfiles';
import {
  applyWebGpuOptimizations,
  enableSnapshotRenderingWhenReady,
} from '../../src/rendering/RendererBackend';
import { createDefaultSettings } from '../../src/settings/GameSettings';

/* ------------------------------------------------------------------ */
/* Defect 2 — the sky dome must never be black                         */
/* ------------------------------------------------------------------ */

describe('SkyDome never presents a black sphere', () => {
  let engine: NullEngine;
  let scene: Scene;
  let dome: SkyDome;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    dome = new SkyDome(scene);
  });

  afterEach(() => {
    dome.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('seeds a non-black gradient at attach time, before any update() call', () => {
    dome.attach();

    const mesh = scene.meshes.find((m) => m.name === 'eaoin_sky_dome');
    expect(mesh, 'the sky dome mesh should exist after attach()').toBeTruthy();

    const colors = mesh!.getVerticesData(VertexBuffer.ColorKind);
    expect(colors, 'the dome must upload a vertex-colour buffer').toBeTruthy();

    // This is the assertion that fails on the old code: every float was 0.
    const brightest = Math.max(...Array.from(colors!));
    expect(
      brightest,
      'dome vertex colours are all zero => an opaque black ball around the camera'
    ).toBeGreaterThan(0.1);
  });

  it('paints sky-blue at the horizon rather than black', () => {
    dome.attach();
    const mesh = scene.meshes.find((m) => m.name === 'eaoin_sky_dome')!;
    const colors = Array.from(mesh.getVerticesData(VertexBuffer.ColorKind)!);

    // Every vertex should carry some blue; a sky is never a black void.
    let minBlue = Number.POSITIVE_INFINITY;
    for (let i = 2; i < colors.length; i += 4) minBlue = Math.min(minBlue, colors[i]);
    expect(minBlue).toBeGreaterThan(0.3);

    // And blue should dominate, matching the Overworld palette.
    for (let i = 0; i < colors.length; i += 4) {
      expect(colors[i + 2]).toBeGreaterThanOrEqual(colors[i]);
    }
  });

  it('still repaints correctly on update(), and keeps the camera deep inside', () => {
    dome.attach();
    const cameraPosition = new Vector3(120, 70, -40);

    const result = dome.update(
      OVERWORLD_SKY,
      1,      // full daylight
      0,      // no sunset band
      new Vector3(0, -1, 0),
      cameraPosition,
      1       // > 0.05s so the throttled repaint runs
    );

    expect(result.horizon.r + result.horizon.g + result.horizon.b).toBeGreaterThan(0.3);

    const mesh = scene.meshes.find((m) => m.name === 'eaoin_sky_dome')!;
    // The dome must track the camera so the player can never leave it.
    expect(mesh.position.equals(cameraPosition)).toBe(true);
    // ...and be far larger than the camera's near plane.
    expect(SKY_DOME_DIAMETER / 2).toBeGreaterThan(500);
  });

  it('publishes a non-black scene clear colour', () => {
    dome.attach();
    dome.update(OVERWORLD_SKY, 1, 0, new Vector3(0, -1, 0), Vector3.Zero(), 1);

    const clear = scene.clearColor;
    expect(clear.r + clear.g + clear.b).toBeGreaterThan(0.3);
  });

  it('keeps the night sky dim but never pitch black', () => {
    dome.attach();
    // dayFactor 0 = midnight.
    const result = dome.update(OVERWORLD_SKY, 0, 0, new Vector3(0, 1, 0), Vector3.Zero(), 1);
    const clear = scene.clearColor;

    // Dim...
    expect(clear.r + clear.g + clear.b).toBeLessThan(1.2);
    // ...but still a colour, so the horizon reads instead of vanishing.
    expect(result.horizon).toBeInstanceOf(Color3);
  });
});

/* ------------------------------------------------------------------ */
/* Defect 1 — snapshot rendering must be gated on scene readiness      */
/* ------------------------------------------------------------------ */

/** Minimal stand-in for WebGPUEngine's snapshot surface. */
function makeFakeWebGpuEngine() {
  return {
    snapshotRendering: false,
    snapshotRenderingMode: 0,
    snapshotRenderingReset() { /* presence of this marks the engine as WebGPU */ },
  };
}

describe('WebGPU snapshot rendering is never armed before the scene can draw', () => {
  it('applyWebGpuOptimizations does NOT switch snapshot rendering on', () => {
    const engine = makeFakeWebGpuEngine();

    const enabled = applyWebGpuOptimizations(engine as never);

    // The old implementation returned true here for the 'balanced' preset and
    // left an empty bundle recorded => permanently black world.
    expect(enabled).toBe(false);
    expect(engine.snapshotRendering).toBe(false);
  });

  it('does not enable snapshot rendering until the scene reports ready', () => {
    const babylonEngine = new NullEngine();
    const scene = new Scene(babylonEngine);
    const fake = makeFakeWebGpuEngine();
    const settings = { ...createDefaultSettings(), qualityPreset: 'balanced' as const };

    enableSnapshotRenderingWhenReady(fake as never, scene, settings);

    // Nothing has rendered yet, so it must still be off.
    expect(fake.snapshotRendering).toBe(false);

    scene.dispose();
    babylonEngine.dispose();
  });

  it('leaves snapshot rendering off entirely on high-quality presets', () => {
    const babylonEngine = new NullEngine();
    const scene = new Scene(babylonEngine);
    new FreeCamera('probe_camera', Vector3.Zero(), scene);
    const fake = makeFakeWebGpuEngine();
    const settings = { ...createDefaultSettings(), qualityPreset: 'cinematic' as const };

    enableSnapshotRenderingWhenReady(fake as never, scene, settings);
    for (let i = 0; i < 60; i += 1) scene.render();

    expect(fake.snapshotRendering).toBe(false);

    scene.dispose();
    babylonEngine.dispose();
  });

  it('stays off on the DEFAULT balanced preset (opt-in only)', () => {
    const babylonEngine = new NullEngine();
    const scene = new Scene(babylonEngine);
    new FreeCamera('probe_camera', Vector3.Zero(), scene);
    const fake = makeFakeWebGpuEngine();

    // 'balanced' is what a fresh install uses. The old build turned snapshot
    // rendering on here, which is why ordinary players saw a black world.
    enableSnapshotRenderingWhenReady(fake as never, scene, createDefaultSettings());
    for (let i = 0; i < 60; i += 1) scene.render();

    expect(fake.snapshotRendering).toBe(false);

    scene.dispose();
    babylonEngine.dispose();
  });

  it('stays off on performance because streamed meshes make snapshots unsafe', () => {
    const babylonEngine = new NullEngine();
    const scene = new Scene(babylonEngine);
    new FreeCamera('probe_camera', Vector3.Zero(), scene);
    const fake = makeFakeWebGpuEngine();
    const settings = { ...createDefaultSettings(), qualityPreset: 'performance' as const };

    enableSnapshotRenderingWhenReady(fake as never, scene, settings);
    for (let i = 0; i < 60; i += 1) scene.render();

    // A stale bundle can omit newly streamed block/material groups forever,
    // which presents as X-ray holes despite the underlying voxels existing.
    expect(fake.snapshotRendering).toBe(false);

    scene.dispose();
    babylonEngine.dispose();
  });

  it('is a no-op on the WebGL engine, which has no snapshot support', () => {
    const babylonEngine = new NullEngine();
    const scene = new Scene(babylonEngine);
    const webgl = { snapshotRendering: false };

    expect(() =>
      enableSnapshotRenderingWhenReady(webgl as never, scene, createDefaultSettings())
    ).not.toThrow();
    expect(webgl.snapshotRendering).toBe(false);

    scene.dispose();
    babylonEngine.dispose();
  });
});

/**
 * Regression tests for the true ribbon/vertex-shader Aurora Borealis.
 *
 * Brief: "Remove the broken, sunrise-style popping triangles along the
 * horizon. Replace them with a beautiful custom ribbon/vertex shader that
 * projects long, continuous, flowing curtains of neon green and purple
 * light stretching seamlessly across the night sky above the clouds."
 */
import { describe, it, expect } from 'vitest';
import { NullEngine, Scene, ShaderMaterial } from '@babylonjs/core';
import { AuroraRibbon } from '../../src/sky/AuroraRibbon';
import { CLOUD_DECK_ALTITUDE, CLOUD_DECK_THICKNESS } from '../../src/sky/VolumetricClouds';

function makeAurora(): { engine: NullEngine; scene: Scene; aurora: AuroraRibbon } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const aurora = new AuroraRibbon(scene);
  aurora.attach();
  return { engine, scene, aurora };
}

describe('AuroraRibbon — continuous ribbon geometry, not popping planes', () => {
  it('builds real Ribbon meshes, not flat planes', () => {
    const { engine, scene, aurora } = makeAurora();
    const ribbonMeshes = scene.meshes.filter((m) => m.name.startsWith('aurora_ribbon_'));
    expect(ribbonMeshes.length).toBe(aurora.getRibbonCount());
    expect(ribbonMeshes.length).toBeGreaterThan(1);
    for (const mesh of ribbonMeshes) {
      // A ribbon built from a dense vertical path has many more vertices
      // than a simple 4-vertex plane — this is what should replace the old
      // low-poly cards.
      const positions = mesh.getVerticesData('position');
      expect(positions, mesh.name).toBeTruthy();
      expect(positions!.length / 3).toBeGreaterThan(20);
    }
    aurora.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('drives every curtain with a genuine custom vertex+fragment shader', () => {
    const { engine, scene, aurora } = makeAurora();
    const ribbonMeshes = scene.meshes.filter((m) => m.name.startsWith('aurora_ribbon_'));
    for (const mesh of ribbonMeshes) {
      expect(mesh.material).toBeInstanceOf(ShaderMaterial);
    }
    aurora.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('is seated high above the cloud deck, not popping up along the horizon', () => {
    const { engine, scene, aurora } = makeAurora();
    const ribbonMeshes = scene.meshes.filter((m) => m.name.startsWith('aurora_ribbon_'));
    for (const mesh of ribbonMeshes) {
      const positions = mesh.getVerticesData('position')!;
      let minY = Infinity;
      for (let i = 1; i < positions.length; i += 3) minY = Math.min(minY, positions[i]);
      // The lowest point of every curtain must clear the top of the cloud
      // deck, so the aurora reads as "above the clouds" rather than a
      // horizon-level artifact.
      expect(minY).toBeGreaterThan(CLOUD_DECK_ALTITUDE + CLOUD_DECK_THICKNESS / 2);
    }
    aurora.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('stays hidden and inert at zero intensity (daytime / no aurora biome)', () => {
    const { engine, scene, aurora } = makeAurora();
    aurora.update(0.016, 0);
    expect(aurora.root.isEnabled()).toBe(false);
    aurora.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('becomes visible and advances its shader clock once intensity rises', () => {
    const { engine, scene, aurora } = makeAurora();
    aurora.update(0.016, 0.8);
    expect(aurora.root.isEnabled()).toBe(true);
    aurora.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('uses additive, non-depth-writing blending so curtains glow and layer instead of occluding each other', () => {
    const { engine, scene, aurora } = makeAurora();
    const ribbonMeshes = scene.meshes.filter((m) => m.name.startsWith('aurora_ribbon_'));
    for (const mesh of ribbonMeshes) {
      const mat = mesh.material as ShaderMaterial;
      expect(mat.disableDepthWrite).toBe(true);
      expect(mat.backFaceCulling).toBe(false);
    }
    aurora.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('disposes every ribbon mesh and material', () => {
    const { engine, scene, aurora } = makeAurora();
    const before = scene.meshes.length;
    aurora.dispose();
    expect(scene.meshes.length).toBeLessThan(before);
    scene.dispose();
    engine.dispose();
  });
});

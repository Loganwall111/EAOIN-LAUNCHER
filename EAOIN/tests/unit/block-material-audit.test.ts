/**
 * Opaque-terrain material audit regression tests — the X-ray defect lockdown.
 *
 * Grass, Dirt and Stone (plus the bedrock foundation) must be 100% solid,
 * vibrant and opaque: hard-coded `transparencyMode = 0`, material alpha 1,
 * texel alpha byte 255, no alpha blending path, no alpha channel exposed.
 * The audit function is what lets a future regression fail loudly and by
 * name instead of shipping a see-through world.
 */
import { describe, it, expect } from 'vitest';
import { NullEngine, Scene } from '@babylonjs/core';
import {
  auditOpaqueTerrainSafety,
  createBlockMaterials,
  OPAQUE_ALPHA_BYTE,
  OPAQUE_GROUND_BLOCKS,
  OPAQUE_TRANSPARENCY_MODE,
} from '../../src/rendering/BlockMaterials';
import { encodeSurfaceKey } from '../../src/rendering/GreedyMesher';

function makeScene(): { engine: NullEngine; scene: Scene } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  return { engine, scene };
}

describe('opaque terrain safety constants (hard-coded)', () => {
  it('locks the opaque alpha byte at 255 and the opaque transparency mode at 0', () => {
    expect(OPAQUE_ALPHA_BYTE).toBe(255);
    expect(OPAQUE_TRANSPARENCY_MODE).toBe(0);
    expect(Array.from(OPAQUE_GROUND_BLOCKS)).toEqual([1, 2, 3, 12]);
  });
});

describe('auditOpaqueTerrainSafety', () => {
  it('reports zero violations on the production material map', () => {
    const { engine, scene } = makeScene();
    const materials = createBlockMaterials(scene, 'classic');
    expect(auditOpaqueTerrainSafety(materials)).toEqual([]);
    scene.dispose();
    engine.dispose();
  });

  it('catches a sabotaged grass material by name (the X-ray regression)', () => {
    const { engine, scene } = makeScene();
    const materials = createBlockMaterials(scene, 'classic');
    const grass = materials.get(encodeSurfaceKey(1, 0));
    expect(grass).toBeDefined();
    // Simulate the original defect: something pushes grass into a blend pass.
    grass!.transparencyMode = 2; // MATERIAL_ALPHATESTANDBLEND
    const violations = auditOpaqueTerrainSafety(materials);
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('Grass');
    expect(violations[0]).toContain('transparencyMode');
    scene.dispose();
    engine.dispose();
  });

  it('catches alpha-channel leaks on a dirt texture', () => {
    const { engine, scene } = makeScene();
    const materials = createBlockMaterials(scene, 'classic');
    const dirt = materials.get(encodeSurfaceKey(2, 0));
    dirt!.diffuseTexture!.hasAlpha = true;
    const violations = auditOpaqueTerrainSafety(materials);
    expect(violations.some((v) => v.includes('Dirt') && v.includes('hasAlpha'))).toBe(true);
    scene.dispose();
    engine.dispose();
  });

  it('catches stone losing depth writing', () => {
    const { engine, scene } = makeScene();
    const materials = createBlockMaterials(scene, 'classic');
    const stone = materials.get(encodeSurfaceKey(3, 0));
    stone!.disableDepthWrite = true;
    const violations = auditOpaqueTerrainSafety(materials);
    expect(violations.some((v) => v.includes('Stone') && v.includes('depth'))).toBe(true);
    scene.dispose();
    engine.dispose();
  });

  it('leaves every face variant of the ground blocks covered', () => {
    const { engine, scene } = makeScene();
    const materials = createBlockMaterials(scene, 'classic');
    for (const id of OPAQUE_GROUND_BLOCKS) {
      for (const key of materials.keys()) {
        if ((key & 0xffff) !== id) continue;
        const material = materials.get(key)!;
        expect(material.alpha, `alpha ${id} variant ${key >> 16}`).toBe(1);
        expect(material.transparencyMode, `mode ${id} variant ${key >> 16}`).toBe(0);
        expect(material.needAlphaBlending(), `blend ${id}`).toBe(false);
        expect(material.needAlphaTesting(), `test ${id}`).toBe(false);
      }
    }
    scene.dispose();
    engine.dispose();
  });
});

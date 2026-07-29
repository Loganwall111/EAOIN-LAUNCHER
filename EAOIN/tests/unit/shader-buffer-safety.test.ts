/**
 * Regression tests for the missing-'Lights'-buffer crash class.
 *
 * The failure: a scene that renders light-receiving StandardMaterials while
 * owning zero lights can make the GPU backend fail the draw on a missing
 * 'Lights' uniform buffer. Custom ShaderMaterials carry the twin failure:
 * a GLSL-declared uniform with no binding. This suite pins the guard that
 * prevents both.
 */
import { describe, it, expect } from 'vitest';
import { HemisphericLight, NullEngine, Scene, Vector3 } from '@babylonjs/core';
import {
  collectDeclaredShaderUniforms,
  ensureSceneLightsBuffer,
  LIGHTS_GUARD_LIGHT_NAME,
  sceneLightsBufferSafe,
  validateShaderMaterialUniforms,
} from '../../src/rendering/ShaderBufferSafety';
import {
  AURORA_FRAGMENT_SHADER,
  AURORA_VERTEX_SHADER,
} from '../../src/sky/AuroraRibbon';
import { StarField } from '../../src/sky/StarField';

function makeScene(): { engine: NullEngine; scene: Scene } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  return { engine, scene };
}

describe('ensureSceneLightsBuffer', () => {
  it('installs exactly one guard light on a lightless scene', () => {
    const { engine, scene } = makeScene();
    expect(scene.lights.length).toBe(0);
    expect(sceneLightsBufferSafe(scene)).toBe(false);

    const guard = ensureSceneLightsBuffer(scene);
    expect(guard).not.toBeNull();
    expect(guard!.name).toBe(LIGHTS_GUARD_LIGHT_NAME);
    expect(scene.lights.length).toBe(1);
    expect(sceneLightsBufferSafe(scene)).toBe(true);

    engine.dispose();
  });

  it('is idempotent — a second call never duplicates the guard', () => {
    const { engine, scene } = makeScene();
    ensureSceneLightsBuffer(scene);
    const second = ensureSceneLightsBuffer(scene);
    expect(second).toBeNull();
    expect(scene.lights.filter((l) => l.name === LIGHTS_GUARD_LIGHT_NAME).length).toBe(1);

    const third = ensureSceneLightsBuffer(scene);
    expect(third).toBeNull();
    expect(scene.lights.length).toBe(1);
    engine.dispose();
  });

  it('leaves a real lighting rig untouched', () => {
    const { engine, scene } = makeScene();
    new HemisphericLight('sun', new Vector3(0, 1, 0), scene);
    const installed = ensureSceneLightsBuffer(scene);
    expect(installed).toBeNull();
    expect(scene.lights.length).toBe(1);
    expect(scene.lights[0].name).toBe('sun');
    engine.dispose();
  });

  it('fills in after every light was disposed (the teardown crash window)', () => {
    const { engine, scene } = makeScene();
    const sun = new HemisphericLight('sun', new Vector3(0, 1, 0), scene);
    sun.dispose();
    expect(scene.lights.length).toBe(0);
    ensureSceneLightsBuffer(scene);
    expect(scene.lights.length).toBe(1);
    engine.dispose();
  });
});

describe('validateShaderMaterialUniforms', () => {
  it('parses uniform declarations including comma lists and precision qualifiers', () => {
    const glsl = `
      precision highp float;
      uniform mat4 world;
      uniform highp float intensity, phase;
      uniform lowp vec3 tint;
      varying vec2 vUV;      /* not a uniform — must be ignored */
      attribute vec3 pos;    /* not a uniform either */
    `;
    const names = collectDeclaredShaderUniforms(glsl);
    expect(names).toEqual(expect.arrayContaining(['world', 'intensity', 'phase', 'tint']));
    expect(names).not.toContain('vUV');
    expect(names).not.toContain('pos');
  });

  it('passes the production aurora shader — every declared uniform is bound', () => {
    const bound = ['world', 'worldViewProjection', 'time', 'ribbonPhase', 'intensity'];
    const audit = validateShaderMaterialUniforms(AURORA_VERTEX_SHADER, AURORA_FRAGMENT_SHADER, bound);
    expect(audit.missing).toEqual([]);
    expect(audit.declared).toEqual(expect.arrayContaining(['time', 'ribbonPhase', 'intensity']));
  });

  it('flags a declared-but-unbound uniform (the WebGPU crash setup)', () => {
    const vertex = `
      uniform mat4 worldViewProjection;
      uniform float wobble;
      void main(void) { gl_Position = worldViewProjection * vec4(0.0); }
    `;
    const audit = validateShaderMaterialUniforms(vertex, '', ['worldViewProjection']);
    expect(audit.missing).toEqual(['wobble']);
  });

  it('flags the engine-owned Lights block when a raw shader requests it', () => {
    const vertex = `
      uniform Lights { vec4 lightDir; };
      uniform mat4 worldViewProjection;
      void main(void) { gl_Position = worldViewProjection * vec4(0.0); }
    `;
    const audit = validateShaderMaterialUniforms(vertex, '', ['worldViewProjection']);
    // A raw ShaderMaterial can never satisfy the scene-owned Lights buffer —
    // the audit must catch this exact declaration by block name.
    expect(audit.missing).toContain('Lights');
  });

  it('treats Babylon per-material builtins as engine-bound, never missing', () => {
    const vertex = `
      uniform mat4 world;
      uniform mat4 view;
      uniform mat4 worldViewProjection;
      uniform vec3 cameraPosition;
      void main(void) { gl_Position = worldViewProjection * vec4(0.0); }
    `;
    const audit = validateShaderMaterialUniforms(vertex, '', []);
    expect(audit.missing).toEqual([]);
  });
});

describe('sky systems keep the Lights buffer alive', () => {
  it('StarField.attach leaves the scene with at least one light', () => {
    const { engine, scene } = makeScene();
    expect(scene.lights.length).toBe(0);
    const stars = new StarField(scene, 'safety-seed');
    stars.attach();
    expect(scene.lights.length).toBeGreaterThan(0);
    stars.dispose();
    scene.dispose();
    engine.dispose();
  });
});

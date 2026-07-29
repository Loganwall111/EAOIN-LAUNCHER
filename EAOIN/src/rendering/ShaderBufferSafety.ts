/**
 * ShaderBufferSafety — uniform & light bindings that cannot crash the renderer.
 *
 * ## The failure this module prevents
 *
 * Babylon compiles one `Lights` uniform buffer per scene for every
 * light-receiving material. If a mesh renders while the scene owns *zero*
 * lights — a torn-down lighting rig, a freshly rebuilt overlay scene, or a dev
 * tool that disposed the sun — the GPU backend can fail the draw with a
 * missing-'Lights'-buffer error instead of falling back to unlit shading.
 * Custom `ShaderMaterial`s carry the same risk in a second form: binding an
 * incomplete uniform list when the GLSL declares more uniforms than the
 * material registers.
 *
 * ## The contract
 *
 *  1. A scene that renders any `StandardMaterial` keeps at least one light
 *     alive at all times. `ensureSceneLightsBuffer` installs a dim guard
 *     light — exactly once — whenever the rig is found empty.
 *  2. Every custom shader's declared uniforms must be fully covered by the
 *     `ShaderMaterial` uniform list. `validateShaderMaterialUniforms` is the
 *     compile-time-style check; a `missing` entry is a binding crash that
 *     never reaches the player.
 */
import { HemisphericLight, Light, Scene, Vector3 } from '@babylonjs/core';

/** Name of the guard light, so it is recognisable in inspectors and tests. */
export const LIGHTS_GUARD_LIGHT_NAME = 'eaoin_lights_buffer_guard';

/** Result of auditing a shader's declared uniforms against its bindings. */
export interface ShaderUniformAudit {
  /** Uniforms the GLSL declares that the material will bind anyway. */
  declared: string[];
  /** Uniforms the material claims to bind. */
  bound: string[];
  /** GLSL-declared uniforms with no binding — these crash on WebGPU. */
  missing: string[];
  /** Bound names never declared in GLSL — harmless but dead weight. */
  unused: string[];
}

/**
 * Guarantee the scene's light list is non-empty so Babylon always has a real
 * `Lights` uniform buffer to bind. Idempotent: returns `null` when a rig
 * already exists or a guard was installed earlier.
 */
export function ensureSceneLightsBuffer(scene: Scene): Light | null {
  const existingGuard = scene.lights.find((l) => l.name === LIGHTS_GUARD_LIGHT_NAME);
  if (existingGuard) return null;
  if (scene.lights.length > 0) return null;

  // Deliberately dim and neutral: it exists to satisfy the buffer binding,
  // not to light the level. The real lighting rig overpowers it instantly,
  // and it is removed with the scene like any other light.
  const guard = new HemisphericLight(
    LIGHTS_GUARD_LIGHT_NAME,
    new Vector3(0, 1, 0),
    scene
  );
  guard.diffuse.set(0.02, 0.02, 0.02);
  guard.specular.set(0, 0, 0);
  guard.intensity = 0.05;
  return guard;
}

/**
 * True when the scene is safe for light-receiving materials — either it has a
 * real rig of its own or the guard light is installed.
 */
export function sceneLightsBufferSafe(scene: Scene): boolean {
  return scene.lights.length > 0;
}

/**
 * Pull every `uniform <type> <name>` declaration out of a GLSL source string.
 * Handles comma-separated declarations (`uniform float a, b;`) and ignores
 * attributes/varyings. Uniform buffer blocks (`uniform Lights { ... };`) are
 * reported under the block name so a `ShaderMaterial` that accidentally asks
 * for the engine-owned `Lights` buffer is caught by the audit.
 */
export function collectDeclaredShaderUniforms(source: string): string[] {
  const names = new Set<string>();
  const statement = /uniform\s+(?:highp\s+|mediump\s+|lowp\s+)?\w+\s+([^;{}()]+);/g;
  let match: RegExpExecArray | null;
  while ((match = statement.exec(source)) !== null) {
    for (const part of match[1].split(',')) {
      const name = part.trim().replace(/\[.*\]$/, '');
      if (name.length > 0) names.add(name);
    }
  }
  // Uniform buffer blocks need the scene to hand the shader a bound buffer
  // under the block name (Babylon's own lighting block is named "Lights").
  const block = /uniform\s+(\w+)\s*\{/g;
  while ((match = block.exec(source)) !== null) {
    names.add(match[1]);
  }
  return [...names];
}

/**
 * Audit a custom ShaderMaterial's uniform list against its GLSL.
 *
 * `bound` is the list passed in the material options
 * (`uniforms: [...]`). Babylon's per-material built-ins
 * (`world`, `view`, `projection`, `worldViewProjection`, …) are engine-bound
 * automatically, so they never count as missing; everything else — including
 * the engine-owned `Lights` block, which a raw ShaderMaterial cannot satisfy —
 * must appear in `bound`.
 */
export function validateShaderMaterialUniforms(
  vertexSource: string,
  fragmentSource: string,
  bound: readonly string[]
): ShaderUniformAudit {
  const engineBound = new Set([
    'world',
    'worldViewProjection',
    'viewProjection',
    'view',
    'projection',
    'cameraPosition',
    'worldView',
  ]);
  const declared = [
    ...new Set([
      ...collectDeclaredShaderUniforms(vertexSource),
      ...collectDeclaredShaderUniforms(fragmentSource),
    ]),
  ];
  const boundSet = new Set(bound);
  const missing = declared.filter((name) => !boundSet.has(name) && !engineBound.has(name));
  const unused = bound.filter((name) => !declared.includes(name) && !engineBound.has(name));
  return { declared, bound: [...bound], missing, unused };
}

/**
 * Log a hard warning for any shader that fails the audit, in one place, so a
 * future custom shader surfaces the exact binding to fix during development
 * rather than a GPU crash in production. Returns the audit for tests.
 */
export function auditShaderMaterial(
  materialName: string,
  vertexSource: string,
  fragmentSource: string,
  bound: readonly string[]
): ShaderUniformAudit {
  const audit = validateShaderMaterialUniforms(vertexSource, fragmentSource, bound);
  if (audit.missing.length > 0) {
    console.warn(
      `[ShaderBufferSafety] "${materialName}" GLSL declares uniforms with no binding: ` +
      `${audit.missing.join(', ')}. This is the missing-buffer crash class — bind them ` +
      `in the ShaderMaterial options or remove the declaration.`
    );
  }
  return audit;
}

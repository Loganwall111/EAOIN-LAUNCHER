/**
 * AuroraRibbon — a true ribbon/vertex-shader Aurora Borealis.
 *
 * ## What this replaces
 *
 * The previous aurora (`StarField.createAurora`) was a fan of flat
 * `CreatePlane` cards, each independently scaled and rotated in JS every
 * frame. Planes popping in and out of alignment as they individually
 * rescale is what read as "broken, sunrise-style popping triangles along the
 * horizon" — a set of discrete quads snapping between poses rather than one
 * continuous light form.
 *
 * ## What this is instead
 *
 * Each curtain is a single `CreateRibbon` mesh built from a dense vertical
 * grid of control points, so the geometry itself is a long, continuous,
 * flowing strip rather than a handful of independently posed cards. All of
 * the actual motion — the horizontal wave, the vertical shimmer, the
 * flowing neon-green-to-purple colour travel — happens **in a custom vertex
 * and fragment shader**, so the ribbon genuinely undulates as one continuous
 * surface instead of snapping between JS-driven poses. Multiple ribbons are
 * arranged in a wide arc high above the cloud deck, tall enough and far
 * enough out that they read as curtains stretching across the whole night
 * sky rather than a cluster of local triangles at the horizon.
 */
import {
  Effect,
  Mesh,
  MeshBuilder,
  Scene,
  ShaderMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import { auditShaderMaterial } from '../rendering/ShaderBufferSafety';

const SHADER_NAME = 'eaoinAuroraRibbon';

/** Exported so the shader-buffer audit can inspect the exact source it guards. */
export const AURORA_VERTEX_SHADER = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;

uniform mat4 worldViewProjection;
uniform mat4 world;
uniform float time;
uniform float ribbonPhase;

varying vec2 vUV;
varying vec3 vWorldPosition;

void main(void) {
  vec3 pos = position;
  // v (0=bottom, 1=top of the curtain) drives a travelling horizontal wave,
  // so the ribbon undulates like a real curtain of light rather than a flat
  // card. Multiple overlapping sine terms at different frequencies keep it
  // from reading as one mechanical ripple.
  float v = uv.y;
  float wave = sin(time * 0.6 + v * 6.2831 * 1.4 + ribbonPhase) * 5.5
             + sin(time * 0.37 + v * 6.2831 * 2.6 + ribbonPhase * 1.7) * 2.4;
  pos.x += wave;
  pos.z += wave * 0.6;
  // A slower vertical breathing so the whole sheet gently rises and falls.
  pos.y += sin(time * 0.22 + ribbonPhase * 2.1) * 3.0;

  vUV = uv;
  vWorldPosition = (world * vec4(pos, 1.0)).xyz;
  gl_Position = worldViewProjection * vec4(pos, 1.0);
}
`;

/** Exported so the shader-buffer audit can inspect the exact source it guards. */
export const AURORA_FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUV;
varying vec3 vWorldPosition;

uniform float time;
uniform float ribbonPhase;
uniform float intensity;

// Flowing colour ramp: neon green -> cyan -> violet -> back to green, so the
// curtain's hue genuinely travels along its length instead of sitting fixed.
vec3 auroraRamp(float t) {
  vec3 green = vec3(0.25, 1.0, 0.55);
  vec3 cyan = vec3(0.30, 0.95, 0.85);
  vec3 violet = vec3(0.62, 0.30, 0.98);
  float phase = fract(t);
  if (phase < 0.5) {
    return mix(green, cyan, phase * 2.0);
  }
  return mix(cyan, violet, (phase - 0.5) * 2.0);
}

void main(void) {
  float v = vUV.y;
  // Soft vertical falloff: bright through the middle, fading to nothing at
  // the very top and bottom edges — a real curtain, not a hard-edged card.
  float edgeFade = smoothstep(0.0, 0.18, v) * (1.0 - smoothstep(0.82, 1.0, v));

  // Slow colour drift along the ribbon's length and across time.
  float huePos = vUV.x * 0.6 + time * 0.05 + ribbonPhase * 0.35;
  vec3 color = auroraRamp(huePos);

  // Fine internal shimmer so the sheet reads as flowing light rather than a
  // flat gradient decal.
  float shimmer = 0.75 + 0.25 * sin(time * 1.6 + vUV.x * 18.0 + v * 9.0);

  float alpha = edgeFade * shimmer * intensity;
  gl_FragColor = vec4(color * (0.7 + shimmer * 0.5), alpha);
}
`;

Effect.ShadersStore[`${SHADER_NAME}VertexShader`] = AURORA_VERTEX_SHADER;
Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = AURORA_FRAGMENT_SHADER;

/** Uniform list bound by every aurora ShaderMaterial — audited at attach. */
const AURORA_BOUND_UNIFORMS = ['world', 'worldViewProjection', 'time', 'ribbonPhase', 'intensity'];

/** How many vertical control points make up each ribbon's flowing strip. */
const RIBBON_SEGMENTS = 28;
const RIBBON_COUNT = 5;
const RIBBON_HEIGHT = 460;
const RIBBON_WIDTH = 220;
const RIBBON_BASE_Y = 380;
const RIBBON_RADIUS = 640;

interface RibbonInstance {
  mesh: Mesh;
  material: ShaderMaterial;
  phase: number;
}

export class AuroraRibbon {
  private readonly scene: Scene;
  readonly root: TransformNode;
  private ribbons: RibbonInstance[] = [];
  private elapsed = 0;
  private disposed = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.root = new TransformNode('aurora_ribbon_root', scene);
  }

  attach(): void {
    // Compile-time-style audit of the custom shader's uniform bindings. If a
    // future edit adds a GLSL uniform without binding it (the WebGPU
    // "missing buffer" crash class), this surfaces it immediately at attach
    // instead of as a GPU fault mid-game.
    auditShaderMaterial(
      SHADER_NAME,
      AURORA_VERTEX_SHADER,
      AURORA_FRAGMENT_SHADER,
      AURORA_BOUND_UNIFORMS
    );
    for (let i = 0; i < RIBBON_COUNT; i += 1) {
      const angle = (i / RIBBON_COUNT) * Math.PI * 1.4 - Math.PI * 0.2;
      const centerX = Math.cos(angle) * RIBBON_RADIUS;
      const centerZ = Math.sin(angle) * RIBBON_RADIUS;
      // Tangential direction along the arc, so each ribbon faces roughly
      // toward the centre of the sky arc rather than all facing one way.
      const dirX = -Math.sin(angle);
      const dirZ = Math.cos(angle);

      const pathArray: Vector3[][] = [];
      // Two paths (left edge, right edge) of RIBBON_SEGMENTS points each —
      // CreateRibbon interpolates a continuous strip of geometry between
      // them, which is what gives the "long continuous flowing curtain"
      // shape instead of a stack of discrete quads.
      const left: Vector3[] = [];
      const right: Vector3[] = [];
      for (let s = 0; s <= RIBBON_SEGMENTS; s += 1) {
        const y = RIBBON_BASE_Y + (s / RIBBON_SEGMENTS) * RIBBON_HEIGHT;
        left.push(new Vector3(
          centerX - dirX * RIBBON_WIDTH * 0.5,
          y,
          centerZ - dirZ * RIBBON_WIDTH * 0.5
        ));
        right.push(new Vector3(
          centerX + dirX * RIBBON_WIDTH * 0.5,
          y,
          centerZ + dirZ * RIBBON_WIDTH * 0.5
        ));
      }
      pathArray.push(left, right);

      const mesh = MeshBuilder.CreateRibbon(
        `aurora_ribbon_${i}`,
        { pathArray, sideOrientation: Mesh.DOUBLESIDE, updatable: false },
        this.scene
      );
      mesh.isPickable = false;
      mesh.checkCollisions = false;
      mesh.applyFog = false;
      mesh.renderingGroupId = 0;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.doNotSyncBoundingInfo = true;
      mesh.parent = this.root;

      const material = new ShaderMaterial(
        `aurora_ribbon_mat_${i}`,
        this.scene,
        SHADER_NAME,
        {
          attributes: ['position', 'uv'],
          uniforms: [...AURORA_BOUND_UNIFORMS],
          needAlphaBlending: true,
        }
      );
      material.backFaceCulling = false;
      material.disableDepthWrite = true;
      material.alphaMode = 1; // ALPHA_ADD — glows like real auroral light.
      material.setFloat('ribbonPhase', i * 1.7);
      material.setFloat('intensity', 0);
      mesh.material = material;

      this.ribbons.push({ mesh, material, phase: i * 1.7 });
    }
  }

  /**
   * Advance the shader clock and set overall visibility.
   *
   * `intensity` is 0-1, driven by night factor and the active sky profile's
   * `auroraStrength` — the same inputs the old plane-based aurora used, so
   * swapping the implementation needed no change to callers beyond wiring.
   */
  update(deltaSeconds: number, intensity: number): void {
    if (this.disposed) return;
    this.elapsed += deltaSeconds;
    const visible = intensity > 0.01;
    this.root.setEnabled(visible);
    if (!visible) return;

    for (const ribbon of this.ribbons) {
      ribbon.material.setFloat('time', this.elapsed);
      ribbon.material.setFloat('intensity', intensity);
    }
  }

  getRibbonCount(): number {
    return this.ribbons.length;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const ribbon of this.ribbons) {
      ribbon.mesh.dispose();
      ribbon.material.dispose();
    }
    this.ribbons = [];
    this.root.dispose(false, true);
  }
}

export default AuroraRibbon;

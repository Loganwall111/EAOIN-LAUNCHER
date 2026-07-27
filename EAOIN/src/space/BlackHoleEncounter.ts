/**
 * BlackHoleEncounter — "Life Comes Apart 2.0" real black hole.
 *
 * A physical, enterable black hole that appears at night (and permanently at
 * the top of the central End island). Unlike the decorative one in the sky
 * rig, this one:
 *
 *   - renders with a genuine **gravitational lensing** post-process that warps
 *     the framebuffer radially around the event horizon, including an Einstein
 *     ring and chromatic dispersion;
 *   - exerts real pull on the player once inside its influence radius;
 *   - crosses an event horizon that drops you into the Void encounter, where
 *     the tentacle leviathan waits.
 *
 * Lensing is done as a screen-space post-process rather than by ray-marching
 * the scene, which keeps it affordable while still bending the starfield,
 * terrain and clouds around the hole the way a real one does.
 */
import {
  Camera,
  Color3,
  Effect,
  Matrix,
  Mesh,
  MeshBuilder,
  PostProcess,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';

/** Distance at which the player starts being pulled in. */
export const INFLUENCE_RADIUS = 90;
/** Distance at which the player is committed — no escape. */
export const EVENT_HORIZON_RADIUS = 9;
/** Shader name registered with Babylon's shader store. */
const LENS_SHADER = 'eaoinGravitationalLens';

/**
 * Screen-space gravitational lensing.
 *
 * For each pixel we compute its offset from the hole's projected screen
 * position, then pull the sample point inward by an amount proportional to
 * `strength / distance^2` — the same inverse-square falloff light actually
 * follows near a mass. Inside the Schwarzschild radius nothing escapes, so we
 * output black; just outside it we brighten into the Einstein ring.
 */
Effect.ShadersStore[`${LENS_SHADER}FragmentShader`] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform vec2 holeCenter;     // hole position in screen UV space
uniform float holeRadius;    // apparent event-horizon radius in UV units
uniform float strength;      // 0 when far away, 1 at full effect
uniform float aspect;        // viewport aspect, so the warp stays circular

void main(void) {
  // Work in aspect-corrected space so the distortion is a circle, not an oval.
  vec2 uv = vUV;
  vec2 d = uv - holeCenter;
  d.x *= aspect;
  float dist = length(d);

  // Everything inside the horizon is gone.
  if (dist < holeRadius) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Inverse-square deflection, clamped so pixels near the rim don't fly across
  // the screen and alias badly.
  float deflection = strength * holeRadius * holeRadius / (dist * dist);
  deflection = min(deflection, 0.45);

  vec2 dir = normalize(d);
  vec2 warp = dir * deflection;
  warp.x /= aspect;
  vec2 sampleUV = uv - warp;

  // Chromatic dispersion: blue light bends slightly more than red, so sample
  // the channels at marginally different deflections.
  vec2 warpR = warp * 0.965;
  vec2 warpB = warp * 1.045;
  warpR.x /= 1.0; warpB.x /= 1.0;
  float r = texture2D(textureSampler, clamp(uv - warpR, 0.001, 0.999)).r;
  float g = texture2D(textureSampler, clamp(sampleUV, 0.001, 0.999)).g;
  float b = texture2D(textureSampler, clamp(uv - warpB, 0.001, 0.999)).b;
  vec3 col = vec3(r, g, b);

  // Einstein ring: a bright photon-sphere halo hugging the horizon.
  float ringDist = abs(dist - holeRadius * 1.32);
  float ring = exp(-ringDist * 90.0) * strength;
  col += vec3(1.0, 0.72, 0.38) * ring * 1.6;

  // Deepen the shadow as we approach the horizon.
  float shadow = smoothstep(holeRadius * 2.6, holeRadius, dist);
  col *= 1.0 - shadow * 0.92 * strength;

  gl_FragColor = vec4(col, 1.0);
}
`;

export interface BlackHoleState {
  /** Whether the hole is currently present in the world. */
  active: boolean;
  /** 0-1 how strongly the player is inside its influence. */
  pull: number;
  /** True on the frame the player crosses the event horizon. */
  consumed: boolean;
  /** Metres from the player to the singularity. */
  distance: number;
}

export class BlackHoleEncounter {
  private readonly scene: Scene;
  private readonly camera: Camera;
  readonly root: TransformNode;

  private horizon: Mesh | null = null;
  private photonRing: Mesh | null = null;
  private disc: Mesh | null = null;
  private lens: PostProcess | null = null;

  /** World position of the singularity. */
  position = new Vector3(0, 120, 0);
  private active = false;
  private elapsed = 0;
  private disposed = false;
  private consumedFired = false;

  /** Raised when the player crosses the horizon. */
  onConsumed: (() => void) | null = null;

  constructor(scene: Scene, camera: Camera) {
    this.scene = scene;
    this.camera = camera;
    this.root = new TransformNode('black_hole_encounter', scene);
    this.root.setEnabled(false);
  }

  attach(): void {
    // Event horizon — absolute black, occludes everything behind it.
    const horizon: Mesh = MeshBuilder.CreateSphere(
      'bh_event_horizon',
      { diameter: EVENT_HORIZON_RADIUS * 2, segments: 24 },
      this.scene
    );
    const hm = new StandardMaterial('bh_horizon_mat', this.scene);
    hm.emissiveColor = Color3.Black();
    hm.diffuseColor = Color3.Black();
    hm.specularColor = Color3.Black();
    hm.disableLighting = true;
    hm.fogEnabled = false;
    horizon.material = hm;
    horizon.parent = this.root;
    horizon.isPickable = false;
    horizon.applyFog = false;
    this.horizon = horizon;

    // Photon sphere.
    const ring = MeshBuilder.CreateTorus(
      'bh_photon_ring',
      { diameter: EVENT_HORIZON_RADIUS * 2.7, thickness: 0.9, tessellation: 72 },
      this.scene
    );
    const rm = new StandardMaterial('bh_photon_mat', this.scene);
    rm.emissiveColor = new Color3(1.0, 0.78, 0.42);
    rm.diffuseColor = Color3.Black();
    rm.disableLighting = true;
    rm.fogEnabled = false;
    rm.alpha = 0.9;
    ring.material = rm;
    ring.parent = this.root;
    ring.isPickable = false;
    ring.applyFog = false;
    this.photonRing = ring;

    // Accretion disc.
    const disc = MeshBuilder.CreateTorus(
      'bh_accretion_disc',
      { diameter: EVENT_HORIZON_RADIUS * 5.5, thickness: EVENT_HORIZON_RADIUS * 1.6, tessellation: 64 },
      this.scene
    );
    const dm = new StandardMaterial('bh_disc_mat', this.scene);
    dm.emissiveColor = new Color3(1.0, 0.48, 0.16);
    dm.diffuseColor = Color3.Black();
    dm.disableLighting = true;
    dm.fogEnabled = false;
    dm.alpha = 0.62;
    disc.material = dm;
    disc.scaling.y = 0.08;
    disc.parent = this.root;
    disc.isPickable = false;
    disc.applyFog = false;
    this.disc = disc;

    this.root.rotation.x = 0.5;
  }

  /** Place and enable the hole. */
  spawn(position: Vector3): void {
    this.position.copyFrom(position);
    this.root.position.copyFrom(position);
    this.root.setEnabled(true);
    this.active = true;
    this.consumedFired = false;
    this.ensureLens();
  }

  despawn(): void {
    this.active = false;
    this.root.setEnabled(false);
    this.disposeLens();
  }

  isActive(): boolean {
    return this.active;
  }

  /** Build the lensing post-process lazily — only while a hole exists. */
  private ensureLens(): void {
    if (this.lens || this.disposed) return;
    try {
      this.lens = new PostProcess(
        'bh_lens',
        LENS_SHADER,
        ['holeCenter', 'holeRadius', 'strength', 'aspect'],
        null,
        1.0,
        this.camera
      );
    } catch (error) {
      // Never let a shader compile failure break the frame.
      console.warn('[BlackHole] Lensing shader unavailable; falling back to geometry only.', error);
      this.lens = null;
    }
  }

  private disposeLens(): void {
    this.lens?.dispose();
    this.lens = null;
  }

  /**
   * Advance the encounter.
   *
   * @param playerPosition mutated in place when the hole pulls the player in.
   */
  update(deltaSeconds: number, playerPosition: Vector3): BlackHoleState {
    if (!this.active || this.disposed) {
      return { active: false, pull: 0, consumed: false, distance: Infinity };
    }

    this.elapsed += deltaSeconds;

    // Spin the disc fast and the ring slowly.
    if (this.disc) this.disc.rotation.y = this.elapsed * 1.15;
    if (this.photonRing) this.photonRing.rotation.y = -this.elapsed * 0.42;
    // The horizon "breathes" very slightly, so it never reads as a static ball.
    if (this.horizon) {
      const breathe = 1 + Math.sin(this.elapsed * 0.6) * 0.015;
      this.horizon.scaling.set(breathe, breathe, breathe);
    }

    const toHole = this.position.subtract(playerPosition);
    const distance = toHole.length();

    // 0 outside the influence radius, 1 at the horizon.
    const pull = distance >= INFLUENCE_RADIUS
      ? 0
      : Math.min(1, Math.pow(1 - distance / INFLUENCE_RADIUS, 2));

    // Apply real gravitational attraction.
    if (pull > 0.001 && distance > 0.01) {
      const accel = pull * 26;
      playerPosition.addInPlace(toHole.normalize().scale(accel * deltaSeconds));
    }

    this.updateLens(playerPosition, pull, distance);

    let consumed = false;
    if (distance <= EVENT_HORIZON_RADIUS && !this.consumedFired) {
      this.consumedFired = true;
      consumed = true;
      this.onConsumed?.();
    }

    return { active: true, pull, consumed, distance };
  }

  /** Project the hole to screen space and feed the lensing shader. */
  private updateLens(playerPosition: Vector3, pull: number, distance: number): void {
    if (!this.lens) return;

    const engine = this.scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const aspect = width / Math.max(1, height);

    // Project the singularity into normalised screen coordinates.
    const identity = this.scene.getTransformMatrix();
    const viewport = this.camera.viewport.toGlobal(width, height);
    const projected = Vector3.Project(this.position, Matrix.Identity(), identity, viewport);

    const cx = projected.x / width;
    // Babylon projects with Y down; the shader samples with Y up.
    const cy = 1 - projected.y / height;

    // Behind the camera, or off screen — fade the effect out entirely rather
    // than warping the wrong part of the frame.
    const forward = this.camera.getForwardRay().direction;
    const toHole = this.position.subtract(playerPosition).normalize();
    const facing = Vector3.Dot(forward, toHole);
    const onScreen = facing > 0 && cx > -0.6 && cx < 1.6 && cy > -0.6 && cy < 1.6;

    // Apparent size falls off with distance, exactly like a real object.
    const apparentRadius = Math.min(0.55, (EVENT_HORIZON_RADIUS / Math.max(1, distance)) * 0.85);
    const strength = onScreen ? Math.max(pull, Math.min(1, 24 / Math.max(1, distance))) : 0;

    this.lens.onApply = (effect) => {
      effect.setFloat2('holeCenter', cx, cy);
      effect.setFloat('holeRadius', apparentRadius);
      effect.setFloat('strength', strength);
      effect.setFloat('aspect', aspect);
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeLens();
    this.root.dispose(false, true);
  }
}

export default BlackHoleEncounter;

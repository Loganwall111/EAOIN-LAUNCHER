/**
 * SkyDome — the single, authoritative sky background.
 *
 * ## The bug this replaces
 *
 * `SceneLighting.configureSceneLighting()` used to create **two** nested
 * `infiniteDistance` BACKSIDE spheres:
 *
 *   overworld_sky_dome     d=1200  alpha 1.00
 *   horizon_gradient_dome  d=800   alpha 0.08
 *
 * Because `infiniteDistance` pins a mesh to the camera, both spheres sat at the
 * *same* effective depth with the smaller one permanently inside the larger.
 * With no depth separation they z-fought, and — critically — the outer dome was
 * painted with a **single flat emissive colour**. So the moment you pitched the
 * camera up past the horizon line, the entire frame became one uniform blue
 * fill that flickered. Look back down at terrain and it looked normal again.
 * That is exactly the reported "blue screen flashing at me when I look in the
 * sky, and when I turn away it goes back to normal".
 *
 * On top of that, three separate systems were each writing `scene.clearColor`
 * and `scene.fogColor` every frame with different formulas, so the dome colour,
 * the clear colour and the fog colour never agreed — producing a hard, popping
 * seam at the horizon.
 *
 * ## The fix
 *
 * One dome. One writer. A real vertical gradient baked into **vertex colours**,
 * so zenith → horizon is a smooth ramp instead of a flat fill, plus a separate
 * sun-facing glow band for sunrise/sunset. The dome owns `scene.clearColor` and
 * `scene.fogColor` and keeps them consistent with the gradient it is drawing,
 * so the horizon blends seamlessly into the fogged terrain instead of banding.
 */
import {
  Color3,
  Color4,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
  VertexBuffer,
} from '@babylonjs/core';
import { SkyProfile } from './SkyProfiles';

/**
 * Dome radius. Must be comfortably inside `camera.maxZ` (1500) so the dome is
 * never clipped by the far plane — a clipped dome punches a hole straight to
 * the clear colour and is itself a source of "flashing sky".
 */
export const SKY_DOME_DIAMETER = 2400;

export class SkyDome {
  private readonly scene: Scene;
  private dome: Mesh | null = null;
  private material: StandardMaterial | null = null;
  /** Cached unit-sphere Y of each vertex, in [-1, 1]. */
  private vertexHeights: Float32Array | null = null;
  /** Cached unit-sphere direction of each vertex, for the sun glow band. */
  private vertexDirections: Float32Array | null = null;
  private colorBuffer: Float32Array | null = null;
  private disposed = false;
  /** Throttle: repainting ~20x/sec is imperceptible and much cheaper. */
  private sinceRepaint = 0;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  attach(): void {
    // A single BACKSIDE sphere. Note we do NOT use `infiniteDistance`: the dome
    // is explicitly re-centred on the camera each frame instead. Using both at
    // once double-applies the camera offset, which is what dragged the old sky
    // layers into the near clip plane.
    const dome = MeshBuilder.CreateSphere(
      'eaoin_sky_dome',
      { diameter: SKY_DOME_DIAMETER, segments: 32, sideOrientation: Mesh.BACKSIDE },
      this.scene
    );

    const material = new StandardMaterial('eaoin_sky_dome_mat', this.scene);
    material.backFaceCulling = false;
    material.disableLighting = true;
    // The gradient lives in vertex colours. A white emissive base means the
    // per-vertex colours come through unmodified.
    material.emissiveColor = new Color3(1, 1, 1);
    material.diffuseColor = Color3.Black();
    material.specularColor = Color3.Black();
    material.ambientColor = Color3.Black();
    material.fogEnabled = false;
    material.alpha = 1;
    dome.material = material;

    dome.isPickable = false;
    dome.checkCollisions = false;
    dome.applyFog = false;
    // Group 0 = drawn before everything, so all world geometry occludes it.
    dome.renderingGroupId = 0;
    dome.alwaysSelectAsActiveMesh = true;
    dome.doNotSyncBoundingInfo = true;
    dome.infiniteDistance = false;
    dome.metadata = { skyDome: true };

    // Cache per-vertex unit directions so the per-frame repaint is a cheap
    // colour write with no trigonometry or allocation.
    const positions = dome.getVerticesData(VertexBuffer.PositionKind);
    if (positions) {
      const count = positions.length / 3;
      this.vertexHeights = new Float32Array(count);
      this.vertexDirections = new Float32Array(count * 3);
      const r = SKY_DOME_DIAMETER / 2;
      for (let i = 0; i < count; i += 1) {
        const x = positions[i * 3] / r;
        const y = positions[i * 3 + 1] / r;
        const z = positions[i * 3 + 2] / r;
        this.vertexHeights[i] = Math.max(-1, Math.min(1, y));
        this.vertexDirections[i * 3] = x;
        this.vertexDirections[i * 3 + 1] = y;
        this.vertexDirections[i * 3 + 2] = z;
      }
      this.colorBuffer = new Float32Array(count * 4);
      dome.setVerticesData(VertexBuffer.ColorKind, this.colorBuffer, true);
      dome.hasVertexAlpha = false;
    }

    this.dome = dome;
    this.material = material;
  }

  /**
   * Repaint the gradient and publish the matching scene clear/fog colours.
   *
   * This method is the **only** place in the engine that writes
   * `scene.clearColor` and `scene.fogColor`, which is what guarantees the
   * horizon stays seamless.
   */
  update(
    profile: SkyProfile,
    dayFactor: number,
    horizonFactor: number,
    sunDirection: Vector3,
    cameraPosition: Vector3,
    deltaSeconds: number
  ): { zenith: Color3; horizon: Color3; fog: Color3 } {
    // Blend the profile's day and night palettes by the current sun elevation.
    const zenith = Color3.Lerp(profile.zenithNight, profile.zenithDay, dayFactor);
    const horizon = Color3.Lerp(profile.horizonNight, profile.horizonDay, dayFactor);
    const fog = Color3.Lerp(profile.fogNight, profile.fogDay, dayFactor);

    // Warm the horizon band towards the sunset colour near dawn/dusk.
    const litHorizon = Color3.Lerp(horizon, profile.sunsetGlow, horizonFactor * 0.72);
    const litFog = Color3.Lerp(fog, profile.sunsetGlow, horizonFactor * 0.38);

    if (this.dome) {
      // Re-centre on the camera in all three axes. The dome is 2400 units
      // across, so the player is always deep inside it and can never reach,
      // clip, or exit it — the geometric guarantee against the "wall of blue".
      this.dome.position.copyFrom(cameraPosition);

      this.sinceRepaint += deltaSeconds;
      if (this.sinceRepaint >= 0.05) {
        this.sinceRepaint = 0;
        this.paintGradient(zenith, litHorizon, profile, sunDirection, horizonFactor);
      }
    }

    // Publish the atmosphere. Clear colour matches the horizon band so that any
    // pixel the dome somehow fails to cover blends in rather than flashing.
    this.scene.clearColor = new Color4(litHorizon.r, litHorizon.g, litHorizon.b, 1);
    this.scene.fogColor = litFog;

    return { zenith, horizon: litHorizon, fog: litFog };
  }

  /**
   * Write the vertical gradient plus the sun glow band into vertex colours.
   *
   * Three bands are composited per vertex:
   *   1. zenith → horizon ramp, biased so most of the visible dome is sky and
   *      the bright band stays tight to the horizon;
   *   2. a below-horizon darkening so the lower hemisphere reads as ground haze;
   *   3. a radial glow around the sun direction, strongest at sunrise/sunset.
   */
  private paintGradient(
    zenith: Color3,
    horizon: Color3,
    profile: SkyProfile,
    sunDirection: Vector3,
    horizonFactor: number
  ): void {
    if (!this.dome || !this.colorBuffer || !this.vertexHeights || !this.vertexDirections) return;

    // `sunDirection` points *from* the sun toward the world, so negate it to
    // get the direction a viewer looks to see the sun.
    const sx = -sunDirection.x;
    const sy = -sunDirection.y;
    const sz = -sunDirection.z;

    const count = this.vertexHeights.length;
    for (let i = 0; i < count; i += 1) {
      const h = this.vertexHeights[i];

      // Bias the ramp with a power curve: keeps the saturated zenith colour
      // across most of the sky and compresses the bright band near the horizon,
      // which is what real atmospheric scattering looks like.
      const t = Math.pow(Math.max(0, h), 0.58);
      let r = horizon.r + (zenith.r - horizon.r) * t;
      let g = horizon.g + (zenith.g - horizon.g) * t;
      let b = horizon.b + (zenith.b - horizon.b) * t;

      // Below the horizon, fade toward the fog colour so the dome meets the
      // terrain without a visible seam.
      if (h < 0) {
        const below = Math.min(1, -h * 1.6);
        r += (profile.fogDay.r * 0.5 - r) * below * 0.55;
        g += (profile.fogDay.g * 0.5 - g) * below * 0.55;
        b += (profile.fogDay.b * 0.5 - b) * below * 0.55;
      }

      // Sun glow band.
      const dx = this.vertexDirections[i * 3];
      const dy = this.vertexDirections[i * 3 + 1];
      const dz = this.vertexDirections[i * 3 + 2];
      const dot = dx * sx + dy * sy + dz * sz;
      if (dot > 0) {
        // pow() tightens the glow into a halo instead of washing the whole sky.
        const glow = Math.pow(dot, 7) * (0.30 + horizonFactor * 0.85);
        r += profile.sunsetGlow.r * glow;
        g += profile.sunsetGlow.g * glow;
        b += profile.sunsetGlow.b * glow;
      }

      const o = i * 4;
      this.colorBuffer[o] = r < 0 ? 0 : r > 1 ? 1 : r;
      this.colorBuffer[o + 1] = g < 0 ? 0 : g > 1 ? 1 : g;
      this.colorBuffer[o + 2] = b < 0 ? 0 : b > 1 ? 1 : b;
      this.colorBuffer[o + 3] = 1;
    }

    this.dome.updateVerticesData(VertexBuffer.ColorKind, this.colorBuffer, false, false);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.dome?.dispose();
    this.material?.dispose();
    this.dome = null;
    this.material = null;
  }
}

export default SkyDome;

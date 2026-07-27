/**
 * PortalWindow — see-through portals.
 *
 * The portal interior was an opaque coloured disc. This replaces it with an
 * actual window onto the destination dimension: a procedurally painted "far
 * side" — that dimension's sky gradient, horizon, ground band and silhouettes —
 * composited behind a refractive ripple, so looking into a Nether portal shows
 * a hellscape and looking into a Sky Gate shows clouds and open air.
 *
 * ## Why this and not a second camera
 *
 * A true portal render would need a second camera plus a `RenderTargetTexture`
 * per portal, re-rendering the whole scene each frame. With up to a dozen
 * portals in view that is a dozen extra scene passes and it tanks the frame
 * rate — and the destination dimension's geometry isn't even loaded, so there
 * would be nothing to render anyway.
 *
 * Painting the destination's *atmosphere* gives essentially the same read at a
 * fraction of the cost: the player sees a different world through the frame,
 * correctly coloured for where it leads, animated, and legible at a glance.
 */
import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import { getSkyProfileForDimension, SkyProfile } from '../sky/SkyProfiles';

/** Resolution of the painted destination view. */
const VIEW_SIZE = 256;

export interface PortalWindowOptions {
  /** Dimension the portal leads to. */
  destination: string;
  /** Radius of the portal opening. */
  radius: number;
  /** World position of the portal. */
  position: Vector3;
}

export class PortalWindow {
  private readonly scene: Scene;
  private readonly destination: string;
  private readonly profile: SkyProfile;

  surface: Mesh | null = null;
  private material: StandardMaterial | null = null;
  private texture: DynamicTexture | null = null;
  private elapsed = 0;
  private disposed = false;
  /** Repainting every frame is wasteful for a slow-drifting sky. */
  private sinceRepaint = 0;

  constructor(scene: Scene, private readonly options: PortalWindowOptions) {
    this.scene = scene;
    this.destination = options.destination;
    this.profile = getSkyProfileForDimension(options.destination);
  }

  attach(): void {
    const { radius, position } = this.options;

    // A double-sided disc so the portal is see-through from both faces.
    const surface = MeshBuilder.CreateDisc(
      `portal_window_${this.destination}`,
      { radius, tessellation: 48, sideOrientation: Mesh.DOUBLESIDE },
      this.scene
    );
    surface.position.copyFrom(position);
    surface.isPickable = false;
    surface.checkCollisions = false;
    // Portals sit in world space and should be fogged with everything else,
    // so distant portals recede naturally.
    surface.applyFog = true;

    const texture = new DynamicTexture(
      `portal_window_tex_${this.destination}`,
      { width: VIEW_SIZE, height: VIEW_SIZE },
      this.scene,
      true
    );

    const material = new StandardMaterial(`portal_window_mat_${this.destination}`, this.scene);
    material.emissiveTexture = texture;
    material.diffuseTexture = texture;
    material.opacityTexture = texture;
    material.disableLighting = true;
    material.specularColor = Color3.Black();
    material.backFaceCulling = false;
    surface.material = material;

    this.surface = surface;
    this.material = material;
    this.texture = texture;
    this.paint(0);
  }

  /**
   * Paint the destination dimension's view into the texture.
   *
   * Composited back to front: sky gradient, sun/glow, horizon haze, ground
   * band, silhouettes, then a circular alpha mask so the square texture reads
   * as a round opening with soft edges.
   */
  private paint(time: number): void {
    if (!this.texture) return;
    const ctx = this.texture.getContext() as unknown as CanvasRenderingContext2D;
    const s = VIEW_SIZE;
    const p = this.profile;

    const css = (c: Color3, a = 1) =>
      `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;

    // --- Sky gradient ---------------------------------------------------
    const sky = ctx.createLinearGradient(0, 0, 0, s);
    sky.addColorStop(0, css(p.zenithDay));
    sky.addColorStop(0.55, css(p.horizonDay));
    sky.addColorStop(0.62, css(Color3.Lerp(p.horizonDay, p.sunsetGlow, 0.35)));
    sky.addColorStop(1, css(p.fogDay.scale(0.55)));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, s, s);

    // --- Sun / light source glow, drifting slowly -----------------------
    if (p.hasSun) {
      const sunX = s * (0.5 + Math.sin(time * 0.11) * 0.28);
      const sunY = s * 0.30;
      const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, s * 0.34);
      glow.addColorStop(0, css(p.sunsetGlow, 0.95));
      glow.addColorStop(0.35, css(p.sunsetGlow, 0.28));
      glow.addColorStop(1, css(p.sunsetGlow, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, s, s);
    }

    // --- Aurora ribbons, for dimensions that have them ------------------
    if (p.auroraStrength > 0.3) {
      for (let i = 0; i < 3; i += 1) {
        const y = s * (0.16 + i * 0.07) + Math.sin(time * 0.6 + i) * 8;
        const band = ctx.createLinearGradient(0, y - 16, 0, y + 16);
        band.addColorStop(0, 'rgba(0,255,190,0)');
        band.addColorStop(0.5, `rgba(90,255,200,${0.16 * p.auroraStrength})`);
        band.addColorStop(1, 'rgba(0,255,190,0)');
        ctx.fillStyle = band;
        ctx.fillRect(0, y - 16, s, 32);
      }
    }

    // --- Clouds ---------------------------------------------------------
    if (p.cloudCoverage > 0.05) {
      ctx.fillStyle = css(p.cloudTint, 0.30 * p.cloudCoverage);
      for (let i = 0; i < 7; i += 1) {
        // Drift horizontally and wrap, so the view is always moving.
        const cx = ((i * 47 + time * 9) % (s + 90)) - 45;
        const cy = s * (0.16 + ((i * 13) % 24) / 100);
        const cw = 34 + ((i * 19) % 40);
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw, cw * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- Ground band -----------------------------------------------------
    const groundTop = s * 0.62;
    const ground = ctx.createLinearGradient(0, groundTop, 0, s);
    const groundColor = Color3.Lerp(p.fogDay, p.zenithNight, 0.45);
    ground.addColorStop(0, css(groundColor.scale(1.1)));
    ground.addColorStop(1, css(groundColor.scale(0.35)));
    ctx.fillStyle = ground;
    ctx.fillRect(0, groundTop, s, s - groundTop);

    // --- Silhouettes on the horizon --------------------------------------
    // Deterministic per destination so a given portal always looks the same.
    ctx.fillStyle = css(groundColor.scale(0.28));
    let h = 2166136261;
    for (let i = 0; i < this.destination.length; i += 1) {
      h ^= this.destination.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    for (let i = 0; i < 9; i += 1) {
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const r = (h >>> 0) / 0xffffffff;
      const w = 14 + r * 30;
      const height = 12 + r * 46;
      const x = (i / 9) * s + r * 12;
      ctx.fillRect(x, groundTop - height, w, height + 4);
    }

    // --- Circular mask ----------------------------------------------------
    // Everything outside the disc becomes transparent, and the rim fades so
    // the opening blends into the portal frame instead of hard-clipping.
    const mask = ctx.getImageData(0, 0, s, s);
    const data = mask.data;
    const c = s / 2;
    for (let y = 0; y < s; y += 1) {
      for (let x = 0; x < s; x += 1) {
        const dx = x - c;
        const dy = y - c;
        const d = Math.sqrt(dx * dx + dy * dy) / c;
        const idx = (y * s + x) * 4;
        // Ripple the edge so the surface looks liquid.
        const ripple = Math.sin(d * 22 - time * 3.2) * 0.02;
        const edge = 1 - Math.min(1, Math.max(0, (d + ripple - 0.74) / 0.26));
        data[idx + 3] = Math.round(255 * Math.min(1, edge * 1.15));
      }
    }
    ctx.putImageData(mask, 0, 0);

    this.texture.update(false);
  }

  update(deltaSeconds: number, cameraPosition: Vector3): void {
    if (this.disposed || !this.surface) return;
    this.elapsed += deltaSeconds;

    // The window always faces the player, so you can never catch it edge-on
    // and see an infinitely thin sliver.
    this.surface.lookAt(cameraPosition);

    // ~8 Hz repaint: plenty for drifting clouds and a rippling edge.
    this.sinceRepaint += deltaSeconds;
    if (this.sinceRepaint >= 0.125) {
      this.sinceRepaint = 0;
      this.paint(this.elapsed);
    }
  }

  /** Fade the window with distance so far-off portals don't shimmer. */
  setVisibility(alpha: number): void {
    if (this.material) this.material.alpha = Math.max(0, Math.min(1, alpha));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.surface?.dispose();
    this.material?.dispose();
    this.texture?.dispose();
    this.surface = null;
    this.material = null;
    this.texture = null;
  }
}

export default PortalWindow;

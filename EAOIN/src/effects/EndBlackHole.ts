/**
 * EndBlackHole — the 2.0 End sky overhaul.
 *
 * A black hole hangs in the purple/pink void above the End's central island,
 * with a lensed accretion ring (gravitational lensing). It does NOT destroy
 * blocks — it only ever pulls the player toward the central island / the end
 * portal, so stepping into the centre lets you enter the end portal.
 */
import {
  Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3,
} from '@babylonjs/core';

export class EndBlackHole {
  private core: Mesh | null = null;
  private lens: Mesh | null = null;
  private disc: Mesh | null = null;
  private active = false;
  /** Distance at which the black hole starts pulling the player (the Edge). */
  private pullRadius = 90;

  constructor(private readonly scene: Scene) {}

  setActive(active: boolean): void {
    this.active = active;
    if (this.core) {
      this.core.setEnabled(active);
      this.lens?.setEnabled(active);
      this.disc?.setEnabled(active);
    }
  }

  /** Build the black hole above the origin (over the central dragon island). */
  ensure(position: Vector3): void {
    if (this.core) return;
    // Pure black event horizon.
    this.core = MeshBuilder.CreateSphere('end_black_hole_core', { diameter: 26, segments: 24 }, this.scene);
    const coreMat = new StandardMaterial('end_black_hole_core_mat', this.scene);
    coreMat.emissiveColor = new Color3(0, 0, 0);
    coreMat.diffuseColor = new Color3(0, 0, 0);
    coreMat.specularColor = new Color3(0, 0, 0);
    coreMat.disableLighting = true;
    this.core.material = coreMat;
    this.core.position.copyFrom(position);
    this.core.isPickable = false;

    // Gravitational lensing ring — a purple/pink glowing annulus.
    this.lens = MeshBuilder.CreateTorus('end_black_hole_lens', { diameter: 40, thickness: 3.2, tessellation: 48 }, this.scene);
    const lensMat = new StandardMaterial('end_black_hole_lens_mat', this.scene);
    lensMat.emissiveColor = new Color3(0.9, 0.35, 0.85);
    lensMat.diffuseColor = new Color3(0.4, 0.1, 0.4);
    lensMat.specularColor = new Color3(0.2, 0.2, 0.2);
    lensMat.alpha = 0.9;
    this.lens.material = lensMat;
    this.lens.position.copyFrom(position);
    this.lens.rotation.x = Math.PI / 2;
    this.lens.isPickable = false;

    // Accretion disc — a flat, glowing purple-pink disc (textured swirl).
    this.disc = MeshBuilder.CreateDisc('end_black_hole_disc', { radius: 60, tessellation: 40 }, this.scene);
    const discTex = new DynamicTexture('end_black_hole_disc_tex', { width: 128, height: 128 }, this.scene, false);
    const ctx = discTex.getContext() as unknown as CanvasRenderingContext2D;
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    grad.addColorStop(0, '#ff88ff');
    grad.addColorStop(0.4, '#a832ff');
    grad.addColorStop(0.7, '#3a1a6a');
    grad.addColorStop(1, 'rgba(60,30,120,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    discTex.update();
    const discMat = new StandardMaterial('end_black_hole_disc_mat', this.scene);
    discMat.emissiveTexture = discTex;
    discMat.diffuseColor = new Color3(0.6, 0.2, 0.7);
    discMat.disableLighting = true;
    discMat.alpha = 0.85;
    discMat.backFaceCulling = false;
    this.disc.material = discMat;
    this.disc.position.copyFrom(position);
    this.disc.rotation.x = Math.PI / 2;
    this.disc.isPickable = false;
  }

  /** Spin the lens/disc. */
  tick(deltaSeconds: number): void {
    if (!this.active) return;
    if (this.lens) this.lens.rotation.z += deltaSeconds * 0.4;
    if (this.disc) this.disc.rotation.z += deltaSeconds * 0.15;
  }

  /**
   * Pull the player toward the black hole's axis (the central end portal) but
   * NEVER destroy blocks. Returns a pull force to add to the camera.
   */
  pull(player: Vector3, out: Vector3): Vector3 {
    out.set(0, 0, 0);
    if (!this.active || !this.core) return out;
    const dx = -player.x;
    const dz = -player.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2) return out; // already centred — let them enter the portal
    if (dist > this.pullRadius) return out; // too far — the edge, not yet pulling
    // Gentle pull inward (only horizontal; we don't yank them down).
    const strength = Math.max(0, (this.pullRadius - dist) / this.pullRadius);
    out.x = (dx / Math.max(1, dist)) * strength * 3.2;
    out.z = (dz / Math.max(1, dist)) * strength * 3.2;
    return out;
  }

  dispose(): void {
    this.core?.dispose(); this.lens?.dispose(); this.disc?.dispose();
    this.core = this.lens = this.disc = null;
  }
}

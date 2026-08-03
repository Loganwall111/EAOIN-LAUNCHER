/**
 * EndBlackHole — the 2.0 End sky overhaul + physical black-hole portal.
 *
 * A black hole hangs in the purple/pink void above the End's central island,
 * rendered with a real lensing look (a bright photon ring + a swirling
 * accretion disc, like the Singularity simulator). It is NOT a solid block:
 * it is a physical portal.
 *
 *   - It pulls the player in with growing strength (spaghettification: the
 *     closer you get, the harder it tugs).
 *   - Once you cross the event horizon, `enter()` returns true. In SURVIVAL
 *     you are torn apart and die; in CREATIVE you are teleported into a black
 *     void you can explore freely. There is no loading screen — it is instant.
 */
import {
  Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3,
} from '@babylonjs/core';

export class EndBlackHole {
  private core: Mesh | null = null;
  private lens: Mesh | null = null;
  private disc: Mesh | null = null;
  private voidSphere: Mesh | null = null;
  private active = false;
  /** Distance at which the black hole starts pulling the player (the Edge). */
  private pullRadius = 90;
  /** Event horizon radius — crossing it means you entered the hole. */
  private horizonRadius = 13;

  constructor(private readonly scene: Scene) {}

  setActive(active: boolean): void {
    this.active = active;
    if (this.core) {
      this.core.setEnabled(active);
      this.lens?.setEnabled(active);
      this.disc?.setEnabled(active);
      this.voidSphere?.setEnabled(active);
    }
  }

  /** Build the black hole above the origin (over the central dragon island). */
  ensure(position: Vector3): void {
    if (this.core) return;
    // Pure black event horizon — a real sphere you can pass INTO.
    this.core = MeshBuilder.CreateSphere('end_black_hole_core', { diameter: this.horizonRadius * 2, segments: 24 }, this.scene);
    const coreMat = new StandardMaterial('end_black_hole_core_mat', this.scene);
    coreMat.emissiveColor = new Color3(0, 0, 0);
    coreMat.diffuseColor = new Color3(0, 0, 0);
    coreMat.specularColor = new Color3(0, 0, 0);
    coreMat.disableLighting = true;
    coreMat.backFaceCulling = false; // visible from inside too
    this.core.material = coreMat;
    this.core.position.copyFrom(position);
    this.core.isPickable = false;

    // Photon ring — a bright, glowing annulus right at the horizon.
    this.lens = MeshBuilder.CreateTorus('end_black_hole_lens', { diameter: this.horizonRadius * 2.4, thickness: 1.4, tessellation: 48 }, this.scene);
    const lensMat = new StandardMaterial('end_black_hole_lens_mat', this.scene);
    lensMat.emissiveColor = new Color3(1.0, 0.75, 0.45);
    lensMat.diffuseColor = new Color3(0.8, 0.5, 0.2);
    lensMat.specularColor = new Color3(0.2, 0.2, 0.2);
    lensMat.alpha = 0.95;
    this.lens.material = lensMat;
    this.lens.position.copyFrom(position);
    this.lens.rotation.x = Math.PI / 2;
    this.lens.isPickable = false;

    // Accretion disc — a flat, glowing warm disc (textured swirl, like the
    // Interstellar look: bright inner edge, wrapped over and under).
    this.disc = MeshBuilder.CreateDisc('end_black_hole_disc', { radius: this.horizonRadius * 4.5, tessellation: 40 }, this.scene);
    const discTex = new DynamicTexture('end_black_hole_disc_tex', { width: 128, height: 128 }, this.scene, false);
    const ctx = discTex.getContext() as unknown as CanvasRenderingContext2D | null;
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, '#fff7e0');
      grad.addColorStop(0.25, '#ffd166');
      grad.addColorStop(0.5, '#ff8c42');
      grad.addColorStop(0.75, '#c0603a');
      grad.addColorStop(1, 'rgba(120,50,20,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      // Animated swirl bands.
      ctx.strokeStyle = 'rgba(255,220,160,0.5)';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(64, 64, 20 + i * 8, i * 0.6, i * 0.6 + 3.4);
        ctx.stroke();
      }
      discTex.update();
    }
    const discMat = new StandardMaterial('end_black_hole_disc_mat', this.scene);
    discMat.emissiveTexture = discTex;
    discMat.diffuseColor = new Color3(0.9, 0.5, 0.2);
    discMat.disableLighting = true;
    discMat.alpha = 0.92;
    discMat.backFaceCulling = false;
    this.disc.material = discMat;
    this.disc.position.copyFrom(position);
    this.disc.rotation.x = Math.PI / 2;
    this.disc.isPickable = false;

    // Interior void — a large black sphere so entering the hole surrounds you
    // with a wall of blackness you can look back out of.
    this.voidSphere = MeshBuilder.CreateSphere('end_black_hole_void', { diameter: this.horizonRadius * 6, segments: 16 }, this.scene);
    const voidMat = new StandardMaterial('end_black_hole_void_mat', this.scene);
    voidMat.emissiveColor = new Color3(0.004, 0.002, 0.01);
    voidMat.diffuseColor = new Color3(0.002, 0.001, 0.005);
    voidMat.specularColor = new Color3(0, 0, 0);
    voidMat.disableLighting = true;
    voidMat.backFaceCulling = false;
    this.voidSphere.material = voidMat;
    this.voidSphere.position.copyFrom(position);
    this.voidSphere.isPickable = false;
    this.voidSphere.isVisible = false; // shown only after entering (creative)
  }

  /** Spin the lens/disc + pulse the ring. */
  tick(deltaSeconds: number, time = performance.now()): void {
    if (!this.active) return;
    if (this.lens) this.lens.rotation.z += deltaSeconds * 0.6;
    if (this.disc) this.disc.rotation.z += deltaSeconds * 0.2;
    if (this.lens) {
      // gentle brightness pulse on the photon ring
      const pulse = 0.9 + 0.1 * Math.sin(time * 0.002);
      (this.lens.material as StandardMaterial).emissiveColor = new Color3(1.0 * pulse, 0.75 * pulse, 0.45 * pulse);
    }
  }

  /**
   * Pull the player toward the black hole with growing strength (so the closer
   * you get, the harder it tugs — spaghettification). Returns a pull force.
   */
  pull(player: Vector3, out: Vector3): Vector3 {
    out.set(0, 0, 0);
    if (!this.active || !this.core) return out;
    const dx = -player.x;
    const dz = -player.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2) return out; // centred on the axis
    if (dist > this.pullRadius) return out;
    // Strength grows as you approach — stronger than before, so you get
    // visibly pulled in and stretched (spaghettified).
    const falloff = Math.max(0, (this.pullRadius - dist) / this.pullRadius);
    const strength = falloff * falloff * 6.0;
    out.x = (dx / Math.max(1, dist)) * strength;
    out.z = (dz / Math.max(1, dist)) * strength;
    return out;
  }

  /** True when the player has crossed the event horizon (entered the hole). */
  entered(player: Vector3): boolean {
    if (!this.active || !this.core) return false;
    return Math.hypot(player.x, player.z) < this.horizonRadius;
  }

  /** Centre world position of the hole (used to spawn the void in creative). */
  centre(): Vector3 {
    return this.core ? this.core.position.clone() : Vector3.Zero();
  }

  /** Show the black-void interior (creative mode after entering). */
  showVoid(): void {
    if (this.voidSphere) this.voidSphere.isVisible = true;
  }

  dispose(): void {
    this.core?.dispose(); this.lens?.dispose(); this.disc?.dispose(); this.voidSphere?.dispose();
    this.core = this.lens = this.disc = this.voidSphere = null;
  }
}


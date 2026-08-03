/**
 * RealityRifts — enormous tears in spacetime that occasionally appear.
 *
 *  Each rift reveals content from a neighboring dimension, the cosmos,
 *  floating ruins, or alternate realities. They animate dynamically with
 *  distortion, edge flow, and particles.
 */
import { Color3, Color4, DynamicTexture, Mesh, MeshBuilder, ParticleSystem, Scene, StandardMaterial, Texture, Vector3 } from '@babylonjs/core';

export type RiftContent = 'dimension' | 'stars' | 'nebula' | 'black_hole' | 'floating_ruins' | 'alternate_reality' | 'galaxy';

export interface RiftDef {
  position: Vector3;
  size: number;
  content: RiftContent;
  color1: Color3;
  color2: Color3;
  rotationSpeed: number;
  lifetime: number;
  maxLifetime: number;
  intensity: number;
}

export class RealityRift {
  mesh: Mesh;
  innerMesh: Mesh;
  particles: ParticleSystem;
  def: RiftDef;

  constructor(scene: Scene, def: RiftDef) {
    this.def = def;
    this.mesh = MeshBuilder.CreateDisc('rift', { radius: def.size, tessellation: 24, sideOrientation: Mesh.DOUBLESIDE }, scene);
    this.mesh.position = def.position.clone();
    const mat = new StandardMaterial('rift_mat', scene);
    mat.emissiveColor = def.color2;
    mat.diffuseColor = def.color1;
    mat.specularColor = new Color3(0, 0, 0);
    mat.alpha = 0.38;
    mat.backFaceCulling = false;
    this.mesh.material = mat;
    this.mesh.isPickable = false;

    this.innerMesh = MeshBuilder.CreateDisc('rift_inner', { radius: def.size * 0.92, tessellation: 24, sideOrientation: Mesh.DOUBLESIDE }, scene);
    this.innerMesh.position = def.position.clone();
    this.innerMesh.parent = this.mesh;
    const innerMat = new StandardMaterial('rift_inner_mat', scene);
    innerMat.emissiveColor = Color3.Lerp(def.color1, def.color2, 0.5);
    innerMat.diffuseColor = new Color3(0, 0, 0);
    // Gravitational-lensing vortex: a warped, spiralling texture so the rift
    // visibly bends the light around it, like a mini black hole.
    const vortex = new DynamicTexture('rift_vortex_tex', { width: 128, height: 128 }, scene, false);
    const vctx = vortex.getContext() as unknown as CanvasRenderingContext2D | null;
    if (vctx) {
      const cx = 64, cy = 64;
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const r0 = 14, r1 = 56;
        const grad = vctx.createRadialGradient(
          cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0, 2,
          cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1, r1 - r0,
        );
        const cr = Math.floor(def.color2.r * 255), cg = Math.floor(def.color2.g * 255), cb = Math.floor(def.color2.b * 255);
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},0.9)`);
        grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.25)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        vctx.strokeStyle = grad;
        vctx.lineWidth = 4;
        vctx.beginPath();
        vctx.arc(cx, cy, (r0 + r1) / 2, ang, ang + 1.4);
        vctx.stroke();
      }
      vctx.fillStyle = 'rgba(0,0,0,0.6)';
      vctx.beginPath(); vctx.arc(cx, cy, 8, 0, Math.PI * 2); vctx.fill();
      vortex.update();
    }
    innerMat.emissiveTexture = vortex;
    innerMat.alpha = 0.4;
    this.innerMesh.material = innerMat;
    this.innerMesh.isPickable = false;

    this.particles = new ParticleSystem('rift_particles', 80, scene);
    this.particles.particleTexture = this.makeRiftTex(scene, def);
    this.particles.emitter = def.position.clone();
    this.particles.minSize = 0.3; this.particles.maxSize = 0.9;
    this.particles.minLifeTime = 1.2; this.particles.maxLifeTime = 2.4;
    this.particles.emitRate = 40;
    this.particles.color1 = new Color4(def.color1.r, def.color1.g, def.color1.b, 1);
    this.particles.color2 = new Color4(def.color2.r, def.color2.g, def.color2.b, 1);
    this.particles.colorDead = new Color4(0, 0, 0, 1);
    this.particles.direction1 = new Vector3(-0.6, -0.2, -0.6);
    this.particles.direction2 = new Vector3(0.6, 0.2, 0.6);
    this.particles.gravity = new Vector3(0, -0.2, 0);
    this.particles.start();
  }

  private makeRiftTex(scene: Scene, def: RiftDef): Texture {
    if (typeof document === 'undefined') return new Texture('', scene);
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    if (!ctx) return new Texture('', scene);
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, `rgba(${Math.floor(def.color2.r * 255)},${Math.floor(def.color2.g * 255)},${Math.floor(def.color2.b * 255)},1)`);
    grd.addColorStop(0.7, `rgba(${Math.floor(def.color1.r * 255)},${Math.floor(def.color1.g * 255)},${Math.floor(def.color1.b * 255)},0.5)`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
    return Texture.CreateFromBase64String(c.toDataURL(), 'riftTex', scene, true, false);
  }

  update(dt: number, camera: Vector3): void {
    this.def.lifetime -= dt;
    this.mesh.rotation.z += this.def.rotationSpeed * dt;
    this.mesh.lookAt(camera);
    // Counter-spin the inner vortex so the lensing swirl churns.
    if (this.innerMesh) this.innerMesh.rotation.z -= this.def.rotationSpeed * dt * 1.6;
    const fade = Math.min(1, this.def.lifetime) * Math.min(1, (this.def.maxLifetime - this.def.lifetime) / 1.0);
    const mat = this.mesh.material as StandardMaterial;
    if (mat) mat.alpha = 0.2 + 0.18 * (0.5 + 0.5 * Math.sin(performance.now() * 0.003)) * fade;
    const im = this.innerMesh.material as StandardMaterial;
    if (im) im.alpha = 0.3 + 0.15 * (0.5 + 0.5 * Math.sin(performance.now() * 0.004)) * fade;
  }

  isExpired(): boolean { return this.def.lifetime <= 0; }
  dispose(): void {
    this.mesh.dispose();
    this.innerMesh.dispose();
    this.particles.dispose();
  }
}

export class RealityRiftSystem {
  scene: Scene;
  rifts: RealityRift[] = [];
  spawnCooldown: number = 120; // keep rifts rare and never immediate at spawn
  time: number = 0;

  constructor(scene: Scene) { this.scene = scene; }

  spawnRandomRift(playerPos: Vector3): RealityRift | null {
    if (this.spawnCooldown > 0) return null;
    if (Math.random() > 0.015) return null; // subtle ambient chance per call
    const contents: RiftContent[] = ['dimension', 'stars', 'nebula', 'black_hole', 'floating_ruins', 'alternate_reality', 'galaxy'];
    const content = contents[Math.floor(Math.random() * contents.length)];
    const colorTable: Record<RiftContent, [Color3, Color3]> = {
      dimension: [new Color3(0.6, 0.2, 1), new Color3(0.2, 0.05, 0.6)],
      stars: [new Color3(0.1, 0.2, 0.6), new Color3(0.95, 0.95, 1)],
      nebula: [new Color3(0.95, 0.4, 0.6), new Color3(0.3, 0.1, 0.6)],
      black_hole: [new Color3(0, 0, 0), new Color3(0.5, 0.0, 0.85)],
      floating_ruins: [new Color3(0.55, 0.45, 0.3), new Color3(0.85, 0.7, 0.4)],
      alternate_reality: [new Color3(0.95, 0.05, 0.55), new Color3(0.05, 0.95, 0.85)],
      galaxy: [new Color3(0.65, 0.4, 0.95), new Color3(0.95, 0.85, 0.45)],
    };
    const [c1, c2] = colorTable[content];
    const size = 7 + Math.random() * 9;
    const angle = Math.random() * Math.PI * 2;
    const distance = 160 + Math.random() * 130;
    const pos = new Vector3(
      playerPos.x + Math.cos(angle) * distance,
      playerPos.y + 90 + Math.random() * 80,
      playerPos.z + Math.sin(angle) * distance,
    );
    const def: RiftDef = {
      position: pos,
      size,
      content,
      color1: c1,
      color2: c2,
      rotationSpeed: (Math.random() - 0.5) * 0.6,
      lifetime: 30,
      maxLifetime: 30,
      intensity: 1,
    };
    const rift = new RealityRift(this.scene, def);
    this.rifts.push(rift);
    this.spawnCooldown = 150 + Math.random() * 90;
    return rift;
  }

  update(dt: number, playerPos: Vector3, camera: Vector3): void {
    this.time += dt;
    this.spawnCooldown -= dt;
    this.spawnRandomRift(playerPos);
    const next: RealityRift[] = [];
    for (const r of this.rifts) {
      r.update(dt, camera);
      if (!r.isExpired()) next.push(r);
      else r.dispose();
    }
    this.rifts = next;
  }

  /**
   * Rift suction — rifts exert a gravity pull on the player, dragging them
   * toward the tear so they feel the void bleeding in. Returns a world-space
   * acceleration that the caller adds to the player's motion. Stronger the
   * closer you are and the bigger the rift.
   */
  pullOnPlayer(playerPos: Vector3, out: Vector3): Vector3 {
    out.set(0, 0, 0);
    for (const r of this.rifts) {
      const to = r.mesh.position.subtract(playerPos);
      const distSq = to.lengthSquared();
      if (distSq < 1e-4) continue;
      const dist = Math.sqrt(distSq);
      // Only rifts within ~40 blocks exert meaningful pull.
      if (dist > 40) continue;
      const strength = (r.def.size * r.def.intensity * 3.2) / Math.max(6, dist * dist);
      to.normalize();
      out.addInPlace(to.scale(Math.min(0.9, strength)));
    }
    return out;
  }

  dispose(): void {
    for (const r of this.rifts) r.dispose();
    this.rifts = [];
  }
}

export default RealityRiftSystem;

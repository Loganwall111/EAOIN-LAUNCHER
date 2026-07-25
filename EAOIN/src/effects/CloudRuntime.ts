/**
 * CloudRuntime — Minecraft-style blocky clouds, stunning from far away, moving.
 * Uses instanced white boxes in a high layer that drifts with wind.
 */
import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';

export interface CloudRuntimeOptions {
  y: number;
  speed: number;
  count: number;
}

export class CloudRuntime {
  private readonly root: TransformNode;
  private readonly template: Mesh;
  private readonly clouds: { mesh: any; offset: Vector3 }[] = [];
  private readonly material: StandardMaterial;
  private readonly bounds = 420;
  private readonly cell = 12;

  constructor(scene: Scene, private readonly spawnY: number, seed: string) {
    void seed;
    // use scene via root creation below, store indirectly
    this.root = new TransformNode('cloud_root', scene);
    this.root.position.y = spawnY + 68; // high above terrain

    this.material = new StandardMaterial('cloud_mat', scene);
    this.material.diffuseColor = new Color3(0.92, 0.94, 0.98);
    this.material.emissiveColor = new Color3(0.08, 0.09, 0.11);
    this.material.specularColor = new Color3(0.02, 0.02, 0.025);
    this.material.alpha = 0.93;
    this.material.backFaceCulling = false;

    this.template = MeshBuilder.CreateBox('cloud_template', { width: this.cell, height: 4.2, depth: this.cell }, scene);
    this.template.isVisible = false;
    this.template.material = this.material;
    this.template.isPickable = false;

    this.generateCloudMap();
  }

  private hashToUnit(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 0xffffffff;
  }

  private noise2D(x: number, z: number): number {
    // value noise with smoothstep
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);
    const n00 = this.hashToUnit(`cloud:${xi}:${zi}`);
    const n10 = this.hashToUnit(`cloud:${xi + 1}:${zi}`);
    const n01 = this.hashToUnit(`cloud:${xi}:${zi + 1}`);
    const n11 = this.hashToUnit(`cloud:${xi + 1}:${zi + 1}`);
    const nx0 = n00 * (1 - u) + n10 * u;
    const nx1 = n01 * (1 - u) + n11 * u;
    return nx0 * (1 - v) + nx1 * v;
  }

  private fbm(x: number, z: number): number {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    for (let i = 0; i < 4; i++) {
      sum += this.noise2D(x * freq, z * freq) * amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / 1.875;
  }

  private generateCloudMap(): void {
    // Generate cloud puffs in a large square around spawn, using fbm for organic Minecraft-style blobs
    for (let x = -this.bounds; x <= this.bounds; x += this.cell * 2) {
      for (let z = -this.bounds; z <= this.bounds; z += this.cell * 2) {
        const nx = (x + this.hashToUnit(`cloud_jx:${x}:${z}`) * 6) * 0.008;
        const nz = (z + this.hashToUnit(`cloud_jz:${x}:${z}`) * 6) * 0.008;
        const n = this.fbm(nx, nz);
        if (n > 0.58) {
          // cloud puff cluster 2-5 boxes
          const cluster = 2 + Math.floor(this.hashToUnit(`cloud_cl:${x}:${z}`) * 3);
          for (let k = 0; k < cluster; k++) {
            const ox = (this.hashToUnit(`cloud_ox:${x}:${z}:${k}`) - 0.5) * this.cell * 2.2;
            const oz = (this.hashToUnit(`cloud_oz:${x}:${z}:${k}`) - 0.5) * this.cell * 2.2;
            const oy = (this.hashToUnit(`cloud_oy:${x}:${z}:${k}`) - 0.5) * 2.2;
            const inst = this.template.createInstance(`cloud_block_${x}_${z}_${k}`);
            inst.position.set(x + ox, oy, z + oz);
            inst.parent = this.root;
            inst.isPickable = false;
            inst.isVisible = true;
            this.clouds.push({ mesh: inst, offset: new Vector3(ox, oy, oz) });
          }
        }
      }
    }
  }

  update(deltaSeconds: number): void {
    // Minecraft clouds drift slowly in one direction (wind)
    const windSpeed = 3.2; // blocks per second
    this.root.position.x += deltaSeconds * windSpeed;
    this.root.position.z += deltaSeconds * windSpeed * 0.35;

    // wrap around to keep infinite feel
    if (this.root.position.x > this.bounds) this.root.position.x -= this.bounds * 2;
    if (this.root.position.z > this.bounds * 0.5) this.root.position.z -= this.bounds;

    // subtle vertical bob for life
    this.root.position.y = this.spawnY + 68 + Math.sin(performance.now() * 0.00015) * 0.8;
  }

  dispose(): void {
    for (const c of this.clouds) c.mesh.dispose();
    this.template.dispose();
    this.root.dispose();
  }
}

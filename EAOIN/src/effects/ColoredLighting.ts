/**
 * ColoredLighting — Part 4 coloured lighting runtime.
 *
 * Emissive blocks (coloured lamps, torches, glow glass) emit their own tint.
 * This runtime finds nearby emissive blocks around the player, mixes their
 * colours together, and tints a dynamic point light so the world really does
 * "change colour when another light passes through". Also exposes the god-ray
 * intensity knob.
 */
import { Color3, PointLight, Scene, Vector3 } from '@babylonjs/core';
import { getBlock } from '@shared/blocks/BlockRegistry';

/** Block ids that are coloured light sources. */
const COLOURED_LIGHTS = new Set<number>([316, 317, 318, 319, 320, 321, 322, 329]);

interface LightProbe { x: number; y: number; z: number; tint: Color3; }

export class ColoredLighting {
  private light: PointLight | null = null;
  private lastKey = '';
  private enabled = true;
  private godRays = 0.4;

  constructor(private readonly scene: Scene) {}

  configure(opts: { coloredLighting: boolean; lightMixing: boolean; godRays: number }): void {
    this.enabled = opts.coloredLighting;
    this.godRays = opts.godRays;
    if (!this.light) {
      this.light = new PointLight('colored_light', Vector3.Zero(), this.scene);
      this.light.range = 18;
      this.light.intensity = 0;
    }
  }

  /** Scan a 9x5x9 box around the player for emissive blocks and mix their tints. */
  update(playerPos: Vector3, getBlockAt: (x: number, y: number, z: number) => number): void {
    if (!this.enabled || !this.light) {
      if (this.light) this.light.intensity = 0;
      return;
    }
    const probes: LightProbe[] = [];
    const px = Math.floor(playerPos.x);
    const py = Math.floor(playerPos.y);
    const pz = Math.floor(playerPos.z);
    for (let dx = -4; dx <= 4; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dz = -4; dz <= 4; dz++) {
          const id = getBlockAt(px + dx, py + dy, pz + dz);
          if (COLOURED_LIGHTS.has(id)) {
            const b = getBlock(id);
            probes.push({ x: px + dx + 0.5, y: py + dy + 0.5, z: pz + dz + 0.5, tint: Color3.FromHexString(b.color) });
          }
        }
      }
    }
    if (probes.length === 0) {
      this.light.intensity = 0;
      return;
    }
    // Mix (average) the tints and place the light at the nearest probe.
    let r = 0, g = 0, b = 0;
    let nearest = probes[0];
    let nearestDist = Infinity;
    for (const p of probes) {
      r += p.tint.r; g += p.tint.g; b += p.tint.b;
      const d = Vector3.DistanceSquared(playerPos, new Vector3(p.x, p.y, p.z));
      if (d < nearestDist) { nearestDist = d; nearest = p; }
    }
    const n = probes.length;
    const mix = new Color3(r / n, g / n, b / n);
    this.light.position.set(nearest.x, nearest.y, nearest.z);
    this.light.diffuse = mix;
    this.light.specular = mix.scale(0.4);
    // Intensity scales with how many lights overlap (light mixing).
    this.light.intensity = Math.min(6, 1.5 + probes.length * 0.5);
    this.lastKey = `${nearest.x},${nearest.y},${nearest.z}`;
    void this.lastKey;
  }

  /** God-ray / glow intensity for the current frame. */
  getGodRays(): number {
    return this.enabled ? this.godRays : 0;
  }

  dispose(): void {
    this.light?.dispose();
    this.light = null;
  }
}

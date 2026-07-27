/**
 * VolumetricClouds — "Life Comes Apart 2.0" cloud field.
 *
 * Replaces the two flat camera-locked cloud *planes* (which were the source of
 * the full-screen white/blue wash) with a real field of thick, blocky,
 * clustered cloud volumes spread across the whole sky.
 *
 * Design:
 *   - Clouds are grouped into **clusters**. Each cluster is a big cumulus mass
 *     built from many overlapping boxes at varying heights, so clouds read as
 *     large volumetric shapes rather than a texture on a plane.
 *   - The field tiles over a very large area and wraps relative to the player,
 *     so it fills the world in every direction no matter how far you walk.
 *   - Everything renders through GPU **thin instances** of one box mesh, so a
 *     couple of thousand cloud blocks cost a single draw call.
 *   - Cloud altitude is far above the build ceiling and the field never
 *     re-centres on the camera's Y, so it cannot intersect the player's view.
 */
import {
  Color3,
  Matrix,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';

/** Height above the world origin at which the cloud deck sits. */
export const CLOUD_DECK_ALTITUDE = 192;
/** Half-width of the tiling cloud field, in world units. */
export const CLOUD_FIELD_EXTENT = 1400;
/** Spacing between candidate cluster centres. */
const CLUSTER_SPACING = 190;
/** Hard cap on instances, so a dense preset can't tank the frame rate. */
const MAX_CLOUD_BLOCKS = 2600;

export interface CloudFieldOptions {
  /** 0-1 from the active SkyProfile. Scales cluster count and puff density. */
  coverage: number;
  /** Cloud albedo tint from the active SkyProfile. */
  tint: Color3;
  /** Wind speed in world units per second. */
  windSpeed: number;
}

interface CloudBlock {
  /** Position relative to the field origin. */
  base: Vector3;
  scale: Vector3;
  /** Per-block bob phase so the deck breathes instead of moving rigidly. */
  phase: number;
}

export class VolumetricClouds {
  private readonly scene: Scene;
  private readonly seed: string;
  private template: Mesh | null = null;
  private material: StandardMaterial | null = null;
  private blocks: CloudBlock[] = [];
  private matrices: Float32Array | null = null;
  private elapsed = 0;
  private windOffset = new Vector3(0, 0, 0);
  private coverage: number;
  private tint: Color3;
  private windSpeed: number;
  private disposed = false;
  /** Rebuilding the buffer every frame is wasteful; throttle it. */
  private sinceRefresh = 0;

  constructor(scene: Scene, seed: string, options: CloudFieldOptions) {
    this.scene = scene;
    this.seed = seed;
    this.coverage = options.coverage;
    this.tint = options.tint;
    this.windSpeed = options.windSpeed;
  }

  attach(): void {
    this.material = new StandardMaterial('volumetric_cloud_mat', this.scene);
    this.material.diffuseColor = this.tint.scale(0.55);
    // Clouds are lit mostly by ambient sky light; a little emissive keeps them
    // readable at dawn/dusk without blowing out to pure white.
    this.material.emissiveColor = this.tint.scale(0.42);
    this.material.specularColor = Color3.Black();
    this.material.alpha = 0.86;
    this.material.backFaceCulling = true;
    // Clouds must not be tinted by ground fog — they are above the fog layer.
    this.material.fogEnabled = false;

    this.template = MeshBuilder.CreateBox('volumetric_cloud_block', { size: 1 }, this.scene);
    this.template.material = this.material;
    this.template.isPickable = false;
    this.template.checkCollisions = false;
    this.template.applyFog = false;
    this.template.renderingGroupId = 0;
    this.template.alwaysSelectAsActiveMesh = true;
    this.template.doNotSyncBoundingInfo = true;
    // Never let the sky deck take part in shadow casting or picking.
    this.template.receiveShadows = false;

    this.buildField();
  }

  /* ------------------------------------------------------------------ */
  /* Field generation                                                    */
  /* ------------------------------------------------------------------ */

  private hash(s: string): number {
    let h = 2166136261;
    const full = `${this.seed}:${s}`;
    for (let i = 0; i < full.length; i += 1) {
      h ^= full.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 0xffffffff;
  }

  /**
   * Build the cloud field: a grid of candidate cluster sites, each gated by
   * noise against `coverage`, each expanded into a big multi-puff cumulus.
   */
  private buildField(): void {
    this.blocks = [];
    if (this.coverage <= 0.001) {
      this.matrices = new Float32Array(0);
      this.pushBuffer();
      return;
    }

    // Higher coverage => lower gate => more clusters survive.
    const gate = 1 - this.coverage;

    for (let x = -CLOUD_FIELD_EXTENT; x <= CLOUD_FIELD_EXTENT; x += CLUSTER_SPACING) {
      for (let z = -CLOUD_FIELD_EXTENT; z <= CLOUD_FIELD_EXTENT; z += CLUSTER_SPACING) {
        if (this.blocks.length >= MAX_CLOUD_BLOCKS) break;
        const n = this.clusterNoise(x, z);
        if (n < gate * 0.82) continue;
        this.buildCluster(x, z, n);
      }
    }

    this.matrices = new Float32Array(this.blocks.length * 16);
    this.pushBuffer();
  }

  /** Smooth 2-octave value noise driving where clusters appear. */
  private clusterNoise(x: number, z: number): number {
    const sample = (fx: number, fz: number): number => {
      const xi = Math.floor(fx);
      const zi = Math.floor(fz);
      const xf = fx - xi;
      const zf = fz - zi;
      const u = xf * xf * (3 - 2 * xf);
      const v = zf * zf * (3 - 2 * zf);
      const n00 = this.hash(`cl:${xi}:${zi}`);
      const n10 = this.hash(`cl:${xi + 1}:${zi}`);
      const n01 = this.hash(`cl:${xi}:${zi + 1}`);
      const n11 = this.hash(`cl:${xi + 1}:${zi + 1}`);
      return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
    };
    const a = sample(x * 0.0035, z * 0.0035);
    const b = sample(x * 0.0090, z * 0.0090);
    return a * 0.68 + b * 0.32;
  }

  /**
   * One cumulus mass: a wide flat base with a rounded, tapering crown, built
   * from overlapping boxes. This is what makes clouds read as *large* and
   * *clustered* rather than as scattered individual puffs.
   */
  private buildCluster(cx: number, cz: number, density: number): void {
    // Big clusters — "make the clouds larger and in bigger clusters".
    const radius = 58 + this.hash(`r:${cx}:${cz}`) * 96;
    const puffCount = Math.round(14 + density * 26 + this.hash(`n:${cx}:${cz}`) * 12);
    const baseY = (this.hash(`y:${cx}:${cz}`) - 0.5) * 46;
    const jitterX = (this.hash(`jx:${cx}:${cz}`) - 0.5) * CLUSTER_SPACING * 0.8;
    const jitterZ = (this.hash(`jz:${cx}:${cz}`) - 0.5) * CLUSTER_SPACING * 0.8;

    for (let i = 0; i < puffCount; i += 1) {
      if (this.blocks.length >= MAX_CLOUD_BLOCKS) return;
      const a = this.hash(`a:${cx}:${cz}:${i}`) * Math.PI * 2;
      // sqrt keeps puffs evenly spread over the disc instead of bunching at
      // the centre.
      const d = Math.sqrt(this.hash(`d:${cx}:${cz}:${i}`)) * radius;
      const px = cx + jitterX + Math.cos(a) * d;
      const pz = cz + jitterZ + Math.sin(a) * d;

      // Puffs near the cluster centre stack higher, giving a domed crown.
      const centreness = 1 - d / radius;
      const lift = centreness * centreness * (26 + this.hash(`l:${cx}:${cz}:${i}`) * 30);
      const py = baseY + lift + (this.hash(`py:${cx}:${cz}:${i}`) - 0.5) * 10;

      const w = 34 + this.hash(`w:${cx}:${cz}:${i}`) * 52 + centreness * 26;
      const h = 14 + this.hash(`h:${cx}:${cz}:${i}`) * 20 + centreness * 22;
      const dp = 34 + this.hash(`dp:${cx}:${cz}:${i}`) * 52 + centreness * 26;

      this.blocks.push({
        base: new Vector3(px, py, pz),
        scale: new Vector3(w, h, dp),
        phase: this.hash(`ph:${cx}:${cz}:${i}`) * Math.PI * 2,
      });
    }
  }

  /** Write current block transforms into the thin-instance buffer. */
  private pushBuffer(): void {
    if (!this.template || !this.matrices) return;
    if (this.blocks.length === 0) {
      this.template.thinInstanceCount = 0;
      this.template.setEnabled(false);
      return;
    }
    this.template.setEnabled(true);

    const rotation = Quaternion.Identity();
    for (let i = 0; i < this.blocks.length; i += 1) {
      const b = this.blocks[i];
      // Wrap each block around the field so the deck is effectively infinite.
      const x = wrap(b.base.x + this.windOffset.x, CLOUD_FIELD_EXTENT);
      const z = wrap(b.base.z + this.windOffset.z, CLOUD_FIELD_EXTENT);
      // Gentle vertical breathing keeps the deck alive.
      const y = CLOUD_DECK_ALTITUDE + b.base.y + Math.sin(this.elapsed * 0.16 + b.phase) * 3.2;

      Matrix.ComposeToRef(b.scale, rotation, new Vector3(x, y, z), tempMatrix);
      tempMatrix.copyToArray(this.matrices, i * 16);
    }

    this.template.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
    this.template.thinInstanceCount = this.blocks.length;
  }

  /* ------------------------------------------------------------------ */
  /* Runtime                                                             */
  /* ------------------------------------------------------------------ */

  /** Swap to a different biome/dimension cloud look. Rebuilds only if needed. */
  setProfile(coverage: number, tint: Color3): void {
    const coverageChanged = Math.abs(coverage - this.coverage) > 0.06;
    this.coverage = coverage;
    this.tint = tint;
    if (this.material) {
      // Ease the tint so crossing a biome border doesn't snap the cloud colour.
      this.material.diffuseColor = Color3.Lerp(this.material.diffuseColor, tint.scale(0.55), 0.12);
      this.material.emissiveColor = Color3.Lerp(this.material.emissiveColor, tint.scale(0.42), 0.12);
    }
    if (coverageChanged) this.buildField();
  }

  /**
   * Light the deck for the current time of day. Clouds go warm at sunset and
   * deep blue-grey at night, which sells the whole sky.
   */
  setLighting(dayFactor: number, horizonFactor: number, sunsetGlow: Color3): void {
    if (!this.material) return;
    const day = this.tint.scale(0.55);
    const night = this.tint.scale(0.10);
    let diffuse = Color3.Lerp(night, day, dayFactor);
    diffuse = Color3.Lerp(diffuse, sunsetGlow.scale(0.62), horizonFactor * 0.7);
    this.material.diffuseColor = diffuse;

    let emissive = this.tint.scale(0.06 + dayFactor * 0.30);
    emissive = Color3.Lerp(emissive, sunsetGlow.scale(0.40), horizonFactor * 0.65);
    this.material.emissiveColor = emissive;
    this.material.alpha = 0.72 + dayFactor * 0.16;
  }

  update(deltaSeconds: number, cameraPosition: Vector3): void {
    if (this.disposed || !this.template) return;
    this.elapsed += deltaSeconds;

    // Wind drifts the whole deck.
    this.windOffset.x += deltaSeconds * this.windSpeed;
    this.windOffset.z += deltaSeconds * this.windSpeed * 0.32;

    // Keep the field centred on the player horizontally only, so clouds always
    // surround you — but never follow your altitude, which is what previously
    // let a sky layer drop into eye level.
    this.template.position.x = Math.round(cameraPosition.x / (CLOUD_FIELD_EXTENT * 2)) * (CLOUD_FIELD_EXTENT * 2);
    this.template.position.z = Math.round(cameraPosition.z / (CLOUD_FIELD_EXTENT * 2)) * (CLOUD_FIELD_EXTENT * 2);

    // ~12 Hz is plenty for a slow-moving cloud deck.
    this.sinceRefresh += deltaSeconds;
    if (this.sinceRefresh >= 0.08) {
      this.sinceRefresh = 0;
      this.pushBuffer();
    }
  }

  getBlockCount(): number {
    return this.blocks.length;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.template?.dispose();
    this.material?.dispose();
    this.template = null;
    this.material = null;
    this.blocks = [];
    this.matrices = null;
  }
}

const tempMatrix = Matrix.Identity();

function wrap(value: number, extent: number): number {
  const span = extent * 2;
  let v = value;
  while (v > extent) v -= span;
  while (v < -extent) v += span;
  return v;
}

export default VolumetricClouds;

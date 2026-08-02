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
  Material,
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
/**
 * Vertical thickness of the deck, in world units.
 *
 * The deck is a *volume*, not a sheet: puffs are distributed through this
 * full height so flying up into it gives the airliner "inside the weather"
 * feeling — mist above, below and around you — instead of punching through
 * an infinitely thin plane.
 */
export const CLOUD_DECK_THICKNESS = 64;
/** Half-width of the tiling cloud field, in world units. */
export const CLOUD_FIELD_EXTENT = 1400;
/** Spacing between candidate cluster centres. */
const CLUSTER_SPACING = 190;
/** Hard cap on instances, so a dense preset can't tank the frame rate. */
const MAX_CLOUD_BLOCKS = 2600;
/**
 * Peak opacity of a single puff.
 *
 * Deliberately low. Each cluster stacks 14-50 overlapping boxes, so the
 * *accumulated* opacity through a cluster is what the player reads as cloud
 * density. Setting this high made every individual box visible as a hard
 * white slab, which is what made the deck look like floating geometry rather
 * than weather.
 */
const CLOUD_PUFF_ALPHA = 0.30;

/* ------------------------------------------------------------------ */
/* Tornado macro formation                                             */
/* ------------------------------------------------------------------ */
//
// "Arrange the macro layout of this volumetric cloud layer into a massive
// swirling vortex tornado pattern above the overworld that players can fly
// through." The ordinary field above is a dispersed cumulus deck; this is a
// second, deliberate macro structure seated inside it: a funnel of puffs
// whose ring radius widens and whose ring angle advances with height, so the
// silhouette reads as a slow, continuous swirl rather than a scattered pile
// of boxes. It is built from the same soft alpha-blended puffs as the rest
// of the deck, so flying into it gives the same "thick mist" immersion.

/** Field-local position of the funnel's centre line (wraps with the field). */
const TORNADO_CENTER_X = 0;
const TORNADO_CENTER_Z = 0;
/** Vertical span of the funnel, centred on the deck's own vertical band. */
const TORNADO_HEIGHT = CLOUD_DECK_THICKNESS * 2.4;
/** Puff rings stacked from the narrow base to the wide crown. */
const TORNADO_RING_COUNT = 22;
/** Puffs placed around each ring. */
const TORNADO_PUFFS_PER_RING = 11;
/** Radius at the narrowest ring, near the base of the funnel. */
const TORNADO_BASE_RADIUS = 20;
/** Radius at the widest ring, where the funnel opens into the deck above. */
const TORNADO_TOP_RADIUS = 150;
/** Full turns the spiral completes from base to crown — the "swirl". */
const TORNADO_TURNS = 3.25;

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
  /** Performance-tier multiplier from 0-1. */
  private densityScale = 1;
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
    this.material.alpha = CLOUD_PUFF_ALPHA;

    // --- soft, flyable-through volume ------------------------------------
    //
    // `backFaceCulling = false` is what lets the player fly *into* the deck.
    // With culling on, entering a puff clips away its far side and the cloud
    // visibly pops inside-out around the camera. Rendering both faces keeps
    // the volume coherent from within.
    this.material.backFaceCulling = false;

    // Force the alpha-blended path. Babylon decides transparency from alpha
    // and texture, and a StandardMaterial with no diffuse texture at alpha 1
    // would take the opaque path and draw hard white slabs.
    this.material.needAlphaBlending = () => true;
    this.material.transparencyMode = Material.MATERIAL_ALPHABLEND;

    // Do NOT write depth. This is the single most important line for making
    // stacked puffs read as one soft mass: with depth writes on, whichever
    // box draws first occludes every box behind it, so the deck resolves into
    // visible hard-edged cubes. Depth-testing stays on so terrain still
    // correctly occludes clouds.
    this.material.disableDepthWrite = true;
    // Blend back-to-front without sorting artifacts inside a cluster.
    this.material.separateCullingPass = true;

    // Clouds must not be tinted by ground fog — they are above the fog layer.
    this.material.fogEnabled = false;

    this.template = MeshBuilder.CreateBox('volumetric_cloud_block', { size: 1 }, this.scene);
    this.template.material = this.material;
    this.template.isPickable = false;
    // The deck is atmosphere, never a surface: the player flies straight
    // through it rather than landing on it.
    this.template.checkCollisions = false;
    this.template.applyFog = false;
    // Rendering group 0 keeps the deck in the *same* transparent pass as the
    // rest of the world, so opaque terrain writes depth first and the soft
    // cloud volume is correctly occluded behind mountains instead of drawing
    // through them. (Group 1 rendered the deck after terrain in a later pass,
    // which is what let cloud puffs bleed over mountain silhouettes.)
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
    const effectiveCoverage = Math.max(0, Math.min(1, this.coverage * this.densityScale));
    const gate = 1 - effectiveCoverage;

    // The dedicated tornado macro-formation is seated first so it always
    // gets its full allocation of puffs. Building the dispersed cluster
    // field first would spend the whole `MAX_CLOUD_BLOCKS` budget before the
    // tornado ever got a turn, silently dropping the one deliberate macro
    // shape the brief actually asks for.
    this.buildTornado(effectiveCoverage);

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
    // Seat each cluster somewhere inside the deck's vertical band, leaving
    // headroom at the top and bottom for the per-puff lift/jitter below so
    // the volume has soft, ragged edges rather than a flat ceiling and floor.
    const baseY = (this.hash(`y:${cx}:${cz}`) - 0.5) * CLOUD_DECK_THICKNESS * 0.55;
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

  /**
   * The tornado macro-formation: a funnel of puff rings that narrows near
   * its base and widens as it climbs, each ring rotated further than the
   * last so the whole shape reads as one continuous swirling vortex.
   *
   * Built the same way `buildCluster` is — many overlapping soft boxes, same
   * material, same thin-instance buffer — so it costs nothing extra to
   * render and blends seamlessly with the rest of the deck; only the *macro
   * layout* differs, which is exactly what turns "a pile of cumulus puffs"
   * into a shape the player can recognise and fly through.
   */
  private buildTornado(strength: number): void {
    if (strength <= 0.001) return;

    for (let ring = 0; ring < TORNADO_RING_COUNT; ring += 1) {
      if (this.blocks.length >= MAX_CLOUD_BLOCKS) return;
      // 0 at the base, 1 at the crown.
      const t = ring / Math.max(1, TORNADO_RING_COUNT - 1);
      // Ease the radius growth so the silhouette bells outward like a real
      // funnel cloud instead of a perfect cone.
      const eased = t * t * (3 - 2 * t);
      const ringRadius = TORNADO_BASE_RADIUS + (TORNADO_TOP_RADIUS - TORNADO_BASE_RADIUS) * eased;
      // The spiral: each ring is rotated further round than the one below
      // it, so following the rings upward traces a continuous swirl.
      const ringAngle = t * TORNADO_TURNS * Math.PI * 2;
      const ringY = (t - 0.5) * TORNADO_HEIGHT;
      // Puffs shrink toward the narrow base and swell toward the open crown,
      // matching a funnel's real silhouette.
      const puffScale = 0.45 + eased * 0.9;

      for (let i = 0; i < TORNADO_PUFFS_PER_RING; i += 1) {
        if (this.blocks.length >= MAX_CLOUD_BLOCKS) return;
        const key = `tornado:${ring}:${i}`;
        const spread = (i / TORNADO_PUFFS_PER_RING) * Math.PI * 2;
        const wobble = (this.hash(`${key}:w`) - 0.5) * 0.4;
        const a = ringAngle + spread + wobble;
        const r = ringRadius * (0.86 + this.hash(`${key}:r`) * 0.28);

        const px = TORNADO_CENTER_X + Math.cos(a) * r;
        const pz = TORNADO_CENTER_Z + Math.sin(a) * r;
        const py = ringY + (this.hash(`${key}:y`) - 0.5) * (TORNADO_HEIGHT / TORNADO_RING_COUNT) * 1.4;

        const w = (30 + this.hash(`${key}:sw`) * 30) * puffScale;
        const h = (16 + this.hash(`${key}:sh`) * 16) * puffScale;
        const dp = (30 + this.hash(`${key}:sd`) * 30) * puffScale;

        this.blocks.push({
          base: new Vector3(px, py, pz),
          scale: new Vector3(w, h, dp),
          phase: this.hash(`${key}:ph`) * Math.PI * 2,
        });
      }
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

    for (let i = 0; i < this.blocks.length; i += 1) {
      const b = this.blocks[i];
      // Wrap each block around the field so the deck is effectively infinite.
      const x = wrap(b.base.x + this.windOffset.x, CLOUD_FIELD_EXTENT);
      const z = wrap(b.base.z + this.windOffset.z, CLOUD_FIELD_EXTENT);
      // Gentle vertical breathing keeps the deck alive.
      const y = CLOUD_DECK_ALTITUDE + b.base.y + Math.sin(this.elapsed * 0.16 + b.phase) * 3.2;

      tempPosition.set(x, y, z);
      Matrix.ComposeToRef(b.scale, tempRotation, tempPosition, tempMatrix);
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

  /** Thin out the deck on lower effect tiers. */
  setDensityScale(scale: number): void {
    const next = Math.max(0, Math.min(1, scale));
    if (Math.abs(next - this.densityScale) <= 0.08) return;
    this.densityScale = next;
    this.buildField();
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
    // Stay within the soft per-puff budget. Opacity accumulates across the
    // many overlapping boxes in a cluster, so this is the density of a single
    // wisp, not of the cloud as a whole — pushing it toward 1 is what turned
    // the deck back into hard white blocks.
    this.material.alpha = CLOUD_PUFF_ALPHA * (0.82 + dayFactor * 0.18);
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

  /**
   * Read-only snapshot of every puff's base position (before wind offset).
   *
   * Exists for regression tests that need to verify the macro *shape* of the
   * field — e.g. that the tornado formation actually widens and spirals with
   * height rather than just existing as a blob of extra boxes — without
   * reaching into a private field.
   */
  getDebugBlocks(): ReadonlyArray<{ x: number; y: number; z: number }> {
    return this.blocks.map((b) => ({ x: b.base.x, y: b.base.y, z: b.base.z }));
  }

  /**
   * How deeply the given altitude sits inside the cloud deck's vertical
   * band, in [0, 1].
   *
   * This is what makes flying up into the deck feel like flying an airplane
   * into real weather: 0 well below or above the deck, ramping up smoothly
   * to 1 once the camera is inside the dense middle of the band. The caller
   * (`AtmosphereSystem` / the render loop) uses this to thicken fog and tint
   * the view, rather than the clouds staying purely decorative geometry you
   * can fly through without anything changing on screen.
   */
  getImmersion(altitude: number): number {
    if (this.coverage <= 0.001) return 0;
    const half = CLOUD_DECK_THICKNESS * 0.5;
    // Soft edges: full band ± half thickness, with an extra half-thickness
    // of ramp on each side so entering/leaving the deck fades rather than
    // snapping.
    const distance = Math.abs(altitude - CLOUD_DECK_ALTITUDE);
    if (distance >= half + CLOUD_DECK_THICKNESS) return 0;
    if (distance <= half) return 1;
    const t = 1 - (distance - half) / CLOUD_DECK_THICKNESS;
    return Math.max(0, Math.min(1, t));
  }

  /** The colour the screen should fog toward while flying through the deck. */
  getMistColor(): Color3 {
    // A soft, bright, slightly warm-neutral grey-white — real cloud mist, not
    // a flat opaque colour swatch.
    return Color3.Lerp(this.tint, new Color3(0.92, 0.93, 0.96), 0.6);
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
const tempRotation = Quaternion.Identity();
const tempPosition = Vector3.Zero();

function wrap(value: number, extent: number): number {
  const span = extent * 2;
  let v = value;
  while (v > extent) v -= span;
  while (v < -extent) v += span;
  return v;
}

export default VolumetricClouds;

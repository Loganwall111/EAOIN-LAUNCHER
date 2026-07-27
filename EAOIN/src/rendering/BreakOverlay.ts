/**
 * BreakOverlay — the Minecraft block-breaking crack animation.
 *
 * ## What was wrong
 *
 * The old implementation created a plain dark box scaled slightly larger than
 * the target block, then faded its **alpha from 0.18 to 0.80** and pushed its
 * emissive toward red as mining progressed. So breaking a block dimmed the
 * whole cube and washed it red — the reported "there's just this red screen
 * that appears when I'm breaking a block that just feels so outdated". There
 * were never any actual cracks.
 *
 * ## What it does now
 *
 * Ten destroy-stage textures, generated once and cached, drawn exactly the way
 * Minecraft does it: a **black crack pattern on a transparent background**,
 * alpha-blended onto a shell mesh sitting a hair outside the block. Stage 0 is
 * a single hairline fracture; by stage 9 the face is a dense web. The block
 * underneath keeps its own texture and colour the whole time.
 *
 * The stage textures are deterministic and shared across every block, so
 * cracks grow by *adding* detail rather than changing pattern — which is what
 * makes the progression read as one block breaking apart.
 */
import {
  Color3,
  Mesh,
  MeshBuilder,
  RawTexture,
  Scene,
  StandardMaterial,
  Texture,
} from '@babylonjs/core';

/** Minecraft uses 10 destroy stages; matching that keeps the feel familiar. */
export const DESTROY_STAGES = 10;

const TEXTURE_SIZE = 16;

/** Deterministic hash in [0,1) so the crack pattern is stable between runs. */
function hash(x: number, y: number, salt: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + salt * 2246822519, 3266489917);
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 4294967296;
}

/**
 * Draw the crack pattern for a stage into an RGBA buffer.
 *
 * Cracks are grown as random walks from a few seed points. Higher stages
 * inherit every earlier stage's walk (same salts, more of them, longer), so
 * the pattern accumulates instead of flickering between frames.
 */
function buildStageTexels(stage: number): Uint8Array {
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  // Fully transparent to start: only the cracks themselves are opaque.
  const plot = (x: number, y: number, alpha: number) => {
    if (x < 0 || y < 0 || x >= TEXTURE_SIZE || y >= TEXTURE_SIZE) return;
    const i = (y * TEXTURE_SIZE + x) * 4;
    // Cracks are near-black with a subtle lighter lip, like chipped stone.
    if (alpha <= data[i + 3]) return;
    data[i] = 12;
    data[i + 1] = 10;
    data[i + 2] = 10;
    data[i + 3] = alpha;
  };

  const progress = (stage + 1) / DESTROY_STAGES;
  // More fractures, and longer ones, as the block gives way.
  const fractures = 1 + Math.round(progress * 6);
  const length = 3 + Math.round(progress * 13);

  for (let f = 0; f < fractures; f += 1) {
    // Every fracture starts at the same place for a given index, so stage N+1
    // is stage N plus extra damage.
    let x = Math.floor(hash(f, 0, 17) * TEXTURE_SIZE);
    let y = Math.floor(hash(f, 1, 23) * TEXTURE_SIZE);

    for (let step = 0; step < length; step += 1) {
      plot(x, y, 235);
      // Faint lip beside the crack gives it depth at 16px.
      plot(x + 1, y, 90);
      plot(x, y + 1, 90);

      // Random walk biased along one axis per fracture, so cracks run rather
      // than blob.
      const horizontal = hash(f, 2, 31) > 0.5;
      const turn = hash(f, step + 3, 41);
      if (horizontal) {
        x += turn < 0.75 ? 1 : 0;
        y += turn < 0.25 ? -1 : turn > 0.85 ? 1 : 0;
      } else {
        y += turn < 0.75 ? 1 : 0;
        x += turn < 0.25 ? -1 : turn > 0.85 ? 1 : 0;
      }

      // Branch on the later stages for that shattered look.
      if (stage > 5 && hash(f, step, 53) > 0.86) {
        plot(x + 1, y - 1, 200);
        plot(x + 2, y - 1, 120);
      }

      if (x < 0) x += TEXTURE_SIZE;
      if (y < 0) y += TEXTURE_SIZE;
      x %= TEXTURE_SIZE;
      y %= TEXTURE_SIZE;
    }
  }

  return data;
}

/**
 * Owns the crack mesh and its ten stage textures.
 *
 * One instance lives for the whole session; `show`/`hide` move and retexture a
 * single reused mesh, so mining never allocates.
 */
export class BreakOverlay {
  private readonly mesh: Mesh;
  private readonly materials: StandardMaterial[] = [];
  private currentStage = -1;
  private visible = false;

  constructor(scene: Scene) {
    // Slightly larger than the block so the cracks sit just proud of the
    // surface and never z-fight with the terrain mesh.
    this.mesh = MeshBuilder.CreateBox('block_break_overlay', { size: 1.004 }, scene);
    this.mesh.isPickable = false;
    this.mesh.checkCollisions = false;
    this.mesh.setEnabled(false);
    this.mesh.renderingGroupId = 1;

    for (let stage = 0; stage < DESTROY_STAGES; stage += 1) {
      const material = new StandardMaterial(`break_stage_${stage}`, scene);
      const texture = RawTexture.CreateRGBATexture(
        buildStageTexels(stage),
        TEXTURE_SIZE,
        TEXTURE_SIZE,
        scene,
        false,
        false,
        Texture.NEAREST_SAMPLINGMODE
      );
      texture.hasAlpha = true;
      texture.wrapU = Texture.CLAMP_ADDRESSMODE;
      texture.wrapV = Texture.CLAMP_ADDRESSMODE;

      material.diffuseTexture = texture;
      material.opacityTexture = texture;
      material.useAlphaFromDiffuseTexture = true;
      // Unlit: the cracks must read the same in a bright field and a dark cave.
      material.disableLighting = true;
      material.emissiveColor = new Color3(1, 1, 1);
      material.diffuseColor = new Color3(0, 0, 0);
      material.specularColor = new Color3(0, 0, 0);
      material.backFaceCulling = true;
      // Do not write depth — the overlay is decoration on top of the block.
      material.zOffset = -2;

      this.materials.push(material);
    }
  }

  /**
   * Show the crack overlay on a block.
   *
   * @param progress 0..1 mining progress; mapped onto the ten destroy stages.
   */
  show(blockX: number, blockY: number, blockZ: number, progress: number): void {
    const stage = Math.min(
      DESTROY_STAGES - 1,
      Math.max(0, Math.floor(progress * DESTROY_STAGES))
    );

    if (!this.visible) {
      this.mesh.setEnabled(true);
      this.visible = true;
    }

    this.mesh.position.set(blockX + 0.5, blockY + 0.5, blockZ + 0.5);

    // Swapping the material is the only per-stage work; textures are prebuilt.
    if (stage !== this.currentStage) {
      this.mesh.material = this.materials[stage];
      this.currentStage = stage;
    }
  }

  /** Current destroy stage, or -1 when hidden. Exposed for the HUD and tests. */
  getStage(): number {
    return this.visible ? this.currentStage : -1;
  }

  hide(): void {
    if (!this.visible) return;
    this.mesh.setEnabled(false);
    this.visible = false;
    this.currentStage = -1;
  }

  dispose(): void {
    this.mesh.dispose();
    for (const material of this.materials) {
      material.diffuseTexture?.dispose();
      material.dispose();
    }
    this.materials.length = 0;
  }
}

/** Exposed for tests: the raw texels of a destroy stage. */
export function destroyStageTexels(stage: number): Uint8Array {
  return buildStageTexels(stage);
}

export default BreakOverlay;

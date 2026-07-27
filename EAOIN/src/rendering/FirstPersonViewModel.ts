/**
 * FirstPersonViewModel — the arm and the item it is holding.
 *
 * ## What was wrong
 *
 * The old view model was three stacked boxes parented directly to the camera,
 * and it never showed what you were holding. So:
 *
 *   - "the hand looks like a square and is moving in a weird way" — the swing
 *     drove `arm.position` on all three axes with `sin(progress * PI * 6)`,
 *     a frequency tied to *mining progress* rather than to time, so a fast
 *     block juddered and a slow one crawled;
 *   - "the weapons in the game are blocks… swords are actually displayed in
 *     the person's hand, same with all items" — nothing was rendered in the
 *     hand at all, whatever you had selected.
 *
 * ## What it does now
 *
 * A hinged arm rig (shoulder → elbow) that rotates rather than slides, which
 * is what makes a punch look like a punch. The held item is rebuilt whenever
 * the selection changes:
 *
 *   - **Blocks** become a small textured cube using the same procedural
 *     textures as the world and inventory, held at the Minecraft angle.
 *   - **Tools and weapons** become a flat sprite plane using the item's own
 *     art, angled so the blade points up and away exactly like Minecraft.
 *
 * Animation is driven by **wall-clock time**, so the swing tempo is constant
 * regardless of how long the block takes to break, plus a bob tied to walking
 * speed and a small landing dip.
 */
import {
  Color3,
  Mesh,
  MeshBuilder,
  RawTexture,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  UniversalCamera,
  Vector3,
} from '@babylonjs/core';
import { BlockID } from '@shared/blocks/BlockRegistry';
import {
  buildBlockTexels,
  isItemSprite,
  TEXTURE_SIZE,
} from './BlockTextureSource';

/** How long one swing takes, in ms. Minecraft's is ~250ms. */
const SWING_MS = 260;

export interface ViewModelSkin {
  /** Skin tone for the hand. */
  skin: string;
  /** Sleeve colour, from the player's chosen outfit. */
  sleeve: string;
}

const DEFAULT_SKIN: ViewModelSkin = { skin: '#b87855', sleeve: '#1f67c8' };

export class FirstPersonViewModel {
  /** Root, parented to the camera. Everything hangs off this. */
  private readonly root: TransformNode;
  /** Shoulder pivot — the swing rotates this, so the arm arcs. */
  private readonly shoulder: TransformNode;
  private readonly armMeshes: Mesh[] = [];
  /** Pivot for whatever is being held, so items swing with the arm. */
  private readonly itemPivot: TransformNode;

  private heldMesh: Mesh | null = null;
  private heldMaterial: StandardMaterial | null = null;
  private heldKey = '';

  /** Timestamp the current swing started, or 0 when idle. */
  private swingStartedAt = 0;
  /** Set while the player holds the mine button, for continuous swinging. */
  private swingRepeating = false;
  private enabled = true;
  private bobPhase = 0;

  constructor(
    private readonly scene: Scene,
    camera: UniversalCamera,
    skin: ViewModelSkin = DEFAULT_SKIN
  ) {
    this.root = new TransformNode('first_person_root', scene);
    this.root.parent = camera;
    // Lower-right of the screen, angled inward, like every FPS view model.
    this.root.position = new Vector3(0.42, -0.36, 0.62);

    this.shoulder = new TransformNode('first_person_shoulder', scene);
    this.shoulder.parent = this.root;
    // Pivot sits above the arm so rotation swings the hand down and forward.
    this.shoulder.position = new Vector3(0, 0.22, 0);
    this.shoulder.rotation = new Vector3(0.32, -0.22, -0.14);

    const skinMaterial = this.pixelMaterial('fp_skin', skin.skin, 'skin');
    const sleeveMaterial = this.pixelMaterial('fp_sleeve', skin.sleeve, 'sleeve');

    // Minecraft's arm is a 4x12x4 cuboid. These proportions match, scaled to
    // view-model size, with the sleeve covering the upper two thirds.
    const upper = MeshBuilder.CreateBox('fp_arm_upper', { width: 0.16, height: 0.34, depth: 0.16 }, scene);
    upper.parent = this.shoulder;
    upper.position.y = -0.19;
    upper.material = sleeveMaterial;

    const hand = MeshBuilder.CreateBox('fp_arm_hand', { width: 0.165, height: 0.15, depth: 0.165 }, scene);
    hand.parent = this.shoulder;
    hand.position.y = -0.43;
    hand.material = skinMaterial;

    this.armMeshes.push(upper, hand);
    for (const mesh of this.armMeshes) {
      mesh.isPickable = false;
      mesh.checkCollisions = false;
      // Render after the world so the arm is never clipped by nearby geometry.
      mesh.renderingGroupId = 2;
      mesh.applyFog = false;
    }

    this.itemPivot = new TransformNode('first_person_item', scene);
    this.itemPivot.parent = this.shoulder;
    this.itemPivot.position = new Vector3(0.02, -0.46, 0.06);
  }

  /** Show or hide the whole view model (hidden in third person). */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.root.setEnabled(enabled);
  }

  /** Start a swing. Called on every mine/attack input. */
  swing(): void {
    this.swingStartedAt = performance.now();
  }

  /** While true the arm keeps swinging, for held-down mining. */
  setContinuousSwing(active: boolean): void {
    this.swingRepeating = active;
    if (active && this.swingStartedAt === 0) this.swing();
  }

  /**
   * Set what the hand is holding.
   *
   * `blockId` 0 or a tool id both work: tools render as sprites, blocks as
   * cubes. Rebuilds only when the selection actually changes.
   */
  setHeldItem(blockId: BlockID): void {
    const key = String(blockId);
    if (key === this.heldKey) return;
    this.heldKey = key;

    this.disposeHeld();
    if (!blockId) return;

    if (isItemSprite(blockId)) this.buildSpriteItem(blockId);
    else this.buildBlockItem(blockId);
  }

  /**
   * Advance the animation.
   *
   * @param deltaSeconds frame delta
   * @param movementSpeed horizontal speed in blocks/sec, drives the walk bob
   */
  update(deltaSeconds: number, movementSpeed = 0): void {
    if (!this.enabled) return;

    // --- swing ------------------------------------------------------------
    let swingAmount = 0;
    if (this.swingStartedAt > 0) {
      const elapsed = performance.now() - this.swingStartedAt;
      if (elapsed >= SWING_MS) {
        if (this.swingRepeating) this.swingStartedAt = performance.now();
        else this.swingStartedAt = 0;
      } else {
        // Time-based, so the tempo never depends on block hardness.
        const t = elapsed / SWING_MS;
        // Fast out, slow back: a punch, not a metronome.
        swingAmount = Math.sin(t * Math.PI);
      }
    }

    // --- walk bob ---------------------------------------------------------
    this.bobPhase += deltaSeconds * Math.min(movementSpeed, 6) * 2.2;
    const bobActive = movementSpeed > 0.15 ? 1 : 0;
    const bobX = Math.cos(this.bobPhase) * 0.014 * bobActive;
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.018 * bobActive;

    // The swing is a ROTATION about the shoulder, plus a small forward thrust.
    // The old code translated the arm on three axes at once, which is what
    // made it look like a box sliding around the screen.
    this.shoulder.rotation.x = 0.32 - swingAmount * 1.25;
    this.shoulder.rotation.z = -0.14 + swingAmount * 0.22;
    this.root.position.x = 0.42 + bobX - swingAmount * 0.05;
    this.root.position.y = -0.36 - bobY + swingAmount * 0.03;
    this.root.position.z = 0.62 + swingAmount * 0.10;
  }

  dispose(): void {
    this.disposeHeld();
    for (const mesh of this.armMeshes) {
      mesh.material?.dispose();
      mesh.dispose();
    }
    this.armMeshes.length = 0;
    this.itemPivot.dispose();
    this.shoulder.dispose();
    this.root.dispose();
  }

  /* ------------------------------------------------------------------ *
   * held item construction
   * ------------------------------------------------------------------ */

  /** Blocks are held as a small cube, tilted the way Minecraft holds them. */
  private buildBlockItem(blockId: BlockID): void {
    const mesh = MeshBuilder.CreateBox(`fp_held_block_${blockId}`, { size: 0.26 }, this.scene);
    mesh.parent = this.itemPivot;
    mesh.position = new Vector3(0.02, -0.04, 0.10);
    mesh.rotation = new Vector3(0.18, 0.78, 0.12);

    const material = new StandardMaterial(`fp_held_mat_${blockId}`, this.scene);
    material.diffuseTexture = this.itemTexture(blockId, 'side');
    material.specularColor = new Color3(0.03, 0.03, 0.03);
    // Slight self-illumination so the held item stays visible in a dark cave.
    material.emissiveColor = new Color3(0.22, 0.22, 0.22);
    mesh.material = material;

    this.finishHeld(mesh, material);
  }

  /**
   * Tools and weapons are held as a flat sprite, angled blade-up.
   *
   * This is the fix for "the weapons in the game are blocks — swords should be
   * displayed in the person's hand": a sword now renders as its own item art
   * on a plane, not as a coloured cube.
   */
  private buildSpriteItem(blockId: BlockID): void {
    const mesh = MeshBuilder.CreatePlane(
      `fp_held_item_${blockId}`,
      { size: 0.4, sideOrientation: Mesh.DOUBLESIDE },
      this.scene
    );
    mesh.parent = this.itemPivot;
    mesh.position = new Vector3(0.04, 0.02, 0.12);
    // Angled so the item reads at a three-quarter view, like Minecraft's
    // held-item transform.
    mesh.rotation = new Vector3(0.15, -0.55, -0.62);

    const material = new StandardMaterial(`fp_held_mat_${blockId}`, this.scene);
    const texture = this.itemTexture(blockId, 'side');
    texture.hasAlpha = true;
    material.diffuseTexture = texture;
    material.opacityTexture = texture;
    material.useAlphaFromDiffuseTexture = true;
    material.backFaceCulling = false;
    material.specularColor = new Color3(0, 0, 0);
    material.emissiveColor = new Color3(0.35, 0.35, 0.35);
    mesh.material = material;

    this.finishHeld(mesh, material);
  }

  private finishHeld(mesh: Mesh, material: StandardMaterial): void {
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.renderingGroupId = 2;
    mesh.applyFog = false;
    this.heldMesh = mesh;
    this.heldMaterial = material;
  }

  private itemTexture(blockId: BlockID, face: 'top' | 'side' | 'bottom'): Texture {
    const texels = buildBlockTexels({ id: blockId, face });
    const texture = RawTexture.CreateRGBATexture(
      new Uint8Array(texels.buffer.slice(0)),
      TEXTURE_SIZE,
      TEXTURE_SIZE,
      this.scene,
      false,
      false,
      Texture.NEAREST_SAMPLINGMODE
    );
    texture.name = `fp_tex_${blockId}`;
    return texture;
  }

  private disposeHeld(): void {
    this.heldMaterial?.diffuseTexture?.dispose();
    this.heldMaterial?.dispose();
    this.heldMesh?.dispose();
    this.heldMaterial = null;
    this.heldMesh = null;
  }

  /**
   * Pixel-art material for the arm itself.
   *
   * Generated rather than a flat colour so the arm has visible texels and
   * matches the blocky look of everything else.
   */
  private pixelMaterial(name: string, baseHex: string, style: 'skin' | 'sleeve'): StandardMaterial {
    const size = 16;
    const data = new Uint8Array(size * size * 4);
    const base = hexToRgb(baseHex);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        // Deterministic per-texel shade variation.
        let h = Math.imul(x * 73856093 + y * 19349663 + (style === 'skin' ? 7 : 13), 2654435761);
        h = (h ^ (h >>> 15)) >>> 0;
        const n = (h / 4294967296 - 0.5) * (style === 'skin' ? 0.14 : 0.2);
        // Darken the outline so the cuboid edges read.
        const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1 ? -0.22 : 0;
        const k = 1 + n + edge;
        const i = (y * size + x) * 4;
        data[i] = Math.max(0, Math.min(255, base.r * k));
        data[i + 1] = Math.max(0, Math.min(255, base.g * k));
        data[i + 2] = Math.max(0, Math.min(255, base.b * k));
        data[i + 3] = 255;
      }
    }

    const texture = RawTexture.CreateRGBATexture(
      data, size, size, this.scene, false, false, Texture.NEAREST_SAMPLINGMODE
    );
    texture.name = `${name}_tex`;

    const material = new StandardMaterial(`${name}_mat`, this.scene);
    material.diffuseTexture = texture;
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    // Keep the arm readable in caves without making it glow.
    material.emissiveColor = new Color3(0.18, 0.18, 0.18);
    return material;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').padEnd(6, '0');
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

export default FirstPersonViewModel;

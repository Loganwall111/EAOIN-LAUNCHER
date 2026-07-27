/**
 * Procedural block material pack.
 *
 * Textures come from `BlockTextureSource`, the single generator shared with
 * the inventory, hotbar and held-item renderers. That is what guarantees an
 * oak log looks the same in your hand, in a slot and in the ground — before
 * this, the world used one generator and the UI drew flat CSS squares.
 *
 * ## Lighting model (the "dark blocks" fix)
 *
 * The old pack used `PBRMaterial` with `environmentIntensity = 0`. With no
 * image-based lighting, a PBR surface has *only* the direct sun term, so any
 * face pointing away from the sun — the underside of a canopy, a cave wall,
 * the north side of a trunk — resolved to nearly black. That is the reported
 * "when I'm in the trees the blocks are dark and I cannot see anything".
 *
 * Blocks now use `StandardMaterial` with:
 *   - a real `ambientColor` contribution, so unlit faces keep a readable floor,
 *   - baked vertex-colour AO from the mesher providing the contact shading
 *     that the harsh directional light used to fake,
 *   - `specularColor` near zero, because a voxel world should not be glossy.
 *
 * Emissive blocks keep their glow, and transparent blocks keep alpha blending.
 */
import {
  Color3,
  Material,
  RawTexture,
  Scene,
  StandardMaterial,
  Texture,
} from '@babylonjs/core';
import { BlockID, BLOCKS, getBlock } from '@shared/blocks/BlockRegistry';
import {
  buildBlockTexels,
  faceForVariant,
  hasFaceVariants,
  TEXTURE_SIZE,
  VARIANT_BOTTOM,
  VARIANT_SIDE,
  VARIANT_TOP,
} from './BlockTextureSource';
import { encodeSurfaceKey, SurfaceKey } from './GreedyMesher';

/** Keyed by surface key (block id + face variant), matching the mesher. */
export type BlockMaterialMap = Map<SurfaceKey, StandardMaterial>;

export type TexturePackId = 'classic' | 'soft' | 'vibrant' | 'noir';

/**
 * Emissive strength per block, derived from the registry's light level so we
 * do not maintain a second hand-written table that can drift out of sync.
 */
function emissiveFor(id: BlockID): Color3 {
  const block = getBlock(id);
  if (!block.emissive || block.lightLevel <= 0) return new Color3(0, 0, 0);
  const strength = Math.min(1, block.lightLevel / 15) * 0.55;
  const base = Color3.FromHexString(block.color);
  return new Color3(base.r * strength, base.g * strength, base.b * strength);
}

export function createBlockMaterials(scene: Scene, texturePack: TexturePackId = 'classic'): BlockMaterialMap {
  const materials: BlockMaterialMap = new Map();

  for (const block of Object.values(BLOCKS)) {
    if (block.id === 0) continue;
    const variants = hasFaceVariants(block.id)
      ? [VARIANT_SIDE, VARIANT_TOP, VARIANT_BOTTOM]
      : [VARIANT_SIDE];

    for (const variant of variants) {
      const key = encodeSurfaceKey(block.id, variant);
      materials.set(key, createMaterial(scene, block.id, variant, texturePack));
    }
  }

  return materials;
}

function createMaterial(
  scene: Scene,
  id: BlockID,
  variant: number,
  pack: TexturePackId
): StandardMaterial {
  const block = getBlock(id);
  const safeName = block.name.toLowerCase().replace(/\s+/g, '_');
  const material = new StandardMaterial(`block_${safeName}_${variant}`, scene);

  const texture = createBlockTexture(scene, id, variant, pack);
  material.diffuseTexture = texture;
  material.ambientTexture = texture;

  // Vertex colours carry the mesher's baked ambient occlusion. In Babylon
  // this is enabled per-mesh (`mesh.useVertexColors`, on by default), so the
  // material only has to avoid overriding the diffuse with a flat colour.
  material.diffuseColor = new Color3(1, 1, 1);

  // A voxel world should read as matte. Leaving specular on made every block
  // look like wet plastic under the sun.
  material.specularColor = new Color3(0.04, 0.04, 0.04);
  material.specularPower = 96;

  // The ambient term is the actual fix for unlit faces going black: it lets
  // the scene's ambientColor lift surfaces the sun never reaches.
  material.ambientColor = new Color3(1, 1, 1);
  material.emissiveColor = emissiveFor(id);

  // Voxel faces are only ever seen from outside, so culling halves the
  // fragment work. The old pack disabled it, doubling overdraw for no gain.
  material.backFaceCulling = true;

  if (block.transparent) {
    texture.hasAlpha = true;
    material.useAlphaFromDiffuseTexture = true;
    if (block.category === 'fluid') {
      material.alpha = 0.74;
      material.transparencyMode = Material.MATERIAL_ALPHABLEND;
      // Water should not be walled off from itself by depth writes.
      material.separateCullingPass = true;
    } else {
      // Leaves and glass use alpha *testing*, not blending: it is far cheaper,
      // needs no sorting, and gives the crisp cut-out edge Minecraft has.
      material.transparencyMode = Material.MATERIAL_ALPHATEST;
      material.alphaCutOff = 0.35;
      material.backFaceCulling = false;
    }
  }

  return material;
}

function createBlockTexture(
  scene: Scene,
  id: BlockID,
  variant: number,
  pack: TexturePackId
): Texture {
  const texels = buildBlockTexels({ id, face: faceForVariant(variant), pack });
  const texture = RawTexture.CreateRGBATexture(
    // RawTexture copies the buffer, so sharing the cached array is safe.
    new Uint8Array(texels.buffer.slice(0)),
    TEXTURE_SIZE,
    TEXTURE_SIZE,
    scene,
    // Mipmaps ON: without them, distant voxel terrain aliases into shimmering
    // noise, which reads as "the world looks glitchy far away".
    true,
    false,
    Texture.NEAREST_NEAREST_MIPLINEAR
  );
  texture.name = `tex_block_${id}_${variant}`;
  // Greedy meshing merges coplanar faces into large quads whose UVs span the
  // quad in *blocks* (a 6×3 quad has UVs 0..6 by 0..3). WRAP addressing makes
  // that tile the texture once per block; the default CLAMP would stretch one
  // texel across the whole merged quad and the terrain would look smeared.
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  // Anisotropy keeps ground textures sharp at grazing angles, which is most
  // of the screen when you are standing on terrain.
  texture.anisotropicFilteringLevel = 4;
  return texture;
}

/** Look up the material for a surface, falling back to the block's side face. */
export function materialForSurface(
  materials: BlockMaterialMap,
  key: SurfaceKey
): StandardMaterial | null {
  const exact = materials.get(key);
  if (exact) return exact;
  const blockId = key & 0xffff;
  return materials.get(blockId) ?? null;
}

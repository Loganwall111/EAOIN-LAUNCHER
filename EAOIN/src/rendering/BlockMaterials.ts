/**
 * Babylon materials for voxel surfaces.
 *
 * Opacity is decided from the block registry once, here. The mesher never
 * changes material alpha and opaque terrain never inherits alpha from a PNG or
 * generated RGBA texture. Keeping that contract in one place prevents a
 * texture-pack change from turning the ground into an X-ray surface.
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

/** Keyed by block id + face variant, matching the mesher's surface keys. */
export type BlockMaterialMap = Map<SurfaceKey, StandardMaterial>;

export type TexturePackId = 'classic' | 'soft' | 'vibrant' | 'noir';

/**
 * The alpha byte every opaque terrain texel is forced to. Hard-coded: this is
 * the second line of defence against the X-ray defect; even if a generated
 * RGBA texture or a future resource pack ships a stray low alpha channel, the
 * uploaded GPU buffer reads fully opaque for these blocks regardless.
 */
export const OPAQUE_ALPHA_BYTE = 255;

/** Babylon transparencyMode for the opaque queue — hard requirement, never blended/tested. */
export const OPAQUE_TRANSPARENCY_MODE = 0; // Material.MATERIAL_OPAQUE

/**
 * Ground ids that are always opaque, even if a resource pack or registry edit
 * accidentally marks one transparent. Id 12 is the engine's bedrock material.
 * Grass, Dirt and Stone (1, 2, 3) are locked here permanently — they are the
 * foundation of every chunk and must never inherit alpha from anything.
 */
export const OPAQUE_GROUND_BLOCKS: ReadonlySet<BlockID> = new Set<BlockID>([
  1, // grass block
  2, // dirt
  3, // stone
  12, // bedrock / obsidian foundation
]);

/**
 * Audit every registered material against the opaque-safety contract.
 *
 * Returns a list of human-readable violations; an empty result means the
 * world's ground cannot render as an X-ray surface. Run at startup in dev
 * builds and in the regression suite — cheap (one pass over the map) and it
 * pins the exact invariants the X-ray defect violated:
 *
 *  - Grass/Dirt/Stone/Bedrock are in the opaque render queue
 *    (`transparencyMode === 0`) with `alpha === 1`.
 *  - Their textures never advertise an alpha channel.
 *  - Babylon can never route them into a blend or alpha-test pass.
 */
export function auditOpaqueTerrainSafety(materials: BlockMaterialMap): string[] {
  const violations: string[] = [];
  for (const [key, material] of materials) {
    const id = (key & 0xffff) as BlockID;
    if (!OPAQUE_GROUND_BLOCKS.has(id)) continue;
    const label = `${getBlock(id).name} (variant ${key >> 16})`;
    if (material.transparencyMode !== OPAQUE_TRANSPARENCY_MODE) {
      violations.push(`${label}: transparencyMode ${material.transparencyMode} (must be 0)`);
    }
    if (material.alpha !== 1) violations.push(`${label}: alpha ${material.alpha} (must be 1)`);
    if (material.useAlphaFromDiffuseTexture) violations.push(`${label}: useAlphaFromDiffuseTexture true`);
    if (material.needAlphaBlending()) violations.push(`${label}: needAlphaBlending() true`);
    if (material.needAlphaTesting()) violations.push(`${label}: needAlphaTesting() true`);
    if (material.diffuseTexture?.hasAlpha) violations.push(`${label}: diffuseTexture.hasAlpha true`);
    if (material.disableDepthWrite) violations.push(`${label}: depth write disabled`);
  }
  return violations;
}

function emissiveFor(id: BlockID): Color3 {
  const block = getBlock(id);
  if (!block.emissive || block.lightLevel <= 0) return new Color3(0, 0, 0);
  const strength = Math.min(1, block.lightLevel / 15) * 0.55;
  const base = Color3.FromHexString(block.color);
  return new Color3(base.r * strength, base.g * strength, base.b * strength);
}

/** True when a block must use Babylon's opaque render queue. */
function isOpaqueBlock(id: BlockID): boolean {
  return OPAQUE_GROUND_BLOCKS.has(id) || !getBlock(id).transparent;
}

/**
 * Register every block and every authored face variant exactly once.
 * Air has no material because it never emits geometry.
 */
export function createBlockMaterials(
  scene: Scene,
  texturePack: TexturePackId = 'classic'
): BlockMaterialMap {
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
  const fallbackColor = Color3.FromHexString(block.color);
  const material = new StandardMaterial(`block_${safeName}_${variant}`, scene);
  const opaque = isOpaqueBlock(id);
  const texture = createBlockTexture(scene, id, variant, pack, opaque);

  material.diffuseTexture = texture;
  material.ambientTexture = texture;
  material.diffuseColor = new Color3(1, 1, 1);
  material.ambientColor = new Color3(1, 1, 1);
  material.emissiveColor = fallbackColor;
  material.specularColor = new Color3(0.04, 0.04, 0.04);
  material.specularPower = 96;
  material.backFaceCulling = true;

  if (opaque) {
    configureOpaqueMaterial(material, texture);
  } else if (block.category === 'fluid') {
    configureBlendedMaterial(material, texture);
  } else {
    configureCutoutMaterial(material, texture);
  }

  material.disableLighting = true;
  material.maxSimultaneousLights = 0;

  return material;
}

/**
 * Absolute opaque registration for terrain and every other non-transparent
 * block. The explicit alpha callbacks are intentional: Babylon otherwise
 * derives them from texture metadata, which lets a stray PNG alpha channel
 * silently move terrain into an alpha render pass.
 */
function configureOpaqueMaterial(material: StandardMaterial, texture: Texture): void {
  material.alpha = 1;
  material.transparencyMode = OPAQUE_TRANSPARENCY_MODE;
  material.useAlphaFromDiffuseTexture = false;
  material.separateCullingPass = false;
  material.disableDepthWrite = false;
  material.forceDepthWrite = true;

  texture.hasAlpha = false;
  material.needAlphaBlending = () => false;
  material.needAlphaTesting = () => false;
}

function configureBlendedMaterial(material: StandardMaterial, texture: Texture): void {
  texture.hasAlpha = true;
  material.useAlphaFromDiffuseTexture = true;
  material.alpha = 0.74;
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  material.separateCullingPass = true;
  material.forceDepthWrite = false;
  material.needAlphaBlending = () => true;
  material.needAlphaTesting = () => false;
}

function configureCutoutMaterial(material: StandardMaterial, texture: Texture): void {
  texture.hasAlpha = true;
  material.useAlphaFromDiffuseTexture = true;
  material.alpha = 1;
  material.transparencyMode = Material.MATERIAL_ALPHATEST;
  material.alphaCutOff = 0.35;
  material.backFaceCulling = false;
  material.separateCullingPass = false;
  material.forceDepthWrite = true;
  material.needAlphaBlending = () => false;
  material.needAlphaTesting = () => true;
}

function createBlockTexture(
  scene: Scene,
  id: BlockID,
  variant: number,
  pack: TexturePackId,
  opaque: boolean
): Texture {
  const source = buildBlockTexels({ id, face: faceForVariant(variant), pack });
  const texels = new Uint8Array(source.length);
  texels.set(source);

  // The uploaded buffer itself is made opaque as a second line of defence.
  // `hasAlpha = false` prevents sampling alpha, while this prevents a future
  // material flag change from exposing stale transparent texels in a PNG/pack.
  if (opaque) {
    for (let alpha = 3; alpha < texels.length; alpha += 4) texels[alpha] = OPAQUE_ALPHA_BYTE;
  }

  const texture = RawTexture.CreateRGBATexture(
    texels,
    TEXTURE_SIZE,
    TEXTURE_SIZE,
    scene,
    true,
    false,
    Texture.NEAREST_NEAREST_MIPLINEAR
  );
  texture.name = `tex_block_${id}_${variant}`;
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 4;
  texture.hasAlpha = !opaque;
  return texture;
}

/** Look up a material, falling back to the block's side face. */
export function materialForSurface(
  materials: BlockMaterialMap,
  key: SurfaceKey
): StandardMaterial | null {
  const exact = materials.get(key);
  if (exact) return exact;
  return materials.get(key & 0xffff) ?? null;
}

/** Opaque, depth-writing fallback used when a block registration is missing. */
export function createMissingBlockMaterial(scene: Scene): StandardMaterial {
  const material = new StandardMaterial('missing_block_fallback', scene);
  material.diffuseColor = new Color3(1, 0, 1);
  material.emissiveColor = new Color3(0.6, 0, 0.6);
  material.specularColor = new Color3(0, 0, 0);
  material.ambientColor = new Color3(1, 1, 1);
  material.alpha = 1;
  material.transparencyMode = 0;
  material.useAlphaFromDiffuseTexture = false;
  material.disableDepthWrite = false;
  material.forceDepthWrite = true;
  material.needAlphaBlending = () => false;
  material.needAlphaTesting = () => false;
  return material;
}

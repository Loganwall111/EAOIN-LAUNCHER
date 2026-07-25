/**
 * Procedural block material pack.
 *
 * No external asset download is required: each block gets a small nearest-neighbor
 * DynamicTexture so the sandbox has real visible surfaces immediately.
 *
 * Materials are PBR (metallic/roughness) so the procedurally textured block
 * surfaces react correctly to the scene's lighting, env reflection, and
 * fog. Texture pack support is preserved by recoloring the same procedural
 * canvas before it is uploaded as the PBR albedo texture.
 */
import {
  Color3,
  DynamicTexture,
  Material,
  PBRMaterial,
  Scene,
  Texture,
} from '@babylonjs/core';
import { BlockID, BLOCKS } from '@shared/blocks/BlockRegistry';

export type BlockMaterialMap = Map<BlockID, PBRMaterial>;

interface BlockPaletteEntry {
  base: string;
  flecks: string[];
  alpha?: number;
  emissive?: string;
  metallic?: number;
  roughness?: number;
}

const BLOCK_PALETTE: Record<BlockID, BlockPaletteEntry> = {
  1: { base: '#4f9d36', flecks: ['#66b84a', '#2f6f24', '#8ccf5f'], roughness: 0.95 },
  2: { base: '#8a5b38', flecks: ['#6e4327', '#a87347', '#5a3420'], roughness: 0.92 },
  3: { base: '#7b7f86', flecks: ['#5f6267', '#999da3', '#4e5156'], roughness: 0.88, metallic: 0.05 },
  4: { base: '#d8c27a', flecks: ['#c7ab5d', '#ead68c', '#b9984d'], roughness: 0.9 },
  5: { base: '#3175d8', flecks: ['#55a7ff', '#204e9a', '#8ed1ff'], alpha: 0.58, roughness: 0.18, metallic: 0.08 },
  6: { base: '#8b5a2b', flecks: ['#5a3518', '#b47a3c', '#2e1a0b'], roughness: 0.85 },
  7: { base: '#2f8f38', flecks: ['#51b34e', '#1d5f24', '#78d36a'], alpha: 0.88, roughness: 0.8 },
  8: { base: '#303035', flecks: ['#111114', '#4a4a52', '#222227'], roughness: 0.55, metallic: 0.35 },
  9: { base: '#77716a', flecks: ['#b89f80', '#5b5855', '#d2c0a0'], roughness: 0.82, metallic: 0.1 },
  10: { base: '#876f30', flecks: ['#f1c84c', '#4f3d16', '#dba928'], emissive: '#3a2b08', roughness: 0.6, metallic: 0.45 },
  11: { base: '#587f89', flecks: ['#57e2ff', '#21535e', '#b6f6ff'], emissive: '#073642', roughness: 0.4, metallic: 0.6 },
  12: { base: '#20152f', flecks: ['#3b2458', '#0a0711', '#5d3c85'], roughness: 0.75, metallic: 0.2 },
  13: { base: '#3b0d0d', flecks: ['#ff3030', '#751313', '#160404'], emissive: '#3d0707', roughness: 0.65, metallic: 0.25 },
  14: { base: '#5f1b16', flecks: ['#ff4d35', '#ffb347', '#2a0906'], emissive: '#66180b', roughness: 0.7, metallic: 0.18 },
  15: { base: '#3b1d63', flecks: ['#8b5cf6', '#22d3ee', '#f0abfc'], alpha: 0.88, emissive: '#24104d', roughness: 0.35, metallic: 0.4 },
  16: { base: '#63d7ff', flecks: ['#d8fbff', '#22d3ee', '#8b5cf6'], alpha: 0.82, emissive: '#08465c', roughness: 0.2, metallic: 0.55 },
  17: { base: '#9b6b31', flecks: ['#c38a42', '#5b3515', '#e2b56b'], roughness: 0.85 },
  18: { base: '#b28655', flecks: ['#5b3a1c', '#a855f7', '#22d3ee'], emissive: '#271338', roughness: 0.5, metallic: 0.5 },
  19: { base: '#243b53', flecks: ['#38bdf8', '#facc15', '#111827'], emissive: '#0a3a56', roughness: 0.4, metallic: 0.6 },
  20: { base: '#7c4a21', flecks: ['#4a2a12', '#c0844d', '#201006'], alpha: 0.92, roughness: 0.7 },
  21: { base: '#2f1b68', flecks: ['#a855f7', '#22d3ee', '#f0abfc'], alpha: 0.86, emissive: '#2b145e', roughness: 0.3, metallic: 0.5 },
  22: { base: '#d7dde8', flecks: ['#ef4444', '#64748b', '#f8fafc'], emissive: '#2b0707', roughness: 0.45, metallic: 0.55 },
  23: { base: '#8e99a8', flecks: ['#cbd5e1', '#64748b', '#475569'], roughness: 0.55, metallic: 0.4 },
};

export function createBlockMaterials(scene: Scene, texturePack: 'classic' | 'soft' | 'vibrant' | 'noir' = 'classic'): BlockMaterialMap {
  const materials: BlockMaterialMap = new Map();

  for (const block of Object.values(BLOCKS)) {
    if (block.id === 0) continue;
    const entry = applyTexturePack(BLOCK_PALETTE[block.id] ?? BLOCK_PALETTE[3], texturePack);
    const material = new PBRMaterial(`block_${block.name.toLowerCase().replace(/\s+/g, '_')}`, scene);
    const texture = createBlockTexture(scene, block.id, entry);

    // PBR albedo — color * texture. We keep a base color even when the texture
    // is the dominant signal so transparent/emissive blocks still tint
    // correctly under different lighting.
    material.albedoTexture = texture;
    material.albedoColor = Color3.FromHexString(entry.base);
    material.backFaceCulling = false;

    // PBR surface parameters. Defaults come from the palette so stone feels
    // rougher than glass-like or ore blocks, and emissive blocks stay lit in
    // dark rooms. roughness stays within (0, 1) for valid PBR.
    material.roughness = clamp01(entry.roughness ?? 0.85);
    material.metallic = clamp01(entry.metallic ?? 0);

    if (entry.alpha !== undefined) {
      material.alpha = clamp01(entry.alpha);
      material.useAlphaFromAlbedoTexture = true;
      material.transparencyMode = Material.MATERIAL_ALPHABLEND;
      material.needDepthPrePass = true;
    }

    if (entry.emissive) {
      material.emissiveColor = Color3.FromHexString(entry.emissive);
    } else {
      material.emissiveColor = new Color3(0, 0, 0);
    }

    // Keep PBR materials cheap enough to render at chunk-streaming rates.
    // The default scene does not provide a baked IBL probe, so we lean on
    // direct lighting only and let albedo + emissive carry the look.
    material.environmentIntensity = 0;
    material.disableLighting = false;

    materials.set(block.id, material);
  }

  return materials;
}

function applyTexturePack(entry: BlockPaletteEntry, pack: 'classic' | 'soft' | 'vibrant' | 'noir'): BlockPaletteEntry {
  if (pack === 'classic') return entry;
  if (pack === 'soft') return { ...entry, base: lighten(entry.base, 18), flecks: entry.flecks.map((color) => lighten(color, 14)) };
  if (pack === 'vibrant') return { ...entry, base: saturate(entry.base, 1.22), flecks: entry.flecks.map((color) => saturate(color, 1.28)) };
  return { ...entry, base: grayscale(entry.base), flecks: entry.flecks.map(grayscale) };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function createBlockTexture(scene: Scene, blockId: BlockID, entry: BlockPaletteEntry): DynamicTexture {
  const size = 64;
  const texture = new DynamicTexture(`tex_block_${blockId}`, { width: size, height: size }, scene, false);
  texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
  texture.hasAlpha = entry.alpha !== undefined;

  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = entry.base;
  ctx.fillRect(0, 0, size, size);

  drawBlockPattern(ctx, blockId, entry, size);
  texture.update(false);
  return texture;
}

function drawBlockPattern(
  ctx: CanvasRenderingContext2D,
  blockId: BlockID,
  entry: BlockPaletteEntry,
  size: number
): void {
  const rand = seededRandom(blockId * 7919);

  for (let i = 0; i < 90; i += 1) {
    const fleck = entry.flecks[Math.floor(rand() * entry.flecks.length)] ?? entry.base;
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    const w = 1 + Math.floor(rand() * 5);
    const h = 1 + Math.floor(rand() * 5);
    ctx.fillStyle = withAlpha(fleck, entry.alpha ?? 1);
    ctx.fillRect(x, y, w, h);
  }

  if (blockId === 1) drawGrassBlades(ctx, entry, size, rand);
  if (blockId === 3 || blockId === 12) drawCracks(ctx, entry, size, rand);
  if (blockId === 5) drawWaterLines(ctx, size);
  if (blockId === 6 || blockId === 17) drawWoodRings(ctx, size);
  if ([8, 9, 10, 11, 13, 14, 15, 16, 18, 19, 21, 22, 23].includes(blockId)) drawOreSpeckles(ctx, entry, size, rand);
}

function drawGrassBlades(
  ctx: CanvasRenderingContext2D,
  entry: BlockPaletteEntry,
  size: number,
  rand: () => number
): void {
  for (let i = 0; i < 35; i += 1) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    ctx.strokeStyle = entry.flecks[i % entry.flecks.length] ?? '#66b84a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x + Math.floor(rand() * 3) - 1, y);
    ctx.stroke();
  }
}

function drawCracks(
  ctx: CanvasRenderingContext2D,
  entry: BlockPaletteEntry,
  size: number,
  rand: () => number
): void {
  ctx.strokeStyle = entry.flecks[2] ?? '#4e5156';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    let x = Math.floor(rand() * size);
    let y = Math.floor(rand() * size);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let segment = 0; segment < 3; segment += 1) {
      x += Math.floor(rand() * 15) - 7;
      y += Math.floor(rand() * 15) - 7;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawWaterLines(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = '#a5ddff';
  ctx.lineWidth = 2;
  for (let y = 8; y < size; y += 14) {
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const waveY = y + Math.sin(x * 0.35) * 3;
      if (x === 0) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawWoodRings(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.strokeStyle = '#3f240f';
  ctx.lineWidth = 3;
  for (let x = 8; x < size; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 6, 14, x - 6, 34, x + 4, size);
    ctx.stroke();
  }
}

function drawOreSpeckles(
  ctx: CanvasRenderingContext2D,
  entry: BlockPaletteEntry,
  size: number,
  rand: () => number
): void {
  for (let i = 0; i < 18; i += 1) {
    const color = entry.flecks[i % entry.flecks.length] ?? entry.base;
    const x = Math.floor(rand() * (size - 8));
    const y = Math.floor(rand() * (size - 8));
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 3 + Math.floor(rand() * 6), 3 + Math.floor(rand() * 6));
  }
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function withAlpha(hex: string, alpha: number): string {
  if (alpha >= 1) return hex;
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lighten(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  return toHex(r + amount, g + amount, b + amount);
}

function saturate(hex: string, multiplier: number): string {
  const { r, g, b } = parseHex(hex);
  const avg = (r + g + b) / 3;
  return toHex(avg + (r - avg) * multiplier, avg + (g - avg) * multiplier, avg + (b - avg) * multiplier);
}

function grayscale(hex: string): string {
  const { r, g, b } = parseHex(hex);
  const y = r * 0.299 + g * 0.587 + b * 0.114;
  return toHex(y, y, y);
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  const part = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

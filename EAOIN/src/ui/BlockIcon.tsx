/**
 * BlockIcon — the one true block/item icon for every panel in the UI.
 *
 * ## What was wrong
 *
 * There were two different icon renderers and neither drew the block's actual
 * texture:
 *
 *   - `HUD.BlockLogo` built a "3D bevelled cube" out of two CSS `clip-path`
 *     polygons filled with `block.color` and `block.accentColor`.
 *   - `HudFrame.HotbarBlockCube` built a *different* CSS cube from the same
 *     two colours.
 *
 * So every block in the inventory was a flat coloured lozenge — "the blocks in
 * the inventory are complete squares all over the place, in real Minecraft
 * blocks actually have actual textures". Swords and tools got the same cube
 * treatment, which is why "the weapons in the game are blocks".
 *
 * ## What it does now
 *
 * Rasterises the **same procedural texture the world renderer uses** onto a
 * canvas:
 *
 *   - **Blocks** are drawn as an isometric cube — top face, left face, right
 *     face — each with the real texture for that side and the correct face
 *     shading. This is exactly how Minecraft renders inventory blocks.
 *   - **Tools, weapons and plants** are drawn flat, as their item sprite, with
 *     transparency preserved.
 *
 * Rendering happens once per (id, size) into a cached data URL, so a 300-slot
 * creative page costs 300 tiny canvas paints on first open and nothing after.
 */
import { useMemo } from 'react';
import { BlockID, getBlock } from '@shared/blocks/BlockRegistry';
import {
  buildBlockTexels,
  BlockFace,
  isItemSprite,
  TEXTURE_SIZE,
} from '../rendering/BlockTextureSource';

/** Cache of rendered icons, keyed by `${id}:${size}`. */
const ICON_CACHE = new Map<string, string>();

/** Face brightness, matching the world renderer's lighting. */
const FACE_SHADE: Record<BlockFace, number> = {
  top: 1.0,
  side: 0.82,
  bottom: 0.62,
};

function texelAt(texels: Uint8ClampedArray, x: number, y: number): [number, number, number, number] {
  const cx = Math.max(0, Math.min(TEXTURE_SIZE - 1, x));
  const cy = Math.max(0, Math.min(TEXTURE_SIZE - 1, y));
  const i = (cy * TEXTURE_SIZE + cx) * 4;
  return [texels[i], texels[i + 1], texels[i + 2], texels[i + 3]];
}

/**
 * Draw an isometric cube by mapping each output pixel back into one of the
 * three visible faces.
 *
 * Software-rasterised rather than done with CSS transforms so the pixel art
 * stays crisp and identical to the in-world texture — CSS 3D would resample
 * it with bilinear filtering and turn 16×16 art into mush.
 */
function renderCube(ctx: CanvasRenderingContext2D, id: BlockID, size: number): void {
  const top = buildBlockTexels({ id, face: 'top' });
  const left = buildBlockTexels({ id, face: 'side' });
  const right = buildBlockTexels({ id, face: 'side' });

  const image = ctx.createImageData(size, size);
  const half = size / 2;
  // Isometric proportions: the cube's top diamond is half as tall as wide.
  const quarter = size / 4;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      // Position relative to the centre of the top face's diamond.
      const dx = (px + 0.5 - half) / half;
      const dy = (py + 0.5 - quarter) / quarter;

      let face: BlockFace | null = null;
      let u = 0;
      let v = 0;

      // Top diamond: |dx| + |dy| <= 1 in the upper half.
      if (Math.abs(dx) + Math.abs(dy) <= 1 && py < size * 0.5) {
        face = 'top';
        u = (dx + dy + 1) / 2;
        v = (dy - dx + 1) / 2;
      } else {
        // Side walls occupy the lower two thirds, split down the middle.
        const wallTop = quarter + Math.abs(px + 0.5 - half) * 0.5;
        const wallBottom = size * 0.98;
        if (py >= wallTop && py <= wallBottom) {
          if (px < half) {
            face = 'side';
            u = px / half;
            v = (py - wallTop) / (wallBottom - wallTop);
          } else {
            face = 'side';
            u = (px - half) / half;
            v = (py - wallTop) / (wallBottom - wallTop);
          }
        }
      }

      const out = (py * size + px) * 4;
      if (!face) { image.data[out + 3] = 0; continue; }

      const texels = face === 'top' ? top : px < half ? left : right;
      const [r, g, b, a] = texelAt(
        texels,
        Math.floor(u * TEXTURE_SIZE),
        Math.floor(v * TEXTURE_SIZE)
      );
      if (a === 0) { image.data[out + 3] = 0; continue; }

      // Shade the two side walls differently so the cube reads as 3D.
      const shade = face === 'top'
        ? FACE_SHADE.top
        : px < half ? FACE_SHADE.side : FACE_SHADE.side * 0.78;

      image.data[out] = r * shade;
      image.data[out + 1] = g * shade;
      image.data[out + 2] = b * shade;
      image.data[out + 3] = a;
    }
  }

  ctx.putImageData(image, 0, 0);
}

/** Draw a flat item sprite, nearest-neighbour upscaled. */
function renderSprite(ctx: CanvasRenderingContext2D, id: BlockID, size: number): void {
  const texels = buildBlockTexels({ id, face: 'side' });
  const image = ctx.createImageData(size, size);
  const scale = TEXTURE_SIZE / size;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const [r, g, b, a] = texelAt(texels, Math.floor(px * scale), Math.floor(py * scale));
      const out = (py * size + px) * 4;
      image.data[out] = r;
      image.data[out + 1] = g;
      image.data[out + 2] = b;
      image.data[out + 3] = a;
    }
  }

  ctx.putImageData(image, 0, 0);
}

/**
 * Render a block/item icon to a data URL.
 *
 * Returns an empty string when there is no canvas support (jsdom in tests),
 * so callers must handle that and fall back to a coloured tile.
 */
export function blockIconDataUrl(id: BlockID, size = 32): string {
  const key = `${id}:${size}`;
  const cached = ICON_CACHE.get(key);
  if (cached !== undefined) return cached;

  let url = '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      if (isItemSprite(id)) renderSprite(ctx, id, size);
      else renderCube(ctx, id, size);
      url = canvas.toDataURL();
    }
  } catch {
    // jsdom has no canvas; the caller falls back to a solid colour tile.
    url = '';
  }

  ICON_CACHE.set(key, url);
  return url;
}

export interface BlockIconProps {
  id: BlockID;
  /** Rendered pixel size. Defaults to 32. */
  size?: number;
  className?: string;
}

/**
 * The block/item icon component. Drop-in replacement for the old
 * `BlockLogo` / `HotbarBlockCube`.
 */
export default function BlockIcon({ id, size = 32, className }: BlockIconProps) {
  const block = getBlock(id);
  const url = useMemo(() => blockIconDataUrl(id, size), [id, size]);

  if (!url) {
    // Test/no-canvas fallback: a plain tile in the block's colour.
    return (
      <span
        className={`block-icon fallback ${className ?? ''}`}
        style={{ width: size, height: size, background: block.color, display: 'inline-block' }}
        title={block.name}
        aria-label={block.name}
      />
    );
  }

  return (
    <img
      className={`block-icon ${className ?? ''}`}
      src={url}
      width={size}
      height={size}
      alt={block.name}
      title={block.name}
      draggable={false}
      // Nearest-neighbour on the way to the screen keeps the pixels sharp.
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

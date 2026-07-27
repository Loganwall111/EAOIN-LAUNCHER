/**
 * BlockTextureSource — one procedural pixel-art texture generator for every
 * block, shared by the world renderer, the inventory, the hotbar and the
 * first-person held item.
 *
 * ## Why this exists
 *
 * Before this module there were three unrelated "block looks" in the game:
 *
 *   1. `BlockMaterials` drew a Babylon `DynamicTexture` with random flecks.
 *   2. `HUD.BlockLogo` drew a flat CSS `clip-path` cube from `block.color`.
 *   3. `HudFrame.HotbarBlockCube` drew *another* CSS cube from the same colour.
 *
 * So a block was a detailed surface in the world and a plain coloured square
 * in the inventory — the reported "blocks in the inventory are complete
 * squares" bug. Every consumer now rasterises the *same* function, so an oak
 * log in your hand, in the hotbar and in the ground are pixel-identical.
 *
 * ## Design
 *
 * - Pure: no Babylon, no DOM at module scope. Output is a plain `Uint8ClampedArray`
 *   of RGBA texels, so it runs in Node tests and in the browser.
 * - Deterministic: the pattern for a block id never changes between runs, so
 *   textures can be cached and compared in tests.
 * - Per-face: `top`, `side` and `bottom` variants, which is what makes grass
 *   read as grass (green top, dirt bottom, banded side) instead of a green cube.
 * - 16×16 like real Minecraft, upscaled by the consumer with nearest-neighbour
 *   filtering. 16×16 also means the whole 300-block atlas is ~300 KB.
 */
import { BlockID, getBlock, BlockCategory } from '@shared/blocks/BlockRegistry';

/** Native texel resolution. Minecraft-authentic and cheap to generate. */
export const TEXTURE_SIZE = 16;

export type BlockFace = 'top' | 'side' | 'bottom';

/** RGBA texel buffer, `TEXTURE_SIZE * TEXTURE_SIZE * 4` bytes long. */
export type TexelBuffer = Uint8ClampedArray;

/**
 * The visual archetype a block is drawn as. Derived once from the registry so
 * ~300 blocks get sensible art without 300 hand-written entries.
 */
export type TextureArchetype =
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'cobble'
  | 'sand'
  | 'log'
  | 'planks'
  | 'leaves'
  | 'ore'
  | 'gem'
  | 'metal'
  | 'fluid'
  | 'glass'
  | 'brick'
  | 'crystal'
  | 'organic'
  | 'machine'
  | 'portal'
  | 'tool'
  | 'plant'
  | 'plain';

interface Rgb { r: number; g: number; b: number; }

/* ------------------------------------------------------------------ *
 * colour helpers
 * ------------------------------------------------------------------ */

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0');
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function shade(color: Rgb, amount: number): Rgb {
  // amount > 0 lightens toward white, < 0 darkens toward black.
  if (amount >= 0) {
    return {
      r: color.r + (255 - color.r) * amount,
      g: color.g + (255 - color.g) * amount,
      b: color.b + (255 - color.b) * amount,
    };
  }
  const k = 1 + amount;
  return { r: color.r * k, g: color.g * k, b: color.b * k };
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

/* ------------------------------------------------------------------ *
 * deterministic value noise
 * ------------------------------------------------------------------ */

/** Integer hash → [0, 1). Stable across platforms (no Math.random). */
function hash2(x: number, y: number, salt: number): number {
  let h = x * 374761393 + y * 668265263 + salt * 2246822519;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  // Parenthesised deliberately: `a >>> 0 / b` parses as `a >>> (0 / b)`, which
  // silently returns the raw 32-bit integer instead of a 0..1 fraction.
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Same as `hash2`, clamped strictly below 1 so `Math.floor(r * n) < n`. */
function rand(x: number, y: number, salt: number): number {
  const v = hash2(x, y, salt);
  return v >= 1 ? 0.9999999 : v;
}

/** Smooth-ish 2-octave value noise, used for mottling and veins. */
function noise2(x: number, y: number, salt: number, scale: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const a = rand(x0, y0, salt);
  const b = rand(x0 + 1, y0, salt);
  const c = rand(x0, y0 + 1, salt);
  const d = rand(x0 + 1, y0 + 1, salt);
  const u = smooth(fx);
  const v = smooth(fy);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/* ------------------------------------------------------------------ *
 * archetype classification
 * ------------------------------------------------------------------ */

/** Explicit overrides for the blocks whose look really matters. */
const ARCHETYPE_OVERRIDES: Record<number, TextureArchetype> = {
  1: 'grass',
  2: 'dirt',
  3: 'stone',
  4: 'sand',
  5: 'fluid',
  6: 'log',
  7: 'leaves',
  8: 'ore', 9: 'ore', 10: 'ore', 11: 'gem',
  12: 'stone',
  13: 'machine', 14: 'machine',
  15: 'portal',
  16: 'crystal',
  17: 'planks',
  18: 'machine', 19: 'machine',
  20: 'planks', 21: 'portal', 22: 'metal', 23: 'stone',
  24: 'cobble', 25: 'cobble',
  26: 'stone', 27: 'stone', 28: 'stone', 29: 'stone',
  30: 'ore', 31: 'ore', 32: 'gem', 33: 'ore',
  34: 'brick', 35: 'brick', 36: 'brick', 37: 'brick',
  38: 'sand', 39: 'sand',
  40: 'stone', 41: 'stone', 42: 'stone', 43: 'stone',
  44: 'organic', 45: 'sand', 46: 'dirt', 47: 'stone', 48: 'stone',
  49: 'crystal',
  50: 'log', 51: 'log', 52: 'log',
  89: 'plain',
  104: 'leaves',
  105: 'dirt',
  108: 'organic',
  219: 'crystal',
  220: 'glass', 221: 'glass',
  227: 'fluid',
  275: 'dirt', 276: 'dirt', 279: 'dirt',
};

/** Category → archetype fallback so unnamed blocks still get real art. */
const CATEGORY_ARCHETYPE: Record<BlockCategory, TextureArchetype> = {
  building: 'stone',
  decoration: 'planks',
  functional: 'machine',
  redstone: 'machine',
  plant: 'plant',
  food: 'organic',
  tool: 'tool',
  weapon: 'tool',
  armor: 'metal',
  ore: 'ore',
  fluid: 'fluid',
  nature: 'organic',
  nether: 'organic',
  end: 'crystal',
  space: 'metal',
  creative: 'machine',
  spawn_egg: 'organic',
  misc: 'plain',
};

export function archetypeFor(id: BlockID): TextureArchetype {
  const override = ARCHETYPE_OVERRIDES[id];
  if (override) return override;
  const block = getBlock(id);
  const name = block.name.toLowerCase();
  // Name-driven detection catches the long tail: "Spruce Planks", "Iron Ore"…
  if (name.includes('leaves') || name.includes('petal')) return 'leaves';
  if (name.includes('log') || name.includes('stem') || name.includes('wood')) return 'log';
  if (name.includes('planks')) return 'planks';
  if (name.includes('cobble') || name.includes('gravel')) return 'cobble';
  if (name.includes('brick') || name.includes('tile')) return 'brick';
  if (name.includes('ore')) return 'ore';
  if (name.includes('glass') || name.includes('ice')) return 'glass';
  if (name.includes('sand')) return 'sand';
  if (name.includes('dirt') || name.includes('soil') || name.includes('mud')) return 'dirt';
  if (name.includes('grass') || name.includes('moss') || name.includes('mycelium')) return 'grass';
  if (name.includes('crystal') || name.includes('amethyst') || name.includes('glow')) return 'crystal';
  if (name.includes('sword') || name.includes('pickaxe') || name.includes('axe') || name.includes('shovel') || name.includes('hoe')) return 'tool';
  if (block.transparent && block.category === 'fluid') return 'fluid';
  return CATEGORY_ARCHETYPE[block.category] ?? 'plain';
}

/* ------------------------------------------------------------------ *
 * texture painting
 * ------------------------------------------------------------------ */

class Painter {
  readonly data: TexelBuffer;

  constructor(private readonly size: number, base: Rgb, alpha: number) {
    this.data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i += 1) {
      this.data[i * 4] = base.r;
      this.data[i * 4 + 1] = base.g;
      this.data[i * 4 + 2] = base.b;
      this.data[i * 4 + 3] = alpha * 255;
    }
  }

  set(x: number, y: number, color: Rgb, alpha = 1): void {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    const i = (y * this.size + x) * 4;
    this.data[i] = color.r;
    this.data[i + 1] = color.g;
    this.data[i + 2] = color.b;
    this.data[i + 3] = alpha * 255;
  }

  get(x: number, y: number): Rgb {
    const i = (y * this.size + x) * 4;
    return { r: this.data[i], g: this.data[i + 1], b: this.data[i + 2] };
  }

  clearAlpha(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    this.data[(y * this.size + x) * 4 + 3] = 0;
  }
}

export interface TextureRequest {
  id: BlockID;
  face: BlockFace;
  /** Recolour pass applied by the active texture pack. */
  pack?: 'classic' | 'soft' | 'vibrant' | 'noir';
}

/**
 * Rasterise one block face into RGBA texels.
 *
 * The result is cached, so calling this per inventory slot per render is free
 * after the first paint.
 */
export function buildBlockTexels(request: TextureRequest): TexelBuffer {
  const pack = request.pack ?? 'classic';
  const cacheKey = `${request.id}:${request.face}:${pack}`;
  const cached = TEXEL_CACHE.get(cacheKey);
  if (cached) return cached;

  const block = getBlock(request.id);
  const archetype = archetypeFor(request.id);
  let base = hexToRgb(block.color);
  let accent = hexToRgb(block.accentColor ?? block.color);
  ({ base, accent } = applyPack(base, accent, pack));

  const alpha = block.transparent && block.category === 'fluid' ? 0.72 : 1;
  const painter = new Painter(TEXTURE_SIZE, base, alpha);
  paintArchetype(painter, archetype, request.id, request.face, base, accent);

  TEXEL_CACHE.set(cacheKey, painter.data);
  return painter.data;
}

const TEXEL_CACHE = new Map<string, TexelBuffer>();

/** Drops every cached texture. Called when the texture pack changes. */
export function clearTextureCache(): void {
  TEXEL_CACHE.clear();
}

function applyPack(base: Rgb, accent: Rgb, pack: 'classic' | 'soft' | 'vibrant' | 'noir'): { base: Rgb; accent: Rgb } {
  if (pack === 'classic') return { base, accent };
  if (pack === 'soft') return { base: shade(base, 0.16), accent: shade(accent, 0.12) };
  if (pack === 'vibrant') return { base: saturate(base, 1.28), accent: saturate(accent, 1.34) };
  return { base: desaturate(base), accent: desaturate(accent) };
}

function saturate(color: Rgb, factor: number): Rgb {
  const grey = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
  return {
    r: grey + (color.r - grey) * factor,
    g: grey + (color.g - grey) * factor,
    b: grey + (color.b - grey) * factor,
  };
}

function desaturate(color: Rgb): Rgb {
  const grey = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
  return { r: grey, g: grey, b: grey };
}

function paintArchetype(
  p: Painter,
  archetype: TextureArchetype,
  id: BlockID,
  face: BlockFace,
  base: Rgb,
  accent: Rgb
): void {
  const S = TEXTURE_SIZE;
  const salt = id * 977 + 13;

  // Every archetype starts from a mottled base so nothing is a flat square.
  const mottle = (strength: number, scale = 3.2) => {
    for (let y = 0; y < S; y += 1) {
      for (let x = 0; x < S; x += 1) {
        const n = noise2(x, y, salt, scale) - 0.5;
        p.set(x, y, shade(p.get(x, y), n * strength), alphaAt(p, x, y));
      }
    }
  };

  switch (archetype) {
    case 'grass': {
      if (face === 'bottom') { paintArchetype(p, 'dirt', id, 'side', hexToRgb('#8a5a36'), hexToRgb('#5b3a1c')); return; }
      if (face === 'top') {
        mottle(0.38, 2.4);
        // Scattered brighter blades so the top reads as grass from above.
        for (let i = 0; i < 26; i += 1) {
          const x = Math.floor(rand(i, 1, salt) * S);
          const y = Math.floor(rand(i, 2, salt) * S);
          p.set(x, y, shade(base, 0.22));
        }
        return;
      }
      // Side: dirt body with a green crown and a ragged transition line.
      const dirt = hexToRgb('#8a5a36');
      for (let y = 0; y < S; y += 1) {
        for (let x = 0; x < S; x += 1) {
          const crown = 3 + Math.floor(noise2(x, 0, salt, 2.6) * 2.4);
          const color = y <= crown ? base : dirt;
          const n = noise2(x, y, salt + 5, 2.8) - 0.5;
          p.set(x, y, shade(color, n * 0.34));
        }
      }
      return;
    }

    case 'dirt': {
      mottle(0.42, 2.2);
      for (let i = 0; i < 12; i += 1) {
        const x = Math.floor(rand(i, 3, salt) * S);
        const y = Math.floor(rand(i, 4, salt) * S);
        p.set(x, y, shade(accent, -0.18));
      }
      return;
    }

    case 'stone': {
      mottle(0.3, 3.6);
      // A couple of soft crack lines, which is what sells stone at 16px.
      for (let c = 0; c < 3; c += 1) {
        let x = Math.floor(rand(c, 7, salt) * S);
        let y = Math.floor(rand(c, 8, salt) * S);
        const steps = 5 + Math.floor(rand(c, 9, salt) * 5);
        for (let s = 0; s < steps; s += 1) {
          p.set(x, y, shade(base, -0.26));
          x += rand(c, s + 10, salt) > 0.5 ? 1 : -1;
          y += rand(c, s + 20, salt) > 0.45 ? 1 : 0;
          if (x < 0 || x >= S || y >= S) break;
        }
      }
      return;
    }

    case 'cobble': {
      // Rounded stones on a dark mortar bed.
      for (let y = 0; y < S; y += 1) for (let x = 0; x < S; x += 1) p.set(x, y, shade(base, -0.4));
      const cells = 4;
      const step = S / cells;
      for (let cy = 0; cy < cells; cy += 1) {
        for (let cx = 0; cx < cells; cx += 1) {
          const jitterX = Math.floor(rand(cx, cy, salt) * 2) - 1;
          const jitterY = Math.floor(rand(cx, cy, salt + 1) * 2) - 1;
          const tone = shade(base, (rand(cx, cy, salt + 2) - 0.45) * 0.34);
          for (let y = 1; y < step; y += 1) {
            for (let x = 1; x < step; x += 1) {
              p.set(cx * step + x + jitterX, cy * step + y + jitterY, tone);
            }
          }
        }
      }
      return;
    }

    case 'sand': {
      mottle(0.22, 1.8);
      for (let i = 0; i < 22; i += 1) {
        const x = Math.floor(rand(i, 11, salt) * S);
        const y = Math.floor(rand(i, 12, salt) * S);
        p.set(x, y, shade(base, 0.16));
      }
      return;
    }

    case 'log': {
      if (face === 'top' || face === 'bottom') {
        // End grain: concentric rings around the centre.
        const c = (S - 1) / 2;
        for (let y = 0; y < S; y += 1) {
          for (let x = 0; x < S; x += 1) {
            const d = Math.hypot(x - c, y - c);
            const ring = Math.sin(d * 1.9) * 0.5 + 0.5;
            p.set(x, y, mix(accent, shade(base, 0.14), ring));
          }
        }
        return;
      }
      // Bark: vertical fibres.
      for (let y = 0; y < S; y += 1) {
        for (let x = 0; x < S; x += 1) {
          const fibre = noise2(x * 3, y * 0.35, salt, 2.1);
          p.set(x, y, mix(shade(base, -0.22), shade(base, 0.12), fibre));
        }
      }
      for (let i = 0; i < 5; i += 1) {
        const x = Math.floor(rand(i, 13, salt) * S);
        for (let y = 0; y < S; y += 1) p.set(x, y, shade(accent, -0.2));
      }
      return;
    }

    case 'planks': {
      const plankHeight = 4;
      for (let y = 0; y < S; y += 1) {
        const row = Math.floor(y / plankHeight);
        const tone = shade(base, (rand(row, 0, salt) - 0.5) * 0.2);
        for (let x = 0; x < S; x += 1) {
          const grain = noise2(x * 2.4, y, salt + row, 3) - 0.5;
          p.set(x, y, shade(tone, grain * 0.2));
        }
        if (y % plankHeight === 0) for (let x = 0; x < S; x += 1) p.set(x, y, shade(base, -0.42));
      }
      // Nail/seam marks so planks are not just stripes.
      for (let row = 0; row < S / plankHeight; row += 1) {
        const x = 2 + Math.floor(rand(row, 21, salt) * (S - 4));
        p.set(x, row * plankHeight + 2, shade(accent, -0.35));
      }
      return;
    }

    case 'leaves': {
      // Clustered foliage with real holes punched through, so canopies read as
      // leaves and light filters between them instead of forming a solid block.
      for (let y = 0; y < S; y += 1) {
        for (let x = 0; x < S; x += 1) {
          const n = noise2(x, y, salt, 1.9);
          const tone = mix(shade(base, -0.28), shade(base, 0.2), n);
          p.set(x, y, tone);
          if (n < 0.24) p.clearAlpha(x, y);
        }
      }
      for (let i = 0; i < 10; i += 1) {
        const x = Math.floor(rand(i, 31, salt) * S);
        const y = Math.floor(rand(i, 32, salt) * S);
        p.set(x, y, shade(accent, -0.24));
      }
      return;
    }

    case 'ore':
    case 'gem': {
      // Stone matrix first, then the ore blobs on top.
      const stone = hexToRgb('#7f7f84');
      for (let y = 0; y < S; y += 1) {
        for (let x = 0; x < S; x += 1) {
          const n = noise2(x, y, salt + 3, 3.4) - 0.5;
          p.set(x, y, shade(stone, n * 0.3));
        }
      }
      const blobs = archetype === 'gem' ? 4 : 5;
      for (let i = 0; i < blobs; i += 1) {
        const bx = 2 + Math.floor(rand(i, 41, salt) * (S - 4));
        const by = 2 + Math.floor(rand(i, 42, salt) * (S - 4));
        const r = archetype === 'gem' ? 1.6 : 1.3 + rand(i, 43, salt);
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            if (Math.hypot(dx, dy) > r) continue;
            const edge = Math.hypot(dx, dy) > r - 0.8;
            p.set(bx + dx, by + dy, edge ? shade(base, -0.24) : base);
          }
        }
        // Specular pip — this is what makes diamond/gold read as valuable.
        p.set(bx, by - 1, shade(base, 0.45));
      }
      return;
    }

    case 'metal': {
      for (let y = 0; y < S; y += 1) {
        for (let x = 0; x < S; x += 1) {
          const brushed = noise2(x * 0.6, y * 4, salt, 2.6) - 0.5;
          p.set(x, y, shade(base, brushed * 0.26));
        }
      }
      // Panel border + rivets.
      for (let i = 0; i < S; i += 1) {
        p.set(i, 0, shade(base, 0.24));
        p.set(0, i, shade(base, 0.18));
        p.set(i, S - 1, shade(base, -0.3));
        p.set(S - 1, i, shade(base, -0.24));
      }
      for (const [x, y] of [[2, 2], [S - 3, 2], [2, S - 3], [S - 3, S - 3]]) {
        p.set(x, y, shade(accent, 0.3));
      }
      return;
    }

    case 'fluid': {
      // Horizontal wave bands with a slow vertical offset per row.
      for (let y = 0; y < S; y += 1) {
        for (let x = 0; x < S; x += 1) {
          const wave = Math.sin((x + y * 0.6) * 0.8) * 0.5 + 0.5;
          const n = noise2(x, y, salt, 2.6);
          p.set(x, y, mix(shade(base, -0.16), shade(base, 0.22), wave * 0.6 + n * 0.4), 0.72);
        }
      }
      for (let i = 0; i < 6; i += 1) {
        const x = Math.floor(rand(i, 51, salt) * S);
        const y = Math.floor(rand(i, 52, salt) * S);
        p.set(x, y, shade(base, 0.5), 0.8);
      }
      return;
    }

    case 'glass': {
      for (let y = 0; y < S; y += 1) {
        for (let x = 0; x < S; x += 1) {
          const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1;
          p.set(x, y, edge ? shade(base, 0.3) : base, edge ? 0.85 : 0.3);
        }
      }
      // Diagonal highlight streak.
      for (let i = 2; i < S - 4; i += 1) p.set(i, i - 1, shade(base, 0.6), 0.7);
      return;
    }

    case 'brick': {
      const mortar = shade(base, -0.4);
      const rowHeight = 4;
      for (let y = 0; y < S; y += 1) {
        const row = Math.floor(y / rowHeight);
        const offset = row % 2 === 0 ? 0 : 4;
        for (let x = 0; x < S; x += 1) {
          const inMortarRow = y % rowHeight === 0;
          const inMortarCol = (x + offset) % 8 === 0;
          if (inMortarRow || inMortarCol) { p.set(x, y, mortar); continue; }
          const tone = shade(base, (rand(Math.floor((x + offset) / 8), row, salt) - 0.5) * 0.22);
          p.set(x, y, tone);
        }
      }
      return;
    }

    case 'crystal': {
      // Faceted shards radiating from the centre + emissive core.
      const c = (S - 1) / 2;
      for (let y = 0; y < S; y += 1) {
        for (let x = 0; x < S; x += 1) {
          const angle = Math.atan2(y - c, x - c);
          const facet = Math.abs(Math.sin(angle * 3)) * 0.5 + 0.25;
          const d = Math.hypot(x - c, y - c) / c;
          p.set(x, y, shade(mix(base, accent, facet), (1 - d) * 0.4 - 0.12));
        }
      }
      p.set(Math.round(c), Math.round(c), shade(base, 0.7));
      return;
    }

    case 'organic': {
      mottle(0.5, 2.0);
      for (let i = 0; i < 16; i += 1) {
        const x = Math.floor(rand(i, 61, salt) * S);
        const y = Math.floor(rand(i, 62, salt) * S);
        p.set(x, y, shade(accent, -0.22));
        p.set(x + 1, y, shade(accent, -0.12));
      }
      return;
    }

    case 'machine': {
      // Casing + a lit control face, which is what a command block should be.
      for (let y = 0; y < S; y += 1) {
        for (let x = 0; x < S; x += 1) {
          const border = x < 2 || y < 2 || x > S - 3 || y > S - 3;
          p.set(x, y, border ? shade(base, -0.3) : shade(base, 0.05));
        }
      }
      for (let y = 4; y < S - 4; y += 1) {
        for (let x = 4; x < S - 4; x += 1) {
          const lit = (x + y) % 3 === 0;
          p.set(x, y, lit ? shade(accent, 0.42) : shade(accent, -0.15));
        }
      }
      return;
    }

    case 'portal': {
      // Swirling energy — the see-through portal look the player likes kept.
      const c = (S - 1) / 2;
      for (let y = 0; y < S; y += 1) {
        for (let x = 0; x < S; x += 1) {
          const d = Math.hypot(x - c, y - c) / c;
          const swirl = Math.sin(d * 6 + Math.atan2(y - c, x - c) * 2) * 0.5 + 0.5;
          p.set(x, y, mix(shade(base, -0.3), shade(accent, 0.5), swirl), 0.82);
        }
      }
      return;
    }

    case 'tool': {
      // Items are drawn as an actual item sprite on transparent background —
      // a sword must not be a cube in the hotbar.
      for (let y = 0; y < S; y += 1) for (let x = 0; x < S; x += 1) p.clearAlpha(x, y);
      const handle = hexToRgb('#6b4423');
      const name = getBlock(id).name.toLowerCase();
      const isSword = name.includes('sword') || name.includes('blade') || name.includes('dagger');
      // Diagonal handle bottom-left → centre.
      for (let i = 0; i < 6; i += 1) p.set(3 + i, S - 3 - i, i < 2 ? shade(handle, -0.2) : handle);
      p.set(4, S - 3, shade(handle, -0.3));
      if (isSword) {
        for (let i = 0; i < 8; i += 1) {
          p.set(9 + Math.floor(i * 0.6), 6 - Math.floor(i * 0.7) + 1, base);
          p.set(8 + Math.floor(i * 0.6), 6 - Math.floor(i * 0.7) + 1, shade(base, 0.3));
        }
        for (let i = -1; i <= 1; i += 1) p.set(9 + i, 9 - i, shade(accent, 0.1)); // guard
      } else {
        // Pick/axe head: a chunky blob at the top-right.
        for (let dy = 0; dy < 5; dy += 1) {
          for (let dx = 0; dx < 6; dx += 1) {
            if (dx + dy > 7) continue;
            p.set(8 + dx, 2 + dy, dy === 0 ? shade(base, 0.3) : base);
          }
        }
      }
      return;
    }

    case 'plant': {
      for (let y = 0; y < S; y += 1) for (let x = 0; x < S; x += 1) p.clearAlpha(x, y);
      // A stem with a few leaves — reads as vegetation, not a green square.
      const stemX = S / 2;
      for (let y = 5; y < S - 1; y += 1) p.set(stemX, y, shade(base, -0.2));
      for (let i = 0; i < 5; i += 1) {
        const y = 6 + i * 2;
        const dir = i % 2 === 0 ? 1 : -1;
        p.set(stemX + dir, y, base);
        p.set(stemX + dir * 2, y - 1, shade(base, 0.14));
      }
      p.set(stemX, 4, shade(accent, 0.25));
      p.set(stemX - 1, 4, accent);
      p.set(stemX + 1, 4, accent);
      return;
    }

    default: {
      mottle(0.26, 3);
      for (let i = 0; i < S; i += 1) {
        p.set(i, 0, shade(base, 0.18));
        p.set(0, i, shade(base, 0.12));
        p.set(i, S - 1, shade(base, -0.22));
        p.set(S - 1, i, shade(base, -0.16));
      }
      return;
    }
  }
}

function alphaAt(p: Painter, x: number, y: number): number {
  return p.data[(y * TEXTURE_SIZE + x) * 4 + 3] / 255;
}

/* ------------------------------------------------------------------ *
 * face variants
 * ------------------------------------------------------------------ */

/** Variant indices used as the high bits of a mesher surface key. */
export const VARIANT_SIDE = 0;
export const VARIANT_TOP = 1;
export const VARIANT_BOTTOM = 2;

/**
 * Archetypes whose top/bottom faces genuinely differ from their sides.
 *
 * Kept deliberately small: every extra variant is an extra material and an
 * extra draw call per chunk, so only the blocks where it is visually obvious
 * (grass crowns, log end grain) opt in.
 */
const MULTI_FACE_ARCHETYPES = new Set<TextureArchetype>(['grass', 'log']);

/** True when this block needs separate top/side/bottom materials. */
export function hasFaceVariants(id: BlockID): boolean {
  return MULTI_FACE_ARCHETYPES.has(archetypeFor(id));
}

/** Maps a mesher face direction to the variant index for this block. */
export function faceVariantFor(id: BlockID, direction: 'top' | 'bottom' | 'side'): number {
  if (!hasFaceVariants(id)) return VARIANT_SIDE;
  if (direction === 'top') return VARIANT_TOP;
  if (direction === 'bottom') return VARIANT_BOTTOM;
  return VARIANT_SIDE;
}

/** Inverse of `faceVariantFor`, for building the matching texture. */
export function faceForVariant(variant: number): BlockFace {
  if (variant === VARIANT_TOP) return 'top';
  if (variant === VARIANT_BOTTOM) return 'bottom';
  return 'side';
}

/**
 * True when a block should be drawn as a flat item sprite rather than a cube.
 * Swords, pickaxes and plants are billboards in Minecraft, not blocks — this is
 * what stops the hotbar showing a sword as a coloured box.
 */
export function isItemSprite(id: BlockID): boolean {
  const archetype = archetypeFor(id);
  return archetype === 'tool' || archetype === 'plant';
}

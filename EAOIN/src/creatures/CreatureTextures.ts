/**
 * CreatureTextures — procedural pixel-art skins for mobs.
 *
 * ## What was wrong
 *
 * Every mob part was a Babylon `StandardMaterial` with a single flat
 * `diffuseColor`, so an animal was literally a stack of solid-colour boxes:
 * "every section of it is coloured white, every section of it is coloured blue
 * in the head". Eyes were separate emissive cubes glued to the face, which is
 * the "sheep has an eye that's like a white block that looks really bad".
 *
 * ## What it does now
 *
 * Each body part gets a real 16×16 texture with wool tufts, fur grain, hide
 * shading and — critically — **eyes painted into the head texture** the way
 * Minecraft does it, instead of being extra geometry. Faces also get a muzzle
 * and nostrils, so a sheep reads as a sheep.
 *
 * Pure and deterministic (no Babylon, no DOM), so it is unit-testable and the
 * results can be cached.
 */

export const MOB_TEXTURE_SIZE = 16;

export type MobPart = 'body' | 'head' | 'leg';

/** The species this module knows how to paint. */
export type MobSpecies = 'sheep' | 'deer' | 'goat' | 'hare' | 'wolf' | 'cow' | 'pig' | 'chicken';

interface Rgb { r: number; g: number; b: number; }

interface SpeciesPalette {
  /** Main coat colour. */
  coat: string;
  /** Secondary colour: face, hooves, markings. */
  accent: string;
  /** Eye colour. */
  eye: string;
  /** Coat surface treatment. */
  fur: 'wool' | 'fur' | 'hide' | 'feather';
}

export const MOB_PALETTES: Record<MobSpecies, SpeciesPalette> = {
  sheep: { coat: '#e8e4d8', accent: '#d9b8a0', eye: '#241c18', fur: 'wool' },
  deer: { coat: '#8a5a30', accent: '#e8dcc8', eye: '#1c1410', fur: 'fur' },
  goat: { coat: '#c9c4b6', accent: '#6b6357', eye: '#2a2118', fur: 'fur' },
  hare: { coat: '#b98f5e', accent: '#e6d8c0', eye: '#2b1a14', fur: 'fur' },
  wolf: { coat: '#8d8f96', accent: '#4a4c52', eye: '#c8482e', fur: 'fur' },
  cow: { coat: '#3d332c', accent: '#e6e0d4', eye: '#1a1410', fur: 'hide' },
  pig: { coat: '#e0989a', accent: '#c4787c', eye: '#231a18', fur: 'hide' },
  chicken: { coat: '#efefe6', accent: '#d8a63c', eye: '#231a18', fur: 'feather' },
};

/* ---------------------------------------------------------------- */

function hexToRgb(hex: string): Rgb {
  const c = hex.replace('#', '').padEnd(6, '0');
  return {
    r: Number.parseInt(c.slice(0, 2), 16),
    g: Number.parseInt(c.slice(2, 4), 16),
    b: Number.parseInt(c.slice(4, 6), 16),
  };
}

function shade(color: Rgb, amount: number): Rgb {
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

/** Deterministic hash in [0,1). */
function rand(x: number, y: number, salt: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + salt * 2246822519, 3266489917);
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 4294967296;
}

class Canvas {
  readonly data = new Uint8Array(MOB_TEXTURE_SIZE * MOB_TEXTURE_SIZE * 4);

  constructor(base: Rgb) {
    for (let i = 0; i < MOB_TEXTURE_SIZE * MOB_TEXTURE_SIZE; i += 1) {
      this.data[i * 4] = base.r;
      this.data[i * 4 + 1] = base.g;
      this.data[i * 4 + 2] = base.b;
      this.data[i * 4 + 3] = 255;
    }
  }

  set(x: number, y: number, c: Rgb): void {
    if (x < 0 || y < 0 || x >= MOB_TEXTURE_SIZE || y >= MOB_TEXTURE_SIZE) return;
    const i = (y * MOB_TEXTURE_SIZE + x) * 4;
    this.data[i] = Math.max(0, Math.min(255, c.r));
    this.data[i + 1] = Math.max(0, Math.min(255, c.g));
    this.data[i + 2] = Math.max(0, Math.min(255, c.b));
    this.data[i + 3] = 255;
  }

  get(x: number, y: number): Rgb {
    const i = (y * MOB_TEXTURE_SIZE + x) * 4;
    return { r: this.data[i], g: this.data[i + 1], b: this.data[i + 2] };
  }

  rect(x0: number, y0: number, w: number, h: number, c: Rgb): void {
    for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) this.set(x, y, c);
  }
}

const CACHE = new Map<string, Uint8Array>();

/**
 * Build (or fetch) the texture for one body part of one species.
 */
export function buildMobTexture(species: MobSpecies, part: MobPart): Uint8Array {
  const key = `${species}:${part}`;
  const cached = CACHE.get(key);
  if (cached) return cached;

  const palette = MOB_PALETTES[species];
  const coat = hexToRgb(palette.coat);
  const accent = hexToRgb(palette.accent);
  const eye = hexToRgb(palette.eye);
  const salt = species.charCodeAt(0) * 131 + part.charCodeAt(0);

  const canvas = new Canvas(coat);
  paintCoat(canvas, coat, palette.fur, salt);

  if (part === 'head') paintFace(canvas, coat, accent, eye, species);
  if (part === 'leg') paintLeg(canvas, coat, accent, species);
  if (part === 'body') paintBodyMarkings(canvas, coat, accent, species, salt);

  CACHE.set(key, canvas.data);
  return canvas.data;
}

/** Surface treatment: wool tufts, fur grain, smooth hide, or feathers. */
function paintCoat(canvas: Canvas, coat: Rgb, fur: SpeciesPalette['fur'], salt: number): void {
  const S = MOB_TEXTURE_SIZE;
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      let delta = 0;
      if (fur === 'wool') {
        // Clumped tufts: low-frequency blobs, high contrast.
        const blob = rand(Math.floor(x / 2), Math.floor(y / 2), salt);
        delta = (blob - 0.5) * 0.34;
      } else if (fur === 'fur') {
        // Directional grain running down the body.
        const grain = rand(x, Math.floor(y / 3), salt);
        delta = (grain - 0.5) * 0.26;
      } else if (fur === 'feather') {
        // Overlapping scallops.
        const scallop = ((x + (y % 2) * 2) % 4 === 0) ? -0.12 : 0;
        delta = scallop + (rand(x, y, salt) - 0.5) * 0.12;
      } else {
        // Hide: smooth with subtle mottling.
        delta = (rand(Math.floor(x / 3), Math.floor(y / 3), salt) - 0.5) * 0.16;
      }
      // Ambient-occlusion style darkening toward the part's edges, which is
      // what stops each box reading as a flat slab of colour.
      const edge = Math.min(x, y, S - 1 - x, S - 1 - y);
      const edgeShade = edge === 0 ? -0.20 : edge === 1 ? -0.09 : 0;
      canvas.set(x, y, shade(coat, delta + edgeShade));
    }
  }
}

/**
 * Paint the face: eyes, muzzle and nostrils, directly into the head texture.
 *
 * Painting eyes rather than attaching emissive cubes is the fix for the
 * "sheep has an eye that's like a white block" complaint.
 */
function paintFace(canvas: Canvas, coat: Rgb, accent: Rgb, eye: Rgb, species: MobSpecies): void {
  // Muzzle patch across the lower face.
  canvas.rect(4, 9, 8, 5, shade(accent, 0.05));
  // Nostrils.
  canvas.set(6, 11, shade(accent, -0.55));
  canvas.set(9, 11, shade(accent, -0.55));
  // Mouth line.
  canvas.rect(6, 13, 4, 1, shade(accent, -0.42));

  // Eyes: a dark iris with a single white catchlight, 2x2 each.
  for (const ex of [3, 11]) {
    canvas.rect(ex, 5, 2, 2, eye);
    // Catchlight — one pixel, top-left of the iris.
    canvas.set(ex, 5, shade(eye, 0.82));
  }

  // Brow shading above the eyes gives the face structure.
  canvas.rect(3, 4, 2, 1, shade(coat, -0.24));
  canvas.rect(11, 4, 2, 1, shade(coat, -0.24));

  if (species === 'wolf') {
    // Snarl: a lighter snout stripe and visible teeth.
    canvas.rect(7, 9, 2, 5, shade(accent, 0.18));
    canvas.set(6, 12, shade(accent, 0.6));
    canvas.set(9, 12, shade(accent, 0.6));
  }
  if (species === 'sheep') {
    // Woolly forelock over the brow.
    for (let x = 2; x < 14; x += 2) canvas.set(x, 2, shade(coat, 0.22));
  }
  if (species === 'chicken') {
    // Beak and comb.
    canvas.rect(6, 10, 4, 3, shade(accent, 0.1));
    canvas.rect(6, 1, 4, 2, { r: 200, g: 60, b: 50 });
  }
}

/** Hooves / paws at the bottom of the leg texture. */
function paintLeg(canvas: Canvas, coat: Rgb, accent: Rgb, species: MobSpecies): void {
  const dark = species === 'sheep' || species === 'cow'
    ? shade(accent, -0.62)
    : shade(coat, -0.48);
  canvas.rect(0, 12, MOB_TEXTURE_SIZE, 4, dark);
  // Highlight along the front of the leg.
  canvas.rect(2, 0, 1, 12, shade(coat, 0.14));
}

/** Species-specific coat markings on the body. */
function paintBodyMarkings(
  canvas: Canvas,
  coat: Rgb,
  accent: Rgb,
  species: MobSpecies,
  salt: number
): void {
  if (species === 'cow') {
    // Irregular patches, the defining feature of a cow.
    for (let i = 0; i < 4; i += 1) {
      const px = Math.floor(rand(i, 1, salt) * 11);
      const py = Math.floor(rand(i, 2, salt) * 11);
      const w = 3 + Math.floor(rand(i, 3, salt) * 3);
      const h = 3 + Math.floor(rand(i, 4, salt) * 3);
      canvas.rect(px, py, w, h, accent);
    }
  }
  if (species === 'deer') {
    // Dappled spots down the flank.
    for (let i = 0; i < 7; i += 1) {
      const px = 2 + Math.floor(rand(i, 5, salt) * 12);
      const py = 3 + Math.floor(rand(i, 6, salt) * 9);
      canvas.set(px, py, shade(accent, 0.2));
      canvas.set(px + 1, py, shade(accent, 0.1));
    }
  }
  if (species === 'sheep') {
    // Extra-fluffy tufts so wool reads at a distance.
    for (let i = 0; i < 10; i += 1) {
      const px = Math.floor(rand(i, 7, salt) * 15);
      const py = Math.floor(rand(i, 8, salt) * 15);
      canvas.set(px, py, shade(coat, 0.26));
      canvas.set(px, py + 1, shade(coat, -0.14));
    }
  }
  if (species === 'pig') {
    canvas.rect(0, 11, MOB_TEXTURE_SIZE, 1, shade(accent, -0.2));
  }
}

/** Clear the cache (tests, texture-pack swaps). */
export function clearMobTextureCache(): void {
  CACHE.clear();
}

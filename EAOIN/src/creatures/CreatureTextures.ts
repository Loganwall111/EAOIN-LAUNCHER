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

export type MobPart = 'body' | 'head' | 'leg' | 'wing' | 'fin' | 'segment';

/**
 * Species this module has a hand-tuned palette for.
 *
 * Any other species is painted from the palette supplied by the caller (see
 * `buildMobTextureFromPalette`), so the whole 41-entry wildlife roster and all
 * of its colour variants are covered without an entry each.
 */
export type MobSpecies = 'sheep' | 'deer' | 'goat' | 'hare' | 'wolf' | 'cow' | 'pig' | 'chicken';

/** Surface treatment; picked from the body plan when not otherwise known. */
export type CoatStyle = 'wool' | 'fur' | 'hide' | 'feather' | 'scale' | 'chitin' | 'slick';

/** Everything the painter needs. Variants supply their own transformed hexes. */
export interface MobPaletteInput {
  /** Main coat colour. */
  coat: string;
  /** Secondary: face, hooves, markings. */
  accent: string;
  /** Eye colour. Defaults to near-black. */
  eye?: string;
  style: CoatStyle;
  /** Stable id used to seed the pattern, so variants differ from each other. */
  seed: string;
  /** Drives species-specific markings (spots, patches). */
  markings?: 'none' | 'patches' | 'dapples' | 'tufts' | 'stripes' | 'belly';
}

interface Rgb { r: number; g: number; b: number; }

interface SpeciesPalette {
  /** Main coat colour. */
  coat: string;
  /** Secondary colour: face, hooves, markings. */
  accent: string;
  /** Eye colour. */
  eye: string;
  /** Coat surface treatment. */
  fur: CoatStyle;
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

/**
 * Deterministic hash in [0,1).
 *
 * Avalanches twice. A single multiply-and-shift left the low bits of `x`
 * correlated when `y` and `salt` were held constant, which is how the deer's
 * scatter spots came out as diagonal streaks instead of dapples.
 */
function rand(x: number, y: number, salt: number): number {
  let h = Math.imul(x + 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ Math.imul(y + 0x165667b1, 0xc2b2ae35), 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15) ^ Math.imul(salt + 0x2545f491, 0x9e3779b1), 0x85ebca77);
  h = (h ^ (h >>> 16)) >>> 0;
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

  applyPremiumRelief(canvas, part, salt);

  CACHE.set(key, canvas.data);
  return canvas.data;
}

/**
 * NEXT-GEN MOB REMAKE — premium relief + sheen finishing pass.
 *
 * Runs after every part painter. It re-lights the finished 16×16 skin with a
 * soft top-down key light and a rim of contact occlusion so a mob body reads as
 * a rounded, volumetric creature instead of a flat-shaded box — matching the
 * new high-fidelity terrain. It only rescales existing colours (never writes
 * new hues or touches alpha), so every wildlife regression stays exact:
 *   - each part still has >1 distinct colour ("texture detail")
 *   - two different palettes/seeds still produce different buffers
 *   - the pass is deterministic per (part, salt)
 */
function applyPremiumRelief(canvas: Canvas, part: MobPart, salt: number): void {
  const S = MOB_TEXTURE_SIZE;
  const edge = S - 1;
  // Legs and segments are seen edge-on and get a stronger cylindrical shade;
  // heads/bodies get a gentle spherical key light.
  const cylindrical = part === 'leg' || part === 'segment' || part === 'fin';
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const c = canvas.get(x, y);
      // Spherical key light from the upper-left; cylindrical mobs shade only
      // across X so the limb keeps a rounded barrel highlight.
      const nx = (x / edge) * 2 - 1;
      const ny = (y / edge) * 2 - 1;
      const round = cylindrical
        ? 1 - nx * nx
        : 1 - (nx * nx + ny * ny) * 0.5;
      let delta = (round - 0.5) * 0.20;
      // Contact occlusion hugging the silhouette so parts seat together.
      const rim = Math.min(x, y, edge - x, edge - y);
      if (rim === 0) delta -= 0.14;
      // Micro fibre sparkle keeps the coat alive without adding new colours.
      delta += (rand(x, y, salt + 4099) - 0.5) * 0.05;
      canvas.set(x, y, shade(c, delta));
    }
  }
}

/** Surface treatment: wool, fur, hide, feathers, scales, chitin or wet skin. */
function paintCoat(canvas: Canvas, coat: Rgb, fur: CoatStyle, salt: number): void {
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
      } else if (fur === 'scale') {
        // Diamond lattice — reptiles and fish.
        const lattice = ((x + y) % 3 === 0 || (x - y + S) % 3 === 0) ? -0.16 : 0.06;
        delta = lattice + (rand(x, y, salt) - 0.5) * 0.1;
      } else if (fur === 'chitin') {
        // Hard banded plates with dark seams.
        const band = y % 4 === 0 ? -0.3 : y % 4 === 1 ? 0.12 : 0;
        delta = band + (rand(Math.floor(x / 2), y, salt) - 0.5) * 0.12;
      } else if (fur === 'slick') {
        // Wet skin: a broad vertical sheen, almost no texture.
        const sheen = Math.cos(((x / S) - 0.35) * Math.PI) * 0.16;
        delta = sheen + (rand(Math.floor(x / 4), Math.floor(y / 4), salt) - 0.5) * 0.06;
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
      const px = Math.floor(rand(i * 41 + 7, i * 13 + 3, salt) * 11);
      const py = Math.floor(rand(i * 23 + 29, i * 31 + 17, salt + 53) * 11);
      const w = 3 + Math.floor(rand(i * 11 + 2, i * 43 + 9, salt + 71) * 3);
      const h = 3 + Math.floor(rand(i * 37 + 13, i * 19 + 27, salt + 89) * 3);
      canvas.rect(px, py, w, h, accent);
    }
  }
  if (species === 'deer') {
    // Dappled spots down the flank.
    for (let i = 0; i < 9; i += 1) {
      const px = 2 + Math.floor(rand(i * 31 + 5, i * 7 + 11, salt) * 12);
      const py = 3 + Math.floor(rand(i * 17 + 23, i * 13 + 41, salt + 97) * 9);
      // A rounded 2x2 dapple. Setting (px,py) and (px+1,py+1) drew a
      // one-pixel diagonal, which read as slashes rather than spots.
      canvas.set(px, py, shade(accent, 0.24));
      canvas.set(px + 1, py, shade(accent, 0.18));
      canvas.set(px, py + 1, shade(accent, 0.16));
      canvas.set(px + 1, py + 1, shade(accent, 0.10));
    }
  }
  if (species === 'sheep') {
    // Extra-fluffy tufts so wool reads at a distance.
    for (let i = 0; i < 12; i += 1) {
      const px = Math.floor(rand(i * 29 + 3, i * 11 + 19, salt) * 15);
      const py = Math.floor(rand(i * 19 + 37, i * 23 + 5, salt + 61) * 15);
      canvas.set(px, py, shade(coat, 0.26));
      canvas.set(px, py + 1, shade(coat, -0.14));
    }
  }
  if (species === 'pig') {
    canvas.rect(0, 11, MOB_TEXTURE_SIZE, 1, shade(accent, -0.2));
  }
}

/**
 * Build a texture from an arbitrary palette.
 *
 * This is the entry point used for the full wildlife roster and every colour
 * variant: rather than hand-authoring an entry per species, the caller passes
 * the species' (or variant's) own colours and the painter applies the right
 * surface treatment, face and markings for the part.
 */
export function buildMobTextureFromPalette(input: MobPaletteInput, part: MobPart): Uint8Array {
  const key = `pal:${input.seed}:${input.coat}:${input.accent}:${input.style}:${input.markings ?? 'none'}:${part}`;
  const cached = CACHE.get(key);
  if (cached) return cached;

  const coat = hexToRgb(input.coat);
  const accent = hexToRgb(input.accent);
  const eye = hexToRgb(input.eye ?? '#1c1610');
  // Seed from the full identity so two variants of one species differ.
  let salt = 0;
  for (let i = 0; i < input.seed.length; i += 1) salt = (salt * 31 + input.seed.charCodeAt(i)) >>> 0;
  salt += part.charCodeAt(0) * 7919;

  const canvas = new Canvas(coat);
  paintCoat(canvas, coat, input.style, salt);

  switch (part) {
    case 'head':
      paintGenericFace(canvas, coat, accent, eye, input.style);
      break;
    case 'leg':
      paintGenericLeg(canvas, coat, accent);
      break;
    case 'wing':
      paintWing(canvas, coat, accent, salt);
      break;
    case 'fin':
      paintFin(canvas, coat, accent);
      break;
    case 'segment':
      paintSegment(canvas, coat, accent, salt);
      break;
    default:
      paintGenericMarkings(canvas, coat, accent, input.markings ?? 'none', salt);
      break;
  }

  applyPremiumRelief(canvas, part, salt);

  CACHE.set(key, canvas.data);
  return canvas.data;
}

/**
 * Faces, drawn per coat style.
 *
 * A shark with a mammal's muzzle and nostrils reads as wrong even at 16px, so
 * the mouth, eyes and brow are chosen by what kind of animal this is:
 *
 *   feather  — beak, small round eyes set high
 *   scale    — wide fish/reptile jaw with a tooth line, side-set eyes
 *   chitin   — mandibles and a cluster of small eyes
 *   slick    — smooth face, a simple curved mouth (dolphins, frogs, whales)
 *   default  — the mammal muzzle with nostrils
 */
function paintGenericFace(canvas: Canvas, coat: Rgb, accent: Rgb, eye: Rgb, style: CoatStyle): void {
  if (style === 'feather') {
    // Beak: a wedge sitting proud of the face.
    canvas.rect(6, 9, 4, 4, shade(accent, 0.1));
    canvas.rect(7, 12, 2, 2, shade(accent, -0.12));
    canvas.rect(6, 11, 4, 1, shade(accent, -0.35));
    paintEyes(canvas, coat, eye, [3, 11], 4, true);
    return;
  }

  if (style === 'scale') {
    // Wide jaw spanning the face, with a pale tooth line.
    canvas.rect(2, 10, 12, 4, shade(coat, -0.3));
    canvas.rect(2, 10, 12, 1, shade(coat, -0.5));
    for (let x = 3; x < 14; x += 2) canvas.set(x, 11, shade(accent, 0.55));
    // Eyes sit high and to the sides on fish and reptiles.
    paintEyes(canvas, coat, eye, [1, 13], 4, false);
    return;
  }

  if (style === 'chitin') {
    // Mandibles.
    canvas.rect(5, 11, 2, 4, shade(accent, -0.3));
    canvas.rect(9, 11, 2, 4, shade(accent, -0.3));
    canvas.rect(6, 14, 4, 1, shade(accent, -0.45));
    // A cluster of small eyes, which is what makes an arthropod unsettling.
    for (const [ex, ey] of [[3, 5], [6, 4], [9, 4], [12, 5], [5, 7], [10, 7]]) {
      canvas.set(ex, ey, eye);
      canvas.set(ex + 1, ey, shade(eye, 0.5));
    }
    return;
  }

  if (style === 'slick') {
    // Smooth face, gentle curved mouth — dolphins, frogs, whales.
    for (let x = 4; x < 12; x += 1) {
      const y = 12 + (x === 4 || x === 11 ? -1 : 0);
      canvas.set(x, y, shade(coat, -0.4));
    }
    paintEyes(canvas, coat, eye, [2, 12], 5, true);
    return;
  }

  // Mammal default: muzzle, nostrils, mouth line.
  canvas.rect(4, 9, 8, 5, shade(accent, 0.05));
  canvas.set(6, 11, shade(accent, -0.55));
  canvas.set(9, 11, shade(accent, -0.55));
  canvas.rect(6, 13, 4, 1, shade(accent, -0.42));
  paintEyes(canvas, coat, eye, [3, 11], 5, true);
}

/**
 * Paint a symmetric pair of eyes with a catchlight.
 *
 * Eyes live in the head texture rather than being separate emissive cubes —
 * the old approach is what produced the "sheep has an eye that's like a white
 * block" complaint.
 */
function paintEyes(
  canvas: Canvas,
  coat: Rgb,
  eye: Rgb,
  columns: [number, number],
  row: number,
  brow: boolean
): void {
  for (const ex of columns) {
    canvas.rect(ex, row, 2, 2, eye);
    // Single-pixel catchlight, top-left of the iris.
    canvas.set(ex, row, shade(eye, 0.82));
  }
  if (brow) {
    for (const ex of columns) canvas.rect(ex, row - 1, 2, 1, shade(coat, -0.24));
  }
}

function paintGenericLeg(canvas: Canvas, coat: Rgb, accent: Rgb): void {
  canvas.rect(0, 12, MOB_TEXTURE_SIZE, 4, shade(accent, -0.5));
  canvas.rect(2, 0, 1, 12, shade(coat, 0.14));
}

/** Feathered wing: primaries fanning out from the leading edge. */
function paintWing(canvas: Canvas, coat: Rgb, accent: Rgb, salt: number): void {
  for (let y = 0; y < MOB_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < MOB_TEXTURE_SIZE; x += 1) {
      // Feather quills every third column, darkening toward the tip.
      const quill = x % 3 === 0;
      const tip = y / MOB_TEXTURE_SIZE;
      const base = quill ? shade(coat, -0.24) : shade(coat, 0.06);
      canvas.set(x, y, shade(base, -tip * 0.22));
    }
  }
  // Coverts along the leading edge.
  canvas.rect(0, 0, MOB_TEXTURE_SIZE, 3, shade(accent, 0.1));
  for (let i = 0; i < 5; i += 1) {
    const x = Math.floor(rand(i * 13 + 1, i * 7 + 3, salt) * MOB_TEXTURE_SIZE);
    canvas.set(x, 1, shade(accent, -0.28));
  }
}

/** Fin membrane with visible rays. */
function paintFin(canvas: Canvas, coat: Rgb, accent: Rgb): void {
  for (let y = 0; y < MOB_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < MOB_TEXTURE_SIZE; x += 1) {
      const ray = x % 4 === 0 ? -0.26 : 0.04;
      canvas.set(x, y, shade(coat, ray));
    }
  }
  canvas.rect(0, MOB_TEXTURE_SIZE - 2, MOB_TEXTURE_SIZE, 2, shade(accent, -0.2));
}

/** One body segment of a serpent: banded, with a lighter belly stripe. */
function paintSegment(canvas: Canvas, coat: Rgb, accent: Rgb, salt: number): void {
  for (let y = 0; y < MOB_TEXTURE_SIZE; y += 1) {
    // Bands every few rows, jittered so they are not perfectly regular.
    const band = (y + Math.floor(rand(y, 1, salt) * 2)) % 5 < 2;
    if (!band) continue;
    canvas.rect(0, y, MOB_TEXTURE_SIZE, 1, shade(accent, -0.15));
  }
  // Pale belly.
  canvas.rect(0, MOB_TEXTURE_SIZE - 3, MOB_TEXTURE_SIZE, 3, shade(coat, 0.28));
}

/** Coat markings driven by the species' marking style. */
function paintGenericMarkings(
  canvas: Canvas,
  coat: Rgb,
  accent: Rgb,
  markings: NonNullable<MobPaletteInput['markings']>,
  salt: number
): void {
  if (markings === 'patches') {
    for (let i = 0; i < 4; i += 1) {
      const px = Math.floor(rand(i * 41 + 7, i * 13 + 3, salt) * 11);
      const py = Math.floor(rand(i * 23 + 29, i * 31 + 17, salt + 53) * 11);
      const w = 3 + Math.floor(rand(i * 11 + 2, i * 43 + 9, salt + 71) * 3);
      const h = 3 + Math.floor(rand(i * 37 + 13, i * 19 + 27, salt + 89) * 3);
      canvas.rect(px, py, w, h, accent);
    }
  } else if (markings === 'dapples') {
    for (let i = 0; i < 9; i += 1) {
      const px = 2 + Math.floor(rand(i * 31 + 5, i * 7 + 11, salt) * 12);
      const py = 3 + Math.floor(rand(i * 17 + 23, i * 13 + 41, salt + 97) * 9);
      canvas.set(px, py, shade(accent, 0.24));
      canvas.set(px + 1, py, shade(accent, 0.18));
      canvas.set(px, py + 1, shade(accent, 0.16));
      canvas.set(px + 1, py + 1, shade(accent, 0.1));
    }
  } else if (markings === 'tufts') {
    for (let i = 0; i < 12; i += 1) {
      const px = Math.floor(rand(i * 29 + 3, i * 11 + 19, salt) * 15);
      const py = Math.floor(rand(i * 19 + 37, i * 23 + 5, salt + 61) * 15);
      canvas.set(px, py, shade(coat, 0.26));
      canvas.set(px, py + 1, shade(coat, -0.14));
    }
  } else if (markings === 'stripes') {
    for (let x = 0; x < MOB_TEXTURE_SIZE; x += 3) {
      const jitter = Math.floor(rand(x, 2, salt) * 2);
      canvas.rect(x + jitter, 0, 1, MOB_TEXTURE_SIZE, shade(accent, -0.3));
    }
  } else if (markings === 'belly') {
    canvas.rect(0, MOB_TEXTURE_SIZE - 4, MOB_TEXTURE_SIZE, 4, shade(coat, 0.34));
  }
}

/** Clear the cache (tests, texture-pack swaps). */
export function clearMobTextureCache(): void {
  CACHE.clear();
}

/**
 * Build an RGBA emissive mask from a diffuse head texture: the eye texels
 * (the darkest, high-saturation catchlight pixels) are lifted to a bright
 * emissive colour and everything else is black. Applied as the head material's
 * emissiveTexture, this makes mob eyes genuinely glow at night while the rest
 * of the body stays unlit. Deterministic and pure.
 */
export function buildMobEmissiveMask(diffuse: Uint8Array, size = MOB_TEXTURE_SIZE): Uint8Array {
  const mask = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const r = diffuse[i];
      const g = diffuse[i + 1];
      const b = diffuse[i + 2];
      // Eyes are drawn near-black (dark iris) with a bright catchlight. We
      // key on the bright catchlight pixel plus the surrounding iris region.
      const isBright = r > 200 && g > 200 && b > 200;
      const isDarkIris = r < 60 && g < 60 && b < 60;
      if (isBright || isDarkIris) {
        const glow = isBright ? 1.0 : 0.55;
        mask[i] = Math.round(255 * glow);
        mask[i + 1] = Math.round(255 * glow);
        mask[i + 2] = 255;
        mask[i + 3] = 255;
      } else {
        mask[i] = 0; mask[i + 1] = 0; mask[i + 2] = 0; mask[i + 3] = 0;
      }
    }
  }
  return mask;
}

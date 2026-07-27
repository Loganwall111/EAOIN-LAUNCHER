/**
 * SpeciesVariants — themed sub-types for every species in the roster.
 *
 * ## Why
 *
 * A world where every sheep is the same sheep reads as a tech demo. Minecraft
 * gets a lot of its life from variants: the same mob in a different coat,
 * slightly different size, occasionally something rare enough that finding one
 * is an event.
 *
 * ## Design rules
 *
 * 1. **Variants are themed on the species that already exists.** A wolf gets
 *    timber/tundra/black coats — it never becomes a different animal. The
 *    modifiers here only ever tint the palette and nudge scale/health/speed.
 * 2. **Generic tiers apply to everything.** Runt / normal / elder gives every
 *    species natural size spread without hand-authoring 41 lists.
 * 3. **Rarity is real.** Albino and melanistic morphs sit at ~1-2%, so seeing
 *    one actually means something.
 * 4. **Deterministic.** A creature's variant is a pure function of its spawn
 *    id, so the same animal looks the same every time it streams back in.
 *
 * The result is ~8-15 visually distinct forms per species from a small table,
 * rather than 41 identical models.
 */
import { SpeciesDefinition } from './WildlifeRegistry';

export interface VariantDefinition {
  id: string;
  /** Shown in the codex and on hit messages, e.g. "Timber Wolf". */
  label: string;
  /** Relative chance within its group. */
  weight: number;
  /** Multiplies the species' base scale. */
  scale?: number;
  /** Multiplies base health. */
  health?: number;
  /** Multiplies base speed. */
  speed?: number;
  /**
   * Palette transform. `tint` blends every colour toward a hex, `lighten`
   * and `saturate` adjust in place. Applied in that order.
   */
  tint?: { color: string; amount: number };
  lighten?: number;
  saturate?: number;
  /** Marks the rare morphs so the HUD can call them out. */
  rare?: boolean;
}

/**
 * Size/age tiers applied to every land and marine species.
 *
 * Deliberately subtle: a herd where every animal is a slightly different size
 * looks alive, whereas large random scale swings look like a bug.
 */
export const SIZE_TIERS: VariantDefinition[] = [
  { id: 'runt', label: 'Runt', weight: 14, scale: 0.78, health: 0.7, speed: 1.12 },
  { id: 'young', label: 'Young', weight: 20, scale: 0.88, health: 0.82, speed: 1.06 },
  { id: 'adult', label: '', weight: 46, scale: 1, health: 1, speed: 1 },
  { id: 'large', label: 'Large', weight: 16, scale: 1.14, health: 1.25, speed: 0.94 },
  { id: 'elder', label: 'Elder', weight: 4, scale: 1.3, health: 1.6, speed: 0.86, saturate: 0.8 },
];

/**
 * Colour morphs available to every species.
 *
 * These are the cross-species ones. Species-specific coats are below and take
 * priority when present.
 */
export const COMMON_MORPHS: VariantDefinition[] = [
  { id: 'natural', label: '', weight: 74 },
  { id: 'pale', label: 'Pale', weight: 10, lighten: 0.18, saturate: 0.72 },
  { id: 'dark', label: 'Dark', weight: 10, lighten: -0.22 },
  { id: 'dusky', label: 'Dusky', weight: 4, tint: { color: '#4a4038', amount: 0.3 } },
  // The rare ones. ~2% combined.
  { id: 'albino', label: 'Albino', weight: 1.2, lighten: 0.62, saturate: 0.12, rare: true },
  { id: 'melanistic', label: 'Melanistic', weight: 0.8, lighten: -0.62, saturate: 0.3, rare: true },
];

/**
 * Species-specific coats, themed on the animal they belong to.
 *
 * Keyed by the species id from `WildlifeRegistry`. Where a species appears
 * here, these replace `COMMON_MORPHS` — a cow should roll Holstein/Highland,
 * not "Pale".
 */
export const SPECIES_MORPHS: Record<string, VariantDefinition[]> = {
  cow: [
    { id: 'holstein', label: '', weight: 40 },
    { id: 'jersey', label: 'Jersey', weight: 22, tint: { color: '#b5793f', amount: 0.55 } },
    { id: 'angus', label: 'Angus', weight: 18, lighten: -0.45 },
    { id: 'highland', label: 'Highland', weight: 14, tint: { color: '#a2542a', amount: 0.5 }, scale: 1.08 },
    { id: 'albino', label: 'Albino', weight: 1.5, lighten: 0.6, saturate: 0.1, rare: true },
  ],
  sheep: [
    { id: 'white', label: '', weight: 44 },
    { id: 'brown', label: 'Brown', weight: 18, tint: { color: '#8a6a44', amount: 0.55 } },
    { id: 'grey', label: 'Grey', weight: 16, saturate: 0.25, lighten: -0.16 },
    { id: 'black', label: 'Black', weight: 10, lighten: -0.6, saturate: 0.2 },
    { id: 'shorn', label: 'Shorn', weight: 10, scale: 0.86, lighten: 0.1 },
    { id: 'pink', label: 'Pink', weight: 1.4, tint: { color: '#e89ab0', amount: 0.6 }, rare: true },
  ],
  pig: [
    { id: 'pink', label: '', weight: 52 },
    { id: 'saddleback', label: 'Saddleback', weight: 22, tint: { color: '#3a2a24', amount: 0.42 } },
    { id: 'ginger', label: 'Ginger', weight: 16, tint: { color: '#c8722a', amount: 0.5 } },
    { id: 'boar', label: 'Wild Boar', weight: 9, tint: { color: '#4a3a2a', amount: 0.6 }, scale: 1.14, health: 1.4 },
    { id: 'albino', label: 'Albino', weight: 1, lighten: 0.5, rare: true },
  ],
  chicken: [
    { id: 'white', label: '', weight: 44 },
    { id: 'brown', label: 'Brown', weight: 26, tint: { color: '#9a6a34', amount: 0.55 } },
    { id: 'speckled', label: 'Speckled', weight: 18, lighten: -0.2, saturate: 0.7 },
    { id: 'black', label: 'Black', weight: 10, lighten: -0.58 },
    { id: 'golden', label: 'Golden', weight: 2, tint: { color: '#f0c040', amount: 0.6 }, rare: true },
  ],
  wolf: [
    { id: 'timber', label: 'Timber', weight: 40 },
    { id: 'tundra', label: 'Tundra', weight: 24, lighten: 0.3, saturate: 0.4 },
    { id: 'black', label: 'Black', weight: 20, lighten: -0.55 },
    { id: 'russet', label: 'Russet', weight: 14, tint: { color: '#8a5230', amount: 0.45 } },
    { id: 'dire', label: 'Dire', weight: 2, scale: 1.35, health: 1.8, lighten: -0.35, rare: true },
  ],
  deer: [
    { id: 'red', label: '', weight: 46 },
    { id: 'fallow', label: 'Fallow', weight: 26, lighten: 0.16 },
    { id: 'roe', label: 'Roe', weight: 18, scale: 0.86, tint: { color: '#6a4a2a', amount: 0.3 } },
    { id: 'stag', label: 'Stag', weight: 8, scale: 1.22, health: 1.4 },
    { id: 'white', label: 'White Hart', weight: 2, lighten: 0.66, saturate: 0.1, rare: true },
  ],
  fox: [
    { id: 'red', label: '', weight: 56 },
    { id: 'arctic', label: 'Arctic', weight: 22, lighten: 0.52, saturate: 0.2 },
    { id: 'cross', label: 'Cross', weight: 14, tint: { color: '#4a3a2a', amount: 0.4 } },
    { id: 'silver', label: 'Silver', weight: 6, lighten: -0.35, saturate: 0.15 },
    { id: 'melanistic', label: 'Melanistic', weight: 2, lighten: -0.6, rare: true },
  ],
  rabbit: [
    { id: 'brown', label: '', weight: 42 },
    { id: 'sandy', label: 'Sandy', weight: 22, lighten: 0.2 },
    { id: 'grey', label: 'Grey', weight: 18, saturate: 0.3 },
    { id: 'black', label: 'Black', weight: 12, lighten: -0.55 },
    { id: 'snow', label: 'Snowshoe', weight: 5, lighten: 0.6, saturate: 0.15 },
    { id: 'gold', label: 'Golden', weight: 1, tint: { color: '#e8c04a', amount: 0.6 }, rare: true },
  ],
  horse: [
    { id: 'bay', label: '', weight: 32 },
    { id: 'chestnut', label: 'Chestnut', weight: 22, tint: { color: '#9a4a1a', amount: 0.45 } },
    { id: 'black', label: 'Black', weight: 18, lighten: -0.5 },
    { id: 'grey', label: 'Grey', weight: 14, saturate: 0.2, lighten: 0.24 },
    { id: 'palomino', label: 'Palomino', weight: 10, tint: { color: '#e0c070', amount: 0.55 } },
    { id: 'white', label: 'White', weight: 4, lighten: 0.6, saturate: 0.1, rare: true },
  ],
  goat: [
    { id: 'white', label: '', weight: 40 },
    { id: 'brown', label: 'Brown', weight: 26, tint: { color: '#7a5230', amount: 0.5 } },
    { id: 'black', label: 'Black', weight: 18, lighten: -0.5 },
    { id: 'piebald', label: 'Piebald', weight: 14, lighten: 0.12 },
    { id: 'ibex', label: 'Ibex', weight: 2, scale: 1.25, health: 1.5, tint: { color: '#6a5a3a', amount: 0.4 }, rare: true },
  ],
  bear: [
    { id: 'brown', label: '', weight: 46 },
    { id: 'black', label: 'Black', weight: 26, lighten: -0.45 },
    { id: 'cinnamon', label: 'Cinnamon', weight: 18, tint: { color: '#a2622a', amount: 0.5 } },
    { id: 'grizzly', label: 'Grizzly', weight: 8, scale: 1.25, health: 1.5, lighten: 0.12 },
    { id: 'spirit', label: 'Spirit Bear', weight: 2, lighten: 0.62, saturate: 0.1, rare: true },
  ],
  lion: [
    { id: 'savanna', label: '', weight: 62 },
    { id: 'blackmane', label: 'Black-maned', weight: 24, tint: { color: '#2a1e12', amount: 0.4 } },
    { id: 'pale', label: 'Pale', weight: 12, lighten: 0.24 },
    { id: 'white', label: 'White Lion', weight: 2, lighten: 0.6, saturate: 0.12, rare: true },
  ],
  parrot: [
    { id: 'scarlet', label: 'Scarlet', weight: 30 },
    { id: 'blue', label: 'Blue', weight: 24, tint: { color: '#2a6ad8', amount: 0.72 } },
    { id: 'green', label: 'Green', weight: 22, tint: { color: '#2aa84a', amount: 0.72 } },
    { id: 'gold', label: 'Gold', weight: 18, tint: { color: '#e8b82a', amount: 0.72 } },
    { id: 'grey', label: 'Grey', weight: 6, saturate: 0.12 },
  ],
  clownfish: [
    { id: 'ocellaris', label: '', weight: 52 },
    { id: 'maroon', label: 'Maroon', weight: 24, tint: { color: '#8a2018', amount: 0.5 } },
    { id: 'black', label: 'Black', weight: 18, lighten: -0.45 },
    { id: 'snowflake', label: 'Snowflake', weight: 6, lighten: 0.4, rare: true },
  ],
  shark: [
    { id: 'great_white', label: '', weight: 54 },
    { id: 'tiger', label: 'Tiger', weight: 24, tint: { color: '#6a6a3a', amount: 0.38 } },
    { id: 'bull', label: 'Bull', weight: 18, scale: 0.9, lighten: -0.14 },
    { id: 'megalodon', label: 'Megalodon', weight: 1.5, scale: 2.1, health: 3, rare: true },
  ],
};

/** Weighted pick from a variant list using a deterministic 0-1 roll. */
export function pickVariant(list: VariantDefinition[], roll: number): VariantDefinition {
  const total = list.reduce((sum, v) => sum + v.weight, 0);
  let cursor = Math.max(0, Math.min(0.999999, roll)) * total;
  for (const entry of list) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry;
  }
  return list[list.length - 1];
}

/** The morph table a species should roll on. */
export function morphsFor(speciesId: string): VariantDefinition[] {
  return SPECIES_MORPHS[speciesId] ?? COMMON_MORPHS;
}

export interface ResolvedVariant {
  /** e.g. "sheep:black:large" — stable per creature. */
  key: string;
  /** e.g. "Large Black Sheep". */
  displayName: string;
  scale: number;
  health: number;
  speed: number;
  palette: { body: string; head: string; limb: string; accent?: string };
  rare: boolean;
}

/**
 * Resolve a species plus two deterministic rolls into a concrete variant.
 *
 * @param morphRoll 0-1, picks the coat
 * @param sizeRoll  0-1, picks the size tier
 */
export function resolveVariant(
  species: SpeciesDefinition,
  morphRoll: number,
  sizeRoll: number
): ResolvedVariant {
  const morph = pickVariant(morphsFor(species.id), morphRoll);
  const size = pickVariant(SIZE_TIERS, sizeRoll);

  const palette = {
    body: transform(species.palette.body, morph),
    head: transform(species.palette.head, morph),
    limb: transform(species.palette.limb, morph),
    accent: species.palette.accent ? transform(species.palette.accent, morph) : undefined,
  };

  // Size tiers may also carry a saturate (elder animals grey out).
  if (size.saturate !== undefined) {
    palette.body = applySaturate(palette.body, size.saturate);
    palette.head = applySaturate(palette.head, size.saturate);
    palette.limb = applySaturate(palette.limb, size.saturate);
    if (palette.accent) palette.accent = applySaturate(palette.accent, size.saturate);
  }

  const parts = [size.label, morph.label, species.name].filter(Boolean);

  return {
    key: `${species.id}:${morph.id}:${size.id}`,
    displayName: parts.join(' '),
    scale: species.scale * (morph.scale ?? 1) * (size.scale ?? 1),
    health: Math.max(1, Math.round(species.health * (morph.health ?? 1) * (size.health ?? 1))),
    speed: species.speed * (morph.speed ?? 1) * (size.speed ?? 1),
    palette,
    rare: morph.rare === true,
  };
}

/**
 * Total distinct appearances the roster can produce.
 *
 * Used by the codex UI and by tests, so "lots of variants" is a number we can
 * actually check rather than a claim.
 */
export function countVariants(speciesIds: string[]): number {
  return speciesIds.reduce(
    (total, id) => total + morphsFor(id).length * SIZE_TIERS.length,
    0
  );
}

/* ------------------------------------------------------------------ */
/* colour maths                                                        */
/* ------------------------------------------------------------------ */

function transform(hex: string, variant: VariantDefinition): string {
  let color = hex;
  if (variant.tint) color = applyTint(color, variant.tint.color, variant.tint.amount);
  if (variant.lighten !== undefined) color = applyLighten(color, variant.lighten);
  if (variant.saturate !== undefined) color = applySaturate(color, variant.saturate);
  return color;
}

function parse(hex: string): { r: number; g: number; b: number } {
  const c = hex.replace('#', '').padEnd(6, '0');
  return {
    r: Number.parseInt(c.slice(0, 2), 16),
    g: Number.parseInt(c.slice(2, 4), 16),
    b: Number.parseInt(c.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const part = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function applyTint(hex: string, tintHex: string, amount: number): string {
  const a = parse(hex);
  const b = parse(tintHex);
  const t = Math.max(0, Math.min(1, amount));
  return toHex({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
}

function applyLighten(hex: string, amount: number): string {
  const c = parse(hex);
  if (amount >= 0) {
    return toHex({
      r: c.r + (255 - c.r) * amount,
      g: c.g + (255 - c.g) * amount,
      b: c.b + (255 - c.b) * amount,
    });
  }
  const k = 1 + amount;
  return toHex({ r: c.r * k, g: c.g * k, b: c.b * k });
}

function applySaturate(hex: string, factor: number): string {
  const c = parse(hex);
  const grey = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  return toHex({
    r: grey + (c.r - grey) * factor,
    g: grey + (c.g - grey) * factor,
    b: grey + (c.b - grey) * factor,
  });
}

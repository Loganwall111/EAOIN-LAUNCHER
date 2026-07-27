/**
 * ExoticWorldGen — the strange world types, finally implemented.
 *
 * These were previously presets with no generator behind them: choosing "Far
 * Lands" gave you an ordinary world. This module supplies the actual passes.
 *
 *  - **Far Lands** — the legendary Minecraft terrain-noise overflow, recreated
 *    deliberately. Past a threshold distance the noise input saturates and the
 *    terrain smears into vast vertical walls and stretched tunnels.
 *
 *  - **Sub-Bedrock** — stacked world layers below the bedrock floor, each with
 *    its own ceiling, palette and hazards, ending in the molten core.
 *
 *  - **Inverted** — terrain density flipped, so caverns become spires.
 *
 * All functions are pure functions of (x, y, z, seed, config), so worlds stay
 * byte-identical between the client and the server.
 */
import { BlockID } from '@shared/blocks/BlockRegistry';
import { AdvancedNoise } from './AdvancedNoise';

/* ========================================================================== */
/*                                 FAR LANDS                                  */
/* ========================================================================== */

/**
 * How corrupt the terrain is at a given distance from origin, 0-1.
 *
 * In the original bug, terrain noise was fed coordinates large enough that
 * floating-point precision collapsed, so the noise stopped varying smoothly
 * and instead produced enormous repeating vertical structures. We reproduce
 * the *look* deterministically rather than relying on float overflow, because
 * JS doubles would need coordinates around 2^52 before misbehaving — far
 * beyond any reachable position.
 */
export function farLandsCorruption(worldX: number, worldZ: number, threshold: number): number {
  if (threshold <= 0) return 0;
  const distance = Math.max(Math.abs(worldX), Math.abs(worldZ));
  if (distance < threshold) return 0;
  // Ramp in over the first 25% past the threshold, then saturate.
  const over = (distance - threshold) / (threshold * 0.25);
  return Math.min(1, over);
}

export interface FarLandsSample {
  /** Extra height added to the column; produces the vertical walls. */
  heightBoost: number;
  /** 0-1 chance this column becomes a solid stretched pillar. */
  wallFactor: number;
  /** True when the column should be carved into a stretched tunnel instead. */
  tunnel: boolean;
}

/**
 * Sample the Far Lands distortion for a column.
 *
 * The characteristic look is: sheer walls that run for hundreds of blocks in
 * one axis, separated by stretched horizontal tunnels, with the whole mass
 * reaching the height limit.
 */
export function sampleFarLands(
  noise: AdvancedNoise,
  worldX: number,
  worldZ: number,
  corruption: number,
  worldDepth: number
): FarLandsSample {
  if (corruption <= 0) return { heightBoost: 0, wallFactor: 0, tunnel: false };

  // Deliberately anisotropic: a very low frequency on one axis and a high one
  // on the other is what turns blobs into long walls.
  const wall = noise.fbm2D(worldX * 0.0009, worldZ * 0.06, 4, 2.0, 0.5, 41);
  const cross = noise.fbm2D(worldX * 0.055, worldZ * 0.0011, 4, 2.0, 0.5, 43);
  const combined = Math.max(wall, cross);

  // Past the threshold the noise "saturates": values pile up at the extremes
  // instead of spreading out, which is what removes all the gentle terrain.
  const saturated = combined > 0.5
    ? Math.min(1, 0.5 + (combined - 0.5) * (1 + corruption * 6))
    : Math.max(0, 0.5 - (0.5 - combined) * (1 + corruption * 6));

  const wallFactor = Math.max(0, (saturated - 0.42) / 0.58) * corruption;
  const heightBoost = wallFactor * (worldDepth * 0.62);
  // The gaps between walls become long horizontal tunnels rather than open air.
  const tunnel = saturated < 0.22 && corruption > 0.55;

  return { heightBoost, wallFactor, tunnel };
}

/* ========================================================================== */
/*                                SUB-BEDROCK                                 */
/* ========================================================================== */

export interface SubBedrockLayer {
  index: number;
  name: string;
  /** Y where this layer's floor (its own bedrock) sits. */
  floorY: number;
  /** Y of this layer's ceiling. */
  ceilingY: number;
  /** Primary stone block for the layer. */
  stone: BlockID;
  /** Block used for the layer's ground surface. */
  surface: BlockID;
  /** Fluid that pools at the bottom, if any. */
  fluid: BlockID | null;
  /** Emissive block scattered on the ceiling. */
  glow: BlockID;
  description: string;
}

const STONE: BlockID = 3;
const OBSIDIAN: BlockID = 12;
const LAVA: BlockID = 14;
const WATER: BlockID = 5;
const CRYSTAL: BlockID = 16;
const AMETHYST: BlockID = 15;
const MOSS: BlockID = 1;
const DIRT: BlockID = 2;
const MAGMA: BlockID = 13;

/**
 * Build the stack of layers that sits beneath the world's bedrock floor.
 *
 * Layers are packed into the space between y=0 and the normal bedrock floor,
 * so they fit inside the existing 128-block chunk column rather than needing
 * a taller world. Each gets a floor, a hollow interior and a ceiling.
 */
export function buildSubBedrockLayers(layerCount: number, bedrockThickness: number): SubBedrockLayer[] {
  const count = Math.max(0, Math.min(4, Math.floor(layerCount)));
  if (count === 0) return [];

  const templates: Array<Omit<SubBedrockLayer, 'index' | 'floorY' | 'ceilingY'>> = [
    {
      name: 'The Underdark',
      stone: STONE, surface: MOSS, fluid: WATER, glow: CRYSTAL,
      description: 'A drowned cavern world of pale moss and standing water.',
    },
    {
      name: 'The Crystal Vault',
      stone: OBSIDIAN, surface: AMETHYST, fluid: null, glow: AMETHYST,
      description: 'Geode chambers the size of cathedrals. Everything hums.',
    },
    {
      name: 'The Ashen Deep',
      stone: OBSIDIAN, surface: DIRT, fluid: LAVA, glow: MAGMA,
      description: 'Ash falls upward here. Lava runs in the low places.',
    },
    {
      name: 'The Molten Core',
      stone: MAGMA, surface: MAGMA, fluid: LAVA, glow: LAVA,
      description: 'The bottom of the world. It is entirely on fire.',
    },
  ];

  // The last layer is always the core, so a 2-layer stack is Underdark + Core.
  const chosen = count === templates.length
    ? templates
    : [...templates.slice(0, count - 1), templates[templates.length - 1]];

  // Divide the space beneath the surface bedrock into equal slabs.
  const top = bedrockThickness;
  const usable = 64; // layers occupy y=0..64, well under the surface terrain
  const perLayer = Math.floor(usable / chosen.length);

  return chosen.map((template, index) => {
    const ceilingY = top + usable - index * perLayer;
    const floorY = ceilingY - perLayer;
    return { ...template, index, floorY: Math.max(1, floorY), ceilingY };
  });
}

/** Which sub-bedrock layer, if any, contains this Y. */
export function layerAtDepth(layers: SubBedrockLayer[], y: number): SubBedrockLayer | null {
  for (const layer of layers) {
    if (y >= layer.floorY && y <= layer.ceilingY) return layer;
  }
  return null;
}

/**
 * Decide the block at a point inside the sub-bedrock stack.
 *
 * Returns `null` when this Y is not part of the stack, so the caller leaves
 * normal terrain alone.
 */
export function subBedrockBlockAt(
  noise: AdvancedNoise,
  layers: SubBedrockLayer[],
  worldX: number,
  y: number,
  worldZ: number
): BlockID | null {
  const layer = layerAtDepth(layers, y);
  if (!layer) return null;

  const thickness = layer.ceilingY - layer.floorY;
  if (thickness <= 2) return layer.stone;

  // Each layer gets its own solid floor and ceiling so you fall from one into
  // the next only by breaking through.
  if (y <= layer.floorY + 1) return OBSIDIAN;
  if (y >= layer.ceilingY - 1) return OBSIDIAN;

  const local = (y - layer.floorY) / thickness;

  // Cavern shape: 3D noise carves the interior into connected chambers.
  const cavern = noise.fbm3D(worldX * 0.024, y * 0.05, worldZ * 0.024, 4, 2.0, 0.5, 61);
  const floorNoise = noise.fbm2D(worldX * 0.03, worldZ * 0.03, 3, 2.0, 0.5, 62);

  // A rolling floor in the bottom fifth of the layer.
  const floorHeight = 0.06 + floorNoise * 0.16;
  if (local < floorHeight) {
    return local > floorHeight - 0.03 ? layer.surface : layer.stone;
  }

  // Fluid pools in the lowest part of the chamber.
  if (layer.fluid !== null && local < floorHeight + 0.05 && floorNoise < 0.32) {
    return layer.fluid;
  }

  // Glowing deposits on the ceiling.
  if (local > 0.86 && cavern > 0.62) return layer.glow;

  // Solid rock where the cavern noise says so; otherwise open air.
  if (cavern > 0.58) return layer.stone;
  // Hanging columns tie floor to ceiling.
  const column = noise.fbm2D(worldX * 0.09, worldZ * 0.09, 2, 2.0, 0.5, 63);
  if (column > 0.80) return layer.stone;

  return 0; // air
}

/* ========================================================================== */
/*                                  INVERTED                                  */
/* ========================================================================== */

/**
 * Flip a column's terrain height about sea level, so mountains become
 * hollows and caverns become spires.
 */
export function invertHeight(height: number, seaLevel: number, worldDepth: number): number {
  const mirrored = seaLevel * 2 - height;
  return Math.max(6, Math.min(worldDepth - 8, mirrored));
}

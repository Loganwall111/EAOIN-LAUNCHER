/**
 * Farming & Food Overhaul (2.0).
 *
 * A self-contained, data-driven farming + cooking system that runs on top of
 * the existing block world. Crops are represented as distinct block IDs per
 * growth stage (so no per-block metadata is needed), seeds are plantable items,
 * farmland is a block state, and cooked meals are made by combining crops.
 *
 * Everything here is pure logic so it can be unit-tested without a renderer.
 * GameCanvas wires this into the world: a growth tick advances planted crops,
 * right-click tills / plants / harvests, and a key eats food.
 */
import { BlockID } from '@shared/blocks/BlockRegistry';

/* ------------------------------------------------------------------ *
 * Block IDs introduced by this system (345+).                         *
 * ------------------------------------------------------------------ */
export const FARM = {
  // Seeds (hold + use on farmland to plant)
  WHEAT_SEED: 345,
  CARROT_SEED: 350,
  POTATO_SEED: 354,
  TOMATO_SEED: 358,
  PUMPKIN_SEED: 363,
  // Wheat (grows in 3 stages, harvested grain is its own block)
  WHEAT_SPROUT: 346,
  WHEAT_PLANT: 347,
  WHEAT_MATURE: 348,
  WHEAT_GRAIN: 349,
  // Carrot
  CARROT_SPROUT: 351,
  CARROT_PLANT: 352,
  CARROT_MATURE: 353,
  // Potato
  POTATO_SPROUT: 355,
  POTATO_PLANT: 356,
  POTATO_MATURE: 357,
  // Tomato
  TOMATO_SPROUT: 359,
  TOMATO_PLANT: 360,
  TOMATO_MATURE: 361,
  TOMATO: 362,
  // Pumpkin
  PUMPKIN_SPROUT: 364,
  PUMPKIN_VINE: 365,
  PUMPKIN_MATURE: 366,
  // Farmland
  FARMLAND: 279,          // existing
  FARMLAND_MOIST: 367,
  // Cooked meals
  TOMATO_SOUP: 368,
  VEGETABLE_STEW: 369,
  APPLE_PIE: 370,
} as const;

/** A single growable crop: seed block, per-stage block IDs, harvest drop. */
export interface CropDef {
  id: string;
  name: string;
  emoji: string;
  seedBlock: BlockID;
  /** One block id per growth stage, index 0 = just planted. */
  stageBlocks: BlockID[];
  /** Fully-grown = last index in stageBlocks. */
  matureIndex: number;
  /** Drops when a mature plant is harvested. */
  harvest: Array<{ block: BlockID; amount: number }>;
  /** Approx seconds to reach the next stage (base speed). */
  stageSeconds: number;
}

export const CROPS: CropDef[] = [
  {
    id: 'wheat', name: 'Wheat', emoji: '🌾',
    seedBlock: FARM.WHEAT_SEED,
    stageBlocks: [FARM.WHEAT_SPROUT, FARM.WHEAT_PLANT, FARM.WHEAT_MATURE],
    matureIndex: 2,
    harvest: [{ block: FARM.WHEAT_GRAIN, amount: 2 }, { block: FARM.WHEAT_SEED, amount: 1 }],
    stageSeconds: 18,
  },
  {
    id: 'carrot', name: 'Carrot', emoji: '🥕',
    seedBlock: FARM.CARROT_SEED,
    stageBlocks: [FARM.CARROT_SPROUT, FARM.CARROT_PLANT, FARM.CARROT_MATURE],
    matureIndex: 2,
    harvest: [{ block: 123, amount: 3 }, { block: FARM.CARROT_SEED, amount: 1 }],
    stageSeconds: 16,
  },
  {
    id: 'potato', name: 'Potato', emoji: '🥔',
    seedBlock: FARM.POTATO_SEED,
    stageBlocks: [FARM.POTATO_SPROUT, FARM.POTATO_PLANT, FARM.POTATO_MATURE],
    matureIndex: 2,
    harvest: [{ block: 124, amount: 3 }, { block: FARM.POTATO_SEED, amount: 1 }],
    stageSeconds: 16,
  },
  {
    id: 'tomato', name: 'Tomato', emoji: '🍅',
    seedBlock: FARM.TOMATO_SEED,
    stageBlocks: [FARM.TOMATO_SPROUT, FARM.TOMATO_PLANT, FARM.TOMATO_MATURE],
    matureIndex: 2,
    harvest: [{ block: FARM.TOMATO, amount: 3 }, { block: FARM.TOMATO_SEED, amount: 1 }],
    stageSeconds: 18,
  },
  {
    id: 'pumpkin', name: 'Pumpkin', emoji: '🎃',
    seedBlock: FARM.PUMPKIN_SEED,
    stageBlocks: [FARM.PUMPKIN_SPROUT, FARM.PUMPKIN_VINE, FARM.PUMPKIN_MATURE],
    matureIndex: 2,
    harvest: [{ block: 100, amount: 1 }, { block: FARM.PUMPKIN_SEED, amount: 2 }],
    stageSeconds: 22,
  },
];

/** Seed block → CropDef (fast lookup). */
export const CROP_BY_SEED: Map<BlockID, CropDef> = new Map(CROPS.map((c) => [c.seedBlock, c]));

/** Growth-stage block → CropDef (fast lookup). */
export const CROP_BY_STAGE_BLOCK: Map<BlockID, CropDef> = new Map(
  CROPS.flatMap((c) => c.stageBlocks.map((b) => [b, c] as [BlockID, CropDef]))
);

/** Is this block a plantable seed? */
export function isSeed(block: BlockID): boolean {
  return CROP_BY_SEED.has(block);
}

/** Is this block a farmland state (tilled and plantable)? */
export function isFarmland(block: BlockID): boolean {
  return block === FARM.FARMLAND || block === FARM.FARMLAND_MOIST;
}

/**
 * Tilling a soil block with a hoe. Dirt / grass / podzol / mycelium / grass
 * path / dirt path turn into farmland. Returns the new block id, or null if
 * the block can't be tilled.
 */
export function tillBlock(block: BlockID): BlockID | null {
  // dirt(2), grass(1), podzol(276), mycelium(277), grass path(275), dirt path(278), coarse dirt(n/a)
  if (block === 1 || block === 2 || block === 275 || block === 276 || block === 277 || block === 278) {
    return FARM.FARMLAND;
  }
  return null;
}

/**
 * Plant a seed on farmland. Returns the freshly-planted crop block (stage 0)
 * or null if this isn't a seed or the target isn't farmland.
 */
export function plantOnFarmland(seedBlock: BlockID, targetBlock: BlockID): BlockID | null {
  if (!isSeed(seedBlock)) return null;
  if (!isFarmland(targetBlock)) return null;
  const crop = CROP_BY_SEED.get(seedBlock)!;
  return crop.stageBlocks[0];
}

/** Does this block belong to a growing crop? */
export function cropOfBlock(block: BlockID): CropDef | null {
  return CROP_BY_STAGE_BLOCK.get(block) ?? null;
}

/** Is this block a fully-grown crop ready to harvest? */
export function isMatureCrop(block: BlockID): boolean {
  const crop = CROP_BY_STAGE_BLOCK.get(block);
  if (!crop) return false;
  return crop.stageBlocks.indexOf(block) >= crop.matureIndex;
}

/**
 * Advance a crop block to the stage reached after `elapsedSeconds` have passed
 * since it was planted. Returns the new block id (may equal `current` if no
 * progress or already mature).
 */
export function advanceCrop(current: BlockID, elapsedSeconds: number, speedMult = 1): BlockID {
  const crop = CROP_BY_STAGE_BLOCK.get(current);
  if (!crop) return current;
  const currentIndex = crop.stageBlocks.indexOf(current);
  if (currentIndex < 0 || currentIndex >= crop.matureIndex) return current; // already mature or unknown
  const stagesLeft = crop.matureIndex - currentIndex;
  const progress = Math.floor(elapsedSeconds / (crop.stageSeconds / speedMult));
  const advance = Math.min(progress, stagesLeft);
  if (advance <= 0) return current;
  return crop.stageBlocks[currentIndex + advance];
}

/** The drops produced by harvesting a mature crop. */
export function harvestDrops(block: BlockID): Array<{ block: BlockID; amount: number }> {
  const crop = CROP_BY_STAGE_BLOCK.get(block);
  if (!crop || crop.stageBlocks.indexOf(block) < crop.matureIndex) return [];
  return crop.harvest.map((d) => ({ block: d.block, amount: d.amount }));
}

/* ------------------------------------------------------------------ *
 * Food — eating restores hunger (+ optional health).                  *
 * ------------------------------------------------------------------ */
export interface FoodValue {
  hunger: number;
  health?: number;
  emoji: string;
}

/** Block id → nutrition. Only blocks listed here are edible. */
export const FOOD_VALUES: Record<BlockID, FoodValue> = {
  110: { hunger: 4, emoji: '🍎' },   // Apple
  111: { hunger: 5, emoji: '🍞' },   // Bread
  112: { hunger: 8, emoji: '🥩' },   // Cooked Beef
  113: { hunger: 8, emoji: '🥓' },   // Cooked Porkchop
  114: { hunger: 6, emoji: '🍗' },   // Cooked Chicken
  115: { hunger: 10, health: 4, emoji: '🍏' }, // Golden Apple
  116: { hunger: 20, health: 20, emoji: '✨' }, // Enchanted Golden Apple
  118: { hunger: 6, emoji: '🥧' },   // Pumpkin Pie
  119: { hunger: 2, emoji: '🍪' },   // Cookie
  121: { hunger: 6, emoji: '🍲' },   // Mushroom Stew
  122: { hunger: 2, emoji: '🍠' },   // Beetroot
  123: { hunger: 3, emoji: '🥕' },   // Carrot
  124: { hunger: 3, emoji: '🥔' },   // Potato
  125: { hunger: 2, emoji: '🫐' },   // Sweet Berries
  [FARM.WHEAT_GRAIN]: { hunger: 1, emoji: '🌾' },
  [FARM.TOMATO]: { hunger: 3, emoji: '🍅' },
  [FARM.TOMATO_SOUP]: { hunger: 7, emoji: '🍜' },
  [FARM.VEGETABLE_STEW]: { hunger: 8, emoji: '🍲' },
  [FARM.APPLE_PIE]: { hunger: 7, emoji: '🥧' },
};

/** Is this block edible? */
export function isFood(block: BlockID): boolean {
  return block in FOOD_VALUES;
}

/** Nutrition for a food block, or null if inedible. */
export function foodValue(block: BlockID): FoodValue | null {
  return FOOD_VALUES[block] ?? null;
}

/* ------------------------------------------------------------------ *
 * Cooking — combine crops into cooked meals.                          *
 * ------------------------------------------------------------------ */
export interface CookingRecipe {
  id: string;
  name: string;
  emoji: string;
  inputs: Array<{ block: BlockID; amount: number }>;
  output: BlockID;
  outputAmount: number;
}

export const COOKING_RECIPES: CookingRecipe[] = [
  { id: 'bread', name: 'Bread', emoji: '🍞', inputs: [{ block: FARM.WHEAT_GRAIN, amount: 3 }], output: 111, outputAmount: 1 },
  { id: 'tomato_soup', name: 'Tomato Soup', emoji: '🍜', inputs: [{ block: FARM.TOMATO, amount: 2 }, { block: 111, amount: 1 }], output: FARM.TOMATO_SOUP, outputAmount: 1 },
  { id: 'vegetable_stew', name: 'Vegetable Stew', emoji: '🍲', inputs: [{ block: 123, amount: 1 }, { block: 124, amount: 1 }, { block: FARM.TOMATO, amount: 1 }], output: FARM.VEGETABLE_STEW, outputAmount: 1 },
  { id: 'apple_pie', name: 'Apple Pie', emoji: '🥧', inputs: [{ block: 110, amount: 2 }, { block: FARM.WHEAT_GRAIN, amount: 2 }], output: FARM.APPLE_PIE, outputAmount: 1 },
  { id: 'pumpkin_pie', name: 'Pumpkin Pie', emoji: '🥧', inputs: [{ block: 100, amount: 1 }, { block: FARM.WHEAT_GRAIN, amount: 2 }], output: 118, outputAmount: 1 },
  { id: 'cookies', name: 'Cookie', emoji: '🍪', inputs: [{ block: FARM.WHEAT_GRAIN, amount: 2 }, { block: 110, amount: 1 }], output: 119, outputAmount: 2 },
];

/**
 * Given the set of blocks you have, find the first cooking recipe that can be
 * made and the remaining blocks after spending the ingredients.
 */
export function canCook(
  available: Record<BlockID, number>
): { recipe: CookingRecipe; remaining: Record<BlockID, number> } | null {
  for (const recipe of COOKING_RECIPES) {
    let ok = true;
    const remaining = { ...available };
    for (const input of recipe.inputs) {
      if ((remaining[input.block] ?? 0) < input.amount) { ok = false; break; }
      remaining[input.block] -= input.amount;
    }
    if (ok) return { recipe, remaining };
  }
  return null;
}

/** Human-readable list of a recipe's ingredients for UI messages. */
export function recipeLabel(recipe: CookingRecipe): string {
  return recipe.inputs.map((i) => `${i.amount}× #${i.block}`).join(' + ');
}

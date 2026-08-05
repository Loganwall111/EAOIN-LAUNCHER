import { describe, it, expect } from 'vitest';
import {
  CROPS, FARM, CROP_BY_SEED,
  isSeed, isFarmland, tillBlock, plantOnFarmland,
  cropOfBlock, isMatureCrop, advanceCrop, harvestDrops,
  isFood, foodValue, canCook, COOKING_RECIPES,
} from '../../src/farming/Farming';

describe('Farming — seeds, tilling, planting', () => {
  it('recognises every seed as plantable', () => {
    expect(CROPS.length).toBe(5);
    for (const c of CROPS) {
      expect(isSeed(c.seedBlock)).toBe(true);
      expect(CROP_BY_SEED.get(c.seedBlock)).toBe(c);
    }
    expect(isSeed(1)).toBe(false);
  });

  it('tills dirt/grass into farmland but not stone', () => {
    expect(tillBlock(2)).toBe(FARM.FARMLAND);   // dirt
    expect(tillBlock(1)).toBe(FARM.FARMLAND);   // grass
    expect(tillBlock(276)).toBe(FARM.FARMLAND); // podzol
    expect(tillBlock(3)).toBeNull();            // stone
    expect(tillBlock(FARM.FARMLAND)).toBeNull();// already tilled
  });

  it('plants a seed on farmland into stage 0 crop', () => {
    expect(plantOnFarmland(FARM.WHEAT_SEED, FARM.FARMLAND)).toBe(FARM.WHEAT_SPROUT);
    expect(plantOnFarmland(FARM.CARROT_SEED, FARM.FARMLAND_MOIST)).toBe(FARM.CARROT_SPROUT);
    expect(plantOnFarmland(FARM.WHEAT_SEED, 1)).toBeNull();   // not farmland
    expect(plantOnFarmland(1, FARM.FARMLAND)).toBeNull();     // not a seed
  });
});

describe('Farming — growth & harvest', () => {
  it('identifies crop blocks and maturity', () => {
    expect(cropOfBlock(FARM.WHEAT_SPROUT)?.id).toBe('wheat');
    expect(isMatureCrop(FARM.WHEAT_SPROUT)).toBe(false);
    expect(isMatureCrop(FARM.WHEAT_PLANT)).toBe(false);
    expect(isMatureCrop(FARM.WHEAT_MATURE)).toBe(true);
    expect(isMatureCrop(1)).toBe(false);
  });

  it('advances growth over time and stops at maturity', () => {
    const wheat = CROP_BY_SEED.get(FARM.WHEAT_SEED)!;
    expect(wheat.stageBlocks.length).toBe(3);
    // just planted -> after enough time -> mature
    expect(advanceCrop(FARM.WHEAT_SPROUT, 1)).toBe(FARM.WHEAT_SPROUT);
    expect(advanceCrop(FARM.WHEAT_SPROUT, wheat.stageSeconds * 3)).toBe(FARM.WHEAT_MATURE);
    // already mature stays mature
    expect(advanceCrop(FARM.WHEAT_MATURE, 999)).toBe(FARM.WHEAT_MATURE);
    // non-crop unchanged
    expect(advanceCrop(1, 999)).toBe(1);
  });

  it('advanceCrop respects speed multiplier (farming setting)', () => {
    const wheat = CROP_BY_SEED.get(FARM.WHEAT_SEED)!;
    // speedMult 2 => twice as fast, 1 stage at half the time
    expect(advanceCrop(FARM.WHEAT_SPROUT, wheat.stageSeconds * 0.6, 2)).toBe(FARM.WHEAT_PLANT);
  });

  it('harvests only mature crops and returns drops', () => {
    expect(harvestDrops(FARM.WHEAT_SPROUT)).toEqual([]);
    const drops = harvestDrops(FARM.WHEAT_MATURE);
    expect(drops).toContainEqual({ block: FARM.WHEAT_GRAIN, amount: 2 });
    expect(harvestDrops(FARM.TOMATO_MATURE)).toContainEqual({ block: FARM.TOMATO, amount: 3 });
  });
});

describe('Farming — food & eating', () => {
  it('maps food blocks to nutrition', () => {
    expect(isFood(110)).toBe(true);
    expect(isFood(FARM.TOMATO)).toBe(true);
    expect(isFood(FARM.TOMATO_SOUP)).toBe(true);
    expect(isFood(1)).toBe(false);
    expect(foodValue(FARM.APPLE_PIE)?.hunger).toBe(7);
    expect(foodValue(115)?.health).toBeGreaterThan(0); // golden apple heals
  });
});

describe('Farming — cooking recipes', () => {
  it('has bread from 3 wheat', () => {
    const r = canCook({ [FARM.WHEAT_GRAIN]: 3 });
    expect(r?.recipe.id).toBe('bread');
    expect(r?.remaining[FARM.WHEAT_GRAIN]).toBe(0);
  });

  it('cooks vegetable stew from carrot+potato+tomato', () => {
    const r = canCook({ 123: 1, 124: 1, [FARM.TOMATO]: 1 });
    expect(r?.recipe.id).toBe('vegetable_stew');
  });

  it('returns null when ingredients are insufficient', () => {
    expect(canCook({ [FARM.WHEAT_GRAIN]: 2 })).toBeNull();
    expect(canCook({})).toBeNull();
  });

  it('leaves leftovers after cooking', () => {
    const r = canCook({ [FARM.WHEAT_GRAIN]: 5 });
    expect(r?.recipe.id).toBe('bread');
    expect(r?.remaining[FARM.WHEAT_GRAIN]).toBe(2);
  });

  it('every recipe outputs an edible food block', () => {
    for (const recipe of COOKING_RECIPES) {
      expect(isFood(recipe.output)).toBe(true);
    }
  });
});

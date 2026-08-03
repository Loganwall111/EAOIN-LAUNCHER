// @vitest-environment jsdom
/**
 * 2.0 Update Part 2 — the EAOIN company remains.
 *
 * A structure at the world centre with purple water, a god hand overhead,
 * tentacles, the Encryptor and a Memory Shard. Plus the two new blocks
 * (Encryptor = 339, God Mode Block = 340).
 */
import { describe, it, expect } from 'vitest';
import { Chunk, CHUNK_SIZE } from '../../src/world/Chunk';
import { placeEAOINRemains } from '../../src/world/EAOINRemains';
import { ALL_BLOCK_IDS } from '../../shared/src/blocks/BlockRegistry';
import { RECIPES } from '../../src/crafting/RecipeBook';

const ENCRYPTOR = 339, GOD_BLOCK = 340, PURPLE_WATER = 335, SHARD = 308;

function emptyChunk(cx: number, cz: number): Chunk {
  return new Chunk(cx, cz, 'eaoin-remains', { generate: false });
}

describe('EAOIN company remains', () => {
  it('builds near the world centre (chunk 0,0)', () => {
    const chunk = emptyChunk(0, 0);
    expect(placeEAOINRemains(chunk)).toBe(true);
  });

  it('places the Encryptor and a Memory Shard at the heart', () => {
    const chunk = emptyChunk(0, 0);
    placeEAOINRemains(chunk);
    let encryptor = 0, shard = 0, water = 0, tentacle = 0, obsidian = 0;
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 38; y <= 48; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const b = chunk.getBlock(x, y, z);
          if (b === ENCRYPTOR) encryptor++;
          if (b === SHARD) shard++;
          if (b === PURPLE_WATER) water++;
          if (b === 313) tentacle++;
          if (b === 12) obsidian++;
        }
      }
    }
    expect(encryptor).toBeGreaterThan(0);
    expect(shard).toBeGreaterThan(0);
    expect(water).toBeGreaterThan(0);
    expect(tentacle).toBeGreaterThan(0);
    expect(obsidian).toBeGreaterThan(0);
  });

  it('does nothing far from the centre', () => {
    const chunk = emptyChunk(40, 40);
    expect(placeEAOINRemains(chunk)).toBe(false);
  });
});

describe('New blocks registered', () => {
  it('registers the Encryptor and God Mode Block', () => {
    expect(ALL_BLOCK_IDS).toContain(ENCRYPTOR);
    expect(ALL_BLOCK_IDS).toContain(GOD_BLOCK);
  });
});

describe('God Mode Block recipe', () => {
  it('crafts a God Mode Block from the Encryptor + a Memory Shard', () => {
    const recipe = RECIPES.find((r) => r.id === 'god_mode_block');
    expect(recipe).toBeTruthy();
    expect(recipe?.costs).toEqual([
      { blockId: 339, amount: 1 },
      { blockId: 308, amount: 1 },
    ]);
    expect(recipe?.output).toEqual({ type: 'block', blockId: 340, amount: 1 });
  });
});

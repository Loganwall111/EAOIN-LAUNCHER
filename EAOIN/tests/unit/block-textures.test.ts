/**
 * Block texture regression tests.
 *
 * The reports these pin down:
 *   - "the blocks in the inventory are complete squares… in real Minecraft
 *     blocks actually have actual textures"
 *   - "the weapons in the game are blocks — swords should be displayed in the
 *     person's hand, same with all items"
 *   - "when I'm in the trees the blocks are dark and I cannot see anything"
 *     (leaves must be cut-out, not solid, so light reaches through)
 */
import { describe, it, expect } from 'vitest';
import {
  archetypeFor,
  buildBlockTexels,
  clearTextureCache,
  faceVariantFor,
  hasFaceVariants,
  isItemSprite,
  TEXTURE_SIZE,
  VARIANT_BOTTOM,
  VARIANT_SIDE,
  VARIANT_TOP,
} from '../../src/rendering/BlockTextureSource';
import { ALL_BLOCK_IDS, getBlock } from '../../shared/src/blocks/BlockRegistry';

/** Count distinct opaque colours in a texture. */
function distinctColors(texels: Uint8ClampedArray): number {
  const seen = new Set<string>();
  for (let i = 0; i < texels.length; i += 4) {
    if (texels[i + 3] < 128) continue;
    seen.add(`${texels[i]},${texels[i + 1]},${texels[i + 2]}`);
  }
  return seen.size;
}

function transparentFraction(texels: Uint8ClampedArray): number {
  let clear = 0;
  const pixels = texels.length / 4;
  for (let i = 0; i < texels.length; i += 4) if (texels[i + 3] < 128) clear += 1;
  return clear / pixels;
}

describe('procedural block textures', () => {
  it('emits a correctly sized RGBA buffer', () => {
    const texels = buildBlockTexels({ id: 1, face: 'top' });
    expect(texels.length).toBe(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  });

  it('never renders a block as a flat single-colour square', () => {
    // This is the actual inventory complaint. Every block must have real
    // texture detail, not one solid fill.
    for (const id of ALL_BLOCK_IDS) {
      const texels = buildBlockTexels({ id, face: 'side' });
      expect(distinctColors(texels), `${getBlock(id).name} (${id})`).toBeGreaterThan(1);
    }
  });

  it('is deterministic across calls', () => {
    clearTextureCache();
    const first = Array.from(buildBlockTexels({ id: 3, face: 'side' }));
    clearTextureCache();
    const second = Array.from(buildBlockTexels({ id: 3, face: 'side' }));
    expect(second).toEqual(first);
  });

  it('gives grass a green top and a dirt-coloured bottom', () => {
    const top = buildBlockTexels({ id: 1, face: 'top' });
    const bottom = buildBlockTexels({ id: 1, face: 'bottom' });
    // Average green channel dominance on top, red dominance on the bottom.
    const avg = (t: Uint8ClampedArray, offset: number) => {
      let sum = 0;
      for (let i = offset; i < t.length; i += 4) sum += t[i];
      return sum / (t.length / 4);
    };
    expect(avg(top, 1)).toBeGreaterThan(avg(top, 0)); // green > red on top
    expect(avg(bottom, 0)).toBeGreaterThan(avg(bottom, 1)); // red > green below
  });

  it('makes leaves a cut-out so canopies are not solid black', () => {
    const leaves = buildBlockTexels({ id: 7, face: 'side' });
    const fraction = transparentFraction(leaves);
    expect(fraction).toBeGreaterThan(0.05);
    expect(fraction).toBeLessThan(0.6);
  });

  it('keeps ordinary building blocks fully opaque', () => {
    for (const id of [1, 2, 3, 24, 34]) {
      expect(transparentFraction(buildBlockTexels({ id, face: 'side' })), `${id}`).toBe(0);
    }
  });
});

describe('items versus blocks', () => {
  it('renders every weapon and tool as an item sprite, not a cube', () => {
    // "Wooden Sword" previously matched the log archetype because its name
    // contains "wood", so it was drawn as a bark-textured block.
    const items = ALL_BLOCK_IDS.filter((id) => {
      const category = getBlock(id).category;
      return category === 'weapon' || category === 'tool';
    });
    expect(items.length).toBeGreaterThan(0);
    for (const id of items) {
      expect(isItemSprite(id), `${getBlock(id).name} (${id})`).toBe(true);
      expect(archetypeFor(id), `${getBlock(id).name}`).toBe('tool');
    }
  });

  it('draws item sprites on a transparent background', () => {
    const items = ALL_BLOCK_IDS.filter((id) => getBlock(id).category === 'weapon');
    for (const id of items.slice(0, 5)) {
      expect(transparentFraction(buildBlockTexels({ id, face: 'side' })), `${id}`).toBeGreaterThan(0.4);
    }
  });

  it('never treats a solid building block as a sprite', () => {
    for (const id of [1, 2, 3, 6, 24]) {
      expect(isItemSprite(id), `${id}`).toBe(false);
    }
  });
});

describe('face variants', () => {
  it('only grass and logs need separate top/bottom materials', () => {
    expect(hasFaceVariants(1)).toBe(true);  // grass
    expect(hasFaceVariants(6)).toBe(true);  // oak log
    expect(hasFaceVariants(3)).toBe(false); // stone
    expect(hasFaceVariants(24)).toBe(false); // cobblestone
  });

  it('maps directions onto stable variant indices', () => {
    expect(faceVariantFor(1, 'top')).toBe(VARIANT_TOP);
    expect(faceVariantFor(1, 'bottom')).toBe(VARIANT_BOTTOM);
    expect(faceVariantFor(1, 'side')).toBe(VARIANT_SIDE);
    // A block without variants always reports the side material.
    expect(faceVariantFor(3, 'top')).toBe(VARIANT_SIDE);
  });
});

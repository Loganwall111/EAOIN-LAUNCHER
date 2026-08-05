import { BlockID } from '@shared/blocks/BlockRegistry';

export type InventoryStacks = Record<BlockID, number>;

// Keep the hotbar to keyboard-friendly 1–9 while surfacing the newer runtime blocks.
export const HOTBAR_BLOCKS: BlockID[] = [1, 2, 3, 6, 13, 14, 15, 18, 21];

export function createStarterInventory(): InventoryStacks {
  return {
    1: 32,
    2: 32,
    3: 32,
    4: 16,
    5: 8,
    6: 16,
    7: 16,
    8: 4,
    9: 4,
    13: 0,
    14: 0,
    15: 0,
    16: 0,
    17: 0,
    18: 0,
    19: 0,
    20: 0,
    21: 0,
    22: 0,
    23: 0,
    300: 1, // The Forgotten Journal
    345: 8, // Wheat Seeds (2.0 farming)
    350: 4, // Carrot Seeds (2.0 farming)
    354: 4, // Potato Seed (2.0 farming)
  };
}

export function getStackCount(inventory: InventoryStacks, blockId: BlockID): number {
  return inventory[blockId] ?? 0;
}

export function addToInventory(inventory: InventoryStacks, blockId: BlockID, amount = 1): InventoryStacks {
  if (blockId === 0 || amount <= 0) return inventory;
  return {
    ...inventory,
    [blockId]: getStackCount(inventory, blockId) + amount,
  };
}

export function removeFromInventory(inventory: InventoryStacks, blockId: BlockID, amount = 1): InventoryStacks {
  if (blockId === 0 || amount <= 0) return inventory;
  const current = getStackCount(inventory, blockId);
  return {
    ...inventory,
    [blockId]: Math.max(0, current - amount),
  };
}

export function canConsumeBlock(inventory: InventoryStacks, blockId: BlockID, amount = 1): boolean {
  return getStackCount(inventory, blockId) >= amount;
}

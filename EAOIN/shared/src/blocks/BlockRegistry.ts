/**
 * Block Registry — Data-driven block definitions
 * All gameplay logic flows from this registry.
 */
export type BlockID = number;

export interface BlockDef {
  id: BlockID;
  name: string;
  solid: boolean;
  transparent: boolean;
  hardness: number;
  lightLevel: number;
  emissive: boolean;
}

export const BLOCKS: Record<BlockID, BlockDef> = {
  0: { id: 0, name: 'Air', solid: false, transparent: true, hardness: 0, lightLevel: 15, emissive: false },
  1: { id: 1, name: 'Grass', solid: true, transparent: false, hardness: 0.6, lightLevel: 0, emissive: false },
  2: { id: 2, name: 'Dirt', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false },
  3: { id: 3, name: 'Stone', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false },
  4: { id: 4, name: 'Sand', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false },
  5: { id: 5, name: 'Water', solid: false, transparent: true, hardness: 0, lightLevel: 10, emissive: false },
  6: { id: 6, name: 'Wood', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false },
  7: { id: 7, name: 'Leaves', solid: true, transparent: true, hardness: 0.2, lightLevel: 0, emissive: false },
  8: { id: 8, name: 'Coal', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false },
  9: { id: 9, name: 'Iron Ore', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false },
  10: { id: 10, name: 'Gold Ore', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false },
  11: { id: 11, name: 'Diamond Ore', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false },
  12: { id: 12, name: 'Obsidian', solid: true, transparent: false, hardness: 50.0, lightLevel: 0, emissive: false },
  13: { id: 13, name: 'Logic Wire', solid: true, transparent: false, hardness: 0.35, lightLevel: 2, emissive: true },
  14: { id: 14, name: 'Signal Lamp', solid: true, transparent: false, hardness: 0.8, lightLevel: 12, emissive: true },
  15: { id: 15, name: 'Portal Core', solid: true, transparent: true, hardness: 4.0, lightLevel: 14, emissive: true },
  16: { id: 16, name: 'Crystal Shard', solid: true, transparent: true, hardness: 2.2, lightLevel: 10, emissive: true },
  17: { id: 17, name: 'Village Crate', solid: true, transparent: false, hardness: 1.1, lightLevel: 0, emissive: false },
  18: { id: 18, name: 'Command Block', solid: true, transparent: false, hardness: 3.0, lightLevel: 6, emissive: true },
  19: { id: 19, name: 'Time Machine', solid: true, transparent: false, hardness: 4.2, lightLevel: 12, emissive: true },
  20: { id: 20, name: 'Wooden Door', solid: true, transparent: true, hardness: 1.0, lightLevel: 0, emissive: false },
  21: { id: 21, name: 'Dimensional Door', solid: true, transparent: true, hardness: 3.5, lightLevel: 13, emissive: true },
  22: { id: 22, name: 'Rocket Core', solid: true, transparent: false, hardness: 4.5, lightLevel: 8, emissive: true },
  23: { id: 23, name: 'Moon Rock', solid: true, transparent: false, hardness: 2.8, lightLevel: 1, emissive: false },
};

export function getBlock(id: BlockID): BlockDef {
  return BLOCKS[id] ?? BLOCKS[0];
}

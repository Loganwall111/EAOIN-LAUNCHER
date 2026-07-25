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
};

export function getBlock(id: BlockID): BlockDef {
  return BLOCKS[id] ?? BLOCKS[0];
}

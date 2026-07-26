/**
 * Block Registry — Data-driven block definitions
 * All gameplay logic flows from this registry.
 *
 * EAOIN 1.0 — expanded to ~300 blocks across all categories:
 *  - Building blocks (wood, stone, ores, sand, glass, etc.)
 *  - Decoration blocks (slabs, stairs, fences, walls, banners)
 *  - Functional blocks (doors, beds, crafting, chests, furnaces)
 *  - Redstone / logic
 *  - Plants (saplings, flowers, crops, mushrooms)
 *  - Food & consumables
 *  - Tools & weapons
 *  - Armor
 *  - Dimension-specific blocks
 *  - Mob eggs / spawners
 *  - Technical / creative-only
 */
export type BlockID = number;

export type BlockCategory =
  | 'building'
  | 'decoration'
  | 'functional'
  | 'redstone'
  | 'plant'
  | 'food'
  | 'tool'
  | 'weapon'
  | 'armor'
  | 'ore'
  | 'fluid'
  | 'nature'
  | 'nether'
  | 'end'
  | 'space'
  | 'creative'
  | 'spawn_egg'
  | 'misc';

export interface BlockDef {
  id: BlockID;
  name: string;
  /** Two-letter short label used in compact UI tiles. */
  shortName: string;
  category: BlockCategory;
  /** Whether the block occupies a full voxel. */
  solid: boolean;
  transparent: boolean;
  hardness: number;
  lightLevel: number;
  emissive: boolean;
  /** Stacked max count for the inventory. 64 = Minecraft default. */
  stackSize: number;
  /** Color used to render the 3D voxel + the icon logo. */
  color: string;
  /** Secondary color used for gradient / texture logo. */
  accentColor?: string;
  /** Optional 8x8 ascii pattern (0/1) used to draw a more detailed pixel logo in the inventory. */
  pattern?: string[];
}

/* ---------- 0..23 — original 24 overworld core blocks ---------- */
export const BLOCKS: Record<BlockID, BlockDef> = {
  0: { id: 0, name: 'Air', shortName: '  ', category: 'misc', solid: false, transparent: true, hardness: 0, lightLevel: 15, emissive: false, stackSize: 0, color: '#00000000' },
  1: { id: 1, name: 'Grass Block', shortName: 'GR', category: 'nature', solid: true, transparent: false, hardness: 0.6, lightLevel: 0, emissive: false, stackSize: 64, color: '#6cc24a', accentColor: '#8a5a36' },
  2: { id: 2, name: 'Dirt', shortName: 'DR', category: 'nature', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#8a5a36', accentColor: '#5b3a1c' },
  3: { id: 3, name: 'Stone', shortName: 'ST', category: 'building', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#8a8a8c', accentColor: '#6a6a6d' },
  4: { id: 4, name: 'Sand', shortName: 'SD', category: 'nature', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#e6dca4', accentColor: '#c4b97c' },
  5: { id: 5, name: 'Water', shortName: 'WA', category: 'fluid', solid: false, transparent: true, hardness: 0, lightLevel: 0, emissive: false, stackSize: 0, color: '#3a86d0' },
  6: { id: 6, name: 'Oak Log', shortName: 'OL', category: 'nature', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#6b3f1d', accentColor: '#3d2210' },
  7: { id: 7, name: 'Oak Leaves', shortName: 'LF', category: 'nature', solid: true, transparent: true, hardness: 0.2, lightLevel: 0, emissive: false, stackSize: 64, color: '#3aa83a', accentColor: '#1e6a1e' },
  8: { id: 8, name: 'Coal Ore', shortName: 'CO', category: 'ore', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#3a3a3a', accentColor: '#1a1a1a' },
  9: { id: 9, name: 'Iron Ore', shortName: 'IR', category: 'ore', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#d8b48f', accentColor: '#a07a55' },
  10: { id: 10, name: 'Gold Ore', shortName: 'AU', category: 'ore', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#ffd166', accentColor: '#b9932a' },
  11: { id: 11, name: 'Diamond Ore', shortName: 'DI', category: 'ore', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#5dd6ff', accentColor: '#246f9a' },
  12: { id: 12, name: 'Obsidian', shortName: 'OB', category: 'building', solid: true, transparent: false, hardness: 50.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#20152f', accentColor: '#0a0612' },
  13: { id: 13, name: 'Redstone Wire', shortName: 'RW', category: 'redstone', solid: true, transparent: false, hardness: 0.35, lightLevel: 2, emissive: true, stackSize: 64, color: '#a82323' },
  14: { id: 14, name: 'Redstone Lamp', shortName: 'RL', category: 'redstone', solid: true, transparent: false, hardness: 0.8, lightLevel: 12, emissive: true, stackSize: 64, color: '#d9b46a' },
  15: { id: 15, name: 'Nether Portal Core', shortName: 'NP', category: 'functional', solid: true, transparent: true, hardness: 4.0, lightLevel: 14, emissive: true, stackSize: 64, color: '#7c2cff' },
  16: { id: 16, name: 'Crystal Shard', shortName: 'CS', category: 'ore', solid: true, transparent: true, hardness: 2.2, lightLevel: 10, emissive: true, stackSize: 64, color: '#63d7ff' },
  17: { id: 17, name: 'Village Crate', shortName: 'VC', category: 'functional', solid: true, transparent: false, hardness: 1.1, lightLevel: 0, emissive: false, stackSize: 64, color: '#9b6b31' },
  18: { id: 18, name: 'Command Block', shortName: 'CB', category: 'redstone', solid: true, transparent: false, hardness: 3.0, lightLevel: 6, emissive: true, stackSize: 64, color: '#caa970' },
  19: { id: 19, name: 'Time Machine', shortName: 'TM', category: 'functional', solid: true, transparent: false, hardness: 4.2, lightLevel: 12, emissive: true, stackSize: 64, color: '#a879ff' },
  20: { id: 20, name: 'Wooden Door', shortName: 'WD', category: 'functional', solid: true, transparent: true, hardness: 1.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#b07c4d' },
  21: { id: 21, name: 'Dimensional Door', shortName: 'DD', category: 'functional', solid: true, transparent: true, hardness: 3.5, lightLevel: 13, emissive: true, stackSize: 64, color: '#5dd6ff' },
  22: { id: 22, name: 'Rocket Core', shortName: 'RC', category: 'functional', solid: true, transparent: false, hardness: 4.5, lightLevel: 8, emissive: true, stackSize: 64, color: '#dde2ea' },
  23: { id: 23, name: 'Moon Rock', shortName: 'MR', category: 'space', solid: true, transparent: false, hardness: 2.8, lightLevel: 1, emissive: false, stackSize: 64, color: '#d8dde8' },

  /* ---------- 24..49 — building stone variants ---------- */
  24: { id: 24, name: 'Cobblestone', shortName: 'CB', category: 'building', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#7a7a7d' },
  25: { id: 25, name: 'Mossy Cobblestone', shortName: 'MC', category: 'building', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#6a8a4a' },
  26: { id: 26, name: 'Granite', shortName: 'GR', category: 'building', solid: true, transparent: false, hardness: 1.6, lightLevel: 0, emissive: false, stackSize: 64, color: '#a27568' },
  27: { id: 27, name: 'Diorite', shortName: 'DI', category: 'building', solid: true, transparent: false, hardness: 1.6, lightLevel: 0, emissive: false, stackSize: 64, color: '#dcd6d0' },
  28: { id: 28, name: 'Andesite', shortName: 'AN', category: 'building', solid: true, transparent: false, hardness: 1.6, lightLevel: 0, emissive: false, stackSize: 64, color: '#9a9a9a' },
  29: { id: 29, name: 'Deepslate', shortName: 'DS', category: 'building', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#4a4a52' },
  30: { id: 30, name: 'Deepslate Coal', shortName: 'DC', category: 'ore', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#2c2c34' },
  31: { id: 31, name: 'Deepslate Iron', shortName: 'DI', category: 'ore', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#b69072' },
  32: { id: 32, name: 'Deepslate Diamond', shortName: 'DD', category: 'ore', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#3a8a9a' },
  33: { id: 33, name: 'Deepslate Gold', shortName: 'DG', category: 'ore', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#d8a437' },
  34: { id: 34, name: 'Bricks', shortName: 'BR', category: 'building', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#b85e3c' },
  35: { id: 35, name: 'Stone Bricks', shortName: 'SB', category: 'building', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#9a9a9c' },
  36: { id: 36, name: 'Cracked Stone Bricks', shortName: 'CS', category: 'building', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#6a6a6d' },
  37: { id: 37, name: 'Mossy Stone Bricks', shortName: 'MB', category: 'building', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a7a4a' },
  38: { id: 38, name: 'Sandstone', shortName: 'SS', category: 'building', solid: true, transparent: false, hardness: 0.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#dcc786' },
  39: { id: 39, name: 'Red Sandstone', shortName: 'RS', category: 'building', solid: true, transparent: false, hardness: 0.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#b35a3c' },
  40: { id: 40, name: 'Prismarine', shortName: 'PR', category: 'building', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#4ab3a3' },
  41: { id: 41, name: 'Dark Prismarine', shortName: 'DP', category: 'building', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#2c5a52' },
  42: { id: 42, name: 'Purpur Block', shortName: 'PP', category: 'building', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#a879b5' },
  43: { id: 43, name: 'End Stone', shortName: 'ES', category: 'building', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#dcd28a' },
  44: { id: 44, name: 'Netherrack', shortName: 'NR', category: 'nether', solid: true, transparent: false, hardness: 0.4, lightLevel: 0, emissive: false, stackSize: 64, color: '#723232' },
  45: { id: 45, name: 'Soul Sand', shortName: 'SS', category: 'nether', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a3a2a' },
  46: { id: 46, name: 'Soul Soil', shortName: 'SL', category: 'nether', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#4a2a1c' },
  47: { id: 47, name: 'Basalt', shortName: 'BA', category: 'nether', solid: true, transparent: false, hardness: 1.25, lightLevel: 0, emissive: false, stackSize: 64, color: '#3a3a40' },
  48: { id: 48, name: 'Blackstone', shortName: 'BS', category: 'nether', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#2a2025' },
  49: { id: 49, name: 'Glowstone', shortName: 'GL', category: 'building', solid: true, transparent: true, hardness: 0.3, lightLevel: 15, emissive: true, stackSize: 64, color: '#f6df65' },

  /* ---------- 50..69 — wood + decoration ---------- */
  50: { id: 50, name: 'Spruce Log', shortName: 'SL', category: 'nature', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a3a1c' },
  51: { id: 51, name: 'Birch Log', shortName: 'BL', category: 'nature', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#d8c89a' },
  52: { id: 52, name: 'Jungle Log', shortName: 'JL', category: 'nature', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#7a5a2c' },
  53: { id: 53, name: 'Acacia Log', shortName: 'AC', category: 'nature', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a06a3a' },
  54: { id: 54, name: 'Dark Oak Log', shortName: 'DO', category: 'nature', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#3a2210' },
  55: { id: 55, name: 'Crimson Stem', shortName: 'CR', category: 'nature', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#9a3a4a' },
  56: { id: 56, name: 'Warped Stem', shortName: 'WS', category: 'nature', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#3a8a8a' },
  57: { id: 57, name: 'Oak Planks', shortName: 'OP', category: 'building', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#b07c4d' },
  58: { id: 58, name: 'Spruce Planks', shortName: 'SP', category: 'building', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#8a5a36' },
  59: { id: 59, name: 'Birch Planks', shortName: 'BP', category: 'building', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#d8c89a' },
  60: { id: 60, name: 'Jungle Planks', shortName: 'JP', category: 'building', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a07a3a' },
  61: { id: 61, name: 'Acacia Planks', shortName: 'AP', category: 'building', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#b35a3c' },
  62: { id: 62, name: 'Crimson Planks', shortName: 'CP', category: 'building', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#9a3a4a' },
  63: { id: 63, name: 'Warped Planks', shortName: 'WP', category: 'building', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#3a8a8a' },
  64: { id: 64, name: 'Glass', shortName: 'GL', category: 'building', solid: true, transparent: true, hardness: 0.3, lightLevel: 0, emissive: false, stackSize: 64, color: '#aac8e0' },
  65: { id: 65, name: 'Tinted Glass', shortName: 'TG', category: 'building', solid: true, transparent: true, hardness: 0.3, lightLevel: 0, emissive: false, stackSize: 64, color: '#2a2a2a' },
  66: { id: 66, name: 'Iron Block', shortName: 'IB', category: 'building', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#d8d8d8' },
  67: { id: 67, name: 'Gold Block', shortName: 'GB', category: 'building', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#ffd166' },
  68: { id: 68, name: 'Diamond Block', shortName: 'DB', category: 'building', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#5dd6ff' },
  69: { id: 69, name: 'Emerald Block', shortName: 'EB', category: 'building', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#4adba3' },

  /* ---------- 70..89 — wool, terracotta, concrete ---------- */
  70: { id: 70, name: 'White Wool', shortName: 'WW', category: 'decoration', solid: true, transparent: false, hardness: 0.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#e8e8e8' },
  71: { id: 71, name: 'Red Wool', shortName: 'RW', category: 'decoration', solid: true, transparent: false, hardness: 0.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#c84a4a' },
  72: { id: 72, name: 'Blue Wool', shortName: 'BW', category: 'decoration', solid: true, transparent: false, hardness: 0.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#4a6ac8' },
  73: { id: 73, name: 'Green Wool', shortName: 'GW', category: 'decoration', solid: true, transparent: false, hardness: 0.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#4ac84a' },
  74: { id: 74, name: 'Yellow Wool', shortName: 'YW', category: 'decoration', solid: true, transparent: false, hardness: 0.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#f6df65' },
  75: { id: 75, name: 'Black Wool', shortName: 'KW', category: 'decoration', solid: true, transparent: false, hardness: 0.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#1a1a1a' },
  76: { id: 76, name: 'White Terracotta', shortName: 'WT', category: 'decoration', solid: true, transparent: false, hardness: 1.25, lightLevel: 0, emissive: false, stackSize: 64, color: '#d8d2c4' },
  77: { id: 77, name: 'Terracotta', shortName: 'TC', category: 'decoration', solid: true, transparent: false, hardness: 1.25, lightLevel: 0, emissive: false, stackSize: 64, color: '#a86a52' },
  78: { id: 78, name: 'White Concrete', shortName: 'WC', category: 'decoration', solid: true, transparent: false, hardness: 1.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#dcdcdc' },
  79: { id: 79, name: 'Red Concrete', shortName: 'RC', category: 'decoration', solid: true, transparent: false, hardness: 1.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#a83232' },
  80: { id: 80, name: 'Blue Concrete', shortName: 'BC', category: 'decoration', solid: true, transparent: false, hardness: 1.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#3252a8' },
  81: { id: 81, name: 'Cyan Concrete', shortName: 'CY', category: 'decoration', solid: true, transparent: false, hardness: 1.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#329a9a' },
  82: { id: 82, name: 'Lime Concrete', shortName: 'LC', category: 'decoration', solid: true, transparent: false, hardness: 1.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#5ac84a' },
  83: { id: 83, name: 'Magenta Concrete', shortName: 'MC', category: 'decoration', solid: true, transparent: false, hardness: 1.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#a83aa8' },
  84: { id: 84, name: 'Quartz Block', shortName: 'QZ', category: 'building', solid: true, transparent: false, hardness: 0.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#e8e2d6' },
  85: { id: 85, name: 'Smooth Quartz', shortName: 'SQ', category: 'building', solid: true, transparent: false, hardness: 0.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#f0eada' },
  86: { id: 86, name: 'Marble', shortName: 'MR', category: 'building', solid: true, transparent: false, hardness: 1.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#ece8e0' },
  87: { id: 87, name: 'Limestone', shortName: 'LS', category: 'building', solid: true, transparent: false, hardness: 1.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#d6c8a8' },
  88: { id: 88, name: 'Volcanic Rock', shortName: 'VR', category: 'building', solid: true, transparent: false, hardness: 2.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#2a1a18' },
  89: { id: 89, name: 'Frozen Stone', shortName: 'FS', category: 'building', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#a8c8e0' },

  /* ---------- 90..109 — plants, nature, food ---------- */
  90: { id: 90, name: 'Oak Sapling', shortName: 'OS', category: 'plant', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#3aa83a' },
  91: { id: 91, name: 'Spruce Sapling', shortName: 'SS', category: 'plant', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#2a6a2a' },
  92: { id: 92, name: 'Birch Sapling', shortName: 'BS', category: 'plant', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#5aaa3a' },
  93: { id: 93, name: 'Poppy', shortName: 'PO', category: 'plant', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#c84a4a' },
  94: { id: 94, name: 'Dandelion', shortName: 'DA', category: 'plant', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#f6df65' },
  95: { id: 95, name: 'Blue Orchid', shortName: 'BO', category: 'plant', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#5da3d8' },
  96: { id: 96, name: 'Allium', shortName: 'AL', category: 'plant', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a879d8' },
  97: { id: 97, name: 'Mushroom', shortName: 'MU', category: 'plant', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a85a3a' },
  98: { id: 98, name: 'Cactus', shortName: 'CA', category: 'plant', solid: true, transparent: false, hardness: 0.4, lightLevel: 0, emissive: false, stackSize: 64, color: '#4a8a4a' },
  99: { id: 99, name: 'Sugar Cane', shortName: 'SC', category: 'plant', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a8d878' },
  100: { id: 100, name: 'Pumpkin', shortName: 'PK', category: 'plant', solid: true, transparent: false, hardness: 1.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#e67a1a' },
  101: { id: 101, name: 'Melon', shortName: 'ML', category: 'plant', solid: true, transparent: false, hardness: 1.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#6aaa4a' },
  102: { id: 102, name: 'Coral Block', shortName: 'CO', category: 'plant', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#e87a9a' },
  103: { id: 103, name: 'Bamboo', shortName: 'BA', category: 'plant', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#7aaa3a' },
  104: { id: 104, name: 'Cherry Leaves', shortName: 'CL', category: 'plant', solid: true, transparent: true, hardness: 0.2, lightLevel: 0, emissive: false, stackSize: 64, color: '#f0a8c8' },
  105: { id: 105, name: 'Mangrove Log', shortName: 'MG', category: 'plant', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a3a2c' },
  106: { id: 106, name: 'Glow Berries', shortName: 'GB', category: 'plant', solid: false, transparent: true, hardness: 0.0, lightLevel: 12, emissive: true, stackSize: 64, color: '#f6df65' },
  107: { id: 107, name: 'Spore Blossom', shortName: 'SB', category: 'plant', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#e87ad8' },
  108: { id: 108, name: 'Moss Block', shortName: 'MS', category: 'plant', solid: true, transparent: false, hardness: 0.2, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a8a3a' },
  109: { id: 109, name: 'Lily Pad', shortName: 'LP', category: 'plant', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#3a6a2a' },

  /* ---------- 110..129 — food ---------- */
  110: { id: 110, name: 'Apple', shortName: 'AP', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#c84a4a' },
  111: { id: 111, name: 'Bread', shortName: 'BR', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#c8a85a' },
  112: { id: 112, name: 'Cooked Beef', shortName: 'BF', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#8a4a2a' },
  113: { id: 113, name: 'Cooked Porkchop', shortName: 'PK', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a86a4a' },
  114: { id: 114, name: 'Cooked Chicken', shortName: 'CH', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#e8c8a8' },
  115: { id: 115, name: 'Golden Apple', shortName: 'GA', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#ffd166' },
  116: { id: 116, name: 'Enchanted Golden Apple', shortName: 'EG', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: true, stackSize: 64, color: '#fff7b0' },
  117: { id: 117, name: 'Cake', shortName: 'CK', category: 'food', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 1, color: '#e8d8c0' },
  118: { id: 118, name: 'Pumpkin Pie', shortName: 'PP', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#c87a3a' },
  119: { id: 119, name: 'Cookie', shortName: 'CO', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a87a3a' },
  120: { id: 120, name: 'Honey Bottle', shortName: 'HO', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 16, color: '#f6a52a' },
  121: { id: 121, name: 'Mushroom Stew', shortName: 'MS', category: 'food', solid: true, transparent: false, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#a86a3a' },
  122: { id: 122, name: 'Beetroot', shortName: 'BT', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a82a3a' },
  123: { id: 123, name: 'Carrot', shortName: 'CR', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#e87a2a' },
  124: { id: 124, name: 'Potato', shortName: 'PT', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#c8a85a' },
  125: { id: 125, name: 'Sweet Berries', shortName: 'SB', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#c8323a' },
  126: { id: 126, name: 'Glow Berries (food)', shortName: 'GB', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 6, emissive: true, stackSize: 64, color: '#f6df65' },
  127: { id: 127, name: 'Chorus Fruit', shortName: 'CF', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a879b5' },
  128: { id: 128, name: 'Phantom Membrane', shortName: 'PM', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#8a8a9a' },
  129: { id: 129, name: 'Dragon Breath', shortName: 'DB', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#a82a4a' },

  /* ---------- 130..149 — functional, beds, doors, decoration ---------- */
  130: { id: 130, name: 'Red Bed', shortName: 'BD', category: 'functional', solid: true, transparent: false, hardness: 0.2, lightLevel: 0, emissive: false, stackSize: 1, color: '#c84a4a' },
  131: { id: 131, name: 'Blue Bed', shortName: 'BD', category: 'functional', solid: true, transparent: false, hardness: 0.2, lightLevel: 0, emissive: false, stackSize: 1, color: '#4a6ac8' },
  132: { id: 132, name: 'Green Bed', shortName: 'BD', category: 'functional', solid: true, transparent: false, hardness: 0.2, lightLevel: 0, emissive: false, stackSize: 1, color: '#4ac84a' },
  133: { id: 133, name: 'Black Bed', shortName: 'BD', category: 'functional', solid: true, transparent: false, hardness: 0.2, lightLevel: 0, emissive: false, stackSize: 1, color: '#1a1a1a' },
  134: { id: 134, name: 'Iron Door', shortName: 'ID', category: 'functional', solid: true, transparent: true, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#d8d8d8' },
  135: { id: 135, name: 'Spruce Door', shortName: 'SD', category: 'functional', solid: true, transparent: true, hardness: 1.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#8a5a36' },
  136: { id: 136, name: 'Birch Door', shortName: 'BD', category: 'functional', solid: true, transparent: true, hardness: 1.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#d8c89a' },
  137: { id: 137, name: 'Crimson Door', shortName: 'CD', category: 'functional', solid: true, transparent: true, hardness: 1.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#9a3a4a' },
  138: { id: 138, name: 'Warped Door', shortName: 'WD', category: 'functional', solid: true, transparent: true, hardness: 1.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#3a8a8a' },
  139: { id: 139, name: 'Crafting Table', shortName: 'CT', category: 'functional', solid: true, transparent: false, hardness: 2.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#a06a3a' },
  140: { id: 140, name: 'Furnace', shortName: 'FN', category: 'functional', solid: true, transparent: false, hardness: 3.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a5a5a' },
  141: { id: 141, name: 'Blast Furnace', shortName: 'BF', category: 'functional', solid: true, transparent: false, hardness: 3.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#3a3a3a' },
  142: { id: 142, name: 'Smoker', shortName: 'SM', category: 'functional', solid: true, transparent: false, hardness: 3.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#6a4a3a' },
  143: { id: 143, name: 'Anvil', shortName: 'AV', category: 'functional', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#3a3a40' },
  144: { id: 144, name: 'Enchanting Table', shortName: 'ET', category: 'functional', solid: true, transparent: false, hardness: 5.0, lightLevel: 12, emissive: true, stackSize: 64, color: '#7c2cff' },
  145: { id: 145, name: 'Brewing Stand', shortName: 'BS', category: 'functional', solid: true, transparent: true, hardness: 0.5, lightLevel: 1, emissive: false, stackSize: 64, color: '#5a5a5a' },
  146: { id: 146, name: 'Chest', shortName: 'CH', category: 'functional', solid: true, transparent: false, hardness: 2.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#a06a3a' },
  147: { id: 147, name: 'Trapped Chest', shortName: 'TC', category: 'functional', solid: true, transparent: false, hardness: 2.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#a05a3a' },
  148: { id: 148, name: 'Ender Chest', shortName: 'EC', category: 'functional', solid: true, transparent: false, hardness: 22.5, lightLevel: 7, emissive: true, stackSize: 64, color: '#3a8a5a' },
  149: { id: 149, name: 'Barrel', shortName: 'BR', category: 'functional', solid: true, transparent: false, hardness: 2.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#8a5a36' },

  /* ---------- 150..169 — redstone / functional technical ---------- */
  150: { id: 150, name: 'Lever', shortName: 'LV', category: 'redstone', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#8a5a36' },
  151: { id: 151, name: 'Button', shortName: 'BT', category: 'redstone', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#c8a85a' },
  152: { id: 152, name: 'Pressure Plate', shortName: 'PP', category: 'redstone', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#d8d8d8' },
  153: { id: 153, name: 'Tripwire Hook', shortName: 'TH', category: 'redstone', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#a06a3a' },
  154: { id: 154, name: 'Piston', shortName: 'PS', category: 'redstone', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#8a5a36' },
  155: { id: 155, name: 'Sticky Piston', shortName: 'SP', category: 'redstone', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#6aaa4a' },
  156: { id: 156, name: 'Dropper', shortName: 'DR', category: 'redstone', solid: true, transparent: false, hardness: 3.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a5a5a' },
  157: { id: 157, name: 'Dispenser', shortName: 'DS', category: 'redstone', solid: true, transparent: false, hardness: 3.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#6a6a6a' },
  158: { id: 158, name: 'Hopper', shortName: 'HP', category: 'redstone', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#4a4a4a' },
  159: { id: 159, name: 'Daylight Detector', shortName: 'DD', category: 'redstone', solid: true, transparent: false, hardness: 0.2, lightLevel: 0, emissive: false, stackSize: 64, color: '#a06a3a' },
  160: { id: 160, name: 'Observer', shortName: 'OB', category: 'redstone', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a5a5a' },
  161: { id: 161, name: 'Repeater', shortName: 'RP', category: 'redstone', solid: true, transparent: false, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a85a5a' },
  162: { id: 162, name: 'Comparator', shortName: 'CM', category: 'redstone', solid: true, transparent: false, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a8a05a' },
  163: { id: 163, name: 'Note Block', shortName: 'NB', category: 'redstone', solid: true, transparent: false, hardness: 0.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#8a5a36' },
  164: { id: 164, name: 'Jukebox', shortName: 'JB', category: 'functional', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#6a3a1a' },
  165: { id: 165, name: 'Target', shortName: 'TG', category: 'redstone', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#e8e8e8' },
  166: { id: 166, name: 'Tripwire', shortName: 'TW', category: 'redstone', solid: true, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#c8c8c8' },
  167: { id: 167, name: 'TNT', shortName: 'TN', category: 'redstone', solid: true, transparent: false, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#c83232' },
  168: { id: 168, name: 'Lectern', shortName: 'LT', category: 'functional', solid: true, transparent: false, hardness: 2.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#a06a3a' },
  169: { id: 169, name: 'Loom', shortName: 'LM', category: 'functional', solid: true, transparent: false, hardness: 2.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#a06a3a' },

  /* ---------- 170..189 — weapons ---------- */
  170: { id: 170, name: 'Wooden Sword', shortName: 'WS', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#b07c4d', accentColor: '#5a3617' },
  171: { id: 171, name: 'Stone Sword', shortName: 'SS', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#7a7a7d', accentColor: '#3a3a3d' },
  172: { id: 172, name: 'Iron Sword', shortName: 'IS', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#d8d8d8', accentColor: '#5a5a5d' },
  173: { id: 173, name: 'Diamond Sword', shortName: 'DS', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#5dd6ff', accentColor: '#246f9a' },
  174: { id: 174, name: 'Netherite Sword', shortName: 'NS', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#3a2a2a', accentColor: '#1a0a0a' },
  175: { id: 175, name: 'Golden Sword', shortName: 'GS', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#ffd166', accentColor: '#b9932a' },
  176: { id: 176, name: 'Bow', shortName: 'BW', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#a06a3a' },
  177: { id: 177, name: 'Crossbow', shortName: 'CB', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#5a3a1c' },
  178: { id: 178, name: 'Arrow', shortName: 'AR', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#d8d8d8' },
  179: { id: 179, name: 'Trident', shortName: 'TR', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#5dd6ff' },
  180: { id: 180, name: 'Shield', shortName: 'SH', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#a06a3a' },
  181: { id: 181, name: 'Mace', shortName: 'MC', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#5a5a5d' },
  182: { id: 182, name: 'Spear', shortName: 'SP', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#8a5a36' },
  183: { id: 183, name: 'Fireball Scroll', shortName: 'FB', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: true, stackSize: 16, color: '#ff6a3a' },
  184: { id: 184, name: 'Ice Shard', shortName: 'IS', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a8d8ff' },
  185: { id: 185, name: 'Shadow Blade', shortName: 'SB', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#2a1a3a' },
  186: { id: 186, name: 'Plasma Rifle', shortName: 'PR', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: true, stackSize: 1, color: '#5dd6ff' },
  187: { id: 187, name: 'Laser Sword', shortName: 'LS', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 12, emissive: true, stackSize: 1, color: '#a832ff' },
  188: { id: 188, name: 'Cosmic Bow', shortName: 'CB', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 8, emissive: true, stackSize: 1, color: '#7c2cff' },
  189: { id: 189, name: 'Void Staff', shortName: 'VS', category: 'weapon', solid: false, transparent: true, hardness: 0.0, lightLevel: 4, emissive: true, stackSize: 1, color: '#1a0a3a' },

  /* ---------- 190..209 — armor ---------- */
  190: { id: 190, name: 'Leather Helmet', shortName: 'LH', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#8a5a36' },
  191: { id: 191, name: 'Leather Chestplate', shortName: 'LC', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#8a5a36' },
  192: { id: 192, name: 'Leather Leggings', shortName: 'LL', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#8a5a36' },
  193: { id: 193, name: 'Leather Boots', shortName: 'LB', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#8a5a36' },
  194: { id: 194, name: 'Iron Helmet', shortName: 'IH', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#d8d8d8' },
  195: { id: 195, name: 'Iron Chestplate', shortName: 'IC', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#d8d8d8' },
  196: { id: 196, name: 'Iron Leggings', shortName: 'IL', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#d8d8d8' },
  197: { id: 197, name: 'Iron Boots', shortName: 'IB', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#d8d8d8' },
  198: { id: 198, name: 'Diamond Helmet', shortName: 'DH', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#5dd6ff' },
  199: { id: 199, name: 'Diamond Chestplate', shortName: 'DC', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#5dd6ff' },
  200: { id: 200, name: 'Diamond Leggings', shortName: 'DL', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#5dd6ff' },
  201: { id: 201, name: 'Diamond Boots', shortName: 'DB', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#5dd6ff' },
  202: { id: 202, name: 'Netherite Helmet', shortName: 'NH', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#3a2a2a' },
  203: { id: 203, name: 'Netherite Chestplate', shortName: 'NC', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#3a2a2a' },
  204: { id: 204, name: 'Netherite Leggings', shortName: 'NL', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#3a2a2a' },
  205: { id: 205, name: 'Netherite Boots', shortName: 'NB', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#3a2a2a' },
  206: { id: 206, name: 'Turtle Helmet', shortName: 'TH', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#4ac84a' },
  207: { id: 207, name: 'Elytra', shortName: 'EL', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#5a3a1c' },
  208: { id: 208, name: 'Space Helmet', shortName: 'SH', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#dde2ea' },
  209: { id: 209, name: 'Space Chestplate', shortName: 'SC', category: 'armor', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#dde2ea' },

  /* ---------- 210..229 — space + dimension blocks ---------- */
  210: { id: 210, name: 'Meteorite', shortName: 'ME', category: 'space', solid: true, transparent: false, hardness: 4.0, lightLevel: 2, emissive: false, stackSize: 64, color: '#3a2a1a' },
  211: { id: 211, name: 'Star Block', shortName: 'SB', category: 'space', solid: true, transparent: false, hardness: 1.0, lightLevel: 15, emissive: true, stackSize: 64, color: '#fff7c8' },
  212: { id: 212, name: 'Nebula Glass', shortName: 'NG', category: 'space', solid: true, transparent: true, hardness: 0.3, lightLevel: 12, emissive: true, stackSize: 64, color: '#a879ff' },
  213: { id: 213, name: 'Asteroid Rock', shortName: 'AR', category: 'space', solid: true, transparent: false, hardness: 3.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a4a3a' },
  214: { id: 214, name: 'Comet Ice', shortName: 'CI', category: 'space', solid: true, transparent: true, hardness: 1.0, lightLevel: 4, emissive: true, stackSize: 64, color: '#a8d8ff' },
  215: { id: 215, name: 'Black Hole Fragment', shortName: 'BH', category: 'space', solid: true, transparent: false, hardness: 50.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#000000' },
  216: { id: 216, name: 'Pulsar Crystal', shortName: 'PC', category: 'space', solid: true, transparent: true, hardness: 5.0, lightLevel: 14, emissive: true, stackSize: 64, color: '#5dd6ff' },
  217: { id: 217, name: 'Quasar Core', shortName: 'QC', category: 'space', solid: true, transparent: false, hardness: 7.0, lightLevel: 15, emissive: true, stackSize: 64, color: '#fff5a0' },
  218: { id: 218, name: 'Volcanic Core', shortName: 'VC', category: 'nether', solid: true, transparent: false, hardness: 5.0, lightLevel: 14, emissive: true, stackSize: 64, color: '#ff5a1a' },
  219: { id: 219, name: 'Magma Block', shortName: 'MG', category: 'nether', solid: true, transparent: false, hardness: 0.5, lightLevel: 3, emissive: true, stackSize: 64, color: '#a82a1a' },
  220: { id: 220, name: 'Blue Ice', shortName: 'BI', category: 'building', solid: true, transparent: true, hardness: 2.8, lightLevel: 0, emissive: false, stackSize: 64, color: '#5dafe0' },
  221: { id: 221, name: 'Packed Ice', shortName: 'PI', category: 'building', solid: true, transparent: true, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#a8d8f0' },
  222: { id: 222, name: 'Frozen Wasteland Stone', shortName: 'FW', category: 'building', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#c8d8e8' },
  223: { id: 223, name: 'Crystal Realm Block', shortName: 'CR', category: 'building', solid: true, transparent: true, hardness: 3.0, lightLevel: 12, emissive: true, stackSize: 64, color: '#a879ff' },
  224: { id: 224, name: 'Shadow Stone', shortName: 'SS', category: 'building', solid: true, transparent: false, hardness: 4.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#1a0a1a' },
  225: { id: 225, name: 'Astral Block', shortName: 'AS', category: 'building', solid: true, transparent: true, hardness: 2.0, lightLevel: 8, emissive: true, stackSize: 64, color: '#a832ff' },
  226: { id: 226, name: 'Toxic Sludge', shortName: 'TS', category: 'fluid', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 0, color: '#5aaa1a' },
  227: { id: 227, name: 'Lava', shortName: 'LV', category: 'fluid', solid: false, transparent: true, hardness: 0.0, lightLevel: 15, emissive: true, stackSize: 0, color: '#ff5a1a' },
  228: { id: 228, name: 'Ancient Stone', shortName: 'AS', category: 'building', solid: true, transparent: false, hardness: 6.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#7a6a5a' },
  229: { id: 229, name: 'Machine Block', shortName: 'MB', category: 'building', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#3a3a40' },

  /* ---------- 230..249 — tech + utilities ---------- */
  230: { id: 230, name: 'Copper Wire', shortName: 'CW', category: 'redstone', solid: true, transparent: false, hardness: 0.3, lightLevel: 0, emissive: false, stackSize: 64, color: '#c87a3a' },
  231: { id: 231, name: 'Solar Panel', shortName: 'SP', category: 'redstone', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#2a4a7a' },
  232: { id: 232, name: 'Battery', shortName: 'BA', category: 'redstone', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#5ac84a' },
  233: { id: 233, name: 'Wind Turbine', shortName: 'WT', category: 'functional', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#e8e8e8' },
  234: { id: 234, name: 'Nuclear Reactor', shortName: 'NR', category: 'functional', solid: true, transparent: false, hardness: 7.0, lightLevel: 8, emissive: true, stackSize: 64, color: '#3a3a40' },
  235: { id: 235, name: 'Tesla Coil', shortName: 'TC', category: 'functional', solid: true, transparent: false, hardness: 4.0, lightLevel: 10, emissive: true, stackSize: 64, color: '#a8c8e8' },
  236: { id: 236, name: 'Factory', shortName: 'FA', category: 'functional', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a5a5a' },
  237: { id: 237, name: 'Spaceship', shortName: 'SS', category: 'functional', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#dde2ea' },
  238: { id: 238, name: 'Submarine', shortName: 'SB', category: 'functional', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#3a4a5a' },
  239: { id: 239, name: 'Airship', shortName: 'AS', category: 'functional', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#a06a3a' },
  240: { id: 240, name: 'Train', shortName: 'TR', category: 'functional', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#3a4a3a' },
  241: { id: 241, name: 'Car', shortName: 'CR', category: 'functional', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#c84a4a' },
  242: { id: 242, name: 'Satellite', shortName: 'ST', category: 'functional', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#d8d8d8' },
  243: { id: 243, name: 'Space Elevator', shortName: 'SE', category: 'functional', solid: true, transparent: false, hardness: 5.0, lightLevel: 4, emissive: true, stackSize: 64, color: '#a8c8e8' },
  244: { id: 244, name: 'Terraformer', shortName: 'TF', category: 'functional', solid: true, transparent: false, hardness: 5.0, lightLevel: 6, emissive: true, stackSize: 64, color: '#5ac84a' },
  245: { id: 245, name: 'Wand (Magic)', shortName: 'WN', category: 'tool', solid: false, transparent: true, hardness: 0.0, lightLevel: 4, emissive: true, stackSize: 1, color: '#a879ff' },
  246: { id: 246, name: 'Spellbook', shortName: 'SP', category: 'tool', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#6a3a8a' },
  247: { id: 247, name: 'Magic Crystal', shortName: 'MC', category: 'ore', solid: true, transparent: true, hardness: 2.0, lightLevel: 10, emissive: true, stackSize: 64, color: '#a879ff' },
  248: { id: 248, name: 'Potion', shortName: 'PT', category: 'food', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#a832ff' },
  249: { id: 249, name: 'Ancient Rune', shortName: 'AR', category: 'misc', solid: true, transparent: false, hardness: 0.5, lightLevel: 8, emissive: true, stackSize: 64, color: '#c8a85a' },

  /* ---------- 250..269 — creative-only + spawn eggs ---------- */
  250: { id: 250, name: 'Spawn Egg (Sheep)', shortName: 'ES', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#e8e8e8' },
  251: { id: 251, name: 'Spawn Egg (Pig)', shortName: 'EP', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#f0a8a8' },
  252: { id: 252, name: 'Spawn Egg (Cow)', shortName: 'EC', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a3a2a' },
  253: { id: 253, name: 'Spawn Egg (Zombie)', shortName: 'EZ', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#4ac84a' },
  254: { id: 254, name: 'Spawn Egg (Skeleton)', shortName: 'EK', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#e8e8e8' },
  255: { id: 255, name: 'Spawn Egg (Creeper)', shortName: 'ER', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#6ac84a' },
  256: { id: 256, name: 'Spawn Egg (Enderman)', shortName: 'EE', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#1a0a3a' },
  257: { id: 257, name: 'Spawn Egg (Dragon)', shortName: 'ED', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#1a0a0a' },
  258: { id: 258, name: 'Spawn Egg (Wither)', shortName: 'EW', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#1a0a0a' },
  259: { id: 259, name: 'Spawn Egg (Alien Queen)', shortName: 'EQ', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#5dd6ff' },
  260: { id: 260, name: 'Spawn Egg (Cosmic Guardian)', shortName: 'EG', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a879ff' },
  261: { id: 261, name: 'Spawn Egg (Frost King)', shortName: 'EF', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a8d8ff' },
  262: { id: 262, name: 'Spawn Egg (Volcano Lord)', shortName: 'EV', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#ff5a1a' },
  263: { id: 263, name: 'Spawn Egg (Ocean Leviathan)', shortName: 'EO', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#3a86d0' },
  264: { id: 264, name: 'Spawn Egg (Jungle Guardian)', shortName: 'EJ', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#3aa83a' },
  265: { id: 265, name: 'Spawn Egg (Sand Colossus)', shortName: 'ES', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#c8a85a' },
  266: { id: 266, name: 'Spawn Egg (Space Kraken)', shortName: 'EK', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#1a0a3a' },
  267: { id: 267, name: 'Spawn Egg (Void Emperor)', shortName: 'EV', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#1a0a1a' },
  268: { id: 268, name: 'Spawn Egg (Shadow King)', shortName: 'ES', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#2a1a3a' },
  269: { id: 269, name: 'Spawn Egg (Planet Devourer)', shortName: 'EP', category: 'spawn_egg', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#3a2a1a' },

  /* ---------- 270..299 — creative-only / technical / scenery ---------- */
  270: { id: 270, name: 'Barrier', shortName: 'BR', category: 'creative', solid: true, transparent: true, hardness: 50.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#c8c8c8' },
  271: { id: 271, name: 'Structure Block', shortName: 'SB', category: 'creative', solid: true, transparent: false, hardness: 50.0, lightLevel: 4, emissive: true, stackSize: 64, color: '#3a3a40' },
  272: { id: 272, name: 'Jigsaw Block', shortName: 'JW', category: 'creative', solid: true, transparent: false, hardness: 50.0, lightLevel: 4, emissive: true, stackSize: 64, color: '#5a5a5a' },
  273: { id: 273, name: 'Light Block', shortName: 'LB', category: 'creative', solid: true, transparent: true, hardness: 50.0, lightLevel: 15, emissive: true, stackSize: 64, color: '#fff5a0' },
  274: { id: 274, name: 'Debug Stick', shortName: 'DS', category: 'creative', solid: false, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#a83232' },
  275: { id: 275, name: 'Grass Path', shortName: 'GP', category: 'nature', solid: true, transparent: false, hardness: 0.65, lightLevel: 0, emissive: false, stackSize: 64, color: '#a89060' },
  276: { id: 276, name: 'Podzol', shortName: 'PZ', category: 'nature', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a3a1a' },
  277: { id: 277, name: 'Mycelium', shortName: 'MY', category: 'nature', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#6a5a7a' },
  278: { id: 278, name: 'Dirt Path', shortName: 'DP', category: 'nature', solid: true, transparent: false, hardness: 0.65, lightLevel: 0, emissive: false, stackSize: 64, color: '#8a5a36' },
  279: { id: 279, name: 'Farmland', shortName: 'FL', category: 'nature', solid: true, transparent: false, hardness: 0.6, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a3a1c' },
  280: { id: 280, name: 'Hay Bale', shortName: 'HB', category: 'nature', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#c8a85a' },
  281: { id: 281, name: 'Target', shortName: 'TG', category: 'redstone', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#e8e8e8' },
  282: { id: 282, name: 'Bell', shortName: 'BL', category: 'functional', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#ffd166' },
  283: { id: 283, name: 'Lantern', shortName: 'LT', category: 'functional', solid: false, transparent: true, hardness: 3.5, lightLevel: 15, emissive: true, stackSize: 64, color: '#f6a52a' },
  284: { id: 284, name: 'Soul Lantern', shortName: 'SL', category: 'functional', solid: false, transparent: true, hardness: 3.5, lightLevel: 10, emissive: true, stackSize: 64, color: '#5dd6ff' },
  285: { id: 285, name: 'Chain', shortName: 'CH', category: 'decoration', solid: true, transparent: true, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a5a5a' },
  286: { id: 286, name: 'Iron Bars', shortName: 'IB', category: 'decoration', solid: true, transparent: true, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a8a8a8' },
  287: { id: 287, name: 'Glass Pane', shortName: 'GP', category: 'decoration', solid: true, transparent: true, hardness: 0.3, lightLevel: 0, emissive: false, stackSize: 64, color: '#aac8e0' },
  288: { id: 288, name: 'Fence', shortName: 'FE', category: 'decoration', solid: true, transparent: true, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a06a3a' },
  289: { id: 289, name: 'Fence Gate', shortName: 'FG', category: 'functional', solid: true, transparent: true, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#a06a3a' },
  290: { id: 290, name: 'Wall', shortName: 'WA', category: 'decoration', solid: true, transparent: false, hardness: 2.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#7a7a7d' },
  291: { id: 291, name: 'Stairs (Stone)', shortName: 'SS', category: 'decoration', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#7a7a7d' },
  292: { id: 292, name: 'Slab (Stone)', shortName: 'SL', category: 'decoration', solid: true, transparent: false, hardness: 1.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#7a7a7d' },
  293: { id: 293, name: 'Pressure Plate (Heavy)', shortName: 'HP', category: 'redstone', solid: true, transparent: false, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#5a5a5a' },
  294: { id: 294, name: 'Item Frame', shortName: 'IF', category: 'decoration', solid: true, transparent: true, hardness: 0.5, lightLevel: 0, emissive: false, stackSize: 64, color: '#a06a3a' },
  295: { id: 295, name: 'Painting', shortName: 'PT', category: 'decoration', solid: true, transparent: true, hardness: 0.0, lightLevel: 0, emissive: false, stackSize: 64, color: '#d8c89a' },
  296: { id: 296, name: 'Banner', shortName: 'BN', category: 'decoration', solid: true, transparent: true, hardness: 1.0, lightLevel: 0, emissive: false, stackSize: 16, color: '#e8e8e8' },
  297: { id: 297, name: 'Carved Pumpkin', shortName: 'CP', category: 'decoration', solid: true, transparent: false, hardness: 1.0, lightLevel: 14, emissive: true, stackSize: 64, color: '#e67a1a' },
  298: { id: 298, name: 'Jack o Lantern', shortName: 'JL', category: 'decoration', solid: true, transparent: false, hardness: 1.0, lightLevel: 15, emissive: true, stackSize: 64, color: '#e67a1a' },
  299: { id: 299, name: 'Bee Nest', shortName: 'BN', category: 'decoration', solid: true, transparent: false, hardness: 0.3, lightLevel: 0, emissive: false, stackSize: 64, color: '#c8a85a' },
};

/* ---------- All registered block IDs (so iteration is stable) ---------- */
export const ALL_BLOCK_IDS: BlockID[] = Object.keys(BLOCKS)
  .map((k) => Number(k))
  .filter((id) => id !== 0)
  .sort((a, b) => a - b);

/* ---------- Quick lookup helpers ---------- */
export function getBlock(id: BlockID): BlockDef {
  return BLOCKS[id] ?? BLOCKS[0];
}

export function getBlocksByCategory(category: BlockCategory): BlockDef[] {
  return ALL_BLOCK_IDS.map(getBlock).filter((b) => b.category === category);
}

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  building: 'Building Blocks',
  decoration: 'Decoration',
  functional: 'Functional',
  redstone: 'Redstone',
  plant: 'Plants',
  food: 'Food',
  tool: 'Tools',
  weapon: 'Weapons & Combat',
  armor: 'Armor',
  ore: 'Ores & Minerals',
  fluid: 'Fluids',
  nature: 'Nature',
  nether: 'Nether',
  end: 'The End',
  space: 'Space',
  creative: 'Creative Only',
  spawn_egg: 'Spawn Eggs',
  misc: 'Misc',
};

export const CATEGORY_ORDER: BlockCategory[] = [
  'building', 'decoration', 'functional', 'redstone', 'plant', 'food',
  'tool', 'weapon', 'armor', 'ore', 'fluid', 'nature', 'nether', 'end',
  'space', 'creative', 'spawn_egg', 'misc',
];

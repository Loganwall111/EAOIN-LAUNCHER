/**
 * ModPackRegistry — EAOIN 1.0 official modding support.
 *
 * Mods register blocks, items, recipes, dimensions, mobs, bosses, quests, etc.
 * through a typed API. The registry keeps the loaded mods in memory and
 * lets the user enable/disable them from the dedicated Mods menu (key: F7).
 */

import { BlockDef } from '@shared/blocks/BlockRegistry';
import { RuntimeDimensionID } from '../dimensions/DimensionRuntime';

export type ModID = string;

export interface ModDefinition {
  id: ModID;
  name: string;
  author: string;
  version: string;
  description: string;
  category: 'tech' | 'magic' | 'decoration' | 'biomes' | 'mobs' | 'space' | 'totality' | 'qol' | 'tools' | 'overhaul';
  icon: string;
  enabled: boolean;
  /** What this mod adds. */
  adds: {
    blocks?: BlockDef[];
    items?: number[];
    recipes?: string[];
    dimensions?: RuntimeDimensionID[];
    biomes?: string[];
    mobs?: string[];
    bosses?: string[];
    commands?: string[];
  };
  /** Mod has a config screen? */
  configurable: boolean;
  /** Downloads counter (cosmetic) */
  downloads: number;
}

const MODS: ModDefinition[] = [
  {
    id: 'jei_integration',
    name: 'JEI Integration',
    author: 'EAOIN Team',
    version: '1.0.0',
    description: 'Just Enough Items — shows all crafting recipes in the JEI side panel.',
    category: 'qol',
    icon: '📖',
    enabled: true,
    adds: { recipes: ['all'] },
    configurable: true,
    downloads: 2_400_000,
  },
  {
    id: 'optifine_alternative',
    name: 'Performance++',
    author: 'Community',
    version: '1.0.0',
    description: 'Boosts FPS by 30-60% with smarter chunk meshing, culling, and instancing.',
    category: 'qol',
    icon: '⚡',
    enabled: true,
    adds: {},
    configurable: true,
    downloads: 1_850_000,
  },
  {
    id: 'biomes_o_plenty',
    name: 'Biomes O\' Plenty',
    author: 'Community',
    version: '4.0.0',
    description: 'Adds 90+ new biomes including cherry grove, alps, lavender fields, and more.',
    category: 'biomes',
    icon: '🌸',
    enabled: true,
    adds: { biomes: ['cherry_grove', 'alps', 'lavender', 'maple', 'redwood', 'giant_mushroom', 'mystic_woods', 'haunted'] },
    configurable: false,
    downloads: 5_700_000,
  },
  {
    id: 'twilight_forest',
    name: 'Twilight Forest',
    author: 'Benimatic',
    version: '1.0.0',
    description: 'A whole new dimension of dense enchanted forest with its own progression boss chain.',
    category: 'totality',
    icon: '🌲',
    enabled: false,
    adds: { dimensions: ['twilight_forest' as RuntimeDimensionID], bosses: ['Naga', 'Twilight Lich', 'Minoshroom', 'Hydra', 'Knight Phantom', 'Ur-Ghast', 'Twilight Hydra'] },
    configurable: true,
    downloads: 4_100_000,
  },
  {
    id: 'galacticraft',
    name: 'Galacticraft',
    author: 'micdoodle8',
    version: '1.0.0',
    description: 'Build rockets, space stations, and conquer the Moon, Mars, Venus, and beyond.',
    category: 'space',
    icon: '🚀',
    enabled: true,
    adds: { dimensions: ['moon', 'alien_worlds', 'gas_giant' as RuntimeDimensionID, 'cosmic_void' as RuntimeDimensionID], blocks: [
      { id: 240, name: 'NASA Workbench', shortName: 'NW', category: 'functional', solid: true, transparent: false, hardness: 5.0, lightLevel: 0, emissive: false, stackSize: 1, color: '#dde2ea' },
    ] },
    configurable: true,
    downloads: 3_900_000,
  },
  {
    id: 'tinkers_construct',
    name: 'Tinkers\' Construct',
    author: 'mDiyo',
    version: '1.0.0',
    description: 'Custom tool crafting: smelt metal, cast parts, build modular weapons.',
    category: 'tools',
    icon: '🔨',
    enabled: false,
    adds: { items: [240, 241, 242, 243] },
    configurable: true,
    downloads: 3_300_000,
  },
  {
    id: 'ice_and_fire',
    name: 'Ice and Fire',
    author: 'AlexThe666',
    version: '1.0.0',
    description: 'Adds 3 dragon types (ice, fire, lightning), cyclops, siren, gorgon, and 30+ new mobs.',
    category: 'mobs',
    icon: '🐉',
    enabled: true,
    adds: { mobs: ['ice_dragon', 'fire_dragon', 'lightning_dragon', 'cyclops', 'siren', 'gorgon', 'hippogryph', 'coyote', 'death_worm'], bosses: ['Ice Dragon', 'Fire Dragon', 'Lightning Dragon'] },
    configurable: true,
    downloads: 6_200_000,
  },
  {
    id: 'create',
    name: 'Create',
    author: 'simibubi',
    version: '1.0.0',
    description: 'Mechanical mod: gears, belts, encased fans, trains, steam engines.',
    category: 'tech',
    icon: '⚙',
    enabled: false,
    adds: { blocks: [], items: [245, 246, 247] },
    configurable: true,
    downloads: 7_800_000,
  },
  {
    id: 'botania',
    name: 'Botania',
    author: 'Vazkii',
    version: '1.0.0',
    description: 'Magic mod based on natural resources: flowers, mana, and gentle progression.',
    category: 'magic',
    icon: '🌸',
    enabled: false,
    adds: {},
    configurable: true,
    downloads: 2_900_000,
  },
  {
    id: 'thaumcraft',
    name: 'Thaumcraft',
    author: 'Azanor',
    version: '1.0.0',
    description: 'Magic mod: research, infusion, golems, eldritch bosses, and warp.',
    category: 'magic',
    icon: '✨',
    enabled: false,
    adds: { bosses: ['Thaumcraft Tainted', 'Cthulhu Fragment'] },
    configurable: true,
    downloads: 1_700_000,
  },
  {
    id: 'mekanism',
    name: 'Mekanism',
    author: 'aidancbrady',
    version: '1.0.0',
    description: 'Tech mod: jetpacks, quantum armor, fusion reactors, mining lasers, factories.',
    category: 'tech',
    icon: '🛸',
    enabled: false,
    adds: { items: [248, 249] },
    configurable: true,
    downloads: 2_100_000,
  },
  {
    id: 'pixelmon',
    name: 'Pixelmon',
    author: 'SirBenet',
    version: '1.0.0',
    description: 'Adds Pokémon-style creatures, capture, train, and battle.',
    category: 'totality',
    icon: '🐱',
    enabled: false,
    adds: { mobs: ['pixelmon_creature_1', 'pixelmon_creature_2', 'pixelmon_creature_3'] },
    configurable: true,
    downloads: 1_400_000,
  },
  {
    id: 'alex_mobs',
    name: 'Alex\'s Mobs',
    author: 'AlexThe666',
    version: '1.0.0',
    description: 'Adds 80+ new animals and monsters: bone serpents, tarantulas, frogs, elephant.',
    category: 'mobs',
    icon: '🦌',
    enabled: true,
    adds: { mobs: ['bone_serpent', 'tarantula_hawk', 'moose', 'gorilla', 'orca', 'crow', 'potoo', 'mantis_shrimp', 'tiger', 'kangaroo'] },
    configurable: false,
    downloads: 3_200_000,
  },
  {
    id: 'quark',
    name: 'Quark',
    author: 'Vazkii',
    version: '1.0.0',
    description: 'Vanilla+ mod adding tons of small features, blocks, and items.',
    category: 'overhaul',
    icon: '🧩',
    enabled: false,
    adds: {},
    configurable: true,
    downloads: 2_800_000,
  },
  {
    id: 'littletiles',
    name: 'LittleTiles',
    author: 'CreativeMD',
    version: '1.0.0',
    description: 'Build at sub-block scale with custom-sized tiles.',
    category: 'decoration',
    icon: '🔲',
    enabled: false,
    adds: {},
    configurable: true,
    downloads: 950_000,
  },
  {
    id: 'chisel_and_bits',
    name: 'Chisel & Bits',
    author: 'AlgorithmX2',
    version: '1.0.0',
    description: 'Detail your builds by chiseling individual bits of blocks.',
    category: 'decoration',
    icon: '🪚',
    enabled: false,
    adds: {},
    configurable: true,
    downloads: 1_100_000,
  },
  {
    id: 'mr_crayfish_furniture',
    name: 'MrCrayfish Furniture',
    author: 'MrCrayfish',
    version: '1.0.0',
    description: '100+ decoration items: chairs, tables, fridges, TVs, lamps, and more.',
    category: 'decoration',
    icon: '🛋',
    enabled: true,
    adds: {},
    configurable: false,
    downloads: 2_600_000,
  },
];

export const ALL_MODS: ModDefinition[] = MODS;

export function getMod(id: ModID): ModDefinition {
  return MODS.find((m) => m.id === id) ?? MODS[0];
}

export function getModsByCategory(category: ModDefinition['category']): ModDefinition[] {
  return MODS.filter((m) => m.category === category);
}

export const MOD_CATEGORIES: ModDefinition['category'][] = [
  'qol', 'biomes', 'totality', 'space', 'tools', 'mobs', 'tech', 'magic', 'overhaul', 'decoration',
];

export const MOD_CATEGORY_LABELS: Record<ModDefinition['category'], string> = {
  qol: 'Quality of Life',
  biomes: 'Biomes',
  totality: 'Total Conversions',
  space: 'Space & Planets',
  tools: 'Tools & Weapons',
  mobs: 'Mobs & Bosses',
  tech: 'Technology',
  magic: 'Magic',
  overhaul: 'Overhauls',
  decoration: 'Decoration',
};

export class ModPackRegistry {
  private mods: Map<ModID, ModDefinition> = new Map();
  private listeners: Array<() => void> = [];

  constructor() {
    for (const m of MODS) this.mods.set(m.id, { ...m });
  }

  list(): ModDefinition[] {
    return Array.from(this.mods.values());
  }

  toggle(id: ModID): boolean {
    const mod = this.mods.get(id);
    if (!mod) return false;
    mod.enabled = !mod.enabled;
    this.notify();
    return mod.enabled;
  }

  isEnabled(id: ModID): boolean {
    return this.mods.get(id)?.enabled ?? false;
  }

  onChange(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  getTotalEnabled(): number {
    return Array.from(this.mods.values()).filter((m) => m.enabled).length;
  }

  /**
   * Register a user-built mod created in the in-game mod editor. Each editor
   * mod is stored under a deterministic id and, once created, behaves exactly
   * like a shipped mod (appears in the browser, grants its blocks/items when
   * enabled).
   */
  createCustomMod(spec: {
    name: string;
    description: string;
    icon?: string;
    blocks?: BlockDef[];
    items?: number[];
    mobs?: string[];
    bosses?: string[];
  }): ModID {
    const id = `custom_${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`;
    const mod: ModDefinition = {
      id,
      name: spec.name,
      author: 'You',
      version: '1.0.0-editor',
      description: spec.description || 'A mod built in the in-game editor.',
      category: 'tools',
      icon: spec.icon ?? '🧩',
      enabled: false,
      adds: {
        blocks: spec.blocks ?? [],
        items: spec.items ?? [],
        mobs: spec.mobs ?? [],
        bosses: spec.bosses ?? [],
      },
      configurable: true,
      downloads: 0,
    };
    this.mods.set(id, mod);
    this.notify();
    return id;
  }

  removeMod(id: ModID): boolean {
    return this.mods.delete(id) ? (this.notify(), true) : false;
  }
}

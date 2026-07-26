/**
 * AdvancedItems — 1.0 expanded item categories.
 *
 * Every item has a stable ID, category, name, block id (for placeable),
 * and a flag set (e.g. isTool, isWeapon, isConsumable, etc.).
 *
 * Categories:
 *   - engineering  (wrenches, blueprints, surveyor, mining drill)
 *   - builder      (ruler, fill stick, copy-paste wand)
 *   - survey       (tape measure, laser level, GPS)
 *   - mobility     (grappling hook, jetpack, glider, hoverboard)
 *   - magic        (wand, spellbook, magic crystal, ancient rune)
 *   - tech         (telemetry, robotics, AI core)
 *   - furniture    (chairs, tables, lamps)
 *   - instruments  (drums, guitar, harp)
 *   - farming      (hoe, watering can, fertilizer)
 *   - fishing      (rod, bait, net)
 *   - automation   (logic controller, structure block, jigsaw, debug)
 *   - keys         (dimension keys, portal stabilizers)
 *   - energy       (energy crystals, batteries, generators)
 */
import { BlockID } from '@shared/blocks/BlockRegistry';

export type ItemCategory =
  | 'engineering' | 'builder' | 'survey' | 'mobility' | 'magic' | 'tech'
  | 'furniture' | 'instruments' | 'farming' | 'fishing' | 'automation'
  | 'keys' | 'energy' | 'consumable' | 'tool' | 'weapon' | 'armor' | 'misc';

export interface AdvancedItem {
  id: string;
  name: string;
  emoji: string;
  category: ItemCategory;
  description: string;
  /** If the item can be placed, this is the block id it becomes when placed. */
  blockId?: BlockID;
  /** If the item is stackable. */
  stackSize: number;
  /** Color of the icon. */
  color: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
}

export const ADVANCED_ITEMS: AdvancedItem[] = [
  /* Engineering */
  { id: 'wrench', name: 'Wrench', emoji: '🔧', category: 'engineering', description: 'Adjust machine direction.', stackSize: 1, color: '#888', rarity: 'common' },
  { id: 'blueprint', name: 'Blueprint', emoji: '📜', category: 'engineering', description: 'Plan a structure before building.', stackSize: 64, color: '#aac8e0', rarity: 'uncommon' },
  { id: 'mining_drill', name: 'Mining Drill', emoji: '⛏', category: 'engineering', description: 'Mines 3x3 at once. Powered.', stackSize: 1, color: '#d8d8d8', rarity: 'epic' },
  { id: 'tape_measure', name: 'Tape Measure', emoji: '📏', category: 'survey', description: 'Click two blocks to see distance.', stackSize: 1, color: '#ffd166', rarity: 'common' },
  { id: 'laser_level', name: 'Laser Level', emoji: '🔦', category: 'survey', description: 'Draws a flat horizontal line.', stackSize: 1, color: '#a82a4a', rarity: 'uncommon' },
  { id: 'gps_tool', name: 'GPS Locator', emoji: '📡', category: 'survey', description: 'Pinpoints XYZ and biome.', stackSize: 1, color: '#5dd6ff', rarity: 'rare' },
  { id: 'grappling_hook', name: 'Grappling Hook', emoji: '🪝', category: 'mobility', description: 'Shoots a hook that pulls you to a block.', stackSize: 1, color: '#a06a3a', rarity: 'epic' },
  { id: 'jetpack', name: 'Jetpack', emoji: '🚀', category: 'mobility', description: 'Toggle flight. Uses fuel.', stackSize: 1, color: '#5a5a5a', rarity: 'epic' },
  { id: 'glider', name: 'Glider', emoji: '🪂', category: 'mobility', description: 'Slows your fall.', stackSize: 1, color: '#a832ff', rarity: 'rare' },
  { id: 'hoverboard', name: 'Hoverboard', emoji: '🏂', category: 'mobility', description: 'Glide above ground for short distances.', stackSize: 1, color: '#5dd6ff', rarity: 'epic' },
  { id: 'magic_wand', name: 'Magic Wand', emoji: '🪄', category: 'magic', description: 'Cast spells (right-click).', stackSize: 1, color: '#a879ff', rarity: 'epic' },
  { id: 'spellbook', name: 'Spellbook', emoji: '📖', category: 'magic', description: 'Store 30 spells.', stackSize: 1, color: '#6a3a8a', rarity: 'epic' },
  { id: 'magic_crystal', name: 'Magic Crystal', emoji: '🔮', category: 'magic', description: 'Reagent for spells.', blockId: 247, stackSize: 64, color: '#a879ff', rarity: 'rare' },
  { id: 'ancient_rune', name: 'Ancient Rune', emoji: '🪬', category: 'magic', description: 'Carved glyph that stores a single command.', blockId: 249, stackSize: 64, color: '#c8a85a', rarity: 'legendary' },
  { id: 'dimension_key', name: 'Dimension Key', emoji: '🗝', category: 'keys', description: 'Unlocks a specific dimension portal.', stackSize: 1, color: '#ffd166', rarity: 'epic' },
  { id: 'portal_stabilizer', name: 'Portal Stabilizer', emoji: '🛡', category: 'keys', description: 'Stops a portal from collapsing.', stackSize: 1, color: '#5dd6ff', rarity: 'epic' },
  { id: 'energy_crystal', name: 'Energy Crystal', emoji: '💠', category: 'energy', description: 'Powers tech items.', stackSize: 64, color: '#5dd6ff', rarity: 'rare' },
  { id: 'battery', name: 'Battery', emoji: '🔋', category: 'energy', description: 'Powers portable machines.', blockId: 232, stackSize: 64, color: '#5ac84a', rarity: 'uncommon' },
  { id: 'furniture_chair', name: 'Chair', emoji: '🪑', category: 'furniture', description: 'Sit down to rest.', blockId: 0 as any, stackSize: 64, color: '#a06a3a', rarity: 'common' },
  { id: 'furniture_table', name: 'Table', emoji: '🪑', category: 'furniture', description: 'Place items on top.', stackSize: 64, color: '#a06a3a', rarity: 'common' },
  { id: 'furniture_lamp', name: 'Lamp', emoji: '💡', category: 'furniture', description: 'Bright light.', blockId: 283, stackSize: 64, color: '#f6a52a', rarity: 'common' },
  { id: 'drum', name: 'Note Drum', emoji: '🥁', category: 'instruments', description: 'Plays a beat.', stackSize: 1, color: '#a06a3a', rarity: 'rare' },
  { id: 'guitar', name: 'Note Guitar', emoji: '🎸', category: 'instruments', description: 'Plays a chord.', stackSize: 1, color: '#a06a3a', rarity: 'rare' },
  { id: 'harp', name: 'Note Harp', emoji: '🎹', category: 'instruments', description: 'Plays a melody.', stackSize: 1, color: '#5dd6ff', rarity: 'epic' },
  { id: 'hoe', name: 'Garden Hoe', emoji: '🌱', category: 'farming', description: 'Till dirt into farmland.', stackSize: 1, color: '#a06a3a', rarity: 'common' },
  { id: 'watering_can', name: 'Watering Can', emoji: '🪣', category: 'farming', description: 'Hydrates crops for fast growth.', stackSize: 1, color: '#5dd6ff', rarity: 'uncommon' },
  { id: 'fertilizer', name: 'Fertilizer', emoji: '🌿', category: 'farming', description: 'Doubles crop yield for 1 day.', stackSize: 64, color: '#5aaa1a', rarity: 'uncommon' },
  { id: 'fishing_rod', name: 'Fishing Rod', emoji: '🎣', category: 'fishing', description: 'Catch fish, treasure, or rare items.', stackSize: 1, color: '#a06a3a', rarity: 'common' },
  { id: 'fishing_net', name: 'Fishing Net', emoji: '🕸', category: 'fishing', description: 'Catch many fish at once.', stackSize: 1, color: '#d8d8d8', rarity: 'uncommon' },
  { id: 'bait', name: 'Fish Bait', emoji: '🪱', category: 'fishing', description: 'Better fishing odds.', stackSize: 64, color: '#5a3a1a', rarity: 'common' },
  { id: 'logic_controller', name: 'Logic Controller', emoji: '🧠', category: 'automation', description: 'Runs scripted logic from redstone.', blockId: 18, stackSize: 64, color: '#caa970', rarity: 'rare' },
  { id: 'structure_block', name: 'Structure Block', emoji: '🏛', category: 'automation', description: 'Save/load structures.', blockId: 271, stackSize: 64, color: '#3a3a40', rarity: 'epic' },
  { id: 'jigsaw_block', name: 'Jigsaw Block', emoji: '🧩', category: 'automation', description: 'Procedurally connects structures.', blockId: 272, stackSize: 64, color: '#5a5a5a', rarity: 'epic' },
  { id: 'debug_stick', name: 'Debug Stick', emoji: '🪄', category: 'automation', description: 'Creative-only: edit any block state.', blockId: 274, stackSize: 1, color: '#a83232', rarity: 'mythic' },
  { id: 'bedrock_breaker', name: 'Bedrock Breaker', emoji: '⛏', category: 'automation', description: 'Creative-only: mines bedrock.', stackSize: 1, color: '#1a0a0a', rarity: 'mythic' },
  { id: 'shield_advanced', name: 'Energy Shield', emoji: '🛡', category: 'weapon', description: 'Absorbs 200 damage before breaking.', stackSize: 1, color: '#5dd6ff', rarity: 'epic' },
  { id: 'gravity_boots', name: 'Gravity Boots', emoji: '👢', category: 'mobility', description: 'Walk up walls.', stackSize: 1, color: '#5dd6ff', rarity: 'legendary' },
  { id: 'teleporter', name: 'Teleporter', emoji: '🌀', category: 'keys', description: 'Set 2 points, instant travel between.', stackSize: 1, color: '#a879ff', rarity: 'epic' },
  { id: 'time_machine', name: 'Time Machine', emoji: '⏰', category: 'misc', description: 'Toggle day / night instantly.', blockId: 19, stackSize: 1, color: '#a879ff', rarity: 'legendary' },
  { id: 'weather_machine', name: 'Weather Machine', emoji: '🌦', category: 'misc', description: 'Toggle weather anywhere.', stackSize: 1, color: '#5dd6ff', rarity: 'legendary' },
  { id: 'satellite_dish', name: 'Satellite Dish', emoji: '📡', category: 'tech', description: 'Triggers weather from space.', blockId: 242, stackSize: 1, color: '#d8d8d8', rarity: 'epic' },
  { id: 'tesla_coil', name: 'Tesla Coil', emoji: '⚡', category: 'tech', description: 'Damages nearby mobs.', blockId: 235, stackSize: 1, color: '#a8c8e8', rarity: 'epic' },
  { id: 'factory', name: 'Factory', emoji: '🏭', category: 'tech', description: 'Auto-crafts items from recipes.', blockId: 236, stackSize: 1, color: '#5a5a5a', rarity: 'legendary' },
  { id: 'nuclear_reactor', name: 'Nuclear Reactor', emoji: '☢', category: 'tech', description: 'Generates massive power.', blockId: 234, stackSize: 1, color: '#3a3a40', rarity: 'mythic' },
  { id: 'solar_panel', name: 'Solar Panel', emoji: '☀', category: 'tech', description: 'Generates power from the sun.', blockId: 231, stackSize: 1, color: '#2a4a7a', rarity: 'rare' },
  { id: 'wind_turbine', name: 'Wind Turbine', emoji: '🌬', category: 'tech', description: 'Generates power from wind.', blockId: 233, stackSize: 1, color: '#e8e8e8', rarity: 'rare' },
  { id: 'space_helmet', name: 'Space Helmet', emoji: '🪖', category: 'armor', description: 'Required in space dimensions.', blockId: 208, stackSize: 1, color: '#dde2ea', rarity: 'epic' },
  { id: 'space_chestplate', name: 'Space Chestplate', emoji: '🦺', category: 'armor', description: 'Required in space dimensions.', blockId: 209, stackSize: 1, color: '#dde2ea', rarity: 'epic' },
  { id: 'submarine', name: 'Submarine', emoji: '🛥', category: 'mobility', description: 'Travels underwater indefinitely.', blockId: 238, stackSize: 1, color: '#3a4a5a', rarity: 'legendary' },
  { id: 'airship', name: 'Airship', emoji: '🎈', category: 'mobility', description: 'Float through the air.', blockId: 239, stackSize: 1, color: '#a06a3a', rarity: 'legendary' },
  { id: 'train', name: 'Train', emoji: '🚂', category: 'mobility', description: 'Fast overland transport on rails.', blockId: 240, stackSize: 1, color: '#3a4a3a', rarity: 'legendary' },
  { id: 'car', name: 'Car', emoji: '🚗', category: 'mobility', description: 'Fast overland transport.', blockId: 241, stackSize: 1, color: '#c84a4a', rarity: 'epic' },
  { id: 'spyglass', name: 'Spyglass', emoji: '🔭', category: 'survey', description: 'Zoom in on distant terrain.', stackSize: 1, color: '#a06a3a', rarity: 'uncommon' },
  { id: 'compass', name: 'Compass', emoji: '🧭', category: 'survey', description: 'Always points to spawn.', stackSize: 1, color: '#a06a3a', rarity: 'common' },
  { id: 'recovery_compass', name: 'Recovery Compass', emoji: '🧲', category: 'survey', description: 'Points to last death location.', stackSize: 1, color: '#a879ff', rarity: 'rare' },
  { id: 'clock', name: 'Clock', emoji: '⏰', category: 'survey', description: 'Shows time of day.', stackSize: 1, color: '#ffd166', rarity: 'common' },
  { id: 'book_and_quill', name: 'Book & Quill', emoji: '📝', category: 'misc', description: 'Write a book with 100 pages.', stackSize: 1, color: '#8a5a36', rarity: 'uncommon' },
  { id: 'writable_book', name: 'Written Book', emoji: '📚', category: 'misc', description: 'A book with text. Reads to player.', stackSize: 16, color: '#8a5a36', rarity: 'uncommon' },
  { id: 'enchanted_book', name: 'Enchanted Book', emoji: '📕', category: 'misc', description: 'Stores a single enchantment.', stackSize: 1, color: '#a879ff', rarity: 'epic' },
  { id: 'firework_rocket', name: 'Firework Rocket', emoji: '🚀', category: 'misc', description: 'Flies up and explodes with particles.', stackSize: 64, color: '#ffd166', rarity: 'uncommon' },
  { id: 'firework_star', name: 'Firework Star', emoji: '✨', category: 'misc', description: 'Crafting ingredient for fireworks.', stackSize: 64, color: '#a879ff', rarity: 'uncommon' },
  { id: 'lead', name: 'Lead', emoji: '🪢', category: 'misc', description: 'Tie a mob to a fence.', stackSize: 64, color: '#a06a3a', rarity: 'uncommon' },
  { id: 'name_tag', name: 'Name Tag', emoji: '🏷', category: 'misc', description: 'Rename a mob.', stackSize: 64, color: '#d8d8d8', rarity: 'rare' },
  { id: 'saddle', name: 'Saddle', emoji: '🪑', category: 'misc', description: 'Ride a horse, pig, or strider.', stackSize: 1, color: '#a06a3a', rarity: 'uncommon' },
  { id: 'horse_armor', name: 'Horse Armor', emoji: '🛡', category: 'armor', description: 'Adds armor to a horse.', stackSize: 1, color: '#d8d8d8', rarity: 'rare' },
  { id: 'banner_pattern', name: 'Banner Pattern', emoji: '🏳', category: 'misc', description: 'Decorative banner design.', stackSize: 64, color: '#e8e8e8', rarity: 'uncommon' },
  { id: 'music_disc', name: 'Music Disc', emoji: '💿', category: 'misc', description: 'Plays a song in a jukebox.', stackSize: 1, color: '#5dd6ff', rarity: 'rare' },
  { id: 'goat_horn', name: 'Goat Horn', emoji: '🎺', category: 'instruments', description: 'Plays a unique sound.', stackSize: 1, color: '#a06a3a', rarity: 'uncommon' },
];

export const ITEMS_BY_CATEGORY: Record<ItemCategory, AdvancedItem[]> = ADVANCED_ITEMS.reduce((acc, item) => {
  (acc[item.category] ||= []).push(item);
  return acc;
}, {} as Record<ItemCategory, AdvancedItem[]>);

export const ITEM_CATEGORIES: ItemCategory[] = [
  'tool', 'weapon', 'armor', 'consumable',
  'engineering', 'builder', 'survey', 'mobility', 'magic', 'tech',
  'furniture', 'instruments', 'farming', 'fishing', 'automation', 'keys', 'energy', 'misc',
];

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  tool: 'Tools', weapon: 'Weapons', armor: 'Armor', consumable: 'Consumables',
  engineering: 'Engineering', builder: 'Builder', survey: 'Survey', mobility: 'Mobility',
  magic: 'Magic', tech: 'Technology', furniture: 'Furniture', instruments: 'Instruments',
  farming: 'Farming', fishing: 'Fishing', automation: 'Automation',
  keys: 'Keys & Portals', energy: 'Energy', misc: 'Misc',
};

export const ITEM_CATEGORY_ICONS: Record<ItemCategory, string> = {
  tool: '🛠', weapon: '⚔', armor: '🛡', consumable: '🍗',
  engineering: '🔧', builder: '🏗', survey: '📏', mobility: '🛩',
  magic: '🪄', tech: '🤖', furniture: '🪑', instruments: '🎸',
  farming: '🌾', fishing: '🎣', automation: '⚙', keys: '🗝',
  energy: '🔋', misc: '📦',
};

export const RARITY_COLORS: Record<AdvancedItem['rarity'], string> = {
  common: '#e8e8e8', uncommon: '#5dd6ff', rare: '#7ef7a0', epic: '#a879ff', legendary: '#ffd166', mythic: '#ff7ac1',
};

export default ADVANCED_ITEMS;

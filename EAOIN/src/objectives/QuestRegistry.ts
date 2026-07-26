/**
 * QuestRegistry — EAOIN 1.0 quest lines.
 * Each civilization, dimension, and boss has its own quest arc.
 */

import { RuntimeDimensionID } from '../dimensions/DimensionRuntime';

export type QuestID = string;
export type QuestType = 'main' | 'side' | 'daily' | 'weekly' | 'event' | 'tutorial' | 'dimension' | 'civilization' | 'boss';

export interface QuestStep {
  description: string;
  type: 'collect' | 'kill' | 'craft' | 'place' | 'visit' | 'talk' | 'build' | 'survive' | 'discover' | 'boss';
  target: string;
  amount: number;
  progress: number;
}

export interface QuestDef {
  id: QuestID;
  name: string;
  emoji: string;
  type: QuestType;
  description: string;
  giver: string;
  dimension: RuntimeDimensionID | 'any';
  steps: QuestStep[];
  rewards: { xp: number; coins: number; items?: string[] };
  unlocks: string[];
  level: number;
  lore: string;
}

const QUESTS: QuestDef[] = [
  // Tutorial
  { id: 'q_punch_tree', name: 'Punch a Tree', emoji: '🌲', type: 'tutorial', description: 'Punch your first tree to gather wood.', giver: 'Tutorial Guide', dimension: 'overworld', steps: [{ description: 'Punch a log', type: 'collect', target: 'oak_log', amount: 1, progress: 0 }], rewards: { xp: 10, coins: 0 }, unlocks: ['Crafting'], level: 1, lore: 'It is tradition.' },
  { id: 'q_craft_pickaxe', name: 'Your First Tool', emoji: '⛏', type: 'tutorial', description: 'Craft a wooden pickaxe.', giver: 'Tutorial Guide', dimension: 'overworld', steps: [{ description: 'Craft wooden pickaxe', type: 'craft', target: 'wooden_pickaxe', amount: 1, progress: 0 }], rewards: { xp: 25, coins: 5 }, unlocks: ['Mining'], level: 1, lore: 'Better than hands.' },
  { id: 'q_first_night', name: 'Survive the Night', emoji: '🌙', type: 'tutorial', description: 'Make it through your first night.', giver: 'Tutorial Guide', dimension: 'overworld', steps: [{ description: 'Survive until sunrise', type: 'survive', target: 'night', amount: 1, progress: 0 }], rewards: { xp: 30, coins: 10 }, unlocks: ['Beds'], level: 1, lore: 'A bed is recommended.' },
  { id: 'q_first_bed', name: 'A Place to Sleep', emoji: '🛏', type: 'tutorial', description: 'Craft a bed and set your spawn.', giver: 'Tutorial Guide', dimension: 'overworld', steps: [{ description: 'Craft a red bed', type: 'craft', target: 'red_bed', amount: 1, progress: 0 }], rewards: { xp: 50, coins: 15 }, unlocks: ['Spawn Point'], level: 1, lore: 'Sleep tight.' },
  { id: 'q_first_village', name: 'A Neighborly Visit', emoji: '🏘', type: 'main', description: 'Find a village and meet a villager.', giver: 'Cartographer', dimension: 'overworld', steps: [{ description: 'Find a village', type: 'discover', target: 'village', amount: 1, progress: 0 }], rewards: { xp: 100, coins: 50 }, unlocks: ['Trading'], level: 2, lore: 'Trade, talk, and thrive.' },
  { id: 'q_first_diamond', name: 'Shine Bright', emoji: '💎', type: 'main', description: 'Mine a diamond ore.', giver: 'Cartographer', dimension: 'overworld', steps: [{ description: 'Mine diamond', type: 'collect', target: 'diamond_ore', amount: 1, progress: 0 }], rewards: { xp: 200, coins: 100 }, unlocks: ['Diamond Tools'], level: 3, lore: 'Rare and beautiful.' },
  { id: 'q_enter_nether', name: 'To Hell and Back', emoji: '🔥', type: 'main', description: 'Build a nether portal and enter the Nether.', giver: 'Wandering Trader', dimension: 'overworld', steps: [{ description: 'Build a nether portal', type: 'build', target: 'nether_portal', amount: 1, progress: 0 }, { description: 'Enter the nether', type: 'visit', target: 'nether', amount: 1, progress: 0 }], rewards: { xp: 500, coins: 200, items: ['Gold Sword'] }, unlocks: ['Nether'], level: 4, lore: 'Bring obsidian and a flint.' },
  { id: 'q_kill_wither', name: 'Death Becomes Her', emoji: '☠', type: 'main', description: 'Defeat the Wither.', giver: 'Wandering Trader', dimension: 'nether', steps: [{ description: 'Kill the Wither', type: 'boss', target: 'wither', amount: 1, progress: 0 }], rewards: { xp: 1500, coins: 1000, items: ['Nether Star'] }, unlocks: ['Beacon'], level: 6, lore: 'Three skulls on soul sand.' },
  { id: 'q_enter_end', name: 'The Far Lands', emoji: '🌌', type: 'main', description: 'Find a stronghold and enter the End.', giver: 'Eye of Ender', dimension: 'overworld', steps: [{ description: 'Find stronghold', type: 'discover', target: 'stronghold', amount: 1, progress: 0 }, { description: 'Enter the End', type: 'visit', target: 'end', amount: 1, progress: 0 }], rewards: { xp: 1000, coins: 500, items: ['Ender Pearl x16'] }, unlocks: ['The End'], level: 5, lore: 'Follow the eye.' },
  { id: 'q_kill_ender_dragon', name: 'Free the End', emoji: '🐉', type: 'main', description: 'Slay the Ender Dragon.', giver: 'Enderman', dimension: 'end', steps: [{ description: 'Slay the Ender Dragon', type: 'boss', target: 'ender_dragon', amount: 1, progress: 0 }], rewards: { xp: 5000, coins: 5000, items: ['Dragon Egg', 'Dragon Head'] }, unlocks: ['Elytra', 'Outer Islands'], level: 8, lore: 'The first boss. The hardest goodbye.' },
  { id: 'q_elytra', name: 'Wings', emoji: '🪽', type: 'side', description: 'Find an end city and grab the elytra.', giver: 'Enderman', dimension: 'end', steps: [{ description: 'Find end city', type: 'discover', target: 'end_city', amount: 1, progress: 0 }, { description: 'Loot elytra', type: 'collect', target: 'elytra', amount: 1, progress: 0 }], rewards: { xp: 1000, coins: 200 }, unlocks: ['Flight'], level: 8, lore: 'Now fly.' },
  { id: 'q_rocket', name: 'To the Moon', emoji: '🚀', type: 'main', description: 'Build a rocket and reach the Moon.', giver: 'Galacticraft Engineer', dimension: 'overworld', steps: [{ description: 'Build rocket', type: 'build', target: 'rocket', amount: 1, progress: 0 }, { description: 'Launch to the Moon', type: 'visit', target: 'moon', amount: 1, progress: 0 }], rewards: { xp: 2000, coins: 1500, items: ['Space Helmet', 'Space Chestplate'] }, unlocks: ['Space', 'Galacticraft'], level: 10, lore: 'One small step.' },
  { id: 'q_lunar_sentinel', name: 'Waking the Old Guard', emoji: '🤖', type: 'main', description: 'Defeat the Lunar Sentinel.', giver: 'Galacticraft Engineer', dimension: 'moon', steps: [{ description: 'Defeat Lunar Sentinel', type: 'boss', target: 'lunar_sentinel', amount: 1, progress: 0 }], rewards: { xp: 3000, coins: 2000, items: ['Plasma Cell'] }, unlocks: ['Plasma Weapons'], level: 12, lore: 'It still thinks the war is on.' },
  { id: 'q_alien_queen', name: 'Hive Mind', emoji: '👽', type: 'main', description: 'Slay the Alien Queen on an alien world.', giver: 'Zetan Speaker', dimension: 'alien_worlds', steps: [{ description: 'Travel to alien world', type: 'visit', target: 'alien_worlds', amount: 1, progress: 0 }, { description: 'Defeat the Queen', type: 'boss', target: 'alien_queen', amount: 1, progress: 0 }], rewards: { xp: 5000, coins: 5000, items: ['Alien Blade'] }, unlocks: ['Alien Tech'], level: 14, lore: 'Resistance is futile.' },
  { id: 'q_ancient_dragon', name: 'The Oldest', emoji: '🐲', type: 'main', description: 'Defeat the Ancient Dragon.', giver: 'Sky King', dimension: 'sky_kingdom', steps: [{ description: 'Reach the Sky Kingdom', type: 'visit', target: 'sky_kingdom', amount: 1, progress: 0 }, { description: 'Slay the Ancient Dragon', type: 'boss', target: 'ancient_dragon', amount: 1, progress: 0 }], rewards: { xp: 6000, coins: 6000, items: ['Dragon Heart'] }, unlocks: ['Sky Kingdom Citizenship'], level: 16, lore: 'It is older than the gods.' },
  { id: 'q_void_emperor', name: 'The End of All Things', emoji: '🌑', type: 'main', description: 'Defeat the Void Emperor in the Cosmic Void.', giver: '?', dimension: 'cosmic_void', steps: [{ description: 'Reach the Cosmic Void', type: 'visit', target: 'cosmic_void', amount: 1, progress: 0 }, { description: 'Defeat the Void Emperor', type: 'boss', target: 'void_emperor', amount: 1, progress: 0 }], rewards: { xp: 50_000, coins: 50_000, items: ['Cosmic Edge', 'Void Crown', 'New Game+'] }, unlocks: ['New Game+', 'Transcendent Ending'], level: 50, lore: 'It does not want to kill. It wants you to forget.' },
  { id: 'q_planet_devourer', name: 'Hunger of Worlds', emoji: '🪐', type: 'main', description: 'Defeat the Planet Devourer.', giver: 'Cosmic Guardian', dimension: 'gas_giant', steps: [{ description: 'Reach the Gas Giant', type: 'visit', target: 'gas_giant', amount: 1, progress: 0 }, { description: 'Defeat the Planet Devourer', type: 'boss', target: 'planet_devourer', amount: 1, progress: 0 }], rewards: { xp: 100_000, coins: 100_000, items: ['Singularity Shard'] }, unlocks: ['Ultimate Ending'], level: 80, lore: 'It ate the gods.' },
  { id: 'q_crystal_titan', name: 'Resonance', emoji: '💎', type: 'side', description: 'Defeat the Crystal Titan.', giver: 'Crystal Singer', dimension: 'crystal_realm', steps: [{ description: 'Reach the Crystal Realm', type: 'visit', target: 'crystal_realm', amount: 1, progress: 0 }, { description: 'Defeat the Crystal Titan', type: 'boss', target: 'crystal_titan', amount: 1, progress: 0 }], rewards: { xp: 4000, coins: 3000, items: ['Resonance Wand'] }, unlocks: ['Resonance Magic'], level: 14, lore: 'A walking mountain.' },
  { id: 'q_volcano_lord', name: 'Magma Heart', emoji: '🌋', type: 'side', description: 'Defeat the Volcano Lord.', giver: 'Phoenix', dimension: 'volcanic_realm', steps: [{ description: 'Reach the Volcanic Realm', type: 'visit', target: 'volcanic_realm', amount: 1, progress: 0 }, { description: 'Defeat the Volcano Lord', type: 'boss', target: 'volcano_lord', amount: 1, progress: 0 }], rewards: { xp: 4500, coins: 3500, items: ['Obsidian Blade'] }, unlocks: ['Volcanic Tech'], level: 15, lore: 'The mountain itself is its body.' },
  { id: 'q_frost_king', name: 'Thaw', emoji: '❄', type: 'side', description: 'Defeat the Frost King.', giver: 'Frost Druid', dimension: 'frozen_wasteland', steps: [{ description: 'Reach the Frozen Wasteland', type: 'visit', target: 'frozen_wasteland', amount: 1, progress: 0 }, { description: 'Defeat the Frost King', type: 'boss', target: 'frost_king', amount: 1, progress: 0 }], rewards: { xp: 4000, coins: 3000, items: ['Frost Crown'] }, unlocks: ['Frost Magic'], level: 14, lore: 'He froze himself to live forever.' },
  { id: 'q_ocean_leviathan', name: 'Deep One', emoji: '🌊', type: 'side', description: 'Defeat the Ocean Leviathan.', giver: 'Reef-Warden', dimension: 'ocean_world', steps: [{ description: 'Sail the Ocean World', type: 'visit', target: 'ocean_world', amount: 1, progress: 0 }, { description: 'Defeat the Leviathan', type: 'boss', target: 'ocean_leviathan', amount: 1, progress: 0 }], rewards: { xp: 4500, coins: 3500, items: ['Tidal Trident'] }, unlocks: ['Ocean Mastery'], level: 15, lore: 'It is bigger than you think.' },
  { id: 'q_jungle_guardian', name: 'Roots', emoji: '🌳', type: 'side', description: 'Defeat the Jungle Guardian.', giver: 'Tribesman', dimension: 'giant_forest', steps: [{ description: 'Climb into the Canopy', type: 'visit', target: 'giant_forest', amount: 1, progress: 0 }, { description: 'Defeat the Jungle Guardian', type: 'boss', target: 'jungle_guardian', amount: 1, progress: 0 }], rewards: { xp: 4200, coins: 3200, items: ['Vine Whip'] }, unlocks: ['Canopy Access'], level: 14, lore: 'The forest\'s last line of defense.' },
  { id: 'q_solar_incarnate', name: 'Touch the Sun', emoji: '☀', type: 'main', description: 'Slay the Solar Incarnate.', giver: '?', dimension: 'sun', steps: [{ description: 'Reach the Sun', type: 'visit', target: 'sun', amount: 1, progress: 0 }, { description: 'Defeat the Solar Incarnate', type: 'boss', target: 'solar_incarnate', amount: 1, progress: 0 }], rewards: { xp: 20_000, coins: 20_000, items: ['Plasma Staff'] }, unlocks: ['Solar Ending'], level: 30, lore: 'It does not speak.' },
  { id: 'q_shadow_king', name: 'In the Mirror', emoji: '👤', type: 'side', description: 'Defeat the Shadow King.', giver: '?', dimension: 'shadow_realm', steps: [{ description: 'Enter the Shadow Realm', type: 'visit', target: 'shadow_realm', amount: 1, progress: 0 }, { description: 'Defeat the Shadow King', type: 'boss', target: 'shadow_king', amount: 1, progress: 0 }], rewards: { xp: 5000, coins: 4000, items: ['Mirror Blade'] }, unlocks: ['Shadow Magic'], level: 16, lore: 'He is you, but worse.' },
  { id: 'q_ancient_ai_core', name: 'Reboot', emoji: '🤖', type: 'side', description: 'Defeat the Ancient AI Core.', giver: '?', dimension: 'machine_dimension', steps: [{ description: 'Enter the Machine Dimension', type: 'visit', target: 'machine_dimension', amount: 1, progress: 0 }, { description: 'Defeat the Ancient AI Core', type: 'boss', target: 'ancient_ai_core', amount: 1, progress: 0 }], rewards: { xp: 5500, coins: 4500, items: ['Quantum Processor'] }, unlocks: ['AI Tech'], level: 17, lore: 'It forgot why it was made.' },
  { id: 'q_daily_log', name: 'Daily Login', emoji: '📅', type: 'daily', description: 'Just log in.', giver: 'System', dimension: 'any', steps: [{ description: 'Log in', type: 'survive', target: 'day', amount: 1, progress: 0 }], rewards: { xp: 50, coins: 25 }, unlocks: [], level: 1, lore: 'Welcome back.' },
  { id: 'q_daily_mine', name: 'Daily Mining', emoji: '⛏', type: 'daily', description: 'Mine 50 blocks.', giver: 'System', dimension: 'any', steps: [{ description: 'Mine 50 blocks', type: 'collect', target: 'any_block', amount: 50, progress: 0 }], rewards: { xp: 100, coins: 50 }, unlocks: [], level: 1, lore: 'A day\'s work.' },
  { id: 'q_weekly_boss', name: 'Weekly Boss', emoji: '👑', type: 'weekly', description: 'Defeat one world boss.', giver: 'System', dimension: 'any', steps: [{ description: 'Defeat a world boss', type: 'boss', target: 'any', amount: 1, progress: 0 }], rewards: { xp: 5000, coins: 5000, items: ['Mythic Token'] }, unlocks: ['Mythic Shop'], level: 20, lore: 'Weekly challenge.' },
  { id: 'q_visit_all_dims', name: 'Tourist', emoji: '🌍', type: 'main', description: 'Visit every dimension at least once.', giver: 'Cartographer', dimension: 'any', steps: Array.from({ length: 25 }, (_, i) => ({ description: `Visit dimension ${i + 1}`, type: 'visit' as const, target: `dim_${i}`, amount: 1, progress: 0 })), rewards: { xp: 25_000, coins: 25_000, items: ['Tourist Trophy'] }, unlocks: ['Tourist Title', 'Free Teleport'], level: 30, lore: 'See the multiverse.' },
  { id: 'q_civ_join', name: 'Join a Civilization', emoji: '🏛', type: 'civilization', description: 'Become a citizen of a civilization.', giver: 'Civ Leader', dimension: 'any', steps: [{ description: 'Join a civ', type: 'talk', target: 'leader', amount: 1, progress: 0 }], rewards: { xp: 200, coins: 100 }, unlocks: ['Citizenship'], level: 5, lore: 'Welcome home.' },
  { id: 'q_civ_build', name: 'Builder of Houses', emoji: '🏠', type: 'civilization', description: 'Build 10 houses for your civilization.', giver: 'Civ Architect', dimension: 'any', steps: [{ description: 'Build 10 houses', type: 'build', target: 'house', amount: 10, progress: 0 }], rewards: { xp: 1000, coins: 500 }, unlocks: ['Builder Title'], level: 8, lore: 'A roof and four walls.' },
  { id: 'q_civ_research', name: 'Research Tech', emoji: '🔬', type: 'civilization', description: 'Help research a new tech age.', giver: 'Civ Scientist', dimension: 'any', steps: [{ description: 'Advance tech age', type: 'craft', target: 'tech_age', amount: 1, progress: 0 }], rewards: { xp: 5000, coins: 5000, items: ['Research Trophy'] }, unlocks: ['Civ Research'], level: 15, lore: 'Knowledge is power.' },
  { id: 'q_civ_war', name: 'Veteran of War', emoji: '⚔', type: 'civilization', description: 'Win a war for your civilization.', giver: 'Civ General', dimension: 'any', steps: [{ description: 'Win a war', type: 'kill', target: 'enemy_soldier', amount: 50, progress: 0 }], rewards: { xp: 10_000, coins: 10_000, items: ['War Medal'] }, unlocks: ['General Title'], level: 12, lore: 'For king and country.' },
];

export const ALL_QUESTS: QuestDef[] = QUESTS;
export function getQuest(id: QuestID): QuestDef | undefined {
  return QUESTS.find((q) => q.id === id);
}
export function getQuestsByType(type: QuestType): QuestDef[] {
  return QUESTS.filter((q) => q.type === type);
}

export const QUEST_TYPES: QuestType[] = ['tutorial', 'main', 'side', 'daily', 'weekly', 'event', 'dimension', 'civilization', 'boss'];
export const QUEST_TYPE_LABELS: Record<QuestType, string> = {
  tutorial: 'Tutorial',
  main: 'Main Quest',
  side: 'Side Quest',
  daily: 'Daily',
  weekly: 'Weekly',
  event: 'Event',
  dimension: 'Dimension',
  civilization: 'Civilization',
  boss: 'Boss',
};

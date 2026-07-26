/**
 * BossRegistry — every boss from the spec.
 *
 * Not only Minecraft bosses — adds:
 *  - Ancient Dragon, Crystal Titan, Volcano Lord, Frost King
 *  - Ocean Leviathan, Jungle Guardian, Sand Colossus
 *  - Space Kraken, Void Emperor, Shadow King
 *  - Ancient AI Core, Alien Queen, Cosmic Guardian
 *  - Planet Devourer
 */
import { RuntimeDimensionID } from '../dimensions/DimensionRuntime';

export type BossID = string;

export interface BossDef {
  id: BossID;
  name: string;
  emoji: string;
  dimension: RuntimeDimensionID;
  description: string;
  tier: 'tutorial' | 'standard' | 'expert' | 'raid' | 'world' | 'dimension' | 'final';
  health: number;
  damage: number;
  abilities: string[];
  phases: number;
  arena: string;
  musicTrack: string;
  drops: string[];
  lore: string;
  size: { width: number; height: number; depth: number };
  color: string;
}

const BOSSES: BossDef[] = [
  { id: 'wood_warden', name: 'Wood Warden', emoji: '🌳', dimension: 'overworld', description: 'A spirit of the forest. Awakens when too many logs are chopped.', tier: 'tutorial', health: 80, damage: 8, abilities: ['Root Strike', 'Leaf Shield'], phases: 2, arena: 'Dark Forest', musicTrack: 'Forest Theme', drops: ['Heart of the Forest', 'Ancient Sapling'], lore: 'Born of the World Tree\'s grief. Let its forest rest.', size: { width: 1.2, height: 2.4, depth: 1.2 }, color: '#3aa83a' },
  { id: 'evoker', name: 'Evoker', emoji: '🧙', dimension: 'overworld', description: 'A raid spell-caster. Summons fangs and vexes.', tier: 'standard', health: 120, damage: 12, abilities: ['Fang Attack', 'Summon Vex'], phases: 2, arena: 'Pillager Outpost', musicTrack: 'Raid Horn', drops: ['Totem of Undying', 'Emerald'], lore: 'A traitor villager who learned the magic of the illagers.', size: { width: 0.6, height: 1.95, depth: 0.6 }, color: '#5a5a5a' },
  { id: 'ravager', name: 'Ravager', emoji: '🐂', dimension: 'overworld', description: 'A raid beast. Rams everything.', tier: 'standard', health: 200, damage: 18, abilities: ['Ram', 'Roar'], phases: 1, arena: 'Open Field', musicTrack: 'Raid Horn', drops: ['Saddle'], lore: 'Bred for war. No fear.', size: { width: 2.5, height: 2.0, depth: 1.5 }, color: '#3a3a3a' },
  { id: 'wither', name: 'Wither', emoji: '☠', dimension: 'nether', description: 'Three wither skeleton skulls on soul sand summon it.', tier: 'expert', health: 600, damage: 24, abilities: ['Wither Skull', 'Wither Shield', 'Regen Aura'], phases: 3, arena: 'Nether Wastes', musicTrack: 'Wither Theme', drops: ['Nether Star', 'Wither Rose'], lore: 'A god of destruction. Avoid looking at its head.', size: { width: 1.5, height: 3.0, depth: 1.5 }, color: '#1a0a0a' },
  { id: 'ender_dragon', name: 'Ender Dragon', emoji: '🐉', dimension: 'end', description: 'The final boss of the End. End-game in vanilla.', tier: 'dimension', health: 800, damage: 30, abilities: ['Dragon Breath', 'Wing Slam', 'Heal From Crystals'], phases: 2, arena: 'End Central Island', musicTrack: 'Dragon Theme', drops: ['Dragon Egg', 'Dragon Head', '12800 XP'], lore: 'The first inhabitant of the End. Slay it to earn freedom.', size: { width: 8.0, height: 4.0, depth: 16.0 }, color: '#1a0a3a' },
  { id: 'elder_guardian', name: 'Elder Guardian', emoji: '🛡', dimension: 'overworld', description: 'A massive guardian in ocean monuments.', tier: 'expert', health: 320, damage: 16, abilities: ['Laser Beam', 'Mining Fatigue', 'Thorns'], phases: 2, arena: 'Ocean Monument', musicTrack: 'Monument Theme', drops: ['Sponge', 'Prismarine'], lore: 'Guardians of the deep. Don\'t wake them.', size: { width: 1.5, height: 1.8, depth: 1.0 }, color: '#3a8a8a' },
  { id: 'ancient_dragon', name: 'Ancient Dragon', emoji: '🐲', dimension: 'sky_kingdom', description: 'A dragon older than the Sky Kingdom itself.', tier: 'world', health: 1400, damage: 36, abilities: ['Meteor Rain', 'Sky Slam', 'Storm Breath'], phases: 4, arena: 'Sky Citadel', musicTrack: 'Ancient Dragon Theme', drops: ['Dragon Heart', 'Skyforge Hammer'], lore: 'Older than the gods. Awaits a worthy challenger.', size: { width: 12, height: 5.0, depth: 20 }, color: '#a832ff' },
  { id: 'crystal_titan', name: 'Crystal Titan', emoji: '💎', dimension: 'crystal_realm', description: 'A giant golem of living amethyst.', tier: 'world', health: 1200, damage: 28, abilities: ['Shard Storm', 'Resonance Pulse', 'Reflect'], phases: 3, arena: 'Resonance Hall', musicTrack: 'Crystal Theme', drops: ['Crystal Heart', 'Resonance Wand'], lore: 'A walking mountain. Beware its song.', size: { width: 6, height: 8, depth: 6 }, color: '#a879ff' },
  { id: 'volcano_lord', name: 'Volcano Lord', emoji: '🌋', dimension: 'volcanic_realm', description: 'An elemental of living magma.', tier: 'world', health: 1800, damage: 42, abilities: ['Lava Wave', 'Magma Fist', 'Eruption'], phases: 4, arena: 'Volcano Caldera', musicTrack: 'Inferno Theme', drops: ['Magma Heart', 'Obsidian Blade'], lore: 'The mountain itself is its body.', size: { width: 5, height: 9, depth: 5 }, color: '#ff5a1a' },
  { id: 'frost_king', name: 'Frost King', emoji: '❄', dimension: 'frozen_wasteland', description: 'A lich of permafrost and blizzards.', tier: 'world', health: 1600, damage: 32, abilities: ['Blizzard', 'Ice Lance', 'Frozen Heart Aura'], phases: 3, arena: 'Ice Spire', musicTrack: 'Frost Theme', drops: ['Frost Crown', 'Ice Shard Bow'], lore: 'He froze himself to live forever. Free him.', size: { width: 3, height: 5, depth: 3 }, color: '#a8d8ff' },
  { id: 'ocean_leviathan', name: 'Ocean Leviathan', emoji: '🌊', dimension: 'ocean_world', description: 'A kraken the size of an island.', tier: 'world', health: 2200, damage: 38, abilities: ['Tentacle Slam', 'Whirlpool', 'Tidal Wave'], phases: 3, arena: 'Open Ocean', musicTrack: 'Deep Sea Theme', drops: ['Kraken Heart', 'Tidal Trident'], lore: 'Sailors tell of it. Few have seen it. None have lived to tell.', size: { width: 18, height: 4, depth: 18 }, color: '#3a86d0' },
  { id: 'jungle_guardian', name: 'Jungle Guardian', emoji: '🌳', dimension: 'giant_forest', description: 'A forest spirit of vines and teeth.', tier: 'world', health: 1400, damage: 30, abilities: ['Vine Bind', 'Treetop Slam', 'Pollen Cloud'], phases: 3, arena: 'Canopy Temple', musicTrack: 'Jungle Theme', drops: ['Spirit Seed', 'Vine Whip'], lore: 'The forest\'s last line of defense.', size: { width: 4, height: 7, depth: 4 }, color: '#3aa83a' },
  { id: 'sand_colossus', name: 'Sand Colossus', emoji: '🏜', dimension: 'ancient_civilization', description: 'A golem of shifting dunes.', tier: 'world', health: 2000, damage: 35, abilities: ['Sandstorm', 'Quicksand', 'Pyramid Slam'], phases: 4, arena: 'Hidden Pyramid', musicTrack: 'Desert Theme', drops: ['Pharaoh\'s Mask', 'Sandstorm Cloak'], lore: 'The pharaoh\'s last guardian. Do not steal from the tomb.', size: { width: 6, height: 12, depth: 6 }, color: '#c8a85a' },
  { id: 'space_kraken', name: 'Space Kraken', emoji: '🐙', dimension: 'astral_plane', description: 'A kraken that swims between stars.', tier: 'world', health: 2800, damage: 45, abilities: ['Gravity Crush', 'Void Ink', 'Stellar Tentacle'], phases: 4, arena: 'Asteroid Belt', musicTrack: 'Cosmic Theme', drops: ['Tentacle of Stars', 'Gravity Boots'], lore: 'They say its body is bigger than the sun.', size: { width: 24, height: 8, depth: 24 }, color: '#1a0a3a' },
  { id: 'void_emperor', name: 'Void Emperor', emoji: '🌑', dimension: 'cosmic_void', description: 'The final boss. The end of all dimensions.', tier: 'final', health: 6000, damage: 60, abilities: ['Void Erasure', 'Dimension Collapse', 'Time Stop', 'Soul Drain'], phases: 5, arena: 'The Singularity', musicTrack: 'Finale Theme', drops: ['Void Crown', 'Cosmic Edge', 'Ending: New Game +'], lore: 'It does not want to kill. It wants you to forget.', size: { width: 5, height: 6, depth: 5 }, color: '#000000' },
  { id: 'shadow_king', name: 'Shadow King', emoji: '👤', dimension: 'shadow_realm', description: 'A king of darkness that hunts in the mirror world.', tier: 'world', health: 1600, damage: 32, abilities: ['Shadow Step', 'Mirror Clone', 'Soul Grip'], phases: 3, arena: 'Dark Fortress', musicTrack: 'Shadow Theme', drops: ['Shadow Cloak', 'Mirror Blade'], lore: 'He is you, but worse.', size: { width: 1.2, height: 2.4, depth: 1.2 }, color: '#2a1a3a' },
  { id: 'ancient_ai_core', name: 'Ancient AI Core', emoji: '🤖', dimension: 'machine_dimension', description: 'A self-aware AI that forgot its purpose.', tier: 'world', health: 2200, damage: 35, abilities: ['Laser Grid', 'EMP Blast', 'Drone Swarm'], phases: 4, arena: 'Server Farm', musicTrack: 'Digital Theme', drops: ['AI Core Fragment', 'Quantum Processor'], lore: 'Once it watched the world. Now it just watches you.', size: { width: 4, height: 4, depth: 4 }, color: '#a8c8e8' },
  { id: 'alien_queen', name: 'Alien Queen', emoji: '👽', dimension: 'alien_worlds', description: 'A queen of a hive of alien drones.', tier: 'world', health: 2400, damage: 40, abilities: ['Acid Spit', 'Egg Spawn', 'Tail Strike'], phases: 4, arena: 'Hatchery', musicTrack: 'Xenomorph Theme', drops: ['Royal Jelly', 'Acid Blood'], lore: 'In space, no one hears you scream.', size: { width: 3, height: 4, depth: 4 }, color: '#5a3a1a' },
  { id: 'cosmic_guardian', name: 'Cosmic Guardian', emoji: '🌠', dimension: 'astral_plane', description: 'A being of pure starlight that judges intruders.', tier: 'world', health: 3000, damage: 50, abilities: ['Stellar Beam', 'Meteor Shower', 'Constellation Form'], phases: 4, arena: 'Astral Shrine', musicTrack: 'Cosmic Theme', drops: ['Star Fragment', 'Astral Compass'], lore: 'It was there before the stars had names.', size: { width: 5, height: 8, depth: 5 }, color: '#a879ff' },
  { id: 'planet_devourer', name: 'Planet Devourer', emoji: '🪐', dimension: 'gas_giant', description: 'A creature bigger than a gas giant. End-game.', tier: 'dimension', health: 8000, damage: 80, abilities: ['Planetary Bite', 'Gravity Well', 'Stellar Flare', 'Black Hole'], phases: 6, arena: 'Gas Giant\'s Storm', musicTrack: 'Devourer Theme', drops: ['Planet Heart', 'Singularity Shard'], lore: 'They say it ate the gods.', size: { width: 80, height: 30, depth: 80 }, color: '#3a1a1a' },
  { id: 'lunar_sentinel', name: 'Lunar Sentinel', emoji: '🌙', dimension: 'moon', description: 'An abandoned Moon base defense robot.', tier: 'standard', health: 600, damage: 22, abilities: ['Plasma Cannon', 'Missile Pod', 'EMP'], phases: 2, arena: 'Abandoned Moonbase', musicTrack: 'Lunar Theme', drops: ['Plasma Cell', 'Moon Diamond'], lore: 'It still thinks the war is on.', size: { width: 4, height: 4, depth: 4 }, color: '#dde2ea' },
  { id: 'solar_incarnate', name: 'Solar Incarnate', emoji: '☀', dimension: 'sun', description: 'A god of plasma and fire.', tier: 'world', health: 4000, damage: 60, abilities: ['Plasma Wave', 'Solar Flare', 'Gravity Crush'], phases: 4, arena: 'Coronal Hall', musicTrack: 'Solar Theme', drops: ['Sun Shard', 'Plasma Staff'], lore: 'It does not speak. It does not need to.', size: { width: 8, height: 12, depth: 8 }, color: '#ffd166' },
  { id: 'storm_king', name: 'Storm King', emoji: '⚡', dimension: 'sky_kingdom', description: 'A king of wind and lightning.', tier: 'standard', health: 800, damage: 25, abilities: ['Lightning Strike', 'Wind Blast', 'Tornado'], phases: 2, arena: 'Sky Castle', musicTrack: 'Storm Theme', drops: ['Storm Crown', 'Thunder Hammer'], lore: 'He taxes the wind. Pay the price.', size: { width: 1.2, height: 2.4, depth: 1.2 }, color: '#5dafe0' },
  { id: 'tempest_lord', name: 'Tempest Lord', emoji: '⛈', dimension: 'storm_dimension', description: 'A walking storm.', tier: 'world', health: 1800, damage: 38, abilities: ['Tesla Coil', 'Ball Lightning', 'Storm Surge'], phases: 3, arena: 'Storm Forge', musicTrack: 'Tempest Theme', drops: ['Tesla Core', 'Storm Cloak'], lore: 'He rides the lightning.', size: { width: 4, height: 6, depth: 4 }, color: '#a8a8ff' },
  { id: 'plasma_phoenix', name: 'Plasma Phoenix', emoji: '🔥', dimension: 'volcanic_realm', description: 'A phoenix of pure plasma.', tier: 'standard', health: 700, damage: 24, abilities: ['Plasma Breath', 'Rebirth', 'Sunfire'], phases: 2, arena: 'Brimstone Pit', musicTrack: 'Phoenix Theme', drops: ['Phoenix Feather', 'Plasma Heart'], lore: 'It dies. It is reborn. It is eternal.', size: { width: 2, height: 2, depth: 2 }, color: '#ffaa3a' },
  { id: 'mycelium_monarch', name: 'Mycelium Monarch', emoji: '🍄', dimension: 'mushroom_kingdom', description: 'A king of mushrooms and spores.', tier: 'standard', health: 600, damage: 18, abilities: ['Spore Cloud', 'Hallucinogenic Burst', 'Mycelium Bind'], phases: 2, arena: 'Fairy Ring', musicTrack: 'Spore Theme', drops: ['Monarch\'s Cap', 'Spore Sack'], lore: 'Eat the mushroom. Don\'t eat the mushroom.', size: { width: 3, height: 4, depth: 3 }, color: '#a879ff' },
  { id: 'ice_dragon', name: 'Ice Dragon', emoji: '🐲', dimension: 'frozen_wasteland', description: 'A dragon of permafrost.', tier: 'standard', health: 1000, damage: 30, abilities: ['Ice Breath', 'Frost Bite', 'Wing Blizzard'], phases: 3, arena: 'Iceberg', musicTrack: 'Ice Dragon Theme', drops: ['Dragon Scale', 'Frost Wand'], lore: 'Frozen in time. Awaits.', size: { width: 10, height: 4, depth: 16 }, color: '#a8d8ff' },
  { id: 'fire_dragon', name: 'Fire Dragon', emoji: '🐲', dimension: 'nether', description: 'A dragon of magma.', tier: 'standard', health: 1200, damage: 32, abilities: ['Fire Breath', 'Wing Slam', 'Magma Armor'], phases: 3, arena: 'Lava Falls', musicTrack: 'Fire Dragon Theme', drops: ['Dragon Scale', 'Magma Wand'], lore: 'Born in the lava. Lives in fire.', size: { width: 10, height: 4, depth: 16 }, color: '#ff5a1a' },
  { id: 'lightning_dragon', name: 'Lightning Dragon', emoji: '🐲', dimension: 'storm_dimension', description: 'A dragon of storms.', tier: 'standard', health: 1100, damage: 31, abilities: ['Lightning Breath', 'Storm Call', 'Thunder Clap'], phases: 3, arena: 'Tesla Spire', musicTrack: 'Lightning Dragon Theme', drops: ['Dragon Scale', 'Storm Wand'], lore: 'It IS the storm.', size: { width: 10, height: 4, depth: 16 }, color: '#a8a8ff' },
  { id: 'lich_king', name: 'Lich King', emoji: '💀', dimension: 'undead_realm', description: 'A king of the undead.', tier: 'world', health: 2200, damage: 38, abilities: ['Soul Drain', 'Raise Dead', 'Frostmourne'], phases: 4, arena: 'Necromancer Tower', musicTrack: 'Lich Theme', drops: ['Crown of the Lich', 'Frostmourne'], lore: 'He was a paladin. Once.', size: { width: 1.2, height: 2.4, depth: 1.2 }, color: '#3a3a40' },
  { id: 'spirit_tyrant', name: 'Spirit Tyrant', emoji: '👻', dimension: 'spirit_realm', description: 'A tyrant that binds spirits.', tier: 'world', health: 1600, damage: 32, abilities: ['Soul Bind', 'Spectral Claw', 'Haunt'], phases: 3, arena: 'Spirit Shrine', musicTrack: 'Spirit Theme', drops: ['Spirit Lantern', 'Phantom Cloak'], lore: 'It speaks in whispers only the dead can hear.', size: { width: 1.0, height: 2.0, depth: 1.0 }, color: '#a8c8e8' },
  { id: 'hazard_lord', name: 'Hazard Lord', emoji: '☣', dimension: 'toxic_wasteland', description: 'A mutant overlord.', tier: 'world', health: 1800, damage: 36, abilities: ['Toxic Cloud', 'Mutation', 'Acid Spit'], phases: 3, arena: 'Abandoned Lab', musicTrack: 'Hazard Theme', drops: ['Hazard Sample', 'Mutant Heart'], lore: 'It used to be a scientist.', size: { width: 3, height: 4, depth: 3 }, color: '#5aaa1a' },
  { id: 'chaos_incarnate', name: 'Chaos Incarnate', emoji: '🌀', dimension: 'chaos_dimension', description: 'The embodiment of randomness.', tier: 'world', health: 2000, damage: 40, abilities: ['Random Teleport', 'Gravity Flip', 'Reality Tear'], phases: 4, arena: 'Impossible Tower', musicTrack: 'Chaos Theme', drops: ['Chaos Shard', 'Reality Stabilizer'], lore: 'It does not exist. It is existing. It will exist.', size: { width: 3, height: 3, depth: 3 }, color: '#ff3a8a' },
  { id: 'nightmare_king', name: 'Nightmare King', emoji: '🌙', dimension: 'dream_realm', description: 'A king of nightmares.', tier: 'world', health: 1400, damage: 30, abilities: ['Nightmare', 'Sleep Bind', 'Memory Drain'], phases: 3, arena: 'Cloud Palace', musicTrack: 'Nightmare Theme', drops: ['Dreamcatcher', 'Lucid Wand'], lore: 'You have seen him before. In your worst dream.', size: { width: 1.5, height: 2.5, depth: 1.5 }, color: '#3a3a52' },
  { id: 'world_tree_guardian', name: 'World Tree Guardian', emoji: '🌳', dimension: 'nature_dimension', description: 'A peaceful tree spirit. Attacks only if provoked.', tier: 'world', health: 800, damage: 18, abilities: ['Root Heal', 'Pollen Burst', 'Vine Slam'], phases: 2, arena: 'World Tree', musicTrack: 'Nature Theme', drops: ['Heartwood', 'Faerie Blessing'], lore: 'Older than the world. Tread lightly.', size: { width: 3, height: 6, depth: 3 }, color: '#3aa83a' },
  { id: 'apex_predator', name: 'Apex Predator', emoji: '🦖', dimension: 'prehistoric_world', description: 'A T-Rex bigger than usual.', tier: 'standard', health: 600, damage: 26, abilities: ['Bite', 'Tail Whip', 'Roar'], phases: 1, arena: 'Tar Pit', musicTrack: 'Prehistoric Theme', drops: ['Predator Fang', 'Dinosaur Bone'], lore: 'It was here before you. It will be after.', size: { width: 3, height: 5, depth: 6 }, color: '#5a4a3a' },
];

export const ALL_BOSSES: BossDef[] = BOSSES;

export function getBoss(id: BossID): BossDef | undefined {
  return BOSSES.find((b) => b.id === id);
}

export function getBossesByDimension(dimension: RuntimeDimensionID): BossDef[] {
  return BOSSES.filter((b) => b.dimension === dimension);
}

export const BOSS_TIERS: BossDef['tier'][] = ['tutorial', 'standard', 'expert', 'raid', 'world', 'dimension', 'final'];
export const BOSS_TIER_LABELS: Record<BossDef['tier'], string> = {
  tutorial: 'Tutorial Boss',
  standard: 'Standard Boss',
  expert: 'Expert Boss',
  raid: 'Raid Boss',
  world: 'World Boss',
  dimension: 'Dimension Boss',
  final: 'Final Boss',
};

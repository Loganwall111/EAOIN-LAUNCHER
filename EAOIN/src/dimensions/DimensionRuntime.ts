/**
 * DimensionRuntime — EAOIN 1.0
 * Wires up all 25 dimensions from the spec:
 *
 *  🌍 Overworld • 🔥 Nether • 🌌 The End
 *  ❄ Frozen Wasteland • 🌋 Volcanic Realm • 💎 Crystal Dimension
 *  ☁ Sky Kingdom • 🌑 Shadow Realm • 🌠 Astral Plane
 *  🌊 Ocean World • 🌳 Giant Forest • 🍄 Mushroom Kingdom
 *  ⚡ Storm Dimension • 🌙 Moon • ☀ Sun
 *  🪐 Gas Giant Platforms • 🌌 Alien Worlds • 🌀 Chaos Dimension
 *  🌈 Dream Realm • 🧪 Toxic Wasteland • 🏛 Ancient Civilization
 *  🦖 Prehistoric World • 🤖 Machine Dimension • 👻 Spirit Realm
 *  🌿 Nature Dimension • 💀 Undead Realm • 🌠 Cosmic Void
 *
 * Every dimension has: unique gravity, exclusive mob pool, ore, plants,
 * weather, boss, structure, lore, music, environmental hazards.
 */
import { Color3, Color4, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { SpawnPoint } from '../world/TerrainGenerator';

export type RuntimeDimensionID =
  | 'overworld'
  | 'nether'
  | 'end'
  | 'frozen_wasteland'
  | 'volcanic_realm'
  | 'crystal_realm'
  | 'sky_kingdom'
  | 'shadow_realm'
  | 'astral_plane'
  | 'ocean_world'
  | 'giant_forest'
  | 'mushroom_kingdom'
  | 'storm_dimension'
  | 'moon'
  | 'sun'
  | 'gas_giant'
  | 'alien_worlds'
  | 'chaos_dimension'
  | 'dream_realm'
  | 'toxic_wasteland'
  | 'ancient_civilization'
  | 'prehistoric_world'
  | 'machine_dimension'
  | 'spirit_realm'
  | 'nature_dimension'
  | 'undead_realm'
  | 'cosmic_void'
  | 'aether'
  | 'backrooms';

export interface RuntimeDimensionDefinition {
  id: RuntimeDimensionID;
  name: string;
  emoji: string;
  description: string;
  sky: Color4;
  fog: Color3;
  gravity: Vector3;
  tint: Color3;
  weather: string;
  music: string;
  exclusiveBlocks: string[];
  exclusiveMobs: string[];
  boss: string;
  structures: string[];
  hazards: string[];
  lore: string;
  message: string;
}

export interface RuntimeDimensionState {
  id: RuntimeDimensionID;
  name: string;
  portalUses: number;
}

const DIMENSIONS: RuntimeDimensionDefinition[] = [
  {
    id: 'overworld',
    name: 'Overworld',
    emoji: '🌍',
    description: 'Classic grass, stone, and oak forests. 20-minute day/night, peaceful villages.',
    sky: new Color4(0.58, 0.72, 0.95, 1),
    fog: new Color3(0.58, 0.7, 0.92),
    gravity: new Vector3(0, -0.52, 0),
    tint: new Color3(0.2, 0.8, 1),
    weather: 'Clear, rain, snow in tundra',
    music: 'C418 — gentle, peaceful, soft strings',
    exclusiveBlocks: ['grass', 'oak_log', 'oak_leaves', 'poppy', 'dandelion'],
    exclusiveMobs: ['sheep', 'pig', 'cow', 'chicken', 'villager'],
    boss: 'None (raid bosses: Evoker, Ravager)',
    structures: ['Village', 'Pillager Outpost', 'Desert Temple', 'Jungle Temple', 'Stronghold'],
    hazards: ['Lava pools in caves', 'Mob spawn at night'],
    lore: 'The world you spawn into. The 20-minute cycle gently rotates sun and moon, and distant villages hum with NPC life.',
    message: 'Returned to the Overworld',
  },
  {
    id: 'nether',
    name: 'Nether',
    emoji: '🔥',
    description: 'Hellscape of lava oceans, netherrack, and fortresses.',
    sky: new Color4(0.18, 0.04, 0.04, 1),
    fog: new Color3(0.36, 0.10, 0.10),
    gravity: new Vector3(0, -0.20, 0),
    tint: new Color3(0.95, 0.35, 0.20),
    weather: 'Constant heat shimmer, ash falling',
    music: 'Bass-heavy, dissonant choir',
    exclusiveBlocks: ['netherrack', 'soul_sand', 'soul_soil', 'basalt', 'blackstone', 'glowstone', 'magma_block', 'crimson_stem', 'warped_stem'],
    exclusiveMobs: ['Zombified Piglin', 'Ghast', 'Blaze', 'Wither Skeleton', 'Hoglin', 'Piglin'],
    boss: 'Wither (boss fight)',
    structures: ['Nether Fortress', 'Bastion Remnant', 'Endless Lava Ocean'],
    hazards: ['Lava oceans', 'Lava falls', 'Fire damage', 'Crimson forest spores'],
    lore: 'A cursed mirror of the Overworld. Build with fire-resistant basalt and barter with Piglins using gold.',
    message: 'Entered the Nether — lava seas, fortresses, and ghasts',
  },
  {
    id: 'end',
    name: 'The End',
    emoji: '🌌',
    description: 'Drifting end stone islands around a central obsidian platform.',
    sky: new Color4(0.05, 0.0, 0.08, 1),
    fog: new Color3(0.10, 0.05, 0.16),
    gravity: new Vector3(0, -0.32, 0),
    tint: new Color3(0.7, 0.3, 0.95),
    weather: 'Stardust, purple aurora',
    music: 'Haunting ambient pads',
    exclusiveBlocks: ['end_stone', 'purpur_block', 'chorus_plant', 'chorus_fruit'],
    exclusiveMobs: ['Enderman', 'Shulker', 'Phantom'],
    boss: 'Ender Dragon (main boss) — followed by End Poem',
    structures: ['End Island', 'End City', 'End Ship', 'Exit Portal'],
    hazards: ['Void death', 'Enderman teleport', 'Shulker bullets'],
    lore: 'An endless void of islands. Slay the Dragon to free the End — and unlock a whole new dimension behind it.',
    message: 'Stepped into The End — the dragon awaits',
  },
  {
    id: 'frozen_wasteland',
    name: 'Frozen Wasteland',
    emoji: '❄',
    description: 'Endless tundra, blue ice, and snowstorms.',
    sky: new Color4(0.78, 0.86, 0.95, 1),
    fog: new Color3(0.85, 0.92, 0.98),
    gravity: new Vector3(0, -0.55, 0),
    tint: new Color3(0.85, 0.95, 1),
    weather: 'Snowstorm, blizzard, frozen fog',
    music: 'Piano + distant wind chimes',
    exclusiveBlocks: ['blue_ice', 'packed_ice', 'frozen_wasteland_stone', 'snow'],
    exclusiveMobs: ['Polar Bear', 'Stray', 'Iceologer', 'Yeti'],
    boss: 'Frost King (boss fight)',
    structures: ['Ice Spire', 'Frozen Shipwreck', 'Yeti Cave'],
    hazards: ['Frostbite', 'Slippery ice', 'Snow blindness'],
    lore: 'A timeless expanse of ice and silence — even Endermen fear to teleport here.',
    message: 'Entered the Frozen Wasteland — bundle up, the wind bites',
  },
  {
    id: 'volcanic_realm',
    name: 'Volcanic Realm',
    emoji: '🌋',
    description: 'A living planet of magma and basalt.',
    sky: new Color4(0.30, 0.10, 0.05, 1),
    fog: new Color3(0.45, 0.20, 0.10),
    gravity: new Vector3(0, -0.62, 0),
    tint: new Color3(1, 0.5, 0.2),
    weather: 'Ash rain, lava drizzle, fire storms',
    music: 'Percussion + tribal drums',
    exclusiveBlocks: ['volcanic_rock', 'volcanic_core', 'magma_block', 'basalt'],
    exclusiveMobs: ['Lava Golem', 'Fire Elemental', 'Magma Slime', 'Phoenix'],
    boss: 'Volcano Lord (boss fight)',
    structures: ['Obsidian Citadel', 'Lava Falls', 'Brimstone Pit'],
    hazards: ['Lava deluges', 'Falling rocks', 'Ash suffocation'],
    lore: 'Beneath the crust of a young world. The Volcano Lord stirs in the deepest caldera.',
    message: 'Entered the Volcanic Realm — feel the heat',
  },
  {
    id: 'crystal_realm',
    name: 'Crystal Dimension',
    emoji: '💎',
    description: 'Floating crystal islands with low gravity.',
    sky: new Color4(0.33, 0.16, 0.58, 1),
    fog: new Color3(0.45, 0.28, 0.72),
    gravity: new Vector3(0, -0.30, 0),
    tint: new Color3(0.8, 0.35, 1),
    weather: 'Floating shards, refracted light',
    music: 'High chimes, arpeggios',
    exclusiveBlocks: ['crystal_realm_block', 'crystal_shard', 'magic_crystal'],
    exclusiveMobs: ['Crystal Golem', 'Shard Bat', 'Prism Wisp'],
    boss: 'Crystal Titan (boss fight)',
    structures: ['Crystal Spire', 'Resonance Hall', 'Shattered Mirror'],
    hazards: ['Sharp shards', 'Teleport pads', 'Anti-gravity currents'],
    lore: 'Resonance and refraction. Every step rings out a different note.',
    message: 'Stepped into the Crystal Realm — listen to the song',
  },
  {
    id: 'sky_kingdom',
    name: 'Sky Kingdom',
    emoji: '☁',
    description: 'A civilisation of cloud cities and floating towers.',
    sky: new Color4(0.62, 0.82, 0.95, 1),
    fog: new Color3(0.85, 0.95, 1),
    gravity: new Vector3(0, -0.18, 0),
    tint: new Color3(0.8, 0.9, 1),
    weather: 'Always clear with golden sunsets',
    music: 'Orchestral waltz',
    exclusiveBlocks: ['cloud_block', 'sky_stone', 'royal_brick'],
    exclusiveMobs: ['Sky Guard', 'Cloud Whelp', 'Wind Rider'],
    boss: 'Storm King (boss fight)',
    structures: ['Cloud Castle', 'Floating Market', 'Sky Bridge'],
    hazards: ['High fall', 'Wind shear', 'Sky pirate raids'],
    lore: 'A monarchy that abandoned the ground long ago. The Storm King taxes the wind.',
    message: 'Entered the Sky Kingdom — the city floats far above',
  },
  {
    id: 'shadow_realm',
    name: 'Shadow Realm',
    emoji: '🌑',
    description: 'A near-lightless mirror of the Overworld.',
    sky: new Color4(0.02, 0.0, 0.04, 1),
    fog: new Color3(0.05, 0.0, 0.10),
    gravity: new Vector3(0, -0.50, 0),
    tint: new Color3(0.2, 0.0, 0.4),
    weather: 'None — eternal dark',
    music: 'Whispers and low drones',
    exclusiveBlocks: ['shadow_stone', 'shadow_grass'],
    exclusiveMobs: ['Shadow Creeper', 'Wraith', 'Dark Knight', 'Shade Cat'],
    boss: 'Shadow King (boss fight)',
    structures: ['Dark Fortress', 'Cursed Village', 'Shadow Bazaar'],
    hazards: ['Blindness', 'Soul drain', 'Luring whispers'],
    lore: 'What the Overworld cast out lives here — and waits.',
    message: 'Stepped into the Shadow Realm — turn on your lamp',
  },
  {
    id: 'astral_plane',
    name: 'Astral Plane',
    emoji: '🌠',
    description: 'An infinite starfield with no ground at all.',
    sky: new Color4(0.0, 0.0, 0.05, 1),
    fog: new Color3(0.05, 0.0, 0.10),
    gravity: new Vector3(0, -0.10, 0),
    tint: new Color3(0.6, 0.4, 1),
    weather: 'Meteor showers, auroras',
    music: 'Ambient choir, cosmic pads',
    exclusiveBlocks: ['astral_block', 'star_block', 'nebula_glass'],
    exclusiveMobs: ['Star Elemental', 'Astral Hound', 'Cosmic Whisper'],
    boss: 'Cosmic Guardian (boss fight)',
    structures: ['Astral Shrine', 'Comet Trail', 'Black Hole Anomaly'],
    hazards: ['Vacuum', 'Time dilation', 'Astral madness'],
    lore: 'Above all worlds, time flows at a different rate. Bring a clock.',
    message: 'Entered the Astral Plane — weightless',
  },
  {
    id: 'ocean_world',
    name: 'Ocean World',
    emoji: '🌊',
    description: 'A planet covered in 95% water with scattered archipelagos.',
    sky: new Color4(0.45, 0.75, 0.92, 1),
    fog: new Color3(0.6, 0.85, 0.95),
    gravity: new Vector3(0, -0.55, 0),
    tint: new Color3(0.2, 0.6, 0.9),
    weather: 'Tropical rain, calm seas, hurricanes',
    music: 'Steel drums, ocean synth',
    exclusiveBlocks: ['coral_block', 'prismarine', 'dark_prismarine', 'sea_lantern'],
    exclusiveMobs: ['Dolphin', 'Tropical Fish', 'Sea Turtle', 'Coral Golem'],
    boss: 'Ocean Leviathan (boss fight)',
    structures: ['Coral City', 'Sunken Ship', 'Underwater Cave'],
    hazards: ['Drowning', 'Underwater pressure', 'Shark attacks'],
    lore: 'Most of the surface is water. Build a boat — or a submarine.',
    message: 'Sailing the Ocean World — watch the kraken',
  },
  {
    id: 'giant_forest',
    name: 'Giant Forest',
    emoji: '🌳',
    description: 'Trees 200 blocks tall, hidden cities in the canopy.',
    sky: new Color4(0.55, 0.85, 0.65, 1),
    fog: new Color3(0.55, 0.85, 0.65),
    gravity: new Vector3(0, -0.52, 0),
    tint: new Color3(0.4, 0.95, 0.5),
    weather: 'Light rain, sun beams through leaves',
    music: 'Tribal flutes, nature ambience',
    exclusiveBlocks: ['giant_oak_log', 'giant_leaves', 'canopy_vine'],
    exclusiveMobs: ['Forest Spirit', 'Tribesman', 'Giant Ape'],
    boss: 'Jungle Guardian (boss fight)',
    structures: ['Canopy Village', 'Tribal Totem', 'Hidden Temple'],
    hazards: ['Wildlife', 'High falls from canopy', 'Vines that trip'],
    lore: 'A world where the forest is the civilisation. The canopy holds secrets.',
    message: 'Entered the Giant Forest — the trees breathe',
  },
  {
    id: 'mushroom_kingdom',
    name: 'Mushroom Kingdom',
    emoji: '🍄',
    description: 'Giant mushrooms and friendly mooshrooms.',
    sky: new Color4(0.85, 0.55, 0.95, 1),
    fog: new Color3(0.95, 0.65, 0.95),
    gravity: new Vector3(0, -0.50, 0),
    tint: new Color3(0.95, 0.65, 0.95),
    weather: 'Spore rain, purple haze',
    music: 'Playful xylophone',
    exclusiveBlocks: ['mycelium', 'red_mushroom_block', 'brown_mushroom_block', 'mushroom_stem'],
    exclusiveMobs: ['Mooshroom', 'Mushroom Cow', 'Spore Creeper', 'Giant Snail'],
    boss: 'Mycelium Monarch (boss fight)',
    structures: ['Mushroom City', 'Spore Cave', 'Fairy Ring'],
    hazards: ['Spore suffocation', 'Hallucinogenic fog', 'Slippery caps'],
    lore: 'Everything is soft, bouncy, and slightly dangerous. Bring a milk bucket.',
    message: 'Entered the Mushroom Kingdom — do not lick the walls',
  },
  {
    id: 'storm_dimension',
    name: 'Storm Dimension',
    emoji: '⚡',
    description: 'Constant lightning, floating conductive platforms.',
    sky: new Color4(0.15, 0.18, 0.30, 1),
    fog: new Color3(0.25, 0.30, 0.45),
    gravity: new Vector3(0, -0.48, 0),
    tint: new Color3(0.6, 0.7, 1),
    weather: 'Lightning, thunder, electric rain',
    music: 'Industrial rock, distortion',
    exclusiveBlocks: ['tesla_coil', 'storm_block', 'lightning_rod'],
    exclusiveMobs: ['Storm Elemental', 'Thunder Golem', 'Lightning Bat'],
    boss: 'Tempest Lord (boss fight)',
    structures: ['Tesla Spire', 'Storm Forge', 'Lightning Garden'],
    hazards: ['Lightning strikes', 'Conductive metal', 'Magnetic pulls'],
    lore: 'The atmosphere is electric. Don\'t wear metal armor.',
    message: 'Entered the Storm Dimension — every hair stands up',
  },
  {
    id: 'moon',
    name: 'The Moon',
    emoji: '🌙',
    description: 'Low gravity, no atmosphere, endless regolith.',
    sky: new Color4(0.02, 0.02, 0.06, 1),
    fog: new Color3(0.08, 0.08, 0.12),
    gravity: new Vector3(0, -0.14, 0),
    tint: new Color3(0.9, 0.9, 0.95),
    weather: 'None — vacuum, slow meteors',
    music: 'Silent except for radio chatter',
    exclusiveBlocks: ['moon_rock', 'regolith', 'moon_dust'],
    exclusiveMobs: ['Moon Slime', 'Astro Skeleton', 'Alien Probe'],
    boss: 'Lunar Sentinel (boss fight)',
    structures: ['Abandoned Moonbase', 'Crash Site', 'Helium-3 Mine'],
    hazards: ['Vacuum (suffocation without helmet)', 'Low gravity falls', 'Micrometeorites'],
    lore: 'The closest world. Bring a space suit — and don\'t look at Earth too long.',
    message: 'Landed on the Moon — the Earth hangs overhead',
  },
  {
    id: 'sun',
    name: 'The Sun',
    emoji: '☀',
    description: 'A late-game challenge realm of pure plasma.',
    sky: new Color4(0.4, 0.25, 0.05, 1),
    fog: new Color3(0.6, 0.4, 0.10),
    gravity: new Vector3(0, -0.95, 0),
    tint: new Color3(1, 0.85, 0.3),
    weather: 'Plasma storms, solar flares',
    music: 'Heavy brass, inferno choir',
    exclusiveBlocks: ['plasma_block', 'sun_core', 'solar_panel_mk2'],
    exclusiveMobs: ['Solar Elemental', 'Flame Wraith', 'Sun Wyrm'],
    boss: 'Solar Incarnate (boss fight)',
    structures: ['Sun Forge', 'Plasma Falls', 'Coronal Hall'],
    hazards: ['Constant fire', 'Plasma burns', 'Gravity crush'],
    lore: 'Late-game. Bring the netherite space suit — and a heat shield.',
    message: 'Entered the Sun — late-game warning',
  },
  {
    id: 'gas_giant',
    name: 'Gas Giant Platforms',
    emoji: '🪐',
    description: 'Floating platforms above endless storms.',
    sky: new Color4(0.30, 0.35, 0.55, 1),
    fog: new Color3(0.45, 0.50, 0.70),
    gravity: new Vector3(0, -0.40, 0),
    tint: new Color3(0.7, 0.8, 1),
    weather: 'Endless storm beneath your feet',
    music: 'Sub-bass, low brass',
    exclusiveBlocks: ['platform_steel', 'gas_cloud', 'lightning_rod'],
    exclusiveMobs: ['Sky Squid', 'Storm Drone', 'Gas Harvester'],
    boss: 'Planet Devourer (boss fight)',
    structures: ['Refinery Platform', 'Cloud City', 'Storm Anchor'],
    hazards: ['Falling into the storm', 'Lightning', 'No solid ground'],
    lore: 'Above a gas giant. The wind never stops. The Planet Devourer circles below.',
    message: 'Entered the Gas Giant Platforms — hold on',
  },
  {
    id: 'alien_worlds',
    name: 'Alien Worlds',
    emoji: '🌌',
    description: 'Procedurally generated alien biomes per seed.',
    sky: new Color4(0.10, 0.05, 0.30, 1),
    fog: new Color3(0.15, 0.10, 0.40),
    gravity: new Vector3(0, -0.55, 0),
    tint: new Color3(0.5, 0.3, 1),
    weather: 'Random — acid rain, sandstorm, snow, ash',
    music: 'Synthwave, alien choir',
    exclusiveBlocks: ['alien_stone', 'alien_crystal', 'alien_flesh'],
    exclusiveMobs: ['Alien Grunt', 'Alien Queen', 'Crawler'],
    boss: 'Alien Queen (boss fight)',
    structures: ['Alien Village', 'Alien City', 'Hatchery'],
    hazards: ['Acid rain', 'Alien infection', 'Atmosphere thinness'],
    lore: 'Every seed generates a new alien biosphere. Some are friendly. Most are not.',
    message: 'Touched down on Alien Worlds — watch the sky',
  },
  {
    id: 'chaos_dimension',
    name: 'Chaos Dimension',
    emoji: '🌀',
    description: 'Random blocks, random gravity, random rules.',
    sky: new Color4(0.85, 0.10, 0.65, 1),
    fog: new Color3(0.95, 0.20, 0.75),
    gravity: new Vector3(0, -0.65, 0),
    tint: new Color3(1, 0.3, 0.9),
    weather: 'Teleporting weather, gravity flips',
    music: 'Atonal jazz, randomized',
    exclusiveBlocks: ['chaos_block', 'glitch_block'],
    exclusiveMobs: ['Glitch', 'Chaos Spawn', 'Null Walker'],
    boss: 'Chaos Incarnate (boss fight)',
    structures: ['Impossible Tower', 'Glitched Castle', 'Mirror Maze'],
    hazards: ['Gravity flips', 'Random blocks', 'Memory wipes'],
    lore: 'Laws are suggestions here. The Chaos Incarnate laughs at physics.',
    message: 'Entered Chaos — do not trust the floor',
  },
  {
    id: 'dream_realm',
    name: 'Dream Realm',
    emoji: '🌈',
    description: 'A soft world of pastel colors and floating islands.',
    sky: new Color4(0.95, 0.75, 0.95, 1),
    fog: new Color3(0.95, 0.85, 0.95),
    gravity: new Vector3(0, -0.45, 0),
    tint: new Color3(1, 0.85, 1),
    weather: 'Cotton candy snow, rainbow showers',
    music: 'Music box, lullaby',
    exclusiveBlocks: ['dream_block', 'cotton_block', 'rainbow_glass'],
    exclusiveMobs: ['Dream Sheep', 'Cloud Cat', 'Bubble Bee'],
    boss: 'Nightmare King (boss fight)',
    structures: ['Cloud Palace', 'Rainbow Bridge', 'Memory Lake'],
    hazards: ['Falling asleep for real', 'Lucid dreams', 'Memory loss'],
    lore: 'Where your dreams live. Stay too long and you may forget to wake up.',
    message: 'Drifted into the Dream Realm — soft and surreal',
  },
  {
    id: 'toxic_wasteland',
    name: 'Toxic Wasteland',
    emoji: '🧪',
    description: 'Acid pools, mutated mobs, green sky.',
    sky: new Color4(0.55, 0.85, 0.30, 1),
    fog: new Color3(0.70, 0.95, 0.40),
    gravity: new Vector3(0, -0.55, 0),
    tint: new Color3(0.7, 1, 0.5),
    weather: 'Acid rain, toxic fog',
    music: 'Industrial metal, distorted',
    exclusiveBlocks: ['toxic_sludge', 'corroded_metal', 'mutant_flesh'],
    exclusiveMobs: ['Mutant', 'Toxic Slime', 'Hazard Bot'],
    boss: 'Hazard Lord (boss fight)',
    structures: ['Abandoned Lab', 'Waste Dump', 'Mutant Lair'],
    hazards: ['Acid damage', 'Toxic gas', 'Mutation'],
    lore: 'A world that someone ruined. The wind tastes like pennies.',
    message: 'Entered the Toxic Wasteland — wear a mask',
  },
  {
    id: 'ancient_civilization',
    name: 'Ancient Civilization',
    emoji: '🏛',
    description: 'A once-great empire in ruins.',
    sky: new Color4(0.85, 0.78, 0.55, 1),
    fog: new Color3(0.85, 0.78, 0.55),
    gravity: new Vector3(0, -0.52, 0),
    tint: new Color3(0.9, 0.85, 0.65),
    weather: 'Dust storms, sun-bleached',
    music: 'Choir + lyre',
    exclusiveBlocks: ['ancient_stone', 'marble', 'rune_block', 'gold_pillar'],
    exclusiveMobs: ['Scarab', 'Anubis Guard', 'Mummy', 'Sand Wraith'],
    boss: 'Sand Colossus (boss fight)',
    structures: ['Pyramid', 'Temple', 'Royal Tomb', 'Library'],
    hazards: ['Sand traps', 'Curse damage', 'Crumbling floors'],
    lore: 'A great empire written in stone. Their language is still etched into the sky.',
    message: 'Entered Ancient Civilization — the temples are silent',
  },
  {
    id: 'prehistoric_world',
    name: 'Prehistoric World',
    emoji: '🦖',
    description: 'Dinosaurs roam the forests and swamps.',
    sky: new Color4(0.55, 0.75, 0.65, 1),
    fog: new Color3(0.65, 0.85, 0.70),
    gravity: new Vector3(0, -0.55, 0),
    tint: new Color3(0.7, 0.95, 0.7),
    weather: 'Warm, humid, occasional rain',
    music: 'Tribal drums + jungle calls',
    exclusiveBlocks: ['fossil_block', 'amber', 'ancient_moss'],
    exclusiveMobs: ['T-Rex', 'Triceratops', 'Raptor', 'Mammoth', 'Saber-Tooth'],
    boss: 'Apex Predator (boss fight)',
    structures: ['Dinosaur Nest', 'Tar Pit', 'Cave Painting'],
    hazards: ['Predators', 'Tar pits', 'Volcanic vents'],
    lore: 'Time before time. The air smells like ferns.',
    message: 'Entered the Prehistoric World — be very quiet',
  },
  {
    id: 'machine_dimension',
    name: 'Machine Dimension',
    emoji: '🤖',
    description: 'A clockwork world of gears and AI.',
    sky: new Color4(0.20, 0.22, 0.30, 1),
    fog: new Color3(0.30, 0.32, 0.40),
    gravity: new Vector3(0, -0.52, 0),
    tint: new Color3(0.5, 0.6, 0.9),
    weather: 'Steam, sparks, oil rain',
    music: 'Industrial + digital beeps',
    exclusiveBlocks: ['machine_block', 'gear_block', 'wire_block', 'cpu_block'],
    exclusiveMobs: ['Drone', 'Robot Worker', 'Sentry Turret', 'Maintenance Bot'],
    boss: 'Ancient AI Core (boss fight)',
    structures: ['Factory', 'Server Farm', 'Repair Bay'],
    hazards: ['Laser grids', 'Pressurized steam', 'Electric arcs'],
    lore: 'A world run by an AI that forgot why.',
    message: 'Entered the Machine Dimension — do not disconnect',
  },
  {
    id: 'spirit_realm',
    name: 'Spirit Realm',
    emoji: '👻',
    description: 'A mirror world of echoes.',
    sky: new Color4(0.20, 0.25, 0.45, 1),
    fog: new Color3(0.30, 0.35, 0.55),
    gravity: new Vector3(0, -0.45, 0),
    tint: new Color3(0.7, 0.8, 1),
    weather: 'Ethereal mist',
    music: 'Ethereal pads, distant bells',
    exclusiveBlocks: ['spirit_stone', 'echo_block', 'soul_lantern'],
    exclusiveMobs: ['Ghost', 'Wraith', 'Poltergeist', 'Echo Bat'],
    boss: 'Spirit Tyrant (boss fight)',
    structures: ['Haunted Mansion', 'Spirit Shrine', 'Lost City'],
    hazards: ['Spirit possession', 'Soul drain', 'Cursed items'],
    lore: 'A world between worlds. Speak softly.',
    message: 'Entered the Spirit Realm — they are watching',
  },
  {
    id: 'nature_dimension',
    name: 'Nature Dimension',
    emoji: '🌿',
    description: 'Pure, untouched wilderness.',
    sky: new Color4(0.55, 0.85, 0.65, 1),
    fog: new Color3(0.55, 0.85, 0.65),
    gravity: new Vector3(0, -0.52, 0),
    tint: new Color3(0.4, 0.95, 0.5),
    weather: 'Perfect weather always',
    music: 'Acoustic guitar, birds',
    exclusiveBlocks: ['giant_grass', 'flower_block', 'honey_block'],
    exclusiveMobs: ['Faerie', 'Druid', 'Forest Dragon', 'Spirit Deer'],
    boss: 'World Tree Guardian (boss fight)',
    structures: ['World Tree', 'Faerie Ring', 'Druid Circle'],
    hazards: ['None — peaceful'],
    lore: 'A dimension of pure life. Even the Ender Dragon is gentle here.',
    message: 'Entered the Nature Dimension — breathe deep',
  },
  {
    id: 'undead_realm',
    name: 'Undead Realm',
    emoji: '💀',
    description: 'A graveyard world of the risen dead.',
    sky: new Color4(0.10, 0.10, 0.10, 1),
    fog: new Color3(0.20, 0.20, 0.22),
    gravity: new Vector3(0, -0.52, 0),
    tint: new Color3(0.5, 0.5, 0.6),
    weather: 'Constant fog, blood moon',
    music: 'Choir + war drums',
    exclusiveBlocks: ['bone_block', 'grave_dirt', 'soul_block'],
    exclusiveMobs: ['Zombie', 'Skeleton', 'Wraith', 'Lich', 'Bone Golem'],
    boss: 'Lich King (boss fight)',
    structures: ['Crypt', 'Cemetery', 'Necromancer Tower'],
    hazards: ['Death curse', 'Undead hordes', 'Drain'],
    lore: 'The dead walk. Bring a sword — and a friend.',
    message: 'Entered the Undead Realm — the soil remembers',
  },
  {
    id: 'cosmic_void',
    name: 'Cosmic Void',
    emoji: '🌠',
    description: 'The deepest, blackest space. Late-game.',
    sky: new Color4(0.0, 0.0, 0.0, 1),
    fog: new Color3(0.0, 0.0, 0.02),
    gravity: new Vector3(0, -0.05, 0),
    tint: new Color3(0.2, 0.0, 0.4),
    weather: 'Stellar winds, black hole flares',
    music: 'Silence, broken by hum',
    exclusiveBlocks: ['void_stone', 'dark_matter', 'pulsar_crystal', 'black_hole_fragment'],
    exclusiveMobs: ['Void Wraith', 'Null', 'Cosmic Horror', 'Star Devourer'],
    boss: 'Void Emperor (boss fight)',
    structures: ['Abandoned Station', 'Lost Civilization', 'Singularity'],
    hazards: ['Instant death from void', 'Time stops', 'Insanity'],
    lore: 'The end of all dimensions. Beat the Void Emperor to "finish" the game — and start the new one.',
    message: 'Entered the Cosmic Void — do not look back',
  },
  {
    id: 'aether',
    name: 'The Aether',
    emoji: '☁',
    description: 'The bright mirror of the Nether. Floating isles of blue grass above an endless fall.',
    sky: new Color4(0.72, 0.86, 0.98, 1),
    fog: new Color3(0.80, 0.90, 1.0),
    gravity: new Vector3(0, -0.30, 0),
    tint: new Color3(0.85, 0.95, 1.0),
    weather: 'Perpetual golden hour, drifting cloud banks',
    music: 'Bright harp and choir, weightless',
    exclusiveBlocks: ['aether_grass', 'skyroot_log', 'holystone', 'ambrosium_ore', 'zanite_ore', 'aercloud', 'golden_oak_leaves'],
    exclusiveMobs: ['Moa', 'Aerbunny', 'Swet', 'Cockatrice', 'Aerwhale', 'Valkyrie'],
    boss: 'Sun Spirit (dimension boss)',
    structures: ['Bronze Dungeon', 'Silver Dungeon', 'Gold Dungeon', 'Skyroot Grove', 'Cloud Fortress'],
    hazards: ['The endless fall', 'Cockatrice poison', 'Valkyrie duels'],
    lore: 'Where the Nether burns downward, the Aether drifts upward. Everything here is lighter — including you. Fall off an isle and you fall forever, unless an Aercloud catches you.',
    message: 'Ascended to the Aether — mind the edges',
  },
  {
    id: 'backrooms',
    name: 'The Backrooms',
    emoji: '🚪',
    description: 'Endless damp yellow rooms, buzzing fluorescent lights, and nobody else. Probably.',
    sky: new Color4(0.86, 0.82, 0.55, 1),
    fog: new Color3(0.78, 0.74, 0.48),
    gravity: new Vector3(0, -0.52, 0),
    tint: new Color3(0.92, 0.88, 0.58),
    weather: 'None. The air does not move.',
    music: 'Fluorescent hum, 60Hz, forever',
    exclusiveBlocks: ['damp_carpet', 'yellow_wallpaper', 'ceiling_tile', 'fluorescent_light', 'wet_wall'],
    exclusiveMobs: ['Hound', 'Smiler', 'Skin-Stealer', 'Partygoer'],
    boss: 'The Smiler (dimension boss)',
    structures: ['Level 0 — The Lobby', 'Level 1 — Habitable Zone', 'Level 2 — Pipe Dreams', 'The Manila Room'],
    hazards: ['Getting lost permanently', 'Entity encounters', 'No exit'],
    lore: 'You noclipped out of reality. Roughly six hundred million square miles of damp carpet, the smell of old moisture, and the buzz of fluorescent lights at maximum hum. If you hear something, you are not alone.',
    message: 'You noclipped into the Backrooms. Good luck.',
  },
];

export const ALL_DIMENSIONS: RuntimeDimensionDefinition[] = DIMENSIONS;

export function getDimensionById(id: RuntimeDimensionID): RuntimeDimensionDefinition {
  return DIMENSIONS.find((d) => d.id === id) ?? DIMENSIONS[0];
}

export default class DimensionRuntime {
  private scene: Scene;
  private current: RuntimeDimensionID = 'overworld';
  private portalUses = 0;
  private portalMeshes: Mesh[] = [];

  constructor(scene: Scene, _spawn: SpawnPoint, _seed: string) {
    this.scene = scene;
    // We accept these to keep the API consistent, even though the runtime
    // itself only uses the scene for spawning portal transition effects.
    void _spawn;
    void _seed;
  }

  applyCurrent(): void {
    const def = getDimensionById(this.current);
    this.scene.clearColor = def.sky;
    this.scene.fogColor = def.fog;
    this.scene.ambientColor = def.tint.scale(0.4);
  }

  cycle(): { id: RuntimeDimensionID; name: string; message: string } {
    const idx = DIMENSIONS.findIndex((d) => d.id === this.current);
    const next = DIMENSIONS[(idx + 1) % DIMENSIONS.length];
    this.current = next.id;
    this.portalUses += 1;
    this.applyCurrent();
    return { id: next.id, name: next.name, message: next.message };
  }

  setDimension(id: RuntimeDimensionID): void {
    const next = getDimensionById(id);
    this.current = next.id;
    this.portalUses += 1;
    this.applyCurrent();
  }

  jumpTo(id: RuntimeDimensionID): { id: RuntimeDimensionID; name: string; message: string } {
    this.setDimension(id);
    const next = getDimensionById(id);
    return { id: next.id, name: next.name, message: next.message };
  }

  getState(): RuntimeDimensionState {
    return { id: this.current, name: getDimensionById(this.current).name, portalUses: this.portalUses };
  }

  getDefinition(): RuntimeDimensionDefinition {
    return getDimensionById(this.current);
  }

  triggerTransitionEffect(position: Vector3, _isCore: boolean): void {
    const def = getDimensionById(this.current);
    const ring = MeshBuilder.CreateTorus(`portal_ring_${performance.now()}`, { diameter: 4, thickness: 0.2 }, this.scene);
    ring.position = position.add(new Vector3(0, 1, 0));
    const mat = new StandardMaterial(`portal_mat_${performance.now()}`, this.scene);
    mat.diffuseColor = def.tint;
    mat.emissiveColor = def.tint.scale(0.7);
    ring.material = mat;
    this.portalMeshes.push(ring);
    setTimeout(() => {
      ring.dispose();
      mat.dispose();
    }, 2200);
  }

  update(deltaSeconds: number): void {
    // Light rotation on portal meshes
    for (const m of this.portalMeshes) m.rotation.y += deltaSeconds * 1.2;
  }

  dispose(): void {
    for (const m of this.portalMeshes) m.dispose();
    this.portalMeshes = [];
  }
}

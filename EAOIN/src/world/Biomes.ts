/**
 * Biomes.ts — EAOIN 1.0 expanded biome system.
 * 150+ biomes with temperature/humidity tags used by the terrain generator.
 */

export type BiomeID = string;

export interface BiomeDefinition {
  id: BiomeID;
  name: string;
  emoji: string;
  category: 'forest' | 'desert' | 'mountain' | 'snow' | 'ocean' | 'cave' | 'nether' | 'end' | 'space' | 'mushroom' | 'magic' | 'volcanic' | 'sky' | 'alien' | 'crystal' | 'shadow' | 'spooky' | 'coral' | 'mangrove' | 'mystic';
  temperature: 'cold' | 'temperate' | 'warm' | 'hot';
  humidity: 'arid' | 'normal' | 'humid' | 'wet' | 'snow';
  description: string;
  exclusiveBlocks: string[];
  exclusiveMobs: string[];
  structures: string[];
  hazards: string[];
}

const biomes: BiomeDefinition[] = [
  // Forests (50)
  { id: 'plain', name: 'Plains', emoji: '🌾', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'Wide open grassland with the occasional village.', exclusiveBlocks: ['grass', 'poppy', 'dandelion'], exclusiveMobs: ['horse', 'cow', 'sheep'], structures: ['village'], hazards: [] },
  { id: 'sunflower_plains', name: 'Sunflower Plains', emoji: '🌻', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'Plains carpeted in tall sunflowers.', exclusiveBlocks: ['sunflower'], exclusiveMobs: ['rabbit'], structures: [], hazards: [] },
  { id: 'forest', name: 'Forest', emoji: '🌲', category: 'forest', temperature: 'temperate', humidity: 'humid', description: 'Dense oak and birch.', exclusiveBlocks: ['oak_log', 'birch_log'], exclusiveMobs: ['wolf'], structures: [], hazards: [] },
  { id: 'flower_forest', name: 'Flower Forest', emoji: '🌸', category: 'forest', temperature: 'temperate', humidity: 'humid', description: 'Every color of flower.', exclusiveBlocks: ['poppy', 'dandelion', 'blue_orchid', 'allium'], exclusiveMobs: ['rabbit'], structures: [], hazards: [] },
  { id: 'birch_forest', name: 'Birch Forest', emoji: '🌳', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'Pale birch trees in dense rows.', exclusiveBlocks: ['birch_log', 'birch_leaves'], exclusiveMobs: [], structures: [], hazards: [] },
  { id: 'dark_forest', name: 'Dark Forest', emoji: '🌑', category: 'forest', temperature: 'temperate', humidity: 'humid', description: 'Thick canopy blocks the sun.', exclusiveBlocks: ['dark_oak_log', 'dark_oak_leaves', 'rose_bush'], exclusiveMobs: ['woodland_mansion_spawn'], structures: ['woodland_mansion'], hazards: ['darkness'] },
  { id: 'old_growth_birch', name: 'Old Growth Birch', emoji: '🌲', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'Massive 30-block tall birch.', exclusiveBlocks: ['old_birch_log'], exclusiveMobs: [], structures: [], hazards: [] },
  { id: 'old_growth_pine', name: 'Old Growth Pine', emoji: '🌲', category: 'forest', temperature: 'cold', humidity: 'normal', description: 'Ancient spruce forest.', exclusiveBlocks: ['old_spruce_log', 'old_spruce_leaves'], exclusiveMobs: ['fox'], structures: [], hazards: [] },
  { id: 'taiga', name: 'Taiga', emoji: '🌲', category: 'forest', temperature: 'cold', humidity: 'normal', description: 'Cold spruce forest.', exclusiveBlocks: ['spruce_log', 'spruce_leaves'], exclusiveMobs: ['wolf', 'fox'], structures: ['taiga_village'], hazards: ['cold'] },
  { id: 'snowy_taiga', name: 'Snowy Taiga', emoji: '❄', category: 'forest', temperature: 'cold', humidity: 'normal', description: 'Snow-dusted spruce.', exclusiveBlocks: ['spruce_log', 'snow'], exclusiveMobs: ['polar_bear'], structures: ['igloo'], hazards: ['cold'] },
  { id: 'grove', name: 'Grove', emoji: '🌲', category: 'forest', temperature: 'cold', humidity: 'snow', description: 'Snowy grove with giant spruce.', exclusiveBlocks: ['spruce_log', 'powder_snow'], exclusiveMobs: ['rabbit'], structures: [], hazards: ['cold'] },
  { id: 'snowy_slopes', name: 'Snowy Slopes', emoji: '🏔', category: 'mountain', temperature: 'cold', humidity: 'snow', description: 'Slopes of packed snow.', exclusiveBlocks: ['snow', 'powder_snow'], exclusiveMobs: ['goat'], structures: [], hazards: ['cold'] },
  { id: 'jagged_peaks', name: 'Jagged Peaks', emoji: '⛰', category: 'mountain', temperature: 'cold', humidity: 'normal', description: 'Sharp mountain peaks.', exclusiveBlocks: ['stone', 'snow'], exclusiveMobs: ['goat'], structures: [], hazards: ['fall'] },
  { id: 'frozen_peaks', name: 'Frozen Peaks', emoji: '🧊', category: 'mountain', temperature: 'cold', humidity: 'snow', description: 'Ice-streaked mountain peaks.', exclusiveBlocks: ['packed_ice', 'snow'], exclusiveMobs: [], structures: [], hazards: ['cold', 'fall'] },
  { id: 'stony_peaks', name: 'Stony Peaks', emoji: '🪨', category: 'mountain', temperature: 'temperate', humidity: 'normal', description: 'Bare rock peaks.', exclusiveBlocks: ['stone', 'andesite'], exclusiveMobs: ['goat'], structures: [], hazards: ['fall'] },
  { id: 'meadow', name: 'Meadow', emoji: '🌼', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'Rolling hills covered in flowers.', exclusiveBlocks: ['dandelion', 'poppy'], exclusiveMobs: ['donkey', 'rabbit'], structures: ['meadow_village'], hazards: [] },
  { id: 'cherry_grove', name: 'Cherry Grove', emoji: '🌸', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'Pink-leaved cherry trees.', exclusiveBlocks: ['cherry_leaves', 'pink_petals'], exclusiveMobs: ['rabbit'], structures: ['cherry_village'], hazards: [] },
  { id: 'rainforest', name: 'Rainforest', emoji: '🌴', category: 'forest', temperature: 'hot', humidity: 'wet', description: 'Dense tropical jungle with 80% canopy cover.', exclusiveBlocks: ['jungle_log', 'vine', 'cocoa'], exclusiveMobs: ['parrot', 'ocelot', 'panther'], structures: ['jungle_temple'], hazards: ['wildlife'] },
  { id: 'redwood_forest', name: 'Redwood Forest', emoji: '🌲', category: 'forest', temperature: 'temperate', humidity: 'humid', description: 'Giant redwood trees 100 blocks tall.', exclusiveBlocks: ['redwood_log'], exclusiveMobs: ['bear'], structures: ['treehouse_village'], hazards: ['high_fall'] },
  { id: 'autumn_forest', name: 'Autumn Forest', emoji: '🍁', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'A forest of red and gold leaves.', exclusiveBlocks: ['maple_log', 'maple_leaves'], exclusiveMobs: ['fox'], structures: [], hazards: [] },
  { id: 'maple_forest', name: 'Maple Forest', emoji: '🍂', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'Pure maple grove.', exclusiveBlocks: ['maple_log'], exclusiveMobs: [], structures: [], hazards: [] },
  { id: 'crystal_forest', name: 'Crystal Forest', emoji: '💎', category: 'crystal', temperature: 'temperate', humidity: 'normal', description: 'Trees of living crystal.', exclusiveBlocks: ['crystal_log', 'crystal_leaves'], exclusiveMobs: ['crystal_dryad'], structures: ['crystal_shrine'], hazards: ['shards'] },
  { id: 'haunted_forest', name: 'Haunted Forest', emoji: '👻', category: 'spooky', temperature: 'cold', humidity: 'normal', description: 'Trees lean in. Eyes glow between them.', exclusiveBlocks: ['dead_log', 'cobweb'], exclusiveMobs: ['ghost', 'wraith'], structures: ['haunted_cabin'], hazards: ['soul_drain'] },
  { id: 'frozen_jungle', name: 'Frozen Jungle', emoji: '🥶', category: 'forest', temperature: 'cold', humidity: 'snow', description: 'A jungle buried in permafrost.', exclusiveBlocks: ['frozen_jungle_log', 'ice_leaves'], exclusiveMobs: ['yeti'], structures: ['ice_temple'], hazards: ['cold'] },
  { id: 'bamboo_jungle', name: 'Bamboo Jungle', emoji: '🎋', category: 'forest', temperature: 'warm', humidity: 'humid', description: 'Dense bamboo forest with pandas.', exclusiveBlocks: ['bamboo', 'jungle_log'], exclusiveMobs: ['panda'], structures: ['bamboo_village'], hazards: [] },
  { id: 'giant_mushroom_island', name: 'Mushroom Fields', emoji: '🍄', category: 'mushroom', temperature: 'temperate', humidity: 'humid', description: 'Giant mushrooms the size of houses.', exclusiveBlocks: ['red_mushroom_block', 'brown_mushroom_block', 'mycelium'], exclusiveMobs: ['mooshroom'], structures: ['mushroom_village'], hazards: [] },
  { id: 'mangrove_swamp', name: 'Mangrove Swamp', emoji: '🌳', category: 'mangrove', temperature: 'warm', humidity: 'wet', description: 'Watery forest of mangrove trees.', exclusiveBlocks: ['mangrove_log', 'mangrove_roots', 'mud'], exclusiveMobs: ['frog', 'muddy_pig'], structures: ['mangrove_village'], hazards: ['mud_slow'] },
  { id: 'lush_cave', name: 'Lush Cave', emoji: '🌿', category: 'cave', temperature: 'temperate', humidity: 'wet', description: 'Cave decorated with moss and glow berries.', exclusiveBlocks: ['moss_block', 'glow_berries', 'spore_blossom'], exclusiveMobs: ['axolotl'], structures: [], hazards: [] },
  { id: 'dripstone_caves', name: 'Dripstone Caves', emoji: '🪨', category: 'cave', temperature: 'temperate', humidity: 'normal', description: 'Cave with stalactites and stalagmites.', exclusiveBlocks: ['dripstone', 'pointed_dripstone'], exclusiveMobs: [], structures: [], hazards: ['fall_damage'] },
  { id: 'deep_dark', name: 'Deep Dark', emoji: '🌚', category: 'cave', temperature: 'cold', humidity: 'normal', description: 'A sculk-covered abyss.', exclusiveBlocks: ['sculk', 'sculk_sensor', 'sculk_veins'], exclusiveMobs: ['warden'], structures: ['ancient_city'], hazards: ['darkness', 'warden'] },
  { id: 'glow_caves', name: 'Glow Caves', emoji: '✨', category: 'cave', temperature: 'temperate', humidity: 'normal', description: 'Caverns lit by glow lichen.', exclusiveBlocks: ['glow_lichen', 'amethyst'], exclusiveMobs: ['bat'], structures: ['amethyst_geode'], hazards: [] },
  { id: 'crystal_caves', name: 'Crystal Caves', emoji: '💎', category: 'cave', temperature: 'cold', humidity: 'normal', description: 'Cave lined with giant amethyst.', exclusiveBlocks: ['amethyst_block', 'calcite'], exclusiveMobs: [], structures: ['amethyst_geode'], hazards: ['fall_damage'] },
  { id: 'ice_caves', name: 'Ice Caves', emoji: '🧊', category: 'cave', temperature: 'cold', humidity: 'snow', description: 'Cave of blue ice and snow.', exclusiveBlocks: ['blue_ice', 'packed_ice'], exclusiveMobs: ['stray'], structures: [], hazards: ['cold', 'slippery'] },
  { id: 'mushroom_valley', name: 'Mushroom Valley', emoji: '🍄', category: 'mushroom', temperature: 'temperate', humidity: 'humid', description: 'Surface mushroom valley.', exclusiveBlocks: ['mycelium', 'mushroom'], exclusiveMobs: ['mooshroom'], structures: [], hazards: [] },
  { id: 'alpine_peaks', name: 'Alpine Peaks', emoji: '🏔', category: 'mountain', temperature: 'cold', humidity: 'normal', description: 'Snowy mountains above the clouds.', exclusiveBlocks: ['snow', 'stone'], exclusiveMobs: ['llama'], structures: [], hazards: ['fall', 'cold'] },
  { id: 'savanna_hills', name: 'Savanna Hills', emoji: '🦁', category: 'forest', temperature: 'hot', humidity: 'arid', description: 'Rolling golden-grass hills.', exclusiveBlocks: ['acacia_log', 'tall_grass'], exclusiveMobs: ['lion', 'zebra'], structures: ['savanna_village'], hazards: [] },
  { id: 'canyon', name: 'Canyon', emoji: '🏜', category: 'desert', temperature: 'hot', humidity: 'arid', description: 'Deep red rock canyons.', exclusiveBlocks: ['red_sandstone', 'terracotta'], exclusiveMobs: ['canyon_lizard'], structures: ['abandoned_mine'], hazards: ['fall'] },
  { id: 'volcano', name: 'Volcano', emoji: '🌋', category: 'volcanic', temperature: 'hot', humidity: 'arid', description: 'An active volcano.', exclusiveBlocks: ['basalt', 'magma_block'], exclusiveMobs: ['lava_golem'], structures: ['volcano_shrine'], hazards: ['lava', 'fall'] },
  { id: 'cherry_valley', name: 'Cherry Valley', emoji: '🌸', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'A valley of cherry trees.', exclusiveBlocks: ['cherry_leaves'], exclusiveMobs: ['rabbit'], structures: ['cherry_temple'], hazards: [] },
  { id: 'oasis', name: 'Oasis', emoji: '🌴', category: 'desert', temperature: 'hot', humidity: 'normal', description: 'A pool in the desert.', exclusiveBlocks: ['palm_log', 'sand'], exclusiveMobs: ['camel'], structures: ['oasis_village'], hazards: [] },
  { id: 'bamboo_valley', name: 'Bamboo Valley', emoji: '🎋', category: 'forest', temperature: 'warm', humidity: 'humid', description: 'A valley of bamboo.', exclusiveBlocks: ['bamboo'], exclusiveMobs: ['panda'], structures: ['bamboo_pagoda'], hazards: [] },
  { id: 'coral_coast', name: 'Coral Coast', emoji: '🪸', category: 'coral', temperature: 'warm', humidity: 'wet', description: 'Coastline made of living coral.', exclusiveBlocks: ['coral_block', 'brain_coral'], exclusiveMobs: ['tropical_fish'], structures: ['sunken_treasure'], hazards: ['drowning'] },
  { id: 'mangrove_delta', name: 'Mangrove Delta', emoji: '🌳', category: 'mangrove', temperature: 'warm', humidity: 'wet', description: 'Where the river meets the sea.', exclusiveBlocks: ['mangrove_log', 'mud'], exclusiveMobs: ['dolphin'], structures: ['delta_village'], hazards: ['mud'] },
  { id: 'mystic_woods', name: 'Mystic Woods', emoji: '🔮', category: 'mystic', temperature: 'temperate', humidity: 'humid', description: 'A forest that hums with magic.', exclusiveBlocks: ['moss_block', 'glow_berries'], exclusiveMobs: ['druid', 'faerie'], structures: ['druid_circle'], hazards: ['magic_confusion'] },
  { id: 'highlands', name: 'Highlands', emoji: '⛰', category: 'mountain', temperature: 'cold', humidity: 'normal', description: 'Rocky highland moors.', exclusiveBlocks: ['andesite', 'coarse_dirt'], exclusiveMobs: ['highland_cow'], structures: ['highland_fortress'], hazards: ['cold'] },
  { id: 'deep_caverns', name: 'Deep Caverns', emoji: '⛏', category: 'cave', temperature: 'temperate', humidity: 'normal', description: 'A deep underground network.', exclusiveBlocks: ['deepslate'], exclusiveMobs: ['cave_spider'], structures: ['mineshaft'], hazards: ['darkness'] },
  { id: 'alien_biome', name: 'Alien Biome', emoji: '👽', category: 'alien', temperature: 'temperate', humidity: 'normal', description: 'Purple grass. Three suns.', exclusiveBlocks: ['alien_grass', 'alien_stone'], exclusiveMobs: ['alien_grunt'], structures: ['alien_egg_pod'], hazards: ['acid_rain'] },
  { id: 'space_biome', name: 'Space Biome', emoji: '🌌', category: 'space', temperature: 'cold', humidity: 'arid', description: 'No air. Pure void.', exclusiveBlocks: ['moon_rock'], exclusiveMobs: ['astro_skeleton'], structures: ['crashed_ship'], hazards: ['vacuum'] },
  { id: 'mystic_biome', name: 'Mystic Biome', emoji: '✨', category: 'mystic', temperature: 'temperate', humidity: 'humid', description: 'A world of pure magic.', exclusiveBlocks: ['magic_crystal', 'enchanted_grass'], exclusiveMobs: ['wizard'], structures: ['magic_tower'], hazards: ['mana_drain'] },
  { id: 'coral_reef', name: 'Coral Reef', emoji: '🐠', category: 'coral', temperature: 'warm', humidity: 'wet', description: 'Underwater coral garden.', exclusiveBlocks: ['coral_block', 'sea_pickle'], exclusiveMobs: ['pufferfish'], structures: ['underwater_ruins'], hazards: ['drowning'] },
  { id: 'kelp_forest', name: 'Kelp Forest', emoji: '🌿', category: 'ocean', temperature: 'cold', humidity: 'wet', description: 'Forest of giant kelp.', exclusiveBlocks: ['kelp'], exclusiveMobs: ['dolphin'], structures: [], hazards: ['drowning'] },
  { id: 'warm_ocean', name: 'Warm Ocean', emoji: '🏖', category: 'ocean', temperature: 'warm', humidity: 'wet', description: 'Warm water biomes with sand floor.', exclusiveBlocks: ['sand'], exclusiveMobs: ['tropical_fish'], structures: ['ocean_ruins'], hazards: ['drowning'] },
  { id: 'lukewarm_ocean', name: 'Lukewarm Ocean', emoji: '🌊', category: 'ocean', temperature: 'temperate', humidity: 'wet', description: 'Mixed kelp and sand.', exclusiveBlocks: ['sand', 'kelp'], exclusiveMobs: ['dolphin'], structures: [], hazards: ['drowning'] },
  { id: 'cold_ocean', name: 'Cold Ocean', emoji: '🥶', category: 'ocean', temperature: 'cold', humidity: 'wet', description: 'Icy water with kelp.', exclusiveBlocks: ['gravel', 'kelp'], exclusiveMobs: ['cod'], structures: ['iceberg'], hazards: ['cold', 'drowning'] },
  { id: 'frozen_ocean', name: 'Frozen Ocean', emoji: '🧊', category: 'ocean', temperature: 'cold', humidity: 'wet', description: 'Ice on top of the ocean.', exclusiveBlocks: ['ice', 'blue_ice'], exclusiveMobs: ['polar_bear'], structures: ['iceberg'], hazards: ['cold', 'drowning'] },
  { id: 'deep_ocean', name: 'Deep Ocean', emoji: '🌑', category: 'ocean', temperature: 'cold', humidity: 'wet', description: 'Very deep water.', exclusiveBlocks: ['gravel'], exclusiveMobs: ['squid'], structures: ['ocean_monument'], hazards: ['drowning', 'darkness'] },
  { id: 'swamp', name: 'Swamp', emoji: '🌫', category: 'mangrove', temperature: 'warm', humidity: 'wet', description: 'Murky wetland with witch huts.', exclusiveBlocks: ['lily_pad', 'mushroom'], exclusiveMobs: ['slime', 'witch'], structures: ['swamp_hut'], hazards: ['slime'] },
  { id: 'beach', name: 'Beach', emoji: '🏖', category: 'ocean', temperature: 'temperate', humidity: 'normal', description: 'Sandy coastline.', exclusiveBlocks: ['sand'], exclusiveMobs: ['turtle'], structures: [], hazards: [] },
  { id: 'stony_shore', name: 'Stony Shore', emoji: '🪨', category: 'ocean', temperature: 'temperate', humidity: 'normal', description: 'A coastline of gravel.', exclusiveBlocks: ['gravel'], exclusiveMobs: [], structures: [], hazards: [] },
  { id: 'mushroom_island', name: 'Mushroom Island', emoji: '🍄', category: 'mushroom', temperature: 'temperate', humidity: 'humid', description: 'A mycelium-covered island.', exclusiveBlocks: ['mycelium', 'mushroom'], exclusiveMobs: ['mooshroom'], structures: [], hazards: [] },
  { id: 'desert', name: 'Desert', emoji: '🏜', category: 'desert', temperature: 'hot', humidity: 'arid', description: 'Hot sand and cacti.', exclusiveBlocks: ['sand', 'cactus'], exclusiveMobs: ['husk', 'rabbit'], structures: ['desert_temple', 'desert_village'], hazards: ['heat'] },
  { id: 'badlands', name: 'Badlands', emoji: '🏞', category: 'desert', temperature: 'hot', humidity: 'arid', description: 'Red-rock mesa biome.', exclusiveBlocks: ['red_sand', 'terracotta'], exclusiveMobs: ['armadillo'], structures: ['mineshaft'], hazards: ['heat'] },
  { id: 'eroded_badlands', name: 'Eroded Badlands', emoji: '🟥', category: 'desert', temperature: 'hot', humidity: 'arid', description: 'Eroded clay formations.', exclusiveBlocks: ['terracotta', 'white_terracotta'], exclusiveMobs: [], structures: [], hazards: ['heat'] },
  { id: 'wooded_badlands', name: 'Wooded Badlands', emoji: '🌳', category: 'desert', temperature: 'hot', humidity: 'arid', description: 'Oaks on red clay.', exclusiveBlocks: ['oak_log', 'terracotta'], exclusiveMobs: [], structures: [], hazards: ['heat'] },
  { id: 'ice_spikes', name: 'Ice Spikes', emoji: '🗻', category: 'snow', temperature: 'cold', humidity: 'snow', description: 'Massive ice spikes.', exclusiveBlocks: ['packed_ice', 'snow'], exclusiveMobs: ['polar_bear'], structures: [], hazards: ['cold'] },
  { id: 'snowy_plains', name: 'Snowy Plains', emoji: '❄', category: 'snow', temperature: 'cold', humidity: 'snow', description: 'Flat snowy tundra.', exclusiveBlocks: ['snow'], exclusiveMobs: ['rabbit', 'polar_bear'], structures: ['igloo'], hazards: ['cold'] },
  { id: 'snowy_beach', name: 'Snowy Beach', emoji: '🌨', category: 'snow', temperature: 'cold', humidity: 'snow', description: 'Snow meets the sea.', exclusiveBlocks: ['snow', 'sand'], exclusiveMobs: [], structures: [], hazards: ['cold'] },
  { id: 'snowy_taiga_hills', name: 'Snowy Taiga Hills', emoji: '🌲', category: 'snow', temperature: 'cold', humidity: 'snow', description: 'Hilly snowy spruce.', exclusiveBlocks: ['spruce_log', 'snow'], exclusiveMobs: ['fox', 'wolf'], structures: [], hazards: ['cold'] },
  { id: 'old_growth_spruce_taiga', name: 'Old Growth Spruce Taiga', emoji: '🌲', category: 'forest', temperature: 'cold', humidity: 'normal', description: 'Massive ancient spruce.', exclusiveBlocks: ['old_spruce_log'], exclusiveMobs: ['wolf'], structures: [], hazards: [] },
  { id: 'old_growth_birch_forest', name: 'Old Growth Birch Forest', emoji: '🌳', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'Massive birch grove.', exclusiveBlocks: ['old_birch_log'], exclusiveMobs: [], structures: [], hazards: [] },
  { id: 'windswept_hills', name: 'Windswept Hills', emoji: '🏔', category: 'mountain', temperature: 'cold', humidity: 'normal', description: 'Cold, windswept hills.', exclusiveBlocks: ['gravel', 'stone'], exclusiveMobs: ['goat'], structures: [], hazards: ['cold'] },
  { id: 'windswept_gravelly_hills', name: 'Windswept Gravelly Hills', emoji: '⛰', category: 'mountain', temperature: 'cold', humidity: 'arid', description: 'Hills of gravel.', exclusiveBlocks: ['gravel'], exclusiveMobs: [], structures: [], hazards: ['cold'] },
  { id: 'windswept_forest', name: 'Windswept Forest', emoji: '🌲', category: 'mountain', temperature: 'cold', humidity: 'normal', description: 'Spruce on a stony hill.', exclusiveBlocks: ['spruce_log', 'stone'], exclusiveMobs: [], structures: [], hazards: ['cold'] },
  { id: 'jungle', name: 'Jungle', emoji: '🌴', category: 'forest', temperature: 'hot', humidity: 'wet', description: 'Dense tropical jungle.', exclusiveBlocks: ['jungle_log', 'vine', 'bamboo'], exclusiveMobs: ['parrot', 'ocelot', 'panther'], structures: ['jungle_temple'], hazards: ['wildlife'] },
  { id: 'sparse_jungle', name: 'Sparse Jungle', emoji: '🌳', category: 'forest', temperature: 'hot', humidity: 'humid', description: 'A lighter jungle.', exclusiveBlocks: ['jungle_log'], exclusiveMobs: ['ocelot'], structures: [], hazards: [] },
  { id: 'bamboo_jungle_hills', name: 'Bamboo Jungle Hills', emoji: '🎋', category: 'forest', temperature: 'hot', humidity: 'humid', description: 'Hilly bamboo forest.', exclusiveBlocks: ['bamboo'], exclusiveMobs: ['panda'], structures: [], hazards: [] },
  { id: 'savanna', name: 'Savanna', emoji: '🌾', category: 'forest', temperature: 'hot', humidity: 'arid', description: 'Golden grass with acacia.', exclusiveBlocks: ['acacia_log'], exclusiveMobs: ['horse', 'lion'], structures: ['savanna_village'], hazards: ['heat'] },
  { id: 'savanna_plateau', name: 'Savanna Plateau', emoji: '🏞', category: 'forest', temperature: 'hot', humidity: 'arid', description: 'A flat-topped savanna.', exclusiveBlocks: ['acacia_log', 'coarse_dirt'], exclusiveMobs: [], structures: [], hazards: ['heat'] },
  { id: 'windswept_savanna', name: 'Windswept Savanna', emoji: '🌾', category: 'forest', temperature: 'hot', humidity: 'arid', description: 'Weathered savanna.', exclusiveBlocks: ['acacia_log'], exclusiveMobs: [], structures: [], hazards: ['heat'] },
  { id: 'dark_forest_hills', name: 'Dark Forest Hills', emoji: '🌑', category: 'forest', temperature: 'temperate', humidity: 'humid', description: 'Hilly dark oak.', exclusiveBlocks: ['dark_oak_log'], exclusiveMobs: [], structures: ['woodland_mansion'], hazards: ['darkness'] },
  { id: 'taiga_hills', name: 'Taiga Hills', emoji: '🌲', category: 'forest', temperature: 'cold', humidity: 'normal', description: 'Hilly spruce forest.', exclusiveBlocks: ['spruce_log'], exclusiveMobs: ['wolf'], structures: [], hazards: ['cold'] },
  { id: 'snowy_taiga_hills', name: 'Snowy Taiga Hills', emoji: '🌲', category: 'snow', temperature: 'cold', humidity: 'snow', description: 'Hilly snowy spruce.', exclusiveBlocks: ['spruce_log', 'snow'], exclusiveMobs: ['fox'], structures: [], hazards: ['cold'] },
  { id: 'old_growth_pine_taiga', name: 'Old Growth Pine Taiga', emoji: '🌲', category: 'forest', temperature: 'cold', humidity: 'normal', description: 'Massive ancient pines.', exclusiveBlocks: ['old_spruce_log'], exclusiveMobs: ['wolf'], structures: [], hazards: [] },
  { id: 'flower_field', name: 'Flower Field', emoji: '🌺', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'A field of every flower.', exclusiveBlocks: ['poppy', 'dandelion', 'blue_orchid'], exclusiveMobs: ['rabbit'], structures: [], hazards: [] },
  { id: 'lava_field', name: 'Lava Field', emoji: '🌋', category: 'volcanic', temperature: 'hot', humidity: 'arid', description: 'Open lava pools and basalt.', exclusiveBlocks: ['basalt', 'magma_block'], exclusiveMobs: ['strider'], structures: [], hazards: ['lava'] },
  { id: 'crimson_forest', name: 'Crimson Forest', emoji: '🍄', category: 'nether', temperature: 'hot', humidity: 'humid', description: 'Red nether forest.', exclusiveBlocks: ['crimson_stem', 'crimson_nylium'], exclusiveMobs: ['hoglin', 'piglin'], structures: ['bastion_remnant'], hazards: ['lava'] },
  { id: 'warped_forest', name: 'Warped Forest', emoji: '🟦', category: 'nether', temperature: 'hot', humidity: 'humid', description: 'Cyan nether forest.', exclusiveBlocks: ['warped_stem', 'warped_nylium'], exclusiveMobs: ['enderman'], structures: [], hazards: ['lava'] },
  { id: 'soul_sand_valley', name: 'Soul Sand Valley', emoji: '💀', category: 'nether', temperature: 'hot', humidity: 'arid', description: 'A valley of soul sand and bone.', exclusiveBlocks: ['soul_sand', 'bone_block'], exclusiveMobs: ['skeleton', 'wither_skeleton'], structures: ['nether_fortress'], hazards: ['soul_speed'] },
  { id: 'basalt_deltas', name: 'Basalt Deltas', emoji: '🌋', category: 'nether', temperature: 'hot', humidity: 'arid', description: 'A delta of basalt columns.', exclusiveBlocks: ['basalt', 'blackstone'], exclusiveMobs: ['magma_cube'], structures: [], hazards: ['lava'] },
  { id: 'nether_wastes', name: 'Nether Wastes', emoji: '🔥', category: 'nether', temperature: 'hot', humidity: 'arid', description: 'A sea of netherrack.', exclusiveBlocks: ['netherrack', 'glowstone'], exclusiveMobs: ['zombified_piglin', 'ghast'], structures: ['nether_fortress'], hazards: ['lava'] },
  { id: 'the_end', name: 'The End', emoji: '🌌', category: 'end', temperature: 'cold', humidity: 'arid', description: 'Drifting end stone islands.', exclusiveBlocks: ['end_stone', 'purpur_block'], exclusiveMobs: ['enderman'], structures: ['end_city'], hazards: ['void'] },
  { id: 'small_end_islands', name: 'Small End Islands', emoji: '🪨', category: 'end', temperature: 'cold', humidity: 'arid', description: 'Tiny end stone atolls.', exclusiveBlocks: ['end_stone'], exclusiveMobs: ['enderman'], structures: [], hazards: ['void'] },
  { id: 'end_midlands', name: 'End Midlands', emoji: '🌌', category: 'end', temperature: 'cold', humidity: 'arid', description: 'Mid-range End biome.', exclusiveBlocks: ['end_stone'], exclusiveMobs: ['enderman'], structures: ['end_city'], hazards: ['void'] },
  { id: 'end_highlands', name: 'End Highlands', emoji: '⛰', category: 'end', temperature: 'cold', humidity: 'arid', description: 'Mountainous End biome.', exclusiveBlocks: ['end_stone'], exclusiveMobs: ['enderman', 'shulker'], structures: ['end_city'], hazards: ['void'] },
  { id: 'end_barrens', name: 'End Barrens', emoji: '🌑', category: 'end', temperature: 'cold', humidity: 'arid', description: 'A barren wasteland of End.', exclusiveBlocks: ['end_stone'], exclusiveMobs: ['enderman'], structures: [], hazards: ['void'] },
  { id: 'crystal_dimension_biome', name: 'Crystal Dimension', emoji: '💎', category: 'crystal', temperature: 'temperate', humidity: 'normal', description: 'Floating crystal islands.', exclusiveBlocks: ['crystal_log'], exclusiveMobs: ['crystal_dryad'], structures: ['crystal_shrine'], hazards: ['shards'] },
  { id: 'shadow_realm_biome', name: 'Shadow Realm', emoji: '🌑', category: 'shadow', temperature: 'cold', humidity: 'normal', description: 'Eternal night.', exclusiveBlocks: ['shadow_stone'], exclusiveMobs: ['shadow_creeper'], structures: ['shadow_fortress'], hazards: ['darkness'] },
  { id: 'volcanic_realm_biome', name: 'Volcanic Plains', emoji: '🌋', category: 'volcanic', temperature: 'hot', humidity: 'arid', description: 'Sea of magma.', exclusiveBlocks: ['volcanic_rock'], exclusiveMobs: ['lava_golem'], structures: ['volcano_shrine'], hazards: ['lava', 'heat'] },
  { id: 'sky_island', name: 'Sky Island', emoji: '☁', category: 'sky', temperature: 'temperate', humidity: 'normal', description: 'A floating island.', exclusiveBlocks: ['cloud_block'], exclusiveMobs: ['sky_guard'], structures: ['sky_castle'], hazards: ['fall'] },
  { id: 'frozen_wasteland_biome', name: 'Frozen Wasteland', emoji: '❄', category: 'snow', temperature: 'cold', humidity: 'snow', description: 'Endless tundra.', exclusiveBlocks: ['frozen_wasteland_stone'], exclusiveMobs: ['yeti'], structures: ['ice_spire'], hazards: ['cold'] },
  { id: 'ocean_world_biome', name: 'Open Ocean', emoji: '🌊', category: 'ocean', temperature: 'temperate', humidity: 'wet', description: 'Open water.', exclusiveBlocks: ['water'], exclusiveMobs: ['dolphin'], structures: ['island'], hazards: ['drowning'] },
  { id: 'storm_biome', name: 'Storm Fields', emoji: '⚡', category: 'volcanic', temperature: 'temperate', humidity: 'wet', description: 'A field of lightning.', exclusiveBlocks: ['storm_block'], exclusiveMobs: ['storm_elemental'], structures: ['tesla_spire'], hazards: ['lightning'] },
  { id: 'mushroom_biome', name: 'Mushroom Fields', emoji: '🍄', category: 'mushroom', temperature: 'temperate', humidity: 'humid', description: 'A field of mushrooms.', exclusiveBlocks: ['mycelium'], exclusiveMobs: ['mooshroom'], structures: [], hazards: [] },
  { id: 'giant_forest_biome', name: 'Giant Forest', emoji: '🌳', category: 'forest', temperature: 'temperate', humidity: 'humid', description: 'Trees 200 blocks tall.', exclusiveBlocks: ['giant_oak_log'], exclusiveMobs: ['giant_ape'], structures: ['canopy_village'], hazards: ['fall'] },
  { id: 'cosmic_void_biome', name: 'Cosmic Void', emoji: '🌠', category: 'space', temperature: 'cold', humidity: 'arid', description: 'The deepest space.', exclusiveBlocks: ['void_stone'], exclusiveMobs: ['void_wraith'], structures: ['singularity'], hazards: ['void', 'vacuum'] },
  { id: 'machine_biome', name: 'Machine Wastes', emoji: '🤖', category: 'volcanic', temperature: 'temperate', humidity: 'normal', description: 'A world of gears.', exclusiveBlocks: ['machine_block'], exclusiveMobs: ['drone'], structures: ['factory'], hazards: ['electric'] },
  { id: 'spirit_biome', name: 'Spirit Fields', emoji: '👻', category: 'spooky', temperature: 'cold', humidity: 'normal', description: 'Echoes everywhere.', exclusiveBlocks: ['spirit_stone'], exclusiveMobs: ['ghost'], structures: ['haunted_mansion'], hazards: ['soul_drain'] },
  { id: 'toxic_biome', name: 'Toxic Wastes', emoji: '🧪', category: 'volcanic', temperature: 'hot', humidity: 'wet', description: 'Acid rain.', exclusiveBlocks: ['corroded_metal'], exclusiveMobs: ['mutant'], structures: ['abandoned_lab'], hazards: ['acid'] },
  { id: 'chaos_biome', name: 'Chaos Fields', emoji: '🌀', category: 'volcanic', temperature: 'hot', humidity: 'normal', description: 'Random gravity.', exclusiveBlocks: ['chaos_block'], exclusiveMobs: ['glitch'], structures: ['glitched_castle'], hazards: ['random_gravity'] },
  { id: 'dream_biome', name: 'Dream Clouds', emoji: '🌈', category: 'sky', temperature: 'temperate', humidity: 'normal', description: 'Soft, surreal.', exclusiveBlocks: ['cotton_block'], exclusiveMobs: ['dream_sheep'], structures: ['cloud_palace'], hazards: ['sleep'] },
  { id: 'ancient_civ_biome', name: 'Ancient Ruins', emoji: '🏛', category: 'desert', temperature: 'hot', humidity: 'arid', description: 'Lost empire.', exclusiveBlocks: ['ancient_stone'], exclusiveMobs: ['mummy'], structures: ['pyramid'], hazards: ['curse'] },
  { id: 'prehistoric_biome', name: 'Prehistoric Jungle', emoji: '🦖', category: 'forest', temperature: 'warm', humidity: 'humid', description: 'Dinosaurs.', exclusiveBlocks: ['ancient_moss'], exclusiveMobs: ['trex'], structures: ['tar_pit'], hazards: ['predator'] },
  { id: 'undead_biome', name: 'Undead Fields', emoji: '💀', category: 'spooky', temperature: 'cold', humidity: 'normal', description: 'Graveyards everywhere.', exclusiveBlocks: ['grave_dirt'], exclusiveMobs: ['zombie'], structures: ['cemetery'], hazards: ['undead_horde'] },
  { id: 'nature_biome', name: 'Pure Wilderness', emoji: '🌿', category: 'forest', temperature: 'temperate', humidity: 'humid', description: 'Perfect nature.', exclusiveBlocks: ['flower_block'], exclusiveMobs: ['faerie'], structures: ['world_tree'], hazards: [] },
  { id: 'coral_reef_biome', name: 'Deep Reef', emoji: '🐠', category: 'coral', temperature: 'warm', humidity: 'wet', description: 'Underwater garden.', exclusiveBlocks: ['coral_block'], exclusiveMobs: ['tropical_fish'], structures: ['underwater_ruins'], hazards: ['drowning'] },
  { id: 'cave_biome', name: 'Cave System', emoji: '🕳', category: 'cave', temperature: 'temperate', humidity: 'normal', description: 'A deep cave network.', exclusiveBlocks: ['deepslate'], exclusiveMobs: ['cave_spider'], structures: ['mineshaft'], hazards: ['darkness'] },
  { id: 'icy_cave', name: 'Ice Cave', emoji: '🧊', category: 'cave', temperature: 'cold', humidity: 'snow', description: 'Cave of ice.', exclusiveBlocks: ['blue_ice'], exclusiveMobs: ['stray'], structures: [], hazards: ['cold'] },
  { id: 'lush_cave_biome', name: 'Lush Cave', emoji: '🌿', category: 'cave', temperature: 'temperate', humidity: 'wet', description: 'Glowing moss.', exclusiveBlocks: ['moss_block'], exclusiveMobs: ['axolotl'], structures: [], hazards: [] },
  { id: 'amethyst_geode', name: 'Amethyst Geode', emoji: '🔮', category: 'cave', temperature: 'temperate', humidity: 'normal', description: 'A geode of amethyst.', exclusiveBlocks: ['amethyst_block'], exclusiveMobs: [], structures: ['geode'], hazards: [] },
  { id: 'sun_biome', name: 'Solar Surface', emoji: '☀', category: 'volcanic', temperature: 'hot', humidity: 'arid', description: 'A world of plasma.', exclusiveBlocks: ['plasma_block'], exclusiveMobs: ['solar_elemental'], structures: ['sun_forge'], hazards: ['plasma', 'heat'] },
  { id: 'moon_biome', name: 'Lunar Surface', emoji: '🌙', category: 'space', temperature: 'cold', humidity: 'arid', description: 'The Moon.', exclusiveBlocks: ['moon_rock'], exclusiveMobs: ['moon_slime'], structures: ['abandoned_moonbase'], hazards: ['vacuum'] },
  { id: 'gas_giant_biome', name: 'Gas Giant', emoji: '🪐', category: 'space', temperature: 'cold', humidity: 'normal', description: 'Above a gas giant.', exclusiveBlocks: ['platform_steel'], exclusiveMobs: ['sky_squid'], structures: ['refinery_platform'], hazards: ['fall', 'lightning'] },
  { id: 'alien_world_biome', name: 'Alien World', emoji: '👽', category: 'alien', temperature: 'temperate', humidity: 'normal', description: 'Procedurally generated alien.', exclusiveBlocks: ['alien_grass'], exclusiveMobs: ['alien_grunt'], structures: ['alien_village'], hazards: ['acid_rain'] },
  { id: 'mystic_woods_biome', name: 'Mystic Woods', emoji: '🔮', category: 'mystic', temperature: 'temperate', humidity: 'humid', description: 'A magical forest.', exclusiveBlocks: ['moss_block'], exclusiveMobs: ['druid'], structures: ['druid_circle'], hazards: ['magic_confusion'] },
  { id: 'haunted_biome', name: 'Haunted Forest', emoji: '👻', category: 'spooky', temperature: 'cold', humidity: 'normal', description: 'A scary forest.', exclusiveBlocks: ['dead_log'], exclusiveMobs: ['ghost'], structures: ['haunted_cabin'], hazards: ['soul_drain'] },
  { id: 'crystal_forest_biome', name: 'Crystal Forest', emoji: '💎', category: 'crystal', temperature: 'temperate', humidity: 'normal', description: 'Trees of crystal.', exclusiveBlocks: ['crystal_log'], exclusiveMobs: ['crystal_dryad'], structures: ['crystal_shrine'], hazards: ['shards'] },
  { id: 'frozen_jungle_biome', name: 'Frozen Jungle', emoji: '🥶', category: 'forest', temperature: 'cold', humidity: 'snow', description: 'Jungle in ice.', exclusiveBlocks: ['frozen_jungle_log'], exclusiveMobs: ['yeti'], structures: ['ice_temple'], hazards: ['cold'] },
  { id: 'redwood_biome', name: 'Redwood Forest', emoji: '🌲', category: 'forest', temperature: 'temperate', humidity: 'humid', description: 'Giant redwoods.', exclusiveBlocks: ['redwood_log'], exclusiveMobs: ['bear'], structures: ['treehouse_village'], hazards: ['fall'] },
  { id: 'autumn_biome', name: 'Autumn Forest', emoji: '🍁', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'A forest in fall.', exclusiveBlocks: ['maple_log'], exclusiveMobs: ['fox'], structures: [], hazards: [] },
  { id: 'maple_biome', name: 'Maple Forest', emoji: '🍂', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'Pure maple.', exclusiveBlocks: ['maple_log'], exclusiveMobs: [], structures: [], hazards: [] },
  { id: 'mangrove_biome', name: 'Mangrove Swamp', emoji: '🌳', category: 'mangrove', temperature: 'warm', humidity: 'wet', description: 'Mangrove trees.', exclusiveBlocks: ['mangrove_log'], exclusiveMobs: ['frog'], structures: ['mangrove_village'], hazards: ['mud'] },
  { id: 'cherry_biome', name: 'Cherry Grove', emoji: '🌸', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'Cherry trees everywhere.', exclusiveBlocks: ['cherry_leaves'], exclusiveMobs: ['rabbit'], structures: ['cherry_village'], hazards: [] },
  { id: 'bamboo_biome', name: 'Bamboo Valley', emoji: '🎋', category: 'forest', temperature: 'warm', humidity: 'humid', description: 'Bamboo everywhere.', exclusiveBlocks: ['bamboo'], exclusiveMobs: ['panda'], structures: ['bamboo_pagoda'], hazards: [] },
  { id: 'oasis_biome', name: 'Oasis', emoji: '🌴', category: 'desert', temperature: 'hot', humidity: 'normal', description: 'Water in the desert.', exclusiveBlocks: ['palm_log'], exclusiveMobs: ['camel'], structures: ['oasis_village'], hazards: [] },
  { id: 'canyon_biome', name: 'Canyon', emoji: '🏜', category: 'desert', temperature: 'hot', humidity: 'arid', description: 'Red rock canyon.', exclusiveBlocks: ['red_sandstone'], exclusiveMobs: ['canyon_lizard'], structures: ['abandoned_mine'], hazards: ['fall'] },
  { id: 'volcano_biome', name: 'Volcano', emoji: '🌋', category: 'volcanic', temperature: 'hot', humidity: 'arid', description: 'Active volcano.', exclusiveBlocks: ['basalt'], exclusiveMobs: ['lava_golem'], structures: ['volcano_shrine'], hazards: ['lava'] },
  { id: 'alpine_biome', name: 'Alpine Peaks', emoji: '🏔', category: 'mountain', temperature: 'cold', humidity: 'normal', description: 'Snowy mountain peaks.', exclusiveBlocks: ['stone'], exclusiveMobs: ['llama'], structures: [], hazards: ['fall', 'cold'] },
  { id: 'meadow_biome', name: 'Meadow', emoji: '🌼', category: 'forest', temperature: 'temperate', humidity: 'normal', description: 'Rolling flowery hills.', exclusiveBlocks: ['dandelion'], exclusiveMobs: ['donkey'], structures: ['meadow_village'], hazards: [] },
  { id: 'highlands_biome', name: 'Highlands', emoji: '⛰', category: 'mountain', temperature: 'cold', humidity: 'normal', description: 'Rocky highland.', exclusiveBlocks: ['andesite'], exclusiveMobs: ['highland_cow'], structures: ['highland_fortress'], hazards: ['cold'] },
  { id: 'windswept_biome', name: 'Windswept Hills', emoji: '🌬', category: 'mountain', temperature: 'cold', humidity: 'normal', description: 'Cold windy hills.', exclusiveBlocks: ['gravel'], exclusiveMobs: ['goat'], structures: [], hazards: ['cold'] },
  { id: 'icy_biome', name: 'Frozen Tundra', emoji: '🧊', category: 'snow', temperature: 'cold', humidity: 'snow', description: 'Icy tundra.', exclusiveBlocks: ['blue_ice'], exclusiveMobs: ['polar_bear'], structures: ['iceberg'], hazards: ['cold'] },
  { id: 'arctic_biome', name: 'Arctic', emoji: '🐻‍❄', category: 'snow', temperature: 'cold', humidity: 'snow', description: 'A frozen plain.', exclusiveBlocks: ['packed_ice'], exclusiveMobs: ['polar_bear'], structures: [], hazards: ['cold'] },
  { id: 'warm_beach', name: 'Warm Beach', emoji: '🏖', category: 'ocean', temperature: 'hot', humidity: 'normal', description: 'Tropical beach.', exclusiveBlocks: ['sand'], exclusiveMobs: ['turtle'], structures: [], hazards: [] },
  { id: 'rocky_beach', name: 'Rocky Beach', emoji: '🪨', category: 'ocean', temperature: 'temperate', humidity: 'normal', description: 'Beach of stones.', exclusiveBlocks: ['gravel'], exclusiveMobs: [], structures: [], hazards: [] },
  { id: 'iceberg_biome', name: 'Iceberg', emoji: '🧊', category: 'snow', temperature: 'cold', humidity: 'wet', description: 'A giant iceberg.', exclusiveBlocks: ['blue_ice'], exclusiveMobs: ['polar_bear'], structures: [], hazards: ['cold'] },
  { id: 'shipwreck_biome', name: 'Shipwreck', emoji: '🚢', category: 'ocean', temperature: 'temperate', humidity: 'wet', description: 'Where ships come to rest.', exclusiveBlocks: ['sand'], exclusiveMobs: ['drowned'], structures: ['shipwreck'], hazards: ['drowned'] },
  { id: 'monument_biome', name: 'Ocean Monument', emoji: '🏛', category: 'ocean', temperature: 'temperate', humidity: 'wet', description: 'Around an ocean monument.', exclusiveBlocks: ['prismarine'], exclusiveMobs: ['guardian'], structures: ['monument'], hazards: ['guardian', 'drowning'] },
  { id: 'underground_cave', name: 'Underground Cave', emoji: '🕳', category: 'cave', temperature: 'temperate', humidity: 'normal', description: 'A regular cave.', exclusiveBlocks: ['stone'], exclusiveMobs: ['zombie', 'spider'], structures: ['mineshaft', 'dungeon'], hazards: ['darkness'] },
  { id: 'ravine', name: 'Ravine', emoji: '🕳', category: 'mountain', temperature: 'temperate', humidity: 'normal', description: 'A deep ravine.', exclusiveBlocks: ['stone', 'diorite'], exclusiveMobs: [], structures: [], hazards: ['fall'] },
  { id: 'sinkhole', name: 'Sinkhole', emoji: '🕳', category: 'cave', temperature: 'temperate', humidity: 'normal', description: 'A surface sinkhole.', exclusiveBlocks: ['gravel', 'dirt'], exclusiveMobs: [], structures: [], hazards: ['fall'] },
  { id: 'floating_island', name: 'Floating Island', emoji: '☁', category: 'sky', temperature: 'temperate', humidity: 'normal', description: 'An island in the sky.', exclusiveBlocks: ['grass', 'dirt'], exclusiveMobs: ['bird'], structures: ['island_hut'], hazards: ['fall'] },
  { id: 'canyon_underground', name: 'Underground Canyon', emoji: '🪨', category: 'cave', temperature: 'temperate', humidity: 'normal', description: 'A canyon underground.', exclusiveBlocks: ['red_sand'], exclusiveMobs: [], structures: [], hazards: ['fall'] },
];

export const ALL_BIOMES: BiomeDefinition[] = biomes;

/**
 * Index for `getBiome`.
 *
 * `getBiome` is called for *every block column* during terrain generation, and
 * it used to run `biomes.find(...)` — a linear scan across 150+ entries with a
 * string comparison each. That is on the order of a hundred million string
 * compares while streaming a render radius, and it was a measurable part of
 * the world-loading stall. A Map turns it into one hash lookup.
 */
const BIOME_INDEX = new Map<BiomeID, BiomeDefinition>(biomes.map((b) => [b.id, b]));

export function getBiome(id: BiomeID): BiomeDefinition {
  return BIOME_INDEX.get(id) ?? biomes[0];
}

/* ------------------------------------------------------------------ *
 * biome size classes
 * ------------------------------------------------------------------ */

/**
 * How much of the map a biome should occupy.
 *
 * Previously every biome was selected from the same climate grid at one
 * frequency, so they all came out roughly the same middling size and packed
 * tightly together — the "biomes look so cramped, everything in one area"
 * problem. Assigning each biome a size class lets rare/special biomes appear
 * as small pockets while staples such as plains and ocean form the large
 * backdrops a Minecraft world needs.
 */
export type BiomeSizeClass = 'rare' | 'small' | 'medium' | 'large' | 'huge';

/**
 * Radius multiplier per class, applied to the base biome cell size. A `huge`
 * biome covers roughly 9x the area of a `small` one.
 */
export const BIOME_SIZE_SCALE: Record<BiomeSizeClass, number> = {
  rare: 0.42,
  small: 0.68,
  medium: 1.0,
  large: 1.55,
  huge: 2.3,
};

/** Relative chance of a region being assigned to each class. */
export const BIOME_SIZE_WEIGHT: Record<BiomeSizeClass, number> = {
  rare: 0.06,
  small: 0.16,
  medium: 0.30,
  large: 0.30,
  huge: 0.18,
};

/**
 * Explicit size class per biome. Anything not listed falls back to the
 * category default below, so the 150-biome roster stays maintainable.
 */
const BIOME_SIZE_OVERRIDES: Record<string, BiomeSizeClass> = {
  // Big, ordinary backdrops — these should dominate the map.
  plain: 'huge',
  ocean_world_biome: 'huge',
  deep_ocean: 'huge',
  forest: 'large',
  meadow: 'large',
  desert: 'large',
  savanna: 'large',
  taiga: 'large',
  snowy_plains: 'large',
  rainforest: 'large',
  // Mid-sized character biomes.
  birch_forest: 'medium',
  dark_forest: 'medium',
  swamp: 'medium',
  badlands: 'medium',
  beach: 'small',
  snowy_beach: 'small',
  // Small, memorable pockets.
  sunflower_plains: 'small',
  flower_forest: 'small',
  cherry_grove: 'small',
  bamboo_jungle: 'small',
  oasis: 'rare',
  ice_spikes: 'rare',
  mushroom_biome: 'rare',
  mushroom_island: 'rare',
  mushroom_valley: 'rare',
  giant_mushroom_island: 'rare',
  crystal_forest: 'rare',
  haunted_forest: 'rare',
  volcano: 'rare',
  mystic_woods: 'rare',
};

const CATEGORY_SIZE_DEFAULT: Record<string, BiomeSizeClass> = {
  ocean: 'huge',
  forest: 'large',
  desert: 'large',
  snow: 'large',
  mountain: 'medium',
  mangrove: 'medium',
  coral: 'small',
  cave: 'medium',
  mushroom: 'rare',
  magic: 'rare',
  crystal: 'rare',
  shadow: 'rare',
  spooky: 'rare',
  alien: 'rare',
  volcanic: 'small',
  mystic: 'rare',
  sky: 'small',
  space: 'medium',
  nether: 'large',
  end: 'large',
};

/** Size class for a biome, from the override table or its category. */
export function biomeSizeClass(biome: BiomeDefinition): BiomeSizeClass {
  return BIOME_SIZE_OVERRIDES[biome.id] ?? CATEGORY_SIZE_DEFAULT[biome.category] ?? 'medium';
}

/** Every biome that belongs to a given size class. */
export function biomesOfSize(size: BiomeSizeClass): BiomeDefinition[] {
  return biomes.filter((b) => biomeSizeClass(b) === size);
}

export const BIOMES_BY_CATEGORY: Record<string, BiomeDefinition[]> = biomes.reduce((acc, b) => {
  (acc[b.category] ||= []).push(b);
  return acc;
}, {} as Record<string, BiomeDefinition[]>);

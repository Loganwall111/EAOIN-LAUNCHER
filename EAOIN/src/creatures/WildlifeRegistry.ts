/**
 * WildlifeRegistry — "Life Comes Apart 2.0" real-world animal roster.
 *
 * Data-driven so `CreatureManager` stays a thin spawner: each species declares
 * its body plan, palette, movement style, habitat and loot, and the manager
 * builds it generically. Adding an animal is a single entry here.
 *
 * Body plans map onto the procedural mesh builder:
 *   quadruped — cow, deer, wolf, camel, bear…  (body + head + 4 legs)
 *   serpent   — snakes: a chain of segments that slithers, no legs
 *   bird      — body + head + two wing planes that flap
 *   fish      — body + tail fin, swims in water volumes
 *   marine    — large ocean animals: whale, shark, dolphin
 *   biped     — penguin, ostrich
 *   insect    — butterfly-scale critters with fast wings
 */

export type BodyPlan = 'quadruped' | 'serpent' | 'bird' | 'fish' | 'marine' | 'biped' | 'insect';

/** Where a species is allowed to exist. */
export type Habitat = 'land' | 'water' | 'air' | 'amphibious';

/** Behaviour toward the player. */
export type Temperament = 'passive' | 'skittish' | 'neutral' | 'hostile';

export interface SpeciesDefinition {
  id: string;
  name: string;
  emoji: string;
  bodyPlan: BodyPlan;
  habitat: Habitat;
  temperament: Temperament;
  /** Hex colours for body / head / limbs. */
  palette: { body: string; head: string; limb: string; accent?: string };
  /** Overall size multiplier applied to the body plan's base dimensions. */
  scale: number;
  health: number;
  /** Movement speed in blocks/second. */
  speed: number;
  /** Damage dealt on contact, for hostile species. */
  damage: number;
  /** Biome id substrings this species spawns in. Empty = anywhere on land. */
  biomes: string[];
  /** Relative spawn weight within a matching biome. */
  weight: number;
  /** Blocks dropped when killed. */
  loot: Array<{ blockId: number; amount: number }>;
  /** Only spawns at night when true. */
  nocturnal?: boolean;
  /** Only spawns during a full-moon event (moon-event system). */
  fullMoonOnly?: boolean;
  /** Depth band for marine life, in blocks below sea level. */
  depthRange?: [number, number];
  description: string;
}

/* ------------------------------------------------------------------ */
/* Land animals                                                        */
/* ------------------------------------------------------------------ */

const LAND: SpeciesDefinition[] = [
  {
    id: 'cow', name: 'Cow', emoji: '🐄', bodyPlan: 'quadruped', habitat: 'land', temperament: 'passive',
    palette: { body: '#4a3527', head: '#e8e2d8', limb: '#33251b' },
    scale: 1.05, health: 24, speed: 0.9, damage: 0,
    biomes: ['plain', 'meadow', 'forest', 'savanna'], weight: 10,
    loot: [{ blockId: 112, amount: 2 }],
    description: 'Placid grazer of open grassland.',
  },
  {
    id: 'pig', name: 'Pig', emoji: '🐖', bodyPlan: 'quadruped', habitat: 'land', temperament: 'passive',
    palette: { body: '#e8a0a8', head: '#f0b4bc', limb: '#c07880' },
    scale: 0.82, health: 18, speed: 1.0, damage: 0,
    biomes: ['plain', 'forest', 'meadow', 'swamp'], weight: 9,
    loot: [{ blockId: 113, amount: 2 }],
    description: 'Roots through undergrowth for food.',
  },
  {
    id: 'sheep', name: 'Sheep', emoji: '🐑', bodyPlan: 'quadruped', habitat: 'land', temperament: 'passive',
    palette: { body: '#e0ddd2', head: '#2e2e2a', limb: '#1c1c1a' },
    scale: 0.9, health: 20, speed: 1.05, damage: 0,
    biomes: ['plain', 'meadow', 'mountain', 'highland'], weight: 10,
    loot: [{ blockId: 7, amount: 1 }],
    description: 'Woolly and utterly unbothered.',
  },
  {
    id: 'chicken', name: 'Chicken', emoji: '🐔', bodyPlan: 'bird', habitat: 'land', temperament: 'passive',
    palette: { body: '#f2f2ee', head: '#f2f2ee', limb: '#e8a02a', accent: '#c8322a' },
    scale: 0.5, health: 8, speed: 1.1, damage: 0,
    biomes: ['plain', 'meadow', 'forest'], weight: 8,
    loot: [{ blockId: 114, amount: 1 }],
    description: 'Flaps furiously, never quite flies.',
  },
  {
    id: 'deer', name: 'Deer', emoji: '🦌', bodyPlan: 'quadruped', habitat: 'land', temperament: 'skittish',
    palette: { body: '#8a5a32', head: '#7a4c28', limb: '#4a2c16', accent: '#e8dcc8' },
    scale: 1.0, health: 26, speed: 1.6, damage: 0,
    biomes: ['forest', 'taiga', 'meadow', 'redwood'], weight: 8,
    loot: [{ blockId: 112, amount: 1 }],
    description: 'Bolts at the first sign of movement.',
  },
  {
    id: 'wolf', name: 'Wolf', emoji: '🐺', bodyPlan: 'quadruped', habitat: 'land', temperament: 'hostile',
    palette: { body: '#8a8a90', head: '#9a9aa0', limb: '#5a5a60', accent: '#e8e8f0' },
    scale: 0.88, health: 30, speed: 2.0, damage: 4,
    biomes: ['forest', 'taiga', 'snow', 'tundra'], weight: 5,
    loot: [{ blockId: 7, amount: 1 }],
    description: 'Hunts in packs at the treeline.',
  },
  {
    id: 'bear', name: 'Brown Bear', emoji: '🐻', bodyPlan: 'quadruped', habitat: 'land', temperament: 'neutral',
    palette: { body: '#5a3a1e', head: '#4a2e18', limb: '#3a2412' },
    scale: 1.5, health: 60, speed: 1.3, damage: 8,
    biomes: ['forest', 'taiga', 'redwood', 'mountain'], weight: 3,
    loot: [{ blockId: 112, amount: 3 }],
    description: 'Leave it alone and it will leave you alone.',
  },
  {
    id: 'fox', name: 'Red Fox', emoji: '🦊', bodyPlan: 'quadruped', habitat: 'land', temperament: 'skittish',
    palette: { body: '#d2662a', head: '#e07a34', limb: '#2a2018', accent: '#f2ece0' },
    scale: 0.62, health: 14, speed: 1.9, damage: 2,
    biomes: ['forest', 'taiga', 'snow', 'autumn'], weight: 6,
    loot: [{ blockId: 7, amount: 1 }],
    description: 'Quick, clever and hard to corner.',
  },
  {
    id: 'rabbit', name: 'Rabbit', emoji: '🐇', bodyPlan: 'quadruped', habitat: 'land', temperament: 'skittish',
    palette: { body: '#c8a882', head: '#d8b892', limb: '#8a6a4a' },
    scale: 0.4, health: 8, speed: 2.2, damage: 0,
    biomes: ['plain', 'meadow', 'forest', 'desert', 'snow'], weight: 8,
    loot: [{ blockId: 112, amount: 1 }],
    description: 'Small, fast, everywhere.',
  },
  {
    id: 'horse', name: 'Horse', emoji: '🐎', bodyPlan: 'quadruped', habitat: 'land', temperament: 'passive',
    palette: { body: '#6a4a2a', head: '#5a3e22', limb: '#3a2814', accent: '#2a1c10' },
    scale: 1.35, health: 34, speed: 2.4, damage: 0,
    biomes: ['plain', 'meadow', 'savanna'], weight: 5,
    loot: [{ blockId: 112, amount: 1 }],
    description: 'The fastest thing on four legs out here.',
  },
  // Deserts — the biome that now actually threatens you.
  {
    id: 'camel', name: 'Camel', emoji: '🐪', bodyPlan: 'quadruped', habitat: 'land', temperament: 'passive',
    palette: { body: '#d8b47a', head: '#e0c088', limb: '#a8865a' },
    scale: 1.45, health: 40, speed: 1.2, damage: 0,
    biomes: ['desert', 'oasis', 'badlands', 'savanna'], weight: 7,
    loot: [{ blockId: 112, amount: 2 }],
    description: 'Built for the heat you are not built for.',
  },
  {
    id: 'rattlesnake', name: 'Rattlesnake', emoji: '🐍', bodyPlan: 'serpent', habitat: 'land', temperament: 'hostile',
    palette: { body: '#a88a4a', head: '#8a6a32', limb: '#6a4a22', accent: '#3a2a12' },
    scale: 0.9, health: 12, speed: 1.1, damage: 6,
    biomes: ['desert', 'badlands', 'canyon', 'savanna'], weight: 7,
    loot: [{ blockId: 112, amount: 1 }],
    description: 'You hear it before you see it.',
  },
  {
    id: 'python', name: 'Python', emoji: '🐍', bodyPlan: 'serpent', habitat: 'amphibious', temperament: 'hostile',
    palette: { body: '#5a7a3a', head: '#4a6a2a', limb: '#3a5220', accent: '#c8b878' },
    scale: 1.4, health: 26, speed: 0.85, damage: 7,
    biomes: ['jungle', 'rainforest', 'swamp', 'mangrove'], weight: 5,
    loot: [{ blockId: 112, amount: 2 }],
    description: 'Coils in the mangrove roots.',
  },
  {
    id: 'cobra', name: 'King Cobra', emoji: '🐍', bodyPlan: 'serpent', habitat: 'land', temperament: 'hostile',
    palette: { body: '#3a3a2a', head: '#5a5a3a', limb: '#2a2a1a', accent: '#d8c86a' },
    scale: 1.1, health: 18, speed: 1.2, damage: 9,
    biomes: ['jungle', 'rainforest', 'bamboo', 'savanna'], weight: 4,
    loot: [{ blockId: 112, amount: 1 }],
    description: 'Rears up when cornered. Give it room.',
  },
  {
    id: 'scorpion', name: 'Scorpion', emoji: '🦂', bodyPlan: 'insect', habitat: 'land', temperament: 'hostile',
    palette: { body: '#3a2a1a', head: '#4a3520', limb: '#2a1e12', accent: '#8a6a2a' },
    scale: 0.45, health: 10, speed: 1.3, damage: 5,
    biomes: ['desert', 'badlands', 'canyon'], weight: 6, nocturnal: true,
    loot: [{ blockId: 8, amount: 1 }],
    description: 'Comes out when the sand cools.',
  },
  {
    id: 'elephant', name: 'Elephant', emoji: '🐘', bodyPlan: 'quadruped', habitat: 'land', temperament: 'neutral',
    palette: { body: '#8a8a88', head: '#9a9a98', limb: '#6a6a68' },
    scale: 2.3, health: 120, speed: 1.0, damage: 12,
    biomes: ['savanna', 'plain', 'jungle'], weight: 2,
    loot: [{ blockId: 112, amount: 5 }],
    description: 'Moves slowly and does not need to hurry.',
  },
  {
    id: 'lion', name: 'Lion', emoji: '🦁', bodyPlan: 'quadruped', habitat: 'land', temperament: 'hostile',
    palette: { body: '#c8a05a', head: '#8a5a2a', limb: '#a88248', accent: '#5a3a18' },
    scale: 1.2, health: 55, speed: 2.1, damage: 10,
    biomes: ['savanna', 'plain'], weight: 3,
    loot: [{ blockId: 112, amount: 3 }],
    description: 'Apex predator of the grasslands.',
  },
  {
    id: 'giraffe', name: 'Giraffe', emoji: '🦒', bodyPlan: 'quadruped', habitat: 'land', temperament: 'passive',
    palette: { body: '#e0b458', head: '#d8a848', limb: '#c09038', accent: '#8a5a22' },
    scale: 2.0, health: 48, speed: 1.4, damage: 0,
    biomes: ['savanna'], weight: 3,
    loot: [{ blockId: 112, amount: 3 }],
    description: 'Browses the tops of acacia trees.',
  },
  {
    id: 'polar_bear', name: 'Polar Bear', emoji: '🐻‍❄️', bodyPlan: 'quadruped', habitat: 'amphibious', temperament: 'hostile',
    palette: { body: '#eceff5', head: '#f4f6fa', limb: '#c8cdd8' },
    scale: 1.6, health: 70, speed: 1.5, damage: 10,
    biomes: ['snow', 'ice', 'arctic', 'tundra', 'iceberg', 'frozen'], weight: 4,
    loot: [{ blockId: 112, amount: 3 }],
    description: 'The most dangerous thing on the ice.',
  },
  {
    id: 'penguin', name: 'Penguin', emoji: '🐧', bodyPlan: 'biped', habitat: 'amphibious', temperament: 'passive',
    palette: { body: '#22242a', head: '#1a1c22', limb: '#e8a02a', accent: '#f0f2f6' },
    scale: 0.55, health: 12, speed: 0.8, damage: 0,
    biomes: ['snow', 'ice', 'arctic', 'iceberg', 'frozen'], weight: 7,
    loot: [{ blockId: 114, amount: 1 }],
    description: 'Waddles on land, rockets through water.',
  },
  {
    id: 'goat', name: 'Mountain Goat', emoji: '🐐', bodyPlan: 'quadruped', habitat: 'land', temperament: 'neutral',
    palette: { body: '#d8d4c8', head: '#e4e0d4', limb: '#8a8478', accent: '#5a5248' },
    scale: 0.85, health: 24, speed: 1.5, damage: 3,
    biomes: ['mountain', 'highland', 'alpine', 'windswept', 'cliff'], weight: 8,
    loot: [{ blockId: 3, amount: 1 }],
    description: 'Stands on ledges that should not hold it.',
  },
  {
    id: 'frog', name: 'Frog', emoji: '🐸', bodyPlan: 'quadruped', habitat: 'amphibious', temperament: 'passive',
    palette: { body: '#5a9a3a', head: '#6aaa4a', limb: '#3a6a22', accent: '#d8e858' },
    scale: 0.3, health: 6, speed: 1.0, damage: 0,
    biomes: ['swamp', 'mangrove', 'jungle', 'lake'], weight: 9,
    loot: [{ blockId: 108, amount: 1 }],
    description: 'Croaks all night in the marsh.',
  },
  {
    id: 'crocodile', name: 'Crocodile', emoji: '🐊', bodyPlan: 'quadruped', habitat: 'amphibious', temperament: 'hostile',
    palette: { body: '#4a5a2a', head: '#3a4a20', limb: '#2a3a18', accent: '#8a9a5a' },
    scale: 1.4, health: 55, speed: 1.4, damage: 11,
    biomes: ['swamp', 'mangrove', 'jungle', 'river'], weight: 4,
    loot: [{ blockId: 112, amount: 3 }],
    description: 'Waits at the waterline, mostly submerged.',
  },
];

/* ------------------------------------------------------------------ */
/* Ocean life — for the deeper oceans                                  */
/* ------------------------------------------------------------------ */

const OCEAN: SpeciesDefinition[] = [
  {
    id: 'cod', name: 'Cod', emoji: '🐟', bodyPlan: 'fish', habitat: 'water', temperament: 'passive',
    palette: { body: '#8a7a5a', head: '#9a8a6a', limb: '#6a5a3a' },
    scale: 0.4, health: 6, speed: 1.6, damage: 0,
    biomes: ['ocean', 'lake', 'beach', 'coral'], weight: 12, depthRange: [1, 24],
    loot: [{ blockId: 112, amount: 1 }],
    description: 'Schools in the shallows.',
  },
  {
    id: 'salmon', name: 'Salmon', emoji: '🐠', bodyPlan: 'fish', habitat: 'water', temperament: 'passive',
    palette: { body: '#c86a5a', head: '#d87a6a', limb: '#8a4a3a', accent: '#e8a898' },
    scale: 0.45, health: 8, speed: 1.8, damage: 0,
    biomes: ['ocean', 'river', 'lake', 'frozen_ocean'], weight: 10, depthRange: [1, 20],
    loot: [{ blockId: 112, amount: 1 }],
    description: 'Runs upriver in season.',
  },
  {
    id: 'clownfish', name: 'Clownfish', emoji: '🐠', bodyPlan: 'fish', habitat: 'water', temperament: 'passive',
    palette: { body: '#e87a2a', head: '#f08a3a', limb: '#1a1a1a', accent: '#f8f8f8' },
    scale: 0.25, health: 4, speed: 1.4, damage: 0,
    biomes: ['coral', 'warm_beach', 'ocean'], weight: 11, depthRange: [1, 14],
    loot: [{ blockId: 102, amount: 1 }],
    description: 'Never far from the reef.',
  },
  {
    id: 'sea_turtle', name: 'Sea Turtle', emoji: '🐢', bodyPlan: 'marine', habitat: 'water', temperament: 'passive',
    palette: { body: '#4a7a4a', head: '#5a8a5a', limb: '#3a6a3a', accent: '#8aaa6a' },
    scale: 0.8, health: 22, speed: 1.0, damage: 0,
    biomes: ['ocean', 'coral', 'beach', 'warm_beach'], weight: 6, depthRange: [1, 18],
    loot: [{ blockId: 4, amount: 2 }],
    description: 'Glides between reef and beach.',
  },
  {
    id: 'dolphin', name: 'Dolphin', emoji: '🐬', bodyPlan: 'marine', habitat: 'water', temperament: 'passive',
    palette: { body: '#7a8a9a', head: '#8a9aaa', limb: '#5a6a7a', accent: '#e0e8f0' },
    scale: 1.1, health: 30, speed: 3.0, damage: 0,
    biomes: ['ocean', 'deep_ocean', 'coral'], weight: 6, depthRange: [1, 26],
    loot: [{ blockId: 112, amount: 2 }],
    description: 'Rides the bow wave and leaps clear.',
  },
  {
    id: 'shark', name: 'Great White Shark', emoji: '🦈', bodyPlan: 'marine', habitat: 'water', temperament: 'hostile',
    palette: { body: '#6a7480', head: '#5a6470', limb: '#48525c', accent: '#e8ecf0' },
    scale: 1.8, health: 70, speed: 2.6, damage: 14,
    biomes: ['ocean', 'deep_ocean', 'shipwreck'], weight: 4, depthRange: [4, 40],
    loot: [{ blockId: 112, amount: 3 }],
    description: 'The reason you do not swim at dusk.',
  },
  {
    id: 'orca', name: 'Orca', emoji: '🐋', bodyPlan: 'marine', habitat: 'water', temperament: 'neutral',
    palette: { body: '#141618', head: '#1a1c20', limb: '#0e1012', accent: '#f4f6f8' },
    scale: 2.4, health: 110, speed: 2.8, damage: 16,
    biomes: ['ocean', 'deep_ocean', 'frozen_ocean', 'iceberg'], weight: 2, depthRange: [6, 48],
    loot: [{ blockId: 112, amount: 5 }],
    description: 'Hunts in coordinated pods.',
  },
  {
    id: 'whale', name: 'Humpback Whale', emoji: '🐋', bodyPlan: 'marine', habitat: 'water', temperament: 'passive',
    palette: { body: '#3a4a58', head: '#44545f', limb: '#2a3844', accent: '#8a9aa8' },
    scale: 3.6, health: 200, speed: 1.4, damage: 0,
    biomes: ['deep_ocean', 'ocean'], weight: 1, depthRange: [10, 60],
    loot: [{ blockId: 112, amount: 8 }],
    description: 'Vast, slow, and utterly indifferent to you.',
  },
  {
    id: 'squid', name: 'Giant Squid', emoji: '🦑', bodyPlan: 'marine', habitat: 'water', temperament: 'neutral',
    palette: { body: '#6a3a5a', head: '#7a4a6a', limb: '#4a2a3a', accent: '#c88ab0' },
    scale: 1.3, health: 40, speed: 1.6, damage: 7,
    biomes: ['deep_ocean', 'ocean', 'monument'], weight: 4, depthRange: [16, 64],
    loot: [{ blockId: 12, amount: 1 }],
    description: 'Rises from the deep after dark.',
  },
  {
    id: 'jellyfish', name: 'Jellyfish', emoji: '🎐', bodyPlan: 'marine', habitat: 'water', temperament: 'hostile',
    palette: { body: '#a878d8', head: '#c898f0', limb: '#8a58b8', accent: '#e8d0ff' },
    scale: 0.5, health: 8, speed: 0.5, damage: 4,
    biomes: ['ocean', 'deep_ocean', 'coral', 'monument'], weight: 8, depthRange: [3, 40],
    loot: [{ blockId: 16, amount: 1 }],
    description: 'Drifts. Stings anything it touches.',
  },
  {
    id: 'cosmic_jelly', name: 'Cosmic Jelly', emoji: '🪼', bodyPlan: 'marine', habitat: 'air', temperament: 'neutral',
    palette: { body: '#7a4dd0', head: '#9a6af0', limb: '#5a30a8', accent: '#c8a8ff' },
    scale: 2.2, health: 60, speed: 1.1, damage: 8,
    biomes: ['humorous', 'void'], weight: 6, nocturnal: false,
    loot: [{ blockId: 16, amount: 2 }],
    description: 'A giant cosmic jelly that drifts between the floating isles, feeding on particles of light.',
  },
  {
    id: 'particle_moth', name: 'Particle Moth', emoji: '🦋', bodyPlan: 'bird', habitat: 'air', temperament: 'passive',
    palette: { body: '#a8d8ff', head: '#c8f0ff', limb: '#7ab0e0', accent: '#ffffff' },
    scale: 0.8, health: 12, speed: 1.8, damage: 0,
    biomes: ['humorous', 'void'], weight: 8, nocturnal: false,
    loot: [{ blockId: 301, amount: 1 }],
    description: 'Eats the cosmic particles that illuminate The Humorous.',
  },
  {
    id: 'anglerfish', name: 'Anglerfish', emoji: '🐡', bodyPlan: 'fish', habitat: 'water', temperament: 'hostile',
    palette: { body: '#1a1a24', head: '#24242e', limb: '#101018', accent: '#f0e070' },
    scale: 0.6, health: 18, speed: 1.1, damage: 8,
    biomes: ['deep_ocean', 'abyss'], weight: 5, depthRange: [34, 80],
    loot: [{ blockId: 106, amount: 1 }],
    description: 'A light in the dark, attached to teeth.',
  },
  {
    id: 'crab', name: 'Crab', emoji: '🦀', bodyPlan: 'insect', habitat: 'amphibious', temperament: 'neutral',
    palette: { body: '#d05a3a', head: '#e06a4a', limb: '#a04a2a' },
    scale: 0.35, health: 10, speed: 0.9, damage: 3,
    biomes: ['beach', 'coral', 'ocean', 'rocky_beach', 'warm_beach'], weight: 9, depthRange: [0, 10],
    loot: [{ blockId: 112, amount: 1 }],
    description: 'Sidesteps along the tideline.',
  },
  {
    id: 'sea_snake', name: 'Sea Snake', emoji: '🐍', bodyPlan: 'serpent', habitat: 'water', temperament: 'hostile',
    palette: { body: '#2a5a6a', head: '#3a6a7a', limb: '#1a3a4a', accent: '#d8d868' },
    scale: 1.0, health: 14, speed: 1.7, damage: 8,
    biomes: ['ocean', 'coral', 'mangrove', 'warm_beach'], weight: 5, depthRange: [1, 22],
    loot: [{ blockId: 112, amount: 1 }],
    description: 'Ribbons through the shallows.',
  },
];

/* ------------------------------------------------------------------ */
/* Birds                                                               */
/* ------------------------------------------------------------------ */

const BIRDS: SpeciesDefinition[] = [
  {
    id: 'eagle', name: 'Bald Eagle', emoji: '🦅', bodyPlan: 'bird', habitat: 'air', temperament: 'neutral',
    palette: { body: '#4a3520', head: '#f0f0ec', limb: '#e8b02a', accent: '#2a1e12' },
    scale: 0.8, health: 18, speed: 3.2, damage: 5,
    biomes: ['mountain', 'highland', 'forest', 'alpine', 'cliff'], weight: 5,
    loot: [{ blockId: 114, amount: 1 }],
    description: 'Circles the ridgelines on thermals.',
  },
  {
    id: 'seagull', name: 'Seagull', emoji: '🕊️', bodyPlan: 'bird', habitat: 'air', temperament: 'passive',
    palette: { body: '#f0f2f4', head: '#f8fafc', limb: '#e8a83a', accent: '#8a9aa8' },
    scale: 0.45, health: 8, speed: 2.6, damage: 0,
    biomes: ['beach', 'ocean', 'coral', 'warm_beach', 'rocky_beach'], weight: 10,
    loot: [{ blockId: 114, amount: 1 }],
    description: 'Loud, and after your food.',
  },
  {
    id: 'parrot', name: 'Parrot', emoji: '🦜', bodyPlan: 'bird', habitat: 'air', temperament: 'passive',
    palette: { body: '#d02a3a', head: '#f0c02a', limb: '#3a3a3a', accent: '#2a8ad0' },
    scale: 0.4, health: 8, speed: 2.4, damage: 0,
    biomes: ['jungle', 'rainforest', 'bamboo'], weight: 8,
    loot: [{ blockId: 114, amount: 1 }],
    description: 'Bright against the canopy.',
  },
  {
    id: 'owl', name: 'Owl', emoji: '🦉', bodyPlan: 'bird', habitat: 'air', temperament: 'neutral',
    palette: { body: '#6a5238', head: '#8a6e4a', limb: '#c8a038', accent: '#e8e0c8' },
    scale: 0.5, health: 12, speed: 2.2, damage: 3,
    biomes: ['forest', 'taiga', 'haunted', 'redwood'], weight: 6, nocturnal: true,
    loot: [{ blockId: 114, amount: 1 }],
    description: 'Silent until it is already past you.',
  },
  {
    id: 'bat', name: 'Bat', emoji: '🦇', bodyPlan: 'bird', habitat: 'air', temperament: 'passive',
    palette: { body: '#2e2632', head: '#3a3040', limb: '#1a1620' },
    scale: 0.28, health: 6, speed: 2.8, damage: 0,
    biomes: ['cave', 'haunted', 'spooky', 'mountain'], weight: 9, nocturnal: true,
    loot: [],
    description: 'Wheels through cave mouths at dusk.',
  },
];


/* ------------------------------------------------------------------ */
/* EAOIN natives — creatures themed on the game's own world            */
/*                                                                     */
/* The roster above is real-world wildlife. These are the mobs that     */
/* belong to EAOIN specifically: the things that live in its caves, its */
/* nights, and its 30 dimensions. They are the hostile backbone of the  */
/* game, so combat has something to be about.                           */
/* ------------------------------------------------------------------ */

const EAOIN_NATIVES: SpeciesDefinition[] = [
  /* ---- Overworld night ---- */
  {
    id: 'husk_wanderer', name: 'Husk Wanderer', emoji: '🧟', bodyPlan: 'biped', habitat: 'land', temperament: 'hostile',
    palette: { body: '#5a6a4a', head: '#6a7a58', limb: '#3a4a30', accent: '#2a3020' },
    scale: 1.0, health: 34, speed: 1.15, damage: 6,
    biomes: ['plain', 'forest', 'desert', 'savanna', 'badlands'], weight: 9, nocturnal: true,
    loot: [{ blockId: 2, amount: 1 }],
    description: 'Walks until the sun stops it.',
  },
  {
    id: 'zombie', name: 'Zombie', emoji: '🧟‍♂️', bodyPlan: 'biped', habitat: 'land', temperament: 'hostile',
    palette: { body: '#3e7a4a', head: '#4a8a56', limb: '#2a5a36', accent: '#162a1a' },
    scale: 1.02, health: 40, speed: 1.05, damage: 7,
    biomes: ['plain', 'forest', 'swamp', 'badlands', 'mountain', 'taiga'], weight: 12, nocturnal: true,
    loot: [{ blockId: 2, amount: 2 }],
    description: 'The risen dead. They shamble, but they do not tire.',
  },
  {
    id: 'werewolf', name: 'Werewolf', emoji: '🐺', bodyPlan: 'quadruped', habitat: 'land', temperament: 'hostile',
    palette: { body: '#3a3a44', head: '#4a4a54', limb: '#2a2a32', accent: '#c8c8d0' },
    scale: 1.3, health: 90, speed: 2.6, damage: 16,
    // Only appears under a full moon via the moon-event system.
    biomes: ['forest', 'taiga', 'mountain', 'plain'], weight: 3, nocturnal: true, fullMoonOnly: true,
    loot: [{ blockId: 3, amount: 2 }],
    description: 'It only comes out on the full moon. Run.',
  },
  {
    id: 'bone_archer', name: 'Bone Archer', emoji: '💀', bodyPlan: 'biped', habitat: 'land', temperament: 'hostile',
    palette: { body: '#d8d4c4', head: '#e8e4d4', limb: '#b8b4a4', accent: '#5a5648' },
    scale: 0.98, health: 26, speed: 1.35, damage: 7,
    biomes: ['plain', 'forest', 'cave', 'mountain', 'badlands'], weight: 8, nocturnal: true,
    loot: [{ blockId: 3, amount: 1 }],
    description: 'Keeps its distance. Rarely misses.',
  },
  {
    id: 'creep_bloom', name: 'Creep Bloom', emoji: '🌵', bodyPlan: 'biped', habitat: 'land', temperament: 'hostile',
    palette: { body: '#4aa83a', head: '#5ab84a', limb: '#2a6a22', accent: '#1a4a18' },
    scale: 0.92, health: 22, speed: 1.25, damage: 14,
    biomes: ['plain', 'forest', 'meadow', 'jungle'], weight: 6, nocturnal: true,
    loot: [{ blockId: 8, amount: 1 }],
    description: 'Swells before it bursts. Back away.',
  },
  {
    id: 'hollow_stalker', name: 'Hollow Stalker', emoji: '👤', bodyPlan: 'biped', habitat: 'land', temperament: 'hostile',
    palette: { body: '#2a2432', head: '#352c3e', limb: '#1a1620', accent: '#8a5cf6' },
    scale: 1.4, health: 48, speed: 1.9, damage: 11,
    biomes: ['forest', 'haunted', 'cave', 'badlands'], weight: 3, nocturnal: true,
    loot: [{ blockId: 12, amount: 1 }],
    description: 'It is closer than it was a moment ago.',
  },

  /* ---- Caves ---- */
  {
    id: 'glow_moth', name: 'Glow Moth', emoji: '🦋', bodyPlan: 'insect', habitat: 'air', temperament: 'passive',
    palette: { body: '#7a6ad8', head: '#8a7ae8', limb: '#4a3a98', accent: '#d8f0ff' },
    scale: 0.4, health: 6, speed: 2.0, damage: 0,
    biomes: ['cave', 'mushroom', 'jungle', 'swamp'], weight: 9,
    loot: [{ blockId: 106, amount: 1 }],
    description: 'Drifts through cavern light like a lantern.',
  },
  {
    id: 'cave_lurker', name: 'Cave Lurker', emoji: '🕷️', bodyPlan: 'insect', habitat: 'land', temperament: 'hostile',
    palette: { body: '#3a2a2a', head: '#4a3232', limb: '#241818', accent: '#c83a2a' },
    scale: 0.75, health: 20, speed: 1.85, damage: 6,
    biomes: ['cave', 'cavern', 'deep', 'mineshaft'], weight: 10,
    loot: [{ blockId: 8, amount: 1 }],
    description: 'Comes down the wall, not along the floor.',
  },
  {
    id: 'crystal_crawler', name: 'Crystal Crawler', emoji: '💠', bodyPlan: 'insect', habitat: 'land', temperament: 'neutral',
    palette: { body: '#5ad0e8', head: '#7ae0f8', limb: '#2a8aa8', accent: '#e8faff' },
    scale: 0.55, health: 24, speed: 1.2, damage: 4,
    biomes: ['cave', 'crystal', 'cavern', 'mountain'], weight: 5,
    loot: [{ blockId: 16, amount: 1 }],
    description: 'Its shell rings when struck.',
  },
  {
    id: 'magma_slug', name: 'Magma Slug', emoji: '🔥', bodyPlan: 'serpent', habitat: 'land', temperament: 'hostile',
    palette: { body: '#c8401a', head: '#e8601a', limb: '#8a2a10', accent: '#ffc040' },
    scale: 0.9, health: 40, speed: 0.7, damage: 9,
    biomes: ['cave', 'volcanic', 'nether', 'deep'], weight: 6,
    loot: [{ blockId: 8, amount: 2 }],
    description: 'Leaves the stone glowing behind it.',
  },
  {
    id: 'deep_gazer', name: 'Deep Gazer', emoji: '👁️', bodyPlan: 'marine', habitat: 'land', temperament: 'hostile',
    palette: { body: '#1a2a3a', head: '#24384a', limb: '#101a28', accent: '#40e0d0' },
    scale: 0.5, health: 55, speed: 0.9, damage: 13,
    biomes: ['cave', 'deep', 'abyss', 'cavern'], weight: 2,
    loot: [{ blockId: 16, amount: 2 }],
    description: 'It has been watching the whole time.',
  },

  /* ---- Nether / volcanic ---- */
  {
    id: 'ember_imp', name: 'Ember Imp', emoji: '👺', bodyPlan: 'biped', habitat: 'land', temperament: 'hostile',
    palette: { body: '#8a2a1a', head: '#a83a24', limb: '#5a1a10', accent: '#ffb03a' },
    scale: 0.6, health: 18, speed: 2.1, damage: 7,
    biomes: ['nether', 'volcanic', 'basalt', 'soul'], weight: 10,
    loot: [{ blockId: 8, amount: 1 }],
    description: 'Small, fast, and delighted about it.',
  },
  {
    id: 'ash_walker', name: 'Ash Walker', emoji: '🌋', bodyPlan: 'quadruped', habitat: 'land', temperament: 'hostile',
    palette: { body: '#4a3a38', head: '#5a4642', limb: '#2a201e', accent: '#ff6a2a' },
    scale: 1.3, health: 70, speed: 1.2, damage: 12,
    biomes: ['nether', 'volcanic', 'basalt', 'toxic'], weight: 5,
    loot: [{ blockId: 8, amount: 2 }],
    description: 'Cracked hide with fire underneath.',
  },
  {
    id: 'soul_wisp', name: 'Soul Wisp', emoji: '🕯️', bodyPlan: 'insect', habitat: 'air', temperament: 'neutral',
    palette: { body: '#5ad8d0', head: '#7af0e8', limb: '#2a8a88', accent: '#e8ffff' },
    scale: 0.35, health: 10, speed: 2.4, damage: 3,
    biomes: ['nether', 'soul', 'spirit', 'haunted'], weight: 8,
    loot: [{ blockId: 106, amount: 1 }],
    description: 'Someone, once. Still humming.',
  },

  /* ---- End / void ---- */
  {
    id: 'void_drifter', name: 'Void Drifter', emoji: '🌌', bodyPlan: 'marine', habitat: 'air', temperament: 'neutral',
    palette: { body: '#241838', head: '#32224a', limb: '#140e22', accent: '#a879ff' },
    scale: 1.1, health: 44, speed: 1.5, damage: 8,
    biomes: ['end', 'void', 'astral', 'cosmic'], weight: 7,
    loot: [{ blockId: 12, amount: 1 }],
    description: 'Swims through vacuum as if it were water.',
  },
  {
    id: 'shard_sentinel', name: 'Shard Sentinel', emoji: '🔷', bodyPlan: 'biped', habitat: 'land', temperament: 'hostile',
    palette: { body: '#3a2a5a', head: '#4a3670', limb: '#241a3a', accent: '#c8a8ff' },
    scale: 1.5, health: 90, speed: 1.0, damage: 15,
    biomes: ['end', 'crystal', 'astral', 'void'], weight: 4,
    loot: [{ blockId: 16, amount: 2 }],
    description: 'Assembled from the pieces of something older.',
  },
  {
    id: 'star_minnow', name: 'Star Minnow', emoji: '✨', bodyPlan: 'fish', habitat: 'air', temperament: 'passive',
    palette: { body: '#8ad8ff', head: '#b8ecff', limb: '#4a98c8', accent: '#ffffff' },
    scale: 0.3, health: 5, speed: 2.6, damage: 0,
    biomes: ['end', 'astral', 'cosmic', 'void', 'sky'], weight: 11,
    loot: [{ blockId: 16, amount: 1 }],
    description: 'Shoals of them drift between the islands.',
  },

  /* ---- Sky ---- */
  {
    id: 'cloud_ray', name: 'Cloud Ray', emoji: '🪁', bodyPlan: 'marine', habitat: 'air', temperament: 'passive',
    palette: { body: '#c8dcf0', head: '#dceaf8', limb: '#8aa8c8', accent: '#ffffff' },
    scale: 1.6, health: 34, speed: 1.4, damage: 0,
    biomes: ['sky', 'alpine', 'mountain', 'aether'], weight: 6,
    loot: [{ blockId: 106, amount: 1 }],
    description: 'Glides the high thermals in silence.',
  },
  {
    id: 'storm_harrier', name: 'Storm Harrier', emoji: '⚡', bodyPlan: 'bird', habitat: 'air', temperament: 'hostile',
    palette: { body: '#3a4a6a', head: '#4a5a80', limb: '#e8d040', accent: '#a8d8ff' },
    scale: 0.7, health: 26, speed: 3.4, damage: 8,
    biomes: ['sky', 'storm', 'mountain', 'alpine'], weight: 5,
    loot: [{ blockId: 114, amount: 1 }],
    description: 'Dives out of the cloud layer.',
  },

  /* ---- Swamp / toxic ---- */
  {
    id: 'bog_shambler', name: 'Bog Shambler', emoji: '🪵', bodyPlan: 'biped', habitat: 'amphibious', temperament: 'hostile',
    palette: { body: '#3a4a2a', head: '#4a5a34', limb: '#242e1a', accent: '#8aaa4a' },
    scale: 1.25, health: 52, speed: 0.95, damage: 9,
    biomes: ['swamp', 'mangrove', 'bog', 'marsh'], weight: 7,
    loot: [{ blockId: 108, amount: 2 }],
    description: 'Rises out of the water with the water still on it.',
  },
  {
    id: 'spore_hopper', name: 'Spore Hopper', emoji: '🍄', bodyPlan: 'quadruped', habitat: 'land', temperament: 'passive',
    palette: { body: '#c85a7a', head: '#d86a8a', limb: '#8a3a52', accent: '#f0d0e0' },
    scale: 0.5, health: 14, speed: 1.7, damage: 0,
    biomes: ['mushroom', 'swamp', 'cave', 'jungle'], weight: 8,
    loot: [{ blockId: 108, amount: 1 }],
    description: 'Puffs a cloud of spores when startled.',
  },
  {
    id: 'toxin_hound', name: 'Toxin Hound', emoji: '☣️', bodyPlan: 'quadruped', habitat: 'land', temperament: 'hostile',
    palette: { body: '#5a7a2a', head: '#6a8a34', limb: '#3a5218', accent: '#c8ff4a' },
    scale: 0.85, health: 32, speed: 2.2, damage: 8,
    biomes: ['toxic', 'swamp', 'badlands', 'wasteland'], weight: 6,
    loot: [{ blockId: 108, amount: 1 }],
    description: 'Hunts by smell through the haze.',
  },

  /* ---- Frozen ---- */
  {
    id: 'frost_stag', name: 'Frost Stag', emoji: '🦌', bodyPlan: 'quadruped', habitat: 'land', temperament: 'skittish',
    palette: { body: '#c8dce8', head: '#dceaf4', limb: '#8aa0b0', accent: '#6ac8f0' },
    scale: 1.15, health: 30, speed: 2.0, damage: 0,
    biomes: ['snow', 'frozen', 'tundra', 'taiga', 'ice'], weight: 6,
    loot: [{ blockId: 112, amount: 2 }],
    description: 'Antlers rimed with frost. Gone before you focus.',
  },
  {
    id: 'rime_lurker', name: 'Rime Lurker', emoji: '🧊', bodyPlan: 'biped', habitat: 'land', temperament: 'hostile',
    palette: { body: '#7ab8d8', head: '#8ac8e8', limb: '#4a80a0', accent: '#e8f8ff' },
    scale: 1.1, health: 44, speed: 1.3, damage: 10,
    biomes: ['snow', 'frozen', 'ice', 'tundra'], weight: 5, nocturnal: true,
    loot: [{ blockId: 16, amount: 1 }],
    description: 'Indistinguishable from the ice until it moves.',
  },

  /* ---- Ancient / machine ---- */
  {
    id: 'rune_golem', name: 'Rune Golem', emoji: '🗿', bodyPlan: 'biped', habitat: 'land', temperament: 'neutral',
    palette: { body: '#7a7a72', head: '#8a8a80', limb: '#5a5a54', accent: '#6ad0c0' },
    scale: 1.7, health: 110, speed: 0.85, damage: 14,
    biomes: ['ancient', 'desert', 'mountain', 'ruins', 'cave'], weight: 3,
    loot: [{ blockId: 3, amount: 3 }],
    description: 'Stands still for centuries. Then does not.',
  },
  {
    id: 'scrap_drone', name: 'Scrap Drone', emoji: '🛸', bodyPlan: 'insect', habitat: 'air', temperament: 'hostile',
    palette: { body: '#6a7080', head: '#7a8090', limb: '#454a56', accent: '#ff8a2a' },
    scale: 0.5, health: 22, speed: 2.7, damage: 7,
    biomes: ['machine', 'ancient', 'toxic', 'ruins'], weight: 7,
    loot: [{ blockId: 3, amount: 1 }],
    description: 'Still running a patrol nobody ordered.',
  },

  /* ---- Prehistoric ---- */
  {
    id: 'raptor', name: 'Raptor', emoji: '🦖', bodyPlan: 'biped', habitat: 'land', temperament: 'hostile',
    palette: { body: '#6a7a3a', head: '#7a8a48', limb: '#4a5424', accent: '#d8a83a' },
    scale: 1.0, health: 42, speed: 2.6, damage: 11,
    biomes: ['prehistoric', 'jungle', 'savanna', 'forest'], weight: 6,
    loot: [{ blockId: 112, amount: 2 }],
    description: 'Hunts in threes. You have seen one.',
  },
  {
    id: 'shell_grazer', name: 'Shell Grazer', emoji: '🦕', bodyPlan: 'quadruped', habitat: 'land', temperament: 'neutral',
    palette: { body: '#5a6a4a', head: '#6a7a58', limb: '#3a4632', accent: '#8a7a5a' },
    scale: 2.4, health: 140, speed: 0.75, damage: 10,
    biomes: ['prehistoric', 'jungle', 'swamp', 'plain'], weight: 3,
    loot: [{ blockId: 112, amount: 4 }],
    description: 'Enormous, slow, and entirely uninterested in you.',
  },

  /* ---- Ocean natives ---- */
  {
    id: 'reef_darter', name: 'Reef Darter', emoji: '🐠', bodyPlan: 'fish', habitat: 'water', temperament: 'passive',
    palette: { body: '#f0a02a', head: '#ffb84a', limb: '#c07018', accent: '#2a4a8a' },
    scale: 0.32, health: 6, speed: 2.3, damage: 0,
    biomes: ['coral', 'ocean', 'warm_beach', 'beach'], weight: 12, depthRange: [1, 16],
    loot: [{ blockId: 102, amount: 1 }],
    description: 'Never more than a body length from cover.',
  },
  {
    id: 'abyss_lantern', name: 'Abyss Lantern', emoji: '🏮', bodyPlan: 'fish', habitat: 'water', temperament: 'neutral',
    palette: { body: '#1a1a2e', head: '#26263e', limb: '#101020', accent: '#6affd8' },
    scale: 0.6, health: 20, speed: 1.1, damage: 6,
    biomes: ['deep_ocean', 'abyss', 'ocean'], weight: 6, depthRange: [30, 80],
    loot: [{ blockId: 106, amount: 1 }],
    description: 'The light is the lure.',
  },
  {
    id: 'tide_serpent', name: 'Tide Serpent', emoji: '🐍', bodyPlan: 'serpent', habitat: 'water', temperament: 'hostile',
    palette: { body: '#2a6a7a', head: '#347a8a', limb: '#1a4a58', accent: '#8ae0d0' },
    scale: 1.5, health: 60, speed: 1.7, damage: 12,
    biomes: ['ocean', 'deep_ocean', 'coral'], weight: 4, depthRange: [4, 40],
    loot: [{ blockId: 102, amount: 2 }],
    description: 'Longer than your boat.',
  },
  {
    id: 'giant_octopus', name: 'Giant Octopus', emoji: '🐙', bodyPlan: 'marine', habitat: 'water', temperament: 'hostile',
    palette: { body: '#7a2a4a', head: '#8a3a5a', limb: '#5a2038', accent: '#ffb0d0' },
    scale: 3.2, health: 180, speed: 1.2, damage: 18,
    biomes: ['deep_ocean', 'abyss', 'ocean'], weight: 1, depthRange: [24, 80],
    loot: [{ blockId: 112, amount: 4 }],
    description: 'A mountain of tentacles. It pulls ships down.',
  },
  {
    id: 'glowing_centipede', name: 'Abyssal Centipede', emoji: '🐛', bodyPlan: 'serpent', habitat: 'water', temperament: 'hostile',
    palette: { body: '#1a3a2e', head: '#264a3a', limb: '#122a20', accent: '#7aff6a' },
    scale: 2.6, health: 140, speed: 1.5, damage: 15,
    biomes: ['deep_ocean', 'abyss', 'trench'], weight: 1, depthRange: [40, 90],
    loot: [{ blockId: 106, amount: 3 }],
    description: 'Its segments glow with shifting bioluminescence as it coils on the trench floor.',
  },
  {
    id: 'kraken', name: 'The Kraken', emoji: '🦑', bodyPlan: 'marine', habitat: 'water', temperament: 'hostile',
    palette: { body: '#1a2a3a', head: '#2a3a4a', limb: '#101828', accent: '#6ae0ff' },
    scale: 6.5, health: 420, speed: 0.9, damage: 28,
    biomes: ['deep_ocean', 'abyss', 'trench', 'monument'], weight: 1, depthRange: [50, 100],
    loot: [{ blockId: 12, amount: 6 }],
    description: 'The leviathan of the deep. Its eye is a lantern of cold blue light.',
  },
];

export const ALL_SPECIES: SpeciesDefinition[] = [...LAND, ...OCEAN, ...BIRDS, ...EAOIN_NATIVES];

export const SPECIES_BY_ID: Record<string, SpeciesDefinition> = ALL_SPECIES.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<string, SpeciesDefinition>
);

/**
 * Maps an informal species habitat tag onto the biome-id tokens that should
 * satisfy it. Keeps `WildlifeRegistry` readable while matching the 150-entry
 * biome vocabulary in `Biomes.ts`.
 */
const TAG_SYNONYMS: Record<string, string[]> = {
  plain: ['plain', 'plains', 'meadow', 'grassland'],
  snow: ['snow', 'snowy', 'frozen', 'ice', 'tundra', 'glacial'],
  ice: ['ice', 'frozen', 'iceberg', 'glacial'],
  arctic: ['arctic', 'frozen', 'snowy', 'tundra'],
  tundra: ['tundra', 'snowy', 'frozen'],
  jungle: ['jungle', 'rainforest', 'bamboo'],
  rainforest: ['rainforest', 'jungle'],
  mountain: ['mountain', 'alpine', 'highland', 'peaks', 'stony', 'jagged'],
  alpine: ['alpine', 'mountain', 'peaks'],
  highland: ['highland', 'mountain', 'alpine'],
  forest: ['forest', 'woods', 'grove', 'taiga'],
  taiga: ['taiga', 'spruce', 'pine'],
  swamp: ['swamp', 'mangrove', 'bog', 'marsh'],
  ocean: ['ocean', 'sea'],
  beach: ['beach', 'coast', 'shore'],
  desert: ['desert', 'badlands', 'dune'],
  cave: ['cave', 'cavern', 'caverns', 'underground'],
};

const COLD_QUALIFIERS = new Set(['snowy', 'frozen', 'ice', 'tundra', 'glacial', 'arctic']);
const WARM_QUALIFIERS = new Set(['desert', 'savanna', 'jungle', 'rainforest', 'tropical', 'warm']);

/** Tags whose species must not appear in a cold variant of that biome. */
const WARM_ONLY_TAGS = new Set(['savanna', 'jungle', 'rainforest', 'desert', 'oasis', 'bamboo']);
/** Tags whose species must not appear in a warm variant of that biome. */
const COLD_ONLY_TAGS = new Set(['snow', 'ice', 'arctic', 'tundra', 'frozen', 'iceberg']);

/**
 * Every species that can spawn in a biome, respecting habitat and time of day.
 *
 * `biomeId` is matched by substring so the small `TerrainGenerator` vocabulary
 * ('Forest', 'Desert') and the 150-entry `Biomes.ts` vocabulary
 * ('mangrove_swamp', 'snowy_taiga') both resolve without a lookup table.
 */
export function speciesForBiome(
  biomeId: string,
  options: { habitat?: Habitat | 'any'; isNight?: boolean } = {}
): SpeciesDefinition[] {
  const key = biomeId.toLowerCase();
  const habitat = options.habitat ?? 'any';
  const isNight = options.isNight ?? false;

  return ALL_SPECIES.filter((s) => {
    if (habitat !== 'any' && s.habitat !== habitat && s.habitat !== 'amphibious') return false;
    // Nocturnal species only appear at night; everything else prefers the day
    // but is not hard-gated, so the world never feels empty.
    if (s.nocturnal && !isNight) return false;
    if (s.biomes.length === 0) return true;
    // Climate veto is decided per SPECIES, not per tag. A lion lists both
    // 'savanna' and 'plain'; checking tags individually let the neutral
    // 'plain' tag sneak it into `snowy_plains` even though 'savanna' was
    // vetoed. What matters is whether the animal as a whole belongs here.
    if (!climateAllows(key, s)) return false;
    return s.biomes.some((tag) => biomeMatches(key, tag));
  });
}

/**
 * Reject a species whose overall climate is incompatible with the biome.
 *
 * A species is "warm" if any of its habitat tags is warm-only and none is
 * cold-only, and vice versa. Animals that list both (or neither) are
 * climate-agnostic and always pass.
 */
function climateAllows(biomeId: string, species: SpeciesDefinition): boolean {
  const tokens = biomeId.split(/[^a-z]+/).filter(Boolean);
  const biomeIsCold = tokens.some((t) => COLD_QUALIFIERS.has(t));
  const biomeIsWarm = tokens.some((t) => WARM_QUALIFIERS.has(t));

  const wantsWarm = species.biomes.some((t) => WARM_ONLY_TAGS.has(t));
  const wantsCold = species.biomes.some((t) => COLD_ONLY_TAGS.has(t));

  if (wantsWarm && !wantsCold && biomeIsCold) return false;
  if (wantsCold && !wantsWarm && biomeIsWarm) return false;
  return true;
}

/**
 * Does a biome id match a species' habitat tag?
 *
 * ## Why this is not a plain substring test
 *
 * It used to be `key.includes(tag) || tag.includes(key)`, which put **savanna
 * lions and elephants into `snowy_plains`** — because `'snowy_plains'`
 * contains the substring `'plain'`. Every `*_plains` and `*_forest` biome
 * inherited the fauna of its warm counterpart, so snowfields had lions in them.
 *
 * Matching is now on whole underscore-separated tokens, with an explicit
 * exclusion list for climate words that invert a biome's meaning. A tag only
 * matches if it appears as a token AND the biome is not disqualified.
 */
function biomeMatches(biomeId: string, tag: string): boolean {
  const tokens = biomeId.split(/[^a-z]+/).filter(Boolean);

  // Species tags are written in the singular and informally ('snow', 'jungle',
  // 'mountain'), while biome ids are specific ('snowy_plains', 'rainforest',
  // 'alpine_biome'). Synonyms bridge the two vocabularies so a tag matches the
  // biomes a reader would expect it to.
  const synonyms = TAG_SYNONYMS[tag] ?? [tag];
  const present = synonyms.some((syn) =>
    syn.split(/[^a-z]+/).filter(Boolean).every((t) => tokens.includes(t))
  );
  if (!present) return false;

  // NOTE: the climate veto lives in `climateAllows`, which reasons about the
  // species as a whole. Doing it here, per tag, let an animal with one neutral
  // tag ('plain') bypass a veto earned by another ('savanna').
  return true;
}


/** Weighted pick from a candidate list using a deterministic 0-1 roll. */
export function pickSpecies(candidates: SpeciesDefinition[], roll: number): SpeciesDefinition | null {
  if (candidates.length === 0) return null;
  const total = candidates.reduce((sum, s) => sum + s.weight, 0);
  let cursor = Math.max(0, Math.min(0.999999, roll)) * total;
  for (const s of candidates) {
    cursor -= s.weight;
    if (cursor <= 0) return s;
  }
  return candidates[candidates.length - 1];
}

/** Count of species per habitat, for the wildlife codex UI. */
export function speciesStats(): { total: number; land: number; water: number; air: number } {
  return {
    total: ALL_SPECIES.length,
    land: ALL_SPECIES.filter((s) => s.habitat === 'land' || s.habitat === 'amphibious').length,
    water: ALL_SPECIES.filter((s) => s.habitat === 'water' || s.habitat === 'amphibious').length,
    air: ALL_SPECIES.filter((s) => s.habitat === 'air').length,
  };
}

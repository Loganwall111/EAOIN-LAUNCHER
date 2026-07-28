/**
 * WorldTypes — "Life Comes Apart 2.0" world generation presets.
 *
 * Selected on the world-creation screen. Each preset is a bundle of terrain
 * generator overrides plus metadata for the UI, so adding a world type is a
 * single entry here and it immediately appears in the create menu.
 *
 * Includes the deliberately strange ones:
 *   - **Far Lands** — recreates the classic Minecraft terrain-noise overflow
 *     bug as an intentional feature: past a threshold distance the noise
 *     saturates into vast vertical walls and stretched cave systems.
 *   - **Sub-Bedrock** — dimensions stacked *underneath* bedrock, so digging
 *     down far enough drops you into a whole new layer rather than hitting an
 *     unbreakable floor.
 *   - **Skylands** — nothing but floating islands over an endless void.
 */

export type WorldTypeID =
  | 'default'
  | 'flat'
  | 'amplified'
  | 'skylands'
  | 'far_lands'
  | 'sub_bedrock'
  | 'caves'
  | 'islands'
  | 'water_world'
  | 'inverted'
  | 'large_biomes'
  | 'single_biome';

export interface WorldTypeDefinition {
  id: WorldTypeID;
  name: string;
  /** Short blurb for the create-world card. */
  description: string;
  /** Longer explanation shown when the type is selected. */
  detail: string;
  /** CSS gradient used for the preview tile. */
  preview: string;
  /** Terrain generator overrides applied when this type is chosen. */
  config: WorldTypeConfig;
  /** Marks the odd, exploratory types so the UI can badge them. */
  exotic?: boolean;
}

export interface WorldTypeConfig {
  /** Multiplies overall terrain amplitude. */
  heightScale?: number;
  /** Forces a completely flat world at this Y. */
  flatGroundY?: number;
  /** Generate floating islands instead of continents. */
  floatingIslands?: boolean;
  /** Remove the surface entirely — the whole world is cave. */
  caveWorld?: boolean;
  /** Raise sea level so most of the world is ocean. */
  seaLevelOverride?: number;
  /** Stretch biomes over a much larger area. */
  biomeScale?: number;
  /** Lock the whole world to a single biome id. */
  forcedBiome?: string;
  /**
   * Distance from origin at which Far Lands corruption begins. Terrain noise
   * saturates past this, producing vertical walls and stretched caves.
   */
  farLandsThreshold?: number;
  /** Generate stacked dimension layers below the bedrock floor. */
  subBedrockLayers?: number;
  /** Invert the terrain so caves become mountains. */
  inverted?: boolean;
}

export const WORLD_TYPES: WorldTypeDefinition[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Classic continents, oceans, caves and 150+ biomes.',
    detail:
      'The standard EAOIN overworld. Rolling terrain with rivers, deep cave systems, ravines, ore veins and the full biome table.',
    preview: 'linear-gradient(180deg,#6fb0e6 0%,#a8d8f8 34%,#6cc24a 52%,#3f7a2a 62%,#6b4a2a 100%)',
    config: {},
  },
  {
    id: 'flat',
    name: 'Superflat',
    description: 'A perfectly level world. Ideal for building and testing.',
    detail:
      'Bedrock, a few layers of stone and dirt, then grass all the way to the horizon. No caves, no hills, no surprises — just a canvas.',
    preview: 'linear-gradient(180deg,#8ec8f0 0%,#b8e0ff 56%,#6cc24a 56%,#6cc24a 72%,#7a5a38 100%)',
    config: { flatGroundY: 12, heightScale: 0 },
  },
  {
    id: 'amplified',
    name: 'Amplified',
    description: 'Extreme terrain. Towering peaks and plunging chasms.',
    detail:
      'Terrain amplitude is pushed far past normal, producing sheer mountains that scrape the build limit and valleys that fall away to bedrock.',
    preview: 'linear-gradient(180deg,#3a6fa8 0%,#8fc0e8 22%,#e8f4ff 38%,#6a8a5a 60%,#4a3a2a 100%)',
    config: { heightScale: 2.6 },
  },
  {
    id: 'large_biomes',
    name: 'Large Biomes',
    description: 'The same world, with biomes stretched four times wider.',
    detail:
      'Every biome covers vastly more ground. Deserts become genuinely dangerous crossings and forests take real time to traverse.',
    preview: 'linear-gradient(180deg,#6fb0e6 0%,#a8d8f8 30%,#8ac24a 50%,#c8b46a 74%,#6b4a2a 100%)',
    config: { biomeScale: 4 },
  },
  {
    id: 'skylands',
    name: 'Skylands',
    description: 'Floating islands over an endless void. No ground below.',
    detail:
      'The surface is gone. What remains are thousands of drifting islands at every altitude, linked by nothing but the gap between them. Falling is permanent.',
    preview: 'linear-gradient(180deg,#5aa0e0 0%,#9ad0f8 40%,#7ec24a 52%,#6b4a2a 62%,#2a3a5a 100%)',
    config: { floatingIslands: true },
    exotic: true,
  },
  {
    id: 'islands',
    name: 'Island Survival',
    description: 'Scattered islands across a world-spanning ocean.',
    detail:
      'Small landmasses separated by deep water. Boats and swimming matter, and every island is a self-contained pocket of resources.',
    preview: 'linear-gradient(180deg,#6fb0e6 0%,#a8d8f8 30%,#e6dca4 48%,#2a6ab0 56%,#0a2a5a 100%)',
    config: { seaLevelOverride: 26, heightScale: 0.85 },
  },
  {
    id: 'water_world',
    name: 'Water World',
    description: 'Almost everything is ocean. Land is a rare prize.',
    detail:
      'Sea level is raised until only the highest peaks break the surface. The deep is enormous, dark, and full of things that live down there.',
    preview: 'linear-gradient(180deg,#5a9ad8 0%,#8ac0e8 24%,#2a6ab0 40%,#123a72 70%,#04102a 100%)',
    config: { seaLevelOverride: 46, heightScale: 1.1 },
  },
  {
    id: 'caves',
    name: 'Cave World',
    description: 'No sky. The entire world is one vast cave system.',
    detail:
      'A solid stone world hollowed out by enormous interconnected caverns. Light comes only from lava, glowing fungus and whatever you bring with you.',
    preview: 'linear-gradient(180deg,#1a1a20 0%,#2e2e38 30%,#4a4048 55%,#6a3a2a 78%,#1a0e0a 100%)',
    config: { caveWorld: true },
    exotic: true,
  },
  {
    id: 'far_lands',
    name: 'The Far Lands',
    description: 'Travel far enough and the world stops making sense.',
    detail:
      'Recreates the legendary terrain-noise overflow. Past roughly 12,550,000 blocks the generator saturates: terrain smears into vast vertical walls, caves stretch into infinite tunnels, and the horizon becomes architecture. Here it starts much closer so you can actually reach it.',
    preview: 'linear-gradient(90deg,#6fb0e6 0%,#8ac24a 18%,#7a6a4a 34%,#5a5a5a 46%,#3a3a3a 60%,#6a6a6a 74%,#2a2a2a 100%)',
    config: { farLandsThreshold: 24000 },
    exotic: true,
  },
  {
    id: 'sub_bedrock',
    name: 'Sub-Bedrock Stack',
    description: 'Dig through bedrock into stacked worlds below.',
    detail:
      'Bedrock is no longer the end. Break through and you fall into another complete world layer, and another below that — each with its own biomes, its own ceiling, and its own rules. The bottom layer is the molten core.',
    preview: 'linear-gradient(180deg,#6fb0e6 0%,#6cc24a 20%,#4a4a4a 30%,#2a2a2a 40%,#6a3a2a 60%,#a83a1a 80%,#f0801a 100%)',
    config: { subBedrockLayers: 3 },
    exotic: true,
  },
  {
    id: 'inverted',
    name: 'Inverted',
    description: 'The world turned inside out. Caves become mountains.',
    detail:
      'Terrain density is flipped: every cavern becomes a spire of stone and every mountain becomes a hollow. Deeply disorienting and completely navigable.',
    preview: 'linear-gradient(180deg,#2a1a3a 0%,#4a2a5a 26%,#8a5a9a 48%,#c8a0d8 68%,#e8d8f0 100%)',
    config: { inverted: true },
    exotic: true,
  },
  {
    id: 'single_biome',
    name: 'Single Biome',
    description: 'One biome, everywhere, forever.',
    detail:
      'Pick a biome and the entire world becomes it. An endless desert, an unbroken mushroom field, a jungle with no edge.',
    preview: 'linear-gradient(180deg,#6fb0e6 0%,#a8d8f8 34%,#6cc24a 52%,#6cc24a 100%)',
    config: { forcedBiome: 'forest' },
  },
];

export const WORLD_TYPES_BY_ID: Record<string, WorldTypeDefinition> = WORLD_TYPES.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<string, WorldTypeDefinition>
);

export function getWorldType(id: string): WorldTypeDefinition {
  return WORLD_TYPES_BY_ID[id] ?? WORLD_TYPES_BY_ID.default;
}

/**
 * Encode the world type into the seed string.
 *
 * The terrain generators already sniff the seed for keywords like
 * `floating_islands`, so tagging the seed keeps the whole pipeline working
 * without threading a new parameter through every call site.
 */
export function seedForWorldType(seed: string, typeId: WorldTypeID): string {
  if (typeId === 'default') return seed;
  return `${typeId}__${seed}`;
}

/** Recover the world type from a tagged seed. */
export function worldTypeFromSeed(seed: string): WorldTypeID {
  const match = /^([a-z_]+)__/.exec(seed);
  if (match && WORLD_TYPES_BY_ID[match[1]]) return match[1] as WorldTypeID;
  // Legacy seeds used bare keywords.
  if (isLegacySkyWorldSeed(seed)) return 'skylands';
  if (/amplified/i.test(seed)) return 'amplified';
  if (/^flat_|flat/i.test(seed)) return 'flat';
  return 'default';
}

/**
 * Compatibility sniff for the old "put skylands in the raw seed" workflow.
 *
 * Important: Amplified is *not* a sky-world. A previous regex included the
 * word `amplified`, which silently routed amplified worlds onto the floating-
 * island generator and produced the exact "everything is hollow and broken"
 * look from the bug report.
 */
export function isLegacySkyWorldSeed(seed: string): boolean {
  return /floating[-_ ]?islands|skylands/i.test(seed);
}

/** Strip the type tag back off, for display and for the noise seed. */
export function baseSeed(seed: string): string {
  return seed.replace(/^[a-z_]+__/, '');
}

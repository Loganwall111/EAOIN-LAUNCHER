/**
 * AlphaVersions — the EAOIN 2.0 alpha version catalog.
 *
 * The Alpha Launcher lets you pick which alpha build to play, reads each
 * build's patch notes, and (in the future) swaps ALPHA_URL per build. This is
 * the model the launcher UI drives, mirroring the stable launcher's
 * VERSIONS but scoped to the 2.0 alpha channel.
 */

export interface AlphaBuild {
  id: string;
  /** Display version, e.g. "2.0.0-a1". */
  version: string;
  /** Minecraft-style label (Pre-1, Pre-2…). */
  label: string;
  title: string;
  released: string;
  tagline: string;
  /** Patch notes for this alpha build. */
  notes: string[];
  /** Marks the currently-published alpha build. */
  isLatest?: boolean;
}

export const ALPHA_BUILDS: AlphaBuild[] = [
  {
    id: '2.0.0-a1',
    version: '2.0.0-a1',
    label: 'Pre-1',
    title: 'The Bridge',
    released: '2026-08-01',
    tagline: 'Sprinting, severe weather, and the Nether/End overhaul.',
    notes: [
      '🏃 Sprint on keyboard / controller / touch.',
      '🌪 Severe weather — tornadoes, blizzards, sandstorms, meteor showers.',
      '🔥 Nether overhaul — bedrock roof, lava caves, crimson & warped forests.',
      '🌌 End overhaul — ring islands, obsidian pillars, black-hole sky.',
    ],
  },
  {
    id: '2.0.0-a2',
    version: '2.0.0-a2',
    label: 'Pre-2',
    title: 'The Portal',
    released: '2026-08-02',
    tagline: 'Buildable portals, the Game Hub, and a deeper Nether.',
    notes: [
      '🌀 Custom buildable portals — obsidian frames, end-crystal ground portals, aether globes, rift cylinders.',
      '🎮 Live Game Hub — server corruption, Code Emperor quests, Code Creator mini-games.',
      '👺 Deeper Nether mobs — crimson & warped forest creatures.',
      '📖 Portal Gallery + Tutorial World on the main menu.',
    ],
  },
  {
    id: '2.0.0-a3',
    version: '2.0.0-a3',
    label: 'Pre-3',
    title: 'The Hub',
    released: '2026-08-03',
    tagline: 'Alpha Launcher overhaul, OS re-skin, and the Singularity.',
    notes: [
      '🚀 New Alpha Launcher with a boot sequence, version picker and patch notes.',
      '🖥 HorizonOS re-skinned to a futuristic matrix style with more apps.',
      '🕳 Singularity — a shader-based black hole to zoom through.',
      '💾 Save & Quit to Menu plus auto-save.',
    ],
    isLatest: true,
  },
];

export function alphaBuilds(): AlphaBuild[] {
  return ALPHA_BUILDS;
}

export function latestAlphaBuild(): AlphaBuild {
  return ALPHA_BUILDS[ALPHA_BUILDS.length - 1];
}

export function getAlphaBuild(id: string): AlphaBuild | undefined {
  return ALPHA_BUILDS.find((b) => b.id === id);
}

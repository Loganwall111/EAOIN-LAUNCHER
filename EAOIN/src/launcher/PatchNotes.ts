/**
 * PatchNotes — the changelog shown in the launcher and the in-game menu.
 *
 * A simple, ordered list of patches (newest first). The launcher shows them in
 * a dedicated panel; the game shows the latest entry in the main menu.
 */
export interface PatchEntry {
  version: string;
  label: string;
  title: string;
  date: string;
  notes: string[];
}

export const PATCHES: PatchEntry[] = [
  {
    version: '2.1.0',
    label: 'Next-Gen Update',
    title: 'The Launcher, Rift Dimension & More',
    date: '2026-08-02',
    notes: [
      '🚀 Added the EAOIN Launcher — switch between Public, Experimental and Developer builds before the game boots.',
      '🌀 New Rift Dimension — colourful floating hills and a reality-rift portal.',
      '🏛 Ancient-City note-block ritual opens a blue rippling rift portal.',
      '🧟 New mobs: The Warden, Sulphur Cube, Rift Jellyfish.',
      '🏙 Rare block-built cities, houses and suburban streets.',
      '🎮 Controller & touch/mobile support (off by default).',
      '🎨 Creative mode no longer shows survival health/hunger/drink bars.',
      '🪧 Fixed the intro credit cards going black, and the studio sign wrapping.',
    ],
  },
  {
    version: '2.0.0',
    label: 'Next-Generation Universe',
    title: 'Current Public Release',
    date: '2026-08-01',
    notes: [
      '🌌 Next-generation universe overhaul.',
      '✨ Volumetric clouds, ray-traced reflections & shadows.',
      '🏘 NPC civilizations with tech ages.',
      '👑 Multi-phase bosses across every dimension.',
    ],
  },
  {
    version: '1.1.0',
    label: 'Life Comes Apart',
    title: 'Wildlife & Economy Update',
    date: '2026-02-10',
    notes: [
      '🐄 Full wildlife roster — every species can spawn.',
      '🪙 Coin economy, marketplace and editor mode.',
      '🧩 In-game mod editor.',
    ],
  },
  {
    version: '1.0.0',
    label: 'Release',
    title: 'The Final Journey',
    date: '2025-11-20',
    notes: [
      '📔 Find the 71 Memory Shards to restore the Journal.',
      '👴 Confront The Creator in the Corrupted Lands.',
      '🚀 Final cinematic launch to a new world.',
    ],
  },
];

export const LATEST_PATCH = PATCHES[0];

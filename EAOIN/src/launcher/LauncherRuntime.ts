/**
 * LauncherRuntime — version / build / update model for the EAOIN launcher.
 *
 * The launcher appears before the game boots (like Minecraft / the official
 * launcher). It lets you:
 *   - Switch between old versions, the current public build, and beta builds.
 *   - Pick a "channel": Public, Experimental, or Developer builds.
 *   - Run a system update (simulated), then downgrade back.
 *
 * In the web build there is no real binary to swap, so a "version" is a bundle
 * of settings/features that the game reads when it starts. That lets us
 * honestly change the world type, enable developer-only blocks/tools, and gate
 * experimental features behind the right channel.
 */
export type LauncherChannel = 'public' | 'experimental' | 'developer';

export interface GameBuild {
  id: string;
  name: string;
  /** Display version string, e.g. "1.0.0". */
  version: string;
  channel: LauncherChannel;
  /** Short tagline shown in the launcher list. */
  tagline: string;
  /** Minecraft-style version label. */
  label: string;
  /**
   * World type to use when this build is selected. Overrides the player's
   * normal selection so developer builds can ship a different world.
   */
  worldType?: 'default' | 'flat' | 'skylands' | 'amplified' | 'far_lands';
  /** Developer builds unlock the in-game editor + AI chatbot. */
  devTools?: boolean;
  /** Experimental builds unlock features that are still being tuned. */
  experimental?: boolean;
  /** Build date string, for the update system. */
  released: string;
  /** Marks this as the shipped release build. */
  isPublic?: boolean;
  /** Marks this as the newest / canary build. */
  isLatest?: boolean;
  isBeta?: boolean;
}

/** The full version catalog, oldest → newest. */
export const VERSIONS: GameBuild[] = [
  { id: 'v0.9.0', name: 'EAOIN 0.9.0', version: '0.9.0', channel: 'public', tagline: 'The foundations — first playable build.', label: 'Alpha', worldType: 'default', released: '2025-03-01' },
  { id: 'v0.9.5', name: 'EAOIN 0.9.5', version: '0.9.5', channel: 'public', tagline: 'Caves & Cliffs wave one.', label: 'Alpha', worldType: 'default', released: '2025-06-14' },
  { id: 'v1.0.0', name: 'EAOIN 1.0.0', version: '1.0.0', channel: 'public', tagline: 'Release — the full sandbox.', label: 'Stable', worldType: 'default', isPublic: true, released: '2025-11-20' },
  { id: 'v1.1.0', name: 'EAOIN 1.1.0', version: '1.1.0', channel: 'public', tagline: 'Life Comes Apart — wildlife & economy.', label: 'Stable', worldType: 'default', released: '2026-02-10' },
  { id: 'v2.0.0', name: 'EAOIN 2.0.0', version: '2.0.0', channel: 'public', tagline: 'Next-Generation Universe — current release.', label: 'Release', worldType: 'default', isPublic: true, isLatest: true, released: '2026-08-01' },
  { id: 'beta-2.1.0', name: 'EAOIN 2.1.0 BETA', version: '2.1.0', channel: 'public', tagline: 'The Humorous & worldgen overhaul — not out yet.', label: 'Beta', worldType: 'skylands', isBeta: true, released: '2026-09-01' },
  { id: 'exp-caves-3', name: 'Experimental: Caves & Cliffs 3', version: 'exp-3.0', channel: 'experimental', tagline: 'Deeper caves, new ores, warden territory.', label: 'Experimental', worldType: 'amplified', experimental: true, released: '2026-08-15' },
  { id: 'exp-rifts', name: 'Experimental: Reality Rifts', version: 'exp-3.1', channel: 'experimental', tagline: 'Test the rift dimension & portal mechanic.', label: 'Experimental', worldType: 'skylands', experimental: true, released: '2026-08-20' },
  { id: 'dev-sandbox', name: 'Developer: Sandbox', version: 'dev-9.9', channel: 'developer', tagline: 'End-game editor + AI chatbot. New random blocks.', label: 'Developer', worldType: 'flat', devTools: true, released: '2026-08-22' },
  { id: 'dev-worldgen', name: 'Developer: Worldgen Lab', version: 'dev-9.10', channel: 'developer', tagline: 'Prototype cities & new biomes.', label: 'Developer', worldType: 'amplified', devTools: true, released: '2026-08-25' },
];

export interface LauncherState {
  /** The build id currently selected. */
  selectedId: string;
  /** Which channel tab is active. */
  channel: LauncherChannel;
  /** Persisted "installed" build id. */
  installedId: string;
  /** True while a system update is in progress. */
  updating: boolean;
  /** Update progress 0..1. */
  updateProgress: number;
  /** The build id we just updated to (or downgraded to). */
  lastUpdate?: string;
}

export function launcherDefaults(): LauncherState {
  return {
    selectedId: 'v2.0.0',
    channel: 'public',
    installedId: 'v2.0.0',
    updating: false,
    updateProgress: 0,
  };
}

/** Which channel a build belongs to, resolved from its flags. */
export function buildChannel(b: GameBuild): LauncherChannel {
  return b.channel;
}

export function getBuild(id: string): GameBuild | undefined {
  return VERSIONS.find((b) => b.id === id);
}

/** The newest build available on the currently-selected channel. */
export function latestOfChannel(channel: LauncherChannel): GameBuild | undefined {
  return VERSIONS.filter((b) => buildChannel(b) === channel).slice(-1)[0];
}

/** Filter the catalog to one channel. */
export function buildsForChannel(channel: LauncherChannel): GameBuild[] {
  return VERSIONS.filter((b) => buildChannel(b) === channel);
}

export interface LauncherDebugSettings {
  infiniteItems: boolean;
  noFallDamage: boolean;
  instantBuild: boolean;
  godMode: boolean;
  showChunkBorders: boolean;
  superSpeed: boolean;
}

export function defaultDebugSettings(): LauncherDebugSettings {
  return { infiniteItems: false, noFallDamage: false, instantBuild: false, godMode: false, showChunkBorders: false, superSpeed: false };
}

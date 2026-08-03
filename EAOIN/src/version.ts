export const GAME_VERSION = '2.0.0';
export const RELEASE_NAME = 'The Final Release — Coloured Lighting & World\u2019s Edge';
export const BUILD_STAMP = 2026080221;
/**
 * Where the EAOIN 2.0 alpha preview is hosted on our single live site.
 *
 * The alpha is packaged as a sub-directory of the stable build (Alternative A),
 * so it lives at `./alpha/` on the same origin. The `?launch=1` query makes the
 * alpha skip its launcher boot + version-select and land straight on the title
 * screen, so clicking Alpha Launcher seamlessly bridges into the alpha.
 */
export const ALPHA_URL = './alpha/?launch=1';
export const RELEASE_LABEL = `EAOIN ${GAME_VERSION} — ${RELEASE_NAME}`;
export const RELEASE_TAGLINE = 'Official Public Release — Terrain Revamp • The Creator Endgame • 71 Memory Shards';
export const RELEASE_FEATURES = [
  '⛰️ Terrain Update: Perlin noise mountains, realistic cliffs & valleys',
  '🕳️ Cave Rework: Big tunnel systems, less abyss, refined frequency',
  '📔 The Final Journey: Find the 71 Memory Shards to restore the Journal',
  '👴 The Creator: Confront the final mystery in the Corrupted Lands',
  '🚀 Final Cinematic: Launch to a new world at the end of the story',
  '🎨 Volumetric Clouds: Higher altitude, larger clustered clouds',
  '🏗️ Inventory Fix: Creative inventory accessible in all sandbox modes',
  '🌍 25 dimensions with unique gravity, mobs, ores, music, hazards',
  '🚀 Space travel — stars, planets, galaxies, anomalies',
  '🧱 300+ blocks across 18 categories',
  '🏛 14 NPC civilizations with tech ages Stone→Multiversal',
  '👑 30+ bosses with multi-phase fights',
  '📜 30+ quests across tutorial/main/side/daily/weekly',
  '🛡 Weapons, armor, beds, food, plants, decorations',
  '🎨 18 official shaders — Vanilla, RTX, Cinematic, Vaporwave, etc.',
  '🧩 17 official mod packs — Twilight Forest, Galacticraft, Ice & Fire, etc.',
  '🌐 Multiplayer — servers, guilds, nations, voice chat, cross-server',
  '🖼 Triple-A graphics — SSAO, SSR, Bloom, Volumetric Clouds, HDR',
  '🎮 Creative tabbed inventory with scrollable categories',
  '⛏ Survival 2x2 crafting + 3x3 crafting table',
  '💎 Real 3D model & first-person arm (F5 third person fixed)',
  '⚙ Full settings, modding, shader menus like Minecraft',
];

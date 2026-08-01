/**
 * Shared presentation data for the EAOIN concept-art UI.
 *
 * Kept separate from the components so the title screen, character creator and
 * HUD all draw from one palette / asset list.
 */

export const UI_ASSETS = {
  menuPanorama: './ui/menu-panorama.jpg',
  creatorBackdrop: './ui/creator-backdrop.jpg',
  newsUpdate: './ui/news-update.jpg',
  newsCivilizations: './ui/news-civilizations.jpg',
  newsDimensions: './ui/news-dimensions.jpg',
  newsSpace: './ui/news-space.jpg',
  bgMultiplayer: './ui/bg-multiplayer.jpg',
  bgMods: './ui/bg-mods.jpg',
  bgOptions: './ui/bg-options.jpg',
} as const;

export interface NewsEntry {
  id: string;
  title: string;
  body: string;
  image: string;
}

export const NEWS_FEED: NewsEntry[] = [
  { id: 'release', title: 'EAOIN 0.01.0', body: 'The world is yours. Begin your journey.', image: UI_ASSETS.newsUpdate },
  { id: 'civs', title: 'Civilizations Update', body: 'Villages, kingdoms, and nations.', image: UI_ASSETS.newsCivilizations },
  { id: 'dims', title: 'Dimensions Expanded', body: 'New realms to explore beyond imagination.', image: UI_ASSETS.newsDimensions },
  { id: 'space', title: 'Space Exploration', body: 'The stars are closer than you think.', image: UI_ASSETS.newsSpace },
];

export const SOCIAL_LINKS = [
  { id: 'discord', icon: '💬', label: 'Discord', href: 'https://discord.com' },
  { id: 'reddit', icon: '🅡', label: 'Reddit', href: 'https://reddit.com' },
  { id: 'youtube', icon: '▶', label: 'YouTube', href: 'https://youtube.com' },
  { id: 'twitter', icon: '𝕏', label: 'X', href: 'https://x.com' },
  { id: 'web', icon: '🌐', label: 'Website', href: 'https://example.com' },
] as const;

/* ----------------------------------------------------- character appearance */

export const SKIN_TONES = ['#f3d3b3', '#eec39a', '#e0b184', '#c68a5f', '#a9714a', '#8a5738', '#6b4226'];

export const HAIR_COLORS = [
  '#2b1a0f', '#4a2c17', '#6b4423', '#a9743a', '#d8a94a', '#e8d18a',
  '#c0392b', '#f2a3b3', '#e8e8e8', '#3aa0e8', '#4ad86a', '#8b3ae8',
];

export const EYE_COLORS = ['#3b6ea5', '#2f8f6f', '#6b4423', '#4a4a4a', '#7a3ea5', '#a53e3e'];

/** Hair silhouettes are drawn procedurally; the number is just a style index. */
export const HAIR_STYLE_COUNT = 26;
export const FACIAL_HAIR_COUNT = 8;
export const CLOTHES_COLORS = ['#2aa8a8', '#2467c7', '#c0392b', '#7ac74f', '#8b5cf6', '#e8a23a', '#2f3640', '#e8e8e8'];

export interface CharacterAppearance {
  name: string;
  skinTone: string;
  hairStyle: number;
  hairColor: string;
  eyeColor: string;
  facialHair: number;
  shirtColor: string;
  pantsColor: string;
  background: string;
}

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  name: 'Player',
  skinTone: SKIN_TONES[1],
  hairStyle: 10,
  hairColor: HAIR_COLORS[2],
  eyeColor: EYE_COLORS[0],
  facialHair: 0,
  shirtColor: CLOTHES_COLORS[0],
  pantsColor: '#2f3640',
  background: 'meadows',
};

export const CREATOR_TABS = [
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'hair', label: 'Hair', icon: '💇' },
  { id: 'facial', label: 'Facial Hair', icon: '🧔' },
  { id: 'eyes', label: 'Eyes', icon: '👁' },
  { id: 'body', label: 'Body', icon: '🧍' },
  { id: 'clothes', label: 'Clothes', icon: '👕' },
  { id: 'accessories', label: 'Accessories', icon: '🎒' },
  { id: 'presets', label: 'Presets', icon: '⭐' },
] as const;

export type CreatorTabID = (typeof CREATOR_TABS)[number]['id'];

export const CREATOR_BACKGROUNDS = [
  { id: 'meadows', label: 'Meadows', css: 'linear-gradient(180deg,#8fd3ff 0%,#cfe9ff 42%,#7fbf5a 62%,#4c8a34 100%)' },
  { id: 'nether', label: 'Nether', css: 'linear-gradient(180deg,#4a0f0f 0%,#8a1f14 40%,#c0392b 68%,#2a0808 100%)' },
  { id: 'end', label: 'The End', css: 'linear-gradient(180deg,#1a0f2a 0%,#3d2a5a 42%,#8b5cf6 70%,#120a1e 100%)' },
  { id: 'city', label: 'Megacity', css: 'linear-gradient(180deg,#0f1a2a 0%,#1e3a5a 38%,#3aa0e8 66%,#08111c 100%)' },
  { id: 'space', label: 'Deep Space', css: 'linear-gradient(180deg,#04060f 0%,#0f1a3a 40%,#2a3a7a 70%,#020308 100%)' },
];

/* ------------------------------------------------------------- HUD helpers */

/**
 * Ability rail. Each entry maps to a real keyboard handler already implemented
 * in GameCanvas, so clicking a button and pressing the key do the same thing.
 */
export interface AbilityDef {
  id: string;
  key: string;
  icon: string;
  name: string;
  hint: string;
}

export const HUD_ABILITIES: AbilityDef[] = [
  { id: 'flight', key: 'F', icon: '🕊️', name: 'Flight', hint: 'Toggle creative flight' },
  { id: 'portal', key: 'P', icon: '🌀', name: 'Portal', hint: 'Cycle dimension at a portal' },
  { id: 'rocket', key: 'R', icon: '🚀', name: 'Rocket', hint: 'Launch to the moon' },
  { id: 'door', key: 'G', icon: '🚪', name: 'Door', hint: 'Use a nearby door' },
  { id: 'supplies', key: 'V', icon: '📦', name: 'Supply', hint: 'Deliver supplies to the settlement' },
  { id: 'boss', key: 'N', icon: '👑', name: 'Boss', hint: 'Strike the final boss' },
];

export const CHAT_CHANNELS = ['GLOBAL', 'LOCAL', 'FACTION', 'SYSTEM'] as const;
export type ChatChannel = (typeof CHAT_CHANNELS)[number];

export interface ChatEntry {
  id: number;
  channel: ChatChannel;
  author?: string;
  text: string;
}

export const DEMO_CHAT: ChatEntry[] = [
  { id: 1, channel: 'GLOBAL', author: 'BuilderKing', text: 'Just finished my castle!' },
  { id: 2, channel: 'GLOBAL', author: 'LunaFox', text: 'The sunset looks insane today' },
  { id: 3, channel: 'SYSTEM', text: 'You have joined the server.' },
  { id: 4, channel: 'SYSTEM', text: 'Welcome to EAOIN!' },
  { id: 5, channel: 'GLOBAL', author: 'DragonSlayer', text: 'Anyone want to raid the Ancient City?' },
  { id: 6, channel: 'FACTION', text: 'Your faction gained 250 XP.' },
];

/** Compass tick labels from 0..360 in 15° steps. */
export function compassTicks(): Array<{ deg: number; label: string; cardinal: boolean }> {
  const cardinals: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  const out: Array<{ deg: number; label: string; cardinal: boolean }> = [];
  for (let deg = 0; deg < 360; deg += 15) {
    const cardinal = cardinals[deg];
    out.push({ deg, label: cardinal ?? String(deg), cardinal: Boolean(cardinal) });
  }
  return out;
}

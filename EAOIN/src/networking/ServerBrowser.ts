/**
 * ServerBrowser — EAOIN 1.0 multiplayer support.
 * Lists dedicated servers, MMO realms, and cross-server travel options.
 */

export type ServerType = 'survival' | 'creative' | 'mmo' | 'minigames' | 'skyblock' | 'modded' | 'roleplay' | 'minigame_pvp';

export interface ServerEntry {
  id: string;
  name: string;
  ip: string;
  port: number;
  type: ServerType;
  region: 'NA' | 'EU' | 'AS' | 'AU' | 'SA' | 'AF' | 'OC';
  players: number;
  maxPlayers: number;
  ping: number;
  version: string;
  hasAntiCheat: boolean;
  hasVoiceChat: boolean;
  hasCrossPlay: boolean;
  hasGuilds: boolean;
  hasEconomy: boolean;
  hasLandClaim: boolean;
  hasGovernments: boolean;
  hasDiplomacy: boolean;
  hasFriends: boolean;
  hasAuctions: boolean;
  hasNations: boolean;
  description: string;
  motd: string;
  emoji: string;
}

const SERVERS: ServerEntry[] = [
  { id: 'eaoin_main', name: 'EAOIN Main — Official Survival', ip: 'play.eaoin.com', port: 25565, type: 'survival', region: 'NA', players: 8420, maxPlayers: 10000, ping: 22, version: '1.0.0', hasAntiCheat: true, hasVoiceChat: true, hasCrossPlay: true, hasGuilds: true, hasEconomy: true, hasLandClaim: true, hasGovernments: true, hasDiplomacy: true, hasFriends: true, hasAuctions: true, hasNations: true, description: 'Official EAOIN main server — survival with full MMO features.', motd: 'Welcome to EAOIN — 1.0 has launched!', emoji: '🌍' },
  { id: 'eaoin_creative', name: 'Creative Plaza', ip: 'creative.eaoin.com', port: 25566, type: 'creative', region: 'NA', players: 2180, maxPlayers: 5000, ping: 28, version: '1.0.0', hasAntiCheat: true, hasVoiceChat: true, hasCrossPlay: true, hasGuilds: true, hasEconomy: true, hasLandClaim: true, hasGovernments: false, hasDiplomacy: false, hasFriends: true, hasAuctions: true, hasNations: false, description: 'Massive creative plot world, plot protection, worldedit.', motd: 'Plot world — claim your free plot!', emoji: '🏗' },
  { id: 'eaoin_mmo', name: 'Auralis MMO', ip: 'auralis.eaoin.com', port: 25567, type: 'mmo', region: 'EU', players: 12_400, maxPlayers: 25_000, ping: 92, version: '1.0.0', hasAntiCheat: true, hasVoiceChat: true, hasCrossPlay: true, hasGuilds: true, hasEconomy: true, hasLandClaim: true, hasGovernments: true, hasDiplomacy: true, hasFriends: true, hasAuctions: true, hasNations: true, description: 'A living 180-km world. Join or found a nation.', motd: 'Cross-server travel is live — visit allies!', emoji: '🏰' },
  { id: 'eaoin_skyblock', name: 'Skyblock Universe', ip: 'sky.eaoin.com', port: 25568, type: 'skyblock', region: 'NA', players: 540, maxPlayers: 2000, ping: 18, version: '1.0.0', hasAntiCheat: true, hasVoiceChat: true, hasCrossPlay: true, hasGuilds: true, hasEconomy: true, hasLandClaim: true, hasGovernments: false, hasDiplomacy: false, hasFriends: true, hasAuctions: true, hasNations: false, description: 'Classic skyblock with custom island progression.', motd: 'New season just dropped!', emoji: '☁' },
  { id: 'eaoin_pvp', name: 'Warzone PvP', ip: 'pvp.eaoin.com', port: 25569, type: 'minigame_pvp', region: 'NA', players: 320, maxPlayers: 500, ping: 14, version: '1.0.0', hasAntiCheat: true, hasVoiceChat: true, hasCrossPlay: true, hasGuilds: true, hasEconomy: false, hasLandClaim: false, hasGovernments: false, hasDiplomacy: false, hasFriends: true, hasAuctions: false, hasNations: false, description: 'Tournaments every weekend. Diamonds or death.', motd: 'Tournament finals tonight!', emoji: '⚔' },
  { id: 'eaoin_roleplay', name: 'Realmwalkers RP', ip: 'rp.eaoin.com', port: 25570, type: 'roleplay', region: 'EU', players: 1100, maxPlayers: 3000, ping: 78, version: '1.0.0', hasAntiCheat: true, hasVoiceChat: true, hasCrossPlay: true, hasGuilds: true, hasEconomy: true, hasLandClaim: true, hasGovernments: true, hasDiplomacy: true, hasFriends: true, hasAuctions: true, hasNations: true, description: 'Narrative-driven roleplay server with live GMs.', motd: 'New quest line: The Hollow Crown', emoji: '📖' },
  { id: 'eaoin_modded', name: 'Modded Mania', ip: 'mods.eaoin.com', port: 25571, type: 'modded', region: 'AS', players: 880, maxPlayers: 2000, ping: 144, version: '1.0.0+mods', hasAntiCheat: false, hasVoiceChat: true, hasCrossPlay: true, hasGuilds: true, hasEconomy: true, hasLandClaim: true, hasGovernments: false, hasDiplomacy: false, hasFriends: true, hasAuctions: true, hasNations: false, description: 'Bring your modpack — any combo, 100+ GB allowed.', motd: 'Twilight Forest + Ice and Fire today!', emoji: '🧩' },
  { id: 'eaoin_minigames', name: 'BlockParty', ip: 'mini.eaoin.com', port: 25572, type: 'minigames', region: 'NA', players: 200, maxPlayers: 1000, ping: 22, version: '1.0.0', hasAntiCheat: true, hasVoiceChat: true, hasCrossPlay: true, hasGuilds: false, hasEconomy: true, hasLandClaim: false, hasGovernments: false, hasDiplomacy: false, hasFriends: true, hasAuctions: false, hasNations: false, description: 'TNT Run, Block Hunt, Sky Wars, Build Battle, and more.', motd: 'Build Battle finals in 30m!', emoji: '🎉' },
  { id: 'eaoin_anarchy', name: '2b2t-style Anarchy', ip: 'anarchy.eaoin.com', port: 25573, type: 'survival', region: 'NA', players: 410, maxPlayers: 2000, ping: 38, version: '1.0.0', hasAntiCheat: false, hasVoiceChat: false, hasCrossPlay: true, hasGuilds: false, hasEconomy: false, hasLandClaim: false, hasGovernments: false, hasDiplomacy: false, hasFriends: true, hasAuctions: false, hasNations: false, description: 'No rules. No resets. Don\'t trust anyone.', motd: 'Welcome to hell.', emoji: '🩸' },
  { id: 'eaoin_hardcore', name: 'Hardcore Realms', ip: 'hc.eaoin.com', port: 25574, type: 'survival', region: 'NA', players: 80, maxPlayers: 200, ping: 18, version: '1.0.0', hasAntiCheat: true, hasVoiceChat: true, hasCrossPlay: true, hasGuilds: true, hasEconomy: true, hasLandClaim: true, hasGovernments: false, hasDiplomacy: false, hasFriends: true, hasAuctions: false, hasNations: false, description: 'One life. Live it well.', motd: '15 players left.', emoji: '☠' },
];

export const ALL_SERVERS: ServerEntry[] = SERVERS;
export function getServer(id: string): ServerEntry | undefined {
  return SERVERS.find((s) => s.id === id);
}

export interface FriendEntry {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'in_game' | 'away' | 'dnd';
  server?: string;
  realm: string;
  level: number;
  lastSeen: string;
  avatar: string;
}

export const DEMO_FRIENDS: FriendEntry[] = [
  { id: 'f1', name: 'CraftMaster42', status: 'in_game', server: 'eaoin_main', realm: 'main', level: 84, lastSeen: 'now', avatar: '🧙' },
  { id: 'f2', name: 'BlockWizard', status: 'online', realm: 'main', level: 67, lastSeen: '2m ago', avatar: '🧝' },
  { id: 'f3', name: 'RedstonePro', status: 'away', realm: 'main', level: 92, lastSeen: '15m ago', avatar: '⚙' },
  { id: 'f4', name: 'PixelArtist', status: 'in_game', server: 'eaoin_creative', realm: 'creative', level: 56, lastSeen: 'now', avatar: '🎨' },
  { id: 'f5', name: 'DragonSlayer', status: 'dnd', realm: 'main', level: 99, lastSeen: '1h ago', avatar: '🐉' },
  { id: 'f6', name: 'FrostBite', status: 'offline', realm: 'main', level: 45, lastSeen: '3d ago', avatar: '❄' },
  { id: 'f7', name: 'GalaxyHopper', status: 'in_game', server: 'eaoin_mmo', realm: 'mmo', level: 78, lastSeen: 'now', avatar: '🚀' },
  { id: 'f8', name: 'EnderQueen', status: 'online', realm: 'main', level: 88, lastSeen: '5m ago', avatar: '👸' },
];

export const DEMO_GUILDS = [
  { id: 'g1', name: 'Crystal Vanguard', tag: 'Crys', members: 64, level: 18, motd: 'Building the Crystal Realm!', leader: 'CraftMaster42' },
  { id: 'g2', name: 'Redstone Engineers', tag: 'Eng', members: 132, level: 24, motd: 'No redstone too complex.', leader: 'RedstonePro' },
  { id: 'g3', name: 'Dragon Hunters', tag: 'DH', members: 48, level: 16, motd: 'We hunt dragons.', leader: 'DragonSlayer' },
  { id: 'g4', name: 'Sky Pirates', tag: 'Sky', members: 88, level: 20, motd: 'Plunder the clouds!', leader: 'SkyPirate99' },
];

export const DEMO_NATIONS = [
  { id: 'n1', name: 'Kingdom of Solaris', leader: 'Queen Auralia', population: 5400, territory: '12,400 blocks', economy: 9_200_000, allies: ['Elven Vale', 'Pearl Republic'], enemies: ['The Legion', 'The Pit'], emoji: '👑' },
  { id: 'n2', name: 'Orc Confederation', leader: 'Warchief Gruumsh', population: 2400, territory: '6,800 blocks', economy: 2_100_000, allies: [], enemies: ['Dwarves of Kaz', 'Solaris'], emoji: '🪓' },
  { id: 'n3', name: 'Pearl Republic', leader: 'Reef-Warden Kalani', population: 6000, territory: '18,200 blocks', economy: 8_400_000, allies: ['Solaris', 'Crystal Singers'], enemies: [], emoji: '🧜' },
  { id: 'n4', name: 'The Pit', leader: 'Lord Asmodeus', population: 2200, territory: '4,400 blocks', economy: 1_200_000, allies: ['The Legion'], enemies: ['Seraphic Celes'], emoji: '👿' },
];

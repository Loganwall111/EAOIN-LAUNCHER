/**
 * CivilizationTech — NPC civilization simulation + technology tree.
 *
 * Civilisations:
 *  - Build houses, farms, roads, castles
 *  - Expand villages
 *  - Form kingdoms
 *  - Wage wars, make peace
 *  - Elect leaders
 *  - Trade, research, colonize, build space stations
 *
 * Tech ages:
 *  Stone → Bronze → Iron → Steel → Industrial → Modern → Futuristic → Space → Interstellar → Multiversal
 */

export type TechAge =
  | 'stone'
  | 'bronze'
  | 'iron'
  | 'steel'
  | 'industrial'
  | 'modern'
  | 'futuristic'
  | 'space'
  | 'interstellar'
  | 'multiversal';

export const TECH_AGE_ORDER: TechAge[] = [
  'stone', 'bronze', 'iron', 'steel', 'industrial', 'modern', 'futuristic', 'space', 'interstellar', 'multiversal',
];

export const TECH_AGE_LABELS: Record<TechAge, string> = {
  stone: 'Stone Age',
  bronze: 'Bronze Age',
  iron: 'Iron Age',
  steel: 'Steel Age',
  industrial: 'Industrial Age',
  modern: 'Modern Age',
  futuristic: 'Futuristic Age',
  space: 'Space Age',
  interstellar: 'Interstellar Age',
  multiversal: 'Multiversal Age',
};

export const TECH_AGE_ICONS: Record<TechAge, string> = {
  stone: '🪨', bronze: '🥉', iron: '⚙', steel: '🛡', industrial: '🏭',
  modern: '💡', futuristic: '🤖', space: '🚀', interstellar: '🛸', multiversal: '🌀',
};

export const TECH_AGE_DESCRIPTIONS: Record<TechAge, string> = {
  stone: 'Hunting, gathering, simple huts.',
  bronze: 'First metals, plows, writing.',
  iron: 'Better tools, larger settlements.',
  steel: 'Swords, armor, kingdoms.',
  industrial: 'Steam power, factories, railroads.',
  modern: 'Electricity, cars, planes, computers.',
  futuristic: 'AI, drones, fusion, energy shields.',
  space: 'Rockets, satellites, moon bases.',
  interstellar: 'FTL, alien contact, space elevators.',
  multiversal: 'Travel between dimensions, multiverse politics.',
};

export interface CivilizationStats {
  id: string;
  name: string;
  race: 'human' | 'elf' | 'dwarf' | 'orc' | 'fey' | 'alien' | 'robot' | 'undead' | 'angel' | 'demon' | 'crystal' | 'void' | 'spirit' | 'aquatic';
  age: TechAge;
  population: number;
  settlements: number;
  military: number;
  wealth: number;
  happiness: number;
  research: number;
  religion: string;
  leader: string;
  war: { atWar: boolean; withWhom?: string; sinceTick?: number };
  alliances: string[];
  capital: { x: number; y: number; z: number };
  territoryRadius: number;
  emoji: string;
  color: string;
}

const RACE_LIST: CivilizationStats['race'][] = [
  'human', 'elf', 'dwarf', 'orc', 'fey', 'alien', 'robot', 'undead', 'angel', 'demon', 'crystal', 'void', 'spirit', 'aquatic',
];

/** Pre-built civilizations that auto-spawn per dimension. */
export const STARTING_CIVILIZATIONS: CivilizationStats[] = [
  { id: 'human_overworld', name: 'Kingdom of Solaris', race: 'human', age: 'industrial', population: 1240, settlements: 6, military: 220, wealth: 5600, happiness: 0.74, research: 0.42, religion: 'Order of the Sun', leader: 'Queen Auralia', war: { atWar: false }, alliances: ['elf_vales'], capital: { x: 180, y: 64, z: -240 }, territoryRadius: 220, emoji: '👑', color: '#5dd6ff' },
  { id: 'elf_vales', name: 'Emerald Vale', race: 'elf', age: 'steel', population: 480, settlements: 3, military: 80, wealth: 2200, happiness: 0.88, research: 0.55, religion: 'Old Songs', leader: 'Archdruid Elandar', war: { atWar: false }, alliances: ['human_overworld'], capital: { x: -340, y: 72, z: 200 }, territoryRadius: 180, emoji: '🌿', color: '#5dd67a' },
  { id: 'dwarf_kaz', name: 'Karak Kazad-dûn', race: 'dwarf', age: 'industrial', population: 920, settlements: 5, military: 320, wealth: 8800, happiness: 0.71, research: 0.6, religion: 'Forgefather', leader: 'King Thoradin', war: { atWar: true, withWhom: 'orc_redmoon', sinceTick: 0 }, alliances: [], capital: { x: 0, y: 24, z: 360 }, territoryRadius: 240, emoji: '⛏', color: '#a06a3a' },
  { id: 'orc_redmoon', name: 'Red Moon Clan', race: 'orc', age: 'iron', population: 600, settlements: 4, military: 280, wealth: 1400, happiness: 0.62, research: 0.18, religion: 'Blood Moon', leader: 'Warchief Gruumsh', war: { atWar: true, withWhom: 'dwarf_kaz', sinceTick: 0 }, alliances: [], capital: { x: 280, y: 70, z: 460 }, territoryRadius: 200, emoji: '🪓', color: '#c84a4a' },
  { id: 'fey_dream', name: 'Court of the Dreaming', race: 'fey', age: 'modern', population: 200, settlements: 2, military: 60, wealth: 6000, happiness: 0.92, research: 0.78, religion: 'The First Dream', leader: 'Queen Titania', war: { atWar: false }, alliances: ['elf_vales'], capital: { x: -480, y: 80, z: -120 }, territoryRadius: 160, emoji: '🧚', color: '#a879ff' },
  { id: 'alien_zeta', name: 'Zetan Federation', race: 'alien', age: 'space', population: 14000, settlements: 12, military: 1800, wealth: 99_000, happiness: 0.65, research: 0.92, religion: 'Cosmic Truth', leader: 'Speaker Vex', war: { atWar: false }, alliances: ['robot_logic'], capital: { x: 0, y: 64, z: 0 }, territoryRadius: 320, emoji: '👽', color: '#5dd6ff' },
  { id: 'robot_logic', name: 'Logic Engine', race: 'robot', age: 'futuristic', population: 8000, settlements: 9, military: 1200, wealth: 80_000, happiness: 0.55, research: 0.97, religion: 'The Algorithm', leader: 'Core 7', war: { atWar: false }, alliances: ['alien_zeta'], capital: { x: 220, y: 64, z: 200 }, territoryRadius: 280, emoji: '🤖', color: '#a8a8a8' },
  { id: 'undead_legion', name: 'The Legion', race: 'undead', age: 'iron', population: 1500, settlements: 4, military: 600, wealth: 0, happiness: 0.10, research: 0.30, religion: 'The Hollow', leader: 'The Lich King', war: { atWar: true, withWhom: 'human_overworld', sinceTick: 0 }, alliances: ['demon_pit'], capital: { x: -260, y: 32, z: 380 }, territoryRadius: 220, emoji: '💀', color: '#3a3a40' },
  { id: 'angel_celes', name: 'Seraphic Celes', race: 'angel', age: 'futuristic', population: 1200, settlements: 3, military: 900, wealth: 60_000, happiness: 0.98, research: 0.85, religion: 'Light', leader: 'Archangel Auriel', war: { atWar: true, withWhom: 'demon_pit', sinceTick: 0 }, alliances: [], capital: { x: 380, y: 96, z: -200 }, territoryRadius: 240, emoji: '😇', color: '#fff7b0' },
  { id: 'demon_pit', name: 'The Pit', race: 'demon', age: 'industrial', population: 2200, settlements: 4, military: 1000, wealth: 12_000, happiness: 0.45, research: 0.55, religion: 'The Maw', leader: 'Lord Asmodeus', war: { atWar: true, withWhom: 'angel_celes', sinceTick: 0 }, alliances: ['undead_legion'], capital: { x: -380, y: 18, z: -360 }, territoryRadius: 260, emoji: '👿', color: '#a82a2a' },
  { id: 'crystal_singers', name: 'Crystal Singers', race: 'crystal', age: 'modern', population: 350, settlements: 2, military: 50, wealth: 18_000, happiness: 0.95, research: 0.92, religion: 'The Song', leader: 'Resonance-Keeper Veya', war: { atWar: false }, alliances: ['fey_dream'], capital: { x: 460, y: 48, z: 80 }, territoryRadius: 180, emoji: '💎', color: '#a879ff' },
  { id: 'void_empire', name: 'Void Empire', race: 'void', age: 'interstellar', population: 9500, settlements: 10, military: 2000, wealth: 80_000, happiness: 0.20, research: 0.99, religion: 'The End', leader: 'The Eye', war: { atWar: false }, alliances: [], capital: { x: 0, y: 64, z: -480 }, territoryRadius: 360, emoji: '🌑', color: '#1a0a1a' },
  { id: 'spirit_choir', name: 'Choir of Whispers', race: 'spirit', age: 'industrial', population: 600, settlements: 3, military: 100, wealth: 9000, happiness: 0.78, research: 0.72, religion: 'The Echo', leader: 'Conductor Wraith', war: { atWar: false }, alliances: ['undead_legion'], capital: { x: 220, y: 40, z: -360 }, territoryRadius: 180, emoji: '👻', color: '#a8c8e8' },
  { id: 'aquatic_pearl', name: 'Pearl Republic', race: 'aquatic', age: 'futuristic', population: 6000, settlements: 7, military: 700, wealth: 45_000, happiness: 0.80, research: 0.80, religion: 'The Tide', leader: 'Reef-Warden Kalani', war: { atWar: false }, alliances: ['crystal_singers'], capital: { x: -220, y: 12, z: 0 }, territoryRadius: 260, emoji: '🧜', color: '#5dd6ff' },
];

export const CIVILIZATIONS: CivilizationStats[] = STARTING_CIVILIZATIONS;
export const ALL_CIVILIZATIONS: CivilizationStats[] = CIVILIZATIONS;
export const RACE_NAMES: Record<CivilizationStats['race'], string> = {
  human: 'Human', elf: 'Elf', dwarf: 'Dwarf', orc: 'Orc', fey: 'Fey',
  alien: 'Alien', robot: 'Robot', undead: 'Undead', angel: 'Angel', demon: 'Demon',
  crystal: 'Crystal', void: 'Void', spirit: 'Spirit', aquatic: 'Aquatic',
};

export function getCiv(id: string): CivilizationStats | undefined {
  return CIVILIZATIONS.find((c) => c.id === id);
}

export function getCivsByRace(race: CivilizationStats['race']): CivilizationStats[] {
  return CIVILIZATIONS.filter((c) => c.race === race);
}

export const ALL_RACES: CivilizationStats['race'][] = RACE_LIST;

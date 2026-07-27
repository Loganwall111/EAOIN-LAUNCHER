export type GameMode = 'survival' | 'creative' | 'experimental' | 'story' | 'incredible';

export interface ModeDefinition {
  id: GameMode;
  label: string;
  description: string;
  lockedHint?: string;
}

export const GAME_MODES: ModeDefinition[] = [
  {
    id: 'survival',
    label: 'Survival',
    description: 'Classic resource, health, food, stamina, crafting, story, and progression rules.',
  },
  {
    id: 'creative',
    label: 'Creative',
    description: 'Unlimited placing and testing tools for builders and world designers.',
  },
  {
    id: 'story',
    label: 'Story Mode',
    description: 'Living lore, Ender rifts, Abyss finale, dragon/tentacle boss, rocket ending, and credits.',
  },
  {
    id: 'experimental',
    label: 'Experimental',
    description: 'Command blocks, shaders, Vulkan mode, servers, doors, rockets, moon, and mod APIs.',
  },
  {
    id: 'incredible',
    label: 'Incredible',
    description: 'Editor-like god view with every summon/entity/command preview, fireworks, and ghost navigation.',
    lockedHint: "Only fully unlocks with the rare seed: McDonald's half",
  },
];

/**
 * True for modes where the player cannot be harmed.
 *
 * Used by the death check: dying in creative would be absurd, and the engine
 * previously had no single place that answered this question.
 */
export function isCreativeMode(mode: GameMode): boolean {
  return mode === 'creative' || mode === 'incredible';
}

export function modeLabel(mode: GameMode): string {
  return GAME_MODES.find((entry) => entry.id === mode)?.label ?? 'Survival';
}

export function isRareIncredibleSeed(seed: string): boolean {
  return seed.trim().toLowerCase().replace(/[’]/g, "'") === "mcdonald's half" || seed.trim().toLowerCase() === 'mcdonalds half';
}

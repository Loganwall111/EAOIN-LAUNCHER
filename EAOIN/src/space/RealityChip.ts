/**
 * RealityChip — the reward for killing the Void Leviathan.
 *
 * Dropped inside the black hole's void dimension. Clicking it implants it, and
 * it grants every power in the game at once — the deliberate Infinity Gauntlet
 * analogue from the brief, including a **snap** that erases a chosen fraction
 * of reality.
 *
 * The chip is modelled as a set of `RealityPower`s that each expose a cost and
 * a cooldown, so it is extremely strong without being a single boolean that
 * trivialises the whole game.
 */

export type RealityPowerID =
  | 'snap'
  | 'time_stop'
  | 'rewind'
  | 'teleport'
  | 'phase'
  | 'terraform'
  | 'summon'
  | 'gravity'
  | 'lifesteal'
  | 'duplicate'
  | 'mindcontrol'
  | 'soulsight';

export interface RealityPower {
  id: RealityPowerID;
  name: string;
  /** Which "stone" this echoes, for flavour text. */
  aspect: 'space' | 'time' | 'mind' | 'soul' | 'reality' | 'power';
  description: string;
  /** Seconds before it can be used again. */
  cooldownSeconds: number;
  /** Key the player presses to fire it. */
  key: string;
}

export const REALITY_POWERS: RealityPower[] = [
  {
    id: 'snap', name: 'The Snap', aspect: 'reality',
    description: 'Erase a chosen fraction of every hostile entity in the world. Instantly, and without appeal.',
    cooldownSeconds: 300, key: 'G',
  },
  {
    id: 'time_stop', name: 'Freeze Time', aspect: 'time',
    description: 'Halt the day/night cycle, all mobs and all physics for 20 seconds.',
    cooldownSeconds: 90, key: 'Z',
  },
  {
    id: 'rewind', name: 'Rewind', aspect: 'time',
    description: 'Return to where you stood 10 seconds ago, with the health you had then.',
    cooldownSeconds: 60, key: 'R',
  },
  {
    id: 'teleport', name: 'Fold Space', aspect: 'space',
    description: 'Teleport to whatever you are looking at, at any range, through anything.',
    cooldownSeconds: 8, key: 'V',
  },
  {
    id: 'phase', name: 'Phase', aspect: 'space',
    description: 'Walk through solid matter for 12 seconds.',
    cooldownSeconds: 45, key: 'C',
  },
  {
    id: 'terraform', name: 'Reshape', aspect: 'reality',
    description: 'Raise, flatten or erase terrain in a 24-block radius with a gesture.',
    cooldownSeconds: 20, key: 'T',
  },
  {
    id: 'summon', name: 'Call', aspect: 'power',
    description: 'Summon any creature in the registry, bound to your will.',
    cooldownSeconds: 30, key: 'Y',
  },
  {
    id: 'gravity', name: 'Invert Gravity', aspect: 'power',
    description: 'Reverse gravity in a wide radius for 15 seconds. Everything not anchored falls up.',
    cooldownSeconds: 75, key: 'B',
  },
  {
    id: 'lifesteal', name: 'Siphon', aspect: 'soul',
    description: 'Drain health from every hostile in range and add it to your own.',
    cooldownSeconds: 40, key: 'N',
  },
  {
    id: 'duplicate', name: 'Mirror', aspect: 'reality',
    description: 'Duplicate the held item stack. Works on anything, including itself once.',
    cooldownSeconds: 120, key: 'M',
  },
  {
    id: 'mindcontrol', name: 'Dominate', aspect: 'mind',
    description: 'Any creature you look at fights for you until it dies.',
    cooldownSeconds: 50, key: 'K',
  },
  {
    id: 'soulsight', name: 'Soul Sight', aspect: 'soul',
    description: 'See every entity, ore vein and structure through solid rock.',
    cooldownSeconds: 25, key: 'J',
  },
];

export const POWERS_BY_ID: Record<RealityPowerID, RealityPower> = REALITY_POWERS.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<RealityPowerID, RealityPower>
);

export interface ChipState {
  /** Player is carrying the chip but has not implanted it. */
  held: boolean;
  /** Chip is implanted and its powers are live. */
  implanted: boolean;
  /** Remaining cooldown per power, in seconds. */
  cooldowns: Partial<Record<RealityPowerID, number>>;
  /** How many times the snap has been used. */
  snapCount: number;
}

export function createChipState(): ChipState {
  return { held: false, implanted: false, cooldowns: {}, snapCount: 0 };
}

/** Pick the chip up off the ground. */
export function acquireChip(state: ChipState): { state: ChipState; message: string } {
  if (state.implanted) return { state, message: 'The chip is already part of you.' };
  if (state.held) return { state, message: 'You are already carrying the chip.' };
  return {
    state: { ...state, held: true },
    message: 'Reality Chip acquired — click it in your inventory to implant it.',
  };
}

/** Implant it. This is the irreversible step. */
export function implantChip(state: ChipState): { state: ChipState; message: string } {
  if (state.implanted) return { state, message: 'Already implanted.' };
  if (!state.held) return { state, message: 'You do not have the Reality Chip.' };
  return {
    state: { ...state, held: false, implanted: true },
    message: `Reality Chip implanted. ${REALITY_POWERS.length} powers online. You can feel the seams in things.`,
  };
}

/** Tick every cooldown down. */
export function tickChip(state: ChipState, deltaSeconds: number): ChipState {
  if (!state.implanted) return state;
  let changed = false;
  const cooldowns: Partial<Record<RealityPowerID, number>> = {};
  for (const [id, remaining] of Object.entries(state.cooldowns) as Array<[RealityPowerID, number]>) {
    const next = remaining - deltaSeconds;
    if (next > 0) {
      cooldowns[id] = next;
      changed = true;
    } else {
      changed = true;
    }
  }
  return changed ? { ...state, cooldowns } : state;
}

export interface PowerUseResult {
  state: ChipState;
  ok: boolean;
  message: string;
  power?: RealityPower;
}

/** Attempt to fire a power. */
export function usePower(state: ChipState, id: RealityPowerID): PowerUseResult {
  const power = POWERS_BY_ID[id];
  if (!power) return { state, ok: false, message: 'Unknown power.' };
  if (!state.implanted) {
    return { state, ok: false, message: 'You need the Reality Chip implanted first.' };
  }

  const remaining = state.cooldowns[id] ?? 0;
  if (remaining > 0) {
    return { state, ok: false, message: `${power.name} recharging — ${Math.ceil(remaining)}s`, power };
  }

  const next: ChipState = {
    ...state,
    cooldowns: { ...state.cooldowns, [id]: power.cooldownSeconds },
    snapCount: id === 'snap' ? state.snapCount + 1 : state.snapCount,
  };

  return { state: next, ok: true, message: `${power.name} — ${power.description}`, power };
}

/**
 * Resolve a snap.
 *
 * @param fraction 0-1 portion of reality to erase. 0.5 is the canonical value.
 * @returns how many of `entityCount` are removed.
 */
export function resolveSnap(entityCount: number, fraction = 0.5): number {
  const clamped = Math.max(0, Math.min(1, fraction));
  return Math.floor(entityCount * clamped);
}

/** Map a pressed key to a power, for the input handler. */
export function powerForKey(key: string): RealityPower | null {
  const upper = key.toUpperCase();
  return REALITY_POWERS.find((p) => p.key === upper) ?? null;
}

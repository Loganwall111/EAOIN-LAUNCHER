/**
 * ARGStoryline — the EAOIN alternate-reality storyline (2.0 Update Part 2).
 *
 * The story: a company called EAOIN delivered AI chips/apartments; the Cosmic
 * Girl's son was sent to a planet named after the company. She sacrificed
 * herself to a monster and left a letter — the first words you hear at boot.
 * To understand the world and unlock the secret ending + God Mode, you must
 * find every fragment across every dimension. Each fragment reveals a digit of
 * the key; the key "EAOIN" opens the secret message.
 *
 * This module is a pure, persisted tracker: collect fragments by dimension,
 * and once all are gathered the key is revealed.
 */

export interface ARGFragment {
  id: string;
  /** Dimension where the fragment is hidden. */
  dimension: string;
  title: string;
  /** Story text revealed when collected. */
  text: string;
  /** A letter that assembles into the key. */
  glyph: string;
  emoji: string;
}

export const ARG_FRAGMENTS: ARGFragment[] = [
  {
    id: 'overworld', dimension: 'overworld', title: 'The Letter', glyph: 'E', emoji: '🌍',
    text: 'The first words you heard: a letter from the Cosmic Girl. She sent her son to a planet named after the company — EAOIN.',
  },
  {
    id: 'nether', dimension: 'nether', title: 'The Forge', glyph: 'A', emoji: '🔥',
    text: 'Deep in the nether caves, a forge still glows. The company built its AI chips here, molten and patient.',
  },
  {
    id: 'end', dimension: 'end', title: 'The Void Birth', glyph: 'O', emoji: '🌌',
    text: 'In the void at the centre of the End, the black hole remembers. It was here the daughter sacrificed herself to the monster.',
  },
  {
    id: 'aether', dimension: 'aether', title: 'The Cloud Archive', glyph: 'I', emoji: '☁️',
    text: 'The aether clouds hold the company archive — apartment blueprints, AI housing, and the girl who grew up among them.',
  },
  {
    id: 'rift_dimension', dimension: 'rift_dimension', title: 'The Fracture', glyph: 'N', emoji: '🌀',
    text: 'A rift that was once a door. Beyond it, the monster heard — unseen but never gone. EAOIN.',
  },
];

export interface ARGState {
  collected: string[]; // fragment ids
  secretUnlocked: boolean;
}

const STORAGE_KEY = 'eaoin:arg:v1';

export function argDefaults(): ARGState {
  return { collected: [], secretUnlocked: false };
}

export class ARGStoryline {
  private state: ARGState;

  constructor() {
    this.state = this.load();
  }

  load(): ARGState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ARGState>;
        return {
          collected: Array.isArray(parsed.collected) ? parsed.collected.filter((id) => ARG_FRAGMENTS.some((f) => f.id === id)) : [],
          secretUnlocked: Boolean(parsed.secretUnlocked),
        };
      }
    } catch { /* ignore */ }
    return argDefaults();
  }

  save(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch { /* ignore */ }
  }

  getState(): ARGState {
    return { ...this.state, collected: [...this.state.collected] };
  }

  /** Collect a fragment by dimension (or explicit id). Returns the fragment, or null. */
  collect(dimensionOrId: string): ARGFragment | null {
    const frag = ARG_FRAGMENTS.find((f) => f.id === dimensionOrId || f.dimension === dimensionOrId);
    if (!frag || this.state.collected.includes(frag.id)) return null;
    this.state.collected.push(frag.id);
    // Once all 5 fragments are found, the key "EAOIN" is complete.
    if (this.state.collected.length >= ARG_FRAGMENTS.length) this.state.secretUnlocked = true;
    this.save();
    return frag;
  }

  /** The letters gathered so far, in canonical order. */
  assembledGlyphs(): string {
    return ARG_FRAGMENTS.filter((f) => this.state.collected.includes(f.id)).map((f) => f.glyph).join('');
  }

  /** True when all fragments are collected (the full key is known). */
  isKeyComplete(): boolean {
    return this.state.collected.length >= ARG_FRAGMENTS.length;
  }

  /** The full key, only revealed when complete. */
  revealKey(): string | null {
    return this.isKeyComplete() ? 'EAOIN' : null;
  }

  progress(): { found: number; total: number; pct: number } {
    const total = ARG_FRAGMENTS.length;
    return { found: this.state.collected.length, total, pct: Math.round((this.state.collected.length / total) * 100) };
  }

  reset(): void {
    this.state = argDefaults();
    this.save();
  }
}

/** Singleton for app-wide use. */
let _arg: ARGStoryline | null = null;
export function getARG(): ARGStoryline {
  if (!_arg) _arg = new ARGStoryline();
  return _arg;
}

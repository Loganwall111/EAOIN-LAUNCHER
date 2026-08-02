/**
 * MoonEvents — special night-time anomalies driven by the moon phase.
 *
 * On a deterministic cadence the night can become one of several "special
 * moon" events that tint the world, spawn urban-legend monsters, and raise the
 * zombie/werewolf population:
 *
 *   - Blood Moon    → the whole sky runs red, hostile mobs spawn in swarms.
 *   - Crimson Moon  → a deeper, ominous red that summons Siren Head-like and
 *                     other aberrations.
 *   - Full Moon     → werewolves come out (and wolves are more aggressive).
 *
 * The active event is exposed so the sky/lighting can tint accordingly and the
 * creature spawner can raise caps. Pure and deterministic apart from a smooth
 * timer.
 */
export type MoonEventID = 'none' | 'blood_moon' | 'crimson_moon' | 'full_moon';

export interface MoonEventState {
  id: MoonEventID;
  /** 0-1 ramp-in strength; the tint and spawn pressure scale with it. */
  strength: number;
  /** Human-readable label. */
  label: string;
}

const DURATION = 240; // seconds (~4 min of real time per event)
const CYCLE = 360;    // seconds between event checks

export class MoonEvents {
  private elapsed = 0;
  private phaseTimer = 0;
  private current: MoonEventID = 'none';
  private currentDuration = 0;

  /** When true, the current event is active (used by spawner + sky). */
  getState(): MoonEventState {
    if (this.current === 'none') return { id: 'none', strength: 0, label: 'Clear night' };
    // strength ramps up over the first ~20s and holds.
    const age = this.currentDuration;
    const strength = Math.min(1, age / 20);
    const labels: Record<Exclude<MoonEventID, 'none'>, string> = {
      blood_moon: 'Blood Moon — the world runs red',
      crimson_moon: 'Crimson Moon — the anomalies stir',
      full_moon: 'Full Moon — the beasts are restless',
    };
    return { id: this.current, strength, label: labels[this.current as Exclude<MoonEventID, 'none'>] };
  }

  isActive(id: MoonEventID): boolean {
    return this.current === id;
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    if (this.current !== 'none') {
      this.currentDuration += deltaSeconds;
      if (this.currentDuration >= DURATION) {
        this.current = 'none';
        this.currentDuration = 0;
        this.phaseTimer = 0;
      }
      return;
    }

    this.phaseTimer += deltaSeconds;
    if (this.phaseTimer < CYCLE) return;
    this.phaseTimer = 0;

    // Deterministic pick seeded by the elapsed minutes.
    const roll = (this.elapsed / 60) % 10;
    if (roll < 0.9) this.current = 'blood_moon';
    else if (roll < 1.3) this.current = 'crimson_moon';
    else if (roll < 2.0) this.current = 'full_moon';
    else this.current = 'none';
    if (this.current !== 'none') this.currentDuration = 0;
  }

  /** Spawn-pressure multiplier for hostile mobs during an event. */
  hostilityMultiplier(): number {
    const s = this.getState();
    if (s.id === 'none') return 1;
    return 1 + s.strength * (s.id === 'crimson_moon' ? 4 : s.id === 'blood_moon' ? 3 : 2);
  }

  /** Should a full-moon-only creature (werewolf) spawn here? */
  allowFullMoonCreature(): boolean {
    return this.current === 'full_moon' && this.getState().strength > 0.5;
  }

  /** The ambient sky tint for the event (for the atmosphere to lerp to). */
  skyTint(): { r: number; g: number; b: number } | null {
    const s = this.getState();
    if (s.id === 'blood_moon') return { r: 0.55 * s.strength, g: 0.08 * s.strength, b: 0.05 * s.strength };
    if (s.id === 'crimson_moon') return { r: 0.45 * s.strength, g: 0.02 * s.strength, b: 0.18 * s.strength };
    if (s.id === 'full_moon') return { r: 0.12 * s.strength, g: 0.14 * s.strength, b: 0.24 * s.strength };
    return null;
  }
}

/**
 * SpecialEvents — rare, planet-driven world events.
 *
 *   Oris / Chorus Event
 *     Every ~360 Minecraft days the special planet Oris approaches. Strange
 *     things happen: reality rifts tear open, and every ~26 minutes a new
 *     "Chorus" block grows on the ground — an infection of purple/pink/green/
 *     blue/white that spreads across the whole overworld with a blinking
 *     effect. Chorus vines crack the ground and static portals can appear that
 *     send you to the Backrooms dimension. As the moon gets closer the world
 *     gets hotter. Surviving the event grants an achievement.
 *
 *   Psychedelics Moon
 *     A separate rare moon event that turns the whole world psychedelic for
 *     about half a Minecraft day (~35 real minutes). Surviving it grants a
 *     code that unlocks a hidden chest containing a Shard.
 *
 * This module tracks the event lifecycle and exposes the current state so the
 * renderer/sky can tint, spawn chorus blocks, and the HUD can show messages.
 */
export type SpecialEventID = 'none' | 'oris_chorus' | 'psychedelics';

export interface SpecialEventState {
  id: SpecialEventID;
  /** 0-1 ramp/decay strength. */
  strength: number;
  /** Real seconds remaining in the event. */
  remainingSec: number;
  label: string;
  /** Heat 0-1 as the moon approaches (chorus event). */
  heat: number;
  /** True while it's currently the event day (chorus). */
  eventDay: boolean;
}

/** Real seconds per Minecraft day (20-min day/night = 1200s). */
const MC_DAY_S = 1200;
/** Real seconds per Oris cycle (~360 Minecraft days). */
const ORIS_CYCLE_S = MC_DAY_S * 360;
/** Real seconds the chorus event lasts (10-20 min → ~900s). */
const CHORUS_DURATION_S = 900;
/** Every ~26 minutes a new chorus block grows. */
const CHORUS_GROW_INTERVAL_S = 26 * 60;
/** Real seconds the psychedelics moon lasts (~35 min). */
const PSYCHEDELICS_DURATION_S = 35 * 60;

export class SpecialEvents {
  private elapsed = 0;
  private eventStart = -1;
  private current: SpecialEventID = 'none';
  private duration = 0;
  private lastGrowAt = 0;
  private chorusGrown = 0;
  private orisActive = false;
  /** Reached when a chorus block is actually grown (for the achievement). */
  private chorusGrew = false;

  /** How far into the Oris cycle we are (0-1); 1 = event day approaches. */
  getOrisProgress(): number {
    return (this.elapsed % ORIS_CYCLE_S) / ORIS_CYCLE_S;
  }

  isOrisDay(): boolean {
    // The last ~900s of each 360-day cycle is the Oris approach.
    const inCycle = this.elapsed % ORIS_CYCLE_S;
    return inCycle > ORIS_CYCLE_S - CHORUS_DURATION_S - 60;
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;

    if (this.current === 'none') {
      // Start the chorus event on the Oris day.
      if (this.isOrisDay()) {
        this.current = 'oris_chorus';
        this.eventStart = this.elapsed;
        this.duration = CHORUS_DURATION_S;
        this.lastGrowAt = this.elapsed;
        this.chorusGrown = 0;
        this.orisActive = true;
      }
      return;
    }

    const age = this.elapsed - this.eventStart;
    // Grow a new chorus block every interval.
    if (this.current === 'oris_chorus') {
      this.orisActive = true;
      if (this.elapsed - this.lastGrowAt >= CHORUS_GROW_INTERVAL_S) {
        this.lastGrowAt = this.elapsed;
        this.chorusGrown += 1;
        this.chorusGrew = true;
      }
    }

    if (age >= this.duration) {
      this.current = 'none';
      this.orisActive = false;
    }
  }

  /** Trigger a psychedelics moon event (surviving an Oris event unlocks it). */
  startPsychedelics(): void {
    if (this.current !== 'none') return;
    this.current = 'psychedelics';
    this.eventStart = this.elapsed;
    this.duration = PSYCHEDELICS_DURATION_S;
  }

  getState(): SpecialEventState {
    if (this.current === 'none') {
      return {
        id: 'none', strength: 0, remainingSec: 0,
        label: this.isOrisDay() ? 'Oris approaches…' : '',
        heat: this.orisActive ? 0.3 : 0, eventDay: this.isOrisDay(),
      };
    }
    const age = this.elapsed - this.eventStart;
    const remainingSec = Math.max(0, this.duration - age);
    // Strength ramps up over the first 15s and holds.
    const strength = Math.min(1, age / 15);
    if (this.current === 'oris_chorus') {
      // Heat rises as the moon closes in.
      const heat = Math.min(1, 0.4 + (age / this.duration) * 0.6);
      return {
        id: 'oris_chorus', strength, remainingSec, heat, eventDay: true,
        label: 'The Chorus spreads…',
      };
    }
    return {
      id: 'psychedelics', strength, remainingSec, heat: 0, eventDay: false,
      label: 'Psychedelics Moon',
    };
  }

  private lastEmittedGrown = 0;
  /** Pop the count of chorus blocks to place since last check. */
  consumeChorusGrowth(): number {
    const n = this.chorusGrown - this.lastEmittedGrown;
    this.lastEmittedGrown = this.chorusGrown;
    return n;
  }

  getChorusGrew(): boolean { return this.chorusGrew; }
}

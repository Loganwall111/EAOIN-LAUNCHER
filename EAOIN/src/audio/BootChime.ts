/**
 * BootChime — the "doo doo doo doo" logo sting, Mojang-style.
 *
 * Four rising notes, one per letter of the wordmark as it drops in, then a
 * soft pad chord underneath that swells and decays. Built with the WebAudio
 * API so there is no asset to ship and no load delay before it can play.
 *
 * Browsers refuse to start an AudioContext without a user gesture. Rather than
 * failing silently, `play()` reports whether it actually sounded, so the boot
 * screen can show an "unmute" affordance and retry on the first click.
 */

/** The four-note motif, in Hz. A gentle rising major arpeggio. */
const MOTIF: number[] = [
  293.66, // D4
  369.99, // F#4
  440.0,  // A4
  587.33, // D5
];

/** Seconds between note onsets. */
const NOTE_GAP = 0.42;

export interface BootChimeOptions {
  /** 0-1 master volume. */
  volume?: number;
  /** Skip entirely when the player has muted audio. */
  muted?: boolean;
}

export class BootChime {
  private context: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (this.context) return this.context;
    try {
      const Ctor =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.context = new Ctor();
      return this.context;
    } catch {
      return null;
    }
  }

  /**
   * Play the full sting.
   *
   * @returns true if audio actually started, false if the browser blocked it
   *   (in which case the caller should retry after a user gesture).
   */
  play(options: BootChimeOptions = {}): boolean {
    const { volume = 0.5, muted = false } = options;
    if (muted || volume <= 0) return false;

    const ctx = this.getContext();
    if (!ctx) return false;

    // If the context is suspended we have no gesture yet — ask for a resume and
    // report failure so the UI can retry.
    if (ctx.state === 'suspended') {
      void ctx.resume();
      if (ctx.state === 'suspended') return false;
    }

    const now = ctx.currentTime + 0.05;

    // --- The four melody notes -----------------------------------------
    MOTIF.forEach((freq, i) => {
      const at = now + i * NOTE_GAP;
      // Two detuned oscillators per note give it body rather than a pure sine.
      for (const [type, detune, gainScale] of [
        ['sine', 0, 1.0],
        ['triangle', 6, 0.34],
      ] as Array<[OscillatorType, number, number]>) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;

        const peak = 0.22 * volume * gainScale;
        gain.gain.setValueAtTime(0.0001, at);
        // Soft attack, long bell-like decay.
        gain.gain.exponentialRampToValueAtTime(peak, at + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 1.6);
      }
    });

    // --- Warm pad chord underneath --------------------------------------
    const padStart = now + NOTE_GAP;
    const padEnd = padStart + 3.4;
    for (const freq of [146.83, 220.0, 293.66]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, padStart);
      // Opening the filter as the pad swells makes it bloom rather than just fade in.
      filter.frequency.linearRampToValueAtTime(1600, padStart + 1.6);

      gain.gain.setValueAtTime(0.0001, padStart);
      gain.gain.exponentialRampToValueAtTime(0.05 * volume, padStart + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, padEnd);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(padStart);
      osc.stop(padEnd + 0.1);
    }

    return true;
  }

  /** Total length of the sting in ms, so the caller can time the animation. */
  static durationMs(): number {
    return Math.round((MOTIF.length * NOTE_GAP + 1.6) * 1000);
  }

  /** Onset time of note `i`, in ms — used to sync each letter's drop. */
  static noteOnsetMs(index: number): number {
    return Math.round(index * NOTE_GAP * 1000);
  }

  static noteCount(): number {
    return MOTIF.length;
  }

  dispose(): void {
    try {
      void this.context?.close();
    } catch {
      /* context may already be closed */
    }
    this.context = null;
  }
}

export default BootChime;

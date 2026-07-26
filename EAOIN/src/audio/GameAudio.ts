import { GameSettings } from '../settings/GameSettings';

export type AudioCue = 'mine' | 'place' | 'pickup' | 'craft' | 'hit' | 'creature_down' | 'error' | 'ui';

const CUE_FREQUENCIES: Record<AudioCue, [number, number]> = {
  mine: [150, 90],
  place: [260, 180],
  pickup: [520, 780],
  craft: [440, 660],
  hit: [180, 120],
  creature_down: [220, 330],
  error: [90, 70],
  ui: [360, 420],
};

export class GameAudio {
  private context: AudioContext | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  /** Lightweight procedural Minecraft-like music bed; starts only after user input. */
  startMusic(settings: GameSettings, mood: 'menu' | 'overworld' | 'nether' = 'overworld'): void {
    if (settings.muted || this.musicTimer !== null) return;
    const context = this.getContext(); if (!context) return;
    void context.resume();
    const notes = mood === 'nether' ? [110, 130, 146, 98] : mood === 'menu' ? [220, 277, 330, 440, 330, 277] : [196, 247, 294, 370, 294, 247];
    const play = () => {
      if (settings.muted || settings.volume <= 0) return;
      const osc = context.createOscillator(); const gain = context.createGain(); const now = context.currentTime;
      osc.type = 'sine'; osc.frequency.value = notes[this.musicStep++ % notes.length];
      gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.035 * settings.volume, now + .08); gain.gain.exponentialRampToValueAtTime(.0001, now + 2.4);
      osc.connect(gain); gain.connect(context.destination); osc.start(now); osc.stop(now + 2.5);
    };
    play(); this.musicTimer = window.setInterval(play, 2600);
  }

  stopMusic(): void { if (this.musicTimer !== null) { window.clearInterval(this.musicTimer); this.musicTimer = null; } }

  play(cue: AudioCue, settings: GameSettings): void {
    if (settings.muted || settings.volume <= 0) return;
    const context = this.getContext();
    if (!context) return;

    const [startFrequency, endFrequency] = CUE_FREQUENCIES[cue];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const duration = cue === 'craft' || cue === 'creature_down' ? 0.18 : 0.11;

    oscillator.type = cue === 'error' ? 'sawtooth' : 'square';
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08 * settings.volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private getContext(): AudioContext | null {
    if (this.context) return this.context;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    this.context = new AudioContextClass();
    return this.context;
  }
}

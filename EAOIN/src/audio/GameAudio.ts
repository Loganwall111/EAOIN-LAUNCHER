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
  private ambienceTimer: number | null = null;
  private ambienceProfile = 'forest';

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

  /** Biome-aware ambience bed: sparse wind, water, birds, caves and dimension tones. */
  startAmbience(settings: GameSettings, profile: string): void {
    this.ambienceProfile = profile;
    if (settings.muted || this.ambienceTimer !== null) return;
    const context = this.getContext(); if (!context) return;
    void context.resume();
    const playCue = () => {
      if (settings.muted || settings.volume <= 0) return;
      const roots: Record<string, number> = { forest: 620, plains: 480, desert: 260, snowy: 360, ocean: 190, cave: 90, nether: 120, end: 70, alien: 140 };
      const root = roots[this.ambienceProfile] ?? roots.forest;
      const osc = context.createOscillator(); const gain = context.createGain(); const now = context.currentTime;
      osc.type = this.ambienceProfile === 'nether' || this.ambienceProfile === 'cave' ? 'sawtooth' : 'sine';
      osc.frequency.value = root + Math.random() * root * .22;
      gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.012 * settings.volume, now + .2); gain.gain.exponentialRampToValueAtTime(.0001, now + 3.5);
      osc.connect(gain); gain.connect(context.destination); osc.start(now); osc.stop(now + 3.6);
    };
    playCue(); this.ambienceTimer = window.setInterval(playCue, 4200);
  }

  stopMusic(): void { if (this.musicTimer !== null) { window.clearInterval(this.musicTimer); this.musicTimer = null; } if (this.ambienceTimer !== null) { window.clearInterval(this.ambienceTimer); this.ambienceTimer = null; } }

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

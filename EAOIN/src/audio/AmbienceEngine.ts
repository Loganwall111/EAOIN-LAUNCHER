/**
 * AmbienceEngine — "Life Comes Apart 2.0" biome soundscapes.
 *
 * The old ambience was a single sine beep on a 4-second timer, identical
 * everywhere but for its pitch. This is a layered procedural soundscape:
 *
 *   BED       a continuous filtered-noise or drone bed (wind, water, hum)
 *   MOVEMENT  a slow LFO sweeping the bed's filter so it breathes
 *   EVENTS    sparse one-shots — birdsong, drips, creaks, distant calls
 *
 * Every biome, dimension and the main menu get their own layer recipe, and
 * crossfading between them takes a couple of seconds so walking between biomes
 * never cuts the audio.
 *
 * Everything is synthesised with WebAudio — no assets, no load time, and the
 * whole graph is torn down cleanly on dispose.
 */

export type AmbienceProfileID =
  | 'menu'
  | 'forest'
  | 'plains'
  | 'desert'
  | 'swamp'
  | 'mountain'
  | 'snow'
  | 'ocean'
  | 'underwater'
  | 'cave'
  | 'deep_cave'
  | 'jungle'
  | 'nether'
  | 'end'
  | 'space'
  | 'volcanic'
  | 'mushroom'
  | 'spooky'
  | 'machine'
  | 'dream';

/** A sparse one-shot event layered over the bed. */
interface AmbienceEvent {
  /** Mean seconds between occurrences. */
  everySeconds: number;
  /** Base frequency in Hz. */
  freq: number;
  /** Random spread applied to freq, as a fraction. */
  spread: number;
  /** Note length in seconds. */
  duration: number;
  type: OscillatorType;
  gain: number;
  /** Sweep the pitch over the note, as a multiplier of freq. */
  glide?: number;
}

interface AmbienceProfile {
  id: AmbienceProfileID;
  name: string;
  /** Filtered-noise bed: 'none' disables it. */
  bed: 'none' | 'wind' | 'water' | 'rumble' | 'hiss';
  /** Cutoff of the bed's lowpass filter, Hz. */
  bedCutoff: number;
  bedGain: number;
  /** Continuous tonal drone. 0 disables. */
  droneFreq: number;
  droneGain: number;
  droneType: OscillatorType;
  /** Sparse one-shots. */
  events: AmbienceEvent[];
}

/* Reusable event recipes. */
const BIRD: AmbienceEvent = { everySeconds: 7, freq: 1900, spread: 0.35, duration: 0.13, type: 'sine', gain: 0.05, glide: 1.5 };
const CRICKET: AmbienceEvent = { everySeconds: 3.2, freq: 2600, spread: 0.1, duration: 0.05, type: 'square', gain: 0.016 };
const DRIP: AmbienceEvent = { everySeconds: 6, freq: 900, spread: 0.5, duration: 0.16, type: 'sine', gain: 0.05, glide: 0.35 };
const CREAK: AmbienceEvent = { everySeconds: 13, freq: 150, spread: 0.5, duration: 0.9, type: 'sawtooth', gain: 0.022, glide: 0.7 };
const FROG: AmbienceEvent = { everySeconds: 5.5, freq: 260, spread: 0.3, duration: 0.2, type: 'triangle', gain: 0.045, glide: 0.8 };
const GULL: AmbienceEvent = { everySeconds: 9, freq: 1300, spread: 0.3, duration: 0.3, type: 'sawtooth', gain: 0.03, glide: 0.6 };
const DISTANT_ROAR: AmbienceEvent = { everySeconds: 26, freq: 62, spread: 0.35, duration: 2.6, type: 'sine', gain: 0.07, glide: 0.75 };
const WHALE: AmbienceEvent = { everySeconds: 20, freq: 110, spread: 0.4, duration: 3.2, type: 'sine', gain: 0.06, glide: 1.6 };
const CHIME: AmbienceEvent = { everySeconds: 11, freq: 1050, spread: 0.6, duration: 1.4, type: 'sine', gain: 0.035, glide: 1.02 };
const CLANK: AmbienceEvent = { everySeconds: 8, freq: 340, spread: 0.7, duration: 0.1, type: 'square', gain: 0.028 };

const PROFILES: Record<AmbienceProfileID, AmbienceProfile> = {
  menu: {
    id: 'menu', name: 'Main Menu',
    bed: 'wind', bedCutoff: 420, bedGain: 0.026,
    droneFreq: 110, droneGain: 0.030, droneType: 'sine',
    events: [CHIME, { ...BIRD, everySeconds: 12, gain: 0.028 }],
  },
  forest: {
    id: 'forest', name: 'Forest',
    bed: 'wind', bedCutoff: 700, bedGain: 0.032,
    droneFreq: 0, droneGain: 0, droneType: 'sine',
    events: [BIRD, { ...CRICKET, everySeconds: 5 }, CREAK],
  },
  plains: {
    id: 'plains', name: 'Plains',
    bed: 'wind', bedCutoff: 900, bedGain: 0.038,
    droneFreq: 0, droneGain: 0, droneType: 'sine',
    events: [{ ...BIRD, everySeconds: 9 }, CRICKET],
  },
  desert: {
    id: 'desert', name: 'Desert',
    // Dry, wide, almost nothing alive.
    bed: 'hiss', bedCutoff: 1600, bedGain: 0.040,
    droneFreq: 58, droneGain: 0.016, droneType: 'sine',
    events: [{ ...CREAK, everySeconds: 22, gain: 0.012 }],
  },
  swamp: {
    id: 'swamp', name: 'Swamp',
    bed: 'water', bedCutoff: 380, bedGain: 0.030,
    droneFreq: 74, droneGain: 0.022, droneType: 'triangle',
    events: [FROG, { ...CRICKET, everySeconds: 2.4 }, { ...DRIP, everySeconds: 8 }],
  },
  mountain: {
    id: 'mountain', name: 'Mountains',
    bed: 'wind', bedCutoff: 1400, bedGain: 0.052,
    droneFreq: 0, droneGain: 0, droneType: 'sine',
    events: [{ ...GULL, everySeconds: 16, freq: 1500 }],
  },
  snow: {
    id: 'snow', name: 'Snowfield',
    bed: 'wind', bedCutoff: 1800, bedGain: 0.048,
    droneFreq: 92, droneGain: 0.014, droneType: 'sine',
    events: [{ ...CREAK, everySeconds: 18, freq: 210, gain: 0.014 }],
  },
  ocean: {
    id: 'ocean', name: 'Ocean Surface',
    bed: 'water', bedCutoff: 620, bedGain: 0.056,
    droneFreq: 0, droneGain: 0, droneType: 'sine',
    events: [GULL],
  },
  underwater: {
    id: 'underwater', name: 'Underwater',
    // Everything muffled; a low pressure hum and distant calls.
    bed: 'rumble', bedCutoff: 180, bedGain: 0.050,
    droneFreq: 48, droneGain: 0.038, droneType: 'sine',
    events: [WHALE, { ...DRIP, everySeconds: 9, freq: 420 }],
  },
  cave: {
    id: 'cave', name: 'Caves',
    bed: 'rumble', bedCutoff: 240, bedGain: 0.030,
    droneFreq: 44, droneGain: 0.026, droneType: 'sine',
    events: [DRIP, { ...CREAK, everySeconds: 17 }],
  },
  deep_cave: {
    id: 'deep_cave', name: 'Deep Caverns',
    bed: 'rumble', bedCutoff: 150, bedGain: 0.042,
    droneFreq: 34, droneGain: 0.040, droneType: 'sine',
    events: [{ ...DRIP, everySeconds: 4 }, DISTANT_ROAR],
  },
  jungle: {
    id: 'jungle', name: 'Jungle',
    bed: 'wind', bedCutoff: 560, bedGain: 0.030,
    droneFreq: 0, droneGain: 0, droneType: 'sine',
    events: [{ ...BIRD, everySeconds: 3.4, freq: 2300 }, { ...CRICKET, everySeconds: 1.8 }, FROG],
  },
  nether: {
    id: 'nether', name: 'The Nether',
    bed: 'rumble', bedCutoff: 320, bedGain: 0.048,
    droneFreq: 55, droneGain: 0.044, droneType: 'sawtooth',
    events: [DISTANT_ROAR, { ...CLANK, everySeconds: 14, freq: 180 }],
  },
  end: {
    id: 'end', name: 'The End',
    bed: 'none', bedCutoff: 0, bedGain: 0,
    droneFreq: 38, droneGain: 0.046, droneType: 'sine',
    events: [{ ...CHIME, everySeconds: 8, freq: 620, gain: 0.030 }],
  },
  space: {
    id: 'space', name: 'Space',
    bed: 'none', bedCutoff: 0, bedGain: 0,
    droneFreq: 30, droneGain: 0.034, droneType: 'sine',
    events: [{ ...CHIME, everySeconds: 14, freq: 1400, gain: 0.020 }],
  },
  volcanic: {
    id: 'volcanic', name: 'Volcanic',
    bed: 'rumble', bedCutoff: 260, bedGain: 0.056,
    droneFreq: 46, droneGain: 0.036, droneType: 'sawtooth',
    events: [{ ...CLANK, everySeconds: 6, freq: 120, gain: 0.034 }, DISTANT_ROAR],
  },
  mushroom: {
    id: 'mushroom', name: 'Mushroom Fields',
    bed: 'hiss', bedCutoff: 500, bedGain: 0.022,
    droneFreq: 138, droneGain: 0.030, droneType: 'triangle',
    events: [{ ...CHIME, everySeconds: 6, freq: 780, gain: 0.026 }],
  },
  spooky: {
    id: 'spooky', name: 'Haunted',
    bed: 'wind', bedCutoff: 380, bedGain: 0.036,
    droneFreq: 51, droneGain: 0.030, droneType: 'sawtooth',
    events: [CREAK, { ...CHIME, everySeconds: 17, freq: 430, gain: 0.024 }],
  },
  machine: {
    id: 'machine', name: 'Machine Dimension',
    bed: 'hiss', bedCutoff: 2200, bedGain: 0.026,
    droneFreq: 60, droneGain: 0.038, droneType: 'square',
    events: [{ ...CLANK, everySeconds: 2.6 }],
  },
  dream: {
    id: 'dream', name: 'Dream Realm',
    bed: 'wind', bedCutoff: 300, bedGain: 0.020,
    droneFreq: 220, droneGain: 0.028, droneType: 'sine',
    events: [{ ...CHIME, everySeconds: 4.5, freq: 1320, gain: 0.030 }],
  },
};

/** Live WebAudio nodes for one active layer. */
interface ActiveLayer {
  profile: AmbienceProfile;
  gain: GainNode;
  bedSource: AudioBufferSourceNode | null;
  bedFilter: BiquadFilterNode | null;
  lfo: OscillatorNode | null;
  drone: OscillatorNode | null;
  droneGain: GainNode | null;
  /** Seconds until each event next fires. */
  eventTimers: number[];
}

export class AmbienceEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private current: ActiveLayer | null = null;
  private outgoing: ActiveLayer | null = null;
  private volume = 0.5;
  private muted = false;
  private disposed = false;

  /** Crossfade length between profiles, seconds. */
  private static readonly FADE = 2.0;

  private getContext(): AudioContext | null {
    if (this.disposed) return null;
    if (this.context) return this.context;
    try {
      const Ctor =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.context.destination);
      return this.context;
    } catch {
      return null;
    }
  }

  /** Two seconds of looping white noise, reused by every bed. */
  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  setVolume(volume: number, muted: boolean): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.context.currentTime, 0.15);
    }
  }

  /** Switch to a profile, crossfading from whatever is playing. */
  play(id: AmbienceProfileID): void {
    if (this.disposed) return;
    if (this.current?.profile.id === id) return;

    const ctx = this.getContext();
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') void ctx.resume();

    // Fade out whatever is currently playing.
    if (this.current) {
      this.fadeOutAndStop(this.current, ctx);
      this.outgoing = this.current;
    }

    this.current = this.buildLayer(PROFILES[id] ?? PROFILES.forest, ctx, this.master);
  }

  private buildLayer(profile: AmbienceProfile, ctx: AudioContext, dest: GainNode): ActiveLayer {
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(1, now + AmbienceEngine.FADE);
    gain.connect(dest);

    let bedSource: AudioBufferSourceNode | null = null;
    let bedFilter: BiquadFilterNode | null = null;
    let lfo: OscillatorNode | null = null;

    if (profile.bed !== 'none' && profile.bedGain > 0) {
      bedSource = ctx.createBufferSource();
      bedSource.buffer = this.getNoiseBuffer(ctx);
      bedSource.loop = true;

      bedFilter = ctx.createBiquadFilter();
      // 'rumble' is a lowpass roar; 'hiss' is a bandpass whisper; the rest sit between.
      bedFilter.type = profile.bed === 'hiss' ? 'bandpass' : 'lowpass';
      bedFilter.frequency.value = profile.bedCutoff;
      bedFilter.Q.value = profile.bed === 'hiss' ? 0.7 : 1.0;

      const bedGain = ctx.createGain();
      bedGain.gain.value = profile.bedGain;

      // Slow LFO on the cutoff so the bed breathes instead of sitting static.
      lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.06 + Math.random() * 0.05;
      lfoGain.gain.value = profile.bedCutoff * 0.35;
      lfo.connect(lfoGain);
      lfoGain.connect(bedFilter.frequency);
      lfo.start(now);

      bedSource.connect(bedFilter);
      bedFilter.connect(bedGain);
      bedGain.connect(gain);
      bedSource.start(now);
    }

    let drone: OscillatorNode | null = null;
    let droneGain: GainNode | null = null;
    if (profile.droneFreq > 0 && profile.droneGain > 0) {
      drone = ctx.createOscillator();
      drone.type = profile.droneType;
      drone.frequency.value = profile.droneFreq;
      droneGain = ctx.createGain();
      droneGain.gain.value = profile.droneGain;
      drone.connect(droneGain);
      droneGain.connect(gain);
      drone.start(now);
    }

    return {
      profile,
      gain,
      bedSource,
      bedFilter,
      lfo,
      drone,
      droneGain,
      // Stagger the first fire of each event so they don't all hit at once.
      eventTimers: profile.events.map((e) => Math.random() * e.everySeconds),
    };
  }

  private fadeOutAndStop(layer: ActiveLayer, ctx: AudioContext): void {
    const now = ctx.currentTime;
    layer.gain.gain.cancelScheduledValues(now);
    layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
    layer.gain.gain.linearRampToValueAtTime(0.0001, now + AmbienceEngine.FADE);

    const stopAt = now + AmbienceEngine.FADE + 0.1;
    try {
      layer.bedSource?.stop(stopAt);
      layer.lfo?.stop(stopAt);
      layer.drone?.stop(stopAt);
    } catch {
      /* already stopped */
    }
    window.setTimeout(() => {
      try {
        layer.gain.disconnect();
      } catch {
        /* already disconnected */
      }
      if (this.outgoing === layer) this.outgoing = null;
    }, (AmbienceEngine.FADE + 0.3) * 1000);
  }

  /** Drive the sparse one-shot events. Call once per frame. */
  update(deltaSeconds: number): void {
    const layer = this.current;
    const ctx = this.context;
    if (!layer || !ctx || this.muted || this.volume <= 0) return;

    layer.profile.events.forEach((event, i) => {
      layer.eventTimers[i] -= deltaSeconds;
      if (layer.eventTimers[i] > 0) return;
      // Randomise the gap by ±50% so events never fall into a rhythm.
      layer.eventTimers[i] = event.everySeconds * (0.5 + Math.random());
      this.fireEvent(event, ctx, layer.gain);
    });
  }

  private fireEvent(event: AmbienceEvent, ctx: AudioContext, dest: GainNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const freq = event.freq * (1 + (Math.random() - 0.5) * 2 * event.spread);
    osc.type = event.type;
    osc.frequency.setValueAtTime(freq, now);
    if (event.glide && event.glide !== 1) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freq * event.glide),
        now + event.duration
      );
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, event.gain), now + event.duration * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + event.duration);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + event.duration + 0.05);
  }

  getCurrentProfile(): AmbienceProfileID | null {
    return this.current?.profile.id ?? null;
  }

  stop(): void {
    if (this.current && this.context) {
      this.fadeOutAndStop(this.current, this.context);
      this.current = null;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    try {
      void this.context?.close();
    } catch {
      /* already closed */
    }
    this.context = null;
    this.master = null;
  }
}

/**
 * Map a biome/dimension id onto an ambience profile.
 *
 * Substring matching so all 150+ biome ids and 27 dimension ids resolve
 * without an exhaustive table.
 */
export function ambienceForBiome(
  biomeId: string,
  options: { underwater?: boolean; depth?: number } = {}
): AmbienceProfileID {
  if (options.underwater) return 'underwater';

  const key = biomeId.toLowerCase();
  if (/nether|crimson|warped|soul/.test(key)) return 'nether';
  if (/end|void|chorus/.test(key)) return 'end';
  if (/moon|space|cosmic|gas_giant|astral|asteroid/.test(key)) return 'space';
  if (/volcan|lava|magma|basalt|sun_biome|solar/.test(key)) return 'volcanic';
  if (/mushroom|fungal|spore/.test(key)) return 'mushroom';
  if (/haunt|spooky|undead|shadow|ghost/.test(key)) return 'spooky';
  if (/machine|mechan|factory|circuit/.test(key)) return 'machine';
  if (/dream|astral/.test(key)) return 'dream';
  if (/deep_cave|deepslate|abyss|trench/.test(key)) return 'deep_cave';
  if (/cave|cavern|grotto|underground/.test(key)) return 'cave';
  if (/swamp|mangrove|marsh|bog/.test(key)) return 'swamp';
  if (/jungle|rainforest|bamboo/.test(key)) return 'jungle';
  if (/desert|badlands|dune|savanna|canyon|mesa/.test(key)) return 'desert';
  if (/snow|ice|frozen|tundra|arctic|glacier/.test(key)) return 'snow';
  if (/mountain|alpine|highland|peak|windswept|cliff/.test(key)) return 'mountain';
  if (/ocean|sea|beach|coral|lake|river|shore/.test(key)) return 'ocean';
  if (/forest|taiga|woods|redwood|grove|cherry|autumn|maple/.test(key)) return 'forest';
  return 'plains';
}

export const ALL_AMBIENCE_PROFILES = Object.values(PROFILES).map((p) => ({ id: p.id, name: p.name }));

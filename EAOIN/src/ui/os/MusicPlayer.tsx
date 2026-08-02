/**
 * HorizonOS Music Player — a built-in, synthesized music player.
 *
 * No audio files: each track is a small ambient loop generated live with the
 * WebAudio API (oscillator arpeggios + a soft pad). Includes play/pause, next /
 * previous, volume, a progress bar and a live EQ visualizer.
 */
import { useEffect, useRef, useState } from 'react';

interface Track {
  id: string;
  title: string;
  artist: string;
  emoji: string;
  /** Base pitch for the arpeggio loop, in midi-ish half-steps. */
  root: number;
  /** Note pattern (semitone offsets), looped. */
  pattern: number[];
  tempo: number; // beats per second
}

const TRACKS: Track[] = [
  { id: 'cosmic-drift', title: 'Cosmic Drift', artist: 'Onblockaway', emoji: '🌌', root: 57, pattern: [0, 4, 7, 12, 7, 4, 7, 11], tempo: 0.9 },
  { id: 'nebula-sunrise', title: 'Nebula Sunrise', artist: 'Onblockaway', emoji: '🌅', root: 55, pattern: [0, 3, 7, 10, 12, 10, 7, 3], tempo: 0.8 },
  { id: 'ember-hollows', title: 'Ember Hollows', artist: 'The Forge Choir', emoji: '🔥', root: 50, pattern: [0, 1, 3, 5, 7, 5, 3, 1], tempo: 0.7 },
  { id: 'humorous-jingle', title: 'The Humorous Jingle', artist: 'Giggle Records', emoji: '🍄', root: 60, pattern: [0, 7, 0, 7, 4, 7, 11, 7], tempo: 1.4 },
];

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export default function MusicPlayer() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [playing, setPlaying] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [progress, setProgress] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 24 }, () => 0.2));
  const masterRef = useRef<GainNode | null>(null);
  const stepRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const playingRef = useRef(false);

  const track = TRACKS[trackIndex];

  useEffect(() => () => { stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ensureContext = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      ctxRef.current = new AC();
      masterRef.current = ctxRef.current.createGain();
      masterRef.current.gain.value = volume;
      masterRef.current.connect(ctxRef.current.destination);
    }
    return ctxRef.current;
  };

  const playStep = (step: number, when: number) => {
    const ctx = ctxRef.current;
    if (!ctx || !masterRef.current) return;
    const t = track;
    const note = t.pattern[step % t.pattern.length];
    const freq = midiToFreq(t.root + note);
    // Pluck voice.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.16, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + t.tempo * 1.1);
    osc.connect(g);
    g.connect(masterRef.current);
    osc.start(when);
    osc.stop(when + t.tempo * 1.2);
    // Soft octave pad.
    const pad = ctx.createOscillator();
    pad.type = 'triangle';
    pad.frequency.value = freq / 2;
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(0.0001, when);
    pg.gain.linearRampToValueAtTime(0.05, when + 0.3);
    pg.gain.linearRampToValueAtTime(0.0001, when + t.tempo * 1.0);
    pad.connect(pg);
    pg.connect(masterRef.current);
    pad.start(when);
    pad.stop(when + t.tempo * 1.1);
  };

  const schedule = () => {
    const ctx = ctxRef.current;
    if (!ctx || !playingRef.current) return;
    const t = track;
    const beatMs = (60 / t.tempo) * 1000;
    const now = ctx.currentTime;
    while (stepRef.current * beatMs / 1000 < ctx.currentTime - now + 0.15) {
      playStep(stepRef.current, ctx.currentTime + (stepRef.current * beatMs) / 1000);
      stepRef.current += 1;
    }
    timerRef.current = window.setTimeout(schedule, 80);
  };

  const toggle = () => {
    const ctx = ensureContext();
    void ctx.resume();
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    playingRef.current = true;
    setPlaying(true);
    schedule();
    // Animated EQ bars.
    let raf = 0;
    const eq = () => {
      setBars(() => Array.from({ length: 24 }, () => playingRef.current ? 0.15 + Math.random() * 0.85 : 0.1));
      raf = requestAnimationFrame(eq);
    };
    eq();
    window.setTimeout(() => { cancelAnimationFrame(raf); }, 5000); // brief visualizer
  };

  const next = () => {
    stepRef.current = 0;
    setTrackIndex((i) => (i + 1) % TRACKS.length);
    setProgress(0);
    if (playingRef.current) { if (timerRef.current) clearTimeout(timerRef.current); schedule(); }
  };
  const prev = () => {
    stepRef.current = 0;
    setTrackIndex((i) => (i - 1 + TRACKS.length) % TRACKS.length);
    setProgress(0);
    if (playingRef.current) { if (timerRef.current) clearTimeout(timerRef.current); schedule(); }
  };

  useEffect(() => {
    if (!playing) { setBars(Array.from({ length: 24 }, () => 0.1)); return; }
    let p = 0;
    const iv = window.setInterval(() => {
      p = (p + 1) % 100;
      setProgress(p);
    }, 260);
    return () => clearInterval(iv);
  }, [playing, trackIndex]);

  const stop = () => { playingRef.current = false; setPlaying(false); if (timerRef.current) clearTimeout(timerRef.current); void ctxRef.current?.close(); ctxRef.current = null; };

  return (
    <div className="music-player">
      <div className="mp-track-art">
        <span className="mp-art-emoji">{track.emoji}</span>
      </div>
      <div className="mp-track-info">
        <strong>{track.title}</strong>
        <span>{track.artist}</span>
      </div>

      <div className="mp-eq" aria-hidden="true">
        {bars.map((b, i) => (
          <span key={i} style={{ height: `${Math.max(6, b * 46)}px`, opacity: playing ? 1 : 0.35 }} />
        ))}
      </div>

      <div className="mp-progress">
        <div className="mp-progress-track"><span style={{ width: `${progress}%` }} /></div>
      </div>

      <div className="mp-controls">
        <button className="mp-btn" onClick={prev}>⏮</button>
        <button className={`mp-btn play ${playing ? 'on' : ''}`} onClick={toggle}>{playing ? '⏸' : '▶'}</button>
        <button className="mp-btn" onClick={next}>⏭</button>
      </div>

      <div className="mp-volume">
        <span>🔊</span>
        <input type="range" min={0} max={1} step={0.01} value={volume}
          onChange={(e) => { const v = Number(e.target.value); setVolume(v); if (masterRef.current) masterRef.current.gain.value = v; }} />
      </div>

      <div className="mp-tracklist">
        {TRACKS.map((t, i) => (
          <button key={t.id} className={`mp-track-row ${i === trackIndex ? 'active' : ''}`} onClick={() => setTrackIndex(i)}>
            <span>{t.emoji}</span> {t.title}
          </button>
        ))}
      </div>
    </div>
  );
}

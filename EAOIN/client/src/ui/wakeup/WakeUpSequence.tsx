import { useEffect, useState } from 'react';
import CosmicGirlFigure from './CosmicGirlFigure';

interface WakeUpSequenceProps {
  onComplete: () => void;
}

const DREAM_LINES = [
  "Hello… it’s been a long time.",
  "It’s been a while, huh?",
  "Well, maybe someday I can come to see you…",
  "But for now, the world is counting on you.",
  "It’s time for you to wake up.",
  "Oh, and remember… everything is wired together.",
  "It’s the world we live in."
];

/** Pre-rendered realistic narrator clip served from the site's public path. */
const COSMIC_GIRL_AUDIO = `${import.meta.env.BASE_URL}audio/cosmic_girl.mp3`;

export default function WakeUpSequence({ onComplete }: WakeUpSequenceProps) {
  const [phase, setPhase] = useState<'GALAXIES' | 'DREAM' | 'TITLE' | 'WAKE' | 'DONE'>('GALAXIES');
  const [dreamLineIndex, setDreamLineIndex] = useState(0);
  const [showTitle, setShowTitle] = useState(false);
  const [wakeProgress, setWakeProgress] = useState(0);
  /** Real audio-driven mouth openness (0 = closed … 1 = wide) from the analyser. */
  const [mouth, setMouth] = useState(0);

  // Galaxy rush + neuron loading cinematic
  useEffect(() => {
    if (phase !== 'GALAXIES') return;

    const galaxyTimer = setTimeout(() => {
      setPhase('DREAM');
    }, 6200);

    return () => clearTimeout(galaxyTimer);
  }, [phase]);

  // Cosmic Girl narration — a single realistic pre-rendered voice clip plays
  // the whole monologue, and the on-screen line advances in time with it. The
  // mouth is driven by the *real* audio: an AnalyserNode reads the amplitude
  // of the clip and opens the lips in sync with her voice (no fake CSS timer).
  useEffect(() => {
    if (phase !== 'DREAM') return;
    setDreamLineIndex(0);
    setMouth(0);

    const audio = new Audio(COSMIC_GIRL_AUDIO);
    audio.volume = 0.9;
    const started = window.setTimeout(() => void audio.play().catch(() => {}), 400);

    // ---- Real lipsync: route the clip through an AnalyserNode ----
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let raf = 0;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new AC();
      const source = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(data);
        // Average the voice band (skip the very lowest rumble) for an open/close value.
        const end = Math.floor(data.length * 0.55);
        let sum = 0;
        for (let i = 4; i < end; i += 1) sum += data[i];
        const avg = sum / (end - 4);
        setMouth(Math.min(1, avg / 70));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch { /* audio analysis unavailable — mouth stays closed */ }

    let index = 0;
    setDreamLineIndex(0);
    // Line cadence roughly matches the clip pacing (all seven lines, ~4s each
    // over a ~26s clip). Falls back gracefully if the audio can't load.
    const interval = window.setInterval(() => {
      index += 1;
      setDreamLineIndex(index);
      if (index >= DREAM_LINES.length) {
        window.clearInterval(interval);
        window.setTimeout(() => setPhase('TITLE'), 1400);
      }
    }, 3600);

    return () => {
      window.clearTimeout(started);
      window.clearInterval(interval);
      cancelAnimationFrame(raf);
      audio.pause();
      void ctx?.close();
    };
  }, [phase]);

  // Game title reveal
  useEffect(() => {
    if (phase !== 'TITLE') return;
    const titleTimer = setTimeout(() => {
      setShowTitle(true);
      setTimeout(() => setPhase('WAKE'), 2600);
    }, 800);
    return () => clearTimeout(titleTimer);
  }, [phase]);

  // Wake up animation (pulling hands from ground)
  useEffect(() => {
    if (phase !== 'WAKE') return;

    let progress = 0;
    const wakeInterval = setInterval(() => {
      progress += 4;
      setWakeProgress(Math.min(progress, 100));

      if (progress >= 100) {
        clearInterval(wakeInterval);
        setTimeout(() => {
          setPhase('DONE');
          onComplete();
        }, 900);
      }
    }, 80);

    return () => clearInterval(wakeInterval);
  }, [phase]); // intentionally omit onComplete to prevent restart loop

  if (phase === 'DONE') return null;

  return (
    <div className="wakeup-cinematic">
      {/* Galaxy rush loading cinematic */}
      {phase === 'GALAXIES' && (
        <div className="galaxy-rush">
          <div className="stars" />
          <div className="galaxies" />
          <div className="whispers">Whispers from the mind…</div>
          <div className="neuron-field" />
          <div className="loading-text">SYNCHRONIZING WITH THE WORLD…</div>
          {/* Purple loading bar, parked at the very bottom of the frame. */}
          <div className="aaa-loading-bar">
            <div className="bar-fill" style={{ width: '100%' }} />
          </div>
          {/* White flash-bang just before the girl begins to speak. */}
          <div className="galaxy-flash" aria-hidden="true" />
        </div>
      )}

      {/* Dream sequence with the animated Cosmic Girl looking right at you. */}
      {phase === 'DREAM' && (
        <div className="dream-sequence">
          <div className="cosmic-girl-wrap">
            <CosmicGirlFigure mouth={mouth} />
          </div>
          <div className="dream-text">
            {DREAM_LINES[dreamLineIndex]}
          </div>
          <div className="dream-subtitle">The Cosmic Girl</div>
        </div>
      )}

      {/* Game Title Reveal */}
      {phase === 'TITLE' && (
        <div className="title-reveal">
          <div className={`eaoin-title ${showTitle ? 'visible' : ''}`}>
            EAOIN
          </div>
          <div className="tagline">THIS WORLD AWAITS</div>
        </div>
      )}

      {/* Wake Up Sequence - First Person Hands */}
      {phase === 'WAKE' && (
        <div className="wake-up-scene">
          <div className="ground" />
          <div className="player-hands" style={{ transform: `translateY(${100 - wakeProgress}%)` }}>
            <div className="hand left" />
            <div className="hand right" />
          </div>
          <div className="horizon" />
          <div className="wake-text">You wake up…</div>
        </div>
      )}
    </div>
  );
}

/**
 * CinematicBoot — AAA-style boot sequence shown once on first game launch.
 *
 * Phase 1: "ONBLOCKAWAY STUDIOS" with orbiting particles (2.8s)
 * Phase 2: Loading bar filling up with tips (3.2s)
 * Phase 3: "PRESENTS" text (1.2s)
 * Phase 4: Game title "EAOIN" fades in (2s)
 * Phase 5: Calls onComplete to hand off to the title screen
 */
import { useEffect, useState, useRef } from 'react';

interface CinematicBootProps {
  onComplete: () => void;
}

type BootPhase = 'STUDIO' | 'LOADING' | 'PRESENTS' | 'TITLE' | 'DONE';

const LOADING_TIPS = [
  'Initializing voxel engine…',
  'Compiling shaders…',
  'Loading terrain generator…',
  'Preparing chunk streaming…',
  'Warming up PBR pipeline…',
  'Building heightmap…',
  'Carving caves and mountains…',
  'Setting up lighting…',
  'Spawning clouds…',
  'Calibrating physics…',
  'Ready!',
];

export default function CinematicBoot({ onComplete }: CinematicBootProps) {
  const [phase, setPhase] = useState<BootPhase>('STUDIO');
  const [loadProgress, setLoadProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const tipRef = useRef<number | null>(null);

  // Phase 1: STUDIO intro — auto-advance after 2.8s
  useEffect(() => {
    if (phase !== 'STUDIO') return;
    const t = window.setTimeout(() => {
      setPhase('LOADING');
      setLoadProgress(0);
    }, 2800);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Phase 2: LOADING — fill the bar over ~3.2s
  useEffect(() => {
    if (phase !== 'LOADING') return;
    let p = 0;
    intervalRef.current = window.setInterval(() => {
      p += Math.random() * 10 + 4;
      if (p >= 100) {
        p = 100;
        setLoadProgress(100);
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        window.setTimeout(() => setPhase('PRESENTS'), 350);
      } else {
        setLoadProgress(p);
      }
    }, 100);

    tipRef.current = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % LOADING_TIPS.length);
    }, 300);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (tipRef.current) window.clearInterval(tipRef.current);
    };
  }, [phase]);

  // Phase 3: PRESENTS — auto-advance after 1.2s
  useEffect(() => {
    if (phase !== 'PRESENTS') return;
    const t = window.setTimeout(() => setPhase('TITLE'), 1200);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Phase 4: TITLE — auto-advance after 2.2s
  useEffect(() => {
    if (phase !== 'TITLE') return;
    const t = window.setTimeout(() => {
      setPhase('DONE');
      onComplete();
    }, 2200);
    return () => window.clearTimeout(t);
  }, [phase, onComplete]);

  // ====== STUDIO PHASE ======
  if (phase === 'STUDIO') {
    return (
      <div className="cinematic-boot cinematic-studio">
        <div className="cb-orbit-ring">
          <span /><span /><span /><span />
        </div>
        <div className="cb-studio-name">ONBLOCKAWAY</div>
        <div className="cb-studio-sub">STUDIOS</div>
      </div>
    );
  }

  // ====== LOADING PHASE ======
  if (phase === 'LOADING') {
    return (
      <div className="cinematic-boot cinematic-loading">
        <div className="cb-loading-logo">EAOIN</div>
        <div className="cb-loading-bar-track">
          <div className="cb-loading-bar-fill" style={{ width: `${loadProgress}%` }} />
        </div>
        <div className="cb-loading-tip">{LOADING_TIPS[tipIndex]}</div>
        <div className="cb-loading-pct">{Math.round(loadProgress)}%</div>
      </div>
    );
  }

  // ====== PRESENTS PHASE ======
  if (phase === 'PRESENTS') {
    return (
      <div className="cinematic-boot cinematic-presents">
        <div className="cb-presents-text">PRESENTS</div>
      </div>
    );
  }

  // ====== TITLE PHASE ======
  if (phase === 'TITLE') {
    return (
      <div className="cinematic-boot cinematic-title">
        <h1 className="cb-game-title">EAOIN</h1>
        <div className="cb-game-tagline">Everything And On Infinite</div>
      </div>
    );
  }

  // DONE — render nothing, will transition to title screen
  return null;
}

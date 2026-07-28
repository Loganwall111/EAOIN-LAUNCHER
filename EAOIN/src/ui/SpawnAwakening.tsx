/**
 * SpawnAwakening — the "waking up" cutscene played the first time you spawn.
 *
 * Beat sheet, per the brief:
 *   1. BLACK    — nothing, then the first blink
 *   2. BLINK    — eyelids flutter open and shut a few times, blurred
 *   3. GROUND   — vision settles: you are face-down, hands flat on the dirt
 *   4. PUSH     — hands push off, the view rises to standing
 *   5. LOOK     — a slow pan left and right as you take the place in
 *   6. HANDS    — hands come up into view, you flex them
 *   7. DONE     — hand off to gameplay
 *
 * The eyelids are two CSS shutters over the live 3D canvas, so the world is
 * genuinely rendering behind the sequence — you are watching the real world
 * through opening eyes, not a video.
 *
 * Fully skippable, and collapsed to a short fade under `reducedMotion`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type AwakeningBeat = 'BLACK' | 'BLINK' | 'GROUND' | 'PUSH' | 'LOOK' | 'HANDS' | 'DONE';

interface SpawnAwakeningProps {
  /** Fired once the sequence finishes or is skipped. */
  onComplete: () => void;
  /** Collapse to a brief fade for accessibility. */
  reducedMotion?: boolean;
  /** Biome name, shown on the location card as you stand up. */
  biomeName?: string;
  /** World name/seed, shown under the biome. */
  worldName?: string;
}

/** Beat durations in ms. Snappy pacing so you never stare at a black screen. */
const BEATS: Array<{ beat: AwakeningBeat; ms: number }> = [
  { beat: 'BLACK', ms: 250 },
  { beat: 'BLINK', ms: 800 },
  { beat: 'GROUND', ms: 600 },
  { beat: 'PUSH', ms: 600 },
  { beat: 'LOOK', ms: 500 },
  { beat: 'HANDS', ms: 400 },
];

export default function SpawnAwakening({
  onComplete,
  reducedMotion = false,
  biomeName,
  worldName,
}: SpawnAwakeningProps) {
  const [beat, setBeat] = useState<AwakeningBeat>('BLACK');
  const doneRef = useRef(false);

  // Keep the latest completion callback in a ref. While the world is running
  // the parent (App) re-renders several times a second — every HUD telemetry
  // tick — and each render hands us a *brand new* inline `onComplete`. If the
  // beat timer below depended on that callback directly, it would be torn down
  // and restarted on every one of those re-renders, so the 900 ms BLACK beat
  // (eyes fully shut) would never elapse. The eyelids would stay closed and the
  // player would see nothing but a permanent black wall over the live game.
  // Reading the callback through a ref keeps the timer stable across re-renders.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setBeat('DONE');
    onCompleteRef.current();
  }, []);

  /* Advance through the beats on a timer. */
  useEffect(() => {
    if (beat === 'DONE') return;
    const index = BEATS.findIndex((b) => b.beat === beat);
    if (index === -1) return;

    const entry = BEATS[index];
    const ms = reducedMotion ? Math.min(entry.ms, 170) : entry.ms;
    const timer = window.setTimeout(() => {
      const next = BEATS[index + 1];
      if (next) setBeat(next.beat);
      else finish();
    }, ms);

    return () => window.clearTimeout(timer);
  }, [beat, reducedMotion, finish]);

  // Failsafe: never let the waking up sequence trap the player on a black screen
  // if a browser timer is delayed or interrupted.
  useEffect(() => {
    const maxTotalMs = reducedMotion ? 400 : 3600;
    const safety = window.setTimeout(() => finish(), maxTotalMs);
    return () => window.clearTimeout(safety);
  }, [reducedMotion, finish]);

  /* Skip on any input. */
  useEffect(() => {
    const skip = (e: Event) => {
      // Let the player skip with a key or a click, but don't swallow the event
      // if they're just moving the mouse.
      if (e.type === 'keydown' || e.type === 'pointerdown') finish();
    };
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [finish]);

  if (beat === 'DONE') return null;

  // The location card fades in once we're on our feet.
  const showCard = beat === 'LOOK' || beat === 'HANDS';

  return (
    <div className={`spawn-awakening beat-${beat.toLowerCase()}`} aria-hidden="true">
      {/* Eyelid shutters — these are what actually "open". */}
      <div className="wake-lid wake-lid-top" />
      <div className="wake-lid wake-lid-bottom" />

      {/* Soft focus + vignette that clears as vision resolves. */}
      <div className="wake-blur" />
      <div className="wake-vignette" />

      {/* First-person hands, planted on the ground then raised into view. */}
      <div className="wake-hands">
        <div className="wake-hand wake-hand-left" />
        <div className="wake-hand wake-hand-right" />
      </div>

      {showCard && (
        <div className="wake-card">
          {worldName && <div className="wake-card-world">{worldName}</div>}
          <div className="wake-card-biome">{biomeName ?? 'Unknown Territory'}</div>
          <div className="wake-card-rule" />
        </div>
      )}

      <div className="wake-skip">Press any key to skip</div>
    </div>
  );
}

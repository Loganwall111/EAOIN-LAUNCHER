/**
 * CinematicBoot — AAA-style boot sequence shown on launch.
 *
 * Phase order — a strict, non-overlapping timeline. Each beat names exactly
 * one thing, holds the screen alone, then fades out before the next begins:
 *
 *   1. WARNING     — health/safety + epilepsy card, like a retail console title
 *   2. ENGINE      — "POWERED BY EAOIN ENGINE" tech logo with a scanning sweep
 *   3. STUDIO      — the studio name, ONBLOCKAWAY STUDIOS
 *   4. CREDITS     — the film-style billing block
 *   5. INTRODUCING — the letter-spaced connective card
 *   6. LOGO        — the game name: each letter drops in on its own note of a
 *                    four-note chime, then the whole mark settles
 *   7. READY       — "PRESS ANY KEY" pulse before handing off to the menu
 *
 * ## The "title renders three times" bug
 *
 * The wordmark used to be drawn by three different phases: LOGO (as animated
 * per-letter spans), a separate TITLE phase (as an `<h1>` with a light sweep
 * and tagline), and READY (as the same `<h1>` again). LOGO and TITLE ran
 * back-to-back with independent CSS fade animations, so the game name faded
 * in, restyled, and faded in again — reading as the title stacking over
 * itself. The studio name had the same problem: the STUDIO phase showed
 * "ONBLOCKAWAY", then the LOGO phase re-printed "ONBLOCKAWAY STUDIOS"
 * underneath the wordmark.
 *
 * The redundant TITLE phase is gone and the LOGO phase no longer re-prints
 * the studio name, so each name is introduced exactly once, in order.
 *
 * ## 2.0 changes
 *
 * - **No loading bar here.** Boot is pure presentation; nothing is actually
 *   being loaded at this point, so a fake progress bar just delayed the menu.
 *   The real loading bar now lives in world creation, where there is genuine
 *   work to wait on.
 * - **New LOGO phase** with the letter-by-letter chime, and the whole sequence
 *   runs noticeably longer so it reads as a real title card.
 *
 * The sequence stays fully skippable — press any key or click at any point —
 * and collapses to a short fade when `reducedMotion` is set.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BootChime } from '../audio/BootChime';

interface CinematicBootProps {
  onComplete: () => void;
  /** Honour the accessibility setting by collapsing to a short fade. */
  reducedMotion?: boolean;
}

type BootPhase =
  | 'WARNING'
  | 'ENGINE'
  | 'STUDIO'
  | 'CREDITS'
  | 'INTRODUCING'
  | 'LOGO'
  | 'READY'
  | 'DONE';

/** The wordmark, one letter per chime note. */
const LOGO_LETTERS = ['E', 'A', 'O', 'I', 'N'];

/**
 * Ordered phases and how long each holds, in ms.
 * Durations are longer than 1.x so the boot reads as a real AAA title card.
 */
const PHASE_SEQUENCE: Array<{ phase: BootPhase; durationMs: number }> = [
  { phase: 'WARNING', durationMs: 3400 },
  { phase: 'ENGINE', durationMs: 3200 },
  { phase: 'STUDIO', durationMs: 3800 },
  // The film-style billing block. This is the piece the boot was missing: a
  // retail title card sequence names its production roles before the logo,
  // which is what separates "a loading screen" from "an intro".
  { phase: 'CREDITS', durationMs: 8600 },
  { phase: 'INTRODUCING', durationMs: 2200 },
  // Long enough for every letter to land plus the chime tail.
  { phase: 'LOGO', durationMs: 4600 },
  { phase: 'READY', durationMs: 0 }, // waits for input
];

/**
 * Opening billing block, in film order.
 *
 * Each card holds the screen on its own, fading through, exactly like the
 * title sequence of a retail game. Timings are relative to the start of the
 * CREDITS phase.
 */
interface CreditCard {
  role: string;
  names: string[];
  atMs: number;
}

const CREDIT_CARDS: CreditCard[] = [
  { role: 'A ONBLOCKAWAY STUDIOS PRODUCTION', names: [], atMs: 0 },
  { role: 'ENGINE & RENDERING', names: ['EAOIN Voxel Runtime', 'WebGPU · Vulkan'], atMs: 1700 },
  { role: 'WORLD GENERATION', names: ['Continental Terrain', 'Deep Cave Systems'], atMs: 3400 },
  { role: 'ART DIRECTION', names: ['Procedural Texture Forge'], atMs: 5100 },
  { role: 'IN ASSOCIATION WITH', names: ['Every Block You Have Not Placed Yet'], atMs: 6800 },
];

/** Rotating hint cards shown on the READY card. */
const TIPS = [
  'Press F to toggle flight once you are in the world.',
  'Coins buy skins, capes, shaders, worlds and mods on the Marketplace.',
  'Editor Mode lets you build creations and sell them for coins.',
  'There are 25 dimensions, each with its own gravity and mobs.',
  'Press F5 to swap between first and third person.',
  'Type /help in chat to see every command.',
  'Shaders can be swapped at any time from Options → Video.',
];

export default function CinematicBoot({ onComplete, reducedMotion = false }: CinematicBootProps) {
  const [phase, setPhase] = useState<BootPhase>(reducedMotion ? 'LOGO' : 'WARNING');
  // How many wordmark letters have dropped in so far.
  const [litLetters, setLitLetters] = useState(0);
  // Set when the browser blocked audio, so we can offer a click-to-hear retry.
  const [audioBlocked, setAudioBlocked] = useState(false);
  const chime = useMemo(() => new BootChime(), []);
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [skipHintVisible, setSkipHintVisible] = useState(false);
  /** Index of the billing card currently on screen during CREDITS. */
  const [creditIndex, setCreditIndex] = useState(0);
  const completedRef = useRef(false);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setPhase('DONE');
    onComplete();
  }, [onComplete]);

  /** Jump straight to the loading stage, or straight out if already loaded. */
  const skip = useCallback(() => {
    setPhase((current) => {
      if (current === 'READY' || current === 'DONE') { finish(); return 'DONE'; }
      // Everything in boot is presentation, so skipping jumps straight to the
      // "press any key" card rather than to a fake loading stage.
      return 'READY';
    });
  }, [finish]);

  /* ------------------------------ skip handling --------------------------- */

  useEffect(() => {
    const onInput = () => {
      if (phase === 'READY') finish();
      else skip();
    };
    window.addEventListener('keydown', onInput);
    window.addEventListener('pointerdown', onInput);
    return () => {
      window.removeEventListener('keydown', onInput);
      window.removeEventListener('pointerdown', onInput);
    };
  }, [phase, skip, finish]);

  // Reveal the "press any key to skip" hint shortly after boot starts.
  useEffect(() => {
    const timer = window.setTimeout(() => setSkipHintVisible(true), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  /* --------------------------- cinematic phase clock ---------------------- */

  useEffect(() => {
    const entry = PHASE_SEQUENCE.find((step) => step.phase === phase);
    if (!entry || entry.durationMs === 0) return;
    const next = PHASE_SEQUENCE[PHASE_SEQUENCE.findIndex((step) => step.phase === phase) + 1];
    // `next` is only undefined past the end of the table, and the last entry
    // (READY) has duration 0 so we never get here. Falling back to READY keeps
    // this total without inventing a phase that does not exist — the previous
    // 'LOADING' fallback was not a BootPhase at all.
    const timer = window.setTimeout(
      () => setPhase(next?.phase ?? 'READY'),
      reducedMotion ? Math.min(entry.durationMs, 600) : entry.durationMs
    );
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  /* ------------------------- logo chime choreography ---------------------- */

  useEffect(() => {
    if (phase !== 'LOGO') return;
    let cancelled = false;
    const timers: number[] = [];

    // Try to sound the chime. Browsers block audio without a prior gesture, so
    // if it fails we surface a click-to-hear affordance instead of going quiet
    // with no explanation.
    const sounded = chime.play({ volume: reducedMotion ? 0.3 : 0.55 });
    if (!sounded) setAudioBlocked(true);

    // Drop each letter in on its own note.
    setLitLetters(0);
    for (let i = 0; i < LOGO_LETTERS.length; i += 1) {
      const noteIndex = Math.min(i, BootChime.noteCount() - 1);
      const delay = reducedMotion ? i * 70 : BootChime.noteOnsetMs(noteIndex);
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) setLitLetters(i + 1);
        }, delay)
      );
    }

    return () => {
      cancelled = true;
      for (const t of timers) window.clearTimeout(t);
    };
  }, [phase, reducedMotion, chime]);

  // Retry the chime once the player interacts, if autoplay was blocked.
  useEffect(() => {
    if (!audioBlocked) return;
    const retry = () => {
      if (chime.play({ volume: 0.55 })) setAudioBlocked(false);
    };
    window.addEventListener('pointerdown', retry, { once: true });
    return () => window.removeEventListener('pointerdown', retry);
  }, [audioBlocked, chime]);

  useEffect(() => () => chime.dispose(), [chime]);

  // Cycle the tip cards on the ready card.
  useEffect(() => {
    if (phase !== 'READY') return;
    const timer = window.setInterval(() => {
      setTipIndex((index) => (index + 1) % TIPS.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [phase]);

  /* ------------------------- credits card choreography -------------------- */

  useEffect(() => {
    if (phase !== 'CREDITS') return;
    setCreditIndex(0);
    const timers = CREDIT_CARDS.map((card, index) => window.setTimeout(
      () => setCreditIndex(index),
      reducedMotion ? index * 220 : card.atMs
    ));
    return () => { for (const timer of timers) window.clearTimeout(timer); };
  }, [phase, reducedMotion]);

  /* --------------------------- decorative particles ----------------------- */

  const embers = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 6,
      duration: 7 + Math.random() * 7,
      size: 2 + Math.random() * 4,
    })),
    []
  );

  if (phase === 'DONE') return null;

  const skipHint = skipHintVisible && phase !== 'READY' ? (
    <div className="cb-skip-hint">Press any key to skip</div>
  ) : null;

  /* ================================ WARNING =============================== */
  if (phase === 'WARNING') {
    return (
      <div className="cinematic-boot cb-warning">
        <div className="cb-warning-card">
          <div className="cb-warning-icon">⚠</div>
          <h2>Health &amp; Safety</h2>
          <p>
            A very small percentage of people may experience seizures when exposed to
            flashing lights or patterns. Play in a well-lit room, sit back from the
            screen, and take a 10-15 minute break every hour.
          </p>
          <p className="cb-warning-sub">
            Stop playing immediately and consult a doctor if you experience dizziness,
            altered vision, or disorientation.
          </p>
        </div>
        {skipHint}
      </div>
    );
  }

  /* ================================ ENGINE ================================ */
  if (phase === 'ENGINE') {
    return (
      <div className="cinematic-boot cb-engine">
        <div className="cb-engine-mark">
          <div className="cb-engine-cube">
            <span /><span /><span /><span /><span /><span />
          </div>
          <div className="cb-engine-scan" />
        </div>
        <div className="cb-engine-text">
          <span className="cb-engine-kicker">POWERED BY</span>
          <span className="cb-engine-name">EAOIN ENGINE</span>
          <span className="cb-engine-ver">VOXEL RUNTIME • WEBGPU / VULKAN</span>
        </div>
        {skipHint}
      </div>
    );
  }

  /* ================================ STUDIO ================================ */
  if (phase === 'STUDIO') {
    return (
      <div className="cinematic-boot cinematic-studio">
        <div className="cb-vignette" />
        <div className="cb-orbit-ring">
          <span /><span /><span /><span />
        </div>
        <div className="cb-orbit-ring cb-orbit-ring-2">
          <span /><span /><span />
        </div>
        <div className="cb-studio-name">ONBLOCKAWAY</div>
        <div className="cb-studio-sub">STUDIOS</div>
        <div className="cb-studio-rule" />
        {skipHint}
      </div>
    );
  }

  /* =============================== CREDITS ================================ */
  // The billing block: one role per card, cross-fading on a film cadence.
  if (phase === 'CREDITS') {
    const card = CREDIT_CARDS[Math.min(creditIndex, CREDIT_CARDS.length - 1)];
    return (
      <div className="cinematic-boot cb-credits">
        <div className="cb-vignette" />
        <div className="cb-ember-field" aria-hidden="true">
          {embers.slice(0, 10).map((ember) => (
            <span
              key={ember.id}
              className="cb-ember"
              style={{
                left: `${ember.left}%`,
                width: ember.size,
                height: ember.size,
                animationDelay: `${ember.delay}s`,
                animationDuration: `${ember.duration}s`,
              }}
            />
          ))}
        </div>
        {/* `key` forces a remount per card so the fade-in animation replays. */}
        <div className="cb-credit-card" key={creditIndex}>
          <div className="cb-credit-role">{card.role}</div>
          {card.names.length > 0 && (
            <div className="cb-credit-names">
              {card.names.map((name) => <div key={name} className="cb-credit-name">{name}</div>)}
            </div>
          )}
        </div>
        <div className="cb-credit-progress" aria-hidden="true">
          {CREDIT_CARDS.map((entry, index) => (
            <span key={entry.role} className={index <= creditIndex ? 'on' : ''} />
          ))}
        </div>
        {skipHint}
      </div>
    );
  }

  /* ============================= INTRODUCING ============================== */
  // Connective tissue between the studio card and the game name. It names
  // nothing itself, so it can never collide with the wordmark.
  if (phase === 'INTRODUCING') {
    return (
      <div className="cinematic-boot cinematic-presents">
        <div className="cb-vignette" />
        <div className="cb-presents-text">INTRODUCING</div>
        {skipHint}
      </div>
    );
  }

  /* ================================= LOGO ================================= */
  // The Mojang-style moment: letters drop in one per chime note.
  if (phase === 'LOGO') {
    return (
      <div className="cinematic-boot cb-logo">
        <div className="cb-vignette" />
        <div className="cb-ember-field" aria-hidden="true">
          {embers.slice(0, 12).map((ember) => (
            <span
              key={ember.id}
              className="cb-ember"
              style={{
                left: `${ember.left}%`,
                width: ember.size,
                height: ember.size,
                animationDelay: `${ember.delay}s`,
                animationDuration: `${ember.duration}s`,
              }}
            />
          ))}
        </div>

        <div className="cb-logo-mark">
          {LOGO_LETTERS.map((letter, i) => (
            <span
              key={`${letter}-${i}`}
              className={`cb-logo-letter ${i < litLetters ? 'lit' : ''}`}
              // Each letter carries its own slight rotation so the settled
              // wordmark looks hand-placed rather than mechanically aligned.
              style={{ ['--cb-letter-tilt' as string]: `${((i % 2 === 0 ? -1 : 1) * (1.5 + i * 0.4)).toFixed(2)}deg` }}
            >
              {letter}
            </span>
          ))}
        </div>

        {/* The studio was already named in its own phase; re-printing it here
            is what made the intro look like it was stacking cards. This slot
            now carries the game's tagline, and only after the wordmark has
            fully settled. */}
        <div className={`cb-logo-sub ${litLetters >= LOGO_LETTERS.length ? 'shown' : ''}`}>
          Everything And On Infinite
        </div>

        {audioBlocked && (
          <button className="cb-audio-retry" onClick={() => { if (chime.play({ volume: 0.55 })) setAudioBlocked(false); }}>
            🔊 Click for sound
          </button>
        )}
        {skipHint}
      </div>
    );
  }

  /* ================================= READY ================================ */
  return (
    <div className="cinematic-boot cb-ready">
      <div className="cb-vignette" />
      <div className="cb-title-stack">
        <h1 className="cb-game-title cb-ready-title">EAOIN</h1>
        <div className="cb-title-rule" />
        <div className="cb-game-tagline">Everything And On Infinite</div>
      </div>
      <button className="cb-press-any" onClick={finish}>PRESS ANY KEY</button>
      <div className="cb-tip-card">
        <span className="cb-tip-label">TIP</span>
        <span className="cb-tip-text">{TIPS[tipIndex]}</span>
      </div>
    </div>
  );
}

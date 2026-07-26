/**
 * CinematicBoot — AAA-style boot sequence shown on launch.
 *
 * Phase order:
 *   1. WARNING   — health/safety + epilepsy card, like a retail console title
 *   2. ENGINE    — "POWERED BY EAOIN ENGINE" tech logo with a scanning sweep
 *   3. STUDIO    — ONBLOCKAWAY STUDIOS with an orbiting particle ring
 *   4. PRESENTS  — letter-spaced "PRESENTS"
 *   5. TITLE     — the EAOIN wordmark with a light sweep and rising tagline
 *   6. LOADING   — real staged loading with named subsystems and a progress bar
 *   7. READY     — "PRESS ANY KEY" pulse before handing off to the menu
 *
 * The whole sequence is skippable — press any key or click at any point. It is
 * also automatically shortened when the player has `reducedMotion` enabled.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface CinematicBootProps {
  onComplete: () => void;
  /** Honour the accessibility setting by collapsing to a short fade. */
  reducedMotion?: boolean;
}

type BootPhase =
  | 'WARNING'
  | 'ENGINE'
  | 'STUDIO'
  | 'PRESENTS'
  | 'TITLE'
  | 'LOADING'
  | 'READY'
  | 'DONE';

/** Ordered phases and how long each holds, in ms. */
const PHASE_SEQUENCE: Array<{ phase: BootPhase; durationMs: number }> = [
  { phase: 'WARNING', durationMs: 2600 },
  { phase: 'ENGINE', durationMs: 2400 },
  { phase: 'STUDIO', durationMs: 3000 },
  { phase: 'PRESENTS', durationMs: 1400 },
  { phase: 'TITLE', durationMs: 3000 },
  { phase: 'LOADING', durationMs: 0 }, // driven by the loading simulation
  { phase: 'READY', durationMs: 0 },   // waits for input
];

/**
 * Loading stages. Each has a weight so the bar advances at a believable,
 * uneven pace rather than perfectly linearly.
 */
const LOAD_STAGES: Array<{ label: string; weight: number }> = [
  { label: 'Initializing voxel engine', weight: 6 },
  { label: 'Detecting graphics backend', weight: 5 },
  { label: 'Compiling shader permutations', weight: 14 },
  { label: 'Loading block registry', weight: 7 },
  { label: 'Building biome tables', weight: 8 },
  { label: 'Warming terrain generator', weight: 11 },
  { label: 'Carving caves and ravines', weight: 9 },
  { label: 'Streaming spawn chunks', weight: 12 },
  { label: 'Linking dimension portals', weight: 6 },
  { label: 'Calibrating physics solver', weight: 7 },
  { label: 'Spawning volumetric clouds', weight: 6 },
  { label: 'Syncing marketplace catalog', weight: 5 },
  { label: 'Finalizing render pipeline', weight: 4 },
];

const TOTAL_WEIGHT = LOAD_STAGES.reduce((sum, stage) => sum + stage.weight, 0);

/** Rotating hint cards shown beneath the loading bar. */
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
  const [phase, setPhase] = useState<BootPhase>(reducedMotion ? 'LOADING' : 'WARNING');
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [skipHintVisible, setSkipHintVisible] = useState(false);
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
      if (current === 'LOADING') return current; // let the load finish honestly
      return 'LOADING';
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
    const timer = window.setTimeout(
      () => setPhase(next?.phase ?? 'LOADING'),
      reducedMotion ? Math.min(entry.durationMs, 600) : entry.durationMs
    );
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  /* ---------------------------- loading simulation ------------------------ */

  useEffect(() => {
    if (phase !== 'LOADING') return;
    let cancelled = false;
    let completed = 0;
    let index = 0;

    const runStage = () => {
      if (cancelled) return;
      if (index >= LOAD_STAGES.length) {
        setProgress(100);
        window.setTimeout(() => { if (!cancelled) setPhase('READY'); }, 420);
        return;
      }

      const stage = LOAD_STAGES[index];
      setStageIndex(index);

      // Animate the bar across this stage's slice of the total weight.
      const from = (completed / TOTAL_WEIGHT) * 100;
      const to = ((completed + stage.weight) / TOTAL_WEIGHT) * 100;
      const stageMs = reducedMotion ? 60 : 150 + stage.weight * 22;
      const startedAt = performance.now();

      const step = () => {
        if (cancelled) return;
        const elapsed = performance.now() - startedAt;
        const t = Math.min(1, elapsed / stageMs);
        // Ease-out so each stage decelerates as it lands.
        const eased = 1 - Math.pow(1 - t, 2);
        setProgress(from + (to - from) * eased);
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          completed += stage.weight;
          index += 1;
          runStage();
        }
      };
      requestAnimationFrame(step);
    };

    runStage();
    return () => { cancelled = true; };
  }, [phase, reducedMotion]);

  // Cycle the tip cards while loading.
  useEffect(() => {
    if (phase !== 'LOADING') return;
    const timer = window.setInterval(() => {
      setTipIndex((index) => (index + 1) % TIPS.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [phase]);

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

  /* =============================== PRESENTS =============================== */
  if (phase === 'PRESENTS') {
    return (
      <div className="cinematic-boot cinematic-presents">
        <div className="cb-vignette" />
        <div className="cb-presents-text">PRESENTS</div>
        {skipHint}
      </div>
    );
  }

  /* ================================= TITLE ================================ */
  if (phase === 'TITLE') {
    return (
      <div className="cinematic-boot cinematic-title">
        <div className="cb-vignette" />
        <div className="cb-ember-field" aria-hidden="true">
          {embers.map((ember) => (
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
        <div className="cb-title-stack">
          <h1 className="cb-game-title" data-text="EAOIN">
            EAOIN
            <span className="cb-title-sweep" />
          </h1>
          <div className="cb-title-rule" />
          <div className="cb-game-tagline">Everything And On Infinite</div>
        </div>
        {skipHint}
      </div>
    );
  }

  /* ================================ LOADING =============================== */
  if (phase === 'LOADING') {
    const stage = LOAD_STAGES[Math.min(stageIndex, LOAD_STAGES.length - 1)];
    return (
      <div className="cinematic-boot cinematic-loading">
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

        <div className="cb-loading-logo">EAOIN</div>

        <div className="cb-loading-block">
          <div className="cb-loading-stage-row">
            <span className="cb-loading-stage">{stage.label}…</span>
            <span className="cb-loading-pct">{Math.round(progress)}%</span>
          </div>

          <div className="cb-loading-bar-track">
            <div className="cb-loading-bar-fill" style={{ width: `${progress}%` }}>
              <span className="cb-loading-bar-shine" />
            </div>
          </div>

          <div className="cb-loading-steps" aria-hidden="true">
            {LOAD_STAGES.map((entry, index) => (
              <span
                key={entry.label}
                className={`cb-step-dot ${index < stageIndex ? 'done' : index === stageIndex ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>

        <div className="cb-tip-card">
          <span className="cb-tip-label">TIP</span>
          <span className="cb-tip-text">{TIPS[tipIndex]}</span>
        </div>
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
    </div>
  );
}

/**
 * Premium launch sequence.
 *
 * The phase clock owns exactly one scene at a time. The game wordmark belongs
 * to the shared LOGO/READY scene, so moving to the input prompt does not mount
 * a second title or replay its entrance animation.
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
  | 'NARRATION'
  | 'LOGO'
  | 'READY'
  | 'DONE';

/** The single game wordmark, revealed one letter per chime onset. */
const LOGO_LETTERS = ['E', 'A', 'O', 'I', 'N'];

const PHASE_SEQUENCE: Array<{ phase: BootPhase; durationMs: number }> = [
  { phase: 'WARNING', durationMs: 3000 },
  { phase: 'ENGINE', durationMs: 2800 },
  { phase: 'STUDIO', durationMs: 3000 },
  { phase: 'CREDITS', durationMs: 7200 },
  { phase: 'INTRODUCING', durationMs: 1800 },
  { phase: 'NARRATION', durationMs: 8500 },
  { phase: 'LOGO', durationMs: 4400 },
  { phase: 'READY', durationMs: 0 },
];

interface CreditCard {
  eyebrow: string;
  title: string;
  detail: string;
  atMs: number;
}

const CREDIT_CARDS: CreditCard[] = [
  {
    eyebrow: 'CREATIVE VISION',
    title: 'A world reborn in light',
    detail: 'Next-generation voxel technology meets timeless sandbox freedom.',
    atMs: 0,
  },
  {
    eyebrow: 'TECHNICAL EXCELLENCE',
    title: 'Obsidian Voxel Engine 2.0',
    detail: 'Volumetric atmosphere · Ray-traced lighting · Dynamic seasons',
    atMs: 1800,
  },
  {
    eyebrow: 'LIVING WORLDS',
    title: 'Every horizon tells a story',
    detail: 'Procedural ecosystems · Wind simulation · Evolving biomes',
    atMs: 3600,
  },
  {
    eyebrow: 'FOR THE DREAMERS',
    title: 'Your legend begins now',
    detail: 'Create · Explore · Build · Become infinite',
    atMs: 5400,
  },
];

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
  const [litLetters, setLitLetters] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const chime = useMemo(() => new BootChime(), []);
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [skipHintVisible, setSkipHintVisible] = useState(false);
  const [creditIndex, setCreditIndex] = useState(0);
  const [narrationLine, setNarrationLine] = useState('');
  const completedRef = useRef(false);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setPhase('DONE');
    onComplete();
  }, [onComplete]);

  const skip = useCallback(() => {
    setPhase((current) => {
      if (current === 'READY' || current === 'DONE') { finish(); return 'DONE'; }
      return 'READY';
    });
  }, [finish]);

  /* ------------------------------ input ----------------------------------- */

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

  useEffect(() => {
    const timer = window.setTimeout(() => setSkipHintVisible(true), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  /* --------------------------- phase clock -------------------------------- */

  useEffect(() => {
    const entry = PHASE_SEQUENCE.find((step) => step.phase === phase);
    if (!entry || entry.durationMs === 0) return;
    const next = PHASE_SEQUENCE[PHASE_SEQUENCE.findIndex((step) => step.phase === phase) + 1];
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

  useEffect(() => {
    if (phase !== 'READY') return;
    const timer = window.setInterval(() => {
      setTipIndex((index) => (index + 1) % TIPS.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'CREDITS') return;
    setCreditIndex(0);
    const timers = CREDIT_CARDS.map((card, index) => window.setTimeout(
      () => setCreditIndex(index),
      reducedMotion ? index * 220 : card.atMs
    ));
    return () => { for (const timer of timers) window.clearTimeout(timer); };
  }, [phase, reducedMotion]);

  // Deep wise male narrator voice (AAA cinematic style) — played from
  // pre-rendered realistic audio instead of the browser's robotic speechSynthesis.
  useEffect(() => {
    if (phase !== 'NARRATION') return;

    const narrationLines = [
      "The world has been waiting for you.",
      "Your time has come.",
      "Welcome to this realm.",
      "This world awaits."
    ];
    const base = import.meta.env.BASE_URL;

    let currentIndex = 0;
    let audioEl: HTMLAudioElement | null = null;
    setNarrationLine(narrationLines[0]);

    const playLine = (index: number) => {
      audioEl?.pause();
      audioEl = new Audio(`${base}audio/narration_${index + 1}.mp3`);
      audioEl.volume = 0.95;
      void audioEl.play().catch(() => {
        // Fall back to the browser voice only if the audio can't load.
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(narrationLines[index]);
          utterance.rate = 0.86; utterance.pitch = 0.88; utterance.volume = 0.95;
          window.speechSynthesis.speak(utterance);
        }
      });
    };

    playLine(0);

    const interval = setInterval(() => {
      currentIndex++;
      if (currentIndex < narrationLines.length) {
        setNarrationLine(narrationLines[currentIndex]);
        playLine(currentIndex);
      } else {
        clearInterval(interval);
        setTimeout(() => setPhase('LOGO'), 1200);
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      audioEl?.pause();
    };
  }, [phase]);

  const motes = useMemo(
    () => Array.from({ length: 20 }, (_, index) => ({
      id: index,
      left: 4 + Math.random() * 92,
      delay: Math.random() * 8,
      duration: 9 + Math.random() * 8,
      size: 1 + Math.random() * 3,
    })),
    []
  );

  if (phase === 'DONE') return null;

  const brandPhase = phase === 'LOGO' || phase === 'READY';
  const visibleLetters = phase === 'READY' ? LOGO_LETTERS.length : litLetters;
  const phaseClass = phase.toLowerCase();
  const semanticPhaseClass = phase === 'WARNING' ? 'cb-warning'
    : phase === 'ENGINE' ? 'cb-engine'
      : phase === 'STUDIO' ? 'cinematic-studio'
        : phase === 'CREDITS' ? 'cb-credits'
          : phase === 'INTRODUCING' ? 'cinematic-presents'
            : '';
  const skipHint = skipHintVisible && phase !== 'READY' ? (
    <div className="cb-skip-hint"><span>Esc</span> Skip intro</div>
  ) : null;

  return (
    <div
      className={`cinematic-boot cb-shell cb-phase-${phaseClass} ${semanticPhaseClass} ${brandPhase ? 'cb-logo' : ''} ${phase === 'READY' ? 'cb-ready' : ''}`}
      data-phase={phase}
    >
      <div className="cb-world-backdrop" aria-hidden="true" />
      <div className="cb-atmosphere" aria-hidden="true" />
      <div className="cb-grid-floor" aria-hidden="true" />
      <div className="cb-mote-field" aria-hidden="true">
        {motes.map((mote) => (
          <span
            key={mote.id}
            className="cb-mote"
            style={{
              left: `${mote.left}%`,
              width: mote.size,
              height: mote.size,
              animationDelay: `${mote.delay}s`,
              animationDuration: `${mote.duration}s`,
            }}
          />
        ))}
      </div>
      <div className="cb-vignette" aria-hidden="true" />
      <div className="cb-film-grain" aria-hidden="true" />
      <div className="cb-letterbox cb-letterbox-top" aria-hidden="true" />
      <div className="cb-letterbox cb-letterbox-bottom" aria-hidden="true" />

      {phase !== 'WARNING' && (
        <div className="cb-status-rail" aria-hidden="true">
          <span>ONBLOCKAWAY STUDIOS</span>
          <span className="cb-status-diamond">◆</span>
          <span>ALPHA ACCESS BUILD</span>
        </div>
      )}

      {phase === 'WARNING' && (
        <main className="cb-scene cb-warning-scene" aria-labelledby="cb-warning-title">
          <div className="cb-warning-emblem" aria-hidden="true"><span>!</span></div>
          <div className="cb-warning-copy">
            <span className="cb-eyebrow">Before you enter the world</span>
            <h1 id="cb-warning-title">Health &amp; Safety</h1>
            <p>
              A very small percentage of people may experience seizures when exposed to
              flashing lights or patterns. Play in a well-lit room, sit back from the
              screen, and take a 10–15 minute break every hour.
            </p>
            <p className="cb-warning-sub">
              Stop playing immediately and consult a doctor if you experience dizziness,
              altered vision, or disorientation.
            </p>
          </div>
          <div className="cb-warning-footer"><span /> Player wellbeing comes first <span /></div>
        </main>
      )}

      {phase === 'ENGINE' && (
        <main className="cb-scene cb-engine-scene" aria-label="Engine technology">
          <div className="cb-engine-visual" aria-hidden="true">
            <div className="cb-engine-halo cb-engine-halo-outer" />
            <div className="cb-engine-halo cb-engine-halo-inner" />
            <div className="cb-engine-cube">
              <span /><span /><span /><span /><span /><span />
            </div>
            <div className="cb-engine-scan" />
          </div>
          <div className="cb-engine-copy">
            <span className="cb-eyebrow">Powered by proprietary technology</span>
            <h1>Obsidian Voxel Engine</h1>
            <div className="cb-engine-specs">
              <span>WEBGL2</span><i />
              <span>WEBGPU</span><i />
              <span>VULKAN</span>
            </div>
          </div>
        </main>
      )}

      {phase === 'STUDIO' && (
        <main className="cb-scene cb-studio-scene" aria-label="Onblockaway Studios">
          <div className="cb-studio-sigil" aria-hidden="true">
            <span className="cb-sigil-face cb-sigil-one" />
            <span className="cb-sigil-face cb-sigil-two" />
            <span className="cb-sigil-face cb-sigil-three" />
          </div>
          <div className="cb-studio-lockup">
            <span className="cb-eyebrow">An original production by</span>
            <h1 className="cb-studio-name">ONBLOCKAWAY</h1>
            <div className="cb-studio-rule"><span>STUDIOS</span></div>
          </div>
        </main>
      )}

      {phase === 'CREDITS' && (() => {
        const card = CREDIT_CARDS[Math.min(creditIndex, CREDIT_CARDS.length - 1)];
        return (
          <main className="cb-scene cb-credit-scene" aria-live="polite">
            <div className="cb-credit-number" aria-hidden="true">
              {String(creditIndex + 1).padStart(2, '0')}
            </div>
            <article className="cb-credit-card" key={creditIndex}>
              <span className="cb-eyebrow cb-credit-eyebrow">{card.eyebrow}</span>
              <h1>{card.title}</h1>
              <div className="cb-credit-rule" />
              <p>{card.detail}</p>
            </article>
            <div className="cb-credit-progress" aria-hidden="true">
              {CREDIT_CARDS.map((entry, index) => (
                <span key={entry.eyebrow} className={index <= creditIndex ? 'on' : ''} />
              ))}
            </div>
          </main>
        );
      })()}

      {phase === 'INTRODUCING' && (
        <main className="cb-scene cb-intro-scene">
          <span className="cb-intro-line" aria-hidden="true" />
          <div className="cb-intro-copy">
            <span className="cb-eyebrow">Beyond the horizon</span>
            <h1>A new world awakens</h1>
          </div>
          <span className="cb-intro-line" aria-hidden="true" />
        </main>
      )}

      {phase === 'NARRATION' && (
        <main className="cb-scene cb-narration-scene" style={{ textAlign: 'center' }}>
          <div style={{ maxWidth: '820px', padding: '0 40px' }}>
            <span className="cb-eyebrow" style={{ letterSpacing: '0.4em', color: 'var(--cb-gold)' }}>
              THE ANCIENT VOICE
            </span>
            <h1 style={{
              margin: '32px 0 0',
              fontSize: 'clamp(42px, 6.2vw, 78px)',
              fontWeight: 300,
              lineHeight: 1.05,
              color: '#f4f8fc',
              textShadow: '0 4px 40px rgba(0,0,0,0.6)'
            }}>
              {narrationLine}
            </h1>
            <div style={{
              margin: '28px auto 0',
              width: '220px',
              height: '4px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '999px',
              overflow: 'hidden',
              boxShadow: '0 0 15px rgba(255,194,61,0.5)'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, #ffc23d, #fff, #ffc23d)',
                animation: 'voicePulse 1.5s ease-in-out infinite alternate',
                boxShadow: '0 0 20px #ffc23d'
              }} />
            </div>
          </div>
        </main>
      )}

      {brandPhase && (
        <main className="cb-scene cb-brand-scene" aria-label="Game title">
          <div className="cb-brand-lockup">
            <span className="cb-brand-overline">EVERYTHING · AND · ON · INFINITE</span>
            <h1 className="cb-logo-mark" aria-label="EAOIN">
              {LOGO_LETTERS.map((letter, index) => (
                <span
                  key={`${letter}-${index}`}
                  className={`cb-logo-letter ${index < visibleLetters ? 'lit' : ''}`}
                  style={{ ['--cb-letter-index' as string]: index }}
                  aria-hidden="true"
                >
                  {letter}
                </span>
              ))}
            </h1>
            <div className={`cb-logo-sub ${visibleLetters >= LOGO_LETTERS.length ? 'shown' : ''}`}>
              <span /> Triple A Sandbox Experience <span />
            </div>
          </div>

          {phase === 'READY' && (
            <div className="cb-ready-actions">
              <button className="cb-press-any" onClick={finish}>
                <span className="cb-keycap">↵</span>
                <span>Press any key</span>
              </button>
              <div className="cb-tip-card" key={tipIndex}>
                <span className="cb-tip-label">FIELD NOTE</span>
                <span className="cb-tip-text">{TIPS[tipIndex]}</span>
              </div>
            </div>
          )}

          {audioBlocked && (
            <button className="cb-audio-retry" onClick={() => { if (chime.play({ volume: 0.55 })) setAudioBlocked(false); }}>
              <span>🔊</span> Enable intro sound
            </button>
          )}
        </main>
      )}

      {skipHint}
    </div>
  );
}

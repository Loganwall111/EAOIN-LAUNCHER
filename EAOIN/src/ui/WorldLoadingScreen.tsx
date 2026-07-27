/**
 * WorldLoadingScreen — the Minecraft-style loading screen.
 *
 * This is where the loading bar belongs: unlike the boot sequence, world
 * creation genuinely has work to wait on (terrain seeding, biome tables, chunk
 * meshing), so the progress here reflects real staged setup.
 *
 * Presentation is deliberately Minecraft-ish: a tiled dirt-block background,
 * the world name and type, a chunky segmented progress bar, and a rotating
 * splash tip — over an animated parallax of the world type's own preview
 * gradient, so creating a Skylands world already looks like Skylands.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { getWorldType, WorldTypeID } from '../world/WorldTypes';

interface WorldLoadingScreenProps {
  worldName: string;
  worldType: WorldTypeID;
  seed: string;
  /** Fired when every stage has completed. */
  onComplete: () => void;
  reducedMotion?: boolean;
}

/** Staged setup with weights, so the bar moves at a believable uneven pace. */
const STAGES: Array<{ label: string; weight: number }> = [
  { label: 'Seeding world generator', weight: 6 },
  { label: 'Building biome tables', weight: 8 },
  { label: 'Raising continents', weight: 12 },
  { label: 'Carving caves and ravines', weight: 14 },
  { label: 'Flooding oceans', weight: 9 },
  { label: 'Planting flora', weight: 8 },
  { label: 'Placing structures', weight: 10 },
  { label: 'Spawning wildlife', weight: 7 },
  { label: 'Linking dimension portals', weight: 6 },
  { label: 'Lighting the sky', weight: 6 },
  { label: 'Meshing spawn chunks', weight: 14 },
];

const TOTAL_WEIGHT = STAGES.reduce((sum, s) => sum + s.weight, 0);

const TIPS = [
  'Press F4 to switch between Survival and Creative at any time.',
  'Drink water with X — the desert will kill you without it.',
  'Fireflies come out in swamps after dark.',
  'The deeper you dig, the larger the caverns get.',
  'Press F8 to open the Dimensions menu and travel instantly.',
  'Look up at night — the Aurora is strongest in polar biomes.',
  'Portals show you the world on the other side before you step through.',
  'Something very large lives at the bottom of the ocean.',
  'The core of the world is molten. Bring fire resistance.',
  'Type /gamemode creative for the full creative inventory.',
];

export default function WorldLoadingScreen({
  worldName,
  worldType,
  seed,
  onComplete,
  reducedMotion = false,
}: WorldLoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [tipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const doneRef = useRef(false);
  const type = useMemo(() => getWorldType(worldType), [worldType]);

  /* Advance through the stages. */
  useEffect(() => {
    let cancelled = false;
    let completed = 0;
    let index = 0;

    const runStage = () => {
      if (cancelled) return;

      if (index >= STAGES.length) {
        setProgress(100);
        window.setTimeout(() => {
          if (cancelled || doneRef.current) return;
          doneRef.current = true;
          onComplete();
        }, reducedMotion ? 100 : 480);
        return;
      }

      const stage = STAGES[index];
      setStageIndex(index);

      const from = (completed / TOTAL_WEIGHT) * 100;
      const to = ((completed + stage.weight) / TOTAL_WEIGHT) * 100;
      const stageMs = reducedMotion ? 40 : 170 + stage.weight * 26;
      const startedAt = performance.now();

      const step = () => {
        if (cancelled) return;
        const t = Math.min(1, (performance.now() - startedAt) / stageMs);
        // Ease-out so each stage decelerates as it lands.
        setProgress(from + (to - from) * (1 - Math.pow(1 - t, 2)));
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
  }, [onComplete, reducedMotion]);

  const stage = STAGES[Math.min(stageIndex, STAGES.length - 1)];

  return (
    <div className="world-loading" role="status" aria-live="polite">
      {/* The world type's own palette, so the screen previews the destination. */}
      <div className="wl-scene" style={{ background: type.preview }} />
      <div className="wl-dirt" aria-hidden="true" />
      <div className="wl-vignette" aria-hidden="true" />

      <div className="wl-content">
        <div className="wl-header">
          <div className="wl-world-name">{worldName}</div>
          <div className="wl-world-meta">
            <span className="wl-type-badge">{type.name}</span>
            <span className="wl-seed">Seed: {seed}</span>
          </div>
        </div>

        <p className="wl-type-detail">{type.detail}</p>

        <div className="wl-bar-block">
          <div className="wl-bar-row">
            <span className="wl-stage">{stage.label}…</span>
            <span className="wl-pct">{Math.round(progress)}%</span>
          </div>

          {/* Chunky segmented bar, Minecraft-style. */}
          <div className="wl-bar-track">
            <div className="wl-bar-fill" style={{ width: `${progress}%` }} />
            <div className="wl-bar-segments" aria-hidden="true">
              {Array.from({ length: 20 }, (_, i) => <span key={i} />)}
            </div>
          </div>
        </div>

        <div className="wl-tip">
          <span className="wl-tip-label">TIP</span>
          <span className="wl-tip-text">{TIPS[tipIndex]}</span>
        </div>
      </div>
    </div>
  );
}

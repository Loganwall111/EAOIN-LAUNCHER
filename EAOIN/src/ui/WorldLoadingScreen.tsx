/**
 * WorldLoadingScreen — the Minecraft-style loading screen.
 *
 * This is where the loading bar belongs: unlike the boot sequence, world
 * creation genuinely has work to wait on (renderer startup, save decoding,
 * terrain seeding, material setup, and chunk meshing), so the percentage shown
 * here is driven by GameCanvas' real loading reports instead of a fake timer.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { getWorldType, WorldTypeID } from '../world/WorldTypes';

interface LoadingProgressSnapshot {
  percent: number;
  label: string;
  ready: boolean;
  loadedChunks?: number;
  totalChunks?: number;
  elapsedMs?: number;
}

interface WorldLoadingScreenProps {
  worldName: string;
  worldType: WorldTypeID;
  seed: string;
  /** Real loading progress emitted by GameCanvas. */
  loadingProgress?: LoadingProgressSnapshot;
  /** Fired when the world is playable or the safety cap is reached. */
  onComplete: () => void;
  reducedMotion?: boolean;
}

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

/** Keep the blocking overlay under 15-20 seconds even on slow devices. */
const SAFETY_COMPLETE_MS = 20_000;

export default function WorldLoadingScreen({
  worldName,
  worldType,
  seed,
  loadingProgress,
  onComplete,
  reducedMotion = false,
}: WorldLoadingScreenProps) {
  const [tipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const doneRef = useRef(false);
  const type = useMemo(() => getWorldType(worldType), [worldType]);

  const percent = Math.max(0, Math.min(100, loadingProgress?.percent ?? 0));
  const stageLabel = loadingProgress?.label ?? 'Waiting for renderer…';
  const elapsedSeconds = Math.max(0, Math.floor((loadingProgress?.elapsedMs ?? 0) / 1000));
  const chunkDetail = loadingProgress?.loadedChunks !== undefined && loadingProgress.totalChunks !== undefined
    ? `${loadingProgress.loadedChunks}/${loadingProgress.totalChunks} chunks`
    : null;

  useEffect(() => {
    if (!loadingProgress?.ready || doneRef.current) return;
    const timer = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete();
    }, reducedMotion ? 80 : 420);
    return () => window.clearTimeout(timer);
  }, [loadingProgress?.ready, onComplete, reducedMotion]);

  // Defensive cap: if the renderer never sends a ready event, never leave the
  // player staring at a stuck percentage forever. Distant chunks keep streaming
  // in-game after the overlay closes.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete();
    }, SAFETY_COMPLETE_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

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
            <span className="wl-stage">{stageLabel}</span>
            <span className="wl-pct">{Math.round(percent)}%</span>
          </div>

          {/* Chunky segmented bar, Minecraft-style. */}
          <div className="wl-bar-track" aria-label={`World loading ${Math.round(percent)} percent`}>
            <div className="wl-bar-fill" style={{ width: `${percent}%` }} />
            <div className="wl-bar-segments" aria-hidden="true">
              {Array.from({ length: 20 }, (_, i) => <span key={i} />)}
            </div>
          </div>

          <div className="wl-load-detail">
            <span>{chunkDetail ?? 'Real startup progress from renderer and world generator'}</span>
            <span>{elapsedSeconds}s / 20s max</span>
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

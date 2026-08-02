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
import WarpTunnel3D from './WarpTunnel3D';

interface LoadingProgressSnapshot {
  percent: number;
  label: string;
  ready: boolean;
  loadedChunks?: number;
  totalChunks?: number;
  elapsedMs?: number;
  error?: string;
}

interface WorldLoadingScreenProps {
  worldName: string;
  worldType: WorldTypeID;
  seed: string;
  /** Real loading progress emitted by GameCanvas. */
  loadingProgress?: LoadingProgressSnapshot;
  /** Fired when the world is playable or the safety cap is reached. */
  onComplete: () => void;
  /** Recreates the renderer after an initialization error. */
  onRetry?: () => void;
  /** Leaves the failed world without revealing a blank canvas. */
  onCancel?: () => void;
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
  onRetry,
  onCancel,
  reducedMotion = false,
}: WorldLoadingScreenProps) {
  const [tipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [timedOut, setTimedOut] = useState(false);
  const doneRef = useRef(false);
  const type = useMemo(() => getWorldType(worldType), [worldType]);

  // Read the completion callback through a ref. While the world is starting up
  // the parent (App) re-renders frequently — every HUD telemetry tick hands us
  // a fresh inline `onComplete`. If the completion timers below depended on
  // that callback, they would be reset on every re-render and could never fire,
  // leaving the player stuck on the loading overlay (or, once it does dismiss,
  // on the black "eyes shut" awakening). The ref keeps the timers stable.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const latestProgressRef = useRef(loadingProgress);
  latestProgressRef.current = loadingProgress;

  const percent = Math.max(0, Math.min(100, loadingProgress?.percent ?? 0));
  const stageLabel = loadingProgress?.label ?? 'Waiting for renderer…';
  const ready = Boolean(loadingProgress?.ready);
  const elapsedSeconds = Math.max(0, Math.floor((loadingProgress?.elapsedMs ?? 0) / 1000));
  const chunkDetail = loadingProgress?.loadedChunks !== undefined && loadingProgress.totalChunks !== undefined
    ? `${loadingProgress.loadedChunks}/${loadingProgress.totalChunks} chunks`
    : null;

  useEffect(() => {
    if (!loadingProgress?.ready || doneRef.current) return;
    const timer = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onCompleteRef.current();
    }, reducedMotion ? 80 : 420);
    return () => window.clearTimeout(timer);
  }, [loadingProgress?.ready, reducedMotion]);

  // Defensive cap: only reveal gameplay after controls are wired (76%+). The
  // previous unconditional timer hid this overlay even when initialization had
  // crashed at 42%, which exposed exactly the reported HUD-over-black-canvas
  // state. A real startup error or an earlier stall now stays visible with
  // recovery actions instead.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (doneRef.current) return;
      const latest = latestProgressRef.current;
      if (latest?.error || (latest?.percent ?? 0) < 76) {
        setTimedOut(true);
        return;
      }
      doneRef.current = true;
      onCompleteRef.current();
    }, SAFETY_COMPLETE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="world-loading" role="status" aria-live="polite">
      {/* Real 3D warp tunnel: neon tube corridor + hyperdrive starfield +
          neuron fibres + fresnel Cosmic Entity, driven by the loading %.
          This fully replaces the old flat CSS particle 'snowstorm'. */}
      <WarpTunnel3D progress={percent} ready={ready} />

      {/* Centered overlay stays minimal so the warp is the star. */}
      <div className="wl-content">
        {(loadingProgress?.error || timedOut) && (
          <div className="wl-startup-error" role="alert">
            <strong>{loadingProgress?.error ? 'WORLD STARTUP FAILED' : 'WORLD STARTUP IS TAKING TOO LONG'}</strong>
            <span>
              {loadingProgress?.error
                ? loadingProgress.error
                : 'The renderer did not reach a playable state. Retry instead of opening a blank world.'}
            </span>
            <div className="wl-error-actions">
              {onRetry && <button type="button" onClick={onRetry}>Retry renderer</button>}
              {onCancel && <button type="button" onClick={onCancel}>Back to worlds</button>}
            </div>
          </div>
        )}

        <div className="wl-tip">
          <span className="wl-tip-label">TIP</span>
          <span className="wl-tip-text">{TIPS[tipIndex]}</span>
        </div>
      </div>

      {/* Bottom readout: tiny world info tucked right above the purple bar. */}
      <div className="wl-bottom">
        <div className="wl-world-meta-tiny">
          <span className="wl-world-name-tiny">{worldName}</span>
          <span className="wl-dot">•</span>
          <span>{type.name}</span>
          <span className="wl-dot">•</span>
          <span className="wl-seed-tiny">Seed {seed}</span>
          <span className="wl-dot">•</span>
          <span className="wl-stage-tiny">{stageLabel}</span>
        </div>
      </div>

      {/* Purple loading bar pinned to the very bottom of the screen. */}
      <div className="wl-bar-block">
        <div className="wl-bar-row">
          <span className="wl-stage-small">{chunkDetail ?? 'Loading terrain'}</span>
          <span className="wl-pct">{Math.round(percent)}%</span>
        </div>
        <div className="wl-bar-track" aria-label={`World loading ${Math.round(percent)} percent`}>
          <div className="wl-bar-fill" style={{ width: `${percent}%` }} />
          <div className="wl-bar-segments" aria-hidden="true">
            {Array.from({ length: 20 }, (_, i) => <span key={i} />)}
          </div>
        </div>
        <div className="wl-load-detail">
          <span>Entering the cosmos…</span>
          <span>{elapsedSeconds}s</span>
        </div>
      </div>
    </div>
  );
}

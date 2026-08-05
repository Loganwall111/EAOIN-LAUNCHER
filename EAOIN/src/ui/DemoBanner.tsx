/**
 * DemoBanner — a slim, always-visible HUD strip for the free EAOIN Demo.
 *
 * Shows:
 *   - A live "FREE DEMO" badge + a countdown for the current mode.
 *   - Singularity: 30-minute session countdown.
 *   - Experimental / Incredible: today's allowance countdown + when it resets.
 *
 * It renders nothing when not running the demo, so the full game is untouched.
 */
import { useEffect, useState } from 'react';
import {
  experimentalExhausted, formatMs, getDemoInfo,
  msUntilMidnight, singularityExhausted,
} from '../demo/DemoMode';

export function DemoBanner({ mode }: { mode?: 'singularity' | 'world' }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!getDemoInfo().isDemo) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const info = getDemoInfo();
  if (!info.isDemo) return null;

  const isSingularity = mode === 'singularity';
  const rem = isSingularity ? info.singularityRemainingMs : info.experimentalRemainingMs;
  const exhausted = isSingularity ? singularityExhausted() : experimentalExhausted();

  return (
    <div className={`demo-banner ${exhausted ? 'is-locked' : ''}`}>
      <span className="demo-banner-badge">🎮 FREE DEMO</span>
      <span className="demo-banner-text">
        {isSingularity ? (
          exhausted
            ? 'Singularity session over — the full journey is in the full game.'
            : `Singularity demo: ${formatMs(rem)} left`
        ) : (
          exhausted
            ? `Experimental modes used up — resets in ${formatMs(msUntilMidnight())}.`
            : `Experimental modes: ${formatMs(rem)} left today`
        )}
      </span>
      <span className="demo-banner-buy" onClick={() => { window.dispatchEvent(new CustomEvent('eaoin-demo-gotofull')); }}>
        Get the full game →
      </span>
    </div>
  );
}

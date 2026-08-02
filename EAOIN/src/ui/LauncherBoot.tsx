/**
 * LauncherBoot — the launcher's startup sequence.
 *
 * On first entering the site the launcher shows a quick cinematic boot before
 * the launcher itself appears: "WELCOME TO EAOIN" in caps, then a warp-style
 * flash with the studio name, a "loading…" cue, and a handoff to the launcher.
 * Self-contained and skippable.
 */
import { useEffect, useState } from 'react';

interface LauncherBootProps {
  onComplete: () => void;
}

export default function LauncherBoot({ onComplete }: LauncherBootProps) {
  const [stage, setStage] = useState<'welcome' | 'warp' | 'done'>('welcome');

  useEffect(() => {
    // Welcome (1.4s) → warp flash (1.1s) → done.
    const t1 = window.setTimeout(() => setStage('warp'), 1400);
    const t2 = window.setTimeout(() => { setStage('done'); onComplete(); }, 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  if (stage === 'done') return null;

  return (
    <div className={`launcher-boot ${stage}`}>
      {stage === 'welcome' && (
        <div className="lb-welcome">
          <div className="lb-title">WELCOME TO EAOIN</div>
          <div className="lb-sub">Loading launcher…</div>
        </div>
      )}
      {stage === 'warp' && (
        <div className="lb-warp">
          <div className="lb-warp-tunnel" />
          <div className="lb-warp-ring lb-warp-ring-1" />
          <div className="lb-warp-ring lb-warp-ring-2" />
          <div className="lb-warp-ring lb-warp-ring-3" />
          <div className="lb-warp-text"><span>ONEBLOCKAWAY STUDIO</span>LAUNCHER</div>
          <div className="lb-warp-flash" />
        </div>
      )}
    </div>
  );
}

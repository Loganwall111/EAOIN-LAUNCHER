/**
 * CosmicGirlFigure — a procedural, animated voxel-style Cosmic Girl.
 *
 * Replaces the old static portrait. She is built from CSS blocks (head, face,
 * torso, two arms, two legs) and actually animates: she looks straight at you,
 * her arms wave gently, her legs sway, her torso bobs, and her mouth opens and
 * closes in real time with her voice (audio-driven lipsync via `mouth`).
 */
import { useEffect, useRef } from 'react';

interface Props {
  /** Audio-driven mouth openness, 0 (closed) … 1 (wide). */
  mouth?: number;
}

export default function CosmicGirlFigure({ mouth = 0 }: Props) {
  // Occasionally blink: fade the eyes for a few hundred ms.
  const blinkRef = useRef(false);
  useEffect(() => {
    const t = window.setTimeout(() => { blinkRef.current = true; }, 1200);
    const off = window.setTimeout(() => { blinkRef.current = false; }, 2100);
    const t2 = window.setTimeout(() => { blinkRef.current = true; }, 5200);
    const off2 = window.setTimeout(() => { blinkRef.current = false; }, 5800);
    return () => { clearTimeout(t); clearTimeout(off); clearTimeout(t2); clearTimeout(off2); };
  }, []);

  const mouthScale = 0.25 + Math.min(1, Math.max(0, mouth)) * 1.4;

  return (
    <div className="cosmic-figure" aria-label="The Cosmic Girl">
      {/* Floating glow aura behind the whole figure */}
      <div className="cg-aura" aria-hidden="true" />

      {/* Head + face */}
      <div className="cg-head">
        <div className="cg-hair" aria-hidden="true" />
        <div className="cg-face">
          <div className="cg-eyes">
            <span className={`cg-eye cg-eye-l ${blinkRef.current ? 'blink' : ''}`} />
            <span className={`cg-eye cg-eye-r ${blinkRef.current ? 'blink' : ''}`} />
          </div>
          <div className="cg-mouth" style={{ transform: `scaleY(${mouthScale})` }}>
            <span className="cg-mouth-inner" />
          </div>
        </div>
      </div>

      {/* Torso */}
      <div className="cg-body">
        <div className="cg-chest-mark" aria-hidden="true" />
      </div>

      {/* Arms (wave gently) */}
      <div className="cg-arm cg-arm-l" aria-hidden="true"><span className="cg-hand" /></div>
      <div className="cg-arm cg-arm-r" aria-hidden="true"><span className="cg-hand" /></div>

      {/* Legs (sway) */}
      <div className="cg-leg cg-leg-l" aria-hidden="true"><span className="cg-foot" /></div>
      <div className="cg-leg cg-leg-r" aria-hidden="true"><span className="cg-foot" /></div>
    </div>
  );
}

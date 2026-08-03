/**
 * TouchControls — on-screen mobile controls for EAOIN.
 *
 * Rendered over the live 3D world when the "Touch controls" setting is on. It
 * gives you:
 *   - A virtual left joystick to walk / look around.
 *   - Action buttons: MINE, PLACE, JUMP, FLY, INVENTORY, CHAT, PAUSE and a
 *     hotbar next/prev stepper.
 *   - A small "console" (command) button that opens the command console.
 *
 * Input is sent to the engine over the window:
 *   - `eaoin-touch-move` with `{ x, y }` joystick values (-1..1).
 *   - `eaoin-touch-action` with an `{ action }` string.
 */
import { useRef, useState } from 'react';

interface TouchControlsProps {
  /** Matches the "Touch controls" setting. When false, nothing renders. */
  enabled: boolean;
}

const STICK_RADIUS = 52;

function dispatchAction(action: string): void {
  window.dispatchEvent(new CustomEvent('eaoin-touch-action', { detail: { action } }));
}

function HoldButton({ label, action, hint }: { label: string; action: string; hint: string }) {
  return (
    <button
      type="button"
      className={`tc-btn tc-${action}`}
      aria-label={hint}
      title={hint}
      onPointerDown={(e) => { e.preventDefault(); dispatchAction(action); }}
    >
      {label}
    </button>
  );
}

export default function TouchControls({ enabled }: TouchControlsProps) {
  const stickRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  if (!enabled) return null;

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const emitStick = (dx: number, dy: number) => {
    const maxD = STICK_RADIUS;
    const len = Math.hypot(dx, dy);
    const nx = len > maxD ? (dx / len) * maxD : dx;
    const ny = len > maxD ? (dy / len) * maxD : dy;
    setKnob({ x: nx, y: ny });
    window.dispatchEvent(new CustomEvent('eaoin-touch-move', {
      detail: { x: clamp(nx / maxD, -1, 1), y: clamp(ny / maxD, -1, 1) },
    }));
  };

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = e.pointerId;
    const rect = stickRef.current?.getBoundingClientRect();
    if (rect) originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    emitStick(e.clientX - originRef.current.x, e.clientY - originRef.current.y);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    emitStick(e.clientX - originRef.current.x, e.clientY - originRef.current.y);
  };

  const onUp = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    window.dispatchEvent(new CustomEvent('eaoin-touch-move', { detail: { x: 0, y: 0 } }));
  };

  return (
    <div className="touch-controls" aria-label="Touch controls">
      {/* Left: virtual joystick */}
      <div
        ref={stickRef}
        className="tc-stick"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="tc-stick-base" />
        <div className="tc-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>

      {/* Right: action buttons */}
      <div className="tc-buttons">
        <HoldButton label="MINE" action="mine" hint="Mine / attack the targeted block" />
        <HoldButton label="PLACE" action="place" hint="Place the selected block" />
        <HoldButton label="⤒" action="jump" hint="Jump / swim up" />
        <HoldButton label="FLY" action="fly" hint="Toggle flight" />
        <HoldButton label="RUN" action="sprint" hint="Sprint (toggle)" />
        <HoldButton label="🎒" action="inventory" hint="Open inventory" />
        <HoldButton label="💬" action="chat" hint="Open chat" />
        <HoldButton label="❯❯" action="hotbarNext" hint="Next hotbar slot" />
        <HoldButton label="❮❮" action="hotbarPrev" hint="Previous hotbar slot" />
      </div>

      {/* Bottom centre: pause + command console */}
      <div className="tc-bottom">
        <button type="button" className="tc-btn" onClick={() => dispatchAction('command')} aria-label="Open command console" title="Console / commands">≣</button>
        <button type="button" className="tc-btn" onClick={() => dispatchAction('pause')} aria-label="Pause" title="Pause">⏸</button>
      </div>
    </div>
  );
}

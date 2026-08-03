/**
 * Arcade — a retro arcade cabinet in HorizonOS.
 *
 * Update Part 2: a futuristic matrix-styled arcade with two playable
 * cabinets — a classic "Pong" style game and a "Simon" memory light chase —
 * plus a mini CRT screen aesthetic.
 */
import { useEffect, useRef, useState } from 'react';

type ArcadeGame = 'none' | 'pong' | 'simon';

export default function Arcade() {
  const [game, setGame] = useState<ArcadeGame>('none');
  return (
    <div className="arcade">
      {game === 'none' && (
        <div className="arcade-menu">
          <div className="arcade-title">🕹 ARCAD E</div>
          <div className="arcade-cabinets">
            <button className="arcade-cab" onClick={() => setGame('pong')}>
              <span className="arcade-cab-icon">🏓</span>
              <strong>Neon Pong</strong>
              <small>Matrix-style Pong vs the machine.</small>
            </button>
            <button className="arcade-cab" onClick={() => setGame('simon')}>
              <span className="arcade-cab-icon">🎛</span>
              <strong>Simon Sequence</strong>
              <small>Repeat the blinking light pattern.</small>
            </button>
          </div>
          <p className="arcade-hint">New cabinets download with each OS update.</p>
        </div>
      )}
      {game === 'pong' && <NeonPong onExit={() => setGame('none')} />}
      {game === 'simon' && <SimonGame onExit={() => setGame('none')} />}
    </div>
  );
}

/* ----------------------------- Neon Pong ----------------------------- */

function NeonPong({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [over, setOver] = useState(false);
  const stateRef = useRef({
    px: 120, py: 120, // player paddle
    ex: 120, ey: 120, // enemy paddle
    bx: 160, by: 140, bvx: 2.4, bvy: 2.2,
    playerW: 10, playerH: 60,
    enemyW: 10, enemyH: 60,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = 320, H = 280;
    canvas.width = W; canvas.height = H;
    const s = stateRef.current;
    const enemyTarget = (s.by - s.enemyH / 2) * 0.12;

    const keys = { up: false, down: false };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') keys.up = true;
      if (e.key === 'ArrowDown' || e.key === 's') keys.down = true;
    };
    const offKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
      if (e.key === 'ArrowDown' || e.key === 's') keys.down = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', offKey);

    const tick = () => {
      // player
      if (keys.up) s.py -= 4.4;
      if (keys.down) s.py += 4.4;
      s.py = Math.max(4, Math.min(H - s.playerH - 4, s.py));
      // enemy
      s.ey += (enemyTarget - s.ey) * 0.06;
      s.ey = Math.max(4, Math.min(H - s.enemyH - 4, s.ey));

      // ball
      s.bx += s.bvx; s.by += s.bvy;
      if (s.by <= 4 || s.by >= H - 4) s.bvy *= -1;

      // paddles
      const hitPlayer = s.bvx < 0 && s.bx <= s.px + s.playerW + 6 && s.bx >= s.px - 6 && s.by > s.py - 6 && s.by < s.py + s.playerH + 6;
      const hitEnemy = s.bvx > 0 && s.bx >= s.ex - 6 && s.bx <= s.ex + s.enemyW + 6 && s.by > s.ey - 6 && s.by < s.ey + s.enemyH + 6;
      if (hitPlayer || hitEnemy) s.bvx *= -1.06;

      if (s.bx < -20) { setScore(([p, e]) => [p, e + 1]); resetBall(true); }
      if (s.bx > W + 20) { setScore(([p, e]) => [p + 1, e]); resetBall(false); }

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#02060a';
      ctx.fillRect(0, 0, W, H);
      // grid
      ctx.strokeStyle = 'rgba(77,255,158,0.10)';
      for (let g = 0; g < W; g += 32) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, H); ctx.stroke(); }
      for (let g = 0; g < H; g += 32) { ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(W, g); ctx.stroke(); }
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = 'rgba(77,255,158,0.5)';
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.setLineDash([]);
      // paddles
      ctx.shadowColor = '#4dff9e'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#4dff9e';
      ctx.fillRect(s.px, s.py, s.playerW, s.playerH);
      ctx.fillStyle = '#ff5a7a';
      ctx.fillRect(s.ex, s.ey, s.enemyW, s.enemyH);
      // ball
      ctx.beginPath(); ctx.arc(s.bx, s.by, 5, 0, Math.PI * 2); ctx.fillStyle = '#eafff2'; ctx.fill();
      ctx.shadowBlur = 0;
    };
    const iv = window.setInterval(tick, 16);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', offKey); clearInterval(iv); };
    function resetBall(dirToPlayer: boolean) { s.bx = W / 2; s.by = H / 2; s.bvx = (dirToPlayer ? -1 : 1) * 2.4; s.bvy = 2.2; }
  }, []);

  return (
    <div className="arcade-game">
      <div className="arcade-game-head">
        <span>🏓 Neon Pong</span>
        <span className="arcade-hud"><b>{score[0]}</b> : <b>{score[1]}</b></span>
        <button className="arcade-close" onClick={onExit}>✕</button>
      </div>
      <canvas ref={canvasRef} className="arcade-canvas" style={{ width: '100%', aspectRatio: '320/280' }} />
      <div className="arcade-hint">W/S or ↑/↓ to move. You are the green paddle on the left.</div>
      {over && <div className="arcade-overlay"><button onClick={() => { setScore([0,0]); setOver(false); }}>Restart</button></div>}
    </div>
  );
}

/* --------------------------- Simon Sequence --------------------------- */

const COLORS = ['#4dff9e', '#ffd166', '#5dd6ff', '#ff5a7a'];

function SimonGame({ onExit }: { onExit: () => void }) {
  const [sequence, setSequence] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [lit, setLit] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const seqRef = useRef<number[]>([]);
  const idxRef = useRef(0);
  const litRef = useRef<number | null>(null);
  const playingRef = useRef(false);

  const startRound = () => {
    const next = [...seqRef.current, Math.floor(Math.random() * 4)];
    seqRef.current = next;
    setSequence(next);
    setPlaying(true);
    playingRef.current = true;
    idxRef.current = 0;
    // Playback
    let i = 0;
    const iv = window.setInterval(() => {
      if (i >= next.length) {
        window.clearInterval(iv);
        setPlaying(false);
        playingRef.current = false;
        return;
      }
      litRef.current = next[i];
      setLit(next[i]);
      window.setTimeout(() => { litRef.current = null; setLit(null); }, 300);
      i += 1;
    }, 600);
    return iv;
  };

  const press = (c: number) => {
    if (playing) return;
    if (seqRef.current[idxRef.current] !== c) {
      setRound(0);
      setSequence([]);
      seqRef.current = [];
      return;
    }
    idxRef.current += 1;
    setLit(c);
    window.setTimeout(() => setLit(null), 200);
    if (idxRef.current >= seqRef.current.length) {
      setRound((r) => r + 1);
      window.setTimeout(() => startRound(), 700);
    }
  };

  return (
    <div className="arcade-game">
      <div className="arcade-game-head">
        <span>🎛 Simon Sequence</span>
        <span className="arcade-hud">ROUND <b>{round}</b></span>
        <button className="arcade-close" onClick={onExit}>✕</button>
      </div>
      <div className="simon">
        {COLORS.map((c, i) => (
          <button key={i} className={`simon-pad ${lit === i ? 'lit' : ''}`} style={{ '--sc': c } as React.CSSProperties} onClick={() => press(i)} />
        ))}
      </div>
      <div className="arcade-hint">Watch the lights, then repeat the sequence. The pattern grows each round.</div>
      {round === 0 && sequence.length === 0 && <button className="arcade-start" onClick={startRound}>▶ Start</button>}
    </div>
  );
}

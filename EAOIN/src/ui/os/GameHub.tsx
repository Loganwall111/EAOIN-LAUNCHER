/**
 * HorizonOS Game Hub — built-in playable mini-games.
 *
 * Ships with two games you can actually play inside the OS:
 *   - Arena Shooter  : click the warp-flecks before they fly away.
 *   - Memory Cards   : classic match-the-pair card game.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type GameId = 'none' | 'shooter' | 'cards' | 'snake';

export default function GameHub() {
  const [game, setGame] = useState<GameId>('none');

  return (
    <div className="gamehub">
      {game === 'none' && (
        <div className="gh-launcher">
          <div className="gh-title">🎮 Game Hub</div>
          <div className="gh-cards">
            <button className="gh-card" onClick={() => setGame('shooter')}>
              <span className="gh-card-icon">🎯</span>
              <strong>Arena Shooter</strong>
              <small>Blast the warp-flecks. Fast hands win.</small>
              <span className="gh-play">▶ Play</span>
            </button>
            <button className="gh-card" onClick={() => setGame('cards')}>
              <span className="gh-card-icon">🃏</span>
              <strong>Memory Cards</strong>
              <small>Match the pairs. Trains your cosmic recall.</small>
              <span className="gh-play">▶ Play</span>
            </button>
            <button className="gh-card" onClick={() => setGame('snake')}>
              <span className="gh-card-icon">🐍</span>
              <strong>Neon Snake</strong>
              <small>Eat the motes. Don't eat yourself.</small>
              <span className="gh-play">▶ Play</span>
            </button>
          </div>
          <p className="gh-hint">More arcade cabinets arrive with each OS update.</p>
        </div>
      )}

      {game === 'shooter' && <ArenaShooter onExit={() => setGame('none')} />}
      {game === 'cards' && <MemoryCards onExit={() => setGame('none')} />}
      {game === 'snake' && <SnakeGame onExit={() => setGame('none')} />}
    </div>
  );
}

/* ------------------------------- Neon Snake ------------------------------ */

const GRID = 20;

function SnakeGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [hi, setHi] = useState<number>(() => Number(localStorage.getItem('eaoin_os_snake_hi') ?? 0));
  const [over, setOver] = useState(false);
  const stateRef = useRef({ snake: [{ x: 9, y: 9 }], dir: { x: 1, y: 0 }, food: { x: 4, y: 4 }, alive: true });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.clientWidth;
    canvas.width = size;
    canvas.height = size;
    const cell = size / GRID;
    const s = stateRef.current;

    // Place initial food.
    const placeFood = () => {
      while (true) {
        const f = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
        if (!s.snake.some((seg) => seg.x === f.x && seg.y === f.y)) { s.food = f; return; }
      }
    };
    placeFood();

    const tick = () => {
      if (!s.alive) { draw(); return; }
      const head = s.snake[0];
      const nx = head.x + s.dir.x;
      const ny = head.y + s.dir.y;
      const hitWall = nx < 0 || ny < 0 || nx >= GRID || ny >= GRID;
      const hitSelf = s.snake.some((seg) => seg.x === nx && seg.y === ny);
      if (hitWall || hitSelf) {
        s.alive = false;
        setOver(true);
        setScore((sc) => { if (sc > hi) { setHi(sc); localStorage.setItem('eaoin_os_snake_hi', String(sc)); } return sc; });
        draw();
        return;
      }
      s.snake.unshift({ x: nx, y: ny });
      if (nx === s.food.x && ny === s.food.y) {
        setScore((sc) => sc + 1);
        placeFood();
      } else {
        s.snake.pop();
      }
      draw();
    };

    const draw = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < GRID; i++) {
        for (let j = 0; j < GRID; j++) {
          ctx.strokeStyle = 'rgba(90,150,255,0.06)';
          ctx.strokeRect(i * cell, j * cell, cell, cell);
        }
      }
      // food
      ctx.fillStyle = '#7ad8ff';
      ctx.shadowColor = '#7ad8ff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(s.food.x * cell + cell / 2, s.food.y * cell + cell / 2, cell * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // snake
      s.snake.forEach((seg, i) => {
        ctx.fillStyle = i === 0 ? '#39e08a' : '#1f9a5a';
        ctx.shadowColor = '#39e08a'; ctx.shadowBlur = i === 0 ? 14 : 6;
        ctx.fillRect(seg.x * cell + 1, seg.y * cell + 1, cell - 2, cell - 2);
      });
      ctx.shadowBlur = 0;
    };

    const onKey = (e: KeyboardEvent) => {
      const d = s.dir;
      const map: Record<string, { x: number; y: number }> = {
        ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
      };
      const next = map[e.key];
      if (next && !(next.x === -d.x && next.y === -d.y)) s.dir = next;
    };
    window.addEventListener('keydown', onKey);
    const iv = window.setInterval(tick, 110);

    return () => { window.removeEventListener('keydown', onKey); clearInterval(iv); };
  }, [hi]);

  const restart = () => {
    stateRef.current = { snake: [{ x: 9, y: 9 }], dir: { x: 1, y: 0 }, food: { x: 4, y: 4 }, alive: true };
    setScore(0);
    setOver(false);
  };

  return (
    <div className="gh-game">
      <div className="gh-game-head">
        <span>🐍 Neon Snake</span>
        <span className="gh-hud"><b>SCORE {score}</b> • 🏆 {hi}</span>
        <button className="gh-tool" onClick={onExit}>✕</button>
      </div>
      <div className="snake-wrap">
        <canvas ref={canvasRef} className="snake-canvas" />
        <div className="gh-hint">Arrow keys / WASD to steer. Don't hit the walls or yourself.</div>
      </div>
      {over && (
        <div className="gh-overlay">
          <div className="gh-overlay-card">
            <h2>💥 Game Over</h2>
            <p>Score: <b>{score}</b> {score >= hi && score > 0 ? '— new record!' : ''}</p>
            <div className="gh-overlay-actions">
              <button className="gh-btn" onClick={restart}>↻ Play Again</button>
              <button className="gh-btn" onClick={onExit}>← Hub</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Arena Shooter ----------------------------- */

const FLEET_COUNT = 12;

interface Fleck {
  id: number;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  hue: number;
}

function ArenaShooter({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [over, setOver] = useState(false);
  const flecksRef = useRef<Fleck[]>([]);
  const [highScore, setHighScore] = useState<number>(() => Number(localStorage.getItem('eaoin_os_shooter_hi') ?? 0));

  const spawn = useCallback((w: number, h: number): Fleck[] => {
    const list: Fleck[] = [];
    for (let i = 0; i < FLEET_COUNT; i += 1) {
      list.push({
        id: i,
        x: 40 + Math.random() * (w - 80),
        y: 30 + Math.random() * (h - 70),
        r: 10 + Math.random() * 12,
        vx: (Math.random() - 0.5) * 2.4,
        vy: (Math.random() - 0.5) * 2.4,
        hue: Math.floor(Math.random() * 360),
      });
    }
    return list;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    flecksRef.current = spawn(w, h);
    let raf = 0;
    let dead = 0;

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, w, h);

      // grid backdrop
      ctx.strokeStyle = 'rgba(80,150,255,0.12)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
      for (let gy = 0; gy < h; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

      for (const f of flecksRef.current) {
        f.x += f.vx;
        f.y += f.vy;
        if (f.x < f.r || f.x > w - f.r) f.vx *= -1;
        if (f.y < f.r || f.y > h - f.r) f.vy *= -1;
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 2.2);
        grad.addColorStop(0, `hsla(${f.hue},100%,70%,0.95)`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${f.hue},100%,85%,1)`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (dead < 9999) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const remaining = flecksRef.current.filter((f) => {
        const dx = f.x - x; const dy = f.y - y;
        return !(dx * dx + dy * dy < f.r * f.r * 2.2);
      });
      const hit = flecksRef.current.length - remaining.length;
      flecksRef.current = remaining;
      if (hit > 0) setScore((s) => s + hit);
      if (remaining.length === 0) {
        setOver(true);
        setScore((s) => {
          const total = s;
          if (total > highScore) { setHighScore(total); localStorage.setItem('eaoin_os_shooter_hi', String(total)); }
          return total;
        });
      }
    };
    canvas.addEventListener('pointerdown', onPointer);
    void dead;

    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          setOver(true);
          setScore((s) => {
            if (s > highScore) { setHighScore(s); localStorage.setItem('eaoin_os_shooter_hi', String(s)); }
            return s;
          });
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      canvas.removeEventListener('pointerdown', onPointer);
    };
  }, [spawn, highScore]);

  const restart = () => {
    setScore(0);
    setTimeLeft(30);
    setOver(false);
    flecksRef.current = [];
  };

  return (
    <div className="gh-game">
      <div className="gh-game-head">
        <span>🎯 Arena Shooter</span>
        <span className="gh-hud">
          <b>SCORE {score}</b> • ⏱ {timeLeft}s • 🏆 {highScore}
        </span>
        <button className="gh-tool" onClick={onExit}>✕</button>
      </div>
      <canvas ref={canvasRef} className="gh-canvas" style={{ width: '100%', height: 340 }} />
      <div className="gh-hint">Click the warp-flecks. Clear the board to win.</div>
      {over && (
        <div className="gh-overlay">
          <div className="gh-overlay-card">
            <h2>{score > highScore - 1 && score > 0 ? '🏆 New Record!' : 'Game Over'}</h2>
            <p>Final score: <b>{score}</b> {score >= FLEET_COUNT ? '— you cleared the board!' : ''}</p>
            <div className="gh-overlay-actions">
              <button className="gh-btn" onClick={restart}>↻ Play Again</button>
              <button className="gh-btn" onClick={onExit}>← Hub</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Memory Cards ----------------------------- */

const EMOJIS = ['🦋', '🌟', '🌙', '🪐', '🌊', '🗿', '🧭', '🍄'];

function MemoryCards({ onExit }: { onExit: () => void }) {
  const [deck, setDeck] = useState<{ id: number; emoji: string; flipped: boolean; matched: boolean }[]>(() =>
    [...EMOJIS, ...EMOJIS]
      .map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }))
      .sort(() => Math.random() - 0.5)
  );
  const [picks, setPicks] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [best, setBest] = useState<number>(() => Number(localStorage.getItem('eaoin_os_cards_best') ?? 0));

  const matchedCount = deck.filter((c) => c.matched).length;

  useEffect(() => {
    if (matchedCount === deck.length && deck.length > 0 && !won) {
      setWon(true);
      if (moves > 0 && (best === 0 || moves < best)) {
        setBest(moves);
        localStorage.setItem('eaoin_os_cards_best', String(moves));
      }
    }
  }, [matchedCount, deck.length, moves, best, won]);

  const pick = (id: number) => {
    if (won) return;
    const card = deck.find((c) => c.id === id);
    if (!card || card.flipped || card.matched) return;
    const nextDeck = deck.map((c) => (c.id === id ? { ...c, flipped: true } : c));
    const nextPicks = [...picks, id];
    setDeck(nextDeck);
    setPicks(nextPicks);

    if (nextPicks.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = nextPicks;
      const ca = nextDeck.find((c) => c.id === a)!;
      const cb = nextDeck.find((c) => c.id === b)!;
      window.setTimeout(() => {
        setDeck((d) =>
          d.map((c) => {
            if (c.id === a || c.id === b) {
              if (ca.emoji === cb.emoji) return { ...c, matched: true, flipped: false };
              return { ...c, flipped: false };
            }
            return c;
          })
        );
        setPicks([]);
      }, 550);
    }
  };

  const reset = () => {
    setDeck([...EMOJIS, ...EMOJIS].map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false })).sort(() => Math.random() - 0.5));
    setPicks([]);
    setMoves(0);
    setWon(false);
  };

  return (
    <div className="gh-game">
      <div className="gh-game-head">
        <span>🃏 Memory Cards</span>
        <span className="gh-hud">
          <b>MOVES {moves}</b> • pairs {matchedCount / 2}/{EMOJIS.length} • 🏆 {best ? `${best} moves` : '—'}
        </span>
        <button className="gh-tool" onClick={onExit}>✕</button>
      </div>
      <div className="gh-cards-grid">
        {deck.map((c) => (
          <button
            key={c.id}
            className={`gh-card-face ${c.flipped || c.matched ? 'flipped' : ''} ${c.matched ? 'matched' : ''}`}
            onClick={() => pick(c.id)}
          >
            <span className="gh-face-back">?</span>
            <span className="gh-face-front">{c.emoji}</span>
          </button>
        ))}
      </div>
      <div className="gh-hint">Find all {EMOJIS.length} pairs.</div>
      {won && (
        <div className="gh-overlay">
          <div className="gh-overlay-card">
            <h2>🎉 All pairs found!</h2>
            <p>Cleared in <b>{moves}</b> moves{best && moves <= best ? ' — new best!' : ''}.</p>
            <div className="gh-overlay-actions">
              <button className="gh-btn" onClick={reset}>↻ Play Again</button>
              <button className="gh-btn" onClick={onExit}>← Hub</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

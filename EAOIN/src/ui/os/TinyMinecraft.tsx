/**
 * TinyMinecraft — a playable miniature "EAOIN" block game inside HorizonOS.
 *
 * Update Part 2: an embedded 2D voxel sandbox — you can move, jump, mine blocks
 * with your cursor, and place the selected block. It reads like a tiny slice
 * of the full game in a browser window.
 */
import { useEffect, useRef, useState } from 'react';

const COLS = 32;
const ROWS = 22;

const BLOCKS: Record<string, { id: number; name: string; color: string }> = {
  grass: { id: 1, name: 'Grass', color: '#6cc24a' },
  dirt: { id: 2, name: 'Dirt', color: '#8a5a36' },
  stone: { id: 3, name: 'Stone', color: '#8a8a8c' },
  obsidian: { id: 12, name: 'Obsidian', color: '#20152f' },
  wood: { id: 6, name: 'Oak', color: '#6b3f1d' },
  crystal: { id: 16, name: 'Crystal', color: '#63d7ff' },
  gold: { id: 10, name: 'Gold', color: '#ffd166' },
};
const ORDER = ['grass', 'dirt', 'stone', 'wood', 'obsidian', 'crystal', 'gold'];

type Cell = { type: string; y: number };

export default function TinyMinecraft() {
  const [world, setWorld] = useState<Cell[]>(() => {
    const w: Cell[] = [];
    for (let i = 0; i < COLS * ROWS; i++) w.push({ type: 'air', y: 0 });
    // terrain: grass top, dirt, then stone
    for (let x = 0; x < COLS; x++) {
      const ground = 16;
      for (let y = 0; y < ROWS; y++) {
        let type = 'air';
        if (y === ground) type = 'grass';
        else if (y > ground && y <= ground + 3) type = 'dirt';
        else if (y > ground + 3) type = 'stone';
        w[y * COLS + x] = { type, y };
      }
    }
    return w;
  });
  const [player, setPlayer] = useState({ x: 8, y: 12, vy: 0 });
  const [selected, setSelected] = useState('grass');
  const [px, setPx] = useState(-1);
  const [py, setPy] = useState(-1);
  const heldRef = useRef(false);
  const playerRef = useRef(player);
  playerRef.current = player;
  const worldRef = useRef(world);
  worldRef.current = world;

  const blockAt = (x: number, y: number): Cell | undefined => {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return undefined;
    return worldRef.current[y * COLS + x];
  };

  const solidAt = (x: number, y: number): boolean => {
    const b = blockAt(x, y);
    return !!b && b.type !== 'air';
  };

  // Physics tick.
  useEffect(() => {
    const iv = window.setInterval(() => {
      const p = playerRef.current;
      let ny = p.y;
      // gravity
      if (!solidAt(p.x, p.y + 1)) {
        ny = p.y + 1;
      }
      setPlayer((cur) => ({ ...cur, y: Math.min(ny, ROWS - 2), vy: ny > cur.y ? cur.vy : 0 }));
    }, 90);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    const p = playerRef.current;
    void p;
    if (e.key === 'ArrowLeft' || e.key === 'a') setPlayer((c) => ({ ...c, x: solidAt(c.x - 1, c.y) ? c.x : Math.max(0, c.x - 1) }));
    if (e.key === 'ArrowRight' || e.key === 'd') setPlayer((c) => ({ ...c, x: solidAt(c.x + 1, c.y) ? c.x : Math.min(COLS - 1, c.x + 1) }));
    if ((e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') && solidAt(p.x, p.y + 1)) {
      setPlayer((c) => ({ ...c, y: Math.max(0, c.y - 4) }));
    }
  };

  // pointer: mine on left-drag, place on right-drag
  useEffect(() => {
    const down = () => { heldRef.current = true; };
    const up = () => { heldRef.current = false; };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); };
  }, []);

  const interact = (x: number, y: number, place: boolean) => {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    setWorld((w) => {
      const next = [...w];
      const idx = y * COLS + x;
      if (place) next[idx] = { type: selected, y };
      else next[idx] = { type: 'air', y };
      return next;
    });
  };

  return (
    <div className="tiny-mc" tabIndex={0} onKeyDown={onKey}>
      <div className="tiny-mc-head">
        <span>⛏ EAOIN Mini</span>
        <span className="tiny-mc-hud">WASD/arrows move • mine/place</span>
      </div>
      <div className="tiny-mc-hotbar">
        {ORDER.map((b) => (
          <button key={b} className={`tiny-mc-slot ${selected === b ? 'sel' : ''}`} onClick={() => setSelected(b)} style={{ background: BLOCKS[b].color }}>
            <span className="tiny-mc-slot-name">{BLOCKS[b].name}</span>
          </button>
        ))}
      </div>
      <div className="tiny-mc-world" onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPx(Math.floor((e.clientX - rect.left) / rect.width * COLS));
        setPy(Math.floor((e.clientY - rect.top) / rect.height * ROWS));
      }}
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = Math.floor((e.clientX - rect.left) / rect.width * COLS);
          const y = Math.floor((e.clientY - rect.top) / rect.height * ROWS);
          heldRef.current = true;
          interact(x, y, e.button === 2);
        }}
        onPointerUp={() => { heldRef.current = false; }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {world.map((c, i) => {
          const x = i % COLS;
          const y = Math.floor(i / COLS);
          const isPlayer = Math.round(player.x) === x && Math.round(player.y) === y;
          const isHover = px === x && py === y;
          return (
            <div key={i} className={`tiny-mc-cell ${isHover ? 'hover' : ''}`} style={{
              background: c.type !== 'air' ? BLOCKS[c.type].color : undefined,
              gridColumn: x + 1, gridRow: y + 1,
            }}>
              {isPlayer && <span className="tiny-mc-player">🧍</span>}
              {isHover && <span className="tiny-mc-cross">+</span>}
            </div>
          );
        })}
      </div>
      <div className="tiny-mc-hint">Left-drag to mine • Right-drag to place • Jump with Space. A tiny slice of the real game.</div>
    </div>
  );
}

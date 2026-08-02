/**
 * HorizonOS — an in-game virtual desktop (Windows-7 inspired).
 *
 * A modern-meets-old-fashioned desktop with movable, stacked windows and a
 * taskbar. Boots to a terminal ("loading servers… loading ARC… attaching
 * services… booting… login detected as guest"), then offers a Guest session or
 * an Administrator login. Guest starts instantly; Administrator runs a small
 * authentication screen and a realistic "welcome on board" audio cue.
 *
 * Built-in apps:
 *   - Terminal (the boot console)
 *   - Security Cameras (a lore screen)
 *   - Game Lore (world background notes)
 *   - Creator's Notes (the maker's comments)
 *   - Files (a fake file browser)
 */
import { useEffect, useRef, useState } from 'react';

export interface HorizonOSProps {
  onExit: () => void;
}

interface OSWindow {
  id: string;
  title: string;
  icon: string;
  x: number;
  y: number;
  z: number;
  open: boolean;
  minimized: boolean;
}

const WINDOW_DEFS: Array<Omit<OSWindow, 'x' | 'y' | 'z' | 'open' | 'minimized'>> = [
  { id: 'terminal', title: 'Terminal', icon: '🖥️' },
  { id: 'cameras', title: 'Security Cameras', icon: '📹' },
  { id: 'lore', title: 'Game Lore', icon: '📖' },
  { id: 'notes', title: "Creator's Notes", icon: '✍️' },
  { id: 'files', title: 'Files', icon: '📁' },
];

const BOOT_LINES = [
  'loading servers …',
  'loading ARC …',
  'attaching services …',
  'booting HorizonOS …',
  'login detected as GUEST',
];

const SECURITY_LOG = [
  { cam: 'CAM-01', desc: 'Overworld spawn — clear skies, no anomalies.', time: '00:04' },
  { cam: 'CAM-02', desc: 'Nether gate — heat bloom steady.', time: '00:07' },
  { cam: 'CAM-03', desc: 'Deep Ocean trench — the Bloop silhouette passes.', time: '00:11' },
  { cam: 'CAM-04', desc: 'Sky Kingdom — a rift flickers at the edge.', time: '00:14' },
  { cam: 'CAM-05', desc: 'Backrooms — lights flicker. Something moves.', time: '00:19' },
  { cam: 'CAM-06', desc: 'Corrupted Lands — Oris is visible on the horizon.', time: '00:22' },
];

const LORE_NOTES = [
  'The world of EAOIN was forged from the fractured memories of an older reality.',
  'Every dimension is a room in a house that was never finished.',
  'The Cosmic Girl is not a person. She is the last surviving fragment of the narrator.',
  'Chorus is not a plant. It is a signal.',
  'The Backrooms were never supposed to be reachable. Some doors should stay shut.',
];

const CREATOR_NOTES = [
  'If you are reading this, the bootstrap worked.',
  'HorizonOS started as a joke. Now it is the backbone of the meta.',
  'The real easter egg is the amount of time spent on the grass texture.',
  'Logan1234 opens a lot of doors. This is one of them.',
  'Make sure to check the hidden chest after the Psychedelics moon.',
];

export default function HorizonOS({ onExit }: HorizonOSProps) {
  const [stage, setStage] = useState<'boot' | 'login' | 'guest' | 'admin'>('boot');
  const [bootLine, setBootLine] = useState(0);
  const [user, setUser] = useState('guest');
  const [windows, setWindows] = useState<OSWindow[]>(() =>
    WINDOW_DEFS.map((d, i) => ({ ...d, x: 120 + i * 40, y: 80 + i * 34, z: i, open: false, minimized: false }))
  );
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');
  const topRef = useRef(10);

  // Boot sequence: type out the terminal lines one at a time.
  useEffect(() => {
    if (stage !== 'boot') return;
    if (bootLine < BOOT_LINES.length) {
      const t = window.setTimeout(() => setBootLine((b) => b + 1), 650);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setStage('login'), 700);
    return () => window.clearTimeout(t);
  }, [stage, bootLine]);

  const bringToFront = (id: string) => {
    topRef.current += 1;
    void topRef.current;
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, z: topRef.current, minimized: false } : w)));
  };

  const toggleWindow = (id: string) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, open: !w.open, z: ++topRef.current, minimized: false } : w)));
    void topRef.current;
  };

  const openDefault = (id: string) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, open: true, z: ++topRef.current } : w)));
    void topRef.current;
  };

  const startGuest = () => {
    setUser('guest');
    setStage('guest');
  };

  const submitAdmin = () => {
    if (adminPass.toLowerCase() === 'logan1234') {
      setUser('administrator');
      setStage('admin');
      // Realistic welcome voice cue.
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const u = new SpeechSynthesisUtterance('Welcome on board, administrator.');
        u.rate = 0.95;
        window.speechSynthesis?.speak(u);
        void ctx.resume();
      } catch { /* voice is best-effort */ }
    } else {
      setAdminError('Access denied — invalid administrator credentials.');
    }
  };

  // -------- Boot / login screens --------
  if (stage === 'boot') {
    return (
      <div className="hzos hzos-boot">
        <div className="hzos-terminal">
          <div className="hzos-term-head">HorizonOS Boot</div>
          <div className="hzos-term-body">
            {BOOT_LINES.slice(0, bootLine).map((l) => (
              <div key={l} className="hzos-term-line">{l}</div>
            ))}
            {bootLine < BOOT_LINES.length && <div className="hzos-cursor">▌</div>}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'login') {
    return (
      <div className="hzos hzos-login">
        <div className="hzos-login-card">
          <div className="hzos-logo">🖥️ HorizonOS</div>
          <p className="hzos-tag">Select an account</p>
          <button className="hzos-account" onClick={startGuest}>
            <span className="hzos-avatar">🧑</span> Guest
          </button>
          <button className="hzos-account" onClick={() => setStage('admin')}>
            <span className="hzos-avatar">🛡️</span> Administrator
          </button>
          <button className="hzos-exit" onClick={onExit}>← Back</button>
        </div>
      </div>
    );
  }

  if (stage === 'admin') {
    return (
      <div className="hzos hzos-login">
        <div className="hzos-login-card">
          <div className="hzos-logo">🛡️ Administrator</div>
          <input
            className="ui-input"
            type="password"
            placeholder="Administrator password"
            value={adminPass}
            onChange={(e) => setAdminPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitAdmin()}
          />
          {adminError && <p className="hzos-error">{adminError}</p>}
          <button className="hzos-account" onClick={submitAdmin}>Sign in</button>
          <button className="hzos-exit" onClick={() => { setStage('login'); setAdminPass(''); setAdminError(''); }}>← Back</button>
        </div>
      </div>
    );
  }

  // -------- Desktop --------
  const openWindows = windows.filter((w) => w.open && !w.minimized);
  const anyOpen = windows.some((w) => w.open && !w.minimized);

  return (
    <div className="hzos hzos-desktop" onDoubleClick={(e) => { const t = e.target as HTMLElement; if (t.classList.contains('hzos-desktop')) onExit(); }}>
      {/* Wallpaper + desktop icons */}
      <div className="hzos-wallpaper" />
      <div className="hzos-icons">
        {WINDOW_DEFS.map((d) => (
          <button key={d.id} className="hzos-icon" onDoubleClick={() => openDefault(d.id)}>
            <span className="hzos-icon-img">{d.icon}</span>
            <span>{d.title}</span>
          </button>
        ))}
      </div>

      {/* Windows */}
      {openWindows.map((w) => (
        <div
          key={w.id}
          className="hzos-window"
          style={{ left: w.x, top: w.y, zIndex: w.z }}
          onMouseDown={() => bringToFront(w.id)}
        >
          <div className="hzos-window-head">
            <span>{w.icon} {w.title}</span>
            <span className="hzos-window-actions">
              <button onClick={() => setWindows((ws) => ws.map((x) => x.id === w.id ? { ...x, minimized: true } : x))}>─</button>
              <button onClick={() => setWindows((ws) => ws.map((x) => x.id === w.id ? { ...x, open: false } : x))}>✕</button>
            </span>
          </div>
          <div className="hzos-window-body">
            {w.id === 'terminal' && (
              <div className="hzos-term-body">
                {BOOT_LINES.map((l) => <div key={l} className="hzos-term-line">{l}</div>)}
                <div className="hzos-term-line hzos-term-ok">signed in as {user}</div>
              </div>
            )}
            {w.id === 'cameras' && (
              <div className="hzos-list">
                {SECURITY_LOG.map((c) => (
                  <div key={c.cam} className="hzos-row"><b>{c.cam}</b> [{c.time}] {c.desc}</div>
                ))}
              </div>
            )}
            {w.id === 'lore' && (
              <div className="hzos-list">
                {LORE_NOTES.map((n, i) => <p key={i} className="hzos-note">📖 {n}</p>)}
              </div>
            )}
            {w.id === 'notes' && (
              <div className="hzos-list">
                {CREATOR_NOTES.map((n, i) => <p key={i} className="hzos-note">✍️ {n}</p>)}
              </div>
            )}
            {w.id === 'files' && (
              <div className="hzos-list">
                <p className="hzos-note">📁 /home/{user}</p>
                <p className="hzos-note">📄 README.txt — "Welcome to HorizonOS."</p>
                <p className="hzos-note">📄 oshints.txt — "Try double-clicking the desktop."</p>
                <p className="hzos-note">🗄️ chest.key — "Shard located after Psychedelics moon."</p>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Taskbar */}
      <div className="hzos-taskbar">
        <button className="hzos-start" onClick={() => toggleWindow('terminal')}>🪟 Start</button>
        {WINDOW_DEFS.map((d) => (
          <button
            key={d.id}
            className={`hzos-task ${windows.find((w) => w.id === d.id)?.open ? 'active' : ''}`}
            onClick={() => {
              const win = windows.find((w) => w.id === d.id)!;
              if (win.open && !win.minimized) setWindows((ws) => ws.map((x) => x.id === d.id ? { ...x, minimized: true } : x));
              else toggleWindow(d.id);
            }}
          >
            {d.icon} {d.title}
          </button>
        ))}
        <div className="hzos-clock">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {!anyOpen && (
        <div className="hzos-hint">Double-click a desktop icon • Double-click the wallpaper to exit</div>
      )}
    </div>
  );
}

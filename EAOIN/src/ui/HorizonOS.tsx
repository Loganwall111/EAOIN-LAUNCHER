/**
 * HorizonOS — an in-game virtual desktop (Windows-7 inspired).
 *
 * A full little operating system: movable, draggable windows, a Wi-Fi tray at
 * the bottom-right that connects to networks, a real File Explorer that takes
 * you to documents, a Game Hub with playable shooter & card mini-games, and the
 * Nebula Browser that can load real pages and download extensions.
 *
 * Boots to a terminal, then offers a Guest or Administrator session.
 */
import { useEffect, useRef, useState } from 'react';
import FileExplorer from './os/FileExplorer';
import BrowserApp from './os/BrowserApp';
import GameHub from './os/GameHub';

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
  w: number;
  h: number;
}

const WINDOW_DEFS: Array<Omit<OSWindow, 'x' | 'y' | 'z' | 'open' | 'minimized' | 'w' | 'h'>> = [
  { id: 'terminal', title: 'Terminal', icon: '🖥️' },
  { id: 'files', title: 'File Explorer', icon: '📁' },
  { id: 'browser', title: 'Nebula Browser', icon: '🌐' },
  { id: 'games', title: 'Game Hub', icon: '🎮' },
  { id: 'cameras', title: 'Security Cameras', icon: '📹' },
  { id: 'lore', title: 'Game Lore', icon: '📖' },
  { id: 'notes', title: "Creator's Notes", icon: '✍️' },
];

const WINDOW_SIZES: Record<string, { w: number; h: number }> = {
  files: { w: 620, h: 400 },
  browser: { w: 660, h: 440 },
  games: { w: 560, h: 440 },
};

const BOOT_LINES = [
  'loading servers …',
  'loading ARC …',
  'attaching services …',
  'mounting File Explorer …',
  'wiring Nebula Browser …',
  'boot gaming layer …',
  'scanning Wi-Fi networks …',
  'booting HorizonOS …',
  'login detected as GUEST',
];

const SECURITY_LOG = [
  { cam: 'CAM-01', desc: 'Overworld spawn — clear skies, no anomalies.', time: '00:04' },
  { cam: 'CAM-02', desc: 'Nether gate — heat bloom steady.', time: '00:07' },
  { cam: 'CAM-03', desc: 'Deep Ocean trench — the Bloop silhouette passes.', time: '00:11' },
  { cam: 'CAM-04', desc: 'Sky Kingdom — a rift flickers at the edge.', time: '00:14' },
  { cam: 'CAM-05', desc: 'Backrooms — lights flicker. Something moves.', time: '00:19' },
  { cam: 'CAM-06', desc: 'The Humorous — crystal spires hum in tune.', time: '00:22' },
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

interface Network {
  id: string;
  ssid: string;
  signal: number; // 1..4 bars
  locked: boolean;
}

const NETWORKS: Network[] = [
  { id: 'n1', ssid: 'EAOIN_5G', signal: 4, locked: false },
  { id: 'n2', ssid: 'Nebula_Prime', signal: 3, locked: true },
  { id: 'n3', ssid: 'The Humorous WiFi', signal: 2, locked: false },
  { id: 'n4', ssid: 'Backrooms_Guest', signal: 1, locked: false },
];

export default function HorizonOS({ onExit }: HorizonOSProps) {
  const [stage, setStage] = useState<'boot' | 'login' | 'guest' | 'admin'>('boot');
  const [bootLine, setBootLine] = useState(0);
  const [user, setUser] = useState('guest');
  const [windows, setWindows] = useState<OSWindow[]>(() =>
    WINDOW_DEFS.map((d, i) => {
      const size = WINDOW_SIZES[d.id] ?? { w: 520, h: 320 };
      return { ...d, x: 90 + i * 34, y: 60 + i * 30, z: i, open: false, minimized: false, ...size };
    })
  );
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');
  const [clock, setClock] = useState('');
  const [wifiOpen, setWifiOpen] = useState(false);
  const [connectedNet, setConnectedNet] = useState<string>('EAOIN_5G');
  const topRef = useRef(10);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  // Boot sequence.
  useEffect(() => {
    if (stage !== 'boot') return;
    if (bootLine < BOOT_LINES.length) {
      const t = window.setTimeout(() => setBootLine((b) => b + 1), 520);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setStage('login'), 650);
    return () => window.clearTimeout(t);
  }, [stage, bootLine]);

  // Clock tick.
  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    update();
    const id = window.setInterval(update, 15000);
    return () => window.clearInterval(id);
  }, []);

  // Global drag listeners while dragging a window.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const nx = e.clientX - drag.dx;
      const ny = e.clientY - drag.dy;
      setWindows((ws) => ws.map((w) => (w.id === drag.id ? { ...w, x: Math.max(0, nx), y: Math.max(0, ny) } : w)));
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const bringToFront = (id: string) => {
    topRef.current += 1;
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, z: topRef.current, minimized: false } : w)));
  };

  const toggleWindow = (id: string) => {
    topRef.current += 1;
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, open: !w.open, z: topRef.current, minimized: false } : w)));
  };

  const openDefault = (id: string) => {
    topRef.current += 1;
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, open: true, z: topRef.current, minimized: false } : w)));
  };

  const startDrag = (id: string, e: React.PointerEvent) => {
    const win = windows.find((w) => w.id === id);
    if (!win) return;
    dragRef.current = { id, dx: e.clientX - win.x, dy: e.clientY - win.y };
    bringToFront(id);
  };

  const startGuest = () => { setUser('guest'); setStage('guest'); };

  const submitAdmin = () => {
    if (adminPass.toLowerCase() === 'logan1234') {
      setUser('administrator');
      setStage('admin');
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

  if (stage === 'boot') {
    return (
      <div className="hzos hzos-boot">
        <div className="hzos-terminal">
          <div className="hzos-term-head">HorizonOS Boot</div>
          <div className="hzos-term-body">
            {BOOT_LINES.slice(0, bootLine).map((l) => <div key={l} className="hzos-term-line">{l}</div>)}
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
          <button className="hzos-account" onClick={startGuest}><span className="hzos-avatar">🧑</span> Guest</button>
          <button className="hzos-account" onClick={() => setStage('admin')}><span className="hzos-avatar">🛡️</span> Administrator</button>
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
          <input className="ui-input" type="password" placeholder="Administrator password" value={adminPass}
            onChange={(e) => setAdminPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitAdmin()} />
          {adminError && <p className="hzos-error">{adminError}</p>}
          <button className="hzos-account" onClick={submitAdmin}>Sign in</button>
          <button className="hzos-exit" onClick={() => { setStage('login'); setAdminPass(''); setAdminError(''); }}>← Back</button>
        </div>
      </div>
    );
  }

  const openWindows = windows.filter((w) => w.open && !w.minimized);
  const anyOpen = windows.some((w) => w.open && !w.minimized);
  const connected = NETWORKS.find((n) => n.ssid === connectedNet);

  return (
    <div className="hzos hzos-desktop" onDoubleClick={(e) => { const t = e.target as HTMLElement; if (t.classList.contains('hzos-desktop')) onExit(); }}>
      <div className="hzos-wallpaper" />
      <div className="hzos-wallpaper-moon" aria-hidden="true" />

      <div className="hzos-icons">
        {WINDOW_DEFS.map((d) => (
          <button key={d.id} className="hzos-icon" onDoubleClick={() => openDefault(d.id)}>
            <span className="hzos-icon-img">{d.icon}</span>
            <span>{d.title}</span>
          </button>
        ))}
      </div>

      {openWindows.map((w) => (
        <div
          key={w.id}
          className="hzos-window"
          style={{ left: w.x, top: w.y, zIndex: w.z, width: w.w, height: w.h }}
          onMouseDown={() => bringToFront(w.id)}
        >
          <div className="hzos-window-head" onPointerDown={(e) => startDrag(w.id, e)}>
            <span>{w.icon} {w.title}</span>
            <span className="hzos-window-actions">
              <button onClick={(e) => { e.stopPropagation(); setWindows((ws) => ws.map((x) => x.id === w.id ? { ...x, minimized: true } : x)); }}>─</button>
              <button onClick={(e) => { e.stopPropagation(); setWindows((ws) => ws.map((x) => x.id === w.id ? { ...x, open: false } : x)); }}>✕</button>
            </span>
          </div>
          <div className="hzos-window-body">
            {w.id === 'terminal' && (
              <div className="hzos-term-body">
                {BOOT_LINES.map((l) => <div key={l} className="hzos-term-line">{l}</div>)}
                <div className="hzos-term-line hzos-term-ok">signed in as {user}</div>
                <div className="hzos-term-line">type /help for commands</div>
              </div>
            )}
            {w.id === 'files' && <FileExplorer />}
            {w.id === 'browser' && <BrowserApp />}
            {w.id === 'games' && <GameHub />}
            {w.id === 'cameras' && (
              <div className="hzos-list">
                {SECURITY_LOG.map((c) => <div key={c.cam} className="hzos-row"><b>{c.cam}</b> [{c.time}] {c.desc}</div>)}
              </div>
            )}
            {w.id === 'lore' && (
              <div className="hzos-list">{LORE_NOTES.map((n, i) => <p key={i} className="hzos-note">📖 {n}</p>)}</div>
            )}
            {w.id === 'notes' && (
              <div className="hzos-list">{CREATOR_NOTES.map((n, i) => <p key={i} className="hzos-note">✍️ {n}</p>)}</div>
            )}
          </div>
        </div>
      ))}

      <div className="hzos-taskbar">
        <button className="hzos-start" onClick={() => toggleWindow('terminal')}>🪟 Start</button>
        {WINDOW_DEFS.map((d) => (
          <button key={d.id} className={`hzos-task ${windows.find((w) => w.id === d.id)?.open ? 'active' : ''}`}
            onClick={() => {
              const win = windows.find((w) => w.id === d.id)!;
              if (win.open && !win.minimized) setWindows((ws) => ws.map((x) => x.id === d.id ? { ...x, minimized: true } : x));
              else toggleWindow(d.id);
            }}>
            {d.icon} {d.title}
          </button>
        ))}
        <div className="hzos-tray">
          <button className={`hzos-tray-icon wifi ${connected ? 'on' : ''}`} title={`Wi-Fi: ${connected?.ssid ?? 'off'}`} onClick={() => setWifiOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill={connected ? '#fff' : '#8899aa'}>
              <path d="M12 18.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 12a6.5 6.5 0 0 1 4.6 1.9l-1.4 1.4a4.5 4.5 0 0 0-6.4 0l-1.4-1.4A6.5 6.5 0 0 1 12 12zM12 5.5c3.6 0 6.9 1.5 9.2 3.8l-1.4 1.4A10.8 10.8 0 0 0 12 7.5a10.8 10.8 0 0 0-7.8 3.2L2.8 9.3A12.8 12.8 0 0 1 12 5.5z"/>
            </svg>
          </button>
          {wifiOpen && (
            <div className="hzos-wifi-panel">
              <div className="hzos-wifi-head">📶 Wi-Fi</div>
              <div className="hzos-wifi-status">
                {connected ? `Connected to ${connected.ssid}` : 'Not connected'} • {connected?.signal ?? 0}/4 bars
              </div>
              <div className="hzos-wifi-list">
                {NETWORKS.map((n) => (
                  <button key={n.id} className={`hzos-wifi-row ${connectedNet === n.ssid ? 'active' : ''}`}
                    onClick={() => setConnectedNet(n.ssid)}>
                    <span className="hzos-wifi-bars">{Array.from({ length: 4 }, (_, i) => i < n.signal ? '▮' : '▯').join('')}</span>
                    <span className="hzos-wifi-name">{n.ssid}</span>
                    <span className="hzos-wifi-lock">{n.locked ? '🔒' : connectedNet === n.ssid ? '✓' : ''}</span>
                  </button>
                ))}
              </div>
              <button className="hzos-wifi-off" onClick={() => setConnectedNet('')}>Turn Wi-Fi off</button>
            </div>
          )}
          <div className="hzos-clock">{clock}</div>
        </div>
      </div>

      {!anyOpen && (
        <div className="hzos-hint">Double-click a desktop icon • Click the 📶 tray to join a network • Double-click the wallpaper to exit</div>
      )}
    </div>
  );
}

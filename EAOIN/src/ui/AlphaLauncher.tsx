/**
 * AlphaLauncher — a full in-game launcher for the EAOIN 2.0 alpha preview.
 *
 * 2.0 "Update Part 2" overhaul: clicking Alpha Mode now runs a short boot-up
 * sequence, then shows its own "Alpha Launcher" — the game name, an alpha
 * version picker (Pre-1, Pre-2, Pre-3…) with per-build patch notes, a settings
 * button, and a Play button that opens the selected alpha build.
 *
 * Opening the alpha build still launches it at ALPHA_URL (the packaged /alpha/
 * sub-directory of the site).
 */
import { useEffect, useMemo, useState } from 'react';
import { ALPHA_URL } from '../version';
import { alphaBuilds, latestAlphaBuild } from '../launcher/AlphaVersions';

const HIGHLIGHTS = [
  { emoji: '🔥', title: 'Nether & End overhaul', desc: 'A sealed lava cave world and rings of End islands under a black-hole sky.' },
  { emoji: '🌀', title: 'Custom buildable portals', desc: 'Each dimension has its own build technique — obsidian frames, end-crystal ground portals, aether globes, rift cylinders.' },
  { emoji: '🎮', title: 'Game Hub', desc: 'A live hub with server corruption, Code Emperor quests and Code Creator mini-games.' },
  { emoji: '🕳', title: 'Singularity', desc: 'A shader-based black hole you can zoom through to uncover the ARG.' },
  { emoji: '🖥', title: 'HorizonOS re-skin', desc: 'A futuristic matrix-style OS with arcade and embedded mini-games.' },
];

type BootStage = 'boot' | 'ready';

export default function AlphaLauncher({ onBack }: { onBack: () => void }) {
  const [stage, setStage] = useState<BootStage>('boot');
  const [bootLine, setBootLine] = useState(0);
  const [selectedId, setSelectedId] = useState(latestAlphaBuild().id);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const builds = useMemo(() => alphaBuilds(), []);
  const selected = builds.find((b) => b.id === selectedId) ?? builds[builds.length - 1];

  // Boot-up sequence: type out a few matrix-style boot lines, then show the
  // launcher. Mirrors the feel of the stable launcher's boot but for the alpha.
  useEffect(() => {
    const lines = [
      'EAOIN 2.0 ALPHA',
      'mounting alpha channel …',
      'loading Singularity shaders …',
      'attaching HorizonOS matrix theme …',
      'decrypting ARG fragments …',
      'ALPHA READY',
    ];
    if (stage !== 'boot') return;
    const iv = window.setInterval(() => {
      setBootLine((n) => {
        const next = n + 1;
        if (next >= lines.length) {
          window.clearInterval(iv);
          setStage('ready');
        }
        return Math.min(next, lines.length - 1);
      });
    }, 260);
    return () => window.clearInterval(iv);
  }, [stage]);

  const launch = () => {
    // In a real shipping setup the selected build would map to its own URL;
    // for now all alpha builds share the single packaged alpha route.
    window.open(ALPHA_URL, '_blank', 'noopener');
  };

  if (stage === 'boot') {
    const lines = [
      'EAOIN 2.0 ALPHA',
      'mounting alpha channel …',
      'loading Singularity shaders …',
      'attaching HorizonOS matrix theme …',
      'decrypting ARG fragments …',
      'ALPHA READY',
    ];
    return (
      <div className="alpha-boot">
        <div className="alpha-boot-title">🚀 ALPHA LAUNCHER</div>
        <div className="alpha-boot-lines">
          {lines.slice(0, bootLine + 1).map((l, i) => (
            <div key={i} className={i === bootLine ? 'alpha-boot-line cur' : 'alpha-boot-line'}>{l}</div>
          ))}
        </div>
        <div className="alpha-boot-cursor">▮</div>
      </div>
    );
  }

  return (
    <div className="alpha-launcher">
      <div className="alpha-launcher-head">
        <button className="screen-back" onClick={onBack}>← Back</button>
        <div className="screen-titles">
          <div className="screen-eyebrow">ALPHA LAUNCHER</div>
          <h1 className="screen-title">🚀 EAOIN 2.0 Alpha</h1>
        </div>
        <button className="alpha-settings-btn" onClick={() => setSettingsOpen((s) => !s)} aria-label="Alpha settings">⚙</button>
      </div>

      {settingsOpen && (
        <div className="alpha-settings">
          <div className="alpha-settings-title">⚙ Alpha Launcher Settings</div>
          <label>
            <span>Launch target</span>
            <input className="mini-input" value={ALPHA_URL} readOnly />
          </label>
          <p className="alpha-settings-hint">The alpha build is served from the same site at <code>{ALPHA_URL}</code>.</p>
          <button className="alpha-settings-close" onClick={() => setSettingsOpen(false)}>Close</button>
        </div>
      )}

      <div className="alpha-launcher-body">
        <div className="alpha-hero">
          <div className="alpha-badge">PRE-RELEASE</div>
          <h2>Try the next-gen update</h2>
          <p>
            The <b>EAOIN 2.0 Alpha</b> is a separate, experimental build with the
            latest next-gen features. Pick an alpha version below and press play.
          </p>
          <div className="alpha-actions">
            <button className="alpha-play" onClick={launch}>▶ Play {selected.version}</button>
            <span className="alpha-url">{ALPHA_URL}</span>
          </div>
        </div>

        <div className="alpha-columns">
          <div className="alpha-versions">
            <h3>📦 Alpha Versions</h3>
            <div className="alpha-version-list">
              {builds.slice().reverse().map((b) => (
                <button key={b.id} className={`alpha-version ${selectedId === b.id ? 'selected' : ''}`} onClick={() => setSelectedId(b.id)}>
                  <span className="alpha-ver-num">{b.version}</span>
                  <span className="alpha-ver-title">{b.title}</span>
                  {b.isLatest && <span className="alpha-ver-latest">LATEST</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="alpha-patch">
            <h3>📜 Patch Notes — {selected.version}</h3>
            <div className="alpha-patch-tagline">{selected.tagline}</div>
            <ul className="alpha-patch-notes">
              {selected.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        </div>

        <div className="alpha-howto">
          <h3>📌 How to play the alpha (from inside this launcher)</h3>
          <ol>
            <li>Pick an alpha version above, then press <b>▶ Play</b> — it opens the alpha build in a new tab.</li>
            <li>If a pop-up is blocked, allow it, or copy the link below and paste it in a new tab.</li>
            <li>Play it like the main game — the alpha has all the next-gen 2.0 features.</li>
          </ol>
          <div className="alpha-howto-link">🔗 <code>{ALPHA_URL}</code></div>
        </div>

        <div className="alpha-features">
          <h3>What's inside the alpha</h3>
          <div className="alpha-feature-grid">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="alpha-feature">
                <span className="alpha-feature-emoji">{h.emoji}</span>
                <div>
                  <strong>{h.title}</strong>
                  <p>{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

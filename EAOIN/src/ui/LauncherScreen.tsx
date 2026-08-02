/**
 * LauncherScreen — the EAOIN launcher shown before the game boots.
 *
 * Styled like the official menu with the studio name at the top. Features:
 *   - A version list across three channels: Public, Experimental, Developer.
 *   - A "System Update" control at the top that warns when an update is ready,
 *     shows an updating prompt with progress, then "Successfully updated", and
 *     offers a downgrade button.
 *   - A debug panel (developer channel) with every-settings toggles.
 *   - Floating particle effects to match the main menu.
 */
import { useMemo, useState } from 'react';
import {
  buildsForChannel, defaultDebugSettings, getBuild,
  LauncherChannel, LauncherDebugSettings, LauncherState, latestOfChannel,
} from '../launcher/LauncherRuntime';

interface LauncherScreenProps {
  state: LauncherState;
  onSelect: (id: string) => void;
  onLaunch: () => void;
  /** Called when the user completes an update/downgrade. */
  onInstalled: (id: string) => void;
  /** Called to actually boot the game with the selected build. */
  onBoot: () => void;
}

const CHANNELS: Array<{ id: LauncherChannel; label: string; icon: string }> = [
  { id: 'public', label: 'Public Builds', icon: '🌍' },
  { id: 'experimental', label: 'Experimental', icon: '🧪' },
  { id: 'developer', label: 'Developer Builds', icon: '🛠' },
];

export default function LauncherScreen({ state, onSelect, onLaunch, onInstalled, onBoot }: LauncherScreenProps) {
  const [channel, setChannel] = useState<LauncherChannel>(state.channel);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debug, setDebug] = useState<LauncherDebugSettings>(() => defaultDebugSettings());

  const builds = useMemo(() => buildsForChannel(channel), [channel]);
  const selected = getBuild(state.selectedId);
  const installed = getBuild(state.installedId);
  const newest = latestOfChannel(channel);

  const updateAvailable = newest && installed && newest.released > installed.released;

  // Particle field (deterministic-looking motes) to match the main menu.
  const motes = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    id: i, left: 3 + Math.random() * 94, delay: Math.random() * 6,
    duration: 8 + Math.random() * 9, size: 1 + Math.random() * 3,
  })), []);

  const runUpdate = () => {
    if (!newest || updating) return;
    setUpdating(true);
    setUpdateProgress(0);
    setUpdateMsg(null);
    let p = 0;
    const iv = window.setInterval(() => {
      p += 0.08 + Math.random() * 0.06;
      if (p >= 1) {
        p = 1;
        clearInterval(iv);
        setUpdateProgress(1);
        setUpdateMsg('Successfully updated');
        onInstalled(newest.id);
        window.setTimeout(() => { setUpdating(false); }, 600);
      } else {
        setUpdateProgress(p);
      }
    }, 90);
  };

  const downgrade = () => {
    if (!installed) return;
    // Downgrade to the newest stable build on the channel.
    const stable = buildsForChannel('public').filter((b) => b.isPublic).slice(-1)[0];
    const target = stable ?? builds[0];
    if (!target) return;
    setUpdateMsg('Successfully downgraded');
    onInstalled(target.id);
  };

  const selectedBuild = selected;
  const isDev = selectedBuild?.devTools;

  return (
    <div className="launcher-screen">
      {/* Particle field */}
      <div className="launcher-particles" aria-hidden="true">
        {motes.map((m) => <span key={m.id} className="launcher-mote" style={{ left: `${m.left}%`, width: m.size, height: m.size, animationDelay: `${m.delay}s`, animationDuration: `${m.duration}s` }} />)}
      </div>

      {/* Studio name at the very top */}
      <header className="launcher-header">
        <div className="launcher-studio">ONEBLOCKAWAY STUDIOS</div>
        <div className="launcher-wordmark">EAOIN LAUNCHER</div>
      </header>

      {/* System update at the top */}
      <div className="launcher-update">
        {updateAvailable ? (
          <>
            <span className="lu-warn">⚠ System Update Available — {newest.name}</span>
            <button className="lu-btn" onClick={runUpdate} disabled={updating}>Update</button>
          </>
        ) : installed ? (
          <>
            <span className="lu-ok">✔ Installed: {installed.name} ({installed.label})</span>
            {!updating && <button className="lu-btn ghost" onClick={downgrade}>Downgrade</button>}
          </>
        ) : (
          <span className="lu-ok">No updates available</span>
        )}
      </div>

      {/* Updating prompt */}
      {updating && (
        <div className="launcher-updating">
          <div className="lu-prompt">Updating to {newest?.name}…</div>
          <div className="lu-bar"><span style={{ width: `${Math.round(updateProgress * 100)}%` }} /></div>
          <div className="lu-pct">{Math.round(updateProgress * 100)}%</div>
          {updateMsg && <div className="lu-done">{updateMsg}</div>}
        </div>
      )}
      {updateMsg && !updating && <div className="launcher-updating done"><div className="lu-done">{updateMsg}</div></div>}

      {/* Channel tabs */}
      <nav className="launcher-channels">
        {CHANNELS.map((c) => (
          <button key={c.id} className={`launcher-channel ${channel === c.id ? 'active' : ''}`} onClick={() => setChannel(c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </nav>

      {/* Version list */}
      <div className="launcher-body">
        <div className="launcher-versions">
          {builds.map((b) => (
            <button key={b.id} className={`launcher-version ${state.selectedId === b.id ? 'selected' : ''}`} onClick={() => onSelect(b.id)}>
              <div className="lv-main">
                <strong>{b.name}</strong>
                <span className="lv-label">{b.label}</span>
                <small>{b.tagline}</small>
              </div>
              <div className="lv-meta">
                {b.worldType && <span className="lv-chip">{b.worldType}</span>}
                {b.devTools && <span className="lv-chip dev">DEV</span>}
                {b.experimental && <span className="lv-chip exp">EXP</span>}
              </div>
            </button>
          ))}
          {builds.length === 0 && <p className="lv-empty">No builds on this channel yet.</p>}
        </div>

        {/* Right panel: selected build + play */}
        <aside className="launcher-detail">
          {selectedBuild ? (
            <>
              <h3 className="ld-name">{selectedBuild.name}</h3>
              <div className="ld-meta">
                <span>Version {selectedBuild.version}</span>
                <span>{selectedBuild.label}</span>
                <span>{selectedBuild.released}</span>
              </div>
              <p className="ld-desc">{selectedBuild.tagline}</p>
              <div className="ld-badges">
                {selectedBuild.worldType && <span className="lv-chip">World: {selectedBuild.worldType}</span>}
                {selectedBuild.devTools && <span className="lv-chip dev">End-game Editor + AI Chatbot</span>}
                {selectedBuild.experimental && <span className="lv-chip exp">Experimental features</span>}
                {selectedBuild.isBeta && <span className="lv-chip beta">Beta — not released yet</span>}
              </div>

              {/* Debug panel — developer builds only */}
              {isDev && (
                <div className="ld-debug">
                  <button className="ld-debug-toggle" onClick={() => setShowDebug((s) => !s)}>
                    🛠 Debug Settings {showDebug ? '▾' : '▸'}
                  </button>
                  {showDebug && (
                    <div className="ld-debug-body">
                      {([['Infinite items', 'infiniteItems'], ['No fall damage', 'noFallDamage'], ['Instant build', 'instantBuild'], ['God mode', 'godMode'], ['Show chunk borders', 'showChunkBorders'], ['Super speed', 'superSpeed']] as Array<[string, keyof LauncherDebugSettings]>).map(([label, key]) => (
                        <label key={key} className="ld-debug-row">
                          <span>{label}</span>
                          <input type="checkbox" checked={debug[key]} onChange={() => setDebug((d) => ({ ...d, [key]: !d[key] }))} />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="launcher-actions">
                <button className="launcher-play" onClick={() => { onLaunch(); onBoot(); }}>▶ Play</button>
              </div>
            </>
          ) : (
            <p className="lv-empty">Select a build to play.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

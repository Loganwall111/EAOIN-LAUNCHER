import { useEffect, useState } from 'react';
import { GAME_MODES, GameMode } from '../modes/GameMode';
import { RELEASE_LABEL } from '../version';

interface MainMenuProps {
  onStart: (seed?: string, mode?: GameMode) => void;
  currentSeed: string;
}

export default function MainMenu({ onStart, currentSeed }: MainMenuProps) {
  const [seed, setSeed] = useState(currentSeed);
  const [mode, setMode] = useState<GameMode>('survival');
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const begin = (nextSeed?: string, nextMode?: GameMode) => {
    if (loading) return;
    setLoading(true);
    window.setTimeout(() => onStart(nextSeed, nextMode), 900);
  };

  return (
    <div className="main-menu">
      <div className="menu-background release-2-menu">
        <div className="menu-title">
          <h1>EAOIN</h1>
          <p className="subtitle">{RELEASE_LABEL}</p>
        </div>
        <div className="menu-card">
          <input
            type="text"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="World Seed"
            className="seed-input"
          />
          <div className="mode-select">
            {GAME_MODES.map((entry) => (
              <button
                key={entry.id}
                className={`mode-card ${mode === entry.id ? 'selected' : ''}`}
                onClick={() => setMode(entry.id)}
              >
                <strong>{entry.label}</strong>
                <span>{entry.description}</span>
              </button>
            ))}
          </div>
          {loading ? (
            <div className="menu-loading" role="status"><strong>Loading world…</strong><div className="loading-track"><span /></div><small>Generating terrain • Preparing chunks • Lighting the overworld</small></div>
          ) : <>
          <button onClick={() => begin(seed, mode)} className="btn-primary">
            Play {GAME_MODES.find((entry) => entry.id === mode)?.label}
          </button>
          <button onClick={() => begin(undefined, 'experimental')} className="btn-secondary">
            Quick Experimental
          </button></>}
          {/* Settings intentionally lives on the front page, like a console title screen. */}
          <button className="menu-settings-link" onClick={() => setSettingsOpen(true)}>Settings</button>
          {settingsOpen && <div className="menu-settings-card"><strong>Settings</strong><span>Configure audio, graphics and controls in-game.</span><button onClick={() => setSettingsOpen(false)}>Done</button></div>}
          <button onClick={() => onStart(undefined, 'experimental')} className="btn-secondary" style={{display:'none'}}>
            Quick Experimental
          </button>
        </div>
        <div className="menu-footer">
          <p>2.0 UI & Graphics Overhaul • Experimental Vulkan/WebGPU Mode • Commands • Doors • Rockets • Moon</p>
        </div>
      </div>
    </div>
  );
}

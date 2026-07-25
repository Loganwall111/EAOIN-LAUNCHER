import { useState } from 'react';
import { GAME_MODES, GameMode } from '../modes/GameMode';
import { RELEASE_LABEL } from '../version';

interface MainMenuProps {
  onStart: (seed?: string, mode?: GameMode) => void;
  currentSeed: string;
}

export default function MainMenu({ onStart, currentSeed }: MainMenuProps) {
  const [seed, setSeed] = useState(currentSeed);
  const [mode, setMode] = useState<GameMode>('survival');

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
          <button onClick={() => onStart(seed, mode)} className="btn-primary">
            Play {GAME_MODES.find((entry) => entry.id === mode)?.label}
          </button>
          <button onClick={() => onStart(undefined, 'experimental')} className="btn-secondary">
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

import { useState } from 'react';

interface MainMenuProps {
  onStart: (seed?: string) => void;
  currentSeed: string;
}

export default function MainMenu({ onStart, currentSeed }: MainMenuProps) {
  const [seed, setSeed] = useState(currentSeed);

  return (
    <div className="main-menu">
      <div className="menu-background">
        <div className="menu-title">
          <h1>EAOIN</h1>
          <p className="subtitle">Ultimate Sandbox RPG</p>
        </div>
        <div className="menu-card">
          <input
            type="text"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="World Seed"
            className="seed-input"
          />
          <button onClick={() => onStart(seed)} className="btn-primary">
            Play World
          </button>
          <button onClick={() => onStart()} className="btn-secondary">
            Quick Play
          </button>
        </div>
        <div className="menu-footer">
          <p>Build Step 9 Complete • Multiplayer & Persistent Universe Next</p>
        </div>
      </div>
    </div>
  );
}

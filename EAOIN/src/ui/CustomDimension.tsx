/**
 * CustomDimensionCreator — build a playable dimension your way.
 *
 * Pick a terrain archetype (biome), a game mode, a sky mood, and toggles for
 * creatures/weather/creative — then start it. It applies the chosen world type
 * via the seed tag (which the generators already understand) and applies the
 * chosen sky/atmosphere mood through Full-Game-Settings on launch.
 */
import { useState } from 'react';
import { seedForWorldType, WorldTypeID } from '../world/WorldTypes';
import { GameMode } from '../modes/GameMode';
import { SuperSettings } from '../settings/SuperSettings';

interface Props {
  onStart: (seed: string, mode: GameMode, superSettings: Partial<SuperSettings>) => void;
  onBack: () => void;
}

const BIOMES: { id: WorldTypeID; label: string; emoji: string; blurb: string }[] = [
  { id: 'default', label: 'Rolling Hills', emoji: '🌄', blurb: 'Classic green valleys, rivers and forests.' },
  { id: 'flat', label: 'Superflat Build', emoji: '🧱', blurb: 'A perfectly flat world for unlimited building.' },
  { id: 'amplified', label: 'Amplified Peaks', emoji: '⛰️', blurb: 'Massive dramatic mountains and cliffs.' },
  { id: 'skylands', label: 'Skylands', emoji: '☁️', blurb: 'Floating islands above an endless void.' },
];

const SKIES: { id: string; label: string; emoji: string; patch: Partial<SuperSettings> }[] = [
  { id: 'day', label: 'Sunny Day', emoji: '☀️', patch: { skyMode: 'day', cloudDensity: 0.4, sunBrightness: 1.2 } },
  { id: 'night', label: 'Eternal Night', emoji: '🌙', patch: { skyMode: 'night', starDensity: 1, moonBrightness: 1.4 } },
  { id: 'golden', label: 'Golden Hour', emoji: '🌅', patch: { skyMode: 'sunset', sunBrightness: 1.1, cloudDensity: 0.5 } },
  { id: 'aurora', label: 'Aurora', emoji: '🌌', patch: { skyMode: 'aurora', auroraStrength: 1, starDensity: 1 } },
  { id: 'space', label: 'Deep Space', emoji: '🚀', patch: { skyMode: 'space', starDensity: 1 } },
  { id: 'void', label: 'Void', emoji: '🕳️', patch: { skyMode: 'void' } },
];

const MODES: { id: GameMode; label: string; emoji: string }[] = [
  { id: 'survival', label: 'Survival', emoji: '🌄' },
  { id: 'creative', label: 'Creative', emoji: '🏗️' },
  { id: 'story', label: 'Story', emoji: '🏘️' },
  { id: 'incredible', label: 'Incredible', emoji: '🌈' },
];

export default function CustomDimension({ onStart, onBack }: Props) {
  const [name, setName] = useState('My World');
  const [biome, setBiome] = useState(BIOMES[0]);
  const [sky, setSky] = useState(SKIES[0]);
  const [mode, setMode] = useState<GameMode>('survival');
  const [unlimitedCreative, setUnlimitedCreative] = useState(false);
  const [hostileMobs, setHostileMobs] = useState(true);

  const launch = () => {
    const base = (name || 'custom').toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Math.random().toString(36).slice(2, 8);
    const seed = seedForWorldType(base, biome.id);
    const patch: Partial<SuperSettings> = {
      ...sky.patch,
      unlimitedCreative: mode === 'creative' ? unlimitedCreative : false,
      hostileSpawning: hostileMobs,
    };
    onStart(seed, mode, patch);
  };

  return (
    <div className="custom-dim">
      <div className="custom-dim-head">
        <button className="screen-back" onClick={onBack}>← Back</button>
        <div className="screen-titles">
          <div className="screen-eyebrow">DIMENSION CREATOR</div>
          <h1 className="screen-title">🌍 Build Your Own World</h1>
        </div>
      </div>

      <div className="custom-dim-body">
        <label className="cd-field">
          <span>World Name</span>
          <input className="ui-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="cd-section">
          <div className="cd-label">Terrain / Biome</div>
          <div className="cd-grid">
            {BIOMES.map((b) => (
              <button key={b.id} className={`cd-card ${biome.id === b.id ? 'selected' : ''}`} onClick={() => setBiome(b)}>
                <span className="cd-emoji">{b.emoji}</span>
                <strong>{b.label}</strong>
                <small>{b.blurb}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="cd-section">
          <div className="cd-label">Sky / Atmosphere</div>
          <div className="cd-grid">
            {SKIES.map((s) => (
              <button key={s.id} className={`cd-card ${sky.id === s.id ? 'selected' : ''}`} onClick={() => setSky(s)}>
                <span className="cd-emoji">{s.emoji}</span>
                <strong>{s.label}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="cd-section">
          <div className="cd-label">Game Mode</div>
          <div className="cd-grid">
            {MODES.map((m) => (
              <button key={m.id} className={`cd-card ${mode === m.id ? 'selected' : ''}`} onClick={() => setMode(m.id)}>
                <span className="cd-emoji">{m.emoji}</span>
                <strong>{m.label}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="cd-toggles">
          <label><input type="checkbox" checked={unlimitedCreative} onChange={(e) => setUnlimitedCreative(e.target.checked)} /> Unlimited creative</label>
          <label><input type="checkbox" checked={hostileMobs} onChange={(e) => setHostileMobs(e.target.checked)} /> Hostile mobs</label>
        </div>

        <button className="confirm-btn wide" onClick={launch}>🚀 Create &amp; Play</button>
      </div>
    </div>
  );
}

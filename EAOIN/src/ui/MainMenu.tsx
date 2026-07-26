/**
 * MainMenu — Singleplayer world selection screen.
 *
 * Matches the AAA title screen aesthetic with the dark glass panels,
 * beveled borders, and voxel UI styling.
 */
import { useEffect, useMemo, useState } from 'react';
import { GAME_MODES, GameMode } from '../modes/GameMode';
import { GameAudio } from '../audio/GameAudio';

interface MainMenuProps {
  onStart: (seed?: string, mode?: GameMode) => void;
  currentSeed: string;
  /** Return to the title screen. */
  onBack: () => void;
}

interface WorldEntry {
  id: string;
  name: string;
  seed: string;
  mode: GameMode;
  lastPlayed: string;
  size: string;
  growth: string;
  icon: string;
  cheats: boolean;
  mods: boolean;
}

const MODE_BACKGROUNDS: Record<GameMode, { label: string; gradient: string; emoji: string; description: string }> = {
  survival: { label: 'Survival', gradient: 'linear-gradient(180deg,#4a8fc7 0%,#76b6e0 28%,#6cc24a 54%,#3f7a2a 60%,#8a5a36 100%)', emoji: '🌄', description: 'Gather, craft, survive' },
  creative: { label: 'Creative', gradient: 'linear-gradient(180deg,#7bb8e8 0%,#a7d8ff 35%,#b0e09a 60%,#d8c07a 100%)', emoji: '🏗️', description: 'Build without limits' },
  story: { label: 'Story', gradient: 'linear-gradient(180deg,#2a2a5a 0%,#4a3a7a 30%,#ffaa55 58%,#1a1a2a 100%)', emoji: '🏘️', description: 'Follow the narrative' },
  experimental: { label: 'Experimental', gradient: 'linear-gradient(180deg,#0a0a1a 0%,#2a1a6a 28%,#8a2be2 62%,#ff4d8d 85%,#0a0a0a 100%)', emoji: '🔬', description: 'Ray-traced shaders & Vulkan' },
  incredible: { label: 'Incredible', gradient: 'linear-gradient(180deg,#ff2020 0%,#ffcc00 28%,#20ff88 55%,#2040ff 82%,#000 100%)', emoji: '🌈', description: 'Rare seeds & surprises' },
};

function loadWorlds(defaultSeed: string): WorldEntry[] {
  try {
    const raw = localStorage.getItem('eaoin_worlds');
    if (raw) return JSON.parse(raw) as WorldEntry[];
  } catch {}
  return [
    { id: 'world_1', name: 'New World', seed: defaultSeed, mode: 'survival', lastPlayed: new Date().toLocaleString(), size: '42 MB', growth: '184 chunks explored • 12h played', icon: '🌍', cheats: false, mods: false },
    { id: 'world_2', name: 'Creative Flat', seed: 'flat_' + defaultSeed.slice(0, 6), mode: 'creative', lastPlayed: 'Yesterday', size: '18 MB', growth: '92 chunks • 3h', icon: '🏗️', cheats: true, mods: true },
    { id: 'world_3', name: 'Incredible Rare', seed: 'incredible_mcdonalds_' + defaultSeed.slice(0, 4), mode: 'incredible', lastPlayed: '2 days ago', size: '89 MB', growth: '412 chunks • 28h', icon: '🍔', cheats: true, mods: true },
  ];
}

function saveWorlds(worlds: WorldEntry[]): void {
  try { localStorage.setItem('eaoin_worlds', JSON.stringify(worlds)); } catch {}
}

export default function MainMenu({ onStart, currentSeed, onBack }: MainMenuProps) {
  const menuAudio = useMemo(() => new GameAudio(), []);

  useEffect(() => {
    const start = () => menuAudio.startMusic({ muted: false, volume: 0.8 } as any, 'menu');
    window.addEventListener('pointerdown', start, { once: true });
    return () => { window.removeEventListener('pointerdown', start); menuAudio.stopMusic(); };
  }, [menuAudio]);

  // World selection state
  const [worlds, setWorlds] = useState<WorldEntry[]>(() => loadWorlds(currentSeed));
  const [selectedWorldId, setSelectedWorldId] = useState<string>('world_1');
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [createForm, setCreateForm] = useState<WorldEntry>({
    id: '', name: 'New World', seed: currentSeed, mode: 'survival', lastPlayed: 'Now',
    size: '0 MB', growth: '0 chunks', icon: '🌍', cheats: false, mods: false,
  });
  const [editWorld, setEditWorld] = useState<WorldEntry | null>(null);

  const selectedWorld = worlds.find(w => w.id === selectedWorldId) ?? worlds[0];

  useEffect(() => saveWorlds(worlds), [worlds]);

  const handleCreateWorld = () => {
    const newWorld: WorldEntry = {
      ...createForm,
      id: 'world_' + Date.now(),
      lastPlayed: new Date().toLocaleString(),
      size: Math.floor(Math.random() * 60 + 10) + ' MB',
      growth: Math.floor(Math.random() * 200 + 20) + ' chunks • 0h',
      icon: MODE_BACKGROUNDS[createForm.mode]?.emoji ?? '🌍',
    };
    setWorlds(w => [newWorld, ...w]);
    setSelectedWorldId(newWorld.id);
    setView('list');
  };

  const handleEditSave = () => {
    if (!editWorld) return;
    setWorlds(w => w.map(x => x.id === editWorld.id ? { ...editWorld, lastPlayed: new Date().toLocaleString() } : x));
    setView('list');
  };

  const handleDeleteWorld = (id: string) => {
    setWorlds(w => w.filter(x => x.id !== id));
    if (selectedWorldId === id && worlds.length > 1) {
      setSelectedWorldId(worlds[0].id === id ? worlds[1]?.id ?? '' : worlds[0].id);
    }
  };

  const selectedMode = selectedWorld?.mode ?? 'survival';
  const effectiveBackground = MODE_BACKGROUNDS[selectedMode];

  return (
    <div className="singleplayer-screen">
      {/* Background */}
      <div className="sp-backdrop" style={{ backgroundImage: effectiveBackground.gradient }} />
      <div className="sp-overlay" />

      {/* Header */}
      <header className="sp-header">
        <button className="sp-back-btn" onClick={onBack}>← Back</button>
        <div className="sp-header-titles">
          <span className="sp-eyebrow">SINGLEPLAYER</span>
          <h1 className="sp-title">Select World</h1>
        </div>
        <div className="sp-header-actions">
          <button className="sp-create-btn" onClick={() => {
            setCreateForm({ id: '', name: `New World ${worlds.length + 1}`, seed: 'seed_' + Math.random().toString(36).slice(2, 8), mode: 'survival', lastPlayed: 'Now', size: '0 MB', growth: '0 chunks', icon: '🌍', cheats: false, mods: false });
            setView('create');
          }}>
            + Create New World
          </button>
        </div>
      </header>

      {/* World List */}
      {view === 'list' && (
        <div className="sp-body">
          <div className="sp-world-list-panel ui-panel">
            <div className="ui-panel-title">◈ Your Worlds ({worlds.length})</div>
            <div className="sp-world-list">
              {worlds.length === 0 && (
                <div className="sp-empty">
                  <span>No worlds yet. Create one to start playing!</span>
                </div>
              )}
              {worlds.map(w => (
                <div
                  key={w.id}
                  className={`sp-world-card ${selectedWorldId === w.id ? 'selected' : ''}`}
                  onClick={() => setSelectedWorldId(w.id)}
                >
                  <div className="sp-world-icon" style={{ background: MODE_BACKGROUNDS[w.mode]?.gradient }}>
                    {w.icon}
                  </div>
                  <div className="sp-world-info">
                    <strong>{w.name}</strong>
                    <span className="sp-world-seed">{w.seed}</span>
                    <span className="sp-world-mode">
                      {MODE_BACKGROUNDS[w.mode]?.emoji} {MODE_BACKGROUNDS[w.mode]?.label} • {w.lastPlayed}
                    </span>
                    <span className="sp-world-meta">
                      {w.growth} • {w.size}
                      {w.cheats && <span className="sp-badge cheats">Cheats</span>}
                      {w.mods && <span className="sp-badge mods">Mods</span>}
                    </span>
                  </div>
                  <div className="sp-world-actions">
                    <button className="sp-action-btn edit" title="Edit" onClick={e => { e.stopPropagation(); setEditWorld({ ...w }); setView('edit'); }}>✎</button>
                    <button className="sp-action-btn delete" title="Delete" onClick={e => { e.stopPropagation(); handleDeleteWorld(w.id); }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected world detail + Play */}
          {selectedWorld && (
            <div className="sp-detail-panel ui-panel">
              <div className="ui-panel-title">◈ World Details</div>
              <div className="sp-detail-content">
                <div className="sp-detail-hero" style={{ background: MODE_BACKGROUNDS[selectedWorld.mode]?.gradient }}>
                  <span className="sp-detail-icon">{selectedWorld.icon}</span>
                </div>
                <div className="sp-detail-info">
                  <h2>{selectedWorld.name}</h2>
                  <div className="sp-detail-stats">
                    <div><span>Seed</span><strong>{selectedWorld.seed}</strong></div>
                    <div><span>Mode</span><strong>{MODE_BACKGROUNDS[selectedWorld.mode]?.label}</strong></div>
                    <div><span>Last Played</span><strong>{selectedWorld.lastPlayed}</strong></div>
                    <div><span>Size</span><strong>{selectedWorld.size}</strong></div>
                    <div><span>Growth</span><strong>{selectedWorld.growth}</strong></div>
                  </div>
                </div>
                <button className="sp-play-btn" onClick={() => onStart(selectedWorld.seed, selectedWorld.mode)}>
                  ▶ PLAY WORLD
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create World */}
      {view === 'create' && (
        <div className="sp-body sp-create-body">
          <div className="sp-form-panel ui-panel">
            <div className="ui-panel-title">◈ Create New World</div>
            <div className="sp-form-content">
              <label className="sp-field">
                <span>World Name</span>
                <input type="text" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
              </label>
              <label className="sp-field">
                <span>Seed</span>
                <div className="sp-seed-row">
                  <input type="text" value={createForm.seed} onChange={e => setCreateForm({ ...createForm, seed: e.target.value })} placeholder="Leave blank for random" />
                  <button className="sp-seed-random" onClick={() => setCreateForm({ ...createForm, seed: Math.random().toString(36).slice(2, 10) })}>🎲 Random</button>
                </div>
              </label>

              <div className="sp-mode-select">
                <span className="sp-field-label">Game Mode</span>
                <div className="sp-mode-grid">
                  {GAME_MODES.map(entry => (
                    <button
                      key={entry.id}
                      className={`sp-mode-card ${createForm.mode === entry.id ? 'selected' : ''}`}
                      onClick={() => setCreateForm({ ...createForm, mode: entry.id })}
                    >
                      <strong>{MODE_BACKGROUNDS[entry.id]?.emoji} {entry.label}</strong>
                      <small>{MODE_BACKGROUNDS[entry.id]?.description}</small>
                    </button>
                  ))}
                </div>
              </div>

              <label className="sp-checkbox">
                <input type="checkbox" checked={createForm.cheats} onChange={e => setCreateForm({ ...createForm, cheats: e.target.checked })} />
                <span>Allow Cheats (commands like /day, /time, /summon)</span>
              </label>
              <label className="sp-checkbox">
                <input type="checkbox" checked={createForm.mods} onChange={e => setCreateForm({ ...createForm, mods: e.target.checked })} />
                <span>Enable Mods & Resource Packs</span>
              </label>

              <div className="sp-form-actions">
                <button className="sp-btn primary" onClick={handleCreateWorld}>Create World</button>
                <button className="sp-btn secondary" onClick={() => setView('list')}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit World */}
      {view === 'edit' && editWorld && (
        <div className="sp-body sp-create-body">
          <div className="sp-form-panel ui-panel">
            <div className="ui-panel-title">◈ Edit World — {editWorld.name}</div>
            <div className="sp-form-content">
              <label className="sp-field">
                <span>World Name</span>
                <input type="text" value={editWorld.name} onChange={e => setEditWorld({ ...editWorld, name: e.target.value })} />
              </label>
              <label className="sp-field">
                <span>Seed</span>
                <div className="sp-seed-row">
                  <span className="sp-seed-display">{editWorld.seed}</span>
                  <button className="sp-seed-random" onClick={() => setEditWorld({ ...editWorld, seed: Math.random().toString(36).slice(2, 10) })}>🎲 New Seed</button>
                </div>
              </label>

              <div className="sp-mode-select">
                <span className="sp-field-label">Game Mode</span>
                <div className="sp-mode-grid">
                  {GAME_MODES.map(entry => (
                    <button
                      key={entry.id}
                      className={`sp-mode-card ${editWorld.mode === entry.id ? 'selected' : ''}`}
                      onClick={() => setEditWorld({ ...editWorld, mode: entry.id })}
                    >
                      <strong>{MODE_BACKGROUNDS[entry.id]?.emoji} {entry.label}</strong>
                      <small>{MODE_BACKGROUNDS[entry.id]?.description}</small>
                    </button>
                  ))}
                </div>
              </div>

              <label className="sp-checkbox">
                <input type="checkbox" checked={editWorld.cheats} onChange={e => setEditWorld({ ...editWorld, cheats: e.target.checked })} />
                <span>Allow Cheats</span>
              </label>
              <label className="sp-checkbox">
                <input type="checkbox" checked={editWorld.mods} onChange={e => setEditWorld({ ...editWorld, mods: e.target.checked })} />
                <span>Enable Mods & Resource Packs</span>
              </label>

              <div className="sp-form-actions">
                <button className="sp-btn primary" onClick={handleEditSave}>Save Changes</button>
                <button className="sp-btn secondary" onClick={() => setView('list')}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

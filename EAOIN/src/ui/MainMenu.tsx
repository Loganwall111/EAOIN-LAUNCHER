import { useEffect, useMemo, useRef, useState } from 'react';
import { GAME_MODES, GameMode } from '../modes/GameMode';
import { RELEASE_LABEL } from '../version';
import { MarketplaceRuntime } from '../marketplace/MarketplaceRuntime';
import { GameSettings } from '../settings/GameSettings';
import { loadSettings, saveSettings } from '../settings/SettingsSave';

interface MainMenuProps {
  onStart: (seed?: string, mode?: GameMode) => void;
  currentSeed: string;
}

type MenuPhase = 'BOOT' | 'STUDIO_INTRO' | 'SPLASH_PLAY' | 'POST_PLAY_LOADING' | 'MAIN' | 'WORLD_LIST' | 'CREATE_WORLD' | 'EDIT_WORLD';

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

const SPLASHES = [
  'Now with 26m clear spawn!', 'Settlement 58m away!', 'Rocket 110m in clearing!', 'SPACE to jump — fixed!',
  'Ray traced shadows!', 'SSAO + Bloom + Reflections!', 'O objectives U systems!', 'De-cluttered world grid!',
  'Minecraft skybox vibes!', 'More colours than before!', 'WASD + SPACE feels smooth!', 'No more hyper-cramped!',
  'Marketplace fixed!', 'Auralis Megacity 180m out!', 'Pirates 98m away!', 'Ender isles 155m!',
  'Portal core 72m NE!', 'Also try Survival!', 'Creative but spacious!', 'Experimental Vulkan!',
  'Craft with style!', 'Build without collision!', 'Voxels but pro!', 'Yellow splash text!',
  '100% more Minecraft!', 'Now with splash physics!', 'T is for chat!', 'I is inventory!',
  'G is door!', 'R is rocket!', 'P is dimension!', 'B is barter!', 'V is supplies!',
  'L is redstone!', 'N is boss!', 'C is credits!', 'K skips credits!', 'H for god mode!',
  'F5 third person!', 'Bouncy yellow text!', '/ help for commands!', 'Rare McDonalds world!',
  'Incredible mode!', '400km city biome!', 'Black hole singularity!', 'Water physics!',
  'Glass physics!', 'Cloth banners wave!', 'Crisp movement!', 'Smaller ellipsoid!',
  'Fixed ellipsoid 0.32!', 'Jump velocity 7.5!', 'No more stuck!', 'Spawn is breathable!',
  'Professional game feel!', '3D warped UI!', 'Panorama moves with mouse!', 'Settings on front page!',
  'Marketplace front and center!', 'Character creator!', 'Multi-coloured loading!', 'More alive atmosphere!',
  'God rays!', 'Starfield 120 stars!', 'Clouds moving stunning!', '16 chunk render distance!',
  'Bigger mountains! Bigger caves! Bigger cliffs!', 'Flat areas too!', 'Volumetric noise maps square!',
  '20 min day night cycle!', 'Block logos in inventory!', '2x2 crafting + 3x3 table!', 'Hand punching!',
  'Block cracking overlay!', 'Fog reduced to 100-1000!', 'T chat with /day /time!', 'World list centered!',
];

const POST_PLAY_TIPS = [
  'Clearing spawn 26m radius…', 'Spreading settlement 58m NW…', 'Placing rocket launchpad 110m SE in clearing…',
  'Moving portal core 72m NE…', 'Building dimensional doors 48m & 68m out…', 'Relocating palette 38m north…',
  'Streaming Auralis Megacity 180m away…', 'Anchoring pirate lake 98m SW…', 'Carving Ender isles 155m out…',
  'Baking ray traced soft shadows 2048²…', 'Computing SSAO ambient occlusion…', 'Warming up bloom + reflections…',
  'Sharpening Minecraft skybox gradient…', 'Tuning jump physics space→7.5 vel…', 'Shrinking ellipsoid to 0.32 to avoid cramp…',
  'Generating cloud map — Minecraft clouds stunning far away…', 'Increasing render distance to 16 chunks…',
  'Building mountains, caves, cliffs with volumetric noise…', 'Flattening some plains for variety…',
  'Setting day night to 20 min cycle…', 'Polishing inventory with block logos…', 'Adding hand punch & cracking…',
  'Ready — world is de-cluttered!',
];

const MODE_BACKGROUNDS: Record<GameMode, { label: string; gradient: string; emoji: string }> = {
  survival: { label: 'Overworld sunrise — grass drops glisten', gradient: 'linear-gradient(180deg,#4a8fc7 0%,#76b6e0 28%,#6cc24a 54%,#3f7a2a 60%,#8a5a36 100%)', emoji: '🌄' },
  creative: { label: 'Endless flat canvas — build spacious', gradient: 'linear-gradient(180deg,#7bb8e8 0%,#a7d8ff 35%,#b0e09a 60%,#d8c07a 100%)', emoji: '🏗️' },
  story: { label: 'Village lights far NW', gradient: 'linear-gradient(180deg,#2a2a5a 0%,#4a3a7a 30%,#ffaa55 58%,#1a1a2a 100%)', emoji: '🏘️' },
  experimental: { label: 'Vulkan ray-traced lab — SSAO bloom', gradient: 'linear-gradient(180deg,#0a0a1a 0%,#2a1a6a 28%,#8a2be2 62%,#ff4d8d 85%,#0a0a0a 100%)', emoji: '🔬' },
  incredible: { label: 'Rare seed fireworks — McDonalds!', gradient: 'linear-gradient(180deg,#ff2020 0%,#ffcc00 28%,#20ff88 55%,#2040ff 82%,#000 100%)', emoji: '🌈' },
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

export default function MainMenu({ onStart, currentSeed }: MainMenuProps) {
  const [seed, setSeed] = useState(currentSeed);
  const [mode, setMode] = useState<GameMode>('survival');
  const [hoverMode, setHoverMode] = useState<GameMode | null>(null);
  // Enter the title screen immediately. The old boot spinner made the game feel like a browser demo.
  const [phase, setPhase] = useState<MenuPhase>('STUDIO_INTRO');
  const [bootProgress, setBootProgress] = useState(0);
  const [postProgress, setPostProgress] = useState(0);
  const [pendingWorld, setPendingWorld] = useState<{ seed: string; mode: GameMode } | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [splash, setSplash] = useState(() => SPLASHES[Math.floor(Math.random() * SPLASHES.length)]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [multiplayerOpen, setMultiplayerOpen] = useState(false);
  const [modsOpen, setModsOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [skinTone, setSkinTone] = useState('#b86f48');
  const [shirtColor, setShirtColor] = useState('#2467c7');
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [mouseParallax, setMouseParallax] = useState({ x: 0, y: 0 });
  const categories = ['All', 'World', 'Skin', 'Shader', 'Systems', 'Texture', 'DLC', 'Modpack', 'Music'];
  const [catFilter, setCatFilter] = useState('All');
  const [marketRevision, setMarketRevision] = useState(0);
  const marketplace = useMemo(() => new MarketplaceRuntime(), []);
  const marketStatus = useMemo(() => {
    void marketRevision;
    return marketplace.getStatus();
  }, [marketplace, marketRevision]);
  const filteredPacks = useMemo(() => {
    void marketRevision;
    return marketplace
      .getPacks()
      .filter((pack) => catFilter === 'All' || pack.category === catFilter.toLowerCase());
  }, [marketplace, marketRevision, catFilter]);
  const containerRef = useRef<HTMLDivElement>(null);

  // World selection state
  const [worlds, setWorlds] = useState<WorldEntry[]>(() => loadWorlds(currentSeed));
  const [selectedWorldId, setSelectedWorldId] = useState<string>('world_1');
  const [createForm, setCreateForm] = useState<WorldEntry>({ id: '', name: 'New World', seed: currentSeed, mode: 'survival', lastPlayed: 'Now', size: '0 MB', growth: '0 chunks', icon: '🌍', cheats: false, mods: false });
  const [editWorld, setEditWorld] = useState<WorldEntry | null>(null);

  const selectedWorld = worlds.find(w => w.id === selectedWorldId) ?? worlds[0];

  useEffect(() => saveWorlds(worlds), [worlds]);
  // Character Creator is available from the main menu for every game mode.

  // Cinematic studio ident: an intentional AAA-style opening, not a loading screen.
  useEffect(() => {
    if (phase !== 'STUDIO_INTRO') return;
    const id = window.setTimeout(() => setPhase('MAIN'), 2800);
    return () => window.clearTimeout(id);
  }, [phase]);

  // Boot loading
  useEffect(() => {
    if (phase !== 'BOOT') return;
    let p = 0;
    const id = window.setInterval(() => {
      p += Math.random() * 14 + 5;
      if (p >= 100) { p = 100; setBootProgress(100); window.setTimeout(() => setPhase('SPLASH_PLAY'), 350); window.clearInterval(id); }
      else setBootProgress(p);
    }, 90);
    return () => window.clearInterval(id);
  }, [phase]);

  // Post-play loading
  useEffect(() => {
    if (phase !== 'POST_PLAY_LOADING') return;
    let p = 0;
    const tipId = window.setInterval(() => setTipIndex(i => (i + 1) % POST_PLAY_TIPS.length), 260);
    const id = window.setInterval(() => {
      p += Math.random() * 9 + 4;
      if (p >= 100) { setPostProgress(100); window.clearInterval(id); window.clearInterval(tipId); window.setTimeout(() => { if (pendingWorld) onStart(pendingWorld.seed, pendingWorld.mode); else setPhase('MAIN'); }, 420); }
      else setPostProgress(p);
    }, 85);
    return () => { window.clearInterval(id); window.clearInterval(tipId); };
  }, [phase, pendingWorld, onStart]);

  // Parallax
  useEffect(() => {
    const h = (e: MouseEvent) => setMouseParallax({ x: (e.clientX / window.innerWidth - 0.5) * 24, y: (e.clientY / window.innerHeight - 0.5) * 18 });
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, []);

  const effectiveBackground = (hoverMode ?? mode) ? MODE_BACKGROUNDS[hoverMode ?? mode] : MODE_BACKGROUNDS.survival;
  const beginPlayClick = () => { if (phase === 'SPLASH_PLAY') { setPendingWorld(null); setPhase('POST_PLAY_LOADING'); setPostProgress(0); setTipIndex(0); } };
  const beginWorld = (s?: string, m?: GameMode) => {
    setPendingWorld({ seed: s ?? seed, mode: m ?? mode });
    setPostProgress(0);
    setTipIndex(0);
    setPhase('POST_PLAY_LOADING');
  };
  const reshuffleSplash = () => setSplash(SPLASHES[Math.floor(Math.random() * SPLASHES.length)]);
  const saveSettingsPatch = (patch: Partial<GameSettings>) => { const next = { ...settings, ...patch }; setSettings(next); saveSettings(next); };

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
    setPhase('WORLD_LIST');
  };

  const handleEditSave = () => {
    if (!editWorld) return;
    setWorlds(w => w.map(x => x.id === editWorld.id ? { ...editWorld, lastPlayed: new Date().toLocaleString() } : x));
    setPhase('WORLD_LIST');
  };

  const handleDeleteWorld = (id: string) => {
    setWorlds(w => w.filter(x => x.id !== id));
  };

  // ===== STUDIO IDENT =====
  if (phase === 'STUDIO_INTRO') {
    return (
      <div className="studio-ident" role="status" aria-label="ONEBLOCKAWAY Studios">
        <div className="studio-orbit"><span /><span /><span /></div>
        <div className="studio-name">ONEBLOCKAWAY</div>
        <div className="studio-label">STUDIOS</div>
        <div className="studio-subline">PRESENTS</div>
      </div>
    );
  }

  // ===== BOOT =====
  if (phase === 'BOOT') {
    return (
      <div className="main-menu boot-phase" style={{ background: 'radial-gradient(circle at 50% 30%,#1a2a4a,#060a12 70%)' }}>
        <div className="mc-panorama-boot"><div className="panorama-orbit">{Array.from({ length: 6 }).map((_, i) => <div key={i} className={`panorama-face face-${i}`} />)}</div></div>
        <div className="boot-card">
          <h1 className="boot-logo">EAOIN</h1>
          <div className="boot-subtitle">{RELEASE_LABEL} • De-cluttered Edition • Clouds + Mountains + Caves</div>
          <div className="menu-loading" role="status">
            <strong>Booting EAOIN — preparing Minecraft skybox, cloud map moving, volumetric terrain… {Math.round(bootProgress)}%</strong>
            <div className="loading-track colorful"><span className="rainbow" style={{ width: `${bootProgress}%` }} /></div>
            <small>Loading assets • Compiling PBR • Building heightmap • Carving caves • Cloud instances</small>
          </div>
          <div className="boot-footer">Professional 3D warped UI • Settings front-page • Marketplace fixed • World list centered</div>
        </div>
      </div>
    );
  }

  // ===== SPLASH PLAY =====
  if (phase === 'SPLASH_PLAY') {
    return (
      <div className="main-menu splash-play-phase" ref={containerRef}>
        <div className="mc-movable-panorama" style={{ transform: `translate3d(${mouseParallax.x}px,${mouseParallax.y}px,0) scale(1.12)` }}>
          <div className="panorama-scene"><div className="panorama-cube">
            <div className="cube-face front" style={{ background: MODE_BACKGROUNDS.survival.gradient }} />
            <div className="cube-face back" style={{ background: MODE_BACKGROUNDS.creative.gradient }} />
            <div className="cube-face right" style={{ background: MODE_BACKGROUNDS.experimental.gradient }} />
            <div className="cube-face left" style={{ background: MODE_BACKGROUNDS.story.gradient }} />
            <div className="cube-face top" style={{ background: 'linear-gradient(180deg,#a0d8ff,#4a8fc7)' }} />
            <div className="cube-face bottom" style={{ background: 'linear-gradient(180deg,#8a5a36,#3d2210)' }} />
          </div></div>
          <div className="panorama-vignette" />
          <div className="floating-blocks">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="float-block" style={{ left: `${(i * 17) % 100}%`, top: `${(i * 23) % 80}%`, animationDelay: `${i * 0.3}s` }} />)}</div>
        </div>
        <div className="splash-play-card warped-3d">
          <div className="menu-title-3d"><h1 className="title-warped"><span className="title-shadow">EAOIN</span><span className="title-front">EAOIN</span></h1>
            <div className="splash-text" onClick={reshuffleSplash} title="Click to reshuffle">{splash}</div>
            <p className="subtitle rainbow-subtitle">{RELEASE_LABEL} • 3.2 • Clouds + Mountains + Caves + 16 chunks + 20min day</p>
          </div>
          <button className="btn-play-big minecraft-btn" onClick={beginPlayClick}><span className="btn-label-main">PLAY</span><span className="btn-label-sub">De-cluttered world • Clouds moving • 16 chunks • 20min day</span></button>
          <div className="splash-hints"><span>🌄 Settlement 58m • 🚀 Rocket 110m • ☁️ Clouds stunning far • 🏔️ Bigger mountains/caves/cliffs + flats</span><span>Move mouse — panorama movable! Click yellow text to reshuffle</span></div>
          <div className="boot-footer minimal">© EAOIN 2026 — Minecraft UI • World list centered • Inventory block logos • Hand punch + cracking</div>
        </div>
      </div>
    );
  }

  // ===== POST PLAY LOADING =====
  if (phase === 'POST_PLAY_LOADING') {
    return (
      <div className="main-menu post-play-loading-phase" style={{ background: effectiveBackground.gradient }}>
        <div className="mc-movable-panorama blurred" style={{ transform: `translate3d(${mouseParallax.x * 0.6}px,${mouseParallax.y * 0.6}px,0) scale(1.08)` }} />
        <div className="loading-card big">
          <h2 className="loading-title">Loading World Grid — Clouds + Volumetric Terrain</h2>
          <div className="menu-loading bigger" role="status">
            <strong>{POST_PLAY_TIPS[tipIndex]} {Math.round(postProgress)}%</strong>
            <div className="loading-track colorful multi"><span className="rainbow animated" style={{ width: `${postProgress}%` }} /><span className="rainbow-overlay" style={{ width: `${postProgress}%` }} /></div>
            <div className="loading-dots">{['#ff4d4d', '#ffcc00', '#4dff88', '#4da3ff', '#c84dff'].map((c, i) => <i key={i} style={{ background: c, animationDelay: `${i * 0.12}s`, transform: `scale(${0.6 + (postProgress % 40) / 80})` }} />)}</div>
            <small>Preparing chunks • Cloud instances moving • Mountains 48m • Caves volumetric • 16 radius • 20min day/night • Inventory logos • Cracking overlay</small>
          </div>
          <div className="colorful-blocks-row">{['grass', 'dirt', 'stone', 'water', 'crystal', 'rocket', 'portal'].map(b => <span key={b} className={`mini-block mini-${b}`} />)}</div>
        </div>
      </div>
    );
  }

  // ===== WORLD LIST — centered middle, like Minecraft =====
  if (phase === 'WORLD_LIST') {
    return (
      <div className="main-menu world-list-phase" style={{ background: 'linear-gradient(180deg,#5a5a5a 0,#3a3a3a 14%,#2a2a2a 14% 100%)' }}>
        <div className="mc-skybox" style={{ background: effectiveBackground.gradient, opacity: 0.35, filter: 'blur(8px)' }} />
        <div className="world-list-container">
          <h2 className="world-list-title">Select World</h2>
          <div className="world-list">
            {worlds.map(w => (
              <div key={w.id} className={`world-card ${selectedWorldId === w.id ? 'selected' : ''}`} onClick={() => setSelectedWorldId(w.id)}>
                <div className="world-icon" style={{ background: MODE_BACKGROUNDS[w.mode]?.gradient }}>{w.icon}</div>
                <div className="world-info">
                  <strong>{w.name}</strong>
                  <span>{w.seed} • {GAME_MODES.find(m => m.id === w.mode)?.label} • {w.lastPlayed}</span>
                  <small>Growth: {w.growth} • Size: {w.size} {w.cheats ? '• Cheats' : ''} {w.mods ? '• Mods' : ''}</small>
                </div>
                <div className="world-actions">
                  <button className="icon-btn edit" title="Edit World (pencil)" onClick={e => { e.stopPropagation(); setEditWorld({ ...w }); setPhase('EDIT_WORLD'); }}>✎</button>
                  <button className="icon-btn delete" title="Delete" onClick={e => { e.stopPropagation(); handleDeleteWorld(w.id); }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
          <div className="world-list-footer">
            <button className="btn-primary" onClick={() => selectedWorld && beginWorld(selectedWorld.seed, selectedWorld.mode)}>Play Selected World</button>
            <button className="btn-secondary" onClick={() => { setCreateForm({ id: '', name: `New World ${worlds.length + 1}`, seed: 'seed_' + Math.random().toString(36).slice(2, 8), mode: 'survival', lastPlayed: 'Now', size: '0 MB', growth: '0 chunks', icon: '🌍', cheats: false, mods: false }); setPhase('CREATE_WORLD'); }}>Create New World</button>
            <button className="btn-secondary" onClick={() => setPhase('MAIN')}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'CREATE_WORLD') {
    return (
      <div className="main-menu create-world-phase">
        <div className="mc-skybox" style={{ background: MODE_BACKGROUNDS[createForm.mode]?.gradient ?? effectiveBackground.gradient }} />
        <div className="create-world-container">
          <h2>Create New World</h2>
          <label>World Name <input value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} /></label>
          <label>Seed <input value={createForm.seed} onChange={e => setCreateForm({ ...createForm, seed: e.target.value })} placeholder="Leave blank for random" /><button className="small" onClick={() => setCreateForm({ ...createForm, seed: Math.random().toString(36).slice(2, 10) })}>Randomize</button><button className="small" onClick={() => setCreateForm({ ...createForm, name: 'Floating Islands Preset', seed: 'floating_islands_' + Math.random().toString(36).slice(2, 8), icon: '☁️' })}>Floating Islands Preset</button></label>
          <div className="mode-select inline">
            {GAME_MODES.map(entry => (
              <button key={entry.id} className={`mode-card mini ${createForm.mode === entry.id ? 'selected' : ''}`} onClick={() => setCreateForm({ ...createForm, mode: entry.id })}>
                <strong>{MODE_BACKGROUNDS[entry.id]?.emoji} {entry.label}</strong><small>{entry.description}</small>
              </button>
            ))}
          </div>
          <label className="check"><input type="checkbox" checked={createForm.cheats} onChange={e => setCreateForm({ ...createForm, cheats: e.target.checked })} /> Allow Cheats (sheets) — enable commands like /day /time /summon</label>
          <label className="check"><input type="checkbox" checked={createForm.mods} onChange={e => setCreateForm({ ...createForm, mods: e.target.checked })} /> Enable Mods & Resource Packs / Shaders</label>
          <div className="create-footer">
            <button className="btn-primary" onClick={handleCreateWorld}>Create New World</button>
            <button className="btn-secondary" onClick={() => setPhase('WORLD_LIST')}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'EDIT_WORLD') {
    if (!editWorld) return null;
    return (
      <div className="main-menu create-world-phase">
        <div className="mc-skybox" style={{ background: MODE_BACKGROUNDS[editWorld.mode]?.gradient }} />
        <div className="create-world-container">
          <h2>✎ Edit World — {editWorld.name}</h2>
          <label>World Name <input value={editWorld.name} onChange={e => setEditWorld({ ...editWorld, name: e.target.value })} /></label>
          <label>Seed <span className="muted">{editWorld.seed}</span><button className="small" onClick={() => setEditWorld({ ...editWorld, seed: Math.random().toString(36).slice(2, 10) })}>Change Seed</button></label>
          <div className="mode-select inline">
            {GAME_MODES.map(entry => (
              <button key={entry.id} className={`mode-card mini ${editWorld.mode === entry.id ? 'selected' : ''}`} onClick={() => setEditWorld({ ...editWorld, mode: entry.id })}>
                <strong>{entry.label}</strong><small>{entry.description}</small>
              </button>
            ))}
          </div>
          <label className="check"><input type="checkbox" checked={editWorld.cheats} onChange={e => setEditWorld({ ...editWorld, cheats: e.target.checked })} /> Allow Cheats</label>
          <label className="check"><input type="checkbox" checked={editWorld.mods} onChange={e => setEditWorld({ ...editWorld, mods: e.target.checked })} /> Enable Mods & Resource Packs</label>
          <div className="create-footer"><button className="btn-primary" onClick={handleEditSave}>Save World</button><button className="btn-secondary" onClick={() => setPhase('WORLD_LIST')}>Cancel</button></div>
        </div>
      </div>
    );
  }

  // ===== MAIN =====
  return (
    <div className="main-menu main-phase" ref={containerRef}>
      <div className="mc-skybox" style={{ background: effectiveBackground.gradient, transform: `translate3d(${mouseParallax.x * 0.8}px,${mouseParallax.y * 0.8}px,0) scale(1.1)` }}>
        <div className="mc-clouds">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="mc-cloud" style={{ left: `${10 + i * 14}%`, top: `${6 + i * 4}%`, animationDelay: `${i * 0.8}s` }} />)}</div>
        <div className="mc-sun" /><div className="panorama-vignette stronger" />
      </div>
      <div className="panorama-label"><span className="emoji">{effectiveBackground.emoji}</span> {effectiveBackground.label} — movable panorama picture for every area • Clouds moving stunning far away • 16 chunks</div>
      <div className="main-layout">
        <div className="menu-background release-2-menu warped-3d pro">
          <div className="menu-title-3d small"><h1 className="title-warped small"><span className="title-shadow">EAOIN</span><span className="title-front">EAOIN</span></h1><div className="splash-text small" onClick={reshuffleSplash}>{splash}</div><p className="subtitle">{RELEASE_LABEL} • Settings front-page • Marketplace fixed • World list centered</p></div>
          <div className="menu-card grid-pro">
            <div className="left-col">
              <h3 className="col-title">Singleplayer — centered world list like Minecraft (growth on side)</h3>
              <button className="btn-primary minecraft-btn big" onClick={() => setPhase('WORLD_LIST')}><span>🎮 Singleplayer — Select World (centered)</span><small>Growth shown on side • Name • Seed • Mode • Cheats • Mods • Edit ✎</small></button>
              <h3 className="col-title">Game Area — hover to move panorama</h3>
              <div className="mode-select pro">{GAME_MODES.map(entry => (
                <button key={entry.id} className={`mode-card pro ${mode === entry.id ? 'selected' : ''} ${hoverMode === entry.id ? 'hovered' : ''}`} onClick={() => setMode(entry.id)} onMouseEnter={() => setHoverMode(entry.id)} onMouseLeave={() => setHoverMode(null)}>
                  <strong>{MODE_BACKGROUNDS[entry.id]?.emoji} {entry.label}</strong><span>{entry.description}</span><small>{MODE_BACKGROUNDS[entry.id]?.label}</small>
                </button>
              ))}</div>
              <input type="text" value={seed} onChange={e => setSeed(e.target.value)} placeholder="World Seed" className="seed-input pro" />
              <button onClick={() => beginWorld(seed, mode)} className="btn-primary minecraft-btn big"><span>Play {GAME_MODES.find(e => e.id === mode)?.label}</span><small>{seed ? `Seed ${seed.slice(0, 18)}` : 'Random'} • Spawn clear 26m • Clouds moving • Fog 100-1000</small></button>
              <button onClick={() => beginWorld(undefined, 'experimental')} className="btn-secondary minecraft-btn">Quick Experimental — Ray Traced Shadows + Clouds</button>
              <div className="quick-row">
                <button className="menu-settings-link mc-link" onClick={() => setSettingsOpen(v => !v)}>⚙️ Settings (front-page)</button>
                <button className="menu-settings-link mc-link" onClick={() => setMarketOpen(v => !v)}>🛒 Marketplace</button>
                <button className="menu-settings-link mc-link" onClick={() => setMultiplayerOpen(v => !v)}>🌐 Multiplayer</button>
                <button className="menu-settings-link mc-link" onClick={() => setModsOpen(v => !v)}>🧩 Mods & Packs</button>
                <button className="menu-settings-link mc-link" onClick={() => setCreatorOpen(v => !v)}>🧍 Character Creator</button>
              </div>
            </div>
            <div className="right-col">
              {settingsOpen && (
                <div className="menu-settings-card pro settings-front"><strong>⚙️ Settings — Front Page</strong>
                  <div className="settings-grid">
                    <label><span>Volume {Math.round(settings.volume * 100)}%</span><input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={e => saveSettingsPatch({ volume: Number(e.target.value) } as any)} /></label>
                    <label className="checkbox"><input type="checkbox" checked={settings.muted} onChange={e => saveSettingsPatch({ muted: e.target.checked })} /><span>Muted</span></label>
                    <label><span>Quality (render distance up to 16)</span><select value={settings.qualityPreset} onChange={e => saveSettingsPatch({ qualityPreset: e.target.value as any })}><option value="performance">Performance (6)</option><option value="balanced">Balanced (8)</option><option value="quality">Quality (12)</option><option value="cinematic">Cinematic (16 + clouds)</option></select></label>
                    <label><span>Renderer</span><select value={settings.rendererPreference} onChange={e => saveSettingsPatch({ rendererPreference: e.target.value as any })}><option value="auto">Auto: WebGPU first</option><option value="webgpu">Prefer WebGPU</option><option value="webgl">Force WebGL</option></select></label>
                    <label><span>Render scale {Math.round(settings.renderScale * 100)}%</span><input type="range" min={0.5} max={1.5} step={0.1} value={settings.renderScale} onChange={e => saveSettingsPatch({ renderScale: Number(e.target.value) })} /></label>
                    <label className="checkbox"><input type="checkbox" checked={settings.fogEnabled} onChange={e => saveSettingsPatch({ fogEnabled: e.target.checked })} /><span>Fog 100-1000 toggle (reduced)</span></label>
                    <label className="checkbox"><input type="checkbox" checked={settings.realisticLighting} onChange={e => saveSettingsPatch({ realisticLighting: e.target.checked })} /><span>Realistic lighting + shadows</span></label>
                  </div>
                  <button onClick={() => setSettingsOpen(false)} className="btn-secondary mini">Close</button>
                </div>
              )}
              {marketOpen && (
                <div className="menu-settings-card pro marketplace-front">
                  <strong>🛒 Marketplace</strong>
                  <div className="market-categories">
                    {categories.map(cat => (
                      <button key={cat} className={`btn-secondary mini ${catFilter === cat ? 'selected' : ''}`} onClick={() => setCatFilter(cat)}>{cat}</button>
                    ))}
                  </div>
                  <div className="marketplace-list">
                    {filteredPacks.length === 0 && <div className="market-pack"><em>No packs in this category yet</em></div>}
                    {filteredPacks.map(pack => (
                      <div key={pack.id} className="market-pack">
                        <strong>{pack.name}</strong>
                        <span>{pack.creator} • {pack.category} • {pack.priceCoins} coins • {pack.downloads} dl</span>
                        <em>{pack.published ? 'Published ✅' : 'Draft'}</em>
                      </div>
                    ))}
                  </div>
                  <div className="market-stats"><span>Packs: {marketStatus.packs}</span><span>Published: {marketStatus.publishedPacks}</span><span>Coins: {marketStatus.grossCoins}</span></div>
                  <div className="market-actions">
                    <button onClick={() => { marketplace.publishDraft('New Adventure Map'); setMarketRevision(v => v + 1); }} className="btn-secondary mini">Create Draft</button>
                    <button onClick={() => { marketplace.approveAll(); setMarketRevision(v => v + 1); }} className="btn-primary mini">Approve All</button>
                  </div>
                  <button onClick={() => setMarketOpen(false)} className="btn-secondary mini">Close</button>
                </div>
              )}
              {creatorOpen && <div className="menu-settings-card character-creator pro"><strong>👨‍👩‍👧 Family / Character Creator</strong><label>Skin <input type="color" value={skinTone} onChange={e => setSkinTone(e.target.value)} /></label><label>Shirt <input type="color" value={shirtColor} onChange={e => setShirtColor(e.target.value)} /></label><div className="avatar-preview pro" style={{ background: shirtColor, borderColor: skinTone }}><div className="preview-head" style={{ background: skinTone }} /></div><button onClick={() => setCreatorOpen(false)} className="btn-secondary mini">Save</button></div>}
              {multiplayerOpen && (
                <div className="menu-settings-card pro multiplayer-front">
                  <strong>🌐 Multiplayer</strong>
                  <p>Join friends and discover community worlds.</p>
                  <div className="market-pack"><strong>EAOIN Official Realms</strong><span>Online • 128 players • Survival / Creative</span><button className="btn-primary mini">Join</button></div>
                  <div className="market-pack"><strong>Community Adventure Hub</strong><span>Online • Cross-play • Quests and worlds</span><button className="btn-secondary mini">View</button></div>
                  <button onClick={() => setMultiplayerOpen(false)} className="btn-secondary mini">Close</button>
                </div>
              )}
              {modsOpen && (
                <div className="menu-settings-card pro mods-front">
                  <strong>🧩 Mods & Packs</strong>
                  <p>Manage your installed content before entering a world.</p>
                  <div className="market-pack"><strong>World & Gameplay Packs</strong><span>12 installed • 4 enabled</span><button className="btn-primary mini">Manage</button></div>
                  <div className="market-pack"><strong>Texture Packs</strong><span>HD voxel materials • shaders • UI themes</span><button className="btn-secondary mini">Browse</button></div>
                  <div className="market-pack"><strong>Upload Pack</strong><span>Worlds, skins, textures, mods and DLC</span><button className="btn-secondary mini">Upload</button></div>
                  <button onClick={() => setModsOpen(false)} className="btn-secondary mini">Close</button>
                </div>
              )}
              {!settingsOpen && !marketOpen && !multiplayerOpen && !modsOpen && !creatorOpen && <div className="menu-info-card pro"><h4>✨ What’s new 3.2</h4><ul><li>☁️ Cloud map — Minecraft clouds stunning far, moving</li><li>🏔️ Default worlds now use regular Minecraft-like solid terrain; floating islands are a preset seed</li><li>📋 Create world screen with growth on side like Minecraft — name, seed, mode, cheats/sheets, mods</li><li>✎ Edit world with pencil button, centered layout, not square menu 123 on sides</li><li>🌗 Day/night 20 min cycle</li><li>🎒 Inventory block logos, survival 2x2 + 3x3 table crafting above</li><li>👊 Hand punching — arm goes towards tree</li><li>💥 Block cracking overlay — official cracking, not just bar</li><li>🌫️ Fog reduced to 100-1000 toggle</li><li>💬 T chat + /day /time /summon entity commands</li></ul></div>}
            </div>
          </div>
          <div className="menu-footer pro"><p>3.2 • Clouds visible • 16 chunks • Regular Minecraft-like worlds by default • Floating Islands preset seed • F fly button • 20min day • Inventory logos • Hand punch + cracking • Fog 100-1000 • T chat /day /time • World list centered</p></div>
        </div>
      </div>
    </div>
  );
}

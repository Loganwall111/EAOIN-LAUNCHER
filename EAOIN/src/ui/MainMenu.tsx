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

type MenuPhase = 'BOOT' | 'SPLASH_PLAY' | 'POST_PLAY_LOADING' | 'MAIN' | 'WORLD_LIST' | 'CREATE_WORLD' | 'EDIT_WORLD';

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

// ===== Enhanced Marketplace Types =====
interface MarketplaceCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface MarketplaceItem {
  id: string;
  name: string;
  creator: string;
  category: string;
  priceCoins: number;
  downloads: number;
  rating: number;
  image: string;
  tags: string[];
}

const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  { id: 'worlds', name: 'Worlds', icon: '🌍', color: '#6cc24a' },
  { id: 'skins', name: 'Skin Packs', icon: '👤', color: '#5dd6ff' },
  { id: 'textures', name: 'Texture Packs', icon: '🎨', color: '#a879ff' },
  { id: 'shaders', name: 'Shaders', icon: '✨', color: '#ffd166' },
  { id: 'mods', name: 'Mods', icon: '🧩', color: '#ff7ac1' },
  { id: 'dlc', name: 'DLC', icon: '📦', color: '#ff6b6b' },
];

const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  // Worlds
  { id: 'black-hole-singularity', name: 'Black Hole Singularity', creator: 'EAOIN Labs', category: 'worlds', priceCoins: 990, downloads: 1240, rating: 4.8, image: '🌑', tags: ['space', 'adventure'] },
  { id: 'space-exploration', name: 'Space Exploration', creator: 'EAOIN Labs', category: 'worlds', priceCoins: 850, downloads: 980, rating: 4.6, image: '🚀', tags: ['space', 'exploration'] },
  { id: 'floating-islands', name: 'Floating Islands', creator: 'Community', category: 'worlds', priceCoins: 0, downloads: 5420, rating: 4.9, image: '🏝️', tags: ['nature', 'building'] },
  { id: 'medieval-kingdom', name: 'Medieval Kingdom', creator: 'Community', category: 'worlds', priceCoins: 450, downloads: 2100, rating: 4.7, image: '🏰', tags: ['medieval', 'quest'] },
  // Skins
  { id: 'skin-character-creator', name: 'Skin Packs + Creator', creator: 'EAOIN Labs', category: 'skins', priceCoins: 450, downloads: 2100, rating: 4.5, image: '👨‍👩‍👧', tags: ['character', 'customization'] },
  { id: 'sci-fi-packs', name: 'Sci-Fi Character Pack', creator: 'Community', category: 'skins', priceCoins: 300, downloads: 890, rating: 4.4, image: '🧑‍🚀', tags: ['sci-fi', 'space'] },
  { id: 'medieval-skins', name: 'Medieval Skins Pack', creator: 'Community', category: 'skins', priceCoins: 200, downloads: 1200, rating: 4.3, image: '⚔️', tags: ['medieval', 'fantasy'] },
  // Textures
  { id: 'hd-textures', name: 'HD Texture Pack', creator: 'Community', category: 'textures', priceCoins: 350, downloads: 3200, rating: 4.6, image: '🖼️', tags: ['hd', 'graphics'] },
  { id: 'pixel-art-textures', name: 'Pixel Art Pack', creator: 'Community', category: 'textures', priceCoins: 0, downloads: 4800, rating: 4.8, image: '📷', tags: ['retro', 'pixel'] },
  // Shaders
  { id: 'rtx-shaders', name: 'RTX Ray Tracing', creator: 'EAOIN Labs', category: 'shaders', priceCoins: 750, downloads: 1500, rating: 4.9, image: '💎', tags: ['rtx', 'raytracing'] },
  { id: 'cinematic-shaders', name: 'Cinematic Shader Pack', creator: 'Community', category: 'shaders', priceCoins: 400, downloads: 2200, rating: 4.7, image: '🎬', tags: ['cinematic', 'movie'] },
  // Mods
  { id: 'twilight-forest-mods', name: 'Twilight Forest', creator: 'EAOIN Labs', category: 'mods', priceCoins: 500, downloads: 890, rating: 4.8, image: '🌲', tags: ['adventure', 'biome'] },
  { id: 'galacticraft-mods', name: 'Galacticraft', creator: 'EAOIN Labs', category: 'mods', priceCoins: 600, downloads: 760, rating: 4.6, image: '🪐', tags: ['space', 'travel'] },
  // DLC
  { id: 'creature-dlc', name: 'Creature Collection DLC', creator: 'EAOIN Labs', category: 'dlc', priceCoins: 400, downloads: 540, rating: 4.5, image: '🐉', tags: ['creatures', 'mobs'] },
  { id: 'plant-dlc', name: 'Plant Life DLC', creator: 'EAOIN Labs', category: 'dlc', priceCoins: 250, downloads: 680, rating: 4.4, image: '🌺', tags: ['plants', 'nature'] },
];

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
  const [phase, setPhase] = useState<MenuPhase>('BOOT');
  const [bootProgress, setBootProgress] = useState(0);
  const [postProgress, setPostProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [splash, setSplash] = useState(() => SPLASHES[Math.floor(Math.random() * SPLASHES.length)]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [skinTone, setSkinTone] = useState('#b86f48');
  const [shirtColor, setShirtColor] = useState('#2467c7');
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [mouseParallax, setMouseParallax] = useState({ x: 0, y: 0 });
  const marketplace = useMemo(() => new MarketplaceRuntime(), []);
  const containerRef = useRef<HTMLDivElement>(null);

  // New: Marketplace bottom bar state
  const [marketCategory, setMarketCategory] = useState<string>('worlds');
  const [marketSearch, setMarketSearch] = useState('');
  const [marketTab, setMarketTab] = useState<'browse' | 'create' | 'my-packs'>('browse');
  const [selectedPack, setSelectedPack] = useState<MarketplaceItem | null>(null);

  // World selection state
  const [worlds, setWorlds] = useState<WorldEntry[]>(() => loadWorlds(currentSeed));
  const [selectedWorldId, setSelectedWorldId] = useState<string>('world_1');
  const [createForm, setCreateForm] = useState<WorldEntry>({ id: '', name: 'New World', seed: currentSeed, mode: 'survival', lastPlayed: 'Now', size: '0 MB', growth: '0 chunks', icon: '🌍', cheats: false, mods: false });
  const [editWorld, setEditWorld] = useState<WorldEntry | null>(null);

  const selectedWorld = worlds.find(w => w.id === selectedWorldId) ?? worlds[0];

  useEffect(() => saveWorlds(worlds), [worlds]);
  useEffect(() => { if (mode === 'survival' && creatorOpen) setCreatorOpen(false); }, [mode, creatorOpen]);

  // Boot loading - with safety fallback
  useEffect(() => {
    if (phase !== 'BOOT') return;
    let p = 0;
    let mounted = true;
    const id = window.setInterval(() => {
      if (!mounted) return;
      p += Math.random() * 14 + 5;
      if (p >= 100) { 
        p = 100; 
        setBootProgress(100); 
        if (mounted) {
          window.setTimeout(() => {
            if (mounted) setPhase('SPLASH_PLAY');
          }, 350);
        }
        window.clearInterval(id); 
      }
      else setBootProgress(p);
    }, 90);
    return () => { mounted = false; window.clearInterval(id); };
  }, [phase]);

  // Post-play loading
  useEffect(() => {
    if (phase !== 'POST_PLAY_LOADING') return;
    let p = 0;
    let mounted = true;
    const tipId = window.setInterval(() => { if (mounted) setTipIndex(i => (i + 1) % POST_PLAY_TIPS.length); }, 260);
    const id = window.setInterval(() => {
      if (!mounted) return;
      p += Math.random() * 9 + 4;
      if (p >= 100) { 
        setPostProgress(100); 
        window.clearInterval(id); 
        window.clearInterval(tipId); 
        if (mounted) {
          window.setTimeout(() => {
            if (mounted) setPhase('MAIN');
          }, 420);
        }
      }
      else setPostProgress(p);
    }, 85);
    return () => { mounted = false; window.clearInterval(id); window.clearInterval(tipId); };
  }, [phase]);

  // Parallax
  useEffect(() => {
    const h = (e: MouseEvent) => setMouseParallax({ x: (e.clientX / window.innerWidth - 0.5) * 24, y: (e.clientY / window.innerHeight - 0.5) * 18 });
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, []);

  const effectiveBackground = (hoverMode ?? mode) ? MODE_BACKGROUNDS[hoverMode ?? mode] : MODE_BACKGROUNDS.survival;
  const beginPlayClick = () => { if (phase === 'SPLASH_PLAY') { setPhase('POST_PLAY_LOADING'); setPostProgress(0); setTipIndex(0); } };
  const beginWorld = (s?: string, m?: GameMode) => onStart(s ?? seed, m ?? mode);
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

  // Filter marketplace items
  const filteredMarketItems = useMemo(() => {
    return MARKETPLACE_ITEMS.filter(item => {
      const matchesCategory = item.category === marketCategory;
      const matchesSearch = marketSearch === '' || 
        item.name.toLowerCase().includes(marketSearch.toLowerCase()) ||
        item.creator.toLowerCase().includes(marketSearch.toLowerCase()) ||
        item.tags.some(tag => tag.toLowerCase().includes(marketSearch.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [marketCategory, marketSearch]);

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
        <div className="mc-skybox" style={{ background: MODE_BACKGROUNDS[editWorld.mode].gradient }} />
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
                <button className="menu-settings-link mc-link" onClick={() => setSettingsOpen(v => !v)}>⚙️ Settings</button>
                <button className="menu-settings-link mc-link" onClick={() => setMarketOpen(v => !v)}>🛒 Marketplace</button>
                {mode !== 'survival' && <button className="menu-settings-link mc-link" onClick={() => setCreatorOpen(v => !v)}>👨‍👩‍👧 Character</button>}
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
                <div className="menu-settings-card pro marketplace-front"><strong>🛒 Marketplace — Fixed</strong><div className="marketplace-list">{marketplace.getPacks().map(pack => <div key={pack.id} className="market-pack"><strong>{pack.name}</strong><span>{pack.creator} • {pack.category} • {pack.priceCoins} coins • {pack.downloads} dl</span><em>{pack.published ? 'Published ✅' : 'Draft'}</em></div>)}</div><div className="market-stats"><span>Packs: {marketplace.getStatus().packs}</span><span>Published: {marketplace.getStatus().publishedPacks}</span><span>Coins: {marketplace.getStatus().grossCoins}</span></div><div className="market-actions"><button onClick={() => { marketplace.publishDraft('New Adventure Map'); }} className="btn-secondary mini">Create Draft</button><button onClick={() => { marketplace.approveAll(); }} className="btn-primary mini">Approve All</button></div><button onClick={() => setMarketOpen(false)} className="btn-secondary mini">Close</button></div>
              )}
              {mode !== 'survival' && creatorOpen && <div className="menu-settings-card character-creator pro"><strong>👨‍👩‍👧 Family / Character Creator</strong><label>Skin <input type="color" value={skinTone} onChange={e => setSkinTone(e.target.value)} /></label><label>Shirt <input type="color" value={shirtColor} onChange={e => setShirtColor(e.target.value)} /></label><div className="avatar-preview pro" style={{ background: shirtColor, borderColor: skinTone }}><div className="preview-head" style={{ background: skinTone }} /></div><button onClick={() => setCreatorOpen(false)} className="btn-secondary mini">Save</button></div>}
              {!settingsOpen && !marketOpen && !creatorOpen && <div className="menu-info-card pro"><h4>✨ What's new 3.2</h4><ul><li>☁️ Cloud map — Minecraft clouds stunning far, moving</li><li>🏔️ Default worlds now use regular Minecraft-like solid terrain; floating islands are a preset seed</li><li>📋 Create world screen with growth on side like Minecraft — name, seed, mode, cheats/sheets, mods</li><li>✎ Edit world with pencil button, centered layout, not square menu 123 on sides</li><li>🌗 Day/night 20 min cycle</li><li>🎒 Inventory block logos, survival 2x2 + 3x3 table crafting above</li><li>👊 Hand punching — arm goes towards tree</li><li>💥 Block cracking overlay — official cracking, not just bar</li><li>🌫️ Fog reduced to 100-1000 toggle</li><li>💬 T chat + /day /time /summon entity commands</li></ul></div>}
            </div>
          </div>
          <div className="menu-footer pro"><p>3.2 • Clouds visible • 16 chunks • Regular Minecraft-like worlds by default • Floating Islands preset seed • F fly button • 20min day • Inventory logos • Hand punch + cracking • Fog 100-1000 • T chat /day /time • World list centered</p></div>
        </div>
      </div>
      
      {/* ===== NEW: ENHANCED MARKETPLACE BAR AT BOTTOM ===== */}
      <div className="marketplace-bottom-bar">
        <div className="market-bar-header">
          <h3>🛒 EAOIN Marketplace</h3>
          <div className="market-tabs">
            <button className={`market-tab ${marketTab === 'browse' ? 'active' : ''}`} onClick={() => setMarketTab('browse')}>
              📦 Browse Packs
            </button>
            <button className={`market-tab ${marketTab === 'create' ? 'active' : ''}`} onClick={() => setMarketTab('create')}>
              ✏️ Create Pack
            </button>
            <button className={`market-tab ${marketTab === 'my-packs' ? 'active' : ''}`} onClick={() => setMarketTab('my-packs')}>
              📁 My Packs
            </button>
          </div>
          <input 
            type="text" 
            className="market-search" 
            placeholder="🔍 Search packs, creators, tags..." 
            value={marketSearch}
            onChange={e => setMarketSearch(e.target.value)}
          />
        </div>
        
        <div className="market-bar-content">
          {marketTab === 'browse' && (
            <>
              <div className="market-categories">
                {MARKETPLACE_CATEGORIES.map(cat => (
                  <button 
                    key={cat.id} 
                    className={`market-cat-btn ${marketCategory === cat.id ? 'active' : ''}`}
                    style={{ '--cat-color': cat.color } as React.CSSProperties}
                    onClick={() => setMarketCategory(cat.id)}
                  >
                    <span className="cat-icon">{cat.icon}</span>
                    <span className="cat-name">{cat.name}</span>
                  </button>
                ))}
              </div>
              <div className="market-items-grid">
                {filteredMarketItems.length > 0 ? (
                  filteredMarketItems.map(item => (
                    <div key={item.id} className="market-item-card" onClick={() => setSelectedPack(item)}>
                      <div className="item-image">{item.image}</div>
                      <div className="item-info">
                        <strong>{item.name}</strong>
                        <span className="item-creator">by {item.creator}</span>
                        <div className="item-rating">{'⭐'.repeat(Math.round(item.rating))} {item.rating}</div>
                        <div className="item-tags">
                          {item.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="item-tag">{tag}</span>
                          ))}
                        </div>
                      </div>
                      <div className="item-price">
                        {item.priceCoins === 0 ? (
                          <span className="price-free">FREE</span>
                        ) : (
                          <span className="price-coins">💎 {item.priceCoins}</span>
                        )}
                        <span className="downloads">⬇ {item.downloads.toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="market-empty">
                    <p>No packs found. Try a different search or category!</p>
                  </div>
                )}
              </div>
            </>
          )}
          
          {marketTab === 'create' && (
            <div className="market-create-section">
              <div className="create-pack-form">
                <h4>✨ Create Your Own Pack</h4>
                <div className="form-row">
                  <label>Pack Name:</label>
                  <input type="text" placeholder="My Awesome Pack" />
                </div>
                <div className="form-row">
                  <label>Pack Type:</label>
                  <select>
                    <option value="">Select type...</option>
                    {MARKETPLACE_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>Description:</label>
                  <textarea placeholder="Describe your pack..." rows={3}></textarea>
                </div>
                <div className="form-row">
                  <label>Price (0 = Free):</label>
                  <input type="number" min="0" placeholder="0" />
                </div>
                <div className="form-row">
                  <label>Upload Files:</label>
                  <button className="upload-btn">📁 Select Files...</button>
                </div>
                <div className="create-actions">
                  <button className="btn-primary">🚀 Publish Pack</button>
                  <button className="btn-secondary">💾 Save as Draft</button>
                </div>
              </div>
              <div className="modding-preview">
                <h4>🎨 Modding Capabilities</h4>
                <ul>
                  <li>✏️ Create custom skins & character models</li>
                  <li>🖼️ Design texture packs with custom blocks & items</li>
                  <li>🌍 Build custom worlds with unique biomes</li>
                  <li>🧩 Develop mods with JavaScript scripting</li>
                  <li>✨ Create custom shaders & visual effects</li>
                  <li>🎵 Add custom music & sound effects</li>
                  <li>📦 Bundle DLC content with new features</li>
                </ul>
                <p className="mod-note">All creations can be shared on the EAOIN Marketplace!</p>
              </div>
            </div>
          )}
          
          {marketTab === 'my-packs' && (
            <div className="market-my-packs">
              <h4>📁 My Created Packs</h4>
              <div className="my-packs-list">
                <div className="my-pack-item">
                  <span className="pack-icon">📦</span>
                  <div className="pack-details">
                    <strong>My Test World</strong>
                    <span>World • Draft • 0 downloads</span>
                  </div>
                  <button className="btn-secondary mini">Edit</button>
                </div>
              </div>
              <div className="my-stats">
                <div className="stat-box">
                  <strong>0</strong>
                  <span>Published Packs</span>
                </div>
                <div className="stat-box">
                  <strong>0</strong>
                  <span>Total Downloads</span>
                </div>
                <div className="stat-box">
                  <strong>0 💎</strong>
                  <span>Total Earnings</span>
                </div>
              </div>
              <button className="btn-primary" onClick={() => setMarketTab('create')}>➕ Create New Pack</button>
            </div>
          )}
        </div>
      </div>
      
      {/* Pack Detail Modal */}
      {selectedPack && (
        <div className="pack-detail-modal" onClick={() => setSelectedPack(null)}>
          <div className="pack-detail-card" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedPack(null)}>✕</button>
            <div className="detail-header">
              <span className="detail-image">{selectedPack.image}</span>
              <div className="detail-title">
                <h2>{selectedPack.name}</h2>
                <p>by {selectedPack.creator}</p>
                <div className="detail-rating">{'⭐'.repeat(Math.round(selectedPack.rating))} {selectedPack.rating} ({selectedPack.downloads.toLocaleString()} downloads)</div>
              </div>
            </div>
            <div className="detail-tags">
              {selectedPack.tags.map(tag => (
                <span key={tag} className="detail-tag">{tag}</span>
              ))}
            </div>
            <div className="detail-actions">
              {selectedPack.priceCoins === 0 ? (
                <button className="btn-primary big">⬇️ Download Free</button>
              ) : (
                <button className="btn-primary big">💎 Buy for {selectedPack.priceCoins} Coins</button>
              )}
              <button className="btn-secondary">❤️ Add to Wishlist</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

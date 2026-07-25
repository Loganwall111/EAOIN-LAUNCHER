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

type MenuPhase = 'BOOT' | 'SPLASH_PLAY' | 'POST_PLAY_LOADING' | 'MAIN';

const SPLASHES = [
  'Now with 26m clear spawn!',
  'Settlement 58m away!',
  'Rocket 110m in clearing!',
  'SPACE to jump — fixed!',
  'Ray traced shadows!',
  'SSAO + Bloom + Reflections!',
  'O objectives U systems!',
  'De-cluttered world grid!',
  'Minecraft skybox vibes!',
  'More colours than before!',
  'WASD + SPACE feels smooth!',
  'No more hyper-cramped!',
  'Marketplace fixed!',
  'Auralis Megacity 180m out!',
  'Pirates 98m away!',
  'Ender isles 155m!',
  'Portal core 72m NE!',
  'Also try Survival!',
  'Creative but spacious!',
  'Experimental Vulkan!',
  'Craft with style!',
  'Build without collision!',
  'Voxels but pro!',
  'Yellow splash text!',
  '100% more Minecraft!',
  'Now with splash physics!',
  'T is for tools!',
  'I is inventory!',
  'G is door!',
  'R is rocket!',
  'P is dimension!',
  'B is barter!',
  'V is supplies!',
  'L is redstone!',
  'N is boss!',
  'C is credits!',
  'K skips credits!',
  'H for god mode!',
  'F5 third person!',
  'Bouncy yellow text!',
  '/ help for commands!',
  'Rare McDonalds world!',
  'Incredible mode!',
  '400km city biome!',
  'Black hole singularity!',
  'Water physics!',
  'Glass physics!',
  'Cloth banners wave!',
  'Crisp movement!',
  'Smaller ellipsoid!',
  'Fixed ellipsoid 0.32!',
  'Jump velocity 7.5!',
  'No more stuck!',
  'Spawn is breathable!',
  'Professional game feel!',
  '3D warped UI!',
  'Panorama moves with mouse!',
  'Settings on front page!',
  'Marketplace front and center!',
  'Character creator!',
  'Multi-coloured loading!',
  'More alive atmosphere!',
  'God rays!',
  'Starfield 120 stars!',
];

const POST_PLAY_TIPS = [
  'Clearing spawn 26m radius…',
  'Spreading settlement 58m NW…',
  'Placing rocket launchpad 110m SE in clearing…',
  'Moving portal core 72m NE…',
  'Building dimensional doors 48m & 68m out…',
  'Relocating palette 38m north…',
  'Streaming Auralis Megacity 180m away…',
  'Anchoring pirate lake 98m SW…',
  'Carving Ender isles 155m out…',
  'Baking ray traced soft shadows 2048²…',
  'Computing SSAO ambient occlusion…',
  'Warming up bloom + reflections…',
  'Sharpening Minecraft skybox gradient…',
  'Tuning jump physics space→7.5 vel…',
  'Shrinking ellipsoid to 0.32 to avoid cramp…',
  'Ready — world is de-cluttered!',
];

const MODE_BACKGROUNDS: Record<GameMode, { label: string; gradient: string; emoji: string }> = {
  survival: { label: 'Overworld sunrise — grass drops glisten', gradient: 'linear-gradient(180deg,#4a8fc7 0%,#76b6e0 28%,#6cc24a 54%,#3f7a2a 60%,#8a5a36 100%)', emoji: '🌄' },
  creative: { label: 'Endless flat canvas — build spacious', gradient: 'linear-gradient(180deg,#7bb8e8 0%,#a7d8ff 35%,#b0e09a 60%,#d8c07a 100%)', emoji: '🏗️' },
  story: { label: 'Village lights far NW', gradient: 'linear-gradient(180deg,#2a2a5a 0%,#4a3a7a 30%,#ffaa55 58%,#1a1a2a 100%)', emoji: '🏘️' },
  experimental: { label: 'Vulkan ray-traced lab — SSAO bloom', gradient: 'linear-gradient(180deg,#0a0a1a 0%,#2a1a6a 28%,#8a2be2 62%,#ff4d8d 85%,#0a0a0a 100%)', emoji: '🔬' },
  incredible: { label: 'Rare seed fireworks — McDonalds!', gradient: 'linear-gradient(180deg,#ff2020 0%,#ffcc00 28%,#20ff88 55%,#2040ff 82%,#000 100%)', emoji: '🌈' },
};

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

  // Boot loading simulation
  useEffect(() => {
    if (phase !== 'BOOT') return;
    let p = 0;
    const id = window.setInterval(() => {
      p += Math.random() * 14 + 5;
      if (p >= 100) {
        p = 100;
        setBootProgress(100);
        window.setTimeout(() => setPhase('SPLASH_PLAY'), 350);
        window.clearInterval(id);
      } else setBootProgress(p);
    }, 90);
    return () => window.clearInterval(id);
  }, [phase]);

  // Post-play loading simulation — colorful multi-colour progression
  useEffect(() => {
    if (phase !== 'POST_PLAY_LOADING') return;
    let p = 0;
    const tipId = window.setInterval(() => setTipIndex((i) => (i + 1) % POST_PLAY_TIPS.length), 260);
    const id = window.setInterval(() => {
      p += Math.random() * 9 + 4;
      if (p >= 100) {
        setPostProgress(100);
        window.clearInterval(id);
        window.clearInterval(tipId);
        window.setTimeout(() => setPhase('MAIN'), 420);
      } else setPostProgress(p);
    }, 85);
    return () => {
      window.clearInterval(id);
      window.clearInterval(tipId);
    };
  }, [phase]);

  // Parallax mouse tracking for movable panorama picture
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 24;
      const ny = (e.clientY / window.innerHeight - 0.5) * 18;
      setMouseParallax({ x: nx, y: ny });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  const effectiveBackground = (hoverMode ?? mode) ? MODE_BACKGROUNDS[hoverMode ?? mode] : MODE_BACKGROUNDS.survival;

  const beginPlayClick = () => {
    if (phase !== 'SPLASH_PLAY') return;
    setPhase('POST_PLAY_LOADING');
    setPostProgress(0);
    setTipIndex(0);
  };

  const beginWorld = (nextSeed?: string, nextMode?: GameMode) => {
    onStart(nextSeed ?? seed, nextMode ?? mode);
  };

  const reshuffleSplash = () => setSplash(SPLASHES[Math.floor(Math.random() * SPLASHES.length)]);

  const saveSettingsPatch = (patch: Partial<GameSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  // ===== BOOT =====
  if (phase === 'BOOT') {
    return (
      <div className="main-menu boot-phase" style={{ background: 'radial-gradient(circle at 50% 30%,#1a2a4a,#060a12 70%)' }}>
        <div className="mc-panorama-boot">
          <div className="panorama-orbit">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`panorama-face face-${i}`} />
            ))}
          </div>
        </div>
        <div className="boot-card">
          <h1 className="boot-logo">EAOIN</h1>
          <div className="boot-subtitle">{RELEASE_LABEL} • De-cluttered Edition</div>
          <div className="menu-loading" role="status">
            <strong>Booting EAOIN — preparing Minecraft skybox & ray tracing… {Math.round(bootProgress)}%</strong>
            <div className="loading-track colorful">
              <span className="rainbow" style={{ width: `${bootProgress}%` }} />
            </div>
            <small>Loading assets • Compiling block PBR materials • Initializing world distribution grid</small>
          </div>
          <div className="boot-footer">Professional 3D warped UI • Settings front-page • Marketplace fixed</div>
        </div>
      </div>
    );
  }

  // ===== SPLASH PLAY =====
  if (phase === 'SPLASH_PLAY') {
    return (
      <div className="main-menu splash-play-phase" ref={containerRef}>
        {/* Movable panorama picture that actually represents a Minecraft UI for every area */}
        <div className="mc-movable-panorama" style={{ transform: `translate3d(${mouseParallax.x}px,${mouseParallax.y}px,0) scale(1.12)` }}>
          <div className="panorama-scene">
            <div className="panorama-cube">
              <div className="cube-face front" style={{ background: MODE_BACKGROUNDS.survival.gradient }} />
              <div className="cube-face back" style={{ background: MODE_BACKGROUNDS.creative.gradient }} />
              <div className="cube-face right" style={{ background: MODE_BACKGROUNDS.experimental.gradient }} />
              <div className="cube-face left" style={{ background: MODE_BACKGROUNDS.story.gradient }} />
              <div className="cube-face top" style={{ background: 'linear-gradient(180deg,#a0d8ff,#4a8fc7)' }} />
              <div className="cube-face bottom" style={{ background: 'linear-gradient(180deg,#8a5a36,#3d2210)' }} />
            </div>
          </div>
          <div className="panorama-vignette" />
          {/* Blurred low-poly block preview silhouettes floating */}
          <div className="floating-blocks">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="float-block" style={{ left: `${(i * 17) % 100}%`, top: `${(i * 23) % 80}%`, animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
        </div>

        <div className="splash-play-card warped-3d">
          <div className="menu-title-3d">
            <h1 className="title-warped">
              <span className="title-shadow">EAOIN</span>
              <span className="title-front">EAOIN</span>
            </h1>
            <div className="splash-text" onClick={reshuffleSplash} title="Click to reshuffle — like Minecraft!">
              {splash}
            </div>
            <p className="subtitle rainbow-subtitle">{RELEASE_LABEL} • 3.1 De-cluttered • Ray Traced</p>
          </div>

          <button className="btn-play-big minecraft-btn" onClick={beginPlayClick}>
            <span className="btn-label-main">PLAY</span>
            <span className="btn-label-sub">De-cluttered world • 26m clear spawn</span>
          </button>

          <div className="splash-hints">
            <span>🌄 Settlement 58m • 🚀 Rocket 110m • 🌀 Portal 72m • Settings front-page</span>
            <span>Move mouse — panorama picture is movable!</span>
          </div>

          <div className="boot-footer minimal">© EAOIN 2026 — Minecraft-inspired UI • Professional • Colourful • Marketplace Fixed</div>
        </div>
      </div>
    );
  }

  // ===== POST PLAY LOADING — colourful different colours =====
  if (phase === 'POST_PLAY_LOADING') {
    return (
      <div className="main-menu post-play-loading-phase" style={{ background: effectiveBackground.gradient }}>
        <div className="mc-movable-panorama blurred" style={{ transform: `translate3d(${mouseParallax.x * 0.6}px,${mouseParallax.y * 0.6}px,0) scale(1.08)` }} />
        <div className="loading-card big">
          <h2 className="loading-title">Loading World Grid — De-cluttered</h2>
          <div className="menu-loading bigger" role="status">
            <strong>{POST_PLAY_TIPS[tipIndex]} {Math.round(postProgress)}%</strong>
            <div className="loading-track colorful multi">
              <span className="rainbow animated" style={{ width: `${postProgress}%` }} />
              <span className="rainbow-overlay" style={{ width: `${postProgress}%` }} />
            </div>
            <div className="loading-dots">
              {['#ff4d4d', '#ffcc00', '#4dff88', '#4da3ff', '#c84dff'].map((c, i) => (
                <i key={i} style={{ background: c, animationDelay: `${i * 0.12}s`, transform: `scale(${0.6 + (postProgress % 40) / 80})` }} />
              ))}
            </div>
            <small>Preparing chunks • Lighting • Shadows 2048² • SSAO • Bloom • Reflections • Fixes</small>
          </div>
          <div className="colorful-blocks-row">
            {['grass', 'dirt', 'stone', 'water', 'crystal', 'rocket', 'portal'].map((b) => (
              <span key={b} className={`mini-block mini-${b}`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ===== MAIN =====
  return (
    <div className="main-menu main-phase" ref={containerRef}>
      {/* Skybox that matches Minecraft more — dynamic based on mode */}
      <div className="mc-skybox" style={{ background: effectiveBackground.gradient, transform: `translate3d(${mouseParallax.x * 0.8}px,${mouseParallax.y * 0.8}px,0) scale(1.1)` }}>
        <div className="mc-clouds">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="mc-cloud" style={{ left: `${10 + i * 14}%`, top: `${6 + i * 4}%`, animationDelay: `${i * 0.8}s` }} />
          ))}
        </div>
        <div className="mc-sun" />
        <div className="panorama-vignette stronger" />
      </div>

      <div className="panorama-label">
        <span className="emoji">{effectiveBackground.emoji}</span> {effectiveBackground.label} — movable panorama picture for every area
      </div>

      <div className="main-layout">
        <div className="menu-background release-2-menu warped-3d pro">
          <div className="menu-title-3d small">
            <h1 className="title-warped small">
              <span className="title-shadow">EAOIN</span>
              <span className="title-front">EAOIN</span>
            </h1>
            <div className="splash-text small" onClick={reshuffleSplash}>
              {splash}
            </div>
            <p className="subtitle">{RELEASE_LABEL} • Settings front-page • Marketplace fixed</p>
          </div>

          <div className="menu-card grid-pro">
            <div className="left-col">
              <h3 className="col-title">Game Area — hover to move panorama</h3>
              <div className="mode-select pro">
                {GAME_MODES.map((entry) => (
                  <button
                    key={entry.id}
                    className={`mode-card pro ${mode === entry.id ? 'selected' : ''} ${hoverMode === entry.id ? 'hovered' : ''}`}
                    onClick={() => setMode(entry.id)}
                    onMouseEnter={() => setHoverMode(entry.id)}
                    onMouseLeave={() => setHoverMode(null)}
                  >
                    <strong>
                      {MODE_BACKGROUNDS[entry.id]?.emoji} {entry.label}
                    </strong>
                    <span>{entry.description}</span>
                    <small>{MODE_BACKGROUNDS[entry.id]?.label}</small>
                  </button>
                ))}
              </div>

              <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="World Seed" className="seed-input pro" />

              <button onClick={() => beginWorld(seed, mode)} className="btn-primary minecraft-btn big">
                <span>Play {GAME_MODES.find((e) => e.id === mode)?.label}</span>
                <small>{seed ? `Seed ${seed.slice(0, 18)}` : 'Random'} • Spawn clear 26m</small>
              </button>
              <button onClick={() => beginWorld(undefined, 'experimental')} className="btn-secondary minecraft-btn">
                Quick Experimental — Ray Traced Shadows
              </button>

              <div className="quick-row">
                <button className="menu-settings-link mc-link" onClick={() => setSettingsOpen((v) => !v)}>
                  ⚙️ Settings (front-page)
                </button>
                <button className="menu-settings-link mc-link" onClick={() => setMarketOpen((v) => !v)}>
                  🛒 Marketplace (fixed)
                </button>
                <button className="menu-settings-link mc-link" onClick={() => setCreatorOpen((v) => !v)}>
                  🧍 Character Creator
                </button>
              </div>
            </div>

            <div className="right-col">
              {settingsOpen && (
                <div className="menu-settings-card pro settings-front">
                  <strong>⚙️ Settings — Front Page (pushed to main UI)</strong>
                  <div className="settings-grid">
                    <label>
                      <span>Volume {Math.round(settings.volume * 100)}%</span>
                      <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => saveSettingsPatch({ volume: Number(e.target.value) } as any)} />
                    </label>
                    <label className="checkbox">
                      <input type="checkbox" checked={settings.muted} onChange={(e) => saveSettingsPatch({ muted: e.target.checked })} />
                      <span>Muted</span>
                    </label>
                    <label>
                      <span>Quality</span>
                      <select value={settings.qualityPreset} onChange={(e) => saveSettingsPatch({ qualityPreset: e.target.value as any })}>
                        <option value="performance">Performance</option>
                        <option value="balanced">Balanced</option>
                        <option value="quality">Quality</option>
                        <option value="cinematic">Cinematic (SSAO+Bloom+Shadows)</option>
                      </select>
                    </label>
                    <label>
                      <span>Renderer</span>
                      <select value={settings.rendererPreference} onChange={(e) => saveSettingsPatch({ rendererPreference: e.target.value as any })}>
                        <option value="auto">Auto: WebGPU first</option>
                        <option value="webgpu">Prefer WebGPU</option>
                        <option value="webgl">Force WebGL</option>
                      </select>
                    </label>
                    <label>
                      <span>Render scale {Math.round(settings.renderScale * 100)}%</span>
                      <input type="range" min={0.5} max={1.5} step={0.1} value={settings.renderScale} onChange={(e) => saveSettingsPatch({ renderScale: Number(e.target.value) })} />
                    </label>
                    <label className="checkbox">
                      <input type="checkbox" checked={settings.realisticLighting} onChange={(e) => saveSettingsPatch({ realisticLighting: e.target.checked })} />
                      <span>Realistic lighting + ray traced shadows</span>
                    </label>
                    <label className="checkbox">
                      <input type="checkbox" checked={settings.postProcessEnabled} onChange={(e) => saveSettingsPatch({ postProcessEnabled: e.target.checked })} />
                      <span>Bloom + SSAO + Vignette</span>
                    </label>
                    <label className="checkbox">
                      <input type="checkbox" checked={settings.fogEnabled} onChange={(e) => saveSettingsPatch({ fogEnabled: e.target.checked })} />
                      <span>Fog & atmospherics</span>
                    </label>
                  </div>
                  <button onClick={() => setSettingsOpen(false)} className="btn-secondary mini">
                    Close Settings
                  </button>
                </div>
              )}

              {marketOpen && (
                <div className="menu-settings-card pro marketplace-front">
                  <strong>🛒 Marketplace — Fixed (front-page)</strong>
                  <div className="marketplace-list">
                    {marketplace.getPacks().map((pack) => (
                      <div key={pack.id} className="market-pack">
                        <strong>{pack.name}</strong>
                        <span>{pack.creator} • {pack.category} • {pack.priceCoins} coins • {pack.downloads} dl</span>
                        <em>{pack.published ? 'Published ✅' : 'Draft'}</em>
                      </div>
                    ))}
                  </div>
                  <div className="market-stats">
                    <span>Packs: {marketplace.getStatus().packs}</span>
                    <span>Published: {marketplace.getStatus().publishedPacks}</span>
                    <span>Coins: {marketplace.getStatus().grossCoins}</span>
                  </div>
                  <div className="market-actions">
                    <button onClick={() => { marketplace.publishDraft('New Adventure Map'); }} className="btn-secondary mini">Create Draft</button>
                    <button onClick={() => { marketplace.approveAll(); }} className="btn-primary mini">Approve All (fix)</button>
                  </div>
                  <button onClick={() => setMarketOpen(false)} className="btn-secondary mini">Close Marketplace</button>
                </div>
              )}

              {creatorOpen && (
                <div className="menu-settings-card character-creator pro">
                  <strong>🧍 Character Creator — Front Page</strong>
                  <label>
                    Skin <input type="color" value={skinTone} onChange={(e) => setSkinTone(e.target.value)} />
                  </label>
                  <label>
                    Shirt <input type="color" value={shirtColor} onChange={(e) => setShirtColor(e.target.value)} />
                  </label>
                  <div className="avatar-preview pro" style={{ background: shirtColor, borderColor: skinTone }}>
                    <div className="preview-head" style={{ background: skinTone }} />
                  </div>
                  <button onClick={() => setCreatorOpen(false)} className="btn-secondary mini">Save Character</button>
                </div>
              )}

              {!settingsOpen && !marketOpen && !creatorOpen && (
                <div className="menu-info-card pro">
                  <h4>✨ What’s fixed & improved</h4>
                  <ul>
                    <li>🎯 Spawn — 26m clear, no more cramped at origin</li>
                    <li>🏘️ Settlement — 58m NW in own clearing</li>
                    <li>🚀 Rocket — 110m SE launchpad clearing with lights</li>
                    <li>🌀 Portal Core — 72m NE with beacon</li>
                    <li>🚪 Doors — 48m & 68m spread</li>
                    <li>🏙️ Megacity — 180m away, not hugging spawn</li>
                    <li>🧭 O toggle objectives, U toggle systems</li>
                    <li>⌨️ SPACE jumps — fixed ellipsoid 0.32, vel 7.5</li>
                    <li>🌗 Ray tracing: 2048² soft shadows + SSAO + bloom</li>
                    <li>🎨 Colourful loading bars, Minecraft skybox, splash text</li>
                    <li>🖼️ Movable panorama — hover modes to preview area</li>
                    <li>⚙️ Settings pushed to front-page main UI</li>
                    <li>🛒 Marketplace fixed + front-page</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="menu-footer pro">
            <p>3.1 De-cluttered Edition • Minecraft skybox • 3D warped UI • Ray traced shadows+bloom+SSAO+reflections • Space fixed • O/U toggles</p>
            <p>Seed: {seed || 'random'} • Mode: {mode} • Renderer: {settings.rendererPreference} • Quality: {settings.qualityPreset}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

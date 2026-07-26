/**
 * TitleScreen — the EAOIN "Triple A Sandbox Experience" boot/main menu.
 *
 * Layout mirrors the concept art: full-bleed voxel panorama, chiselled stone
 * wordmark, a centred stack of beveled menu buttons, the news feed on the left,
 * social rail bottom-left, icon rail top-right and the player card bottom-right.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { GAME_VERSION, RELEASE_NAME } from '../version';
import { CharacterAppearance, NEWS_FEED, SOCIAL_LINKS, UI_ASSETS } from './theme';
import { AvatarPortrait } from './VoxelAvatar';

const SPLASHES = [
  'The world is yours!', '25 dimensions to explore!', 'Now with volumetric clouds!',
  'Build without limits!', 'Also try Creative mode!', '300+ blocks!',
  'Space travel included!', 'Bigger mountains, deeper caves!', 'Made with voxels!',
];

export interface TitleScreenProps {
  appearance: CharacterAppearance;
  onSingleplayer: () => void;
  onMultiplayer: () => void;
  onMods: () => void;
  onOptions: () => void;
  onQuit: () => void;
  onEditCharacter: () => void;
  onOpenNews: () => void;
  onOpenGuide: () => void;
  onOpenStats: () => void;
  onOpenFriends: () => void;
}

export default function TitleScreen({
  appearance, onSingleplayer, onMultiplayer, onMods, onOptions, onQuit,
  onEditCharacter, onOpenNews, onOpenGuide, onOpenStats, onOpenFriends,
}: TitleScreenProps) {
  const [splash] = useState(() => SPLASHES[Math.floor(Math.random() * SPLASHES.length)]);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const frame = useRef<number | undefined>(undefined);

  // Subtle panorama parallax that follows the pointer, rAF-throttled so it
  // never competes with the render loop for frame time.
  const handleMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY, currentTarget } = event;
    const { width, height } = currentTarget.getBoundingClientRect();
    const nx = (clientX / width - 0.5) * 2;
    const ny = (clientY / height - 0.5) * 2;
    if (frame.current !== undefined) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = undefined;
      setParallax({ x: nx, y: ny });
    });
  }, []);

  useEffect(() => () => {
    if (frame.current !== undefined) window.cancelAnimationFrame(frame.current);
  }, []);

  return (
    <div className="eaoin-title-screen" onMouseMove={handleMove}>
      <div
        className="title-backdrop"
        style={{
          backgroundImage: `url(${UI_ASSETS.menuPanorama})`,
          transform: `scale(1.06) translate(${parallax.x * -14}px, ${parallax.y * -9}px)`,
        }}
      />

      {/* ---- top-right icon rail ---- */}
      <div className="title-icon-rail">
        <button className="icon-btn" title="Options" aria-label="Options" onClick={onOptions}>⚙</button>
        <button className="icon-btn" title="Guide" aria-label="Guide" onClick={onOpenGuide}>📖</button>
        <button className="icon-btn" title="Statistics" aria-label="Statistics" onClick={onOpenStats}>📊</button>
        <button className="icon-btn" title="Friends" aria-label="Friends" onClick={onOpenFriends}>👥</button>
        <button className="icon-btn danger" title="Quit" aria-label="Quit" onClick={onQuit}>✕</button>
      </div>

      {/* ---- wordmark ---- */}
      <div className="title-logo-wrap">
        <h1 className="title-logo">EAOIN</h1>
        <div className="title-tagline">Triple A Sandbox Experience</div>
        <div className="title-splash">{splash}</div>
      </div>

      {/* ---- news feed ---- */}
      <aside className="title-news ui-panel">
        <div className="ui-panel-title">◈ EAOIN News</div>
        <div className="news-list">
          {NEWS_FEED.map((entry) => (
            <div key={entry.id} className="news-item" onClick={onOpenNews} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') onOpenNews(); }}>
              <img className="news-thumb" src={entry.image} alt="" loading="lazy" />
              <div className="news-copy">
                <h4>{entry.title}</h4>
                <p>{entry.body}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="news-all" onClick={onOpenNews}>View All News</button>
      </aside>

      {/* ---- main menu ---- */}
      <nav className="title-menu" aria-label="Main menu">
        <button className="menu-btn is-primary" onClick={onSingleplayer}>
          Singleplayer<span className="btn-icon">🟩</span>
        </button>
        <button className="menu-btn is-primary" onClick={onMultiplayer}>
          Multiplayer<span className="btn-icon">🧑</span>
        </button>
        <button className="menu-btn" onClick={onMods}>
          Mods<span className="btn-icon">🟢</span>
        </button>
        <button className="menu-btn" onClick={onOptions}>
          Options<span className="btn-icon">⚙</span>
        </button>
        <button className="menu-btn" onClick={onQuit}>
          Quit Game<span className="btn-icon">❌</span>
        </button>
      </nav>

      {/* ---- social rail ---- */}
      <div className="title-social">
        {SOCIAL_LINKS.map((link) => (
          <a key={link.id} className="social-btn" href={link.href} title={link.label}
            target="_blank" rel="noreferrer noopener" aria-label={link.label}>
            {link.icon}
          </a>
        ))}
      </div>

      {/* ---- player card ---- */}
      <div className="title-player-card ui-panel" onClick={onEditCharacter} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onEditCharacter(); }}>
        <AvatarPortrait appearance={appearance} size={42} />
        <div className="player-meta">
          <strong>Welcome, {appearance.name}</strong>
          <span>Notch the Explorer</span>
        </div>
        <span className="player-edit">✎</span>
      </div>

      <div className="title-version">EAOIN {GAME_VERSION} — {RELEASE_NAME}</div>
    </div>
  );
}

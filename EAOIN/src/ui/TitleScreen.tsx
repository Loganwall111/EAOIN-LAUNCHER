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
import { SignedInUser } from './SignInScreen';

const SPLASHES = [
  'The world is yours!', '25 dimensions to explore!', 'Now with volumetric clouds!',
  'Build without limits!', 'Also try Creative mode!', '300+ blocks!',
  'Space travel included!', 'Bigger mountains, deeper caves!', 'Made with voxels!',
];

export interface TitleScreenProps {
  appearance: CharacterAppearance;
  signedInUser: SignedInUser | null;
  onSignIn: () => void;
  onSingleplayer: () => void;
  onMultiplayer: () => void;
  /** Launch the pre-built Tutorial World (sits right above Multiplayer). */
  onTutorial: () => void;
  /** Launch the Game Hub (HQ, studio, server). */
  onGameHub: () => void;
  /** Launch the Portal Gallery area. */
  onPortalGallery: () => void;
  /** Launch the in-game Alpha Launcher (opens the EAOIN 2.0 alpha build). */
  onAlphaLauncher: () => void;
  /** Open the Singularity — the shader-based black hole. */
  onSingularity: () => void;
  /** Return to the stable release (used inside the alpha preview). */
  onBackToStable: () => void;
  /** Launch HorizonOS — the in-game virtual desktop / OS. */
  onHorizonOS: () => void;
  onMods: () => void;
  onMarketplace: () => void;
  onEditorMode: () => void;
  /** Live coin balance shown in the economy pill. */
  coinBalance: number;
  onOpenCoinStore: () => void;
  onOptions: () => void;
  onQuit: () => void;
  onEditCharacter: () => void;
  onOpenNews: () => void;
  onOpenGuide: () => void;
  onOpenStats: () => void;
  onOpenFriends: () => void;
  /** Open the hidden cosmic rift behind the '?' button. */
  onOpenCosmicRift?: () => void;
}

export default function TitleScreen({
  appearance, signedInUser, onSignIn, onSingleplayer, onMultiplayer, onTutorial, onGameHub,
  onPortalGallery, onAlphaLauncher, onSingularity, onBackToStable, onHorizonOS, onMods,
  onMarketplace, onEditorMode, coinBalance, onOpenCoinStore, onOptions, onQuit,
  onEditCharacter, onOpenNews, onOpenGuide, onOpenStats, onOpenFriends, onOpenCosmicRift,
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

      {/* ---- economy: coin balance, top of screen ---- */}
      <button
        className="title-coin-pill"
        onClick={onOpenCoinStore}
        title="Your coins — click to get more"
        aria-label={`${coinBalance} coins. Open the coin store.`}
      >
        <span className="title-coin-glyph">🪙</span>
        <span className="title-coin-amount">{coinBalance.toLocaleString()}</span>
        <span className="title-coin-plus">+</span>
      </button>

      {/* ---- top-right icon rail ---- */}
      <div className="title-icon-rail">
        <button className="icon-btn back-stable" title="Back to Stable" aria-label="Back to Stable" onClick={onBackToStable}>⬅️</button>
        <button className="icon-btn cosmic-rift" title="?" aria-label="Cosmic rift" onClick={onOpenCosmicRift}>?</button>
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
        <button className="menu-btn is-tutorial" onClick={onTutorial}>
          Tutorial World<span className="btn-icon">📖</span>
        </button>
        <button className="menu-btn is-primary" onClick={onMultiplayer}>
          Multiplayer<span className="btn-icon">🧑</span>
        </button>
        <button className="menu-btn is-gamehub" onClick={onGameHub}>
          Game Hub<span className="btn-icon">🎮</span>
        </button>
        <button className="menu-btn is-portals" onClick={onPortalGallery}>
          Portal Gallery<span className="btn-icon">🌀</span>
        </button>
        <button className="menu-btn is-singularity" onClick={onSingularity}>
          Singularity<span className="btn-icon">🕳</span>
        </button>
        <button className="menu-btn is-horizonos" onClick={onHorizonOS}>
          HorizonOS<span className="btn-icon">🖥️</span>
        </button>
        <button className="menu-btn" onClick={onMods}>
          Mods<span className="btn-icon">🟢</span>
        </button>
        <button className="menu-btn" onClick={onOptions}>
          Options<span className="btn-icon">⚙</span>
        </button>

        {/* ---- marketplace section ---- */}
        <div className="menu-section-divider"><span>STORE &amp; CREATION</span></div>
        <button className="menu-btn is-marketplace" onClick={onMarketplace}>
          Marketplace<span className="btn-icon">🏬</span>
        </button>
        <button className="menu-btn is-editor" onClick={onEditorMode}>
          Editor Mode<span className="btn-icon">🛠</span>
        </button>

        {/* ---- separate launcher section (bottom) ---- */}
        <div className="menu-section-divider"><span>ALPHA LAUNCHER</span></div>
        <button className="menu-btn is-backstable" onClick={onBackToStable}>
          Back to Stable<span className="btn-icon">⬅️</span>
        </button>
        <button className="menu-btn is-alpha" onClick={onAlphaLauncher}>
          Alpha Launcher<span className="btn-icon">🚀</span>
        </button>

        <button className="menu-btn" onClick={onQuit}>
          Quit Game<span className="btn-icon">❌</span>
        </button>
      </nav>

      {/* ---- Sign-in button (bottom-left above social) ---- */}
      <div className="title-signin-section">
        {signedInUser ? (
          <div className="title-signed-in-card" onClick={onSignIn} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onSignIn(); }}>
            <div className="signin-avatar-letter">{signedInUser.avatarLetter}</div>
            <div className="signin-meta">
              <strong>{signedInUser.name}</strong>
              <span>{signedInUser.email}</span>
            </div>
          </div>
        ) : (
          <button className="title-signin-btn" onClick={onSignIn}>
            <svg className="google-icon-sm" viewBox="0 0 24 24" width="16" height="16">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Sign In</span>
          </button>
        )}
      </div>

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

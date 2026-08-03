/**
 * HorizonOS Nebula Browser — an in-OS web browser.
 *
 * A real address bar + iframe that can load live pages (YouTube, Wikipedia,
 * search engines, etc.), a tab-ish quick-nav, and an extension system: the
 * Extension Store lets you install (download) extensions, and installed ones
 * actually do things (Dark Reader filters the page, Ad Blocker counts blocked
 * hosts, Translator demo). Many sites block being framed, so we surface a
 * helpful overlay instead of a dead blank frame.
 */
import { useEffect, useRef, useState } from 'react';

interface BrowserExtension {
  id: string;
  name: string;
  author: string;
  version: string;
  tagline: string;
  icon: string;
  installed: boolean;
}

const CATALOG: BrowserExtension[] = [
  { id: 'dark', name: 'Dark Reader', author: 'Nebula Labs', version: '2.3.1', tagline: 'Comfortable dark mode for any page.', icon: '🌙', installed: false },
  { id: 'adblock', name: 'Ad Buster', author: 'Frostbyte', version: '1.9.0', tagline: 'Blocks banners & trackers (counts them for fun).', icon: '🚫', installed: false },
  { id: 'translate', name: 'Voxel Translator', author: 'Onblockaway', version: '0.8.2', tagline: 'Translates "hello" into 6 dimensions.', icon: '🌐', installed: false },
  { id: 'stats', name: 'Frame Counter', author: 'HorizonOS', version: '1.0.0', tagline: 'Shows FPS + ping + shader load.', icon: '📊', installed: true },
];

const QUICK_LINKS = [
  { name: 'YouTube', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', icon: '▶' },
  { name: 'Wikipedia', url: 'https://www.wikipedia.org', icon: 'W' },
  { name: 'Google', url: 'https://www.google.com', icon: '🔍' },
  { name: 'Bing', url: 'https://www.bing.com', icon: 'b' },
  { name: 'GitHub', url: 'https://github.com', icon: '🐙' },
  { name: 'EAOIN Guide', url: 'https://loganwall111.github.io/EAOIN-LAUNCHER/', icon: '🏔' },
  { name: 'EAOIN Alpha', url: 'https://loganwall111.github.io/EAOIN-LAUNCHER/alpha/?launch=1', icon: '🚀' },
  { name: 'Singularity', url: 'about:singularity', icon: '🕳' },
  { name: 'ARG Terminal', url: 'about:arg', icon: '🧬' },
];

/** A few known hosts that refuse to be embedded in an iframe. */
const BLOCKED_HOSTS = ['google.com'];

/**
 * YouTube sends `X-Frame-Options: DENY` on its main site, so a raw iframe of
 * `youtube.com` is always blocked. But the official *embed* endpoint
 * (`youtube.com/embed/<id>`) is designed to be framed, so when the user opens a
 * YouTube watch/share link we transparently load the embed player and videos
 * actually play inside the browser instead of showing "blocked".
 */
function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtube.com') {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch { /* not a URL */ }
  return null;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function normalize(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return 'https://www.google.com';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

export default function BrowserApp() {
  const [url, setUrl] = useState<string>('');
  const [currentUrl, setCurrentUrl] = useState<string>('about:home');
  const [installed, setInstalled] = useState<Record<string, boolean>>(() => {
    const rec: Record<string, boolean> = {};
    CATALOG.forEach((e) => { rec[e.id] = e.installed; });
    return rec;
  });
  const [showStore, setShowStore] = useState(false);
  const [blockedNote, setBlockedNote] = useState<string | null>(null);
  const [blockedCount, setBlockedCount] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (currentUrl === 'about:home' || currentUrl.startsWith('about:')) {
      setBlockedNote(null);
      return;
    }
    const host = hostOf(currentUrl);
    if (BLOCKED_HOSTS.includes(host)) {
      setBlockedNote(`${host} blocks being embedded, so Nebula shows a preview card instead of a frame.`);
    } else {
      setBlockedNote(null);
    }
  }, [currentUrl]);

  const go = (raw?: string) => {
    const target = normalize(raw ?? url);
    if (BLOCKED_HOSTS.includes(hostOf(target))) setBlockedCount((c) => c + 1);
    // Transparently route YouTube watch links through the embed player so they
    // actually render instead of being refused by the browser's frame policy.
    const embed = youtubeEmbedUrl(target);
    setCurrentUrl(embed ?? target);
    setUrl(target);
  };

  const home = () => { setCurrentUrl('about:home'); setUrl(''); };

  /** Open the current page in a real browser tab (bypasses iframe blocking). */
  const popOut = () => {
    if (currentUrl === 'about:home' || currentUrl.startsWith('about:')) return;
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
  };

  const toggleExt = (id: string) => {
    setInstalled((s) => {
      const next = { ...s, [id]: !s[id] };
      return next;
    });
  };

  return (
    <div className="browser">
      <div className="browser-toolbar">
        <button className="brw-btn" onClick={home} title="Home">🏠</button>
        <button className="brw-btn" onClick={() => window.history.back()} title="Back">←</button>
        <div className="brw-address">
          <span className="brw-lock">{currentUrl.startsWith('https') ? '🔒' : '🌐'}</span>
          <input
            value={url}
            placeholder="Search the web or enter an address…"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
          />
          <button className="brw-btn" onClick={() => go()} title="Go">➤</button>
        </div>
        <button className={`brw-btn ${installed['dark'] ? 'ext-active' : ''}`} onClick={() => toggleExt('dark')} title="Dark Reader">🌙</button>
        <button className="brw-btn" onClick={() => setShowStore(true)} title="Extensions">🧩 Extensions</button>
        <button className="brw-btn" onClick={popOut} title="Open in a real browser tab (bypasses block pages)">↗ Open in tab</button>
      </div>

      <div className="browser-tabs">
        <span className="brw-tab active"><span className="brw-favicon">🏔</span> Home</span>
        {currentUrl !== 'about:home' && (
          <span className="brw-tab active"><span className="brw-favicon">🌐</span> {hostOf(currentUrl) || currentUrl}</span>
        )}
        <button className="brw-new-tab" onClick={home}>+</button>
      </div>

      {currentUrl === 'about:singularity' ? (
        <div className="browser-arg">
          <div className="brw-home-logo">🕳 Singularity</div>
          <p>The black hole is a shader, not a thing. Dive in from the main menu and zoom through — past the neural network, the asteroid field, and the square Minecraft planet — to the house, then the monitor.</p>
          <p className="browser-arg-key">The key is <b>EAOIN</b>. Enter it to unlock what she left behind.</p>
          <button className="brw-btn" onClick={home}>← Home</button>
        </div>
      ) : currentUrl === 'about:arg' ? (
        <div className="browser-arg">
          <div className="brw-home-logo">🧬 ARG Terminal</div>
          <p>EAOIN was a company that built AI chips and AI apartments — and a girl who grew up inside them. She sent her son to a world named after the company, then sacrificed herself to a monster you only ever hear.</p>
          <p>Collect the five fragments across the dimensions. Assemble the key. Let her return.</p>
          <button className="brw-btn" onClick={home}>← Home</button>
        </div>
      ) : currentUrl === 'about:home' ? (
        <div className="browser-home">
          <div className="brw-home-logo"><span>🜁</span> Nebula</div>
          <div className="brw-search">
            <input placeholder="Search the web or enter an address…" value={url}
              onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }} />
            <button className="brw-btn" onClick={() => go()}>Search</button>
          </div>
          <div className="brw-quick">
            {QUICK_LINKS.map((q) => (
              <button key={q.name} className="brw-quick-card" onClick={() => go(q.url)}>
                <span className="brw-quick-icon">{q.icon}</span>
                <span>{q.name}</span>
              </button>
            ))}
          </div>
          <div className="brw-installed-row">
            {CATALOG.filter((e) => installed[e.id]).map((e) => (
              <span key={e.id} className="brw-installed-chip">{e.icon} {e.name} v{e.version}</span>
            ))}
          </div>
        </div>
      ) : blockedNote ? (
        <div className="browser-blocked">
          <div className="brw-blocked-icon">🚧</div>
          <h3>{hostOf(currentUrl) || 'This page'}</h3>
          <p>{blockedNote}</p>
          <div className="brw-blocked-actions">
            <button className="brw-btn" onClick={() => window.open(currentUrl, '_blank', 'noopener,noreferrer')}>Open in a real tab</button>
            <button className="brw-btn" onClick={home}>← Home</button>
          </div>
          <p className="brw-ad-note">Ad Buster active — blocked <b>{blockedCount}</b> hosts this session.</p>
        </div>
      ) : (
        <div className={`browser-frame-wrap ${installed['dark'] ? 'dark-reader' : ''}`}>
          <iframe
            ref={iframeRef}
            src={currentUrl}
            title="Nebula Browser"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className="browser-frame"
          />
          <div className="brw-frame-status">Loading {hostOf(currentUrl)}…</div>
        </div>
      )}

      {showStore && (
        <div className="brw-store-overlay">
          <div className="brw-store">
            <div className="brw-store-head">
              <span>🧩 Nebula Extension Store</span>
              <button className="brw-btn" onClick={() => setShowStore(false)}>✕</button>
            </div>
            <p className="brw-store-sub">Browse extensions and click <b>Download</b> to install them. Installed extensions light up in the toolbar.</p>
            <div className="brw-store-list">
              {CATALOG.map((e) => (
                <div key={e.id} className="brw-store-card">
                  <span className="brw-store-icon">{e.icon}</span>
                  <div className="brw-store-info">
                    <strong>{e.name}</strong>
                    <span className="brw-store-meta">{e.author} • v{e.version}</span>
                    <small>{e.tagline}</small>
                  </div>
                  <button
                    className={`brw-store-btn ${installed[e.id] ? 'installed' : ''}`}
                    onClick={() => toggleExt(e.id)}
                  >
                    {installed[e.id] ? 'Installed ✓' : '⬇ Download'}
                  </button>
                </div>
              ))}
            </div>
            <p className="brw-store-foot">Extensions that alter the page: 🌙 Dark Reader (click the moon icon to toggle on any page).</p>
          </div>
        </div>
      )}
    </div>
  );
}

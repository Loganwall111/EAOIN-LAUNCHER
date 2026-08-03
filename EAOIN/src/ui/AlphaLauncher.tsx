/**
 * AlphaLauncher — a launcher inside the game that opens the EAOIN 2.0 alpha
 * build. Clicking Play launches the alpha in a new tab at ALPHA_URL, so you
 * don't have to leave the stable launcher to try the next-gen update.
 */
import { ALPHA_URL } from '../version';

const HIGHLIGHTS = [
  { emoji: '🔥', title: 'Nether & End overhaul', desc: 'A sealed lava cave world and rings of End islands under a black-hole sky.' },
  { emoji: '🌀', title: 'Custom buildable portals', desc: 'Each dimension has its own build technique — obsidian frames, end-crystal ground portals, aether globes, rift cylinders.' },
  { emoji: '🎮', title: 'Game Hub', desc: 'A live hub with server corruption, Code Emperor quests and Code Creator mini-games.' },
  { emoji: '👺', title: 'Deeper Nether mobs', desc: 'Crimson hoglins, warped striders, ghasts, blazes, wither skeletons and more.' },
  { emoji: '🌪', title: 'Severe weather', desc: 'Tornadoes, blizzards, sandstorms and meteor showers tied to biomes.' },
  { emoji: '🏃', title: 'Sprint & arm animation', desc: 'Sprint on keyboard/controller/touch with a proper flying and sprint arm sway.' },
];

export default function AlphaLauncher({ onBack }: { onBack: () => void }) {
  const launch = () => {
    window.open(ALPHA_URL, '_blank', 'noopener');
  };

  return (
    <div className="alpha-launcher">
      <div className="alpha-launcher-head">
        <button className="screen-back" onClick={onBack}>← Back</button>
        <div className="screen-titles">
          <div className="screen-eyebrow">ALPHA LAUNCHER</div>
          <h1 className="screen-title">🚀 EAOIN 2.0 Alpha</h1>
        </div>
      </div>

      <div className="alpha-launcher-body">
        <div className="alpha-hero">
          <div className="alpha-badge">PRE-RELEASE</div>
          <h2>Try the next-gen update</h2>
          <p>
            The <b>EAOIN 2.0 Alpha</b> is a separate, experimental build of the
            game with the latest next-gen features. It runs in its own launcher —
            just press play and it opens the alpha build for you.
          </p>
          <div className="alpha-actions">
            <button className="alpha-play" onClick={launch}>▶ Play Alpha</button>
            <span className="alpha-url">{ALPHA_URL}</span>
          </div>
        </div>

        <div className="alpha-howto">
          <h3>📌 How to play the alpha (from inside this launcher)</h3>
          <ol>
            <li>Press <b>▶ Play Alpha</b> above — it opens the alpha build in a new tab.</li>
            <li>If a pop-up is blocked, allow it, or copy the link below and paste it in a new tab.</li>
            <li>Play it like the main game — the alpha has all the next-gen 2.0 features.</li>
          </ol>
          <div className="alpha-howto-link">🔗 <code>{ALPHA_URL}</code></div>
        </div>

        <div className="alpha-features">
          <h3>What's inside the alpha</h3>
          <div className="alpha-feature-grid">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="alpha-feature">
                <span className="alpha-feature-emoji">{h.emoji}</span>
                <div>
                  <strong>{h.title}</strong>
                  <p>{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * TutorialWorld — 2.0: a pre-built world that teaches you how to play and how
 * the game progresses, with tons of features to explore. It launches a special
 * tutorial world (via the normal game start with a tutorial seed).
 */
import { useState } from 'react';

interface TutorialStep { icon: string; title: string; desc: string; }

const STEPS: TutorialStep[] = [
  { icon: '🏃', title: 'Move & Sprint', desc: 'WASD to move, mouse to look, Space to jump, hold Shift to sprint.' },
  { icon: '⛏️', title: 'Mine', desc: 'Left-click a block to mine it. Hold to keep mining.' },
  { icon: '🧱', title: 'Place', desc: 'Right-click to place the selected block from your hotbar.' },
  { icon: '🎒', title: 'Inventory', desc: 'Press E/I to open inventory and 2x2/3x3 crafting.' },
  { icon: '🔥', title: 'Build a Nether Portal', desc: 'Craft obsidian and light a 4x5 frame to enter the Nether.' },
  { icon: '🌌', title: 'Find the Rift', desc: 'Play note blocks in order, then strike the Jukebox to open a rift to The Rift Dimension.' },
  { icon: '🏙', title: 'Explore Cities', desc: 'Hunt down rare block-built cities, movie theatres and rail lines.' },
  { icon: '🌪', title: 'Survive the Weather', desc: 'Tornadoes, blizzards and sandstorms can form — watch the sky.' },
];

export default function TutorialWorld({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const [idx, setIdx] = useState(0);
  const step = STEPS[idx];

  return (
    <div className="tutorial-world">
      <div className="tutorial-head">
        <button className="screen-back" onClick={onBack}>← Back</button>
        <div className="screen-titles">
          <div className="screen-eyebrow">TUTORIAL WORLD</div>
          <h1 className="screen-title">📖 Learn to Play</h1>
        </div>
      </div>

      <div className="tutorial-body">
        <div className="tutorial-card">
          <div className="tutorial-icon">{step.icon}</div>
          <h2>{step.title}</h2>
          <p>{step.desc}</p>
          <div className="tutorial-progress">
            {STEPS.map((_, i) => <span key={i} className={i <= idx ? 'on' : ''} />)}
          </div>
          <div className="tutorial-actions">
            <button className="btn-secondary" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>◀</button>
            <button className="btn-secondary" onClick={() => setIdx((i) => Math.min(STEPS.length - 1, i + 1))} disabled={idx === STEPS.length - 1}>▶</button>
          </div>
          <button className="confirm-btn wide" onClick={onStart}>🚀 Enter Tutorial World</button>
        </div>

        <div className="tutorial-overview">
          <h3>The World Ahead</h3>
          <ul>
            {STEPS.map((s, i) => <li key={i} className={i === idx ? 'current' : ''}>{s.icon} {s.title}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

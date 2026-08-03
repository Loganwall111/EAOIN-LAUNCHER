/**
 * GameHubScreen — 2.0: a pre-built hub world with three/four colour-coded
 * portals connecting to separate areas:
 *   - HQ (blue)   : the main hub with computers, film-makers and the game name.
 *   - Studio (red): a replica of ONEBLOCKAWAY STUDIOS where they build the game.
 *   - Server (purple): a separate "server" dimension full of code to explore.
 *   - Friends (orange): meet the Code Emperor and Code Creator for quests/mini-games.
 */
import { useState } from 'react';

type HubArea = 'hq' | 'studio' | 'server' | 'friends';

const AREAS: Record<HubArea, { name: string; colour: string; emoji: string; desc: string; content: string[] }> = {
  hq: {
    name: 'EAOIN HQ', colour: '#2aa8e0', emoji: '🏢',
    desc: 'The main hub — computers, film-makers and the name of the game itself.',
    content: ['🖥 Rows of computers running the game', '🎬 Film-makers capturing the world', '🏷 The EAOIN name glowing overhead', '👋 Meet friends and pick a portal'],
  },
  studio: {
    name: 'ONEBLOCKAWAY Studio', colour: '#e0483f', emoji: '🎬',
    desc: 'A replica of the real studio where they build the game — hang out and watch.',
    content: ['🎥 Mo-cap stage', '🧑‍🎨 Art desks', '💻 Dev machines', '📦 Asset library'],
  },
  server: {
    name: 'The Server', colour: '#7a4dff', emoji: '🖧',
    desc: 'A separate server dimension — follow the code as it corrupts you.',
    content: ['📟 Racks of blinking servers', '🔢 Streams of code to explore', '⚠️ Corruption spreads as you get deeper', '🧠 Recover lost data'],
  },
  friends: {
    name: 'Friends Area', colour: '#ffd166', emoji: '🤝',
    desc: 'Meet the Code Emperor and the Code Creator — quests and mini-games await.',
    content: ['👑 The Code Emperor — quest giver', '🛠 The Code Creator — mini-games', '🎯 Daily challenges', '🎁 Rewards'],
  },
};

export default function GameHubScreen({ onBack }: { onBack: () => void }) {
  const [area, setArea] = useState<HubArea>('hq');
  const a = AREAS[area];

  return (
    <div className="gamehub-screen">
      <div className="gamehub-head">
        <button className="screen-back" onClick={onBack}>← Back</button>
        <div className="screen-titles">
          <div className="screen-eyebrow">GAME HUB</div>
          <h1 className="screen-title">🎮 The Hub</h1>
        </div>
      </div>

      <div className="gamehub-body">
        <div className="gamehub-portals">
          {(Object.keys(AREAS) as HubArea[]).map((id) => (
            <button key={id} className={`ghub-portal ${area === id ? 'active' : ''}`} onClick={() => setArea(id)} style={{ ['--hc' as string]: AREAS[id].colour }}>
              <div className="ghub-ring"><span>{AREAS[id].emoji}</span></div>
              <span>{AREAS[id].name}</span>
            </button>
          ))}
        </div>

        <div className="gamehub-area" style={{ borderColor: a.colour }}>
          <h2 style={{ color: a.colour }}>{a.emoji} {a.name}</h2>
          <p className="gamehub-desc">{a.desc}</p>
          <div className="gamehub-content">
            {a.content.map((c, i) => <div key={i} className="gamehub-item">{c}</div>)}
          </div>
          <div className="gamehub-npc">
            <span className="npc-portrait">👑</span>
            <span><b>The Code Emperor</b> — "Welcome to the hub. Choose a portal to begin."</span>
          </div>
        </div>
      </div>
    </div>
  );
}

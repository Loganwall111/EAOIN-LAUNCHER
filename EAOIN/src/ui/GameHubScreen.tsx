/**
 * GameHubScreen — 2.0: a pre-built hub world with four colour-coded portals
 * connecting to separate areas, each with its own interactive system:
 *   - HQ (blue)     : the main hub with computers, film-makers and the game name.
 *   - Studio (red)  : a replica of ONEBLOCKAWAY STUDIOS where they build the game.
 *   - Server (purple): a separate "server" dimension whose code corrupts you as
 *                      you descend — recover lost data to push back the glitch.
 *   - Friends (orange): meet the Code Emperor (quest giver) and the Code Creator
 *                      (mini-games) and collect daily rewards.
 *
 * The Hub is alive: the Server has a live corruption meter, the Friends area has
 * a quest board and playable mini-games, and every action can grant rewards.
 */
import { useMemo, useState } from 'react';

type HubArea = 'hq' | 'studio' | 'server' | 'friends';

const AREAS: Record<HubArea, { name: string; colour: string; emoji: string; desc: string }> = {
  hq: {
    name: 'EAOIN HQ', colour: '#2aa8e0', emoji: '🏢',
    desc: 'The main hub — computers, film-makers and the name of the game itself.',
  },
  studio: {
    name: 'ONEBLOCKAWAY Studio', colour: '#e0483f', emoji: '🎬',
    desc: 'A replica of the real studio where they build the game — hang out and watch.',
  },
  server: {
    name: 'The Server', colour: '#7a4dff', emoji: '🖧',
    desc: 'A separate server dimension — follow the code as it corrupts you.',
  },
  friends: {
    name: 'Friends Area', colour: '#ffd166', emoji: '🤝',
    desc: 'Meet the Code Emperor and the Code Creator — quests and mini-games await.',
  },
};

interface Quest {
  id: string;
  name: string;
  emoji: string;
  target: number;
  reward: string;
  hint: string;
}

const QUESTS: Quest[] = [
  { id: 'crystals', name: 'Gather End Crystals', emoji: '💠', target: 3, reward: 'Crystal ×2', hint: 'Mine crystal shards from the End.' },
  { id: 'server', name: 'Recover Lost Server Data', emoji: '🖧', target: 5, reward: 'Shard ×1', hint: 'Head to The Server and hit “Recover data”.' },
  { id: 'mobs', name: 'Dodge the Nether Mobs', emoji: '👺', target: 3, reward: 'Coal ×3', hint: 'Outlast the ember imps in the Nether.' },
];

export default function GameHubScreen({ onBack }: { onBack: () => void }) {
  const [area, setArea] = useState<HubArea>('hq');

  // --- Server corruption mechanic -----------------------------------------
  const [corruption, setCorruption] = useState(0);
  const [recovered, setRecovered] = useState(0);
  const [serverLog, setServerLog] = useState<string[]>([
    'Server online. Corruption dormant. Type in the void hums.',
  ]);
  const [boots, setBoots] = useState(0);

  // --- Friends: quests + rewards ------------------------------------------
  const [quests, setQuests] = useState<Record<string, number>>({ crystals: 0, server: 0, mobs: 0 });
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [inventory, setInventory] = useState<Record<string, number>>({});

  // --- Friends: mini-games -------------------------------------------------
  const code = useMemo(() => (Math.random() * 8999 + 1000).toFixed(0), []);
  const [codeGuess, setCodeGuess] = useState('');
  const [codeDone, setCodeDone] = useState(false);
  const [reactionHits, setReactionHits] = useState(0);
  const [reactionDone, setReactionDone] = useState(false);

  const a = AREAS[area];
  const corruptionPercent = Math.min(100, Math.round(corruption));

  const addReward = (label: string, amount = 1) => {
    setInventory((inv) => ({ ...inv, [label]: (inv[label] ?? 0) + amount }));
  };

  const descendIntoServer = () => {
    const next = corruption + 18;
    const hitCore = next >= 100;
    const logs: string[] = [`Corruption surges to ${Math.min(100, Math.round(next))}%…`, 'Code glitches across the walls.'];
    if (hitCore) {
      logs.push('💀 You reached the corrupted core! Reality glitches — recovered data spills out.');
      addReward('Shard');
      setRecovered((r) => r + 2);
      setQuests((q) => ({ ...q, server: q.server + 2 }));
    }
    setServerLog((log) => [...logs, ...log].slice(0, 6));
    setBoots((b) => b + 1);
    setCorruption(hitCore ? 25 : next);
  };

  const recoverData = () => {
    if (recovered >= 8) return;
    const healed = Math.max(0, corruption - 15);
    setCorruption(healed);
    setRecovered((r) => r + 1);
    setQuests((q) => ({ ...q, server: q.server + 1 }));
    setServerLog((log) => [`✅ Recovered a lost data packet (${recovered + 1}/8). Corruption eases.`, ...log].slice(0, 6));
  };

  const progressQuest = (id: string) => {
    setQuests((qs) => ({ ...qs, [id]: qs[id] + 1 }));
  };

  const claimQuest = (id: string) => {
    const q = QUESTS.find((x) => x.id === id)!;
    if (claimed.has(id) || quests[id] < q.target) return;
    setClaimed((prev) => new Set(prev).add(id));
    addReward(q.reward);
  };

  const checkCode = () => {
    if (codeGuess === code) {
      setCodeDone(true);
      addReward('Memory Shard');
    }
  };

  const reactionHit = () => {
    if (reactionDone) return;
    const next = reactionHits + 1;
    setReactionHits(next);
    if (next >= 5) {
      setReactionDone(true);
      addReward('Sulphur');
    }
  };

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

          {/* ---------- HQ: the flavour area ---------- */}
          {area === 'hq' && (
            <div className="gamehub-content">
              {['🖥 Rows of computers running the game', '🎬 Film-makers capturing the world', '🏷 The EAOIN name glowing overhead', '👋 Pick a colour-coded portal to explore'].map((c, i) => (
                <div key={i} className="gamehub-item">{c}</div>
              ))}
              <div className="gamehub-npc">
                <span className="npc-portrait">🖥</span>
                <span><b>HorizonOS</b> — “Welcome to EAOIN. Every portal here leads somewhere real.”</span>
              </div>
            </div>
          )}

          {/* ---------- Studio ---------- */}
          {area === 'studio' && (
            <div className="gamehub-content">
              {['🎥 Mo-cap stage', '🧑‍🎨 Art desks', '💻 Dev machines', '📦 Asset library'].map((c, i) => (
                <div key={i} className="gamehub-item">{c}</div>
              ))}
              <div className="gamehub-npc">
                <span className="npc-portrait">🎬</span>
                <span><b>ONEBLOCKAWAY STUDIOS</b> — “This is where the world is built. Want a sneak peek?”</span>
              </div>
            </div>
          )}

          {/* ---------- Server: live corruption mechanic ---------- */}
          {area === 'server' && (
            <div className="hub-panel">
              <div className="corruption-meter">
                <div className="corruption-label"><span>Corruption</span><b>{corruptionPercent}%</b></div>
                <div className="corruption-bar"><div className="corruption-fill" style={{ width: `${corruptionPercent}%`, background: a.colour }} /></div>
              </div>
              <div className="hub-row">
                <button className="hub-btn" onClick={descendIntoServer}>⬇ Descend deeper ({boots})</button>
                <button className="hub-btn" onClick={recoverData} disabled={recovered >= 8}>💾 Recover data ({recovered}/8)</button>
              </div>
              <div className="hub-log">
                {serverLog.map((l, i) => <div key={i} className="hub-log-line">{l}</div>)}
              </div>
            </div>
          )}

          {/* ---------- Friends: quests + mini-games ---------- */}
          {area === 'friends' && (
            <div className="hub-panel">
              <div className="gamehub-npc">
                <span className="npc-portrait">👑</span>
                <span><b>The Code Emperor</b> — “Take a quest. The Hub rewards those who explore.”</span>
              </div>
              <div className="quest-board">
                {QUESTS.map((q) => {
                  const done = quests[q.id] >= q.target;
                  const isClaimed = claimed.has(q.id);
                  return (
                    <div key={q.id} className={`quest-row ${done ? 'done' : ''} ${isClaimed ? 'claimed' : ''}`}>
                      <div className="quest-emoji">{q.emoji}</div>
                      <div className="quest-info">
                        <strong>{q.name}</strong>
                        <small>{q.hint}</small>
                        <span className="quest-progress">{Math.min(quests[q.id], q.target)}/{q.target} · 🎁 {q.reward}</span>
                      </div>
                      <div className="quest-actions">
                        <button className="hub-btn sm" onClick={() => progressQuest(q.id)} disabled={done}>+1</button>
                        <button className="hub-btn sm accent" onClick={() => claimQuest(q.id)} disabled={!done || isClaimed}>{isClaimed ? '✓' : 'Claim'}</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="gamehub-npc">
                <span className="npc-portrait">🛠</span>
                <span><b>The Code Creator</b> — “Play a mini-game. I’ll pay in items.”</span>
              </div>

              <div className="mini-games">
                {/* Code scramble */}
                <div className="mini-game">
                  <strong>🔐 Code Scramble</strong>
                  <small>Enter the 4-digit key HorizonOS whispered: {codeDone ? code : '????'}</small>
                  <div className="mini-row">
                    <input className="mini-input" value={codeGuess} onChange={(e) => setCodeGuess(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="####" />
                    <button className="hub-btn sm" onClick={checkCode} disabled={codeDone || codeGuess.length !== 4}>{codeDone ? '✓' : 'Enter'}</button>
                  </div>
                </div>

                {/* Reaction game */}
                <div className="mini-game">
                  <strong>⚡ Reaction Test</strong>
                  <small>Click the drifting cursor 5 times to beat the Creator.</small>
                  <button
                    className="hub-btn reaction"
                    onClick={reactionHit}
                    disabled={reactionDone}
                    style={{ position: 'relative', marginLeft: `${(reactionHits * 13) % 55}%` }}
                  >
                    {reactionDone ? `🎉 ${reactionHits}/5` : `🎯 ${reactionHits}/5`}
                  </button>
                </div>
              </div>

              <div className="hub-inventory">
                <strong>🧰 Reward bag</strong>
                <div>{Object.entries(inventory).map(([k, v]) => <span key={k} className="hub-reward">{k} ×{v}</span>)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

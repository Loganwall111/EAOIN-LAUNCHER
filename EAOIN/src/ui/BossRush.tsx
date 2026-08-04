/**
 * BossRush — browse every boss in the game and fight them, one at a time, in
 * the current world. Clicking a boss summons it in front of you (via the
 * in-scene boss system). Great for testing, challenge runs, and boss farming.
 */
import { useState } from 'react';
import { ALL_BOSSES, BossDef } from '../creatures/BossRegistry';

const TIER_ORDER: Record<string, number> = { tutorial: 0, standard: 1, expert: 2, raid: 3, world: 4, dimension: 5, final: 6 };

export default function BossRush({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<BossDef>(ALL_BOSSES[0]);
  const [filter, setFilter] = useState('all');

  const bosses = ALL_BOSSES
    .filter((b) => filter === 'all' || b.tier === filter)
    .sort((a, b) => (TIER_ORDER[a.tier] ?? 0) - (TIER_ORDER[b.tier] ?? 0));

  const tiers = ['all', 'tutorial', 'standard', 'expert', 'raid', 'world', 'dimension', 'final'] as const;

  const summon = (id: string) => {
    window.dispatchEvent(new CustomEvent('eaoin-boss-rush', { detail: { bossId: id } }));
  };

  return (
    <div className="boss-rush">
      <div className="boss-rush-head">
        <button className="screen-back" onClick={onBack}>← Back</button>
        <div className="screen-titles">
          <div className="screen-eyebrow">BOSS RUSH</div>
          <h1 className="screen-title">👑 Choose Your Challenge</h1>
        </div>
      </div>

      <div className="boss-rush-tiers">
        {tiers.map((t) => (
          <button key={t} className={`boss-tier ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>
            {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="boss-rush-body">
        <div className="boss-rush-list">
          {bosses.map((b) => (
            <button key={b.id} className={`boss-card ${selected.id === b.id ? 'selected' : ''}`} onClick={() => setSelected(b)}>
              <span className="boss-emoji" style={{ background: b.color }}>{b.emoji}</span>
              <div>
                <strong>{b.name}</strong>
                <small>{b.tier} • {b.health} HP</small>
              </div>
            </button>
          ))}
        </div>

        <div className="boss-rush-preview">
          <div className="boss-rush-portrait" style={{ background: `radial-gradient(circle, ${selected.color}55, ${selected.color}22)` }}>
            <span className="boss-emoji big">{selected.emoji}</span>
          </div>
          <h2>{selected.name}</h2>
          <span className="boss-rush-tier">{selected.tier.toUpperCase()}</span>
          <p className="boss-rush-desc">{selected.description}</p>
          <p className="boss-rush-lore">{selected.lore}</p>
          <div className="boss-rush-stats">
            <span>❤️ {selected.health} HP</span>
            <span>⚔️ {selected.damage} dmg</span>
            <span>🛡️ {selected.phases} phases</span>
          </div>
          <div className="boss-rush-abilities">
            {selected.abilities.map((a) => <span key={a} className="boss-ability">{a}</span>)}
          </div>
          <button className="confirm-btn wide" onClick={() => summon(selected.id)}>
            ⚔️ Summon {selected.name}
          </button>
        </div>
      </div>
    </div>
  );
}

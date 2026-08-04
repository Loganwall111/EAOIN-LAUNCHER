/**
 * QuestJournal — a full quest log. Browse every quest by type (tutorial, main,
 * side, dimension, boss…), see its steps and rewards, and track how far you've
 * come (via the live objectives). Gives you a clear "what do I do next".
 */
import { useState } from 'react';
import { ALL_QUESTS, QuestDef, QUEST_TYPES, QUEST_TYPE_LABELS } from '../objectives/QuestRegistry';
import { ObjectiveStatus } from '../objectives/ObjectiveTracker';

interface Props {
  objectives: ObjectiveStatus[];
  onBack: () => void;
}

export default function QuestJournal({ objectives, onBack }: Props) {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<QuestDef>(ALL_QUESTS[0]);

  const quests = ALL_QUESTS.filter((q) => filter === 'all' || q.type === filter);

  return (
    <div className="quest-journal">
      <div className="quest-journal-head">
        <button className="screen-back" onClick={onBack}>← Back</button>
        <div className="screen-titles">
          <div className="screen-eyebrow">QUEST JOURNAL</div>
          <h1 className="screen-title">📜 Quests &amp; Goals</h1>
        </div>
      </div>

      <div className="quest-journal-tiers">
        <button className={`quest-tier ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        {QUEST_TYPES.map((t) => (
          <button key={t} className={`quest-tier ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>
            {QUEST_TYPE_LABELS[t] ?? t}
          </button>
        ))}
      </div>

      <div className="quest-journal-body">
        <div className="quest-journal-list">
          {quests.map((q) => (
            <button key={q.id} className={`quest-card ${selected.id === q.id ? 'selected' : ''}`} onClick={() => setSelected(q)}>
              <span className="quest-emoji">{q.emoji}</span>
              <div>
                <strong>{q.name}</strong>
                <small>{q.type} • {q.dimension}</small>
              </div>
            </button>
          ))}
        </div>

        <div className="quest-journal-preview">
          <h2>{selected.emoji} {selected.name}</h2>
          <span className="quest-type-badge">{QUEST_TYPE_LABELS[selected.type] ?? selected.type} • Lv {selected.level}</span>
          <p className="quest-desc">{selected.description}</p>
          <p className="quest-lore">{selected.lore}</p>
          <div className="quest-steps">
            {selected.steps.map((s, i) => (
              <div className="quest-step" key={i}>
                <span>{s.type}</span>
                <span>{s.description}</span>
                <span className="quest-step-progress">{s.progress}/{s.amount}</span>
              </div>
            ))}
          </div>
          <div className="quest-rewards">
            <span>✨ {selected.rewards.xp} XP</span>
            <span>🪙 {selected.rewards.coins} coins</span>
            {selected.rewards.items?.map((it) => <span key={it}>{it}</span>)}
          </div>
          <div className="quest-live">
            <strong>Live progress</strong>
            {objectives.length === 0 ? <span>No tracked objectives yet.</span> : objectives.slice(0, 5).map((o) => (
              <div className={`quest-live-row ${o.complete ? 'done' : ''}`} key={o.id}>
                <span>{o.complete ? '✅' : '⏳'}</span><span>{o.label}</span><span>{o.progress}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

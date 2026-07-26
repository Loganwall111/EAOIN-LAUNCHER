/**
 * ModsScreen — themed mod browser backed by the real ModPackRegistry.
 *
 * Toggling here mutates the shared registry instance owned by App, so enabling
 * a pack genuinely changes what the game loads rather than flipping local UI
 * state that gets thrown away on unmount.
 */
import { useMemo, useState } from 'react';
import { MOD_CATEGORIES, MOD_CATEGORY_LABELS, ModDefinition, ModPackRegistry } from '../modding/ModPackRegistry';
import { UI_ASSETS } from './theme';
import MenuScreen from './MenuScreen';

export interface ModsScreenProps {
  registry: ModPackRegistry;
  onBack: () => void;
  /** Bumped by the parent whenever the registry changes, to force a re-read. */
  revision: number;
  onToggle: (id: ModDefinition['id']) => void;
}

export default function ModsScreen({ registry, onBack, revision, onToggle }: ModsScreenProps) {
  const [category, setCategory] = useState<ModDefinition['category'] | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mods = useMemo(() => {
    void revision; // re-read the registry after every toggle
    const text = query.trim().toLowerCase();
    return registry.list().filter((mod) => {
      if (category !== 'all' && mod.category !== category) return false;
      if (!text) return true;
      return mod.name.toLowerCase().includes(text) || mod.author.toLowerCase().includes(text);
    });
  }, [registry, revision, category, query]);

  const enabledCount = useMemo(() => { void revision; return registry.getTotalEnabled(); }, [registry, revision]);
  const active = mods.find((m) => m.id === selectedId) ?? mods[0] ?? null;

  return (
    <MenuScreen
      title="Mods & Packs"
      subtitle={`${registry.list().length} installed • ${enabledCount} enabled`}
      backdrop={UI_ASSETS.bgMods}
      onBack={onBack}
    >
      <div className="split-2">
        <section className="ui-panel list-pane">
          <div className="ui-panel-title">Installed Content</div>
          <div className="filter-row">
            <input
              className="ui-input"
              placeholder="Search mods…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search mods"
            />
            <div className="chip-row">
              <button className={`chip ${category === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}>All</button>
              {MOD_CATEGORIES.map((cat) => (
                <button key={cat} className={`chip ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}>
                  {MOD_CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>
          </div>
          <div className="scroll-list">
            {mods.length === 0 && <p className="empty-note">No mods match those filters.</p>}
            {mods.map((mod) => (
              <div key={mod.id} className={`row-card ${active?.id === mod.id ? 'selected' : ''}`}>
                <button className="rc-hit" onClick={() => setSelectedId(mod.id)}>
                  <span className="rc-main">
                    <strong>{mod.icon} {mod.name}</strong>
                    <small>{mod.author} • v{mod.version}</small>
                  </span>
                </button>
                <button
                  className={`toggle ${mod.enabled ? 'on' : ''}`}
                  onClick={() => onToggle(mod.id)}
                  aria-pressed={mod.enabled}
                  aria-label={`${mod.enabled ? 'Disable' : 'Enable'} ${mod.name}`}
                >
                  <span />
                </button>
              </div>
            ))}
          </div>
        </section>

        <aside className="ui-panel detail-pane">
          <div className="ui-panel-title">Details</div>
          {active ? (
            <div className="detail-body">
              <h3 className="detail-name">{active.icon} {active.name}</h3>
              <p className="detail-addr">{active.author} • v{active.version} • {MOD_CATEGORY_LABELS[active.category] ?? active.category}</p>
              <p className="detail-desc">{active.description}</p>
              <p className="option-group-label" style={{ marginTop: 16 }}>Adds</p>
              <div className="chip-row">
                {active.adds.blocks?.length ? <span className="chip static">{active.adds.blocks.length} blocks</span> : null}
                {active.adds.items?.length ? <span className="chip static">{active.adds.items.length} items</span> : null}
                {active.adds.recipes?.length ? <span className="chip static">{active.adds.recipes.length} recipes</span> : null}
                {active.adds.dimensions?.length ? <span className="chip static">{active.adds.dimensions.length} dimensions</span> : null}
              </div>
              <button
                className={active.enabled ? 'confirm-btn wide danger' : 'confirm-btn wide'}
                onClick={() => onToggle(active.id)}
              >
                {active.enabled ? 'Disable Pack' : 'Enable Pack'}
              </button>
            </div>
          ) : (
            <p className="empty-note">Select a mod to see details.</p>
          )}
        </aside>
      </div>
    </MenuScreen>
  );
}

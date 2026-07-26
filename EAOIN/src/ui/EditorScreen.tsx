/**
 * EditorScreen — Editor Mode / Creator Studio.
 *
 * A world-editor workspace where a player can:
 *   • define custom blocks and entities,
 *   • place entities into a preview scene,
 *   • pick a tool from the toolbar (place, erase, brush, terrain, spawn…),
 *   • fill in store metadata, and
 *   • publish the finished creation to the marketplace for coins.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ART_PRESETS,
  CustomBlock,
  CustomEntity,
  EDITOR_TOOLS,
  EditorProject,
  EditorTool,
  TINT_PRESETS,
  createCustomBlock,
  createCustomEntity,
  createEmptyProject,
  exportProject,
  importProject,
  loadProjects,
  saveProjects,
  toMarketItem,
  validateForPublish,
} from '../editor/EditorProject';
import { MARKET_CATEGORIES, MarketCategory, MarketplaceLibrary } from '../marketplace/MarketplaceCatalog';
import { StoreService } from '../economy/StoreService';

export interface EditorScreenProps {
  store: StoreService;
  library: MarketplaceLibrary;
  authorName: string;
  onBack: () => void;
  onOpenMarketplace: () => void;
}

type EditorTab = 'blocks' | 'entities' | 'world' | 'publish';

export default function EditorScreen({
  store, library, authorName, onBack, onOpenMarketplace,
}: EditorScreenProps) {
  const [projects, setProjects] = useState<EditorProject[]>(() => loadProjects());
  const [activeId, setActiveId] = useState<string | null>(() => loadProjects()[0]?.id ?? null);
  const [tab, setTab] = useState<EditorTab>('blocks');
  const [tool, setTool] = useState<EditorTool>('place');
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const active = useMemo(
    () => projects.find((project) => project.id === activeId) ?? null,
    [projects, activeId]
  );

  // Persist on every change so nothing is lost on refresh.
  useEffect(() => { saveProjects(projects); }, [projects]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Escape backs out; number keys pick a tool.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (event.key === 'Escape') { event.preventDefault(); onBack(); return; }
      if (typing) return;
      const match = EDITOR_TOOLS.find((entry) => entry.key === event.key);
      if (match) { event.preventDefault(); setTool(match.id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  /* ------------------------------ project CRUD ---------------------------- */

  const mutate = useCallback((id: string, change: (project: EditorProject) => EditorProject) => {
    setProjects((current) => current.map((project) =>
      project.id === id ? { ...change(project), updatedAt: Date.now() } : project
    ));
  }, []);

  const handleNewProject = useCallback(() => {
    const project = createEmptyProject(authorName);
    setProjects((current) => [project, ...current]);
    setActiveId(project.id);
    setTab('blocks');
    setToast({ text: 'New project created.', ok: true });
  }, [authorName]);

  const handleDeleteProject = useCallback((id: string) => {
    setProjects((current) => {
      const next = current.filter((project) => project.id !== id);
      setActiveId((currentId) => (currentId === id ? next[0]?.id ?? null : currentId));
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    if (!active) return;
    const json = exportProject(active);
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${active.meta.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.eaoin.json`;
      link.click();
      URL.revokeObjectURL(url);
      setToast({ text: 'Project exported.', ok: true });
    } catch {
      setToast({ text: 'Export failed in this browser.', ok: false });
    }
  }, [active]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      const project = importProject(text);
      if (!project) { setToast({ text: 'That file is not a valid EAOIN project.', ok: false }); return; }
      setProjects((current) => [project, ...current]);
      setActiveId(project.id);
      setToast({ text: `Imported "${project.meta.name}".`, ok: true });
    });
    event.target.value = '';
  }, []);

  /* -------------------------------- publish ------------------------------- */

  const validation = useMemo(
    () => (active ? validateForPublish(active) : { ok: false, errors: [], warnings: [] }),
    [active]
  );

  const handlePublish = useCallback(() => {
    if (!active) return;
    const result = validateForPublish(active);
    if (!result.ok) {
      setToast({ text: result.errors[0] ?? 'Project is not ready to publish.', ok: false });
      setTab('publish');
      return;
    }
    store.publishCreation(toMarketItem(active));
    mutate(active.id, (project) => ({ ...project, published: true }));
    setToast({ text: `"${active.meta.name}" is live on the marketplace!`, ok: true });
  }, [active, mutate, store]);

  /* ---------------------------------- view -------------------------------- */

  return (
    <div className="editor-screen">
      <div className="ed-backdrop" />

      <header className="ed-topbar">
        <button className="ed-back" onClick={onBack} aria-label="Back to main menu">‹ Back</button>
        <div className="ed-titles">
          <span className="ed-eyebrow">EAOIN</span>
          <h1 className="ed-title">Editor Mode</h1>
        </div>
        <div className="ed-top-actions">
          <label className="ed-import">
            Import
            <input type="file" accept=".json,application/json" onChange={handleImport} hidden />
          </label>
          <button className="ed-secondary" onClick={handleExport} disabled={!active}>Export</button>
          <button className="ed-secondary" onClick={onOpenMarketplace}>🏬 Marketplace</button>
          <button className="ed-primary" onClick={handlePublish} disabled={!active}>Publish</button>
        </div>
      </header>

      <div className="ed-body">
        {/* --------------------------- project list -------------------------- */}
        <aside className="ed-projects">
          <div className="ed-pane-title">Projects</div>
          <button className="ed-new-btn" onClick={handleNewProject}>+ New Creation</button>
          <div className="ed-project-list">
            {projects.length === 0 && (
              <p className="ed-empty">No projects yet. Create one to start building.</p>
            )}
            {projects.map((project) => (
              <div
                key={project.id}
                className={`ed-project-card ${activeId === project.id ? 'selected' : ''}`}
                onClick={() => setActiveId(project.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => { if (event.key === 'Enter') setActiveId(project.id); }}
              >
                <span className="ed-project-art" style={{ background: project.meta.tint }}>
                  {project.meta.art}
                </span>
                <span className="ed-project-meta">
                  <strong>{project.meta.name}</strong>
                  <small>
                    {project.blocks.length} blocks • {project.entities.length} entities
                    {project.published && <span className="ed-live-tag">LIVE</span>}
                  </small>
                </span>
                <button
                  className="ed-project-delete"
                  aria-label={`Delete ${project.meta.name}`}
                  onClick={(event) => { event.stopPropagation(); handleDeleteProject(project.id); }}
                >✕</button>
              </div>
            ))}
          </div>
        </aside>

        {/* ------------------------------ workspace -------------------------- */}
        {active ? (
          <section className="ed-workspace">
            {/* toolbar */}
            <div className="ed-toolbar" role="toolbar" aria-label="Editor tools">
              {EDITOR_TOOLS.map((entry) => (
                <button
                  key={entry.id}
                  className={`ed-tool ${tool === entry.id ? 'active' : ''}`}
                  onClick={() => setTool(entry.id)}
                  title={`${entry.hint} (${entry.key})`}
                  aria-pressed={tool === entry.id}
                >
                  <span className="ed-tool-icon">{entry.icon}</span>
                  <span className="ed-tool-label">{entry.label}</span>
                  <span className="ed-tool-key">{entry.key}</span>
                </button>
              ))}
            </div>

            {/* viewport placeholder + live stats */}
            <div className="ed-viewport" style={{ background: active.meta.tint }}>
              <div className="ed-viewport-grid" />
              <div className="ed-viewport-hud">
                <span className="ed-viewport-tool">
                  {EDITOR_TOOLS.find((entry) => entry.id === tool)?.icon}{' '}
                  {EDITOR_TOOLS.find((entry) => entry.id === tool)?.label}
                </span>
                <span className="ed-viewport-seed">seed {active.seed}</span>
              </div>
              <div className="ed-viewport-entities">
                {active.placements.map((placement) => {
                  const entity = active.entities.find((candidate) => candidate.id === placement.entityId);
                  return (
                    <span
                      key={placement.id}
                      className="ed-placed-entity"
                      style={{
                        left: `${50 + placement.x}%`,
                        top: `${50 + placement.z}%`,
                        transform: `scale(${entity?.scale ?? 1})`,
                      }}
                      title={entity?.name}
                    >
                      {entity?.glyph ?? '👾'}
                    </span>
                  );
                })}
              </div>
              <p className="ed-viewport-note">
                Live 3D editing renders here in-game. Use the panels to define content,
                then Publish to sell it.
              </p>
            </div>

            {/* tabs */}
            <div className="ed-tabs" role="tablist">
              {(['blocks', 'entities', 'world', 'publish'] as EditorTab[]).map((key) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  className={`ed-tab ${tab === key ? 'active' : ''}`}
                  onClick={() => setTab(key)}
                >
                  {key === 'blocks' && '🧱 Blocks'}
                  {key === 'entities' && '👾 Entities'}
                  {key === 'world' && '🌍 World'}
                  {key === 'publish' && '🏬 Publish'}
                </button>
              ))}
            </div>

            <div className="ed-tab-body">
              {tab === 'blocks' && (
                <BlocksTab project={active} onChange={(next) => mutate(active.id, () => next)} />
              )}
              {tab === 'entities' && (
                <EntitiesTab project={active} onChange={(next) => mutate(active.id, () => next)} />
              )}
              {tab === 'world' && (
                <WorldTab project={active} onChange={(next) => mutate(active.id, () => next)} />
              )}
              {tab === 'publish' && (
                <PublishTab
                  project={active}
                  validation={validation}
                  onChange={(next) => mutate(active.id, () => next)}
                  onPublish={handlePublish}
                  library={library}
                />
              )}
            </div>
          </section>
        ) : (
          <section className="ed-workspace ed-workspace-empty">
            <div className="ed-empty-state">
              <span className="ed-empty-glyph">🛠</span>
              <h2>Create something worth selling</h2>
              <p>
                Build custom blocks, design entities, sculpt worlds, then publish to the
                marketplace and earn coins whenever someone buys your work.
              </p>
              <button className="ed-primary" onClick={handleNewProject}>+ New Creation</button>
            </div>
          </section>
        )}
      </div>

      {toast && <div className={`ed-toast ${toast.ok ? 'ok' : 'err'}`} role="status">{toast.text}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Tabs                                    */
/* -------------------------------------------------------------------------- */

function BlocksTab({ project, onChange }: { project: EditorProject; onChange: (p: EditorProject) => void }) {
  const update = (id: string, patch: Partial<CustomBlock>) => {
    onChange({
      ...project,
      blocks: project.blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)),
    });
  };

  return (
    <div className="ed-panel">
      <div className="ed-panel-head">
        <h3>Custom Blocks ({project.blocks.length})</h3>
        <button
          className="ed-add-btn"
          onClick={() => onChange({ ...project, blocks: [...project.blocks, createCustomBlock()] })}
        >+ Add Block</button>
      </div>

      {project.blocks.length === 0 && (
        <p className="ed-empty">No custom blocks yet. Add one to start building your palette.</p>
      )}

      <div className="ed-card-grid">
        {project.blocks.map((block) => (
          <div key={block.id} className="ed-item-card">
            <div className="ed-item-swatch" style={{ background: block.color }} />
            <label className="ed-field">
              <span>Name</span>
              <input value={block.name} onChange={(e) => update(block.id, { name: e.target.value })} />
            </label>
            <label className="ed-field">
              <span>Colour</span>
              <input type="color" value={block.color} onChange={(e) => update(block.id, { color: e.target.value })} />
            </label>
            <label className="ed-field">
              <span>Hardness {block.hardness.toFixed(1)}</span>
              <input
                type="range" min={0.1} max={10} step={0.1} value={block.hardness}
                onChange={(e) => update(block.id, { hardness: Number(e.target.value) })}
              />
            </label>
            <label className="ed-check">
              <input type="checkbox" checked={block.solid} onChange={(e) => update(block.id, { solid: e.target.checked })} />
              <span>Solid</span>
            </label>
            <label className="ed-check">
              <input type="checkbox" checked={block.emissive} onChange={(e) => update(block.id, { emissive: e.target.checked })} />
              <span>Emits light</span>
            </label>
            {block.emissive && (
              <label className="ed-field">
                <span>Light {Math.round(block.lightLevel * 15)}</span>
                <input
                  type="range" min={0} max={1} step={0.0667} value={block.lightLevel}
                  onChange={(e) => update(block.id, { lightLevel: Number(e.target.value) })}
                />
              </label>
            )}
            <button
              className="ed-remove"
              onClick={() => onChange({ ...project, blocks: project.blocks.filter((b) => b.id !== block.id) })}
            >Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntitiesTab({ project, onChange }: { project: EditorProject; onChange: (p: EditorProject) => void }) {
  const update = (id: string, patch: Partial<CustomEntity>) => {
    onChange({
      ...project,
      entities: project.entities.map((entity) => (entity.id === id ? { ...entity, ...patch } : entity)),
    });
  };

  const spawn = (entityId: string) => {
    onChange({
      ...project,
      placements: [...project.placements, {
        id: `place_${Date.now().toString(36)}_${project.placements.length}`,
        entityId,
        x: Math.round((Math.random() - 0.5) * 70),
        y: 0,
        z: Math.round((Math.random() - 0.5) * 70),
      }],
    });
  };

  return (
    <div className="ed-panel">
      <div className="ed-panel-head">
        <h3>Custom Entities ({project.entities.length})</h3>
        <button
          className="ed-add-btn"
          onClick={() => onChange({ ...project, entities: [...project.entities, createCustomEntity()] })}
        >+ Add Entity</button>
      </div>

      {project.entities.length === 0 && (
        <p className="ed-empty">No entities yet. Create creatures, NPCs or bosses for your world.</p>
      )}

      <div className="ed-card-grid">
        {project.entities.map((entity) => (
          <div key={entity.id} className="ed-item-card">
            <div className="ed-item-glyph">{entity.glyph}</div>
            <label className="ed-field">
              <span>Name</span>
              <input value={entity.name} onChange={(e) => update(entity.id, { name: e.target.value })} />
            </label>
            <label className="ed-field">
              <span>Glyph</span>
              <input value={entity.glyph} maxLength={4} onChange={(e) => update(entity.id, { glyph: e.target.value })} />
            </label>
            <label className="ed-field">
              <span>Health {entity.health}</span>
              <input
                type="range" min={1} max={500} step={1} value={entity.health}
                onChange={(e) => update(entity.id, { health: Number(e.target.value) })}
              />
            </label>
            <label className="ed-field">
              <span>Speed {entity.speed.toFixed(1)}</span>
              <input
                type="range" min={0} max={8} step={0.1} value={entity.speed}
                onChange={(e) => update(entity.id, { speed: Number(e.target.value) })}
              />
            </label>
            <label className="ed-field">
              <span>Scale {entity.scale.toFixed(1)}</span>
              <input
                type="range" min={0.2} max={4} step={0.1} value={entity.scale}
                onChange={(e) => update(entity.id, { scale: Number(e.target.value) })}
              />
            </label>
            <label className="ed-field">
              <span>Behaviour</span>
              <select
                value={entity.behaviour}
                onChange={(e) => update(entity.id, { behaviour: e.target.value as CustomEntity['behaviour'] })}
              >
                {(['idle', 'wander', 'follow', 'flee', 'patrol', 'guard'] as const).map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </label>
            <label className="ed-check">
              <input type="checkbox" checked={entity.hostile} onChange={(e) => update(entity.id, { hostile: e.target.checked })} />
              <span>Hostile</span>
            </label>
            <div className="ed-card-actions">
              <button className="ed-spawn" onClick={() => spawn(entity.id)}>Spawn in world</button>
              <button
                className="ed-remove"
                onClick={() => onChange({
                  ...project,
                  entities: project.entities.filter((candidate) => candidate.id !== entity.id),
                  placements: project.placements.filter((placement) => placement.entityId !== entity.id),
                })}
              >Remove</button>
            </div>
          </div>
        ))}
      </div>

      {project.placements.length > 0 && (
        <div className="ed-placements">
          <h4>Placed entities ({project.placements.length})</h4>
          <button
            className="ed-clear"
            onClick={() => onChange({ ...project, placements: [] })}
          >Clear all placements</button>
        </div>
      )}
    </div>
  );
}

function WorldTab({ project, onChange }: { project: EditorProject; onChange: (p: EditorProject) => void }) {
  return (
    <div className="ed-panel">
      <div className="ed-panel-head"><h3>World Settings</h3></div>
      <div className="ed-form">
        <label className="ed-field">
          <span>Preview seed</span>
          <div className="ed-seed-row">
            <input value={project.seed} onChange={(e) => onChange({ ...project, seed: e.target.value })} />
            <button
              className="ed-secondary"
              onClick={() => onChange({ ...project, seed: `editor_${Math.random().toString(36).slice(2, 10)}` })}
            >🎲 Random</button>
          </div>
        </label>
        <label className="ed-field">
          <span>Tile art</span>
          <div className="ed-preset-row">
            {ART_PRESETS.map((art) => (
              <button
                key={art}
                className={`ed-preset ${project.meta.art === art ? 'active' : ''}`}
                onClick={() => onChange({ ...project, meta: { ...project.meta, art } })}
              >{art}</button>
            ))}
          </div>
        </label>
        <label className="ed-field">
          <span>Tile colour</span>
          <div className="ed-preset-row">
            {TINT_PRESETS.map((tint) => (
              <button
                key={tint}
                className={`ed-preset tint ${project.meta.tint === tint ? 'active' : ''}`}
                style={{ background: tint }}
                aria-label="Select tile colour"
                onClick={() => onChange({ ...project, meta: { ...project.meta, tint } })}
              />
            ))}
          </div>
        </label>
      </div>
    </div>
  );
}

function PublishTab({
  project, validation, onChange, onPublish, library,
}: {
  project: EditorProject;
  validation: { ok: boolean; errors: string[]; warnings: string[] };
  onChange: (p: EditorProject) => void;
  onPublish: () => void;
  library: MarketplaceLibrary;
}) {
  const setMeta = (patch: Partial<EditorProject['meta']>) =>
    onChange({ ...project, meta: { ...project.meta, ...patch } });

  const alreadyLive = library.publishedItems().some((item) => item.id === `creator-${project.id}`);

  return (
    <div className="ed-panel">
      <div className="ed-panel-head"><h3>Publish to Marketplace</h3></div>

      <div className="ed-form">
        <label className="ed-field">
          <span>Name</span>
          <input value={project.meta.name} onChange={(e) => setMeta({ name: e.target.value })} maxLength={48} />
        </label>

        <label className="ed-field">
          <span>Description</span>
          <textarea
            rows={3}
            value={project.meta.description}
            onChange={(e) => setMeta({ description: e.target.value })}
            placeholder="Tell players what makes your creation worth buying…"
          />
        </label>

        <label className="ed-field">
          <span>Category</span>
          <select
            value={project.meta.category}
            onChange={(e) => setMeta({ category: e.target.value as MarketCategory })}
          >
            {MARKET_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>{category.icon} {category.label}</option>
            ))}
          </select>
        </label>

        <label className="ed-field">
          <span>Price — 🪙 {project.meta.priceCoins.toLocaleString()} coins</span>
          <input
            type="range" min={0} max={5000} step={10}
            value={project.meta.priceCoins}
            onChange={(e) => setMeta({ priceCoins: Number(e.target.value) })}
          />
          <small className="ed-hint">
            You keep 70% of every sale — about 🪙{Math.floor(project.meta.priceCoins * 0.7).toLocaleString()} per copy.
            Set to 0 to publish free.
          </small>
        </label>

        <label className="ed-field">
          <span>Tags (comma separated)</span>
          <input
            value={project.meta.tags.join(', ')}
            onChange={(e) => setMeta({
              tags: e.target.value.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean),
            })}
            placeholder="adventure, pvp, medieval"
          />
        </label>
      </div>

      {validation.errors.length > 0 && (
        <ul className="ed-validation errors">
          {validation.errors.map((error) => <li key={error}>✕ {error}</li>)}
        </ul>
      )}
      {validation.warnings.length > 0 && (
        <ul className="ed-validation warnings">
          {validation.warnings.map((warning) => <li key={warning}>⚠ {warning}</li>)}
        </ul>
      )}

      <button className="ed-publish-btn" onClick={onPublish} disabled={!validation.ok}>
        {alreadyLive ? 'Update Listing' : 'Publish to Marketplace'}
      </button>
      {alreadyLive && <p className="ed-hint">This creation is already live on the marketplace.</p>}
    </div>
  );
}

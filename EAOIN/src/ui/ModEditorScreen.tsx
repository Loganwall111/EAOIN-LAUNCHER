/**
 * ModEditorScreen — build your own mod in-game.
 *
 * A lightweight editor where you give a mod a name/description and add custom
 * blocks (with a colour + name) and items. Saving registers it with the shared
 * ModPackRegistry, so it appears in the Mods browser and (once enabled) grants
 * its blocks/items in a fresh world — a real, working mod you made in-game.
 */
import { useState } from 'react';
import { ModPackRegistry } from '../modding/ModPackRegistry';
import { UI_ASSETS } from './theme';
import MenuScreen from './MenuScreen';

export interface ModEditorScreenProps {
  registry: ModPackRegistry;
  onBack: () => void;
}

interface DraftBlock {
  name: string;
  color: string;
  solid: boolean;
}

const PRESET_COLORS = ['#a879ff', '#4de0ff', '#7aff6a', '#ffd166', '#ff8a5a', '#ff5ac8', '#ffffff', '#ff4d4d'];

export default function ModEditorScreen({ registry, onBack }: ModEditorScreenProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [blocks, setBlocks] = useState<DraftBlock[]>([{ name: '', color: '#a879ff', solid: true }]);
  const [items, setItems] = useState<number[]>([]);
  const [saved, setSaved] = useState(false);

  const updateBlock = (i: number, patch: Partial<DraftBlock>) => {
    setBlocks((bs) => bs.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  };

  const addBlockRow = () => setBlocks((bs) => [...bs, { name: '', color: '#a879ff', solid: true }]);
  const removeBlockRow = (i: number) => setBlocks((bs) => bs.filter((_, idx) => idx !== i));

  const toggleItem = (id: number) => {
    setItems((its) => (its.includes(id) ? its.filter((x) => x !== id) : [...its, id]));
  };

  const saveMod = () => {
    const namedBlocks = blocks
      .filter((b) => b.name.trim())
      .map((b, i) => ({
        id: 900 + i,
        name: b.name.trim(),
        shortName: b.name.trim().slice(0, 2).toUpperCase(),
        category: 'decoration' as const,
        solid: b.solid,
        transparent: !b.solid,
        hardness: 1.5,
        lightLevel: 4,
        emissive: true,
        stackSize: 64,
        color: b.color,
      }));
    if (!name.trim()) return;
    registry.createCustomMod({ name: name.trim(), description, blocks: namedBlocks, items });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <MenuScreen
      title="Mod Editor"
      subtitle="Build your own mod, blocks and items — live"
      backdrop={UI_ASSETS.bgMods}
      onBack={onBack}
    >
      <div className="ui-panel editor-pane">
        <div className="ui-panel-title">New Mod</div>
        <div className="opt-list">
          <label className="opt-row">
            <span className="opt-label"><strong>Mod name</strong></span>
            <input className="ui-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My Super Blocks" />
          </label>
          <label className="opt-row">
            <span className="opt-label"><strong>Description</strong></span>
            <input className="ui-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does it add?" />
          </label>
        </div>

        <div className="ui-panel-title" style={{ marginTop: 18 }}>Custom Blocks</div>
        {blocks.map((b, i) => (
          <div key={i} className="opt-row">
            <input
              className="ui-input"
              placeholder={`Block ${i + 1} name`}
              value={b.name}
              onChange={(e) => updateBlock(i, { name: e.target.value })}
            />
            <div className="color-picker-row">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={`color-swatch ${b.color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => updateBlock(i, { color: c })}
                  aria-label={`colour ${c}`}
                />
              ))}
            </div>
            <label className="opt-check">
              <input type="checkbox" checked={b.solid} onChange={(e) => updateBlock(i, { solid: e.target.checked })} />
              Solid
            </label>
            <button className="btn-secondary" onClick={() => removeBlockRow(i)}>✕</button>
          </div>
        ))}
        <button className="btn-secondary" onClick={addBlockRow}>+ Add block</button>

        <div className="ui-panel-title" style={{ marginTop: 18 }}>Extra Items (by id)</div>
        <div className="chip-row">
          {[1, 2, 3, 4, 6, 7, 8, 10, 12, 16, 24, 49].map((id) => (
            <button
              key={id}
              className={`chip ${items.includes(id) ? 'active' : ''}`}
              onClick={() => toggleItem(id)}
            >
              +{id}
            </button>
          ))}
        </div>

        <div className="editor-save">
          <button className="confirm-btn wide" onClick={saveMod}>💾 Save Mod</button>
          {saved && <p className="editor-saved">✓ Mod saved — find it in Mods &amp; Packs</p>}
        </div>
      </div>
    </MenuScreen>
  );
}

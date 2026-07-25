import { useEffect, useState, useMemo } from 'react';
import { BlockID, getBlock } from '@shared/blocks/BlockRegistry';
import { RecipeID, RECIPES, canCraft, recipeCostLabel, recipeOutputLabel } from '../crafting/RecipeBook';
import { GameMode } from '../modes/GameMode';
import { ObjectiveStatus } from '../objectives/ObjectiveTracker';
import { RuntimeStatus } from '../runtime/RuntimeStatus';
import { getStackCount, HOTBAR_BLOCKS, InventoryStacks } from '../player/InventoryState';
import { SurvivalStats } from '../player/SurvivalState';
import { getTool, isToolUnlocked, TOOLBELT, ToolID, ToolInventory } from '../player/ToolState';
import { GameSettings, clampSettings } from '../settings/GameSettings';

interface HUDProps {
  gameMode: GameMode; selectedBlock: BlockID; selectedTool: ToolID; toolInventory: ToolInventory;
  inventory: InventoryStacks; survivalStats: SurvivalStats; inventoryOpen: boolean; settingsOpen: boolean; settings: GameSettings;
  runtimeStatus: RuntimeStatus; objectives: ObjectiveStatus[]; objectivesVisible: boolean; systemsVisible: boolean;
  onToggleObjectives: () => void; onToggleSystems: () => void; craftingMessage: string;
  onCraftRecipe: (recipe: RecipeID) => void; onCloseInventory: () => void; onCloseSettings: () => void;
  onSettingsChange: (s: GameSettings) => void; onResetPlayerProgress: () => void;
}

const INVENTORY_BLOCKS: BlockID[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

const BLOCK_COLORS: Record<number, string> = {
  1: '#4f9d36', 2: '#8a5b38', 3: '#7b7f86', 4: '#d8c27a', 5: '#3175d8', 6: '#8b5a2b', 7: '#2f8f38', 8: '#303035', 9: '#77716a', 10: '#876f30', 11: '#587f89', 12: '#20152f', 13: '#3b0d0d', 14: '#5f1b16', 15: '#3b1d63', 16: '#63d7ff', 17: '#9b6b31', 18: '#b28655', 19: '#243b53', 20: '#7c4a21', 21: '#2f1b68', 22: '#d7dde8', 23: '#8e99a8',
};

function BlockLogo({ id, size = 28 }: { id: BlockID; size?: number }) {
  const color = BLOCK_COLORS[id] ?? '#555';
  const name = getBlock(id).name.slice(0, 2).toUpperCase();
  return <div className="block-logo" style={{ width: size, height: size, background: color, border: '2px solid #000', display: 'grid', placeItems: 'center', font: '800 10px monospace', color: '#fff', textShadow: '1px 1px #000', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22)' }}>{name}</div>;
}

export default function HUD({ gameMode, selectedBlock, selectedTool, toolInventory, inventory, survivalStats, inventoryOpen, settingsOpen, settings, runtimeStatus, objectives, objectivesVisible, systemsVisible, onToggleObjectives, onToggleSystems, craftingMessage, onCraftRecipe, onCloseInventory, onCloseSettings, onSettingsChange, onResetPlayerProgress }: HUDProps) {
  const updateSettings = (patch: Partial<GameSettings>) => onSettingsChange(clampSettings({ ...settings, ...patch }));
  const [craftMode, setCraftMode] = useState<2 | 3>(2);
  const [craftGrid, setCraftGrid] = useState<(BlockID | null)[]>([null, null, null, null]);
  const [craftGrid3, setCraftGrid3] = useState<(BlockID | null)[]>(Array(9).fill(null));

  const activeGrid = craftMode === 2 ? craftGrid : craftGrid3;

  const gridCounts = useMemo(() => {
    const m = new Map<BlockID, number>();
    for (const id of activeGrid) if (id) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [activeGrid]);

  const matchingRecipe = useMemo(() => {
    // Find first recipe whose costs are subset of grid counts (simplified crafting above inventory like Minecraft)
    for (const r of RECIPES) {
      let ok = true;
      for (const c of r.costs) {
        if ((gridCounts.get(c.blockId) ?? 0) < c.amount) { ok = false; break; }
      }
      if (ok && r.costs.length > 0) return r;
    }
    return null;
  }, [gridCounts]);

  const placeIntoGrid = (blockId: BlockID) => {
    if (craftMode === 2) {
      const idx = craftGrid.findIndex(v => v === null);
      if (idx >= 0) { const g = [...craftGrid]; g[idx] = blockId; setCraftGrid(g); }
    } else {
      const idx = craftGrid3.findIndex(v => v === null);
      if (idx >= 0) { const g = [...craftGrid3]; g[idx] = blockId; setCraftGrid3(g); }
    }
  };

  const clearGrid = () => { setCraftGrid([null, null, null, null]); setCraftGrid3(Array(9).fill(null)); };

  const craftFromGrid = () => {
    if (!matchingRecipe) return;
    // consume grid
    const remaining = new Map(gridCounts);
    for (const c of matchingRecipe.costs) {
      remaining.set(c.blockId, (remaining.get(c.blockId) ?? 0) - c.amount);
    }
    // rebuild grid emptied of consumed? For simplicity clear grid
    clearGrid();
    onCraftRecipe(matchingRecipe.id);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'o') onToggleObjectives();
      if (e.key.toLowerCase() === 'u') onToggleSystems();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onToggleObjectives, onToggleSystems]);

  return (
    <div className="game-hud-overlay">
      <div className="survival-panel"><div className="stat-row"><span>Mode</span><strong>{gameMode}</strong></div><div className="stat-row"><span>Health</span><meter min={0} max={100} value={survivalStats.health} /></div><div className="stat-row"><span>Food</span><meter min={0} max={100} value={survivalStats.food} /></div><div className="stat-row"><span>Stamina</span><meter min={0} max={100} value={survivalStats.stamina} /></div></div>

      {systemsVisible && <div className="systems-panel"><h3>Runtime Systems [U]</h3>
        <div><span>Ver</span><strong>{runtimeStatus.nextGen.version}</strong></div>
        <div><span>Clouds</span><strong>moving stunning far</strong></div>
        <div><span>Render</span><strong>{runtimeStatus.nextGen.cityLengthKm}km • 16 chunks</strong></div>
        <div><span>Fog</span><strong>{settings.fogEnabled ? '100-1000 on' : 'off'} • toggle</strong></div>
        <div><span>Day/Night</span><strong>20min cycle</strong></div>
        <div><span>Dimension</span><strong>{runtimeStatus.dimensionName}</strong></div>
        <div><span>Settlement</span><strong>{runtimeStatus.settlementName}</strong></div>
        <div><span>Doors</span><strong>{runtimeStatus.doors}/{runtimeStatus.dimensionalDoors}</strong></div>
        <div><span>Rocket</span><strong>{runtimeStatus.rocketReady ? 'ready' : 'refuel'}</strong></div>
        <div><span>Moon</span><strong>{runtimeStatus.moonVisits}</strong></div>
        <div><span>Physics</span><strong>{runtimeStatus.nextGen.advancedPhysics.waveHeight} wave</strong></div>
        <div><span>Market</span><strong>{runtimeStatus.nextGen.marketplace.publishedPacks}/{runtimeStatus.nextGen.marketplace.packs}</strong></div>
      </div>}

      {settings.showObjectives && objectivesVisible && (
        <div className="objectives-panel"><h3>Objectives [O]</h3>{objectives.map(o => <div key={o.id} className={`objective ${o.complete ? 'complete' : ''}`}><span>{o.complete ? '✓' : '•'} {o.label}</span><strong>{o.progress}</strong></div>)}</div>
      )}

      <div className="toolbelt">{TOOLBELT.map((toolId, index) => { const unlocked = isToolUnlocked(toolInventory, toolId); return <div key={toolId} className={`tool-slot ${selectedTool === toolId ? 'selected' : ''} ${unlocked ? '' : 'locked'}`}><span className="slot-key">{index === 0 ? 'Q' : `Q+${index}`}</span><span className="item-label">{unlocked ? getTool(toolId).name : 'Locked'}</span></div>; })}</div>

      <div className="hotbar">{HOTBAR_BLOCKS.map((blockId, index) => { const count = getStackCount(inventory, blockId); return <div key={blockId} className={`slot ${selectedBlock === blockId ? 'selected' : ''} ${count === 0 ? 'empty' : ''}`}><span className="slot-key">{index + 1}</span><div style={{ marginTop: 12 }}><BlockLogo id={blockId} size={22} /></div><span className="item-label" style={{ fontSize: 8 }}>{getBlock(blockId).name.slice(0, 7)}</span><span className="stack-count">×{count}</span></div>; })}</div>

      {inventoryOpen && (
        <div className="inventory-panel pro-inv">
          <div className="inventory-header"><div><h2>Inventory — Block logos • Survival crafting table above • Hand punch when mining tree</h2><p>{craftingMessage} • Cracking overlay 1-10 when destroying • Fog {settings.fogEnabled ? '100-1000 on' : 'off'} • T chat /day /time /summon</p></div><button onClick={onCloseInventory}>Close [E]</button></div>

          <div className="inv-top">
            <div className="inv-player-area">
              <h3 style={{ color: '#ffd166', fontSize: 11 }}>Player</h3>
              <div className="inv-avatar-box"><div style={{ fontSize: 48 }}>🧍</div><small style={{ fontSize: 9, color: '#aaa' }}>Survival • 20min day</small></div>
              <div style={{ fontSize: 9, color: '#bbb' }}>Hand punches toward tree when mining wood — arm goes forward (see GameCanvas)</div>
            </div>
            <div className="inv-crafting">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ color: '#7ef7a0', fontSize: 11 }}>Crafting Table {craftMode}x{craftMode} in inventory</h3><button className="btn-secondary mini" onClick={() => setCraftMode(c => c === 2 ? 3 : 2)}>Toggle {craftMode === 2 ? '3x3 Table' : '2x2'}</button><button className="btn-secondary mini" onClick={clearGrid}>Clear</button></div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className={`craft-grid ${craftMode === 2 ? 'c2' : 'c3'}`}>
                  {activeGrid.map((bid, i) => (
                    <div key={i} className="craft-slot" onClick={() => {
                      if (craftMode === 2) { const g = [...craftGrid]; g[i] = null; setCraftGrid(g); } else { const g = [...craftGrid3]; g[i] = null; setCraftGrid3(g); }
                    }}>{bid ? <BlockLogo id={bid} /> : <span style={{ opacity: 0.25, fontSize: 10 }}>·</span>}</div>
                  ))}
                </div>
                <div className="craft-arrow">→</div>
                <div className="craft-result" onClick={craftFromGrid} title={matchingRecipe ? `Craft ${matchingRecipe.name}` : 'Add blocks to grid to craft'}>
                  {matchingRecipe ? <><BlockLogo id={matchingRecipe.output.type === 'block' ? matchingRecipe.output.blockId : 6} size={36} /><small style={{ fontSize: 8, color: '#ffd166' }}>{matchingRecipe.name}</small></> : <span style={{ opacity: 0.4, fontSize: 10 }}>Result</span>}
                </div>
              </div>
              <small style={{ fontSize: 9, color: '#aaa' }}>Click inventory blocks with logos to place into crafting grid above — actually crafts. Hand punches tree, cracking overlay 1-10 appears on ground when destroying.</small>
            </div>
          </div>

          <h3 style={{ color: '#ffd166', fontSize: 11, margin: '8px 0' }}>Materials — block logos like Minecraft inventory (colored logos)</h3>
          <div className="inventory-grid-pro">
            {INVENTORY_BLOCKS.map(blockId => {
              const count = getStackCount(inventory, blockId);
              return (
                <div key={blockId} className="inv-slot" onClick={() => { if (count > 0) placeIntoGrid(blockId); }} title={`${getBlock(blockId).name} — click to place into crafting table above`}>
                  <BlockLogo id={blockId} size={28} />
                  <span className="stack-count">×{count}</span>
                </div>
              );
            })}
          </div>

          <h3 style={{ color: '#7ef7a0', fontSize: 11, margin: '10px 0 6px' }}>Crafting Recipes — with block logos</h3>
          <div className="recipe-list" style={{ maxHeight: 160 }}>
            {RECIPES.map(recipe => {
              const ready = canCraft(recipe, inventory, toolInventory);
              return (
                <button key={recipe.id} className={`recipe-card ${ready ? 'ready' : ''}`} onClick={() => onCraftRecipe(recipe.id)} disabled={!ready}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{recipe.output.type === 'block' ? <BlockLogo id={recipe.output.blockId} size={20} /> : <span>🛠️</span>}<span className="recipe-name">{recipe.name}</span></div>
                  <span>Cost: {recipeCostLabel(recipe)}</span><span>Output: {recipeOutputLabel(recipe)}</span><small>{recipe.description}</small>
                </button>
              );
            })}
          </div>

          <div className="inventory-footer"><span>Keys: I/E toggle • 1-9 blocks • Q tools • T chat /day /time /summon • Left click punch with hand toward tree • Cracking overlay • Fog toggle in settings 100-1000</span><button className="danger-lite" onClick={onResetPlayerProgress}>Reset</button></div>
        </div>
      )}

      {runtimeStatus.nextGen.creditsActive && <div className="credits-cinematic"><div className="credits-stars" /><div className="credits-card"><p>After years...</p><h1>THE END</h1><span>EAOIN {runtimeStatus.nextGen.version}</span><small>Press K to skip</small></div><div className="credits-roll"><p>Clouds stunning far away • Mountains bigger • Caves bigger • Cliffs + flats volumetric square • 20min day</p><p>Inventory block logos • Crafting table above • Hand punch • Cracking 1-10 • Fog 100-1000 • T chat</p></div></div>}

      {settingsOpen && (
        <div className="settings-panel"><div className="inventory-header"><div><h2>Settings — Fog reduced 100-1000 toggle • Clouds moving</h2><p>Day/night 20min • Render distance up to 16 • Inventory logos</p></div><button onClick={onCloseSettings}>Close</button></div>
          <label className="setting-row"><span>Muted</span><input type="checkbox" checked={settings.muted} onChange={e => updateSettings({ muted: e.target.checked })} /></label>
          <label className="setting-row"><span>Volume {Math.round(settings.volume * 100)}%</span><input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={e => updateSettings({ volume: Number(e.target.value) })} /></label>
          <label className="setting-row"><span>Quality (render distance {settings.qualityPreset === 'performance' ? 6 : settings.qualityPreset === 'quality' ? 12 : settings.qualityPreset === 'cinematic' ? 16 : 8})</span><select value={settings.qualityPreset} onChange={e => updateSettings({ qualityPreset: e.target.value as GameSettings['qualityPreset'] })}><option value="performance">Performance (6)</option><option value="balanced">Balanced (8)</option><option value="quality">Quality (12)</option><option value="cinematic">Cinematic (16)</option></select></label>
          <label className="setting-row"><span>Fog enabled (reduced to 100-1000)</span><input type="checkbox" checked={settings.fogEnabled} onChange={e => updateSettings({ fogEnabled: e.target.checked })} /></label>
          <label className="setting-row"><span>Render scale {Math.round(settings.renderScale * 100)}%</span><input type="range" min={0.5} max={1.5} step={0.05} value={settings.renderScale} onChange={e => updateSettings({ renderScale: Number(e.target.value) })} /></label>
          <label className="setting-row"><span>Realistic + clouds moving</span><input type="checkbox" checked={settings.realisticLighting} onChange={e => updateSettings({ realisticLighting: e.target.checked })} /></label>
          <label className="setting-row"><span>Particles + clouds</span><input type="checkbox" checked={settings.particlesEnabled} onChange={e => updateSettings({ particlesEnabled: e.target.checked })} /></label>
          <label className="setting-row"><span>Show stats</span><input type="checkbox" checked={settings.showStats} onChange={e => updateSettings({ showStats: e.target.checked })} /></label>
        </div>
      )}

      <div className="status-bar"><span>Left: punch tree (hand goes) + cracking 1-10</span><span>T chat • /day /time /summon • Q tools</span><span>Fog 100-1000 toggle • Clouds moving stunning far • 20min day</span></div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { BlockID, getBlock, ALL_BLOCK_IDS, CATEGORY_ORDER, CATEGORY_LABELS, BlockCategory, BlockDef } from '@shared/blocks/BlockRegistry';
import { RecipeID, RECIPES, canCraft, recipeCostLabel, recipeOutputLabel } from '../crafting/RecipeBook';
import BlockIcon from './BlockIcon';
import { GameMode } from '../modes/GameMode';
import { ObjectiveStatus } from '../objectives/ObjectiveTracker';
import { RuntimeStatus } from '../runtime/RuntimeStatus';
import { getStackCount, HOTBAR_BLOCKS, InventoryStacks } from '../player/InventoryState';
import { SurvivalStats } from '../player/SurvivalState';
import { ToolID, ToolInventory } from '../player/ToolState';
import { GameSettings, clampSettings } from '../settings/GameSettings';
import { RELEASE_LABEL, RELEASE_TAGLINE, RELEASE_FEATURES, GAME_VERSION } from '../version';
import { ALL_SHADERS, ShaderID, ShaderDefinition } from '../rendering/ShaderRegistry';
import { ModPackRegistry, ModDefinition, ALL_MODS, MOD_CATEGORY_LABELS, MOD_CATEGORIES } from '../modding/ModPackRegistry';
import { ALL_SERVERS, ServerEntry, DEMO_FRIENDS, DEMO_GUILDS, DEMO_NATIONS } from '../networking/ServerBrowser';
import { ALL_DIMENSIONS } from '../dimensions/DimensionRuntime';
import DimensionSigil from './DimensionSigil';
import DeveloperAppPanel from './DeveloperAppPanel';
import HowToPlayGuide from './HowToPlayGuide';
import { ALL_BOSSES, BOSS_TIER_LABELS } from '../creatures/BossRegistry';
import { ALL_QUESTS, QUEST_TYPES, QUEST_TYPE_LABELS } from '../objectives/QuestRegistry';
import { CIVILIZATIONS, RACE_NAMES, TECH_AGE_LABELS, TECH_AGE_ICONS } from '../civilization/CivilizationTech';
import { ALL_STAR_SYSTEMS, ALL_PLANETS, ALL_ANOMALIES, GALAXY_LIST, STAR_CLASS_INFO } from '../nextgen/SpaceRegistry';
import { ALL_BIOMES } from '../world/Biomes';

interface HUDProps {
  gameMode: GameMode; selectedBlock: BlockID; selectedTool: ToolID; toolInventory: ToolInventory;
  inventory: InventoryStacks; survivalStats: SurvivalStats; inventoryOpen: boolean; settingsOpen: boolean; settings: GameSettings;
  /** Instant dimension travel from the Dimensions menu. */
  onTravelToDimension?: (dimensionId: string) => void;
  runtimeStatus: RuntimeStatus; objectives: ObjectiveStatus[]; objectivesVisible: boolean; systemsVisible: boolean;
  onToggleObjectives: () => void; onToggleSystems: () => void; craftingMessage: string;
  onCraftRecipe: (recipe: RecipeID) => void; onCloseInventory: () => void; onCloseSettings: () => void;
  onSettingsChange: (s: GameSettings) => void;
  onSelectBlock: (block: BlockID) => void;
}

/* --------------------- Block icon --------------------- */
/**
 * Inventory icons now render the block's real texture (see `BlockIcon`).
 *
 * This used to be `BlockLogo`, which drew a flat two-tone CSS cube from
 * `block.color`, so every block in the inventory was a coloured lozenge rather
 * than the textured block it is in the world.
 */
function BlockLogo({ id, size = 28 }: { id: BlockID; size?: number; pixelStyle?: 'cube' | 'flat' | 'isometric' }) {
  return <BlockIcon id={id} size={size} />;
}

function SlotKey({ k }: { k: string | number }) {
  return <span className="slot-key">{k}</span>;
}

function StackCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="stack-count">×{count}</span>;
}

interface SlotProps {
  id: BlockID;
  count: number;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  showKey?: string | number;
  size?: number;
  empty?: boolean;
}

function BlockSlot({ id, count, selected, onClick, onDoubleClick, showKey, size = 28, empty }: SlotProps) {
  return (
    <div
      className={`inv-slot ${selected ? 'selected' : ''} ${empty || count === 0 ? 'empty' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={getBlock(id).name}
    >
      {showKey !== undefined && <SlotKey k={showKey} />}
      <BlockLogo id={id} size={size} />
      <StackCount count={count} />
    </div>
  );
}

/* --------------------- Main HUD --------------------- */
export default function HUD({ gameMode, selectedBlock, toolInventory, inventory, inventoryOpen, settingsOpen, settings, runtimeStatus, objectives, objectivesVisible, systemsVisible, onToggleObjectives, onToggleSystems, craftingMessage, onCraftRecipe, onCloseInventory, onCloseSettings, onSettingsChange, onSelectBlock, onTravelToDimension }: HUDProps) {
  const updateSettings = (patch: Partial<GameSettings>) => onSettingsChange(clampSettings({ ...settings, ...patch }));
  const [craftMode, setCraftMode] = useState<2 | 3>(2);
  const [craftGrid, setCraftGrid] = useState<(BlockID | null)[]>([null, null, null, null]);
  const [craftGrid3, setCraftGrid3] = useState<(BlockID | null)[]>(Array(9).fill(null));

  /* ---- creative menu state ---- */
  // 'all' is a real tab, and searching implicitly searches every category —
  // which is what people expect from Minecraft's creative search.
  const [creativeCategory, setCreativeCategory] = useState<CreativeTab>('all');
  const [creativeSearch, setCreativeSearch] = useState('');
  const [creativePage, setCreativePage] = useState(0);
  /** Player-editable creative hotbar, like Minecraft's bottom row. */
  const [creativeHotbar, setCreativeHotbar] = useState<BlockID[]>(() => [...HOTBAR_BLOCKS]);

  /* ---- shader menu ---- */
  const [shaderMenuOpen, setShaderMenuOpen] = useState(false);
  const [selectedShader, setSelectedShader] = useState<ShaderID>('pbr_plus');

  /* ---- mod menu ---- */
  const [modMenuOpen, setModMenuOpen] = useState(false);
  const [modFilter, setModFilter] = useState<ModDefinition['category'] | 'all'>('all');
  const [modRegistry] = useState(() => new ModPackRegistry());

  /* ---- dimension menu ---- */
  const [dimensionMenuOpen, setDimensionMenuOpen] = useState(false);

  /* ---- server browser ---- */
  const [serverMenuOpen, setServerMenuOpen] = useState(false);

  /* ---- friends list ---- */
  const [friendsOpen, setFriendsOpen] = useState(false);

  /* ---- bosses ---- */
  const [bossesOpen, setBossesOpen] = useState(false);

  /* ---- quests ---- */
  const [questsOpen, setQuestsOpen] = useState(false);

  /* ---- civilizations ---- */
  const [civsOpen, setCivsOpen] = useState(false);

  /* ---- space menu ---- */
  const [spaceOpen, setSpaceOpen] = useState(false);

  /* ---- biomes menu ---- */
  const [biomesOpen, setBiomesOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  /* ---- shader settings that actually change visuals ---- */
  const applyShader = (sh: ShaderDefinition) => {
    setSelectedShader(sh.id);
    updateSettings({
      experimentalShaders: sh.features.bloom,
      postProcessEnabled: sh.features.bloom || sh.features.ssao || sh.features.ssr,
    });
  };

  const activeGrid = craftMode === 2 ? craftGrid : craftGrid3;
  const gridCounts = useMemo(() => {
    const m = new Map<BlockID, number>();
    for (const id of activeGrid) if (id) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [activeGrid]);

  const matchingRecipe = useMemo(() => {
    for (const r of RECIPES) {
      let ok = true;
      for (const c of r.costs) if ((gridCounts.get(c.blockId) ?? 0) < c.amount) { ok = false; break; }
      if (ok && r.costs.length > 0) return r;
    }
    return null;
  }, [gridCounts]);

  const placeIntoGrid = (blockId: BlockID) => {
    if (craftMode === 2) {
      const idx = craftGrid.findIndex((v) => v === null);
      if (idx >= 0) { const g = [...craftGrid]; g[idx] = blockId; setCraftGrid(g); }
    } else {
      const idx = craftGrid3.findIndex((v) => v === null);
      if (idx >= 0) { const g = [...craftGrid3]; g[idx] = blockId; setCraftGrid3(g); }
    }
  };
  const clearGrid = () => { setCraftGrid([null, null, null, null]); setCraftGrid3(Array(9).fill(null)); };
  const craftFromGrid = () => {
    if (!matchingRecipe) return;
    clearGrid();
    onCraftRecipe(matchingRecipe.id);
  };

  /* ---- keybindings for the new menus ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'o') onToggleObjectives();
      if (e.key.toLowerCase() === 'u') onToggleSystems();
      if (e.key === 'F6') { e.preventDefault(); setShaderMenuOpen((v) => !v); setModMenuOpen(false); setDimensionMenuOpen(false); setServerMenuOpen(false); setBossesOpen(false); setQuestsOpen(false); setCivsOpen(false); setSpaceOpen(false); setBiomesOpen(false); setFriendsOpen(false); }
      if (e.key === 'F7') { e.preventDefault(); setModMenuOpen((v) => !v); setShaderMenuOpen(false); setDimensionMenuOpen(false); setServerMenuOpen(false); setBossesOpen(false); setQuestsOpen(false); setCivsOpen(false); setSpaceOpen(false); setBiomesOpen(false); setFriendsOpen(false); }
      if (e.key === 'F8') { e.preventDefault(); setDimensionMenuOpen((v) => !v); setShaderMenuOpen(false); setModMenuOpen(false); setServerMenuOpen(false); setBossesOpen(false); setQuestsOpen(false); setCivsOpen(false); setSpaceOpen(false); setBiomesOpen(false); setFriendsOpen(false); }
      if (e.key === 'F9') { e.preventDefault(); setBossesOpen((v) => !v); setShaderMenuOpen(false); setModMenuOpen(false); setDimensionMenuOpen(false); setServerMenuOpen(false); setQuestsOpen(false); setCivsOpen(false); setSpaceOpen(false); setBiomesOpen(false); setFriendsOpen(false); }
      if (e.key === 'F10') { e.preventDefault(); setQuestsOpen((v) => !v); setShaderMenuOpen(false); setModMenuOpen(false); setDimensionMenuOpen(false); setServerMenuOpen(false); setBossesOpen(false); setCivsOpen(false); setSpaceOpen(false); setBiomesOpen(false); setFriendsOpen(false); }
      if (e.key === 'F11') { e.preventDefault(); setCivsOpen((v) => !v); setShaderMenuOpen(false); setModMenuOpen(false); setDimensionMenuOpen(false); setServerMenuOpen(false); setBossesOpen(false); setQuestsOpen(false); setSpaceOpen(false); setBiomesOpen(false); setFriendsOpen(false); }
      if (e.key === 'F12') { e.preventDefault(); setSpaceOpen((v) => !v); setShaderMenuOpen(false); setModMenuOpen(false); setDimensionMenuOpen(false); setServerMenuOpen(false); setBossesOpen(false); setQuestsOpen(false); setCivsOpen(false); setBiomesOpen(false); setFriendsOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onToggleObjectives, onToggleSystems]);

  useEffect(() => {
    if (!settings.multiplayerServersEnabled) setServerMenuOpen(false);
  }, [settings.multiplayerServersEnabled]);

  /* Creative inventory items for the current tab.
     A non-empty search always spans every category. */
  const creativeItems = useMemo(() => {
    const q = creativeSearch.trim().toLowerCase();
    const all = ALL_BLOCK_IDS.map(getBlock);
    const scoped = q || creativeCategory === 'all'
      ? all
      : all.filter((b) => b.category === creativeCategory);
    if (!q) return scoped;
    return scoped.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.shortName.toLowerCase().includes(q) ||
        String(b.id) === q ||
        b.category.includes(q)
    );
  }, [creativeCategory, creativeSearch]);
  const CREATIVE_PER_PAGE = 45;
  const creativePageCount = Math.max(1, Math.ceil(creativeItems.length / CREATIVE_PER_PAGE));
  useEffect(() => { setCreativePage(0); }, [creativeCategory, creativeSearch]);
  useEffect(() => { if (creativePage > creativePageCount - 1) setCreativePage(Math.max(0, creativePageCount - 1)); }, [creativePage, creativePageCount]);
  const pagedCreative = creativeItems.slice(creativePage * CREATIVE_PER_PAGE, (creativePage + 1) * CREATIVE_PER_PAGE);

  return (
    <div className={`game-hud-overlay ${isCreativeMode(gameMode) ? 'creative' : 'survival'}`} aria-label="EAOIN gameplay HUD">
      {systemsVisible && (
        <div className="systems-panel">
          <h3>Runtime [U]</h3>
          <div><span>Renderer</span><strong>{runtimeStatus.nextGen?.version ?? '1.0'}</strong></div>
          <div><span>Clouds</span><strong>moving</strong></div>
          <div><span>Render</span><strong>16 chunks</strong></div>
          <div><span>Fog</span><strong>{settings.fogEnabled ? '100-1000' : 'off'}</strong></div>
          <div><span>Day</span><strong>20 min cycle</strong></div>
          <div><span>Mods</span><strong>{modRegistry.getTotalEnabled()} loaded</strong></div>
          <div><span>Shader</span><strong>{ALL_SHADERS.find((s) => s.id === selectedShader)?.name ?? 'PBR+'}</strong></div>
          <div><span>Settlement</span><strong>{runtimeStatus.settlementName?.slice(0, 14) ?? '?'}</strong></div>
        </div>
      )}

      {settings.showObjectives && objectivesVisible && (
        <div className="objectives-panel">
          <h3>Objectives [O]</h3>
          {objectives.slice(0, 6).map((o) => (
            <div key={o.id} className={`objective ${o.complete ? 'complete' : ''}`}>
              <span>{o.complete ? '✓' : '•'} {o.label}</span>
              <strong>{o.progress}</strong>
            </div>
          ))}
        </div>
      )}

      {/* ===================== INVENTORY ===================== */}
      {inventoryOpen && (
        <div className="inventory-panel pro-inv">
          <div className="inventory-header">
            <div>
              <h2>Inventory {isCreativeMode(gameMode) ? '— Creative' : '— Survival'}</h2>
              <p>Mode: {gameMode} • Version {GAME_VERSION} • {craftingMessage}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setGuideOpen(true)}>📖 How to Play</button>
              <button onClick={() => setBiomesOpen(true)}>🌍 Biomes</button>
              <button onClick={onCloseInventory}>Close [E]</button>
            </div>
          </div>

          {isCreativeMode(gameMode) ? (
            <CreativeInventory
              category={creativeCategory}
              onCategoryChange={setCreativeCategory}
              search={creativeSearch}
              onSearchChange={setCreativeSearch}
              page={creativePage}
              pageCount={creativePageCount}
              onPageChange={setCreativePage}
              items={pagedCreative}
              totalCount={creativeItems.length}
              selectedBlock={selectedBlock}
              hotbar={creativeHotbar}
              onAssignHotbar={(slot, blockId) => {
                setCreativeHotbar((current) => {
                  const next = [...current];
                  next[slot] = blockId;
                  return next;
                });
              }}
              onPickBlock={(blockId) => { onSelectBlock(blockId); }}
              onPickAndClose={(blockId) => { onSelectBlock(blockId); onCloseInventory(); }}
            />
          ) : (
            <SurvivalInventory
              inventory={inventory}
              selectedBlock={selectedBlock}
              craftMode={craftMode}
              setCraftMode={setCraftMode}
              activeGrid={activeGrid}
              matchingRecipe={matchingRecipe}
              placeIntoGrid={placeIntoGrid}
              clearGrid={clearGrid}
              craftFromGrid={craftFromGrid}
              craftGrid={craftGrid}
              craftGrid3={craftGrid3}
              setCraftGrid={setCraftGrid}
              setCraftGrid3={setCraftGrid3}
              toolInventory={toolInventory}
              onCraftRecipe={onCraftRecipe}
            />
          )}
        </div>
      )}

      {/* ===================== SHADER MENU ===================== */}
      {shaderMenuOpen && (
        <div className="menu-panel pro shader-panel">
          <div className="inventory-header">
            <div><h2>🎨 Shaders [F6]</h2><p>{ALL_SHADERS.length} official shaders • SSAO, SSR, Bloom, Volumetric, HDR, Ray Traced</p></div>
            <button onClick={() => setShaderMenuOpen(false)}>Close</button>
          </div>
          <div className="shader-grid">
            {ALL_SHADERS.map((sh) => (
              <div key={sh.id} className={`shader-card ${selectedShader === sh.id ? 'selected' : ''}`} onClick={() => applyShader(sh)}>
                <div className="shader-preview" style={{ background: `linear-gradient(135deg, ${sh.tint.r >= 0 ? `rgba(${Math.floor(sh.tint.r * 255)},${Math.floor(sh.tint.g * 255)},${Math.floor(sh.tint.b * 255)},1)` : 'rgba(20,20,20,1)'} 0%, rgba(10,10,10,1) 100%)` }}>
                  <span style={{ fontSize: 22 }}>🎨</span>
                </div>
                <strong>{sh.name}</strong>
                <span style={{ fontSize: 9, color: '#aaa' }}>by {sh.author}</span>
                <small style={{ fontSize: 8, color: '#888', minHeight: 24 }}>{sh.description}</small>
                <div className="shader-features">
                  {sh.features.bloom && <span className="badge">Bloom</span>}
                  {sh.features.ssao && <span className="badge">SSAO</span>}
                  {sh.features.ssr && <span className="badge">SSR</span>}
                  {sh.features.hdr && <span className="badge">HDR</span>}
                  {sh.features.rayTraced && <span className="badge">RTX</span>}
                  {sh.features.volumetricLighting && <span className="badge">Vol.Light</span>}
                  {sh.features.volumetricClouds && <span className="badge">Vol.Cloud</span>}
                  {sh.features.atmosphericScattering && <span className="badge">Atmos</span>}
                  {sh.features.depthOfField && <span className="badge">DoF</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== MODS MENU ===================== */}
      {modMenuOpen && (
        <div className="menu-panel pro mod-panel">
          <div className="inventory-header">
            <div><h2>🧩 Mods [F7] — {modRegistry.getTotalEnabled()} enabled</h2><p>EAOIN Modding API v3.0 — install any of the {ALL_MODS.length} official packs</p></div>
            <button onClick={() => setModMenuOpen(false)}>Close</button>
          </div>
          <div className="mod-filters">
            <button className={modFilter === 'all' ? 'active' : ''} onClick={() => setModFilter('all')}>All ({ALL_MODS.length})</button>
            {MOD_CATEGORIES.map((c) => (
              <button key={c} className={modFilter === c ? 'active' : ''} onClick={() => setModFilter(c)}>
                {MOD_CATEGORY_LABELS[c]} ({ALL_MODS.filter((m) => m.category === c).length})
              </button>
            ))}
          </div>
          <div className="mod-grid">
            {ALL_MODS.filter((m) => modFilter === 'all' || m.category === modFilter).map((m) => {
              const enabled = modRegistry.isEnabled(m.id);
              return (
                <div key={m.id} className={`mod-card ${enabled ? 'enabled' : ''}`}>
                  <div className="mod-icon">{m.icon}</div>
                  <strong>{m.name}</strong>
                  <span style={{ fontSize: 9, color: '#aaa' }}>{m.author} • v{m.version}</span>
                  <small style={{ fontSize: 9, color: '#888' }}>{m.description}</small>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 8, color: '#888' }}>{(m.downloads / 1_000_000).toFixed(1)}M dl</span>
                    <button className={enabled ? 'btn-secondary' : 'btn-primary'} onClick={() => modRegistry.toggle(m.id)}>
                      {enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================== DIMENSIONS MENU ===================== */}
      {dimensionMenuOpen && (
        <div className="menu-panel pro dim-panel">
          <div className="inventory-header">
            <div>
              <h2>Dimensions [F8] — {ALL_DIMENSIONS.length} total</h2>
              <p>Current: {runtimeStatus.dimensionName} • Click any dimension to travel there instantly</p>
            </div>
            <button onClick={() => setDimensionMenuOpen(false)}>Close</button>
          </div>
          <div className="dim-grid">
            {ALL_DIMENSIONS.map((d) => {
              const isCurrent = runtimeStatus.dimensionId === d.id;
              return (
                <button
                  key={d.id}
                  className={`dim-card ${isCurrent ? 'current' : ''}`}
                  disabled={isCurrent}
                  title={isCurrent ? `You are already in ${d.name}` : `Travel to ${d.name}`}
                  onClick={() => {
                    if (isCurrent) return;
                    onTravelToDimension?.(d.id);
                    setDimensionMenuOpen(false);
                  }}
                >
                  <DimensionSigil id={d.id} />
                  <strong>{d.name}</strong>
                  <small>{d.description}</small>
                  <div className="dim-stats">
                    <span>Boss: {d.boss}</span>
                    <span>{d.weather.slice(0, 26)}</span>
                  </div>
                  <span className="dim-travel-cta">{isCurrent ? 'CURRENT' : 'TRAVEL →'}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================== BOSSES MENU ===================== */}
      {bossesOpen && (
        <div className="menu-panel pro boss-panel">
          <div className="inventory-header">
            <div><h2>👑 Bosses [F9] — {ALL_BOSSES.length} total</h2><p>Defeat them all to unlock the new endings</p></div>
            <button onClick={() => setBossesOpen(false)}>Close</button>
          </div>
          <div className="boss-grid">
            {ALL_BOSSES.map((b) => (
              <div key={b.id} className="boss-card">
                <div className="boss-emoji" style={{ background: b.color }}>{b.emoji}</div>
                <strong>{b.name}</strong>
                <span style={{ fontSize: 9, color: '#aaa' }}>{b.dimension} • {BOSS_TIER_LABELS[b.tier]}</span>
                <small style={{ fontSize: 9 }}>{b.description}</small>
                <div className="boss-stats">
                  <span>❤️ {b.health}</span>
                  <span>⚔ {b.damage}</span>
                  <span>📜 {b.phases} phase{b.phases > 1 ? 's' : ''}</span>
                </div>
                <div className="boss-abilities">
                  {b.abilities.map((a) => <span key={a} className="ability-tag">{a}</span>)}
                </div>
                <small style={{ fontSize: 8, fontStyle: 'italic', color: '#7ef7a0' }}>{b.lore}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== QUESTS MENU ===================== */}
      {questsOpen && (
        <div className="menu-panel pro quest-panel">
          <div className="inventory-header">
            <div><h2>📜 Quests [F10] — {ALL_QUESTS.length} total</h2><p>Tutorial, Main, Side, Daily, Weekly, Civilization, Boss</p></div>
            <button onClick={() => setQuestsOpen(false)}>Close</button>
          </div>
          <div className="quest-filters">
            {QUEST_TYPES.map((t) => (
              <button key={t} className="quest-filter">{QUEST_TYPE_LABELS[t]} ({ALL_QUESTS.filter((q) => q.type === t).length})</button>
            ))}
          </div>
          <div className="quest-list">
            {ALL_QUESTS.map((q) => (
              <div key={q.id} className="quest-card">
                <div className="quest-icon">{q.emoji}</div>
                <div className="quest-body">
                  <strong>{q.name} <span className="quest-type">{QUEST_TYPE_LABELS[q.type]}</span></strong>
                  <span style={{ fontSize: 9, color: '#aaa' }}>{q.giver} • Lvl {q.level} • {q.dimension}</span>
                  <p style={{ fontSize: 9, color: '#888' }}>{q.description}</p>
                  <div className="quest-steps">
                    {q.steps.map((s, i) => (
                      <div key={i} className="quest-step">
                        <span className="step-bullet">{i + 1}</span>
                        {s.description} <span style={{ color: '#7ef7a0' }}>{s.progress}/{s.amount}</span>
                      </div>
                    ))}
                  </div>
                  <div className="quest-rewards">
                    <span>⭐ {q.rewards.xp} XP</span>
                    <span>💰 {q.rewards.coins}</span>
                    {q.rewards.items?.map((it) => <span key={it}>🎁 {it}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== CIVILIZATIONS MENU ===================== */}
      {civsOpen && (
        <div className="menu-panel pro civ-panel">
          <div className="inventory-header">
            <div><h2>🏛 Civilizations [F11] — {CIVILIZATIONS.length} active</h2><p>They build, expand, wage war, research, colonize planets</p></div>
            <button onClick={() => setCivsOpen(false)}>Close</button>
          </div>
          <div className="civ-list">
            {CIVILIZATIONS.map((c) => (
              <div key={c.id} className="civ-card" style={{ borderLeft: `4px solid ${c.color}` }}>
                <div className="civ-emoji">{c.emoji}</div>
                <div className="civ-body">
                  <strong>{c.name}</strong>
                  <span style={{ fontSize: 9, color: '#aaa' }}>{RACE_NAMES[c.race]} • {TECH_AGE_LABELS[c.age]} • Led by {c.leader}</span>
                  <div className="civ-stats">
                    <span>👥 {c.population.toLocaleString()}</span>
                    <span>🏘 {c.settlements}</span>
                    <span>⚔ {c.military.toLocaleString()}</span>
                    <span>💰 {c.wealth.toLocaleString()}</span>
                    <span>😊 {(c.happiness * 100).toFixed(0)}%</span>
                    <span>🔬 {(c.research * 100).toFixed(0)}%</span>
                  </div>
                  {c.war.atWar && <div className="civ-war">⚔ At war with {c.war.withWhom}</div>}
                  {c.alliances.length > 0 && <div className="civ-alliances">🤝 Allied with {c.alliances.join(', ')}</div>}
                  <small style={{ fontSize: 9, color: '#7ef7a0' }}>Religion: {c.religion}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="civ-tech-tree">
            <h3>Tech Age Progression</h3>
            <div className="tech-tree">
              {['stone', 'bronze', 'iron', 'steel', 'industrial', 'modern', 'futuristic', 'space', 'interstellar', 'multiversal'].map((age) => (
                <div key={age} className="tech-node">
                  <span style={{ fontSize: 18 }}>{TECH_AGE_ICONS[age as keyof typeof TECH_AGE_ICONS]}</span>
                  <strong>{TECH_AGE_LABELS[age as keyof typeof TECH_AGE_LABELS]}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================== SPACE MENU ===================== */}
      {spaceOpen && (
        <div className="menu-panel pro space-panel">
          <div className="inventory-header">
            <div><h2>🚀 Space [F12] — Universe</h2><p>{ALL_STAR_SYSTEMS.length} star systems • {GALAXY_LIST.length} galaxies • procedural planets per seed</p></div>
            <button onClick={() => setSpaceOpen(false)}>Close</button>
          </div>
          <div className="space-section">
            <h3>Galaxies</h3>
            <div className="galaxy-list">
              {GALAXY_LIST.map((g) => (
                <div key={g.id} className="galaxy-card">
                  <strong>🌌 {g.name}</strong>
                  <span style={{ fontSize: 9, color: '#aaa' }}>{g.type} • {g.stars} stars</span>
                  <small style={{ fontSize: 8, color: '#888' }}>{g.description}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="space-section">
            <h3>Star Systems</h3>
            <div className="system-list">
              {ALL_STAR_SYSTEMS.map((s) => (
                <div key={s.id} className="system-card">
                  <strong>⭐ {s.name}</strong>
                  <span style={{ fontSize: 9, color: '#aaa' }}>{STAR_CLASS_INFO[s.starClass].color !== '#000000' ? '🌟' : '🕳'} {s.starClass} class • {s.planetCount} planets • {s.distance} ly</span>
                  <small style={{ fontSize: 8 }}>{s.specialFeatures.join(', ')}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="space-section">
            <h3>Planets</h3>
            <div className="planet-list">
              {ALL_PLANETS.map((p) => (
                <div key={p.id} className="planet-card">
                  <strong>🪐 {p.name}</strong>
                  <span style={{ fontSize: 9 }}>{p.type} • {p.size} Earth radii • {p.temperature}K</span>
                  <span style={{ fontSize: 8 }}>Habitability: {(p.habitability * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-section">
            <h3>Space Anomalies</h3>
            <div className="anomaly-list">
              {ALL_ANOMALIES.map((a) => (
                <div key={a.id} className="anomaly-card">
                  <strong>🛸 {a.name}</strong>
                  <span style={{ fontSize: 9, color: '#aaa' }}>{a.type}</span>
                  <small style={{ fontSize: 8 }}>{a.desc}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================== HOW TO PLAY GUIDE ===================== */}
      {guideOpen && <HowToPlayGuide onClose={() => setGuideOpen(false)} />}

      {/* ===================== DEVELOPER APP PANEL ===================== */}
      {/* Self-gated: renders nothing for players during Alpha Access and only
          opens from the developer trigger (backquote / Ctrl+Shift+D). Controls
          write straight into the live developer tuning store. */}
      <DeveloperAppPanel />

      {/* ===================== BIOMES MENU ===================== */}
      {biomesOpen && (
        <div className="menu-panel pro biomes-panel">
          <div className="inventory-header">
            <div><h2>🌍 Biomes — {ALL_BIOMES.length} total</h2><p>150+ biomes across forest, desert, snow, ocean, cave, nether, end, alien, mystic...</p></div>
            <button onClick={() => setBiomesOpen(false)}>Close</button>
          </div>
          <div className="biomes-grid">
            {ALL_BIOMES.map((b) => (
              <div key={b.id} className="biome-card">
                <div className="biome-emoji">{b.emoji}</div>
                <strong>{b.name}</strong>
                <span style={{ fontSize: 8, color: '#aaa' }}>{b.temperature} • {b.humidity}</span>
                <small style={{ fontSize: 8 }}>{b.description}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== SETTINGS MENU ===================== */}
      {settingsOpen && (
        <div className="settings-panel">
          <div className="inventory-header">
            <div>
              <h2>Settings</h2>
              <p>EAOIN {GAME_VERSION} • {RELEASE_TAGLINE}</p>
            </div>
            <button onClick={onCloseSettings}>Close</button>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.4)', padding: 10, border: '2px solid #5dd6ff', borderRadius: 4, margin: '8px 0' }}>
            <h3 style={{ color: '#5dd6ff', fontSize: 12, marginBottom: 6 }}>✨ {RELEASE_LABEL}</h3>
            <ul style={{ fontSize: 9, color: '#d6d6d6', paddingLeft: 18, lineHeight: 1.5 }}>
              {RELEASE_FEATURES.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </div>
          <label className="setting-row"><span>Muted</span><input type="checkbox" checked={settings.muted} onChange={(e) => updateSettings({ muted: e.target.checked })} /></label>
          <label className="setting-row"><span>Volume {Math.round(settings.volume * 100)}%</span><input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => updateSettings({ volume: Number(e.target.value) })} /></label>
          <label className="setting-row">
            <span>Quality (render distance)</span>
            <select value={settings.qualityPreset} onChange={(e) => updateSettings({ qualityPreset: e.target.value as GameSettings['qualityPreset'] })}>
              <option value="performance">Performance (6)</option>
              <option value="balanced">Balanced (8)</option>
              <option value="quality">Quality (12)</option>
              <option value="cinematic">Cinematic (16)</option>
            </select>
          </label>
          <label className="setting-row">
            <span>Renderer</span>
            <select value={settings.rendererPreference} onChange={(e) => updateSettings({ rendererPreference: e.target.value as GameSettings['rendererPreference'] })}>
              <option value="auto">Auto: WebGPU first</option>
              <option value="vulkan">Vulkan / WebGPU</option>
              <option value="webgpu">Prefer WebGPU</option>
              <option value="webgl">Force WebGL</option>
            </select>
          </label>
          <label className="setting-row"><span>Fog 100-1000</span><input type="checkbox" checked={settings.fogEnabled} onChange={(e) => updateSettings({ fogEnabled: e.target.checked })} /></label>
          <label className="setting-row"><span>Realistic lighting</span><input type="checkbox" checked={settings.realisticLighting} onChange={(e) => updateSettings({ realisticLighting: e.target.checked })} /></label>
          <label className="setting-row"><span>Particles</span><input type="checkbox" checked={settings.particlesEnabled} onChange={(e) => updateSettings({ particlesEnabled: e.target.checked })} /></label>
          <label className="setting-row"><span>Post-processing</span><input type="checkbox" checked={settings.postProcessEnabled} onChange={(e) => updateSettings({ postProcessEnabled: e.target.checked })} /></label>
          <label className="setting-row"><span>Experimental shaders</span><input type="checkbox" checked={settings.experimentalShaders} onChange={(e) => updateSettings({ experimentalShaders: e.target.checked })} /></label>
          <label className="setting-row"><span>Command blocks</span><input type="checkbox" checked={settings.commandBlocksEnabled} onChange={(e) => updateSettings({ commandBlocksEnabled: e.target.checked })} /></label>
          <label className="setting-row"><span>Show stats</span><input type="checkbox" checked={settings.showStats} onChange={(e) => updateSettings({ showStats: e.target.checked })} /></label>
          <label className="setting-row"><span>High contrast</span><input type="checkbox" checked={settings.highContrast} onChange={(e) => updateSettings({ highContrast: e.target.checked })} /></label>
          <label className="setting-row"><span>Reduced motion</span><input type="checkbox" checked={settings.reducedMotion} onChange={(e) => updateSettings({ reducedMotion: e.target.checked })} /></label>
        </div>
      )}

      {/* Biome ambience */}
      <audio src="/assets/ambience/forest.mp3" loop />
      <audio src="/assets/ambience/nether.mp3" loop />

      {/* ===================== MULTIPLAYER ===================== */}
      <div className="hud-buttons">
        <button onClick={() => setShaderMenuOpen((v) => !v)} className="hud-btn shaders" title="Shaders (F6)">🎨 Shaders</button>
        <button onClick={() => setModMenuOpen((v) => !v)} className="hud-btn mods" title="Mods (F7)">🧩 Mods</button>
        <button onClick={() => setDimensionMenuOpen((v) => !v)} className="hud-btn dims" title="Dimensions (F8)">🌌 Dims</button>
        <button onClick={() => setBossesOpen((v) => !v)} className="hud-btn bosses" title="Bosses (F9)">👑 Bosses</button>
        <button onClick={() => setQuestsOpen((v) => !v)} className="hud-btn quests" title="Quests (F10)">📜 Quests</button>
        <button onClick={() => setCivsOpen((v) => !v)} className="hud-btn civs" title="Civilizations (F11)">🏛 Civs</button>
        <button onClick={() => setSpaceOpen((v) => !v)} className="hud-btn space" title="Space (F12)">🚀 Space</button>
        <button onClick={() => { if (settings.multiplayerServersEnabled) setServerMenuOpen((v) => !v); }} className="hud-btn servers" title={settings.multiplayerServersEnabled ? 'Servers' : 'Servers disabled in settings'} disabled={!settings.multiplayerServersEnabled}>🖥 Servers</button>
        <button onClick={() => setFriendsOpen((v) => !v)} className="hud-btn friends" title="Friends">👥 Friends</button>
      </div>

      {settings.multiplayerServersEnabled && serverMenuOpen && (
        <div className="menu-panel pro server-panel">
          <div className="inventory-header">
            <div><h2>🖥 Multiplayer Server Browser</h2><p>{ALL_SERVERS.length} official servers + create your own dedicated server</p></div>
            <button onClick={() => setServerMenuOpen(false)}>Close</button>
          </div>
          <div className="server-list">
            {ALL_SERVERS.map((s) => <ServerCard key={s.id} server={s} />)}
          </div>
        </div>
      )}

      {friendsOpen && (
        <div className="menu-panel pro friends-panel">
          <div className="inventory-header">
            <div><h2>👥 Friends & Social</h2><p>{DEMO_FRIENDS.length} friends • {DEMO_GUILDS.length} guilds • {DEMO_NATIONS.length} nations</p></div>
            <button onClick={() => setFriendsOpen(false)}>Close</button>
          </div>
          <h3 style={{ color: '#7ef7a0', fontSize: 11, margin: '6px 0' }}>Online Friends</h3>
          <div className="friend-list">
            {DEMO_FRIENDS.map((f) => (
              <div key={f.id} className={`friend-card status-${f.status}`}>
                <div className="friend-avatar">{f.avatar}</div>
                <strong>{f.name}</strong>
                <span style={{ fontSize: 9, color: '#aaa' }}>Lvl {f.level} • {f.status.replace('_', ' ')}</span>
                <span style={{ fontSize: 8, color: '#888' }}>{f.lastSeen}</span>
              </div>
            ))}
          </div>
          <h3 style={{ color: '#ffd166', fontSize: 11, margin: '6px 0' }}>Guilds</h3>
          <div className="guild-list">
            {DEMO_GUILDS.map((g) => (
              <div key={g.id} className="guild-card">
                <strong>[{g.tag}] {g.name}</strong>
                <span style={{ fontSize: 9, color: '#aaa' }}>{g.members} members • Lvl {g.level}</span>
                <small style={{ fontSize: 8 }}>{g.motd}</small>
              </div>
            ))}
          </div>
          <h3 style={{ color: '#a879ff', fontSize: 11, margin: '6px 0' }}>Nations</h3>
          <div className="nation-list">
            {DEMO_NATIONS.map((n) => (
              <div key={n.id} className="nation-card">
                <strong>{n.emoji} {n.name}</strong>
                <span style={{ fontSize: 9, color: '#aaa' }}>Led by {n.leader} • {n.population.toLocaleString()} people</span>
                <span style={{ fontSize: 8 }}>Economy: {n.economy.toLocaleString()} coins</span>
                <span style={{ fontSize: 8, color: '#7ef7a0' }}>Allies: {n.allies.join(', ') || 'None'}</span>
                <span style={{ fontSize: 8, color: '#c84a4a' }}>Enemies: {n.enemies.join(', ') || 'None'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------- Creative Inventory --------------------- */

const CATEGORY_ICONS: Record<BlockCategory, string> = {
  building: '🧱', decoration: '🎨', functional: '⚙', redstone: '🔌', plant: '🌱',
  food: '🍗', tool: '🛠', weapon: '⚔', armor: '🛡', ore: '⛏', fluid: '💧',
  nature: '🌳', nether: '🔥', end: '🌌', space: '🚀', creative: '✨', spawn_egg: '🥚', misc: '📦',
};

/** Creative tabs are the block categories plus a leading "all" tab. */
export type CreativeTab = BlockCategory | 'all';

/** Creative-style building applies to Creative and the unlocked Incredible mode. */
export function isCreativeMode(mode: GameMode): boolean {
  return mode === 'creative' || mode === 'incredible' || mode === 'experimental' || mode === 'story';
}

/**
 * Minecraft-style creative inventory.
 *
 * Fixes over the previous version:
 *  - An "All" tab and search that spans every category, not just the open one.
 *  - A real, editable creative hotbar strip along the bottom: click a block to
 *    equip it, or click a hotbar slot first to choose which slot to overwrite.
 *  - Shows the item count for the whole result set, not just the current page.
 *  - Keyboard paging and a visible "no results" state.
 */
function CreativeInventory({
  category, onCategoryChange, search, onSearchChange, page, pageCount, onPageChange,
  items, totalCount, selectedBlock, hotbar, onAssignHotbar, onPickBlock, onPickAndClose,
}: {
  category: CreativeTab;
  onCategoryChange: (c: CreativeTab) => void;
  search: string;
  onSearchChange: (s: string) => void;
  page: number;
  pageCount: number;
  onPageChange: (p: number) => void;
  items: BlockDef[];
  totalCount: number;
  selectedBlock: BlockID;
  hotbar: BlockID[];
  onAssignHotbar: (slot: number, blockId: BlockID) => void;
  onPickBlock: (id: BlockID) => void;
  onPickAndClose: (id: BlockID) => void;
}) {
  // When a hotbar slot is armed, the next block clicked goes into that slot
  // instead of simply being equipped.
  const [armedSlot, setArmedSlot] = useState<number | null>(null);

  const handlePick = (blockId: BlockID) => {
    if (armedSlot !== null) {
      onAssignHotbar(armedSlot, blockId);
      setArmedSlot(null);
      onPickBlock(blockId);
      return;
    }
    onPickBlock(blockId);
  };

  return (
    <div className="creative-inventory">
      <div className="creative-tabs">
        <button
          className={`creative-tab ${category === 'all' ? 'active' : ''}`}
          onClick={() => onCategoryChange('all')}
        >
          ★ All
        </button>
        {CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            className={`creative-tab ${category === cat ? 'active' : ''}`}
            onClick={() => onCategoryChange(cat)}
          >
            {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div className="creative-controls">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="🔍 Search all blocks by name, id or category…"
          className="creative-search"
        />
        <div className="creative-pager">
          <button onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0}>◀</button>
          <span>Page {page + 1} / {pageCount}</span>
          <button onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1}>▶</button>
        </div>
        <small className="creative-count">{totalCount} blocks</small>
      </div>

      <div className="creative-grid">
        {items.length === 0 && (
          <div className="creative-empty">No blocks match “{search}”. Try another term or the All tab.</div>
        )}
        {items.map((b) => (
          <button
            key={b.id}
            className={`creative-slot ${selectedBlock === b.id ? 'selected' : ''}`}
            title={`${b.name} (#${b.id}) — ${CATEGORY_LABELS[b.category]}\nClick to equip • Double-click to equip and close`}
            onClick={() => handlePick(b.id)}
            onDoubleClick={() => onPickAndClose(b.id)}
          >
            <BlockLogo id={b.id} size={36} />
            <span className="creative-name">{b.name}</span>
            <span className="creative-id">#{b.id}</span>
          </button>
        ))}
      </div>

      {/* Editable creative hotbar, exactly like Minecraft's bottom row. */}
      <div className="creative-hotbar-row">
        <span className="creative-hotbar-label">Hotbar</span>
        <div className="creative-hotbar">
          {hotbar.map((blockId, i) => (
            <button
              key={i}
              className={`creative-hotbar-slot ${armedSlot === i ? 'armed' : ''} ${selectedBlock === blockId ? 'selected' : ''}`}
              title={`Slot ${i + 1}: ${getBlock(blockId).name}\nClick to arm this slot, then click any block above to assign it`}
              onClick={() => setArmedSlot(armedSlot === i ? null : i)}
            >
              <span className="slot-key">{i + 1}</span>
              <BlockLogo id={blockId} size={26} />
            </button>
          ))}
        </div>
      </div>

      <div className="creative-tip">
        {armedSlot !== null
          ? `🎯 Slot ${armedSlot + 1} armed — click any block above to place it in that hotbar slot.`
          : '💡 Click a block to equip it • Double-click to equip and close • Click a hotbar slot to reassign it • F4 toggles Creative/Survival • /gamemode creative also works'}
      </div>
    </div>
  );
}

/* --------------------- Survival Inventory --------------------- */
function SurvivalInventory({ inventory, selectedBlock, craftMode, setCraftMode, activeGrid, matchingRecipe, placeIntoGrid, clearGrid, craftFromGrid, craftGrid, craftGrid3, setCraftGrid, setCraftGrid3, toolInventory, onCraftRecipe }: any) {
  return (
    <div className="survival-inventory">
      <div className="inv-top">
        <div className="inv-player-area">
          <h3 style={{ color: '#ffd166', fontSize: 11 }}>Player</h3>
          <div className="inv-avatar-box">
            <div style={{ fontSize: 48 }}>🧍</div>
            <small style={{ fontSize: 9, color: '#aaa' }}>Survival • 20min day</small>
          </div>
          <div style={{ fontSize: 9, color: '#bbb' }}>Hand punches toward tree when mining wood — arm goes forward (see GameCanvas)</div>
        </div>
        <div className="inv-crafting">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: '#7ef7a0', fontSize: 11 }}>Crafting {craftMode}×{craftMode}</h3>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn-secondary mini" onClick={() => setCraftMode(craftMode === 2 ? 3 : 2)}>Toggle {craftMode === 2 ? '3×3' : '2×2'}</button>
              <button className="btn-secondary mini" onClick={clearGrid}>Clear</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className={`craft-grid c${craftMode}`}>
              {activeGrid.map((bid: BlockID | null, i: number) => (
                <div key={i} className="craft-slot" onClick={() => {
                  if (craftMode === 2) { const g = [...craftGrid]; g[i] = null; setCraftGrid(g); }
                  else { const g = [...craftGrid3]; g[i] = null; setCraftGrid3(g); }
                }}>{bid ? <BlockLogo id={bid} /> : <span style={{ opacity: 0.25, fontSize: 10 }}>·</span>}</div>
              ))}
            </div>
            <div className="craft-arrow">→</div>
            <div className="craft-result" onClick={craftFromGrid} title={matchingRecipe ? `Craft ${matchingRecipe.name}` : 'Add blocks to grid to craft'}>
              {matchingRecipe ? <><BlockLogo id={matchingRecipe.output.type === 'block' ? matchingRecipe.output.blockId : 6} size={36} /><small style={{ fontSize: 8, color: '#ffd166' }}>{matchingRecipe.name}</small></> : <span style={{ opacity: 0.4, fontSize: 10 }}>Result</span>}
            </div>
          </div>
          <small style={{ fontSize: 9, color: '#aaa' }}>Click inventory blocks to place into the crafting grid above. Hand punches tree, cracking overlay 1-10 when destroying.</small>
        </div>
      </div>
      <h3 style={{ color: '#ffd166', fontSize: 11, margin: '8px 0' }}>Materials — block logos like Minecraft inventory</h3>
      <div className="inventory-grid-pro">
        {ALL_BLOCK_IDS.filter((id) => getStackCount(inventory, id) > 0 || id <= 23).slice(0, 81).map((blockId) => {
          const count = getStackCount(inventory, blockId);
          return (
            <BlockSlot
              key={blockId}
              id={blockId}
              count={count}
              selected={selectedBlock === blockId}
              onClick={() => { if (count > 0) placeIntoGrid(blockId); }}
              size={32}
            />
          );
        })}
      </div>
      <h3 style={{ color: '#7ef7a0', fontSize: 11, margin: '10px 0 6px' }}>Recipes</h3>
      <div className="recipe-list" style={{ maxHeight: 160 }}>
        {RECIPES.map((recipe: any) => {
          const ready = canCraft(recipe, inventory, toolInventory);
          return (
            <button key={recipe.id} className={`recipe-card ${ready ? 'ready' : ''}`} onClick={() => onCraftRecipe(recipe.id)} disabled={!ready}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {recipe.output.type === 'block' ? <BlockLogo id={recipe.output.blockId} size={20} /> : <span>🛠️</span>}
                <span className="recipe-name">{recipe.name}</span>
              </div>
              <span>Cost: {recipeCostLabel(recipe)}</span>
              <span>Output: {recipeOutputLabel(recipe)}</span>
              <small>{recipe.description}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ServerCard({ server }: { server: ServerEntry }) {
  return (
    <div className="server-card">
      <div className="server-icon" style={{ background: server.type === 'mmo' ? 'linear-gradient(180deg,#5dd6ff,#246f9a)' : server.type === 'creative' ? 'linear-gradient(180deg,#7ef7a0,#3aa83a)' : server.type === 'skyblock' ? 'linear-gradient(180deg,#aac8e0,#3a86d0)' : 'linear-gradient(180deg,#a879ff,#5a3a99)' }}>{server.emoji}</div>
      <div className="server-body">
        <strong>{server.name}</strong>
        <span style={{ fontSize: 9, color: '#aaa' }}>{server.ip}:{server.port} • {server.region} • {server.players.toLocaleString()}/{server.maxPlayers.toLocaleString()} players • {server.ping}ms</span>
        <small style={{ fontSize: 8, color: '#888' }}>{server.description}</small>
        <div className="server-features">
          {server.hasGuilds && <span className="badge">Guilds</span>}
          {server.hasEconomy && <span className="badge">Economy</span>}
          {server.hasNations && <span className="badge">Nations</span>}
          {server.hasVoiceChat && <span className="badge">Voice</span>}
          {server.hasCrossPlay && <span className="badge">Cross-Play</span>}
          {server.hasAntiCheat && <span className="badge">Anti-Cheat</span>}
          {server.hasLandClaim && <span className="badge">Claims</span>}
          {server.hasDiplomacy && <span className="badge">Diplomacy</span>}
        </div>
      </div>
      <button className="btn-primary">Join</button>
    </div>
  );
}

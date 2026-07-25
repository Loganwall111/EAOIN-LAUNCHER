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
  gameMode: GameMode;
  selectedBlock: BlockID;
  selectedTool: ToolID;
  toolInventory: ToolInventory;
  inventory: InventoryStacks;
  survivalStats: SurvivalStats;
  inventoryOpen: boolean;
  settingsOpen: boolean;
  settings: GameSettings;
  runtimeStatus: RuntimeStatus;
  objectives: ObjectiveStatus[];
  craftingMessage: string;
  onCraftRecipe: (recipe: RecipeID) => void;
  onCloseInventory: () => void;
  onCloseSettings: () => void;
  onSettingsChange: (settings: GameSettings) => void;
  onResetPlayerProgress: () => void;
}

const INVENTORY_BLOCKS: BlockID[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

export default function HUD({
  gameMode,
  selectedBlock,
  selectedTool,
  toolInventory,
  inventory,
  survivalStats,
  inventoryOpen,
  settingsOpen,
  settings,
  runtimeStatus,
  objectives,
  craftingMessage,
  onCraftRecipe,
  onCloseInventory,
  onCloseSettings,
  onSettingsChange,
  onResetPlayerProgress,
}: HUDProps) {
  const updateSettings = (patch: Partial<GameSettings>): void => {
    onSettingsChange(clampSettings({ ...settings, ...patch }));
  };

  return (
    <div className="game-hud-overlay">
      <div className="survival-panel">
        <div className="stat-row"><span>Mode</span><strong>{gameMode}</strong></div>
        <div className="stat-row"><span>Health</span><meter min="0" max="100" value={survivalStats.health} /></div>
        <div className="stat-row"><span>Food</span><meter min="0" max="100" value={survivalStats.food} /></div>
        <div className="stat-row"><span>Stamina</span><meter min="0" max="100" value={survivalStats.stamina} /></div>
      </div>

      <div className="systems-panel">
        <h3>Runtime Systems</h3>
        <div><span>3.0</span><strong>{runtimeStatus.nextGen.version}</strong></div>
        <div><span>Vulkan</span><strong>{runtimeStatus.nextGen.vulkanOfficial ? 'official' : 'off'}</strong></div>
        <div><span>Shaders</span><strong>{runtimeStatus.nextGen.shadersOfficial ? 'official' : 'off'}</strong></div>
        <div><span>Commands</span><strong>{runtimeStatus.nextGen.commandsOfficial ? 'official' : 'off'}</strong></div>
        <div><span>Dimension</span><strong>{runtimeStatus.dimensionName}</strong></div>
        <div><span>Signal</span><strong>{runtimeStatus.redstoneActive ? 'ON' : 'OFF'}</strong></div>
        <div><span>Placed Logic</span><strong>W{runtimeStatus.placedLogicWires} / L{runtimeStatus.placedSignalLamps}</strong></div>
        <div><span>Powered Lamps</span><strong>{runtimeStatus.poweredSignalLamps}</strong></div>
        <div><span>Portal Core</span><strong>{runtimeStatus.nearbyPortalCore ? 'nearby' : 'none'}</strong></div>
        <div><span>Doors</span><strong>{runtimeStatus.doors} / Dim {runtimeStatus.dimensionalDoors}</strong></div>
        <div><span>Rocket</span><strong>{runtimeStatus.rocketReady ? 'ready' : 'refuel'}</strong></div>
        <div><span>Moon Visits</span><strong>{runtimeStatus.moonVisits}</strong></div>
        <div><span>Planets</span><strong>{runtimeStatus.nextGen.planets}</strong></div>
        <div><span>Megacity</span><strong>{runtimeStatus.nextGen.cityLengthKm}km</strong></div>
        <div><span>City Pop</span><strong>{runtimeStatus.nextGen.cityEconomy.population.toLocaleString()}</strong></div>
        <div><span>City Jobs</span><strong>{runtimeStatus.nextGen.cityEconomy.activeJobs.toLocaleString()}</strong></div>
        <div><span>Market</span><strong>{runtimeStatus.nextGen.marketplace.publishedPacks}/{runtimeStatus.nextGen.marketplace.packs}</strong></div>
        <div><span>Physics</span><strong>W{runtimeStatus.nextGen.advancedPhysics.waveHeight} C{runtimeStatus.nextGen.advancedPhysics.clothEnergy}</strong></div>
        <div><span>Pirates</span><strong>{runtimeStatus.nextGen.pirates}</strong></div>
        <div><span>Dragon</span><strong>{runtimeStatus.nextGen.dragonHealth}</strong></div>
        <div><span>Tentacle</span><strong>{runtimeStatus.nextGen.tentacleHealth}</strong></div>
        <div><span>God Mode</span><strong>{runtimeStatus.nextGen.godModeActive ? 'ON' : 'OFF'}</strong></div>
        <div><span>McDonald's</span><strong>{runtimeStatus.nextGen.rareMcdonaldsWorld ? 'rare seed' : 'none'}</strong></div>
        <div><span>Settlement</span><strong>{runtimeStatus.settlementName}</strong></div>
        <div><span>Villagers</span><strong>{runtimeStatus.villagers}</strong></div>
        <div><span>Prosperity</span><strong>{runtimeStatus.settlementProsperity}/10</strong></div>
        <div><span>Task</span><strong>{runtimeStatus.settlementTask}</strong></div>
        <div><span>Job</span><strong>{runtimeStatus.settlementJobProgress}%</strong></div>
        <div><span>Stock</span><strong>W{runtimeStatus.settlementWood} / S{runtimeStatus.settlementStone}</strong></div>
        <div><span>Trades</span><strong>{runtimeStatus.tradesCompleted}</strong></div>
        <div><span>Authority</span><strong>{runtimeStatus.syncState} {runtimeStatus.syncQuality}%</strong></div>
        <div><span>Ping/Jitter</span><strong>{runtimeStatus.networkPing}/{runtimeStatus.networkJitter}ms</strong></div>
        <div><span>Remote</span><strong>{runtimeStatus.remotePlayers} peers</strong></div>
        <div><span>Packets</span><strong>↑{runtimeStatus.outboundPackets} ↓{runtimeStatus.inboundPackets}</strong></div>
        <div><span>Loss</span><strong>{runtimeStatus.packetLoss}%</strong></div>
        <div><span>Snapshots</span><strong>{runtimeStatus.snapshotBuffer}</strong></div>
        <div><span>Rollback</span><strong>{runtimeStatus.rollbackEvents}</strong></div>
        <div><span>Client</span><strong>{runtimeStatus.networkClientId}</strong></div>
        <div><span>Actions</span><strong>{runtimeStatus.localActions}</strong></div>
        <div><span>Mods</span><strong>{runtimeStatus.loadedMods} / {runtimeStatus.texturePack}</strong></div>
        <div><span>API</span><strong>{runtimeStatus.moddingApiVersion}</strong></div>
      </div>

      {settings.showObjectives && (
        <div className="objectives-panel">
          <h3>Objectives</h3>
          {objectives.map((objective) => (
            <div key={objective.id} className={`objective ${objective.complete ? 'complete' : ''}`}>
              <span>{objective.complete ? '✓' : '•'} {objective.label}</span>
              <strong>{objective.progress}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="toolbelt">
        {TOOLBELT.map((toolId, index) => {
          const unlocked = isToolUnlocked(toolInventory, toolId);
          return (
            <div key={toolId} className={`tool-slot ${selectedTool === toolId ? 'selected' : ''} ${unlocked ? '' : 'locked'}`}>
              <span className="slot-key">{index === 0 ? 'T' : `T+${index}`}</span>
              <span className="item-label">{unlocked ? getTool(toolId).name : 'Locked'}</span>
            </div>
          );
        })}
      </div>

      <div className="hotbar">
        {HOTBAR_BLOCKS.map((blockId, index) => {
          const count = getStackCount(inventory, blockId);
          return (
            <div key={blockId} className={`slot ${selectedBlock === blockId ? 'selected' : ''} ${count === 0 ? 'empty' : ''}`}>
              <span className="slot-key">{index + 1}</span>
              <span className="item-label">{getBlock(blockId).name}</span>
              <span className="stack-count">×{count}</span>
            </div>
          );
        })}
      </div>

      {inventoryOpen && (
        <div className="inventory-panel">
          <div className="inventory-header">
            <div>
              <h2>Inventory & Crafting</h2>
              <p>{craftingMessage}</p>
            </div>
            <button onClick={onCloseInventory}>Close</button>
          </div>

          <div className="inventory-layout">
            <section>
              <h3>Materials</h3>
              <div className="inventory-grid">
                {INVENTORY_BLOCKS.map((blockId) => (
                  <div key={blockId} className="inventory-item">
                    <span>{getBlock(blockId).name}</span>
                    <strong>×{getStackCount(inventory, blockId)}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3>Crafting Recipes</h3>
              <div className="recipe-list">
                {RECIPES.map((recipe) => {
                  const ready = canCraft(recipe, inventory, toolInventory);
                  return (
                    <button
                      key={recipe.id}
                      className={`recipe-card ${ready ? 'ready' : ''}`}
                      onClick={() => onCraftRecipe(recipe.id)}
                      disabled={!ready}
                    >
                      <span className="recipe-name">{recipe.name}</span>
                      <span>Cost: {recipeCostLabel(recipe)}</span>
                      <span>Output: {recipeOutputLabel(recipe)}</span>
                      <small>{recipe.description}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="inventory-footer">
            <span>Keys: I/E toggle panel • 1–9 select blocks • T cycles unlocked tools</span>
            <button className="danger-lite" onClick={onResetPlayerProgress}>Reset Player Progress</button>
          </div>
        </div>
      )}

      {runtimeStatus.nextGen.creditsActive && (
        <div className="credits-cinematic">
          <div className="credits-stars" />
          <div className="credits-card">
            <p>After years and years of playing...</p>
            <p>you are finally here.</p>
            <h1>THE END</h1>
            <span>EAOIN {runtimeStatus.nextGen.version}</span>
            <small>Press K to skip and return to your world.</small>
          </div>
          <div className="credits-roll">
            <p>Directed by the worlds you built</p>
            <p>Powered by BabylonJS, WebGPU, and Native Vulkan foundations</p>
            <p>Voxel worlds, cities, planets, rifts, and every impossible door</p>
            <p>Thank you for playing EAOIN</p>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="settings-panel">
          <div className="inventory-header">
            <div>
              <h2>Settings</h2>
              <p>Audio, debug display, objectives, and movement tuning.</p>
            </div>
            <button onClick={onCloseSettings}>Close</button>
          </div>

          <label className="setting-row">
            <span>Muted</span>
            <input type="checkbox" checked={settings.muted} onChange={(event) => updateSettings({ muted: event.target.checked })} />
          </label>
          <label className="setting-row">
            <span>Volume {Math.round(settings.volume * 100)}%</span>
            <input type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={(event) => updateSettings({ volume: Number(event.target.value) })} />
          </label>
          <label className="setting-row">
            <span>Renderer backend</span>
            <select value={settings.rendererPreference} onChange={(event) => updateSettings({ rendererPreference: event.target.value as GameSettings['rendererPreference'] })}>
              <option value="auto">Auto: WebGPU first</option>
              <option value="webgpu">Prefer WebGPU</option>
              <option value="webgl">Force WebGL</option>
            </select>
          </label>
          <label className="setting-row">
            <span>Quality preset</span>
            <select value={settings.qualityPreset} onChange={(event) => updateSettings({ qualityPreset: event.target.value as GameSettings['qualityPreset'] })}>
              <option value="performance">Performance</option>
              <option value="balanced">Balanced</option>
              <option value="quality">Quality</option>
              <option value="cinematic">Cinematic</option>
            </select>
          </label>
          <label className="setting-row">
            <span>Render scale {Math.round(settings.renderScale * 100)}%</span>
            <input type="range" min="0.5" max="1.5" step="0.05" value={settings.renderScale} onChange={(event) => updateSettings({ renderScale: Number(event.target.value) })} />
          </label>
          <label className="setting-row">
            <span>Camera speed {settings.cameraSpeed.toFixed(2)}</span>
            <input type="range" min="0.12" max="1.1" step="0.02" value={settings.cameraSpeed} onChange={(event) => updateSettings({ cameraSpeed: Number(event.target.value) })} />
          </label>
          <label className="setting-row">
            <span>Vulkan mode (official)</span>
            <input type="checkbox" checked={settings.experimentalVulkanMode} onChange={(event) => updateSettings({ experimentalVulkanMode: event.target.checked, rendererPreference: event.target.checked ? 'webgpu' : settings.rendererPreference, realisticLighting: event.target.checked ? true : settings.realisticLighting })} />
          </label>
          <label className="setting-row">
            <span>Realistic overworld lighting</span>
            <input type="checkbox" checked={settings.realisticLighting} onChange={(event) => updateSettings({ realisticLighting: event.target.checked })} />
          </label>
          <label className="setting-row">
            <span>Particles</span>
            <input type="checkbox" checked={settings.particlesEnabled} onChange={(event) => updateSettings({ particlesEnabled: event.target.checked })} />
          </label>
          <label className="setting-row">
            <span>Texture pack</span>
            <select value={settings.texturePack} onChange={(event) => updateSettings({ texturePack: event.target.value as GameSettings['texturePack'] })}>
              <option value="classic">Classic</option>
              <option value="soft">Soft</option>
              <option value="vibrant">Vibrant</option>
              <option value="noir">Noir</option>
            </select>
          </label>
          <label className="setting-row">
            <span>Fog enabled</span>
            <input type="checkbox" checked={settings.fogEnabled} onChange={(event) => updateSettings({ fogEnabled: event.target.checked })} />
          </label>
          <label className="setting-row">
            <span>Experimental shaders</span>
            <input type="checkbox" checked={settings.experimentalShaders} onChange={(event) => updateSettings({ experimentalShaders: event.target.checked, postProcessEnabled: event.target.checked })} />
          </label>
          <label className="setting-row">
            <span>Post effects foundation</span>
            <input type="checkbox" checked={settings.postProcessEnabled} onChange={(event) => updateSettings({ postProcessEnabled: event.target.checked })} />
          </label>
          <label className="setting-row">
            <span>Command blocks</span>
            <input type="checkbox" checked={settings.commandBlocksEnabled} onChange={(event) => updateSettings({ commandBlocksEnabled: event.target.checked })} />
          </label>
          <label className="setting-row">
            <span>Multiplayer servers</span>
            <input type="checkbox" checked={settings.multiplayerServersEnabled} onChange={(event) => updateSettings({ multiplayerServersEnabled: event.target.checked })} />
          </label>
          <label className="setting-row">
            <span>Show render stats</span>
            <input type="checkbox" checked={settings.showStats} onChange={(event) => updateSettings({ showStats: event.target.checked })} />
          </label>
          <label className="setting-row">
            <span>Show objectives</span>
            <input type="checkbox" checked={settings.showObjectives} onChange={(event) => updateSettings({ showObjectives: event.target.checked })} />
          </label>
          <label className="setting-row">
            <span>High contrast HUD</span>
            <input type="checkbox" checked={settings.highContrast} onChange={(event) => updateSettings({ highContrast: event.target.checked })} />
          </label>
          <label className="setting-row">
            <span>Reduced motion</span>
            <input type="checkbox" checked={settings.reducedMotion} onChange={(event) => updateSettings({ reducedMotion: event.target.checked })} />
          </label>
        </div>
      )}

      <div className="status-bar">
        <span>Hold left: mine / hit creatures</span>
        <span>P dimension • G door • R rocket • N boss • C credits • H god</span>
        <span>/ commands • I/E inventory • O settings • Esc pause</span>
      </div>
    </div>
  );
}

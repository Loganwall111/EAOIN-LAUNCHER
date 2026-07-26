import { useState, useCallback, useEffect, useMemo } from 'react';
import { BlockID } from '@shared/blocks/BlockRegistry';
import { craftRecipe, RECIPES, RecipeID } from './crafting/RecipeBook';
import MainMenu from './ui/MainMenu';
import TitleScreen from './ui/TitleScreen';
import CharacterCreator from './ui/CharacterCreator';
import HudFrame from './ui/HudFrame';
import { CharacterAppearance, DEFAULT_APPEARANCE } from './ui/theme';
import GameCanvas, { HudTelemetry } from './engine/GameCanvas';
import { GameMode } from './modes/GameMode';
import HUD from './ui/HUD';
import { buildObjectives, createGameplayCounters, GameplayCounterKey, GameplayCounters } from './objectives/ObjectiveTracker';
import { createDefaultRuntimeStatus, RuntimeStatus } from './runtime/RuntimeStatus';
import { createStarterInventory, InventoryStacks } from './player/InventoryState';
import { PlayerSaveManager } from './player/PlayerSave';
import { createStarterSurvivalStats, SurvivalStats } from './player/SurvivalState';
import { createStarterToolInventory, isToolUnlocked, ToolID, ToolInventory } from './player/ToolState';
import { GameSettings } from './settings/GameSettings';
import { loadSettings, saveSettings } from './settings/SettingsSave';

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [worldSeed, setWorldSeed] = useState('eaoin_seed_2026');
  const [gameMode, setGameMode] = useState<GameMode>('survival');
  const [selectedBlock, setSelectedBlock] = useState<BlockID>(1);
  const [selectedTool, setSelectedTool] = useState<ToolID>('hand');
  const [toolInventory, setToolInventory] = useState<ToolInventory>(() => createStarterToolInventory());
  const [inventory, setInventory] = useState<InventoryStacks>(() => createStarterInventory());
  const [survivalStats, setSurvivalStats] = useState<SurvivalStats>(() => createStarterSurvivalStats());
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [craftingMessage, setCraftingMessage] = useState('Crafting ready');
  const [gameplayCounters, setGameplayCounters] = useState<GameplayCounters>(() => createGameplayCounters());
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>(() => createDefaultRuntimeStatus());
  const [objectivesVisible, setObjectivesVisible] = useState(true);
  const [systemsVisible, setSystemsVisible] = useState(false);

  /* ---- concept-art shell: title screen -> (creator) -> world ---- */
  type Screen = 'title' | 'creator' | 'worlds';
  const [screen, setScreen] = useState<Screen>('title');
  const [appearance, setAppearance] = useState<CharacterAppearance>(() => {
    try {
      const raw = localStorage.getItem('eaoin_appearance');
      if (raw) return { ...DEFAULT_APPEARANCE, ...(JSON.parse(raw) as Partial<CharacterAppearance>) };
    } catch { /* first run */ }
    return DEFAULT_APPEARANCE;
  });
  const [telemetry, setTelemetry] = useState<HudTelemetry>({
    position: { x: 0, y: 0, z: 0 }, yaw: 0, timeOfDay: 12, day: 1, biome: 'Meadows',
  });

  useEffect(() => {
    try { localStorage.setItem('eaoin_appearance', JSON.stringify(appearance)); } catch { /* storage disabled */ }
  }, [appearance]);

  const objectives = useMemo(
    () => buildObjectives(inventory, toolInventory, gameplayCounters, runtimeStatus),
    [gameplayCounters, inventory, runtimeStatus, toolInventory]
  );

  const startGame = useCallback((seed?: string, mode: GameMode = 'survival') => {
    const nextSeed = seed || worldSeed;
    if (seed) setWorldSeed(seed);
    setGameMode(mode);
    if (mode === 'experimental') {
      setSettings((current) => ({ ...current, experimentalVulkanMode: true, rendererPreference: 'webgpu', commandBlocksEnabled: true, experimentalShaders: true, particlesEnabled: true }));
    }

    const saved = new PlayerSaveManager(nextSeed).load();
    setSelectedTool(saved?.selectedTool ?? 'hand');
    setToolInventory(saved?.tools ?? createStarterToolInventory());
    setInventory({ ...createStarterInventory(), ...(saved?.inventory ?? {}) });
    setSurvivalStats(saved?.survivalStats ?? createStarterSurvivalStats());
    setInventoryOpen(false);
    setSettingsOpen(false);
    setGameplayCounters(createGameplayCounters());
    setRuntimeStatus(createDefaultRuntimeStatus());
    setCraftingMessage(saved ? 'Loaded saved player progress' : 'New player inventory ready');
    setGameStarted(true);
  }, [worldSeed]);

  const exitToMenu = useCallback(() => {
    setInventoryOpen(false);
    setSettingsOpen(false);
    setGameStarted(false);
    setScreen('title');
  }, []);

  const markInventoryOpened = useCallback(() => {
    setGameplayCounters((counters) => ({ ...counters, inventoryOpened: true }));
  }, []);

  const toggleInventory = useCallback(() => {
    markInventoryOpened();
    setInventoryOpen((open) => !open);
  }, [markInventoryOpened]);

  const toggleSettings = useCallback(() => {
    setSettingsOpen((open) => !open);
  }, []);

  const closeInventory = useCallback(() => {
    setInventoryOpen(false);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const recordGameplayEvent = useCallback((event: GameplayCounterKey, amount = 1) => {
    setGameplayCounters((counters) => ({ ...counters, [event]: counters[event] + amount }));
  }, []);

  const craft = useCallback((recipeId: RecipeID) => {
    const recipe = RECIPES.find((entry) => entry.id === recipeId);
    if (!recipe) {
      setCraftingMessage('Unknown recipe');
      return;
    }

    const result = craftRecipe(recipe, { inventory, tools: toolInventory });
    setCraftingMessage(result.message);
    if (!result.ok) return;

    setInventory(result.inventory);
    setToolInventory(result.tools);
    recordGameplayEvent('craftedItems');
    if (recipe.output.type === 'tool') setSelectedTool(recipe.output.toolId);
  }, [inventory, recordGameplayEvent, toolInventory]);

  const resetPlayerProgress = useCallback(() => {
    PlayerSaveManager.clearSeed(worldSeed);
    setSelectedTool('hand');
    setToolInventory(createStarterToolInventory());
    setInventory(createStarterInventory());
    setSurvivalStats(createStarterSurvivalStats());
    setGameplayCounters(createGameplayCounters());
    setRuntimeStatus(createDefaultRuntimeStatus());
    setCraftingMessage('Player progress reset');
  }, [worldSeed]);

  // expose for debugging / window access
  void resetPlayerProgress;

  useEffect(() => {
    if (!gameStarted) return;
    if (!isToolUnlocked(toolInventory, selectedTool)) setSelectedTool('hand');
    new PlayerSaveManager(worldSeed).save({
      inventory,
      tools: toolInventory,
      survivalStats,
      selectedTool: isToolUnlocked(toolInventory, selectedTool) ? selectedTool : 'hand',
    });
  }, [gameStarted, inventory, selectedTool, survivalStats, toolInventory, worldSeed]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const shellClass = `eaoin-app ${settings.highContrast ? 'high-contrast' : ''} ${settings.reducedMotion ? 'reduced-motion' : ''}`;

  if (!gameStarted) {
    if (screen === 'title') {
      return (
        <div className={shellClass}>
          <TitleScreen
            appearance={appearance}
            onSingleplayer={() => setScreen('worlds')}
            onMultiplayer={() => setScreen('worlds')}
            onMods={() => setScreen('worlds')}
            onOptions={() => setScreen('worlds')}
            onQuit={() => window.close()}
            onEditCharacter={() => setScreen('creator')}
            onOpenNews={() => setScreen('worlds')}
            onOpenGuide={() => setScreen('worlds')}
            onOpenStats={() => setScreen('worlds')}
            onOpenFriends={() => setScreen('worlds')}
          />
        </div>
      );
    }
    if (screen === 'creator') {
      return (
        <div className={shellClass}>
          <CharacterCreator
            appearance={appearance}
            onChange={setAppearance}
            onConfirm={() => setScreen('title')}
            onCancel={() => setScreen('title')}
          />
        </div>
      );
    }
  }

  return (
    <div className={shellClass}>
      {!gameStarted ? (
        <>
          <button
            className="back-to-title"
            onClick={() => setScreen('title')}
          >
            ← Title Screen
          </button>
          <MainMenu onStart={startGame} currentSeed={worldSeed} />
        </>
      ) : (
        <>
          <GameCanvas
            seed={worldSeed}
            gameMode={gameMode}
            onExit={exitToMenu}
            selectedBlock={selectedBlock}
            onSelectedBlockChange={setSelectedBlock}
            selectedTool={selectedTool}
            onSelectedToolChange={setSelectedTool}
            toolInventory={toolInventory}
            inventory={inventory}
            onInventoryChange={setInventory}
            survivalStats={survivalStats}
            onSurvivalStatsChange={setSurvivalStats}
            settings={settings}
            onSettingsChange={setSettings}
            onToggleInventory={toggleInventory}
            onToggleSettings={toggleSettings}
            onGameplayEvent={recordGameplayEvent}
            onRuntimeStatusChange={setRuntimeStatus}
            onTelemetry={setTelemetry}
          />
          <HudFrame
            appearance={appearance}
            survivalStats={survivalStats}
            inventory={inventory}
            selectedBlock={selectedBlock}
            selectedTool={selectedTool}
            onSelectBlock={setSelectedBlock}
            position={telemetry.position}
            yaw={telemetry.yaw}
            timeOfDay={telemetry.timeOfDay}
            day={telemetry.day}
            biome={telemetry.biome}
            runtimeStatus={runtimeStatus}
            objectives={objectives}
            onOpenInventory={toggleInventory}
            onOpenGuide={toggleInventory}
            onOpenFriends={toggleSettings}
            onOpenSettings={toggleSettings}
            onOpenQuests={() => setObjectivesVisible((v) => !v)}
          />
          <HUD
            gameMode={gameMode}
            selectedBlock={selectedBlock}
            selectedTool={selectedTool}
            toolInventory={toolInventory}
            inventory={inventory}
            survivalStats={survivalStats}
            inventoryOpen={inventoryOpen}
            settingsOpen={settingsOpen}
            settings={settings}
            runtimeStatus={runtimeStatus}
            objectives={objectives}
            objectivesVisible={objectivesVisible}
            systemsVisible={systemsVisible}
            onToggleObjectives={() => setObjectivesVisible((value) => !value)}
            onToggleSystems={() => setSystemsVisible((value) => !value)}
            craftingMessage={craftingMessage}
            onCraftRecipe={craft}
            onCloseInventory={closeInventory}
            onCloseSettings={closeSettings}
            onSettingsChange={setSettings}
          />
        </>
      )}
    </div>
  );
}

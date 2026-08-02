import { Suspense, lazy, useState, useCallback, useEffect, useMemo } from 'react';
import { BlockID } from '@shared/blocks/BlockRegistry';
import { craftRecipe, RECIPES, RecipeID } from './crafting/RecipeBook';
import MainMenu from './ui/MainMenu';
import TitleScreen from './ui/TitleScreen';
import HowToPlayGuide from './ui/HowToPlayGuide';
import CharacterCreator from './ui/CharacterCreator';
import MultiplayerScreen from './ui/MultiplayerScreen';
import HorizonOS from './ui/HorizonOS';
import ModsScreen from './ui/ModsScreen';
import OptionsScreen from './ui/OptionsScreen';
import { ModPackRegistry } from './modding/ModPackRegistry';
import { CharacterAppearance, DEFAULT_APPEARANCE } from './ui/theme';
import type { HudTelemetry, WorldLoadProgress } from './engine/GameCanvas';
import { GameMode } from './modes/GameMode';
import { buildObjectives, createGameplayCounters, GameplayCounterKey, GameplayCounters } from './objectives/ObjectiveTracker';
import { createDefaultRuntimeStatus, RuntimeStatus } from './runtime/RuntimeStatus';
import { addToInventory, createStarterInventory, InventoryStacks } from './player/InventoryState';
import { PlayerSaveManager } from './player/PlayerSave';
import { createStarterSurvivalStats, SurvivalStats } from './player/SurvivalState';
import { createStarterToolInventory, isToolUnlocked, ToolID, ToolInventory } from './player/ToolState';
import { GameSettings } from './settings/GameSettings';
import { loadSettings, saveSettings } from './settings/SettingsSave';
import CinematicBoot from './ui/CinematicBoot';
import SpawnAwakening from './ui/SpawnAwakening';
import WorldLoadingScreen from './ui/WorldLoadingScreen';
import WakeUpIntegration from '../client/src/ui/wakeup/WakeUpIntegration';
import { worldTypeFromSeed, WorldTypeID } from './world/WorldTypes';
import SignInScreen, { SignedInUser } from './ui/SignInScreen';
import MarketplaceScreen from './ui/MarketplaceScreen';
import EditorScreen from './ui/EditorScreen';
import { CoinWallet } from './economy/CoinEconomy';
import { createPaymentProvider } from './economy/PaymentProvider';
import { StoreService } from './economy/StoreService';
import { MarketplaceLibrary } from './marketplace/MarketplaceCatalog';

const GameCanvas = lazy(() => import('./engine/GameCanvas'));
const HudFrame = lazy(() => import('./ui/HudFrame'));
const HUD = lazy(() => import('./ui/HUD'));

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
  /** Plays the waking-up cutscene once, on entering a world. */
  const [awakening, setAwakening] = useState(false);
  const [nextGenWakeUp, setNextGenWakeUp] = useState(false);
  /** Shows the world-creation loading screen before the world appears. */
  const [worldLoading, setWorldLoading] = useState(false);
  const [worldLoadProgress, setWorldLoadProgress] = useState<WorldLoadProgress>({ percent: 0, label: 'Preparing world', ready: false, elapsedMs: 0 });
  /** Remounts GameCanvas when startup fails and the player chooses Retry. */
  const [worldAttempt, setWorldAttempt] = useState(0);
  const [pendingWorldType, setPendingWorldType] = useState<WorldTypeID>('default');
  const [systemsVisible, setSystemsVisible] = useState(false);

  /* ---- App flow: sign-in → cinematic boot → title screen → game ---- */
  type AppPhase = 'signin' | 'boot' | 'title' | 'creator' | 'worlds' | 'multiplayer' | 'horizonos' | 'mods' | 'options' | 'marketplace' | 'editor' | 'guide';
  // BUGFIX 2.0: the app used to open on the sign-in screen, so signing in was
  // forced before you could reach the menu. Boot now runs first and hands off
  // to the title screen; sign-in is reached only by pressing the button there.
  const [appPhase, setAppPhase] = useState<AppPhase>('boot');
  const [signedInUser, setSignedInUser] = useState<SignedInUser | null>(null);

  const [appearance, setAppearance] = useState<CharacterAppearance>(() => {
    try {
      const raw = localStorage.getItem('eaoin_appearance');
      if (raw) return { ...DEFAULT_APPEARANCE, ...(JSON.parse(raw) as Partial<CharacterAppearance>) };
    } catch { /* first run */ }
    return DEFAULT_APPEARANCE;
  });
  const [telemetry, setTelemetry] = useState<HudTelemetry>({
    position: { x: 0, y: 0, z: 0 }, yaw: 0, timeOfDay: 12, day: 1, biome: 'Meadows', flightEnabled: false,
    hydration: 100, climate: 'temperate', weather: 'clear', skyProfile: 'Overworld',
  });

  /** Ability buttons re-use the engine's real keyboard handlers. */
  const fireAbility = useCallback((key: string) => {
    window.dispatchEvent(new CustomEvent('eaoin-ability', { detail: { key } }));
  }, []);
  const modRegistry = useMemo(() => new ModPackRegistry(), []);

  /* ---- Economy: one wallet, one library, one store for the whole app ---- */
  const wallet = useMemo(() => new CoinWallet(), []);
  const marketLibrary = useMemo(() => new MarketplaceLibrary(), []);
  const store = useMemo(
    () => new StoreService(wallet, marketLibrary, createPaymentProvider()),
    [wallet, marketLibrary]
  );
  const [coinBalance, setCoinBalance] = useState(() => wallet.getBalance());
  useEffect(() => wallet.subscribe((snapshot) => setCoinBalance(snapshot.balance)), [wallet]);
  const [modRevision, setModRevision] = useState(0);
  const toggleMod = useCallback((id: Parameters<ModPackRegistry['toggle']>[0]) => {
    modRegistry.toggle(id);
    setModRevision((v) => v + 1);
  }, [modRegistry]);

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
    // Grant the blocks/items that enabled mods add, so toggling a content mod
    // actually puts its items in your hands instead of being a placeholder.
    let startInv = createStarterInventory();
    for (const mod of modRegistry.list()) {
      if (!mod.enabled) continue;
      for (const block of mod.adds.blocks ?? []) startInv = addToInventory(startInv, block.id as BlockID, 8);
      for (const item of mod.adds.items ?? []) startInv = addToInventory(startInv, item as BlockID, 1);
    }
    setInventory({ ...startInv, ...(saved?.inventory ?? {}) });
    setSurvivalStats(saved?.survivalStats ?? createStarterSurvivalStats());
    setInventoryOpen(false);
    setSettingsOpen(false);
    setGameplayCounters(createGameplayCounters());
    setRuntimeStatus(createDefaultRuntimeStatus());
    setCraftingMessage(saved ? 'Loaded saved player progress' : 'New player inventory ready');
    // Loading screen first, then the awakening cutscene, then gameplay.
    setWorldLoadProgress({ percent: 0, label: 'Preparing world', ready: false, elapsedMs: 0 });
    setPendingWorldType(worldTypeFromSeed(nextSeed));
    setWorldAttempt((attempt) => attempt + 1);
    setWorldLoading(true);
    setNextGenWakeUp(true);
    setAwakening(false);
    setGameStarted(true);
  }, [worldSeed]);

  const exitToMenu = useCallback(() => {
    setInventoryOpen(false);
    setSettingsOpen(false);
    setWorldLoading(false);
    setAwakening(false);
    setNextGenWakeUp(false);
    setGameStarted(false);
    setAppPhase('title');
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

  /**
   * Instant dimension travel from the Dimensions menu. The engine owns the
   * actual transition, so we just raise an event it already listens for.
   */
  const travelToDimension = useCallback((dimensionId: string) => {
    window.dispatchEvent(new CustomEvent('eaoin-travel-dimension', { detail: { dimensionId } }));
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

  // Handlers for sign-in flow
  const handleSignedIn = useCallback((user: SignedInUser) => {
    setSignedInUser(user);
    // Update the character name from the signed-in user
    setAppearance((prev) => ({ ...prev, name: user.name }));
    // Return to the title screen the button was pressed from.
    setAppPhase('title');
  }, []);

  const handleSkipSignIn = useCallback(() => {
    setSignedInUser(null);
    setAppPhase('title');
  }, []);

  const handleBootComplete = useCallback(() => {
    setAppPhase('title');
  }, []);

  const handleWorldLoadingProgress = useCallback((progress: WorldLoadProgress) => {
    setWorldLoadProgress((current) => {
      if (
        current.percent === progress.percent &&
        current.label === progress.label &&
        current.ready === progress.ready &&
        current.error === progress.error &&
        current.loadedChunks === progress.loadedChunks &&
        current.totalChunks === progress.totalChunks &&
        Math.floor(current.elapsedMs / 1000) === Math.floor(progress.elapsedMs / 1000)
      ) return current;
      return progress;
    });
  }, []);

  const handleWorldLoadingComplete = useCallback(() => {
    setWorldLoading(false);
  }, []);

  const retryWorldStartup = useCallback(() => {
    setWorldLoadProgress({ percent: 0, label: 'Retrying renderer', ready: false, elapsedMs: 0 });
    setWorldLoading(true);
    setAwakening(true);
    setWorldAttempt((attempt) => attempt + 1);
  }, []);

  const shellClass = `eaoin-app ${settings.highContrast ? 'high-contrast' : ''} ${settings.reducedMotion ? 'reduced-motion' : ''}`;

  // ===== SIGN-IN PHASE =====
  if (appPhase === 'signin' && !gameStarted) {
    return (
      <div className={shellClass}>
        <SignInScreen
          onSignedIn={handleSignedIn}
          onSkip={handleSkipSignIn}
        />
      </div>
    );
  }

  // ===== CINEMATIC BOOT PHASE =====
  if (appPhase === 'boot' && !gameStarted) {
    return (
      <div className={shellClass}>
        <CinematicBoot onComplete={handleBootComplete} reducedMotion={settings.reducedMotion} />
      </div>
    );
  }

  // ===== TITLE SCREEN PHASE =====
  if (!gameStarted) {
    if (appPhase === 'title') {
      return (
        <div className={shellClass}>
          <TitleScreen
            appearance={appearance}
            signedInUser={signedInUser}
            onSignIn={() => setAppPhase('signin')}
            onSingleplayer={() => setAppPhase('worlds')}
            onMultiplayer={() => setAppPhase('multiplayer')}
            onMods={() => setAppPhase('mods')}
            onMarketplace={() => setAppPhase('marketplace')}
            onEditorMode={() => setAppPhase('editor')}
            coinBalance={coinBalance}
            onOpenCoinStore={() => setAppPhase('marketplace')}
            onOptions={() => setAppPhase('options')}
            onQuit={() => window.close()}
            onEditCharacter={() => setAppPhase('creator')}
            onOpenNews={() => setAppPhase('worlds')}
            onOpenGuide={() => setAppPhase('guide')}
            onOpenStats={() => setAppPhase('options')}
            onOpenFriends={() => setAppPhase('multiplayer')}
          />
        </div>
      );
    }
    if (appPhase === 'guide') {
      return (
        <div className={shellClass}>
          <div className="game-hud-overlay" aria-label="How to Play">
            <HowToPlayGuide onClose={() => setAppPhase('title')} />
          </div>
        </div>
      );
    }
    if (appPhase === 'worlds') {
      return (
        <div className={shellClass}>
          <MainMenu
            onStart={startGame}
            currentSeed={worldSeed}
            onBack={() => setAppPhase('title')}
          />
        </div>
      );
    }
    if (appPhase === 'multiplayer') {
      return (
        <div className={shellClass}>
          <MultiplayerScreen
            onBack={() => setAppPhase('title')}
            onJoin={() => setAppPhase('worlds')}
            onHorizonOS={() => setAppPhase('horizonos')}
          />
        </div>
      );
    }
    if (appPhase === 'horizonos') {
      return (
        <HorizonOS onExit={() => setAppPhase('multiplayer')} />
      );
    }
    if (appPhase === 'mods') {
      return (
        <div className={shellClass}>
          <ModsScreen
            registry={modRegistry}
            revision={modRevision}
            onToggle={toggleMod}
            onBack={() => setAppPhase('title')}
          />
        </div>
      );
    }
    if (appPhase === 'options') {
      return (
        <div className={shellClass}>
          <OptionsScreen
            settings={settings}
            onChange={setSettings}
            onBack={() => setAppPhase('title')}
          />
        </div>
      );
    }
    if (appPhase === 'marketplace') {
      return (
        <div className={shellClass}>
          <MarketplaceScreen
            wallet={wallet}
            library={marketLibrary}
            store={store}
            onBack={() => setAppPhase('title')}
            onOpenEditor={() => setAppPhase('editor')}
          />
        </div>
      );
    }
    if (appPhase === 'editor') {
      return (
        <div className={shellClass}>
          <EditorScreen
            store={store}
            library={marketLibrary}
            authorName={signedInUser?.name ?? appearance.name}
            onBack={() => setAppPhase('title')}
            onOpenMarketplace={() => setAppPhase('marketplace')}
          />
        </div>
      );
    }
    if (appPhase === 'creator') {
      return (
        <div className={shellClass}>
          <CharacterCreator
            appearance={appearance}
            onChange={setAppearance}
            onConfirm={() => setAppPhase('title')}
            onCancel={() => setAppPhase('title')}
          />
        </div>
      );
    }
  }

  // ===== IN-GAME =====
  return (
    <div className={shellClass}>
      <Suspense fallback={null}>
        <GameCanvas
          key={`${worldSeed}:${worldAttempt}`}
          seed={worldSeed}
          gameMode={gameMode}
          modRegistry={modRegistry}
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
          onLoadingProgress={handleWorldLoadingProgress}
          onGameModeChange={setGameMode}
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
          flightEnabled={telemetry.flightEnabled}
          onAbility={fireAbility}
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
          onSelectBlock={setSelectedBlock}
          onTravelToDimension={travelToDimension}
        />
      </Suspense>
      {worldLoading && (
        <WorldLoadingScreen
          key={`loading:${worldSeed}:${worldAttempt}`}
          worldName={worldSeed}
          worldType={pendingWorldType}
          seed={worldSeed}
          reducedMotion={settings.reducedMotion}
          loadingProgress={worldLoadProgress}
          onComplete={handleWorldLoadingComplete}
          onRetry={retryWorldStartup}
          onCancel={exitToMenu}
        />
      )}
      {!worldLoading && nextGenWakeUp && (
        <WakeUpIntegration
          onWakeUpComplete={() => {
            setNextGenWakeUp(false);
            setAwakening(true);
          }}
        />
      )}
      {!worldLoading && !nextGenWakeUp && awakening && (
        <SpawnAwakening
          onComplete={() => setAwakening(false)}
          reducedMotion={settings.reducedMotion}
          biomeName={telemetry.biome}
          worldName={worldSeed}
        />
      )}
    </div>
  );
}

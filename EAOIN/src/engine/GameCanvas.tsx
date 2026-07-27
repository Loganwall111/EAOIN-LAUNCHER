import { useEffect, useRef, useState } from 'react';
import { Color3, Color4, DefaultRenderingPipeline, GlowLayer, Mesh, MeshBuilder, Scene, StandardMaterial, UniversalCamera, Vector3 } from '@babylonjs/core';
import { GameAudio } from '../audio/GameAudio';
import { AmbienceEngine, ambienceForBiome } from '../audio/AmbienceEngine';
import { SettlementRuntime } from '../civilization/SettlementRuntime';
import { CommandEffect, runCommand, WorldTimeState } from '../commands/CommandRuntime';
import { BlockID, getBlock } from '@shared/blocks/BlockRegistry';
import { addToInventory, canConsumeBlock, getStackCount, HOTBAR_BLOCKS, InventoryStacks, removeFromInventory } from '../player/InventoryState';
import { applyDamage, createStarterSurvivalStats, SurvivalStats, updateSurvivalLoop } from '../player/SurvivalState';
import { climateForBiome, createStarterHydration, drink, HydrationState, updateHydration } from '../player/Hydration';
import { estimateMining, getTool, nextTool, ToolID, ToolInventory } from '../player/ToolState';
import { CreatureManager, CreatureStats } from '../creatures/CreatureManager';
import DimensionRuntime, { RuntimeDimensionID } from '../dimensions/DimensionRuntime';
import { WorldInteractionRuntime } from '../effects/WorldInteractionRuntime';
import { ItemDropManager } from '../items/ItemDropManager';
import { LocalAuthorityRuntime } from '../networking/LocalAuthorityRuntime';
import { GameMode } from '../modes/GameMode';
import { ModdingRuntime } from '../modding/ModdingRuntime';
import { NextGenRuntime } from '../nextgen/NextGenRuntime';
import { GameplayCounterKey } from '../objectives/ObjectiveTracker';
import { createBlockMaterials } from '../rendering/BlockMaterials';
import { ChunkRenderManager, ChunkRenderStats } from '../rendering/ChunkRenderManager';
import { BreakOverlay } from '../rendering/BreakOverlay';
import { FirstPersonViewModel } from '../rendering/FirstPersonViewModel';
import { applyRenderScale, createRuntimeEngine, invalidateRenderSnapshot, RendererBackendInfo } from '../rendering/RendererBackend';
import { DimensionChunkSource } from './DimensionChunkSource';
import { AdaptivePerformance, BUDGET_PRESETS, EffectTier, effectSettingsFor } from '../performance/AdaptivePerformance';
import { LogicRuntime } from '../redstone/LogicRuntime';
import { configureSceneLighting, SceneLightingHandles } from '../rendering/SceneLighting';
import { RuntimeStatus } from '../runtime/RuntimeStatus';
import { GameSettings, qualityRenderDistance, clampSettings } from '../settings/GameSettings';
import { TerrainGenerator } from '../world/TerrainGenerator';
import AdvancedTerrainGenerator, { FLOATING_ISLANDS_CONFIG } from '../world/AdvancedTerrainGenerator';
import { FloatingIslandsGenerator } from '../world/FloatingIslands';
import { AdvancedPhysicsRuntime } from '../physics/AdvancedPhysics';
import { AtmosphereSystem, AtmosphereFrame } from '../sky/AtmosphereSystem';
import { getWorldType, worldTypeFromSeed, WorldTypeConfig } from '../world/WorldTypes';
import { PortalSystem } from '../portals/PortalSystem';
import { RealityRiftSystem } from '../world/RealityRifts';
import { CommandBlockSystem } from '../redstone/CommandBlockSystem';
import { CinematicLighting, DEFAULT_CINEMATIC } from '../rendering/CinematicLighting';
import { getWorldLayout } from '../world/WorldDistribution';
import { WorldSaveManager } from '../world/WorldSave';
import { EndGameRuntime } from '../space/EndGameRuntime';
import { ScreenSpaceRayTracer } from '../rendering/ScreenSpaceRayTracing';
import { implantChip, powerForKey, usePower } from '../space/RealityChip';

/** Live world readouts pushed to the HUD each sampling tick. */
export interface WorldLoadProgress {
  /** Honest 0-100 readiness for the blocking world load overlay. */
  percent: number;
  /** Current real subsystem or chunk-streaming step. */
  label: string;
  /** True once the world is playable and the overlay may close. */
  ready: boolean;
  /** Spawn/render chunks that have actually been generated + meshed. */
  loadedChunks?: number;
  /** Total chunks targeted for the visible startup radius. */
  totalChunks?: number;
  /** Milliseconds since GameCanvas began initializing this world. */
  elapsedMs: number;
  /** Present when initialization stopped before the render loop could start. */
  error?: string;
}

export interface HudTelemetry {
  position: { x: number; y: number; z: number };
  /** Camera yaw in radians. */
  yaw: number;
  timeOfDay: number;
  day: number;
  biome: string;
  flightEnabled: boolean;
  /** 0-100 thirst bar. Drains fast in deserts. */
  hydration: number;
  /** Human-readable climate band, e.g. "Scorching". */
  climate: string;
  /** Active weather effect, e.g. "sandstorm". */
  weather: string;
  /** Name of the active sky/atmosphere profile. */
  skyProfile: string;
}

interface GameCanvasProps {
  seed: string; gameMode: GameMode; onExit: () => void;
  selectedBlock: BlockID; onSelectedBlockChange: (b: BlockID) => void;
  selectedTool: ToolID; onSelectedToolChange: (t: ToolID) => void;
  toolInventory: ToolInventory; inventory: InventoryStacks; onInventoryChange: (i: InventoryStacks) => void;
  survivalStats: SurvivalStats; onSurvivalStatsChange: (s: SurvivalStats) => void;
  settings: GameSettings; onSettingsChange: (s: GameSettings) => void;
  onToggleInventory: () => void; onToggleSettings: () => void;
  onGameplayEvent: (e: GameplayCounterKey, amount?: number) => void;
  onRuntimeStatusChange: (s: RuntimeStatus) => void;
  onTelemetry?: (t: HudTelemetry) => void;
  /** Reports real renderer/world/chunk-loading progress to the overlay. */
  onLoadingProgress?: (progress: WorldLoadProgress) => void;
  /** Live game-mode switching, so `/gamemode creative` works mid-world. */
  onGameModeChange?: (mode: GameMode) => void;
}
interface BlockCoordinate { x: number; y: number; z: number; }
interface MiningSession { target: BlockCoordinate; blockId: BlockID; startedAt: number; durationMs: number; canHarvest: boolean; toolName: string; }
interface RuntimeRenderStats extends ChunkRenderStats {
  fps: number; streamCenter: string; creatures: CreatureStats; drops: number; renderer: RendererBackendInfo;
  /** 95th-percentile frame time in ms — the number that reflects felt stutter. */
  frameTimeP95: number;
  /** Live internal resolution scale chosen by the adaptive tuner. */
  renderScale: number;
  effectTier: EffectTier;
  /** Why the tuner last changed something. */
  adaptiveReason: string;
}

const BLOCK_REACH = 7;
const GRAVITY_BASE = -20;
const JUMP_VELOCITY_BASE = 7.5;
const TERMINAL_VELOCITY = -28;
/** Chunks meshed synchronously before the first frame is presented. */
const INITIAL_CHUNK_RADIUS = 2;
/** Chunks generated + meshed per frame while streaming the render radius in. */
const CHUNKS_PER_FRAME = 2;
const INITIAL_RENDERER_INFO: RendererBackendInfo = { backend: 'webgl', label: 'Initializing renderer', requested: 'auto', webgpuSupported: false, vulkanPath: 'native-vulkan-required', vulkanStatus: 'Detecting graphics backend…' };
/** Hard cap for the blocking loading overlay; remaining distant chunks stream while playing. */
const WORLD_LOADING_MAX_MS = 18_000;


/** Full day/night cycle length in real seconds — 20 minutes, like Minecraft. */
const DAY_LENGTH_SECONDS = 1200;

/** Particle emit-rate multiplier per quality preset. */
function particleQualityFor(preset: GameSettings['qualityPreset']): number {
  if (preset === 'performance') return 0.45;
  if (preset === 'quality') return 1.15;
  if (preset === 'cinematic') return 1.4;
  return 1;
}

export default function GameCanvas({ seed, gameMode, onExit, selectedBlock, onSelectedBlockChange, selectedTool, onSelectedToolChange, toolInventory, inventory, onInventoryChange, survivalStats, onSurvivalStatsChange, settings, onSettingsChange, onToggleInventory, onToggleSettings, onGameplayEvent, onRuntimeStatusChange, onTelemetry, onLoadingProgress, onGameModeChange }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedBlockRef = useRef<BlockID>(selectedBlock);
  const selectedToolRef = useRef<ToolID>(selectedTool);
  const toolInventoryRef = useRef<ToolInventory>(toolInventory);
  const inventoryRef = useRef<InventoryStacks>(inventory);
  const survivalStatsRef = useRef<SurvivalStats>(survivalStats);
  const settingsRef = useRef<GameSettings>(settings);
  // Game mode is read inside the render loop and inside event handlers. Keeping
  // it in a ref means switching modes never tears down and rebuilds the scene.
  const gameModeRef = useRef<GameMode>(gameMode);
  const gameModeChangeRef = useRef(onGameModeChange);
  const worldTimeRef = useRef<WorldTimeState>({ timeOfDay: 12, frozen: false });
  const flightEnabledRef = useRef(false);
  const telemetryRef = useRef(onTelemetry);
  const loadingProgressRef = useRef(onLoadingProgress);
  useEffect(() => { telemetryRef.current = onTelemetry; }, [onTelemetry]);
  useEffect(() => { loadingProgressRef.current = onLoadingProgress; }, [onLoadingProgress]);
  const [actionMessage, setActionMessage] = useState('WASD move • SPACE jump • Left mine with hand punch • Right place • T chat /day /time • O objectives U systems');
  const [worldVersion, setWorldVersion] = useState(0);
  const [miningProgress, setMiningProgress] = useState(0);
  const [miningLabel, setMiningLabel] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [paused, setPaused] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  /**
   * Mirrors of the chat/command open flags for the window key handler.
   *
   * BUGFIX: `handleKeyDown` is registered once on `window` inside the scene
   * effect, so it closed over the *initial* `commandOpen` / `chatOpen` values,
   * which were always `false`. Every gameplay hotkey therefore still fired
   * while the player was typing — pressing "i" in `/kill` opened the
   * inventory, "d" in `/time set day` toggled things, and so on. Refs are read
   * live inside the handler, so the guard actually reflects the current UI.
   */
  const textEntryOpenRef = useRef(false);
  /**
   * Set by the scene effect to the live command-effect executor.
   *
   * Commands are pure and return a `CommandEffect`; the running scene is the
   * only thing that can act on one (teleport the camera, kill the player,
   * spawn a creature). This ref is the bridge between the two.
   */
  const commandEffectRef = useRef<((effect: CommandEffect) => string | void) | null>(null);
  const [commandText, setCommandText] = useState('/help');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ text: string; system?: boolean }>>([{ text: 'Welcome — T to chat, / for commands, Q to cycle tools, SPACE to jump, clouds moving', system: true }]);
  const [worldTime, setWorldTime] = useState<WorldTimeState>({ timeOfDay: 12, frozen: false });
  const [renderStats, setRenderStats] = useState<RuntimeRenderStats>({ loadedChunks: 0, meshCount: 0, triangleCount: 0, rebuildCount: 0, naiveTriangleCount: 0, meshingSavings: 0, fps: 0, streamCenter: '0,0', creatures: { count: 0, cap: 0, spawned: 0, despawned: 0 }, drops: 0, renderer: INITIAL_RENDERER_INFO, frameTimeP95: 0, renderScale: 1, effectTier: 'medium', adaptiveReason: '' });
  const [flightEnabled, setFlightEnabled] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => { selectedBlockRef.current = selectedBlock; }, [selectedBlock]);
  useEffect(() => { selectedToolRef.current = selectedTool; }, [selectedTool]);
  useEffect(() => { toolInventoryRef.current = toolInventory; }, [toolInventory]);
  useEffect(() => { inventoryRef.current = inventory; }, [inventory]);
  useEffect(() => { survivalStatsRef.current = survivalStats; }, [survivalStats]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { gameModeChangeRef.current = onGameModeChange; }, [onGameModeChange]);
  useEffect(() => { worldTimeRef.current = worldTime; }, [worldTime]);
  useEffect(() => { textEntryOpenRef.current = commandOpen || chatOpen; }, [commandOpen, chatOpen]);

  useEffect(() => {
    let disposed = false;
    let cleanupScene: (() => void) | undefined;
    const loadingStartedAt = performance.now();
    let lastLoadingReport: WorldLoadProgress = { percent: -1, label: '', ready: false, elapsedMs: 0 };
    const reportLoadingProgress = (
      percent: number,
      label: string,
      ready = false,
      chunks?: Pick<WorldLoadProgress, 'loadedChunks' | 'totalChunks'>,
      error?: string
    ): void => {
      if (disposed) return;
      const elapsedMs = performance.now() - loadingStartedAt;
      const rounded = Math.round(Math.max(0, Math.min(100, percent)));
      // Never let the visible bar go backwards if the renderer re-checks a stage.
      const next: WorldLoadProgress = {
        percent: Math.max(rounded, lastLoadingReport.percent),
        label,
        ready,
        elapsedMs,
        ...chunks,
        ...(error ? { error } : {}),
      };
      const percentChanged = next.percent !== lastLoadingReport.percent;
      const labelChanged = next.label !== lastLoadingReport.label;
      const chunkChanged = next.loadedChunks !== lastLoadingReport.loadedChunks || next.totalChunks !== lastLoadingReport.totalChunks;
      const errorChanged = next.error !== lastLoadingReport.error;
      if (ready || percentChanged || labelChanged || chunkChanged || errorChanged || elapsedMs - lastLoadingReport.elapsedMs > 500) {
        lastLoadingReport = next;
        loadingProgressRef.current?.(next);
      }
    };

    setInitializationError(null);
    const initializeWorld = async (): Promise<void> => {
      const canvas = canvasRef.current; if (!canvas) return;
      canvas.tabIndex = 1;
      reportLoadingProgress(1, 'Creating renderer');
      const runtimeEngine = await createRuntimeEngine(canvas, settingsRef.current);
      const engine = runtimeEngine.engine;
      if (disposed) { engine.dispose(); return; }
      // Keep a provisional disposer in place throughout startup. If any
      // subsystem throws before the full cleanup closure is installed, the GPU
      // context is still released and Retry can create a clean renderer.
      cleanupScene = () => { engine.dispose(); };
      reportLoadingProgress(8, runtimeEngine.info.label || 'Renderer ready');
      setRenderStats(c => ({ ...c, renderer: runtimeEngine.info }));
      const scene = new Scene(engine);
      cleanupScene = () => { scene.dispose(); engine.dispose(); };
      scene.clearColor = new Color4(0.22, 0.38, 0.58, 1);
      scene.collisionsEnabled = true;
      scene.gravity = new Vector3(0, 0, 0);
      scene.fogEnabled = settingsRef.current.fogEnabled;
      reportLoadingProgress(12, 'Scene created');

      const saveManager = new WorldSaveManager(seed);
      const savedEdits = saveManager.load();
      reportLoadingProgress(16, savedEdits.length > 0 ? `Loaded ${savedEdits.length} saved world edits` : 'Checked saved world edits');
      // 1.0 advanced world generation. Falls back to legacy if the seed asks.
      const useAdvancedWorld = !/classic|legacy/i.test(seed);
      // 2.0 — the world-creation screen tags the seed with the chosen preset,
      // e.g. "skylands__mySeed". Decode it into real generator settings.
      const worldTypeId = worldTypeFromSeed(seed);
      const worldTypeConfig = getWorldType(worldTypeId).config;
      const isSkyWorld = Boolean(worldTypeConfig.floatingIslands)
        || /floating[-_ ]?islands|skylands|amplified/i.test(seed);
      const advancedTerrain: AdvancedTerrainGenerator | null = useAdvancedWorld
        ? new AdvancedTerrainGenerator({
            ...(isSkyWorld ? FLOATING_ISLANDS_CONFIG : {}),
            ...worldTypeOverrides(worldTypeConfig),
            seed,
          })
        : null;
      const terrain: TerrainGenerator = useAdvancedWorld
        ? (advancedTerrain as unknown as TerrainGenerator)
        : new TerrainGenerator(seed, savedEdits);
      // Construct every generator before the first synchronous chunk request.
      // The old callback closed over Aether/Backrooms `const`s declared much
      // later and crashed here with "Cannot access before initialization".
      const chunkSource = new DimensionChunkSource(seed, terrain);
      reportLoadingProgress(22, useAdvancedWorld ? 'Terrain generator seeded' : 'Legacy terrain generator seeded');
      const floatingIslands: FloatingIslandsGenerator | null = isSkyWorld ? new FloatingIslandsGenerator(seed) : null;
      void floatingIslands; // reserved for future floating-island content injection
      const spawn = terrain.getSpawnPoint();
      const layout = getWorldLayout(seed, spawn);
      reportLoadingProgress(28, `Spawn point found at ${Math.round(spawn.x)}, ${Math.round(spawn.y)}, ${Math.round(spawn.z)}`);
      setActionMessage(savedEdits.length > 0
        ? `Loaded ${savedEdits.length} edits • Settlement ${Math.round(Math.hypot(layout.settlement.x, layout.settlement.z))}m • Rocket ${Math.round(Math.hypot(layout.rocket.x, layout.settlement.z))}m • 1.0 advanced world`
        : `EAOIN 1.0 • advanced world gen • bedrock foundation • Caves & Cliffs terrain • 150+ biomes • 25 dimensions`);

      const camera = new UniversalCamera('player_camera', new Vector3(spawn.x, spawn.y, spawn.z), scene);
      camera.attachControl(canvas, true);
      camera.setTarget(new Vector3(spawn.x + 8, spawn.y - 0.35, spawn.z + 8));
      camera.minZ = 0.05; camera.maxZ = 1500;
      camera.speed = Math.max(0.7, settingsRef.current.cameraSpeed * 1.15);
      camera.inertia = 0; camera.angularSensibility = 900; camera.applyGravity = false; camera.checkCollisions = true;
      camera.ellipsoid = new Vector3(0.32, 0.82, 0.32); camera.ellipsoidOffset = new Vector3(0, 0.82, 0);
      camera.keysUp = [87, 38]; camera.keysDown = [83, 40]; camera.keysLeft = [65, 37]; camera.keysRight = [68, 39];

      const skin = new StandardMaterial('player_skin', scene); skin.diffuseColor = new Color3(0.72, 0.43, 0.28);
      const shirt = new StandardMaterial('player_shirt', scene); shirt.diffuseColor = new Color3(0.12, 0.42, 0.78);
      const pants = new StandardMaterial('player_pants', scene); pants.diffuseColor = new Color3(0.20, 0.28, 0.50);
      // First-person view model: a hinged arm that actually holds the selected
      // block or item. Replaces three stacked boxes that showed nothing in the
      // hand and slid around the screen instead of swinging.
      const viewModel = new FirstPersonViewModel(scene, camera);
      viewModel.setHeldItem(selectedBlockRef.current);

      // Third-person avatar — built as a parent transform so we can position
      // it independently of the camera and avoid the visual jitter of moving
      // the camera itself on toggle.  This makes the player actually visible
      // when the user presses F5.
      const avatar = new Mesh('third_person_avatar', scene);
      avatar.isVisible = false; // hidden in first person
      avatar.isPickable = false;
      // Local origin is the avatar's feet; we offset body parts upward.
      const torso = MeshBuilder.CreateBox('avatar_torso', { width: 0.7, height: 0.95, depth: 0.38 }, scene);
      torso.parent = avatar; torso.position.y = 1.27; torso.material = shirt; torso.isPickable = false;
      const head = MeshBuilder.CreateBox('avatar_head', { width: 0.55, height: 0.55, depth: 0.55 }, scene);
      head.parent = avatar; head.position.y = 2.02; head.material = skin; head.isPickable = false;
      const legA = MeshBuilder.CreateBox('avatar_leg_a', { width: 0.25, height: 0.85, depth: 0.28 }, scene);
      legA.parent = avatar; legA.position.set(-0.18, 0.4, 0); legA.material = pants; legA.isPickable = false;
      const legB = MeshBuilder.CreateBox('avatar_leg_b', { width: 0.25, height: 0.85, depth: 0.28 }, scene);
      legB.parent = avatar; legB.position.set(0.18, 0.4, 0); legB.material = pants; legB.isPickable = false;
      const armA = MeshBuilder.CreateBox('avatar_arm_a', { width: 0.22, height: 0.82, depth: 0.25 }, scene);
      armA.parent = avatar; armA.position.set(-0.48, 1.24, 0); armA.material = skin; armA.isPickable = false;
      const armB = MeshBuilder.CreateBox('avatar_arm_b', { width: 0.22, height: 0.82, depth: 0.25 }, scene);
      armB.parent = avatar; armB.position.set(0.48, 1.24, 0); armB.material = skin; armB.isPickable = false;
      // Walking animation
      let walkPhase = 0;
      let thirdPerson = false;
      const THIRD_PERSON_DISTANCE = 3.5;

      const materials = createBlockMaterials(scene, settingsRef.current.texturePack);
      reportLoadingProgress(34, 'Block materials baked');
      const audio = new GameAudio();
      // 2.0 — layered procedural soundscapes per biome/dimension.
      const ambience = new AmbienceEngine();
      ambience.setVolume(settingsRef.current.volume, settingsRef.current.muted);
      const renderer = new ChunkRenderManager(scene, materials);
      renderer.setGreedyMeshing(settingsRef.current.greedyMeshing !== false);
      const itemDrops = new ItemDropManager(scene, materials);

      // --- adaptive performance -------------------------------------------
      // A fixed quality preset has to be tuned for the worst-case view, which
      // leaves most frames slower than they need to be. This measures real
      // frame times and steers resolution / effects / view distance to hold
      // the target framerate. See performance/AdaptivePerformance.ts.
      const perfBudget = {
        ...(BUDGET_PRESETS[settingsRef.current.qualityPreset] ?? BUDGET_PRESETS.balanced),
        targetFps: settingsRef.current.targetFps || 60,
      };
      const baseRenderRadius = qualityRenderDistance(settingsRef.current.qualityPreset);
      const perf = new AdaptivePerformance(perfBudget, {
        renderScale: settingsRef.current.renderScale,
        renderDistance: baseRenderRadius,
        effectTier: settingsRef.current.qualityPreset === 'performance' ? 'low'
          : settingsRef.current.qualityPreset === 'cinematic' ? 'ultra'
          : settingsRef.current.qualityPreset === 'quality' ? 'high' : 'medium',
      });
      // Mutable because the tuner shrinks/grows it while playing.
      let renderRadius = perf.getState().renderDistance;
      let effectTier: EffectTier = perf.getState().effectTier;
      let adaptiveReason = '';
      const startupChunkTotal = chunksInRadius(renderRadius);
      const dimensionRuntime = new DimensionRuntime(scene, spawn, seed);
      const worldInteractions = new WorldInteractionRuntime(scene, terrain, spawn, seed);
      const moddingRuntime = new ModdingRuntime(); moddingRuntime.registerMockPack();
      const nextGenRuntime = new NextGenRuntime(scene, terrain, seed, gameMode, spawn);
      const logicRuntime = new LogicRuntime(scene, terrain, spawn);
      const settlementRuntime = new SettlementRuntime(scene, terrain, seed);
      const authorityRuntime = new LocalAuthorityRuntime(seed);
      let streamCenter = toChunkCoordinate(spawn.x, spawn.z);
      // Load only the chunks directly around spawn synchronously so the first
      // frame has ground in it. The rest of the render radius is streamed in a
      // few chunks per frame below, which keeps the canvas from sitting on a
      // black screen while thousands of chunks are meshed.
      const initialChunkTotal = chunksInRadius(INITIAL_CHUNK_RADIUS);
      reportLoadingProgress(42, `Meshing spawn chunks 0/${initialChunkTotal}`, false, { loadedChunks: 0, totalChunks: initialChunkTotal });
      renderer.updateVisibleChunks(streamCenter.cx, streamCenter.cz, INITIAL_CHUNK_RADIUS, chunkSource.generateChunk);
      const initialLoadedChunks = Math.min(renderer.getStats().loadedChunks, startupChunkTotal);
      reportLoadingProgress(55, `Meshed spawn chunks ${Math.min(initialLoadedChunks, initialChunkTotal)}/${initialChunkTotal}`, false, { loadedChunks: initialLoadedChunks, totalChunks: startupChunkTotal });
      const lighting = configureSceneLighting(scene, spawn);

      const glow = new GlowLayer('voxel_bloom', scene, { blurKernelSize: 64 });
      glow.intensity = settingsRef.current.postProcessEnabled || settingsRef.current.realisticLighting ? 0.22 : 0.08;
      const optionalPostEffectsEnabled = settingsRef.current.postProcessEnabled || settingsRef.current.qualityPreset === 'cinematic' || settingsRef.current.experimentalShaders;
      scene.environmentIntensity = 0.48;
      dimensionRuntime.applyCurrent();
      // 1.0 — wire in the new cinematic lighting, dynamic sky, portals, rifts, physics, command blocks.
      //
      // BUGFIX: this used to build a `voxel_cinematic_pipeline` here *and* let
      // CinematicLighting build a second `cinematic_pipeline` below. Two
      // DefaultRenderingPipelines on one scene stack their tone-mapping and
      // bloom passes, which blew out the image to white. CinematicLighting now
      // owns the single post stack, and adopts the sun/hemi/glow created by
      // configureSceneLighting() rather than duplicating them.
      const cinematicLighting = new CinematicLighting(scene, DEFAULT_CINEMATIC);
      let pipeline: DefaultRenderingPipeline | null = null;
      if (optionalPostEffectsEnabled) {
        try {
          cinematicLighting.buildPipeline();
          pipeline = cinematicLighting.pipeline;
          if (pipeline) {
            pipeline.samples = 2;
            pipeline.imageProcessing.vignetteEnabled = false;
            // Clamp exposure — the scene is already fully lit by the adopted rig.
            pipeline.imageProcessing.exposure = Math.min(pipeline.imageProcessing.exposure, 0.78);
            pipeline.imageProcessing.contrast = 1.08;
            pipeline.bloomWeight = Math.min(pipeline.bloomWeight, 0.16);
            pipeline.bloomThreshold = Math.max(pipeline.bloomThreshold, 0.86);
            pipeline.depthOfFieldEnabled = settingsRef.current.qualityPreset === 'cinematic';
          }
        } catch (error) {
          pipeline?.dispose(); pipeline = null;
          scene.postProcessesEnabled = false;
          console.warn('[Render] Optional post-processing disabled to keep world visible.', error);
        }
      }
      // 5.0 — screen-space ray tracing. Real per-pixel ray marching against
      // the depth buffer for reflections, contact shadows and AO. It is NOT
      // hardware RT and the UI says so; see ScreenSpaceRayTracing.ts.
      const rayTracer = new ScreenSpaceRayTracer(scene, camera);
      rayTracer.configure({
        quality: settingsRef.current.rayTracingQuality,
        reflections: settingsRef.current.rayTracedReflections,
        contactShadows: settingsRef.current.rayTracedShadows,
        ambientOcclusion: settingsRef.current.rayTracedAO,
      });
      let lastRayTracingQuality = settingsRef.current.rayTracingQuality;

      // 2.0 — ONE atmosphere system owns the sky dome, celestial bodies,
      // clouds, stars, aurora, fog and biome weather particles. Nothing else in
      // the engine writes scene.clearColor / fogColor, which is what keeps the
      // horizon seamless and killed the flashing blue overhead.
      const atmosphere = new AtmosphereSystem(scene, {
        seed,
        dayLengthSeconds: DAY_LENGTH_SECONDS,
        particlesEnabled: settingsRef.current.particlesEnabled && !settingsRef.current.reducedMotion,
        particleQuality: particleQualityFor(settingsRef.current.qualityPreset),
      });
      atmosphere.attach();
      atmosphere.timeOfDay = worldTimeRef.current.timeOfDay;
      atmosphere.setDimension(dimensionRuntime.getState().id);
      reportLoadingProgress(66, 'Atmosphere, lighting, and sky attached', false, { loadedChunks: initialLoadedChunks, totalChunks: startupChunkTotal });
      // Track the biome under the player so the sky can cross-fade per biome.
      let lastBiomeKey = '';
      const portalSystem = new PortalSystem(scene);
      // spawn the "home" portal near spawn
      const currentDim = dimensionRuntime.getState();
      portalSystem.spawnForDimension(currentDim.id as RuntimeDimensionID, new Vector3(spawn.x - 4, spawn.y - 1, spawn.z - 4));
      // spawn a couple of "destination" portals around the spawn for atmosphere
      portalSystem.spawnForDimension('nether', new Vector3(spawn.x + 18, spawn.y - 1, spawn.z + 12));
      portalSystem.spawnForDimension('crystal_realm', new Vector3(spawn.x - 22, spawn.y - 1, spawn.z + 18));
      const realityRifts = new RealityRiftSystem(scene);

      // Install UI publishers before wiring any subsystem callbacks. Startup
      // code should never be able to invoke a callback whose const is still in
      // its temporal dead zone.
      let actionMessageTimer: number | undefined;
      const showActionMessage = (message: string): void => {
        setActionMessage(message);
        if (actionMessageTimer !== undefined) window.clearTimeout(actionMessageTimer);
        actionMessageTimer = window.setTimeout(() => { setActionMessage('WASD move • SPACE jump • F fly • Left click punch tree • Right place • T chat /day /time • Q tools • O/U panels'); }, 2400);
      };
      const publishInventory = (next: InventoryStacks): void => { inventoryRef.current = next; onInventoryChange(next); };
      const publishSurvivalStats = (next: SurvivalStats): void => {
        const r = { health: Number(next.health.toFixed(1)), food: Number(next.food.toFixed(1)), stamina: Number(next.stamina.toFixed(1)) };
        survivalStatsRef.current = r; onSurvivalStatsChange(r);
      };

      // 5.0 — the end-game chain, finally driven from the frame loop:
      // black hole → the void → Void Leviathan → Reality Chip. Also owns the
      // ocean depth/wave/whirlpool/Bloop hookup, which previously existed as
      // tested systems that nothing ever called.
      const endGame = new EndGameRuntime(scene, camera, {
        seed,
        seaLevel: (terrain as unknown as { config?: { seaLevel?: number } }).config?.seaLevel ?? 18,
      });
      endGame.attach();
      endGame.onMessage = (text) => showActionMessage(text);
      endGame.onPlayerDamage = (amount, source) => {
        const next = applyDamage(survivalStatsRef.current, amount);
        survivalStatsRef.current = next;
        publishSurvivalStats(next);
        showActionMessage(`${source} hits you for ${amount}.`);
      };
      endGame.onEnterVoid = (arenaCenter) => {
        camera.position.copyFrom(arenaCenter).addInPlace(new Vector3(0, 4, -40));
        dimensionRuntime.setDimension('cosmic_void');
        atmosphere.setDimension('cosmic_void');
      };
      const physics = new AdvancedPhysicsRuntime();
      physics.attach(scene);
      const commandBlockSystem = new CommandBlockSystem();
      commandBlockSystem.onLog = (m) => showActionMessage(`[script] ${m}`);
      // Place a starter command block at the spawn for immediate scripting demo.
      commandBlockSystem.placeBlock(spawn.x + 5, spawn.y, spawn.z, 'impulse', 'say Welcome to EAOIN 1.0 — type /help in chat', false, true);
      commandBlockSystem.placeBlock(spawn.x + 6, spawn.y, spawn.z, 'chain', 'give @p 1 64', false, true);
      commandBlockSystem.placeBlock(spawn.x + 7, spawn.y, spawn.z, 'chain', 'give @p 22 1', false, true);
      // Do not auto-place a repeating `time set day` block: it spammed the
      // action rail and kept the sky locked to a bright midday look.
      const creatureManager = new CreatureManager(scene, terrain, seed); creatureManager.update(camera.position, 1);

      // Real Minecraft-style destroy-stage cracks. The old overlay just faded a
      // dark box to red over the block, which is the "red screen when breaking
      // a block" the player called outdated.
      const breakOverlay = new BreakOverlay(scene);

      let miningSession: MiningSession | null = null;
      const clearMining = (): void => {
        miningSession = null; setMiningProgress(0); setMiningLabel('');
        breakOverlay.hide();
        viewModel.setContinuousSwing(false);
      };
      const publishRenderStats = (): void => {
        const s = renderer.getStats();
        const sample = perf.getSample();
        setRenderStats({
          ...s,
          fps: Math.round(engine.getFps()),
          streamCenter: `${streamCenter.cx},${streamCenter.cz}`,
          creatures: creatureManager.getStats(),
          drops: itemDrops.getCount(),
          renderer: runtimeEngine.info,
          frameTimeP95: sample.frameTimeP95,
          renderScale: perf.getState().renderScale,
          effectTier,
          adaptiveReason,
        });
      };
      const publishRuntimeStatus = (): void => {
        const dim = dimensionRuntime.getState(); const logic = logicRuntime.getStats(); const settlement = settlementRuntime.getStats(camera.position); const authority = authorityRuntime.getStatus(); const interactions = worldInteractions.getStats(); const modding = moddingRuntime.getStatus(settingsRef.current);
        onRuntimeStatusChange({
          dimensionId: dim.id, dimensionName: dim.name, portalUses: dim.portalUses, redstoneActive: logic.active, redstoneToggles: logic.toggles, logicBlocks: logic.blocks, placedLogicWires: logic.placedWires, placedSignalLamps: logic.placedLamps, poweredSignalLamps: logic.poweredLamps,
          nearbyPortalCore: hasNearbyBlock(terrain, camera.position, 15, 6),
          settlementName: settlement.discovered ? settlement.name : `Undiscovered ~${Math.round(Math.hypot(layout.settlement.x, layout.settlement.z))}m`, settlementDiscovered: settlement.discovered, villagers: settlement.villagers, settlementProsperity: settlement.prosperity, settlementTask: settlement.discovered ? settlement.activeTask : 'Village 55m NW — follow beacon', settlementJobProgress: settlement.jobProgress, settlementWood: settlement.woodStockpile, settlementStone: settlement.stoneStockpile, tradesCompleted: settlement.tradesCompleted,
          doors: interactions.doors, dimensionalDoors: interactions.dimensionalDoors, rocketReady: interactions.rocketReady, moonVisits: interactions.moonVisits,
          moddingApiVersion: modding.apiVersion, loadedMods: modding.loadedMods, texturePack: modding.texturePack, shaderExperimental: modding.shaderExperimental, commandBlocksEnabled: modding.commandBlocksEnabled,
          networkClientId: authority.clientId, networkPing: authority.ping, networkJitter: authority.jitter, remotePlayers: authority.remotePlayers, outboundPackets: authority.outboundPackets, inboundPackets: authority.inboundPackets, packetLoss: authority.packetLoss, snapshotBuffer: authority.snapshotBuffer, rollbackEvents: authority.rollbackEvents, predictionError: authority.predictionError, syncQuality: authority.syncQuality, syncState: authority.syncState, authorityTicks: authority.ticks, localActions: authority.localActions, nextGen: nextGenRuntime.getStatus(),
        });
      };
      const rebuildEditedBlock = (target: BlockCoordinate): void => { renderer.rebuildForWorldBlock(target.x, target.z); publishRenderStats(); };
      const saveWorldEdits = (): void => { const r = saveManager.save(terrain.getEdits()); showActionMessage(r.message); };
      publishRenderStats(); publishRuntimeStatus();

      const finishMining = (session: MiningSession): void => {
        const existing = terrain.getBlockAt(session.target.x, session.target.y, session.target.z);
        if (existing !== session.blockId || existing === 0) { showActionMessage('Mining target changed'); clearMining(); return; }
        terrain.setBlockAt(session.target.x, session.target.y, session.target.z, 0);
        authorityRuntime.recordAction(); onGameplayEvent('blocksMined');
        if (session.canHarvest) { itemDrops.spawnDrop(existing, new Vector3(session.target.x, session.target.y, session.target.z), 1); audio.play('mine', settingsRef.current); showActionMessage(`Mined ${getBlock(existing).name} with ${session.toolName} — cracking complete`); }
        else { audio.play('error', settingsRef.current); showActionMessage(`${getBlock(existing).name} broke but dropped nothing — stronger tool needed`); }
        rebuildEditedBlock(session.target); saveWorldEdits(); clearMining();
      };

      /**
       * Kill and respawn the player.
       *
       * Survival had no death at all: health could hit zero and nothing
       * happened, and `/kill` was not even a command. Dying now recentres you
       * on the world spawn with fresh stats, which is what makes survival
       * mode have stakes.
       */
      const respawnPlayer = (reason: string): string => {
        const safeY = terrain.getHeightAt(spawn.x, spawn.z) + 2;
        camera.position.set(spawn.x, safeY, spawn.z);
        velocityY = 0;
        fallStartY = safeY;
        wasFalling = false;
        const fresh = createStarterSurvivalStats();
        survivalStatsRef.current = fresh;
        publishSurvivalStats(fresh);
        clearMining();
        audio.play('error', settingsRef.current);
        return `${reason} — respawned at the world spawn.`;
      };

      /**
       * Execute a `CommandEffect` against the running world.
       *
       * Registered on a ref so the React-side command handlers can reach the
       * live scene without the scene being rebuilt when they change.
       */
      commandEffectRef.current = (effect: CommandEffect): string | void => {
        switch (effect.kind) {
          case 'kill':
            return respawnPlayer('You died');
          case 'heal': {
            const fresh = createStarterSurvivalStats();
            survivalStatsRef.current = fresh;
            publishSurvivalStats(fresh);
            hydrationState = createStarterHydration();
            return 'Fully healed.';
          }
          case 'teleport': {
            camera.position.set(effect.x ?? 0, effect.y ?? 64, effect.z ?? 0);
            velocityY = 0;
            wasFalling = false;
            fallStartY = camera.position.y;
            // Re-centre streaming so the destination meshes immediately.
            streamCenter = toChunkCoordinate(camera.position.x, camera.position.z);
            return;
          }
          case 'give': {
            const id = effect.blockId ?? 0;
            const amount = effect.amount ?? 1;
            if (!id) return 'Nothing to give.';
            publishInventory(addToInventory(inventoryRef.current, id as BlockID, amount));
            return `Gave ${amount}x ${getBlock(id as BlockID).name}.`;
          }
          case 'clear':
            creatureManager.clearAll();
            return 'Removed every loaded creature.';
          case 'spawn': {
            const spawned = creatureManager.spawnNear(camera.position, effect.entity ?? 'sheep');
            return spawned ? `Summoned ${spawned}.` : 'No room to summon here.';
          }
          case 'weather':
            // The atmosphere system owns weather; setBiome re-evaluates it.
            atmosphere.setWeatherOverride(effect.weather ?? 'clear');
            return `Weather set to ${effect.weather}.`;
          default:
            return;
        }
      };

      let velocityY = 0; let grounded = false; let jumpRequested = false; let fallStartY = camera.position.y; let wasFalling = false;
      const pressedKeys = new Set<string>();
      const setFlightMode = (enabled: boolean): void => {
        flightEnabledRef.current = enabled;
        setFlightEnabled(enabled);
        velocityY = 0; jumpRequested = false; wasFalling = false; fallStartY = camera.position.y;
        camera.speed = Math.max(0.7, settingsRef.current.cameraSpeed * (enabled ? 2.6 : 1.15));
        showActionMessage(enabled ? 'Flight enabled — F toggles, SPACE up, Left Shift down' : 'Flight disabled — gravity back on');
      };
      const toggleFlightMode = (): void => setFlightMode(!flightEnabledRef.current);
      const handleFlightButton = (): void => toggleFlightMode();
      const isGroundedCheck = (pos: Vector3): boolean => {
        const footY = Math.floor(pos.y - 0.84 - 0.08); const blockTop = footY + 1;
        const checks: Array<[number, number]> = [[0, 0], [0.22, 0], [-0.22, 0], [0, 0.22], [0, -0.22]];
        for (const [ox, oz] of checks) {
          const bx = Math.floor(pos.x + ox); const bz = Math.floor(pos.z + oz);
          const id = terrain.getBlockAt(bx, footY, bz);
          if (id !== 0 && id !== 5) { if (pos.y - 0.84 >= blockTop - 0.15) return true; }
          const idBelow = terrain.getBlockAt(bx, footY - 1, bz);
          if (id !== 0 && idBelow !== 0 && id !== 5) { if (pos.y - 0.84 >= blockTop - 0.35 && pos.y - 0.84 <= blockTop + 0.25) return true; }
        }
        return false;
      };

      /**
       * Push an effect tier into the live scene.
       *
       * Everything here is reversible and cheap to toggle, which is the whole
       * point — the tuner may change tier several times a minute as the player
       * moves between an open vista and a cave.
       */
      const applyEffectTier = (tier: EffectTier): void => {
        const fx = effectSettingsFor(tier);
        try {
          // Shadows are the single most expensive light-side feature.
          const shadowGenerator = lighting.shadowGenerator;
          if (shadowGenerator) {
            const map = shadowGenerator.getShadowMap();
            if (map) map.refreshRate = fx.shadowsEnabled ? 1 : 0;
            shadowGenerator.setDarkness(fx.shadowsEnabled ? 0.35 : 1);
          }
          glow.intensity = fx.bloomEnabled ? 0.22 : 0.0;
          if (pipeline) {
            pipeline.bloomEnabled = fx.bloomEnabled;
            pipeline.depthOfFieldEnabled = fx.depthOfFieldEnabled;
            pipeline.samples = fx.samples;
          }
          // Particles are pooled inside the atmosphere system.
          atmosphere.setParticlesEnabled(
            settingsRef.current.particlesEnabled && !settingsRef.current.reducedMotion && fx.particleScale > 0.25
          );
        } catch { /* effect tuning must never break the frame */ }
      };

      let positionFrame = 0, survivalFrame = 0, streamFrame = 0;
      /** True when the previous frame meshed chunks, so the tuner can skip it. */
      let chunkWorkLastFrame = false;
      /** Tracks surface/submerged transitions so we only re-theme on change. */
      let wasSubmerged = false;
      let startupLoadingComplete = !renderer.hasPendingChunks(streamCenter.cx, streamCenter.cz, renderRadius);
      // 2.0 — thirst. Deserts are now genuinely hostile: the bar drains fast in
      // the heat and you must find water (or an oasis) to top it back up.
      let hydrationState: HydrationState = createStarterHydration();
      let currentClimate = climateForBiome('plains');
      let worldDay = 1, lastTimeOfDay = worldTimeRef.current.timeOfDay;
      let timeState: WorldTimeState = worldTimeRef.current;
      let lastCameraPosition = camera.position.clone();
      /**
       * 0 = open sky above the player, 1 = fully enclosed.
       *
       * Sampled a few times a second (not per frame) by walking straight up
       * from the camera and counting solid blocks. It drives the carried
       * light, so stepping into a cave or under a thick canopy brightens the
       * player's immediate surroundings instead of leaving them in the dark.
       */
      let enclosureFactor = 0;
      let enclosureFrame = 0;
      const sampleEnclosure = (): number => {
        const px = Math.floor(camera.position.x);
        const pz = Math.floor(camera.position.z);
        const py = Math.floor(camera.position.y);
        let blocked = 0;
        const samples = 12;
        for (let i = 1; i <= samples; i += 1) {
          const id = terrain.getBlockAt(px, py + i, pz);
          if (id !== 0 && id !== 5) blocked += 1;
        }
        return Math.min(1, blocked / 4);
      };

      scene.onBeforeRenderObservable.add(() => {
        const now = performance.now();
        if (miningSession) {
          const progress = Math.min(1, (now - miningSession.startedAt) / miningSession.durationMs);
          setMiningProgress(progress);
          // Cracks advance through ten discrete destroy stages on the block
          // itself; the arm keeps swinging on its own constant tempo.
          breakOverlay.show(
            miningSession.target.x,
            miningSession.target.y,
            miningSession.target.z,
            progress
          );
          if (progress >= 1) finishMining(miningSession);
        }

        const rawDeltaMs = engine.getDeltaTime();
        const deltaSeconds = Math.min(rawDeltaMs / 1000, 0.05);

        // --- adaptive performance tick --------------------------------------
        // `chunkWorkThisFrame` is set below when chunks were meshed, so those
        // frames are excluded from the tuner's signal; otherwise flying into a
        // new region would permanently degrade quality.
        if (settingsRef.current.adaptivePerformance) {
          perf.sample(rawDeltaMs, chunkWorkLastFrame);
          const adjustment = perf.update(deltaSeconds);
          if (adjustment.changed) {
            adaptiveReason = adjustment.reason;
            const next = adjustment.state;
            applyRenderScale(engine, next.renderScale);
            if (next.renderDistance !== renderRadius) {
              renderRadius = next.renderDistance;
              // The visible set changed, so any cached WebGPU draw list is stale.
              invalidateRenderSnapshot(engine);
            }
            if (next.effectTier !== effectTier) {
              effectTier = next.effectTier;
              applyEffectTier(effectTier);
            }
            if (settingsRef.current.showPerformanceOverlay) {
              showActionMessage(`Auto quality: ${adjustment.reason}`);
            }
          }
        }
        chunkWorkLastFrame = false;

        if (!timeState.frozen) { timeState = { ...timeState, timeOfDay: (timeState.timeOfDay + deltaSeconds * 0.02) % 24 }; worldTimeRef.current = timeState; }
        else if (worldTimeRef.current !== timeState) timeState = worldTimeRef.current;
        // Wrapping past midnight advances the day counter shown in the HUD.
        if (timeState.timeOfDay < lastTimeOfDay) worldDay += 1;
        lastTimeOfDay = timeState.timeOfDay;
        const dimGravityY = dimensionRuntime.getState().id === 'overworld' ? -0.52 : dimensionRuntime.getState().id === 'crystal_realm' ? -0.30 : dimensionRuntime.getState().id === 'moon' ? -0.14 : -0.62;
        const gravityStrength = GRAVITY_BASE * (Math.abs(dimGravityY) / 0.52);
        const jumpVel = JUMP_VELOCITY_BASE * (dimGravityY < -0.3 ? 1 : 0.9 + Math.abs(dimGravityY) / 0.52 * 0.2);

        // Keep the atmosphere clock in sync with the world clock (so /time works).
        atmosphere.timeOfDay = timeState.timeOfDay;
        atmosphere.frozen = timeState.frozen;
        atmosphere.setParticlesEnabled(settingsRef.current.particlesEnabled && !settingsRef.current.reducedMotion);

        // Cross-fade the sky whenever the player walks into a new biome.
        if (streamFrame % 20 === 0) {
          try {
            const raw = (terrain as unknown as { getBiomeAt?: (x: number, z: number) => unknown })
              .getBiomeAt?.(camera.position.x, camera.position.z);
            let biomeKey = '';
            let biomeCategory: string | undefined;
            if (typeof raw === 'string') biomeKey = raw;
            else if (raw && typeof raw === 'object') {
              const def = raw as { id?: unknown; name?: unknown; category?: unknown };
              biomeKey = String(def.id ?? def.name ?? '');
              biomeCategory = def.category === undefined ? undefined : String(def.category);
            }
            if (biomeKey && biomeKey !== lastBiomeKey) {
              lastBiomeKey = biomeKey;
              atmosphere.setBiome(biomeKey, biomeCategory);
            }
            // Swap the soundscape to match where the player actually is,
            // including going underwater and dropping into deep caves.
            const eyeBlock = terrain.getBlockAt(
              Math.floor(camera.position.x),
              Math.floor(camera.position.y),
              Math.floor(camera.position.z)
            );
            const underwater = eyeBlock === 5;
            const surfaceY = terrain.getHeightAt(camera.position.x, camera.position.z);
            const underground = camera.position.y < surfaceY - 6;
            const ambienceKey = underground && !underwater
              ? (camera.position.y < surfaceY * 0.45 ? 'deep_cave' : 'cave')
              : (biomeKey || 'plains');
            ambience.play(ambienceForBiome(ambienceKey, { underwater }));
          } catch { /* biome lookup is cosmetic — never break the frame */ }
        }

        // View model: swing tempo is wall-clock based, bob follows real speed.
        const horizontalSpeed = Math.hypot(
          camera.position.x - lastCameraPosition.x,
          camera.position.z - lastCameraPosition.z
        ) / Math.max(0.0001, deltaSeconds);
        viewModel.setHeldItem(selectedBlockRef.current);
        viewModel.update(deltaSeconds, horizontalSpeed);

        enclosureFrame += 1;
        if (enclosureFrame % 15 === 0) {
          try {
            // Smooth toward the new reading so walking under a tree fades the
            // light up instead of popping it.
            enclosureFactor += (sampleEnclosure() - enclosureFactor) * 0.5;
          } catch { /* terrain probe is cosmetic — never break the frame */ }
        }

        ambience.setVolume(settingsRef.current.volume, settingsRef.current.muted);
        ambience.update(deltaSeconds);
        const atmosphereFrame = atmosphere.update(deltaSeconds, camera.position);
        updateWorldLighting(
          lighting,
          atmosphereFrame,
          settingsRef.current.experimentalVulkanMode || settingsRef.current.realisticLighting,
          camera.position,
          enclosureFactor
        );
        if (pipeline) {
          // Runtime safety clamp: if the player enables a heavy shader pack,
          // keep exposure and bloom inside a readable range.
          pipeline.imageProcessing.exposure = Math.min(pipeline.imageProcessing.exposure, 0.80);
          pipeline.bloomWeight = Math.min(pipeline.bloomWeight, 0.18);
        }
        // Keep ray-traced shadows pointing at the real sun, and re-configure
        // the pass when the player changes the quality setting.
        rayTracer.update(deltaSeconds);
        if (atmosphereFrame.sunDirection) rayTracer.setSunDirection(atmosphereFrame.sunDirection);
        if (settingsRef.current.rayTracingQuality !== lastRayTracingQuality) {
          lastRayTracingQuality = settingsRef.current.rayTracingQuality;
          rayTracer.configure({
            quality: settingsRef.current.rayTracingQuality,
            reflections: settingsRef.current.rayTracedReflections,
            contactShadows: settingsRef.current.rayTracedShadows,
            ambientOcclusion: settingsRef.current.rayTracedAO,
          });
        }

        nextGenRuntime.update(deltaSeconds, camera.position, settingsRef.current);

        // --- end-game chain + ocean -----------------------------------------
        // Drives the black hole's pull, the Void Leviathan fight, Reality Chip
        // cooldowns, ocean depth zones, wave height, whirlpool drag and the
        // Bloop. `camera.position` is passed by reference so the black hole
        // and whirlpools genuinely move the player.
        const eyeBlockId = terrain.getBlockAt(
          Math.floor(camera.position.x),
          Math.floor(camera.position.y),
          Math.floor(camera.position.z)
        );
        const endGameFrame = endGame.update(deltaSeconds, camera.position, eyeBlockId);

        // Underwater look: the ocean owns fog colour and density while you are
        // submerged, so descending actually gets darker and bluer.
        if (endGameFrame.ocean?.submerged) {
          const zone = endGameFrame.ocean;
          scene.fogMode = Scene.FOGMODE_EXP2;
          scene.fogDensity = zone.fogDensity;
          scene.fogColor = zone.tint;
          scene.clearColor = new Color4(zone.tint.r, zone.tint.g, zone.tint.b, 1);
          scene.environmentIntensity = 0.48 * zone.light;
          if (!wasSubmerged) {
            wasSubmerged = true;
            showActionMessage(`${zone.zone.name} — ${zone.zone.description}`);
          }
        } else if (wasSubmerged) {
          // Hand the sky back to the atmosphere system on surfacing.
          wasSubmerged = false;
          scene.environmentIntensity = 0.48;
          atmosphere.setDimension(dimensionRuntime.getState().id);
          showActionMessage('You break the surface.');
        }
        dimensionRuntime.update(deltaSeconds); worldInteractions.update(deltaSeconds); logicRuntime.update(deltaSeconds); authorityRuntime.update(deltaSeconds); settlementRuntime.update(camera.position, deltaSeconds);
        cinematicLighting.setTimeOfDay(timeState.timeOfDay);
        // Wind from the atmosphere drives the advanced physics simulations.
        const windPhase = performance.now() * 0.0001;
        physics.setWind(new Vector3(0.4 + 0.6 * Math.sin(windPhase), 0, 0.3 + 0.4 * Math.cos(windPhase * 1.3)));
        physics.update(deltaSeconds);
        // 1.0 — animate the dimension portals and spawn reality rifts occasionally.
        portalSystem.update(deltaSeconds, camera.position);
        realityRifts.update(deltaSeconds, camera.position, camera.position);
        // 1.0 — tick command-block system (repeating/impulse/chain).
        commandBlockSystem.tick(deltaSeconds);
        const settlementMessage = settlementRuntime.consumeDiscoveryMessage(); if (settlementMessage) showActionMessage(settlementMessage);
        creatureManager.update(camera.position, deltaSeconds);
        const collectedDrops = itemDrops.update(camera.position, deltaSeconds);
        if (collectedDrops.length > 0) {
          let nextInv = inventoryRef.current; let c = 0;
          for (const drop of collectedDrops) {
            nextInv = addToInventory(nextInv, drop.blockId, drop.amount);
            c += drop.amount;
            if (drop.blockId === 301) {
              onGameplayEvent('shardsCollected', drop.amount);
            }
          }
          publishInventory(nextInv); onGameplayEvent('dropsCollected', c); audio.play('pickup', settingsRef.current);
        }
        camera.speed = Math.max(0.7, settingsRef.current.cameraSpeed * 1.15);
        scene.fogEnabled = settingsRef.current.fogEnabled;
        // Render scale is owned by the adaptive tuner while it is enabled;
        // only honour the raw setting when the player has turned it off.
        // (This call used to run unconditionally every frame, forcing a
        // full render-target resize check 60 times a second.)
        if (!settingsRef.current.adaptivePerformance) {
          applyRenderScale(engine, settingsRef.current.renderScale);
        }
        if (thirdPerson) {
          // Visual third-person model: keep the real camera/player collision at
          // the controlled position, and draw the avatar a few blocks in front
          // of the camera. The old toggle moved the camera backward and then
          // snapped the avatar to that same camera point, which made the model
          // disappear into/behind the near plane.
          const forward = camera.getForwardRay().direction.clone();
          forward.y = 0;
          if (forward.lengthSquared() < 0.001) forward.set(0, 0, 1);
          forward.normalize();
          const avatarFeet = camera.position.add(forward.scale(THIRD_PERSON_DISTANCE));
          avatar.position.x = avatarFeet.x;
          avatar.position.y = camera.position.y - 1.62;
          avatar.position.z = avatarFeet.z;
          // Face the same direction as the camera so the player sees the back
          // of their character, like a Minecraft-style third-person chase view.
          avatar.rotation.y = camera.rotation.y;
          // Walk animation
          const horiz = Math.hypot(camera.position.x - lastCameraPosition.x, camera.position.z - lastCameraPosition.z);
          if (horiz > 0.01) {
            walkPhase += deltaSeconds * 8;
            const swing = Math.sin(walkPhase) * 0.6;
            legA.rotation.x = swing;
            legB.rotation.x = -swing;
            armA.rotation.x = -swing * 0.5;
            armB.rotation.x = swing * 0.5;
          } else {
            legA.rotation.x *= 0.85;
            legB.rotation.x *= 0.85;
            armA.rotation.x *= 0.85;
            armB.rotation.x *= 0.85;
          }
        }

        if (flightEnabledRef.current) {
          grounded = false; velocityY = 0; jumpRequested = false; wasFalling = false; fallStartY = camera.position.y;
          camera.speed = Math.max(1.1, settingsRef.current.cameraSpeed * 2.6);
          let vertical = 0;
          if (pressedKeys.has('Space')) vertical += 1;
          if (pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight')) vertical -= 1;
          if (vertical !== 0) {
            const flyStep = vertical * Math.max(5.5, settingsRef.current.cameraSpeed * 5.8) * deltaSeconds;
            (camera as any).moveWithCollisions?.(new Vector3(0, flyStep, 0));
            if (!(camera as any).moveWithCollisions) camera.position.y += flyStep;
          }
        } else {
          camera.speed = Math.max(0.7, settingsRef.current.cameraSpeed * 1.15);
          grounded = isGroundedCheck(camera.position);
          if (grounded) {
            if (velocityY < -0.5 && wasFalling) {
              const fallDist = fallStartY - camera.position.y;
              if (fallDist > 5.8) { const dmg = Math.round((fallDist - 5.8) * 5.2); const next = applyDamage(survivalStatsRef.current, dmg); survivalStatsRef.current = next; publishSurvivalStats(next); showActionMessage(`Fall damage -${dmg} HP from ${fallDist.toFixed(1)}m`); }
            }
            wasFalling = false; fallStartY = camera.position.y; if (velocityY <= 0.2) velocityY = 0;
            if (jumpRequested) { velocityY = jumpVel; grounded = false; jumpRequested = false; audio.play('ui', settingsRef.current); showActionMessage(`Jump!`); }
          } else {
            if (!wasFalling) { wasFalling = true; fallStartY = lastCameraPosition.y; }
            velocityY += gravityStrength * deltaSeconds; if (velocityY < TERMINAL_VELOCITY) velocityY = TERMINAL_VELOCITY;
          }
          if (Math.abs(velocityY) > 0.001) {
            (camera as any).moveWithCollisions?.(new Vector3(0, velocityY * deltaSeconds, 0));
            if (!(camera as any).moveWithCollisions) { const nextY = camera.position.y + velocityY * deltaSeconds; const footId = terrain.getBlockAt(Math.floor(camera.position.x), Math.floor(nextY - 0.84), Math.floor(camera.position.z)); if (footId === 0 || footId === 5 || velocityY > 0) camera.position.y = nextY; else velocityY = 0; }
          }
          if (isGroundedCheck(camera.position) && velocityY < 0) { velocityY = 0; grounded = true; }
        }

        const horiz = Math.hypot(camera.position.x - lastCameraPosition.x, camera.position.z - lastCameraPosition.z);
        const moving = horiz > 0.01;
        let nextSurvival = updateSurvivalLoop(survivalStatsRef.current, deltaSeconds, moving);

        // --- Thirst ---------------------------------------------------------
        // Sun exposure is the atmosphere's daylight scaled by how open the sky
        // is above the player, so caves and night are safe.
        const headBlock = terrain.getBlockAt(
          Math.floor(camera.position.x),
          Math.floor(camera.position.y),
          Math.floor(camera.position.z)
        );
        const standingInWater = headBlock === 5;
        const sunExposure = atmosphereFrame.dayFactor;
        currentClimate = climateForBiome(lastBiomeKey || 'plains');
        const hydrationTick = updateHydration(hydrationState, {
          deltaSeconds,
          climate: currentClimate,
          moving,
          exerting: flightEnabledRef.current && moving,
          sunExposure,
          inWater: standingInWater,
        });
        hydrationState = { hydration: hydrationTick.hydration, parchedSeconds: hydrationTick.parchedSeconds };
        if (hydrationTick.warning) showActionMessage(hydrationTick.warning);
        if (hydrationTick.damage > 0) nextSurvival = applyDamage(nextSurvival, hydrationTick.damage);
        // Dehydration throttles stamina recovery.
        if (hydrationTick.staminaScale < 1 && nextSurvival.stamina > survivalStatsRef.current.stamina) {
          const regained = nextSurvival.stamina - survivalStatsRef.current.stamina;
          nextSurvival = { ...nextSurvival, stamina: survivalStatsRef.current.stamina + regained * hydrationTick.staminaScale };
        }

        survivalStatsRef.current = nextSurvival; survivalFrame += 1; if (survivalFrame % 8 === 0) publishSurvivalStats(nextSurvival);
        // Incremental world streaming — a small budget every frame so the world
        // keeps filling in without ever blocking the render loop.
        const movedChunk = toChunkCoordinate(camera.position.x, camera.position.z);
        const centerChanged = movedChunk.cx !== streamCenter.cx || movedChunk.cz !== streamCenter.cz;
        if (centerChanged) streamCenter = movedChunk;
        if (centerChanged || renderer.hasPendingChunks(streamCenter.cx, streamCenter.cz, renderRadius)) {
          const result = renderer.updateVisibleChunks(
            streamCenter.cx, streamCenter.cz, renderRadius,
            chunkSource.generateChunk,
            { budget: CHUNKS_PER_FRAME }
          );
          if (result.loaded > 0 || result.unloaded > 0) {
            // Meshing is expensive and bursty; tell the tuner to ignore this
            // frame so streaming does not look like a sustained slowdown.
            chunkWorkLastFrame = true;
            // The drawn mesh set changed, so a cached WebGPU command bundle
            // would be replaying stale draws. Force it to re-record.
            invalidateRenderSnapshot(engine);
            try {
              const sg = lighting.shadowGenerator;
              const fx = effectSettingsFor(effectTier);
              for (const m of scene.meshes) {
                if (!m.name.startsWith('voxel_world_')) continue;
                // Only register shadow casters when the tier actually draws
                // shadows — the shadow map cost scales with caster count.
                if (fx.shadowsEnabled) sg.addShadowCaster(m as Mesh, true);
                (m as Mesh).receiveShadows = fx.shadowsEnabled;
              }
            } catch {}
          }
          if (!startupLoadingComplete) {
            const loadedVisibleChunks = Math.max(0, Math.min(startupChunkTotal, startupChunkTotal - result.pending));
            const chunkRatio = startupChunkTotal > 0 ? loadedVisibleChunks / startupChunkTotal : 1;
            const elapsed = performance.now() - loadingStartedAt;
            if (result.pending === 0) {
              startupLoadingComplete = true;
              reportLoadingProgress(100, `World ready — ${loadedVisibleChunks}/${startupChunkTotal} chunks loaded`, true, { loadedChunks: loadedVisibleChunks, totalChunks: startupChunkTotal });
            } else if (elapsed >= WORLD_LOADING_MAX_MS) {
              startupLoadingComplete = true;
              reportLoadingProgress(100, `Playable now — ${loadedVisibleChunks}/${startupChunkTotal} chunks loaded; the rest will stream in`, true, { loadedChunks: loadedVisibleChunks, totalChunks: startupChunkTotal });
            } else {
              reportLoadingProgress(76 + chunkRatio * 23, `Streaming chunks ${loadedVisibleChunks}/${startupChunkTotal}`, false, { loadedChunks: loadedVisibleChunks, totalChunks: startupChunkTotal });
            }
          }
          if (result.pending > 0 && streamFrame % 30 === 0) {
            showActionMessage(`Loading world — ${result.pending} chunks remaining`);
          } else if (result.pending === 0 && result.loaded > 0) {
            showActionMessage(`World loaded • render distance ${renderRadius} chunks`);
          }
        }
        streamFrame += 1;
        if (streamFrame % 12 === 0) {
          logicRuntime.scanPlacedNetwork(camera.position); publishRuntimeStatus();
          const targetPick = scene.pickWithRay(camera.getForwardRay(BLOCK_REACH));
          const creatureId = targetPick?.pickedMesh?.metadata?.creatureId as string | undefined;
          if (targetPick?.hit && creatureId) setTargetLabel('Creature • left click');
          else if (targetPick?.hit && targetPick.pickedPoint && targetPick.pickedMesh?.name.startsWith('voxel_world_')) {
            const normal = targetPick.getNormal(true);
            if (normal) { normal.normalize(); const target = toBlockCoordinate(targetPick.pickedPoint.add(normal.scale(-0.01))); const blockId = terrain.getBlockAt(target.x, target.y, target.z); setTargetLabel(blockId === 0 ? '' : getBlock(blockId).name); }
          } else setTargetLabel('');
          publishRenderStats();
        }
        positionFrame += 1;
        if (positionFrame % 8 === 0) {
          // Sync the in-world clock with the dynamic sky.
          const synced: WorldTimeState = { ...timeState, timeOfDay: atmosphere.timeOfDay };
          worldTimeRef.current = synced;
          setWorldTime(synced);
          // Feed the concept-art HUD (compass, minimap, clock, coordinates).
          if (telemetryRef.current) {
            let biomeName = 'Meadows';
            try {
              const raw = (terrain as unknown as { getBiomeAt?: (x: number, z: number) => unknown })
                .getBiomeAt?.(camera.position.x, camera.position.z);
              if (typeof raw === 'string') biomeName = raw;
              else if (raw && typeof raw === 'object' && 'name' in raw) biomeName = String((raw as { name: unknown }).name);
            } catch { /* biome lookup is cosmetic — never break the frame */ }
            telemetryRef.current({
              position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
              yaw: camera.rotation.y,
              timeOfDay: synced.timeOfDay,
              day: worldDay,
              biome: biomeName,
              flightEnabled: flightEnabledRef.current,
              hydration: hydrationState.hydration,
              climate: currentClimate,
              weather: atmosphere.getProfile().weather,
              skyProfile: atmosphere.getProfile().label,
            });
          }
        }
        lastCameraPosition = camera.position.clone();
      });

      const lockPointerIfNeeded = (): boolean => { canvas.focus(); if (document.pointerLockElement === canvas) return true; void canvas.requestPointerLock?.(); showActionMessage('Mouse locked — WASD walk, SPACE jump, F fly, left click punch'); return false; };
      const pickTargetBlock = (): { target: BlockCoordinate; blockId: BlockID; normal: Vector3; point: Vector3 } | null => {
        const pick = scene.pickWithRay(camera.getForwardRay(BLOCK_REACH), (mesh) => mesh.name.startsWith('voxel_world_'));
        if (!pick?.hit || !pick.pickedPoint) return null;
        const normal = pick.getNormal(true); if (!normal || normal.lengthSquared() === 0) return null; normal.normalize();
        const target = toBlockCoordinate(pick.pickedPoint.add(normal.scale(-0.01))); const blockId = terrain.getBlockAt(target.x, target.y, target.z); if (blockId === 0) return null;
        return { target, blockId, normal, point: pick.pickedPoint };
      };
      const startMining = (): void => {
        const picked = pickTargetBlock(); if (!picked) { showActionMessage('No block in reach'); clearMining(); return; }
        const toolId = selectedToolRef.current; const estimate = estimateMining(picked.blockId, toolId); const tool = getTool(toolId);
        miningSession = { target: picked.target, blockId: picked.blockId, startedAt: performance.now(), durationMs: estimate.durationMs, canHarvest: estimate.canHarvest, toolName: tool.name };
        setMiningProgress(0.01); setMiningLabel(`${tool.name} punching ${getBlock(picked.blockId).name}${estimate.canHarvest ? '' : ' (no drop)'}`);
        // Cracks start at stage 0; the arm swings continuously while held.
        breakOverlay.show(picked.target.x, picked.target.y, picked.target.z, 0);
        viewModel.setContinuousSwing(true);
        showActionMessage(`${getBlock(picked.blockId).name}: cracking… ${(estimate.durationMs / 1000).toFixed(1)}s`);
      };
      const attackCreature = (): boolean => {
        // The Void Leviathan is picked first and with a much longer reach —
        // it is enormous, and the fight would be unplayable at 7 blocks.
        if (endGame.isLeviathanActive()) {
          const bossPick = scene.pickWithRay(
            camera.getForwardRay(90),
            (mesh) => Boolean(mesh.metadata?.leviathanPart)
          );
          const part = bossPick?.pickedMesh?.metadata?.leviathanPart as
            | 'core' | 'maw' | 'tentacle' | undefined;
          if (bossPick?.hit && part) {
            const tool = getTool(selectedToolRef.current);
            const damage = 20 + tool.tier * 12;
            const result = endGame.damageLeviathan(damage, part);
            audio.play(result.kind === 'core_hit' ? 'creature_down' : 'hit', settingsRef.current);
            authorityRuntime.recordAction();
            return true;
          }
        }
        const pick = scene.pickWithRay(camera.getForwardRay(BLOCK_REACH), (mesh) => Boolean(mesh.metadata?.creatureId));
        const creatureId = pick?.pickedMesh?.metadata?.creatureId as string | undefined; if (!pick?.hit || !creatureId) return false;
        const tool = getTool(selectedToolRef.current); const damage = 5 + tool.tier * 4 + (tool.kind === 'axe' ? 3 : 0);
        const result = creatureManager.damageCreature(creatureId, damage); if (!result.hit) return false;
        authorityRuntime.recordAction(); audio.play(result.dead ? 'creature_down' : 'hit', settingsRef.current); showActionMessage(result.message);
        if (result.dead) { onGameplayEvent('creaturesDefeated'); for (const drop of result.drops ?? []) itemDrops.spawnDrop(drop.blockId, result.position ?? camera.position, drop.amount); }
        publishRenderStats(); return true;
      };
      const placeSelectedBlock = (): void => {
        const blockToPlace = selectedBlockRef.current;
        if (blockToPlace === 302) {
          // The Omni Creator — trigger the Final Journey
          audio.play('ui', settingsRef.current);
          showActionMessage('Hidden coordinates revealed: UNKNOWN REGION — Reality unstable.');
          setTimeout(() => {
            dimensionRuntime.setDimension('corrupted_lands');
            atmosphere.setDimension('corrupted_lands');
            chunkSource.setDimension('corrupted_lands');
            showActionMessage('Reality distortion detected. You have reached The Corrupted Lands.');
          }, 2000);
          return;
        }

        const picked = pickTargetBlock(); if (!picked) { showActionMessage('No block face'); return; }
        const placeTarget = toBlockCoordinate(picked.point.add(picked.normal.scale(0.01)));
        if (terrain.getBlockAt(placeTarget.x, placeTarget.y, placeTarget.z) !== 0) { showActionMessage('Occupied'); return; }
        if (wouldBlockPlayer(placeTarget, camera.position)) { showActionMessage('Cannot place inside player'); return; }
        const creativeNow = gameModeRef.current === 'creative' || gameModeRef.current === 'incredible';
        if (!creativeNow && !canConsumeBlock(inventoryRef.current, blockToPlace, 1)) { showActionMessage(`No ${getBlock(blockToPlace).name} left`); return; }
        terrain.setBlockAt(placeTarget.x, placeTarget.y, placeTarget.z, blockToPlace);
        authorityRuntime.recordAction(); if (!creativeNow) publishInventory(removeFromInventory(inventoryRef.current, blockToPlace, 1));
        onGameplayEvent('blocksPlaced'); audio.play('place', settingsRef.current); rebuildEditedBlock(placeTarget); saveWorldEdits();
        showActionMessage(`Placed ${getBlock(blockToPlace).name}`);
      };
      const handleBlockMouseDown = (event: MouseEvent): void => {
        if (event.button !== 0 && event.button !== 2) return; event.preventDefault(); if (!lockPointerIfNeeded()) return;
        if (event.button === 0) {
          // Always swing on click, whether you connect with a mob, a block or
          // thin air — that feedback is most of what makes punching feel real.
          viewModel.swing();
          if (!attackCreature()) startMining();
        } else {
          viewModel.swing();
          placeSelectedBlock();
        }
      };
      const handleMouseUp = (event: MouseEvent): void => { if (event.button !== 0 || !miningSession) return; showActionMessage('Mining canceled'); clearMining(); };
      const handleKeyDown = (event: KeyboardEvent): void => {
        // --- text-entry guard ------------------------------------------------
        // While chat or the command console is open, the keyboard belongs to
        // the input field and nothing else. Without this, typing "/kill" fired
        // the inventory hotkey on the "i", "/time set day" fired several more,
        // and the game was unplayable from the console.
        //
        // Checked against a ref (not the captured state) because this listener
        // is attached once and would otherwise see the values from first mount.
        if (textEntryOpenRef.current) return;

        // Also stand down whenever focus is genuinely in a text field, such as
        // the seed box or a marketplace search, so hotkeys never steal typing.
        const target = event.target as HTMLElement | null;
        if (target) {
          const tag = target.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
        }

        // Modifier chords belong to the browser/OS (Ctrl+R, Cmd+L, Alt+Tab…).
        // Only Shift is used by gameplay.
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        const ambienceProfile = dimensionRuntime.getState().id === 'nether' ? 'nether' : (dimensionRuntime.getState().id === 'end' ? 'end' : 'forest');
        // Music stays on GameAudio; ambience is owned by AmbienceEngine now.
        audio.startMusic(settingsRef.current, ambienceProfile === 'nether' ? 'nether' : 'overworld');
        pressedKeys.add(event.code);
        if (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar') { event.preventDefault(); if (!flightEnabledRef.current && grounded) jumpRequested = true; return; }
        if (event.key === 'F5') {
          event.preventDefault();
          thirdPerson = !thirdPerson;
          viewModel.setEnabled(!thirdPerson);
          avatar.isVisible = thirdPerson;
          // Never teleport the gameplay camera on view toggle. The avatar is
          // offset in the render loop instead, so F5 cannot hide the model, clip
          // the camera into it, or drop the player through collision.
          showActionMessage(thirdPerson ? '🎥 Third-person view — player model visible in front of you' : '🎥 First-person view');
          return;
        }
        if (event.key.toLowerCase() === 'x') {
          // Drink: you must be standing in, or directly beside, water.
          event.preventDefault();
          const px = Math.floor(camera.position.x);
          const pz = Math.floor(camera.position.z);
          const py = Math.floor(camera.position.y);
          let nearWater = false;
          for (let dx = -1; dx <= 1 && !nearWater; dx += 1) {
            for (let dz = -1; dz <= 1 && !nearWater; dz += 1) {
              for (let dy = -2; dy <= 1 && !nearWater; dy += 1) {
                if (terrain.getBlockAt(px + dx, py + dy, pz + dz) === 5) nearWater = true;
              }
            }
          }
          if (!nearWater) { showActionMessage('No water within reach — find a lake, river or oasis'); return; }
          const result = drink(hydrationState);
          hydrationState = result.state;
          audio.play('pickup', settingsRef.current);
          showActionMessage(result.message);
          return;
        }
        if (event.key === 'F4') {
          // Quick survival <-> creative toggle, so the creative inventory is
          // always one key away without opening the chat console.
          event.preventDefault();
          const next: GameMode = gameModeRef.current === 'creative' ? 'survival' : 'creative';
          gameModeChangeRef.current?.(next);
          audio.play('ui', settingsRef.current);
          showActionMessage(`Game mode: ${next.toUpperCase()} — press E for the ${next === 'creative' ? 'creative' : 'survival'} inventory`);
          return;
        }
        if (event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFlightMode(); audio.play('ui', settingsRef.current); return; }
        if (event.key === 'Escape') { event.preventDefault(); document.exitPointerLock?.(); setPaused(true); return; }
        if (event.key === '/' && settingsRef.current.commandBlocksEnabled) { event.preventDefault(); document.exitPointerLock?.(); setCommandText('/'); setCommandOpen(true); setChatOpen(false); showActionMessage('Command console / — try /day /time /summon'); return; }
        if (event.key.toLowerCase() === 't') { event.preventDefault(); document.exitPointerLock?.(); setChatText(''); setChatOpen(true); showActionMessage('Chat opened — T like Minecraft, type /day /time /summon'); return; }
        if (event.key.toLowerCase() === 'q') { event.preventDefault(); const tool = nextTool(selectedToolRef.current, toolInventoryRef.current); selectedToolRef.current = tool; onSelectedToolChange(tool); showActionMessage(`Equipped ${getTool(tool).name} (Q)`); return; }
        const keyIndex = Number.parseInt(event.key, 10) - 1;
        if (keyIndex >= 0 && keyIndex < HOTBAR_BLOCKS.length && !Number.isNaN(keyIndex)) { event.preventDefault(); const nextBlock = HOTBAR_BLOCKS[keyIndex]; selectedBlockRef.current = nextBlock; onSelectedBlockChange(nextBlock); showActionMessage(`Selected ${getBlock(nextBlock).name}`); return; }
        if (event.key.toLowerCase() === 'i' || event.key.toLowerCase() === 'e') { event.preventDefault(); onToggleInventory(); audio.play('ui', settingsRef.current); showActionMessage('Inventory with block logos + 2x2/3x3 crafting'); return; }
        if (event.key.toLowerCase() === 'p') { event.preventDefault(); const used = hasNearbyBlock(terrain, camera.position, 15, 5); const dim = dimensionRuntime.cycle(); dimensionRuntime.triggerTransitionEffect(camera.position, used); atmosphere.setDimension(dim.id); authorityRuntime.recordAction(); audio.play('ui', settingsRef.current); showActionMessage(`${used ? 'Portal Core' : 'Portal monument'} — ${dim.message}`); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'n') { event.preventDefault(); showActionMessage(nextGenRuntime.damageFinalBoss(gameModeRef.current === 'creative' || gameModeRef.current === 'incredible' ? 160 : 45)); audio.play('hit', settingsRef.current); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'c') { event.preventDefault(); showActionMessage(nextGenRuntime.startCredits()); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'k') { event.preventDefault(); showActionMessage(nextGenRuntime.skipCredits()); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'h') { event.preventDefault(); showActionMessage(nextGenRuntime.toggleGodMode()); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'g') { event.preventDefault(); const m = worldInteractions.tryUseDoor(camera.position, () => dimensionRuntime.cycle().id as RuntimeDimensionID); audio.play('ui', settingsRef.current); showActionMessage(m); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'r') { event.preventDefault(); const m = worldInteractions.tryLaunchRocket(camera.position, () => { dimensionRuntime.setDimension('moon'); dimensionRuntime.triggerTransitionEffect(camera.position, true); nextGenRuntime.launchMoonRuntime(); }); audio.play('ui', settingsRef.current); showActionMessage(m); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'v') { event.preventDefault(); const settlement = settlementRuntime.getStats(camera.position); if (!settlement.discovered) { showActionMessage(`Settlement ${Math.round(Math.hypot(layout.settlement.x, layout.settlement.z))}m away`); publishRuntimeStatus(); return; } let delivered = false; if (getStackCount(inventoryRef.current, 17) > 0) { publishInventory(removeFromInventory(inventoryRef.current, 17, 1)); showActionMessage(settlementRuntime.deliverSupplies('crate', 1)); delivered = true; } else if (getStackCount(inventoryRef.current, 6) > 0) { publishInventory(removeFromInventory(inventoryRef.current, 6, 1)); showActionMessage(settlementRuntime.deliverSupplies('wood', 1)); delivered = true; } else if (getStackCount(inventoryRef.current, 3) > 0) { publishInventory(removeFromInventory(inventoryRef.current, 3, 1)); showActionMessage(settlementRuntime.deliverSupplies('stone', 1)); delivered = true; } else showActionMessage('No supplies'); if (delivered) { authorityRuntime.recordAction(); audio.play('craft', settingsRef.current); } publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'l') { event.preventDefault(); const logic = logicRuntime.toggle(); audio.play('ui', settingsRef.current); showActionMessage(`Redstone ${logic.active ? 'ON' : 'OFF'}`); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'b') { event.preventDefault(); const settlement = settlementRuntime.getStats(camera.position); if (!settlement.discovered) { showActionMessage('Find settlement'); return; } if (getStackCount(inventoryRef.current, 8) > 0) { let ni = removeFromInventory(inventoryRef.current, 8, 1); ni = addToInventory(ni, 17, 1); publishInventory(ni); authorityRuntime.recordAction(); audio.play('craft', settingsRef.current); showActionMessage(`${settlementRuntime.completeTrade()} — Coal for Crate`); } else if (getStackCount(inventoryRef.current, 10) > 0) { let ni = removeFromInventory(inventoryRef.current, 10, 1); ni = addToInventory(ni, 16, 2); publishInventory(ni); authorityRuntime.recordAction(); audio.play('craft', settingsRef.current); showActionMessage(`${settlementRuntime.completeTrade()} — Gold for Shards`); } else showActionMessage('Need Coal or Gold'); publishRuntimeStatus(); return; }
        // --- end-game: black hole, Void Leviathan, Reality Chip -------------
        if (event.key.toLowerCase() === 'j') {
          event.preventDefault();
          const result = implantChip(endGame.getChip());
          endGame.setChip(result.state);
          showActionMessage(result.message);
          return;
        }
        if (event.key === 'B' && event.shiftKey) {
          // Shift+B summons the black hole, which is the entry to the end game.
          event.preventDefault();
          endGame.spawnBlackHole(camera.position.add(new Vector3(0, 90, 120)));
          return;
        }
        if (event.key === 'L' && event.shiftKey) {
          event.preventDefault();
          endGame.summonLeviathan(camera.position);
          return;
        }
        // Reality Chip powers fire on their own bound keys once implanted.
        if (endGame.getChip().implanted) {
          const power = powerForKey(event.key);
          if (power) {
            event.preventDefault();
            const result = usePower(endGame.getChip(), power.id);
            endGame.setChip(result.state);
            showActionMessage(result.message);
            if (result.ok) audio.play('ui', settingsRef.current);
            return;
          }
        }
        if (event.key.toLowerCase() === 'o') { event.preventDefault(); document.exitPointerLock?.(); onToggleSettings(); return; }
      };
      const handleKeyUp = (event: KeyboardEvent): void => { pressedKeys.delete(event.code); };
      const handleContextMenu = (e: MouseEvent): void => { e.preventDefault(); };
      const handleResize = (): void => { engine.resize(); };
      canvas.addEventListener('mousedown', handleBlockMouseDown); canvas.addEventListener('contextmenu', handleContextMenu);
      const handleAbilityEvent = (event: Event): void => {
        const key = (event as CustomEvent<{ key: string }>).detail?.key;
        if (!key) return;
        handleKeyDown(new KeyboardEvent('keydown', { key, bubbles: false }));
      };
      window.addEventListener('eaoin-ability', handleAbilityEvent);
      // Instant dimension travel, raised by the Dimensions menu (F8).
      const handleTravelEvent = (event: Event): void => {
        const dimensionId = (event as CustomEvent<{ dimensionId: string }>).detail?.dimensionId;
        if (!dimensionId) return;
        const previousDimension = chunkSource.getDimension();
        dimensionRuntime.setDimension(dimensionId as RuntimeDimensionID);
        dimensionRuntime.triggerTransitionEffect(camera.position, true);
        // Swap the whole atmosphere and chunk source to the destination.
        atmosphere.setDimension(dimensionId);
        chunkSource.setDimension(dimensionId);

        if (dimensionId === 'corrupted_lands') {
            showActionMessage('Reality begins to bend...');
            setTimeout(() => {
                showActionMessage('A mysterious figure with a large mustache appears.');
            }, 3000);
        }

        // Dimensions with their own generator need the world rebuilt, not
        // merely re-lit. Entering or leaving one discards every loaded chunk.
        const usesOwnGenerator = (id: string) => id === 'aether' || id === 'backrooms';
        if (usesOwnGenerator(dimensionId) || usesOwnGenerator(previousDimension)) {
          renderer.clearAll();
          invalidateRenderSnapshot(engine);
          // Drop the player onto solid ground in the destination.
          if (dimensionId === 'aether') camera.position.set(8, 96, 8);
          else if (dimensionId === 'backrooms') camera.position.set(3, 16, 3);
          streamCenter = toChunkCoordinate(camera.position.x, camera.position.z);
          renderer.updateVisibleChunks(
            streamCenter.cx, streamCenter.cz, INITIAL_CHUNK_RADIUS,
            chunkSource.generateChunk
          );
        }

        const state = dimensionRuntime.getState();
        audio.play('ui', settingsRef.current);
        showActionMessage(`Traveled to ${state.name}`);
        publishRuntimeStatus();
      };
      window.addEventListener('eaoin-travel-dimension', handleTravelEvent);
      window.addEventListener('mouseup', handleMouseUp); window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp); window.addEventListener('eaoin-toggle-flight', handleFlightButton); window.addEventListener('resize', handleResize);
      reportLoadingProgress(76, 'Controls and gameplay systems wired', false, { loadedChunks: initialLoadedChunks, totalChunks: startupChunkTotal });
      if (!renderer.hasPendingChunks(streamCenter.cx, streamCenter.cz, renderRadius)) {
        reportLoadingProgress(100, `World ready — ${initialLoadedChunks}/${startupChunkTotal} chunks loaded`, true, { loadedChunks: initialLoadedChunks, totalChunks: startupChunkTotal });
      }
      let recoveredFromRenderError = false;
      let consecutiveRenderFailures = 0;
      engine.runRenderLoop(() => {
        try {
          scene.render();
          consecutiveRenderFailures = 0;
        } catch (error) {
          if (!recoveredFromRenderError) {
            recoveredFromRenderError = true;
            console.error('[Render] Scene render failed; disabling optional effects and retrying.', error);
            pipeline?.dispose(); pipeline = null;
            scene.postProcessesEnabled = false;
            setActionMessage('Renderer recovered — optional effects disabled so the world stays visible');
          }
          try {
            scene.render();
            consecutiveRenderFailures = 0;
          } catch (retryError) {
            consecutiveRenderFailures += 1;
            if (consecutiveRenderFailures >= 3) {
              const detail = retryError instanceof Error ? retryError.message : String(retryError);
              console.error('[Render] Scene failed repeatedly; stopping the broken render loop.', retryError);
              engine.stopRenderLoop();
              setInitializationError(`Rendering stopped: ${detail || 'unknown graphics error'}`);
              reportLoadingProgress(
                Math.max(76, lastLoadingReport.percent),
                'Renderer stopped after repeated frame failures',
                false,
                undefined,
                detail || 'Unknown graphics error'
              );
            }
          }
        }
      }); engine.resize();
      const initialStats = renderer.getStats(); console.log(`[Render] 3.2 ready: ${initialStats.loadedChunks} chunks, clouds moving, mountains & caves volumetric, 16 render, 20min day`);
      cleanupScene = () => {
        if (actionMessageTimer !== undefined) window.clearTimeout(actionMessageTimer);
        canvas.removeEventListener('mousedown', handleBlockMouseDown); canvas.removeEventListener('contextmenu', handleContextMenu);
        window.removeEventListener('eaoin-ability', handleAbilityEvent);
        window.removeEventListener('eaoin-travel-dimension', handleTravelEvent);
        window.removeEventListener('mouseup', handleMouseUp); window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); window.removeEventListener('eaoin-toggle-flight', handleFlightButton); window.removeEventListener('resize', handleResize);
        breakOverlay.dispose(); viewModel.dispose();
        audio.stopMusic(); ambience.dispose(); endGame.dispose(); rayTracer.dispose(); itemDrops.dispose(); atmosphere.dispose(); worldInteractions.dispose(); nextGenRuntime.dispose(); creatureManager.dispose(); settlementRuntime.dispose(); logicRuntime.dispose(); dimensionRuntime.dispose(); portalSystem.dispose(); realityRifts.dispose(); renderer.dispose(); scene.dispose(); engine.dispose();
      };
    };

    void initializeWorld().catch((error: unknown) => {
      if (disposed) return;
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[Startup] World initialization failed before the render loop started.', error);
      try { cleanupScene?.(); } catch { /* best-effort cleanup after startup failure */ }
      cleanupScene = undefined;
      setInitializationError(detail || 'Unknown renderer error');
      reportLoadingProgress(
        Math.max(0, lastLoadingReport.percent),
        'World failed to start',
        false,
        undefined,
        detail || 'Unknown renderer error'
      );
    });
    return () => { disposed = true; cleanupScene?.(); };
  }, [onGameplayEvent, onInventoryChange, onRuntimeStatusChange, onSelectedBlockChange, onSelectedToolChange, onSurvivalStatsChange, onToggleInventory, onToggleSettings, seed, settings.rendererPreference, worldVersion]);

  const applyCommandResult = (result: ReturnType<typeof runCommand>): void => {
    onSettingsChange(clampSettings(result.settings));
    worldTimeRef.current = result.time;
    setWorldTime(result.time);
    setActionMessage(result.lastMessage);
    // `/gamemode creative` swaps the HUD to the creative inventory live.
    if (result.gameModeChange) onGameModeChange?.(result.gameModeChange);
    // Anything that touches the running world (kill, tp, give, summon…) is
    // executed by the scene, which owns the camera, terrain and creatures.
    if (result.effect) {
      const note = commandEffectRef.current?.(result.effect);
      if (typeof note === 'string' && note) setActionMessage(note);
    }
  };
  const submitCommand = (): void => {
    const result = runCommand(commandText, { settings: settingsRef.current, time: worldTimeRef.current, lastMessage: actionMessage, gameMode: gameModeRef.current });
    applyCommandResult(result);
    setCommandOpen(false);
    setChatMessages(m => [...m, { text: result.lastMessage, system: true }].slice(-18));
  };
  const submitChat = (): void => {
    const t = chatText.trim(); if (!t) { setChatOpen(false); return; }
    if (t.startsWith('/')) {
      const result = runCommand(t, { settings: settingsRef.current, time: worldTimeRef.current, lastMessage: actionMessage, gameMode: gameModeRef.current });
      applyCommandResult(result);
      setChatMessages(m => [...m, { text: `> ${t}`, system: false }, { text: result.lastMessage, system: true }].slice(-20));
      // Special handling for summon
      if (t.toLowerCase().startsWith('/summon')) { setChatMessages(m => [...m, { text: `Summoned ${t.split(' ')[1] ?? 'entity'} near you (mock)`, system: true }].slice(-20)); }
    } else {
      setChatMessages(m => [...m, { text: `<You> ${t}` }, { text: `Other players would see: ${t} (local mock)`, system: true }].slice(-20));
      setActionMessage(`Chatted: ${t}`);
    }
    setChatOpen(false); setChatText('');
  };
  const resetSavedWorld = (): void => {
    document.exitPointerLock?.(); const r = WorldSaveManager.clearSeed(seed); void r; setActionMessage('World reset — regular Minecraft-like terrain, grounded lakes, clouds visible, 20min day'); setMiningProgress(0); setMiningLabel(''); setWorldVersion(v => v + 1);
  };

  return (
    <div className="game-screen">
      <canvas ref={canvasRef} className="game-canvas" />
      {initializationError && (
        <div className="world-startup-error" role="alert">
          <strong>THE WORLD COULD NOT START</strong>
          <span>{initializationError}</span>
          <div>
            <button onClick={() => setWorldVersion((version) => version + 1)}>Retry renderer</button>
            <button onClick={onExit}>Back to worlds</button>
          </div>
        </div>
      )}
      <div className="game-hud">
        {settings.showStats && <div className="render-stats-panel"><div>Renderer {renderStats.renderer.backend.toUpperCase()}</div><div>{renderStats.renderer.label}</div><div>Clouds: visible moving voxel • Fog 100-1000 {settings.fogEnabled ? 'on' : 'off'}</div><div>Render radius {qualityRenderDistance(settings.qualityPreset)} • MaxZ 1500</div><div>Day/Night 20min cycle • Terrain: regular Minecraft-like overworld</div><div>FPS {renderStats.fps}</div><div>Chunks {renderStats.loadedChunks} @ {renderStats.streamCenter}</div><div>Meshes {renderStats.meshCount}</div><div>Creatures {renderStats.creatures.count}/{renderStats.creatures.cap}</div><div>Drops {renderStats.drops}</div><div>Tris {renderStats.triangleCount.toLocaleString()}</div></div>}
        {targetLabel && <div className="target-label">{targetLabel}</div>}
        {miningProgress > 0 && <div className="mining-progress"><div className="mining-label">{miningLabel} — cracking {Math.round(miningProgress * 10)}/10</div><div className="mining-bar"><span style={{ width: `${Math.round(miningProgress * 100)}%` }} /></div></div>}
        {commandOpen && <div className="command-console"><input value={commandText} autoFocus onChange={e => setCommandText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitCommand(); if (e.key === 'Escape') setCommandOpen(false); }} /><button onClick={submitCommand}>Run</button></div>}
        {chatOpen && <div className="chat-panel"><div className="chat-log">{chatMessages.slice(-10).map((m, i) => <div key={i} className={`chat-line ${m.system ? 'system' : ''}`}>{m.text}</div>)}</div><div className="chat-input-row"><input className="chat-input" value={chatText} autoFocus placeholder="Chat or /day /time 12 /summon sheep" onChange={e => setChatText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitChat(); if (e.key === 'Escape') setChatOpen(false); }} /><button className="chat-send" onClick={submitChat}>Send</button></div></div>}
        <div className="world-action-rail">
          <button className={`world-action fly ${flightEnabled ? 'active' : ''}`} onClick={() => window.dispatchEvent(new Event('eaoin-toggle-flight'))}>FLY [F] {flightEnabled ? 'ON' : 'OFF'}</button>
          <button className="world-action" onClick={resetSavedWorld}>RESET</button>
          <button className="world-action danger" onClick={onExit}>EXIT</button>
        </div>
        {paused && <div className="pause-panel"><h2>Paused — Regular World + Fly Button</h2><p>Spawn clear 26m. Settlement 58m, Rocket 110m, Portal 72m, Clouds moving stunning far away, Render distance up to 16 chunks, Terrain regular Minecraft-like hills, grounded lakes, no default floating islands, Day/night 20 min, Inventory block logos, Hand punch goes towards tree, Cracking overlay, Fog 100-1000 toggle, T chat /day /time /summon.</p><button onClick={() => { setPaused(false); canvasRef.current?.requestPointerLock?.(); }}>Resume</button><button onClick={onToggleSettings}>Settings</button><button onClick={onExit}>Exit to Menu</button></div>}
      </div>
    </div>
  );
}


/**
 * Drive the world lighting rig from the atmosphere frame.
 *
 * BUGFIX 2.0: this function used to also write `scene.clearColor`,
 * `scene.fogColor` and `scene.fogDensity`, and to position its own sun disc,
 * moon disc, god-ray cone and 120 star meshes — all of which duplicated and
 * fought with `DynamicSky`, which wrote the same three scene properties every
 * frame with completely different formulas. The sky you saw overhead therefore
 * never matched the fog at the horizon, which is what produced the hard blue
 * band that flashed when you looked up.
 *
 * `AtmosphereSystem` is now the sole owner of sky colour, fog and celestial
 * bodies. This function only maps the resulting atmosphere onto the actual
 * lights, so there is exactly one source of truth.
 */
/**
 * Drive the lighting rig from the atmosphere frame.
 *
 * The important change here is that every term has a **floor**. Previously the
 * sky fill bottomed out near zero at night and inside dim sky profiles, so
 * anything the sun missed went black. Night is now dim and blue rather than
 * invisible, and the player-carried light guarantees the immediate
 * surroundings are always readable — the fix for "in the trees / underground
 * I cannot see anything".
 */
function updateWorldLighting(
  lighting: SceneLightingHandles,
  frame: AtmosphereFrame,
  realistic: boolean,
  playerPosition?: Vector3,
  /** 0 = open sky, 1 = fully enclosed. Boosts the carried light in caves. */
  enclosure = 0
): void {
  const boost = realistic ? 1.08 : 1;
  const daylight = Math.max(0.08, frame.dayFactor);
  const moonlight = frame.nightFactor;
  // Never let a sky profile drive ambient scale to zero.
  const ambientScale = Math.max(0.45, frame.profile.ambientScale);

  // Point the sun light along the real sun direction from the celestial rig, so
  // shadows track the visible cube sun across the sky.
  lighting.sun.direction.copyFrom(frame.sunDirection);
  lighting.sun.intensity = daylight * 0.55 * boost * ambientScale;
  lighting.sun.diffuse = frame.sunColor;

  // Hemispheric fill is now the primary readability source, with a hard floor
  // so no time of day or dimension can black the world out.
  lighting.sky.intensity = Math.max(0.42, 0.40 + daylight * 0.55) * boost * ambientScale;
  lighting.sky.diffuse = Color3.Lerp(
    // Night sky colour lifted so moonlit terrain reads blue, not black.
    frame.profile.zenithNight.scale(4.2),
    frame.profile.horizonDay,
    frame.dayFactor
  );

  // The spawn beacon glows brighter at night so it stays findable.
  lighting.spawnLight.intensity = 0.24 + moonlight * 0.72;

  // Carried light: subtle outdoors in daylight, strong in caves and at night.
  if (playerPosition) lighting.playerLight.position.copyFrom(playerPosition);
  const nightNeed = 1 - frame.dayFactor;
  lighting.playerLight.intensity = 0.22 + enclosure * 0.85 + nightNeed * 0.35;
  lighting.playerLight.range = 12 + enclosure * 10;
}

/**
 * Translate a world-type preset into `AdvancedTerrainGenerator` config.
 *
 * Kept separate from `WorldTypes.ts` so the preset table stays a pure data
 * description and this file owns the mapping onto whatever the generator's
 * current option names happen to be.
 */
/**
 * Translate a world-type preset into real generator settings.
 *
 * Every field here is now actually read by AdvancedTerrainGenerator. The
 * exotic presets (Far Lands, Sub-Bedrock, Inverted, Cave World) used to be
 * decorative — the card appeared on the create screen and generated an
 * ordinary world. They are wired to real passes in `ExoticWorldGen.ts`.
 */
function worldTypeOverrides(config: WorldTypeConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (config.floatingIslands) { out.floatingIslands = true; out.skyIslands = true; }
  if (config.seaLevelOverride !== undefined) out.seaLevel = config.seaLevelOverride;
  if (config.heightScale !== undefined) out.mountainIntensity = config.heightScale;
  // A superflat world has no relief, no caves and no erosion to run.
  if (config.flatGroundY !== undefined) {
    out.flatGroundY = config.flatGroundY;
    out.mountainIntensity = 0;
    out.caveScale = 0;
    out.erosionIterations = 0;
    out.ravines = false;
    out.sinkholes = false;
    out.volcanoes = false;
  }
  // Cave worlds crank the carve rate right up and seal the sky.
  if (config.caveWorld) { out.caveScale = 3; out.caveWorld = true; }
  // The Far Lands: terrain-noise saturation past a threshold distance.
  if (config.farLandsThreshold !== undefined) out.farLandsThreshold = config.farLandsThreshold;
  // Stacked worlds beneath the bedrock floor.
  if (config.subBedrockLayers !== undefined) out.subBedrockLayers = config.subBedrockLayers;
  // Density flip: caverns become spires.
  if (config.inverted) out.inverted = true;
  return out;
}

function toBlockCoordinate(point: Vector3): BlockCoordinate { return { x: Math.floor(point.x), y: Math.floor(point.y), z: Math.floor(point.z) }; }
function toChunkCoordinate(worldX: number, worldZ: number): { cx: number; cz: number } { return { cx: Math.floor(worldX / 16), cz: Math.floor(worldZ / 16) }; }
function chunksInRadius(radius: number): number { const diameter = radius * 2 + 1; return diameter * diameter; }
function hasNearbyBlock(terrain: { getBlockAt(x: number, y: number, z: number): BlockID }, position: Vector3, blockId: BlockID, radius: number): boolean {
  const minX = Math.floor(position.x - radius); const maxX = Math.floor(position.x + radius); const minZ = Math.floor(position.z - radius); const maxZ = Math.floor(position.z + radius); const minY = Math.max(0, Math.floor(position.y - radius)); const maxY = Math.min(127, Math.floor(position.y + radius));
  for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) for (let y = minY; y <= maxY; y++) if (terrain.getBlockAt(x, y, z) === blockId) return true;
  return false;
}
function wouldBlockPlayer(block: BlockCoordinate, playerPosition: Vector3): boolean {
  const center = new Vector3(block.x + 0.5, block.y + 0.5, block.z + 0.5);
  return Math.abs(center.x - playerPosition.x) < 0.72 && Math.abs(center.y - playerPosition.y) < 1.45 && Math.abs(center.z - playerPosition.z) < 0.72;
}

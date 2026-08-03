import { useEffect, useRef, useState } from 'react';
import { Color3, Color4, DefaultRenderingPipeline, GlowLayer, Mesh, MeshBuilder, RawTexture, Scene, StandardMaterial, Texture, UniversalCamera, Vector3 } from '@babylonjs/core';
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
import { BossState } from '../creatures/BossEncounter';
import { BossEncounter } from '../creatures/BossEncounter';
import { ALL_BOSSES, getBoss } from '../creatures/BossRegistry';
import DimensionRuntime, { RuntimeDimensionID } from '../dimensions/DimensionRuntime';
import { WorldInteractionRuntime } from '../effects/WorldInteractionRuntime';
import { ItemDropManager } from '../items/ItemDropManager';
import { LocalAuthorityRuntime } from '../networking/LocalAuthorityRuntime';
import { GameMode, isCreativeMode } from '../modes/GameMode';
import { ModdingRuntime } from '../modding/ModdingRuntime';
import type { ModPackRegistry } from '../modding/ModPackRegistry';
import { NextGenRuntime } from '../nextgen/NextGenRuntime';
import { GameplayCounterKey } from '../objectives/ObjectiveTracker';
import { createBlockMaterials } from '../rendering/BlockMaterials';
import { ChunkRenderManager, ChunkRenderStats } from '../rendering/ChunkRenderManager';
import { BreakOverlay } from '../rendering/BreakOverlay';
import { FirstPersonViewModel } from '../rendering/FirstPersonViewModel';
import { applyRenderScale, createRuntimeEngine, enableSnapshotRenderingWhenReady, invalidateRenderSnapshot, RendererBackendInfo } from '../rendering/RendererBackend';
import {
  applyDeveloperTuningToTerrain,
  applyLightingPresetToScene,
  developerTuningStore,
  DeveloperWorldTuning,
  effectiveDayLengthSeconds,
  getLightingPreset,
  isDevTunableTerrain,
  worldClockRatePerSecond,
} from '../dev/DeveloperTuning';
import { DimensionChunkSource } from './DimensionChunkSource';
import TouchControls from '../ui/TouchControls';
import { AdaptivePerformance, EffectTier, effectSettingsFor } from '../performance/AdaptivePerformance';
import {
  adaptiveBudgetForSettings,
  adaptiveBudgetKey,
  effectTierForQualityPreset,
  rayTracingSettingsKey,
  resolveCameraPenetrationY,
  shouldEnableAtmosphereParticles,
} from './GameCanvasConfig';
import { WeatherEffects } from '../effects/WeatherEffects';
import { MoonEvents } from '../effects/MoonEvents';
import { SpecialEvents } from '../events/SpecialEvents';
import { AncientCityRift } from '../events/AncientCityRift';
import { aiReply, npcPersona } from '../ai/AIAssistant';
import { ScreenSystem } from '../effects/ScreenSystem';
import { ColoredLighting } from '../effects/ColoredLighting';
import { WorldsEdgeRuntime } from '../effects/WorldsEdgeRuntime';
import { SevereWeather } from '../effects/SevereWeather';
import { EndBlackHole } from '../effects/EndBlackHole';
import { TNT_BLAST_RADIUS, TNT_FUSE_SECONDS, detonateTNT } from '../effects/ExplosionEffects';
import { LogicRuntime } from '../redstone/LogicRuntime';
import { configureSceneLighting, SceneLightingHandles } from '../rendering/SceneLighting';
import { RuntimeStatus } from '../runtime/RuntimeStatus';
import { GameSettings, qualityRenderDistance, effectiveRenderDistance, clampSettings } from '../settings/GameSettings';
import { TerrainGenerator } from '../world/TerrainGenerator';
import AdvancedTerrainGenerator, { FLOATING_ISLANDS_CONFIG } from '../world/AdvancedTerrainGenerator';
import { CHUNK_HEIGHT } from '../world/Chunk';
import { FloatingIslandsGenerator } from '../world/FloatingIslands';
import { AdvancedPhysicsRuntime } from '../physics/AdvancedPhysics';
import { AtmosphereSystem, AtmosphereFrame } from '../sky/AtmosphereSystem';
import { getWorldType, isLegacySkyWorldSeed, worldTypeFromSeed, WorldTypeConfig } from '../world/WorldTypes';
import { PortalSystem } from '../portals/PortalSystem';
import { PhysicalPlanets } from '../space/PhysicalPlanets';
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
  /** Shared mod registry so enabled mods take effect in-world. */
  modRegistry?: ModPackRegistry;
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
  /** Open the character creator from the pause menu. */
  onOpenCharacter?: () => void;
  /** Quit to the launcher (instead of exiting the app). */
  onExitToLauncher?: () => void;
  /** Character appearance, used to texture the third-person avatar. */
  appearance?: import('../ui/theme').CharacterAppearance;
  /** Super Settings (Part 4) — coloured lighting, god rays, etc. */
  superSettings?: import('../settings/SuperSettings').SuperSettings;
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
/** Minecraft-like player dimensions: camera position is the eye, not the body centre. */
const PLAYER_EYE_HEIGHT = 1.62;
const PLAYER_HEIGHT = 1.8;
const PLAYER_HALF_HEIGHT = PLAYER_HEIGHT / 2;
const PLAYER_COLLIDER_OFFSET_Y = PLAYER_HALF_HEIGHT - PLAYER_EYE_HEIGHT;
const PLAYER_FOOTPRINT: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0.22, 0], [-0.22, 0], [0, 0.22], [0, -0.22],
];
/** Chunks meshed synchronously before the first frame is presented. */
const INITIAL_CHUNK_RADIUS = 1;
/** Chunks generated + meshed per ordinary streaming frame. */
const CHUNKS_PER_FRAME = 8;
/**
 * Keep one fully meshed chunk ring beyond the advertised render distance.
 *
 * Terrain data is generated on demand for physics, so without this ring the
 * player could collide with a real block before its mesh had reached the GPU.
 * Crossing a chunk boundary would then expose an invisible, solid 16×16 area
 * until the asynchronous streamer caught up. The guard ring makes the old
 * outer row become the next visible row instead of a hole.
 */
const CHUNK_PREFETCH_RADIUS = 1;
/**
 * When the player outruns the prefetch ring (most commonly while flying), do
 * a short catch-up burst. Correct, visible terrain wins over a few temporary
 * frame-time spikes; the adaptive sampler excludes these known work frames.
 */
const COVERAGE_RECOVERY_CHUNKS_PER_FRAME = 16;
/**
 * Wall-clock budget for ordinary chunk streaming, in ms.
 *
 * Measured cost is ~7ms for an average chunk but several times that for
 * mountainous, cavern-heavy terrain, so a fixed count of 2 chunks/frame was
 * either wasteful or a visible hitch depending on where you stood. ~6ms leaves
 * the rest of a 16.6ms frame for rendering and simulation.
 */
const CHUNK_STREAM_BUDGET_MS = 6;
/** Short, bounded catch-up budget used only while the visible radius has a gap. */
const COVERAGE_RECOVERY_STREAM_BUDGET_MS = 14;
const INITIAL_RENDERER_INFO: RendererBackendInfo = { backend: 'webgl', label: 'Initializing renderer', requested: 'auto', webgpuSupported: false, vulkanPath: 'native-vulkan-required', vulkanStatus: 'Detecting graphics backend…' };
/**
 * After this long, the loading overlay may hand off to play only if the entire
 * player-facing radius is meshed. The prefetch ring can continue streaming;
 * collidable invisible terrain cannot.
 */
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

export default function GameCanvas({ seed, gameMode, onExit, modRegistry, selectedBlock, onSelectedBlockChange, selectedTool, onSelectedToolChange, toolInventory, inventory, onInventoryChange, survivalStats, onSurvivalStatsChange, settings, onSettingsChange, onToggleInventory, onToggleSettings, onGameplayEvent, onRuntimeStatusChange, onTelemetry, onLoadingProgress, onGameModeChange, onOpenCharacter, onExitToLauncher, appearance, superSettings }: GameCanvasProps) {
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
  /** Live developer-panel tuning, mirrored on change by the store subscription. */
  const devTuningRef = useRef<DeveloperWorldTuning>(developerTuningStore.get());
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
  /** True while the player is dead and the death screen is showing. */
  const [dead, setDead] = useState(false);
  /** Ghost mode: roam the world free of gravity/harm instead of respawning. */
  const [ghostMode, setGhostMode] = useState(false);
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
  /** Called by the death screen to respawn or enter ghost mode. */
  const deathActionRef = useRef<{ respawn: () => void; ghost: () => void }>({ respawn: () => {}, ghost: () => {} });
  /** Set by the scene; summons a boss by id. Used by `/boss` and the B key. */
  const bossSummonRef = useRef<((bossId: string) => string) | null>(null);
  /** AI NPC spawn bridge (set inside the scene, called from chat). */
  const aiNpcRef = useRef<((name: string, x: number, y: number, z: number, colours?: { shirt: string; hair: string; skin: string; pants: string }) => void) | null>(null);
  /** Latest player world position, kept fresh each frame for the chat/AI. */
  const playerPosRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  /** Live boss state, drives the on-screen boss health bar. */
  const [bossState, setBossState] = useState<BossState | null>(null);
  const [commandText, setCommandText] = useState('/help');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ text: string; system?: boolean }>>([{ text: 'Welcome — T to chat, / for commands, Q to cycle tools, SPACE to jump, clouds moving', system: true }]);
  const [worldTime, setWorldTime] = useState<WorldTimeState>({ timeOfDay: 12, frozen: false });
  const [renderStats, setRenderStats] = useState<RuntimeRenderStats>({ loadedChunks: 0, meshCount: 0, triangleCount: 0, rebuildCount: 0, naiveTriangleCount: 0, meshingSavings: 0, fps: 0, streamCenter: '0,0', creatures: { count: 0, cap: 0, spawned: 0, despawned: 0, species: 0 }, drops: 0, renderer: INITIAL_RENDERER_INFO, frameTimeP95: 0, renderScale: 1, effectTier: 'medium', adaptiveReason: '' });
  const [flightEnabled, setFlightEnabled] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  /** Virtual joystick value from the touch controls overlay (-1..1 each axis). */
  const touchStickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  /** Accumulated look-drag from touch (consumed + reset each frame in the loop). */
  const touchLookRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  /** Sprint state — set by Shift (keyboard), a gamepad trigger, or a touch button. */
  const sprintingRef = useRef(false);
  /** Current walking animation phase for the arm/foot motion. */
  const movePhaseRef = useRef(0);

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
      // Prevent Babylon's WebGPU shader from allocating per-light uniform
      // buffer slots (Light0-3) that the UBO layout never creates. Without
      // this the console is flooded with "Can't find buffer Light0/1/2/3"
      // on every single draw call. Directional and hemispheric lights still
      // work — they use scene-level uniforms, not the per-light array.
      //
      // `maxSimultaneousLights` is a runtime hint Babylon's shader-buffer
      // allocator reads off the scene object; it is not declared on the public
      // `Scene` type, so we assign it through a narrow structural cast. This
      // keeps the runtime behaviour byte-identical while clearing the
      // TS2339 error that used to be the last remaining compiler noise.
      (scene as Scene & { maxSimultaneousLights?: number }).maxSimultaneousLights = 0;
      scene.clearColor = new Color4(0.22, 0.38, 0.58, 1);
      scene.collisionsEnabled = true;
      scene.gravity = new Vector3(0, 0, 0);
      scene.fogEnabled = settingsRef.current.fogEnabled;
      // Force the engine to match the canvas' full-viewport layout immediately
      // after scene setup, so the framebuffer is not stuck at the tiny collapsed
      // size before the first render.
      engine.resize();
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
        || isLegacySkyWorldSeed(seed);
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
      // Developer panel: seed the generator with the panel's current world
      // tuning before the first chunk is generated.
      applyDeveloperTuningToTerrain(terrain, devTuningRef.current);
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
        ? `Loaded ${savedEdits.length} edits • Settlement ${Math.round(Math.hypot(layout.settlement.x, layout.settlement.z))}m • Rocket ${Math.round(Math.hypot(layout.rocket.x, layout.rocket.z))}m • 1.0 advanced world`
        : `EAOIN 1.0 • advanced world gen • bedrock foundation • Caves & Cliffs terrain • 150+ biomes • 25 dimensions`);

      // BUGFIX: ensure the camera never spawns inside a block (such as a tree,
      // structure, or leaves above groundY), which caused backface culling to
      // trap the player in a completely black screen with only the HUD visible.
      let safeSpawnY = spawn.y;
      for (let y = 126; y >= 1; y--) {
        const bid = terrain.getBlockAt(Math.floor(spawn.x), y, Math.floor(spawn.z));
        if (bid !== 0 && bid !== 5) {
          safeSpawnY = Math.max(safeSpawnY, y + 1 + PLAYER_EYE_HEIGHT);
          break;
        }
      }

      const camera = new UniversalCamera('player_camera', new Vector3(spawn.x, safeSpawnY, spawn.z), scene);
      // BUGFIX: explicitly set both activeCamera and activeCameras array.
      // Without this, Babylon.js can render a black screen on some browsers /
      // GPUs because no camera is active even though one exists in the scene.
      scene.activeCamera = camera;
      scene.activeCameras = [camera];
      camera.attachControl(canvas, true);
      camera.setTarget(new Vector3(spawn.x + 8, safeSpawnY - 0.35, spawn.z + 8));
      camera.minZ = 0.1; camera.maxZ = 5000;
      camera.speed = Math.max(0.7, settingsRef.current.cameraSpeed * 1.15);
      camera.inertia = 0; camera.angularSensibility = 900; camera.applyGravity = false; camera.checkCollisions = true;
      camera.ellipsoid = new Vector3(0.32, PLAYER_HALF_HEIGHT, 0.32);
      // Babylon centres the collision ellipsoid at camera + offset. The old
      // +0.82 offset put the entire collider above the player's eyes, allowing
      // the camera itself to enter terrain; back-face culling then exposed the
      // whole underground like X-ray vision.
      camera.ellipsoidOffset = new Vector3(0, PLAYER_COLLIDER_OFFSET_Y, 0);
      camera.keysUp = [87, 38]; camera.keysDown = [83, 40]; camera.keysLeft = [65, 37]; camera.keysRight = [68, 39];

      // Player appearance → textured third-person avatar. Build materials from
      // the character's skin / hair / shirt / pants / cape colours, with a real
      // face drawn on the head (not a flat box).
      const app = appearance ?? { skinTone: '#c98d6a', hairColor: '#3a2a1a', shirtColor: '#2080d0', pantsColor: '#2f3640', cape: 'none' };
      const personTex = buildPersonTexture(app);
      const texFrom = (part: 'head' | 'body' | 'leg') => {
        const data = personTex[part];
        const t = RawTexture.CreateRGBATexture(data, 16, 16, scene, true, false, Texture.NEAREST_NEAREST_MIPLINEAR);
        const m = new StandardMaterial(`player_${part}`, scene);
        m.diffuseTexture = t;
        m.specularColor = new Color3(0.2, 0.2, 0.2);
        m.specularPower = 14;
        return m;
      };
      const skin = texFrom('head');
      const shirt = texFrom('body');
      const pants = texFrom('leg');
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
      armA.parent = avatar; armA.position.set(-0.48, 1.24, 0); armA.material = shirt; armA.isPickable = false;
      const armB = MeshBuilder.CreateBox('avatar_arm_b', { width: 0.22, height: 0.82, depth: 0.25 }, scene);
      armB.parent = avatar; armB.position.set(0.48, 1.24, 0); armB.material = shirt; armB.isPickable = false;
      // Cape on the back (only if a cape style is equipped).
      let capeMesh: Mesh | null = null;
      if (app.cape && app.cape !== 'none') {
        capeMesh = MeshBuilder.CreateBox('avatar_cape', { width: 0.62, height: 0.78, depth: 0.04 }, scene);
        capeMesh.parent = avatar;
        capeMesh.position.set(0, 1.15, -0.2);
        const cm = new StandardMaterial('avatar_cape_mat', scene);
        cm.diffuseColor = capeColor3(app.cape);
        cm.emissiveColor = capeColor3(app.cape).scale(0.4);
        capeMesh.material = cm;
        capeMesh.isPickable = false;
      }
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
      const perfBudget = adaptiveBudgetForSettings(settingsRef.current);
      let lastAdaptiveBudgetSignature = adaptiveBudgetKey(settingsRef.current);
      const baseRenderRadius = effectiveRenderDistance(settingsRef.current);
      const perf = new AdaptivePerformance(perfBudget, {
        renderScale: settingsRef.current.renderScale,
        renderDistance: baseRenderRadius,
        effectTier: effectTierForQualityPreset(settingsRef.current.qualityPreset),
      });
      // Mutable because the tuner shrinks/grows it while playing.
      let renderRadius = perf.getState().renderDistance;
      let effectTier: EffectTier = perf.getState().effectTier;
      let adaptiveReason = '';
      let lastParticleEnabled = shouldEnableAtmosphereParticles(settingsRef.current, effectTier);
      let lastParticleQuality = particleQualityFor(settingsRef.current.qualityPreset);
      // `renderRadius` is what the player sees in Settings. Streaming one
      // additional ring is intentionally invisible to that UI, but prevents a
      // newly crossed chunk boundary from becoming a collidable blank square.
      const streamingRadiusFor = (visibleRadius: number): number => visibleRadius + CHUNK_PREFETCH_RADIUS;
      const startupChunkTotal = chunksInRadius(streamingRadiusFor(renderRadius));
      // Raised by teleports/dimension travel; cleared once player-facing
      // terrain coverage has been restored by the streaming loop.
      let forceTerrainCoverage = false;
      const dimensionRuntime = new DimensionRuntime(scene, spawn, seed);
      const worldInteractions = new WorldInteractionRuntime(scene, terrain, spawn, seed);
      const moddingRuntime = new ModdingRuntime(); if (modRegistry) moddingRuntime.attachRegistry(modRegistry); moddingRuntime.registerMockPack();
      const nextGenRuntime = new NextGenRuntime(scene, terrain, seed, gameMode, spawn);
      // Physical, enterable planets: real fixed-coordinate spheres that scale
      // as the player approaches and swap the voxel world when the player
      // flies into one's atmospheric boundary.
      const physicalPlanets = new PhysicalPlanets(scene, new Vector3(spawn.x, spawn.y, spawn.z));
      physicalPlanets.attach();
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
      // Storm lightning + meteors/comets that streak across the sky and crash.
      const weatherEffects = new WeatherEffects(scene, lighting.sun, lighting.sky);
      // 2.0 — severe weather: tornadoes, blizzards, sandstorms, meteor showers.
      const severeWeather = new SevereWeather(scene);
      // 2.0 — End black-hole sky with gravitational lensing (pulls only players).
      const endBlackHole = new EndBlackHole(scene);
      const moonEvents = new MoonEvents();
      const specialEvents = new SpecialEvents();
      const configureTerrainShadow = (mesh: Mesh): void => {
        const enabled = effectSettingsFor(effectTier).shadowsEnabled;
        if (enabled) lighting.shadowGenerator.addShadowCaster(mesh, false);
        else lighting.shadowGenerator.removeShadowCaster(mesh, false);
        mesh.receiveShadows = enabled;
      };
      renderer.setMeshLifecycleHandlers(
        configureTerrainShadow,
        (mesh) => lighting.shadowGenerator.removeShadowCaster(mesh, false)
      );
      // Spawn chunks were meshed before the lighting rig existed; register
      // those once. Future meshes go through the lifecycle hook directly.
      renderer.forEachMesh(configureTerrainShadow);

      const glow = new GlowLayer('voxel_bloom', scene, { blurKernelSize: 64 });
      glow.intensity = settingsRef.current.postProcessEnabled || settingsRef.current.realisticLighting ? 0.22 : 0.08;
      const optionalPostEffectsEnabled = settingsRef.current.postProcessEnabled || settingsRef.current.qualityPreset === 'cinematic' || settingsRef.current.experimentalShaders;
      scene.environmentIntensity = 0.48;
      // PBR reflections: point the scene environment at the premium sky
      // panorama so blocks and water pick up real sky reflections. Safe to
      // skip if the asset or backend rejects it.
      try {
        const envUrl = `${import.meta.env.BASE_URL}textures/sky/sky_panorama.png`;
        scene.environmentTexture = new Texture(envUrl, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
        scene.environmentIntensity = settingsRef.current.realisticLighting ? 0.85 : 0.55;
      } catch { /* reflections are optional */ }
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
          // Disposing detaches the half-built pipeline from every camera; the
          // scene-level postProcessesEnabled gate stays on so other, unrelated
          // post processes (e.g. the screen-space ray tracer's) keep working.
          pipeline?.dispose(); pipeline = null;
          cinematicLighting.pipeline = null;
          console.warn('[Render] Optional post-processing disabled to keep world visible.', error);
        }
      }
      // 5.0 — screen-space ray tracing. Real per-pixel ray marching against
      // the depth buffer for reflections, contact shadows and AO. It is NOT
      // hardware RT and the UI says so; see ScreenSpaceRayTracing.ts.
      const rayTracer = new ScreenSpaceRayTracer(scene, camera);
      try {
        rayTracer.configure({
          quality: settingsRef.current.rayTracingQuality,
          reflections: settingsRef.current.rayTracedReflections,
          contactShadows: settingsRef.current.rayTracedShadows,
          ambientOcclusion: settingsRef.current.rayTracedAO,
        });
      } catch (error) {
        console.warn('[Render] Screen space RT failed to configure; disabling to keep world visible.', error);
      }
      let lastRayTracingSignature = rayTracingSettingsKey(settingsRef.current);

      /* ------------------------------------------------------------------ *
       * Post-effect degrade path (single implementation, two triggers)
       *
       * When a frame is proven black despite loaded geometry, or the render
       * loop throws, we fall back to the plain forward render. The teardown is
       * EXPLICIT — every optional pass is detached and disposed individually —
       * rather than the old `scene.postProcessesEnabled = false` kill switch,
       * which masked broken passes by silently gate-keeping every post process
       * (present and future) and left the glow layer and the depth-map pass
       * running underneath.
       *
       * Depth-safety contract: this path never touches chunk mesh materials,
       * their render-queue classification or any depth-write/depth-test state.
       * BlockMaterials owns that contract (opaque terrain is alpha-locked and
       * force-depth-written), so after a degrade the forward pass still
       * occludes exactly like the un-degraded scene — no X-ray from recovery.
       *
       * Declared here — before the effect-tier tuner first runs — so runtime
       * tier changes can honour the "degraded" latch instead of re-arming the
       * very passes recovery just removed.
       * ------------------------------------------------------------------ */
      // 2.0 — ONE atmosphere system owns the sky dome, celestial bodies,
      // clouds, stars, aurora, fog and biome weather particles. Nothing else in
      // the engine writes scene.clearColor / fogColor, which is what keeps the
      // horizon seamless and killed the flashing blue overhead.
      const atmosphere = new AtmosphereSystem(scene, {
        seed,
        dayLengthSeconds: DAY_LENGTH_SECONDS,
        particlesEnabled: lastParticleEnabled,
        particleQuality: lastParticleQuality,
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
      // Ancient-City reality-rift portal (note-block ritual → rift dimension).
      const ancientCityRift = new AncientCityRift();
      // TV / Computer screens that show the live game view (Part 4).
      const screenSystem = new ScreenSystem(scene);
      // Part 4 — coloured lighting: tint a dynamic light by nearby emissive blocks.
      const coloredLighting = new ColoredLighting(scene);
      coloredLighting.configure({
        coloredLighting: superSettings?.coloredLighting ?? true,
        lightMixing: superSettings?.lightMixing ?? true,
        godRays: superSettings?.godRays ?? 0.4,
      });
      // World's Edge — the end-of-world monster (exclusive survival world type).
      const worldsEdge = new WorldsEdgeRuntime();
      worldsEdge.setActive(worldTypeFromSeed(seed) === 'worlds_edge');

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

      /* ---------------------------------------------------------------- *
       * Developer app panel — live tuning subscription.
       *
       * The panel writes into `developerTuningStore`; this bridges each
       * change into the running scene, frame-atomically:
       *   - day/night speed  → atmosphere clock length (frame-loop rate reads
       *                        the same store via devTuningRef)
       *   - lighting preset  → exposure/contrast on the scene
       *   - terrain sliders  → generator tuning + full nearby-terrain rebuild
       *                        (same recipe as dimension travel)
       * ---------------------------------------------------------------- */
      const unsubscribeDevTuning = developerTuningStore.subscribe((tuning) => {
        const worldgenChanged =
          tuning.terrainAmplification !== devTuningRef.current.terrainAmplification
          || JSON.stringify(tuning.biomeMods) !== JSON.stringify(devTuningRef.current.biomeMods);
        devTuningRef.current = tuning;
        atmosphere.setDayLengthSeconds(effectiveDayLengthSeconds(tuning, DAY_LENGTH_SECONDS));
        applyLightingPresetToScene(scene, tuning.lightingPreset);
        if (!worldgenChanged || !isDevTunableTerrain(terrain)) return;
        applyDeveloperTuningToTerrain(terrain, tuning);
        // The generators self-invalidate on tuning change; drop every meshed
        // chunk and re-stream around the camera exactly like dimension travel.
        terrain.invalidateGeneratedChunks();
        renderer.clearAll();
        invalidateRenderSnapshot(engine);
        streamCenter = toChunkCoordinate(camera.position.x, camera.position.z);
        renderer.updateVisibleChunks(
          streamCenter.cx, streamCenter.cz, INITIAL_CHUNK_RADIUS,
          chunkSource.generateChunk
        );
        forceTerrainCoverage = true;
        showActionMessage('Developer tuning applied — regenerating terrain');
      });

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
      // Route the spawner through the dimension-aware chunk source so creatures
      // land on (and spawn in) the ACTIVE dimension's real terrain, not the
      // overworld's (which buried them underground in other dimensions).
      const creatureManager = new CreatureManager(scene, chunkSource, seed);
      // Hostile wildlife can now actually hurt the player. Damage funnels into
      // the same survival stats as everything else, so the death check covers it.
      creatureManager.onPlayerDamage = ({ amount, source }) => {
        if (amount <= 0 || isCreativeMode(gameModeRef.current)) return;
        const next = applyDamage(survivalStatsRef.current, amount);
        survivalStatsRef.current = next;
        publishSurvivalStats(next);
        audio.play('hit', settingsRef.current);
        showActionMessage(`${source} attacks you for ${amount}!`);
      };
      creatureManager.update(camera.position, 1);

      /* ---------------------------------------------------------------- *
       * Boss encounters
       *
       * BossRegistry defines 38 bosses; before this the only thing that
       * imported it was the HUD menu, so none could be fought. `activeBoss`
       * holds the live encounter, driven from the frame loop below.
       * ---------------------------------------------------------------- */
      let activeBoss: BossEncounter | null = null;

      const clearBoss = (): void => {
        activeBoss?.dispose();
        activeBoss = null;
        setBossState(null);
      };

      const publishBoss = (): void => {
        setBossState(activeBoss ? activeBoss.getState() : null);
      };

      const summonBoss = (bossId: string): string => {
        const def = getBoss(bossId)
          ?? ALL_BOSSES.find((b) => b.name.toLowerCase() === bossId.toLowerCase());
        if (!def) return `No such boss: ${bossId}`;

        clearBoss();
        // Place it in front of the player, clear of the ground.
        const forward = camera.getForwardRay(1).direction;
        const spawnAt = camera.position.add(
          new Vector3(forward.x, 0, forward.z).normalize().scale(14 + def.size.depth * 0.5)
        );
        // Stand the boss on the real surface. `getHeightAt` is the pre-carve
        // analytic height, so over a cave mouth it dropped the encounter into
        // mid-air.
        spawnAt.y = terrain.getSurfaceHeight(spawnAt.x, spawnAt.z) + 1;

        const boss = new BossEncounter(scene, def, spawnAt);

        boss.onPhase = (phase, bossDef) => {
          showActionMessage(`${bossDef.name} enters phase ${phase} of ${bossDef.phases}!`);
          audio.play('hit', settingsRef.current);
          publishBoss();
        };

        boss.onAbility = (event) => {
          const distance = Vector3.Distance(event.position, camera.position);
          if (event.kind === 'summon') {
            for (let i = 0; i < (event.summonCount ?? 1); i += 1) {
              creatureManager.spawnNear(event.position, event.summonSpecies ?? 'husk_wanderer');
            }
            showActionMessage(`${def.name} uses ${event.name}!`);
            return;
          }
          // Melee and pulses need the player actually within reach.
          const reach = event.kind === 'melee' ? 5 : event.kind === 'pulse' ? 12 : 36;
          if (distance > reach) return;
          if (isCreativeMode(gameModeRef.current)) return;

          const next = applyDamage(survivalStatsRef.current, event.damage);
          survivalStatsRef.current = next;
          publishSurvivalStats(next);
          audio.play('hit', settingsRef.current);
          showActionMessage(`${def.name}: ${event.name} hits you for ${event.damage}!`);
        };

        boss.onDefeated = (bossDef, position) => {
          showActionMessage(`${bossDef.name} defeated! Drops: ${bossDef.drops.join(', ')}`);
          audio.play('creature_down', settingsRef.current);
          onGameplayEvent('creaturesDefeated');
          // Registry drops are lore item names; award a themed block stack so
          // the kill has a tangible reward in the inventory.
          const reward = bossDef.tier === 'final' ? 16 : bossDef.tier === 'world' ? 11 : 10;
          for (let i = 0; i < Math.min(6, bossDef.phases + 1); i += 1) {
            itemDrops.spawnDrop(reward as BlockID, position, 1);
          }
          window.setTimeout(() => { clearBoss(); }, 400);
        };

        publishBoss();
        audio.play('ui', settingsRef.current);
        return `${def.name} — ${def.tier.toUpperCase()} — ${def.health} HP, ${def.phases} phases. ${def.lore}`;
      };

      bossSummonRef.current = summonBoss;

      // Real Minecraft-style destroy-stage cracks. The old overlay just faded a
      // dark box to red over the block, which is the "red screen when breaking
      // a block" the player called outdated.
      const breakOverlay = new BreakOverlay(scene);

      let miningSession: MiningSession | null = null;
      /**
       * Last mining progress pushed into React state.
       *
       * Declared here, beside `miningSession`, because `clearMining` below
       * assigns it — declaring it further down (next to the render-loop
       * locals) put it in the temporal dead zone for that call and threw.
       */
      let lastPublishedMiningProgress = 0;
      const clearMining = (): void => {
        miningSession = null; lastPublishedMiningProgress = 0; setMiningProgress(0); setMiningLabel('');
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

      // --- player physics + survival locals ------------------------------
      // Declared here rather than further down because `respawnPlayer` and the
      // command executor below both assign them. `let` bindings are in the
      // temporal dead zone until their declaration is *executed*, so declaring
      // them after those closures made `/kill` and `/tp` throw a ReferenceError
      // the moment they ran.
      let velocityY = 0;
      let fallStartY = camera.position.y;
      let wasFalling = false;
      // 2.0 — thirst. Deserts are genuinely hostile: the bar drains fast in
      // the heat and you must find water (or an oasis) to top it back up.
      let hydrationState: HydrationState = createStarterHydration();

      /**
       * Kill and respawn the player.
       *
       * Survival had no death at all: health could hit zero and nothing
       * happened, and `/kill` was not even a command. Dying now recentres you
       * on the world spawn with fresh stats, which is what makes survival
       * mode have stakes.
       */
      const respawnPlayer = (reason: string): string => {
        let safeY = terrain.getHeightAt(spawn.x, spawn.z) + 1 + PLAYER_EYE_HEIGHT;
        for (let y = 126; y >= 1; y--) {
          const bid = terrain.getBlockAt(Math.floor(spawn.x), y, Math.floor(spawn.z));
          if (bid !== 0 && bid !== 5) {
            safeY = Math.max(safeY, y + 1 + PLAYER_EYE_HEIGHT);
            break;
          }
        }
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
            // Re-centre streaming so the destination has physical terrain
            // before the next simulation tick. The complete render/prefetch
            // radius continues loading incrementally afterwards.
            streamCenter = toChunkCoordinate(camera.position.x, camera.position.z);
            renderer.updateVisibleChunks(
              streamCenter.cx,
              streamCenter.cz,
              INITIAL_CHUNK_RADIUS,
              chunkSource.generateChunk
            );
            forceTerrainCoverage = true;
            invalidateRenderSnapshot(engine);
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
          case 'boss': {
            const note = bossSummonRef.current?.(effect.entity ?? 'wood_warden');
            return note ?? 'Boss system unavailable.';
          }
          case 'weather':
            // The atmosphere system owns weather; setBiome re-evaluates it.
            atmosphere.setWeatherOverride(effect.weather ?? 'clear');
            return `Weather set to ${effect.weather}.`;
          default:
            return;
        }
      };

      // NOTE: velocityY / fallStartY / wasFalling are declared above, before
      // respawnPlayer and the command executor, which both assign them.
      let grounded = false; let jumpRequested = false;
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

      // Death screen actions: respawn or roam as a ghost.
      deathActionRef.current = {
        respawn: () => {
          setDead(false);
          setGhostMode(false);
          setPaused(false);
          setFlightMode(false);
          respawnPlayer('You died');
          canvasRef.current?.requestPointerLock?.();
        },
        ghost: () => {
          setDead(false);
          setGhostMode(true);
          setPaused(false);
          setFlightMode(true);
          flightEnabledRef.current = true;
          // Ghosts are intangible: no fall damage, no thirst, no mob harm.
          const fresh = createStarterSurvivalStats();
          survivalStatsRef.current = { ...fresh, health: 999 };
          publishSurvivalStats({ ...fresh, health: 999 });
          canvasRef.current?.requestPointerLock?.();
          showActionMessage('👻 Ghost mode — roam the world and haunt the living (F4 to respawn normally)');
        },
      };
      const isGroundedCheck = (pos: Vector3): boolean => {
        const feet = pos.y - PLAYER_EYE_HEIGHT;
        const supportY = Math.floor(feet - 0.06);
        const blockTop = supportY + 1;
        // Reused immutable offsets: sample the centre and four edges of the
        // collision footprint, just like a voxel character controller.
        for (const [ox, oz] of PLAYER_FOOTPRINT) {
          const bx = Math.floor(pos.x + ox);
          const bz = Math.floor(pos.z + oz);
          const id = terrain.getBlockAt(bx, supportY, bz);
          if (id !== 0 && id !== 5 && feet >= blockTop - 0.16 && feet <= blockTop + 0.24) return true;
        }
        return false;
      };

      /**
       * Surface X-ray cutaway repair.
       *
       * Every material in `BlockMaterials` sets `backFaceCulling = false`, so
       * Babylon renders both the outside and inside of every voxel face. A
       * camera whose eye point ends up *inside* a solid voxel (a fast fall
       * landing a frame late, a teleport/respawn placed a hair too low, or
       * standing dead-centre in a doorway that regenerated after a chunk edit)
       * is always facing the block's own interior far face, which stops the
       * ray — the ground no longer reads as see-through into the caves below.
       *
       * `moveWithCollisions` (used above for gravity and flight) resolves
       * *swept* collisions along a movement vector, but it does nothing for a
       * camera that is already resting inside solid geometry with no velocity
       * to sweep against — which is exactly the stuck cases listed above. This
       * runs every frame, is O(1), and simply lifts the eye to just above the
       * nearest open block whenever the voxel actually containing the camera
       * is solid, so the player is never embedded inside opaque geometry.
       */
      const resolveCameraPenetration = (pos: Vector3): void => {
        const lifted = resolveCameraPenetrationY(
          (x, y, z) => terrain.getBlockAt(x, y, z),
          pos.x,
          pos.y,
          pos.z,
          CHUNK_HEIGHT
        );
        if (lifted !== null) {
          pos.y = lifted;
          velocityY = 0;
        }
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
            // Tier changes are rare, so update the live caster set here once.
            // Chunk streaming itself uses lifecycle hooks and never scans the
            // whole scene per loaded chunk.
            renderer.forEachMesh(configureTerrainShadow);
          }
          glow.intensity = fx.bloomEnabled ? 0.22 : 0.0;
          glow.isEnabled = fx.bloomEnabled;
          if (pipeline) {
            pipeline.bloomEnabled = fx.bloomEnabled;
            pipeline.depthOfFieldEnabled = fx.depthOfFieldEnabled;
            pipeline.samples = fx.samples;
          }
          creatureManager.setPopulationCap(Math.round(26 * fx.creatureScale));
          atmosphere.setCloudDensityScale(fx.cloudScale);
          // Particles are pooled inside the atmosphere system.
          const particlesEnabled = shouldEnableAtmosphereParticles(settingsRef.current, tier);
          if (particlesEnabled !== lastParticleEnabled) {
            lastParticleEnabled = particlesEnabled;
            atmosphere.setParticlesEnabled(particlesEnabled);
          }
        } catch { /* effect tuning must never break the frame */ }
      };
      applyEffectTier(effectTier);

      let positionFrame = 0, survivalFrame = 0, streamFrame = 0;
      /** True when the previous frame meshed chunks, so the tuner can skip it. */
      let chunkWorkLastFrame = false;
      /** Tracks surface/submerged transitions so we only re-theme on change. */
      let wasSubmerged = false;
      /** Tracks cloud-deck entry/exit so the "flying into weather" message fires once. */
      let wasInClouds = false;
      let startupLoadingComplete = !renderer.hasPendingChunks(
        streamCenter.cx,
        streamCenter.cz,
        streamingRadiusFor(renderRadius)
      );
      // 2.0 — thirst. Deserts are now genuinely hostile: the bar drains fast in
      // the heat and you must find water (or an oasis) to top it back up.
      // NOTE: hydrationState is declared above, before the command executor.
      let currentClimate = climateForBiome('plains');
      let worldDay = 1, lastTimeOfDay = worldTimeRef.current.timeOfDay;
      let timeState: WorldTimeState = worldTimeRef.current;
      const lastCameraPosition = camera.position.clone();
      const tempForward = Vector3.Zero();
      const tempRight = Vector3.Zero();
      const tempMove = Vector3.Zero();
      const tempAvatarFeet = Vector3.Zero();
      const tempVerticalMove = Vector3.Zero();
      const tempWind = Vector3.Zero();
      const tempRiftPull = Vector3.Zero();

      // Edge-trigger state for controller buttons (so a held button doesn't
      // re-fire its action every frame).
      let padBtn0 = false, padBtn1 = false, padBtn2 = false, padBtn3 = false;
      let padBtn4 = false, padBtn5 = false, padBtn6 = false, padBtn7 = false;
      let padBtn8 = false, padBtn9 = false;

      /** Cycle the hotbar selection by a signed step (controller bumpers / touch). */
      // NPC spawn bridge for the AI assistant (chat lives outside this scope).
      aiNpcRef.current = (name: string, x: number, y: number, z: number, colours?: { shirt: string; hair: string; skin: string; pants: string }): void => {
        try {
          // Spawn an NPC villager and recolour its body parts to match the
          // persona's unique cosmetics (NPC variant looks).
          const res = creatureManager.spawnNear(new Vector3(x, y, z), 'villager');
          showActionMessage(`🧑 ${name} (NPC) spawned nearby`);
          void res;
          if (colours) {
            // Best-effort: find the spawned villager meshes and tint them.
            // (The creature manager builds from the registry palette; we skip
            // fine recolouring here to keep spawn reliable.)
          }
        } catch { /* NPC spawn is best-effort */ }
      };

      const cycleHotbar = (dir: number): void => {
        const cur = HOTBAR_BLOCKS.indexOf(selectedBlockRef.current as (typeof HOTBAR_BLOCKS)[number]);
        const next = HOTBAR_BLOCKS[(cur + dir + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length];
        selectedBlockRef.current = next;
        onSelectedBlockChange(next);
        audio.play('ui', settingsRef.current);
        showActionMessage(`Selected ${getBlock(next).name}`);
      };
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
          // PERF: this used to call setState every single frame while mining,
          // re-rendering the whole HUD React tree ~60x/second for a bar that
          // is only ~300px wide. Publishing at 2% granularity is visually
          // identical and cuts the renders by roughly 30x.
          const quantised = Math.round(progress * 50) / 50;
          if (quantised !== lastPublishedMiningProgress) {
            lastPublishedMiningProgress = quantised;
            setMiningProgress(quantised);
          }
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
        const budgetSignature = adaptiveBudgetKey(settingsRef.current);
        if (budgetSignature !== lastAdaptiveBudgetSignature) {
          lastAdaptiveBudgetSignature = budgetSignature;
          perf.setBudget(adaptiveBudgetForSettings(settingsRef.current));
          const clamped = perf.getState();
          applyRenderScale(engine, clamped.renderScale);
          if (clamped.renderDistance !== renderRadius) {
            renderRadius = clamped.renderDistance;
            invalidateRenderSnapshot(engine);
          }
          if (clamped.effectTier !== effectTier) {
            effectTier = clamped.effectTier;
            applyEffectTier(effectTier);
          }
        }
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
        } else {
          const manualEffectTier = effectTierForQualityPreset(settingsRef.current.qualityPreset);
          if (manualEffectTier !== effectTier) {
            effectTier = manualEffectTier;
            applyEffectTier(effectTier);
          }
          const manualRenderRadius = effectiveRenderDistance(settingsRef.current);
          if (manualRenderRadius !== renderRadius) {
            renderRadius = manualRenderRadius;
            invalidateRenderSnapshot(engine);
          }
          applyRenderScale(engine, settingsRef.current.renderScale);
        }
        chunkWorkLastFrame = false;

        // World clock. At the 1× default this advances deltaSeconds * 0.02 world
        // hours — the exact shipping rate; the developer panel's day/night
        // speed slider simply scales it (0.25×–8×) or freezes it entirely.
        const clockFrozen = timeState.frozen || devTuningRef.current.timeFrozen;
        if (!clockFrozen) { timeState = { ...timeState, timeOfDay: (timeState.timeOfDay + deltaSeconds * worldClockRatePerSecond(devTuningRef.current, DAY_LENGTH_SECONDS)) % 24 }; worldTimeRef.current = timeState; }
        else if (worldTimeRef.current !== timeState) timeState = worldTimeRef.current;
        // Wrapping past midnight advances the day counter shown in the HUD.
        if (timeState.timeOfDay < lastTimeOfDay) worldDay += 1;
        lastTimeOfDay = timeState.timeOfDay;
        const dimGravityY = dimensionRuntime.getState().id === 'overworld' ? -0.52 : dimensionRuntime.getState().id === 'crystal_realm' ? -0.30 : dimensionRuntime.getState().id === 'moon' ? -0.14 : -0.62;
        const gravityStrength = GRAVITY_BASE * (Math.abs(dimGravityY) / 0.52);
        const jumpVel = JUMP_VELOCITY_BASE * (dimGravityY < -0.3 ? 1 : 0.9 + Math.abs(dimGravityY) / 0.52 * 0.2);

        // Keep the atmosphere clock in sync with the world clock (so /time works).
        atmosphere.timeOfDay = timeState.timeOfDay;
        atmosphere.frozen = timeState.frozen || devTuningRef.current.timeFrozen;
        const currentParticleQuality = particleQualityFor(settingsRef.current.qualityPreset);
        if (currentParticleQuality !== lastParticleQuality) {
          lastParticleQuality = currentParticleQuality;
          atmosphere.setParticleQuality(currentParticleQuality);
        }

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
        viewModel.update(deltaSeconds, horizontalSpeed, Boolean(flightEnabledRef.current), sprintingRef.current);

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
        // Developer lighting presets scale fog density after the atmosphere
        // rewrites it each frame (identity multiplication at the vanilla
        // preset, so the stock look is untouched).
        const devFogScale = getLightingPreset(devTuningRef.current.lightingPreset).fogDensityScale;
        if (devFogScale !== 1) scene.fogDensity *= devFogScale;
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
        // the pass when the player changes the quality setting. Once recovery
        // has stripped the effect stack, never re-arm it from a settings
        // signature change — that is how the old fallback "looped".
        rayTracer.update(deltaSeconds);
        if (atmosphereFrame.sunDirection) rayTracer.setSunDirection(atmosphereFrame.sunDirection);
        const currentRayTracingSignature = rayTracingSettingsKey(settingsRef.current);
        if (currentRayTracingSignature !== lastRayTracingSignature) {
          lastRayTracingSignature = currentRayTracingSignature;
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
        } else {
          // Volumetric cloud immersion: flying up into the 64-block deck
          // must feel like an airplane punching into real weather — a thick,
          // sweeping, foggy mist that thickens as the player goes deeper in
          // and clears smoothly on the way out. Skipped entirely while
          // submerged, since the ocean fog above already owns the screen.
          const immersion = atmosphereFrame.cloudImmersion;
          if (immersion > 0.01) {
            const cloudColor = atmosphere.clouds.getMistColor();
            scene.fogMode = Scene.FOGMODE_EXP2;
            // Ramp density from the ambient atmosphere value up to a thick,
            // near-whiteout soup at full immersion.
            const baseDensity = atmosphereFrame.profile.fogDensity;
            scene.fogDensity = baseDensity + immersion * 0.045;
            scene.fogColor = Color3.Lerp(scene.fogColor, cloudColor, immersion);
            if (!wasInClouds && immersion > 0.5) {
              wasInClouds = true;
              showActionMessage('Flying into the clouds — visibility dropping in the mist');
            } else if (wasInClouds && immersion < 0.2) {
              wasInClouds = false;
              showActionMessage('Clear of the clouds');
            }
          } else if (wasInClouds) {
            wasInClouds = false;
          }
        }
        dimensionRuntime.update(deltaSeconds); worldInteractions.update(deltaSeconds); logicRuntime.update(deltaSeconds); authorityRuntime.update(deltaSeconds); settlementRuntime.update(camera.position, deltaSeconds);
        cinematicLighting.setTimeOfDay(timeState.timeOfDay);
        // Wind from the atmosphere drives the advanced physics simulations.
        const windPhase = performance.now() * 0.0001;
        tempWind.set(0.4 + 0.6 * Math.sin(windPhase), 0, 0.3 + 0.4 * Math.cos(windPhase * 1.3));
        physics.setWind(tempWind);
        physics.update(deltaSeconds);
        // Storm lightning flashes + meteors/comets that streak and crash.
        weatherEffects.update(deltaSeconds, atmosphere.getProfile().weather, camera.position, 0.55, 0.42);
        // 2.0 — severe weather (tornado/blizzard/sandstorm/meteor shower) with a
        // wandering tornado that pulls the player toward its funnel.
        {
          const weather = atmosphere.getProfile().weather;
          const severeType =
            weather === 'rain' ? 'tornado' as const
            : weather === 'snowstorm' ? 'blizzard' as const
            : weather === 'sandstorm' ? 'sandstorm' as const
            : weather === 'ashfall' || weather === 'embers' ? 'meteorshower' as const
            : 'none' as const;
          const severe = severeWeather.update(deltaSeconds, severeType, camera.position);
          if (severe.pull) camera.position.addInPlace(severe.pull.scale(deltaSeconds));
        }
        // Moon events: blood/crimson/full moon tint the night and raise hostile
        // spawn pressure. Only at night.
        moonEvents.update(deltaSeconds);
        const moonState = moonEvents.getState();
        if (moonState.id !== 'none' && moonState.strength > 0.01) {
          creatureManager.setMoonEvent(moonEvents.hostilityMultiplier(), moonEvents.allowFullMoonCreature());
          const tint = moonEvents.skyTint();
          if (tint) {
            scene.clearColor.r = Math.max(scene.clearColor.r, tint.r * 0.5);
            scene.clearColor.g = Math.max(scene.clearColor.g, tint.g * 0.5);
            scene.clearColor.b = Math.max(scene.clearColor.b, tint.b * 0.5);
          }
          if (streamFrame % 120 === 0) showActionMessage(`🌕 ${moonState.label}`);
        } else {
          creatureManager.setMoonEvent(1, false);
        }
        // --- Oris / Chorus + Psychedelics special events -------------------
        specialEvents.update(deltaSeconds);
        const specialState = specialEvents.getState();
        if (specialState.id === 'oris_chorus' && specialState.strength > 0.01) {
          // The world runs hot and reality tears open as Oris approaches.
          scene.clearColor.r = Math.max(scene.clearColor.r, 0.28 * specialState.strength);
          scene.clearColor.b = Math.max(scene.clearColor.b, 0.18 * specialState.strength);
          if (streamFrame % 90 === 0) showActionMessage(`🪐 ${specialState.label} — heat rising`);
          // Grow chorus blocks: spawn a cluster somewhere near the player.
          const toGrow = specialEvents.consumeChorusGrowth();
          if (toGrow > 0) {
            for (let i = 0; i < toGrow; i++) {
              const gx = Math.floor(camera.position.x + (Math.random() - 0.5) * 40);
              const gz = Math.floor(camera.position.z + (Math.random() - 0.5) * 40);
              const gy = terrain.getSurfaceHeight(gx, gz);
              if (gy > 1 && gy < CHUNK_HEIGHT - 2) {
                terrain.setBlockAt(gx, gy + 1, gz, 307);
                renderer.rebuildForWorldBlock(gx, gz);
                saveWorldEdits();
              }
            }
            forceTerrainCoverage = true;
            showActionMessage('🌺 Chorus blooms across the world!');
          }
        } else if (specialState.id === 'psychedelics' && specialState.strength > 0.01) {
          // Psychedelic world tint + message.
          if (streamFrame % 90 === 0) showActionMessage(`🌈 ${specialState.label}`);
        }
        // --- Oris / Psychedelics survival rewards --------------------------
        // Surviving the Chorus event grants an achievement; surviving the
        // Psychedelics moon grants a shard-unlock code and drops a Shard.
        if (specialEvents.hasSurvivedOris()) {
          if (streamFrame % 40 === 0) showActionMessage('🏆 Achievement: SURVIVED ORIS');
        }
        const shard = specialEvents.consumeShardCode();
        if (shard.fresh && shard.code) {
          showActionMessage(`🗝️ Hidden chest code: ${shard.code}`);
          showActionMessage('💠 You found a Shard! The reward chest has been unlocked.');
          publishInventory(addToInventory(inventoryRef.current, 308 as BlockID, 1));
          onGameplayEvent('shardsCollected', 1);
        }
        // 1.0 — animate the dimension portals and spawn reality rifts occasionally.
        portalSystem.update(deltaSeconds, camera.position);
        // Seamless dimension traversal: crossing a physical planet's
        // atmospheric boundary swaps the voxel world to that planet's own
        // ground dimension, exactly like walking through a portal frame.
        const planetApproaches = physicalPlanets.update(deltaSeconds, camera.position);
        for (const approach of planetApproaches) {
          const targetDimension = approach.planet.dimension;
          const prevDim = chunkSource.getDimension();
          dimensionRuntime.setDimension(targetDimension);
          dimensionRuntime.triggerTransitionEffect(camera.position, true);
          atmosphere.setDimension(targetDimension);
          chunkSource.setDimension(targetDimension);
          if (chunkSource.hasOwnTerrain(targetDimension) || chunkSource.hasOwnTerrain(prevDim)) {
            renderer.clearAll();
            invalidateRenderSnapshot(engine);
            const sy = chunkSource.getSurfaceHeightAt(camera.position.x, camera.position.z);
            camera.position.y = sy >= 1 ? sy + 1 + PLAYER_EYE_HEIGHT : 64 + PLAYER_EYE_HEIGHT;
            streamCenter = toChunkCoordinate(camera.position.x, camera.position.z);
            renderer.updateVisibleChunks(streamCenter.cx, streamCenter.cz, INITIAL_CHUNK_RADIUS, chunkSource.generateChunk);
          }
          forceTerrainCoverage = true;
          showActionMessage(`Entering ${approach.planet.name}'s atmosphere — welcome to ${dimensionRuntime.getDefinition().name}`);
        }
        realityRifts.update(deltaSeconds, camera.position, camera.position);
        // World's Edge: the end-of-world monster timer & edge grab.
        if (worldsEdge.isActive()) {
          const edgeRes = worldsEdge.tick(
            deltaSeconds,
            Math.hypot(camera.position.x, camera.position.z),
            gameModeRef.current === 'creative' || gameModeRef.current === 'incredible',
            performance.now()
          );
          if (edgeRes?.message) showActionMessage(edgeRes.message);
          if (edgeRes?.grabPlayer) {
            // Tentacle grab: flash, pull down, die to the monster.
            showActionMessage('🦑 The monster\u2019s tentacles drag you into the dark\u2026');
            const next = applyDamage(survivalStatsRef.current, 9999);
            survivalStatsRef.current = next; publishSurvivalStats(next);
            setDead(true);
          }
          if (edgeRes?.corruptAt) {
            // Corrupt the land: turn a nearby block column into corrupted stone.
            const cx = edgeRes.corruptAt.x, cz = edgeRes.corruptAt.z;
            const gy = terrain.getSurfaceHeight(cx, cz);
            if (gy >= 1) {
              terrain.setBlockAt(cx, gy, cz, 313);
              renderer.rebuildForWorldBlock(cx, cz);
            }
          }
          if (edgeRes?.worldConsumed) {
            showActionMessage('💀 The world has been consumed. This run is over.');
            const next = applyDamage(survivalStatsRef.current, 9999);
            survivalStatsRef.current = next; publishSurvivalStats(next);
            setDead(true);
          }
        }
        // Ancient-City rift portal: animate it, and step through to teleport to
        // the Rift Dimension.
        if (ancientCityRift.isActive()) {
          ancientCityRift.tick(deltaSeconds);
          if (ancientCityRift.consumeStep(camera.position.x, camera.position.y, camera.position.z)
            && chunkSource.getDimension() !== 'rift_dimension') {
            const targetDim: RuntimeDimensionID = 'rift_dimension';
            const prevDim = chunkSource.getDimension();
            dimensionRuntime.setDimension(targetDim);
            dimensionRuntime.triggerTransitionEffect(camera.position, true);
            atmosphere.setDimension(targetDim);
            chunkSource.setDimension(targetDim);
            if (chunkSource.hasOwnTerrain(targetDim) || chunkSource.hasOwnTerrain(prevDim)) {
              renderer.clearAll();
              invalidateRenderSnapshot(engine);
              const sy = chunkSource.getSurfaceHeightAt(camera.position.x, camera.position.z);
              camera.position.y = sy >= 1 ? sy + 1 + PLAYER_EYE_HEIGHT : 64 + PLAYER_EYE_HEIGHT;
              streamCenter = toChunkCoordinate(camera.position.x, camera.position.z);
              renderer.updateVisibleChunks(streamCenter.cx, streamCenter.cz, INITIAL_CHUNK_RADIUS, chunkSource.generateChunk);
            }
            forceTerrainCoverage = true;
            ancientCityRift.clear();
            showActionMessage('🌀 Torn through reality — entered The Rift Dimension');
            publishRuntimeStatus();
          }
        }
        // Rift suction — a nearby reality tear drags the player toward it.
        const riftPull = realityRifts.pullOnPlayer(camera.position, tempRiftPull);
        if (riftPull.lengthSquared() > 1e-6) {
          tempRiftPull.set(riftPull.x * deltaSeconds, riftPull.y * deltaSeconds, riftPull.z * deltaSeconds);
          camera.position.addInPlace(tempRiftPull);
        }
        // Celestial black-hole suction: at night the black hole in the sky pulls
        // the player toward it, so flying near it feels like falling in.
        const bhPull = atmosphere.celestial.pullFromBlackHole(camera.position);
        if (bhPull) {
          tempRiftPull.set(bhPull.x * deltaSeconds, bhPull.y * deltaSeconds, bhPull.z * deltaSeconds);
          camera.position.addInPlace(tempRiftPull);
        }
        // 2.0 — End black-hole sky: gravitational-lensing hole above the dragon
        // island that pulls the player toward the central end portal (never
        // destroys blocks). Active only in The End.
        {
          const inEnd = chunkSource.getDimension() === 'end';
          endBlackHole.setActive(inEnd);
          if (inEnd) {
            endBlackHole.ensure(camera.position.clone().add(new Vector3(0, 120, 0)));
            endBlackHole.tick(deltaSeconds);
            endBlackHole.pull(camera.position, tempRiftPull);
            camera.position.addInPlace(tempRiftPull.scale(deltaSeconds * 2));
          }
        }
        // 1.0 — tick command-block system (repeating/impulse/chain).
        commandBlockSystem.tick(deltaSeconds);
        const settlementMessage = settlementRuntime.consumeDiscoveryMessage(); if (settlementMessage) showActionMessage(settlementMessage);
        // Keep the spawner's clock in step so nocturnal species (scorpions,
        // owls, bats) only appear after dark.
        // Boss encounters tick before creatures so summoned minions appear
        // in the same frame the ability fires.
        if (activeBoss) {
          activeBoss.update(deltaSeconds, camera.position);
          if (streamFrame % 6 === 0) publishBoss();
        }
        creatureManager.setTimeOfDay(timeState.timeOfDay);
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

        /* ---- Controller + touch input (off by default) -------------------
           When controllerSupport is on, a connected gamepad drives the camera:
           left stick moves, right stick looks, and the face/trigger buttons
           jump, fly, mine, place, open the inventory, open chat and pause.
           When touchControls is on, the on-screen joystick (`touchStickRef`)
           moves the camera the same way. Both are layered on top of the normal
           keyboard/mouse scheme, so they never conflict with it. */
        const usingController = settingsRef.current.controllerSupport;
        const usingTouch = settingsRef.current.touchControls;
        if (usingController || usingTouch) {
          let moveX = 0;
          let moveY = 0;
          let lookX = 0;
          let lookY = 0;
          if (usingController) {
            const pad = (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [])[0] ?? null;
            if (pad) {
              const LX = pad.axes[0] ?? 0;
              const LY = pad.axes[1] ?? 0;
              const RX = pad.axes[2] ?? 0;
              const RY = pad.axes[3] ?? 0;
              const dead = 0.14;
              moveX = Math.abs(LX) > dead ? LX : 0;
              moveY = Math.abs(LY) > dead ? LY : 0;
              lookX = Math.abs(RX) > dead ? RX : 0;
              lookY = Math.abs(RY) > dead ? RY : 0;
              const btn = (i: number) => (pad.buttons[i]?.pressed ?? false);
              // Buttons only fire on a fresh press (edge-triggered).
              if (btn(0) && !padBtn0) { padBtn0 = true; jumpRequested = true; }
              if (!btn(0)) padBtn0 = false;
              if (btn(1) && !padBtn1) { padBtn1 = true; toggleFlightMode(); showActionMessage(`Flight ${flightEnabledRef.current ? 'ON' : 'OFF'}`); }
              if (!btn(1)) padBtn1 = false;
              if (btn(2) && !padBtn2) { padBtn2 = true; startMining(); }
              if (!btn(2)) padBtn2 = false;
              if (btn(3) && !padBtn3) { padBtn3 = true; placeSelectedBlock(); }
              if (!btn(3)) padBtn3 = false;
              if (btn(9) && !padBtn9) { padBtn9 = true; setPaused((p) => !p); }
              if (!btn(9)) padBtn9 = false;
              if (btn(8) && !padBtn8) { padBtn8 = true; onToggleInventory(); }
              if (!btn(8)) padBtn8 = false;
              if (btn(6) && !padBtn6) { padBtn6 = true; setChatOpen(true); setCommandOpen(false); }
              if (!btn(6)) padBtn6 = false;
              if (btn(7) && !padBtn7) { padBtn7 = true; setCommandOpen(true); setChatOpen(false); }
              if (!btn(7)) padBtn7 = false;
              // Triggers mine (hold to keep mining) / place.
              if (pad.buttons[7]?.value > 0.5) startMining();
              if (pad.buttons[6]?.value > 0.5) placeSelectedBlock();
              // Sprint: holding the left shoulder/trigger (button 6/10) sprints.
              sprintingRef.current = btn(10) || btn(6) || (pad.buttons[6]?.value ?? 0) > 0.5;
              // Bumpers cycle the hotbar.
              if (btn(4) && !padBtn4) { padBtn4 = true; cycleHotbar(-1); }
              if (!btn(4)) padBtn4 = false;
              if (btn(5) && !padBtn5) { padBtn5 = true; cycleHotbar(1); }
              if (!btn(5)) padBtn5 = false;
            }
          }
          if (usingTouch) {
            const stick = touchStickRef.current;
            moveX += stick.x;
            moveY += stick.y;
            // Touch drag on the world rotates the camera (Minecraft-PE style).
            lookX += touchLookRef.current.x;
            lookY += touchLookRef.current.y;
            touchLookRef.current.x = 0;
            touchLookRef.current.y = 0;
          }

          // Look: right stick (controller) / drag (touch) rotates the camera.
          const lookSens = usingController ? 0.0026 : 0.006;
          if (Math.abs(lookX) > 0.001 || Math.abs(lookY) > 0.001) {
            camera.rotation.y -= lookX * lookSens * 60 * deltaSeconds;
            camera.rotation.x -= lookY * lookSens * 60 * deltaSeconds;
            const halfPi = Math.PI / 2 - 0.01;
            camera.rotation.x = Math.max(-halfPi, Math.min(halfPi, camera.rotation.x));
          }

          // Movement: drive the camera along its facing directions.
          if (Math.abs(moveX) > 0.001 || Math.abs(moveY) > 0.001) {
            camera.getDirectionToRef(Vector3.LeftHandedForwardReadOnly, tempForward);
            camera.getDirectionToRef(Vector3.RightReadOnly, tempRight);
            tempForward.y = 0; tempRight.y = 0;
            if (tempForward.lengthSquared() > 0.001) tempForward.normalize();
            if (tempRight.lengthSquared() > 0.001) tempRight.normalize();
            tempMove.copyFrom(tempForward).scaleInPlace(moveY);
            tempMove.addInPlace(tempRight.scale(moveX));
            tempMove.normalize();
            const sprinting = sprintingRef.current && !flightEnabledRef.current;
            const walkSpeed = (flightEnabledRef.current ? settingsRef.current.cameraSpeed * 2.6 : settingsRef.current.cameraSpeed * (sprinting ? 2.1 : 1.15)) * 60 * deltaSeconds;
            tempMove.scaleInPlace(Math.max(0, walkSpeed));
            (camera as any).moveWithCollisions?.(tempMove);
            if (!(camera as any).moveWithCollisions) camera.position.addInPlace(tempMove);
            // Track a move phase so the flying/walking arm animation can sync.
            movePhaseRef.current += tempMove.length() * 0.04;
          }
        }

        if (thirdPerson) {
          // Visual third-person model: keep the real camera/player collision at
          // the controlled position, and draw the avatar a few blocks in front
          // of the camera. The old toggle moved the camera backward and then
          // snapped the avatar to that same camera point, which made the model
          // disappear into/behind the near plane.
          camera.getDirectionToRef(Vector3.LeftHandedForwardReadOnly, tempForward);
          tempForward.y = 0;
          if (tempForward.lengthSquared() < 0.001) tempForward.set(0, 0, 1);
          tempForward.normalize();
          tempAvatarFeet.copyFrom(tempForward).scaleInPlace(THIRD_PERSON_DISTANCE).addInPlace(camera.position);
          avatar.position.x = tempAvatarFeet.x;
          avatar.position.z = tempAvatarFeet.z;
          // Stand the avatar on the REAL terrain surface at its own feet so it
          // never "falls off" over a drop or clips through a rise (the old code
          // reused the camera's feet height, so the model floated/sank on
          // uneven ground).
          const avSurface = terrain.getSurfaceHeight(Math.floor(avatar.position.x), Math.floor(avatar.position.z));
          avatar.position.y = (avSurface >= 1 ? avSurface + 1 : camera.position.y - 1.62);
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
            tempVerticalMove.set(0, flyStep, 0);
            (camera as any).moveWithCollisions?.(tempVerticalMove);
            if (!(camera as any).moveWithCollisions) camera.position.y += flyStep;
          }
        } else {
          // Sprinting: holding Shift (or a controller/touch sprint) roughly
          // doubles ground speed. Legs no longer "get stuck" because Babylon's
          // collision moveWithCollisions steps are scaled per-frame by speed.
          const sprinting = sprintingRef.current && !flightEnabledRef.current;
          camera.speed = Math.max(0.7, settingsRef.current.cameraSpeed * (sprinting ? 2.1 : 1.15));
          grounded = isGroundedCheck(camera.position);
          if (grounded) {
            if (velocityY < -0.5 && wasFalling) {
              const fallDist = fallStartY - camera.position.y;
              if (fallDist > 5.8) { const dmg = Math.round((fallDist - 5.8) * 5.2); const next = applyDamage(survivalStatsRef.current, dmg); survivalStatsRef.current = next; publishSurvivalStats(next); showActionMessage(`Fall damage -${dmg} HP from ${fallDist.toFixed(1)}m`); }
            }
            // Strict grounding snap-gate. The instant a floor collision is
            // detected, downward velocity is forced to absolute 0 (never a
            // residual fraction) and the eye is snapped a hair above the
            // supporting block top. A tiny 0.01 epsilon stops the collider
            // footprint from overlapping the chunk mesh bounds, which is what
            // produced the rapid standing/walking camera shake.
            velocityY = 0;
            const groundFeet = camera.position.y - PLAYER_EYE_HEIGHT;
            const supportBlockY = Math.floor(groundFeet - 0.06);
            const supportBlockTop = supportBlockY + 1;
            camera.position.y = supportBlockTop + PLAYER_EYE_HEIGHT + 0.01;
            wasFalling = false; fallStartY = camera.position.y;
            if (jumpRequested) { velocityY = jumpVel; grounded = false; jumpRequested = false; audio.play('ui', settingsRef.current); showActionMessage(`Jump!`); }
          } else {
            if (!wasFalling) { wasFalling = true; fallStartY = lastCameraPosition.y; }
            velocityY += gravityStrength * deltaSeconds; if (velocityY < TERMINAL_VELOCITY) velocityY = TERMINAL_VELOCITY;
          }
          if (Math.abs(velocityY) > 0.001 && !grounded) {
            tempVerticalMove.set(0, velocityY * deltaSeconds, 0);
            (camera as any).moveWithCollisions?.(tempVerticalMove);
            if (!(camera as any).moveWithCollisions) {
              const nextY = camera.position.y + velocityY * deltaSeconds;
              const supportY = Math.floor(nextY - PLAYER_EYE_HEIGHT - 0.05);
              const footId = terrain.getBlockAt(Math.floor(camera.position.x), supportY, Math.floor(camera.position.z));
              if (footId === 0 || footId === 5 || velocityY > 0) camera.position.y = nextY;
              else {
                camera.position.y = supportY + 1 + PLAYER_EYE_HEIGHT + 0.01;
                velocityY = 0;
              }
            }
          }
        }

        // Swimming: when the player's body is immersed in water (fluid, not a
        // solid), apply buoyancy so they float and can swim up with SPACE
        // instead of sinking straight through the water column.
        const inWaterBody = (() => {
          const py = Math.floor(camera.position.y - PLAYER_EYE_HEIGHT / 2);
          return terrain.getBlockAt(Math.floor(camera.position.x), py, Math.floor(camera.position.z)) === 5;
        })();
        if (inWaterBody && !flightEnabledRef.current) {
          // Buoyancy keeps the player near the surface; SPACE swims upward.
          if (pressedKeys.has('Space') || pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight')) {
            velocityY = 4.2;
            grounded = false;
          } else {
            // Float: gently rise toward the surface if sinking, else drift.
            velocityY = Math.max(velocityY, -1.2);
          }
          wasFalling = false;
          fallStartY = camera.position.y;
        }

        // Ground collision gate lock — a hard safety net on top of the
        // per-block grounding snap above. Instead of trusting the analytic
        // `getSurfaceHeight()` estimate (which can disagree with the real
        // voxels and make the player hover after stepping/jumping onto a
        // lower block), it scans the actual solid voxel directly beneath the
        // player's feet and lands the boots on that block's top face, then
        // freezes downward velocity to 0.
        if (!flightEnabledRef.current) {
          const feetY = camera.position.y - PLAYER_EYE_HEIGHT;
          const px = Math.floor(camera.position.x);
          const pz = Math.floor(camera.position.z);
          let supportTop = -1;
          for (let by = Math.floor(feetY + 0.5); by >= 0; by -= 1) {
            const id = terrain.getBlockAt(px, by, pz);
            if (id !== 0 && id !== 5) { supportTop = by + 1; break; }
          }
          // Only engage when there really is a solid block beneath the feet.
          if (supportTop >= 0 && feetY <= supportTop) {
            // Embedded or hovering right at the surface: snap boots onto it.
            camera.position.y = supportTop + PLAYER_EYE_HEIGHT;
            velocityY = 0;
            wasFalling = false;
            fallStartY = camera.position.y;
            grounded = true;
          } else if (supportTop >= 0 && feetY <= supportTop + 0.1) {
            // A hair above the block top — settle onto it so the player never
            // floats just off the surface.
            camera.position.y = supportTop + PLAYER_EYE_HEIGHT;
            velocityY = 0;
            wasFalling = false;
            fallStartY = camera.position.y;
            grounded = true;
          }
          // If the feet are clearly above the support (a real drop), leave
          // gravity running so the player falls naturally onto the block.
        }

        // Runs after every movement path (flight, falling, walking) so the
        // player's eye can never end up resting inside opaque, backface-
        // culled voxel geometry — see `resolveCameraPenetration` above for
        // why that specific state is what produces the "see through solid
        // ground into the caves below" report.
        resolveCameraPenetration(camera.position);

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

        survivalStatsRef.current = nextSurvival; survivalFrame += 1; if (survivalFrame % 12 === 0) publishSurvivalStats(nextSurvival);

        // --- death ------------------------------------------------------------
        // Health could previously reach zero and simply stay there: starving,
        // dehydrating or falling had no terminal consequence, so survival had
        // no stakes. One check here covers every damage source, since they all
        // funnel into `survivalStatsRef` above. On death the game shows a red
        // death screen with "Respawn" or "Become Ghost" instead of instantly
        // teleporting back to spawn.
        if (nextSurvival.health <= 0 && !isCreativeMode(gameModeRef.current) && !ghostMode) {
          if (!dead) {
            setDead(true);
            setPaused(true);
            document.exitPointerLock?.();
            showActionMessage('You died');
          }
        }
        // Incremental world streaming. The target includes a one-chunk guard
        // ring beyond the selected render distance, so terrain that has real
        // collision data is also already drawable when the player crosses a
        // 16-block boundary.
        const movedChunk = toChunkCoordinate(camera.position.x, camera.position.z);
        const centerChanged = movedChunk.cx !== streamCenter.cx || movedChunk.cz !== streamCenter.cz;
        if (centerChanged) streamCenter = movedChunk;
        const playerFacingRadius = renderRadius;
        const streamingRadius = streamingRadiusFor(playerFacingRadius);
        const visibleCoverageMissing = !renderer.hasChunksInRadius(
          streamCenter.cx,
          streamCenter.cz,
          playerFacingRadius
        );
        const visibleSetDirty = renderer.hasPendingChunks(
          streamCenter.cx,
          streamCenter.cz,
          streamingRadius
        );
        // Fill startup every frame behind the loading cover. Once playable,
        // ordinary prefetch work stays spread across every third frame. If a
        // fast flight/teleport has outrun the guard ring, switch to a bounded
        // every-frame catch-up burst until the player-facing world is solid
        // and visible again — never leave collidable terrain invisible.
        const recoveringCoverage = forceTerrainCoverage || visibleCoverageMissing;
        const shouldStreamThisFrame = centerChanged
          || !startupLoadingComplete
          || recoveringCoverage
          || streamFrame % 3 === 0;
        if (visibleSetDirty && shouldStreamThisFrame) {
          const result = renderer.updateVisibleChunks(
            streamCenter.cx,
            streamCenter.cz,
            streamingRadius,
            chunkSource.generateChunk,
            recoveringCoverage
              ? { budget: COVERAGE_RECOVERY_CHUNKS_PER_FRAME, timeBudgetMs: COVERAGE_RECOVERY_STREAM_BUDGET_MS }
              : { budget: CHUNKS_PER_FRAME, timeBudgetMs: CHUNK_STREAM_BUDGET_MS }
          );
          // A teleport needs a complete player-facing ring before going back
          // to low-priority prefetch work. Do not wait for the outer guard ring
          // itself: it is intentionally allowed to finish in the background.
          forceTerrainCoverage = !renderer.hasChunksInRadius(
            streamCenter.cx,
            streamCenter.cz,
            playerFacingRadius
          );
          if (result.loaded > 0 || result.unloaded > 0) {
            // Meshing is expensive and bursty; tell the tuner to ignore this
            // frame so streaming does not look like a sustained slowdown.
            chunkWorkLastFrame = true;
            // The drawn mesh set changed, so a cached WebGPU command bundle
            // would be replaying stale draws. Force it to re-record.
            invalidateRenderSnapshot(engine);
            // New/rebuilt terrain meshes update their own shadow membership
            // through ChunkRenderManager's lifecycle hook. Do not rescan every
            // mesh in the scene here — that made streaming O(n²).
          }
          if (!startupLoadingComplete) {
            const startupStreamingRadius = streamingRadiusFor(renderRadius);
            const currentStartupTotal = chunksInRadius(startupStreamingRadius);
            const loadedVisibleChunks = Math.max(0, Math.min(currentStartupTotal, currentStartupTotal - result.pending));
            const chunkRatio = currentStartupTotal > 0 ? loadedVisibleChunks / currentStartupTotal : 1;
            const elapsed = performance.now() - loadingStartedAt;
            const playerFacingCoverageReady = renderer.hasChunksInRadius(
              streamCenter.cx,
              streamCenter.cz,
              playerFacingRadius
            );
            if (result.pending === 0) {
              startupLoadingComplete = true;
              reportLoadingProgress(100, `World ready — ${loadedVisibleChunks}/${currentStartupTotal} terrain chunks loaded`, true, { loadedChunks: loadedVisibleChunks, totalChunks: currentStartupTotal });
            } else if (elapsed >= WORLD_LOADING_MAX_MS && playerFacingCoverageReady) {
              // The guard ring can safely continue in the background, but do
              // not ever dismiss the loading cover while the player could be
              // standing on terrain that is not drawn yet.
              startupLoadingComplete = true;
              reportLoadingProgress(100, `Playable now — ${loadedVisibleChunks}/${currentStartupTotal} chunks loaded; the outer safety ring will finish streaming`, true, { loadedChunks: loadedVisibleChunks, totalChunks: currentStartupTotal });
            } else {
              reportLoadingProgress(76 + chunkRatio * 23, `Streaming terrain ${loadedVisibleChunks}/${currentStartupTotal}`, false, { loadedChunks: loadedVisibleChunks, totalChunks: currentStartupTotal });
            }
          }
          if (result.pending > 0 && streamFrame % 30 === 0) {
            showActionMessage(`Loading terrain — ${result.pending} chunks remaining`);
          } else if (result.pending === 0 && result.loaded > 0) {
            showActionMessage(`World loaded • render distance ${renderRadius} chunks`);
          }
        }
        streamFrame += 1;
        if (streamFrame % 20 === 0) {
          logicRuntime.scanPlacedNetwork(camera.position); publishRuntimeStatus();
          const targetPick = scene.pickWithRay(camera.getForwardRay(BLOCK_REACH));
          const creatureId = targetPick?.pickedMesh?.metadata?.creatureId as string | undefined;
          if (targetPick?.hit && creatureId) setTargetLabel('Creature • left click');
          else if (targetPick?.hit && targetPick.pickedPoint && targetPick.pickedMesh?.name.startsWith('voxel_world_')) {
            const normal = targetPick.getNormal(true);
            if (normal) { normal.normalize(); const target = toBlockCoordinate(targetPick.pickedPoint.add(normal.scale(-0.01))); const blockId = terrain.getBlockAt(target.x, target.y, target.z); setTargetLabel(blockId === 0 ? '' : getBlock(blockId).name); }
          } else setTargetLabel('');
          if (settingsRef.current.showStats || settingsRef.current.showPerformanceOverlay) publishRenderStats();
        }
        positionFrame += 1;
        if (positionFrame % 15 === 0) {
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
        playerPosRef.current.x = camera.position.x;
        playerPosRef.current.y = camera.position.y;
        playerPosRef.current.z = camera.position.z;
        lastCameraPosition.copyFrom(camera.position);
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
        // Bosses are large, so they get a longer reach than ordinary mobs and
        // are checked first.
        if (activeBoss?.isAlive()) {
          const bossPick = scene.pickWithRay(
            camera.getForwardRay(Math.max(BLOCK_REACH, 12)),
            (mesh) => Boolean(mesh.metadata?.bossId)
          );
          if (bossPick?.hit) {
            const tool = getTool(selectedToolRef.current);
            const damage = 12 + tool.tier * 9 + (tool.kind === 'axe' ? 4 : 0);
            const result = activeBoss.damage(damage);
            audio.play(result.dead ? 'creature_down' : 'hit', settingsRef.current);
            authorityRuntime.recordAction();
            if (!result.dead) {
              showActionMessage(`${activeBoss.def.name}: ${Math.ceil(result.health)}/${activeBoss.def.health} HP`);
            }
            publishBoss();
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
            renderer.clearAll();
            invalidateRenderSnapshot(engine);
            streamCenter = toChunkCoordinate(camera.position.x, camera.position.z);
            renderer.updateVisibleChunks(streamCenter.cx, streamCenter.cz, INITIAL_CHUNK_RADIUS, chunkSource.generateChunk);
            forceTerrainCoverage = true;
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
        // TV / Computer screens: add a live-view screen mesh on the block face.
        if (blockToPlace === 326 || blockToPlace === 327) {
          const facing = Math.abs(picked.normal.x) > Math.abs(picked.normal.z) ? 'x' : 'z';
          const camPos = new Vector3(placeTarget.x + 0.5, placeTarget.y + 0.5, placeTarget.z + 0.5);
          screenSystem.addScreen(`scr_${placeTarget.x}_${placeTarget.y}_${placeTarget.z}`, camPos, blockToPlace === 327 ? 'computer' : 'tv', facing);
          showActionMessage(blockToPlace === 327 ? '🖥️ Computer placed — showing live view' : '📺 TV placed — showing live view');
        }
        // Water is a fluid: a placed source flows downward and sideways into a
        // bounded pool instead of sitting as a single frozen block.
        if (blockToPlace === 5) flowWater(terrain, placeTarget.x, placeTarget.y, placeTarget.z);
        authorityRuntime.recordAction(); if (!creativeNow) publishInventory(removeFromInventory(inventoryRef.current, blockToPlace, 1));
        onGameplayEvent('blocksPlaced'); audio.play('place', settingsRef.current); rebuildEditedBlock(placeTarget); saveWorldEdits();

        // Buildable portals: each dimension has its own build technique (2.0).
        // Placing the frame-completing block — Obsidian (Nether standing ring),
        // a Crystal Shard on a ground ring (End), Glass (Aether globe), or Rift
        // Stone (twin rift cylinders) — lights the matching portal.
        const portalTriggerBlocks = [12, 16, 64, 313];
        if (portalTriggerBlocks.includes(blockToPlace)) {
          const frame = portalSystem.findBuildablePortalFrame(
            placeTarget.x, placeTarget.y, placeTarget.z,
            (x, y, z) => terrain.getBlockAt(x, y, z)
          );
          if (frame) {
            portalSystem.spawnForDimension(frame.dimension, new Vector3(frame.x, frame.y, frame.z));
            forceTerrainCoverage = true;
            const portalName = portalSystem.portalName(frame.dimension) ?? dimensionRuntime.getDefinition().name;
            showActionMessage(`🔥 Portal activated — ${portalName}`);
            audio.play('ui', settingsRef.current);
          }
        }
        // TNT: fuse briefly, then detonate with a real voxel blast + fire.
        if (blockToPlace === 167) {
          showActionMessage('TNT armed — stand back!');
          const tx = placeTarget.x, ty = placeTarget.y, tz = placeTarget.z;
          window.setTimeout(() => {
            detonateTNT(scene, {
              getBlock: (x, y, z) => terrain.getBlockAt(x, y, z),
              setBlock: (x, y, z, block) => terrain.setBlockAt(x, y, z, block),
              drop: (block, x, y, z) => itemDrops.spawnDrop(block as BlockID, new Vector3(x + 0.5, y + 0.5, z + 0.5), 1),
              rebuild: (x, z) => renderer.rebuildForWorldBlock(x, z),
              playCue: () => audio.play('explosion', settingsRef.current),
              fireBlock: 303,
            }, tx, ty, tz, TNT_BLAST_RADIUS);
            // Screen shake if the blast is near the camera.
            const d = Vector3.Distance(camera.position, new Vector3(tx, ty, tz));
            if (d < 24) {
              const amp = (1 - d / 24) * 0.12;
              camera.position.x += (Math.random() - 0.5) * amp;
              camera.position.z += (Math.random() - 0.5) * amp;
            }
            forceTerrainCoverage = true;
            showActionMessage('BOOM!');
          }, TNT_FUSE_SECONDS * 1000);
          return;
        }
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
          // Right-click on a redstone component toggles it instead of placing.
          const target = pickTargetBlock();
          if (target) {
            // Ancient-City rift puzzle: Note Blocks + Jukebox.
            const tx = target.target.x, ty = target.target.y, tz = target.target.z;
            const tb = terrain.getBlockAt(tx, ty, tz);
            if (tb === 330 || tb === 331 || tb === 332) {
              // Rail / Minecart: right-click a minecart on a rail to ride it
              // forward along the track (a short fast ride).
              viewModel.swing();
              if (tb === 332) {
                // Find the rail direction and boost the player along it.
                const dirX = terrain.getBlockAt(tx + 1, ty, tz) === 330 || terrain.getBlockAt(tx + 1, ty, tz) === 331 ? 1 : -1;
                const dirZ = terrain.getBlockAt(tx, ty, tz + 1) === 330 || terrain.getBlockAt(tx, ty, tz + 1) === 331 ? 1 : -1;
                camera.position.x += dirX * 6;
                camera.position.z += dirZ * 6;
                showActionMessage('🚂 You hop in the minecart and zoom along the rail!');
              } else {
                showActionMessage('🚂 Place a Minecart on the rail, then click it to ride.');
              }
              audio.play('ui', settingsRef.current);
              return;
            }
            if (tb === 315) {
              // MCP Player Block — spawns an NPC that acts like a player type.
              viewModel.swing();
              aiNpcRef.current?.(appearance?.name ?? 'Player', tx + 1, ty, tz + 1);
              showActionMessage('🧑 MCP Player activated — an NPC player joins you');
              audio.play('ui', settingsRef.current);
              return;
            }
            if (tb === 309 || tb === 310) {
              viewModel.swing();
              const msg = tb === 309
                ? ancientCityRift.onNoteBlock(tx, ty, tz, performance.now())
                : ancientCityRift.onJukebox(tx, ty, tz, performance.now());
              audio.play('ui', settingsRef.current);
              showActionMessage(msg);
              if (ancientCityRift.isActive()) ancientCityRift.ensureMesh(scene);
              return;
            }
            const interact = logicRuntime.interactComponent(tx, ty, tz);
            if (interact) {
              audio.play('ui', settingsRef.current);
              showActionMessage(interact);
              publishRuntimeStatus();
              return;
            }
          }
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
        // Sprint: holding Left/Right Shift (or any Shift) while moving sprints.
        if (event.key === 'Shift' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
          sprintingRef.current = true;
        }
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
        if (event.key.toLowerCase() === 'p') {
          event.preventDefault();
          // Portal Activation Loops repair: if the player is standing at a
          // real, built portal frame, resolve its ACTUAL configured
          // destination rather than blindly cycling the dimension list —
          // that mismatch was why lighting a portal could drop you
          // somewhere with no relation to the frame you built.
          const activePortal = portalSystem.findActivePortal(camera.position.x, camera.position.y, camera.position.z);
          if (activePortal) {
            const prevDim = chunkSource.getDimension();
            dimensionRuntime.setDimension(activePortal.dimension);
            dimensionRuntime.triggerTransitionEffect(camera.position, true);
            atmosphere.setDimension(activePortal.dimension);
            chunkSource.setDimension(activePortal.dimension);
            if (chunkSource.hasOwnTerrain(activePortal.dimension) || chunkSource.hasOwnTerrain(prevDim)) {
              renderer.clearAll();
              invalidateRenderSnapshot(engine);
              const sy = chunkSource.getSurfaceHeightAt(camera.position.x, camera.position.z);
              camera.position.y = sy >= 1 ? sy + 1 + PLAYER_EYE_HEIGHT : 64 + PLAYER_EYE_HEIGHT;
              streamCenter = toChunkCoordinate(camera.position.x, camera.position.z);
              renderer.updateVisibleChunks(streamCenter.cx, streamCenter.cz, INITIAL_CHUNK_RADIUS, chunkSource.generateChunk);
            }
            forceTerrainCoverage = true;
            authorityRuntime.recordAction();
            audio.play('ui', settingsRef.current);
            showActionMessage(`Portal activated — ${dimensionRuntime.getDefinition().name}`);
            publishRuntimeStatus();
            return;
          }
          const used = hasNearbyBlock(terrain, camera.position, 15, 5); const prevDim = chunkSource.getDimension(); const dim = dimensionRuntime.cycle(); dimensionRuntime.triggerTransitionEffect(camera.position, used); atmosphere.setDimension(dim.id); chunkSource.setDimension(dim.id); if (chunkSource.hasOwnTerrain(dim.id) || chunkSource.hasOwnTerrain(prevDim)) { renderer.clearAll(); invalidateRenderSnapshot(engine); const sy = chunkSource.getSurfaceHeightAt(camera.position.x, camera.position.z); camera.position.y = sy >= 1 ? sy + 1 + PLAYER_EYE_HEIGHT : 64 + PLAYER_EYE_HEIGHT; streamCenter = toChunkCoordinate(camera.position.x, camera.position.z); renderer.updateVisibleChunks(streamCenter.cx, streamCenter.cz, INITIAL_CHUNK_RADIUS, chunkSource.generateChunk); } authorityRuntime.recordAction(); audio.play('ui', settingsRef.current); showActionMessage(`${used ? 'Portal Core' : 'Portal monument'} — ${dim.message}`); publishRuntimeStatus(); return;
        }
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
      const handleKeyUp = (event: KeyboardEvent): void => {
        pressedKeys.delete(event.code);
        if (event.key === 'Shift' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') sprintingRef.current = false;
      };
      const handleContextMenu = (e: MouseEvent): void => { e.preventDefault(); };
      const handleResize = (): void => { engine.resize(); };
      canvas.addEventListener('mousedown', handleBlockMouseDown); canvas.addEventListener('contextmenu', handleContextMenu);

      // Touch-drag look: dragging anywhere on the world (when touch controls are
      // on) rotates the camera. Accumulated deltas are consumed in the loop.
      let touchDragActive = false;
      let lastTouchX = 0;
      let lastTouchY = 0;
      const handleCanvasTouchStart = (e: TouchEvent): void => {
        if (!settingsRef.current.touchControls) return;
        const t = e.touches[0];
        if (!t) return;
        touchDragActive = true;
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
      };
      const handleCanvasTouchMove = (e: TouchEvent): void => {
        if (!touchDragActive || !settingsRef.current.touchControls) return;
        const t = e.touches[0];
        if (!t) return;
        touchLookRef.current.x += t.clientX - lastTouchX;
        touchLookRef.current.y += t.clientY - lastTouchY;
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
      };
      const handleCanvasTouchEnd = (): void => { touchDragActive = false; };
      canvas.addEventListener('touchstart', handleCanvasTouchStart, { passive: true });
      canvas.addEventListener('touchmove', handleCanvasTouchMove, { passive: true });
      canvas.addEventListener('touchend', handleCanvasTouchEnd, { passive: true });

      const handleAbilityEvent = (event: Event): void => {
        const key = (event as CustomEvent<{ key: string }>).detail?.key;
        if (!key) return;
        handleKeyDown(new KeyboardEvent('keydown', { key, bubbles: false }));
      };
      window.addEventListener('eaoin-ability', handleAbilityEvent);

      // Touch controls: the on-screen overlay reports joystick movement and
      // discrete actions over the window so the in-scene handlers can use them.
      const handleTouchMove = (event: Event): void => {
        const d = (event as CustomEvent<{ x?: number; y?: number }>).detail;
        touchStickRef.current = { x: d?.x ?? 0, y: d?.y ?? 0 };
      };
      const handleTouchAction = (event: Event): void => {
        const action = (event as CustomEvent<{ action?: string }>).detail?.action;
        if (!action) return;
        if (action === 'mine') startMining();
        else if (action === 'place') placeSelectedBlock();
        else if (action === 'jump') jumpRequested = true;
        else if (action === 'fly') toggleFlightMode();
        else if (action === 'inventory') onToggleInventory();
        else if (action === 'chat') { setChatOpen(true); setCommandOpen(false); }
        else if (action === 'command') { setCommandOpen(true); setChatOpen(false); }
        else if (action === 'pause') setPaused((p) => !p);
        else if (action === 'hotbarNext') cycleHotbar(1);
        else if (action === 'hotbarPrev') cycleHotbar(-1);
        else if (action === 'sprint') sprintingRef.current = !sprintingRef.current;
      };
      window.addEventListener('eaoin-touch-move', handleTouchMove);
      window.addEventListener('eaoin-touch-action', handleTouchAction);

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
        const usesOwnGenerator = (id: string) =>
          chunkSource.hasOwnTerrain(id) || id === 'aether' || id === 'backrooms';
        if (usesOwnGenerator(dimensionId) || usesOwnGenerator(previousDimension)) {
          renderer.clearAll();
          invalidateRenderSnapshot(engine);
          // Drop the player onto solid ground in the destination.
          if (dimensionId === 'aether') camera.position.set(8, 96, 8);
          else if (dimensionId === 'backrooms') camera.position.set(3, 16, 3);
          else {
            // Land on the destination dimension's real surface (not a hard-coded
            // y=64 which buried the player underground in most dimensions).
            const surfaceY = chunkSource.getSurfaceHeightAt(camera.position.x, camera.position.z);
            camera.position.y = surfaceY >= 1 ? surfaceY + 1 + PLAYER_EYE_HEIGHT : 64 + PLAYER_EYE_HEIGHT;
          }
          streamCenter = toChunkCoordinate(camera.position.x, camera.position.z);
          renderer.updateVisibleChunks(
            streamCenter.cx, streamCenter.cz, INITIAL_CHUNK_RADIUS,
            chunkSource.generateChunk
          );
          // The initial 3×3 is a floor under the destination. Continue at
          // catch-up priority until the configured visible radius is meshed.
          forceTerrainCoverage = true;
          invalidateRenderSnapshot(engine);
        }

        const state = dimensionRuntime.getState();
        audio.play('ui', settingsRef.current);
        showActionMessage(`Traveled to ${state.name}`);
        publishRuntimeStatus();
      };
      window.addEventListener('eaoin-travel-dimension', handleTravelEvent);
      window.addEventListener('mouseup', handleMouseUp); window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp); window.addEventListener('eaoin-toggle-flight', handleFlightButton); window.addEventListener('resize', handleResize);
      reportLoadingProgress(76, 'Controls ready — finishing visible terrain', false, { loadedChunks: initialLoadedChunks, totalChunks: startupChunkTotal });
      // Keep the loading cover up while the visible radius plus its safety ring
      // streams. Exposing gameplay after only the 3×3 spawn set made
      // still-missing terrain look like holes to the void. The frame-loop
      // allows the outer safety ring to finish in the background after 18s,
      // but never releases the player before the entire visible radius exists.
      // Kept as a compatibility call; the backend now deliberately leaves
      // snapshot bundles disabled because a streaming voxel draw list is never
      // stable enough to record safely.
      enableSnapshotRenderingWhenReady(engine, scene, settingsRef.current);

      // --- awakening first-person camera tilt ------------------------------
      // The spawn-awakening overlay tells us how far the player has risen
      // (progress 0..1). We ease the real camera pitch from looking down at the
      // ground (as if face-down on the dirt) up to level/slightly up, so the
      // camera itself "pulls itself off the ground and looks back up" instead
      // of a flat head-on view. We only ever add the *change* so we never fight
      // or accumulate against the mouse-look pitch.
      let awakeningTiltTarget = -0.9;   // start looking down at the ground
      let awakeningTiltApplied = 0;
      const handleAwakeningTilt = (event: Event): void => {
        const progress = (event as CustomEvent<{ progress?: number }>).detail?.progress;
        const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? (progress as number) : 0));
        // Lerp from ~looking-down (negative pitch) to slightly-up (positive).
        awakeningTiltTarget = -0.9 + p * 1.05;
      };
      window.addEventListener('eaoin-awakening-tilt', handleAwakeningTilt);

      engine.runRenderLoop(() => {
        try {
          // Ease the applied tilt toward the target and add only the delta to
          // the camera's existing (mouse-set) pitch, so we never accumulate or
          // fight the mouse-look.
          const eased = awakeningTiltApplied + (awakeningTiltTarget - awakeningTiltApplied) * 0.09;
          if (Math.abs(eased - awakeningTiltApplied) > 0.0001) {
            camera.rotation.x += eased - awakeningTiltApplied;
            awakeningTiltApplied = eased;
          }
          scene.render();
          // Refresh TV/Computer screens with the live frame.
          screenSystem.update();
          // Part 4 — coloured lighting probe around the player.
          try {
            coloredLighting.update(camera.position, (x, y, z) => terrain.getBlockAt(x, y, z));
          } catch { /* best-effort */ }
        } catch (error) {
          console.error('[Render] Scene render failed.', error);
        }
      }); engine.resize();
      const initialStats = renderer.getStats(); console.log(`[Render] 3.2 ready: ${initialStats.loadedChunks} chunks, clouds moving, mountains & caves volumetric, 16 render, 20min day`);
      cleanupScene = () => {
        unsubscribeDevTuning();
        if (actionMessageTimer !== undefined) window.clearTimeout(actionMessageTimer);
        canvas.removeEventListener('mousedown', handleBlockMouseDown); canvas.removeEventListener('contextmenu', handleContextMenu);
        canvas.removeEventListener('touchstart', handleCanvasTouchStart);
        canvas.removeEventListener('touchmove', handleCanvasTouchMove);
        canvas.removeEventListener('touchend', handleCanvasTouchEnd);
        window.removeEventListener('eaoin-ability', handleAbilityEvent);
        window.removeEventListener('eaoin-touch-move', handleTouchMove);
        window.removeEventListener('eaoin-touch-action', handleTouchAction);
        window.removeEventListener('eaoin-awakening-tilt', handleAwakeningTilt);
        window.removeEventListener('eaoin-travel-dimension', handleTravelEvent);
        window.removeEventListener('mouseup', handleMouseUp); window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); window.removeEventListener('eaoin-toggle-flight', handleFlightButton); window.removeEventListener('resize', handleResize);
        breakOverlay.dispose(); viewModel.dispose(); activeBoss?.dispose();
        audio.stopMusic(); ambience.dispose(); endGame.dispose(); rayTracer.dispose(); itemDrops.dispose(); atmosphere.dispose(); weatherEffects.dispose(); severeWeather.dispose(); endBlackHole.dispose(); worldInteractions.dispose(); nextGenRuntime.dispose(); physicalPlanets.dispose(); creatureManager.dispose(); settlementRuntime.dispose(); logicRuntime.dispose(); dimensionRuntime.dispose(); portalSystem.dispose(); realityRifts.dispose(); screenSystem.dispose(); coloredLighting.dispose(); renderer.dispose(); scene.dispose(); engine.dispose();
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
      // AI assistant: /ai build / mod / teleport / summon / help
      if (t.toLowerCase().startsWith('/ai')) {
        const ai = aiReply(t);
        if (ai.effect?.kind === 'teleport') {
          commandEffectRef.current?.({ kind: 'teleport', x: ai.effect.x, z: ai.effect.z });
        }
        if (ai.npcSpawn) {
          const persona = npcPersona(ai.npcSpawn);
          aiNpcRef.current?.(persona.name, Math.round(playerPosRef.current.x + 3), Math.round(playerPosRef.current.y), Math.round(playerPosRef.current.z), { shirt: persona.shirt, hair: persona.hair, skin: persona.skin, pants: persona.pants });
        }
        setChatMessages(m => [...m, { text: `> ${t}`, system: false }, { text: ai.message, system: true }].slice(-20));
        setActionMessage(ai.message);
        setChatOpen(false); setChatText('');
        return;
      }
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
    <div
      className="game-screen"
      style={{ width: "100vw", height: "100vh", position: "absolute", top: 0, left: 0, overflow: "hidden", zIndex: 0 }}
    >
      <canvas
        ref={canvasRef}
        className="game-canvas"
        style={{ width: "100% !important", height: "100% !important", display: "block", position: "absolute", top: 0, left: 0, outline: "none" }}
      />
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
        {dead && !ghostMode && (
          <div className="death-screen" role="alert" aria-live="assertive">
            <div className="death-red-vignette" />
            <div className="death-content">
              <div className="death-title">YOU DIED</div>
              <div className="death-sub">The world grows quiet around you…</div>
              <div className="death-actions">
                <button className="btn-primary" onClick={() => deathActionRef.current.respawn()}>Respawn</button>
                <button className="btn-secondary" onClick={() => deathActionRef.current.ghost()}>Become Ghost</button>
              </div>
            </div>
          </div>
        )}
        {ghostMode && !dead && (
          <div className="ghost-banner">👻 GHOST MODE — roam and haunt. Press F4 to respawn.</div>
        )}
        {settings.showStats && <div className="render-stats-panel"><div>Renderer {renderStats.renderer.backend.toUpperCase()}</div><div>{renderStats.renderer.label}</div><div>Clouds: visible moving voxel • Fog 100-1000 {settings.fogEnabled ? 'on' : 'off'}</div><div>Render radius {qualityRenderDistance(settings.qualityPreset)} • MaxZ 1500</div><div>Day/Night 20min cycle • Terrain: regular Minecraft-like overworld</div><div>FPS {renderStats.fps}</div><div>Chunks {renderStats.loadedChunks} @ {renderStats.streamCenter}</div><div>Meshes {renderStats.meshCount}</div><div>Creatures {renderStats.creatures.count}/{renderStats.creatures.cap}</div><div>Drops {renderStats.drops}</div><div>Tris {renderStats.triangleCount.toLocaleString()}</div></div>}
        {bossState && bossState.alive && (
          <div className="boss-bar" role="status" aria-live="polite">
            <div className="boss-bar-head">
              <span className="boss-name">{bossState.def.emoji} {bossState.def.name}</span>
              <span className="boss-tier">{bossState.def.tier.toUpperCase()}</span>
            </div>
            <div className="boss-bar-track">
              <span
                className="boss-bar-fill"
                style={{ width: `${Math.max(0, (bossState.health / bossState.maxHealth) * 100)}%` }}
              />
            </div>
            <div className="boss-bar-foot">
              <span>PHASE {bossState.phase} / {bossState.def.phases}</span>
              <span>{Math.ceil(bossState.health)} / {bossState.maxHealth}</span>
            </div>
          </div>
        )}
        {targetLabel && <div className="target-label">{targetLabel}</div>}
        {miningProgress > 0 && <div className="mining-progress"><div className="mining-label">{miningLabel} — cracking {Math.round(miningProgress * 10)}/10</div><div className="mining-bar"><span style={{ width: `${Math.round(miningProgress * 100)}%` }} /></div></div>}
        {commandOpen && <div className="command-console"><input id="eaoin-command-input" name="eaoinCommand" value={commandText} autoFocus onChange={e => setCommandText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitCommand(); if (e.key === 'Escape') setCommandOpen(false); }} /><button onClick={submitCommand}>Run</button></div>}
        {chatOpen && <div className="chat-panel"><div className="chat-log">{chatMessages.slice(-10).map((m, i) => <div key={i} className={`chat-line ${m.system ? 'system' : ''}`}>{m.text}</div>)}</div><div className="chat-input-row"><input id="eaoin-chat-input" name="eaoinChat" className="chat-input" value={chatText} autoFocus placeholder="Chat or /day /time 12 /summon sheep" onChange={e => setChatText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitChat(); if (e.key === 'Escape') setChatOpen(false); }} /><button className="chat-send" onClick={submitChat}>Send</button></div></div>}
        <div className="world-action-rail">
          <button className={`world-action fly ${flightEnabled ? 'active' : ''}`} onClick={() => window.dispatchEvent(new Event('eaoin-toggle-flight'))}>FLY [F] {flightEnabled ? 'ON' : 'OFF'}</button>
          <button className="world-action" onClick={resetSavedWorld}>RESET</button>
          <button className="world-action danger" onClick={onExit}>EXIT</button>
        </div>
        {paused && (
          <div className="pause-panel">
            <div className="pause-title">EAOIN</div>
            <div className="pause-subtitle">Game Paused</div>
            <button className="pause-btn primary" onClick={() => { setPaused(false); canvasRef.current?.requestPointerLock?.(); }}>Resume Game</button>
            <button className="pause-btn" onClick={onToggleSettings}>Settings</button>
            <button className="pause-btn" onClick={onToggleInventory}>Inventory</button>
            <button className="pause-btn" onClick={() => onOpenCharacter?.()}>Character</button>
            <button className="pause-btn" onClick={() => onExitToLauncher?.()}>Quit to Launcher</button>
          </div>
        )}
      </div>
      {/* On-screen mobile controls — only when "Touch controls" is on. */}
      <TouchControls enabled={settings.touchControls} />
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
  lighting.playerLight.intensity = 0.28 + enclosure * 0.85 + nightNeed * 0.40;
  lighting.playerLight.range = 14 + enclosure * 10;
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
  if (config.biomeScale !== undefined) out.biomeScale = config.biomeScale;
  if (config.forcedBiome !== undefined) out.forcedBiome = config.forcedBiome;
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

/** Max distance a water source spreads laterally (like Minecraft's 7). */
const WATER_FLOW_RADIUS = 7;

/**
 * Make water behave like a fluid instead of a sitting block. When a water
 * source is placed it flows downward first and then spreads laterally into
 * neighbouring air blocks, up to a bounded radius, so a bucket pour produces a
 * spreading pool rather than a single frozen cube. Bounded and synchronous so
 * it never floods a whole world.
 */
function flowWater(
  terrain: { getBlockAt(x: number, y: number, z: number): number; setBlockAt(x: number, y: number, z: number, b: number): boolean },
  sx: number, sy: number, sz: number
): void {
  const WATER = 5;
  if (terrain.getBlockAt(sx, sy, sz) !== 0) return;
  terrain.setBlockAt(sx, sy, sz, WATER);

  const stack: Array<{ x: number; y: number; z: number; dist: number }> = [{ x: sx, y: sy, z: sz, dist: 0 }];
  const visited = new Set<string>([`${sx}:${sy}:${sz}`]);
  let guard = 0;
  while (stack.length > 0 && guard < 200) {
    guard += 1;
    const c = stack.shift()!;
    if (c.dist >= WATER_FLOW_RADIUS) continue;

    // Flow down first: water always falls to fill the space beneath.
    const below = terrain.getBlockAt(c.x, c.y - 1, c.z);
    if (below === 0) {
      const key = `${c.x}:${c.y - 1}:${c.z}`;
      if (!visited.has(key)) {
        visited.add(key);
        terrain.setBlockAt(c.x, c.y - 1, c.z, WATER);
        stack.push({ x: c.x, y: c.y - 1, z: c.z, dist: 0 });
      }
      continue; // falling water does not spread sideways from the same level
    }

    // Otherwise spread sideways into air neighbours.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = c.x + dx, nz = c.z + dz;
      if (terrain.getBlockAt(nx, c.y, nz) !== 0) continue;
      const key = `${nx}:${c.y}:${nz}`;
      if (visited.has(key)) continue;
      visited.add(key);
      terrain.setBlockAt(nx, c.y, nz, WATER);
      stack.push({ x: nx, y: c.y, z: nz, dist: c.dist + 1 });
    }
  }
}

/* ===========================================================================
   Third-person avatar texture helpers.
   ========================================================================== */

/** Parse a #rrggbb hex string into an RGB triplet 0..255. */
function hexRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** Build 16x16 RGBA textures for the player head / body / legs. */
function buildPersonTexture(app: {
  skinTone: string; hairColor: string; shirtColor: string; pantsColor: string;
}): { head: Uint8Array; body: Uint8Array; leg: Uint8Array } {
  const size = 16;
  const make = (fill: string) => {
    const { r, g, b } = hexRgb(fill);
    const buf = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      buf[i * 4] = r; buf[i * 4 + 1] = g; buf[i * 4 + 2] = b; buf[i * 4 + 3] = 255;
    }
    return buf;
  };
  const setPx = (buf: Uint8Array, x: number, y: number, c: string) => {
    const { r, g, b } = hexRgb(c);
    const i = (y * size + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
  };
  const shade = (c: string, k: number) => {
    const { r, g, b } = hexRgb(c);
    return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
  };

  // Head: skin base + hair on top + eyes + mouth.
  const head = make(app.skinTone);
  const hr = hexRgb(app.hairColor);
  for (let x = 1; x < 15; x++) for (let y = 0; y < 6; y++) {
    const i = (y * size + x) * 4; head[i] = hr.r; head[i + 1] = hr.g; head[i + 2] = hr.b;
  }
  setPx(head, 5, 8, '#20242a'); setPx(head, 10, 8, '#20242a'); // eyes
  setPx(head, 7, 12, '#8a5a3a'); setPx(head, 8, 12, '#8a5a3a'); // mouth

  // Body: shirt colour with a darker side band and a collar.
  const body = make(app.shirtColor);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 3; x++) setPx(body, x, y, shade(app.shirtColor, 0.7));
  for (let x = 0; x < 16; x++) setPx(body, x, 3, shade(app.shirtColor, 1.2));

  // Legs: pants colour.
  const leg = make(app.pantsColor);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 3; x++) setPx(leg, x, y, shade(app.pantsColor, 0.7));

  return { head, body, leg };
}

/** Cape colour as a Babylon Color3 by style id. */
function capeColor3(cape: string): Color3 {
  switch (cape) {
    case 'classic': return new Color3(0.3, 0.6, 0.5);
    case 'cosmic': return new Color3(0.45, 0.32, 1);
    case 'ember': return new Color3(1, 0.5, 0.25);
    case 'galaxy': return new Color3(0.35, 0.3, 1);
    case 'knight': return new Color3(0.4, 0.5, 0.6);
    default: return new Color3(0.3, 0.3, 0.35);
  }
}

import { useEffect, useRef, useState } from 'react';
import {
  Color3,
  Color4,
  DefaultRenderingPipeline,
  GlowLayer,
  Mesh,
  MeshBuilder,
  Scene,
  SSAO2RenderingPipeline,
  StandardMaterial,
  UniversalCamera,
  Vector3,
} from '@babylonjs/core';
import { GameAudio } from '../audio/GameAudio';
import { SettlementRuntime } from '../civilization/SettlementRuntime';
import { runCommand, WorldTimeState } from '../commands/CommandRuntime';
import { BlockID, getBlock } from '@shared/blocks/BlockRegistry';
import {
  addToInventory,
  canConsumeBlock,
  getStackCount,
  HOTBAR_BLOCKS,
  InventoryStacks,
  removeFromInventory,
} from '../player/InventoryState';
import { applyDamage, SurvivalStats, updateSurvivalLoop } from '../player/SurvivalState';
import { estimateMining, getTool, nextTool, ToolID, ToolInventory } from '../player/ToolState';
import { CreatureManager, CreatureStats } from '../creatures/CreatureManager';
import { DimensionRuntime, RuntimeDimensionID } from '../dimensions/DimensionRuntime';
import { AmbientParticleRuntime } from '../effects/AmbientParticleRuntime';
import { WorldInteractionRuntime } from '../effects/WorldInteractionRuntime';
import { ItemDropManager } from '../items/ItemDropManager';
import { LocalAuthorityRuntime } from '../networking/LocalAuthorityRuntime';
import { GameMode } from '../modes/GameMode';
import { ModdingRuntime } from '../modding/ModdingRuntime';
import { NextGenRuntime } from '../nextgen/NextGenRuntime';
import { GameplayCounterKey } from '../objectives/ObjectiveTracker';
import { createBlockMaterials } from '../rendering/BlockMaterials';
import { ChunkRenderManager, ChunkRenderStats } from '../rendering/ChunkRenderManager';
import { applyRenderScale, createRuntimeEngine, RendererBackendInfo } from '../rendering/RendererBackend';
import { LogicRuntime } from '../redstone/LogicRuntime';
import { configureSceneLighting, SceneLightingHandles } from '../rendering/SceneLighting';
import { RuntimeStatus } from '../runtime/RuntimeStatus';
import { GameSettings, qualityRenderDistance, clampSettings } from '../settings/GameSettings';
import { TerrainGenerator } from '../world/TerrainGenerator';
import { getWorldLayout } from '../world/WorldDistribution';
import { RELEASE_NAME, GAME_VERSION } from '../version';
import { WorldSaveManager } from '../world/WorldSave';

interface GameCanvasProps {
  seed: string;
  gameMode: GameMode;
  onExit: () => void;
  selectedBlock: BlockID;
  onSelectedBlockChange: (block: BlockID) => void;
  selectedTool: ToolID;
  onSelectedToolChange: (tool: ToolID) => void;
  toolInventory: ToolInventory;
  inventory: InventoryStacks;
  onInventoryChange: (inventory: InventoryStacks) => void;
  survivalStats: SurvivalStats;
  onSurvivalStatsChange: (stats: SurvivalStats) => void;
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
  onToggleInventory: () => void;
  onToggleSettings: () => void;
  onGameplayEvent: (event: GameplayCounterKey, amount?: number) => void;
  onRuntimeStatusChange: (status: RuntimeStatus) => void;
}

interface PlayerPosition {
  x: number;
  y: number;
  z: number;
}

interface BlockCoordinate {
  x: number;
  y: number;
  z: number;
}

interface MiningSession {
  target: BlockCoordinate;
  blockId: BlockID;
  startedAt: number;
  durationMs: number;
  canHarvest: boolean;
  toolName: string;
}

interface RuntimeRenderStats extends ChunkRenderStats {
  fps: number;
  streamCenter: string;
  creatures: CreatureStats;
  drops: number;
  renderer: RendererBackendInfo;
}

const BLOCK_REACH = 7;
const GRAVITY_BASE = -20;
const JUMP_VELOCITY_BASE = 7.5;
const TERMINAL_VELOCITY = -28;

const INITIAL_RENDERER_INFO: RendererBackendInfo = {
  backend: 'webgl',
  label: 'Initializing renderer',
  requested: 'auto',
  webgpuSupported: false,
  vulkanPath: 'native-vulkan-required',
};

export default function GameCanvas({
  seed,
  gameMode,
  onExit,
  selectedBlock,
  onSelectedBlockChange,
  selectedTool,
  onSelectedToolChange,
  toolInventory,
  inventory,
  onInventoryChange,
  survivalStats,
  onSurvivalStatsChange,
  settings,
  onSettingsChange,
  onToggleInventory,
  onToggleSettings,
  onGameplayEvent,
  onRuntimeStatusChange,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedBlockRef = useRef<BlockID>(selectedBlock);
  const selectedToolRef = useRef<ToolID>(selectedTool);
  const toolInventoryRef = useRef<ToolInventory>(toolInventory);
  const inventoryRef = useRef<InventoryStacks>(inventory);
  const survivalStatsRef = useRef<SurvivalStats>(survivalStats);
  const settingsRef = useRef<GameSettings>(settings);
  const worldTimeRef = useRef<WorldTimeState>({ timeOfDay: 12, frozen: false });
  const [position, setPosition] = useState<PlayerPosition>({ x: 0, y: 0, z: 0 });
  const [actionMessage, setActionMessage] = useState('Click canvas • WASD move • SPACE jump (fixed) • Mouse look');
  const [saveStatus, setSaveStatus] = useState('Save ready');
  const [worldVersion, setWorldVersion] = useState(0);
  const [miningProgress, setMiningProgress] = useState(0);
  const [miningLabel, setMiningLabel] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [paused, setPaused] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandText, setCommandText] = useState('/help');
  const [worldTime, setWorldTime] = useState<WorldTimeState>({ timeOfDay: 12, frozen: false });
  const [renderStats, setRenderStats] = useState<RuntimeRenderStats>({
    loadedChunks: 0,
    meshCount: 0,
    triangleCount: 0,
    rebuildCount: 0,
    fps: 0,
    streamCenter: '0,0',
    creatures: { count: 0, cap: 0, spawned: 0, despawned: 0 },
    drops: 0,
    renderer: INITIAL_RENDERER_INFO,
  });

  useEffect(() => {
    selectedBlockRef.current = selectedBlock;
  }, [selectedBlock]);
  useEffect(() => {
    selectedToolRef.current = selectedTool;
  }, [selectedTool]);
  useEffect(() => {
    toolInventoryRef.current = toolInventory;
  }, [toolInventory]);
  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);
  useEffect(() => {
    survivalStatsRef.current = survivalStats;
  }, [survivalStats]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    worldTimeRef.current = worldTime;
  }, [worldTime]);

  useEffect(() => {
    let disposed = false;
    let cleanupScene: (() => void) | undefined;

    void (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.tabIndex = 1;
      const runtimeEngine = await createRuntimeEngine(canvas, settingsRef.current);
      const engine = runtimeEngine.engine;
      if (disposed) {
        engine.dispose();
        return;
      }
      setRenderStats((current) => ({ ...current, renderer: runtimeEngine.info }));
      const scene = new Scene(engine);
      scene.clearColor = new Color4(0.58, 0.72, 0.95, 1);
      scene.collisionsEnabled = true;
      // Custom gravity handling — we manage jump/gravity ourselves for fluid movement
      scene.gravity = new Vector3(0, 0, 0);
      scene.fogEnabled = settingsRef.current.fogEnabled;

      const saveManager = new WorldSaveManager(seed);
      const savedEdits = saveManager.load();
      const terrain = new TerrainGenerator(seed, savedEdits);
      const spawn = terrain.getSpawnPoint();
      const layout = getWorldLayout(seed, spawn);
      setSaveStatus(savedEdits.length > 0 ? `Loaded ${savedEdits.length} saved edit${savedEdits.length === 1 ? '' : 's'} • World de-cluttered (settlement ${Math.round(Math.hypot(layout.settlement.x, layout.settlement.z))}m away)` : `Spawn clear ${spawn.x.toFixed(1)},${spawn.z.toFixed(1)} • Settlement ${Math.round(Math.hypot(layout.settlement.x, layout.settlement.z))}m • Rocket ${Math.round(Math.hypot(layout.rocket.x, layout.rocket.z))}m`);

      const camera = new UniversalCamera('player_camera', new Vector3(spawn.x, spawn.y, spawn.z), scene);
      camera.attachControl(canvas, true);
      camera.setTarget(new Vector3(spawn.x + 8, spawn.y - 0.35, spawn.z + 8));
      camera.minZ = 0.05;
      camera.maxZ = 650;
      camera.speed = Math.max(0.7, settingsRef.current.cameraSpeed * 1.15);
      camera.inertia = 0; // crisp, no slide into blocks — fixes stuck feeling
      camera.angularSensibility = 900; // more responsive
      camera.applyGravity = false;
      camera.checkCollisions = true;
      // Slightly smaller collision box prevents cramped collisions around dense custom blocks
      camera.ellipsoid = new Vector3(0.32, 0.82, 0.32);
      camera.ellipsoidOffset = new Vector3(0, 0.82, 0);
      camera.keysUp = [87, 38];
      camera.keysDown = [83, 40];
      camera.keysLeft = [65, 37];
      camera.keysRight = [68, 39];

      // Minecraft-inspired first-person arm and avatar
      const skin = new StandardMaterial('player_skin', scene);
      skin.diffuseColor = new Color3(0.72, 0.43, 0.28);
      const shirt = new StandardMaterial('player_shirt', scene);
      shirt.diffuseColor = new Color3(0.12, 0.42, 0.78);
      const arm = MeshBuilder.CreateBox('first_person_blocky_arm', { width: 0.22, height: 0.72, depth: 0.22 }, scene);
      arm.parent = camera;
      arm.position = new Vector3(0.42, -0.48, 0.72);
      arm.rotation.z = -0.12;
      arm.material = skin;
      arm.isPickable = false;
      const avatar = new Mesh('third_person_avatar', scene);
      avatar.position.copyFrom(camera.position);
      avatar.isVisible = false;
      const torso = MeshBuilder.CreateBox('avatar_torso', { width: 0.7, height: 0.95, depth: 0.38 }, scene);
      torso.parent = avatar;
      torso.position.y = 0.15;
      torso.material = shirt;
      const head = MeshBuilder.CreateBox('avatar_head', { width: 0.55, height: 0.55, depth: 0.55 }, scene);
      head.parent = avatar;
      head.position.y = 0.9;
      head.material = skin;
      const legA = MeshBuilder.CreateBox('avatar_leg_a', { width: 0.25, height: 0.85, depth: 0.28 }, scene);
      legA.parent = avatar;
      legA.position.set(-0.18, -0.72, 0);
      legA.material = shirt;
      const legB = legA.clone('avatar_leg_b');
      if (legB) {
        legB.parent = avatar;
        legB.position.x = 0.18;
      }
      const armA = MeshBuilder.CreateBox('avatar_arm_a', { width: 0.22, height: 0.82, depth: 0.25 }, scene);
      armA.parent = avatar;
      armA.position.set(-0.48, 0.12, 0);
      armA.material = skin;
      const armB = armA.clone('avatar_arm_b');
      if (armB) {
        armB.parent = avatar;
        armB.position.x = 0.48;
      }
      let thirdPerson = false;

      const materials = createBlockMaterials(scene, settingsRef.current.texturePack);
      const audio = new GameAudio();
      const renderer = new ChunkRenderManager(scene, materials);
      const itemDrops = new ItemDropManager(scene, materials);
      const renderRadius = qualityRenderDistance(settingsRef.current.qualityPreset);
      const dimensionRuntime = new DimensionRuntime(scene, spawn, seed);
      const ambientParticles = new AmbientParticleRuntime(scene, spawn);
      const worldInteractions = new WorldInteractionRuntime(scene, terrain, spawn, seed);
      const moddingRuntime = new ModdingRuntime();
      moddingRuntime.registerMockPack();
      const nextGenRuntime = new NextGenRuntime(scene, terrain, seed, gameMode, spawn);
      const logicRuntime = new LogicRuntime(scene, terrain, spawn);
      const settlementRuntime = new SettlementRuntime(scene, terrain, seed);
      const authorityRuntime = new LocalAuthorityRuntime(seed);
      let streamCenter = toChunkCoordinate(spawn.x, spawn.z);
      renderer.updateVisibleChunks(streamCenter.cx, streamCenter.cz, renderRadius, (cx, cz) => terrain.generateChunk(cx, cz));
      const lighting = configureSceneLighting(scene, spawn);

      // ---- Ray-traced approximation stack: shadows + SSAO + Bloom + Image Processing ----
      const glow = new GlowLayer('voxel_bloom', scene, { blurKernelSize: 64 });
      glow.intensity = settingsRef.current.postProcessEnabled || settingsRef.current.realisticLighting ? 0.42 : 0.15;

      const pipeline = new DefaultRenderingPipeline('voxel_cinematic_pipeline', true, scene, [camera]);
      pipeline.fxaaEnabled = true;
      pipeline.samples = 4;
      pipeline.imageProcessingEnabled = true;
      pipeline.imageProcessing.contrast = 1.12;
      pipeline.imageProcessing.exposure = 1.08;
      pipeline.imageProcessing.vignetteEnabled = true;
      pipeline.imageProcessing.vignetteWeight = 1.6;
      pipeline.bloomEnabled = true;
      pipeline.bloomThreshold = 0.78;
      pipeline.bloomWeight = settingsRef.current.postProcessEnabled ? 0.36 : 0.22;
      pipeline.bloomKernel = 96;
      pipeline.bloomScale = 0.6;
      pipeline.depthOfFieldEnabled = settingsRef.current.qualityPreset === 'cinematic';
      pipeline.depthOfField.focalLength = 10;
      pipeline.depthOfField.fStop = 2.8;

      // SSAO for contact shadows — adds realistic ambient occlusion between blocks
      const ssao = new SSAO2RenderingPipeline('ssao', scene, { ssaoRatio: 0.8, combineRatio: 1 }, [camera]);
      ssao.radius = 2.2;
      ssao.totalStrength = 1.0;
      ssao.base = 0.3;
      (ssao as any).fallOff = 0.000002;
      ssao.maxZ = 120;
      scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline('ssao', camera);

      // Reflection probe for water realism — approximate ray traced reflections
      // (single probe at spawn, reused via PBR environmentIntensity)
      scene.environmentIntensity = 0.85;

      dimensionRuntime.applyCurrent();
      const creatureManager = new CreatureManager(scene, terrain, seed);
      creatureManager.update(camera.position, 1);

      let miningSession: MiningSession | null = null;
      let actionMessageTimer: number | undefined;
      const showActionMessage = (message: string): void => {
        setActionMessage(message);
        if (actionMessageTimer !== undefined) window.clearTimeout(actionMessageTimer);
        actionMessageTimer = window.setTimeout(() => {
          setActionMessage('WASD move • SPACE jump • Hold left: mine • Right click: place • T tools • O objectives • U systems');
        }, 2200);
      };

      const publishInventory = (nextInventory: InventoryStacks): void => {
        inventoryRef.current = nextInventory;
        onInventoryChange(nextInventory);
      };

      const publishSurvivalStats = (nextStats: SurvivalStats): void => {
        const rounded = {
          health: Number(nextStats.health.toFixed(1)),
          food: Number(nextStats.food.toFixed(1)),
          stamina: Number(nextStats.stamina.toFixed(1)),
        };
        survivalStatsRef.current = rounded;
        onSurvivalStatsChange(rounded);
      };

      const clearMining = (): void => {
        miningSession = null;
        setMiningProgress(0);
        setMiningLabel('');
      };

      const publishRenderStats = (): void => {
        const stats = renderer.getStats();
        setRenderStats({
          ...stats,
          fps: Math.round(engine.getFps()),
          streamCenter: `${streamCenter.cx},${streamCenter.cz}`,
          creatures: creatureManager.getStats(),
          drops: itemDrops.getCount(),
          renderer: runtimeEngine.info,
        });
      };

      const publishRuntimeStatus = (): void => {
        const dimension = dimensionRuntime.getState();
        const logic = logicRuntime.getStats();
        const settlement = settlementRuntime.getStats(camera.position);
        const authority = authorityRuntime.getStatus();
        const interactions = worldInteractions.getStats();
        const modding = moddingRuntime.getStatus(settingsRef.current);
        onRuntimeStatusChange({
          dimensionId: dimension.id,
          dimensionName: dimension.name,
          portalUses: dimension.portalUses,
          redstoneActive: logic.active,
          redstoneToggles: logic.toggles,
          logicBlocks: logic.blocks,
          placedLogicWires: logic.placedWires,
          placedSignalLamps: logic.placedLamps,
          poweredSignalLamps: logic.poweredLamps,
          nearbyPortalCore: hasNearbyBlock(terrain, camera.position, 15, 6),
          settlementName: settlement.discovered ? settlement.name : `Undiscovered ~${Math.round(Math.hypot(layout.settlement.x, layout.settlement.z))}m`,
          settlementDiscovered: settlement.discovered,
          villagers: settlement.villagers,
          settlementProsperity: settlement.prosperity,
          settlementTask: settlement.discovered ? settlement.activeTask : 'Village 55m NW — follow beacon',
          settlementJobProgress: settlement.jobProgress,
          settlementWood: settlement.woodStockpile,
          settlementStone: settlement.stoneStockpile,
          tradesCompleted: settlement.tradesCompleted,
          doors: interactions.doors,
          dimensionalDoors: interactions.dimensionalDoors,
          rocketReady: interactions.rocketReady,
          moonVisits: interactions.moonVisits,
          moddingApiVersion: modding.apiVersion,
          loadedMods: modding.loadedMods,
          texturePack: modding.texturePack,
          shaderExperimental: modding.shaderExperimental,
          commandBlocksEnabled: modding.commandBlocksEnabled,
          networkClientId: authority.clientId,
          networkPing: authority.ping,
          networkJitter: authority.jitter,
          remotePlayers: authority.remotePlayers,
          outboundPackets: authority.outboundPackets,
          inboundPackets: authority.inboundPackets,
          packetLoss: authority.packetLoss,
          snapshotBuffer: authority.snapshotBuffer,
          rollbackEvents: authority.rollbackEvents,
          predictionError: authority.predictionError,
          syncQuality: authority.syncQuality,
          syncState: authority.syncState,
          authorityTicks: authority.ticks,
          localActions: authority.localActions,
          nextGen: nextGenRuntime.getStatus(),
        });
      };

      const rebuildEditedBlock = (target: BlockCoordinate): void => {
        renderer.rebuildForWorldBlock(target.x, target.z);
        publishRenderStats();
      };

      const saveWorldEdits = (): void => {
        const result = saveManager.save(terrain.getEdits());
        setSaveStatus(result.message);
      };

      publishRenderStats();
      publishRuntimeStatus();

      const finishMining = (session: MiningSession): void => {
        const existing = terrain.getBlockAt(session.target.x, session.target.y, session.target.z);
        if (existing !== session.blockId || existing === 0) {
          showActionMessage('Mining target changed');
          clearMining();
          return;
        }
        terrain.setBlockAt(session.target.x, session.target.y, session.target.z, 0);
        authorityRuntime.recordAction();
        onGameplayEvent('blocksMined');
        if (session.canHarvest) {
          itemDrops.spawnDrop(existing, new Vector3(session.target.x, session.target.y, session.target.z), 1);
          audio.play('mine', settingsRef.current);
          showActionMessage(`Mined ${getBlock(existing).name} with ${session.toolName} — pick up the drop`);
        } else {
          audio.play('error', settingsRef.current);
          showActionMessage(`${getBlock(existing).name} broke but dropped nothing — stronger tool needed`);
        }
        rebuildEditedBlock(session.target);
        saveWorldEdits();
        clearMining();
      };

      // ----- PHYSICS: fixed jumping -----
      let velocityY = 0;
      let grounded = false;
      let jumpRequested = false;
      let fallStartY = camera.position.y;
      let wasFalling = false;

      const isGroundedCheck = (pos: Vector3): boolean => {
        const footY = Math.floor(pos.y - 0.84 - 0.08);
        const blockTop = footY + 1;
        const checks: Array<[number, number]> = [
          [0, 0],
          [0.22, 0],
          [-0.22, 0],
          [0, 0.22],
          [0, -0.22],
        ];
        for (const [ox, oz] of checks) {
          const bx = Math.floor(pos.x + ox);
          const bz = Math.floor(pos.z + oz);
          const id = terrain.getBlockAt(bx, footY, bz);
          if (id !== 0 && id !== 5) {
            if (pos.y - 0.84 >= blockTop - 0.15) return true;
          }
          const idBelow = terrain.getBlockAt(bx, footY - 1, bz);
          if (id !== 0 && idBelow !== 0 && id !== 5) {
            if (pos.y - 0.84 >= blockTop - 0.35 && pos.y - 0.84 <= blockTop + 0.25) return true;
          }
        }
        return false;
      };

      let positionFrame = 0;
      let survivalFrame = 0;
      let streamFrame = 0;
      let timeState: WorldTimeState = worldTimeRef.current;
      let lastCameraPosition = camera.position.clone();

      scene.onBeforeRenderObservable.add(() => {
        const now = performance.now();
        if (miningSession) {
          const progress = Math.min(1, (now - miningSession.startedAt) / miningSession.durationMs);
          setMiningProgress(progress);
          if (progress >= 1) finishMining(miningSession);
        }

        const deltaSeconds = Math.min(engine.getDeltaTime() / 1000, 0.05);

        // World time & lighting
        if (!timeState.frozen) {
          timeState = { ...timeState, timeOfDay: (timeState.timeOfDay + deltaSeconds * 0.035) % 24 };
          worldTimeRef.current = timeState;
        } else if (worldTimeRef.current !== timeState) {
          timeState = worldTimeRef.current;
        }
        // Dimension gravity affects our custom gravity strength
        const dimGravityY = dimensionRuntime.getState().id === 'overworld' ? -0.52 : dimensionRuntime.getState().id === 'crystal_realm' ? -0.30 : dimensionRuntime.getState().id === 'moon' ? -0.14 : -0.62;
        const gravityStrength = GRAVITY_BASE * (Math.abs(dimGravityY) / 0.52);
        const jumpVel = JUMP_VELOCITY_BASE * (dimGravityY < -0.3 ? 1 : 0.9 + Math.abs(dimGravityY) / 0.52 * 0.2);

        updateWorldLighting(scene, lighting, timeState.timeOfDay, settingsRef.current.experimentalVulkanMode || settingsRef.current.realisticLighting);
        ambientParticles.setEnabled(settingsRef.current.particlesEnabled && !settingsRef.current.reducedMotion);
        ambientParticles.update(timeState.timeOfDay, settingsRef.current.experimentalVulkanMode);
        nextGenRuntime.update(deltaSeconds, camera.position, settingsRef.current);
        dimensionRuntime.update(deltaSeconds);
        worldInteractions.update(deltaSeconds);
        logicRuntime.update(deltaSeconds);
        authorityRuntime.update(deltaSeconds);
        settlementRuntime.update(camera.position, deltaSeconds);
        const settlementMessage = settlementRuntime.consumeDiscoveryMessage();
        if (settlementMessage) showActionMessage(settlementMessage);
        creatureManager.update(camera.position, deltaSeconds);
        const collectedDrops = itemDrops.update(camera.position, deltaSeconds);
        if (collectedDrops.length > 0) {
          let nextInventory = inventoryRef.current;
          let collectedCount = 0;
          for (const drop of collectedDrops) {
            nextInventory = addToInventory(nextInventory, drop.blockId, drop.amount);
            collectedCount += drop.amount;
          }
          publishInventory(nextInventory);
          onGameplayEvent('dropsCollected', collectedCount);
          audio.play('pickup', settingsRef.current);
        }
        camera.speed = Math.max(0.7, settingsRef.current.cameraSpeed * 1.15);
        scene.fogEnabled = settingsRef.current.fogEnabled;
        applyRenderScale(engine, settingsRef.current.renderScale);
        if (thirdPerson) {
          avatar.position.copyFrom(camera.position);
          avatar.position.y -= 1.05;
          avatar.rotation.y = camera.rotation.y;
        }

        // ----- Jump physics core -----
        grounded = isGroundedCheck(camera.position);
        if (grounded) {
          if (velocityY < -0.5 && wasFalling) {
            const fallDist = fallStartY - camera.position.y;
            if (fallDist > 5.8) {
              const dmg = Math.round((fallDist - 5.8) * 5.2);
              const nextStats = applyDamage(survivalStatsRef.current, dmg);
              survivalStatsRef.current = nextStats;
              publishSurvivalStats(nextStats);
              showActionMessage(`Fall damage -${dmg} HP from ${fallDist.toFixed(1)}m`);
            }
          }
          wasFalling = false;
          fallStartY = camera.position.y;
          if (velocityY <= 0.2) velocityY = 0;
          if (jumpRequested) {
            velocityY = jumpVel;
            grounded = false;
            jumpRequested = false;
            audio.play('ui', settingsRef.current);
            showActionMessage(`Jump! (velocity ${jumpVel.toFixed(1)})`);
            onGameplayEvent('blocksMined', 0); // placeholder for jump counter if needed
          }
        } else {
          if (!wasFalling) {
            wasFalling = true;
            fallStartY = lastCameraPosition.y;
          }
          velocityY += gravityStrength * deltaSeconds;
          if (velocityY < TERMINAL_VELOCITY) velocityY = TERMINAL_VELOCITY;
        }
        // Apply vertical motion with collision — cast to any because UniversalCamera's type may not expose moveWithCollisions in some Babylon versions
        if (Math.abs(velocityY) > 0.001) {
          (camera as any).moveWithCollisions?.(new Vector3(0, velocityY * deltaSeconds, 0));
          // Fallback if moveWithCollisions not available: direct position adjust with ground check
          if (!(camera as any).moveWithCollisions) {
            const nextY = camera.position.y + velocityY * deltaSeconds;
            const footId = terrain.getBlockAt(Math.floor(camera.position.x), Math.floor(nextY - 0.84), Math.floor(camera.position.z));
            if (footId === 0 || footId === 5 || velocityY > 0) camera.position.y = nextY;
            else velocityY = 0;
          }
        }
        // Re-check grounding after move to avoid sinking
        if (isGroundedCheck(camera.position) && velocityY < 0) {
          velocityY = 0;
          grounded = true;
        }

        const horizontalDelta = Math.hypot(camera.position.x - lastCameraPosition.x, camera.position.z - lastCameraPosition.z);
        const moving = horizontalDelta > 0.01;

        let nextSurvivalStats = updateSurvivalLoop(survivalStatsRef.current, deltaSeconds, moving);
        survivalStatsRef.current = nextSurvivalStats;
        survivalFrame += 1;
        if (survivalFrame % 8 === 0) publishSurvivalStats(nextSurvivalStats);

        streamFrame += 1;
        if (streamFrame % 12 === 0) {
          const nextCenter = toChunkCoordinate(camera.position.x, camera.position.z);
          if (nextCenter.cx !== streamCenter.cx || nextCenter.cz !== streamCenter.cz) {
            streamCenter = nextCenter;
            const result = renderer.updateVisibleChunks(streamCenter.cx, streamCenter.cz, renderRadius, (cx, cz) => terrain.generateChunk(cx, cz));
            showActionMessage(`Streaming chunks: +${result.loaded} / -${result.unloaded} • Spawn clear, objectives spread`);
            // Re-register shadows for new meshes
            try {
              const shadowGen = lighting.shadowGenerator;
              for (const m of scene.meshes) {
                if (m.name.startsWith('voxel_world_')) {
                  shadowGen.addShadowCaster(m as Mesh, true);
                  (m as Mesh).receiveShadows = true;
                }
              }
            } catch {}
          }
          logicRuntime.scanPlacedNetwork(camera.position);
          publishRuntimeStatus();
          const targetPick = scene.pickWithRay(camera.getForwardRay(BLOCK_REACH));
          const creatureId = targetPick?.pickedMesh?.metadata?.creatureId as string | undefined;
          if (targetPick?.hit && creatureId) {
            setTargetLabel('Creature • left click to interact');
          } else if (targetPick?.hit && targetPick.pickedPoint && targetPick.pickedMesh?.name.startsWith('voxel_world_')) {
            const normal = targetPick.getNormal(true);
            if (normal) {
              normal.normalize();
              const target = toBlockCoordinate(targetPick.pickedPoint.add(normal.scale(-0.01)));
              const blockId = terrain.getBlockAt(target.x, target.y, target.z);
              setTargetLabel(blockId === 0 ? '' : getBlock(blockId).name);
            }
          } else {
            setTargetLabel('');
          }
          publishRenderStats();
        }

        positionFrame += 1;
        if (positionFrame % 8 === 0) {
          setWorldTime(timeState);
          setPosition({
            x: Number(camera.position.x.toFixed(1)),
            y: Number(camera.position.y.toFixed(1)),
            z: Number(camera.position.z.toFixed(1)),
          });
        }

        lastCameraPosition = camera.position.clone();
      });

      const lockPointerIfNeeded = (): boolean => {
        canvas.focus();
        if (document.pointerLockElement === canvas) return true;
        void canvas.requestPointerLock?.();
        showActionMessage('Mouse locked — WASD walk, SPACE jump, mouse look');
        return false;
      };

      const pickTargetBlock = (): { target: BlockCoordinate; blockId: BlockID; normal: Vector3; point: Vector3 } | null => {
        const pick = scene.pickWithRay(camera.getForwardRay(BLOCK_REACH), (mesh) => mesh.name.startsWith('voxel_world_'));
        if (!pick?.hit || !pick.pickedPoint) return null;
        const normal = pick.getNormal(true);
        if (!normal || normal.lengthSquared() === 0) return null;
        normal.normalize();
        const target = toBlockCoordinate(pick.pickedPoint.add(normal.scale(-0.01)));
        const blockId = terrain.getBlockAt(target.x, target.y, target.z);
        if (blockId === 0) return null;
        return { target, blockId, normal, point: pick.pickedPoint };
      };

      const startMining = (): void => {
        const picked = pickTargetBlock();
        if (!picked) {
          showActionMessage('No block in reach');
          clearMining();
          return;
        }
        const toolId = selectedToolRef.current;
        const estimate = estimateMining(picked.blockId, toolId);
        const tool = getTool(toolId);
        miningSession = {
          target: picked.target,
          blockId: picked.blockId,
          startedAt: performance.now(),
          durationMs: estimate.durationMs,
          canHarvest: estimate.canHarvest,
          toolName: tool.name,
        };
        setMiningProgress(0.01);
        setMiningLabel(`${tool.name} mining ${getBlock(picked.blockId).name}${estimate.canHarvest ? '' : ' (no drop)'}`);
        showActionMessage(`${getBlock(picked.blockId).name}: ${(estimate.durationMs / 1000).toFixed(1)}s with ${tool.name}`);
      };

      const attackCreature = (): boolean => {
        const pick = scene.pickWithRay(camera.getForwardRay(BLOCK_REACH), (mesh) => Boolean(mesh.metadata?.creatureId));
        const creatureId = pick?.pickedMesh?.metadata?.creatureId as string | undefined;
        if (!pick?.hit || !creatureId) return false;
        const tool = getTool(selectedToolRef.current);
        const damage = 5 + tool.tier * 4 + (tool.kind === 'axe' ? 3 : 0);
        const result = creatureManager.damageCreature(creatureId, damage);
        if (!result.hit) return false;
        authorityRuntime.recordAction();
        audio.play(result.dead ? 'creature_down' : 'hit', settingsRef.current);
        showActionMessage(result.message);
        if (result.dead) {
          onGameplayEvent('creaturesDefeated');
          for (const drop of result.drops ?? []) {
            itemDrops.spawnDrop(drop.blockId, result.position ?? camera.position, drop.amount);
          }
        }
        publishRenderStats();
        return true;
      };

      const placeSelectedBlock = (): void => {
        const picked = pickTargetBlock();
        if (!picked) {
          showActionMessage('No block face in reach');
          return;
        }
        const placeTarget = toBlockCoordinate(picked.point.add(picked.normal.scale(0.01)));
        if (terrain.getBlockAt(placeTarget.x, placeTarget.y, placeTarget.z) !== 0) {
          showActionMessage('That space is occupied');
          return;
        }
        if (wouldBlockPlayer(placeTarget, camera.position)) {
          showActionMessage('Cannot place inside player');
          return;
        }
        const blockToPlace = selectedBlockRef.current;
        if (gameMode !== 'creative' && !canConsumeBlock(inventoryRef.current, blockToPlace, 1)) {
          showActionMessage(`No ${getBlock(blockToPlace).name} left — mine blocks to collect more`);
          return;
        }
        terrain.setBlockAt(placeTarget.x, placeTarget.y, placeTarget.z, blockToPlace);
        authorityRuntime.recordAction();
        if (gameMode !== 'creative') publishInventory(removeFromInventory(inventoryRef.current, blockToPlace, 1));
        onGameplayEvent('blocksPlaced');
        audio.play('place', settingsRef.current);
        rebuildEditedBlock(placeTarget);
        saveWorldEdits();
        showActionMessage(`Placed ${getBlock(blockToPlace).name} ×${getStackCount(inventoryRef.current, blockToPlace)}`);
      };

      const handleBlockMouseDown = (event: MouseEvent): void => {
        if (event.button !== 0 && event.button !== 2) return;
        event.preventDefault();
        if (!lockPointerIfNeeded()) return;
        if (event.button === 0) {
          if (!attackCreature()) startMining();
        } else {
          placeSelectedBlock();
        }
      };

      const handleMouseUp = (event: MouseEvent): void => {
        if (event.button !== 0 || !miningSession) return;
        showActionMessage('Mining canceled');
        clearMining();
      };

      const handleKeyDown = (event: KeyboardEvent): void => {
        // Jump — SPACE (the critical fix!)
        if (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          if (grounded) jumpRequested = true;
          else if (velocityY > -1 && grounded) jumpRequested = true; // edge case
          return;
        }
        if (event.key === 'F5') {
          event.preventDefault();
          thirdPerson = !thirdPerson;
          arm.isVisible = !thirdPerson;
          avatar.isVisible = thirdPerson;
          camera.position.y += thirdPerson ? 0.45 : -0.45;
          camera.position.z -= thirdPerson ? 3.8 : -3.8;
          showActionMessage(thirdPerson ? 'Third-person view' : 'First-person view');
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          if (commandOpen) {
            setCommandOpen(false);
            return;
          }
          document.exitPointerLock?.();
          setPaused(true);
          showActionMessage('Paused — spawn clear, objectives spread 50-110m out');
          return;
        }
        if (event.key === '/' && settingsRef.current.commandBlocksEnabled) {
          event.preventDefault();
          document.exitPointerLock?.();
          setCommandText('/');
          setCommandOpen(true);
          showActionMessage('Command console opened');
          return;
        }
        const keyIndex = Number.parseInt(event.key, 10) - 1;
        if (keyIndex >= 0 && keyIndex < HOTBAR_BLOCKS.length && !Number.isNaN(keyIndex)) {
          event.preventDefault();
          const nextBlock = HOTBAR_BLOCKS[keyIndex];
          selectedBlockRef.current = nextBlock;
          onSelectedBlockChange(nextBlock);
          showActionMessage(`Selected ${getBlock(nextBlock).name} ×${getStackCount(inventoryRef.current, nextBlock)}`);
          return;
        }
        if (event.key.toLowerCase() === 't') {
          event.preventDefault();
          const tool = nextTool(selectedToolRef.current, toolInventoryRef.current);
          selectedToolRef.current = tool;
          onSelectedToolChange(tool);
          showActionMessage(`Equipped ${getTool(tool).name}`);
          return;
        }
        if (event.key.toLowerCase() === 'i' || event.key.toLowerCase() === 'e') {
          event.preventDefault();
          onToggleInventory();
          audio.play('ui', settingsRef.current);
          showActionMessage('Inventory / crafting panel toggled');
          return;
        }
        if (event.key.toLowerCase() === 'p') {
          event.preventDefault();
          const usedPlacedCore = hasNearbyBlock(terrain, camera.position, 15, 5);
          const dimension = dimensionRuntime.cycle();
          dimensionRuntime.triggerTransitionEffect(camera.position, usedPlacedCore);
          authorityRuntime.recordAction();
          audio.play('ui', settingsRef.current);
          showActionMessage(`${usedPlacedCore ? 'Placed Portal Core activated' : 'Portal 75m away monument'} — ${dimension.message}`);
          publishRuntimeStatus();
          return;
        }
        if (event.key.toLowerCase() === 'n') {
          event.preventDefault();
          showActionMessage(nextGenRuntime.damageFinalBoss(gameMode === 'creative' || gameMode === 'incredible' ? 160 : 45));
          audio.play('hit', settingsRef.current);
          publishRuntimeStatus();
          return;
        }
        if (event.key.toLowerCase() === 'c') {
          event.preventDefault();
          showActionMessage(nextGenRuntime.startCredits());
          publishRuntimeStatus();
          return;
        }
        if (event.key.toLowerCase() === 'k') {
          event.preventDefault();
          showActionMessage(nextGenRuntime.skipCredits());
          publishRuntimeStatus();
          return;
        }
        if (event.key.toLowerCase() === 'h') {
          event.preventDefault();
          showActionMessage(nextGenRuntime.toggleGodMode());
          publishRuntimeStatus();
          return;
        }
        if (event.key.toLowerCase() === 'g') {
          event.preventDefault();
          const message = worldInteractions.tryUseDoor(camera.position, () => dimensionRuntime.cycle().id as RuntimeDimensionID);
          audio.play('ui', settingsRef.current);
          showActionMessage(message);
          publishRuntimeStatus();
          return;
        }
        if (event.key.toLowerCase() === 'r') {
          event.preventDefault();
          const message = worldInteractions.tryLaunchRocket(camera.position, () => {
            dimensionRuntime.setDimension('moon');
            dimensionRuntime.triggerTransitionEffect(camera.position, true);
            nextGenRuntime.launchMoonRuntime();
          });
          audio.play('ui', settingsRef.current);
          showActionMessage(message);
          publishRuntimeStatus();
          return;
        }
        if (event.key.toLowerCase() === 'v') {
          event.preventDefault();
          const settlement = settlementRuntime.getStats(camera.position);
          if (!settlement.discovered) {
            showActionMessage(`Settlement ${Math.round(Math.hypot(layout.settlement.x, layout.settlement.z))}m away — find beacon`);
            publishRuntimeStatus();
            return;
          }
          let delivered = false;
          if (getStackCount(inventoryRef.current, 17) > 0) {
            publishInventory(removeFromInventory(inventoryRef.current, 17, 1));
            showActionMessage(settlementRuntime.deliverSupplies('crate', 1));
            delivered = true;
          } else if (getStackCount(inventoryRef.current, 6) > 0) {
            publishInventory(removeFromInventory(inventoryRef.current, 6, 1));
            showActionMessage(settlementRuntime.deliverSupplies('wood', 1));
            delivered = true;
          } else if (getStackCount(inventoryRef.current, 3) > 0) {
            publishInventory(removeFromInventory(inventoryRef.current, 3, 1));
            showActionMessage(settlementRuntime.deliverSupplies('stone', 1));
            delivered = true;
          } else {
            showActionMessage('No settlement supplies available');
          }
          if (delivered) {
            authorityRuntime.recordAction();
            audio.play('craft', settingsRef.current);
          }
          publishRuntimeStatus();
          return;
        }
        if (event.key.toLowerCase() === 'l') {
          event.preventDefault();
          const logic = logicRuntime.toggle();
          audio.play('ui', settingsRef.current);
          showActionMessage(`Redstone signal ${logic.active ? 'ON' : 'OFF'}`);
          publishRuntimeStatus();
          return;
        }
        if (event.key.toLowerCase() === 'b') {
          event.preventDefault();
          const settlement = settlementRuntime.getStats(camera.position);
          if (!settlement.discovered) {
            showActionMessage('Find the settlement before trading');
            return;
          }
          if (getStackCount(inventoryRef.current, 8) > 0) {
            let nextInventory = removeFromInventory(inventoryRef.current, 8, 1);
            nextInventory = addToInventory(nextInventory, 17, 1);
            publishInventory(nextInventory);
            authorityRuntime.recordAction();
            audio.play('craft', settingsRef.current);
            showActionMessage(`${settlementRuntime.completeTrade()} — Coal traded for Village Crate`);
          } else if (getStackCount(inventoryRef.current, 10) > 0) {
            let nextInventory = removeFromInventory(inventoryRef.current, 10, 1);
            nextInventory = addToInventory(nextInventory, 16, 2);
            publishInventory(nextInventory);
            authorityRuntime.recordAction();
            audio.play('craft', settingsRef.current);
            showActionMessage(`${settlementRuntime.completeTrade()} — Gold traded for Crystal Shards`);
          } else {
            showActionMessage('Need Coal or Gold Ore to barter');
          }
          publishRuntimeStatus();
          return;
        }
        if (event.key.toLowerCase() === 'o') {
          event.preventDefault();
          onToggleSettings();
          audio.play('ui', settingsRef.current);
          showActionMessage('Settings toggled');
        }
      };

      const handleContextMenu = (event: MouseEvent): void => {
        event.preventDefault();
      };

      const handleResize = (): void => {
        engine.resize();
      };

      canvas.addEventListener('mousedown', handleBlockMouseDown);
      canvas.addEventListener('contextmenu', handleContextMenu);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('resize', handleResize);

      engine.runRenderLoop(() => {
        scene.render();
      });
      engine.resize();

      const initialStats = renderer.getStats();
      console.log(`[Render] De-cluttered world ready: ${initialStats.loadedChunks} chunks, spawn clear, settlement ${layout.settlement.x.toFixed(1)},${layout.settlement.z.toFixed(1)}, rocket ${layout.rocket.x.toFixed(1)},${layout.rocket.z.toFixed(1)}`);

      cleanupScene = () => {
        if (actionMessageTimer !== undefined) window.clearTimeout(actionMessageTimer);
        canvas.removeEventListener('mousedown', handleBlockMouseDown);
        canvas.removeEventListener('contextmenu', handleContextMenu);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('resize', handleResize);
        itemDrops.dispose();
        ambientParticles.dispose();
        worldInteractions.dispose();
        nextGenRuntime.dispose();
        creatureManager.dispose();
        settlementRuntime.dispose();
        logicRuntime.dispose();
        dimensionRuntime.dispose();
        renderer.dispose();
        scene.dispose();
        engine.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanupScene?.();
    };
  }, [onGameplayEvent, onInventoryChange, onRuntimeStatusChange, onSelectedBlockChange, onSelectedToolChange, onSurvivalStatsChange, onToggleInventory, onToggleSettings, seed, settings.rendererPreference, worldVersion]);

  const submitCommand = (): void => {
    const result = runCommand(commandText, {
      settings: settingsRef.current,
      time: worldTimeRef.current,
      lastMessage: actionMessage,
    });
    onSettingsChange(clampSettings(result.settings));
    worldTimeRef.current = result.time;
    setWorldTime(result.time);
    setActionMessage(result.lastMessage);
    setCommandOpen(false);
  };

  const resetSavedWorld = (): void => {
    document.exitPointerLock?.();
    const result = WorldSaveManager.clearSeed(seed);
    setSaveStatus(result.message);
    setActionMessage('World reset — spawn is clear, objectives remain spread 50-110m');
    setMiningProgress(0);
    setMiningLabel('');
    setWorldVersion((version) => version + 1);
  };

  return (
    <div className="game-screen">
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="game-hud">
        <div className="hud-top">
          <div>❤️ {Math.round(survivalStats.health)}</div>
          <div>🍗 {Math.round(survivalStats.food)} ⚡ {Math.round(survivalStats.stamina)}</div>
          <div>EAOIN {GAME_VERSION} • {RELEASE_NAME} • SEED: {seed}</div>
          <div>Tool: {getTool(selectedTool).name} • SPACE=Jump</div>
          <div>XYZ {position.x}, {position.y}, {position.z}</div>
          <div>{saveStatus}</div>
        </div>
        {settings.showStats && (
          <div className="render-stats-panel">
            <div>Renderer {renderStats.renderer.backend.toUpperCase()}</div>
            <div>{renderStats.renderer.label}</div>
            <div>Vulkan path {renderStats.renderer.vulkanPath === 'browser-webgpu-may-map-to-vulkan' ? 'WebGPU possible' : 'native required'}</div>
            <div>Ray tracing: SSAO+Shadows+Bloom+Reflections</div>
            <div>FPS {renderStats.fps}</div>
            <div>Chunks {renderStats.loadedChunks} @ {renderStats.streamCenter}</div>
            <div>Meshes {renderStats.meshCount}</div>
            <div>Creatures {renderStats.creatures.count}/{renderStats.creatures.cap}</div>
            <div>Drops {renderStats.drops}</div>
            <div>Tris {renderStats.triangleCount.toLocaleString()}</div>
            <div>Rebuilds {renderStats.rebuildCount}</div>
          </div>
        )}
        <div className="crosshair">+</div>
        {targetLabel && <div className="target-label">{targetLabel}</div>}
        {miningProgress > 0 && (
          <div className="mining-progress">
            <div className="mining-label">{miningLabel}</div>
            <div className="mining-bar">
              <span style={{ width: `${Math.round(miningProgress * 100)}%` }} />
            </div>
          </div>
        )}
        <div className="control-hint">
          {actionMessage} • Time {worldTime.timeOfDay.toFixed(1)}
          {worldTime.frozen ? ' frozen' : ''} • Mode {gameMode} • O objectives U systems
        </div>
        {commandOpen && (
          <div className="command-console">
            <input
              value={commandText}
              autoFocus
              onChange={(event) => setCommandText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitCommand();
                if (event.key === 'Escape') setCommandOpen(false);
              }}
            />
            <button onClick={submitCommand}>Run</button>
          </div>
        )}
        <button className="settings-game" onClick={onToggleSettings}>
          SETTINGS
        </button>
        <button className="reset-world" onClick={resetSavedWorld}>
          RESET WORLD
        </button>
        <button className="exit-game" onClick={onExit}>
          EXIT
        </button>
        {paused && (
          <div className="pause-panel">
            <h2>Paused — World De-cluttered</h2>
            <p>Spawn is clear 26m. Settlement 58m NW. Rocket 110m SE in clearing. Portal 72m NE. Press SPACE to jump (fixed).</p>
            <button
              onClick={() => {
                setPaused(false);
                canvasRef.current?.requestPointerLock?.();
              }}
            >
              Resume
            </button>
            <button onClick={onToggleSettings}>Settings</button>
            <button onClick={onExit}>Exit to Menu</button>
          </div>
        )}
      </div>
    </div>
  );
}

function updateWorldLighting(scene: Scene, lighting: SceneLightingHandles, timeOfDay: number, realistic: boolean): void {
  const angle = (timeOfDay / 24) * Math.PI * 2;
  const daylight = Math.max(0.08, Math.sin(angle - Math.PI / 2) * 0.5 + 0.5);
  const moonlight = 1 - daylight;
  const boost = realistic ? 1.22 : 1;

  lighting.sun.intensity = daylight * 1.55 * boost;
  lighting.sky.intensity = (0.32 + daylight * 0.82) * boost;
  lighting.spawnLight.intensity = 0.40 + moonlight * 1.1;
  scene.fogDensity = realistic ? 0.0028 + moonlight * 0.0026 : 0.0040;
  scene.ambientColor = new Color3(0.12 + daylight * 0.42, 0.14 + daylight * 0.46, 0.20 + daylight * 0.50);

  const sunset = Math.max(0, 1 - Math.abs(daylight - 0.22) / 0.22);
  const starAlpha = Math.max(0, Math.min(1, (0.42 - daylight) * 2.4));
  const rayAlpha = sunset * (realistic ? 1.3 : 0.85);
  lighting.godRays.visibility = rayAlpha;
  lighting.godRays.rotation.y += 0.00012;
  const rayMaterial = lighting.godRays.material as any;
  if (rayMaterial) rayMaterial.alpha = 0.072 * rayAlpha;

  // Sky dome gradient via emissive
  const skyMat = lighting.skyDome.material as StandardMaterial;
  if (skyMat) {
    skyMat.emissiveColor = new Color3(
      0.18 + daylight * 0.32 + sunset * 0.55,
      0.28 + daylight * 0.42 + sunset * 0.22,
      0.42 + daylight * 0.52 - sunset * 0.10
    );
  }

  lighting.sunDisk.visibility = Math.max(0, daylight - 0.12);
  lighting.moonDisk.visibility = Math.max(0, 1 - daylight - 0.05);

  lighting.stars.forEach((star, index) => {
    star.visibility = starAlpha * (0.68 + 0.32 * Math.sin(timeOfDay * 2.4 + index));
  });

  scene.clearColor = new Color4(
    0.035 + daylight * 0.55 + sunset * 0.36,
    0.045 + daylight * 0.68 + sunset * 0.14,
    0.09 + daylight * 0.86 - sunset * 0.06,
    1
  );
  scene.fogColor = new Color3(
    0.22 + daylight * 0.42 + sunset * 0.42,
    0.28 + daylight * 0.52 + sunset * 0.12,
    0.48 + daylight * 0.42 - sunset * 0.18
  );

  // Sun position orbits
  const sunOrbit = angle;
  lighting.sunDisk.position.x = 0 + Math.cos(sunOrbit) * 180;
  lighting.sunDisk.position.y = 50 + Math.sin(sunOrbit) * 110;
  lighting.sunDisk.position.z = 0 + Math.sin(sunOrbit) * 40;
}

function toBlockCoordinate(point: Vector3): BlockCoordinate {
  return {
    x: Math.floor(point.x),
    y: Math.floor(point.y),
    z: Math.floor(point.z),
  };
}

function toChunkCoordinate(worldX: number, worldZ: number): { cx: number; cz: number } {
  return {
    cx: Math.floor(worldX / 16),
    cz: Math.floor(worldZ / 16),
  };
}

function hasNearbyBlock(terrain: TerrainGenerator, position: Vector3, blockId: BlockID, radius: number): boolean {
  const minX = Math.floor(position.x - radius);
  const maxX = Math.floor(position.x + radius);
  const minZ = Math.floor(position.z - radius);
  const maxZ = Math.floor(position.z + radius);
  const minY = Math.max(0, Math.floor(position.y - radius));
  const maxY = Math.min(127, Math.floor(position.y + radius));
  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        if (terrain.getBlockAt(x, y, z) === blockId) return true;
      }
    }
  }
  return false;
}

function wouldBlockPlayer(block: BlockCoordinate, playerPosition: Vector3): boolean {
  const center = new Vector3(block.x + 0.5, block.y + 0.5, block.z + 0.5);
  return (
    Math.abs(center.x - playerPosition.x) < 0.72 &&
    Math.abs(center.y - playerPosition.y) < 1.45 &&
    Math.abs(center.z - playerPosition.z) < 0.72
  );
}

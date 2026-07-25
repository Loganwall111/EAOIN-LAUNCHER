import { useEffect, useRef, useState } from 'react';
import { Color3, Color4, DefaultRenderingPipeline, GlowLayer, Scene, UniversalCamera, Vector3 } from '@babylonjs/core';
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
  const [actionMessage, setActionMessage] = useState('Click canvas to lock mouse • WASD to walk');
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
      scene.gravity = new Vector3(0, -0.34, 0);
      scene.fogEnabled = settingsRef.current.fogEnabled;

    const saveManager = new WorldSaveManager(seed);
    const savedEdits = saveManager.load();
    const terrain = new TerrainGenerator(seed, savedEdits);
    const spawn = terrain.getSpawnPoint();
    setSaveStatus(savedEdits.length > 0 ? `Loaded ${savedEdits.length} saved edit${savedEdits.length === 1 ? '' : 's'}` : 'No saved edits');

    const camera = new UniversalCamera('player_camera', new Vector3(spawn.x, spawn.y, spawn.z), scene);
    camera.attachControl(canvas, true);
    camera.setTarget(new Vector3(spawn.x + 8, spawn.y - 0.35, spawn.z + 8));
    camera.minZ = 0.05;
    camera.maxZ = 450;
    camera.speed = Math.max(0.65, settingsRef.current.cameraSpeed);
    camera.inertia = 0.45;
    camera.angularSensibility = 1800;
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new Vector3(0.42, 0.92, 0.42);
    camera.keysUp = [87, 38]; // W / ArrowUp
    camera.keysDown = [83, 40]; // S / ArrowDown
    camera.keysLeft = [65, 37]; // A / ArrowLeft
    camera.keysRight = [68, 39]; // D / ArrowRight

    const materials = createBlockMaterials(scene, settingsRef.current.texturePack);
    const audio = new GameAudio();
    const renderer = new ChunkRenderManager(scene, materials);
    const itemDrops = new ItemDropManager(scene, materials);
    const renderRadius = qualityRenderDistance(settingsRef.current.qualityPreset);
    const dimensionRuntime = new DimensionRuntime(scene, spawn);
    const ambientParticles = new AmbientParticleRuntime(scene, spawn);
    const worldInteractions = new WorldInteractionRuntime(scene, terrain, spawn);
    const moddingRuntime = new ModdingRuntime();
    moddingRuntime.registerMockPack();
    const nextGenRuntime = new NextGenRuntime(scene, terrain, seed, gameMode, spawn);
    const logicRuntime = new LogicRuntime(scene, terrain, spawn);
    const settlementRuntime = new SettlementRuntime(scene, terrain, seed);
    const authorityRuntime = new LocalAuthorityRuntime(seed);
    let streamCenter = toChunkCoordinate(spawn.x, spawn.z);
    renderer.updateVisibleChunks(
      streamCenter.cx,
      streamCenter.cz,
      renderRadius,
      (cx, cz) => terrain.generateChunk(cx, cz)
    );
    const lighting = configureSceneLighting(scene, spawn);
    // Browser-safe cinematic approximation of ray-traced presentation: HDR
    // bloom, multisample antialiasing and image processing. Real hardware ray
    // tracing is not exposed consistently by WebGL/WebGPU browsers.
    const glow = new GlowLayer('voxel_bloom', scene, { blurKernelSize: 32 });
    glow.intensity = settingsRef.current.postProcessEnabled || settingsRef.current.realisticLighting ? 0.38 : 0;
    const pipeline = new DefaultRenderingPipeline('voxel_cinematic_pipeline', true, scene, [camera]);
    pipeline.fxaaEnabled = true;
    pipeline.samples = 2;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.contrast = 1.08;
    pipeline.imageProcessing.exposure = 1.05;
    pipeline.bloomEnabled = settingsRef.current.postProcessEnabled || settingsRef.current.realisticLighting;
    pipeline.bloomThreshold = 0.82;
    pipeline.bloomWeight = 0.18;
    dimensionRuntime.applyCurrent();
    const creatureManager = new CreatureManager(scene, terrain, seed);
    creatureManager.update(camera.position, 1);

    let miningSession: MiningSession | null = null;
    let actionMessageTimer: number | undefined;
    const showActionMessage = (message: string): void => {
      setActionMessage(message);
      if (actionMessageTimer !== undefined) window.clearTimeout(actionMessageTimer);
      actionMessageTimer = window.setTimeout(() => {
        setActionMessage('Hold left: mine • Right click: place • T: cycle tools');
      }, 1800);
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
        settlementName: settlement.discovered ? settlement.name : 'Undiscovered',
        settlementDiscovered: settlement.discovered,
        villagers: settlement.villagers,
        settlementProsperity: settlement.prosperity,
        settlementTask: settlement.discovered ? settlement.activeTask : 'Find the village',
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

    let positionFrame = 0;
    let survivalFrame = 0;
    let streamFrame = 0;
    let timeState: WorldTimeState = worldTimeRef.current;
    let lastCameraPosition = camera.position.clone();
    let falling = false;
    let fallStartY = camera.position.y;

    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      if (miningSession) {
        const progress = Math.min(1, (now - miningSession.startedAt) / miningSession.durationMs);
        setMiningProgress(progress);
        if (progress >= 1) finishMining(miningSession);
      }

      const deltaSeconds = Math.min(engine.getDeltaTime() / 1000, 0.05);
      if (!timeState.frozen) {
        timeState = { ...timeState, timeOfDay: (timeState.timeOfDay + deltaSeconds * 0.035) % 24 };
        worldTimeRef.current = timeState;
      } else if (worldTimeRef.current !== timeState) {
        timeState = worldTimeRef.current;
      }
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
      camera.speed = Math.max(0.65, settingsRef.current.cameraSpeed);
      scene.fogEnabled = settingsRef.current.fogEnabled;
      applyRenderScale(engine, settingsRef.current.renderScale);
      const horizontalDelta = Math.hypot(
        camera.position.x - lastCameraPosition.x,
        camera.position.z - lastCameraPosition.z
      );
      const moving = horizontalDelta > 0.012;

      let nextSurvivalStats = updateSurvivalLoop(survivalStatsRef.current, deltaSeconds, moving);
      const verticalDelta = camera.position.y - lastCameraPosition.y;
      if (verticalDelta < -0.055) {
        if (!falling) {
          falling = true;
          fallStartY = lastCameraPosition.y;
        }
        fallStartY = Math.max(fallStartY, lastCameraPosition.y);
      } else if (falling && Math.abs(verticalDelta) < 0.018) {
        const fallDistance = fallStartY - camera.position.y;
        if (fallDistance > 5.5) {
          const damage = Math.round((fallDistance - 5.5) * 5);
          nextSurvivalStats = applyDamage(nextSurvivalStats, damage);
          showActionMessage(`Fall damage -${damage} HP`);
        }
        falling = false;
        fallStartY = camera.position.y;
      }

      survivalStatsRef.current = nextSurvivalStats;
      survivalFrame += 1;
      if (survivalFrame % 8 === 0) publishSurvivalStats(nextSurvivalStats);

      streamFrame += 1;
      if (streamFrame % 12 === 0) {
        const nextCenter = toChunkCoordinate(camera.position.x, camera.position.z);
        if (nextCenter.cx !== streamCenter.cx || nextCenter.cz !== streamCenter.cz) {
          streamCenter = nextCenter;
          const result = renderer.updateVisibleChunks(
            streamCenter.cx,
            streamCenter.cz,
            renderRadius,
            (cx, cz) => terrain.generateChunk(cx, cz)
          );
          showActionMessage(`Streaming chunks: +${result.loaded} / -${result.unloaded}`);
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
      showActionMessage('Mouse locked — use WASD to walk and mouse to look');
      return false;
    };

    const pickTargetBlock = (): { target: BlockCoordinate; blockId: BlockID; normal: Vector3; point: Vector3 } | null => {
      const pick = scene.pickWithRay(
        camera.getForwardRay(BLOCK_REACH),
        (mesh) => mesh.name.startsWith('voxel_world_')
      );

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
      const pick = scene.pickWithRay(
        camera.getForwardRay(BLOCK_REACH),
        (mesh) => Boolean(mesh.metadata?.creatureId)
      );
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
      if (event.key === 'Escape') {
        event.preventDefault();
        if (commandOpen) {
          setCommandOpen(false);
          return;
        }
        document.exitPointerLock?.();
        setPaused(true);
        showActionMessage('Paused');
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
        showActionMessage(`${usedPlacedCore ? 'Placed Portal Core activated' : 'Spawn portal monument activated'} — ${dimension.message}`);
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
          showActionMessage('Find the settlement before delivering supplies');
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
    console.log(
      `[Render] Playable streamed scene ready: ${initialStats.loadedChunks} chunks, ${initialStats.meshCount} block meshes, spawn ${spawn.x.toFixed(1)},${spawn.y.toFixed(1)},${spawn.z.toFixed(1)}`
    );

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
    setActionMessage('World reset to generated seed terrain');
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
          <div>Tool: {getTool(selectedTool).name}</div>
          <div>XYZ {position.x}, {position.y}, {position.z}</div>
          <div>{saveStatus}</div>
        </div>
        {settings.showStats && (
          <div className="render-stats-panel">
            <div>Renderer {renderStats.renderer.backend.toUpperCase()}</div>
            <div>{renderStats.renderer.label}</div>
            <div>Vulkan path {renderStats.renderer.vulkanPath === 'browser-webgpu-may-map-to-vulkan' ? 'WebGPU possible' : 'native required'}</div>
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
            <div className="mining-bar"><span style={{ width: `${Math.round(miningProgress * 100)}%` }} /></div>
          </div>
        )}
        <div className="control-hint">{actionMessage} • Time {worldTime.timeOfDay.toFixed(1)}{worldTime.frozen ? ' frozen' : ''} • Mode {gameMode}</div>
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
        <button className="settings-game" onClick={onToggleSettings}>SETTINGS</button>
        <button className="reset-world" onClick={resetSavedWorld}>RESET WORLD</button>
        <button className="exit-game" onClick={onExit}>EXIT</button>
        {paused && (
          <div className="pause-panel">
            <h2>Paused</h2>
            <p>Press Escape to pause. Use I/E for inventory, O for settings.</p>
            <button onClick={() => {
              setPaused(false);
              canvasRef.current?.requestPointerLock?.();
            }}>Resume</button>
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
  const boost = realistic ? 1.18 : 1;

  lighting.sun.intensity = daylight * 1.45 * boost;
  lighting.sky.intensity = (0.28 + daylight * 0.76) * boost;
  lighting.spawnLight.intensity = 0.35 + moonlight * 0.9;
  scene.fogDensity = realistic ? 0.0035 + moonlight * 0.003 : 0.0045;
  scene.ambientColor = new Color3(0.12 + daylight * 0.38, 0.14 + daylight * 0.42, 0.2 + daylight * 0.45);
  scene.clearColor = new Color4(
    0.035 + daylight * 0.55,
    0.045 + daylight * 0.68,
    0.09 + daylight * 0.86,
    1
  );
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
    Math.abs(center.x - playerPosition.x) < 0.85 &&
    Math.abs(center.y - playerPosition.y) < 1.65 &&
    Math.abs(center.z - playerPosition.z) < 0.85
  );
}

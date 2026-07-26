import { useEffect, useRef, useState } from 'react';
import { Color3, Color4, DefaultRenderingPipeline, GlowLayer, Mesh, MeshBuilder, Scene, StandardMaterial, UniversalCamera, Vector3 } from '@babylonjs/core';
import { GameAudio } from '../audio/GameAudio';
import { SettlementRuntime } from '../civilization/SettlementRuntime';
import { CloudRuntime } from '../effects/CloudRuntime';
import { runCommand, WorldTimeState } from '../commands/CommandRuntime';
import { BlockID, getBlock } from '@shared/blocks/BlockRegistry';
import { addToInventory, canConsumeBlock, getStackCount, HOTBAR_BLOCKS, InventoryStacks, removeFromInventory } from '../player/InventoryState';
import { applyDamage, SurvivalStats, updateSurvivalLoop } from '../player/SurvivalState';
import { estimateMining, getTool, nextTool, ToolID, ToolInventory } from '../player/ToolState';
import { CreatureManager, CreatureStats } from '../creatures/CreatureManager';
import DimensionRuntime, { RuntimeDimensionID } from '../dimensions/DimensionRuntime';
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
  seed: string; gameMode: GameMode; onExit: () => void;
  selectedBlock: BlockID; onSelectedBlockChange: (b: BlockID) => void;
  selectedTool: ToolID; onSelectedToolChange: (t: ToolID) => void;
  toolInventory: ToolInventory; inventory: InventoryStacks; onInventoryChange: (i: InventoryStacks) => void;
  survivalStats: SurvivalStats; onSurvivalStatsChange: (s: SurvivalStats) => void;
  settings: GameSettings; onSettingsChange: (s: GameSettings) => void;
  onToggleInventory: () => void; onToggleSettings: () => void;
  onGameplayEvent: (e: GameplayCounterKey, amount?: number) => void;
  onRuntimeStatusChange: (s: RuntimeStatus) => void;
}
interface PlayerPosition { x: number; y: number; z: number; }
interface BlockCoordinate { x: number; y: number; z: number; }
interface MiningSession { target: BlockCoordinate; blockId: BlockID; startedAt: number; durationMs: number; canHarvest: boolean; toolName: string; }
interface RuntimeRenderStats extends ChunkRenderStats { fps: number; streamCenter: string; creatures: CreatureStats; drops: number; renderer: RendererBackendInfo; }

const BLOCK_REACH = 7;
const GRAVITY_BASE = -20;
const JUMP_VELOCITY_BASE = 7.5;
const TERMINAL_VELOCITY = -28;
const INITIAL_RENDERER_INFO: RendererBackendInfo = { backend: 'webgl', label: 'Initializing renderer', requested: 'auto', webgpuSupported: false, vulkanPath: 'native-vulkan-required' };

export default function GameCanvas({ seed, gameMode, onExit, selectedBlock, onSelectedBlockChange, selectedTool, onSelectedToolChange, toolInventory, inventory, onInventoryChange, survivalStats, onSurvivalStatsChange, settings, onSettingsChange, onToggleInventory, onToggleSettings, onGameplayEvent, onRuntimeStatusChange }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedBlockRef = useRef<BlockID>(selectedBlock);
  const selectedToolRef = useRef<ToolID>(selectedTool);
  const toolInventoryRef = useRef<ToolInventory>(toolInventory);
  const inventoryRef = useRef<InventoryStacks>(inventory);
  const survivalStatsRef = useRef<SurvivalStats>(survivalStats);
  const settingsRef = useRef<GameSettings>(settings);
  const worldTimeRef = useRef<WorldTimeState>({ timeOfDay: 12, frozen: false });
  const flightEnabledRef = useRef(false);
  const [position, setPosition] = useState<PlayerPosition>({ x: 0, y: 0, z: 0 });
  const [actionMessage, setActionMessage] = useState('WASD move • SPACE jump • Left mine with hand punch • Right place • T chat /day /time • O objectives U systems');
  const [saveStatus, setSaveStatus] = useState('Save ready');
  const [worldVersion, setWorldVersion] = useState(0);
  const [miningProgress, setMiningProgress] = useState(0);
  const [miningLabel, setMiningLabel] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [paused, setPaused] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandText, setCommandText] = useState('/help');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ text: string; system?: boolean }>>([{ text: 'Welcome — T to chat, / for commands, Q to cycle tools, SPACE to jump, clouds moving', system: true }]);
  const [worldTime, setWorldTime] = useState<WorldTimeState>({ timeOfDay: 12, frozen: false });
  const [renderStats, setRenderStats] = useState<RuntimeRenderStats>({ loadedChunks: 0, meshCount: 0, triangleCount: 0, rebuildCount: 0, fps: 0, streamCenter: '0,0', creatures: { count: 0, cap: 0, spawned: 0, despawned: 0 }, drops: 0, renderer: INITIAL_RENDERER_INFO });
  const [flightEnabled, setFlightEnabled] = useState(false);

  useEffect(() => { selectedBlockRef.current = selectedBlock; }, [selectedBlock]);
  useEffect(() => { selectedToolRef.current = selectedTool; }, [selectedTool]);
  useEffect(() => { toolInventoryRef.current = toolInventory; }, [toolInventory]);
  useEffect(() => { inventoryRef.current = inventory; }, [inventory]);
  useEffect(() => { survivalStatsRef.current = survivalStats; }, [survivalStats]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { worldTimeRef.current = worldTime; }, [worldTime]);

  useEffect(() => {
    let disposed = false;
    let cleanupScene: (() => void) | undefined;
    void (async () => {
      const canvas = canvasRef.current; if (!canvas) return;
      canvas.tabIndex = 1;
      const runtimeEngine = await createRuntimeEngine(canvas, settingsRef.current);
      const engine = runtimeEngine.engine;
      if (disposed) { engine.dispose(); return; }
      setRenderStats(c => ({ ...c, renderer: runtimeEngine.info }));
      const scene = new Scene(engine);
      scene.clearColor = new Color4(0.42, 0.62, 0.86, 1);
      scene.collisionsEnabled = true;
      scene.gravity = new Vector3(0, 0, 0);
      scene.fogEnabled = settingsRef.current.fogEnabled;

      const saveManager = new WorldSaveManager(seed);
      const savedEdits = saveManager.load();
      const terrain = new TerrainGenerator(seed, savedEdits);
      const spawn = terrain.getSpawnPoint();
      const layout = getWorldLayout(seed, spawn);
      setSaveStatus(savedEdits.length > 0 ? `Loaded ${savedEdits.length} edits • Settlement ${Math.round(Math.hypot(layout.settlement.x, layout.settlement.z))}m • Rocket ${Math.round(Math.hypot(layout.rocket.x, layout.rocket.z))}m • Clouds visible • F fly` : `Regular Minecraft-like world • clouds visible • F fly • 20min day`);

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
      const arm = MeshBuilder.CreateBox('first_person_blocky_arm', { width: 0.22, height: 0.72, depth: 0.22 }, scene);
      arm.parent = camera; arm.position = new Vector3(0.42, -0.48, 0.72); arm.rotation.z = -0.12; arm.material = skin; arm.isPickable = false;
      const armPunchBase = new Vector3(0.42, -0.48, 0.72);

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
      const audio = new GameAudio();
      const renderer = new ChunkRenderManager(scene, materials);
      const itemDrops = new ItemDropManager(scene, materials);
      const renderRadius = qualityRenderDistance(settingsRef.current.qualityPreset);
      const dimensionRuntime = new DimensionRuntime(scene, spawn, seed);
      const ambientParticles = new AmbientParticleRuntime(scene, spawn);
      const worldInteractions = new WorldInteractionRuntime(scene, terrain, spawn, seed);
      const moddingRuntime = new ModdingRuntime(); moddingRuntime.registerMockPack();
      const nextGenRuntime = new NextGenRuntime(scene, terrain, seed, gameMode, spawn);
      const logicRuntime = new LogicRuntime(scene, terrain, spawn);
      const settlementRuntime = new SettlementRuntime(scene, terrain, seed);
      const authorityRuntime = new LocalAuthorityRuntime(seed);
      let streamCenter = toChunkCoordinate(spawn.x, spawn.z);
      renderer.updateVisibleChunks(streamCenter.cx, streamCenter.cz, renderRadius, (cx, cz) => terrain.generateChunk(cx, cz));
      const lighting = configureSceneLighting(scene, spawn);
      const cloudRuntime = new CloudRuntime(scene, spawn.y, seed);

      const glow = new GlowLayer('voxel_bloom', scene, { blurKernelSize: 64 });
      glow.intensity = settingsRef.current.postProcessEnabled || settingsRef.current.realisticLighting ? 0.42 : 0.15;
      let pipeline: DefaultRenderingPipeline | null = null;
      const optionalPostEffectsEnabled = settingsRef.current.postProcessEnabled || settingsRef.current.qualityPreset === 'cinematic' || settingsRef.current.experimentalShaders;
      if (optionalPostEffectsEnabled) {
        try {
          pipeline = new DefaultRenderingPipeline('voxel_cinematic_pipeline', true, scene, [camera]);
          pipeline.fxaaEnabled = true; pipeline.samples = 2; pipeline.imageProcessingEnabled = true; pipeline.imageProcessing.contrast = 1.03; pipeline.imageProcessing.exposure = 0.92; pipeline.imageProcessing.vignetteEnabled = false;
          pipeline.bloomEnabled = true; pipeline.bloomThreshold = 0.82; pipeline.bloomWeight = 0.28; pipeline.bloomKernel = 64; pipeline.bloomScale = 0.6;
          pipeline.depthOfFieldEnabled = settingsRef.current.qualityPreset === 'cinematic'; pipeline.depthOfField.focalLength = 10; pipeline.depthOfField.fStop = 2.8;
        } catch (error) {
          pipeline?.dispose(); pipeline = null;
          scene.postProcessesEnabled = false;
          console.warn('[Render] Optional post-processing disabled to keep world visible.', error);
        }
      }
      scene.environmentIntensity = 0.72;
      dimensionRuntime.applyCurrent();
      const creatureManager = new CreatureManager(scene, terrain, seed); creatureManager.update(camera.position, 1);

      // cracking overlay mesh — official block cracking like Minecraft
      let crackMesh: Mesh | null = null;
      const crackMaterial = new StandardMaterial('crack_mat', scene);
      crackMaterial.diffuseColor = new Color3(0.05, 0.05, 0.05);
      crackMaterial.emissiveColor = new Color3(0.12, 0.12, 0.12);
      crackMaterial.alpha = 0.0;
      crackMaterial.wireframe = false;
      crackMaterial.backFaceCulling = false;

      let miningSession: MiningSession | null = null;
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
      const clearMining = (): void => {
        miningSession = null; setMiningProgress(0); setMiningLabel('');
        if (crackMesh) { crackMesh.dispose(); crackMesh = null; crackMaterial.alpha = 0; }
        // reset arm
        arm.position.copyFrom(armPunchBase); arm.rotation.z = -0.12;
      };
      const publishRenderStats = (): void => {
        const s = renderer.getStats();
        setRenderStats({ ...s, fps: Math.round(engine.getFps()), streamCenter: `${streamCenter.cx},${streamCenter.cz}`, creatures: creatureManager.getStats(), drops: itemDrops.getCount(), renderer: runtimeEngine.info });
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
      const saveWorldEdits = (): void => { const r = saveManager.save(terrain.getEdits()); setSaveStatus(r.message); };
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

      let positionFrame = 0, survivalFrame = 0, streamFrame = 0;
      let timeState: WorldTimeState = worldTimeRef.current;
      let lastCameraPosition = camera.position.clone();

      scene.onBeforeRenderObservable.add(() => {
        const now = performance.now();
        if (miningSession) {
          const progress = Math.min(1, (now - miningSession.startedAt) / miningSession.durationMs);
          setMiningProgress(progress);
          // hand punch animation — arm goes towards block when punching tree
          const punch = Math.sin(progress * Math.PI * 6) * 0.12; // rapid punch
          const forward = progress * 0.55;
          const isWood = miningSession.blockId === 6;
          arm.position.x = armPunchBase.x - forward * (isWood ? 0.38 : 0.28) + punch * 0.1;
          arm.position.y = armPunchBase.y + forward * 0.14 + Math.abs(punch) * 0.08;
          arm.position.z = armPunchBase.z - forward * 0.55 - Math.abs(punch) * 0.12;
          arm.rotation.x = isWood ? -0.28 * progress : 0;
          arm.rotation.z = -0.12 - punch * 0.6;
          // cracking overlay progress
          if (crackMesh) {
            crackMaterial.alpha = 0.18 + progress * 0.62;
            const scale = 1.002 + progress * 0.018;
            crackMesh.scaling.set(scale, scale, scale);
            // simulate cracking lines by changing emissive
            crackMaterial.emissiveColor = new Color3(progress * 0.2, 0, 0);
          }
          if (progress >= 1) finishMining(miningSession);
        } else {
          // idle arm sway
          arm.position.x = armPunchBase.x + Math.sin(now * 0.0012) * 0.02;
          arm.position.y = armPunchBase.y + Math.cos(now * 0.0015) * 0.015;
          arm.position.z = armPunchBase.z;
          arm.rotation.x = 0; arm.rotation.z = -0.12;
        }

        const deltaSeconds = Math.min(engine.getDeltaTime() / 1000, 0.05);
        if (!timeState.frozen) { timeState = { ...timeState, timeOfDay: (timeState.timeOfDay + deltaSeconds * 0.02) % 24 }; worldTimeRef.current = timeState; }
        else if (worldTimeRef.current !== timeState) timeState = worldTimeRef.current;
        const dimGravityY = dimensionRuntime.getState().id === 'overworld' ? -0.52 : dimensionRuntime.getState().id === 'crystal_realm' ? -0.30 : dimensionRuntime.getState().id === 'moon' ? -0.14 : -0.62;
        const gravityStrength = GRAVITY_BASE * (Math.abs(dimGravityY) / 0.52);
        const jumpVel = JUMP_VELOCITY_BASE * (dimGravityY < -0.3 ? 1 : 0.9 + Math.abs(dimGravityY) / 0.52 * 0.2);

        updateWorldLighting(scene, lighting, timeState.timeOfDay, settingsRef.current.experimentalVulkanMode || settingsRef.current.realisticLighting);
        ambientParticles.setEnabled(settingsRef.current.particlesEnabled && !settingsRef.current.reducedMotion);
        ambientParticles.update(timeState.timeOfDay, settingsRef.current.experimentalVulkanMode);
        cloudRuntime.update(deltaSeconds);
        nextGenRuntime.update(deltaSeconds, camera.position, settingsRef.current);
        dimensionRuntime.update(deltaSeconds); worldInteractions.update(deltaSeconds); logicRuntime.update(deltaSeconds); authorityRuntime.update(deltaSeconds); settlementRuntime.update(camera.position, deltaSeconds);
        const settlementMessage = settlementRuntime.consumeDiscoveryMessage(); if (settlementMessage) showActionMessage(settlementMessage);
        creatureManager.update(camera.position, deltaSeconds);
        const collectedDrops = itemDrops.update(camera.position, deltaSeconds);
        if (collectedDrops.length > 0) {
          let nextInv = inventoryRef.current; let c = 0;
          for (const drop of collectedDrops) { nextInv = addToInventory(nextInv, drop.blockId, drop.amount); c += drop.amount; }
          publishInventory(nextInv); onGameplayEvent('dropsCollected', c); audio.play('pickup', settingsRef.current);
        }
        camera.speed = Math.max(0.7, settingsRef.current.cameraSpeed * 1.15);
        scene.fogEnabled = settingsRef.current.fogEnabled;
        applyRenderScale(engine, settingsRef.current.renderScale);
        if (thirdPerson) {
          // Place the avatar at the player's feet (camera is at eye level ~1.62).
          avatar.position.x = camera.position.x;
          avatar.position.y = camera.position.y - 1.62;
          avatar.position.z = camera.position.z;
          // Face the same direction as the camera
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
        survivalStatsRef.current = nextSurvival; survivalFrame += 1; if (survivalFrame % 8 === 0) publishSurvivalStats(nextSurvival);
        streamFrame += 1;
        if (streamFrame % 12 === 0) {
          const nextCenter = toChunkCoordinate(camera.position.x, camera.position.z);
          if (nextCenter.cx !== streamCenter.cx || nextCenter.cz !== streamCenter.cz) {
            streamCenter = nextCenter;
            const result = renderer.updateVisibleChunks(streamCenter.cx, streamCenter.cz, renderRadius, (cx, cz) => terrain.generateChunk(cx, cz));
            showActionMessage(`Streaming +${result.loaded}/-${result.unloaded} • Clouds moving • Fog ${settingsRef.current.fogEnabled ? '100-1000' : 'off'}`);
            try { const sg = lighting.shadowGenerator; for (const m of scene.meshes) if (m.name.startsWith('voxel_world_')) { sg.addShadowCaster(m as Mesh, true); (m as Mesh).receiveShadows = true; } } catch {}
          }
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
        if (positionFrame % 8 === 0) { setWorldTime(timeState); setPosition({ x: Number(camera.position.x.toFixed(1)), y: Number(camera.position.y.toFixed(1)), z: Number(camera.position.z.toFixed(1)) }); }
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
        // create cracking overlay box at block position
        if (crackMesh) crackMesh.dispose();
        crackMesh = MeshBuilder.CreateBox(`crack_${picked.target.x}_${picked.target.y}_${picked.target.z}`, { width: 1.02, height: 1.02, depth: 1.02 }, scene);
        crackMesh.position = new Vector3(picked.target.x + 0.5, picked.target.y + 0.5, picked.target.z + 0.5);
        crackMesh.material = crackMaterial; crackMaterial.alpha = 0.12; crackMesh.isPickable = false; crackMesh.checkCollisions = false;
        showActionMessage(`${getBlock(picked.blockId).name}: cracking… ${(estimate.durationMs / 1000).toFixed(1)}s`);
      };
      const attackCreature = (): boolean => {
        const pick = scene.pickWithRay(camera.getForwardRay(BLOCK_REACH), (mesh) => Boolean(mesh.metadata?.creatureId));
        const creatureId = pick?.pickedMesh?.metadata?.creatureId as string | undefined; if (!pick?.hit || !creatureId) return false;
        const tool = getTool(selectedToolRef.current); const damage = 5 + tool.tier * 4 + (tool.kind === 'axe' ? 3 : 0);
        const result = creatureManager.damageCreature(creatureId, damage); if (!result.hit) return false;
        authorityRuntime.recordAction(); audio.play(result.dead ? 'creature_down' : 'hit', settingsRef.current); showActionMessage(result.message);
        if (result.dead) { onGameplayEvent('creaturesDefeated'); for (const drop of result.drops ?? []) itemDrops.spawnDrop(drop.blockId, result.position ?? camera.position, drop.amount); }
        publishRenderStats(); return true;
      };
      const placeSelectedBlock = (): void => {
        const picked = pickTargetBlock(); if (!picked) { showActionMessage('No block face'); return; }
        const placeTarget = toBlockCoordinate(picked.point.add(picked.normal.scale(0.01)));
        if (terrain.getBlockAt(placeTarget.x, placeTarget.y, placeTarget.z) !== 0) { showActionMessage('Occupied'); return; }
        if (wouldBlockPlayer(placeTarget, camera.position)) { showActionMessage('Cannot place inside player'); return; }
        const blockToPlace = selectedBlockRef.current;
        if (gameMode !== 'creative' && !canConsumeBlock(inventoryRef.current, blockToPlace, 1)) { showActionMessage(`No ${getBlock(blockToPlace).name} left`); return; }
        terrain.setBlockAt(placeTarget.x, placeTarget.y, placeTarget.z, blockToPlace);
        authorityRuntime.recordAction(); if (gameMode !== 'creative') publishInventory(removeFromInventory(inventoryRef.current, blockToPlace, 1));
        onGameplayEvent('blocksPlaced'); audio.play('place', settingsRef.current); rebuildEditedBlock(placeTarget); saveWorldEdits();
        showActionMessage(`Placed ${getBlock(blockToPlace).name}`);
      };
      const handleBlockMouseDown = (event: MouseEvent): void => {
        if (event.button !== 0 && event.button !== 2) return; event.preventDefault(); if (!lockPointerIfNeeded()) return;
        if (event.button === 0) { if (!attackCreature()) startMining(); } else placeSelectedBlock();
      };
      const handleMouseUp = (event: MouseEvent): void => { if (event.button !== 0 || !miningSession) return; showActionMessage('Mining canceled'); clearMining(); };
      const handleKeyDown = (event: KeyboardEvent): void => {
        pressedKeys.add(event.code);
        if (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar') { event.preventDefault(); if (!flightEnabledRef.current && grounded) jumpRequested = true; return; }
        if (event.key === 'F5') {
          event.preventDefault();
          thirdPerson = !thirdPerson;
          arm.isVisible = !thirdPerson; // hide first-person arm in third-person
          avatar.isVisible = thirdPerson; // show the player model in third-person
          // For third-person we back the camera away from the player slightly,
          // but we do this via the camera's local position rather than by
          // teleporting the camera in world space, which used to cause the
          // player to fall out of the world.
          if (thirdPerson) {
            // Move camera back along its forward direction.
            const forward = camera.getForwardRay().direction;
            camera.position = camera.position.add(forward.scale(-THIRD_PERSON_DISTANCE));
            // Slight downward look so the player is centered in the frame.
            camera.rotation.x -= 0.18;
            // The avatar follows the camera in the render loop now.
          } else {
            // Return to first-person: snap camera back behind the player model.
            const forward = camera.getForwardRay().direction;
            camera.position = camera.position.add(forward.scale(THIRD_PERSON_DISTANCE));
            camera.rotation.x += 0.18;
          }
          showActionMessage(thirdPerson ? '🎥 Third-person view — your player is now visible' : '🎥 First-person view');
          return;
        }
        if (event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFlightMode(); audio.play('ui', settingsRef.current); return; }
        if (event.key === 'Escape') { event.preventDefault(); if (commandOpen || chatOpen) { setCommandOpen(false); setChatOpen(false); return; } document.exitPointerLock?.(); setPaused(true); return; }
        if (event.key === '/' && settingsRef.current.commandBlocksEnabled) { event.preventDefault(); document.exitPointerLock?.(); setCommandText('/'); setCommandOpen(true); setChatOpen(false); showActionMessage('Command console / — try /day /time /summon'); return; }
        if (event.key.toLowerCase() === 't' && !commandOpen && !chatOpen) { event.preventDefault(); document.exitPointerLock?.(); setChatText(''); setChatOpen(true); showActionMessage('Chat opened — T like Minecraft, type /day /time /summon'); return; }
        if (event.key.toLowerCase() === 'q') { event.preventDefault(); const tool = nextTool(selectedToolRef.current, toolInventoryRef.current); selectedToolRef.current = tool; onSelectedToolChange(tool); showActionMessage(`Equipped ${getTool(tool).name} (Q)`); return; }
        const keyIndex = Number.parseInt(event.key, 10) - 1;
        if (keyIndex >= 0 && keyIndex < HOTBAR_BLOCKS.length && !Number.isNaN(keyIndex)) { event.preventDefault(); const nextBlock = HOTBAR_BLOCKS[keyIndex]; selectedBlockRef.current = nextBlock; onSelectedBlockChange(nextBlock); showActionMessage(`Selected ${getBlock(nextBlock).name}`); return; }
        if (event.key.toLowerCase() === 'i' || event.key.toLowerCase() === 'e') { event.preventDefault(); onToggleInventory(); audio.play('ui', settingsRef.current); showActionMessage('Inventory with block logos + 2x2/3x3 crafting'); return; }
        if (event.key.toLowerCase() === 'p') { event.preventDefault(); const used = hasNearbyBlock(terrain, camera.position, 15, 5); const dim = dimensionRuntime.cycle(); dimensionRuntime.triggerTransitionEffect(camera.position, used); authorityRuntime.recordAction(); audio.play('ui', settingsRef.current); showActionMessage(`${used ? 'Portal Core' : 'Portal monument'} — ${dim.message}`); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'n') { event.preventDefault(); showActionMessage(nextGenRuntime.damageFinalBoss(gameMode === 'creative' || gameMode === 'incredible' ? 160 : 45)); audio.play('hit', settingsRef.current); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'c') { event.preventDefault(); showActionMessage(nextGenRuntime.startCredits()); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'k') { event.preventDefault(); showActionMessage(nextGenRuntime.skipCredits()); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'h') { event.preventDefault(); showActionMessage(nextGenRuntime.toggleGodMode()); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'g') { event.preventDefault(); const m = worldInteractions.tryUseDoor(camera.position, () => dimensionRuntime.cycle().id as RuntimeDimensionID); audio.play('ui', settingsRef.current); showActionMessage(m); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'r') { event.preventDefault(); const m = worldInteractions.tryLaunchRocket(camera.position, () => { dimensionRuntime.setDimension('moon'); dimensionRuntime.triggerTransitionEffect(camera.position, true); nextGenRuntime.launchMoonRuntime(); }); audio.play('ui', settingsRef.current); showActionMessage(m); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'v') { event.preventDefault(); const settlement = settlementRuntime.getStats(camera.position); if (!settlement.discovered) { showActionMessage(`Settlement ${Math.round(Math.hypot(layout.settlement.x, layout.settlement.z))}m away`); publishRuntimeStatus(); return; } let delivered = false; if (getStackCount(inventoryRef.current, 17) > 0) { publishInventory(removeFromInventory(inventoryRef.current, 17, 1)); showActionMessage(settlementRuntime.deliverSupplies('crate', 1)); delivered = true; } else if (getStackCount(inventoryRef.current, 6) > 0) { publishInventory(removeFromInventory(inventoryRef.current, 6, 1)); showActionMessage(settlementRuntime.deliverSupplies('wood', 1)); delivered = true; } else if (getStackCount(inventoryRef.current, 3) > 0) { publishInventory(removeFromInventory(inventoryRef.current, 3, 1)); showActionMessage(settlementRuntime.deliverSupplies('stone', 1)); delivered = true; } else showActionMessage('No supplies'); if (delivered) { authorityRuntime.recordAction(); audio.play('craft', settingsRef.current); } publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'l') { event.preventDefault(); const logic = logicRuntime.toggle(); audio.play('ui', settingsRef.current); showActionMessage(`Redstone ${logic.active ? 'ON' : 'OFF'}`); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'b') { event.preventDefault(); const settlement = settlementRuntime.getStats(camera.position); if (!settlement.discovered) { showActionMessage('Find settlement'); return; } if (getStackCount(inventoryRef.current, 8) > 0) { let ni = removeFromInventory(inventoryRef.current, 8, 1); ni = addToInventory(ni, 17, 1); publishInventory(ni); authorityRuntime.recordAction(); audio.play('craft', settingsRef.current); showActionMessage(`${settlementRuntime.completeTrade()} — Coal for Crate`); } else if (getStackCount(inventoryRef.current, 10) > 0) { let ni = removeFromInventory(inventoryRef.current, 10, 1); ni = addToInventory(ni, 16, 2); publishInventory(ni); authorityRuntime.recordAction(); audio.play('craft', settingsRef.current); showActionMessage(`${settlementRuntime.completeTrade()} — Gold for Shards`); } else showActionMessage('Need Coal or Gold'); publishRuntimeStatus(); return; }
        if (event.key.toLowerCase() === 'o') { event.preventDefault(); document.exitPointerLock?.(); onToggleSettings(); return; }
      };
      const handleKeyUp = (event: KeyboardEvent): void => { pressedKeys.delete(event.code); };
      const handleContextMenu = (e: MouseEvent): void => { e.preventDefault(); };
      const handleResize = (): void => { engine.resize(); };
      canvas.addEventListener('mousedown', handleBlockMouseDown); canvas.addEventListener('contextmenu', handleContextMenu);
      window.addEventListener('mouseup', handleMouseUp); window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp); window.addEventListener('eaoin-toggle-flight', handleFlightButton); window.addEventListener('resize', handleResize);
      let recoveredFromRenderError = false;
      engine.runRenderLoop(() => {
        try {
          scene.render();
        } catch (error) {
          if (!recoveredFromRenderError) {
            recoveredFromRenderError = true;
            console.error('[Render] Scene render failed; disabling optional effects and retrying.', error);
            pipeline?.dispose(); pipeline = null;
            scene.postProcessesEnabled = false;
            setActionMessage('Renderer recovered — optional effects disabled so the world stays visible');
          }
          try { scene.render(); } catch {}
        }
      }); engine.resize();
      const initialStats = renderer.getStats(); console.log(`[Render] 3.2 ready: ${initialStats.loadedChunks} chunks, clouds moving, mountains & caves volumetric, 16 render, 20min day`);
      cleanupScene = () => {
        if (actionMessageTimer !== undefined) window.clearTimeout(actionMessageTimer);
        canvas.removeEventListener('mousedown', handleBlockMouseDown); canvas.removeEventListener('contextmenu', handleContextMenu);
        window.removeEventListener('mouseup', handleMouseUp); window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); window.removeEventListener('eaoin-toggle-flight', handleFlightButton); window.removeEventListener('resize', handleResize);
        if (crackMesh) crackMesh.dispose(); crackMaterial.dispose();
        itemDrops.dispose(); ambientParticles.dispose(); cloudRuntime.dispose(); worldInteractions.dispose(); nextGenRuntime.dispose(); creatureManager.dispose(); settlementRuntime.dispose(); logicRuntime.dispose(); dimensionRuntime.dispose(); renderer.dispose(); scene.dispose(); engine.dispose();
      };
    })();
    return () => { disposed = true; cleanupScene?.(); };
  }, [gameMode, onGameplayEvent, onInventoryChange, onRuntimeStatusChange, onSelectedBlockChange, onSelectedToolChange, onSurvivalStatsChange, onToggleInventory, onToggleSettings, seed, settings.rendererPreference, worldVersion]);

  const submitCommand = (): void => {
    const result = runCommand(commandText, { settings: settingsRef.current, time: worldTimeRef.current, lastMessage: actionMessage });
    onSettingsChange(clampSettings(result.settings)); worldTimeRef.current = result.time; setWorldTime(result.time); setActionMessage(result.lastMessage); setCommandOpen(false);
    setChatMessages(m => [...m, { text: result.lastMessage, system: true }].slice(-18));
  };
  const submitChat = (): void => {
    const t = chatText.trim(); if (!t) { setChatOpen(false); return; }
    if (t.startsWith('/')) {
      const result = runCommand(t, { settings: settingsRef.current, time: worldTimeRef.current, lastMessage: actionMessage });
      onSettingsChange(clampSettings(result.settings)); worldTimeRef.current = result.time; setWorldTime(result.time); setActionMessage(result.lastMessage);
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
    document.exitPointerLock?.(); const r = WorldSaveManager.clearSeed(seed); setSaveStatus(r.message); setActionMessage('World reset — regular Minecraft-like terrain, grounded lakes, clouds visible, 20min day'); setMiningProgress(0); setMiningLabel(''); setWorldVersion(v => v + 1);
  };

  return (
    <div className="game-screen">
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="game-hud">
        <div className="hud-top"><div>❤️ {Math.round(survivalStats.health)}</div><div>🍗 {Math.round(survivalStats.food)} ⚡ {Math.round(survivalStats.stamina)}</div><div>EAOIN {GAME_VERSION} • {RELEASE_NAME} • SEED: {seed}</div><div>Tool: {getTool(selectedTool).name} • SPACE=Jump • F=Fly • Q=Tools</div><div>XYZ {position.x}, {position.y}, {position.z}</div><div>{saveStatus}</div></div>
        {settings.showStats && <div className="render-stats-panel"><div>Renderer {renderStats.renderer.backend.toUpperCase()}</div><div>{renderStats.renderer.label}</div><div>Clouds: visible moving voxel • Fog 100-1000 {settings.fogEnabled ? 'on' : 'off'}</div><div>Render radius {qualityRenderDistance(settings.qualityPreset)} • MaxZ 1500</div><div>Day/Night 20min cycle • Terrain: regular Minecraft-like overworld</div><div>FPS {renderStats.fps}</div><div>Chunks {renderStats.loadedChunks} @ {renderStats.streamCenter}</div><div>Meshes {renderStats.meshCount}</div><div>Creatures {renderStats.creatures.count}/{renderStats.creatures.cap}</div><div>Drops {renderStats.drops}</div><div>Tris {renderStats.triangleCount.toLocaleString()}</div></div>}
        <div className="crosshair">+</div>
        {targetLabel && <div className="target-label">{targetLabel}</div>}
        {miningProgress > 0 && <div className="mining-progress"><div className="mining-label">{miningLabel} — cracking {Math.round(miningProgress * 10)}/10</div><div className="mining-bar"><span style={{ width: `${Math.round(miningProgress * 100)}%` }} /></div></div>}
        <div className="control-hint">{actionMessage} • Time {worldTime.timeOfDay.toFixed(1)}{worldTime.frozen ? ' frozen' : ''} • Mode {gameMode} • Flight {flightEnabled ? 'ON' : 'OFF'} • T chat / • Q tools • O/U panels • Fog 100-1000</div>
        {commandOpen && <div className="command-console"><input value={commandText} autoFocus onChange={e => setCommandText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitCommand(); if (e.key === 'Escape') setCommandOpen(false); }} /><button onClick={submitCommand}>Run</button></div>}
        {chatOpen && <div className="chat-panel"><div className="chat-log">{chatMessages.slice(-10).map((m, i) => <div key={i} className={`chat-line ${m.system ? 'system' : ''}`}>{m.text}</div>)}</div><div className="chat-input-row"><input className="chat-input" value={chatText} autoFocus placeholder="Chat or /day /time 12 /summon sheep" onChange={e => setChatText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitChat(); if (e.key === 'Escape') setChatOpen(false); }} /><button className="chat-send" onClick={submitChat}>Send</button></div></div>}
        <button className={`fly-game ${flightEnabled ? 'active' : ''}`} onClick={() => window.dispatchEvent(new Event('eaoin-toggle-flight'))}>FLY [F] {flightEnabled ? 'ON' : 'OFF'}</button>
        <button className="settings-game" onClick={onToggleSettings}>SETTINGS</button>
        <button className="reset-world" onClick={resetSavedWorld}>RESET WORLD</button>
        <button className="exit-game" onClick={onExit}>EXIT</button>
        {paused && <div className="pause-panel"><h2>Paused — Regular World + Fly Button</h2><p>Spawn clear 26m. Settlement 58m, Rocket 110m, Portal 72m, Clouds moving stunning far away, Render distance up to 16 chunks, Terrain regular Minecraft-like hills, grounded lakes, no default floating islands, Day/night 20 min, Inventory block logos, Hand punch goes towards tree, Cracking overlay, Fog 100-1000 toggle, T chat /day /time /summon.</p><button onClick={() => { setPaused(false); canvasRef.current?.requestPointerLock?.(); }}>Resume</button><button onClick={onToggleSettings}>Settings</button><button onClick={onExit}>Exit to Menu</button></div>}
      </div>
    </div>
  );
}

function updateWorldLighting(scene: Scene, lighting: SceneLightingHandles, timeOfDay: number, realistic: boolean): void {
  const angle = (timeOfDay / 24) * Math.PI * 2;
  const daylight = Math.max(0.08, Math.sin(angle - Math.PI / 2) * 0.5 + 0.5);
  const moonlight = 1 - daylight; const boost = realistic ? 1.08 : 1;
  lighting.sun.intensity = daylight * 1.18 * boost; lighting.sky.intensity = (0.24 + daylight * 0.56) * boost; lighting.spawnLight.intensity = 0.32 + moonlight * 0.95;
  scene.fogDensity = realistic ? 0.0010 + moonlight * 0.0005 : 0.0011;
  scene.ambientColor = new Color3(0.10 + daylight * 0.28, 0.12 + daylight * 0.32, 0.18 + daylight * 0.38);
  const sunset = Math.max(0, 1 - Math.abs(daylight - 0.22) / 0.22); const starAlpha = Math.max(0, Math.min(1, (0.42 - daylight) * 2.4)); const rayAlpha = sunset * (realistic ? 1.3 : 0.85);
  lighting.godRays.visibility = rayAlpha; lighting.godRays.rotation.y += 0.00012; const rayMaterial = lighting.godRays.material as any; if (rayMaterial) rayMaterial.alpha = 0.072 * rayAlpha;
  const skyMat = lighting.skyDome.material as StandardMaterial; if (skyMat) { skyMat.emissiveColor = new Color3(0.13 + daylight * 0.22 + sunset * 0.34, 0.22 + daylight * 0.28 + sunset * 0.15, 0.36 + daylight * 0.34 - sunset * 0.08); }
  lighting.sunDisk.visibility = Math.max(0, daylight - 0.12); lighting.moonDisk.visibility = Math.max(0, 1 - daylight - 0.05);
  lighting.stars.forEach((star, index) => { star.visibility = starAlpha * (0.68 + 0.32 * Math.sin(timeOfDay * 2.4 + index)); });
  scene.clearColor = new Color4(0.03 + daylight * 0.39 + sunset * 0.26, 0.04 + daylight * 0.50 + sunset * 0.10, 0.08 + daylight * 0.68 - sunset * 0.04, 1);
  scene.fogColor = new Color3(0.18 + daylight * 0.28 + sunset * 0.30, 0.24 + daylight * 0.36 + sunset * 0.10, 0.42 + daylight * 0.30 - sunset * 0.12);
  const sunOrbit = angle; lighting.sunDisk.position.x = 0 + Math.cos(sunOrbit) * 180; lighting.sunDisk.position.y = 50 + Math.sin(sunOrbit) * 110; lighting.sunDisk.position.z = 0 + Math.sin(sunOrbit) * 40;
}
function toBlockCoordinate(point: Vector3): BlockCoordinate { return { x: Math.floor(point.x), y: Math.floor(point.y), z: Math.floor(point.z) }; }
function toChunkCoordinate(worldX: number, worldZ: number): { cx: number; cz: number } { return { cx: Math.floor(worldX / 16), cz: Math.floor(worldZ / 16) }; }
function hasNearbyBlock(terrain: TerrainGenerator, position: Vector3, blockId: BlockID, radius: number): boolean {
  const minX = Math.floor(position.x - radius); const maxX = Math.floor(position.x + radius); const minZ = Math.floor(position.z - radius); const maxZ = Math.floor(position.z + radius); const minY = Math.max(0, Math.floor(position.y - radius)); const maxY = Math.min(127, Math.floor(position.y + radius));
  for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) for (let y = minY; y <= maxY; y++) if (terrain.getBlockAt(x, y, z) === blockId) return true;
  return false;
}
function wouldBlockPlayer(block: BlockCoordinate, playerPosition: Vector3): boolean {
  const center = new Vector3(block.x + 0.5, block.y + 0.5, block.z + 0.5);
  return Math.abs(center.x - playerPosition.x) < 0.72 && Math.abs(center.y - playerPosition.y) < 1.45 && Math.abs(center.z - playerPosition.z) < 0.72;
}

import { NextGenStatus } from '../nextgen/NextGenRuntime';

export interface RuntimeStatus {
  dimensionId: string;
  dimensionName: string;
  portalUses: number;
  redstoneActive: boolean;
  redstoneToggles: number;
  logicBlocks: number;
  placedLogicWires: number;
  placedSignalLamps: number;
  poweredSignalLamps: number;
  nearbyPortalCore: boolean;
  settlementName: string;
  settlementDiscovered: boolean;
  villagers: number;
  settlementProsperity: number;
  settlementTask: string;
  settlementJobProgress: number;
  settlementWood: number;
  settlementStone: number;
  tradesCompleted: number;
  doors: number;
  dimensionalDoors: number;
  rocketReady: boolean;
  moonVisits: number;
  moddingApiVersion: string;
  loadedMods: number;
  texturePack: string;
  shaderExperimental: boolean;
  commandBlocksEnabled: boolean;
  networkClientId: string;
  networkPing: number;
  networkJitter: number;
  remotePlayers: number;
  outboundPackets: number;
  inboundPackets: number;
  packetLoss: number;
  snapshotBuffer: number;
  rollbackEvents: number;
  predictionError: number;
  syncQuality: number;
  syncState: string;
  authorityTicks: number;
  localActions: number;
  nextGen: NextGenStatus;
}

export function createDefaultNextGenStatus(): NextGenStatus {
  return {
    version: '3.0 Next Generation Unreveals',
    vulkanOfficial: true,
    shadersOfficial: true,
    commandsOfficial: true,
    planets: 0,
    stars: 0,
    rockets: 0,
    blackHoles: 0,
    cityBiome: 'Undiscovered',
    cityLengthKm: 0,
    civilians: 0,
    pirates: 0,
    dams: 0,
    powerPlants: 0,
    sewers: 0,
    waterPhysics: false,
    glassPhysics: false,
    treePhysics: false,
    clothPhysics: false,
    enderRifts: 0,
    dragonHealth: 0,
    tentacleHealth: 0,
    storyChapter: 'Not started',
    endingUnlocked: false,
    creditsActive: false,
    godBlockUnlocked: false,
    godModeActive: false,
    incredibleModeActive: false,
    rareMcdonaldsWorld: false,
    marketplacePacks: 0,
    marketplace: { packs: 0, publishedPacks: 0, creatorToolsOnline: false, pendingReviews: 0, grossCoins: 0 },
    cityEconomy: { name: 'Undiscovered', lengthKm: 0, districts: 0, population: 0, activeJobs: 0, transitLines: 0, powerDemandMw: 0, powerGeneratedMw: 0, waterDemandMl: 0, sewerLoadPercent: 0, marketVolume: 0, happiness: 0, loreEvents: 0 },
    advancedPhysics: { waterCells: 0, waveHeight: 0, floatingBodies: 0, glassStress: 0, crackedGlass: 0, bendingTrees: 0, clothNodes: 0, clothEnergy: 0, fallingTrees: 0, crashParticles: 0, solverIterations: 0 },
    moonRuntime: false,
  };
}

export function createDefaultRuntimeStatus(): RuntimeStatus {
  return {
    dimensionId: 'overworld',
    dimensionName: 'Overworld',
    portalUses: 0,
    redstoneActive: false,
    redstoneToggles: 0,
    logicBlocks: 0,
    placedLogicWires: 0,
    placedSignalLamps: 0,
    poweredSignalLamps: 0,
    nearbyPortalCore: false,
    settlementName: 'Undiscovered',
    settlementDiscovered: false,
    villagers: 0,
    settlementProsperity: 0,
    settlementTask: 'Awaiting discovery',
    settlementJobProgress: 0,
    settlementWood: 0,
    settlementStone: 0,
    tradesCompleted: 0,
    doors: 0,
    dimensionalDoors: 0,
    rocketReady: false,
    moonVisits: 0,
    moddingApiVersion: 'none',
    loadedMods: 0,
    texturePack: 'classic',
    shaderExperimental: false,
    commandBlocksEnabled: false,
    networkClientId: 'local',
    networkPing: 0,
    networkJitter: 0,
    remotePlayers: 0,
    outboundPackets: 0,
    inboundPackets: 0,
    packetLoss: 0,
    snapshotBuffer: 0,
    rollbackEvents: 0,
    predictionError: 0,
    syncQuality: 100,
    syncState: 'green',
    authorityTicks: 0,
    localActions: 0,
    nextGen: createDefaultNextGenStatus(),
  };
}

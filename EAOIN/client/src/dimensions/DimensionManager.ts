/**
 * DimensionManager — Universal Dimension Framework
 * Controls all realities: creation, loading, unloading, connections.
 */
export interface DimensionDef {
  id: string;
  name: string;
  rules: DimensionRules;
  biomeIds: string[];
  enabled: boolean;
  activeSimulation: boolean;
}

export interface DimensionInstance {
  definition: DimensionDef;
  loadedChunks: Set<string>;
  entities: Set<string>;
  portalConnections: string[]; // destination dimension IDs
}

export class DimensionManager {
  private dimensions = new Map<string, DimensionDef>();
  private instances = new Map<string, DimensionInstance>();
  private currentDimension = 'overworld';

  constructor() {
    this.registerDefaultDimensions();
  }

  private registerDefaultDimensions(): void {
    this.registerDimension({
      id: 'overworld',
      name: 'Overworld',
      rules: { gravity: 1.0, timeScale: 1.0, atmosphere: 'normal', physics: 'standard' },
      biomeIds: ['plains', 'forest', 'mountain', 'ocean'],
      enabled: true,
      activeSimulation: true,
    });
    this.registerDimension({
      id: 'nether',
      name: 'Nether',
      rules: { gravity: 1.0, timeScale: 0.5, atmosphere: 'toxic', physics: 'standard' },
      biomeIds: ['nether_wastes', 'crimson_forest'],
      enabled: true,
      activeSimulation: false,
    });
    this.registerDimension({
      id: 'end',
      name: 'The End',
      rules: { gravity: 0.6, timeScale: 2.0, atmosphere: 'none', physics: 'low_gravity' },
      biomeIds: ['end_islands', 'chorus_forest'],
      enabled: true,
      activeSimulation: false,
    });
    this.registerDimension({
      id: 'crystal_realm',
      name: 'Crystal Realm',
      rules: { gravity: 0.4, timeScale: 0.8, atmosphere: 'energy_field', physics: 'modified' },
      biomeIds: ['crystal_forest', 'energy_caves'],
      enabled: true,
      activeSimulation: false,
    });
  }

  registerDimension(def: DimensionDef): void {
    this.dimensions.set(def.id, def);
    this.instances.set(def.id, {
      definition: def,
      loadedChunks: new Set(),
      entities: new Set(),
      portalConnections: [],
    });
    console.log(`[Dimension] Registered: ${def.id}`);
  }

  loadDimension(id: string): DimensionInstance | null {
    const def = this.dimensions.get(id);
    if (!def || !def.enabled) return null;
    const instance = this.instances.get(id);
    if (!instance) return null;
    instance.definition.activeSimulation = true;
    this.currentDimension = id;
    console.log(`[Dimension] Loaded dimension: ${def.name}`);
    return instance;
  }

  unloadDimension(id: string): void {
    const instance = this.instances.get(id);
    if (instance) instance.definition.activeSimulation = false;
  }

  getCurrentDimension(): string {
    return this.currentDimension;
  }

  getDimensionRules(id: string): any {
    return this.dimensions.get(id)?.rules ?? null;
  }
}

/**
 * StarSystem — Procedural Star Systems with Orbiting Objects
 */
import { GalaxyGenerator, StarSystemData } from './GalaxyGenerator';

export class StarSystem {
  private systems = new Map<string, StarSystemData>();

  constructor(private galaxyGenerator: GalaxyGenerator) {}

  createSystem(galaxyId: string, seed: string): StarSystemData {
    const system = this.galaxyGenerator.generateStarSystem(galaxyId, seed);
    this.systems.set(system.id, system);
    console.log(`[StarSystem] Created system ${system.id} in galaxy ${galaxyId}`);
    return system;
  }

  getSystem(id: string): StarSystemData | null {
    return this.systems.get(id) ?? null;
  }

  getAllSystems(): StarSystemData[] {
    return Array.from(this.systems.values());
  }
}

/**
 * GalaxyGenerator — Procedural Cosmic Regions
 */
export interface GalaxyDef {
  id: string;
  type: 'spiral' | 'nebula' | 'cluster' | 'unknown';
  starDensity: number;
  civilizationActivity: number;
  resourceRarity: number;
  seed: string;
}

export interface StarSystemData {
  id: string;
  galaxyId: string;
  star: {
    size: number;
    temperature: number;
    color: string;
    age: number;
    energyOutput: number;
  };
  planets: string[];
  position: { x: number; y: number; z: number };
}

export class GalaxyGenerator {
  private galaxies = new Map<string, GalaxyDef>();

  generateGalaxy(id: string, type: GalaxyDef['type'], seed: string): GalaxyDef {
    const galaxy: GalaxyDef = {
      id,
      type,
      starDensity: 0.3 + Math.random() * 0.7,
      civilizationActivity: Math.random(),
      resourceRarity: Math.random(),
      seed,
    };
    this.galaxies.set(id, galaxy);
    console.log(`[Galaxy] Generated ${type} galaxy: ${id}`);
    return galaxy;
  }

  generateStarSystem(galaxyId: string, seed: string): StarSystemData {
    const galaxy = this.galaxies.get(galaxyId);
    return {
      id: `system_${seed.slice(0, 8)}`,
      galaxyId,
      star: {
        size: 0.5 + Math.random() * 1.5,
        temperature: 3000 + Math.random() * 6000,
        color: `hsl(${30 + Math.random() * 40}, 80%, 70%)`,
        age: Math.random() * 10,
        energyOutput: 1 + Math.random() * 3,
      },
      planets: ['planet_1', 'planet_2', 'planet_moon_1'],
      position: {
        x: (Math.random() - 0.5) * 1000,
        y: (Math.random() - 0.5) * 100,
        z: (Math.random() - 0.5) * 1000,
      },
    };
  }

  getGalaxy(id: string): GalaxyDef | null {
    return this.galaxies.get(id) ?? null;
  }
}

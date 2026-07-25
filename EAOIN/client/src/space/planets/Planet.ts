/**
 * Planet — Surface World with Space Properties
 */
export interface PlanetDef {
  id: string;
  starSystemId: string;
  name: string;
  size: number;
  gravity: number;
  atmosphere: 'normal' | 'thin' | 'dense' | 'toxic';
  temperature: number;
  rotation: number;
  resources: string[];
  lifeLevel: number;
  civilizationLevel: number;
  surfaceWorldId: string;
}

export class Planet {
  createPlanet(starSystemId: string, seed: string): PlanetDef {
    return {
      id: `planet_${seed.slice(0, 8)}`,
      starSystemId,
      name: `Planet-${seed.slice(0, 4)}`,
      size: 0.5 + Math.random() * 2.5,
      gravity: 0.3 + Math.random() * 1.2,
      atmosphere: Math.random() > 0.7 ? 'toxic' : Math.random() > 0.6 ? 'thin' : 'normal',
      temperature: -50 + Math.random() * 150,
      rotation: Math.random() * 24,
      resources: ['iron', 'crystal', 'energy_material'],
      lifeLevel: Math.random(),
      civilizationLevel: Math.random() > 0.8 ? 0.1 + Math.random() * 0.4 : 0,
      surfaceWorldId: `world_${seed}`,
    };
  }
}

/**
 * VillageGenerator — Settlement Generation Framework
 * Camp → Village → Town → City progression.
 */
export interface VillageDef {
  id: string;
  center: { x: number; z: number };
  size: 'camp' | 'village' | 'town' | 'city';
  population: number;
  structures: string[]; // structure IDs
  growthProgress: number; // 0-1
  biome: string;
}

export class VillageGenerator {
  private villages = new Map<string, VillageDef>();

  generateVillage(biome: string, cx: number, cz: number): VillageDef {
    const village: VillageDef = {
      id: `village_${cx}_${cz}`,
      center: { x: cx, z: cz },
      size: 'village',
      population: 10 + Math.floor(Math.random() * 20),
      structures: ['house_1', 'farm_1', 'well_1'],
      growthProgress: Math.random() * 0.4,
      biome,
    };
    this.villages.set(village.id, village);
    console.log(`[Village] Generated ${village.id} at ${cx},${cz} in ${biome}`);
    return village;
  }

  growVillage(id: string): boolean {
    const v = this.villages.get(id);
    if (!v) return false;
    v.growthProgress += 0.05;
    if (v.growthProgress >= 1.0 && v.size === 'village') {
      v.size = 'town';
      v.population += 15;
      v.structures.push('market_1', 'blacksmith_1');
    } else if (v.growthProgress >= 2.0 && v.size === 'town') {
      v.size = 'city';
      v.population += 30;
      v.structures.push('castle_1', 'library_1');
    }
    console.log(`[Village] ${id} grew to ${v.size}`);
    return true;
  }

  getVillages(): VillageDef[] {
    return Array.from(this.villages.values());
  }
}

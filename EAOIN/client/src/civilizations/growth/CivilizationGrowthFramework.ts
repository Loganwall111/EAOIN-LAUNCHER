/**
 * CivilizationGrowthFramework — City-Level Progression System
 */
import { VillageDef, VillageGenerator } from '../villages/VillageGenerator';
import { EconomySystem } from '../economy/EconomySystem';

export interface CivilizationLevelDef {
  level: 'camp' | 'village' | 'town' | 'city' | 'civilization';
  minPopulation: number;
  minStructures: number;
  requiredTradeRoutes: number;
  technologyLevelRequired: number;
}

export class CivilizationGrowthFramework {
  private levels: CivilizationLevelDef[] = [
    { level: 'camp', minPopulation: 0, minStructures: 1, requiredTradeRoutes: 0, technologyLevelRequired: 0 },
    { level: 'village', minPopulation: 10, minStructures: 3, requiredTradeRoutes: 1, technologyLevelRequired: 0.2 },
    { level: 'town', minPopulation: 25, minStructures: 5, requiredTradeRoutes: 2, technologyLevelRequired: 0.4 },
    { level: 'city', minPopulation: 50, minStructures: 10, requiredTradeRoutes: 3, technologyLevelRequired: 0.6 },
    { level: 'civilization', minPopulation: 100, minStructures: 20, requiredTradeRoutes: 5, technologyLevelRequired: 0.8 },
  ];

  evaluateProgression(village: VillageDef, tradeRoutes: number, technologyLevel: number): string | null {
    for (const levelDef of this.levels) {
      if (village.size === levelDef.level) continue;
      if (
        village.population >= levelDef.minPopulation &&
        village.structures.length >= levelDef.minStructures &&
        tradeRoutes >= levelDef.requiredTradeRoutes &&
        technologyLevel >= levelDef.technologyLevelRequired
      ) {
        console.log(`[Civilization] Village ${village.id} reaches ${levelDef.level}`);
        return levelDef.level;
      }
    }
    return null;
  }
}

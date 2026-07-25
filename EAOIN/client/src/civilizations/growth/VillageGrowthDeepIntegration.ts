/**
 * VillageGrowthDeepIntegration — Growth Triggers, Population, Trade Route Integration
 */
import { VillageGenerator, VillageDef } from '../villages/VillageGenerator';
import { EconomySystem } from '../economy/EconomySystem';

export class VillageGrowthDeepIntegration {
  constructor(
    private villageGenerator: VillageGenerator,
    private economy: EconomySystem,
  ) {}

  evaluateGrowthTriggers(): void {
    for (const village of this.villageGenerator.getVillages()) {
      // Growth if population high and trade routes exist
      const routes = this.economy.getRoutes().filter(r => r.fromVillage === village.id || r.toVillage === village.id);
      if (routes.length > 0 && village.population > 20 && village.growthProgress < 1.0) {
        this.villageGenerator.growVillage(village.id);
        console.log(`[Growth] Village ${village.id} triggered growth via trade routes (${routes.length})`);
      }
    }
  }

  integrateWithTradeRoutes(): void {
    for (const village of this.villageGenerator.getVillages()) {
      const nearestVillage = this.findNearestVillage(village);
      if (nearestVillage && village.id !== nearestVillage.id) {
        this.economy.createRoute(village.id, nearestVillage.id, ['wheat', 'stone'], 10);
      }
    }
  }

  private findNearestVillage(village: VillageDef): VillageDef | null {
    const others = this.villageGenerator.getVillages().filter(v => v.id !== village.id);
    if (others.length === 0) return null;
    return others.reduce((nearest, current) => {
      const nearestDist = Math.abs(nearest.center.x - village.center.x) + Math.abs(nearest.center.z - village.center.z);
      const currentDist = Math.abs(current.center.x - village.center.x) + Math.abs(current.center.z - village.center.z);
      return currentDist < nearestDist ? current : nearest;
    }, others[0]);
  }
}

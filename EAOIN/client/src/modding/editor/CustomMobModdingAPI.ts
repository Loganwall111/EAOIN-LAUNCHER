/**
 * CustomMobModdingAPI — API for Custom Mobs
 */
import { DimensionCreatureDef } from '@client/dimensions/creatures/DimensionCreatureSystem';

export class CustomMobModdingAPI {
  private customMobs = new Map<string, DimensionCreatureDef>();

  registerMob(creature: DimensionCreatureDef): boolean {
    this.customMobs.set(creature.id, creature);
    console.log(`[CustomMobAPI] Registered mob: ${creature.id}`);
    return true;
  }

  getMob(id: string): DimensionCreatureDef | null {
    return this.customMobs.get(id) ?? null;
  }

  listCustomMobs(): DimensionCreatureDef[] {
    return Array.from(this.customMobs.values());
  }
}

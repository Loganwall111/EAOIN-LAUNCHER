/**
 * DimensionCreatures — Dimension-Specific Mobs
 */
export interface DimensionCreatureDef {
  id: string;
  dimensionId: string;
  creatureType: string;
  behavior: 'passive' | 'hostile' | 'neutral';
  abilities: string[];
  spawnConditions: { timeOfDay?: number; biome: string[]; weather?: string };
  dropTable: Record<string, number>;
}

export class DimensionCreatureSystem {
  private creatures = new Map<string, DimensionCreatureDef>();

  registerCreature(creature: DimensionCreatureDef): void {
    this.creatures.set(creature.id, creature);
    console.log(`[DimensionCreature] Registered ${creature.id} for ${creature.dimensionId}`);
  }

  spawnCreature(creatureId: string, dimensionId: string): boolean {
    const creature = this.creatures.get(creatureId);
    if (!creature || creature.dimensionId !== dimensionId) return false;
    console.log(`[DimensionCreature] Spawning ${creature.id} in ${dimensionId}`);
    return true;
  }

  getDimensionCreatures(dimensionId: string): DimensionCreatureDef[] {
    return Array.from(this.creatures.values()).filter(c => c.dimensionId === dimensionId);
  }
}

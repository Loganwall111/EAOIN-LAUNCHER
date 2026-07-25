/**
 * DimensionCreatureSpawningExecution — Spawn Conditions & Behavior
 */
import { DimensionCreatureSystem, DimensionCreatureDef } from '../creatures/DimensionCreatureSystem';

export class DimensionCreatureSpawningExecution {
  constructor(private creatureSystem: DimensionCreatureSystem) {}

  evaluateSpawnConditions(dimensionId: string, worldTime: number, biome: string, weather?: string): DimensionCreatureDef[] {
    const candidates = this.creatureSystem.getDimensionCreatures(dimensionId);
    const spawnable: DimensionCreatureDef[] = [];
    for (const creature of candidates) {
      const timeMatch = !creature.spawnConditions.timeOfDay || this.timeInRange(worldTime, creature.spawnConditions.timeOfDay);
      const biomeMatch = creature.spawnConditions.biome.includes(biome);
      const weatherMatch = !creature.spawnConditions.weather || creature.spawnConditions.weather === weather;
      if (timeMatch && biomeMatch && weatherMatch) {
        spawnable.push(creature);
      }
    }
    return spawnable;
  }

  private timeInRange(time: number, target: number): boolean {
    return Math.abs((time % 24000) - target) < 1000;
  }

  spawnFromConditions(creatures: DimensionCreatureDef[], dimensionId: string): boolean[] {
    return creatures.map(c => this.creatureSystem.spawnCreature(c.id, dimensionId));
  }
}

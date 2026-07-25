/**
 * CustomMobDeepIntegration — Behavior & Spawn Integration
 */
import { DimensionCreatureDef } from '@client/dimensions/creatures/DimensionCreatureSystem';
import { DimensionCreatureBehavior } from '@client/dimensions/deep/DimensionCreatureBehavior';

export class CustomMobDeepIntegration {
  constructor(private behaviorSystem: DimensionCreatureBehavior) {}

  initializeCustomMobBehavior(creatureDef: DimensionCreatureDef, position: { x: number; y: number; z: number }): boolean {
    this.behaviorSystem.initializeBehavior(creatureDef, position);
    console.log(`[MobDeep] Behavior initialized for custom mob: ${creatureDef.id}`);
    return true;
  }

  updateCustomMobBehavior(creatureId: string, playerPosition?: { x: number; y: number; z: number }): boolean {
    this.behaviorSystem.updateBehavior(creatureId, playerPosition);
    console.log(`[MobDeep] Behavior updated for ${creatureId}`);
    return true;
  }
}

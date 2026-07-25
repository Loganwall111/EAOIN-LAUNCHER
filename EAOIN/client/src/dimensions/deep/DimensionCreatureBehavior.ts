/**
 * DimensionCreatureBehavior — Movement AI & Combat Framework
 */
import { DimensionCreatureDef } from '../creatures/DimensionCreatureSystem';

export interface CreatureBehaviorState {
  creatureId: string;
  currentBehavior: 'idle' | 'wander' | 'attack' | 'flee';
  target?: { x: number; y: number; z: number };
  health: number;
  aggressionRange: number;
}

export class DimensionCreatureBehavior {
  private behaviors = new Map<string, CreatureBehaviorState>();

  initializeBehavior(creatureDef: DimensionCreatureDef, position: { x: number; y: number; z: number }): void {
    const state: CreatureBehaviorState = {
      creatureId: creatureDef.id,
      currentBehavior: creatureDef.behavior === 'passive' ? 'idle' : 'wander',
      target: position,
      health: 20,
      aggressionRange: creatureDef.behavior === 'hostile' ? 10 : 0,
    };
    this.behaviors.set(creatureDef.id, state);
    console.log(`[CreatureBehavior] Initialized ${creatureDef.id}: ${state.currentBehavior}`);
  }

  updateBehavior(creatureId: string, playerPosition?: { x: number; y: number; z: number }): void {
    const behavior = this.behaviors.get(creatureId);
    if (!behavior) return;
    if (behavior.aggressionRange > 0 && playerPosition) {
      const dx = Math.abs(behavior.target?.x ?? 0 - playerPosition.x);
      const dz = Math.abs(behavior.target?.z ?? 0 - playerPosition.z);
      if (Math.sqrt(dx * dx + dz * dz) < behavior.aggressionRange) {
        behavior.currentBehavior = 'attack';
        behavior.target = playerPosition;
      } else {
        behavior.currentBehavior = 'wander';
      }
    }
  }

  takeDamage(creatureId: string, amount: number): boolean {
    const behavior = this.behaviors.get(creatureId);
    if (!behavior) return false;
    behavior.health -= amount;
    if (behavior.health <= 0) {
      console.log(`[CreatureBehavior] ${creatureId} defeated`);
      return true;
    }
    return false;
  }

  getBehavior(creatureId: string): CreatureBehaviorState | null {
    return this.behaviors.get(creatureId) ?? null;
  }
}

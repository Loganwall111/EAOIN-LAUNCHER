/**
 * DimensionPhysics — Custom physics rules per reality
 */
import { DimensionRules, applyDimensionPhysics } from './DimensionRules';

export class DimensionPhysics {
  private velocities = new Map<string, { x: number; y: number; z: number }>();

  updateVelocity(entityId: string, inputVelocity: { x: number; y: number; z: number }, rules: DimensionRules): { x: number; y: number; z: number } {
    const current = this.velocities.get(entityId) ?? { x: 0, y: 0, z: 0 };
    const newVel = applyDimensionPhysics(
      {
        x: inputVelocity.x + current.x * 0.9, // Friction
        y: inputVelocity.y,
        z: inputVelocity.z + current.z * 0.9,
      },
      rules
    );
    this.velocities.set(entityId, newVel);
    return newVel;
  }

  resetVelocity(entityId: string): void {
    this.velocities.delete(entityId);
  }
}

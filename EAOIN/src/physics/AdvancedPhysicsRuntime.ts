import { Vector3 } from '@babylonjs/core';

export interface AdvancedPhysicsStats {
  waterCells: number;
  waveHeight: number;
  floatingBodies: number;
  glassStress: number;
  crackedGlass: number;
  bendingTrees: number;
  clothNodes: number;
  clothEnergy: number;
  fallingTrees: number;
  crashParticles: number;
  solverIterations: number;
}

export class AdvancedPhysicsRuntime {
  private elapsed = 0;
  private waveHeight = 0;
  private glassStress = 0;
  private crackedGlass = 0;
  private clothEnergy = 0;
  private fallingTrees = 0;
  private crashParticles = 0;

  update(deltaSeconds: number, playerPosition: Vector3): void {
    this.elapsed += deltaSeconds;
    this.waveHeight = Number((0.35 + Math.sin(this.elapsed * 1.8 + playerPosition.x * 0.03) * 0.22).toFixed(2));
    this.glassStress = Number((Math.abs(Math.sin(this.elapsed * 0.35)) * 100).toFixed(1));
    if (this.glassStress > 92 && Math.floor(this.elapsed) % 9 === 0) this.crackedGlass = Math.min(12, this.crackedGlass + 1);
    this.clothEnergy = Number((45 + Math.sin(this.elapsed * 2.3) * 32).toFixed(1));
    if (Math.floor(this.elapsed) % 17 === 0 && this.elapsed > 1) {
      this.fallingTrees = Math.min(8, this.fallingTrees + 1);
      this.crashParticles = Math.min(400, this.crashParticles + 24);
    }
    this.crashParticles = Math.max(0, this.crashParticles - deltaSeconds * 5);
  }

  getStats(): AdvancedPhysicsStats {
    return {
      waterCells: 4096,
      waveHeight: this.waveHeight,
      floatingBodies: 12,
      glassStress: this.glassStress,
      crackedGlass: this.crackedGlass,
      bendingTrees: 64,
      clothNodes: 256,
      clothEnergy: this.clothEnergy,
      fallingTrees: this.fallingTrees,
      crashParticles: Math.round(this.crashParticles),
      solverIterations: 8,
    };
  }
}

import { Color4, ParticleSystem, Scene, Texture, Vector3 } from '@babylonjs/core';
import { SpawnPoint } from '../world/TerrainGenerator';

export class AmbientParticleRuntime {
  private readonly particles: ParticleSystem;

  constructor(scene: Scene, spawn: SpawnPoint) {
    this.particles = new ParticleSystem('release_to_life_ambient_particles', 900, scene);
    this.particles.particleTexture = Texture.CreateFromBase64String('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'particleTex', scene);
    this.particles.emitter = new Vector3(spawn.x, spawn.y + 8, spawn.z);
    this.particles.minEmitBox = new Vector3(-35, 0, -35);
    this.particles.maxEmitBox = new Vector3(35, 12, 35);
    this.particles.color1 = new Color4(0.65, 0.9, 1, 0.22);
    this.particles.color2 = new Color4(1, 0.86, 0.46, 0.18);
    this.particles.colorDead = new Color4(0.2, 0.25, 0.35, 0);
    this.particles.minSize = 0.03;
    this.particles.maxSize = 0.11;
    this.particles.minLifeTime = 3;
    this.particles.maxLifeTime = 8;
    this.particles.emitRate = 55;
    this.particles.direction1 = new Vector3(-0.08, 0.12, -0.08);
    this.particles.direction2 = new Vector3(0.08, 0.25, 0.08);
    this.particles.minEmitPower = 0.05;
    this.particles.maxEmitPower = 0.18;
    this.particles.updateSpeed = 0.01;
    this.particles.start();
  }

  setEnabled(enabled: boolean): void {
    if (enabled && !this.particles.isStarted()) this.particles.start();
    if (!enabled && this.particles.isStarted()) this.particles.stop();
  }

  update(timeOfDay: number, experimentalVulkanMode: boolean): void {
    const night = timeOfDay < 5 || timeOfDay > 20;
    this.particles.emitRate = experimentalVulkanMode ? 90 : night ? 65 : 35;
  }

  dispose(): void {
    this.particles.dispose();
  }
}

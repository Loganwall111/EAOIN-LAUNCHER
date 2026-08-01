/**
 * WeatherEffects — storm lightning and falling meteors/comets.
 *
 * Adds two ambient events the base atmosphere/VFX don't cover:
 *   - Lightning: during a storm, a random flash is triggered which briefly
 *     spikes the scene light and draws a glowing bolt, then a shockwave
 *     ripple of light sweeps outward.
 *   - Meteors/comets: occasional bright streaks that arc down and "crash",
 *     leaving a brief glowing impact flash, so the night sky has real motion.
 *
 * Pure + deterministic-ish and cheap: events are scheduled from elapsed time
 * and driven from the frame loop with no per-frame allocation churn.
 */
import {
  Color3,
  Color4,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';

const STORM_WEATHER = new Set(['rain']);

export class WeatherEffects {
  private elapsed = 0;
  private nextLightningAt = 8 + Math.random() * 12;
  private nextMeteorAt = 20 + Math.random() * 30;
  private flashIntensity = 0;
  private flashMaterial: StandardMaterial | null = null;
  private boltMesh: Mesh | null = null;
  private boltLife = 0;
  private meteorParticles: ParticleSystem | null = null;
  private meteorBurst: ParticleSystem | null = null;
  private readonly random: () => number;

  constructor(
    private readonly scene: Scene,
    private readonly sun: { intensity: number },
    private readonly hemi: { intensity: number }
  ) {
    this.random = Math.random;
  }

  private setupFlashMaterial(): void {
    if (this.flashMaterial) return;
    const mat = new StandardMaterial('weather_lightning_flash', this.scene);
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.disableLighting = true;
    this.flashMaterial = mat;
  }

  /** Create a tall, branching-ish glowing bolt mesh (kept simple). */
  private spawnBolt(at: Vector3): void {
    this.setupFlashMaterial();
    this.disposeBolt();
    const height = 30 + this.random() * 40;
    const bolt = MeshBuilder.CreateTube(
      'weather_bolt',
      { path: [at.add(new Vector3(0, height, 0)), at], radius: 0.35, tessellation: 4, cap: Mesh.CAP_END },
      this.scene
    );
    bolt.material = this.flashMaterial;
    bolt.isPickable = false;
    this.boltMesh = bolt;
    this.boltLife = 0.25;
  }

  private disposeBolt(): void {
    this.boltMesh?.dispose();
    this.boltMesh = null;
  }

  private setupMeteorParticles(): void {
    if (this.meteorParticles) return;
    this.meteorParticles = new ParticleSystem('weather_meteor', 120, this.scene);
    this.meteorParticles.minSize = 1.2; this.meteorParticles.maxSize = 2.4;
    this.meteorParticles.minLifeTime = 0.8; this.meteorParticles.maxLifeTime = 1.6;
    this.meteorParticles.emitRate = 0;
    this.meteorParticles.blendMode = ParticleSystem.BLENDMODE_ADD;
    this.meteorParticles.color1 = new Color4(1, 0.85, 0.5, 1);
    this.meteorParticles.color2 = new Color4(1, 0.6, 0.2, 1);
    this.meteorParticles.colorDead = new Color4(0.4, 0.2, 0.05, 0);
    this.meteorParticles.minEmitPower = 0; this.meteorParticles.maxEmitPower = 0;
    this.meteorParticles.direction1 = new Vector3(0, 0, 0); this.meteorParticles.direction2 = new Vector3(0, 0, 0);
    this.meteorBurst = new ParticleSystem('weather_meteor_burst', 60, this.scene);
    this.meteorBurst.minSize = 1; this.meteorBurst.maxSize = 2;
    this.meteorBurst.minLifeTime = 0.4; this.meteorBurst.maxLifeTime = 0.9;
    this.meteorBurst.emitRate = 0;
    this.meteorBurst.blendMode = ParticleSystem.BLENDMODE_ADD;
    this.meteorBurst.color1 = new Color4(1, 0.9, 0.6, 1);
    this.meteorBurst.colorDead = new Color4(0.5, 0.3, 0.1, 0);
  }

  /** Fire a meteor: a bright streak near the player that ends in an impact flash. */
  private spawnMeteor(camera: Vector3): void {
    this.setupMeteorParticles();
    if (!this.meteorParticles) return;
    // A point a few hundred blocks away, biased ahead of the camera.
    const angle = this.random() * Math.PI * 2;
    const dist = 180 + this.random() * 140;
    const start = camera.add(new Vector3(Math.cos(angle) * dist, 60 + this.random() * 60, Math.sin(angle) * dist));
    const impact = camera.add(new Vector3(Math.cos(angle) * (40 + this.random() * 60), 0, Math.sin(angle) * (40 + this.random() * 60)));
    this.meteorParticles.emitter = start;
    this.meteorParticles.direction1 = impact.subtract(start).normalize().scale(1.0);
    this.meteorParticles.direction2 = this.meteorParticles.direction1.clone();
    this.meteorParticles.minEmitPower = 1; this.meteorParticles.maxEmitPower = 1;
    this.meteorParticles.emitRate = 40;
    this.meteorParticles.start();
    window.setTimeout(() => {
      this.meteorParticles?.stop();
      this.meteorParticles?.dispose();
      this.meteorParticles = null;
      if (this.meteorBurst) {
        this.meteorBurst.emitter = impact;
        this.meteorBurst.emitRate = 30;
        this.meteorBurst.start();
      }
      window.setTimeout(() => {
        this.meteorBurst?.stop();
        this.meteorBurst?.dispose();
        this.meteorBurst = null;
      }, 800);
    }, 1400);
  }

  /**
   * Called each frame. `weather` selects whether storms can strike lightning;
   * the flash is applied as a temporary boost to the scene lights plus a bolt.
   */
  update(deltaSeconds: number, weather: string, camera: Vector3, sunBase: number, hemiBase: number): void {
    this.elapsed += deltaSeconds;
    const storming = STORM_WEATHER.has(weather);

    // --- lightning -------------------------------------------------------
    if (storming && this.elapsed >= this.nextLightningAt) {
      this.nextLightningAt = this.elapsed + 6 + this.random() * 14;
      this.flashIntensity = 1.0;
      // Bolt somewhere in front of the camera, on/near the ground.
      const angle = this.random() * Math.PI * 2;
      const at = camera.add(new Vector3(Math.cos(angle) * (20 + this.random() * 40), 0, Math.sin(angle) * (20 + this.random() * 40)));
      this.spawnBolt(at);
    }
    // Decay the flash over a few frames.
    if (this.flashIntensity > 0) {
      this.flashIntensity = Math.max(0, this.flashIntensity - deltaSeconds * 3.2);
    }
    // Apply the flash as a light boost, easing back to the base.
    const boost = 1 + this.flashIntensity * 1.6;
    this.sun.intensity = sunBase * boost;
    this.hemi.intensity = hemiBase * boost;

    // Fade the bolt out.
    if (this.boltLife > 0) {
      this.boltLife -= deltaSeconds;
      if (this.boltLife <= 0) this.disposeBolt();
    }

    // --- meteors / comets ------------------------------------------------
    if (this.elapsed >= this.nextMeteorAt) {
      this.nextMeteorAt = this.elapsed + 25 + this.random() * 40;
      this.spawnMeteor(camera);
    }
  }

  dispose(): void {
    this.disposeBolt();
    this.meteorParticles?.dispose();
    this.meteorBurst?.dispose();
    this.meteorParticles = null;
    this.meteorBurst = null;
  }
}

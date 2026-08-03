/**
 * SevereWeather — 2.0 dramatic weather events.
 *
 * Adds the big sky-weather phenomena on top of the existing storm/meteor
 * system:
 *   - **Tornadoes**: a swirling funnel of debris that forms in the sky, has a
 *     strong wind pull on the player, and wanders across the world.
 *   - **Blizzards / ice storms**: heavy driven snow with a cold tint.
 *   - **Sandstorms**: fast horizontal sand streaks with a warm haze.
 *   - **Meteor showers**: periodic bright meteors streaking across the sky.
 *
 * Each event is a pooled particle system driven by a `SevereWeatherType`
 * supplied from the biome/profile, and an active tornado that pulls the camera.
 */
import {
  Color3, Color4, Mesh, MeshBuilder, ParticleSystem, PointLight, Scene,
  StandardMaterial, Vector3,
} from '@babylonjs/core';

export type SevereWeatherType = 'none' | 'tornado' | 'blizzard' | 'sandstorm' | 'meteorshower';

export interface SevereWeatherState {
  /** Tornado world position (null when none). */
  tornado?: { x: number; y: number; z: number };
  /** Horizontal pull force applied to the player by the active tornado. */
  pull?: Vector3;
}

export class SevereWeather {
  private tornadoMesh: Mesh | null = null;
  private tornadoLight: PointLight | null = null;
  private tornadoCenter: Vector3 | null = null;
  private debris: ParticleSystem | null = null;
  private snow: ParticleSystem | null = null;
  private sand: ParticleSystem | null = null;
  private meteor: ParticleSystem | null = null;
  private nextMeteorAt = 3;

  constructor(private readonly scene: Scene) {}

  /** Point a pooled particle system at a soft, tinted sprite. */
  private pool(color: Color4, size: number, count: number): ParticleSystem {
    const p = new ParticleSystem(`severe_${color.r}_${count}`, count, this.scene);
    p.minSize = size; p.maxSize = size * 2;
    p.minLifeTime = 1; p.maxLifeTime = 3;
    p.blendMode = ParticleSystem.BLENDMODE_ADD;
    p.color1 = color; p.color2 = color; p.colorDead = new Color4(color.r, color.g, color.b, 0);
    p.minEmitPower = 0; p.maxEmitPower = 0;
    p.emitRate = 0;
    p.direction1 = new Vector3(0, 0, 0); p.direction2 = new Vector3(0, 0, 0);
    return p;
  }

  private buildTornado(): void {
    if (this.tornadoMesh) return;
    // A tapered funnel: a cylinder tapering from wide top to narrow bottom.
    const path = [new Vector3(0, 0, 0), new Vector3(0, 30, 0)];
    this.tornadoMesh = MeshBuilder.CreateCylinder('severe_tornado', {
      height: 30, diameterTop: 3.2, diameterBottom: 1.0, tessellation: 16,
    }, this.scene);
    const mat = new StandardMaterial('severe_tornado_mat', this.scene);
    mat.emissiveColor = new Color3(0.6, 0.6, 0.62);
    mat.alpha = 0.5;
    mat.backFaceCulling = false;
    mat.diffuseColor = new Color3(0.3, 0.3, 0.32);
    this.tornadoMesh.material = mat;
    this.tornadoMesh.isPickable = false;
    this.tornadoLight = new PointLight('severe_tornado_light', Vector3.Zero(), this.scene);
    this.tornadoLight.diffuse = new Color3(0.4, 0.4, 0.5);
    this.tornadoLight.intensity = 0;
    this.tornadoLight.range = 60;
    void path;
  }

  /**
   * Set the active severe weather type and aim tornado/wind near the camera.
   * Returns the pull force applied to the player this frame.
   */
  update(deltaSeconds: number, type: SevereWeatherType, camera: Vector3): SevereWeatherState {
    const out: SevereWeatherState = {};

    if (type === 'tornado') {
      this.buildTornado();
      // Tornado wanders slowly and forms a few dozen blocks away.
      if (!this.tornadoCenter) {
        const angle = this.randomAngle();
        this.tornadoCenter = camera.add(new Vector3(Math.cos(angle) * 30, 0, Math.sin(angle) * 30));
      } else {
        // Slow drift.
        this.tornadoCenter.x += Math.sin(this.elapsed + 1) * 1.5 * deltaSeconds;
        this.tornadoCenter.z += Math.cos(this.elapsed + 2) * 1.5 * deltaSeconds;
        this.tornadoCenter.y = camera.y;
      }
      this.tornadoMesh!.position.copyFrom(this.tornadoCenter);
      this.tornadoMesh!.rotation.y += deltaSeconds * 3;
      this.tornadoMesh!.isVisible = true;
      if (this.tornadoLight) {
        this.tornadoLight.position.copyFrom(this.tornadoCenter);
        this.tornadoLight.intensity = 6;
      }
      // Wind pull: drag the player toward the funnel centre (but not too hard).
      const to = this.tornadoCenter.subtract(camera);
      to.y = 0;
      const dist = to.length();
      if (dist > 1 && dist < 40) {
        const pull = to.normalize().scale(Math.min(8, (40 - dist) * 0.25));
        out.pull = pull;
        out.tornado = { x: this.tornadoCenter.x, y: this.tornadoCenter.y, z: this.tornadoCenter.z };
      }
    } else {
      if (this.tornadoMesh) this.tornadoMesh.isVisible = false;
      if (this.tornadoLight) this.tornadoLight.intensity = 0;
    }

    // Ambient particle beds for blizzard / sandstorm / debris.
    this.ensurePools(type, camera);
    return out;
  }

  private elapsed = 0;
  private randomAngle(): number { return Math.random() * Math.PI * 2; }

  private ensurePools(type: SevereWeatherType, camera: Vector3): void {
    this.elapsed += 0.016;
    if (type === 'blizzard') {
      if (!this.snow) {
        this.snow = this.pool(new Color4(0.9, 0.95, 1, 0.9), 0.4, 400);
        this.snow.direction1 = new Vector3(-2, -6, -2);
        this.snow.direction2 = new Vector3(2, -4, 2);
        this.snow.minEmitPower = 1; this.snow.maxEmitPower = 2;
        this.snow.emitter = camera;
        this.snow.minEmitBox = new Vector3(-25, -2, -25);
        this.snow.maxEmitBox = new Vector3(25, 14, 25);
        this.snow.start();
      }
      this.snow.emitRate = 220;
      this.sand?.stop(); this.debris?.stop(); this.meteor?.stop();
    } else if (type === 'sandstorm') {
      if (!this.sand) {
        this.sand = this.pool(new Color4(0.85, 0.7, 0.4, 0.8), 0.5, 300);
        this.sand.direction1 = new Vector3(-14, -1, -4);
        this.sand.direction2 = new Vector3(-8, 1, 4);
        this.sand.minEmitPower = 1; this.sand.maxEmitPower = 3;
        this.sand.emitter = camera;
        this.sand.minEmitBox = new Vector3(-30, -3, -20);
        this.sand.maxEmitBox = new Vector3(20, 6, 20);
        this.sand.start();
      }
      this.sand.emitRate = 200;
      this.snow?.stop(); this.debris?.stop(); this.meteor?.stop();
    } else if (type === 'tornado') {
      if (!this.debris) {
        this.debris = this.pool(new Color4(0.6, 0.55, 0.45, 0.8), 0.4, 300);
        this.debris.emitter = this.tornadoCenter ?? camera;
        this.debris.minEmitBox = new Vector3(-6, 0, -6);
        this.debris.maxEmitBox = new Vector3(6, 26, 6);
        this.debris.start();
      }
      if (this.tornadoCenter) this.debris.emitter = this.tornadoCenter;
      this.debris.emitRate = 240;
      this.snow?.stop(); this.sand?.stop(); this.meteor?.stop();
    } else if (type === 'meteorshower') {
      if (!this.meteor) {
        this.meteor = this.pool(new Color4(1, 0.7, 0.3, 1), 0.8, 160);
        this.meteor.direction1 = new Vector3(-2, -8, -2);
        this.meteor.direction2 = new Vector3(2, -6, 2);
        this.meteor.minEmitPower = 1; this.meteor.maxEmitPower = 2;
        this.meteor.emitter = camera;
        this.meteor.minEmitBox = new Vector3(-30, 20, -30);
        this.meteor.maxEmitBox = new Vector3(30, 40, 30);
        this.meteor.start();
      }
      this.meteor.emitRate = this.elapsed >= this.nextMeteorAt ? 60 : 10;
      if (this.elapsed >= this.nextMeteorAt) this.nextMeteorAt = this.elapsed + 4 + Math.random() * 5;
      this.snow?.stop(); this.sand?.stop(); this.debris?.stop();
    } else {
      this.snow?.stop(); this.sand?.stop(); this.debris?.stop(); this.meteor?.stop();
    }
  }

  dispose(): void {
    this.snow?.dispose(); this.sand?.dispose(); this.debris?.dispose(); this.meteor?.dispose();
    this.tornadoMesh?.dispose(); this.tornadoLight?.dispose();
    this.snow = this.sand = this.debris = this.meteor = null;
    this.tornadoMesh = null; this.tornadoLight = null;
  }
}

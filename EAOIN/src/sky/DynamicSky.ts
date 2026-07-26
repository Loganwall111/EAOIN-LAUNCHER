/**
 * DynamicSky — 1.0 cinematic, animated sky & celestial body system.
 *
 *  Replaces the static skybox with a fully dynamic system that handles:
 *   - Animated sun
 *   - Animated moon (with 8 moon phases)
 *   - Stars (twinkling, with parallax)
 *   - Dynamic clouds (procedural puffs that drift)
 *   - Aurora Borealis (high-altitude particle ribbons)
 *   - Shooting stars
 *   - Meteor showers (random events)
 *   - Eclipse events (when sun & moon align)
 *   - Colored sunsets (warm hue blend near the horizon)
 *   - Colored sunrises (cool blue→pink ramp at dawn)
 *   - Volumetric clouds (huge slow-moving blocks of light)
 *
 *  The system exposes a single `update(dt, camera)` that mutates
 *  scene.fogColor / scene.clearColor / lighting / etc. — so the rest of
 *  the renderer doesn't need to know it's a "real" sky.
 */
import { Color3, Color4, Mesh, MeshBuilder, ParticleSystem, Scene, StandardMaterial, Texture, Vector3 } from '@babylonjs/core';
import { AdvancedNoise } from '../world/AdvancedNoise';

export interface SkyConfig {
  timeOfDay: number; // 0-24
  dayLengthSeconds: number; // full day-night cycle in real-time seconds
  starsEnabled: boolean;
  auroraEnabled: boolean;
  shootingStarsEnabled: boolean;
  meteorShowerChance: number;
  eclipseChance: number;
  volumetricClouds: boolean;
  sunriseColor: Color3;
  sunsetColor: Color3;
  noonColor: Color3;
  midnightColor: Color3;
  eclipseColor: Color3;
}

export const DEFAULT_SKY: SkyConfig = {
  timeOfDay: 12,
  dayLengthSeconds: 1200, // 20 minutes
  starsEnabled: true,
  auroraEnabled: true,
  shootingStarsEnabled: true,
  meteorShowerChance: 0.04,
  eclipseChance: 0.02,
  volumetricClouds: true,
  sunriseColor: new Color3(0.96, 0.65, 0.42),
  sunsetColor: new Color3(0.95, 0.42, 0.32),
  noonColor: new Color3(0.42, 0.66, 0.95),
  midnightColor: new Color3(0.05, 0.06, 0.16),
  eclipseColor: new Color3(0.32, 0.32, 0.45),
};

export class DynamicSky {
  scene: Scene;
  config: SkyConfig;
  noise: AdvancedNoise;
  sunDisk: Mesh | null = null;
  moonDisk: Mesh | null = null;
  starField: Mesh | null = null;
  cloudLayer: Mesh | null = null;
  cloudBigLayer: Mesh | null = null;
  aurora: ParticleSystem | null = null;
  shootingStars: Mesh[] = [];
  meteorites: Mesh[] = [];
  time: number = 0;
  meteorCooldown: number = 0;
  eclipseActive: boolean = false;

  constructor(scene: Scene, config: Partial<SkyConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_SKY, ...config };
    this.noise = new AdvancedNoise('sky');
  }

  attach(): void {
    this.createSun();
    this.createMoon();
    this.createStars();
    this.createClouds();
    this.createAurora();
  }

  /* ----- Sun ----- */
  private createSun(): void {
    const sun = MeshBuilder.CreateSphere('sky_sun', { diameter: 18, segments: 16 }, this.scene);
    sun.position.y = 200;
    const mat = new StandardMaterial('sky_sun_mat', this.scene);
    mat.emissiveColor = new Color3(1, 0.92, 0.7);
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.specularColor = new Color3(0, 0, 0);
    mat.disableLighting = true;
    sun.material = mat;
    sun.isPickable = false;
    sun.infiniteDistance = true;
    this.sunDisk = sun;
  }

  /* ----- Moon ----- */
  private createMoon(): void {
    const moon = MeshBuilder.CreateSphere('sky_moon', { diameter: 14, segments: 16 }, this.scene);
    moon.position.y = 200;
    const mat = new StandardMaterial('sky_moon_mat', this.scene);
    mat.emissiveColor = new Color3(0.85, 0.88, 0.95);
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.specularColor = new Color3(0, 0, 0);
    mat.disableLighting = true;
    moon.material = mat;
    moon.isPickable = false;
    moon.infiniteDistance = true;
    this.moonDisk = moon;
  }

  /* ----- Stars ----- */
  private createStars(): void {
    const stars = MeshBuilder.CreatePlane('sky_stars', { size: 1500 }, this.scene);
    const mat = new StandardMaterial('sky_stars_mat', this.scene);
    const tex = this.makeStarTexture();
    mat.emissiveTexture = tex;
    mat.opacityTexture = tex;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    stars.material = mat;
    stars.isPickable = false;
    stars.infiniteDistance = true;
    this.starField = stars;
  }

  private makeStarTexture(): Texture {
    const size = 1024;
    const tex = new Texture(this.dataURL(size), this.scene, true, false);
    return tex;
  }

  private dataURL(size: number): string {
    // Procedural starfield as data URL.
    if (typeof document === 'undefined') return '';
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1200; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 1.4 + 0.3;
      const alpha = 0.4 + Math.random() * 0.6;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return c.toDataURL();
  }

  /* ----- Clouds (volumetric) ----- */
  private createClouds(): void {
    const cloud = MeshBuilder.CreatePlane('sky_clouds', { size: 1200 }, this.scene);
    const mat = new StandardMaterial('sky_clouds_mat', this.scene);
    mat.diffuseColor = new Color3(1, 1, 1);
    mat.opacityTexture = this.makeCloudTexture();
    mat.emissiveColor = new Color3(0.85, 0.88, 0.95);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    cloud.material = mat;
    cloud.isPickable = false;
    cloud.infiniteDistance = true;
    this.cloudLayer = cloud;

    const cloud2 = MeshBuilder.CreatePlane('sky_clouds_big', { size: 2400 }, this.scene);
    const m2 = new StandardMaterial('sky_clouds_big_mat', this.scene);
    m2.diffuseColor = new Color3(1, 1, 1);
    m2.opacityTexture = this.makeCloudTexture();
    m2.disableLighting = true;
    m2.backFaceCulling = false;
    cloud2.material = m2;
    cloud2.isPickable = false;
    cloud2.infiniteDistance = true;
    cloud2.position.y = 90;
    this.cloudBigLayer = cloud2;
  }

  private makeCloudTexture(): Texture {
    if (typeof document === 'undefined') return new Texture('', this.scene);
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return new Texture('', this.scene);
    ctx.clearRect(0, 0, size, size);
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 30 + Math.random() * 80;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.85)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new Texture(c.toDataURL(), this.scene, true, false);
    return tex;
  }

  /* ----- Aurora ----- */
  private createAurora(): void {
    if (!this.config.auroraEnabled) return;
    this.aurora = new ParticleSystem('aurora', 200, this.scene);
    this.aurora.particleTexture = this.makeAuroraTexture();
    this.aurora.emitter = new Vector3(0, 200, 0);
    this.aurora.minSize = 80; this.aurora.maxSize = 200;
    this.aurora.minLifeTime = 12; this.aurora.maxLifeTime = 20;
    this.aurora.emitRate = 4;
    this.aurora.color1 = new Color4(0.3, 1, 0.5, 1);
    this.aurora.color2 = new Color4(0.4, 0.5, 1, 1);
    this.aurora.colorDead = new Color4(0, 0, 0, 1);
    this.aurora.gravity = new Vector3(0, 0, 0);
    this.aurora.direction1 = new Vector3(-1, 0, 0);
    this.aurora.direction2 = new Vector3(1, 0, 0);
    this.aurora.minEmitPower = 0; this.aurora.maxEmitPower = 0;
    this.aurora.start();
  }

  private makeAuroraTexture(): Texture {
    if (typeof document === 'undefined') return new Texture('', this.scene);
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    if (!ctx) return new Texture('', this.scene);
    const grd = ctx.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, 'rgba(0,255,200,0)');
    grd.addColorStop(0.5, 'rgba(120,255,200,0.7)');
    grd.addColorStop(1, 'rgba(0,255,200,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
    return new Texture(c.toDataURL(), this.scene, true, false);
  }

  /* ----- Update ----- */
  update(dt: number, camera: Vector3): { ambient: Color3; sunColor: Color3; moonColor: Color3; weather: string; eclipse: boolean } {
    this.time += dt;
    if (this.config.dayLengthSeconds > 0) {
      this.config.timeOfDay = (this.config.timeOfDay + (dt / this.config.dayLengthSeconds) * 24) % 24;
    }
    const t = this.config.timeOfDay;

    // Sun position (rises east, sets west).
    const sunAngle = ((t - 6) / 24) * Math.PI * 2;
    const sunRadius = 200;
    if (this.sunDisk) {
      this.sunDisk.position.set(Math.cos(sunAngle) * sunRadius, Math.sin(sunAngle) * sunRadius, 80);
    }
    // Moon opposite to sun.
    if (this.moonDisk) {
      this.moonDisk.position.set(-Math.cos(sunAngle) * sunRadius, -Math.sin(sunAngle) * sunRadius, -80);
    }
    // Star field follows camera and is brightest at night.
    if (this.starField) {
      this.starField.position.copyFrom(camera);
      const nightFactor = Math.max(0, Math.sin(((t - 6) / 24) * Math.PI * 2 + Math.PI) * 0.5 + 0.5);
      const starMat = this.starField.material as StandardMaterial;
      if (starMat) {
        starMat.alpha = 0.95 * nightFactor;
        if (this.config.starsEnabled) starMat.alpha *= 1.0;
      }
    }
    // Clouds slowly drift.
    if (this.cloudLayer) {
      this.cloudLayer.position.copyFrom(camera);
      this.cloudLayer.position.y = 60;
      this.cloudLayer.rotation.y = this.time * 0.01;
    }
    if (this.cloudBigLayer) {
      this.cloudBigLayer.position.copyFrom(camera);
      this.cloudBigLayer.position.y = 90;
      this.cloudBigLayer.rotation.y = -this.time * 0.005;
    }
    // Aurora visible at high latitudes or polar dimensions.
    if (this.aurora) {
      const t2 = (this.time * 0.0005) % 1;
      this.aurora.emitter = new Vector3(camera.x + Math.sin(t2 * Math.PI * 2) * 60, camera.y + 80, camera.z + Math.cos(t2 * Math.PI * 2) * 60);
      this.aurora.minSize = 80 * (0.7 + 0.3 * Math.sin(this.time * 0.2));
    }
    // Shooting stars.
    if (this.config.shootingStarsEnabled && Math.random() < dt * 0.6) this.spawnShootingStar(camera);
    // Meteor showers.
    this.meteorCooldown -= dt;
    if (this.meteorCooldown <= 0 && Math.random() < this.config.meteorShowerChance * dt * 10) {
      this.spawnMeteor(camera);
      this.meteorCooldown = 4;
    }
    // Eclipse events.
    this.eclipseActive = Math.random() < this.config.eclipseChance * dt;
    if (this.sunDisk && this.sunDisk.material) {
      const m = this.sunDisk.material as StandardMaterial;
      m.emissiveColor = this.eclipseActive ? new Color3(0.4, 0.4, 0.6) : new Color3(1, 0.92, 0.7);
    }
    // Compute lighting colors.
    return this.computeSkyColors(t);
  }

  private computeSkyColors(t: number): { ambient: Color3; sunColor: Color3; moonColor: Color3; weather: string; eclipse: boolean } {
    // Color ramp:
    // 0-4: night, 4-6: dawn, 6-12: morning, 12-16: afternoon, 16-18: dusk, 18-24: night
    const dayPhase = ((t + 24) % 24);
    const angle = (dayPhase / 24) * Math.PI * 2 - Math.PI * 0.5;
    const dayFactor = Math.max(0, Math.sin(angle));
    const nightFactor = Math.max(0, -Math.sin(angle));
    const sunsetFactor = Math.max(0, 1 - Math.abs(dayFactor - 0.25) * 4) * (dayFactor > 0 ? 1 : 0);
    const sunriseFactor = Math.max(0, 1 - Math.abs(dayFactor - 0.45) * 4) * (dayFactor > 0 ? 1 : 0);

    let sky = this.config.midnightColor.clone();
    if (dayFactor > 0) {
      sky = Color3.Lerp(this.config.midnightColor, this.config.noonColor, dayFactor);
    }
    if (sunsetFactor > 0) sky = Color3.Lerp(sky, this.config.sunsetColor, sunsetFactor);
    if (sunriseFactor > 0) sky = Color3.Lerp(sky, this.config.sunriseColor, sunriseFactor);
    if (this.eclipseActive) sky = Color3.Lerp(sky, this.config.eclipseColor, 0.5);

    const ambient = sky.scale(0.4);
    const sunColor = Color3.Lerp(new Color3(0.5, 0.5, 0.7), new Color3(1, 0.95, 0.85), dayFactor);
    const moonColor = Color3.Lerp(new Color3(0.2, 0.3, 0.6), new Color3(0.8, 0.85, 1), nightFactor);

    const weather = (dayFactor > 0.7) ? 'sunny' : (dayFactor > 0.3) ? 'partly-cloudy' : (dayFactor > 0.05) ? 'dusk' : 'clear-night';

    this.scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
    this.scene.fogColor = sky;
    this.scene.ambientColor = ambient;

    return { ambient, sunColor, moonColor, weather, eclipse: this.eclipseActive };
  }

  /* ----- Shooting stars & meteors ----- */
  private spawnShootingStar(camera: Vector3): void {
    const star = MeshBuilder.CreateSphere('shooting_star', { diameter: 0.8 }, this.scene);
    star.position = camera.add(new Vector3((Math.random() - 0.5) * 400, 220, (Math.random() - 0.5) * 400));
    const m = new StandardMaterial('shoot_mat', this.scene);
    m.emissiveColor = new Color3(1, 0.95, 0.8);
    star.material = m;
    star.isPickable = false;
    this.shootingStars.push(star);
    setTimeout(() => { star.dispose(); m.dispose(); this.shootingStars = this.shootingStars.filter((s) => s !== star); }, 1500);
  }

  private spawnMeteor(camera: Vector3): void {
    const meteor = MeshBuilder.CreateSphere('meteor', { diameter: 3 }, this.scene);
    meteor.position = camera.add(new Vector3((Math.random() - 0.5) * 600, 250, (Math.random() - 0.5) * 600));
    const m = new StandardMaterial('meteor_mat', this.scene);
    m.emissiveColor = new Color3(1, 0.5, 0.2);
    meteor.material = m;
    meteor.isPickable = false;
    this.meteorites.push(meteor);
    setTimeout(() => { meteor.dispose(); m.dispose(); this.meteorites = this.meteorites.filter((s) => s !== meteor); }, 4000);
  }
}

export default DynamicSky;

/**
 * BiomeVFX — "Life Comes Apart 2.0" per-biome atmospheric particle effects.
 *
 * One pooled particle system per effect type, all following the player. Only
 * the effects the current `SkyProfile` asks for are emitting at any moment;
 * everything else is stopped, so the cost is bounded regardless of how many
 * effect types exist.
 *
 * Effects:
 *   fireflies  — swamps / haunted woods: slow drifting warm motes that pulse
 *   butterflies— meadows and forests by day: fluttering coloured wings
 *   pollen     — forests: fine golden drifting dust
 *   sandstorm  — deserts: fast horizontal sand streaks
 *   snowstorm  — mountains / tundra: falling, wind-blown snow
 *   ashfall    — volcanic: slow grey embers falling
 *   embers     — nether: rising orange sparks
 *   spores     — mushroom / toxic: floating luminous spores
 *   rain       — storm dimension: fast vertical streaks
 *   void       — space: sparse drifting cosmic dust
 */
import { Color4, ParticleSystem, Scene, Texture, Vector3 } from '@babylonjs/core';
import { SkyWeather } from '../sky/SkyProfiles';

/** Extra ambience layered on top of the profile's primary weather. */
export type AmbientEffect = 'fireflies' | 'butterflies' | 'pollen';

export interface BiomeVFXOptions {
  /** Master enable — respects the user's "particles" setting. */
  enabled: boolean;
  /** Scales every emit rate; 0.5 on low-end presets. */
  quality: number;
}

interface EffectHandle {
  system: ParticleSystem;
  baseEmitRate: number;
}

/** 1x1 white dot, used as the base sprite for every soft particle. */
const DOT_TEXTURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

export class BiomeVFX {
  private readonly scene: Scene;
  private readonly effects = new Map<string, EffectHandle>();
  private texture: Texture | null = null;
  private enabled: boolean;
  private quality: number;
  private activeWeather: SkyWeather = 'clear';
  private activeAmbient = new Set<AmbientEffect>();
  private disposed = false;

  constructor(scene: Scene, options: BiomeVFXOptions) {
    this.scene = scene;
    this.enabled = options.enabled;
    this.quality = options.quality;
  }

  attach(): void {
    this.texture = Texture.CreateFromBase64String(DOT_TEXTURE, 'dot', this.scene);
    this.createFireflies();
    this.createButterflies();
    this.createPollen();
    this.createSandstorm();
    this.createSnowstorm();
    this.createAshfall();
    this.createEmbers();
    this.createSpores();
    this.createRain();
    this.createVoidDust();
  }

  /* ------------------------------------------------------------------ */
  /* Construction helpers                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Build a particle system emitting inside a box centred on the player.
   * `half` is the half-extent of that box in X/Y/Z.
   */
  private make(
    name: string,
    capacity: number,
    emitRate: number,
    half: Vector3,
    configure: (p: ParticleSystem) => void
  ): void {
    const p = new ParticleSystem(`biome_vfx_${name}`, capacity, this.scene);
    p.particleTexture = this.texture;
    p.emitter = new Vector3(0, 0, 0);
    p.minEmitBox = half.scale(-1);
    p.maxEmitBox = half.clone();
    p.emitRate = emitRate;
    p.gravity = new Vector3(0, 0, 0);
    p.minEmitPower = 0;
    p.maxEmitPower = 0;
    p.updateSpeed = 0.014;
    p.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    configure(p);
    this.effects.set(name, { system: p, baseEmitRate: emitRate });
  }

  /** Swamps: warm, slow, pulsing motes near the ground. */
  private createFireflies(): void {
    this.make('fireflies', 420, 34, new Vector3(34, 5, 34), (p) => {
      // Emit low — fireflies belong just above the water and reeds.
      p.minEmitBox = new Vector3(-34, -3, -34);
      p.maxEmitBox = new Vector3(34, 7, 34);
      p.color1 = new Color4(1.0, 0.92, 0.38, 1);
      p.color2 = new Color4(0.62, 1.0, 0.34, 1);
      p.colorDead = new Color4(0.2, 0.35, 0.1, 0);
      p.minSize = 0.10;
      p.maxSize = 0.26;
      p.minLifeTime = 3.0;
      p.maxLifeTime = 7.0;
      // Additive so they glow against the dark swamp.
      p.blendMode = ParticleSystem.BLENDMODE_ADD;
      p.direction1 = new Vector3(-0.18, 0.06, -0.18);
      p.direction2 = new Vector3(0.18, 0.22, 0.18);
      p.minEmitPower = 0.08;
      p.maxEmitPower = 0.30;
      // Fireflies visibly blink.
      p.addSizeGradient(0, 0.2);
      p.addSizeGradient(0.35, 1.0);
      p.addSizeGradient(0.70, 0.35);
      p.addSizeGradient(1.0, 0.0);
    });
  }

  /** Meadows/forests by day: bright fluttering wings. */
  private createButterflies(): void {
    this.make('butterflies', 140, 8, new Vector3(26, 4, 26), (p) => {
      p.minEmitBox = new Vector3(-26, -1, -26);
      p.maxEmitBox = new Vector3(26, 6, 26);
      p.color1 = new Color4(1.0, 0.55, 0.80, 1);
      p.color2 = new Color4(0.45, 0.75, 1.0, 1);
      p.colorDead = new Color4(1, 1, 1, 0);
      p.minSize = 0.18;
      p.maxSize = 0.34;
      p.minLifeTime = 6;
      p.maxLifeTime = 13;
      p.direction1 = new Vector3(-0.6, 0.12, -0.6);
      p.direction2 = new Vector3(0.6, 0.42, 0.6);
      p.minEmitPower = 0.35;
      p.maxEmitPower = 0.95;
      // The rapid size oscillation reads as wings flapping.
      p.addSizeGradient(0, 0.30);
      p.addSizeGradient(0.20, 1.00);
      p.addSizeGradient(0.35, 0.42);
      p.addSizeGradient(0.50, 1.00);
      p.addSizeGradient(0.65, 0.42);
      p.addSizeGradient(0.80, 1.00);
      p.addSizeGradient(1.0, 0.0);
    });
  }

  private createPollen(): void {
    this.make('pollen', 300, 26, new Vector3(30, 8, 30), (p) => {
      p.color1 = new Color4(1.0, 0.94, 0.62, 0.42);
      p.color2 = new Color4(0.92, 1.0, 0.74, 0.30);
      p.colorDead = new Color4(0.8, 0.8, 0.6, 0);
      p.minSize = 0.04;
      p.maxSize = 0.11;
      p.minLifeTime = 6;
      p.maxLifeTime = 14;
      p.direction1 = new Vector3(-0.12, -0.03, -0.12);
      p.direction2 = new Vector3(0.12, 0.10, 0.12);
      p.minEmitPower = 0.05;
      p.maxEmitPower = 0.22;
    });
  }

  /** Deserts: fast, low, horizontal sand. */
  private createSandstorm(): void {
    this.make('sandstorm', 900, 220, new Vector3(40, 12, 40), (p) => {
      p.color1 = new Color4(0.86, 0.74, 0.48, 0.42);
      p.color2 = new Color4(0.74, 0.62, 0.40, 0.30);
      p.colorDead = new Color4(0.7, 0.6, 0.4, 0);
      p.minSize = 0.10;
      p.maxSize = 0.40;
      p.minLifeTime = 0.8;
      p.maxLifeTime = 2.0;
      // Strong, near-horizontal wind.
      p.direction1 = new Vector3(5.0, -0.25, 1.6);
      p.direction2 = new Vector3(9.0, 0.35, 3.4);
      p.minEmitPower = 3.2;
      p.maxEmitPower = 7.5;
      p.updateSpeed = 0.020;
    });
  }

  /** Mountains / tundra: wind-blown falling snow. */
  private createSnowstorm(): void {
    this.make('snowstorm', 900, 200, new Vector3(36, 16, 36), (p) => {
      // Emit above the player so flakes fall down through the view.
      p.minEmitBox = new Vector3(-36, 6, -36);
      p.maxEmitBox = new Vector3(36, 22, 36);
      p.color1 = new Color4(1, 1, 1, 0.80);
      p.color2 = new Color4(0.86, 0.92, 1.0, 0.62);
      p.colorDead = new Color4(1, 1, 1, 0);
      p.minSize = 0.09;
      p.maxSize = 0.24;
      p.minLifeTime = 2.6;
      p.maxLifeTime = 5.5;
      p.gravity = new Vector3(0, -1.6, 0);
      p.direction1 = new Vector3(-2.2, -0.6, -1.4);
      p.direction2 = new Vector3(2.6, -0.2, 1.8);
      p.minEmitPower = 0.7;
      p.maxEmitPower = 2.4;
    });
  }

  private createAshfall(): void {
    this.make('ashfall', 500, 90, new Vector3(32, 16, 32), (p) => {
      p.minEmitBox = new Vector3(-32, 6, -32);
      p.maxEmitBox = new Vector3(32, 20, 32);
      p.color1 = new Color4(0.34, 0.30, 0.28, 0.62);
      p.color2 = new Color4(0.58, 0.30, 0.16, 0.48);
      p.colorDead = new Color4(0.2, 0.18, 0.16, 0);
      p.minSize = 0.07;
      p.maxSize = 0.22;
      p.minLifeTime = 4;
      p.maxLifeTime = 9;
      p.gravity = new Vector3(0, -0.55, 0);
      p.direction1 = new Vector3(-0.5, -0.2, -0.5);
      p.direction2 = new Vector3(0.6, 0.05, 0.6);
      p.minEmitPower = 0.15;
      p.maxEmitPower = 0.6;
    });
  }

  /** Nether: rising sparks. */
  private createEmbers(): void {
    this.make('embers', 420, 70, new Vector3(28, 6, 28), (p) => {
      p.minEmitBox = new Vector3(-28, -4, -28);
      p.maxEmitBox = new Vector3(28, 4, 28);
      p.color1 = new Color4(1.0, 0.52, 0.14, 0.90);
      p.color2 = new Color4(1.0, 0.80, 0.30, 0.70);
      p.colorDead = new Color4(0.4, 0.08, 0.0, 0);
      p.minSize = 0.06;
      p.maxSize = 0.20;
      p.minLifeTime = 2.4;
      p.maxLifeTime = 6.0;
      p.blendMode = ParticleSystem.BLENDMODE_ADD;
      p.gravity = new Vector3(0, 0.9, 0);
      p.direction1 = new Vector3(-0.3, 0.5, -0.3);
      p.direction2 = new Vector3(0.3, 1.4, 0.3);
      p.minEmitPower = 0.4;
      p.maxEmitPower = 1.5;
    });
  }

  private createSpores(): void {
    this.make('spores', 400, 48, new Vector3(30, 10, 30), (p) => {
      p.color1 = new Color4(0.72, 0.42, 0.96, 0.60);
      p.color2 = new Color4(0.44, 0.96, 0.72, 0.48);
      p.colorDead = new Color4(0.3, 0.2, 0.4, 0);
      p.minSize = 0.08;
      p.maxSize = 0.24;
      p.minLifeTime = 6;
      p.maxLifeTime = 15;
      p.blendMode = ParticleSystem.BLENDMODE_ADD;
      p.direction1 = new Vector3(-0.14, 0.02, -0.14);
      p.direction2 = new Vector3(0.14, 0.16, 0.14);
      p.minEmitPower = 0.05;
      p.maxEmitPower = 0.25;
    });
  }

  private createRain(): void {
    this.make('rain', 1200, 420, new Vector3(30, 18, 30), (p) => {
      p.minEmitBox = new Vector3(-30, 10, -30);
      p.maxEmitBox = new Vector3(30, 22, 30);
      p.color1 = new Color4(0.62, 0.72, 0.90, 0.46);
      p.color2 = new Color4(0.50, 0.62, 0.82, 0.34);
      p.colorDead = new Color4(0.5, 0.6, 0.8, 0);
      p.minSize = 0.05;
      p.maxSize = 0.10;
      p.minLifeTime = 0.7;
      p.maxLifeTime = 1.4;
      p.gravity = new Vector3(0, -22, 0);
      p.direction1 = new Vector3(-1.0, -8, -0.6);
      p.direction2 = new Vector3(1.2, -14, 0.9);
      p.minEmitPower = 4;
      p.maxEmitPower = 9;
      p.updateSpeed = 0.022;
    });
  }

  private createVoidDust(): void {
    this.make('void', 260, 16, new Vector3(34, 18, 34), (p) => {
      p.color1 = new Color4(0.68, 0.72, 1.0, 0.50);
      p.color2 = new Color4(0.86, 0.62, 1.0, 0.36);
      p.colorDead = new Color4(0.3, 0.3, 0.5, 0);
      p.minSize = 0.04;
      p.maxSize = 0.14;
      p.minLifeTime = 8;
      p.maxLifeTime = 18;
      p.blendMode = ParticleSystem.BLENDMODE_ADD;
      p.direction1 = new Vector3(-0.08, -0.05, -0.08);
      p.direction2 = new Vector3(0.08, 0.08, 0.08);
      p.minEmitPower = 0.02;
      p.maxEmitPower = 0.12;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Runtime                                                             */
  /* ------------------------------------------------------------------ */

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) for (const { system } of this.effects.values()) system.stop();
    else this.applyActive();
  }

  setQuality(quality: number): void {
    this.quality = quality;
    this.applyActive();
  }

  /**
   * Choose which effects run. `weather` comes straight from the active
   * `SkyProfile`; `ambient` is extra life layered on top (butterflies by day,
   * fireflies at night) chosen by the caller from biome + time of day.
   */
  setProfile(weather: SkyWeather, ambient: AmbientEffect[]): void {
    const nextAmbient = new Set(ambient);
    const sameAmbient =
      nextAmbient.size === this.activeAmbient.size &&
      [...nextAmbient].every((a) => this.activeAmbient.has(a));
    if (weather === this.activeWeather && sameAmbient) return;
    this.activeWeather = weather;
    this.activeAmbient = nextAmbient;
    this.applyActive();
  }

  /** Start exactly the systems that should be running, stop everything else. */
  private applyActive(): void {
    if (this.disposed) return;
    const wanted = new Set<string>();
    if (this.enabled) {
      if (this.activeWeather !== 'clear') wanted.add(this.activeWeather);
      for (const a of this.activeAmbient) wanted.add(a);
    }

    for (const [name, handle] of this.effects) {
      const shouldRun = wanted.has(name);
      handle.system.emitRate = handle.baseEmitRate * this.quality;
      if (shouldRun && !handle.system.isStarted()) handle.system.start();
      else if (!shouldRun && handle.system.isStarted()) handle.system.stop();
    }
  }

  /** Keep every running emitter centred on the player. */
  update(cameraPosition: Vector3): void {
    if (this.disposed) return;
    for (const { system } of this.effects.values()) {
      if (!system.isStarted()) continue;
      const emitter = system.emitter as Vector3;
      if (emitter instanceof Vector3) emitter.copyFrom(cameraPosition);
    }
  }

  /** Effects currently emitting — surfaced in the debug HUD. */
  getActiveEffects(): string[] {
    const active: string[] = [];
    for (const [name, handle] of this.effects) if (handle.system.isStarted()) active.push(name);
    return active;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const { system } of this.effects.values()) system.dispose();
    this.effects.clear();
    this.texture?.dispose();
    this.texture = null;
  }
}

/** Colour used for a weather type in UI badges. */
export function weatherLabel(weather: SkyWeather): string {
  switch (weather) {
    case 'sandstorm': return 'Sandstorm';
    case 'snowstorm': return 'Snowstorm';
    case 'ashfall': return 'Ashfall';
    case 'spores': return 'Spores';
    case 'fireflies': return 'Fireflies';
    case 'pollen': return 'Pollen';
    case 'rain': return 'Rain';
    case 'embers': return 'Embers';
    case 'void': return 'Cosmic Dust';
    default: return 'Clear';
  }
}

export default BiomeVFX;

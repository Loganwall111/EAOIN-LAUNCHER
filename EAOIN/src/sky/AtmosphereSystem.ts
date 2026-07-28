/**
 * AtmosphereSystem — the single owner of the sky in "Life Comes Apart 2.0".
 *
 * ## Why this exists
 *
 * The sky used to be drawn by four systems that did not know about each other:
 *
 *   | System                | Wrote                                        |
 *   |-----------------------|----------------------------------------------|
 *   | `SceneLighting`       | 2 nested infinite-distance domes, flat colour |
 *   | `updateWorldLighting` | `clearColor`, `fogColor`, sun/moon discs      |
 *   | `DynamicSky`          | `clearColor`, `fogColor`, cloud/star planes   |
 *   | `CloudRuntime`        | a third cloud layer                           |
 *
 * Two of them fought over `scene.clearColor` every single frame with different
 * formulas, while the dome you actually saw overhead was painted by a third.
 * The result was a flat blue fill that flashed as you pitched the camera up and
 * disagreed with the fog at the horizon.
 *
 * `AtmosphereSystem` collapses all of that into one pipeline with one writer:
 *
 *   profile (biome/dimension)
 *     └─> SkyDome        — gradient background, owns clearColor + fogColor
 *     └─> CelestialBodies— cube sun/moon, ringed planet, black hole, comets
 *     └─> StarField      — stars, aurora, shooting stars
 *     └─> VolumetricClouds — big clustered cloud masses
 *     └─> BiomeVFX       — fireflies / sandstorm / snowstorm / …
 *
 * Nothing else in the engine may write `scene.clearColor` or `scene.fogColor`.
 */
import { Color3, Scene, Vector3 } from '@babylonjs/core';
import { BiomeVFX, AmbientEffect } from '../effects/BiomeVFX';
import { CelestialBodies } from './CelestialBodies';
import { SkyDome } from './SkyDome';
import {
  getSkyProfileForBiome,
  getSkyProfileForDimension,
  lerpSkyProfile,
  OVERWORLD_SKY,
  SkyProfile,
  SkyWeather,
} from './SkyProfiles';
import { StarField } from './StarField';
import { VolumetricClouds } from './VolumetricClouds';

export interface AtmosphereOptions {
  seed: string;
  /** Full day/night cycle length in real seconds. 1200 = 20 minutes. */
  dayLengthSeconds: number;
  /** Respects the user's particles setting. */
  particlesEnabled: boolean;
  /** Scales particle emit rates on lower presets. */
  particleQuality: number;
}

export interface AtmosphereFrame {
  timeOfDay: number;
  dayFactor: number;
  nightFactor: number;
  /** Peaks at dawn and dusk — drives sunset colouring. */
  horizonFactor: number;
  /** Direction the sunlight travels, for the directional light. */
  sunDirection: Vector3;
  /** Tinted sun colour for the directional light. */
  sunColor: Color3;
  /** Scene ambient for this frame. */
  ambient: Color3;
  profile: SkyProfile;
  /** True while the sky is bright enough to be considered daytime. */
  isDay: boolean;
}

/**
 * Darkest the world's ambient light is ever allowed to get.
 *
 * Tuned so a moonlit field reads as dim blue and a cave interior stays
 * navigable, rather than resolving to pure black.
 */
const MIN_AMBIENT = { r: 0.40, g: 0.44, b: 0.52 };

export class AtmosphereSystem {
  private readonly scene: Scene;
  private readonly options: AtmosphereOptions;

  readonly dome: SkyDome;
  readonly celestial: CelestialBodies;
  readonly stars: StarField;
  readonly clouds: VolumetricClouds;
  readonly vfx: BiomeVFX;

  /** 0-24 world clock. */
  timeOfDay = 8;
  /** Frozen by `/time freeze`. */
  frozen = false;

  /** Profile we are blending away from. */
  private fromProfile: SkyProfile = OVERWORLD_SKY;
  /** Profile we are blending toward. */
  private toProfile: SkyProfile = OVERWORLD_SKY;
  /** 0-1 blend position between the two. */
  private blend = 1;
  /** Currently interpolated profile — what everything actually reads. */
  private current: SkyProfile = OVERWORLD_SKY;
  /** Set by `/weather`; overrides the biome profile's own weather. */
  private weatherOverride: SkyWeather | null = null;
  private elapsed = 0;
  private disposed = false;

  constructor(scene: Scene, options: AtmosphereOptions) {
    this.scene = scene;
    this.options = options;

    this.dome = new SkyDome(scene);
    this.celestial = new CelestialBodies(scene);
    this.stars = new StarField(scene, options.seed);
    this.clouds = new VolumetricClouds(scene, options.seed, {
      coverage: OVERWORLD_SKY.cloudCoverage,
      tint: OVERWORLD_SKY.cloudTint,
      windSpeed: 3.4,
    });
    this.vfx = new BiomeVFX(scene, {
      enabled: options.particlesEnabled,
      quality: options.particleQuality,
    });
  }

  attach(): void {
    this.dome.attach();
    this.celestial.attach();
    this.stars.attach();
    this.clouds.attach();
    this.vfx.attach();
    // Exponential-squared fog; density is driven per-frame from the profile.
    this.scene.fogMode = Scene.FOGMODE_EXP2;
  }

  /* ------------------------------------------------------------------ */
  /* Profile switching                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Request the atmosphere for a biome. Cross-fades rather than snapping, so
   * walking from forest into swamp eases the fog and colour over ~2 seconds.
   */
  setBiome(biomeId: string, category?: string): void {
    this.transitionTo(getSkyProfileForBiome(biomeId, category));
  }

  /** Request the atmosphere for a dimension. */
  setDimension(dimensionId: string): void {
    this.transitionTo(getSkyProfileForDimension(dimensionId));
  }

  private transitionTo(next: SkyProfile): void {
    if (next.id === this.toProfile.id) return;
    // Start the new blend from wherever we currently are, so rapid biome
    // changes never cause a visible jump.
    this.fromProfile = this.current;
    this.toProfile = next;
    this.blend = 0;
  }

  getProfile(): SkyProfile {
    return this.weatherOverride
      ? { ...this.current, weather: this.weatherOverride }
      : this.current;
  }

  /**
   * Force a weather type, as `/weather` does. Pass `'clear'` or `null` to hand
   * control back to the biome's own profile.
   */
  setWeatherOverride(weather: string | null): void {
    if (!weather || weather === 'clear') { this.weatherOverride = null; return; }
    // `/weather` accepts friendly names; map them onto real sky weather.
    const alias: Record<string, SkyWeather> = {
      rain: 'rain', storm: 'rain', snow: 'snowstorm', snowstorm: 'snowstorm',
      sand: 'sandstorm', sandstorm: 'sandstorm', ash: 'ashfall', ashfall: 'ashfall',
      spores: 'spores', fireflies: 'fireflies', pollen: 'pollen', embers: 'embers', void: 'void',
    };
    this.weatherOverride = alias[weather.toLowerCase()] ?? null;
  }

  /* ------------------------------------------------------------------ */
  /* Frame update                                                        */
  /* ------------------------------------------------------------------ */

  update(deltaSeconds: number, cameraPosition: Vector3): AtmosphereFrame {
    if (this.disposed) return this.emptyFrame();

    this.elapsed += deltaSeconds;

    // Advance the world clock.
    if (!this.frozen && this.options.dayLengthSeconds > 0) {
      this.timeOfDay = (this.timeOfDay + (deltaSeconds / this.options.dayLengthSeconds) * 24) % 24;
    }

    // Ease the biome cross-fade (~2s).
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + deltaSeconds * 0.5);
      this.current = lerpSkyProfile(this.fromProfile, this.toProfile, smoothstep(this.blend));
    } else {
      this.current = this.toProfile;
    }
    const profile = this.current;

    // Sun elevation drives everything else.
    const sunAngle = ((this.timeOfDay - 6) / 24) * Math.PI * 2;
    const elevation = Math.sin(sunAngle);
    const dayFactor = Math.max(0, elevation);
    const nightFactor = Math.max(0, -elevation);
    const horizonFactor = Math.max(0, 1 - Math.abs(elevation) * 3.2);

    // --- Celestial rig -------------------------------------------------
    const celestial = this.celestial.update({
      timeOfDay: this.timeOfDay,
      cameraPosition,
      deltaSeconds,
      deepSpaceStrength: profile.showDeepSpace ? 1 : 0,
      hasSun: profile.hasSun,
      sunTint: profile.sunTint,
    });

    // --- Sky dome (owns clearColor + fogColor) -------------------------
    this.dome.update(profile, dayFactor, horizonFactor, celestial.sunDirection, cameraPosition, deltaSeconds);

    // Fog density comes from the profile, thickening a little at night so
    // darkness feels enclosing without ever hiding the terrain by day.
    this.scene.fogDensity = profile.fogDensity * (1 + nightFactor * 0.35);

    // --- Stars & aurora -------------------------------------------------
    this.stars.update(deltaSeconds, cameraPosition, nightFactor, profile.starDensity, profile.auroraStrength);

    // --- Clouds ---------------------------------------------------------
    this.clouds.setProfile(profile.cloudCoverage, profile.cloudTint);
    this.clouds.setLighting(dayFactor, horizonFactor, profile.sunsetGlow);
    this.clouds.update(deltaSeconds, cameraPosition);

    // --- Biome particles -------------------------------------------------
    this.vfx.setProfile(this.weatherOverride ?? profile.weather, this.chooseAmbientEffects(profile, dayFactor));
    this.vfx.update(cameraPosition);

    // --- Lighting outputs ------------------------------------------------
    const sunColor = Color3.Lerp(
      profile.sunTint.scale(0.35),
      profile.sunTint,
      dayFactor
    );
    // Sunsets bleed warm light onto the world.
    const tintedSun = Color3.Lerp(sunColor, profile.sunsetGlow, horizonFactor * 0.55);

    const ambientBase = Color3.Lerp(
      profile.zenithNight.scale(2.2),
      profile.horizonDay.scale(0.55),
      dayFactor
    );
    const ambient = ambientBase.scale(profile.ambientScale);
    // Ambient FLOOR.
    //
    // This line writes `scene.ambientColor` every frame, which makes it the
    // final authority on how dark an unlit face can get. Several sky profiles
    // drove it to nearly zero at night, and with block materials taking their
    // ambient term from here that is exactly how caves and forest interiors
    // ended up as unreadable black blocks. The lighting rig sets a sensible
    // base; this clamps the per-frame value so no profile can go below it.
    this.scene.ambientColor = new Color3(
      Math.max(MIN_AMBIENT.r, ambient.r),
      Math.max(MIN_AMBIENT.g, ambient.g),
      Math.max(MIN_AMBIENT.b, ambient.b)
    );

    return {
      timeOfDay: this.timeOfDay,
      dayFactor,
      nightFactor,
      horizonFactor,
      sunDirection: celestial.sunDirection,
      sunColor: tintedSun,
      ambient,
      profile,
      isDay: dayFactor > 0.15,
    };
  }

  /**
   * Layer time-appropriate life on top of the profile's own weather:
   * butterflies in gentle biomes by day, fireflies in those same biomes at
   * night. Biomes whose primary weather is already a creature effect are left
   * alone so we don't double up.
   */
  private chooseAmbientEffects(profile: SkyProfile, dayFactor: number): AmbientEffect[] {
    const out: AmbientEffect[] = [];
    const gentle =
      profile.weather === 'clear' || profile.weather === 'pollen' || profile.weather === 'fireflies';
    if (!gentle) return out;

    const lush = ['plains', 'forest', 'meadow', 'nature_dimension', 'dream_realm', 'magic', 'overworld'].some(
      (id) => profile.id.includes(id)
    );

    if (dayFactor > 0.25 && lush) out.push('butterflies');
    if (dayFactor > 0.25 && (lush || profile.weather === 'pollen')) out.push('pollen');
    // Fireflies at night everywhere lush, and always in swamps.
    if (dayFactor < 0.20 && (lush || profile.weather === 'fireflies')) out.push('fireflies');
    return out;
  }

  private emptyFrame(): AtmosphereFrame {
    return {
      timeOfDay: this.timeOfDay,
      dayFactor: 1,
      nightFactor: 0,
      horizonFactor: 0,
      sunDirection: new Vector3(0, -1, 0),
      sunColor: new Color3(1, 1, 1),
      ambient: new Color3(0.3, 0.3, 0.3),
      profile: this.current,
      isDay: true,
    };
  }

  /** Debug readouts for the stats panel. */
  getStats(): { profile: string; clouds: number; weather: string; fogDensity: number } {
    return {
      profile: this.current.label,
      clouds: this.clouds.getBlockCount(),
      weather: this.current.weather,
      fogDensity: this.scene.fogDensity,
    };
  }

  setParticlesEnabled(enabled: boolean): void {
    this.vfx.setEnabled(enabled);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.dome.dispose();
    this.celestial.dispose();
    this.stars.dispose();
    this.clouds.dispose();
    this.vfx.dispose();
  }
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export default AtmosphereSystem;

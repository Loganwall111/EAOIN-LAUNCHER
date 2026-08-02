/**
 * SkyProfiles — "Life Comes Apart 2.0" per-biome / per-dimension atmosphere registry.
 *
 * Every biome and every dimension gets its own sky gradient, fog colour, fog
 * density, cloud tint and weather particle style. One profile is active at a
 * time and it is the *single source of truth* for atmosphere: `DynamicSky`
 * reads it and drives `scene.clearColor`, `scene.fogColor`, `scene.fogDensity`,
 * the sky dome vertex colours and the ambient particle system from it.
 *
 * Fog policy (per the 2.0 design brief):
 *   - Fog is LOW almost everywhere. `FOG_LOW` is the default so you can see to
 *     the render-distance edge.
 *   - Swamps / marsh / mushroom get `FOG_HEAVY` — thick, close, soupy.
 *   - Deserts get a sandstorm, mountains/snow get a snowstorm. Those raise fog
 *     moderately *and* switch the weather particle type.
 */
import { Color3 } from '@babylonjs/core';

/** Weather/particle style driven by the active profile. */
export type SkyWeather =
  | 'clear'
  | 'sandstorm'
  | 'snowstorm'
  | 'ashfall'
  | 'spores'
  | 'fireflies'
  | 'pollen'
  | 'rain'
  | 'embers'
  | 'void';

/**
 * Fog density bands. Babylon uses FOGMODE_EXP2, so these are small numbers —
 * `0.0006` still reaches ~1000 blocks, `0.0042` closes in to roughly 120.
 */
export const FOG_NONE = 0.0;
export const FOG_LOW = 0.00055;
export const FOG_MILD = 0.0011;
export const FOG_MEDIUM = 0.0019;
export const FOG_HEAVY = 0.0042;
export const FOG_SOUP = 0.0068;

export interface SkyProfile {
  id: string;
  label: string;
  /** Dome colour straight overhead at midday. */
  zenithDay: Color3;
  /** Dome colour at the horizon band at midday. */
  horizonDay: Color3;
  /** Dome colour straight overhead at midnight. */
  zenithNight: Color3;
  /** Dome colour at the horizon band at midnight. */
  horizonNight: Color3;
  /** Warm band painted around the sun at sunrise/sunset. */
  sunsetGlow: Color3;
  fogDay: Color3;
  fogNight: Color3;
  /** EXP2 fog density. Keep low unless the biome is deliberately soupy. */
  fogDensity: number;
  cloudTint: Color3;
  /** 0 = cloudless, 1 = fully overcast. Scales cloud cluster count + alpha. */
  cloudCoverage: number;
  /** 0 = no aurora, 1 = full polar display. Night only. */
  auroraStrength: number;
  /** 0 = no stars, 1 = dense field. Night only. */
  starDensity: number;
  /** Multiplies overall scene ambient — dark realms sit below 1. */
  ambientScale: number;
  /** Tints the sun disc + directional light in this atmosphere. */
  sunTint: Color3;
  weather: SkyWeather;
  /** Show the ringed gas giant / black hole / drifting planets at night. */
  showDeepSpace: boolean;
  /** Sun visible at all — false for The End, caves, the void. */
  hasSun: boolean;
}

function c(r: number, g: number, b: number): Color3 {
  return new Color3(r, g, b);
}

/**
 * The overworld baseline. Every other profile is a partial override of this so
 * a new biome only has to declare what actually differs.
 */
export const OVERWORLD_SKY: SkyProfile = {
  id: 'overworld',
  label: 'Overworld',
  zenithDay: c(0.16, 0.38, 0.80),
  horizonDay: c(0.60, 0.78, 0.96),
  zenithNight: c(0.015, 0.022, 0.075),
  horizonNight: c(0.05, 0.07, 0.16),
  // Sunset/sunrise: a warm orange base that blooms into pink-purple as the sun
  // nears the horizon, giving dusk that purplish-pink cast and dawn a warm
  // orange-blue gradient rising into the sky.
  sunsetGlow: c(1.0, 0.42, 0.55),
  fogDay: c(0.63, 0.76, 0.92),
  fogNight: c(0.05, 0.07, 0.14),
  fogDensity: FOG_LOW,
  cloudTint: c(1.0, 1.0, 1.0),
  cloudCoverage: 0.5,
  auroraStrength: 0.25,
  starDensity: 1,
  ambientScale: 1,
  sunTint: c(1.0, 0.80, 0.55),
  weather: 'clear',
  showDeepSpace: true,
  hasSun: true,
};

function profile(id: string, label: string, over: Partial<SkyProfile>): SkyProfile {
  return { ...OVERWORLD_SKY, id, label, ...over };
}

/* ------------------------------------------------------------------ */
/* Biome profiles                                                      */
/* ------------------------------------------------------------------ */

export const BIOME_SKY_PROFILES: Record<string, SkyProfile> = {
  plains: profile('plains', 'Open Plains', {
    zenithDay: c(0.17, 0.42, 0.80),
    horizonDay: c(0.66, 0.83, 0.97),
    cloudCoverage: 0.42,
  }),

  forest: profile('forest', 'Deep Forest', {
    zenithDay: c(0.16, 0.38, 0.72),
    horizonDay: c(0.58, 0.76, 0.86),
    fogDay: c(0.58, 0.72, 0.74),
    fogDensity: FOG_MILD,
    cloudCoverage: 0.58,
    weather: 'pollen',
  }),

  // "Swamps can have like little particles in the air like fireflies" — and the
  // one place fog is deliberately allowed to get thick.
  swamp: profile('swamp', 'Rotting Swamp', {
    zenithDay: c(0.24, 0.34, 0.30),
    horizonDay: c(0.52, 0.56, 0.42),
    zenithNight: c(0.03, 0.05, 0.04),
    horizonNight: c(0.08, 0.11, 0.08),
    sunsetGlow: c(0.86, 0.62, 0.28),
    fogDay: c(0.44, 0.50, 0.38),
    fogNight: c(0.07, 0.10, 0.08),
    fogDensity: FOG_HEAVY,
    cloudTint: c(0.80, 0.82, 0.72),
    cloudCoverage: 0.74,
    starDensity: 0.5,
    ambientScale: 0.86,
    sunTint: c(0.88, 0.90, 0.68),
    weather: 'fireflies',
  }),

  mangrove: profile('mangrove', 'Mangrove Delta', {
    zenithDay: c(0.20, 0.36, 0.40),
    horizonDay: c(0.54, 0.64, 0.55),
    fogDay: c(0.46, 0.56, 0.48),
    fogDensity: FOG_MEDIUM,
    cloudCoverage: 0.66,
    weather: 'fireflies',
  }),

  // "desert should have sandstorm" + "the sky get so bright ... that you have
  // to drink water to survive in the desert".
  desert: profile('desert', 'Scorching Desert', {
    zenithDay: c(0.36, 0.55, 0.82),
    horizonDay: c(0.94, 0.84, 0.60),
    sunsetGlow: c(1.0, 0.55, 0.18),
    fogDay: c(0.88, 0.78, 0.55),
    fogNight: c(0.10, 0.09, 0.11),
    fogDensity: FOG_MEDIUM,
    cloudTint: c(1.0, 0.96, 0.84),
    cloudCoverage: 0.16,
    auroraStrength: 0,
    starDensity: 1,
    ambientScale: 1.16,
    sunTint: c(1.0, 0.93, 0.70),
    weather: 'sandstorm',
  }),

  badlands: profile('badlands', 'Red Badlands', {
    zenithDay: c(0.32, 0.44, 0.70),
    horizonDay: c(0.90, 0.66, 0.44),
    sunsetGlow: c(1.0, 0.42, 0.16),
    fogDay: c(0.80, 0.58, 0.40),
    fogDensity: FOG_MEDIUM,
    cloudCoverage: 0.20,
    ambientScale: 1.08,
    weather: 'sandstorm',
  }),

  // "snowstorms Mountains"
  mountain: profile('mountain', 'High Mountains', {
    zenithDay: c(0.12, 0.34, 0.76),
    horizonDay: c(0.74, 0.85, 0.96),
    zenithNight: c(0.012, 0.020, 0.070),
    horizonNight: c(0.08, 0.12, 0.22),
    fogDay: c(0.80, 0.87, 0.95),
    fogNight: c(0.10, 0.14, 0.22),
    fogDensity: FOG_MEDIUM,
    cloudTint: c(0.96, 0.98, 1.0),
    cloudCoverage: 0.70,
    auroraStrength: 0.85,
    starDensity: 1,
    ambientScale: 1.04,
    weather: 'snowstorm',
  }),

  snow: profile('snow', 'Frozen Tundra', {
    zenithDay: c(0.20, 0.42, 0.80),
    horizonDay: c(0.82, 0.90, 0.98),
    zenithNight: c(0.010, 0.024, 0.080),
    horizonNight: c(0.09, 0.14, 0.26),
    fogDay: c(0.84, 0.90, 0.97),
    fogNight: c(0.11, 0.16, 0.26),
    fogDensity: FOG_MEDIUM,
    cloudCoverage: 0.66,
    // Polar biomes are the aurora borealis showcase.
    auroraStrength: 1,
    ambientScale: 1.02,
    weather: 'snowstorm',
  }),

  ocean: profile('ocean', 'Open Ocean', {
    zenithDay: c(0.14, 0.38, 0.82),
    horizonDay: c(0.56, 0.78, 0.95),
    fogDay: c(0.58, 0.76, 0.92),
    fogDensity: FOG_LOW,
    cloudCoverage: 0.46,
  }),

  coral: profile('coral', 'Coral Shallows', {
    zenithDay: c(0.16, 0.48, 0.86),
    horizonDay: c(0.62, 0.88, 0.94),
    cloudCoverage: 0.30,
    ambientScale: 1.06,
  }),

  mushroom: profile('mushroom', 'Mushroom Fields', {
    zenithDay: c(0.30, 0.22, 0.42),
    horizonDay: c(0.72, 0.52, 0.72),
    zenithNight: c(0.06, 0.03, 0.10),
    horizonNight: c(0.16, 0.08, 0.20),
    sunsetGlow: c(0.94, 0.42, 0.72),
    fogDay: c(0.62, 0.46, 0.66),
    fogNight: c(0.12, 0.07, 0.16),
    fogDensity: FOG_HEAVY,
    cloudTint: c(0.92, 0.78, 0.94),
    cloudCoverage: 0.60,
    auroraStrength: 0.4,
    weather: 'spores',
  }),

  volcanic: profile('volcanic', 'Volcanic Wastes', {
    zenithDay: c(0.24, 0.13, 0.10),
    horizonDay: c(0.62, 0.26, 0.12),
    zenithNight: c(0.07, 0.02, 0.01),
    horizonNight: c(0.22, 0.06, 0.02),
    sunsetGlow: c(1.0, 0.32, 0.08),
    fogDay: c(0.48, 0.22, 0.12),
    fogNight: c(0.18, 0.06, 0.03),
    fogDensity: FOG_MEDIUM,
    cloudTint: c(0.44, 0.28, 0.24),
    cloudCoverage: 0.82,
    auroraStrength: 0,
    starDensity: 0.3,
    ambientScale: 0.94,
    sunTint: c(1.0, 0.62, 0.34),
    weather: 'ashfall',
  }),

  crystal: profile('crystal', 'Crystal Fields', {
    zenithDay: c(0.16, 0.34, 0.66),
    horizonDay: c(0.62, 0.86, 0.98),
    zenithNight: c(0.04, 0.06, 0.18),
    horizonNight: c(0.14, 0.24, 0.44),
    sunsetGlow: c(0.66, 0.72, 1.0),
    fogDay: c(0.66, 0.84, 0.96),
    fogDensity: FOG_MILD,
    cloudTint: c(0.86, 0.94, 1.0),
    auroraStrength: 0.9,
    ambientScale: 1.05,
  }),

  spooky: profile('spooky', 'Haunted Woods', {
    zenithDay: c(0.14, 0.14, 0.20),
    horizonDay: c(0.36, 0.36, 0.44),
    zenithNight: c(0.02, 0.02, 0.04),
    horizonNight: c(0.07, 0.06, 0.10),
    sunsetGlow: c(0.62, 0.30, 0.42),
    fogDay: c(0.34, 0.34, 0.40),
    fogNight: c(0.05, 0.05, 0.08),
    fogDensity: FOG_HEAVY,
    cloudTint: c(0.52, 0.52, 0.58),
    cloudCoverage: 0.86,
    starDensity: 0.4,
    ambientScale: 0.78,
    weather: 'fireflies',
  }),

  magic: profile('magic', 'Mystic Grove', {
    zenithDay: c(0.22, 0.26, 0.62),
    horizonDay: c(0.66, 0.62, 0.94),
    zenithNight: c(0.05, 0.03, 0.14),
    horizonNight: c(0.16, 0.10, 0.30),
    sunsetGlow: c(0.86, 0.46, 0.96),
    fogDay: c(0.60, 0.58, 0.86),
    fogDensity: FOG_MILD,
    auroraStrength: 1,
    ambientScale: 1.02,
    weather: 'fireflies',
  }),

  sky: profile('sky', 'Sky Islands', {
    zenithDay: c(0.10, 0.36, 0.86),
    horizonDay: c(0.76, 0.90, 1.0),
    fogDay: c(0.78, 0.88, 1.0),
    fogDensity: FOG_LOW,
    cloudCoverage: 0.90,
    ambientScale: 1.08,
  }),

  cave: profile('cave', 'Deep Caves', {
    zenithDay: c(0.03, 0.03, 0.05),
    horizonDay: c(0.07, 0.07, 0.10),
    zenithNight: c(0.01, 0.01, 0.02),
    horizonNight: c(0.03, 0.03, 0.05),
    sunsetGlow: c(0.10, 0.10, 0.14),
    fogDay: c(0.05, 0.05, 0.08),
    fogNight: c(0.03, 0.03, 0.05),
    fogDensity: FOG_SOUP,
    cloudCoverage: 0,
    auroraStrength: 0,
    starDensity: 0,
    ambientScale: 0.55,
    weather: 'clear',
    showDeepSpace: false,
    hasSun: false,
  }),

  alien: profile('alien', 'Alien World', {
    zenithDay: c(0.26, 0.10, 0.34),
    horizonDay: c(0.72, 0.44, 0.30),
    zenithNight: c(0.06, 0.02, 0.10),
    horizonNight: c(0.18, 0.08, 0.18),
    sunsetGlow: c(0.60, 1.0, 0.36),
    fogDay: c(0.54, 0.40, 0.44),
    fogDensity: FOG_MILD,
    cloudTint: c(0.82, 0.62, 0.86),
    auroraStrength: 0.8,
    sunTint: c(0.86, 0.72, 1.0),
    weather: 'spores',
  }),

  shadow: profile('shadow', 'Shadow Realm', {
    zenithDay: c(0.05, 0.04, 0.09),
    horizonDay: c(0.16, 0.12, 0.24),
    zenithNight: c(0.02, 0.01, 0.04),
    horizonNight: c(0.07, 0.04, 0.12),
    sunsetGlow: c(0.42, 0.16, 0.52),
    fogDay: c(0.14, 0.11, 0.20),
    fogNight: c(0.05, 0.03, 0.09),
    fogDensity: FOG_MEDIUM,
    cloudCoverage: 0.70,
    cloudTint: c(0.30, 0.26, 0.40),
    auroraStrength: 0.5,
    ambientScale: 0.62,
    hasSun: false,
  }),
};

/* ------------------------------------------------------------------ */
/* Dimension profiles                                                  */
/* ------------------------------------------------------------------ */

export const DIMENSION_SKY_PROFILES: Record<string, SkyProfile> = {
  overworld: OVERWORLD_SKY,

  nether: profile('nether', 'The Nether', {
    zenithDay: c(0.22, 0.05, 0.04),
    horizonDay: c(0.52, 0.14, 0.08),
    zenithNight: c(0.18, 0.03, 0.03),
    horizonNight: c(0.42, 0.10, 0.06),
    sunsetGlow: c(1.0, 0.30, 0.06),
    fogDay: c(0.40, 0.11, 0.08),
    fogNight: c(0.34, 0.09, 0.06),
    fogDensity: FOG_MEDIUM,
    cloudTint: c(0.42, 0.18, 0.14),
    cloudCoverage: 0.40,
    auroraStrength: 0,
    starDensity: 0,
    ambientScale: 0.90,
    sunTint: c(1.0, 0.48, 0.24),
    weather: 'embers',
    showDeepSpace: false,
    hasSun: false,
  }),

  end: profile('end', 'The End', {
    zenithDay: c(0.04, 0.01, 0.07),
    horizonDay: c(0.12, 0.06, 0.18),
    zenithNight: c(0.03, 0.01, 0.05),
    horizonNight: c(0.10, 0.05, 0.15),
    sunsetGlow: c(0.34, 0.16, 0.48),
    fogDay: c(0.10, 0.05, 0.16),
    fogNight: c(0.08, 0.04, 0.13),
    fogDensity: FOG_MILD,
    cloudCoverage: 0,
    auroraStrength: 0.35,
    starDensity: 1,
    ambientScale: 0.68,
    weather: 'void',
    showDeepSpace: true,
    hasSun: false,
  }),

  frozen_wasteland: profile('frozen_wasteland', 'Frozen Wasteland', {
    ...BIOME_SKY_PROFILES.snow,
    auroraStrength: 1,
    fogDensity: FOG_MEDIUM,
    weather: 'snowstorm',
  }),

  volcanic_realm: profile('volcanic_realm', 'Volcanic Realm', BIOME_SKY_PROFILES.volcanic),

  crystal_realm: profile('crystal_realm', 'Crystal Dimension', {
    ...BIOME_SKY_PROFILES.crystal,
    auroraStrength: 1,
  }),

  sky_kingdom: profile('sky_kingdom', 'Sky Kingdom', BIOME_SKY_PROFILES.sky),

  shadow_realm: profile('shadow_realm', 'Shadow Realm', BIOME_SKY_PROFILES.shadow),

  astral_plane: profile('astral_plane', 'Astral Plane', {
    zenithDay: c(0.06, 0.04, 0.20),
    horizonDay: c(0.30, 0.20, 0.56),
    zenithNight: c(0.03, 0.02, 0.12),
    horizonNight: c(0.16, 0.10, 0.36),
    sunsetGlow: c(0.70, 0.40, 1.0),
    fogDay: c(0.24, 0.18, 0.46),
    fogNight: c(0.12, 0.08, 0.28),
    fogDensity: FOG_LOW,
    cloudCoverage: 0.24,
    cloudTint: c(0.78, 0.68, 1.0),
    auroraStrength: 1,
    starDensity: 1,
    ambientScale: 0.88,
    hasSun: false,
  }),

  ocean_world: profile('ocean_world', 'Ocean World', {
    ...BIOME_SKY_PROFILES.ocean,
    fogDensity: FOG_MILD,
    cloudCoverage: 0.62,
  }),

  giant_forest: profile('giant_forest', 'Giant Forest', {
    ...BIOME_SKY_PROFILES.forest,
    cloudCoverage: 0.70,
    fogDensity: FOG_MEDIUM,
  }),

  mushroom_kingdom: profile('mushroom_kingdom', 'Mushroom Kingdom', BIOME_SKY_PROFILES.mushroom),

  storm_dimension: profile('storm_dimension', 'Storm Dimension', {
    zenithDay: c(0.10, 0.12, 0.20),
    horizonDay: c(0.32, 0.36, 0.46),
    zenithNight: c(0.03, 0.04, 0.08),
    horizonNight: c(0.10, 0.12, 0.20),
    sunsetGlow: c(0.60, 0.62, 0.88),
    fogDay: c(0.30, 0.34, 0.44),
    fogNight: c(0.09, 0.11, 0.18),
    fogDensity: FOG_HEAVY,
    cloudTint: c(0.46, 0.50, 0.58),
    cloudCoverage: 1,
    auroraStrength: 0.3,
    ambientScale: 0.82,
    weather: 'rain',
  }),

  moon: profile('moon', 'The Moon', {
    zenithDay: c(0.005, 0.005, 0.015),
    horizonDay: c(0.03, 0.03, 0.06),
    zenithNight: c(0.003, 0.003, 0.010),
    horizonNight: c(0.02, 0.02, 0.04),
    sunsetGlow: c(0.18, 0.20, 0.30),
    fogDay: c(0.02, 0.02, 0.04),
    fogNight: c(0.01, 0.01, 0.03),
    // Airless — no scattering, so essentially no fog.
    fogDensity: FOG_NONE,
    cloudCoverage: 0,
    auroraStrength: 0,
    // Vacuum: the full star field is visible even during "day".
    starDensity: 1,
    ambientScale: 0.55,
    sunTint: c(1.0, 1.0, 0.98),
    weather: 'void',
    showDeepSpace: true,
  }),

  sun: profile('sun', 'Solar Surface', {
    zenithDay: c(0.92, 0.52, 0.10),
    horizonDay: c(1.0, 0.80, 0.30),
    zenithNight: c(0.86, 0.44, 0.08),
    horizonNight: c(1.0, 0.72, 0.24),
    sunsetGlow: c(1.0, 0.92, 0.50),
    fogDay: c(0.98, 0.66, 0.22),
    fogNight: c(0.94, 0.58, 0.18),
    fogDensity: FOG_MEDIUM,
    cloudCoverage: 0,
    auroraStrength: 0,
    starDensity: 0,
    ambientScale: 1.25,
    sunTint: c(1.0, 0.86, 0.46),
    weather: 'embers',
    showDeepSpace: false,
    hasSun: false,
  }),

  gas_giant: profile('gas_giant', 'Gas Giant Platforms', {
    zenithDay: c(0.34, 0.22, 0.14),
    horizonDay: c(0.82, 0.62, 0.36),
    zenithNight: c(0.10, 0.06, 0.05),
    horizonNight: c(0.30, 0.18, 0.12),
    sunsetGlow: c(1.0, 0.66, 0.30),
    fogDay: c(0.66, 0.50, 0.32),
    fogNight: c(0.22, 0.14, 0.10),
    fogDensity: FOG_HEAVY,
    cloudTint: c(0.94, 0.78, 0.54),
    cloudCoverage: 1,
    starDensity: 0.6,
    weather: 'clear',
    showDeepSpace: true,
  }),

  alien_worlds: profile('alien_worlds', 'Alien Worlds', BIOME_SKY_PROFILES.alien),

  chaos_dimension: profile('chaos_dimension', 'Chaos Dimension', {
    zenithDay: c(0.34, 0.06, 0.30),
    horizonDay: c(0.86, 0.30, 0.20),
    zenithNight: c(0.10, 0.02, 0.12),
    horizonNight: c(0.30, 0.08, 0.24),
    sunsetGlow: c(0.20, 1.0, 0.60),
    fogDay: c(0.56, 0.24, 0.40),
    fogNight: c(0.18, 0.06, 0.16),
    fogDensity: FOG_MEDIUM,
    cloudTint: c(0.90, 0.40, 0.72),
    cloudCoverage: 0.72,
    auroraStrength: 1,
    ambientScale: 0.92,
    weather: 'spores',
  }),

  dream_realm: profile('dream_realm', 'Dream Realm', {
    zenithDay: c(0.42, 0.52, 0.92),
    horizonDay: c(0.98, 0.76, 0.90),
    zenithNight: c(0.12, 0.10, 0.32),
    horizonNight: c(0.36, 0.22, 0.50),
    sunsetGlow: c(1.0, 0.66, 0.92),
    fogDay: c(0.86, 0.74, 0.92),
    fogNight: c(0.26, 0.18, 0.40),
    fogDensity: FOG_MILD,
    cloudTint: c(1.0, 0.88, 0.96),
    cloudCoverage: 0.86,
    auroraStrength: 1,
    ambientScale: 1.12,
    weather: 'pollen',
  }),

  toxic_wasteland: profile('toxic_wasteland', 'Toxic Wasteland', {
    zenithDay: c(0.20, 0.26, 0.10),
    horizonDay: c(0.58, 0.66, 0.24),
    zenithNight: c(0.05, 0.07, 0.03),
    horizonNight: c(0.16, 0.20, 0.08),
    sunsetGlow: c(0.72, 1.0, 0.24),
    fogDay: c(0.46, 0.54, 0.22),
    fogNight: c(0.13, 0.16, 0.07),
    fogDensity: FOG_HEAVY,
    cloudTint: c(0.72, 0.80, 0.44),
    cloudCoverage: 0.80,
    ambientScale: 0.90,
    sunTint: c(0.86, 1.0, 0.56),
    weather: 'spores',
  }),

  ancient_civilization: profile('ancient_civilization', 'Ancient Civilization', {
    zenithDay: c(0.22, 0.40, 0.68),
    horizonDay: c(0.84, 0.76, 0.58),
    sunsetGlow: c(1.0, 0.60, 0.26),
    fogDay: c(0.72, 0.68, 0.56),
    fogDensity: FOG_MILD,
    cloudCoverage: 0.36,
    ambientScale: 1.04,
  }),

  prehistoric_world: profile('prehistoric_world', 'Prehistoric World', {
    zenithDay: c(0.20, 0.36, 0.62),
    horizonDay: c(0.76, 0.72, 0.52),
    sunsetGlow: c(1.0, 0.50, 0.18),
    fogDay: c(0.64, 0.66, 0.50),
    fogDensity: FOG_MEDIUM,
    cloudTint: c(0.94, 0.90, 0.80),
    cloudCoverage: 0.68,
    weather: 'pollen',
  }),

  machine_dimension: profile('machine_dimension', 'Machine Dimension', {
    zenithDay: c(0.10, 0.13, 0.17),
    horizonDay: c(0.34, 0.42, 0.50),
    zenithNight: c(0.03, 0.04, 0.06),
    horizonNight: c(0.10, 0.14, 0.20),
    sunsetGlow: c(0.30, 0.86, 1.0),
    fogDay: c(0.30, 0.38, 0.46),
    fogNight: c(0.09, 0.12, 0.18),
    fogDensity: FOG_MEDIUM,
    cloudTint: c(0.56, 0.64, 0.72),
    cloudCoverage: 0.58,
    auroraStrength: 0.6,
    ambientScale: 0.90,
    sunTint: c(0.78, 0.92, 1.0),
    weather: 'ashfall',
  }),

  spirit_realm: profile('spirit_realm', 'Spirit Realm', {
    zenithDay: c(0.10, 0.20, 0.24),
    horizonDay: c(0.42, 0.66, 0.66),
    zenithNight: c(0.03, 0.07, 0.09),
    horizonNight: c(0.12, 0.24, 0.26),
    sunsetGlow: c(0.44, 1.0, 0.86),
    fogDay: c(0.38, 0.58, 0.58),
    fogNight: c(0.10, 0.18, 0.20),
    fogDensity: FOG_HEAVY,
    cloudTint: c(0.72, 0.92, 0.90),
    cloudCoverage: 0.66,
    auroraStrength: 1,
    ambientScale: 0.84,
    weather: 'fireflies',
  }),

  nature_dimension: profile('nature_dimension', 'Nature Dimension', {
    zenithDay: c(0.16, 0.44, 0.66),
    horizonDay: c(0.66, 0.88, 0.72),
    sunsetGlow: c(1.0, 0.68, 0.34),
    fogDay: c(0.58, 0.76, 0.62),
    fogDensity: FOG_MILD,
    cloudCoverage: 0.54,
    ambientScale: 1.06,
    weather: 'pollen',
  }),

  undead_realm: profile('undead_realm', 'Undead Realm', {
    ...BIOME_SKY_PROFILES.spooky,
    fogDensity: FOG_HEAVY,
    auroraStrength: 0.4,
  }),

  cosmic_void: profile('cosmic_void', 'Cosmic Void', {
    zenithDay: c(0.006, 0.006, 0.020),
    horizonDay: c(0.02, 0.02, 0.06),
    zenithNight: c(0.003, 0.003, 0.012),
    horizonNight: c(0.012, 0.012, 0.036),
    sunsetGlow: c(0.24, 0.14, 0.44),
    fogDay: c(0.01, 0.01, 0.03),
    fogNight: c(0.006, 0.006, 0.020),
    fogDensity: FOG_NONE,
    cloudCoverage: 0,
    auroraStrength: 0.5,
    starDensity: 1,
    ambientScale: 0.50,
    weather: 'void',
    showDeepSpace: true,
    hasSun: false,
  }),

  // The Aether: perpetual bright golden hour above an endless fall. Very high
  // ambient and near-zero fog, so the isles read as floating in open light.
  aether: profile('aether', 'The Aether', {
    zenithDay: c(0.38, 0.62, 0.92),
    horizonDay: c(0.92, 0.94, 0.82),
    zenithNight: c(0.16, 0.26, 0.48),
    horizonNight: c(0.44, 0.50, 0.68),
    sunsetGlow: c(1.0, 0.86, 0.58),
    fogDay: c(0.86, 0.92, 1.0),
    fogNight: c(0.40, 0.48, 0.66),
    fogDensity: FOG_LOW,
    cloudCoverage: 0.85,
    auroraStrength: 0.12,
    starDensity: 0.25,
    ambientScale: 1.25,
    weather: 'clear',
  }),

  // The Backrooms: no sky at all. A flat sickly yellow with heavy fog so you
  // can never see more than a room or two ahead, which is the entire point.
  backrooms: profile('backrooms', 'The Backrooms', {
    zenithDay: c(0.74, 0.70, 0.42),
    horizonDay: c(0.80, 0.76, 0.48),
    zenithNight: c(0.66, 0.62, 0.36),
    horizonNight: c(0.72, 0.68, 0.42),
    sunsetGlow: c(0.84, 0.78, 0.46),
    fogDay: c(0.76, 0.72, 0.46),
    fogNight: c(0.70, 0.66, 0.40),
    fogDensity: FOG_HEAVY,
    cloudCoverage: 0,
    auroraStrength: 0,
    starDensity: 0,
    ambientScale: 0.92,
    weather: 'clear',
    hasSun: false,
  }),
};

/* ------------------------------------------------------------------ */
/* Lookup                                                              */
/* ------------------------------------------------------------------ */

/**
 * Maps the coarse `BiomeDefinition.category` values from `Biomes.ts` onto a
 * profile, so all 150+ biomes resolve to a sensible atmosphere even when they
 * have no bespoke entry of their own.
 */
const CATEGORY_TO_PROFILE: Record<string, string> = {
  forest: 'forest',
  desert: 'desert',
  mountain: 'mountain',
  snow: 'snow',
  ocean: 'ocean',
  cave: 'cave',
  nether: 'volcanic',
  end: 'shadow',
  space: 'crystal',
  mushroom: 'mushroom',
  magic: 'magic',
  volcanic: 'volcanic',
  sky: 'sky',
  alien: 'alien',
  crystal: 'crystal',
  shadow: 'shadow',
  spooky: 'spooky',
  coral: 'coral',
  mangrove: 'mangrove',
  mystic: 'magic',
};

/** Direct biome-id hints for the small `TerrainGenerator` biome vocabulary. */
const BIOME_ID_TO_PROFILE: Record<string, string> = {
  plains: 'plains',
  forest: 'forest',
  desert: 'desert',
  highlands: 'mountain',
  mountains: 'mountain',
  cliff: 'mountain',
  lake: 'ocean',
  swamp: 'swamp',
  meadow: 'plains',
  beach: 'ocean',
  taiga: 'snow',
  tundra: 'snow',
  jungle: 'forest',
  rainforest: 'forest',
  badlands: 'badlands',
  savanna: 'desert',
};

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Resolve a sky profile from a biome name/id and optional category. Falls back
 * to the overworld baseline so an unknown biome can never blank the sky.
 */
export function getSkyProfileForBiome(biomeId: string, category?: string): SkyProfile {
  const key = normalise(biomeId);

  // Exact profile id.
  if (BIOME_SKY_PROFILES[key]) return BIOME_SKY_PROFILES[key];

  // Known short-vocabulary biome.
  const direct = BIOME_ID_TO_PROFILE[key];
  if (direct && BIOME_SKY_PROFILES[direct]) return BIOME_SKY_PROFILES[direct];

  // Substring match — catches 'mangrove_swamp', 'snowy_taiga', 'ice_spikes'…
  for (const [needle, profileId] of Object.entries(BIOME_ID_TO_PROFILE)) {
    if (key.includes(needle) && BIOME_SKY_PROFILES[profileId]) return BIOME_SKY_PROFILES[profileId];
  }
  for (const profileId of Object.keys(BIOME_SKY_PROFILES)) {
    if (key.includes(profileId)) return BIOME_SKY_PROFILES[profileId];
  }

  // Category fallback.
  if (category) {
    const mapped = CATEGORY_TO_PROFILE[normalise(category)];
    if (mapped && BIOME_SKY_PROFILES[mapped]) return BIOME_SKY_PROFILES[mapped];
  }

  return OVERWORLD_SKY;
}

/** Resolve a sky profile for a runtime dimension id. */
export function getSkyProfileForDimension(dimensionId: string): SkyProfile {
  return DIMENSION_SKY_PROFILES[normalise(dimensionId)] ?? OVERWORLD_SKY;
}

/**
 * Blend two profiles. Used to cross-fade the atmosphere as the player walks
 * from one biome into the next instead of snapping between them.
 */
export function lerpSkyProfile(a: SkyProfile, b: SkyProfile, t: number): SkyProfile {
  const k = Math.max(0, Math.min(1, t));
  const mix = (x: number, y: number) => x + (y - x) * k;
  return {
    id: k < 0.5 ? a.id : b.id,
    label: k < 0.5 ? a.label : b.label,
    zenithDay: Color3.Lerp(a.zenithDay, b.zenithDay, k),
    horizonDay: Color3.Lerp(a.horizonDay, b.horizonDay, k),
    zenithNight: Color3.Lerp(a.zenithNight, b.zenithNight, k),
    horizonNight: Color3.Lerp(a.horizonNight, b.horizonNight, k),
    sunsetGlow: Color3.Lerp(a.sunsetGlow, b.sunsetGlow, k),
    fogDay: Color3.Lerp(a.fogDay, b.fogDay, k),
    fogNight: Color3.Lerp(a.fogNight, b.fogNight, k),
    fogDensity: mix(a.fogDensity, b.fogDensity),
    cloudTint: Color3.Lerp(a.cloudTint, b.cloudTint, k),
    cloudCoverage: mix(a.cloudCoverage, b.cloudCoverage),
    auroraStrength: mix(a.auroraStrength, b.auroraStrength),
    starDensity: mix(a.starDensity, b.starDensity),
    ambientScale: mix(a.ambientScale, b.ambientScale),
    sunTint: Color3.Lerp(a.sunTint, b.sunTint, k),
    weather: k < 0.5 ? a.weather : b.weather,
    showDeepSpace: k < 0.5 ? a.showDeepSpace : b.showDeepSpace,
    hasSun: k < 0.5 ? a.hasSun : b.hasSun,
  };
}

export const ALL_SKY_PROFILES: SkyProfile[] = [
  ...Object.values(BIOME_SKY_PROFILES),
  ...Object.values(DIMENSION_SKY_PROFILES),
];

/**
 * ShaderRegistry — EAOIN 1.0 official shader support.
 *
 * Players can install shaders via the dedicated Shaders menu (key: F6).
 * Each shader toggles a set of visual effects: SSAO, SSR, Bloom, Volumetric
 * Lighting, HDR, Atmospheric Scattering, Ray Traced Shadows, Motion Blur.
 *
 * The runtime is renderer-agnostic — BabylonJS supports these features
 * via the DefaultRenderingPipeline; the registry reports what should be
 * enabled based on user choice.
 */

export type ShaderID =
  | 'vanilla'
  | 'pbr_plus'
  | 'cinematic'
  | 'rtx_lite'
  | 'rtx_full'
  | 'painterly'
  | 'anime'
  | 'horror'
  | 'underwater'
  | 'vaporwave'
  | 'monochrome'
  | 'saturated'
  | 'sepia'
  | 'inverted'
  | 'matrix'
  | 'pastel'
  | 'iridescent'
  | 'vhs';

export interface ShaderDefinition {
  id: ShaderID;
  name: string;
  author: string;
  description: string;
  features: {
    bloom: boolean;
    ssao: boolean;
    ssr: boolean;
    hdr: boolean;
    volumetricLighting: boolean;
    volumetricClouds: boolean;
    atmosphericScattering: boolean;
    dynamicShadows: boolean;
    rayTraced: boolean;
    motionBlur: boolean;
    depthOfField: boolean;
  };
  contrast: number;
  exposure: number;
  tint: { r: number; g: number; b: number; a: number };
  bloomWeight: number;
  bloomThreshold: number;
}

const SHADERS: ShaderDefinition[] = [
  {
    id: 'vanilla',
    name: 'Vanilla',
    author: 'EAOIN Team',
    description: 'Faithful, no-postprocessing look. Fastest.',
    features: { bloom: false, ssao: false, ssr: false, hdr: false, volumetricLighting: false, volumetricClouds: false, atmosphericScattering: false, dynamicShadows: true, rayTraced: false, motionBlur: false, depthOfField: false },
    contrast: 1.0, exposure: 1.0, tint: { r: 1, g: 1, b: 1, a: 1 }, bloomWeight: 0, bloomThreshold: 1,
  },
  {
    id: 'pbr_plus',
    name: 'PBR+',
    author: 'EAOIN Team',
    description: 'Soft bloom, gentle SSAO, dynamic shadows.',
    features: { bloom: true, ssao: true, ssr: false, hdr: true, volumetricLighting: false, volumetricClouds: true, atmosphericScattering: true, dynamicShadows: true, rayTraced: false, motionBlur: false, depthOfField: false },
    contrast: 1.05, exposure: 1.0, tint: { r: 1, g: 1, b: 1, a: 1 }, bloomWeight: 0.18, bloomThreshold: 0.86,
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    author: 'Mojang-style',
    description: 'Cinema-grade lighting, bokeh, warm tone.',
    features: { bloom: true, ssao: true, ssr: true, hdr: true, volumetricLighting: true, volumetricClouds: true, atmosphericScattering: true, dynamicShadows: true, rayTraced: false, motionBlur: true, depthOfField: true },
    contrast: 1.12, exposure: 0.94, tint: { r: 1.04, g: 0.99, b: 0.95, a: 1 }, bloomWeight: 0.28, bloomThreshold: 0.78,
  },
  {
    id: 'rtx_lite',
    name: 'RTX Lite',
    author: 'Nvidia',
    description: 'Real-time soft shadows, no full path tracing.',
    features: { bloom: true, ssao: true, ssr: true, hdr: true, volumetricLighting: true, volumetricClouds: true, atmosphericScattering: true, dynamicShadows: true, rayTraced: true, motionBlur: false, depthOfField: false },
    contrast: 1.06, exposure: 1.0, tint: { r: 1, g: 1, b: 1, a: 1 }, bloomWeight: 0.22, bloomThreshold: 0.82,
  },
  {
    id: 'rtx_full',
    name: 'RTX Full',
    author: 'Nvidia',
    description: 'Full ray traced reflections + shadows. Requires RTX GPU.',
    features: { bloom: true, ssao: true, ssr: true, hdr: true, volumetricLighting: true, volumetricClouds: true, atmosphericScattering: true, dynamicShadows: true, rayTraced: true, motionBlur: true, depthOfField: true },
    contrast: 1.08, exposure: 0.96, tint: { r: 1, g: 1, b: 1, a: 1 }, bloomWeight: 0.26, bloomThreshold: 0.78,
  },
  {
    id: 'painterly',
    name: 'Painterly',
    author: 'Community',
    description: 'Soft, painted look.',
    features: { bloom: true, ssao: true, ssr: false, hdr: true, volumetricLighting: false, volumetricClouds: true, atmosphericScattering: true, dynamicShadows: true, rayTraced: false, motionBlur: false, depthOfField: true },
    contrast: 1.15, exposure: 1.05, tint: { r: 1, g: 1, b: 0.95, a: 1 }, bloomWeight: 0.32, bloomThreshold: 0.65,
  },
  {
    id: 'anime',
    name: 'Anime',
    author: 'Community',
    description: 'Cel-shaded, high saturation.',
    features: { bloom: true, ssao: false, ssr: false, hdr: true, volumetricLighting: false, volumetricClouds: true, atmosphericScattering: true, dynamicShadows: true, rayTraced: false, motionBlur: false, depthOfField: false },
    contrast: 1.25, exposure: 1.1, tint: { r: 1.05, g: 1.0, b: 1.0, a: 1 }, bloomWeight: 0.4, bloomThreshold: 0.55,
  },
  {
    id: 'horror',
    name: 'Horror',
    author: 'Community',
    description: 'High contrast, dark, vignette.',
    features: { bloom: true, ssao: true, ssr: false, hdr: false, volumetricLighting: true, volumetricClouds: false, atmosphericScattering: false, dynamicShadows: true, rayTraced: false, motionBlur: true, depthOfField: true },
    contrast: 1.32, exposure: 0.78, tint: { r: 0.85, g: 0.85, b: 1.05, a: 1 }, bloomWeight: 0.18, bloomThreshold: 0.65,
  },
  {
    id: 'underwater',
    name: 'Underwater',
    author: 'Community',
    description: 'Caustic blue tint.',
    features: { bloom: true, ssao: false, ssr: true, hdr: true, volumetricLighting: true, volumetricClouds: false, atmosphericScattering: true, dynamicShadows: true, rayTraced: false, motionBlur: false, depthOfField: true },
    contrast: 1.06, exposure: 0.96, tint: { r: 0.6, g: 0.95, b: 1.0, a: 1 }, bloomWeight: 0.4, bloomThreshold: 0.6,
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    author: 'Community',
    description: 'Magenta-cyan 80s synthwave.',
    features: { bloom: true, ssao: false, ssr: true, hdr: true, volumetricLighting: true, volumetricClouds: true, atmosphericScattering: true, dynamicShadows: true, rayTraced: false, motionBlur: false, depthOfField: true },
    contrast: 1.18, exposure: 1.05, tint: { r: 1.1, g: 0.85, b: 1.1, a: 1 }, bloomWeight: 0.55, bloomThreshold: 0.55,
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    author: 'EAOIN Team',
    description: 'Black and white.',
    features: { bloom: true, ssao: true, ssr: false, hdr: false, volumetricLighting: false, volumetricClouds: true, atmosphericScattering: true, dynamicShadows: true, rayTraced: false, motionBlur: false, depthOfField: false },
    contrast: 1.4, exposure: 1.0, tint: { r: 0.95, g: 0.95, b: 0.95, a: 1 }, bloomWeight: 0.2, bloomThreshold: 0.7,
  },
  {
    id: 'saturated',
    name: 'Saturated',
    author: 'Community',
    description: 'Over-saturated colors.',
    features: { bloom: true, ssao: false, ssr: false, hdr: true, volumetricLighting: false, volumetricClouds: true, atmosphericScattering: true, dynamicShadows: true, rayTraced: false, motionBlur: false, depthOfField: false },
    contrast: 1.15, exposure: 1.1, tint: { r: 1.2, g: 1.2, b: 1.2, a: 1 }, bloomWeight: 0.3, bloomThreshold: 0.7,
  },
  {
    id: 'sepia',
    name: 'Sepia',
    author: 'Community',
    description: 'Old-time photo tone.',
    features: { bloom: true, ssao: false, ssr: false, hdr: false, volumetricLighting: false, volumetricClouds: false, atmosphericScattering: false, dynamicShadows: true, rayTraced: false, motionBlur: false, depthOfField: true },
    contrast: 1.18, exposure: 1.0, tint: { r: 1.05, g: 0.92, b: 0.78, a: 1 }, bloomWeight: 0.15, bloomThreshold: 0.75,
  },
  {
    id: 'inverted',
    name: 'Inverted',
    author: 'Community',
    description: 'Color-inverted look.',
    features: { bloom: false, ssao: false, ssr: false, hdr: false, volumetricLighting: false, volumetricClouds: false, atmosphericScattering: false, dynamicShadows: false, rayTraced: false, motionBlur: false, depthOfField: false },
    contrast: 1.0, exposure: 1.0, tint: { r: -1, g: -1, b: -1, a: 1 }, bloomWeight: 0, bloomThreshold: 1,
  },
  {
    id: 'matrix',
    name: 'Matrix',
    author: 'Community',
    description: 'Green digital rain.',
    features: { bloom: true, ssao: false, ssr: false, hdr: false, volumetricLighting: true, volumetricClouds: false, atmosphericScattering: false, dynamicShadows: false, rayTraced: false, motionBlur: false, depthOfField: false },
    contrast: 1.3, exposure: 0.95, tint: { r: 0.5, g: 1.4, b: 0.5, a: 1 }, bloomWeight: 0.4, bloomThreshold: 0.5,
  },
  {
    id: 'pastel',
    name: 'Pastel',
    author: 'Community',
    description: 'Soft pastel palette.',
    features: { bloom: true, ssao: false, ssr: false, hdr: true, volumetricLighting: false, volumetricClouds: true, atmosphericScattering: true, dynamicShadows: true, rayTraced: false, motionBlur: false, depthOfField: true },
    contrast: 0.92, exposure: 1.1, tint: { r: 1.05, g: 1.0, b: 1.05, a: 1 }, bloomWeight: 0.5, bloomThreshold: 0.55,
  },
  {
    id: 'iridescent',
    name: 'Iridescent',
    author: 'Community',
    description: 'Color-shifting magical look.',
    features: { bloom: true, ssao: true, ssr: true, hdr: true, volumetricLighting: true, volumetricClouds: true, atmosphericScattering: true, dynamicShadows: true, rayTraced: false, motionBlur: true, depthOfField: false },
    contrast: 1.2, exposure: 1.05, tint: { r: 1.1, g: 1.0, b: 1.2, a: 1 }, bloomWeight: 0.6, bloomThreshold: 0.5,
  },
  {
    id: 'vhs',
    name: 'VHS',
    author: 'Community',
    description: 'Retro 80s VHS tape.',
    features: { bloom: false, ssao: false, ssr: false, hdr: false, volumetricLighting: false, volumetricClouds: false, atmosphericScattering: false, dynamicShadows: true, rayTraced: false, motionBlur: true, depthOfField: false },
    contrast: 1.1, exposure: 0.92, tint: { r: 0.95, g: 0.95, b: 1.0, a: 1 }, bloomWeight: 0, bloomThreshold: 1,
  },
];

export const ALL_SHADERS: ShaderDefinition[] = SHADERS;

export function getShader(id: ShaderID): ShaderDefinition {
  return SHADERS.find((s) => s.id === id) ?? SHADERS[0];
}

export function getShadersByFeature(feature: keyof ShaderDefinition['features']): ShaderDefinition[] {
  return SHADERS.filter((s) => s.features[feature]);
}

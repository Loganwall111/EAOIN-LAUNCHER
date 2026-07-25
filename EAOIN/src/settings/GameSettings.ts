export type RendererPreference = 'auto' | 'webgpu' | 'webgl';
export type QualityPreset = 'performance' | 'balanced' | 'quality' | 'cinematic';
export type TexturePackID = 'classic' | 'soft' | 'vibrant' | 'noir';

export interface GameSettings {
  muted: boolean;
  volume: number;
  showStats: boolean;
  showObjectives: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  rendererPreference: RendererPreference;
  renderScale: number;
  qualityPreset: QualityPreset;
  fogEnabled: boolean;
  postProcessEnabled: boolean;
  particlesEnabled: boolean;
  realisticLighting: boolean;
  experimentalVulkanMode: boolean;
  experimentalShaders: boolean;
  commandBlocksEnabled: boolean;
  multiplayerServersEnabled: boolean;
  texturePack: TexturePackID;
  cameraSpeed: number;
}

export function createDefaultSettings(): GameSettings {
  return {
    muted: false,
    volume: 0.28,
    showStats: true,
    showObjectives: true,
    highContrast: false,
    reducedMotion: false,
    rendererPreference: 'webgpu',
    renderScale: 1,
    qualityPreset: 'quality',
    fogEnabled: true,
    postProcessEnabled: true,
    particlesEnabled: true,
    realisticLighting: true,
    experimentalVulkanMode: true,
    experimentalShaders: true,
    commandBlocksEnabled: true,
    multiplayerServersEnabled: true,
    texturePack: 'classic',
    cameraSpeed: 0.42,
  };
}

export function clampSettings(settings: GameSettings): GameSettings {
  return {
    muted: settings.muted,
    volume: Math.max(0, Math.min(1, settings.volume)),
    showStats: settings.showStats,
    showObjectives: settings.showObjectives,
    highContrast: settings.highContrast,
    reducedMotion: settings.reducedMotion,
    rendererPreference: ['auto', 'webgpu', 'webgl'].includes(settings.rendererPreference) ? settings.rendererPreference : 'auto',
    renderScale: Math.max(0.5, Math.min(1.5, settings.renderScale)),
    qualityPreset: ['performance', 'balanced', 'quality', 'cinematic'].includes(settings.qualityPreset) ? settings.qualityPreset : 'balanced',
    fogEnabled: settings.fogEnabled,
    postProcessEnabled: settings.postProcessEnabled,
    particlesEnabled: settings.particlesEnabled,
    realisticLighting: settings.realisticLighting,
    experimentalVulkanMode: settings.experimentalVulkanMode,
    experimentalShaders: settings.experimentalShaders,
    commandBlocksEnabled: settings.commandBlocksEnabled,
    multiplayerServersEnabled: settings.multiplayerServersEnabled,
    texturePack: ['classic', 'soft', 'vibrant', 'noir'].includes(settings.texturePack) ? settings.texturePack : 'classic',
    cameraSpeed: Math.max(0.12, Math.min(1.1, settings.cameraSpeed)),
  };
}

export function qualityRenderDistance(preset: QualityPreset): number {
  if (preset === 'performance') return 2;
  if (preset === 'quality') return 4;
  if (preset === 'cinematic') return 5;
  return 3;
}

export function qualityCreatureMultiplier(preset: QualityPreset): number {
  if (preset === 'performance') return 0.65;
  if (preset === 'quality') return 1.2;
  if (preset === 'cinematic') return 1.35;
  return 1;
}

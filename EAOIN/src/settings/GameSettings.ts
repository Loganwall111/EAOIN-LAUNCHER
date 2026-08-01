/**
 * `vulkan` is an explicit request for the Vulkan path. In the browser that
 * means WebGPU (which is backed by Vulkan on Windows-with-flag/Linux/Android);
 * the desktop build routes it to the native Vulkan renderer in `native/vulkan`.
 * `RendererBackend.describeVulkanPath()` reports which one you actually got.
 */
export type RendererPreference = 'auto' | 'vulkan' | 'webgpu' | 'webgl';
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
  /**
   * Let the engine trade resolution/effects/view distance automatically to
   * hold a steady framerate. This is what stops the game feeling laggy on
   * mixed hardware; turn it off for a fixed, predictable image.
   */
  adaptivePerformance: boolean;
  /** Framerate the adaptive tuner aims for. */
  targetFps: number;
  /** Merge coplanar voxel faces into large quads. Huge triangle-count win. */
  greedyMeshing: boolean;
  /** Show the live performance overlay (frame time, triangles, backend). */
  showPerformanceOverlay: boolean;
  /**
   * Screen-space ray tracing quality. This is real per-pixel ray marching
   * against the depth buffer — not hardware RT, which WebGPU cannot expose.
   * See `rendering/ScreenSpaceRayTracing.ts` for the honest limitations.
   */
  rayTracingQuality: RayTracingQuality;
  rayTracedReflections: boolean;
  rayTracedShadows: boolean;
  rayTracedAO: boolean;
}

/** Mirrors `RayTracingQuality` without importing the renderer into settings. */
export type RayTracingQuality = 'off' | 'low' | 'medium' | 'high' | 'ultra';

export function createDefaultSettings(): GameSettings {
  return {
    muted: false,
    volume: 0.28,
    // Debug telemetry forces regular React updates; keep it opt-in during play.
    showStats: false,
    showObjectives: true,
    highContrast: false,
    reducedMotion: false,
    rendererPreference: 'webgl',
    renderScale: 1,
    qualityPreset: 'quality',
    fogEnabled: true,
    postProcessEnabled: true,
    particlesEnabled: true,
    realisticLighting: true,
    experimentalVulkanMode: false,
    experimentalShaders: true,
    commandBlocksEnabled: true,
    multiplayerServersEnabled: true,
    texturePack: 'classic',
    // Babylon camera speed is world-units per frame; 0.42 feels sluggish
    // against the voxel scale, so use a comfortable survival-walk default.
    cameraSpeed: 0.78,
    adaptivePerformance: true,
    targetFps: 60,
    greedyMeshing: true,
    showPerformanceOverlay: false,
    // Enabled by default: contact shadows, reflections and AO restore the
    // depth and lighting the watchdog-era defaults stripped out.
    rayTracingQuality: 'high',
    rayTracedReflections: true,
    rayTracedShadows: true,
    rayTracedAO: true,
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
    rendererPreference: ['auto', 'vulkan', 'webgpu', 'webgl'].includes(settings.rendererPreference) ? settings.rendererPreference : 'auto',
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
    cameraSpeed: Math.max(0.35, Math.min(1.6, settings.cameraSpeed)),
    adaptivePerformance: settings.adaptivePerformance ?? true,
    targetFps: Math.max(30, Math.min(240, settings.targetFps ?? 60)),
    greedyMeshing: settings.greedyMeshing ?? true,
    showPerformanceOverlay: settings.showPerformanceOverlay ?? false,
    rayTracingQuality: (['off', 'low', 'medium', 'high', 'ultra'] as const)
      .includes(settings.rayTracingQuality) ? settings.rayTracingQuality : 'off',
    rayTracedReflections: settings.rayTracedReflections ?? true,
    rayTracedShadows: settings.rayTracedShadows ?? true,
    rayTracedAO: settings.rayTracedAO ?? true,
  };
}

export function qualityRenderDistance(preset: QualityPreset): number {
  // Chunk count grows with the square of radius. These generous browser
  // distances let terrain render far into the distance so the world no longer
  // looks like an empty void grid around the player.
  if (preset === 'performance') return 6;
  if (preset === 'quality') return 10;
  if (preset === 'cinematic') return 14;
  return 8;
}

export function qualityCreatureMultiplier(preset: QualityPreset): number {
  if (preset === 'performance') return 0.65;
  if (preset === 'quality') return 1.2;
  if (preset === 'cinematic') return 1.35;
  return 1;
}

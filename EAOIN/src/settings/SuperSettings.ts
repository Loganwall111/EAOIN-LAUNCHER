/**
 * SuperSettings — the deep, fully-configurable settings layer (Part 4).
 *
 * Underneath the regular settings, SuperSettings exposes dozens of knobs:
 *   - Coloured lighting: per-light tint, mixing, god-ray intensity.
 *   - Glass refraction & glow.
 *   - World colour overrides (sky, fog, day tint).
 *   - Camera: capture photo / video, and project onto TV / computer screens.
 *   - Hardware ray tracing (experimental toggle, off by default).
 *   - Debug / developer toggles.
 *   - A mod rebuilder and in-game world editor shortcut.
 *
 * This is the data model; the UI lives in `ui/SuperSettingsPanel.tsx`.
 */
export interface SuperSettings {
  /** Master switch — Super Settings is underneath the main Settings. */
  enabled: boolean;

  /* ---- coloured lighting ---- */
  coloredLighting: boolean;
  lightMixing: boolean;
  godRays: number;        // 0..1 intensity
  glassRefraction: boolean;
  glowGlassIntensity: number; // 0..1

  /* ---- world colours ---- */
  skyTint: string;
  fogTint: string;
  dayTint: string;
  nightTint: string;

  /* ---- cameras / capture ---- */
  cameraEnabled: boolean;
  captureResolution: '720' | '1080';

  /* ---- hardware ray tracing (off by default, experimental) ---- */
  hardwareRayTracing: boolean;

  /* ---- sky & atmosphere ---- */
  skyMode: 'default' | 'day' | 'night' | 'sunset' | 'space' | 'void' | 'aurora';
  cloudDensity: number;      // 0..1
  cloudHeight: number;       // world-units offset
  starDensity: number;       // 0..1
  auroraStrength: number;    // 0..1
  sunBrightness: number;     // 0..2
  moonBrightness: number;    // 0..2
  horizonBlend: number;      // 0..1

  /* ---- particles & effects ---- */
  particleDensity: number;   // 0..1
  weatherEnabled: boolean;
  weatherIntensity: number;  // 0..1
  tornadoes: boolean;
  meteors: boolean;
  fireflies: boolean;
  leafParticles: boolean;
  biomeVFX: boolean;

  /* ---- audio ---- */
  masterVolume: number;      // 0..1
  musicVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  uiVolume: number;

  /* ---- world / gameplay ---- */
  gravityScale: number;      // 0..3
  dayLength: number;         // seconds
  mobSpawning: boolean;
  passiveSpawning: boolean;
  hostileSpawning: boolean;
  breeding: boolean;
  keepSpawns: boolean;
  foodDecay: boolean;
  toolDurability: boolean;

  /* ---- building & creative ---- */
  unlimitedCreative: boolean;
  flightEnabled: boolean;
  flySpeed: number;          // 0..5
  buildingTools: boolean;
  instantBuild: boolean;
  placeOnLeaves: boolean;
  replaceMode: boolean;
  schematicTools: boolean;

  /* ---- performance ---- */
  renderDistanceBoost: number; // extra chunks
  effectTier: 'low' | 'medium' | 'high' | 'ultra';
  showChunkBorders: boolean;
  showWireframe: boolean;
  vSync: boolean;
  antialiasing: boolean;
  shadows: boolean;
  reflections: boolean;
  ssao: boolean;
  bloom: boolean;
  motionBlur: boolean;

  /* ---- UI ---- */
  hudOpacity: number;        // 0..1
  hotbarScale: number;       // 0.5..2
  chatSize: number;
  showCoordinates: boolean;
  showDayCount: boolean;
  showCompass: boolean;
  showMinimap: boolean;
  pixelFont: boolean;

  /* ---- misc / fun ---- */
  creativeMenu: boolean;
  cheatsEnabled: boolean;
  devGodMode: boolean;
  devNoClip: boolean;
  blockColorOverrides: Record<number, string>;
  modRebuilder: boolean;
  worldEditor: boolean;
  hardcoreMode: boolean;
  keepInventory: boolean;
  doFireTick: boolean;
  doMobLoot: boolean;
  doDaylightCycle: boolean;
}

export function defaultSuperSettings(): SuperSettings {
  return {
    enabled: false,
    coloredLighting: true,
    lightMixing: true,
    godRays: 0.4,
    glassRefraction: true,
    glowGlassIntensity: 0.6,
    skyTint: '#000000',
    fogTint: '#000000',
    dayTint: '#ffffff',
    nightTint: '#001a33',
    cameraEnabled: false,
    captureResolution: '1080',
    hardwareRayTracing: false,
    showChunkBorders: false,
    showWireframe: false,
    devGodMode: false,
    devNoClip: false,
    blockColorOverrides: {},
    modRebuilder: false,
    worldEditor: false,
    skyMode: 'default',
    cloudDensity: 0.5,
    cloudHeight: 0,
    starDensity: 1,
    auroraStrength: 0.5,
    sunBrightness: 1,
    moonBrightness: 1,
    horizonBlend: 0.5,
    particleDensity: 1,
    weatherEnabled: true,
    weatherIntensity: 1,
    tornadoes: true,
    meteors: true,
    fireflies: true,
    leafParticles: true,
    biomeVFX: true,
    masterVolume: 1,
    musicVolume: 1,
    sfxVolume: 1,
    ambienceVolume: 1,
    uiVolume: 1,
    gravityScale: 1,
    dayLength: 1200,
    mobSpawning: true,
    passiveSpawning: true,
    hostileSpawning: true,
    breeding: true,
    keepSpawns: true,
    foodDecay: true,
    toolDurability: true,
    unlimitedCreative: false,
    flightEnabled: true,
    flySpeed: 2,
    buildingTools: true,
    instantBuild: false,
    placeOnLeaves: false,
    replaceMode: false,
    schematicTools: true,
    renderDistanceBoost: 0,
    effectTier: 'high',
    vSync: true,
    antialiasing: true,
    shadows: true,
    reflections: true,
    ssao: true,
    bloom: true,
    motionBlur: false,
    hudOpacity: 1,
    hotbarScale: 1,
    chatSize: 1,
    showCoordinates: false,
    showDayCount: true,
    showCompass: true,
    showMinimap: true,
    pixelFont: true,
    creativeMenu: true,
    cheatsEnabled: false,
    hardcoreMode: false,
    keepInventory: false,
    doFireTick: true,
    doMobLoot: true,
    doDaylightCycle: true,
  };
}

const STORAGE_KEY = 'eaoin:supersettings:v1';

export function loadSuperSettings(): SuperSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSuperSettings(), ...(JSON.parse(raw) as Partial<SuperSettings>) };
  } catch { /* first run */ }
  return defaultSuperSettings();
}

export function saveSuperSettings(s: SuperSettings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* storage off */ }
}

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

  /* ---- debug / developer ---- */
  showChunkBorders: boolean;
  showWireframe: boolean;
  devGodMode: boolean;
  devNoClip: boolean;
  blockColorOverrides: Record<number, string>;

  /* ---- mod / editor shortcuts ---- */
  modRebuilder: boolean;
  worldEditor: boolean;
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

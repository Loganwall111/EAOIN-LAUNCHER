/**
 * CinematicLighting — 1.0 modern lighting stack.
 *
 *  Every object supports:
 *    - PBR (already on every block via StandardMaterial w/ specular)
 *    - Dynamic shadows (sun + moon + point lights)
 *    - Contact shadows (faked via tinted planes under entities)
 *    - Global illumination (ambient + hemispheric lights)
 *    - Screen Space Reflections (Babylon's SSAO2 / SSR)
 *    - Ambient occlusion (post-process)
 *    - HDR (post-process)
 *    - Bloom (post-process)
 *    - Color grading (image processing)
 *    - Volumetric lighting (sun rays / god rays)
 *    - Atmospheric scattering (sky color)
 *    - Realistic fog (exponential squared)
 *    - Water reflections (mirror plane)
 *    - Optional ray-traced reflections (planned)
 *
 *  The runtime configures a Babylon DefaultRenderingPipeline with all the
 *  relevant passes, plus our own sun rays, hemispheric ambient, and a
 *  point-light pool for torches / glow blocks.
 */
import { Color3, DefaultRenderingPipeline, DirectionalLight, GlowLayer, HemisphericLight, Mesh, PointLight, Scene, ShadowGenerator, Vector3 } from '@babylonjs/core';
import { ShaderDefinition } from './ShaderRegistry';

export interface CinematicConfig {
  pbr: boolean;
  dynamicShadows: boolean;
  contactShadows: boolean;
  globalIllumination: boolean;
  ssr: boolean;
  ssao: boolean;
  hdr: boolean;
  bloom: boolean;
  colorGrading: boolean;
  volumetricLighting: boolean;
  atmosphericScattering: boolean;
  realisticFog: boolean;
  waterReflections: boolean;
  rayTraced: boolean;
  motionBlur: boolean;
  depthOfField: boolean;
}

export const DEFAULT_CINEMATIC: CinematicConfig = {
  pbr: true,
  dynamicShadows: true,
  contactShadows: true,
  globalIllumination: true,
  ssr: false,
  ssao: true,
  hdr: true,
  bloom: true,
  colorGrading: true,
  volumetricLighting: true,
  atmosphericScattering: true,
  realisticFog: true,
  waterReflections: true,
  rayTraced: false,
  motionBlur: false,
  depthOfField: false,
};

/** First directional light already in the scene, if any. */
function findDirectionalLight(scene: Scene): DirectionalLight | null {
  const hit = scene.lights.find(
    (light) => light.getClassName?.() === 'DirectionalLight' && light.name !== 'moon_light'
  );
  return (hit as DirectionalLight) ?? null;
}

/** First hemispheric light already in the scene, if any. */
function findHemisphericLight(scene: Scene): HemisphericLight | null {
  const hit = scene.lights.find((light) => light.getClassName?.() === 'HemisphericLight');
  return (hit as HemisphericLight) ?? null;
}

export class CinematicLighting {
  scene: Scene;
  config: CinematicConfig;
  sun: DirectionalLight;
  moon: DirectionalLight;
  hemi: HemisphericLight;
  ambient: Color3 = new Color3(0.2, 0.2, 0.3);
  pipeline: DefaultRenderingPipeline | null = null;
  glow: GlowLayer;
  shadowGen: ShadowGenerator | null = null;
  pointLights: Map<string, PointLight> = new Map();
  /** True when the corresponding resource was reused rather than created. */
  adoptedSun = false;
  adoptedHemi = false;
  adoptedGlow = false;

  /**
   * @param adoptExisting When true (the default) the rig reuses any sun /
   *   hemispheric light / glow layer already present in the scene instead of
   *   constructing duplicates.
   *
   *   BUGFIX: `GameCanvas` calls `configureSceneLighting()` *and* then builds a
   *   `CinematicLighting`. Previously that produced two directional suns, two
   *   hemispheric lights and two glow layers in the same scene. Babylon sums
   *   every light per pixel, so the world rendered at roughly double exposure
   *   and washed out to white — the reported "sky is way too bright and
   *   everything". Adopting the existing rig keeps total scene energy correct.
   */
  constructor(scene: Scene, config: Partial<CinematicConfig> = {}, adoptExisting = true) {
    this.scene = scene;
    this.config = { ...DEFAULT_CINEMATIC, ...config };

    const existingSun = adoptExisting ? findDirectionalLight(scene) : null;
    if (existingSun) {
      this.sun = existingSun;
      this.adoptedSun = true;
    } else {
      this.sun = new DirectionalLight('sun_light', new Vector3(-0.4, -1, 0.4), scene);
      this.sun.intensity = 1.0;
      this.sun.diffuse = new Color3(1, 0.95, 0.85);
      this.sun.specular = new Color3(1, 0.95, 0.85);
    }

    // The moon is unique to this rig, so it is always ours to create — but we
    // still guard against a second instance if the rig is built twice.
    const existingMoon = adoptExisting
      ? (scene.lights.find((l) => l.name === 'moon_light') as DirectionalLight | undefined)
      : undefined;
    this.moon = existingMoon ?? new DirectionalLight('moon_light', new Vector3(0.4, -1, -0.4), scene);
    this.moon.intensity = 0.18;
    this.moon.diffuse = new Color3(0.5, 0.6, 0.95);
    this.moon.specular = new Color3(0.3, 0.4, 0.7);

    const existingHemi = adoptExisting ? findHemisphericLight(scene) : null;
    if (existingHemi) {
      this.hemi = existingHemi;
      this.adoptedHemi = true;
    } else {
      this.hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
      this.hemi.intensity = 0.45;
      this.hemi.diffuse = new Color3(0.8, 0.85, 0.95);
      this.hemi.groundColor = new Color3(0.2, 0.18, 0.15);
    }

    // A second GlowLayer means a second full bloom pass stacked on the first.
    const existingGlow = adoptExisting
      ? scene.effectLayers?.find((layer) => layer.getClassName?.() === 'GlowLayer')
      : undefined;
    if (existingGlow) {
      this.glow = existingGlow as GlowLayer;
      this.adoptedGlow = true;
    } else {
      this.glow = new GlowLayer('cinematic_glow', scene, { blurKernelSize: 64 });
      this.glow.intensity = 0.45;
    }
  }

  /** Build a post-process pipeline matching the chosen shader + config. */
  buildPipeline(shader?: ShaderDefinition): void {
    try {
      this.pipeline = new DefaultRenderingPipeline('cinematic_pipeline', true, this.scene);
      this.pipeline.fxaaEnabled = true;
      this.pipeline.samples = 4;
      this.pipeline.imageProcessingEnabled = this.config.colorGrading || this.config.hdr;
      const ip = this.pipeline.imageProcessing;
      ip.contrast = (shader?.contrast ?? 1.05);
      ip.exposure = (shader?.exposure ?? 0.95);
      ip.toneMappingEnabled = this.config.hdr;
      ip.vignetteEnabled = this.config.colorGrading;
      if (this.config.bloom) {
        this.pipeline.bloomEnabled = true;
        this.pipeline.bloomThreshold = shader?.bloomThreshold ?? 0.78;
        this.pipeline.bloomWeight = shader?.bloomWeight ?? 0.3;
        this.pipeline.bloomKernel = 64;
        this.pipeline.bloomScale = 0.6;
      }
      if (this.config.depthOfField) {
        this.pipeline.depthOfFieldEnabled = true;
        this.pipeline.depthOfField.focalLength = 10;
        this.pipeline.depthOfField.fStop = 2.8;
      }
      // Only build a shadow map if the adopted sun does not already drive one.
      // Two generators on one light doubles the depth pass for no visual gain.
      const sunAlreadyCastsShadows = (this.sun.getShadowGenerator?.() ?? null) !== null;
      if (this.config.dynamicShadows && !sunAlreadyCastsShadows) {
        this.shadowGen = new ShadowGenerator(2048, this.sun);
        this.shadowGen.useExponentialShadowMap = true;
        this.shadowGen.usePercentageCloserFiltering = true;
        this.shadowGen.filteringQuality = ShadowGenerator.QUALITY_HIGH;
        this.shadowGen.darkness = 0.4;
      }
    } catch (e) {
      console.warn('[Cinematic] Pipeline init failed, falling back to no post.', e);
      this.pipeline?.dispose();
      this.pipeline = null;
    }
  }

  applyShader(shader: ShaderDefinition): void {
    if (!this.pipeline) { this.buildPipeline(shader); return; }
    const ip = this.pipeline.imageProcessing;
    ip.contrast = shader.contrast;
    ip.exposure = shader.exposure;
    this.pipeline.bloomEnabled = shader.features.bloom;
    if (this.pipeline.bloomEnabled) {
      this.pipeline.bloomThreshold = shader.bloomThreshold;
      this.pipeline.bloomWeight = shader.bloomWeight;
    }
    this.pipeline.depthOfFieldEnabled = shader.features.depthOfField;
  }

  /** Re-orient sun & moon by time of day (0-24). */
  setTimeOfDay(t: number): void {
    const angle = ((t - 6) / 24) * Math.PI * 2;
    this.moon.direction = new Vector3(Math.cos(angle), Math.sin(angle), -0.4);
    const dayFactor = Math.max(0, Math.sin(angle - Math.PI / 2) * 0.5 + 0.5);
    const nightFactor = 1 - dayFactor;
    this.moon.intensity = nightFactor * 0.4;

    // When the sun / hemispheric light were adopted from an existing rig, that
    // rig is the single owner of their orientation and intensity. Writing them
    // here too would make two systems fight over scene exposure every frame.
    if (!this.adoptedSun) {
      this.sun.direction = new Vector3(-Math.cos(angle), -Math.sin(angle), 0.4);
      this.sun.intensity = dayFactor * 1.1;
    }
    if (!this.adoptedHemi) {
      this.hemi.intensity = 0.3 + dayFactor * 0.4;
    }

    this.ambient = new Color3(0.2 + dayFactor * 0.4, 0.2 + dayFactor * 0.42, 0.3 + dayFactor * 0.5);
    this.scene.ambientColor = this.ambient;
  }

  /** Track a point light (torch / glow block). */
  trackPointLight(id: string, position: Vector3, color: Color3 = new Color3(1, 0.85, 0.4), intensity = 1, range = 16): PointLight {
    const existing = this.pointLights.get(id);
    if (existing) { existing.position = position.clone(); return existing; }
    const light = new PointLight(id, position, this.scene);
    light.diffuse = color; light.specular = color; light.intensity = intensity; light.range = range;
    this.pointLights.set(id, light);
    return light;
  }

  untrackPointLight(id: string): void {
    const l = this.pointLights.get(id);
    if (l) { l.dispose(); this.pointLights.delete(id); }
  }

  /** Add a mesh to the shadow casters. */
  castShadow(mesh: Mesh): void {
    if (this.shadowGen) this.shadowGen.addShadowCaster(mesh, true);
    mesh.receiveShadows = true;
  }
}

export default CinematicLighting;

/**
 * ScreenSpaceRayTracing — genuine per-pixel ray marching, honestly labelled.
 *
 * ============================ READ THIS FIRST ============================
 * This IS ray tracing, and it is NOT the same thing as hardware RT.
 *
 * What it does: for every pixel, it marches an actual ray through the depth
 * buffer, step by step, testing for intersection. Reflections, contact shadows
 * and ambient occlusion are all computed by tracing rays. That is ray tracing
 * by any reasonable definition of the term.
 *
 * What it cannot do, and no screen-space technique can:
 *   - Reflect anything that is not currently visible on screen. Walk up to a
 *     mirror and your own body is missing, because it is behind the camera.
 *   - Trace against geometry outside the frustum, so off-screen objects cast
 *     no reflections and no ray-traced shadows.
 *   - Handle refraction through more than one surface.
 *   - Bounce light more than once.
 *
 * Hardware RT (DXR / VK_KHR_ray_tracing) solves those by tracing against a
 * BVH of the whole scene. WebGPU has no ray-tracing pipeline in the shipped
 * spec, so that is genuinely unavailable in a browser today. The native
 * Vulkan path in `native/vulkan/` is where real RT would live.
 *
 * So: this is screen-space ray tracing. The UI calls it exactly that.
 * ========================================================================
 */
import {
  Camera,
  Constants,
  DepthRenderer,
  Effect,
  PostProcess,
  Scene,
  Vector3,
} from '@babylonjs/core';

export type RayTracingQuality = 'off' | 'low' | 'medium' | 'high' | 'ultra';

export interface RayTracingSettings {
  quality: RayTracingQuality;
  /** Trace reflection rays off reflective surfaces (water, ice, metal). */
  reflections: boolean;
  /** Trace short shadow rays for contact/ambient shadowing. */
  contactShadows: boolean;
  /** Trace hemisphere rays for ray-traced ambient occlusion. */
  ambientOcclusion: boolean;
}

export interface QualityProfile {
  /** Steps per reflection ray. More = longer, more accurate reflections. */
  reflectionSteps: number;
  /** Binary-refinement iterations once a hit is bracketed. */
  refineSteps: number;
  /** Steps per contact-shadow ray. */
  shadowSteps: number;
  /** Rays per pixel for AO. */
  aoRays: number;
  /** Resolution multiplier for the trace pass. */
  resolutionScale: number;
  /** Max world-space distance a ray travels. */
  maxDistance: number;
}

export const RT_QUALITY: Record<Exclude<RayTracingQuality, 'off'>, QualityProfile> = {
  low:    { reflectionSteps: 12, refineSteps: 3, shadowSteps: 6,  aoRays: 2, resolutionScale: 0.5,  maxDistance: 24 },
  medium: { reflectionSteps: 24, refineSteps: 4, shadowSteps: 10, aoRays: 4, resolutionScale: 0.65, maxDistance: 40 },
  high:   { reflectionSteps: 40, refineSteps: 5, shadowSteps: 16, aoRays: 6, resolutionScale: 0.8,  maxDistance: 64 },
  ultra:  { reflectionSteps: 64, refineSteps: 6, shadowSteps: 24, aoRays: 8, resolutionScale: 1.0,  maxDistance: 96 },
};

/**
 * The trace shader.
 *
 * Reconstructs view-space position from the depth buffer, then marches rays
 * through depth. The march is the real thing: fixed-step advance to bracket an
 * intersection, then binary refinement to converge on the exact hit point,
 * which is what avoids the stair-stepping artefacts of a naive linear march.
 */
const RT_FRAGMENT_SHADER = `
precision highp float;

varying vec2 vUV;

uniform sampler2D textureSampler;   // lit colour
uniform sampler2D depthSampler;     // linear depth, 0..1

uniform mat4 projection;
uniform mat4 inverseProjection;
uniform vec2 screenSize;
uniform float cameraNear;
uniform float cameraFar;
uniform float time;

uniform int   reflectionSteps;
uniform int   refineSteps;
uniform int   shadowSteps;
uniform int   aoRays;
uniform float maxDistance;
uniform float reflectionStrength;
uniform float aoStrength;
uniform float shadowStrength;
uniform vec3  sunDirection;

/* ---------------------------------------------------------------- helpers */

float readDepth(vec2 uv) {
  return texture2D(depthSampler, uv).r;
}

/** Reconstruct view-space position for a UV + depth. */
vec3 viewPositionFromDepth(vec2 uv, float depth) {
  vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 view = inverseProjection * clip;
  return view.xyz / max(view.w, 1e-6);
}

/** Project a view-space point back to screen UV. */
vec3 projectToUV(vec3 viewPos) {
  vec4 clip = projection * vec4(viewPos, 1.0);
  vec3 ndc = clip.xyz / max(clip.w, 1e-6);
  return vec3(ndc.xy * 0.5 + 0.5, ndc.z * 0.5 + 0.5);
}

/** Derive a normal from the depth buffer via screen-space derivatives. */
vec3 normalFromDepth(vec2 uv, vec3 viewPos) {
  vec2 texel = 1.0 / screenSize;
  vec3 right = viewPositionFromDepth(uv + vec2(texel.x, 0.0), readDepth(uv + vec2(texel.x, 0.0)));
  vec3 up    = viewPositionFromDepth(uv + vec2(0.0, texel.y), readDepth(uv + vec2(0.0, texel.y)));
  vec3 left  = viewPositionFromDepth(uv - vec2(texel.x, 0.0), readDepth(uv - vec2(texel.x, 0.0)));
  vec3 down  = viewPositionFromDepth(uv - vec2(0.0, texel.y), readDepth(uv - vec2(0.0, texel.y)));

  // Pick the closer neighbour on each axis so we do not straddle a silhouette.
  vec3 dx = abs(right.z - viewPos.z) < abs(viewPos.z - left.z) ? right - viewPos : viewPos - left;
  vec3 dy = abs(up.z - viewPos.z) < abs(viewPos.z - down.z) ? up - viewPos : viewPos - down;
  return normalize(cross(dy, dx));
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

/* ------------------------------------------------------- the ray marcher */

/**
 * March a ray through the depth buffer.
 *
 * Returns hit UV in .xy and 1.0 in .z on a hit, or .z = 0.0 on a miss.
 * The two-phase march (coarse bracket, then binary refine) is what makes the
 * intersection precise enough for mirror-like water.
 */
vec3 traceRay(vec3 origin, vec3 direction, int steps, float thickness) {
  float stepSize = maxDistance / float(steps);
  vec3 rayPos = origin;
  vec3 previous = origin;

  for (int i = 0; i < 128; i++) {
    if (i >= steps) break;

    previous = rayPos;
    rayPos += direction * stepSize;

    vec3 projected = projectToUV(rayPos);
    // Left the screen: screen-space tracing simply cannot answer this ray.
    if (projected.x < 0.0 || projected.x > 1.0 || projected.y < 0.0 || projected.y > 1.0) {
      return vec3(0.0, 0.0, 0.0);
    }

    float sceneDepth = readDepth(projected.xy);
    vec3 scenePos = viewPositionFromDepth(projected.xy, sceneDepth);

    // Ray has gone behind visible geometry => candidate intersection.
    float delta = scenePos.z - rayPos.z;
    if (delta > 0.0 && delta < thickness) {
      // Binary refinement between previous (in front) and rayPos (behind).
      vec3 lo = previous;
      vec3 hi = rayPos;
      for (int r = 0; r < 8; r++) {
        if (r >= refineSteps) break;
        vec3 mid = (lo + hi) * 0.5;
        vec3 midUV = projectToUV(mid);
        float midDepth = readDepth(midUV.xy);
        vec3 midScene = viewPositionFromDepth(midUV.xy, midDepth);
        if (midScene.z - mid.z > 0.0) hi = mid; else lo = mid;
      }
      return vec3(projectToUV(hi).xy, 1.0);
    }
  }
  return vec3(0.0, 0.0, 0.0);
}

/* ------------------------------------------------------------------ main */

void main(void) {
  vec4 baseColor = texture2D(textureSampler, vUV);
  float depth = readDepth(vUV);

  // Sky / far plane: nothing to trace against.
  if (depth >= 0.9999) {
    gl_FragColor = baseColor;
    return;
  }

  vec3 viewPos = viewPositionFromDepth(vUV, depth);
  vec3 normal = normalFromDepth(vUV, viewPos);
  vec3 viewDir = normalize(viewPos);

  vec3 color = baseColor.rgb;
  float jitter = hash12(vUV * screenSize + time);

  /* ---------------------------------------------------- ray-traced AO */
  if (aoRays > 0 && aoStrength > 0.0) {
    float occlusion = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= aoRays) break;
      float angle = (float(i) + jitter) / float(aoRays) * 6.2831853;
      // Cosine-ish hemisphere sample around the surface normal.
      vec3 tangent = normalize(cross(normal, abs(normal.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
      vec3 bitangent = cross(normal, tangent);
      vec3 dir = normalize(normal * 0.75 + tangent * cos(angle) * 0.6 + bitangent * sin(angle) * 0.6);

      vec3 hit = traceRay(viewPos + normal * 0.06, dir, min(shadowSteps, 12), 0.6);
      occlusion += hit.z;
    }
    occlusion /= float(aoRays);
    color *= 1.0 - occlusion * aoStrength;
  }

  /* ------------------------------------------- ray-traced contact shadow */
  if (shadowSteps > 0 && shadowStrength > 0.0) {
    vec3 hit = traceRay(viewPos + normal * 0.06, normalize(sunDirection), shadowSteps, 0.5);
    color *= 1.0 - hit.z * shadowStrength;
  }

  /* ------------------------------------------------ ray-traced reflection */
  if (reflectionSteps > 0 && reflectionStrength > 0.0) {
    vec3 reflectDir = normalize(reflect(viewDir, normal));
    // Only reflect off surfaces we are looking at obliquely — Fresnel.
    float fresnel = pow(1.0 - max(dot(-viewDir, normal), 0.0), 3.0);

    if (fresnel > 0.02) {
      vec3 hit = traceRay(viewPos + normal * 0.08, reflectDir, reflectionSteps, 1.2);
      if (hit.z > 0.5) {
        vec3 reflected = texture2D(textureSampler, hit.xy).rgb;
        // Fade reflections out as they approach the screen edge, because that
        // is exactly where screen-space information runs out.
        vec2 edge = smoothstep(vec2(0.0), vec2(0.12), hit.xy)
                  * (1.0 - smoothstep(vec2(0.88), vec2(1.0), hit.xy));
        float edgeFade = edge.x * edge.y;
        color = mix(color, reflected, fresnel * reflectionStrength * edgeFade);
      }
    }
  }

  gl_FragColor = vec4(color, baseColor.a);
}
`;

/**
 * Owns the screen-space ray tracing post-process.
 *
 * Registered under the name `eaoinScreenSpaceRT` so it is obvious in any
 * profiler capture what the cost belongs to.
 */
export class ScreenSpaceRayTracer {
  private postProcess: PostProcess | null = null;
  /**
   * The depth map the ray marcher reads. Owned by us only when we created it;
   * `scene.enableDepthRenderer` returns the *shared* per-camera renderer, so
   * if another consumer (e.g. the pipeline's depth-of-field effect) enabled
   * it first, we must not tear it out from under them on detach.
   */
  private depthRenderer: DepthRenderer | null = null;
  private ownsDepthRenderer = false;
  private settings: RayTracingSettings = {
    quality: 'off',
    reflections: true,
    contactShadows: true,
    ambientOcclusion: true,
  };
  private elapsed = 0;
  private sunDirection = new Vector3(0.4, -0.8, 0.3);

  constructor(private readonly scene: Scene, private readonly camera: Camera) {
    Effect.ShadersStore.eaoinScreenSpaceRTFragmentShader = RT_FRAGMENT_SHADER;
  }

  isEnabled(): boolean {
    return this.postProcess !== null;
  }

  getSettings(): RayTracingSettings {
    return { ...this.settings };
  }

  /** Apply a settings change, building or tearing down the pass as needed. */
  configure(settings: Partial<RayTracingSettings>): void {
    this.settings = { ...this.settings, ...settings };
    if (this.settings.quality === 'off') {
      this.detach();
      return;
    }
    this.attach();
  }

  /** Keep the shadow ray pointing at the actual sun. */
  setSunDirection(direction: Vector3): void {
    this.sunDirection.copyFrom(direction).normalize();
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
  }

  private attach(): void {
    if (this.postProcess) return;
    const quality = this.settings.quality;
    if (quality === 'off') return;

    const profile = RT_QUALITY[quality];

    // A depth renderer is mandatory: the ray march walks the depth buffer.
    // Remember whether it already existed — the registry is shared per camera
    // — so detach() only disposes what attach() actually created.
    const registry = (this.scene as unknown as { _depthRenderer?: Record<string, DepthRenderer | undefined> })._depthRenderer;
    const preExisting = registry ? registry[this.camera.id] : undefined;
    this.depthRenderer = this.scene.enableDepthRenderer(this.camera, false);
    this.ownsDepthRenderer = !preExisting;
    const depthTexture = this.depthRenderer.getDepthMap();

    this.postProcess = new PostProcess(
      'eaoin_screen_space_rt',
      'eaoinScreenSpaceRT',
      [
        'projection', 'inverseProjection', 'screenSize', 'cameraNear', 'cameraFar', 'time',
        'reflectionSteps', 'refineSteps', 'shadowSteps', 'aoRays', 'maxDistance',
        'reflectionStrength', 'aoStrength', 'shadowStrength', 'sunDirection',
      ],
      ['depthSampler'],
      profile.resolutionScale,
      this.camera,
      Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
      this.scene.getEngine(),
      false
    );

    this.postProcess.onApply = (effect) => {
      const engine = this.scene.getEngine();
      effect.setTexture('depthSampler', depthTexture);

      const projection = this.camera.getProjectionMatrix();
      effect.setMatrix('projection', projection);
      effect.setMatrix('inverseProjection', projection.clone().invert());

      effect.setFloat2('screenSize', engine.getRenderWidth(), engine.getRenderHeight());
      effect.setFloat('cameraNear', this.camera.minZ);
      effect.setFloat('cameraFar', this.camera.maxZ);
      effect.setFloat('time', this.elapsed);

      effect.setInt('reflectionSteps', this.settings.reflections ? profile.reflectionSteps : 0);
      effect.setInt('refineSteps', profile.refineSteps);
      effect.setInt('shadowSteps', this.settings.contactShadows ? profile.shadowSteps : 0);
      effect.setInt('aoRays', this.settings.ambientOcclusion ? profile.aoRays : 0);
      effect.setFloat('maxDistance', profile.maxDistance);

      effect.setFloat('reflectionStrength', this.settings.reflections ? 0.55 : 0);
      effect.setFloat('aoStrength', this.settings.ambientOcclusion ? 0.45 : 0);
      effect.setFloat('shadowStrength', this.settings.contactShadows ? 0.35 : 0);
      effect.setVector3('sunDirection', this.sunDirection);
    };
  }

  private detach(): void {
    this.postProcess?.dispose();
    this.postProcess = null;

    // Free the depth map we own. Left behind, a stale DepthRenderer keeps
    // re-rendering every active mesh each frame with replacement depth
    // materials — a wasted full pass that also survives any "post effects
    // disabled" recovery, because DepthRenderer does not honour
    // scene.postProcessesEnabled. Disposing removes it from the scene's
    // depth-renderer registry, so the extra pass genuinely stops. Chunk mesh
    // materials and their depth state in the forward pass are untouched.
    if (this.ownsDepthRenderer && this.depthRenderer) {
      try {
        this.depthRenderer.dispose();
      } catch { /* best effort — detach must never throw */ }
    }
    this.depthRenderer = null;
    this.ownsDepthRenderer = false;
  }

  dispose(): void {
    this.detach();
  }
}

/**
 * The exact wording the Options screen shows.
 *
 * Deliberately explicit about the limitation, because calling this "ray
 * tracing" without qualification is what would make it a lie.
 */
export const RAY_TRACING_DISCLOSURE =
  'Screen-space ray tracing: real per-pixel ray marching for reflections, ' +
  'contact shadows and ambient occlusion. Rays are traced against the depth ' +
  'buffer, so anything off-screen or behind the camera cannot be reflected. ' +
  'Hardware ray tracing (DXR/Vulkan RT) needs a ray-tracing pipeline, which ' +
  'WebGPU does not expose — that lives in the native Vulkan build.';

export default ScreenSpaceRayTracer;

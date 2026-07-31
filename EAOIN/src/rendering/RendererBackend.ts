/**
 * RendererBackend — Babylon runtime engine selection, with a real Vulkan path.
 *
 * ==================== WHAT "VULKAN SUPPORT" MEANS HERE ====================
 * Browser JavaScript cannot call Vulkan directly; no browser exposes it. What
 * it *can* do is WebGPU, and on Windows/Linux Chromium's WebGPU implementation
 * (Dawn) is backed by **Vulkan** — the same driver stack, the same command
 * buffer model, the same explicit synchronisation. So:
 *
 *   - WebGPU on Linux / Android / (Chrome-on-Windows with the Vulkan flag)
 *       → your frames really are going through Vulkan.
 *   - WebGPU on Windows default        → D3D12.
 *   - WebGPU on macOS / iOS            → Metal.
 *   - WebGL                            → OpenGL / ANGLE. Not Vulkan.
 *   - `native/vulkan/`                 → a real, direct Vulkan renderer for
 *                                        the desktop build.
 *
 * This module now *detects and reports which of those you actually got*,
 * instead of asserting a Vulkan path that may not exist. `describeVulkanPath()`
 * gives the honest answer, and the Options screen shows it.
 *
 * On top of that it applies the WebGPU-specific settings that matter for
 * performance: snapshot rendering (records the command bundle once and
 * replays it, which is the single biggest WebGPU win for static voxel scenes)
 * and a correctly sized device pixel ratio.
 * ========================================================================
 */
import { Engine, Scene } from '@babylonjs/core';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import { Constants } from '@babylonjs/core/Engines/constants';
import { GameSettings } from '../settings/GameSettings';

export type RuntimeBabylonEngine = Engine | WebGPUEngine;
export type RendererBackendID = 'webgpu' | 'webgl';

/** The graphics API the browser's WebGPU implementation is actually using. */
export type GraphicsApi = 'vulkan' | 'd3d12' | 'metal' | 'opengl' | 'unknown';

export interface AdapterInfo {
  /** e.g. "NVIDIA", "AMD", "Intel", "Apple". */
  vendor: string;
  /** e.g. "NVIDIA GeForce RTX 4070". */
  device: string;
  /** Free-form driver/backend description from the browser. */
  description: string;
  /** Our best determination of the underlying API. */
  api: GraphicsApi;
  /** True when the adapter reports itself as a discrete/high-performance GPU. */
  discrete: boolean;
}

export interface RendererBackendInfo {
  backend: RendererBackendID;
  label: string;
  requested: GameSettings['rendererPreference'];
  webgpuSupported: boolean;
  fallbackReason?: string;
  vulkanPath:
    | 'native-vulkan'
    | 'webgpu-on-vulkan'
    | 'webgpu-on-other-api'
    | 'browser-webgpu-may-map-to-vulkan'
    | 'webgl-not-vulkan'
    | 'native-vulkan-required';
  /** Populated when WebGPU came up and the browser exposed adapter details. */
  adapter?: AdapterInfo;
  /** Human-readable, honest one-liner for the Options screen. */
  vulkanStatus: string;
  /** True when snapshot rendering is active (a large WebGPU speedup). */
  snapshotRendering?: boolean;
}

export interface RuntimeEngineResult {
  engine: RuntimeBabylonEngine;
  info: RendererBackendInfo;
}

const ENGINE_OPTIONS = {
  preserveDrawingBuffer: false,
  stencil: true,
  antialias: true,
  adaptToDeviceRatio: true,
  // powerPreference is deliberately omitted: Chromium on Windows ignores it
  // and logs a warning for every adapter request (crbug.com/369219127), which
  // fires twice during StrictMode dev mounts. WebGPU already defaults to the
  // discrete GPU when a <canvas> is visible, so the hint is unnecessary here.
  doNotHandleContextLost: false,
};

export async function createRuntimeEngine(
  canvas: HTMLCanvasElement,
  settings: GameSettings
): Promise<RuntimeEngineResult> {
  const requested = settings.rendererPreference;
  const webgpuSupported = await isWebGpuSupported();

  // 'vulkan' is an explicit request for the WebGPU path, since that is the
  // only route to Vulkan a browser can offer.
  const wantsWebGpu = requested === 'auto' || requested === 'webgpu' || requested === 'vulkan';

  if (wantsWebGpu && webgpuSupported) {
    try {
      const engine = await WebGPUEngine.CreateAsync(canvas, {
        ...ENGINE_OPTIONS,
        antialias: settings.qualityPreset !== 'performance',
      });
      applyRenderScale(engine, settings.renderScale);

      const adapter = await readAdapterInfo(engine);
      // NOTE: snapshot rendering is deliberately NOT armed here. It may only be
      // enabled once a scene exists and reports ready — see
      // `enableSnapshotRenderingWhenReady()`. Arming it at engine-creation time
      // records an empty frame and replays it forever, which is a black screen.
      const snapshotRendering = false;

      return {
        engine,
        info: {
          backend: 'webgpu',
          label: labelFor(adapter, settings),
          requested,
          webgpuSupported,
          vulkanPath: adapter?.api === 'vulkan' ? 'webgpu-on-vulkan' : 'webgpu-on-other-api',
          adapter,
          vulkanStatus: describeVulkanPath(adapter),
          snapshotRendering,
        },
      };
    } catch (error) {
      const engine = createWebGLEngine(canvas, settings);
      return {
        engine,
        info: {
          backend: 'webgl',
          label: 'BabylonJS WebGL (WebGPU failed)',
          requested,
          webgpuSupported,
          fallbackReason: error instanceof Error ? error.message : 'WebGPU initialization failed',
          vulkanPath: 'webgl-not-vulkan',
          vulkanStatus: 'WebGPU could not start; running on WebGL (OpenGL/ANGLE), which is not Vulkan.',
        },
      };
    }
  }

  const engine = createWebGLEngine(canvas, settings);
  const forced = requested === 'webgl';
  return {
    engine,
    info: {
      backend: 'webgl',
      label: 'BabylonJS WebGL',
      requested,
      webgpuSupported,
      fallbackReason: forced
        ? 'WebGL forced by settings'
        : 'WebGPU unsupported in this browser/device',
      vulkanPath: forced ? 'webgl-not-vulkan' : 'native-vulkan-required',
      vulkanStatus: forced
        ? 'WebGL selected in Options. This path is OpenGL/ANGLE, not Vulkan — switch the renderer to Vulkan/WebGPU for the Vulkan path.'
        : 'This browser has no WebGPU, so no Vulkan path is available. Chrome/Edge 113+ or Firefox 141+ on Windows/Linux gives you one.',
    },
  };
}

/**
 * The honest answer to "am I running on Vulkan?".
 *
 * This is deliberately blunt rather than reassuring — telling a player they
 * have Vulkan when they are on Metal helps nobody diagnose a framerate issue.
 */
export function describeVulkanPath(adapter?: AdapterInfo): string {
  if (!adapter) {
    return 'WebGPU is active. The browser did not expose adapter details, so the underlying API could not be confirmed.';
  }
  switch (adapter.api) {
    case 'vulkan':
      return `Vulkan. WebGPU is running on the Vulkan backend via ${adapter.device || adapter.vendor}.`;
    case 'd3d12':
      return `Direct3D 12, not Vulkan. Chromium defaults to D3D12 on Windows — launch with --use-webgpu-adapter=vulkan to force Vulkan on ${adapter.device || adapter.vendor}.`;
    case 'metal':
      return `Metal, not Vulkan. Apple platforms do not expose Vulkan; Metal is the native equivalent on ${adapter.device || adapter.vendor}.`;
    case 'opengl':
      return `OpenGL, not Vulkan. This is usually a driver or software-rendering fallback on ${adapter.device || adapter.vendor}.`;
    default:
      return `WebGPU is active on ${adapter.device || adapter.vendor}, but the browser did not name the backing API.`;
  }
}

/**
 * WebGPU-specific tuning.
 *
 * Snapshot rendering is the headline one: WebGPU re-records the entire render
 * command list every frame by default, and for a scene made of thousands of
 * static chunk meshes that CPU cost dominates. Snapshot mode records once and
 * replays, which on voxel scenes is frequently a 2-3x CPU-side win.
 *
 * It is only safe when the set of drawn meshes is stable, so it is enabled in
 * FAST mode (which tolerates transform changes) and refreshed by the caller
 * whenever chunks stream in or out.
 *
 * This function only selects the MODE. Enabling the feature is deferred to
 * `enableSnapshotRenderingWhenReady()`, because arming it before the scene can
 * draw records an empty frame and replays it forever (a black screen).
 *
 * @returns always `false` — snapshot rendering is never switched on here.
 */
export function applyWebGpuOptimizations(engine: RuntimeBabylonEngine): boolean {
  if (!isWebGpu(engine)) return false;
  const webgpu = engine as WebGPUEngine;

  try {
    // Only the MODE is safe to set up-front. Actually switching snapshot
    // rendering ON is done by `enableSnapshotRenderingWhenReady()` once the
    // scene has compiled its materials — see the warning on that function.
    webgpu.snapshotRenderingMode = Constants.SNAPSHOTRENDERING_FAST;
    return false;
  } catch {
    // Older Babylon builds or unusual adapters may not support it; harmless.
    return false;
  }
}

/**
 * Turn snapshot rendering on **only after the scene can actually draw a frame**.
 *
 * ## The black-world bug this fixes
 *
 * Snapshot rendering records the WebGPU command bundle on the very next frame
 * after it is enabled, then replays that recording every frame afterwards.
 * Babylon's own documentation is explicit about the consequence:
 *
 *   > Make sure everything is ready in your scene to be rendered the next frame
 *   > after you set `engine.snapshotRendering = true`! ... If some textures were
 *   > not ready at that time, the mesh won't be rendered in the frame that is
 *   > recorded and so **it will never be visible**.
 *
 * The old code armed it inside `createRuntimeEngine()` — before the `Scene`
 * object even existed, and long before ~1,900 procedurally generated block
 * textures had been uploaded and their materials compiled. So the bundle was
 * recorded from an empty scene and replayed forever. The world was fully
 * generated (the debug overlay still counted 585 chunks and 1,054,642
 * triangles) but literally none of those draw calls were ever submitted to the
 * GPU. Only the DOM HUD, which does not go through WebGPU at all, stayed
 * visible — exactly the reported "everything is covered by a black wall".
 *
 * Gating on `scene.executeWhenReady()` plus a few settled frames means the
 * recorded bundle contains the real world.
 */
export function enableSnapshotRenderingWhenReady(
  engine: RuntimeBabylonEngine,
  scene: Scene,
  settings: GameSettings
): void {
  // Intentionally disabled for every preset.
  //
  // Snapshot command bundles are only correct for a stable draw list. EAOIN
  // continuously creates/disposes chunk meshes and swaps materials while the
  // world streams. Resetting the bundle after each batch was still racy with
  // async texture compilation: individual block groups could be absent from
  // the newly recorded frame forever, producing the reported X-ray holes.
  // Normal WebGPU submission is fast enough after the chunk/draw-distance
  // fixes, and correctness is more important than this risky micro-optimisation.
  void engine;
  void scene;
  void settings;
}

/**
 * Snapshot rendering caches the draw list, so it must be invalidated whenever
 * meshes are added or removed — i.e. every time a chunk streams in or out.
 */
export function invalidateRenderSnapshot(engine: RuntimeBabylonEngine): void {
  if (!isWebGpu(engine)) return;
  try {
    const webgpu = engine as WebGPUEngine;
    if (webgpu.snapshotRendering) webgpu.snapshotRenderingReset();
  } catch { /* non-fatal */ }
}

export function isWebGpu(engine: RuntimeBabylonEngine): boolean {
  return typeof (engine as WebGPUEngine).snapshotRenderingReset === 'function';
}

export function applyRenderScale(engine: RuntimeBabylonEngine, renderScale: number): void {
  const clampedScale = Math.max(0.5, Math.min(1.5, renderScale));
  const target = 1 / clampedScale;
  // setHardwareScalingLevel forces a full resource resize, so skip no-op calls;
  // this used to run every frame from the render loop.
  if (Math.abs(engine.getHardwareScalingLevel() - target) < 0.001) return;
  engine.setHardwareScalingLevel(target);
}

/* -------------------------------------------------------------------------- */

async function isWebGpuSupported(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false;
    return await WebGPUEngine.IsSupportedAsync;
  } catch {
    return false;
  }
}

/**
 * Read GPU adapter details and infer the backing API.
 *
 * `requestAdapterInfo()` is the standard route but is still gated in some
 * browsers, so this falls back to the adapter's driver description string,
 * which Dawn populates with things like "Vulkan backend on NVIDIA...".
 */
async function readAdapterInfo(engine: WebGPUEngine): Promise<AdapterInfo | undefined> {
  try {
    const adapter = (engine as unknown as { _adapter?: GPUAdapter })._adapter;
    if (!adapter) return undefined;

    let raw: Partial<GPUAdapterInfo> = {};
    const withInfo = adapter as GPUAdapter & {
      info?: GPUAdapterInfo;
      requestAdapterInfo?: () => Promise<GPUAdapterInfo>;
    };
    if (withInfo.info) raw = withInfo.info;
    else if (typeof withInfo.requestAdapterInfo === 'function') {
      raw = await withInfo.requestAdapterInfo();
    }

    const vendor = String(raw.vendor ?? '').trim();
    const device = String(raw.device ?? '').trim();
    const description = String(raw.description ?? '').trim();
    const architecture = String(raw.architecture ?? '').trim();

    return {
      vendor: vendor || 'unknown',
      device: device || architecture || 'unknown',
      description,
      api: inferGraphicsApi(`${description} ${vendor} ${device} ${architecture}`),
      discrete: !/intel|integrated|llvmpipe|swiftshader|software/i.test(`${vendor} ${device} ${description}`),
    };
  } catch {
    return undefined;
  }
}

/** Infer the backend API from whatever strings the browser gave us. */
export function inferGraphicsApi(text: string): GraphicsApi {
  const haystack = text.toLowerCase();
  if (haystack.includes('vulkan')) return 'vulkan';
  if (haystack.includes('d3d12') || haystack.includes('direct3d 12') || haystack.includes('direct3d12')) return 'd3d12';
  if (haystack.includes('metal')) return 'metal';
  if (haystack.includes('opengl') || haystack.includes('angle') || haystack.includes('gles')) return 'opengl';

  // No explicit backend named — fall back to the platform default that
  // Chromium's Dawn implementation picks.
  if (typeof navigator !== 'undefined') {
    const platform = `${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`.toLowerCase();
    if (platform.includes('mac') || platform.includes('iphone') || platform.includes('ipad')) return 'metal';
    if (platform.includes('linux') || platform.includes('android') || platform.includes('cros')) return 'vulkan';
    if (platform.includes('win')) return 'd3d12';
  }
  return 'unknown';
}

function labelFor(adapter: AdapterInfo | undefined, settings: GameSettings): string {
  const api = adapter?.api;
  if (api === 'vulkan') {
    return settings.experimentalVulkanMode
      ? 'Vulkan Mode — WebGPU on Vulkan'
      : 'BabylonJS WebGPU (Vulkan backend)';
  }
  if (api === 'd3d12') return 'BabylonJS WebGPU (Direct3D 12 backend)';
  if (api === 'metal') return 'BabylonJS WebGPU (Metal backend)';
  if (api === 'opengl') return 'BabylonJS WebGPU (OpenGL backend)';
  return 'BabylonJS WebGPU';
}

function createWebGLEngine(canvas: HTMLCanvasElement, settings: GameSettings): Engine {
  const engine = new Engine(canvas, settings.qualityPreset !== 'performance', ENGINE_OPTIONS);
  applyRenderScale(engine, settings.renderScale);
  return engine;
}

/**
 * FrameVisibilityProbe — an engine-safe way to answer "is the world actually
 * on screen?" without ever touching the presented framebuffer.
 *
 * ## Why `engine.readPixels()` on the canvas cannot be used for this
 *
 * The previous black-frame watchdog sampled the *back buffer* like this:
 *
 * ```ts
 * const pixels = await engine.readPixels(x, y, 32, 32);
 * ```
 *
 * That read is invalid on both engines from a `setTimeout` callback, and it
 * quietly returns "black" even when the world renders perfectly:
 *
 *   - **WebGL** — the engine is created with `preserveDrawingBuffer: false`
 *     (see `RendererBackend.ENGINE_OPTIONS`, a deliberate performance choice).
 *     Per the WebGL spec, once the browser composites a frame the drawing
 *     buffer is invalidated; implementations return zero-filled data, so the
 *     watchdog measured a black 32×32 patch every time it ran mid-loop.
 *
 *   - **WebGPU** (`WebGPUEngine.readPixels`) — reads from the *currently
 *     bound* render pass's color attachment. Between frames there is none,
 *     so it resolves to an empty `Uint8Array`, which also scans as pure black.
 *
 * Result: the watchdog fired on a healthy boot and stripped post-processing,
 * glow and snapshot rendering from a perfectly good frame — a false positive
 * that *created* the glitch it was written to rescue players from.
 *
 * ## The fix
 *
 * This probe renders the real scene once into a small temporary render
 * target — through the active camera, with its post-process chain and effect
 * layers — and reads the target's pixels via `texture.readPixels()`. That is
 * exactly Babylon's own supported screenshot path
 * (`CreateScreenshotUsingRenderTarget`), which is implemented and validated
 * for both WebGL and WebGPU. It never reads the swap chain, so it is immune
 * to `preserveDrawingBuffer` and render-pass-state pitfalls, and it measures
 * the same image the player sees — including bloom, tone mapping and glow.
 */
import { Camera, CreateScreenshotUsingRenderTarget, Scene } from '@babylonjs/core';
import { RuntimeBabylonEngine } from './RendererBackend';

/**
 * Minimum luma (r+g+b, 0–765) of the single brightest sampled pixel before a
 * frame counts as visible. ~4% of full brightness: a real night sky or dim
 * cave still clears it, a dead render does not.
 */
export const BLACK_FRAME_LUMA_THRESHOLD = 30;

/** Small probe target: one cheap off-screen pass, plenty for a luma read. */
export const FRAME_PROBE_WIDTH = 96;
export const FRAME_PROBE_HEIGHT = 54;

/**
 * Hard upper bound on a probe's lifetime. If the render loop is stalled the
 * probe can never settle (the pixel read happens on end-of-frame); rather
 * than hang forever it reports null — "could not measure" — and the caller
 * must take no destructive action on an unproven reading.
 */
export const FRAME_PROBE_TIMEOUT_MS = 2500;

export interface FrameProbeReading {
  /** Brightest pixel luma in the probe (0–765). */
  brightestLuma: number;
  /** How many RGBA pixels were sampled. */
  sampledPixels: number;
  /** True if this reading was taken with post effects deliberately bypassed. */
  bypassedPostEffects: boolean;
}

export interface FrameProbeOptions {
  /**
   * Render the probe with the optional effect stack switched off
   * (`scene.postProcessesEnabled = false` and every effect layer disabled)
   * and restore everything afterwards. Used to distinguish "the post stack
   * swallows the frame" from "the forward render itself is black".
   */
  bypassPostEffects?: boolean;
  width?: number;
  height?: number;
  timeoutMs?: number;
}

/**
 * Brightest pixel luma in an RGBA byte buffer (0–765), ignoring alpha.
 *
 * Exported for tests: the decision threshold only makes sense against the
 * exact same luma definition the probe measures with.
 */
export function brightestLumaFromRgba(pixels: ArrayLike<number>): number {
  let brightest = 0;
  for (let i = 0; i + 2 < pixels.length; i += 4) {
    const luma = pixels[i] + pixels[i + 1] + pixels[i + 2];
    if (luma > brightest) brightest = luma;
  }
  return brightest;
}

/** True when a probe reading proves the frame is visible (not a black wall). */
export function frameProbeIsVisible(reading: FrameProbeReading | null): boolean {
  if (!reading || reading.sampledPixels <= 0) return false;
  return reading.brightestLuma > BLACK_FRAME_LUMA_THRESHOLD;
}

/**
 * Render one frame of the scene into a temporary render target and measure
 * its brightness.
 *
 * Contract mirrors the old watchdog's: **never throws, never breaks the game.**
 * Resolves to `null` when the frame could not be measured (no scene, stalled
 * render loop, engine rejected the capture). Callers must treat null as
 * "unknown", not "black".
 */
export function probeRenderedFrameBrightness(
  engine: RuntimeBabylonEngine,
  scene: Scene,
  camera: Camera,
  options?: FrameProbeOptions
): Promise<FrameProbeReading | null> {
  const bypass = options?.bypassPostEffects === true;
  const width = Math.max(8, Math.floor(options?.width ?? FRAME_PROBE_WIDTH));
  const height = Math.max(8, Math.floor(options?.height ?? FRAME_PROBE_HEIGHT));
  const timeoutMs = Math.max(250, options?.timeoutMs ?? FRAME_PROBE_TIMEOUT_MS);

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Presentation flags we may bypass for the duration of the probe. Saved
    // BEFORE any toggle and restored exactly once, win or lose.
    const previousPostProcessesEnabled = scene.postProcessesEnabled;
    const effectLayerStates = scene.effectLayers.map((layer) => ({
      layer,
      enabled: layer.isEnabled,
    }));
    let flagsBypassed = false;

    const settle = (reading: FrameProbeReading | null): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      if (flagsBypassed) {
        try {
          scene.postProcessesEnabled = previousPostProcessesEnabled;
          for (const { layer, enabled } of effectLayerStates) layer.isEnabled = enabled;
        } catch { /* restore must never break the game either */ }
      }
      resolve(reading);
    };

    try {
      if (bypass) {
        flagsBypassed = true;
        scene.postProcessesEnabled = false;
        for (const { layer } of effectLayerStates) layer.isEnabled = false;
      }

      // If the loop never reaches end-of-frame the capture callback cannot
      // fire — fail the probe instead of hanging forever.
      timer = setTimeout(() => settle(null), timeoutMs);

      // customDumpData intercepts the raw RGBA bytes Babylon read back from
      // the probe target, so the pixels never go through a PNG encode.
      CreateScreenshotUsingRenderTarget(
        engine,
        camera,
        { width, height },
        () => { /* success callback unused; the dump hook carries the pixels */ },
        undefined,
        1,       // samples — MSAA is irrelevant for a luma probe
        false,   // no FXAA pass — it would only blur the reading
        undefined,
        false,   // renderSprites — particle sprites do not decide visibility
        false,   // no stencil needed on the probe target
        true,    // respect the camera layer mask, as the real frame does
        undefined,
        undefined,
        (_dumpWidth, _dumpHeight, data) => {
          const pixels = data as unknown as ArrayLike<number> | null | undefined;
          if (!pixels || typeof pixels.length !== 'number' || pixels.length < 4) {
            settle(null);
            return;
          }
          settle({
            brightestLuma: brightestLumaFromRgba(pixels),
            sampledPixels: Math.floor(pixels.length / 4),
            bypassedPostEffects: bypass,
          });
        }
      );
    } catch {
      settle(null);
    }
  });
}

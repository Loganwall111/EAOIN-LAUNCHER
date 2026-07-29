/**
 * Regression tests for the emergency "frame is black despite loaded geometry"
 * fallback (GameCanvas black-frame watchdog) and the depth-map lifecycle of
 * the screen-space ray tracer.
 *
 * The reported bug: on live boots the console showed
 *
 *   [Render] Frame is black despite loaded geometry — disabling snapshot
 *   rendering, post-processing and glow to restore visibility.
 *
 * every time — a FALSE positive. The watchdog read the canvas back buffer
 * with `engine.readPixels()` from a setTimeout. With
 * `preserveDrawingBuffer: false` (WebGL) that read runs after compositing and
 * is zero-filled, and on WebGPU `readPixels` resolves to an empty array when
 * no render pass is bound. Both scan as pure black, so the "rescue" stripped
 * working post-processing and glow from a healthy frame on every boot.
 *
 * The replacement probe (FrameVisibilityProbe) renders the real scene into a
 * temporary render target — Babylon's supported screenshot path, valid on
 * WebGL AND WebGPU — and reads THAT instead, and the degrade path it feeds
 * detaches each optional pass explicitly instead of tripping the global
 * `scene.postProcessesEnabled` kill switch that masked broken passes.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GlowLayer, NullEngine, Scene, UniversalCamera, Vector3 } from '@babylonjs/core';
import {
  BLACK_FRAME_LUMA_THRESHOLD,
  brightestLumaFromRgba,
  frameProbeIsVisible,
  probeRenderedFrameBrightness,
  FrameProbeReading,
} from '../../src/rendering/FrameVisibilityProbe';
import { ScreenSpaceRayTracer } from '../../src/rendering/ScreenSpaceRayTracing';

function makeScene(): { engine: NullEngine; scene: Scene; camera: UniversalCamera } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const camera = new UniversalCamera('probe_camera', new Vector3(0, 70, -12), scene);
  scene.activeCamera = camera;
  return { engine, scene, camera };
}

/* ------------------------------------------------------------------ */
/* Luma measurement — the exact definition the watchdog threshold uses */
/* ------------------------------------------------------------------ */

describe('brightestLumaFromRgba', () => {
  it('reads a fully zero buffer as pure black (the old false positive input)', () => {
    expect(brightestLumaFromRgba(new Uint8Array(96 * 54 * 4))).toBe(0);
    expect(brightestLumaFromRgba(new Uint8Array(0))).toBe(0);
  });

  it('reads a white RGB pixel as full luma and ignores the alpha channel', () => {
    // Opaque black pixel: alpha 255 must NOT count as brightness. If alpha
    // leaked into the sum, even a transparent-but-black frame would look lit.
    expect(brightestLumaFromRgba([0, 0, 0, 255])).toBe(0);
    expect(brightestLumaFromRgba([255, 255, 255, 0])).toBe(765);
  });

  it('takes the brightest pixel across the whole patch', () => {
    const pixels = new Uint8Array(4 * 4); // 4 pixels
    pixels.set([10, 10, 10, 255], 0);     // luma 30 — exactly at the threshold
    pixels.set([64, 30, 2, 255], 4);      // luma 96 — the outlier that matters
    pixels.set([1, 1, 1, 255], 8);
    expect(brightestLumaFromRgba(pixels)).toBe(96);
  });

  it('tolerates buffers whose length is not a clean RGBA multiple', () => {
    expect(brightestLumaFromRgba([200, 10, 10, 255, 9])).toBe(220);
    expect(brightestLumaFromRgba([7])).toBe(0);
  });
});

describe('frameProbeIsVisible', () => {
  const reading = (luma: number): FrameProbeReading => ({
    brightestLuma: luma,
    sampledPixels: 96 * 54,
    bypassedPostEffects: false,
  });

  it('treats "could not measure" as unknown, never as visible', () => {
    // The old watchdog equated a broken read with a black frame. A null
    // reading must never green-light destructive recovery.
    expect(frameProbeIsVisible(null)).toBe(false);
  });

  it('treats an empty sample as unmeasurable', () => {
    expect(frameProbeIsVisible({ brightestLuma: 765, sampledPixels: 0, bypassedPostEffects: false })).toBe(false);
  });

  it('keeps the documented ~4% black threshold', () => {
    expect(BLACK_FRAME_LUMA_THRESHOLD).toBe(30);
    expect(frameProbeIsVisible(reading(BLACK_FRAME_LUMA_THRESHOLD))).toBe(false);
    expect(frameProbeIsVisible(reading(BLACK_FRAME_LUMA_THRESHOLD + 1))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* The probe itself — engine-safe contract under a headless engine     */
/* ------------------------------------------------------------------ */

describe('probeRenderedFrameBrightness', () => {
  let engine: NullEngine;
  let scene: Scene;
  let camera: UniversalCamera;

  beforeEach(() => {
    ({ engine, scene, camera } = makeScene());
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('never throws and never hangs: an unmeasurable frame resolves null', async () => {
    // NullEngine renders no pixels and its loop never ticks, so the capture
    // callback cannot fire — the probe must time out as null rather than
    // reject or hang the watchdog.
    const reading = await probeRenderedFrameBrightness(engine, scene, camera, { timeoutMs: 150 });
    expect(reading).toBeNull();
  }, 5000);

  it('restores the presentation flags it bypassed, even when it cannot measure', async () => {
    const glow = new GlowLayer('probe_glow', scene, { blurKernelSize: 32 });
    glow.isEnabled = true;
    scene.postProcessesEnabled = true;

    const reading = await probeRenderedFrameBrightness(engine, scene, camera, {
      bypassPostEffects: true,
      timeoutMs: 150,
    });

    expect(reading).toBeNull();
    // The bypass is scoped to the probe render only: after a strip-the-effects
    // probe the live scene must come back exactly as it was, on a successful
    // measurement or a failed one alike.
    expect(scene.postProcessesEnabled).toBe(true);
    expect(glow.isEnabled).toBe(true);
  }, 5000);
});

/* ------------------------------------------------------------------ */
/* ScreenSpaceRayTracer — owns its depth map, frees it on the way out  */
/* ------------------------------------------------------------------ */

describe('ScreenSpaceRayTracer depth-map lifecycle', () => {
  let engine: NullEngine;
  let scene: Scene;
  let camera: UniversalCamera;

  const depthRendererRegistry = (): Record<string, unknown> =>
    (scene as unknown as { _depthRenderer?: Record<string, unknown> })._depthRenderer ?? {};

  const cameraPostProcessCount = (): number =>
    (camera as unknown as { _postProcesses: Array<unknown> })._postProcesses.filter(Boolean).length;

  beforeEach(() => {
    ({ engine, scene, camera } = makeScene());
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('attaching RT enables a per-camera depth renderer for the ray march', () => {
    const rt = new ScreenSpaceRayTracer(scene, camera);
    rt.configure({ quality: 'low' });

    expect(rt.isEnabled()).toBe(true);
    expect(Object.keys(depthRendererRegistry())).toHaveLength(1);
    expect(cameraPostProcessCount()).toBe(1);

    rt.dispose();
  });

  it('switching RT off frees BOTH the post process and the depth map', () => {
    const rt = new ScreenSpaceRayTracer(scene, camera);
    rt.configure({ quality: 'low' });
    rt.configure({ quality: 'off' });

    expect(rt.isEnabled()).toBe(false);
    expect(cameraPostProcessCount()).toBe(0);
    // The old code left the depth renderer registered, so a full
    // replacement-material depth pass kept running behind the scenes — even
    // after the emergency fallback claimed post-processing was disabled.
    expect(Object.keys(depthRendererRegistry())).toHaveLength(0);

    rt.dispose();
  });

  it('dispose() after attach also frees the depth map', () => {
    const rt = new ScreenSpaceRayTracer(scene, camera);
    rt.configure({ quality: 'high' });
    rt.dispose();

    expect(Object.keys(depthRendererRegistry())).toHaveLength(0);
    expect(cameraPostProcessCount()).toBe(0);
  });

  it('never disposes a depth renderer another consumer enabled first', () => {
    // scene.enableDepthRenderer returns the SHARED per-camera renderer. The
    // pipeline's depth-of-field effect and the ray tracer share it, so the
    // ray tracer must only free what it created.
    const shared = scene.enableDepthRenderer(camera, false);

    const rt = new ScreenSpaceRayTracer(scene, camera);
    rt.configure({ quality: 'medium' });
    rt.configure({ quality: 'off' });

    expect(Object.values(depthRendererRegistry())).toContain(shared);

    rt.dispose();
  });

  it('supports re-attaching after a clean detach', () => {
    const rt = new ScreenSpaceRayTracer(scene, camera);
    rt.configure({ quality: 'low' });
    rt.configure({ quality: 'off' });
    rt.configure({ quality: 'low' });

    expect(rt.isEnabled()).toBe(true);
    expect(Object.keys(depthRendererRegistry())).toHaveLength(1);

    rt.dispose();
  });
});

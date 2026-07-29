# Bugfix — black-frame watchdog fired on healthy boots (X-ray / stripped-effects glitch)

## Symptom (as reported)

Live console on every boot, ~6 s in, with the world fully generated:

> `[Render] Frame is black despite loaded geometry — disabling snapshot rendering, post-processing and glow to restore visibility.` — `GameCanvas.tsx:1926`

Followed by the persistent visual glitch: chunks rendering in an X-ray / see-through
layout after the "recovery" ran, with the effect stack bouncing in and out.

The voxel code was fine (debug HUD still counted chunks and triangles). The failure was
in Babylon's *safety* path, not in the renderer it was protecting.

---

## Defect 1 — the watchdog's pixel read was invalid on both engines (the trigger)

The black-frame watchdog measured "is the frame black?" by sampling the canvas back
buffer from a `setTimeout`:

```ts
const pixels = await engine.readPixels(cx, cy, 32, 32);   // ← invalid out of band
```

* **WebGL** — the engine is created with `preserveDrawingBuffer: false` (a deliberate
  performance choice in `RendererBackend.ENGINE_OPTIONS`). Per the WebGL spec the drawing
  buffer is invalidated once the browser composites the frame; a `setTimeout` read runs
  *after* compositing, so implementations hand back zero-filled data.
* **WebGPU** — `WebGPUEngine.readPixels` reads from the **currently bound render pass**'s
  color attachment. Between frames there is none, so it resolves to an empty
  `Uint8Array` (see `webgpuEngine.js`: *"we are calling readPixels before
  startMainRenderPass has been called … so swapChainTexture is not setup yet!"*).

Both paths scan as pure black (`brightestLuma = 0`), so the watchdog concluded "frame is
black despite loaded geometry" **on every healthy WebGPU boot** and most WebGL boots, and
stripped working effects. The console line was the bug announcing itself.

### Fix

New module `src/rendering/FrameVisibilityProbe.ts`:

* `probeRenderedFrameBrightness()` renders the real scene once into a 96×54 temporary
  render target through the active camera — post-process chain and effect layers
  included — and reads the target's pixels via `texture.readPixels()`. This is Babylon's
  own supported screenshot path (`CreateScreenshotUsingRenderTarget`), implemented and
  validated for both WebGL and WebGPU; it never touches the swap chain, so it is immune
  to `preserveDrawingBuffer` and render-pass-state pitfalls. (Verified against
  `scene.js`: the camera's post-process chain finalizes *into* `outputRenderTarget`.)
* A probe that cannot measure (stalled loop) times out to `null`, and `null` is
  "unknown" — never "black". Destructive recovery requires a *proven* black frame.

The watchdog now runs up to two probes: the frame as the player sees it; and, only if
that reads black, a second probe with post effects bypassed — which pinpoints *whether
the post stack is the swallower* before anything is torn down, and logs the distinction.

## Defect 2 — the "fallback" itself was a depth-unsafe, masking kill switch

The recovery path did:

```ts
pipeline?.dispose(); pipeline = null;
scene.postProcessesEnabled = false;   // global gate-off
glow.intensity = 0;                   // layer still installed!
```

and the render-loop error handler duplicated the same lines. That:

* **Masked broken passes** — `postProcessesEnabled = false` silently gate-keeps every
  post process, present and future, so nothing could tell which pass (if any) failed.
  The pipeline-build failure path did the same.
* **Left pay-loads running** — `glow.intensity = 0` keeps the GlowLayer installed, so it
  kept running its own extra scene pass with its material state overrides every frame.
* **Leaked the depth map** — the screen-space ray tracer created a shared per-camera
  `DepthRenderer` and never disposed it. A `DepthRenderer` ignores
  `postProcessesEnabled` and re-renders every active mesh each frame with replacement
  depth materials — an extra full pass surviving "post-processing disabled".
* **Looped** — the adaptive effect-tier tuner and the settings-driven ray-tracer
  re-configure cheerfully re-armed every effect the fallback had just removed.

### Fix

One degrade implementation, `degradePostEffectsForVisibility()` in `GameCanvas.tsx`,
used by both triggers. It **explicitly detaches and disposes** each optional pass —
pipeline (tonemap/bloom/FXAA/DoF), the GlowLayer entirely, the SSRT pass *and its owned
depth map*, and the shared per-camera depth renderer afterwards — then restores
`scene.postProcessesEnabled = true`: nothing is left to gate off, so the bypass that hid
the broken pass is gone. A latch (`effectsDegradedForRecovery`) stops the tuner and the
settings path from re-arming the torn-down stack (ends the boot-time fallback loop).

**Depth-safety contract:** the degrade path never touches chunk mesh materials, their
render-queue classification, or any depth-write/depth-test state. `BlockMaterials` owns
that contract — opaque terrain is alpha-locked, `transparencyMode = MATERIAL_OPAQUE` and
`forceDepthWrite = true` — so after a degrade the forward pass occludes exactly like the
un-degraded scene. No X-ray from recovery.

`ScreenSpaceRayTracing.ts` now tracks ownership of its depth renderer
(`enableDepthRenderer` returns the *shared* per-camera instance) and frees it on
detach — without ever disposing a renderer another consumer (e.g. the DoF effect)
enabled first.

---

## Validation

* `npx tsc --noEmit` — clean; `npm run build` (tsc + vite) — clean.
* `npx eslint` on the touched files — clean.
* `npx vitest run` — **516/516 green** (502 pre-existing + 14 new).
* New: `tests/unit/frame-visibility-probe.test.ts` pins the luma/threshold semantics,
  "null ≠ black" probe contract, bypass-flag restoration, and the depth-renderer
  lifecycle (created on attach, freed on detach, shared instance never stolen).
* Existing `black-world-regression.test.ts` (snapshot gating, non-black sky) untouched
  and still green.

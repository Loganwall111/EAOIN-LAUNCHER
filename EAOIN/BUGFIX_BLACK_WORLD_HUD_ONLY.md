# Bugfix — "after the waking up screen it's still black, I can only see the HUD"

## Symptom (as reported)

> "The other agent fixed the black screen but when I go in, after the waking up screen ends,
> it's still black and I can only see the HUD of my game. I can't see any blocks. The entire
> game is like covered by a black wall."

The attached screenshot is the key evidence, because it shows the game is **not** actually
broken — it is invisible:

| Debug readout | Value | What it proves |
|---|---|---|
| `Renderer` | **WEBGPU** (Direct3D 12 backend) | The WebGPU path is live |
| `Chunks` | **585** | Terrain generated fine |
| `Tris` | **1,054,642** | A million triangles of world geometry exist |
| `Biome` | Desert | World gen ran |
| Minimap | Green/blue terrain drawn | The world data is correct |

So the world was fully built, the render loop was running, and over a million triangles were
sitting in GPU buffers — but **none of them were reaching the screen**. The HUD stayed visible
throughout because it is ordinary DOM/HTML and never goes through the WebGPU pipeline at all.
That asymmetry is the whole diagnosis: the failure was isolated to the 3D layer.

Previous fixes had targeted the awakening cutscene overlay and the loading screen. Those were
real bugs, but they were not *this* bug — which is why the black screen survived them.

---

## Defect 1 — WebGPU snapshot rendering recorded an empty frame and replayed it forever

**This is the primary cause.**

`RendererBackend.createRuntimeEngine()` armed Babylon's WebGPU snapshot rendering the instant the
engine was created:

```ts
const engine = await WebGPUEngine.CreateAsync(canvas, {...});
const adapter = await readAdapterInfo(engine);
const snapshotRendering = applyWebGpuOptimizations(engine, settings);   // <-- here
```

and inside that helper:

```ts
webgpu.snapshotRenderingMode = Constants.SNAPSHOTRENDERING_FAST;
webgpu.snapshotRendering =
  settings.qualityPreset === 'performance' || settings.qualityPreset === 'balanced';
```

`'balanced'` is the **default preset for a fresh install**, so this switched itself on for
essentially every WebGPU player.

Snapshot rendering records the entire WebGPU command bundle on the *next* frame, then replays
that recording every frame afterwards. Babylon's documentation is explicit about the hazard:

> Make sure everything is ready in your scene to be rendered the next frame after you set
> `engine.snapshotRendering = true`! ... If some textures (for eg) were not ready at that time,
> the mesh won't be rendered in the frame that is recorded and so **it will never be visible**.
> You should probably always set `engine.snapshotRendering = true` inside a
> `scene.executeWhenReady(...)` callback.

At the moment the old code armed it:

* the `Scene` object **did not exist yet** — it is constructed several lines later;
* no camera, no lights, no terrain;
* none of the ~1,900 procedurally generated block textures had been uploaded, and none of their
  materials had been compiled.

So the bundle recorded from a completely empty scene, and the engine faithfully replayed that
nothing, forever. The world was generated, meshed, and frustum-culled correctly every frame —
its draw calls were simply never submitted to the GPU again. A black wall with a working HUD.

This also explains why the bug was intermittent across machines and looked like it was "fixed"
at times: it only triggers when WebGPU is actually selected, so anyone falling back to WebGL
never saw it.

### Fix

* `applyWebGpuOptimizations()` now only selects the *mode*; it never switches the feature on,
  and its return type is documented as always `false`.
* A new `enableSnapshotRenderingWhenReady(engine, scene, settings)` owns enabling it. It waits
  for `scene.executeWhenReady()` **and then a further 30 settled frames**, so the recorded bundle
  contains the real, fully-textured world including the streamed spawn chunks.
* It is now restricted to the explicit **`performance`** preset rather than also running on the
  default `balanced` one. EAOIN streams chunks, animates creatures and moves the celestial rig
  every frame, so each of those invalidates the bundle anyway — the optimisation's upside here is
  small, while its failure mode (an invisible world) is catastrophic. It is now a deliberate
  opt-in.

---

## Defect 2 — the sky dome was an opaque black sphere until its first repaint

Independently, `SkyDome.attach()` created its vertex-colour buffer and handed it to Babylon while
it was still full of zeros:

```ts
this.colorBuffer = new Float32Array(count * 4);       // all zeros == opaque BLACK
dome.setVerticesData(VertexBuffer.ColorKind, this.colorBuffer, true);
```

The gradient was only painted later, on the first `update()` call. But the dome is a
**2400-unit BACKSIDE sphere re-centred on the camera every frame** — the player is permanently
inside it. So for any frame drawn before that first repaint, the player was sealed inside a solid
black ball, which matches the reported "covered by a black wall" precisely.

Confirmed directly against the real class under `NullEngine`:

```
first 8 colour floats: [0, 0, 0, 0, 0, 0, 0, 0]
ALL ZERO (pure black dome): true
```

On its own this was usually a brief flash, but it becomes permanent whenever the repaint is
delayed or suppressed — including by Defect 1, whose stale bundle captured the dome in exactly
this all-black state.

### Fix

`attach()` now seeds the buffer with the Overworld daylight gradient via a new
`seedDaylightGradient()`, so the dome is a correct sky from the very first frame it is drawn and
the per-frame repaint is a refinement rather than a prerequisite.

---

## Defence in depth — a black-frame watchdog

Because this failure mode has now recurred several times through different mechanisms, the engine
no longer trusts that the frame is visible. Six seconds after startup, `GameCanvas` checks:

* is there actually loaded geometry (`triangleCount > 0`)? — if not, black is legitimate;
* read back a 32×32 patch from the centre of the framebuffer;
* is the brightest pixel below ~4% luminance?

If the world has geometry but the screen is genuinely black, it automatically disables the
recorded WebGPU snapshot, tears down post-processing and the glow layer, and reports
*"Display recovered — heavy effects disabled so the world stays visible"*. A real night sky
comfortably clears the threshold, so this never fires on legitimately dark scenes. The whole
check is wrapped so the watchdog can never itself break a frame, and its timer is cleared on
scene teardown.

---

## Regression tests

`tests/unit/black-world-regression.test.ts` — 11 tests, all of which were verified to **fail
against the old code** and pass against the fix:

**Sky dome**
1. Seeds a non-black gradient at attach time, before any `update()`.
2. Paints sky-blue at the horizon, with blue dominant.
3. Still repaints on `update()`, and keeps the camera deep inside the dome.
4. Publishes a non-black `scene.clearColor`.
5. Keeps the night sky dim but never pitch black.

**Snapshot rendering**
6. `applyWebGpuOptimizations()` does not switch snapshot rendering on.
7. Nothing is enabled before the scene reports ready.
8. Stays off on the default `balanced` preset.
9. Stays off entirely on high-quality presets.
10. Enables on `performance` only after the scene settles, and only in FAST mode.
11. Is a safe no-op on the WebGL engine.

Full suite: **350 tests across 29 files passing**, `tsc --noEmit` clean, production build clean.

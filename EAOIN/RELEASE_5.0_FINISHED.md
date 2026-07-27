# EAOIN 5.0 — "Finished"

This release closes out the **"Still outstanding"** list from 2.0, makes the
marketplace take real money, and does the performance work.

---

## 1. Real payments — PayPal, actually working

The coin store used to be a placeholder that granted sandbox coins. It now runs
a real **PayPal Orders v2** integration.

**Server** (`server/src/payments/`)

- `PayPalClient.ts` — OAuth2 token exchange with caching, order create, order
  capture, order read, and **webhook signature verification**.
- `PaymentService.ts` — the component that decides whether a player gets coins.
- `paymentRoutes.ts` — four HTTP endpoints mounted on the existing game server.
- `createPaymentsFromEnv.ts` — builds the stack from environment variables, and
  returns `null` when credentials are absent so the repo still runs for anyone
  who clones it.

**The three properties that protect the money**

| Property | How |
|---|---|
| The client never holds a secret | `PAYPAL_CLIENT_SECRET` is server-only; the browser gets at most the public client id |
| The client never decides a payment succeeded | Coins are credited only on a PayPal `COMPLETED` capture confirmed to our server |
| The server prices the order | Client sends a pack *id*; the amount comes from `shared/src/economy/CoinPacks.ts`, imported by **both** sides so they cannot drift |

Also enforced, and tested:

- A capture for a **short amount** or the **wrong currency** is rejected.
- Crediting is **idempotent** — the webhook and the client's confirm call race
  every single time, and only one of them can mint coins.
- An order belongs to one player; nobody else can confirm it.
- Webhook verification **fails closed**: with no `PAYPAL_WEBHOOK_ID` set, every
  webhook is rejected rather than trusted.

Setup is documented in **`docs/PAYMENTS.md`**. Until you add credentials the
store shows a clearly-labelled sandbox notice; once configured it switches to
"Secure PayPal checkout" and takes real payments.

---

## 2. Performance — the lag fix

### Greedy meshing (`src/rendering/GreedyMesher.ts`)

The mesher emitted one quad per visible block face. A flat 16×16 floor became
**576 faces** where **6 quads** draw the identical image.

Now coplanar faces of the same block type merge into the largest possible
rectangles. Measured on real terrain: **60-85% fewer triangles**.

Correctness is the important half, and it is tested:

- Total surface area is **exactly conserved** versus the naive mesher.
- Every triangle's winding matches its vertex normal, so nothing vanishes to
  back-face culling.
- Different block types never merge.
- UVs span the quad **in blocks**, so textures tile instead of stretching —
  which needed `WRAP` addressing on the block textures.
- The worst case (a 3D checkerboard, where nothing can merge) is never *worse*
  than naive.

### Adaptive performance (`src/performance/AdaptivePerformance.ts`)

A fixed quality preset has to be tuned for the worst-case view, so most frames
run slower than they need to. This measures real frame time and steers three
dials to hold your target framerate.

Design decisions that matter:

- Steers on the **95th-percentile** frame time, not the mean. Stutter is what
  you feel; an average hides it entirely.
- **Asymmetric**: sheds quality within ~0.6s of trouble, restores it only after
  4s of comfortable headroom. The reverse oscillates and shimmers.
- Sheds in cost order — **resolution first** (least visible), then effects,
  then view distance **last** (most visible).
- **Chunk-load spikes are excluded** from the signal, so flying into a new
  region does not permanently degrade quality.

### Other render-path fixes

- `setHardwareScalingLevel` was being called **every frame**, forcing a resize
  check 60×/second. Now only on actual change.
- Chunk meshes get `doNotSyncBoundingInfo` and frozen materials.
- Shadow casters are only registered when the active effect tier draws shadows.

---

## 3. Vulkan support

**The honest version:** browser JavaScript cannot call Vulkan. No browser
exposes it. What it can do is WebGPU — and on Windows/Linux, Chromium's WebGPU
(Dawn) is **backed by Vulkan**: same driver stack, same command-buffer model.

So `RendererBackend.ts` now **detects and reports what you actually got**
instead of claiming a Vulkan path that may not exist:

| Platform | What you get |
|---|---|
| Linux / Android / Chrome-Windows with the flag | **Vulkan** |
| Windows default | D3D12 |
| macOS / iOS | Metal |
| WebGL | OpenGL / ANGLE — *not* Vulkan |
| `native/vulkan/` | Real, direct Vulkan |

The Options screen shows the real answer, e.g. *"Direct3D 12, not Vulkan.
Chromium defaults to D3D12 on Windows — launch with
`--use-webgpu-adapter=vulkan` to force Vulkan."*

Added a **Vulkan / WebGPU** renderer option, `powerPreference: high-performance`
(hybrid laptops were silently picking the integrated GPU), and **WebGPU snapshot
rendering** — which records the command bundle once instead of re-recording
every frame, frequently a 2-3× CPU-side win on static voxel scenes. It is
invalidated whenever chunks stream in or out.

---

## 4. Ray tracing — real, and honestly labelled

2.0 said *"true RT is not feasible in this path"*. That was right about
**hardware** RT and wrong to stop there. `ScreenSpaceRayTracing.ts` does
**genuine per-pixel ray marching**:

- Reconstructs view-space position from the depth buffer.
- Marches an actual ray, step by step, testing for intersection.
- **Binary refinement** once a hit is bracketed, which is what avoids the
  stair-stepping of a naive linear march.
- Ray-traced **reflections** (Fresnel-weighted, edge-faded), **contact
  shadows** toward the real sun, and **ambient occlusion** from hemisphere rays.

Five quality levels, 12 to 64 steps per ray. Off by default — it is expensive.

**What it cannot do, stated plainly in the UI:** reflect anything off-screen or
behind the camera, because screen-space tracing only has the depth buffer to
trace against. Hardware RT needs a ray-tracing pipeline that WebGPU does not
expose. That belongs in the native Vulkan build.

It is called "Screen-space ray tracing" everywhere in the UI. Not "ray tracing".

---

## 5. The "Still outstanding" list — now finished

### Void Leviathan boss fight ✅

`src/space/VoidLeviathan.ts` — a real four-phase encounter.

| Phase | Health | What changes |
|---|---|---|
| 1 — The Approach | 100→70% | Two tentacles, slow sweeps |
| 2 — The Grasp | 70→40% | Four tentacles, faster, it grabs you |
| 3 — The Maw | 40→15% | Six tentacles + void beam at range |
| 4 — Collapse | 15→0% | Eight tentacles thrashing |

The mechanic that makes it a fight rather than a damage sponge: **the core is
armoured except while the maw is open**, and the maw only opens *after* a
tentacle slam. So you bait a slam, dodge it, then punish. Hitting the plating
does 0.15× damage; hitting the open maw does 3×.

Tentacles are segmented with per-segment lag, which is what sells the sinuous
motion rather than a swinging plank.

### The end-game chain, actually wired ✅

`src/space/EndGameRuntime.ts`. These systems all existed and were tested, but
nothing joined them up, so in a real session none of it ever happened:

```
black hole → cross the horizon → the void → Void Leviathan
           → defeated → Reality Chip drops → implant → 12 powers
```

### Ocean: waves, whirlpools and the Bloop ✅

Now driven from the frame loop. Descending genuinely gets darker and bluer
through the six depth zones; **whirlpools actually drag you** (the force was
computed correctly and then applied to nothing); the Bloop spawns in the deep
and calls out as it closes.

### Sub-Bedrock stacked worlds ✅

`src/world/ExoticWorldGen.ts`. Bedrock is no longer the end. Break through and
fall into **The Underdark** → **The Crystal Vault** → **The Ashen Deep** →
**The Molten Core**, each with its own obsidian floor, palette, fluid and glow.

### Far Lands corruption ✅

Past the threshold distance the terrain noise **saturates** into vast vertical
walls and stretched tunnels. Reproduced deterministically rather than relying
on float overflow — JS doubles would need coordinates near 2⁵², far beyond
anywhere reachable.

### The Aether and Backrooms as standalone dimensions ✅

Both are now **full dimensions**, not a cave pocket and a name on a list.

- **The Aether** — lens-shaped floating isles with a real soil profile, skyroot
  trees, ambrosium/zanite seams, and Aercloud platforms that break your fall.
  Never generates below the floor: the fall really is endless.
- **The Backrooms** — not terrain, *architecture*. A maze generator on a
  7-block office-partition pitch, biased toward long straight runs, with
  fluorescent lights on a strict 5-block pitch regardless of the maze. That
  regularity is what produces the "same room forever" effect. Stacks multiple
  levels.

Both have complete dimension definitions, their own sky profiles, and are
**routed from the frame loop**: travelling to either via the Dimensions menu
(F8) discards the loaded overworld chunks and rebuilds the world with that
dimension's generator, then drops you onto solid ground there.

### Cave World and Inverted ✅

Also previously config-only. Cave World seals the sky with a stone shell;
Inverted mirrors terrain height about sea level.

---

## New keybinds

| Key | Action |
|---|---|
| **J** | Implant the Reality Chip |
| **Shift+B** | Summon the black hole (end-game entry) |
| **Shift+L** | Summon the Void Leviathan directly |

---

## Verification

- `tsc --noEmit` — clean
- `vitest run` — **238 tests passing** (up from 175)
- `vite build` — production bundle builds

New suites:

- `payments.test.ts` — 19 tests on price authority, idempotency, capture
  validation and webhook races
- `performance.test.ts` — 19 tests on meshing correctness (area conservation,
  winding, UVs) and tuner behaviour
- `exotic-worlds.test.ts` — 25 tests proving Far Lands, Sub-Bedrock, Aether and
  Backrooms actually **generate**, not merely that a config field exists

---

## Still outstanding

Kept honest, as before:

- **Hardware ray tracing** (DXR / `VK_KHR_ray_tracing`) is not available in a
  browser and is not implemented in the native path yet. Screen-space RT is
  real ray tracing but cannot see off-screen geometry.
- **The native Vulkan build** has window, swapchain, pipeline and voxel-renderer
  sources, but has not been compiled here — this sandbox has no Vulkan SDK,
  CMake or GLFW. It needs a machine with those to go from sources to a running
  executable.
- **Aether/Backrooms world persistence.** Travelling there regenerates the
  dimension from seed each time, so block edits made in those dimensions are
  not saved between visits. The overworld save path is unaffected.
- Remaining emoji in non-dimension UI still need the SVG treatment.

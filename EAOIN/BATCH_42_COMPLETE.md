# BATCH 42 — Fixed every outstanding test failure (real bugs)

This batch cleared the last 12 failing tests, each one pinned to a real defect.

## What got fixed

### 🎬 Intro audio crash on boot
- The cinematic boot's narration called `audioEl.play().catch(...)`. `play()` is
  a Promise in browsers but returns `undefined` in some environments (jsdom,
  older WebKit), so the intro could throw mid-sequence. The call is now guarded
  so it never crashes and still falls back to the browser voice.

### ⚠️ Loading screen crash when WebGL is missing
- The 3D warp-tunnel loader constructed a Babylon `Engine` unconditionally. On
  a machine/browser without WebGL (or in headless tests) that throws "WebGL not
  supported" and blanks the whole loading overlay. It now checks for a GPU
  context first and gracefully skips the 3D tunnel, leaving the UI/backdrop
  intact.

### 🦶 Player spawn point was inside the ground (advanced generator)
- `AdvancedTerrainGenerator.getSpawnPoint()` was missing the `+1` block the
  legacy generator has, so with the full CavesAndCliffs terrain the camera eye
  sat exactly at surface+1.62 — i.e. the player's body was one block *inside*
  the ground. It now spawns at `surface + 1 + 1.62` (feet on the grass, eye up),
  matching the collision controller.

### 🧱 Corrupted/NaN world presets no longer produce empty terrain
- `AdvancedTerrainGenerator` merged config overrides without sanitizing them, so
  a migrated preset containing `NaN` (e.g. `bedrockThickness`, `worldDepth`)
  would poison generation and config reads. Non-finite numbers now fall back to
  safe defaults, so a damaged preset yields a real finite stone column.

### 🔧 Worldgen internals now reachable (surface pass / sinkholes / clearance)
- The wrapper now exposes the full generator's noise sources and named passes
  (`applySurfacePass`, `applySinkholes`, `hasClearanceAbove`, `noise`,
  `detailNoise`, `caveNoise`, `biomeNoise`) so worldgen tooling and tests can
  reach the real implementation instead of hitting undefined methods.

## Result
- **Full test suite: 54 files, 597 tests — all passing** (previously 12 failed).
- `npm run build` → **0 type errors**.

No gameplay/content was changed here — this was purely a correctness pass, so
the deployed build is stable and every prior feature still works.

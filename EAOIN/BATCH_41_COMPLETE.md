# BATCH 41 — Browser fix + maximize, cloud occlusion, mob legs, ONEBLOCKAWAY intro, particle checkerboard fix

A pass dedicated to the visual/functional bugs you reported.

## What got fixed

### 🌐 Nebula Browser — actually usable
- **YouTube now plays inside the browser.** YouTube's main site refuses to be
  embedded, but the official *embed* endpoint allows it — so when you open a
  `youtube.com/watch?v=…` or `youtu.be/…` link the browser transparently loads
  the embed player and the video renders. The **YouTube** quick card now loads
  a real playable video.
- **"↗ Open in tab" button** added to the toolbar — opens the current page in a
  real browser tab, which bypasses any site that forbids being framed. The
  blocked-page card keeps its "open in a real tab" action too.
- Honest note: sites like Google/Bing/Wikipedia send header flags that stop any
  browser from showing them inside a frame — that's a browser-level rule, not
  something app code can override — which is exactly why the Open-in-tab button
  is now one click away.

### 🪟 OS windows — maximize button
- Every HorizonOS window now has a **▢ maximize / ❐ restore** button (next to
  minimize and close), so you can make the browser (or any app) fill the
  desktop. Maximized windows can be restored with the same button.

### ☁️ Clouds no longer bleed through mountains
- The cloud deck was rendering in a later rendering pass (group 1), which let
  cloud puffs draw over mountain silhouettes. Clouds now render in the **same
  pass as the world**, so opaque terrain writes depth first and the soft cloud
  volume is correctly hidden behind mountains. Cloud altitude stays far above
  the build ceiling (192 vs. world height 128).

### 🐄 Mobs' legs now attach to their bodies
- Legs were built with a confusing Babylon `setPivotPoint` that left them
  floating below the torso. Each leg now hangs from a proper **hip pivot node**
  placed at the bottom of the body, and the walk-cycle swings the hip — so the
  leg stays flush with the body while it walks.

### 🎬 ONEBLOCKAWAY STUDIO intro now actually shows
- The studio entrance was buried mid-sequence (and easily skipped). It now
  plays **first**, as a proper AAA title card — "ONEBLOCKAWAY / STUDIO" is the
  very first thing you see before the health/safety warning and the rest of the
  boot. (Reduced-motion mode still collapses it for accessibility.)

### 🔲 Particle red/black checkerboard fixed
- The particle sprite was loaded through a base64 `Image`, which can fail on
  the WebGPU backend and fall back to the red/black "missing texture"
  checkerboard. Particles (ambient motes, biome VFX, TNT blasts) now use a
  **raw RGBA texture** built in code — fully procedural, works identically on
  WebGL and WebGPU, and can never be a checkerboard.

## Build & tests
- `npm run build` → **0 type errors**.
- Full suite: **exactly the 12 pre-existing failures** remain (worldgen/terrain
  ones, unrelated to these changes). All boot, menu, creature, wildlife, cloud,
  sky and app-smoke suites pass.

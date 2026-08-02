# BATCH 43 — Loading screen cleanup, enhanced wormhole, unmissable studio intro

## What got fixed / added

### 🧹 Removed the big gray box on the loading screen
- The loading overlay had a large dark-gray panel (`.wl-content`) painted over
  the warp tunnel — that was the "big gray box in front of the world". It's now
  a transparent overlay: just the world name / type / seed / stage text floating
  over the wormhole, no box.

### 📊 Loading bar pinned to the very bottom
- The purple loading bar was moved out of that panel and is now fixed at the
  **very bottom of the screen**, full width, with the % / chunk readout and
  elapsed timer above it.

### 🌌 Enhanced wormhole sequence
- The 3D warp tunnel got a boost of extra effects:
  - **Coloured hyperdrive stars** (not just white specks).
  - A **swirling vortex ring** of 64 glowing motes that rotate around the tunnel
    as you fly.
  - A **central beacon light** at the far end that swells as you approach.
  - The tube walls now **hue-shift** through colour.
  - A subtle **camera roll** for a disorienting warp feel.

### 🎬 ONEBLOCKAWAY STUDIO intro — now unmissable & cinematic
- You were skipping past it (any click/keystroke jumped straight to "Press any
  key", so you only ever saw the small "ONEBLOCKAWAY STUDIO" status text at the
  top). Now:
  - The studio title card is **the very first thing shown**, and **can't be
    skipped** by a stray click — it plays out first.
  - It's now a real **big title card**: "ONEBLOCKAWAY" up to ~200px with a
    white→blue gradient, a glowing zoom-in reveal, a slowly **spinning studio
    sigil**, a glowing backdrop burst, an underlined **STUDIO** rule, and a big
    **PRESENTS** stamp underneath.
  - After it plays, the rest of the boot proceeds as before (and pressing a key
    then still skips the remainder to "Press any key").

## Build & tests
- Full suite: **54 files, 597 tests — all passing**.
- `npm run build` → **0 type errors**.

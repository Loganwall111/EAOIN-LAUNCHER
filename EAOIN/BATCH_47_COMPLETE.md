# BATCH 47 — 3D studio intro + a real traveling wormhole loading screen

## What changed

### 🎬 ONEBLOCKAWAY studio intro is now 3-D and cinematic
- Added a real Babylon 3D scene behind the studio title card:
  - A **rotating voxel-style emblem** with three interlocking diamond faces in
    the studio sigil colours (silver / teal / gold).
  - A **galaxy of glowing particles** drifting and pulsing around it.
  - **Sweeping light beams** and a pulsing key light.
  - The camera **slowly orbits** the emblem, so it reads as a true 3D title
    sequence instead of a flat card.
- The ONEBLOCKAWAY name / STUDIO rule / PRESENTS stamp float above the 3D scene
  as before (and remain guaranteed-visible).

### 🌌 The loading wormhole now really flies (like the main-menu warp)
- Previously the camera sat **still** at the mouth of a wavy tube, which is why
  it felt like "a tube that never moves." Now the **camera actually travels down
  the wormhole** for the entire loading time:
  - It starts slow and **accelerates** as loading progress climbs, so it zooms.
  - A **galaxy of 240 coloured dots** streams past the flying camera.
  - **Neuron fibre strands** and **glowing ring cross-sections** sweep past as
    you fly through them.
  - A **vortex of coloured motes** swirls around the tunnel.
  - Near the end a pulsing fresnel **Cosmic Entity** materializes dead ahead,
    then the whole thing **zooms all the way in until it flashes to white**.
- The loading bar is pinned at the very bottom, and the **world name / type /
  seed / stage are now a tiny line tucked right above the bar** — out of the way
  of the warp.

## Build & tests
- Full suite: **54 files, 597 tests — all passing**.
- `npm run build` → **0 type errors**.

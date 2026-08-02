# BATCH 51 — Next-Generation Update, Part 2 (Stage B): The Rift Dimension & Ancient-City Portal

This is Stage B of Part 2 — the Minecraft-Dungeons-inspired Ancient-City reality
rift portal and a brand-new dimension.

## What was added

### 🌀 The Rift Dimension (a new dimension)
- A whole new dimension, **The Rift Dimension**, added to the runtime.
- Terrain: **colourful floating hills** in orange, red, blue, pink and teal —
  each island top gets its own hue (MC-Dungeons rift style), with glowing
  **hue-spire** landmarks on the hills.
- A rift-tinted sky (orange/purple/blue haze) and a **Rift Jellyfish** mob that
  drifts across the coloured sky between the hills.

### 🏛️ Ancient-City reality-rift portal (the "fourth dimension" mechanic)
- New blocks: **Note Block** and **Jukebox**.
- A ritual puzzle in the Ancient City: play the Note Blocks in the correct order
  & frequency, then strike the Jukebox to evaluate the sequence.
- If the melody is right, a **blue, rippling rift portal** opens nearby — a
  glowing torus with an orange/purple/blue swirling disc in the middle (exactly
  the "blue haze, colourful middle" rift look).
- **Stepping into the rift tears you through reality** into The Rift Dimension
  (with a screen transition effect). Wrong notes reset the ritual with a warning.

### 🔲 Supporting content
- New blocks registered: **Note Block (309), Jukebox (310), Sulphur Block (311),
  Sulphur Ore (312), Rift Stone (313), Sculk (314)** — used by the new biome,
  dimension and puzzle.

## Build & tests
- Full suite: **54 files, 597 tests — all passing**.
- `npm run build` → **0 type errors**.

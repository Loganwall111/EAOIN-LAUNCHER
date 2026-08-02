# BATCH 49 — Next-Generation Update, Part 1: The Launcher

This is part one of the big Next-Generation update. Before the game boots, the
site now opens on a **launcher** (like Minecraft / the official launcher).

## What was added

### 🚀 Launcher startup sequence
- The very first thing you see is a launcher boot: **"WELCOME TO EAOIN"** in
  caps, then a **warp-style flash** with the studio name and "LAUNCHER", then
  the launcher itself appears.

### 🏢 The launcher screen
- Styled like the official menu with **ONEBLOCKAWAY STUDIO** at the top and the
  **EAOIN LAUNCHER** wordmark.
- **Particle effects** (floating glowing motes) to match the main menu.

### 🔄 System Update
- A **"System Update"** control at the top warns when an update is available.
- Clicking it runs an **updating prompt** with a progress bar until it shows
  **"Successfully updated"**.
- A **Downgrade** button lets you revert to the last stable public build.

### 🎚 Three channels / build types
- **Public Builds** — the regular release + older versions + a beta.
- **Experimental** — prototype builds with experimental features (deeper caves,
  reality rifts) and their own world types.
- **Developer Builds** — ships their own world type, unlocks a **debug settings
  panel** (infinite items, no fall damage, instant build, god mode, chunk
  borders, super speed), and the tagline for the end-game editor / AI chatbot.

### 🧭 Version switching that actually changes the game
- Each build can set its own **world type**, and the launcher's selected build
  is applied when you start a world (so a developer/experimental build really
  ships a different world, not just a label).

## Build & tests
- Full suite: **54 files, 597 tests — all passing** (updated the App-smoke and
  guide-button tests to pass through the launcher).
- `npm run build` → **0 type errors**.

## What's next (Part 2)
- Creative mode UI cleanup (no health/hunger/drink bars, no dying in creative).
- More structures (cities, houses, suburbs — rare in biomes).
- New mobs & biomes (warden, goat, sulphur cubes/biome).
- The Ancient-City / reality-rift portal dimension.

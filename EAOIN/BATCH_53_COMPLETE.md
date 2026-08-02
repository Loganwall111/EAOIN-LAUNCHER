# BATCH 53 — Part 3 (Stage A): Intro fixes, patch notes, pause menu, quit→launcher

## What was added / fixed

### 🪧 Intro "full black" after ONEBLOCKAWAY
- The credit cards used an animation that faded to `opacity: 0` with
  `fill-mode: both`, so each card was invisible for most of its time — all you
  saw was the four progress dots on a black screen. Cards now fade in and stay
  visible.
- The **ONEBLOCKAWAY** title no longer wraps (the trailing Y dropped to its own
  line) — it now stays on one line and scales to fit.

### 📜 Patch notes
- Added a **Patch Notes** panel. It shows in the **launcher** (📜 Patch Notes
  under Play) and will show in the in-game menu.

### ⏸ Pause menu overhaul
- The pause menu is now a **Minecraft-style left-side panel** with the game name
  (EAOIN) on top and stacked buttons: Resume, Settings, Inventory, Character,
  Quit to Launcher — dimming the world behind it.

### 🚪 Quit now goes to the launcher
- The main-menu **Quit** button (and the in-game "Quit to Launcher") now return
  you to the **launcher** to pick a different build — they no longer close the
  app.

## Build & tests
- Full suite: **54 files, 597 tests — all passing**.
- `npm run build` → **0 type errors**.

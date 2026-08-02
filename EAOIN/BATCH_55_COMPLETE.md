# BATCH 55 — Critical HUD/overlap fixes + F5 third-person + textured player + more mobs

## What was fixed / added

### 🧩 HUD overlapping (minimap, double chat, pause buttons covered)
- **Double chat fixed**: GameCanvas owns the real chat; the decorative HudFrame
  chat is now hidden so there is only ONE chat on screen (was overlapping).
- **Pause/escape buttons now clickable**: the pause panel is forced to the top
  stack (z-index 1000) with pointer-events, so nothing covers its buttons.
- **Panels draggable**: all in-game panels (inventory / shaders / mods / dims /
  bosses / quests / civs / space / etc.) can now be **dragged around by their
  header**, so nothing ever gets stuck underneath another panel.
- Cleaner minimap / quest / systems corner layout so they don't pile on top of
  each other.

### 🎥 F5 third-person fixes
- The avatar no longer **falls off / sinks** over uneven ground — it now stands
  on the real terrain surface at its own feet instead of reusing the camera's
  height.
- Cleaner show/hide so returning to first person doesn't leave a duplicate.

### 🧍 Textured player
- The third-person player is no longer a flat, untextured box — it now uses the
  character's **skin / hair / shirt / pants / cape** colours with a real face
  (eyes + mouth) on the head, and an optional **cape** on the back.

### 🐾 More Minecraft mobs
- Added: **Allay**, **Sniffer**, **Armadillo**, **Breeze**, and **Tadpole** —
  across their natural biomes.

### 🪧 Intro "warning still black" fixed
- The warning and engine scenes used an animation that faded back out to black
  (same bug as the credits). They now use a staying-visible fade-in, so the
  Health & Safety card and the Obsidian Engine card actually stay on screen.

## Build & tests
- Full suite: **54 files, 597 tests — all passing**.
- `npm run build` → **0 type errors**.

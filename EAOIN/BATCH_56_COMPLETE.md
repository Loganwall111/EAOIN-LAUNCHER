# BATCH 56 — Part 3 (final) + Part 4 (coloured lighting, Super Settings, cameras, TV/computers, furniture)

## Part 3 (final)

### 🧑 MCP Player Block
- New block **315: MCP Player Block**. Right-click it to activate an NPC that
  joins you (acts like a player type).
- **NPC villager** species added so `/ai summon` and the MCP block work.
- **NPC cosmetics**: each NPC persona (Alex / Aria / Zed / Nova) now has unique
  shirt / hair / skin / pants colours, so NPCs have distinct looks.

### 🤖 AI Chat in the launcher
- The launcher now has an **AI Chat** panel — type "build a castle", "mod add a
  ruby block", "plan a world" and the assistant replies (same engine as `/ai`).

## Part 4 — Coloured Lighting, Super Settings, Cameras & Screens, Furniture

### 💡 Coloured lighting & more light blocks
- New blocks: **Coloured Lamps (red/blue/green)**, **Torches (white/purple/
  cyan)**, **Glow Glass**, **Fancy Lamp**.
- A **ColoredLighting** runtime scans for emissive blocks around the player and
  **mixes their tints** into a dynamic light — so light literally changes colour
  when another coloured light passes through it.
- Emissive blocks now glow in their **own colour** (not washed-out white).

### ⚡ Super Settings (new deep settings layer)
- A fully-tabbed **Super Settings** panel (underneath the regular Settings, and
  reachable from Options → Gameplay → "Open Super Settings"):
  - Lighting: coloured lighting, light mixing, god rays, glass refraction, glow
    intensity.
  - World: sky / fog / day / night colour overrides.
  - Camera: snapshot **photo** or **video** capture.
  - **Hardware ray tracing** (experimental, OFF by default).
  - Debug: chunk borders, wireframe, dev god-mode / no-clip.
  - Mods & Editor: mod rebuilder + in-game world editor shortcuts.

### 📺 Cameras, TV & Computers
- New blocks: **TV Screen** and **Computer**.
- A **ScreenSystem** projects a **live view of the game** onto TV / Computer
  faces — the "project anything you capture in the game back into the game"
  feature (a real monitor-style live capture via DynamicTexture).

### 🛋️ Furniture & decorative blocks
- New blocks: **Chair, Table, Sofa, Shelf, Lamp (Fancy)**.
- Village houses now have chairs, tables and lamps inside; cities get a **movie
  theatre** with a big TV screen and sofas facing it.

## Build & tests
- Full suite: **54 files, 597 tests — all passing**.
- `npm run build` → **0 type errors**.

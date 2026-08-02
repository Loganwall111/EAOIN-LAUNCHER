# BATCH 39 — HorizonOS becomes a real OS + AAA intro/warp + lipsync + deeper worlds

This batch turns HorizonOS into a full little operating system and nails the
missing AAA intro pieces.

## What got done

### 🖥️ HorizonOS — a real in-game operating system
- **Moved to the main menu.** HorizonOS is no longer buried inside Multiplayer.
  It is now its own main-menu button right below **Multiplayer** (looks like the
  Marketplace / Editor buttons). Its back button returns to the title screen.
- **Draggable windows.** Every window can be grabbed by its title bar and moved
  anywhere on the desktop (pointer-driven drag, brought to front on click).
- **📶 Wi-Fi tray.** A Wi-Fi icon now sits at the bottom-right of the taskbar.
  Clicking it opens a real **network panel**: a list of networks with signal
  bars, lock icons and a connect/disconnect toggle. (Currently ships EAOIN_5G,
  Nebula_Prime, The Humorous WiFi, Backrooms_Guest.)
- **File Explorer** — now a real windowed file browser with a sidebar (Quick
  access / This PC / Documents / Downloads / Pictures / Games / System), a
  toolbar (back/up/home), an address bar, breadcrumbs, a grid view, and a
  document viewer. Double-clicking a folder steps inside; double-clicking a
  file opens it in a built-in reader. Ships a lore-rich fake filesystem
  (server codes, the Humorous dimension file, the Creator's notes, etc.).
- **Game Hub** — a launcher with **two playable built-in mini-games**:
  - **Arena Shooter** — a canvas target shooter. Click the warp-flecks before
    they escape; clears the board. Tracks a high score.
  - **Memory Cards** — a classic match-the-pair card game. Tracks best moves.
- **Nebula Browser** — a real browser UI with an address bar, quick links
  (YouTube, Wikipedia, Google, GitHub), tabs, and an **Extension Store**.
  Downloading an extension installs it; **Dark Reader** actually re-filters the
  page (moon icon in the toolbar), and **Ad Buster** counts blocked hosts.
  Sites that refuse to be embedded get a helpful "open in a real tab" card
  instead of a dead frame.

### 🎬 AAA intro — ONEBLOCKAWAY STUDIO + warp into the menu
- The studio entrance is now properly branded **ONEBLOCKAWAY STUDIO** (in caps,
  in the cinematic phase and the status rail) as a true title-sequence before
  the rest of the boot.
- **Distortion warp** — after the "Press any key / click to play" prompt the
  screen now streaks through a neon warp tunnel (spinning rings, flash, scale +
  blur distortion) and drops you straight into the main menu, fast.

### 🗣️ Real audio-driven lipsync (Cosmic Girl)
- The Cosmic Girl's mouth is no longer a fake CSS loop. Her narration clip is
  now routed through an **AudioContext + AnalyserNode**, and the mouth opens
  and closes in real time with the actual amplitude of her voice.

### 🏙️ Bigger, denser server lobbies
- Lobbies rebuilt as **walkable block-built cities**: every 16×16 chunk is a
  city block with a central fountain plaza, radiating roads with lampposts, a
  perimeter wall with torches, varied themed buildings (windows, roofs, glow
  lamps) — so the whole render radius is dense and populated.

### 🍄 Deeper The Humorous
- New comedic structures on the floating isles: **crystal spires**, **punchline
  arches**, **laugh-houses**, **jest-frog ponds**, and glow clusters.
- New creatures: **Giggle Sprite**, **Pun Golem**, **Jesting Frog** and
  **Chorus Wisp** (joining Cosmic Jelly & Particle Moth).

## Build & tests
- `npm run build` → **0 type errors**.
- Full suite: only the **12 pre-existing** failures remain (AdvancedTerrain /
  world-load / worldgen artifacts / settings-spawn — unrelated to these
  features). All HorizonOS, menu, boot, marketplace, wildlife, dimension and
  creature tests pass.

## What's left (future batches)
- More OS apps (music player, mail, calendar).
- More mini-game arcade cabinets in the Game Hub.
- A bigger, continuously-generating server city (suburbs, docks, towers).
- Additional The Humorous structures/creatures + a boss.

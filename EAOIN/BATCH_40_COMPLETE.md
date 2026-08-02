# BATCH 40 — Loading polish, animated Cosmic Girl, OS apps, snake, big cities, Humorous boss

## What got done

### 🎬 Loading sequence polish
- **Purple loading bar moved to the bottom** of the frame (no longer floating in
  the middle) with the "SYNCHRONIZING…" text sitting right above it.
- **Removed the rectangular purple glow in the middle** of the galaxy-rush
  loading screen — the frame is now clean stars/neuron-field only.
- **Added a white flash-bang** that pops right before the Cosmic Girl begins to
  speak, so the hand-off to her dream sequence feels like a camera snap.

### 🌌 Animated Cosmic Girl (no more static picture)
- Replaced the flat portrait PNG with a **procedural, animated voxel-style
  figure** that actually moves:
  - **Looks directly at you** with a face (eyes that blink, hair).
  - **Waves her arms** gently (left/right wave cycle).
  - **Swings her legs** and bobs her body in a floating hover.
  - Her **mouth still follows her real voice** (audio-driven lipsync via the
    AnalyserNode) — plus a glowing aura.

### 🖥️ Three new OS apps
- **🎵 Music Player** — a real working music player that *synthesizes* 4 ambient
  tracks live with the WebAudio API (no files needed): play/pause, next/prev,
  volume, progress bar and a live EQ visualizer.
- **✉️ Mail** — a working mail client: inbox with unread counts, a reading pane,
  and a Compose form that can "send" to the inbox. Ships with EAOIN-flavoured
  messages (server notices, the Humorous boss alert, studio patch notes).
- **📅 Calendar** — a full month grid with world events (blood moon, Oris
  incursion, Psychedelics moon, jingle release…) plus a click-to-add reminder.

### 🕹️ Game Hub — third cabinet
- **Neon Snake** added to the arcade: arrow-key/WASD grid snake with food,
  growing tail, high score, and game-over restart.

### 🏙️ Continuously-generating server city
- Lobbies are now **district cities** that keep growing in every direction:
  the origin is a grand central plaza, then chunks roll into **suburbs** (low
  houses), **tower districts** (tall towers with window bands + roof beacons)
  and **dock districts** (a water canal with piers and little boats), all walled
  and lamplit.

### 🃏 Proper Humorous boss
- **The Pun Overlord** — a new `expert` boss in `BossRegistry` for dimension
  `humorous`, with abilities (Punchline Cannon, Laugh Wave, Summon Giggle
  Sprite, Groan Aura, Roar of Mockery), 4 phases, arena "The Grand Podium" and
  themed drops. It appears alongside the Giggle Sprites, Pun Golems, Jesting
  Frogs and Chorus Wisps already roaming the isles.

## Build & tests
- `npm run build` → **0 type errors**.
- Related suites (menu, title screen, app smoke, wildlife, creatures, dimension
  chunk source, spawn awakening) all pass. Only the same pre-existing failures
  remain (world-loading-screen black-canvas guards + the other ~10 unrelated
  worldgen/terrain ones).

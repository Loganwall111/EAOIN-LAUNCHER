# BATCH 44 — Dimension spawning fixes, remove wake-up placeholder, real camera tilt

## What got fixed

### 🌍 Player no longer spawns underground in dimensions
- Dimension travel (portal entry, dimension menu, planet approach, cycle) placed
  the camera at `surface + PLAYER_EYE_HEIGHT`, but the surface block occupies
  `surface..surface+1`, so the player's body was one block *inside* the ground.
  All four travel paths now use `surface + 1 + PLAYER_EYE_HEIGHT` — feet on the
  grass, eyes up — matching the overworld spawn.

### 🐄 Creatures no longer spawn underground in dimensions
- The creature spawner always queried the **overworld** terrain for surface /
  voxel / biome, so in a dimension with its own terrain (nether, The Humorous,
  the End, etc.) creatures were buried under that dimension's ground.
- The spawner now routes through a dimension-aware source (`DimensionChunkSource`
  gained `getSurfaceHeight` / `getBlockAt` / `getBiomeAt`), so it reads the
  ACTIVE dimension's real terrain. Dimension biome ids are reported too, so
  species tagged for a dimension can actually spawn there.

### 🎬 Removed the "hands going up" placeholder wake-up
- The blue-screen **WAKE** phase (first-person hands rising into the air) after
  the Cosmic Girl's narration is gone. After the "EAOIN / THIS WORLD AWAITS"
  title reveal, the game now hands **straight off to the eyes-open awakening**
  sequence (eyelids blinking open over the live world).

### 🎥 Real first-person camera tilt (no more tilting face)
- The old third-person body figure with the tilting head/face during the
  awakening has been removed.
- Instead, the **actual in-game camera now tilts**: as the awakening plays, the
  camera eases from looking down at the ground (face-down) up to level/slightly
  up — pulling itself off the ground and looking back up, exactly the first-person
  wake-up feel. It's driven by the awakening's beats via a `eaoin-awakening-tilt`
  event and only ever adds a delta, so it never fights the mouse-look afterward.

## Build & tests
- Full suite: **54 files, 597 tests — all passing**.
- `npm run build` → **0 type errors**.

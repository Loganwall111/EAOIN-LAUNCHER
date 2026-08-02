# BATCH 50 — Next-Generation Update, Part 2 (Stage A): Creative HUD, cities, mobs & biomes

## What was added

### 🎨 Creative mode UI cleanup
- In **Creative / Experimental** modes the survival HUD bars are hidden: no
  health, stamina (drink) or hunger bars. The game already prevents creative
  death/damage — now the HUD matches the mode instead of showing survival
  vitals you can't lose.

### 🏙️ Rare city structures
- Added large, block-built **cities** that spawn **very rarely** on flat grassy
  ground far from spawn: a grid of gravel streets, quiet suburban houses, a few
  taller city towers with glass windows and glowing roof beacons, and a central
  town square with a fountain. Cities don't spawn everywhere — they're special
  finds (roughly 1 in ~5200 chunks), unlike villages.

### 🐐 / 👁️ / 🟨 New mobs & biomes
- **The Warden** — the deep-dark guardian, hostile and brutal (400 HP), spawning
  in `deep_dark` / caves / ancient city / sculk.
- **Sulphur Cube** — the newest hostile cube, found in the new sulphur biome.
- **Sulphur Fields** biome added (cracked brimstone flats with toxic/fire
  hazards and sulphur blocks/ore).
- (Mountain **Goat** already existed; the newer Minecraft-style mobs like the
  Warden and the newest sulphur cube are now in.)

## Build & tests
- Full suite: **54 files, 597 tests — all passing**.
- `npm run build` → **0 type errors**.

## Next (Stage B)
- The **Ancient-City reality-rift portal** dimension (Minecraft-Dungeons inspired):
  a note/jukebox puzzle that opens a blue, rippling rift portal to a floating
  jellyfish dimension with orange/red/blue/pink hills and floating platforms.

# Automatic Batch Report — Batch 28

## Theme
Visible passive creatures, spawning, despawning, and simple AI.

## Completed

- Added `CreatureManager`, a runtime bridge for visible passive creature spawning without replacing the deeper creature architecture skeleton.
- Added passive placeholder creature types:
  - Sheep
  - Deer
  - Goat
  - Hare
- Added simple voxel-style creature mesh construction with body, head, legs, and species details such as horns/ears.
- Added biome-aware creature selection:
  - Forests favor deer/sheep.
  - Highlands favor goats/sheep.
  - Deserts spawn hares.
  - Plains spawn sheep/deer.
- Added deterministic cell-based spawn manager around the player.
- Added despawn manager for creatures outside the active radius.
- Added collision-safe spawn placement that avoids water/lakes, blocked headroom, invalid ground, and immediate player proximity.
- Added lightweight wander AI with random targets, safe ground checks, turning, and movement bobbing.
- Added creature counts to the render stats overlay.

## Validation

- `npm run build` passes.
- `npm test` passes: 5 tests across 2 files.

## Next batch recommendation

Batch 29 should add crafting and UI: inventory panel, basic recipes, crafting interaction flow, and expanded item/stack display.

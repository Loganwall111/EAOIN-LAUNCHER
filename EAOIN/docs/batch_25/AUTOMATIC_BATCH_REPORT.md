# Automatic Batch Report — Batch 25

## Theme
Tool tiers, block hardness, and hold-to-break mining.

## Completed

- Added `ToolState` runtime module with hand, wooden pickaxe, stone pickaxe, wooden axe, and wooden shovel definitions.
- Added tool kinds, tiers, mining speeds, preferred block tool profiles, and harvest/drop checks.
- Added `T` key tool cycling and visible toolbelt HUD.
- Converted left-click block breaking into hold-to-break mining.
- Added mining duration calculations from block hardness and selected tool effectiveness.
- Added no-drop behavior when mining tiered blocks with an insufficient tool.
- Added mining progress label and progress bar at the crosshair.
- Updated action messaging to show selected tool, mining duration, canceled mining, and mining drops.

## Validation

- `npm run build` passes.
- `npm test` passes: 5 tests across 2 files.

## Next batch recommendation

Batch 26 should optimize runtime world rendering: dirty-chunk remeshing, movement-based chunk streaming, chunk disposal outside render radius, and a render statistics overlay.

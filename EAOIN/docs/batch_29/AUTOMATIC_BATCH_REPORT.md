# Automatic Batch Report — Macro Batch 29

## Theme
Larger patch mode: crafting, inventory UI, tool progression, and player save/load in one bundle.

## Completed

- Switched to macro-batch delivery guidance for future work: bundle 10–15 related features where possible, then validate.
- Added `RecipeBook` with typed recipes, costs, outputs, craft validation, and result messaging.
- Added craftable tool unlock recipes for wooden pickaxe, stone pickaxe, wooden axe, and wooden shovel.
- Added block/material conversion recipes for dirt, stone, sand, and prototype charcoal/coal.
- Added `ToolInventory` support so tools can be locked/unlocked instead of all being available immediately.
- Updated tool cycling so `T` only cycles unlocked tools.
- Added locked/unlocked visual states to the toolbelt.
- Added inventory/crafting panel toggled by `I` or `E`.
- Added inventory material grid with all block stack counts.
- Added crafting recipe cards with cost/output/description and disabled states for missing resources.
- Added crafting action flow that consumes resources, outputs blocks, and unlocks tools.
- Added `PlayerSaveManager` for seed-scoped persistence of inventory, unlocked tools, selected tool, and survival stats.
- Added automatic player-progress save while playing.
- Added loading of saved player progress on world start.
- Added reset-player-progress control in the inventory panel.
- Added help/control hints directly in the inventory panel.

## Validation

- `npm run build` passes.
- `npm test` passes: 5 tests across 2 files.

## Next macro-batch recommendation

Macro Batch 30 should combine multiple script-parity gameplay systems: audio feedback, settings/menu polish, basic combat/creature interaction, item drops, and world objective markers.

# BATCH 23 COMPLETE — Save/Load Persistence

Batch 23 makes edited worlds persist between reloads using deterministic generation plus saved block edits.

## Added

- Seed-scoped localStorage save manager.
- Saved block edit schema with coordinates and block IDs.
- Loading saved edits into generated chunks.
- Automatic save after block break/place.
- Save status message in the game HUD.
- `RESET WORLD` control to clear saved edits for the current seed.

## Verified

- `npm run build`
- `npm test`

Both pass.

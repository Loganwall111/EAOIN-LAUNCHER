# BATCH 26 COMPLETE — Streaming and Render Performance

Batch 26 adds the first real runtime streaming/render performance layer.

## Added

- Per-chunk render manager.
- Chunk-local meshes grouped by block material.
- Dirty chunk rebuild after mining/placing.
- Boundary-aware neighbour rebuilds for chunk-edge edits.
- Movement-based chunk streaming from player camera position.
- Far chunk disposal outside render radius.
- Chunk seam rebuilds when chunks load/unload.
- Render statistics overlay: FPS, chunks, meshes, triangles, rebuilds.

## Verified

- `npm run build`
- `npm test`

Both pass.

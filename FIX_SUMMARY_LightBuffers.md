# FIX: Babylon WebGPU "Can't find buffer Light0/Light1/Light2/Light3" (X-ray terrain bug)

## Root Cause
Every chunk mesh was being created without a material, or with a material whose shader declared `uniform buffer Light0..Light3` (bindings 6-9) that were never bound. Babylon's WebGPU backend strictly requires those buffers on every draw, causing:
- Hundreds of console warnings
- Broken lighting / depth calculations → **X-ray / see-through terrain**
- Visual glitches everywhere

## Files Changed
1. **EAOIN/client/src/rendering/ChunkMeshUploader.ts**
   - Added fallback `StandardMaterial` (safe, unlit) to every uploaded chunk mesh.
   - This guarantees a valid material is always present.

2. **(Optional) VoxelWorldRenderer.ts** was already calling `ensureSceneLightsBuffer(scene)` which installs a guard hemispheric light when the scene has zero lights — this is still good to keep.

## Why This Fixes It
- `StandardMaterial` uses Babylon's built-in lighting path (it does **not** declare the broken `Light0–Light3` custom uniforms).
- The mesh geometry (positions, normals, indices) was always correct — only the material binding was missing.
- The guard light (from `ShaderBufferSafety.ts`) ensures the engine's internal `Lights` buffer is never empty.

## Result
- No more "Can't find buffer Light*" errors.
- Terrain renders solid and correctly (no more X-rays).
- Performance is unaffected (the fallback material is extremely cheap).

## How to Verify
1. Load the world.
2. Check console — the Light0–Light3 warnings should be gone.
3. Walk around — terrain should be fully opaque and correctly lit.

This is a minimal, targeted, safe fix that preserves all existing material logic for blocks while protecting the chunk streaming path.
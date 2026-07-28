# World Generation Architecture

How EAOIN builds a chunk, why the pipeline is split the way it is, and the
rules a new pass has to follow. Written after fixing four classes of visual
artefact: chunk-border cliffs, floating topsoil sheets, floating single blocks,
and props spawning at the wrong height.

Language/stack: **TypeScript**, BabylonJS/WebGPU renderer, 16 x 128 x 16 chunks
(`CHUNK_SIZE = 16`, `CHUNK_HEIGHT = 128`).

Primary files:

| File | Role |
| --- | --- |
| `src/world/AdvancedNoise.ts` | Gradient (Perlin) noise, fBm, ridge, domain warp |
| `src/world/AdvancedTerrainGenerator.ts` | The pass pipeline |
| `src/world/Chunk.ts` | Voxel storage (`Uint16Array`) |
| `tests/unit/worldgen-artifacts.test.ts` | Regression tests for all four artefacts |

---

## 1. The pipeline

Generation is three strictly ordered stages. The ordering is the architecture:
every artefact fixed here was a later stage consuming data owned by an earlier
one.

```
STAGE 1 — SHAPE
    fillContinents() / fillSkyIslands()
    Analytic heightmap  ->  solid voxels.
    May use getTerrainHeight() freely.

STAGE 2 — CARVE
    applyCavePass, deepCaves.apply, applyRavines, applySinkholes,
    applyUndergroundOceansAndRivers, applyOrePass, applyGeologyPass
    May only REMOVE or RETYPE voxels. Still may read getTerrainHeight()
    (it needs to know how much rock is overhead).

============ the analytic heightmap is now STALE ============

STAGE 3 — DRESS
    applySurfacePass, applyPendingSpill, applyVegetation, applyStructures
    MUST locate the ground with findSkyExposedSurface() / getSurfaceHeight().
    Calling getTerrainHeight() here is the bug.
```

### Why the stale-heightmap rule matters

`getTerrainHeight(x, z)` answers *"where would the ground be if nothing had
touched it"*. After Stage 2 that is no longer where the ground is: a cave, a
ravine or a sinkhole may have removed twenty blocks from the column.

A Stage 3 pass that writes at `getTerrainHeight(x, z)` therefore writes into
**empty air**, creating a block instead of recolouring one. Because the
analytic height varies smoothly across neighbouring columns, those stray blocks
line up into continuous horizontal sheets — the floating grass slicing through
the sky and through tree trunks.

Measured on the pre-fix generator, over a 7x7-chunk area: **8.6% of columns**
had an analytic surface that disagreed with the real terrain top, and **523
columns** had it sitting directly over air.

---

## 2. Noise continuity

### The seamless-coordinate rule

Noise is **always** sampled in continuous global world coordinates. There is no
per-chunk noise instance, no per-chunk reseeding, and no reset of the sample
origin at a chunk boundary. A chunk is only a *window* onto one global field:

```ts
// AdvancedTerrainGenerator.forEachLocalBlock
for (let lx = 0; lx < CHUNK_SIZE; lx++) {
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    const wx = chunk.x * CHUNK_SIZE + lx;   // GLOBAL coordinate
    const wz = chunk.z * CHUNK_SIZE + lz;
    visit(lx, lz, wx, wz);                  // passes get wx/wz, never lx/lz
  }
}
```

Because `h(x, z)` depends only on `(x, z)`, the column at world x=15 (last of
chunk 0) and x=16 (first of chunk 1) are two adjacent samples of the same
continuous function. Adjacent chunks agree by construction.

Three specific things to check for in any voxel generator — all of which
produce hard vertical cuts:

1. **Early integer casting.** Do not floor the coordinate before scaling it.
   `noise(Math.floor(x * 0.01))` quantises the input and produces flat plateaus
   with vertical steps between them. Scale first, floor only inside the noise
   function where the lattice cell is computed.
2. **Per-chunk sampling.** `noise(lx, lz)` or `noise(chunkX, chunkZ)` restarts
   the field in every chunk. This generator had a real instance of this in the
   underground-lake pass, which sampled chunk indices as if they were world
   coordinates and flooded whole chunks uniformly, giving hard rectangular
   edges.
3. **Clamping that saturates.** A clamp that engages often flattens the tails
   of the distribution into constant plateaus. See §2.2.

### 2.1 Gradient noise, not value noise

The old `AdvancedNoise` interpolated a *hashed value* at each lattice corner.
Value noise is continuous, but **every lattice point is a local extremum**, so
the field is a grid of bumps whose maxima and minima all sit on integer
coordinates. Summed over octaves, those axis-aligned features reinforce and the
terrain grows straight ridges and terraces on a regular grid.

Gradient (Perlin) noise stores a pseudo-random *direction* per corner and
interpolates the dot product with the offset vector. The field is zero at every
lattice point, so there is no grid of extrema and no preferred axis:

```ts
noise2D(x, y, salt) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;              // fractional part kept in full
  const u = fade(xf), v = fade(yf);            // quintic: 6t^5-15t^4+10t^3

  // Per-axis hash contributions hoisted out of the four corners (perf).
  const base = this.seed ^ Math.imul(salt, 0x9E3779B1);
  const hx0 = Math.imul(xi, 0x85EBCA77), hx1 = Math.imul(xi + 1, 0x85EBCA77);
  const hy0 = Math.imul(yi, 0x27D4EB2F), hy1 = Math.imul(yi + 1, 0x27D4EB2F);

  const g00 = grad2(base ^ hx0 ^ hy0, xf,     yf);
  const g10 = grad2(base ^ hx1 ^ hy0, xf - 1, yf);
  const g01 = grad2(base ^ hx0 ^ hy1, xf,     yf - 1);
  const g11 = grad2(base ^ hx1 ^ hy1, xf - 1, yf - 1);

  const nx0 = g00 + (g10 - g00) * u;
  const nx1 = g01 + (g11 - g01) * u;
  const n   = nx0 + (nx1 - nx0) * v;
  // 2D Perlin is bounded by sqrt(2)/2; divide by that bound, then recentre.
  return clamp(n * (0.5 / 0.7071067811865476) + 0.5);   // -> [0,1]
}
```

The **quintic fade** replaces cubic smoothstep. Smoothstep is only C1: its
second derivative jumps at cell boundaries, which shows up as a faint crease
along lattice lines. Quintic is C2, so curvature is continuous too.

### 2.2 Normalisation must divide by the bound, not multiply

Perlin output is bounded by `sqrt(N)/2`. To map it into `[0,1]`:

```ts
return clamp(n * (0.5 / 0.8660254) + 0.5);   // 3D: divide by sqrt(3)/2
```

Writing `n * 0.866 + 0.5` (multiplying) instead pushes roughly a fifth of all
samples past the clamp. The tails flatten into constant 0 / 1 plateaus, which
in the cave passes meant the "cheese chamber" threshold fired constantly and
the underground was over-carved. This was caught by measuring the marginal
distribution (`p01 = 0.000, p99 = 1.000` — a clear tell) rather than by eye.

**When you change a noise basis, re-check every threshold tuned against it.**
Old value-noise fBm had sd ≈ 0.138; the new gradient fBm has sd ≈ 0.100 (2D) and
≈ 0.118 (3D). Thresholds are quantiles of that distribution, so they do not
transfer automatically.

### 2.3 Domain warp must be a vector

The continental field had a real degeneracy:

```ts
// BEFORE — broken
const warp = this.noise.warped2D(cx, cz, 1.6, 1);      // a SCALAR
const continent = this.noise.fbm2D(warp * 1.2, warp * 1.2, 5);
```

Both arguments were the same number, so the 2D field was only ever sampled
along the line `x === z`. Continents degenerated into straight 45° bands, and
since `warped2D` returns `[0,1]`, the whole world sampled a 1.2-unit-wide
window of the fbm — which is why the measured height range was so narrow that
88% of the map cleared the "alpine" biome gate.

```ts
// AFTER — displace the coordinates, keeping the axes independent
const warped = this.noise.warpPoint2D(cx, cz, 1.6, 1);
return this.noise.fbm2D(warped.x, warped.y, 5, 2.0, 0.5, 2);
```

`warpPoint2D` also re-centres the offsets to `[-0.5, 0.5]` so the warp is a
swirl rather than a large constant translation.

---

## 3. Surface masking — the top-down sweep

Topsoil is placed by **observation**, never by formula. The pass walks each
column from the sky down, and the first solid voxel it meets is the surface:

```ts
private findSkyExposedSurface(chunk: Chunk, lx: number, lz: number): number {
  const from = Math.min(CHUNK_HEIGHT - 1, chunk.getHighestOccupiedY());
  for (let y = from; y >= 0; y--) {
    const b = chunk.getBlock(lx, y, lz);
    if (b === AIR) continue;
    if (isSkyTransparent(b)) continue;   // leaves, logs, plants, water
    return y;                            // first real terrain from the top
  }
  return -1;                             // column is empty
}
```

`applySurfacePass` then:

1. finds `surfaceY` with the sweep (skip the column if `-1`);
2. paints the biome's top material **only** at `surfaceY`, and only if the
   block already there is natural ground (`isNaturalGround`) — so it never
   paints over a structure's brickwork, an exposed ore, or bedrock;
3. paints filler downward while the block below is still `DIRT`;
4. fills sea level **into AIR only**, bounded by the real surface.

Every write is conditional on a voxel that was observed to exist. The pass can
recolour but cannot create, so floating topsoil is structurally impossible
rather than merely unlikely.

Two details that matter:

- **Leaves and water are transparent to the sweep.** Otherwise a tree stops the
  search and the pass paints grass onto a canopy; a lake stops it and the pass
  never finds the lake bed.
- **Underground topsoil is legitimate.** Moss on the floor of a lush cavern is
  placed by the deep-cave dresser. The regression test is therefore written as
  *"no topsoil strictly above the column's sky-exposed surface"*, not *"no
  topsoil with a block on top"*, which would have flagged correct cave floors.

---

## 4. Decoration and placement

### 4.1 The height-query contract

| Method | Returns | Use for |
| --- | --- | --- |
| `getHeightAt(x, z)` | Analytic, pre-carve. Does not generate a chunk. | Wide surveys, minimap, LOD, biome logic |
| `getSurfaceHeight(x, z)` | Real highest sky-exposed voxel. Generates the chunk. | **Anything placed into the world** |
| `hasClearanceAbove(x, z, h)` | Is there `h` blocks of air above the ground? | Gating a feature before building it |

Anything that spawns — mobs, NPCs, villages, portals, quest props, Arena AI
actors, boss encounters — places at `getSurfaceHeight() + 1`. Using
`getHeightAt()` is what left entities hovering over carved ground or standing
buried inside a hill.

Call sites updated to the correct query: `CreatureManager.safeGroundPosition`,
`SettlementRuntime.groundPosition`, `WorldInteractionRuntime` (doors, rocket),
`NextGenRuntime` (city towers, road), `LogicRuntime` (signal rig),
`GameCanvas` (boss spawn).

### 4.2 Vegetation

```ts
const surface = this.findSkyExposedSurface(chunk, lx, lz);  // voxels, not heightmap
if (surface < 0) return;
const top = chunk.getBlock(lx, surface, lz);
if (top === WATER || top === AIR) return;
if (!isNaturalGround(top)) return;                          // no trees on brick
if (chunk.getBlock(lx, surface + 1, lz) !== AIR) return;    // space is free
```

### 4.3 Cross-chunk features: the spill buffer

A feature anchored near a chunk edge overhangs its neighbour. The old
`setBlockIfInChunk` silently **discarded** those writes, so a tree at local
x=15 lost the half of its canopy belonging to the next chunk. Measured on a
forced-forest world, edge columns held ~26% fewer leaf blocks than middle
columns — flat, sheared canopies along every chunk boundary.

Now the overhang is routed to the chunk that owns it:

```ts
private setBlockIfInChunk(chunk, worldX, y, worldZ, block) {
  const lx = worldX - chunk.x * CHUNK_SIZE, lz = worldZ - chunk.z * CHUNK_SIZE;
  if (inBounds(lx, lz)) { chunk.setBlock(lx, y, lz, block); return; }
  this.spillBlock(worldX, y, worldZ, block);     // -> neighbour
}
```

- Neighbour already built → apply now, mark `meshDirty`.
- Neighbour not built yet → queue it; `generateChunk` drains the queue
  (`applyPendingSpill`) right after its surface pass.

Two invariants keep this deterministic:

- **Spill writes fill AIR only.** A feature may not carve terrain, a player
  edit, or another feature out of the neighbouring chunk.
- **Both paths behave identically**, so the result does not depend on which
  chunk was generated first. This is pinned by a test that generates a 5x5
  region forward and reversed and compares every voxel.

The buffer is bounded (`SPILL_CHUNK_LIMIT = 4096` chunks) so an unexplored
frontier cannot grow without limit.

---

## 5. Biome boundaries must not follow the chunk grid

A biome change carries a change of surface material, so if biome boundaries
land on a fixed offset within every chunk they draw dead-straight lines across
the world that read as chunk seams — even when the heightmap is perfectly
continuous.

The elevation field used for biome decisions was quantised:

```ts
// BEFORE — piecewise-constant on a 16-block lattice (the same 16 as a chunk)
const x = Math.round(worldX / 16) * 16;
return stencilAt(x, z);
```

Measured: **100% of biome transitions along an 800-block transect landed on a
single offset within the chunk grid.**

The fix keeps the coarse lattice for cost, but **interpolates** between nodes
with smoothstep weights, restoring a continuous field:

```ts
const gx = Math.floor(worldX / step), gz = Math.floor(worldZ / step);
const fx = worldX / step - gx,        fz = worldZ / step - gz;
const h00 = node(gx, gz),     h10 = node(gx + 1, gz);
const h01 = node(gx, gz + 1), h11 = node(gx + 1, gz + 1);
const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
// bilinear blend -> smooth elevation, boundaries follow the landform
```

Worst-offset share is now ~9-11% against a 6.25% ideal (perfect uniformity).

Related: biome elevation gates are expressed **relative to sea level**
(`ALPINE_ELEVATION = 26`, `ICE_CAP_ELEVATION = 38` above `seaLevel`) rather than
as absolute Y. The old absolute `> 48` / `> 56` literals silently turned the
entire map into ice spikes once the heightmap range changed.

---

## 6. Rules for a new pass

1. Sample noise in **global world coordinates**. Never `lx/lz`, never
   `chunkX/chunkZ`, never floor before scaling.
2. Decide which stage you are in. Stage 3 may **not** call
   `getTerrainHeight()`.
3. Locate ground with `findSkyExposedSurface()` (inside the generator) or
   `getSurfaceHeight()` (outside it).
4. Never write a solid block into air unless you are deliberately building a
   feature. Surface/dressing passes recolour only.
5. Features that overhang go through `setBlockIfInChunk`, which handles the
   neighbour. Never drop the write.
6. Fluids need a floor; `applyFluidSettling` sweeps bottom-up as a safety net.
7. If you change a noise basis or frequency, **re-measure every threshold** —
   they are quantiles of a distribution you just changed.

---

## 7. Regression tests

`tests/unit/worldgen-artifacts.test.ts` (17 tests). **6 of them fail against
the pre-fix generator**, so they are real coverage, not tautologies.

| Test | Pins |
| --- | --- |
| continuous across `x % 16 === 15` | border steps statistically equal interior steps |
| identical global-coordinate sampling | height is a pure function of `(x, z)` |
| voxel heights agree at seams | no sheer walls on the chunk grid |
| noise continuity / range / isotropy | small input step ⇒ small output step; no clipped tails; `f(x,z) ≠ f(z,x)` |
| **surface pass creates 0 blocks in mid-air** | instruments `Chunk.setBlock`; the exact floating-sheet mechanism |
| no topsoil above the surface | the visible artefact |
| surface coverage > 90% | the sweep still dresses the world |
| flood-fill from bedrock ⇒ 0 floating terrain | merged multi-chunk volume |
| water always supported | no floating pools |
| `getSurfaceHeight` correctness | nothing solid above the reported surface |
| every tree trunk rooted | no mid-air trees |
| canopy edge/middle ratio > 0.7 | no clipping at borders |
| generation-order independence | spill buffer is deterministic |
| biome transitions not lattice-aligned | worst offset share < 25% |

Measurement note: survey floating debris over a **merged multi-chunk volume**.
Flood-filling one chunk at a time reports real, supported terrain as
"floating" wherever it is held up through a neighbour — that false signal cost
a detour during this work.

---

## 8. Results

| Metric | Before | After |
| --- | --- | --- |
| Surface-pass blocks created in mid-air | 27 / 19 / 2 (per seed, 7x7 chunks) | **0** |
| Unsupported terrain (merged flood-fill) | present | **0** |
| Biome transitions on one chunk offset | **100%** | 9-11% (6.25% ideal) |
| Tree canopy, edge vs middle columns | 0.69 | 0.84-1.0 |
| Trees in a default 17x17-chunk world | **0 logs** | 310 logs / 14,865 leaves |
| Biome distribution | 82% ice_spikes, 15% alpine | plains/meadow/savanna/forest/… |
| World height p05-p95 | 46-74 (88% above alpine gate) | 37-77 |
| Chunk generation | 11.0 ms | 12.2 ms |

Chunk generation is ~11% slower than the original: gradient noise costs more
per sample than value noise. That was offset by hoisting per-axis hash
contributions out of the corner loop in `noise2D`/`noise3D` (16.7 ms → 12.2 ms).
Terrain streams incrementally, so the remaining ~1.2 ms/chunk is not
frame-visible.

Full suite: **392 tests passing**, `tsc --noEmit` clean (one pre-existing
unrelated warning in `VoxelWorldRenderer.ts`), production build succeeds.

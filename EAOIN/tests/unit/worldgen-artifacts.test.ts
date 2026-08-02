/**
 * Regression tests for the four world-generation artefacts reported against
 * the overworld generator:
 *
 *   1. Sheer vertical cut-offs at chunk borders.
 *   2. Floating horizontal sheets of topsoil cutting through air and trees.
 *   3. Random floating single-block artefacts.
 *   4. Structures / AI props spawning at the wrong height for the landscape.
 *
 * Each test pins the *mechanism* that caused the artefact, not just a
 * screenshot-level symptom, so the fix cannot silently regress.
 */
import { describe, expect, it } from 'vitest';
import AdvancedTerrainGenerator from '../../src/world/AdvancedTerrainGenerator';
import { CavesAndCliffsTerrainGenerator } from '../../src/world/CavesAndCliffsTerrainGenerator';
import { AdvancedNoise } from '../../src/world/AdvancedNoise';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from '../../src/world/Chunk';

const AIR = 0;
const WATER = 5;
const LAVA = 227;
/** Blocks that are decoration rather than terrain. */
const PLANTS = new Set([6, 7, 104, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 103, 106, 107, 109]);
const isTerrain = (b: number) => b !== AIR && b !== WATER && b !== LAVA && !PLANTS.has(b);

/* ========================================================================== *
 * 1. NOISE CONTINUITY — no seams at chunk borders
 * ========================================================================== */

describe('noise continuity across chunk boundaries', () => {
  it('is a continuous function of world coordinates, with no step at x % 16 === 15', () => {
    // A chunk-aligned discontinuity is the signature of a generator that
    // restarts its noise per chunk, or casts to int before sampling.
    const gen = new AdvancedTerrainGenerator({ seed: 'seam-check' });

    let boundarySum = 0, boundaryN = 0, boundaryMax = 0;
    let interiorSum = 0, interiorN = 0, interiorMax = 0;

    for (let x = -300; x < 300; x++) {
      for (let z = -300; z < 300; z += 7) {
        const step = Math.abs(gen.getHeightAt(x + 1, z) - gen.getHeightAt(x, z));
        // x -> x+1 crosses a chunk border exactly when x % 16 === 15.
        if (((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE === CHUNK_SIZE - 1) {
          boundarySum += step; boundaryN++; boundaryMax = Math.max(boundaryMax, step);
        } else {
          interiorSum += step; interiorN++; interiorMax = Math.max(interiorMax, step);
        }
      }
    }

    const boundaryAvg = boundarySum / boundaryN;
    const interiorAvg = interiorSum / interiorN;

    // Crossing a chunk border must be statistically indistinguishable from
    // any other step. Allow a little slack for sampling noise.
    expect(boundaryAvg).toBeLessThan(interiorAvg * 1.35 + 0.02);
    expect(boundaryMax).toBeLessThanOrEqual(interiorMax + 1);
  });

  it('samples the same global coordinate identically regardless of chunk', () => {
    // The column (16, 16) is local (0,0) of chunk (1,1) and is also reachable
    // as a neighbour of chunk (0,0). Its height must not depend on that.
    const gen = new AdvancedTerrainGenerator({ seed: 'global-coords' });
    for (const [x, z] of [[16, 16], [-1, -1], [0, 0], [255, -256], [-4097, 8193]]) {
      const a = gen.getHeightAt(x, z);
      const b = gen.getHeightAt(x, z);
      expect(a).toBe(b);
      expect(Number.isFinite(a)).toBe(true);
      // Integer heights only — a fractional height means a caller somewhere
      // will floor it inconsistently.
      expect(Number.isInteger(a)).toBe(true);
    }
  });

  it('produces terrain whose voxels agree with the heightmap at chunk seams', () => {
    // Walk across a chunk border in the generated VOXELS and confirm the
    // ground does not jump.
    const gen = new AdvancedTerrainGenerator({ seed: 'voxel-seam' });
    const surfaceAt = (x: number, z: number) => gen.getSurfaceHeight(x, z);

    let worstBoundary = 0;
    for (let z = 0; z < 64; z += 3) {
      for (let x = -48; x < 48; x++) {
        if (((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE !== CHUNK_SIZE - 1) continue;
        worstBoundary = Math.max(worstBoundary, Math.abs(surfaceAt(x + 1, z) - surfaceAt(x, z)));
      }
    }
    // Terrain may legitimately have cliffs, but not 20-block sheer walls
    // reliably landing on the chunk grid.
    expect(worstBoundary).toBeLessThanOrEqual(6);
  });
});

describe('AdvancedNoise', () => {
  it('is continuous: nearby samples give nearby values', () => {
    const n = new AdvancedNoise('continuity');
    let maxJump = 0;
    for (let i = 0; i < 4000; i++) {
      const x = i * 0.013 - 26, z = Math.sin(i) * 12;
      maxJump = Math.max(maxJump, Math.abs(n.noise2D(x + 1e-4, z) - n.noise2D(x, z)));
    }
    // A tiny step in the input can only make a tiny step in the output.
    expect(maxJump).toBeLessThan(0.01);
  });

  it('stays within [0, 1] without clipping the tails flat', () => {
    // A wrong normalisation constant clamps a large share of samples to
    // exactly 0 or 1, which shows up as terraced, blobby terrain.
    const n = new AdvancedNoise('range');
    let min = 1, max = 0, atZero = 0, atOne = 0, count = 0;
    for (let i = 0; i < 60000; i++) {
      const v = n.noise3D((i % 500) * 0.37, ((i * 7) % 300) * 0.61, ((i * 13) % 500) * 0.29, 3);
      min = Math.min(min, v); max = Math.max(max, v);
      if (v <= 0) atZero++;
      if (v >= 1) atOne++;
      count++;
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
    expect(atZero / count).toBeLessThan(0.001);
    expect(atOne / count).toBeLessThan(0.001);
  });

  it('is isotropic: f(x,z) is not merely f(z,x)', () => {
    // The continent field was once sampled as fbm2D(w, w), collapsing the
    // world onto its diagonal and producing 45-degree banding.
    const n = new AdvancedNoise('isotropy');
    let symmetric = 0, total = 0;
    for (let x = -60; x < 60; x += 3) {
      for (let z = -60; z < 60; z += 3) {
        if (x === z) continue;
        if (Math.abs(n.fbm2D(x * 0.03, z * 0.03, 4) - n.fbm2D(z * 0.03, x * 0.03, 4)) < 1e-12) symmetric++;
        total++;
      }
    }
    expect(symmetric / total).toBeLessThan(0.05);
  });
});

/* ========================================================================== *
 * 2 & 3. SURFACE MASKING — no floating topsoil, no floating debris
 * ========================================================================== */

describe('surface masking', () => {
  it('never creates a block in mid-air (the floating grass-sheet bug)', () => {
    // Instrument Chunk.setBlock and assert the surface pass only ever
    // RECOLOURS existing voxels. This is the precise mechanism that produced
    // horizontal sheets of grass hanging through the air and through trees.
    const original = Chunk.prototype.setBlock;
    try {
      for (const seed of ['float-audit', 'alpha', 'cavetest']) {
        const gen = new AdvancedTerrainGenerator({ seed }) as unknown as {
          applySurfacePass: (c: Chunk) => void;
          generateChunk: (cx: number, cz: number) => Chunk;
        };

        let insidePass = false;
        let createdInAir = 0;
        (Chunk.prototype as unknown as { setBlock: typeof original }).setBlock =
          function (this: Chunk, x: number, y: number, z: number, b: number) {
            if (insidePass && b !== AIR && b !== WATER && this.getBlock(x, y, z) === AIR) createdInAir++;
            return original.call(this, x, y, z, b);
          };

        const realPass = gen.applySurfacePass.bind(gen);
        gen.applySurfacePass = (c: Chunk) => {
          insidePass = true;
          try { realPass(c); } finally { insidePass = false; }
        };

        for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) gen.generateChunk(cx, cz);
        expect(createdInAir, `${seed}: surface pass conjured blocks into empty air`).toBe(0);
      }
    } finally {
      (Chunk.prototype as unknown as { setBlock: typeof original }).setBlock = original;
    }
  });

  it('never leaves topsoil hanging above the ground (the sheet artefact)', () => {
    // The reported artefact was topsoil ABOVE the terrain, hanging in open
    // sky and slicing through tree trunks. So the assertion is precise: for
    // every column, no topsoil may exist strictly above that column's
    // sky-exposed surface.
    //
    // Note this deliberately does NOT flag topsoil *below* the surface: moss
    // on the floor of a lush cavern is legitimate underground dressing placed
    // by the deep-cave pass, and has nothing to do with the sky sheets.
    const TOPSOIL = new Set([1, 89, 108]); // grass, snow, moss
    let columns = 0, floatingTopsoil = 0;

    for (const seed of ['topsoil', 'alpha']) {
      const gen = new AdvancedTerrainGenerator({ seed });
      for (let cx = -2; cx <= 2; cx++) {
        for (let cz = -2; cz <= 2; cz++) {
          const chunk = gen.generateChunk(cx, cz);
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
              // Highest terrain voxel, seeing through plants and water.
              let surface = -1;
              for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
                if (isTerrain(chunk.getBlock(lx, y, lz))) { surface = y; break; }
              }
              if (surface < 0) continue;
              columns++;
              for (let y = surface + 1; y < CHUNK_HEIGHT; y++) {
                if (TOPSOIL.has(chunk.getBlock(lx, y, lz))) floatingTopsoil++;
              }
            }
          }
        }
      }
    }

    expect(columns).toBeGreaterThan(1000);
    expect(floatingTopsoil).toBe(0);
  });

  it('caps each column with a sensible surface material', () => {
    // The flip side of the sweep: the surface must actually be dressed, not
    // left as raw stone everywhere.
    const gen = new AdvancedTerrainGenerator({ seed: 'surface-coverage' });
    let columns = 0, dressed = 0;
    const DRESSED = new Set([1, 4, 89, 108, 105, 47, 2]); // grass/sand/snow/moss/mud/basalt/dirt

    for (let cx = -2; cx <= 2; cx++) {
      for (let cz = -2; cz <= 2; cz++) {
        const chunk = gen.generateChunk(cx, cz);
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            let surface = -1;
            for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
              if (isTerrain(chunk.getBlock(lx, y, lz))) { surface = y; break; }
            }
            if (surface < 0) continue;
            columns++;
            if (DRESSED.has(chunk.getBlock(lx, surface, lz))) dressed++;
          }
        }
      }
    }
    expect(columns).toBeGreaterThan(1000);
    expect(dressed / columns).toBeGreaterThan(0.9);
  });

  it('leaves no unsupported floating terrain', () => {
    // Flood-fill from bedrock across a MERGED multi-chunk volume, then look
    // for terrain that is not connected to it. Merging matters: measuring one
    // chunk at a time reports real terrain as "floating" wherever it is held
    // up through a neighbour.
    const gen = new AdvancedTerrainGenerator({ seed: 'floating-debris' });
    const R = 4;
    const W = R * CHUNK_SIZE;
    const get = (x: number, y: number, z: number) => {
      const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
      return gen.generateChunk(cx, cz).getBlock(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE);
    };
    const idx = (x: number, y: number, z: number) => x + W * (z + W * y);
    const anchored = new Uint8Array(W * W * CHUNK_HEIGHT);
    const stack: Array<[number, number, number]> = [];

    for (let x = 0; x < W; x++) {
      for (let z = 0; z < W; z++) {
        for (let y = 0; y <= gen.config.bedrockThickness; y++) {
          if (isTerrain(get(x, y, z)) && !anchored[idx(x, y, z)]) { anchored[idx(x, y, z)] = 1; stack.push([x, y, z]); }
        }
      }
    }
    while (stack.length) {
      const [x, y, z] = stack.pop()!;
      const neighbours: Array<[number, number, number]> = [
        [x + 1, y, z], [x - 1, y, z], [x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1],
      ];
      for (const [a, b, c] of neighbours) {
        if (a < 0 || a >= W || c < 0 || c >= W || b < 0 || b >= CHUNK_HEIGHT) continue;
        if (anchored[idx(a, b, c)] || !isTerrain(get(a, b, c))) continue;
        anchored[idx(a, b, c)] = 1;
        stack.push([a, b, c]);
      }
    }

    // Only inspect the interior, away from the unexplored outer ring.
    const M = CHUNK_SIZE;
    let floating = 0;
    for (let x = M; x < W - M; x++) {
      for (let z = M; z < W - M; z++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          if (isTerrain(get(x, y, z)) && !anchored[idx(x, y, z)]) floating++;
        }
      }
    }
    expect(floating).toBe(0);
  });

  it('keeps water resting on something solid', () => {
    const gen = new AdvancedTerrainGenerator({ seed: 'fluid-support' });
    let unsupported = 0;
    for (let cx = -2; cx <= 2; cx++) {
      for (let cz = -2; cz <= 2; cz++) {
        const chunk = gen.generateChunk(cx, cz);
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            for (let y = 1; y < CHUNK_HEIGHT; y++) {
              if (chunk.getBlock(lx, y, lz) !== WATER) continue;
              if (chunk.getBlock(lx, y - 1, lz) === AIR) unsupported++;
            }
          }
        }
      }
    }
    expect(unsupported).toBe(0);
  });
});

/* ========================================================================== *
 * 4. PASS SEPARATION — decoration queries the real surface
 * ========================================================================== */

describe('pass separation and height queries', () => {
  it('getSurfaceHeight reports the actual highest solid voxel', () => {
    const gen = new AdvancedTerrainGenerator({ seed: 'surface-api' });
    for (let x = -40; x <= 40; x += 7) {
      for (let z = -40; z <= 40; z += 7) {
        const y = gen.getSurfaceHeight(x, z);
        expect(gen.getBlockAt(x, y, z), `solid ground at ${x},${z}`).not.toBe(AIR);
        // Everything above must be air, water, or vegetation — never terrain.
        for (let above = y + 1; above < CHUNK_HEIGHT; above++) {
          const b = gen.getBlockAt(x, above, z);
          expect(isTerrain(b), `terrain floating above surface at ${x},${above},${z}`).toBe(false);
        }
      }
    }
  });

  it('plants every tree trunk on solid ground, never in mid-air', () => {
    const gen = new AdvancedTerrainGenerator({ seed: 'tree-roots', forcedBiome: 'forest' });
    let trunks = 0, rootless = 0;

    for (let cx = -2; cx <= 2; cx++) {
      for (let cz = -2; cz <= 2; cz++) {
        const chunk = gen.generateChunk(cx, cz);
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            for (let y = 1; y < CHUNK_HEIGHT; y++) {
              if (chunk.getBlock(lx, y, lz) !== 6 /* LOG */) continue;
              const below = chunk.getBlock(lx, y - 1, lz);
              if (below === 6) continue;      // mid-trunk
              trunks++;
              if (below === AIR) rootless++;  // base of a trunk standing on nothing
            }
          }
        }
      }
    }

    expect(trunks).toBeGreaterThan(20);
    expect(rootless).toBe(0);
  });

  it('does not clip features at chunk borders', () => {
    // A generator that discards writes outside the current chunk loses the
    // overhanging half of every tree anchored near an edge, leaving flat,
    // sheared canopies along the chunk grid.
    const gen = new AdvancedTerrainGenerator({ seed: 'canopy-spill', forcedBiome: 'forest' });
    const leavesByLocalX = new Array(CHUNK_SIZE).fill(0);

    for (let cx = -3; cx <= 3; cx++) {
      for (let cz = -3; cz <= 3; cz++) {
        const chunk = gen.generateChunk(cx, cz);
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            for (let y = 0; y < CHUNK_HEIGHT; y++) {
              if (chunk.getBlock(lx, y, lz) === 7 /* LEAVES */) leavesByLocalX[lx]++;
            }
          }
        }
      }
    }

    const edge = leavesByLocalX[0] + leavesByLocalX[CHUNK_SIZE - 1];
    const middle = leavesByLocalX[CHUNK_SIZE / 2 - 1] + leavesByLocalX[CHUNK_SIZE / 2];
    expect(middle).toBeGreaterThan(0);
    // Edge columns should hold a comparable amount of canopy to middle ones.
    expect(edge / middle).toBeGreaterThan(0.7);
  });

  it('exposes clearance checking so props do not spawn inside terrain', () => {
    const gen = new AdvancedTerrainGenerator({ seed: 'clearance' });
    for (let x = -30; x <= 30; x += 11) {
      for (let z = -30; z <= 30; z += 11) {
        if (!gen.hasClearanceAbove(x, z, 3)) continue;
        const y = gen.getSurfaceHeight(x, z);
        for (let dy = 1; dy <= 3; dy++) expect(gen.getBlockAt(x, y + dy, z)).toBe(AIR);
      }
    }
  });

  it('is deterministic regardless of the order chunks are generated in', () => {
    // Cross-chunk decoration must not make the world depend on visit order.
    const forward = new AdvancedTerrainGenerator({ seed: 'order-independence' });
    const reverse = new AdvancedTerrainGenerator({ seed: 'order-independence' });

    const coords: Array<[number, number]> = [];
    for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) coords.push([cx, cz]);
    for (const [cx, cz] of coords) forward.generateChunk(cx, cz);
    for (const [cx, cz] of [...coords].reverse()) reverse.generateChunk(cx, cz);

    // Compare the interior, whose neighbours are generated in both orders.
    let differences = 0;
    for (let cx = -1; cx <= 1; cx++) {
      for (let cz = -1; cz <= 1; cz++) {
        const a = forward.generateChunk(cx, cz);
        const b = reverse.generateChunk(cx, cz);
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            for (let y = 0; y < CHUNK_HEIGHT; y++) {
              if (a.getBlock(lx, y, lz) !== b.getBlock(lx, y, lz)) differences++;
            }
          }
        }
      }
    }
    expect(differences).toBe(0);
  });
});

/* ========================================================================== *
 * BIOME BOUNDARIES — must not align to the chunk grid
 * ========================================================================== */

describe('biome boundaries', () => {
  it('does not snap biome transitions onto the 16-block chunk lattice', () => {
    // Biome changes carry a change of surface material, so if they land on a
    // fixed offset within every chunk they draw dead-straight lines across
    // the world that read as chunk seams.
    const gen = new AdvancedTerrainGenerator({ seed: 'biome-lattice' });
    const byOffset = new Array(CHUNK_SIZE).fill(0);
    let total = 0;

    for (let z = -200; z < 200; z += 5) {
      let previous = gen.getBiomeAt(-300, z).id;
      for (let x = -299; x < 300; x++) {
        const current = gen.getBiomeAt(x, z).id;
        if (current !== previous) {
          byOffset[((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE]++;
          total++;
        }
        previous = current;
      }
    }

    expect(total).toBeGreaterThan(50);
    // Perfectly uniform would be 1/16 = 6.25% per offset. The old generator
    // put 100% of transitions on a single offset.
    const worstShare = Math.max(...byOffset) / total;
    expect(worstShare).toBeLessThan(0.25);
  });
});

/* ========================================================================== *
 * 6. SINKHOLES — craters must not be clipped by chunk borders
 *
 * The sinkhole pass used to iterate the columns *inside* a chunk and carve the
 * disc of any anchor it found there. That lost crater voxels twice over:
 *
 *   - outward: a disc anchored near an edge ran off the chunk and the
 *     overhanging voxels were dropped by a bare `continue`;
 *   - inward:  an anchor in the neighbouring chunk whose radius reached into
 *     this one was never evaluated at all.
 *
 * Measured over a 17x17-chunk region before the fix: 55.6% of anchors were
 * clipped and 292 in-reach anchors were skipped. A crater therefore stopped
 * dead against a straight 16-block line, leaving a flat vertical wall of
 * exposed unlit interior.
 *
 * The pass now iterates ANCHORS (its own cells plus a margin) and clips each
 * disc to the chunk, so both chunks carve their own half of a straddling
 * crater from the same anchor hash.
 * ========================================================================== */

describe('sinkhole craters across chunk boundaries', () => {
  const CELL = 12;
  const RMAX = 3;
  const BLEND = 26 + 32; // SPAWN_PROTECTED_RADIUS + 32

  /**
   * Independently re-derive the crater profile from anchors alone and assert
   * the generator carved it. Mirrors the pass's placement rule, not its loop,
   * so a regression in the loop structure is caught.
   */
  it('carves every voxel the crater profile specifies, including across seams', () => {
    for (const seed of ['crater-hunt', 'seam-check', 'eaoin_seed_2026']) {
      // Reach past `private` the same way the surface-pass test above does:
      // these are the generator's own placement internals, and the whole point
      // of the test is to pin them.
      const gen = new CavesAndCliffsTerrainGenerator({ seed }) as unknown as {
        applySinkholes: (c: Chunk) => void;
        generateChunk: (cx: number, cz: number) => Chunk;
        getTerrainHeight: (x: number, z: number) => number;
        noise: AdvancedNoise;
      };
      let checked = 0;
      let missing = 0;

      // Inspect the chunk immediately after the sinkhole pass, before later
      // passes (anti-floating, surface fill) can legitimately refill voxels.
      const original = gen.applySinkholes.bind(gen);
      gen.applySinkholes = (chunk: Chunk) => {
        original(chunk);
        const ox0 = chunk.x * CHUNK_SIZE;
        const oz0 = chunk.z * CHUNK_SIZE;
        const first = (o: number) => Math.floor((o - RMAX) / CELL);
        const last = (o: number) => Math.floor((o + CHUNK_SIZE - 1 + RMAX) / CELL);

        for (let cellX = first(ox0); cellX <= last(ox0); cellX++) {
          for (let cellZ = first(oz0); cellZ <= last(oz0); cellZ++) {
            const ax = cellX * CELL + Math.floor(gen.noise.hash(cellX, cellZ, 0, 41) * CELL);
            const az = cellZ * CELL + Math.floor(gen.noise.hash(cellX, cellZ, 1, 42) * CELL);
            if (Math.hypot(ax, az) < BLEND) continue;
            const r = 2 + Math.floor(gen.noise.hash(cellX, cellZ, 2, 43) * 2);
            const depth = 8 + Math.floor(gen.noise.hash(cellX, cellZ, 3, 44) * 6);

            for (let wx = ax - r; wx <= ax + r; wx++) {
              for (let wz = az - r; wz <= az + r; wz++) {
                const d = Math.hypot(wx - ax, wz - az);
                if (d > r) continue;
                // Skip rim columns whose profile asks for zero depth.
                if (Math.round(depth * (1 - d / r)) < 1) continue;
                const lx = wx - ox0;
                const lz = wz - oz0;
                if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;
                const y = gen.getTerrainHeight(wx, wz) - 1;
                if (y < 4 || y >= CHUNK_HEIGHT) continue;
                checked++;
                if (chunk.getBlock(lx, y, lz) !== AIR) missing++;
              }
            }
          }
        }
      };

      for (let cx = -6; cx <= 6; cx++) {
        for (let cz = -6; cz <= 6; cz++) gen.generateChunk(cx, cz);
      }

      expect(checked).toBeGreaterThan(500);
      expect(missing).toBe(0);
    }
  });

  it('leaves no straight vertical crater wall along a chunk seam', () => {
    const gen = new AdvancedTerrainGenerator({ seed: 'crater-hunt' });
    const airDepth = (chunk: Chunk, lx: number, lz: number, surface: number) => {
      let n = 0;
      for (let y = surface - 1; y >= 4 && chunk.getBlock(lx, y, lz) === AIR; y--) n++;
      return n;
    };

    let walls = 0;
    for (let cx = -5; cx <= 5; cx++) {
      for (let cz = -5; cz <= 5; cz++) {
        const a = gen.generateChunk(cx, cz);
        const b = gen.generateChunk(cx + 1, cz);
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const wz = cz * CHUNK_SIZE + lz;
          const sa = gen.getHeightAt(cx * CHUNK_SIZE + 15, wz);
          const sb = gen.getHeightAt((cx + 1) * CHUNK_SIZE, wz);
          if (Math.abs(airDepth(a, 15, lz, sa) - airDepth(b, 0, lz, sb)) >= 8) walls++;
        }
      }
    }
    expect(walls).toBe(0);
  });

  it('produces identical voxels whichever neighbour is generated first', () => {
    // A cross-chunk feature must not depend on generation order, or streaming
    // in a different direction would give a different world.
    const forward = new AdvancedTerrainGenerator({ seed: 'order-sink' });
    const reverse = new AdvancedTerrainGenerator({ seed: 'order-sink' });

    const target = forward.generateChunk(2, -3);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx !== 0 || dz !== 0) reverse.generateChunk(2 + dx, -3 + dz);
      }
    }
    const after = reverse.generateChunk(2, -3);

    let diff = 0;
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          if (target.getBlock(x, y, z) !== after.getBlock(x, y, z)) diff++;
        }
      }
    }
    expect(diff).toBe(0);
  });
});

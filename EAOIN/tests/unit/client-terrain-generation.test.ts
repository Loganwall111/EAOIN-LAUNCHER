/**
 * Regression tests for the legacy client voxel pipeline.
 *
 * Each block below pins one of the three reported failures:
 *   1. coordinate scaling / noise inputs at chunk edges
 *   2. voxel grid instantiation (NaN, early break, minimum height)
 *   3. empty-chunk handling not breaking the surrounding grid
 */
import { describe, expect, it } from 'vitest';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from '../../src/world/Chunk';
import { Noise } from '../../client/src/world/noise/Noise';
import {
  TerrainGenerator,
  MIN_SURFACE_Y,
  MAX_SURFACE_Y,
} from '../../client/src/world/TerrainGenerator';
import { ChunkMeshBuilder } from '../../client/src/rendering/ChunkMeshBuilder';

/** Topmost non-air, non-water voxel in a column, or -1. */
function topSolid(chunk: Chunk, lx: number, lz: number): number {
  for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
    const id = chunk.getBlock(lx, y, lz);
    if (id !== 0 && id !== 5) return y;
  }
  return -1;
}

describe('Noise seeding and range', () => {
  it('never returns NaN for a string seed (the zeroed-out noise bug)', () => {
    // The old constructor was typed `private seed: number` but every caller
    // passes the world seed string, so `(x + seed) * 0.017` produced NaN.
    const noise = new Noise('eaoin_seed_2026');
    expect(Number.isFinite(noise.sample(1, 1))).toBe(true);
    expect(Number.isFinite(noise.sample(-4096.5, 8192.25))).toBe(true);
    expect(Number.isFinite(noise.octaveSample(3, 7, 6))).toBe(true);
    expect(Number.isFinite(noise.fbm(0.5, -0.5))).toBe(true);
  });

  it('is deterministic for a given seed and differs between seeds', () => {
    expect(new Noise('a').sample(12.5, -7.25)).toBe(new Noise('a').sample(12.5, -7.25));
    expect(new Noise('a').sample(12.5, -7.25)).not.toBe(new Noise('b').sample(12.5, -7.25));
  });

  it('accepts a numeric seed as well as a string one', () => {
    expect(Number.isFinite(new Noise(1234).sample(2, 3))).toBe(true);
  });

  it('substitutes 0 rather than propagating a non-finite input', () => {
    const noise = new Noise('guard');
    expect(noise.sample(NaN, 1)).toBe(0);
    expect(noise.sample(1, Infinity)).toBe(0);
    expect(noise.fbm(NaN, NaN)).toBe(0);
  });

  it('keeps a stable output range regardless of octave count', () => {
    // The old octaveSample never divided by the accumulated amplitude, so the
    // range grew with the octave count and fixed thresholds meant different
    // things for different callers.
    const noise = new Noise('range');
    for (const octaves of [1, 2, 4, 8]) {
      for (let i = 0; i < 500; i++) {
        const v = noise.octaveSample(i * 0.37, i * -0.21, octaves);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is continuous — no step discontinuities between adjacent samples', () => {
    const noise = new Noise('continuity');
    for (let i = -500; i < 500; i++) {
      const a = noise.sample(i * 0.05, 3.3);
      const b = noise.sample((i + 1) * 0.05, 3.3);
      // Gradient noise sampled 0.05 apart cannot jump; a hash-based field can.
      expect(Math.abs(a - b)).toBeLessThan(0.35);
    }
  });
});

describe('Coordinate scaling at chunk edges', () => {
  const gen = new TerrainGenerator('seam-seed');

  it('has no height discontinuity at chunk boundaries', () => {
    // A chunk seam is where world x % 16 === 15. If the generator sampled
    // chunk-local coordinates (or hashed the chunk index) the step here would
    // be far larger than the step inside a chunk.
    let seamStep = 0;
    let interiorStep = 0;
    for (let wz = -100; wz < 100; wz += 3) {
      for (let wx = -100; wx < 100; wx++) {
        const step = Math.abs(gen.getHeightAt(wx, wz) - gen.getHeightAt(wx + 1, wz));
        if (((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE === 15) {
          seamStep = Math.max(seamStep, step);
        } else {
          interiorStep = Math.max(interiorStep, step);
        }
      }
    }
    expect(seamStep).toBeLessThanOrEqual(interiorStep);
    expect(seamStep).toBeLessThanOrEqual(3);
  });

  it('produces matching voxel columns on both sides of a shared edge', () => {
    const left = gen.generateChunk(0, 0);
    const right = gen.generateChunk(1, 0);
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const a = topSolid(left, CHUNK_SIZE - 1, lz);
      const b = topSolid(right, 0, lz);
      expect(Math.abs(a - b)).toBeLessThanOrEqual(3);
    }
  });

  it('varies along Z, not only along X', () => {
    // The old formula had no Z term at all, giving parallel ridges.
    const chunk = gen.generateChunk(0, 0);
    const heights = new Set<number>();
    for (let lz = 0; lz < CHUNK_SIZE; lz++) heights.add(topSolid(chunk, 8, lz));
    expect(heights.size).toBeGreaterThan(1);
  });

  it('agrees with getHeightAt for every generated voxel column', () => {
    for (let cx = -2; cx <= 2; cx++) {
      for (let cz = -2; cz <= 2; cz++) {
        const chunk = gen.generateChunk(cx, cz);
        for (let lx = 0; lx < CHUNK_SIZE; lx += 5) {
          for (let lz = 0; lz < CHUNK_SIZE; lz += 5) {
            const worldX = cx * CHUNK_SIZE + lx;
            const worldZ = cz * CHUNK_SIZE + lz;
            expect(topSolid(chunk, lx, lz)).toBe(gen.getHeightAt(worldX, worldZ));
          }
        }
      }
    }
  });

  it('is independent of the order chunks are generated in', () => {
    const forward = new TerrainGenerator('order').generateChunk(3, -2);
    const backward = new TerrainGenerator('order');
    backward.generateChunk(-9, 9);
    backward.generateChunk(0, 0);
    const later = backward.generateChunk(3, -2);
    for (let lx = 0; lx < CHUNK_SIZE; lx += 4) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 4) {
        expect(topSolid(later, lx, lz)).toBe(topSolid(forward, lx, lz));
      }
    }
  });
});

describe('Voxel grid instantiation', () => {
  const gen = new TerrainGenerator('grid-seed');

  it('never drops a column into the void', () => {
    for (let cx = -3; cx <= 3; cx++) {
      for (let cz = -3; cz <= 3; cz++) {
        const chunk = gen.generateChunk(cx, cz);
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            expect(topSolid(chunk, lx, lz)).toBeGreaterThanOrEqual(MIN_SURFACE_Y);
          }
        }
      }
    }
  });

  it('keeps every surface within the legal height range', () => {
    for (let wx = -3000; wx <= 3000; wx += 137) {
      for (let wz = -3000; wz <= 3000; wz += 149) {
        const h = gen.getHeightAt(wx, wz);
        expect(Number.isInteger(h)).toBe(true);
        expect(h).toBeGreaterThanOrEqual(MIN_SURFACE_Y);
        expect(h).toBeLessThanOrEqual(MAX_SURFACE_Y);
      }
    }
  });

  it('clamps rather than emptying the column for a non-finite coordinate', () => {
    // Math.max(1, NaN) is NaN, so the old minimum-height guard did nothing and
    // every comparison against it was false, leaving the column all air.
    expect(gen.getHeightAt(NaN, 0)).toBeGreaterThanOrEqual(MIN_SURFACE_Y);
    expect(gen.getHeightAt(0, Infinity)).toBeGreaterThanOrEqual(MIN_SURFACE_Y);
  });

  it('survives a non-finite chunk address without producing an empty chunk', () => {
    const chunk = gen.generateChunk(NaN as unknown as number, 0);
    expect(chunk.getHighestOccupiedY()).toBeGreaterThanOrEqual(MIN_SURFACE_Y);
  });

  it('leaves a contiguous solid column with no interior gaps', () => {
    const chunk = gen.generateChunk(2, -1);
    for (let lx = 0; lx < CHUNK_SIZE; lx += 3) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 3) {
        const surface = topSolid(chunk, lx, lz);
        for (let y = 0; y <= surface; y++) {
          expect(chunk.getBlock(lx, y, lz)).not.toBe(0);
        }
      }
    }
  });

  it('caps the world at the chunk ceiling', () => {
    const chunk = gen.generateChunk(7, 7);
    expect(chunk.getHighestOccupiedY()).toBeLessThan(CHUNK_HEIGHT);
  });
});

describe('Chunk.generate placeholder terrain', () => {
  it('is continuous across chunk boundaries', () => {
    // The old version hashed the chunk index into the base height, so adjacent
    // chunks were unrelated — a hard vertical cut at every seam.
    const left = new Chunk(0, 0, 'placeholder');
    const right = new Chunk(1, 0, 'placeholder');
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const a = topSolid(left, CHUNK_SIZE - 1, lz);
      const b = topSolid(right, 0, lz);
      expect(Math.abs(a - b)).toBeLessThanOrEqual(3);
    }
  });

  it('never leaves an empty column', () => {
    const chunk = new Chunk(-4, 6, 'placeholder');
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        expect(topSolid(chunk, lx, lz)).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('Mesh construction', () => {
  const gen = new TerrainGenerator('mesh-seed');
  const builder = new ChunkMeshBuilder();

  it('emits a valid index buffer (no indices past the vertex array)', () => {
    // The old addFace pushed 4 vertices but 6 sequential indices, so the last
    // two referenced the next face's vertices or ran off the end entirely.
    const mesh = builder.build(gen.generateChunk(0, 0));
    const vertexCount = mesh.vertices.length / 3;
    expect(mesh.indices.length % 6).toBe(0);
    for (const index of mesh.indices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(vertexCount);
    }
  });

  it('emits four vertices and six indices per quad', () => {
    const mesh = builder.build(gen.generateChunk(1, 1));
    expect(mesh.vertices.length / 3).toBe(mesh.quadCount * 4);
    expect(mesh.indices.length).toBe(mesh.quadCount * 6);
    expect(mesh.uvs.length / 2).toBe(mesh.quadCount * 4);
    expect(mesh.normals.length / 3).toBe(mesh.quadCount * 4);
  });

  it('emits geometry for all six face directions', () => {
    // getFaceVertices only had a 2-entry table and fell back to the top face,
    // so sides and bottoms were drawn as horizontal quads — you could see
    // straight through the terrain.
    const mesh = builder.build(gen.generateChunk(0, 0));
    const normals = new Set<string>();
    for (let i = 0; i < mesh.normals.length; i += 3) {
      normals.add(`${mesh.normals[i]},${mesh.normals[i + 1]},${mesh.normals[i + 2]}`);
    }
    expect(normals.size).toBe(6);
  });

  it('spans the unit cell rather than straddling the block centre', () => {
    const mesh = builder.build(gen.generateChunk(0, 0));
    for (const value of mesh.vertices) expect(Number.isInteger(value)).toBe(true);
  });

  it('produces all-finite vertex data', () => {
    const mesh = builder.build(gen.generateChunk(-2, 3));
    for (const v of mesh.vertices) expect(Number.isFinite(v)).toBe(true);
    for (const n of mesh.normals) expect(Number.isFinite(n)).toBe(true);
  });

  it('omits the seam wall when a neighbour sampler is supplied', () => {
    const chunk = gen.generateChunk(0, 0);
    const neighbor = gen.generateChunk(1, 0);
    const sealed = builder.build(chunk);
    const stitched = builder.build(chunk, {
      getNeighbor: (wx, wy, wz) => {
        const lx = wx - CHUNK_SIZE;
        if (lx < 0 || lx >= CHUNK_SIZE || wz < 0 || wz >= CHUNK_SIZE) return 0;
        return neighbor.getBlock(lx, wy, wz);
      },
    });
    expect(stitched.quadCount).toBeLessThan(sealed.quadCount);
  });
});

describe('Empty chunk handling', () => {
  const builder = new ChunkMeshBuilder();

  it('reports an all-air chunk as empty instead of failing', () => {
    const empty = new Chunk(5, 5, 'void', { generate: false });
    const mesh = builder.build(empty);
    expect(mesh.quadCount).toBe(0);
    expect(mesh.indices.length).toBe(0);
    expect(ChunkMeshBuilder.isEmpty(mesh)).toBe(true);
    expect(TerrainGenerator.isChunkEmpty(empty)).toBe(true);
  });

  it('does not break the surrounding grid', () => {
    // The reported symptom: one void chunk took its neighbours down with it.
    const gen = new TerrainGenerator('void-grid');
    const built: Array<{ cx: number; cz: number; quads: number }> = [];
    for (let cx = -1; cx <= 1; cx++) {
      for (let cz = -1; cz <= 1; cz++) {
        // Substitute a deliberately empty chunk in the middle of the grid.
        const chunk = cx === 0 && cz === 0
          ? new Chunk(0, 0, 'void-grid', { generate: false })
          : gen.generateChunk(cx, cz);
        built.push({ cx, cz, quads: builder.build(chunk).quadCount });
      }
    }
    expect(built).toHaveLength(9);
    // The void chunk contributes nothing...
    expect(built.find((c) => c.cx === 0 && c.cz === 0)?.quads).toBe(0);
    // ...and every other chunk still meshed normally.
    for (const entry of built) {
      if (entry.cx === 0 && entry.cz === 0) continue;
      expect(entry.quads).toBeGreaterThan(0);
    }
  });

  it('treats a chunk with blocks but no visible faces as empty', () => {
    const enclosed = new Chunk(0, 0, 'enclosed', { generate: false });
    enclosed.setBlock(4, 20, 4, 3);
    const mesh = builder.build(enclosed, { getNeighbor: () => 3 });
    // Fully surrounded by solid neighbours: nothing to draw, but not an error.
    expect(ChunkMeshBuilder.isEmpty(mesh)).toBe(false);
    expect(mesh.quadCount).toBe(6);
  });
});

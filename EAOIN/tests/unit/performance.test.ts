/**
 * Performance tests.
 *
 * Two things are verified here, and they matter equally:
 *   1. Greedy meshing produces FEWER triangles than the naive mesher.
 *   2. It produces the SAME visible surface — no holes, no extra faces, and
 *      the merged quads cover exactly the area the naive quads did.
 *
 * A mesher that is fast but drops a face is worse than a slow correct one, so
 * the correctness assertions are the important half of this file.
 */
import { describe, it, expect } from 'vitest';
import { greedyMesh, countTriangles, MeshBuffers } from '../../src/rendering/GreedyMesher';
import {
  AdaptivePerformance,
  BUDGET_PRESETS,
  EFFECT_TIERS,
  effectSettingsFor,
} from '../../src/performance/AdaptivePerformance';
import type { BlockID } from '../../shared/src/blocks/BlockRegistry';

/* -------------------------------------------------------------------------- */
/*                                 test helpers                                */
/* -------------------------------------------------------------------------- */

/** A little voxel volume backed by a flat array, for deterministic tests. */
class TestVolume {
  readonly data: Uint8Array;
  constructor(readonly sx: number, readonly sy: number, readonly sz: number) {
    this.data = new Uint8Array(sx * sy * sz);
  }
  idx(x: number, y: number, z: number): number {
    return x + this.sx * (z + this.sz * y);
  }
  get(x: number, y: number, z: number): BlockID {
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return 0;
    return this.data[this.idx(x, y, z)] as BlockID;
  }
  set(x: number, y: number, z: number, id: number): void {
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return;
    this.data[this.idx(x, y, z)] = id;
  }
  /** Fill a solid box. */
  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, id: number): void {
    for (let x = x0; x < x1; x += 1)
      for (let y = y0; y < y1; y += 1)
        for (let z = z0; z < z1; z += 1) this.set(x, y, z, id);
  }
}

function meshVolume(volume: TestVolume) {
  return greedyMesh({
    sizeX: volume.sx, sizeY: volume.sy, sizeZ: volume.sz,
    getBlock: (x, y, z) => volume.get(x, y, z),
    getNeighbor: (x, y, z) => volume.get(x, y, z),
    isFaceVisible: (blockId, neighborId) => neighborId === 0 || neighborId !== blockId,
  });
}

/** Count exposed faces the naive way, as the ground-truth reference. */
function naiveFaceCount(volume: TestVolume): number {
  const offsets = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  let faces = 0;
  for (let x = 0; x < volume.sx; x += 1)
    for (let y = 0; y < volume.sy; y += 1)
      for (let z = 0; z < volume.sz; z += 1) {
        const id = volume.get(x, y, z);
        if (id === 0) continue;
        for (const [dx, dy, dz] of offsets) {
          const n = volume.get(x + dx, y + dy, z + dz);
          if (n === 0 || n !== id) faces += 1;
        }
      }
  return faces;
}

/** Total surface area of all merged quads, from their vertex positions. */
function totalQuadArea(groups: Map<BlockID, MeshBuffers>): number {
  let area = 0;
  for (const buffers of groups.values()) {
    for (let i = 0; i < buffers.positions.length; i += 12) {
      const p = (n: number): [number, number, number] => [
        buffers.positions[i + n * 3],
        buffers.positions[i + n * 3 + 1],
        buffers.positions[i + n * 3 + 2],
      ];
      const [ax, ay, az] = p(0);
      const [bx, by, bz] = p(1);
      const [dx, dy, dz] = p(3);
      const e1 = [bx - ax, by - ay, bz - az];
      const e2 = [dx - ax, dy - ay, dz - az];
      const cross = [
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0],
      ];
      area += Math.hypot(cross[0], cross[1], cross[2]);
    }
  }
  return area;
}

/* -------------------------------------------------------------------------- */
/*                              greedy meshing                                 */
/* -------------------------------------------------------------------------- */

describe('GreedyMesher — correctness', () => {
  it('meshes a single block as exactly 6 quads (12 triangles)', () => {
    const volume = new TestVolume(3, 3, 3);
    volume.set(1, 1, 1, 1);
    const groups = meshVolume(volume);
    expect(countTriangles(groups)).toBe(12);
  });

  it('merges a flat 16x16 floor into one quad per face direction', () => {
    const volume = new TestVolume(16, 3, 16);
    volume.fill(0, 0, 0, 16, 1, 16, 1);
    const groups = meshVolume(volume);

    // Top and bottom become 1 quad each; the four sides become 1 quad each.
    // 6 quads = 12 triangles, versus 16*16*2 + 16*4 = 576 faces naively.
    expect(countTriangles(groups)).toBe(12);
    expect(naiveFaceCount(volume)).toBe(576);
  });

  it('preserves total surface area exactly', () => {
    const volume = new TestVolume(12, 12, 12);
    volume.fill(2, 2, 2, 10, 8, 9, 1);
    volume.fill(4, 8, 4, 7, 11, 6, 1);
    volume.set(1, 1, 1, 1);

    const groups = meshVolume(volume);
    // Every naive face is 1x1, so the reference area is just the face count.
    expect(totalQuadArea(groups)).toBeCloseTo(naiveFaceCount(volume), 6);
  });

  it('never merges across different block types', () => {
    const volume = new TestVolume(4, 1, 1);
    volume.set(0, 0, 0, 1);
    volume.set(1, 0, 0, 1);
    volume.set(2, 0, 0, 2);
    volume.set(3, 0, 0, 2);

    const groups = meshVolume(volume);
    expect(groups.has(1 as BlockID)).toBe(true);
    expect(groups.has(2 as BlockID)).toBe(true);
    // Area is still conserved per-material.
    expect(totalQuadArea(groups)).toBeCloseTo(naiveFaceCount(volume), 6);
  });

  it('emits nothing for an empty volume', () => {
    const groups = meshVolume(new TestVolume(8, 8, 8));
    expect(countTriangles(groups)).toBe(0);
  });

  it('emits nothing for the interior of a fully solid volume', () => {
    // A solid volume that touches every wall has only its outer shell visible.
    const volume = new TestVolume(6, 6, 6);
    volume.fill(0, 0, 0, 6, 6, 6, 1);
    const groups = meshVolume(volume);
    // 6 faces of a 6x6 cube = 6 merged quads = 12 triangles.
    expect(countTriangles(groups)).toBe(12);
  });

  it('produces outward-facing normals on all six sides', () => {
    const volume = new TestVolume(3, 3, 3);
    volume.set(1, 1, 1, 1);
    const groups = meshVolume(volume);
    const buffers = groups.get(1 as BlockID)!;

    const seen = new Set<string>();
    for (let i = 0; i < buffers.normals.length; i += 3) {
      seen.add(`${buffers.normals[i]},${buffers.normals[i + 1]},${buffers.normals[i + 2]}`);
    }
    expect(seen).toEqual(new Set([
      '1,0,0', '-1,0,0', '0,1,0', '0,-1,0', '0,0,1', '0,0,-1',
    ]));
  });

  it('winds every triangle so its geometric normal matches its vertex normal', () => {
    // If winding is wrong for a direction, back-face culling hides that side.
    const volume = new TestVolume(5, 5, 5);
    volume.fill(1, 1, 1, 4, 4, 4, 1);
    const groups = meshVolume(volume);
    const buffers = groups.get(1 as BlockID)!;

    for (let t = 0; t < buffers.indices.length; t += 3) {
      const [i0, i1, i2] = [buffers.indices[t], buffers.indices[t + 1], buffers.indices[t + 2]];
      const vertex = (i: number): [number, number, number] => [
        buffers.positions[i * 3], buffers.positions[i * 3 + 1], buffers.positions[i * 3 + 2],
      ];
      const a = vertex(i0), b = vertex(i1), c = vertex(i2);
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const geometric = [
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0],
      ];
      const declared = [
        buffers.normals[i0 * 3], buffers.normals[i0 * 3 + 1], buffers.normals[i0 * 3 + 2],
      ];
      const dot = geometric[0] * declared[0] + geometric[1] * declared[1] + geometric[2] * declared[2];
      expect(dot).toBeGreaterThan(0);
    }
  });

  it('sets UVs that tile per block rather than stretching', () => {
    const volume = new TestVolume(8, 1, 1);
    volume.fill(0, 0, 0, 8, 1, 1, 1);
    const groups = meshVolume(volume);
    const buffers = groups.get(1 as BlockID)!;

    // The 8-long top face must have a UV extent of 8 in its long direction.
    const maxU = Math.max(...buffers.uvs.filter((_, i) => i % 2 === 0));
    expect(maxU).toBe(8);
  });
});

describe('GreedyMesher — the actual speedup', () => {
  it('cuts triangle count dramatically on flat terrain', () => {
    const volume = new TestVolume(16, 40, 16);
    // A realistic terrain column: solid up to a gently varying height.
    for (let x = 0; x < 16; x += 1)
      for (let z = 0; z < 16; z += 1) {
        const h = 20 + Math.floor(Math.sin(x * 0.4) * 2 + Math.cos(z * 0.3) * 2);
        for (let y = 0; y < h; y += 1) volume.set(x, y, z, 1);
      }

    const groups = meshVolume(volume);
    const greedyTris = countTriangles(groups);
    const naiveTris = naiveFaceCount(volume) * 2;

    expect(greedyTris).toBeLessThan(naiveTris);
    // On terrain like this the win should be large, not marginal.
    expect(greedyTris / naiveTris).toBeLessThan(0.5);
  });

  it('is never worse than the naive mesher', () => {
    // Worst case for greedy: a 3D checkerboard, where nothing can merge.
    const volume = new TestVolume(8, 8, 8);
    for (let x = 0; x < 8; x += 1)
      for (let y = 0; y < 8; y += 1)
        for (let z = 0; z < 8; z += 1) if ((x + y + z) % 2 === 0) volume.set(x, y, z, 1);

    const greedyTris = countTriangles(meshVolume(volume));
    const naiveTris = naiveFaceCount(volume) * 2;
    expect(greedyTris).toBeLessThanOrEqual(naiveTris);
  });
});

/* -------------------------------------------------------------------------- */
/*                            adaptive performance                             */
/* -------------------------------------------------------------------------- */

/** Drive the tuner with a constant frame time until it settles. */
function runAt(tuner: AdaptivePerformance, frameMs: number, seconds: number): void {
  const steps = Math.round((seconds * 1000) / frameMs);
  for (let i = 0; i < steps; i += 1) {
    tuner.sample(frameMs);
    tuner.update(frameMs / 1000);
  }
}

describe('AdaptivePerformance', () => {
  it('holds steady when frame time is on target', () => {
    const tuner = new AdaptivePerformance(BUDGET_PRESETS.balanced, {
      renderScale: 0.9, renderDistance: 8, effectTier: 'medium',
    });
    const before = tuner.getState();
    runAt(tuner, 16.7, 6); // exactly 60fps
    expect(tuner.getState()).toEqual(before);
  });

  it('sheds quality when frames are too slow', () => {
    const tuner = new AdaptivePerformance(BUDGET_PRESETS.balanced, {
      renderScale: 1.0, renderDistance: 12, effectTier: 'high',
    });
    runAt(tuner, 40, 4); // ~25fps, badly over a 60fps budget

    const after = tuner.getState();
    const degraded =
      after.renderScale < 1.0 ||
      after.renderDistance < 12 ||
      after.effectTier !== 'high';
    expect(degraded).toBe(true);
  });

  it('drops resolution before it drops view distance', () => {
    const tuner = new AdaptivePerformance(BUDGET_PRESETS.balanced, {
      renderScale: 1.0, renderDistance: 12, effectTier: 'high',
    });
    runAt(tuner, 40, 1.2);
    const after = tuner.getState();
    // Resolution is the least intrusive dial, so it must move first.
    expect(after.renderScale).toBeLessThan(1.0);
    expect(after.renderDistance).toBe(12);
  });

  it('restores quality after sustained headroom', () => {
    const tuner = new AdaptivePerformance(BUDGET_PRESETS.balanced, {
      renderScale: 0.7, renderDistance: 6, effectTier: 'low',
    });
    runAt(tuner, 6, 20); // ~166fps, huge headroom
    const after = tuner.getState();
    const improved =
      after.renderDistance > 6 || after.effectTier !== 'low' || after.renderScale > 0.7;
    expect(improved).toBe(true);
  });

  it('never exceeds the budget bounds in either direction', () => {
    const budget = BUDGET_PRESETS.performance;
    const tuner = new AdaptivePerformance(budget, {
      renderScale: 1.0, renderDistance: 8, effectTier: 'medium',
    });
    runAt(tuner, 200, 10); // catastrophically slow
    let state = tuner.getState();
    expect(state.renderScale).toBeGreaterThanOrEqual(budget.minRenderScale);
    expect(state.renderDistance).toBeGreaterThanOrEqual(budget.minRenderDistance);

    runAt(tuner, 2, 60); // absurdly fast
    state = tuner.getState();
    expect(state.renderScale).toBeLessThanOrEqual(budget.maxRenderScale);
    expect(state.renderDistance).toBeLessThanOrEqual(budget.maxRenderDistance);
  });

  it('ignores one-off hitches so chunk loading does not tank quality', () => {
    const tuner = new AdaptivePerformance(BUDGET_PRESETS.balanced, {
      renderScale: 1.0, renderDistance: 10, effectTier: 'high',
    });
    const before = tuner.getState();
    for (let i = 0; i < 400; i += 1) {
      // A 500ms chunk-meshing spike every 20 frames, otherwise a clean 60fps.
      const isSpike = i % 20 === 0;
      tuner.sample(isSpike ? 500 : 16.7, isSpike);
      tuner.update(0.0167);
    }
    expect(tuner.getState()).toEqual(before);
  });

  it('exposes a coherent effect ladder', () => {
    let previousParticles = -1;
    for (const tier of EFFECT_TIERS) {
      const settings = effectSettingsFor(tier);
      expect(settings.particleScale).toBeGreaterThan(previousParticles);
      previousParticles = settings.particleScale;
    }
    expect(effectSettingsFor('minimal').shadowsEnabled).toBe(false);
    expect(effectSettingsFor('ultra').shadowsEnabled).toBe(true);
  });

  it('clamps state into range when the budget changes', () => {
    const tuner = new AdaptivePerformance(BUDGET_PRESETS.cinematic, {
      renderScale: 1.0, renderDistance: 20, effectTier: 'ultra',
    });
    tuner.setBudget(BUDGET_PRESETS.performance);
    const state = tuner.getState();
    expect(state.renderDistance).toBeLessThanOrEqual(BUDGET_PRESETS.performance.maxRenderDistance);
    expect(EFFECT_TIERS.indexOf(state.effectTier))
      .toBeLessThanOrEqual(EFFECT_TIERS.indexOf(BUDGET_PRESETS.performance.maxEffectTier));
  });
});

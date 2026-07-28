import { describe, it, expect } from 'vitest';
import AdvancedTerrainGenerator from '../../src/world/AdvancedTerrainGenerator';
import { ChunkRenderManager } from '../../src/rendering/ChunkRenderManager';
import { Chunk } from '../../src/world/Chunk';

/**
 * Regression tests for the "black screen on entering the main world" bug.
 *
 * Two things went wrong together:
 *  1. getTerrainHeight() -> applyHydraulicErosion() -> getTerrainHeight() was
 *     unbounded mutual recursion, so the very first chunk threw a RangeError
 *     and no terrain mesh was ever produced (HUD visible, world black).
 *  2. The whole render radius was generated in one synchronous burst before the
 *     first frame, which is what made it hang for minutes rather than fail fast.
 */
describe('main world load', () => {
  it('computes terrain height without blowing the stack', () => {
    const terrain = new AdvancedTerrainGenerator({ seed: 'regression' });
    expect(() => terrain.getTerrainHeight(300, 300)).not.toThrow();
    const h = terrain.getTerrainHeight(300, 300);
    expect(Number.isFinite(h)).toBe(true);
    expect(h).toBeGreaterThan(0);
  });

  it('generates a chunk with solid, non-empty terrain', () => {
    const terrain = new AdvancedTerrainGenerator({ seed: 'regression' });
    const chunk = terrain.generateChunk(3, 3);
    let solid = 0;
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 128; y++) {
      if (chunk.getBlock(x, y, z) !== 0) solid++;
    }
    expect(solid).toBeGreaterThan(0);
  });

  it('is deterministic for a given seed', () => {
    const a = new AdvancedTerrainGenerator({ seed: 'same-seed' });
    const b = new AdvancedTerrainGenerator({ seed: 'same-seed' });
    for (const [x, z] of [[0, 0], [17, -42], [300, 300], [-901, 588]]) {
      expect(a.getTerrainHeight(x, z)).toBe(b.getTerrainHeight(x, z));
    }
  });

  it('never reports terrain above the 128-block chunk storage ceiling', () => {
    const terrain = new AdvancedTerrainGenerator({ seed: 'amplified__height-limit', mountainIntensity: 2.6, worldDepth: 256 });
    for (let x = -512; x <= 512; x += 32) {
      for (let z = -512; z <= 512; z += 32) {
        expect(terrain.getTerrainHeight(x, z)).toBeLessThan(128);
      }
    }
  });

  it('keeps skylands air above islands and preserves the void below', () => {
    const terrain = new AdvancedTerrainGenerator({
      seed: 'skylands__void-regression', floatingIslands: true, skyIslands: true,
    });
    const chunk = terrain.generateChunk(8, 8);

    // The broken fill loop painted grass from each island top through y=127,
    // and the foundation pass then painted a floor across y=0.
    for (let x = 0; x < 16; x += 1) {
      for (let z = 0; z < 16; z += 1) {
        expect(chunk.getBlock(x, 127, z)).toBe(0);
        expect(chunk.getBlock(x, 0, z)).toBe(0);
      }
    }
  });

  it('streams the render radius incrementally instead of in one blocking burst', () => {
    const terrain = new AdvancedTerrainGenerator({ seed: 'streaming' });
    const manager = new ChunkRenderManager({} as never, new Map() as never);
    // Stub the GPU mesh build; we are asserting scheduling, not rendering.
    (manager as unknown as { rebuildChunk(cx: number, cz: number): void }).rebuildChunk = () => {};

    const radius = 4;
    const budget = 2;
    let first = manager.updateVisibleChunks(0, 0, radius, (cx, cz) => terrain.generateChunk(cx, cz), { budget });
    expect(first.loaded).toBe(budget);
    expect(first.pending).toBeGreaterThan(0);

    let frames = 1;
    while (manager.hasPendingChunks(0, 0, radius)) {
      first = manager.updateVisibleChunks(0, 0, radius, (cx, cz) => terrain.generateChunk(cx, cz), { budget });
      expect(first.loaded).toBeLessThanOrEqual(budget);
      frames++;
      expect(frames).toBeLessThan(1000);
    }

    const total = (radius * 2 + 1) ** 2;
    expect(manager.getStats().loadedChunks).toBe(total);
    expect(frames).toBeGreaterThanOrEqual(total / budget);
    expect(first.pending).toBe(0);
  });

  it('keeps a complete player-facing radius while the next guard ring streams', () => {
    const manager = new ChunkRenderManager({} as never, new Map() as never);
    (manager as unknown as { rebuildChunk(cx: number, cz: number): void }).rebuildChunk = () => {};
    const generate = (cx: number, cz: number) => new Chunk(cx, cz, 'coverage-guard');
    const visibleRadius = 3;
    const streamingRadius = visibleRadius + 1;

    // Finish the initial target, including the one-chunk prefetch ring.
    manager.updateVisibleChunks(0, 0, streamingRadius, generate);
    expect(manager.hasChunksInRadius(0, 0, visibleRadius)).toBe(true);

    // Crossing one chunk boundary adds an outer strip. It is deliberately
    // budget-limited here to model a slow frame: that strip is still pending,
    // but the old prefetch ring must now cover every chunk the player can see.
    const result = manager.updateVisibleChunks(1, 0, streamingRadius, generate, { budget: 1 });
    expect(result.pending).toBeGreaterThan(0);
    expect(manager.hasPendingChunks(1, 0, streamingRadius)).toBe(true);
    expect(manager.hasChunksInRadius(1, 0, visibleRadius)).toBe(true);
  });

  it('actually unloads outer meshes when adaptive render distance drops', () => {
    const manager = new ChunkRenderManager({} as never, new Map() as never);
    (manager as unknown as { rebuildChunk(cx: number, cz: number): void }).rebuildChunk = () => {};
    const generate = (cx: number, cz: number) => new Chunk(cx, cz, 'radius-drop');

    manager.updateVisibleChunks(0, 0, 2, generate);
    expect(manager.getStats().loadedChunks).toBe(25);
    expect(manager.hasPendingChunks(0, 0, 1)).toBe(true);

    const result = manager.updateVisibleChunks(0, 0, 1, generate);
    expect(result.unloaded).toBe(16);
    expect(manager.getStats().loadedChunks).toBe(9);
    expect(manager.hasPendingChunks(0, 0, 1)).toBe(false);
  });
});

/* ========================================================================== *
 * STALE MESH GEOMETRY AFTER A CROSS-CHUNK WRITE
 *
 * `AdvancedTerrainGenerator.spillBlock` routes decoration that overhangs a
 * chunk border (a tree canopy, a ruin) into the neighbour that owns it. When
 * that neighbour is already built it is edited in place and flagged with
 * `chunk.meshDirty = true`.
 *
 * Nothing ever read that flag. The voxels existed in the array but their
 * geometry was never uploaded, so the decoration was invisible and any face it
 * should have hidden stayed exposed. Measured while streaming a forest at
 * radius 3: two of 49 chunks finished dirty with 12 faces missing.
 *
 * `updateVisibleChunks` now sweeps the live set for `meshDirty` chunks, and
 * `rebuildChunk` clears the flag as it meshes.
 * ========================================================================== */

describe('mesh invalidation after cross-chunk decoration writes', () => {
  /** A manager whose GPU upload is stubbed out, tracking rebuilds. */
  const makeManager = () => {
    const manager = new ChunkRenderManager({} as never, new Map() as never);
    const internals = manager as unknown as {
      chunks: Map<string, Chunk>;
      rebuildChunk(cx: number, cz: number): void;
      key(cx: number, cz: number): string;
    };
    let rebuilds = 0;
    internals.rebuildChunk = (cx: number, cz: number) => {
      const chunk = internals.chunks.get(internals.key(cx, cz));
      if (!chunk) return;
      rebuilds += 1;
      // Mirrors the real rebuild: meshing the chunk consumes its dirty flag.
      chunk.meshDirty = false;
    };
    return { manager, internals, rebuilds: () => rebuilds };
  };

  const streamUntilSettled = (
    manager: ChunkRenderManager,
    radius: number,
    generate: (cx: number, cz: number) => Chunk
  ) => {
    let guard = 0;
    do {
      manager.updateVisibleChunks(0, 0, radius, generate, { budget: 1 });
    } while (manager.hasPendingChunks(0, 0, radius) && (guard += 1) < 500);
  };

  it('leaves no chunk dirty once streaming settles', () => {
    // A forced forest maximises canopy overhang across chunk borders.
    const terrain = new AdvancedTerrainGenerator({ seed: 'canopy-spill', forcedBiome: 'forest' });
    const { manager, internals } = makeManager();

    streamUntilSettled(manager, 3, (cx, cz) => terrain.generateChunk(cx, cz));

    let stillDirty = 0;
    for (const chunk of internals.chunks.values()) if (chunk.meshDirty) stillDirty += 1;

    expect(internals.chunks.size).toBe(49);
    expect(stillDirty).toBe(0);
  });

  it('clears the dirty flag as part of the real rebuild', () => {
    // Exercises the PRODUCTION `rebuildChunk`, not a stub, so the flag clear
    // is genuinely covered. Without it the sweep above would re-mesh every
    // chunk on every frame for the rest of the session.
    //
    // An empty chunk meshes to zero geometry, so `rebuildChunk` returns before
    // it touches Babylon and needs no live GPU scene.
    const manager = new ChunkRenderManager({} as never, new Map() as never);
    const internals = manager as unknown as {
      chunks: Map<string, Chunk>;
      rebuildChunk(cx: number, cz: number): void;
      key(cx: number, cz: number): string;
    };

    const chunk = new Chunk(4, -2, 'flag-clear', { generate: false });
    expect(chunk.meshDirty).toBe(true);
    internals.chunks.set(internals.key(4, -2), chunk);

    internals.rebuildChunk(4, -2);

    expect(chunk.meshDirty).toBe(false);
  });

  it('does not re-mesh settled chunks on every subsequent frame', () => {
    // End-to-end guard on the same property: once streaming settles, an idle
    // player must pay nothing. The stub mirrors production by consuming the
    // flag, so this fails if the sweep ever stops being self-limiting.
    const terrain = new AdvancedTerrainGenerator({ seed: 'canopy-spill', forcedBiome: 'forest' });
    const { manager, rebuilds } = makeManager();

    streamUntilSettled(manager, 3, (cx, cz) => terrain.generateChunk(cx, cz));

    const settled = rebuilds();
    for (let frame = 0; frame < 5; frame += 1) {
      manager.updateVisibleChunks(0, 0, 3, (cx, cz) => terrain.generateChunk(cx, cz), { budget: 1 });
    }
    expect(rebuilds() - settled).toBe(0);
  });

  it('rebuilds a chunk that is edited after it was already meshed', () => {
    // The direct mechanism, isolated from world generation.
    const { manager, internals, rebuilds } = makeManager();
    const generate = (cx: number, cz: number) => new Chunk(cx, cz, 'dirty-sweep');

    streamUntilSettled(manager, 1, generate);
    const settled = rebuilds();

    // Simulate a neighbour spilling a canopy voxel into an already-built chunk.
    const victim = internals.chunks.get(internals.key(1, 0));
    expect(victim).toBeDefined();
    victim!.setBlock(0, 40, 0, 7);
    expect(victim!.meshDirty).toBe(true);

    manager.updateVisibleChunks(0, 0, 1, generate, { budget: 1 });

    expect(rebuilds()).toBeGreaterThan(settled);
    expect(victim!.meshDirty).toBe(false);
  });
});

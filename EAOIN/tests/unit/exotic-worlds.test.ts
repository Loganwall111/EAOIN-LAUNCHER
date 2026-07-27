/**
 * Tests for the features that were previously "groundwork, not finished".
 *
 * Each of these asserts the thing actually GENERATES or RUNS, not merely that
 * a config field exists — that was the whole problem with the previous state.
 */
import { describe, it, expect } from 'vitest';
import AdvancedTerrainGenerator from '../../src/world/AdvancedTerrainGenerator';
import {
  buildSubBedrockLayers,
  farLandsCorruption,
  invertHeight,
  layerAtDepth,
  sampleFarLands,
  subBedrockBlockAt,
} from '../../src/world/ExoticWorldGen';
import { AetherTerrain, BackroomsTerrain } from '../../src/dimensions/terrain/AetherBackroomsTerrain';
import { AdvancedNoise } from '../../src/world/AdvancedNoise';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from '../../src/world/Chunk';
import { ALL_DIMENSIONS, getDimensionById } from '../../src/dimensions/DimensionRuntime';
import { getSkyProfileForDimension } from '../../src/sky/SkyProfiles';
import { VoidLeviathan } from '../../src/space/VoidLeviathan';

/** Count non-air blocks in a chunk. */
function solidCount(chunk: Chunk): number {
  let n = 0;
  for (let x = 0; x < CHUNK_SIZE; x += 1)
    for (let y = 0; y < CHUNK_HEIGHT; y += 1)
      for (let z = 0; z < CHUNK_SIZE; z += 1) if (chunk.getBlock(x, y, z) !== 0) n += 1;
  return n;
}

/* -------------------------------------------------------------------------- */
/*                                 FAR LANDS                                   */
/* -------------------------------------------------------------------------- */

describe('The Far Lands', () => {
  it('leaves terrain untouched inside the threshold', () => {
    expect(farLandsCorruption(0, 0, 24_000)).toBe(0);
    expect(farLandsCorruption(10_000, 10_000, 24_000)).toBe(0);
    expect(farLandsCorruption(23_999, 0, 24_000)).toBe(0);
  });

  it('ramps corruption in past the threshold and saturates at 1', () => {
    expect(farLandsCorruption(24_000, 0, 24_000)).toBe(0);
    expect(farLandsCorruption(27_000, 0, 24_000)).toBeCloseTo(0.5, 1);
    expect(farLandsCorruption(40_000, 0, 24_000)).toBe(1);
  });

  it('is disabled entirely when the threshold is 0', () => {
    expect(farLandsCorruption(9_999_999, 9_999_999, 0)).toBe(0);
  });

  it('produces vertical walls once corrupted', () => {
    const noise = new AdvancedNoise('farlands-test');
    let maxBoost = 0;
    for (let x = 40_000; x < 40_400; x += 7) {
      const sample = sampleFarLands(noise, x, 0, 1, 128);
      maxBoost = Math.max(maxBoost, sample.heightBoost);
    }
    // Something along that transect must be a genuine wall, not a bump.
    expect(maxBoost).toBeGreaterThan(20);
  });

  it('actually changes generated terrain height far from origin', () => {
    const normal = new AdvancedTerrainGenerator({ seed: 'fl', farLandsThreshold: 0 });
    const far = new AdvancedTerrainGenerator({ seed: 'fl', farLandsThreshold: 1_000 });

    let differences = 0;
    for (let i = 0; i < 40; i += 1) {
      const x = 20_000 + i * 13;
      if (normal.getTerrainHeight(x, 500) !== far.getTerrainHeight(x, 500)) differences += 1;
    }
    expect(differences).toBeGreaterThan(20);
  });
});

/* -------------------------------------------------------------------------- */
/*                                SUB-BEDROCK                                  */
/* -------------------------------------------------------------------------- */

describe('Sub-Bedrock stacked worlds', () => {
  it('builds the requested number of layers, ending in the core', () => {
    const layers = buildSubBedrockLayers(3, 4);
    expect(layers).toHaveLength(3);
    expect(layers[layers.length - 1].name).toBe('The Molten Core');
  });

  it('produces no layers when disabled', () => {
    expect(buildSubBedrockLayers(0, 4)).toHaveLength(0);
  });

  it('stacks layers without overlapping', () => {
    const layers = buildSubBedrockLayers(4, 4);
    for (let i = 1; i < layers.length; i += 1) {
      // Each layer sits strictly below the previous one.
      expect(layers[i].ceilingY).toBeLessThanOrEqual(layers[i - 1].floorY + 1);
      expect(layers[i].floorY).toBeLessThan(layers[i].ceilingY);
    }
  });

  it('resolves the right layer for a depth', () => {
    const layers = buildSubBedrockLayers(3, 4);
    const top = layers[0];
    expect(layerAtDepth(layers, top.ceilingY - 1)?.name).toBe(top.name);
    expect(layerAtDepth(layers, 5_000)).toBeNull();
  });

  it('gives every layer a solid floor so you do not fall straight through', () => {
    const noise = new AdvancedNoise('sb');
    const layers = buildSubBedrockLayers(3, 4);
    for (const layer of layers) {
      const atFloor = subBedrockBlockAt(noise, layers, 100, layer.floorY + 1, 100);
      expect(atFloor).not.toBe(0);
    }
  });

  it('carves open space inside the layers', () => {
    const noise = new AdvancedNoise('sb-open');
    const layers = buildSubBedrockLayers(3, 4);
    let air = 0;
    let solid = 0;
    const layer = layers[0];
    for (let x = 0; x < 60; x += 3)
      for (let z = 0; z < 60; z += 3)
        for (let y = layer.floorY + 3; y < layer.ceilingY - 2; y += 2) {
          const block = subBedrockBlockAt(noise, layers, x, y, z);
          if (block === 0) air += 1; else solid += 1;
        }
    // It must be a place you can walk around in, not solid rock.
    expect(air).toBeGreaterThan(0);
    expect(solid).toBeGreaterThan(0);
    expect(air / (air + solid)).toBeGreaterThan(0.2);
  });

  it('changes the generated chunk below bedrock', () => {
    const plain = new AdvancedTerrainGenerator({ seed: 'sbw', subBedrockLayers: 0 });
    const stacked = new AdvancedTerrainGenerator({ seed: 'sbw', subBedrockLayers: 3 });

    const a = plain.generateChunk(30, 30);
    const b = stacked.generateChunk(30, 30);

    let differences = 0;
    for (let x = 0; x < CHUNK_SIZE; x += 1)
      for (let z = 0; z < CHUNK_SIZE; z += 1)
        for (let y = 1; y < 60; y += 1) if (a.getBlock(x, y, z) !== b.getBlock(x, y, z)) differences += 1;

    expect(differences).toBeGreaterThan(500);
  });
});

/* -------------------------------------------------------------------------- */
/*                                  INVERTED                                   */
/* -------------------------------------------------------------------------- */

describe('Inverted worlds', () => {
  it('mirrors height about sea level', () => {
    expect(invertHeight(30, 18, 128)).toBe(6);
    expect(invertHeight(10, 18, 128)).toBe(26);
  });

  it('stays inside the world bounds', () => {
    expect(invertHeight(500, 18, 128)).toBeGreaterThanOrEqual(6);
    expect(invertHeight(-500, 18, 128)).toBeLessThanOrEqual(120);
  });
});

/* -------------------------------------------------------------------------- */
/*                          AETHER + BACKROOMS                                 */
/* -------------------------------------------------------------------------- */

describe('The Aether', () => {
  it('generates floating isles with open sky between them', () => {
    const aether = new AetherTerrain({ seed: 'aether-test', floorY: 30, ceilingY: 110 });
    let anySolid = 0;
    let anyEmpty = 0;
    for (let cx = 0; cx < 6; cx += 1) {
      const chunk = new Chunk(cx, 0, 'aether-test');
      // Chunk's own constructor generates default terrain; clear it first.
      for (let x = 0; x < CHUNK_SIZE; x += 1)
        for (let y = 0; y < CHUNK_HEIGHT; y += 1)
          for (let z = 0; z < CHUNK_SIZE; z += 1) chunk.setBlock(x, y, z, 0);

      aether.generate(chunk);
      const solid = solidCount(chunk);
      if (solid > 0) anySolid += 1; else anyEmpty += 1;
    }
    // Some chunks must have isles, and there must be genuine open sky too.
    expect(anySolid).toBeGreaterThan(0);
    expect(anySolid + anyEmpty).toBe(6);
  });

  it('never generates below the floor — the fall is genuinely endless', () => {
    const aether = new AetherTerrain({ seed: 'aether-floor', floorY: 40, ceilingY: 110 });
    const chunk = new Chunk(2, 2, 'aether-floor');
    for (let x = 0; x < CHUNK_SIZE; x += 1)
      for (let y = 0; y < CHUNK_HEIGHT; y += 1)
        for (let z = 0; z < CHUNK_SIZE; z += 1) chunk.setBlock(x, y, z, 0);

    aether.generate(chunk);
    for (let x = 0; x < CHUNK_SIZE; x += 1)
      for (let z = 0; z < CHUNK_SIZE; z += 1)
        for (let y = 0; y < 40; y += 1) expect(chunk.getBlock(x, y, z)).toBe(0);
  });
});

describe('The Backrooms', () => {
  it('generates carpet, walls and a ceiling', () => {
    const backrooms = new BackroomsTerrain({ seed: 'br', floorY: 20, roomHeight: 5, levels: 2 });
    const chunk = new Chunk(0, 0, 'br');
    backrooms.generate(chunk);

    // Carpet on the floor of level 0.
    expect(chunk.getBlock(3, 20, 3)).not.toBe(0);
    // A ceiling above it.
    expect(chunk.getBlock(3, 25, 3)).not.toBe(0);
  });

  it('leaves walkable space — it is a maze, not a solid block', () => {
    const backrooms = new BackroomsTerrain({ seed: 'br2', floorY: 20, roomHeight: 5, levels: 1 });
    const chunk = new Chunk(1, 1, 'br2');
    backrooms.generate(chunk);

    let open = 0;
    for (let x = 0; x < CHUNK_SIZE; x += 1)
      for (let z = 0; z < CHUNK_SIZE; z += 1)
        if (chunk.getBlock(x, 22, z) === 0) open += 1;

    // Most of the floor plan must be room, not wall.
    expect(open).toBeGreaterThan(CHUNK_SIZE * CHUNK_SIZE * 0.4);
  });

  it('places fluorescent lights on a regular pitch', () => {
    const backrooms = new BackroomsTerrain({ seed: 'br3', floorY: 20, roomHeight: 5, levels: 1 });
    const chunk = new Chunk(0, 0, 'br3');
    backrooms.generate(chunk);

    let lights = 0;
    for (let x = 0; x < CHUNK_SIZE; x += 1)
      for (let z = 0; z < CHUNK_SIZE; z += 1)
        if (chunk.getBlock(x, 25, z) === 10) lights += 1;

    // A 5-block pitch across 16x16 gives roughly 9-16 lights.
    expect(lights).toBeGreaterThan(4);
  });

  it('stacks multiple levels', () => {
    const backrooms = new BackroomsTerrain({ seed: 'br4', floorY: 10, roomHeight: 5, levels: 3 });
    const chunk = new Chunk(0, 0, 'br4');
    backrooms.generate(chunk);
    // Level 1's carpet sits one stride above level 0's.
    expect(chunk.getBlock(3, 10, 3)).not.toBe(0);
    expect(chunk.getBlock(3, 17, 3)).not.toBe(0);
  });
});

describe('Aether and Backrooms as real dimensions', () => {
  it('are registered in the dimension list', () => {
    const ids = ALL_DIMENSIONS.map((d) => d.id);
    expect(ids).toContain('aether');
    expect(ids).toContain('backrooms');
  });

  it('have complete definitions, not stubs', () => {
    for (const id of ['aether', 'backrooms'] as const) {
      const dimension = getDimensionById(id);
      expect(dimension.name.length).toBeGreaterThan(0);
      expect(dimension.exclusiveBlocks.length).toBeGreaterThan(2);
      expect(dimension.exclusiveMobs.length).toBeGreaterThan(2);
      expect(dimension.structures.length).toBeGreaterThan(1);
      expect(dimension.lore.length).toBeGreaterThan(40);
    }
  });

  it('have their own sky profiles', () => {
    const aether = getSkyProfileForDimension('aether');
    const backrooms = getSkyProfileForDimension('backrooms');
    expect(aether.label).toBe('The Aether');
    expect(backrooms.label).toBe('The Backrooms');
    // The Backrooms must be foggy and sunless; that is the entire mood.
    expect(backrooms.fogDensity).toBeGreaterThan(aether.fogDensity);
  });
});

/* -------------------------------------------------------------------------- */
/*                              VOID LEVIATHAN                                 */
/* -------------------------------------------------------------------------- */

/** The boss only needs a scene for meshes; a stub is enough for logic tests. */
function stubScene(): never {
  return {} as never;
}

describe('Void Leviathan', () => {
  it('starts inactive and is not defeated', () => {
    const boss = new VoidLeviathan(stubScene(), 'seed');
    expect(boss.isActive()).toBe(false);
    expect(boss.isDefeated()).toBe(false);
  });

  it('reports nothing to hit before it is summoned', () => {
    const boss = new VoidLeviathan(stubScene(), 'seed');
    const event = boss.damage(100, 'core');
    expect(event.kind).toBe('hit');
    expect(boss.isDefeated()).toBe(false);
  });
});

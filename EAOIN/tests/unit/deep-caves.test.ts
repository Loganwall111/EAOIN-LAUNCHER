/**
 * Regression tests for the 2.0 underground overhaul.
 *
 * The key constraint from the brief: caves must be *much* bigger, but this
 * must apply "only in the caves not in the surface". These tests pin both
 * halves of that — large underground volume, intact surface.
 */
import { describe, it, expect } from 'vitest';
import AdvancedTerrainGenerator from '../../src/world/AdvancedTerrainGenerator';
import { CHUNK_SIZE } from '../../src/world/Chunk';
import { DeepCaveGenerator, CAVE_BIOMES } from '../../src/world/DeepCaves';

const BEDROCK = 5;
const ROOF_FRACTION = 0.18;

/** Blocks that only the deep-cave dresser places. */
const GLOW_BLOCKS = new Set([106, 107, 16, 49, 14]);
const MOLTEN_BLOCKS = new Set([227, 219]);

function survey(seed: string, chunkFrom = 40, chunkTo = 43) {
  const gen = new AdvancedTerrainGenerator({ seed });
  let air = 0, solid = 0, glow = 0, molten = 0, surfaceAir = 0, surfaceTotal = 0;

  for (let cx = chunkFrom; cx < chunkTo; cx += 1) {
    for (let cz = chunkFrom; cz < chunkTo; cz += 1) {
      const chunk = gen.generateChunk(cx, cz);
      for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
        for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
          const wx = cx * CHUNK_SIZE + lx;
          const wz = cz * CHUNK_SIZE + lz;
          const surface = gen.getTerrainHeight(wx, wz);
          const roof = Math.max(5, Math.round((surface - BEDROCK) * ROOF_FRACTION));

          for (let y = BEDROCK; y < surface - roof; y += 1) {
            const b = chunk.getBlock(lx, y, lz);
            if (b === 0) air += 1; else solid += 1;
            if (GLOW_BLOCKS.has(b)) glow += 1;
            if (MOLTEN_BLOCKS.has(b)) molten += 1;
          }

          // The four blocks at and just below the surface.
          for (let y = surface - 3; y <= surface; y += 1) {
            surfaceTotal += 1;
            if (chunk.getBlock(lx, y, lz) === 0) surfaceAir += 1;
          }
        }
      }
    }
  }

  return {
    airRatio: air / Math.max(1, air + solid),
    surfaceAirRatio: surfaceAir / Math.max(1, surfaceTotal),
    glow,
    molten,
  };
}

describe('DeepCaveGenerator', () => {
  it('carves genuinely large caverns underground', () => {
    // The old thin-tunnel pass alone produced only a few percent air. Real
    // caverns should open up a large fraction of the rock column.
    const { airRatio } = survey('cavetest');
    expect(airRatio).toBeGreaterThan(0.20);
  });

  it('leaves the surface intact', () => {
    // This is the explicit constraint: bigger caves must not turn the
    // overworld into swiss cheese.
    const { surfaceAirRatio } = survey('cavetest');
    expect(surfaceAirRatio).toBeLessThan(0.35);
  });

  it('places bioluminescence and a molten core', () => {
    const { glow, molten } = survey('cavetest');
    expect(glow).toBeGreaterThan(0);
    expect(molten).toBeGreaterThan(0);
  });

  it('is stable across seeds', () => {
    for (const seed of ['alpha', 'beta']) {
      const { airRatio, surfaceAirRatio } = survey(seed, 20, 22);
      expect(airRatio, `${seed} air`).toBeGreaterThan(0.10);
      expect(surfaceAirRatio, `${seed} surface`).toBeLessThan(0.40);
    }
  });
});

describe('cave biomes', () => {
  it('exposes a full roster including the rare reference levels', () => {
    const ids = DeepCaveGenerator.allBiomes().map((b) => b.id);
    expect(ids).toContain('mushroom_valley');
    expect(ids).toContain('glowworm_grotto');
    expect(ids).toContain('ancient_ruins');
    expect(ids).toContain('backrooms');
    expect(ids.length).toBeGreaterThanOrEqual(10);
  });

  it('gives every biome a glow source so caverns are never pitch black', () => {
    for (const biome of Object.values(CAVE_BIOMES)) {
      expect(biome.glowChance, `${biome.id} glow`).toBeGreaterThan(0);
    }
  });

  it('selects hotter biomes toward the bottom of the world', () => {
    const gen = new DeepCaveGenerator({
      seed: 'biome-depth', bedrockThickness: 4, worldDepth: 128, seaLevel: 18,
    });
    // At the very bottom every column should be magma, regardless of noise.
    for (const [x, z] of [[0, 0], [500, -320], [-1200, 880]]) {
      expect(gen.getCaveBiomeAt(x, z, 0.95).id).toBe('magma_cavern');
    }
  });
});

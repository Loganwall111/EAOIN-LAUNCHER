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

/**
 * Survey the underground across **widely scattered regions**.
 *
 * Sampling a handful of adjacent chunks (as this helper used to) only measures
 * a single spot: the regional cave fields have wavelengths of hundreds of
 * blocks, so a 3-chunk window reports 0% air in one place and 99% a few
 * hundred blocks away. Averaging over spread-out regions is the only way to
 * make an assertion about the world as a whole.
 */
const REGIONS: Array<[number, number]> = [
  [8, 8], [60, -40], [-120, 75], [200, 210], [-300, -260], [420, -510],
];

interface Survey {
  airRatio: number;
  surfaceAirRatio: number;
  glow: number;
  molten: number;
  /** Water blocks with nothing solid beneath them. Must always be 0. */
  floatingWater: number;
  /** Vertical air runs of 3+ blocks — space a player can actually stand in. */
  walkablePockets: number;
  /** Air ratio for each surveyed region, to catch "one region is hollow". */
  perRegion: number[];
}

function survey(seed: string, regions: Array<[number, number]> = REGIONS): Survey {
  const gen = new AdvancedTerrainGenerator({ seed });
  let air = 0, solid = 0, glow = 0, molten = 0, surfaceAir = 0, surfaceTotal = 0;
  let floatingWater = 0, walkablePockets = 0;
  const perRegion: number[] = [];

  for (const [rx, rz] of regions) {
    let regionAir = 0, regionTotal = 0;

    for (let cx = rx; cx < rx + 2; cx += 1) {
      for (let cz = rz; cz < rz + 2; cz += 1) {
        const chunk = gen.generateChunk(cx, cz);
        for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
          for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
            const wx = cx * CHUNK_SIZE + lx;
            const wz = cz * CHUNK_SIZE + lz;
            const surface = gen.getTerrainHeight(wx, wz);
            const roof = Math.max(5, Math.round((surface - BEDROCK) * ROOF_FRACTION));

            let run = 0;
            for (let y = BEDROCK; y < surface - roof; y += 1) {
              const b = chunk.getBlock(lx, y, lz);
              regionTotal += 1;
              if (b === 0) { air += 1; regionAir += 1; run += 1; }
              else { solid += 1; if (run >= 3) walkablePockets += 1; run = 0; }
              if (GLOW_BLOCKS.has(b)) glow += 1;
              if (MOLTEN_BLOCKS.has(b)) molten += 1;
              // Water must always rest on something.
              if (b === 5 && chunk.getBlock(lx, y - 1, lz) === 0) floatingWater += 1;
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

    perRegion.push(regionTotal > 0 ? regionAir / regionTotal : 0);
  }

  return {
    airRatio: air / Math.max(1, air + solid),
    surfaceAirRatio: surfaceAir / Math.max(1, surfaceTotal),
    glow,
    molten,
    floatingWater,
    walkablePockets,
    perRegion,
  };
}

describe('DeepCaveGenerator', () => {
  it('carves caves without hollowing out the underground', () => {
    // The shipped build measured 52% air below the surface: the underground
    // read as an empty shell rather than as rock with caves in it. Real
    // Minecraft sits around 10%. Both bounds matter — too low means there is
    // nothing to explore, too high means the world is hollow.
    const { airRatio } = survey('cavetest');
    expect(airRatio).toBeGreaterThan(0.02);
    expect(airRatio).toBeLessThan(0.35);
  });

  it('leaves solid rock between cave systems in every region', () => {
    // Guards the specific failure mode where one region opens up completely.
    const { perRegion } = survey('cavetest');
    for (const ratio of perRegion) {
      expect(ratio).toBeLessThan(0.75);
    }
  });

  it('produces caves you can actually stand up in', () => {
    // Air alone is not enough: it has to form connected vertical space.
    const { walkablePockets } = survey('cavetest');
    expect(walkablePockets).toBeGreaterThan(100);
  });

  it('never leaves water floating with nothing underneath it', () => {
    // The reported "pool of water just randomly floated" bug. A fixed-Y water
    // band was written over already-carved caverns; 3,738 such blocks were
    // measured in a four-chunk sample before the fix.
    for (const seed of ['cavetest', 'eaoin_seed_2026', 'alpha', 'beta']) {
      expect(survey(seed).floatingWater, `${seed}`).toBe(0);
    }
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
    // Cave density must not swing wildly with the seed. An earlier attempt
    // thresholded low-frequency fbm directly, which has a seed-dependent DC
    // offset, and gave 3% air on one seed against 82% on another.
    for (const seed of ['alpha', 'beta', 'cavetest', 'eaoin_seed_2026']) {
      const { airRatio, surfaceAirRatio } = survey(seed);
      expect(airRatio, `${seed} air`).toBeGreaterThan(0.02);
      expect(airRatio, `${seed} air`).toBeLessThan(0.35);
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

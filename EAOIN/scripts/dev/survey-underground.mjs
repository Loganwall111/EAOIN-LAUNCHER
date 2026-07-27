/**
 * Dev survey: underground quality metrics for the terrain generator.
 *
 * IMPORTANT: samples widely scattered regions. The regional cave noise has a
 * wavelength of several hundred blocks, so surveying 3-4 adjacent chunks only
 * measures one spot and gives wildly misleading global numbers.
 *
 * Run: npx tsx scripts/dev/survey-underground.mjs
 */
import AdvancedTerrainGenerator from '../../src/world/AdvancedTerrainGenerator.ts';
import { CHUNK_SIZE } from '../../src/world/Chunk.ts';

const REGIONS = [[8, 8], [60, -40], [-120, 75], [200, 210], [-300, -260], [420, -510]];

function survey(seed) {
  const gen = new AdvancedTerrainGenerator({ seed });
  let air = 0, total = 0, floatingWater = 0, water = 0, walkable = 0;
  const perRegion = [];

  for (const [rx, rz] of REGIONS) {
    let rAir = 0, rTotal = 0;
    for (let cx = rx; cx < rx + 2; cx++) for (let cz = rz; cz < rz + 2; cz++) {
      const c = gen.generateChunk(cx, cz);
      for (let lx = 0; lx < CHUNK_SIZE; lx++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx, wz = cz * CHUNK_SIZE + lz;
        const surf = gen.getTerrainHeight(wx, wz);
        let run = 0;
        for (let y = 5; y < surf - 6; y++) {
          const b = c.getBlock(lx, y, lz);
          total++; rTotal++;
          if (b === 0) { air++; rAir++; run++; } else { if (run >= 3) walkable++; run = 0; }
          if (b === 5) { water++; if (c.getBlock(lx, y - 1, lz) === 0) floatingWater++; }
        }
      }
    }
    perRegion.push(rTotal ? +(100 * rAir / rTotal).toFixed(1) : 0);
  }

  return {
    seed,
    airPct: +(100 * air / total).toFixed(1),
    perRegion,
    water, floatingWater, walkablePockets: walkable,
  };
}

for (const seed of ['eaoin_seed_2026', 'cavetest', 'alpha', 'beta']) {
  console.log(JSON.stringify(survey(seed)));
}

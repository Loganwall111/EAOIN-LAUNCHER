/**
 * Dev benchmark: chunk generation throughput.
 *
 * Chunk generation runs on the main thread while streaming, so its cost per
 * chunk directly sets how much the game stutters when you walk into new
 * terrain. Run: npx tsx scripts/dev/bench-worldgen.mjs
 */
import AdvancedTerrainGenerator from '../../src/world/AdvancedTerrainGenerator.ts';

function bench(label, chunks = 25) {
  // Fresh generator per run so caches never carry between measurements.
  const gen = new AdvancedTerrainGenerator({ seed: `bench-${label}` });
  const side = Math.round(Math.sqrt(chunks));
  const t0 = process.hrtime.bigint();
  for (let cx = 0; cx < side; cx++) for (let cz = 0; cz < side; cz++) gen.generateChunk(cx, cz);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { total: ms, per: ms / (side * side) };
}

// Warm up the JIT, then take the best of several runs.
bench('warmup');
let best = Infinity;
for (let i = 0; i < 5; i++) best = Math.min(best, bench(`run${i}`).per);
console.log(`chunk generation: ${best.toFixed(1)} ms/chunk (best of 5)`);
console.log(`at 2 chunks/frame that is ${(best * 2).toFixed(1)} ms of the frame budget`);

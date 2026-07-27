/**
 * Dev survey: biome spacing. Walks long transects and reports run lengths.
 * Run: npx tsx scripts/dev/survey-biomes.mjs
 */
import AdvancedTerrainGenerator from '../../src/world/AdvancedTerrainGenerator.ts';

function transect(gen, z, length = 20000, step = 8) {
  const runs = [];
  const counts = new Map();
  let last = null, run = 0;
  for (let x = 0; x < length; x += step) {
    const b = gen.getBiomeAt(x, z).id;
    counts.set(b, (counts.get(b) || 0) + 1);
    if (b !== last) { if (last !== null) runs.push(run * step); last = b; run = 0; }
    run++;
  }
  runs.sort((a, b) => a - b);
  return { runs, counts };
}

for (const seed of ['eaoin_seed_2026', 'alpha']) {
  const gen = new AdvancedTerrainGenerator({ seed });
  const all = [];
  const counts = new Map();
  for (const z of [0, 1500, -2200, 4300]) {
    const t = transect(gen, z);
    all.push(...t.runs);
    for (const [k, v] of t.counts) counts.set(k, (counts.get(k) || 0) + v);
  }
  all.sort((a, b) => a - b);
  const pct = (p) => all[Math.floor(all.length * p)];
  console.log(`\n== ${seed} ==`);
  console.log(`biome runs (blocks): p10=${pct(0.1)} median=${pct(0.5)} p90=${pct(0.9)} max=${all[all.length - 1]}`);
  console.log(`distinct biomes seen: ${counts.size}`);
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  console.log('coverage:', top.map(([k, v]) => `${k} ${(100 * v / total).toFixed(1)}%`).join(', '));
}

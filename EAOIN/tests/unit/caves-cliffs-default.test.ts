// @vitest-environment node
/**
 * Ensures the default overworld still generates real Caves & Cliffs terrain
 * (varied heights, not a flat/low world) and spawns on solid ground.
 */
import { describe, it, expect } from 'vitest';
import { AdvancedTerrainGenerator } from '../../src/world/AdvancedTerrainGenerator';

function legacy(seed: string): { getTerrainHeight(x:number,z:number):number; getSpawnPoint():{x:number;y:number;z:number} } {
  const gen = new AdvancedTerrainGenerator({ seed });
  return (gen as unknown as { legacy: { getTerrainHeight(x:number,z:number):number; getSpawnPoint():{x:number;y:number;z:number} } }).legacy;
}

describe('Default overworld (Caves & Cliffs)', () => {
  it('produces varied terrain heights, not a flatland', () => {
    const g = legacy('eaoin_seed_2026');
    const heights = [0, 8, 50, 120, 300, 800].map((c) => g.getTerrainHeight(c, c));
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    expect(max - min).toBeGreaterThanOrEqual(8); // real relief
    expect(max).toBeGreaterThanOrEqual(30);      // not a sunken/abyssal world
  });

  it('spawns on solid ground well above the bottom of the world', () => {
    const g = legacy('eaoin_seed_2026');
    const spawn = g.getSpawnPoint();
    expect(spawn.y).toBeGreaterThan(15); // above bedrock/bottom
    expect(spawn.y).toBeLessThan(120);   // not stuck at the build cap
  });
});

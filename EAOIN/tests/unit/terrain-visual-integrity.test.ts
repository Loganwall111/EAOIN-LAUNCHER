import { describe, expect, it } from 'vitest';
import AdvancedTerrainGenerator, {
  SPAWN_TERRAIN_BLEND_RADIUS,
} from '../../src/world/AdvancedTerrainGenerator';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../../src/world/Chunk';
import { getWorldLayout, SPAWN_PROTECTED_RADIUS } from '../../src/world/WorldDistribution';

/** Find the highest occupied voxel in a generated world column. */
function topBlock(generator: AdvancedTerrainGenerator, x: number, z: number): number {
  for (let y = CHUNK_HEIGHT - 1; y >= 0; y -= 1) {
    if (generator.getBlockAt(x, y, z) !== 0) return y;
  }
  return -1;
}

describe('overworld visual integrity', () => {
  it('blends the safe spawn platform into procedural terrain without a crater wall', () => {
    for (const seed of ['eaoin_seed_2026', 'alpha', 'cavetest']) {
      const generator = new AdvancedTerrainGenerator({ seed });
      let previous = generator.getTerrainHeight(0, 0);

      expect(previous, `${seed} spawn plateau`).toBe(generator.config.seaLevel - 6);
      for (let x = 1; x <= SPAWN_TERRAIN_BLEND_RADIUS + 4; x += 1) {
        const height = generator.getTerrainHeight(x, 0);
        // A player can walk this grade; the former radius-26 discontinuity was
        // commonly tens of blocks in one step and exposed the cave cross-section.
        expect(Math.abs(height - previous), `${seed} height step at x=${x}`).toBeLessThanOrEqual(3);
        previous = height;
      }

      expect(generator.getTerrainHeight(SPAWN_PROTECTED_RADIUS, 0)).toBe(generator.config.seaLevel - 6);
    }
  });

  it('removes every remnant of the old hillside above objective clearings', () => {
    const seed = 'eaoin_seed_2026';
    const generator = new AdvancedTerrainGenerator({ seed });
    const layout = getWorldLayout(seed, generator.getSpawnPoint());

    for (const point of [layout.palette, layout.marketplace, layout.settlement]) {
      const x = Math.floor(point.x);
      const z = Math.floor(point.z);
      const expectedGround = generator.getTerrainHeight(x, z);
      const chunk = generator.generateChunk(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
      void chunk;

      expect(topBlock(generator, x, z), point.label).toBe(expectedGround);
      expect(generator.getBlockAt(x, expectedGround, z), `${point.label} floor`).not.toBe(0);
      for (let y = expectedGround + 1; y < CHUNK_HEIGHT; y += 1) {
        expect(generator.getBlockAt(x, y, z), `${point.label} floating block at y=${y}`).toBe(0);
      }
    }
  });
});

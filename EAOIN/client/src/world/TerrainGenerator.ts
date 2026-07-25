/**
 * Terrain Generator — Procedural world generation with multi-octave noise
 */
import { Chunk } from '../world/Chunk';
import { Noise } from './noise/Noise';

export class TerrainGenerator {
  private noise: Noise;

  constructor(private seed: string) {
    this.noise = new Noise(seed);
  }

  generateChunk(cx: number, cz: number): Chunk {
    const chunk = new Chunk(cx, cz, this.seed);
    // Chunk.generate() uses deterministic seed-based terrain
    return chunk;
  }

  getHeightAt(wx: number, wz: number): number {
    const hills = Math.sin(wx * 0.12) * 3;
    const mountains = Math.cos(wz * 0.08) * 4;
    const detail = Math.sin((wx + wz) * 0.25);
    return Math.max(1, Math.floor(5 + hills + mountains + detail));
  }

  generateBiome(cx: number, cz: number): string {
    const val = this.noise.sample(cx * 0.05, cz * 0.05);
    if (val > 0.6) return 'Mountain';
    if (val > 0.3) return 'Plains';
    if (val > 0.1) return 'Forest';
    return 'Ocean';
  }
}

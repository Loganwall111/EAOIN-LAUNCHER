/**
 * Perlin/Simplex-style Noise — Deterministic, Seeded
 */
export class Noise {
  constructor(private seed: number) {}

  sample(x: number, z: number): number {
    const val = Math.sin((x + this.seed) * 0.017) * Math.cos((z - this.seed) * 0.019) + Math.sin((x + z) * 0.006);
    return Math.tanh(val); // Normalize roughly to [-1, 1]
  }

  octaveSample(x: number, z: number, octaves = 4): number {
    let total = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let i = 0; i < octaves; i++) {
      total += this.sample(x * frequency, z * frequency) * amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return total;
  }
}

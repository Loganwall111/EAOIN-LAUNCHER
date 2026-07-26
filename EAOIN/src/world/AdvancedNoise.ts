/**
 * AdvancedNoise — multi-octave OpenSimplex-style noise + helpers.
 *
 * Used by the new TerrainGenerator to produce modern Minecraft Caves &
 * Cliffs-grade terrain: continents, mountain ranges, valleys, overhangs,
 * arches, hydraulic/thermal erosion, rivers, plateaus, etc.
 *
 * Implementation notes:
 *  - We use a hand-rolled 3D value-noise with smoothstep interpolation
 *    (good enough quality for the runtime). The same code is used everywhere
 *    so terrain, caves, and biomes are perfectly deterministic per seed.
 *  - We hash the world seed into a per-call salt so every sample is
 *    reproducible but different for each feature.
 *  - All noise functions are PURE — given the same (x, y, z, seed) they
 *    return the same number, which is what multiplayer needs.
 */

export class AdvancedNoise {
  private readonly seed: number;

  constructor(seed: string | number) {
    this.seed = typeof seed === 'string' ? AdvancedNoise.fnv1a(seed) : (seed >>> 0);
  }

  static fnv1a(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  private static smoothstep(t: number): number { return t * t * (3 - 2 * t); }
  private static lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

  /** Deterministic hash in [0, 1). */
  hash(x: number, y: number, z: number, salt: number = 0): number {
    let h = this.seed ^ Math.imul(salt | 0, 0x9E3779B1);
    h = Math.imul(h ^ Math.imul(x | 0, 0x85EBCA77), 0xC2B2AE3D);
    h = Math.imul(h ^ Math.imul(y | 0, 0x27D4EB2F), 0x165667B1);
    h = Math.imul(h ^ Math.imul(z | 0, 0xD3A2646C), 0xCC9E2D51);
    h ^= h >>> 16;
    return (h >>> 0) / 0x100000000;
  }

  /** 2D value noise in [0, 1]. */
  noise2D(x: number, y: number, salt: number = 0): number {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = AdvancedNoise.smoothstep(xf), v = AdvancedNoise.smoothstep(yf);
    const n00 = this.hash(xi, yi, 0, salt);
    const n10 = this.hash(xi + 1, yi, 0, salt);
    const n01 = this.hash(xi, yi + 1, 0, salt);
    const n11 = this.hash(xi + 1, yi + 1, 0, salt);
    return AdvancedNoise.lerp(AdvancedNoise.lerp(n00, n10, u), AdvancedNoise.lerp(n01, n11, u), v);
  }

  /** 3D value noise in [0, 1]. */
  noise3D(x: number, y: number, z: number, salt: number = 0): number {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = AdvancedNoise.smoothstep(xf), v = AdvancedNoise.smoothstep(yf), w = AdvancedNoise.smoothstep(zf);
    const c000 = this.hash(xi, yi, zi, salt);
    const c100 = this.hash(xi + 1, yi, zi, salt);
    const c010 = this.hash(xi, yi + 1, zi, salt);
    const c110 = this.hash(xi + 1, yi + 1, zi, salt);
    const c001 = this.hash(xi, yi, zi + 1, salt);
    const c101 = this.hash(xi + 1, yi, zi + 1, salt);
    const c011 = this.hash(xi, yi + 1, zi + 1, salt);
    const c111 = this.hash(xi + 1, yi + 1, zi + 1, salt);
    const x00 = AdvancedNoise.lerp(c000, c100, u);
    const x10 = AdvancedNoise.lerp(c010, c110, u);
    const x01 = AdvancedNoise.lerp(c001, c101, u);
    const x11 = AdvancedNoise.lerp(c011, c111, u);
    return AdvancedNoise.lerp(AdvancedNoise.lerp(x00, x10, v), AdvancedNoise.lerp(x01, x11, v), w);
  }

  /** Fractal Brownian Motion. */
  fbm2D(x: number, y: number, octaves = 5, lacunarity = 2.02, gain = 0.5, salt = 0): number {
    let sum = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise2D(x * freq, y * freq, salt + i) * amp;
      max += amp;
      amp *= gain; freq *= lacunarity;
    }
    return sum / max;
  }

  fbm3D(x: number, y: number, z: number, octaves = 4, lacunarity = 2.0, gain = 0.48, salt = 0): number {
    let sum = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise3D(x * freq, y * freq, z * freq, salt + i) * amp;
      max += amp;
      amp *= gain; freq *= lacunarity;
    }
    return sum / max;
  }

  /** Ridge noise — sharp mountain ridges in [0, 1]. */
  ridge2D(x: number, y: number, octaves = 4, salt = 0): number {
    return 1 - Math.abs(this.fbm2D(x, y, octaves, 2.0, 0.5, salt) * 2 - 1);
  }

  /**
   * Domain warping: feed one noise into another to create swirling, organic
   * terrain shapes (Caves & Cliffs style).
   *  input2 = noise2D(x + warpX, y + warpY) * amplitude
   */
  warped2D(x: number, y: number, warpAmp: number, salt = 0): number {
    const wx = this.fbm2D(x + 31.4, y - 11.7, 4, 2.0, 0.5, salt);
    const wy = this.fbm2D(x - 24.2, y + 47.1, 4, 2.0, 0.5, salt + 7);
    return this.fbm2D(x + wx * warpAmp, y + wy * warpAmp, 5, 2.0, 0.5, salt + 17);
  }

  /** Billow noise — opposite of ridge, for fluffy cloud-like density. */
  billow2D(x: number, y: number, octaves = 4, salt = 0): number {
    return Math.abs(this.fbm2D(x, y, octaves, 2.0, 0.5, salt) * 2 - 1);
  }

  /** Worley-style cellular noise (simple, F1 distance). */
  worley2D(x: number, y: number, salt = 0): number {
    const xi = Math.floor(x), yi = Math.floor(y);
    let minDist = 999;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const cx = xi + dx, cy = yi + dy;
      const ox = this.hash(cx, cy, 0, salt);
      const oy = this.hash(cx, cy, 1, salt);
      const px = cx + ox, py = cy + oy;
      const d = (px - x) ** 2 + (py - y) ** 2;
      if (d < minDist) minDist = d;
    }
    return Math.sqrt(minDist);
  }
}

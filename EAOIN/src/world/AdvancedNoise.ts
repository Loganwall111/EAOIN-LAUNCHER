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

  /** Cubic smoothstep, 3t^2 - 2t^3. C1 continuous. */
  static smoothstep(t: number): number { return t * t * (3 - 2 * t); }

  /**
   * Quintic fade, 6t^5 - 15t^4 + 10t^3.
   *
   * Perlin's improved interpolant. Unlike `smoothstep` (which is only C1) this
   * has a zero *second* derivative at t=0 and t=1, so the curvature of the
   * field is continuous across every lattice cell boundary as well as the
   * value and the slope. That matters for terrain: a discontinuity in
   * curvature is visible as a faint crease along lattice lines, and because
   * the lattice is axis-aligned those creases line up into the long straight
   * ridges that read as "chunk seams" even when the heightmap is continuous.
   */
  private static fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }

  /** Deterministic hash in [0, 1). */
  hash(x: number, y: number, z: number, salt: number = 0): number {
    let h = this.seed ^ Math.imul(salt | 0, 0x9E3779B1);
    h = Math.imul(h ^ Math.imul(x | 0, 0x85EBCA77), 0xC2B2AE3D);
    h = Math.imul(h ^ Math.imul(y | 0, 0x27D4EB2F), 0x165667B1);
    h = Math.imul(h ^ Math.imul(z | 0, 0xD3A2646C), 0xCC9E2D51);
    h ^= h >>> 16;
    return (h >>> 0) / 0x100000000;
  }

  /**
   * 2D gradient (Perlin) noise in [0, 1].
   *
   * ## Why this is gradient noise and not value noise
   *
   * The previous implementation interpolated a *hashed value* at each lattice
   * corner. Value noise is continuous, but every lattice point is a local
   * extremum of the field, so the result is a grid of bumps whose maxima and
   * minima all sit on integer coordinates. Once summed over octaves those
   * axis-aligned features reinforce each other and the terrain grows visible
   * straight ridges and terraces on a regular grid — exactly the "hard
   * vertical cut" look, and it appears at chunk borders whenever the noise
   * frequency happens to put a lattice line there.
   *
   * Gradient noise instead stores a pseudo-random *direction* at each corner
   * and interpolates the dot product with the offset vector. The field is zero
   * at every lattice point, so there is no grid of extrema and no preferred
   * axis. This is the single most important change for removing seam-like
   * artefacts, and it costs the same number of hash lookups.
   *
   * The output is remapped to [0, 1] so every existing caller — all of which
   * assume a 0..1 range — keeps working unchanged.
   */
  noise2D(x: number, y: number, salt: number = 0): number {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    // Quintic fade for C2 continuity across cell boundaries.
    const u = AdvancedNoise.fade(xf), v = AdvancedNoise.fade(yf);

    // PERF: the four corners share most of their hash work. Fold the seed,
    // the salt and each axis contribution once, then combine per corner with
    // a single multiply + xorshift. This is the same avalanche quality as
    // hashing each corner from scratch, at roughly a third of the cost.
    const base = this.seed ^ Math.imul(salt | 0, 0x9E3779B1);
    const hx0 = Math.imul(xi, 0x85EBCA77);
    const hx1 = Math.imul(xi + 1, 0x85EBCA77);
    const hy0 = Math.imul(yi, 0x27D4EB2F);
    const hy1 = Math.imul(yi + 1, 0x27D4EB2F);

    const g00 = AdvancedNoise.grad2(base ^ hx0 ^ hy0, xf, yf);
    const g10 = AdvancedNoise.grad2(base ^ hx1 ^ hy0, xf - 1, yf);
    const g01 = AdvancedNoise.grad2(base ^ hx0 ^ hy1, xf, yf - 1);
    const g11 = AdvancedNoise.grad2(base ^ hx1 ^ hy1, xf - 1, yf - 1);

    const nx0 = g00 + (g10 - g00) * u;
    const nx1 = g01 + (g11 - g01) * u;
    const n = nx0 + (nx1 - nx0) * v;
    // 2D Perlin with 8 unit-length gradients is bounded by sqrt(2)/2 ≈ 0.7071.
    // Divide by that bound so the theoretical range maps exactly onto [0, 1].
    return Math.min(1, Math.max(0, n * (0.5 / 0.7071067811865476) + 0.5));
  }

  /**
   * Dot product of a lattice gradient with the offset vector.
   *
   * `seedMix` is the pre-folded per-corner hash input; this finishes the
   * avalanche and selects one of 8 evenly spaced directions. A power-of-two
   * count keeps the selection a cheap mask and avoids the directional bias a
   * modulo-by-12 over a low-entropy hash would introduce.
   */
  private static grad2(seedMix: number, dx: number, dy: number): number {
    let h = Math.imul(seedMix, 0xC2B2AE3D);
    h ^= h >>> 15;
    switch (h & 7) {
      case 0: return dx;
      case 1: return -dx;
      case 2: return dy;
      case 3: return -dy;
      case 4: return (dx + dy) * 0.7071067811865476;
      case 5: return (dx - dy) * 0.7071067811865476;
      case 6: return (-dx + dy) * 0.7071067811865476;
      default: return (-dx - dy) * 0.7071067811865476;
    }
  }

  /**
   * 3D gradient (Perlin) noise in [0, 1].
   *
   * Same reasoning as `noise2D`: the cave passes sample this field and
   * threshold it, and with value noise the thresholded surface snapped to the
   * integer lattice, producing flat-faced, box-like cave walls. Gradient noise
   * gives isotropic, rounded cavities.
   */
  noise3D(x: number, y: number, z: number, salt: number = 0): number {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = AdvancedNoise.fade(xf), v = AdvancedNoise.fade(yf), w = AdvancedNoise.fade(zf);

    // PERF: hoist the per-axis hash contributions out of the eight corners.
    // This is the hottest function in world generation (the cave passes call
    // it for most voxels below the surface), so the saving is material.
    const base = this.seed ^ Math.imul(salt | 0, 0x9E3779B1);
    const hx0 = Math.imul(xi, 0x85EBCA77);
    const hx1 = Math.imul(xi + 1, 0x85EBCA77);
    const hy0 = Math.imul(yi, 0x27D4EB2F);
    const hy1 = Math.imul(yi + 1, 0x27D4EB2F);
    const hz0 = Math.imul(zi, 0xD3A2646C);
    const hz1 = Math.imul(zi + 1, 0xD3A2646C);

    const b00 = base ^ hx0 ^ hy0;
    const b10 = base ^ hx1 ^ hy0;
    const b01 = base ^ hx0 ^ hy1;
    const b11 = base ^ hx1 ^ hy1;

    const g000 = AdvancedNoise.grad3(b00 ^ hz0, xf, yf, zf);
    const g100 = AdvancedNoise.grad3(b10 ^ hz0, xf - 1, yf, zf);
    const g010 = AdvancedNoise.grad3(b01 ^ hz0, xf, yf - 1, zf);
    const g110 = AdvancedNoise.grad3(b11 ^ hz0, xf - 1, yf - 1, zf);
    const g001 = AdvancedNoise.grad3(b00 ^ hz1, xf, yf, zf - 1);
    const g101 = AdvancedNoise.grad3(b10 ^ hz1, xf - 1, yf, zf - 1);
    const g011 = AdvancedNoise.grad3(b01 ^ hz1, xf, yf - 1, zf - 1);
    const g111 = AdvancedNoise.grad3(b11 ^ hz1, xf - 1, yf - 1, zf - 1);

    const x00 = g000 + (g100 - g000) * u;
    const x10 = g010 + (g110 - g010) * u;
    const x01 = g001 + (g101 - g001) * u;
    const x11 = g011 + (g111 - g011) * u;
    const y0 = x00 + (x10 - x00) * v;
    const y1 = x01 + (x11 - x01) * v;
    const n = y0 + (y1 - y0) * w;
    // 3D Perlin with edge-midpoint gradients is bounded by sqrt(3)/2 ≈ 0.866.
    // Divide by that bound (not multiply!) before recentring, so the full
    // range maps to [0, 1] without the clamp ever engaging. Multiplying here
    // pushed roughly a fifth of all samples past the clamp, which flattened
    // the tails of the distribution into constant 0 / 1 plateaus and produced
    // blobby, terraced cave walls.
    return Math.min(1, Math.max(0, n * (0.5 / 0.8660254037844386) + 0.5));
  }

  /**
   * Dot product of the 3D lattice gradient with the offset vector.
   *
   * `seedMix` is the pre-folded per-corner hash input; see `noise3D`.
   */
  private static grad3(seedMix: number, dx: number, dy: number, dz: number): number {
    // Ken Perlin's 12 edge-midpoint gradients, selected from a 16-way mask
    // (the last 4 repeat, which is the standard, bias-free arrangement).
    let mixed = Math.imul(seedMix, 0xC2B2AE3D);
    mixed ^= mixed >>> 15;
    const h = mixed & 15;
    switch (h) {
      case 0: return dx + dy;
      case 1: return -dx + dy;
      case 2: return dx - dy;
      case 3: return -dx - dy;
      case 4: return dx + dz;
      case 5: return -dx + dz;
      case 6: return dx - dz;
      case 7: return -dx - dz;
      case 8: return dy + dz;
      case 9: return -dy + dz;
      case 10: return dy - dz;
      case 11: return -dy - dz;
      case 12: return dx + dy;
      case 13: return -dy + dz;
      case 14: return -dx + dy;
      default: return -dy - dz;
    }
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
   * Domain warping: offset the sample point by a vector-valued noise field to
   * create swirling, organic shapes (Caves & Cliffs style).
   *
   * ## Correctness note
   *
   * The warp offsets are re-centred to [-0.5, 0.5] before being scaled. The
   * previous version added a raw [0, 1] fbm, which has a non-zero mean, so the
   * warp applied a large *constant* translation (~0.5 * warpAmp) on top of the
   * intended swirl. That is harmless on its own, but it hid a real bug in the
   * caller, which passed the same warped scalar in for both axes.
   */
  warped2D(x: number, y: number, warpAmp: number, salt = 0): number {
    const wx = this.fbm2D(x + 31.4, y - 11.7, 4, 2.0, 0.5, salt) - 0.5;
    const wy = this.fbm2D(x - 24.2, y + 47.1, 4, 2.0, 0.5, salt + 7) - 0.5;
    return this.fbm2D(x + wx * warpAmp, y + wy * warpAmp, 5, 2.0, 0.5, salt + 17);
  }

  /**
   * Vector-valued domain warp. Returns the *displaced coordinates* so callers
   * can warp a 2D field properly instead of collapsing the warp to a scalar.
   *
   * Use this when you need `f(warp(x, z))`; `warped2D` only gives you a single
   * warped sample and cannot preserve two independent axes.
   */
  warpPoint2D(x: number, y: number, warpAmp: number, salt = 0): { x: number; y: number } {
    const wx = this.fbm2D(x + 31.4, y - 11.7, 4, 2.0, 0.5, salt) - 0.5;
    const wy = this.fbm2D(x - 24.2, y + 47.1, 4, 2.0, 0.5, salt + 7) - 0.5;
    return { x: x + wx * warpAmp, y: y + wy * warpAmp };
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

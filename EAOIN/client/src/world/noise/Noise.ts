/**
 * Perlin/Simplex-style Noise — Deterministic, Seeded.
 *
 * ## What was broken
 *
 * The constructor was typed `private seed: number`, but every caller in the
 * engine builds it from the world seed *string* (`new Noise(seed)` in
 * `TerrainGenerator`). TypeScript only checks the call site, and the legacy
 * generator passed the string through an `any`, so at runtime `this.seed` was
 * a string and every expression of the form `(x + this.seed) * 0.017` became
 * `NaN`:
 *
 * ```
 *   (1 + "my-seed") * 0.017  ->  "1my-seed" * 0.017  ->  NaN
 * ```
 *
 * `NaN` then propagated into the heightmap, `Math.floor(NaN)` stayed `NaN`,
 * and every comparison against it was false — which is precisely the reported
 * "noise values completely zeroing out or failing entirely, dropping blocks
 * into the void". The seed is now hashed to a uint32 whatever type it arrives
 * as, and every public method is guarded so a non-finite input can never leak
 * into the voxel grid.
 *
 * ## Why the field itself changed
 *
 * The old `sample()` was `sin(x) * cos(z) + sin(x + z)`: a separable product of
 * two 1D waves. That is not noise. It is perfectly periodic, it is symmetric
 * about the diagonal, and — because the terms are axis-aligned — it produces
 * long straight ridges and repeating terraces on a fixed grid. Combined with
 * the per-chunk (rather than per-world) coordinates the old generator fed it,
 * the result was the hard vertical cut at every chunk seam.
 *
 * This is now real gradient (Perlin) noise with a quintic fade, which is
 * C2-continuous everywhere, has no preferred axis, and — critically for a
 * chunked world — is a pure function of *world* position, so two chunks that
 * meet at a seam sample the identical field and agree exactly.
 */

/** Quintic fade, 6t^5 - 15t^4 + 10t^3 (Perlin's improved interpolant). */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** FNV-1a over a string, so any seed shape becomes a usable uint32. */
function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Coerce any seed the engine might hand us into a uint32.
 *
 * Accepting `string | number` at the type level is the actual fix: the old
 * signature promised a number and silently received a string.
 */
function normalizeSeed(seed: string | number): number {
  if (typeof seed === 'number') {
    return Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) >>> 0 : 0;
  }
  return hashString(String(seed ?? ''));
}

const SQRT2_OVER_2 = 0.7071067811865476;

export class Noise {
  /** Always a finite uint32, regardless of what the caller passed in. */
  private readonly seed: number;

  constructor(seed: string | number) {
    this.seed = normalizeSeed(seed);
  }

  /** The resolved numeric seed. Useful for deriving related fields. */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Dot product of a pseudo-random unit gradient at lattice point (xi, zi)
   * with the offset vector to the sample point.
   *
   * Eight evenly spaced directions selected by a power-of-two mask: cheap, and
   * free of the directional bias a modulo-by-12 over a low-entropy hash gives.
   */
  private gradientDot(xi: number, zi: number, dx: number, dz: number, salt: number): number {
    let h = this.seed ^ Math.imul(salt | 0, 0x9e3779b1);
    h = Math.imul(h ^ Math.imul(xi | 0, 0x85ebca77), 0xc2b2ae3d);
    h = Math.imul(h ^ Math.imul(zi | 0, 0x27d4eb2f), 0x165667b1);
    h ^= h >>> 15;
    switch (h & 7) {
      case 0: return dx;
      case 1: return -dx;
      case 2: return dz;
      case 3: return -dz;
      case 4: return (dx + dz) * SQRT2_OVER_2;
      case 5: return (dx - dz) * SQRT2_OVER_2;
      case 6: return (-dx + dz) * SQRT2_OVER_2;
      default: return (-dx - dz) * SQRT2_OVER_2;
    }
  }

  /**
   * Raw 2D gradient noise in [-1, 1].
   *
   * Continuous across every lattice cell, so it is also continuous across
   * every chunk boundary — the caller only has to pass *world* coordinates.
   */
  noise2D(x: number, z: number, salt = 0): number {
    // Guard: a non-finite input must never become a NaN height.
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;

    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;
    const u = fade(xf);
    const v = fade(zf);

    const g00 = this.gradientDot(xi, zi, xf, zf, salt);
    const g10 = this.gradientDot(xi + 1, zi, xf - 1, zf, salt);
    const g01 = this.gradientDot(xi, zi + 1, xf, zf - 1, salt);
    const g11 = this.gradientDot(xi + 1, zi + 1, xf - 1, zf - 1, salt);

    const nx0 = lerp(g00, g10, u);
    const nx1 = lerp(g01, g11, u);
    // 2D Perlin with unit gradients is bounded by sqrt(2)/2; divide by that
    // bound so the theoretical range maps exactly onto [-1, 1].
    const n = lerp(nx0, nx1, v) / SQRT2_OVER_2;
    return Math.max(-1, Math.min(1, n));
  }

  /**
   * Single noise sample in [-1, 1].
   *
   * Kept for API compatibility with the previous implementation, but it is now
   * real noise rather than a product of sines, and it is NaN-safe.
   */
  sample(x: number, z: number): number {
    return this.noise2D(x, z, 0);
  }

  /** Single noise sample remapped to [0, 1]. */
  sample01(x: number, z: number): number {
    return this.noise2D(x, z, 0) * 0.5 + 0.5;
  }

  /**
   * Fractal Brownian Motion in [-1, 1].
   *
   * The old `octaveSample` summed amplitudes starting at 0.5 and never divided
   * by the total, so its range depended on the octave count — 4 octaves peaked
   * near 0.94, 6 near 0.98, and callers comparing against fixed thresholds got
   * a different world for every octave count. Normalising by the accumulated
   * amplitude makes the output range independent of `octaves`.
   */
  fbm(x: number, z: number, octaves = 4, lacunarity = 2.0, gain = 0.5, salt = 0): number {
    const count = Math.max(1, Math.floor(octaves));
    let sum = 0;
    let amplitude = 1;
    let frequency = 1;
    let total = 0;
    for (let i = 0; i < count; i++) {
      sum += this.noise2D(x * frequency, z * frequency, salt + i) * amplitude;
      total += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return total > 0 ? sum / total : 0;
  }

  /** Fractal Brownian Motion remapped to [0, 1]. */
  fbm01(x: number, z: number, octaves = 4, lacunarity = 2.0, gain = 0.5, salt = 0): number {
    return this.fbm(x, z, octaves, lacunarity, gain, salt) * 0.5 + 0.5;
  }

  /**
   * Multi-octave sample in [-1, 1].
   *
   * Same name and argument shape as before so existing callers keep working;
   * the range is now normalised (see `fbm`).
   */
  octaveSample(x: number, z: number, octaves = 4): number {
    return this.fbm(x, z, octaves);
  }

  /** Ridge noise in [0, 1] — sharp mountain crests. */
  ridge(x: number, z: number, octaves = 4, salt = 0): number {
    return 1 - Math.abs(this.fbm(x, z, octaves, 2.0, 0.5, salt));
  }

  /** Deterministic hash in [0, 1) for a lattice cell. Never NaN. */
  hash01(x: number, z: number, salt = 0): number {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
    let h = this.seed ^ Math.imul(salt | 0, 0x9e3779b1);
    h = Math.imul(h ^ Math.imul(Math.floor(x) | 0, 0x85ebca77), 0xc2b2ae3d);
    h = Math.imul(h ^ Math.imul(Math.floor(z) | 0, 0x27d4eb2f), 0x165667b1);
    h ^= h >>> 16;
    return (h >>> 0) / 0x100000000;
  }
}

export default Noise;

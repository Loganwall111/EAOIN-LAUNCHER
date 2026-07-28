/**
 * Chunk — Voxel World Unit
 * 16×16×128 blocks per chunk. Deterministic from seed.
 */
import { BlockID } from '@shared/blocks/BlockRegistry';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 128;

export interface ChunkOptions {
  /**
   * Generate the legacy placeholder terrain immediately.
   *
   * Real world generators fill the entire chunk themselves, so pre-generating
   * a throwaway terrain first is pure waste on one of the hottest code paths.
   */
  generate?: boolean;
}

export class Chunk {
  public readonly x: number;
  public readonly z: number;
  public readonly seed: string;
  /**
   * Block ids run through 302, so an 8-bit array is not large enough.
   *
   * The old Uint8Array silently wrapped id 256 to AIR, 257 to GRASS, etc. That
   * made many creative blocks disappear as soon as they were placed and was a
   * direct cause of apparently X-rayed holes in otherwise solid terrain.
   */
  private blocks: Uint16Array;
  /** Number of non-air voxels on each Y layer, used to bound mesh sweeps. */
  private readonly occupiedPerLayer = new Uint16Array(CHUNK_HEIGHT);
  private highestOccupiedY = -1;
  public modified = false;
  public meshDirty = true;

  constructor(x: number, z: number, seed: string, options: ChunkOptions = {}) {
    this.x = x;
    this.z = z;
    this.seed = seed;
    this.blocks = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    if (options.generate !== false) this.generate();
  }

  private index(x: number, y: number, z: number): number {
    return (x + CHUNK_SIZE * (z + CHUNK_SIZE * y));
  }

  getBlock(x: number, y: number, z: number): BlockID {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return 0;
    return this.blocks[this.index(x, y, z)];
  }

  setBlock(x: number, y: number, z: number, block: BlockID): void {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
    const i = this.index(x, y, z);
    const previous = this.blocks[i];
    if (previous !== block) {
      this.blocks[i] = block;

      if (previous === 0 && block !== 0) {
        this.occupiedPerLayer[y] += 1;
        if (y > this.highestOccupiedY) this.highestOccupiedY = y;
      } else if (previous !== 0 && block === 0) {
        this.occupiedPerLayer[y] -= 1;
        if (y === this.highestOccupiedY && this.occupiedPerLayer[y] === 0) {
          while (this.highestOccupiedY >= 0 && this.occupiedPerLayer[this.highestOccupiedY] === 0) {
            this.highestOccupiedY -= 1;
          }
        }
      }

      this.modified = true;
      this.meshDirty = true;
    }
  }

  /** Highest Y containing any non-air voxel, or -1 for an empty chunk. */
  getHighestOccupiedY(): number {
    return this.highestOccupiedY;
  }

  isSolid(x: number, y: number, z: number): boolean {
    const id = this.getBlock(x, y, z);
    return id !== 0; // 0 = air
  }

  /**
   * Deterministic placeholder terrain.
   *
   * ## Why this changed
   *
   * The previous body derived a per-chunk `seedNum` from
   * `hashSeed(seed + x + ',' + z)` and used it as the chunk's base height. A
   * hash is discontinuous by construction, so two chunks that share an edge
   * got completely unrelated base heights — a hard vertical cut at every
   * single chunk boundary, which is the classic "gaps between generated
   * chunks" look. It was also `Math.sin((x + seedNum) * 0.3)` with the
   * *chunk-local* x and **no z term at all**, so the surface was a set of
   * parallel ridges that restarted at every seam.
   *
   * On top of that, `Math.max(1, ...)` cannot enforce a minimum: if the inner
   * expression is `NaN` (which the old string-concatenated seed arithmetic
   * could produce) `Math.max` returns `NaN`, every `y === h` / `y < h` test is
   * false, and the column is left completely empty — a black hole in the
   * world.
   *
   * This version samples one continuous, world-coordinate value-noise field
   * with smooth interpolation, so adjacent chunks agree exactly at their
   * shared edge, and clamps the height with an explicit finite check.
   */
  generate(): void {
    const seedNum = this.hashSeed(this.seed);
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        // WORLD coordinates. Sampling chunk-local x/z is what made the field
        // restart at every boundary.
        const worldX = this.x * CHUNK_SIZE + x;
        const worldZ = this.z * CHUNK_SIZE + z;
        const h = this.columnHeight(worldX, worldZ, seedNum);
        for (let y = 0; y <= h; y++) {
          if (y === h) this.setBlock(x, y, z, 1); // grass
          else if (y > h - 4) this.setBlock(x, y, z, 2); // dirt
          else this.setBlock(x, y, z, 3); // stone
        }
      }
    }
    this.modified = false;
  }

  /** Smoothly interpolated value noise in [0, 1]; continuous everywhere. */
  private sampleNoise(x: number, z: number, seedNum: number): number {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;
    // Smoothstep so the field is C1 across lattice cells (and chunk seams).
    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);
    const corner = (cx: number, cz: number): number => {
      let h = seedNum ^ 0x9e3779b1;
      h = Math.imul(h ^ Math.imul(cx | 0, 0x85ebca77), 0xc2b2ae3d);
      h = Math.imul(h ^ Math.imul(cz | 0, 0x27d4eb2f), 0x165667b1);
      h ^= h >>> 16;
      return (h >>> 0) / 0x100000000;
    };
    const n00 = corner(xi, zi);
    const n10 = corner(xi + 1, zi);
    const n01 = corner(xi, zi + 1);
    const n11 = corner(xi + 1, zi + 1);
    const nx0 = n00 + (n10 - n00) * u;
    const nx1 = n01 + (n11 - n01) * u;
    return nx0 + (nx1 - nx0) * v;
  }

  /** Surface Y for a world column, always a legal integer. */
  private columnHeight(worldX: number, worldZ: number, seedNum: number): number {
    const broad = this.sampleNoise(worldX * 0.02, worldZ * 0.02, seedNum);
    const detail = this.sampleNoise(worldX * 0.08, worldZ * 0.08, seedNum ^ 0x5bf03635);
    const raw = 8 + broad * 10 + detail * 3;
    // Finiteness first: Math.max(1, NaN) is NaN, so a bare max is not a guard.
    if (!Number.isFinite(raw)) return 1;
    return Math.max(1, Math.min(CHUNK_HEIGHT - 1, Math.round(raw)));
  }

  private hashSeed(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
}

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

  generate(): void {
    // Deterministic terrain from seed
    const seedNum = this.hashSeed(this.seed + this.x + ',' + this.z);
    const baseHeight = Math.floor((Math.sin(seedNum * 0.01) * 5 + 5));
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const h = Math.max(1, Math.floor(baseHeight + Math.sin((x + seedNum) * 0.3) * 3));
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          if (y === h) this.setBlock(x, y, z, 1); // grass
          else if (y < h && y > h - 4) this.setBlock(x, y, z, 2); // dirt
          else if (y < h - 4) this.setBlock(x, y, z, 3); // stone
        }
      }
    }
    this.modified = false;
  }

  private hashSeed(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
    return Math.abs(h);
  }
}

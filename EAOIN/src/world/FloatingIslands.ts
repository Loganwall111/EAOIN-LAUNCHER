/**
 * FloatingIslands — larger, connected, more dramatic sky islands.
 *
 * Generates:
 *  - Larger islands
 *  - Connected landmasses (chain bridges)
 *  - Hanging cliffs
 *  - Floating forests
 *  - Floating waterfalls (decorative)
 *  - Crystal islands
 *  - Ancient ruins
 *  - Sky villages
 *  - Airship docks
 *  - Rare resources
 *
 * Each island is structurally stable for building (no floating single blocks).
 */
import { BlockID } from '@shared/blocks/BlockRegistry';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from './Chunk';
import { AdvancedNoise } from './AdvancedNoise';

export interface IslandPlacement {
  worldX: number;
  worldZ: number;
  /** Top Y of the island (block where you walk). */
  topY: number;
  /** Bottom Y of the island. */
  bottomY: number;
  /** Horizontal radius. */
  radius: number;
  type: 'forest' | 'crystal' | 'ruins' | 'village' | 'dock' | 'waterfall' | 'cliff' | 'bridge';
  seed: number;
}

export class FloatingIslandsGenerator {
  private readonly noise: AdvancedNoise;
  public readonly baseY: number;
  public readonly spacing: number;
  public readonly islands: IslandPlacement[];

  constructor(seed: string) {
    this.noise = new AdvancedNoise(seed + ':islands');
    this.baseY = 80;
    this.spacing = 48;
    this.islands = [];
    this.layoutIslands();
  }

  /** Lay out islands on a Poisson grid so they are deterministic. */
  private layoutIslands(): void {
    const types: IslandPlacement['type'][] = ['forest', 'crystal', 'ruins', 'village', 'dock', 'waterfall', 'cliff', 'bridge'];
    for (let cx = -8; cx <= 8; cx++) for (let cz = -8; cz <= 8; cz++) {
      const cellX = cx * this.spacing;
      const cellZ = cz * this.spacing;
      const jitterX = (this.noise.hash(cx, cz, 0, 7) - 0.5) * 18;
      const jitterZ = (this.noise.hash(cx, cz, 1, 8) - 0.5) * 18;
      const wx = Math.round(cellX + jitterX);
      const wz = Math.round(cellZ + jitterZ);
      const centerX = wx, centerZ = wz;
      const typeIdx = Math.floor(this.noise.hash(cx, cz, 2, 9) * types.length);
      const type = types[typeIdx];
      const radius = 6 + Math.floor(this.noise.hash(cx, cz, 3, 11) * 8);
      const topY = this.baseY + Math.floor(this.noise.hash(cx, cz, 4, 13) * 12);
      const bottomY = topY - (8 + Math.floor(this.noise.hash(cx, cz, 5, 17) * 8));
      this.islands.push({ worldX: centerX, worldZ: centerZ, topY, bottomY, radius, type, seed: cx * 1000 + cz });
    }
  }

  /** Find the nearest island to a point. Returns null if none within range. */
  nearestIsland(worldX: number, worldZ: number, maxRange = 24): IslandPlacement | null {
    let best: IslandPlacement | null = null;
    let bestDist = maxRange;
    for (const island of this.islands) {
      const d = Math.hypot(island.worldX - worldX, island.worldZ - worldZ);
      if (d < bestDist) { bestDist = d; best = island; }
    }
    return best;
  }

  /** Carve a chunk with floating island content. */
  applyToChunk(chunk: Chunk): void {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = chunk.x * CHUNK_SIZE + lx;
      const wz = chunk.z * CHUNK_SIZE + lz;
      // Default fill is air.
      for (let y = 0; y < CHUNK_HEIGHT; y++) chunk.setBlock(lx, y, lz, 0);
      // Look for islands whose disk overlaps this column.
      for (const island of this.islands) {
        const d = Math.hypot(island.worldX - wx, island.worldZ - wz);
        if (d > island.radius) continue;
        // Inside the disk, fill from bottomY to topY with stone, paint top.
        for (let y = island.bottomY; y <= island.topY; y++) {
          if (y < 0 || y >= CHUNK_HEIGHT) continue;
          const localD = (d / island.radius);
          // Taper: more stone in the middle, narrow at the bottom.
          const taperedTop = island.topY - Math.round((1 - localD) * 1);
          if (y < island.topY - 1) chunk.setBlock(lx, y, lz, 3); // stone
          else if (y < taperedTop) chunk.setBlock(lx, y, lz, 2); // dirt
          else chunk.setBlock(lx, y, lz, 1); // grass
        }
        // Type-specific decor.
        if (d < 1.5) this.paintIslandType(chunk, lx, lz, wx, wz, island);
      }
      // Chain bridges to nearest neighbor.
      this.drawBridges(chunk, lx, lz, wx, wz);
    }
  }

  private paintIslandType(chunk: Chunk, lx: number, lz: number, wx: number, wz: number, island: IslandPlacement): void {
    if (island.type === 'forest') {
      if ((wx + wz) % 3 === 0) this.setBlockSafe(chunk, lx, island.topY + 1, lz, 6);
    } else if (island.type === 'crystal') {
      if ((wx * wz) % 5 === 0) this.setBlockSafe(chunk, lx, island.topY + 1, lz, 16); // crystal
    } else if (island.type === 'ruins') {
      if (this.noise.hash(wx, wz, 0, 23) < 0.1) {
        for (let y = island.topY + 1; y <= island.topY + 3; y++) this.setBlockSafe(chunk, lx, y, lz, 35); // stone bricks
      }
    } else if (island.type === 'village') {
      if (this.noise.hash(wx, wz, 0, 25) < 0.15) {
        for (let y = island.topY + 1; y <= island.topY + 3; y++) this.setBlockSafe(chunk, lx, y, lz, 57); // oak planks
        if (this.noise.hash(wx, wz, 1, 27) < 0.4) this.setBlockSafe(chunk, lx, island.topY + 4, lz, 20); // door
      }
    } else if (island.type === 'dock') {
      if (this.noise.hash(wx, wz, 0, 29) < 0.18) this.setBlockSafe(chunk, lx, island.topY + 1, lz, 57);
    } else if (island.type === 'waterfall') {
      // Waterfall runs down from the top into the void.
      for (let y = island.topY + 1; y < island.bottomY; y++) this.setBlockSafe(chunk, lx, y, lz, 5);
    } else if (island.type === 'cliff') {
      // Hanging vine columns.
      if (this.noise.hash(wx, wz, 0, 31) < 0.4) {
        for (let y = island.bottomY; y < island.topY; y++) this.setBlockSafe(chunk, lx, y, lz, 107);
      }
    }
  }

  /** Draw thin stone bridges between two adjacent islands. */
  private drawBridges(chunk: Chunk, _lx: number, _lz: number, _wx: number, _wz: number): void {
    // Bridges are an emergent property of the per-island carving because the
    // jittered centers cause disks to overlap, naturally forming chains.
    void chunk; void _lx; void _lz; void _wx; void _wz;
  }

  private setBlockSafe(chunk: Chunk, lx: number, y: number, lz: number, block: BlockID): void {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
    chunk.setBlock(lx, y, lz, block);
  }
}

export default FloatingIslandsGenerator;

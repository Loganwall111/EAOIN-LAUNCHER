/**
 * TerrainGenerator — runtime terrain source for the playable Babylon canvas.
 * De-cluttered version: uses WorldDistribution to spread major objectives
 * and guarantees a clear spawn bubble.
 */
import { BlockID } from '@shared/blocks/BlockRegistry';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from './Chunk';
import { editKey, WorldBlockEdit } from './WorldSave';
import { getWorldLayout, SPAWN_PROTECTED_RADIUS } from './WorldDistribution';

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
}

export type BiomeID = 'Plains' | 'Forest' | 'Desert' | 'Highlands' | 'Lake';

const WATER_LEVEL = 7;
const SPAWN_GROUND_Y = 8;

export class TerrainGenerator {
  private readonly chunks = new Map<string, Chunk>();
  private readonly editOverrides = new Map<string, WorldBlockEdit>();
  // cached layout for clearing checks
  private cachedLayout: ReturnType<typeof getWorldLayout> | null = null;

  constructor(private readonly seed: string, initialEdits: WorldBlockEdit[] = []) {
    for (const edit of initialEdits) {
      this.editOverrides.set(editKey(edit.x, edit.y, edit.z), { ...edit });
    }
  }

  private getLayout(): ReturnType<typeof getWorldLayout> {
    if (!this.cachedLayout) {
      // spawn point approx 0.5,0.5 used for layout calc; avoids circular dep
      this.cachedLayout = getWorldLayout(this.seed, { x: 0.5, y: SPAWN_GROUND_Y + 1.95, z: 0.5 });
    }
    return this.cachedLayout!;
  }

  generateChunk(cx: number, cz: number): Chunk {
    const key = this.chunkKey(cx, cz);
    const cached = this.chunks.get(key);
    if (cached) return cached;

    const chunk = new Chunk(cx, cz, this.seed);
    this.applyBiomeSurfacePass(chunk);
    this.addProceduralWorldContent(chunk);
    this.applyPlayableSpawnPatch(chunk);
    this.applyObjectiveClearings(chunk);
    this.addDispersedLandmarks(chunk);
    this.applySavedEdits(chunk);
    this.chunks.set(key, chunk);
    return chunk;
  }

  generateChunkGrid(radius: number): Chunk[] {
    const chunks: Chunk[] = [];
    for (let cx = -radius; cx <= radius; cx += 1) {
      for (let cz = -radius; cz <= radius; cz += 1) {
        chunks.push(this.generateChunk(cx, cz));
      }
    }
    return chunks;
  }

  getBlockAt(worldX: number, y: number, worldZ: number): BlockID {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    const address = this.toChunkAddress(worldX, worldZ);
    return this.generateChunk(address.cx, address.cz).getBlock(address.lx, y, address.lz);
  }

  setBlockAt(worldX: number, y: number, worldZ: number, block: BlockID): boolean {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    const address = this.toChunkAddress(worldX, worldZ);
    const chunk = this.generateChunk(address.cx, address.cz);
    chunk.setBlock(address.lx, y, address.lz, block);
    this.editOverrides.set(editKey(address.worldX, y, address.worldZ), {
      x: address.worldX,
      y,
      z: address.worldZ,
      block,
    });
    return true;
  }

  getEdits(): WorldBlockEdit[] {
    return Array.from(this.editOverrides.values()).map((edit) => ({ ...edit }));
  }

  getEditCount(): number {
    return this.editOverrides.size;
  }

  getHeightAt(worldX: number, worldZ: number): number {
    const x = Math.floor(worldX);
    const z = Math.floor(worldZ);
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y -= 1) {
      const id = this.getBlockAt(x, y, z);
      if (id !== 0 && id !== 5) return y;
    }
    return 0;
  }

  getBiomeAt(worldX: number, worldZ: number): BiomeID {
    if (this.getLakeDepth(worldX, worldZ) > 0.12) return 'Lake';
    const heat = this.smoothValue(worldX, worldZ, 'heat');
    const moisture = this.smoothValue(worldX, worldZ, 'moisture');
    const rockiness = this.smoothValue(worldX, worldZ, 'rockiness');
    if (rockiness > 0.68) return 'Highlands';
    if (heat > 0.58 && moisture < 0.45) return 'Desert';
    if (moisture > 0.54) return 'Forest';
    return 'Plains';
  }

  getSpawnPoint(): SpawnPoint {
    const x = 0.5;
    const z = 0.5;
    const groundY = this.getHeightAt(Math.floor(x), Math.floor(z));
    return {
      x,
      y: groundY + 1.95,
      z,
    };
  }

  // --- Terrain passes ---

  private applyBiomeSurfacePass(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (localX, localZ, worldX, worldZ) => {
      if (this.isProtectedSpawnColumn(worldX, worldZ, SPAWN_PROTECTED_RADIUS)) return;
      // respect all objective clearings during surface painting
      if (this.isInObjectiveClearing(worldX, worldZ)) return;

      const lakeDepth = this.getLakeDepth(worldX, worldZ);
      if (lakeDepth > 0.12) {
        this.carveLakeColumn(chunk, localX, localZ, lakeDepth);
        return;
      }
      const surfaceY = this.findSurfaceY(chunk, localX, localZ);
      if (surfaceY <= 0) return;
      const biome = this.getBiomeAt(worldX, worldZ);
      if (biome === 'Desert') {
        this.paintSurfaceLayer(chunk, localX, localZ, surfaceY, 4, 4, 2);
      } else if (biome === 'Highlands') {
        this.paintSurfaceLayer(chunk, localX, localZ, surfaceY, 3, 3, 1);
        if (this.hashToUnit(`surface-ore:${worldX}:${worldZ}`) > 0.965) {
          chunk.setBlock(localX, surfaceY, localZ, this.pickOreBlock(worldX, worldZ));
        }
      } else {
        this.paintSurfaceLayer(chunk, localX, localZ, surfaceY, 1, 2, 2);
      }
    });
  }

  private addProceduralWorldContent(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (localX, localZ, worldX, worldZ) => {
      if (this.isProtectedSpawnColumn(worldX, worldZ, SPAWN_PROTECTED_RADIUS + 4)) return;
      if (this.isInObjectiveClearing(worldX, worldZ)) return;

      const biome = this.getBiomeAt(worldX, worldZ);
      if (biome === 'Lake') return;
      const surfaceY = this.findSurfaceY(chunk, localX, localZ);
      if (surfaceY <= 0 || chunk.getBlock(localX, surfaceY, localZ) === 5) return;

      if (biome === 'Forest' && this.isFeatureAnchor(worldX, worldZ, 9, 'forest-tree')) {
        this.placeTreeAt(chunk, worldX, surfaceY, worldZ, 4 + Math.floor(this.hashToUnit(`tree-height:${worldX}:${worldZ}`) * 3));
      }
      if (biome === 'Plains' && this.isFeatureAnchor(worldX, worldZ, 24, 'plains-tree')) {
        this.placeTreeAt(chunk, worldX, surfaceY, worldZ, 3);
      }
      if ((biome === 'Highlands' || biome === 'Plains') && this.isFeatureAnchor(worldX, worldZ, 17, 'boulder')) {
        this.placeBoulderAt(chunk, worldX, surfaceY, worldZ, biome === 'Highlands' ? 2 : 1);
      }
      if (biome === 'Highlands' && this.isFeatureAnchor(worldX, worldZ, 13, 'ore-outcrop')) {
        this.placeOreOutcropAt(chunk, worldX, surfaceY, worldZ);
      }
      if (this.isFeatureAnchor(worldX, worldZ, 41, 'ruin') && this.hashToUnit(`ruin-gate:${worldX}:${worldZ}`) > 0.62) {
        this.placeStarterRuinAt(chunk, worldX, surfaceY, worldZ, biome);
      }
    });
  }

  private applySavedEdits(chunk: Chunk): void {
    for (const edit of this.editOverrides.values()) {
      const address = this.toChunkAddress(edit.x, edit.z);
      if (address.cx === chunk.x && address.cz === chunk.z) {
        chunk.setBlock(address.lx, edit.y, address.lz, edit.block);
      }
    }
    chunk.modified = false;
  }

  private applyPlayableSpawnPatch(chunk: Chunk): void {
    // Large, guaranteed-solid clearing at origin prevents void starts and leaves spawn breathable
    this.forEachLocalBlock(chunk, (localX, localZ, worldX, worldZ) => {
      const dist = Math.hypot(worldX, worldZ);
      if (dist > SPAWN_PROTECTED_RADIUS) return;
      const groundY = SPAWN_GROUND_Y;
      for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
        if (y < groundY - 4) chunk.setBlock(localX, y, localZ, 3);
        else if (y < groundY) chunk.setBlock(localX, y, localZ, 2);
        else if (y === groundY) chunk.setBlock(localX, y, localZ, 1);
        else if (y <= groundY + 4) chunk.setBlock(localX, y, localZ, 0); // generous headroom
        // above that keep procedural
      }
    });
  }

  private applyObjectiveClearings(chunk: Chunk): void {
    const layout = this.getLayout();
    const clearings = [
      layout.rocket, // biggest
      layout.settlement,
      layout.portalCore,
      layout.woodenDoor,
      layout.dimensionalDoor,
      layout.palette,
      layout.marketplace,
    ] as Array<{ x: number; z: number; radius: number; label: string }>;
    this.forEachLocalBlock(chunk, (localX, localZ, worldX, worldZ) => {
      for (const c of clearings) {
        const d = Math.hypot(worldX - c.x, worldZ - c.z);
        if (d <= c.radius) {
          const groundY = SPAWN_GROUND_Y + 1; // flatten slightly higher for visibility
          for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
            if (y < groundY - 3) chunk.setBlock(localX, y, localZ, 3);
            else if (y < groundY) chunk.setBlock(localX, y, localZ, 2);
            else if (y === groundY) chunk.setBlock(localX, y, localZ, c.label === 'rocket' ? 3 : 1);
            else if (y <= groundY + 6) chunk.setBlock(localX, y, localZ, 0);
          }
          break;
        }
      }
    });
  }

  private addDispersedLandmarks(chunk: Chunk): void {
    const layout = this.getLayout();
    this.forEachLocalBlock(chunk, (localX, localZ, worldX, worldZ) => {
      // Block palette moved to dedicated far point (demonstrates materials without cluttering spawn)
      const palette: BlockID[] = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12];
      const dx = worldX - Math.round(layout.palette.x);
      const dz = worldZ - Math.round(layout.palette.z);
      if (dz === 0 && dx >= 0 && dx < palette.length) {
        // clearing already flattened, place row on top
        chunk.setBlock(localX, SPAWN_GROUND_Y + 1, localZ, palette[dx]);
        chunk.setBlock(localX, SPAWN_GROUND_Y + 2, localZ, 0);
        chunk.setBlock(localX, SPAWN_GROUND_Y + 3, localZ, 0);
      }

      // Small water feature only at pirate location, not near spawn
      const pDist = Math.hypot(worldX - layout.pirate.x, worldZ - layout.pirate.z);
      if (pDist < 4) {
        for (let y = 0; y < WATER_LEVEL; y += 1) {
          if (chunk.getBlock(localX, y, localZ) === 0) chunk.setBlock(localX, y, localZ, 3);
        }
        chunk.setBlock(localX, WATER_LEVEL, localZ, 5);
        for (let y = WATER_LEVEL + 1; y < SPAWN_GROUND_Y + 2; y++) chunk.setBlock(localX, y, localZ, 0);
      }
    });
  }

  // helpers previously private

  private carveLakeColumn(chunk: Chunk, localX: number, localZ: number, depth: number): void {
    const bottomY = Math.max(2, WATER_LEVEL - 1 - Math.floor(depth * 3));
    chunk.setBlock(localX, bottomY - 1, localZ, 4);
    for (let y = bottomY; y <= WATER_LEVEL; y += 1) chunk.setBlock(localX, y, localZ, 5);
    for (let y = WATER_LEVEL + 1; y < CHUNK_HEIGHT; y += 1) chunk.setBlock(localX, y, localZ, 0);
  }

  private paintSurfaceLayer(chunk: Chunk, localX: number, localZ: number, surfaceY: number, topBlock: BlockID, fillBlock: BlockID, fillDepth: number): void {
    chunk.setBlock(localX, surfaceY, localZ, topBlock);
    for (let depth = 1; depth <= fillDepth; depth += 1) {
      const y = surfaceY - depth;
      if (y > 0) chunk.setBlock(localX, y, localZ, fillBlock);
    }
  }

  private findSurfaceY(chunk: Chunk, localX: number, localZ: number): number {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y -= 1) {
      const id = chunk.getBlock(localX, y, localZ);
      if (id !== 0 && id !== 5) return y;
    }
    return 0;
  }

  private pickOreBlock(worldX: number, worldZ: number): BlockID {
    const roll = this.hashToUnit(`ore:${worldX}:${worldZ}`);
    if (roll > 0.94) return 11;
    if (roll > 0.82) return 10;
    if (roll > 0.56) return 9;
    return 8;
  }

  private placeTreeAt(chunk: Chunk, worldX: number, surfaceY: number, worldZ: number, height: number): void {
    for (let y = surfaceY + 1; y <= surfaceY + height; y += 1) {
      this.setBlockIfInChunk(chunk, worldX, y, worldZ, 6);
    }
    const canopyBase = surfaceY + height - 1;
    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        const distance = Math.abs(dx) + Math.abs(dz);
        for (let dy = 0; dy <= 2; dy += 1) {
          if (distance <= 3 - Math.max(0, dy - 1)) {
            this.setBlockIfInChunk(chunk, worldX + dx, canopyBase + dy, worldZ + dz, 7);
          }
        }
      }
    }
  }

  private placeBoulderAt(chunk: Chunk, worldX: number, surfaceY: number, worldZ: number, radius: number): void {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        const distance = Math.abs(dx) + Math.abs(dz);
        const height = Math.max(1, radius + 2 - distance);
        for (let dy = 1; dy <= height; dy += 1) {
          this.setBlockIfInChunk(chunk, worldX + dx, surfaceY + dy, worldZ + dz, 3);
        }
      }
    }
  }

  private placeOreOutcropAt(chunk: Chunk, worldX: number, surfaceY: number, worldZ: number): void {
    const oreBlock = this.pickOreBlock(worldX, worldZ);
    this.placeBoulderAt(chunk, worldX, surfaceY, worldZ, 1);
    this.setBlockIfInChunk(chunk, worldX, surfaceY + 2, worldZ, oreBlock);
    this.setBlockIfInChunk(chunk, worldX + 1, surfaceY + 1, worldZ, oreBlock);
    this.setBlockIfInChunk(chunk, worldX, surfaceY + 1, worldZ - 1, oreBlock);
  }

  private placeStarterRuinAt(chunk: Chunk, worldX: number, surfaceY: number, worldZ: number, biome: BiomeID): void {
    const wallBlock: BlockID = biome === 'Desert' ? 4 : 3;
    for (let dx = -3; dx <= 3; dx += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        const wx = worldX + dx;
        const wz = worldZ + dz;
        const border = Math.abs(dx) === 3 || Math.abs(dz) === 2;
        this.setBlockIfInChunk(chunk, wx, surfaceY + 1, wz, wallBlock);
        if (border && this.hashToUnit(`ruin-break:${wx}:${wz}`) > 0.28) {
          this.setBlockIfInChunk(chunk, wx, surfaceY + 2, wz, wallBlock);
          if (this.hashToUnit(`ruin-tall:${wx}:${wz}`) > 0.72) {
            this.setBlockIfInChunk(chunk, wx, surfaceY + 3, wz, wallBlock);
          }
        } else if (!border) {
          this.setBlockIfInChunk(chunk, wx, surfaceY + 2, wz, 0);
          this.setBlockIfInChunk(chunk, wx, surfaceY + 3, wz, 0);
        }
      }
    }
    this.setBlockIfInChunk(chunk, worldX, surfaceY + 2, worldZ, this.pickOreBlock(worldX + 3, worldZ - 3));
  }

  private setBlockIfInChunk(chunk: Chunk, worldX: number, y: number, worldZ: number, block: BlockID): void {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const localX = worldX - chunk.x * CHUNK_SIZE;
    const localZ = worldZ - chunk.z * CHUNK_SIZE;
    if (localX < 0 || localX >= CHUNK_SIZE || localZ < 0 || localZ >= CHUNK_SIZE) return;
    chunk.setBlock(localX, y, localZ, block);
  }

  private isFeatureAnchor(worldX: number, worldZ: number, spacing: number, salt: string): boolean {
    const cellX = Math.floor(worldX / spacing);
    const cellZ = Math.floor(worldZ / spacing);
    const startX = cellX * spacing;
    const startZ = cellZ * spacing;
    const offsetX = Math.floor(this.hashToUnit(`${salt}:x:${cellX}:${cellZ}`) * spacing);
    const offsetZ = Math.floor(this.hashToUnit(`${salt}:z:${cellX}:${cellZ}`) * spacing);
    return worldX === startX + offsetX && worldZ === startZ + offsetZ;
  }

  private getLakeDepth(worldX: number, worldZ: number): number {
    if (this.isProtectedSpawnColumn(worldX, worldZ, SPAWN_PROTECTED_RADIUS + 8)) return 0;
    const spacing = 48;
    const cellX = Math.floor(worldX / spacing);
    const cellZ = Math.floor(worldZ / spacing);
    let depth = 0;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const lx = cellX + dx;
        const lz = cellZ + dz;
        const centerX = lx * spacing + Math.floor(this.hashToUnit(`lake-x:${lx}:${lz}`) * spacing);
        const centerZ = lz * spacing + Math.floor(this.hashToUnit(`lake-z:${lx}:${lz}`) * spacing);
        const radius = 8 + this.hashToUnit(`lake-radius:${lx}:${lz}`) * 9;
        const distance = Math.hypot(worldX - centerX, worldZ - centerZ);
        depth = Math.max(depth, 1 - distance / radius);
      }
    }
    return Math.max(0, depth);
  }

  private smoothValue(worldX: number, worldZ: number, salt: string): number {
    const offset = this.hashToUnit(`smooth:${salt}`) * 2000;
    const value = Math.sin((worldX + offset) * 0.023) + Math.cos((worldZ - offset) * 0.031) + Math.sin((worldX + worldZ + offset) * 0.015);
    return Math.max(0, Math.min(1, value / 6 + 0.5));
  }

  private isProtectedSpawnColumn(worldX: number, worldZ: number, radius: number): boolean {
    return Math.hypot(worldX, worldZ) <= radius;
  }

  private isInObjectiveClearing(worldX: number, worldZ: number): boolean {
    const layout = this.getLayout();
    const points = [layout.rocket, layout.settlement, layout.portalCore, layout.marketplace, layout.palette];
    for (const p of points) if (Math.hypot(worldX - p.x, worldZ - p.z) <= p.radius + 1) return true;
    return false;
  }

  private hashToUnit(str: string): number {
    let h = 2166136261;
    const full = `${this.seed}:${str}`;
    for (let i = 0; i < full.length; i += 1) {
      h ^= full.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 0xffffffff;
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx}:${cz}`;
  }

  private toChunkAddress(worldX: number, worldZ: number): { cx: number; cz: number; lx: number; lz: number; worldX: number; worldZ: number } {
    const x = Math.floor(worldX);
    const z = Math.floor(worldZ);
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return { cx, cz, lx: x - cx * CHUNK_SIZE, lz: z - cz * CHUNK_SIZE, worldX: x, worldZ: z };
  }

  private forEachLocalBlock(chunk: Chunk, visit: (localX: number, localZ: number, worldX: number, worldZ: number) => void): void {
    for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
      for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
        const worldX = chunk.x * CHUNK_SIZE + localX;
        const worldZ = chunk.z * CHUNK_SIZE + localZ;
        visit(localX, localZ, worldX, worldZ);
      }
    }
    chunk.modified = false;
  }
}

/**
 * ChunkLoader — Async Chunk Streaming with Background Loading
 */
import { Chunk } from '../world/Chunk';
import { ChunkCache } from '../rendering/ChunkRenderer';

export class ChunkLoader {
  private loading = new Set<string>();
  private streamRadius = 4;

  constructor(private cache: ChunkCache, private terrainGenerator: any) {}

  updateStream(centerX: number, centerZ: number): void {
    const needed = new Set<string>();
    for (let dx = -this.streamRadius; dx <= this.streamRadius; dx++) {
      for (let dz = -this.streamRadius; dz <= this.streamRadius; dz++) {
        needed.add(`${centerX + dx}:${centerZ + dz}`);
      }
    }

    // Unload distant
    for (const key of Array.from(this.loading)) {
      if (!needed.has(key)) {
        const [x, z] = key.split(':').map(Number);
        this.cache.delete(x, z);
        this.loading.delete(key);
      }
    }

    // Load new
    for (const key of needed) {
      if (!this.cache.has(...key.split(':').map(Number) as [number, number]) && !this.loading.has(key)) {
        this.loading.add(key);
        this.loadChunkAsync(key);
      }
    }
  }

  private async loadChunkAsync(key: string): Promise<void> {
    const [x, z] = key.split(':').map(Number);
    // Simulate async chunk generation
    await new Promise((r) => setTimeout(r, 50));
    const chunk = (this.terrainGenerator as any).generateChunk(x, z);
    this.cache.set(chunk);
    this.loading.delete(key);
    console.log(`[ChunkLoader] Loaded chunk ${key}`);
  }

  getStreamRadius(): number {
    return this.streamRadius;
  }
}

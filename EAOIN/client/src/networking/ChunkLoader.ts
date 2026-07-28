/**
 * ChunkLoader — async chunk streaming with background loading.
 *
 * ## What was broken
 *
 * - **Nothing was ever unloaded.** The unload sweep iterated `this.loading`,
 *   but a key is *removed* from that set the moment its chunk finishes
 *   loading. So the sweep only ever saw in-flight requests, and the cache grew
 *   without bound as the player walked.
 * - **`cache.has(...key.split(':').map(Number))`** spreads a `number[]` into a
 *   two-argument call. It happens to work, but a key like `-1:-2` is fine
 *   while any malformed key yields `NaN` coordinates that silently miss the
 *   cache — so that chunk is requested again on every update, forever.
 * - **Failures were invisible.** If `generateChunk` threw, the key stayed in
 *   `loading` permanently and that chunk was never retried nor reported: a
 *   permanent hole in the grid.
 * - **Nearest-first ordering was missing**, so the ground under the player was
 *   often the last thing to arrive.
 */
import { ChunkCache } from '../rendering/ChunkRenderer';

/** The part of a terrain generator this streamer needs. */
export interface ChunkSource {
  generateChunk(cx: number, cz: number): { x: number; z: number };
}

export class ChunkLoader {
  /** Requests currently in flight. */
  private readonly inFlight = new Set<string>();
  /** Keys the streamer has resolved, whether they produced geometry or not. */
  private readonly resolved = new Set<string>();
  /** Keys whose generation threw; retried on the next update. */
  private readonly failed = new Set<string>();
  private streamRadius = 4;

  constructor(private readonly cache: ChunkCache, private readonly terrainGenerator: ChunkSource) {}

  private key(cx: number, cz: number): string {
    return `${cx}:${cz}`;
  }

  private parseKey(key: string): [number, number] | null {
    const parts = key.split(':');
    if (parts.length !== 2) return null;
    const cx = Number(parts[0]);
    const cz = Number(parts[1]);
    // Reject NaN rather than letting it become a cache key that never matches.
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) return null;
    return [cx, cz];
  }

  updateStream(centerX: number, centerZ: number): void {
    if (!Number.isFinite(centerX) || !Number.isFinite(centerZ)) return;
    const cx0 = Math.trunc(centerX);
    const cz0 = Math.trunc(centerZ);

    const needed = new Set<string>();
    const missing: Array<{ cx: number; cz: number; distance: number }> = [];
    for (let dx = -this.streamRadius; dx <= this.streamRadius; dx++) {
      for (let dz = -this.streamRadius; dz <= this.streamRadius; dz++) {
        const cx = cx0 + dx;
        const cz = cz0 + dz;
        const key = this.key(cx, cz);
        needed.add(key);
        // A previously failed chunk is eligible again; a resolved one is not.
        const pending = !this.cache.has(cx, cz) && !this.inFlight.has(key)
          && (!this.resolved.has(key) || this.failed.has(key));
        if (pending) missing.push({ cx, cz, distance: dx * dx + dz * dz });
      }
    }

    // Unload from the CACHE, not from the in-flight set. This is the actual
    // record of what is resident.
    for (const key of this.cache.keys()) {
      if (needed.has(key)) continue;
      const parsed = this.parseKey(key);
      if (!parsed) continue;
      this.cache.delete(parsed[0], parsed[1]);
      this.resolved.delete(key);
      this.failed.delete(key);
    }

    // Nearest-first, so the player always gets ground underfoot before the
    // distant ring fills in.
    missing.sort((a, b) => a.distance - b.distance);
    for (const entry of missing) {
      const key = this.key(entry.cx, entry.cz);
      this.inFlight.add(key);
      this.failed.delete(key);
      void this.loadChunkAsync(entry.cx, entry.cz);
    }
  }

  private async loadChunkAsync(cx: number, cz: number): Promise<void> {
    const key = this.key(cx, cz);
    try {
      // Yield to the event loop so a full radius does not block a frame.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const chunk = this.terrainGenerator.generateChunk(cx, cz);
      // An empty chunk is still a successfully resolved chunk. Caching it is
      // what stops the streamer requesting the same void square every frame,
      // and what keeps the surrounding grid contiguous.
      this.cache.set(chunk as never);
      this.resolved.add(key);
    } catch (error) {
      // Record the failure instead of leaving the key stuck in flight; the
      // next update retries it rather than leaving a permanent hole.
      this.failed.add(key);
      console.error(`[ChunkLoader] Failed to generate chunk ${key}`, error);
    } finally {
      this.inFlight.delete(key);
    }
  }

  getStreamRadius(): number {
    return this.streamRadius;
  }

  setStreamRadius(radius: number): void {
    if (!Number.isFinite(radius)) return;
    this.streamRadius = Math.max(1, Math.min(24, Math.trunc(radius)));
  }

  /** Chunks still being generated. Zero means the visible radius is settled. */
  get pending(): number {
    return this.inFlight.size;
  }
}

export default ChunkLoader;

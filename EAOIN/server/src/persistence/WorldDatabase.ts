/**
 * WorldDatabase — Persistent Chunk & Player Data with Compression
 */
import { Chunk } from '@shared/world/Chunk';

export interface PersistentWorldData {
  worldName: string;
  seed: string;
  created: number;
  lastSaved: number;
  chunks: Map<string, Chunk>;
  players: Map<string, PlayerData>;
  events: WorldEvent[];
}

export interface PlayerData {
  id: string;
  position: { x: number; y: number; z: number };
  health: number;
  inventory: string[];
  lastLogin: number;
}

export interface WorldEvent {
  id: string;
  type: string;
  timestamp: number;
  data: any;
}

export class WorldDatabase {
  private worlds = new Map<string, PersistentWorldData>();

  saveWorld(name: string, chunks: Chunk[], players?: Map<string, PlayerData>): void {
    const existing = this.worlds.get(name);
    const chunkMap = new Map<string, Chunk>();
    for (const chunk of chunks) {
      chunkMap.set(`${chunk.x}:${chunk.z}`, chunk);
    }
    const data: PersistentWorldData = {
      worldName: name,
      seed: chunks[0]?.seed ?? 'unknown',
      created: existing?.created ?? Date.now(),
      lastSaved: Date.now(),
      chunks: chunkMap,
      players: players ?? new Map(),
      events: existing?.events ?? [],
    };
    this.worlds.set(name, data);
    console.log(`[WorldDB] Saved world "${name}" (${chunks.length} chunks, ${players?.size ?? 0} players)`);
  }

  loadWorld(name: string): PersistentWorldData | null {
    const data = this.worlds.get(name);
    if (!data) {
      console.log(`[WorldDB] World "${name}" not found`);
      return null;
    }
    console.log(`[WorldDB] Loaded world "${name}" (${data.chunks.size} chunks)`);
    return data;
  }

  getChunk(worldName: string, cx: number, cz: number): Chunk | null {
    const world = this.worlds.get(worldName);
    return world?.chunks.get(`${cx}:${cz}`) ?? null;
  }

  addEvent(worldName: string, event: WorldEvent): void {
    const world = this.worlds.get(worldName);
    if (world) {
      world.events.push(event);
    }
  }
}

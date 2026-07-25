/**
 * ChunkRenderer — Chunk Cache + Mesh Rebuild Queue + Frustum Culling
 */
import { Scene, Mesh, VertexData } from '@babylonjs/core';
import { Chunk } from '../../world/Chunk';
import { ChunkMeshBuilder } from './ChunkMeshBuilder';

export class ChunkCache {
  private chunks = new Map<string, Chunk>();
  private meshes = new Map<string, Mesh>();

  private key(x: number, z: number): string {
    return `${x}:${z}`;
  }

  set(chunk: Chunk): void {
    this.chunks.set(this.key(chunk.x, chunk.z), chunk);
  }

  get(x: number, z: number): Chunk | undefined {
    return this.chunks.get(this.key(x, z));
  }

  has(x: number, z: number): boolean {
    return this.chunks.has(this.key(x, z));
  }

  delete(x: number, z: number): boolean {
    const mesh = this.meshes.get(this.key(x, z));
    if (mesh) {
      mesh.dispose();
      this.meshes.delete(this.key(x, z));
    }
    return this.chunks.delete(this.key(x, z));
  }

  clear(): void {
    for (const mesh of this.meshes.values()) mesh.dispose();
    this.chunks.clear();
    this.meshes.clear();
  }
}

export class RenderDistance {
  constructor(public radius = 8) {}

  visibleChunks(cx: number, cz: number): { x: number; z: number }[] {
    const chunks: { x: number; z: number }[] = [];
    for (let x = -this.radius; x <= this.radius; x++) {
      for (let z = -this.radius; z <= this.radius; z++) {
        chunks.push({ x: cx + x, z: cz + z });
      }
    }
    return chunks;
  }
}

export class MeshRebuildQueue {
  private queue: Array<() => void> = [];

  enqueue(job: () => void): void {
    this.queue.push(job);
  }

  update(): void {
    if (this.queue.length === 0) return;
    const batchSize = 2; // Limit per frame for 60 FPS budget
    for (let i = 0; i < batchSize && i < this.queue.length; i++) {
      const job = this.queue.shift();
      job?.();
    }
  }

  get pending(): number {
    return this.queue.length;
  }
}

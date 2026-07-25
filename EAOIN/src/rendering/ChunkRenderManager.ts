/**
 * ChunkRenderManager — per-chunk voxel meshes for streaming and dirty rebuilds.
 *
 * Unlike the first visual bridge that rebuilt the whole visible world at once,
 * this manager owns chunk-local mesh groups. Gameplay edits can rebuild only the
 * touched chunk (plus border neighbours), and player movement streams chunks in
 * and out of the scene.
 */
import { Mesh, Scene, Vector3, VertexData } from '@babylonjs/core';
import { BlockID, getBlock } from '@shared/blocks/BlockRegistry';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from '../world/Chunk';
import { BlockMaterialMap } from './BlockMaterials';

export interface ChunkRenderStats {
  loadedChunks: number;
  meshCount: number;
  triangleCount: number;
  rebuildCount: number;
}

export interface StreamUpdateResult {
  loaded: number;
  unloaded: number;
}

interface MutableMeshData {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

interface FaceDefinition {
  normal: Vector3;
  vertices: ReadonlyArray<readonly [number, number, number]>;
}

const FACE_DEFINITIONS: FaceDefinition[] = [
  { normal: new Vector3(0, 1, 0), vertices: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] },
  { normal: new Vector3(0, -1, 0), vertices: [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]] },
  { normal: new Vector3(1, 0, 0), vertices: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]] },
  { normal: new Vector3(-1, 0, 0), vertices: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]] },
  { normal: new Vector3(0, 0, 1), vertices: [[1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1]] },
  { normal: new Vector3(0, 0, -1), vertices: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] },
];

const FACE_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const NEIGHBOR_CHUNKS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class ChunkRenderManager {
  private readonly chunks = new Map<string, Chunk>();
  private readonly meshes = new Map<string, Mesh[]>();
  private readonly triangles = new Map<string, number>();
  private rebuildCount = 0;

  constructor(private readonly scene: Scene, private readonly materials: BlockMaterialMap) {}

  updateVisibleChunks(
    centerChunkX: number,
    centerChunkZ: number,
    radius: number,
    generateChunk: (cx: number, cz: number) => Chunk
  ): StreamUpdateResult {
    const needed = new Set<string>();
    for (let cx = centerChunkX - radius; cx <= centerChunkX + radius; cx += 1) {
      for (let cz = centerChunkZ - radius; cz <= centerChunkZ + radius; cz += 1) {
        needed.add(this.key(cx, cz));
      }
    }

    let unloaded = 0;
    for (const key of Array.from(this.chunks.keys())) {
      if (!needed.has(key)) {
        const [cx, cz] = this.parseKey(key);
        this.disposeChunk(cx, cz);
        unloaded += 1;
        this.rebuildChunkNeighbors(cx, cz);
      }
    }

    let loaded = 0;
    for (const key of needed) {
      if (!this.chunks.has(key)) {
        const [cx, cz] = this.parseKey(key);
        const chunk = generateChunk(cx, cz);
        this.chunks.set(key, chunk);
        this.rebuildChunk(cx, cz);
        this.rebuildChunkNeighbors(cx, cz);
        loaded += 1;
      }
    }

    return { loaded, unloaded };
  }

  rebuildForWorldBlock(worldX: number, worldZ: number): void {
    const address = this.toChunkAddress(worldX, worldZ);
    this.rebuildChunk(address.cx, address.cz);

    if (address.lx === 0) this.rebuildChunk(address.cx - 1, address.cz);
    if (address.lx === CHUNK_SIZE - 1) this.rebuildChunk(address.cx + 1, address.cz);
    if (address.lz === 0) this.rebuildChunk(address.cx, address.cz - 1);
    if (address.lz === CHUNK_SIZE - 1) this.rebuildChunk(address.cx, address.cz + 1);
  }

  getStats(): ChunkRenderStats {
    let meshCount = 0;
    let triangleCount = 0;
    for (const chunkMeshes of this.meshes.values()) meshCount += chunkMeshes.length;
    for (const count of this.triangles.values()) triangleCount += count;
    return {
      loadedChunks: this.chunks.size,
      meshCount,
      triangleCount,
      rebuildCount: this.rebuildCount,
    };
  }

  dispose(): void {
    for (const key of Array.from(this.meshes.keys())) this.disposeChunkMeshes(key);
    this.chunks.clear();
    this.triangles.clear();
  }

  private rebuildChunkNeighbors(cx: number, cz: number): void {
    for (const [dx, dz] of NEIGHBOR_CHUNKS) {
      if (dx === 0 && dz === 0) continue;
      this.rebuildChunk(cx + dx, cz + dz);
    }
  }

  private rebuildChunk(cx: number, cz: number): void {
    const key = this.key(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    this.disposeChunkMeshes(key);
    const groups = new Map<BlockID, MutableMeshData>();
    this.appendChunkFaces(chunk, groups);

    const chunkMeshes: Mesh[] = [];
    let triangleCount = 0;
    for (const [blockId, data] of groups) {
      if (data.positions.length === 0) continue;

      const blockName = getBlock(blockId).name.toLowerCase().replace(/\s+/g, '_');
      const mesh = new Mesh(`voxel_world_chunk_${cx}_${cz}_${blockName}`, this.scene);
      const vertexData = new VertexData();
      vertexData.positions = data.positions;
      vertexData.normals = data.normals;
      vertexData.uvs = data.uvs;
      vertexData.indices = data.indices;
      vertexData.applyToMesh(mesh, true);

      const block = getBlock(blockId);
      mesh.material = this.materials.get(blockId) ?? null;
      mesh.checkCollisions = block.solid;
      mesh.isPickable = true;
      mesh.receiveShadows = true;
      mesh.freezeWorldMatrix();
      chunkMeshes.push(mesh);
      triangleCount += data.indices.length / 3;
    }

    this.meshes.set(key, chunkMeshes);
    this.triangles.set(key, triangleCount);
    this.rebuildCount += 1;
  }

  private disposeChunk(cx: number, cz: number): void {
    const key = this.key(cx, cz);
    this.disposeChunkMeshes(key);
    this.chunks.delete(key);
  }

  private disposeChunkMeshes(key: string): void {
    const existing = this.meshes.get(key);
    if (existing) {
      for (const mesh of existing) mesh.dispose();
    }
    this.meshes.delete(key);
    this.triangles.delete(key);
  }

  private appendChunkFaces(chunk: Chunk, groups: Map<BlockID, MutableMeshData>): void {
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
        for (let z = 0; z < CHUNK_SIZE; z += 1) {
          const blockId = chunk.getBlock(x, y, z);
          if (blockId === 0) continue;

          const worldX = chunk.x * CHUNK_SIZE + x;
          const worldZ = chunk.z * CHUNK_SIZE + z;
          for (let faceIndex = 0; faceIndex < FACE_DEFINITIONS.length; faceIndex += 1) {
            const [dx, dy, dz] = FACE_OFFSETS[faceIndex];
            if (this.shouldDrawFace(blockId, worldX + dx, y + dy, worldZ + dz)) {
              this.appendFace(this.dataFor(groups, blockId), worldX, y, worldZ, FACE_DEFINITIONS[faceIndex]);
            }
          }
        }
      }
    }
  }

  private shouldDrawFace(blockId: BlockID, neighborWorldX: number, neighborY: number, neighborWorldZ: number): boolean {
    if (neighborY < 0 || neighborY >= CHUNK_HEIGHT) return true;

    const neighborId = this.getLoadedBlockAt(neighborWorldX, neighborY, neighborWorldZ);
    if (neighborId === 0) return true;
    if (neighborId === blockId) return false;

    const current = getBlock(blockId);
    const neighbor = getBlock(neighborId);
    return current.transparent || neighbor.transparent;
  }

  private getLoadedBlockAt(worldX: number, y: number, worldZ: number): BlockID {
    const address = this.toChunkAddress(worldX, worldZ);
    return this.chunks.get(this.key(address.cx, address.cz))?.getBlock(address.lx, y, address.lz) ?? 0;
  }

  private appendFace(data: MutableMeshData, x: number, y: number, z: number, face: FaceDefinition): void {
    const baseIndex = data.positions.length / 3;
    for (const vertex of face.vertices) {
      data.positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);
      data.normals.push(face.normal.x, face.normal.y, face.normal.z);
    }
    data.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    data.indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
  }

  private dataFor(groups: Map<BlockID, MutableMeshData>, blockId: BlockID): MutableMeshData {
    const existing = groups.get(blockId);
    if (existing) return existing;
    const data: MutableMeshData = { positions: [], normals: [], uvs: [], indices: [] };
    groups.set(blockId, data);
    return data;
  }

  private toChunkAddress(worldX: number, worldZ: number): { cx: number; cz: number; lx: number; lz: number } {
    const x = Math.floor(worldX);
    const z = Math.floor(worldZ);
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return {
      cx,
      cz,
      lx: x - cx * CHUNK_SIZE,
      lz: z - cz * CHUNK_SIZE,
    };
  }

  private key(cx: number, cz: number): string {
    return `${cx}:${cz}`;
  }

  private parseKey(key: string): [number, number] {
    const [cx, cz] = key.split(':').map(Number);
    return [cx, cz];
  }
}

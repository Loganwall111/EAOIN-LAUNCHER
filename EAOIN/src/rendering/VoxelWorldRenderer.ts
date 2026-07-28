/**
 * VoxelWorldRenderer — converts generated chunks into visible, collidable Babylon meshes.
 *
 * The existing architecture already owns chunk/block logic; this renderer is the
 * missing runtime bridge that turns that data into physical terrain.
 */
import { Mesh, Scene, Vector3, VertexData, StandardMaterial } from '@babylonjs/core';
import { BlockID, getBlock } from '@shared/blocks/BlockRegistry';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from '../world/Chunk';
import { BlockMaterialMap, createMissingBlockMaterial } from './BlockMaterials';

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
  // +Y top
  {
    normal: new Vector3(0, 1, 0),
    vertices: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]],
  },
  // -Y bottom
  {
    normal: new Vector3(0, -1, 0),
    vertices: [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]],
  },
  // +X east
  {
    normal: new Vector3(1, 0, 0),
    vertices: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]],
  },
  // -X west
  {
    normal: new Vector3(-1, 0, 0),
    vertices: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]],
  },
  // +Z south
  {
    normal: new Vector3(0, 0, 1),
    vertices: [[1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1]],
  },
  // -Z north
  {
    normal: new Vector3(0, 0, -1),
    vertices: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
  },
];

const FACE_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export class VoxelWorldRenderer {
  private readonly chunkMap = new Map<string, Chunk>();

  render(scene: Scene, chunks: Chunk[], materials: BlockMaterialMap): Mesh[] {
    this.chunkMap.clear();
    for (const chunk of chunks) {
      this.chunkMap.set(this.key(chunk.x, chunk.z), chunk);
    }

    const groups = new Map<BlockID, MutableMeshData>();
    for (const chunk of chunks) {
      this.appendChunkFaces(chunk, groups);
    }

    const meshes: Mesh[] = [];
    for (const [blockId, data] of groups) {
      if (data.positions.length === 0) continue;

      const mesh = new Mesh(`voxel_world_${getBlock(blockId).name.toLowerCase().replace(/\s+/g, '_')}`, scene);
      const vertexData = new VertexData();
      vertexData.positions = data.positions;
      vertexData.normals = data.normals;
      vertexData.uvs = data.uvs;
      vertexData.indices = data.indices;
      vertexData.applyToMesh(mesh, true);

      const block = getBlock(blockId);
      let mat = materials.get(blockId);
      if (!mat) {
        // Prevent Babylon red/black checkerboard — use a highly visible magenta fallback
        mat = createMissingBlockMaterial(scene);
      }
      mesh.material = mat;
      mesh.checkCollisions = block.solid;
      mesh.isPickable = true;
      mesh.receiveShadows = true;
      mesh.freezeWorldMatrix();
      meshes.push(mesh);
    }

    return meshes;
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

    const neighborId = this.getBlockAt(neighborWorldX, neighborY, neighborWorldZ);
    if (neighborId === 0) return true;
    if (neighborId === blockId) return false;

    const current = getBlock(blockId);
    const neighbor = getBlock(neighborId);
    return current.transparent || neighbor.transparent;
  }

  private getBlockAt(worldX: number, y: number, worldZ: number): BlockID {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cz = Math.floor(worldZ / CHUNK_SIZE);
    const localX = worldX - cx * CHUNK_SIZE;
    const localZ = worldZ - cz * CHUNK_SIZE;
    return this.chunkMap.get(this.key(cx, cz))?.getBlock(localX, y, localZ) ?? 0;
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

  private key(cx: number, cz: number): string {
    return `${cx}:${cz}`;
  }
}

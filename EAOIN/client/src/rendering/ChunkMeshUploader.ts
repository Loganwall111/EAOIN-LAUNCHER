import { Scene, Mesh, VertexData } from '@babylonjs/core';
import { ChunkMeshBuilder, MeshData } from './ChunkMeshBuilder';

export class ChunkMeshUploader {
  private builder = new ChunkMeshBuilder();
  private meshCache = new Map<string, Mesh>();

  uploadChunk(scene: Scene, chunk: any, cx: number, cz: number): Mesh {
    const key = `${cx}:${cz}`;
    const existing = this.meshCache.get(key);
    if (existing) {
      existing.dispose();
    }

    const meshData: MeshData = this.builder.build(chunk);
    if (meshData.vertices.length === 0) {
      // Empty mesh — create invisible placeholder for streaming
      const mesh = Mesh.CreateBox(key, 0, scene, true);
      mesh.isVisible = false;
      this.meshCache.set(key, mesh);
      return mesh;
    }

    const mesh = new Mesh(key, scene);
    const vertexData = new VertexData();
    vertexData.positions = Array.from(meshData.vertices);
    vertexData.normals = Array.from(meshData.normals);
    vertexData.indices = Array.from(meshData.indices);
    vertexData.uvs = Array.from(meshData.uvs);
    vertexData.applyToMesh(mesh, true);
    mesh.isPickable = true;
    mesh.checkCollisions = true;
    this.meshCache.set(key, mesh);
    return mesh;
  }

  disposeChunk(cx: number, cz: number): void {
    const mesh = this.meshCache.get(`${cx}:${cz}`);
    if (mesh) {
      mesh.dispose();
      this.meshCache.delete(`${cx}:${cz}`);
    }
  }
}

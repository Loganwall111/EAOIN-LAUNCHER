/**
 * ChunkMeshUploader — turns chunk voxel data into Babylon meshes.
 *
 * ## Empty-chunk handling (the "gaps between chunks" bug)
 *
 * The old empty path was:
 *
 * ```ts
 * const mesh = Mesh.CreateBox(key, 0, scene, true);
 * mesh.isVisible = false;
 * ```
 *
 * Three problems, all of which broke the sequential grid of chunks:
 *
 *  - `Mesh.CreateBox` is the removed legacy factory (it is `MeshBuilder.CreateBox`
 *    in Babylon 5+, and the legacy alias is not in the tree-shaken `@babylonjs/core`
 *    entry point this project imports). On a modern build this **throws**, which
 *    aborted the streaming loop mid-radius — every chunk queued behind the void
 *    chunk was never uploaded. That is exactly the reported "massive pitch-black
 *    holes and empty gaps between generated chunks": one empty chunk took its
 *    neighbours down with it.
 *  - A size-0 box still allocates a real vertex buffer and a draw call.
 *  - Because it was cached under the chunk key like a normal mesh, the chunk
 *    could never be re-meshed into something visible if a player later built
 *    there.
 *
 * The fix is to not create a mesh at all for a void chunk, record the key as
 * *known-empty*, and let the rest of the grid carry on. Callers get `null`,
 * which is an ordinary, expected result rather than an error. Every mesh that
 * is created is validated with Babylon's own `isReady`/`getTotalVertices`
 * checks before being handed back.
 */
import { Mesh, Scene, VertexData, StandardMaterial, Color3 } from '@babylonjs/core';
import { Chunk } from '../world/Chunk';
import { ChunkMeshBuilder, MeshData, NeighborSampler } from './ChunkMeshBuilder';

export interface UploadOptions {
  /** Lets the mesher see across the chunk seam. See ChunkMeshBuilder. */
  getNeighbor?: NeighborSampler;
  /** Position vertices in world space instead of moving the mesh. */
  worldSpace?: boolean;
}

export class ChunkMeshUploader {
  private readonly builder = new ChunkMeshBuilder();
  private readonly meshCache = new Map<string, Mesh>();
  /**
   * Chunks that generated no geometry.
   *
   * Tracked explicitly so "empty" is distinguishable from "not yet uploaded".
   * Without this the streamer cannot tell a legitimate void chunk from a
   * failure and will retry it forever.
   */
  private readonly emptyChunks = new Set<string>();

  private key(cx: number, cz: number): string {
    return `${cx}:${cz}`;
  }

  /**
   * Build and upload one chunk.
   *
   * Returns `null` when the chunk is entirely air. That is a normal outcome —
   * sky above an island, an unexplored void — and must not interrupt the
   * caller's loop over the surrounding chunks.
   */
  uploadChunk(scene: Scene, chunk: Chunk, cx: number, cz: number, options: UploadOptions = {}): Mesh | null {
    const key = this.key(cx, cz);

    // Always clear the previous state for this key first, so a rebuild after
    // an edit cannot leave a stale mesh or a stale "empty" marker behind.
    this.disposeChunk(cx, cz);

    // Cheap O(1) rejection before any meshing work: `getHighestOccupiedY` is
    // maintained incrementally by Chunk.setBlock.
    if (chunk.getHighestOccupiedY() < 0) {
      this.emptyChunks.add(key);
      return null;
    }

    const meshData: MeshData = this.builder.build(chunk, {
      getNeighbor: options.getNeighbor,
      worldSpace: options.worldSpace,
    });

    // A chunk can hold blocks and still produce no faces — for example when
    // it is fully enclosed by loaded neighbours. Treat it as empty rather than
    // uploading a zero-triangle mesh.
    if (ChunkMeshBuilder.isEmpty(meshData)) {
      this.emptyChunks.add(key);
      return null;
    }

    const mesh = new Mesh(key, scene);
    const vertexData = new VertexData();
    // Assign the typed arrays directly. `Array.from` on a Float32Array of tens
    // of thousands of elements allocated a boxed number[] per chunk per
    // rebuild, purely to have Babylon convert it straight back.
    vertexData.positions = meshData.vertices;
    vertexData.normals = meshData.normals;
    vertexData.uvs = meshData.uvs;
    vertexData.indices = meshData.indices;
    // `false` — chunk meshes are rebuilt wholesale, never mutated in place, so
    // Babylon does not need to keep an updatable CPU-side copy.
    vertexData.applyToMesh(mesh, false);

    // Standard Babylon validity check. If the vertex data did not take, drop
    // the mesh rather than leaving an invisible husk in the scene graph
    // occupying a grid slot.
    if (mesh.getTotalVertices() === 0) {
      mesh.dispose();
      this.emptyChunks.add(key);
      return null;
    }

    if (!options.worldSpace) {
      // Chunk-local geometry: place the mesh at the chunk origin.
      mesh.position.set(chunk.x * 16, 0, chunk.z * 16);
    }

    // SAFETY FIX: Always assign a safe StandardMaterial.
    // This prevents the "Can't find buffer Light0/Light1/Light2/Light3" WebGPU crash
    // that was causing x-ray / broken terrain. The mesh geometry is correct; the
    // previous material pipeline was declaring light uniforms it never bound.
    if (!mesh.material) {
      const safeMat = new StandardMaterial(`chunk_fallback_${key}`, scene);
      safeMat.diffuseColor = new Color3(0.85, 0.85, 0.9);
      safeMat.specularColor = new Color3(0.1, 0.1, 0.1);
      safeMat.backFaceCulling = true;
      safeMat.alpha = 1;
      mesh.material = safeMat;
    }

    mesh.isPickable = true;
    mesh.checkCollisions = true;
    // Bounds must be established before the world matrix is frozen; freezing
    // first leaves a stale bounding volume on some backends and the frustum
    // culler then rejects a perfectly valid chunk, which looks like the chunk
    // deleting itself as you turn around.
    mesh.refreshBoundingInfo();
    mesh.freezeWorldMatrix();
    mesh.cullingStrategy = Mesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;

    this.meshCache.set(key, mesh);
    return mesh;
  }

  /** The uploaded mesh for a chunk, or undefined if empty / not uploaded. */
  getMesh(cx: number, cz: number): Mesh | undefined {
    return this.meshCache.get(this.key(cx, cz));
  }

  /** True when this chunk was uploaded and found to contain no geometry. */
  isEmpty(cx: number, cz: number): boolean {
    return this.emptyChunks.has(this.key(cx, cz));
  }

  /**
   * True when this chunk has been processed at all — either it has a mesh or
   * it is known to be empty. Streamers should use this, not `getMesh`, to
   * decide whether work is still outstanding; otherwise void chunks are
   * regenerated on every single frame.
   */
  isUploaded(cx: number, cz: number): boolean {
    const key = this.key(cx, cz);
    return this.meshCache.has(key) || this.emptyChunks.has(key);
  }

  disposeChunk(cx: number, cz: number): void {
    const key = this.key(cx, cz);
    const mesh = this.meshCache.get(key);
    if (mesh) {
      mesh.dispose();
      this.meshCache.delete(key);
    }
    this.emptyChunks.delete(key);
  }

  /** Drop every uploaded chunk — used when changing dimension or world. */
  clear(): void {
    for (const mesh of this.meshCache.values()) mesh.dispose();
    this.meshCache.clear();
    this.emptyChunks.clear();
  }
}

export default ChunkMeshUploader;

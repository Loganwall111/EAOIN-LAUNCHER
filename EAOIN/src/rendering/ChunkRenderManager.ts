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
import { BlockMaterialMap, materialForSurface } from './BlockMaterials';
import { faceVariantFor } from './BlockTextureSource';
import { decodeSurfaceKey, encodeSurfaceKey, greedyMesh, SurfaceKey } from './GreedyMesher';

export interface ChunkRenderStats {
  loadedChunks: number;
  meshCount: number;
  triangleCount: number;
  rebuildCount: number;
  /**
   * Triangles the naive one-quad-per-face mesher would have produced. The gap
   * between this and `triangleCount` is what greedy meshing saved.
   */
  naiveTriangleCount: number;
  /** 0-1 fraction of triangles eliminated by face merging. */
  meshingSavings: number;
}

export interface StreamUpdateResult {
  loaded: number;
  unloaded: number;
  /** Chunks still queued because the per-call budget was reached. */
  pending: number;
}

export interface StreamUpdateOptions {
  /**
   * Maximum number of chunks to generate + mesh in this call. Streaming the
   * whole render radius in one synchronous burst froze the canvas on a black
   * screen for minutes, so callers spread the work over several frames.
   */
  budget?: number;
  /**
   * Maximum wall-clock milliseconds to spend generating + meshing.
   *
   * A fixed chunk count is the wrong unit: chunk cost varies by an order of
   * magnitude between a flat plain and a mountain riddled with caverns, so
   * "2 chunks" was comfortably under budget in one place and a 40ms frame
   * spike in another. Stopping on elapsed time keeps the frame rate steady
   * and simply streams a little slower where the terrain is expensive.
   */
  timeBudgetMs?: number;
}

interface MutableMeshData {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  /** Baked ambient-occlusion vertex colours; empty when AO is disabled. */
  colors: number[];
}

interface FaceDefinition {
  normal: Vector3;
  vertices: ReadonlyArray<readonly [number, number, number]>;
}

const FACE_DEFINITIONS: FaceDefinition[] = [
  // Vertex order is counter-clockwise when viewed from outside. The geometric
  // cross product therefore agrees with the declared normal on all six faces.
  { normal: new Vector3(0, 1, 0), vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { normal: new Vector3(0, -1, 0), vertices: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: new Vector3(1, 0, 0), vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { normal: new Vector3(-1, 0, 0), vertices: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { normal: new Vector3(0, 0, 1), vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { normal: new Vector3(0, 0, -1), vertices: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

const FACE_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/**
 * Single visibility rule used by both meshers.
 *
 * - Air (including an unloaded chunk boundary) exposes the current face.
 * - A solid neighbour owns the shared boundary, so no internal face is emitted.
 * - Non-solid media only expose a boundary when the media differ.
 *
 * The asymmetry at a solid/non-solid boundary is deliberate: the solid block
 * emits its opaque wall and the fluid/plant side does not emit a coplanar face.
 */
export function shouldRenderVoxelFace(blockId: BlockID, neighborId: BlockID): boolean {
  if (blockId === 0) return false;
  if (neighborId === 0) return true;
  if (getBlock(neighborId).solid) return false;
  return blockId !== neighborId;
}

/** Monotonic clock, falling back to Date.now in non-browser test environments. */
const now = (): number =>
  (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now();

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
  private readonly naiveTriangles = new Map<string, number>();
  private rebuildCount = 0;
  /** Greedy face merging. Kept switchable so the old path stays testable. */
  private greedyEnabled = true;
  /**
   * Baked AO is optional. It samples twelve neighbouring voxels per face and
   * prevents otherwise identical faces with different corner shades merging.
   * The balanced runtime uses the much cheaper lighting fill by default.
   */
  private ambientOcclusionEnabled = false;
  private lastBuildNaiveTriangles = 0;
  private onMeshCreated: ((mesh: Mesh) => void) | null = null;
  private onMeshDisposed: ((mesh: Mesh) => void) | null = null;

  constructor(private readonly scene: Scene, private readonly materials: BlockMaterialMap) {}

  /**
   * Hooks used by the lighting rig to maintain the shadow-caster list without
   * rescanning every mesh in the scene after each streamed chunk.
   */
  setMeshLifecycleHandlers(
    onCreated: ((mesh: Mesh) => void) | null,
    onDisposed: ((mesh: Mesh) => void) | null = null
  ): void {
    this.onMeshCreated = onCreated;
    this.onMeshDisposed = onDisposed;
  }

  /** Visit the currently live terrain meshes (used once when lighting starts). */
  forEachMesh(visit: (mesh: Mesh) => void): void {
    for (const chunkMeshes of this.meshes.values()) {
      for (const mesh of chunkMeshes) visit(mesh);
    }
  }

  /** Toggle greedy meshing. Disabling forces the naive one-quad-per-face path. */
  setGreedyMeshing(enabled: boolean): void {
    this.greedyEnabled = enabled;
  }

  /**
   * Toggle baked per-vertex ambient occlusion.
   *
   * AO is baked at mesh time, so changing this only affects chunks meshed
   * afterwards; the engine calls `clearAll()` when the player flips the
   * setting so the visible world rebuilds.
   */
  setAmbientOcclusion(enabled: boolean): void {
    this.ambientOcclusionEnabled = enabled;
  }

  /**
   * Drop every loaded chunk and its meshes.
   *
   * Used when travelling between dimensions: the Aether and the Backrooms
   * generate completely different geometry, so the overworld chunks must go
   * rather than being blended with the destination.
   */
  clearAll(): void {
    for (const key of Array.from(this.meshes.keys())) this.disposeChunkMeshes(key);
    this.chunks.clear();
    this.triangles.clear();
    this.naiveTriangles.clear();
  }

  updateVisibleChunks(
    centerChunkX: number,
    centerChunkZ: number,
    radius: number,
    generateChunk: (cx: number, cz: number) => Chunk,
    options: StreamUpdateOptions = {}
  ): StreamUpdateResult {
    const budget = options.budget ?? Number.POSITIVE_INFINITY;

    // Build the needed set, nearest-first so the player always gets ground
    // under their feet before the distant ring is filled in.
    const needed = new Set<string>();
    const missing: Array<{ cx: number; cz: number; distance: number }> = [];
    for (let cx = centerChunkX - radius; cx <= centerChunkX + radius; cx += 1) {
      for (let cz = centerChunkZ - radius; cz <= centerChunkZ + radius; cz += 1) {
        const key = this.key(cx, cz);
        needed.add(key);
        if (!this.chunks.has(key)) {
          const dx = cx - centerChunkX;
          const dz = cz - centerChunkZ;
          missing.push({ cx, cz, distance: dx * dx + dz * dz });
        }
      }
    }
    missing.sort((a, b) => a.distance - b.distance);

    // Rebuilds are collected into a dirty set and flushed once. Previously each
    // loaded chunk immediately re-meshed its four neighbours, so a full radius
    // load re-meshed most chunks five times over.
    const dirty = new Set<string>();

    let unloaded = 0;
    for (const key of Array.from(this.chunks.keys())) {
      if (!needed.has(key)) {
        const [cx, cz] = this.parseKey(key);
        this.disposeChunk(cx, cz);
        unloaded += 1;
        this.markNeighborsDirty(dirty, cx, cz);
      }
    }

    let loaded = 0;
    const timeBudgetMs = options.timeBudgetMs ?? Number.POSITIVE_INFINITY;
    const startedAt = Number.isFinite(timeBudgetMs) ? now() : 0;
    for (const entry of missing) {
      if (loaded >= budget) break;
      // Always allow the first chunk through, so progress is guaranteed even
      // if a single chunk exceeds the whole budget.
      if (loaded > 0 && Number.isFinite(timeBudgetMs) && now() - startedAt >= timeBudgetMs) break;
      const chunk = generateChunk(entry.cx, entry.cz);
      this.chunks.set(this.key(entry.cx, entry.cz), chunk);
      dirty.add(this.key(entry.cx, entry.cz));
      this.markNeighborsDirty(dirty, entry.cx, entry.cz);
      loaded += 1;
    }

    // Pick up chunks the *generator* invalidated behind our back.
    //
    // A cross-chunk decoration write (`AdvancedTerrainGenerator.spillBlock` —
    // a tree canopy or ruin that overhangs into an already-built neighbour)
    // edits a chunk that may already be meshed, and flags it with
    // `chunk.meshDirty = true`. Nothing consumed that flag, so the voxels
    // existed in the array but their geometry was never uploaded: the
    // decoration was simply invisible, and any face it should have hidden
    // stayed exposed. Measured while streaming a forest at radius 3, two of
    // 49 chunks finished dirty with 12 faces missing from the GPU.
    //
    // Scanning the live set is O(loaded chunks) against per-chunk meshing, so
    // it is cheap next to the rebuilds it schedules.
    for (const [key, chunk] of this.chunks) {
      if (chunk.meshDirty) dirty.add(key);
    }

    for (const key of dirty) {
      const [cx, cz] = this.parseKey(key);
      this.rebuildChunk(cx, cz);
    }

    return { loaded, unloaded, pending: Math.max(0, missing.length - loaded) };
  }

  /**
   * True when every chunk in a radius is already represented by a live mesh.
   *
   * This deliberately ignores surplus chunks. The runtime keeps a one-chunk
   * prefetch ring beyond the player-facing render distance: after crossing a
   * chunk boundary, that ring is still valid visible terrain while the next
   * outer ring is generated. Treating those harmless preloaded chunks as a
   * miss would make callers believe there was a hole and defeat the buffer.
   */
  hasChunksInRadius(centerChunkX: number, centerChunkZ: number, radius: number): boolean {
    for (let cx = centerChunkX - radius; cx <= centerChunkX + radius; cx += 1) {
      for (let cz = centerChunkZ - radius; cz <= centerChunkZ + radius; cz += 1) {
        if (!this.chunks.has(this.key(cx, cz))) return false;
      }
    }
    return true;
  }

  /** True when the render radius around this center is not the exact live set. */
  hasPendingChunks(centerChunkX: number, centerChunkZ: number, radius: number): boolean {
    const expected = (radius * 2 + 1) ** 2;
    // Also catch surplus chunks after adaptive performance lowers the radius.
    // The old check only looked for missing chunks, so a downgrade changed the
    // HUD number but never disposed any of the expensive outer meshes.
    return this.chunks.size !== expected
      || !this.hasChunksInRadius(centerChunkX, centerChunkZ, radius);
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
    let naiveTriangleCount = 0;
    for (const chunkMeshes of this.meshes.values()) meshCount += chunkMeshes.length;
    for (const count of this.triangles.values()) triangleCount += count;
    for (const count of this.naiveTriangles.values()) naiveTriangleCount += count;
    return {
      loadedChunks: this.chunks.size,
      meshCount,
      triangleCount,
      rebuildCount: this.rebuildCount,
      naiveTriangleCount,
      meshingSavings: naiveTriangleCount > 0 ? 1 - triangleCount / naiveTriangleCount : 0,
    };
  }

  dispose(): void {
    for (const key of Array.from(this.meshes.keys())) this.disposeChunkMeshes(key);
    this.chunks.clear();
    this.triangles.clear();
    this.naiveTriangles.clear();
  }

  private markNeighborsDirty(dirty: Set<string>, cx: number, cz: number): void {
    for (const [dx, dz] of NEIGHBOR_CHUNKS) {
      if (dx === 0 && dz === 0) continue;
      const key = this.key(cx + dx, cz + dz);
      if (this.chunks.has(key)) dirty.add(key);
    }
  }

  private rebuildChunk(cx: number, cz: number): void {
    const key = this.key(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    // The chunk's voxels are about to be turned into geometry, so anything
    // that dirtied it is now accounted for. Clearing the flag here — rather
    // than at the call sites — keeps it correct for every path that rebuilds
    // (streaming, block edits, dimension changes), and stops the sweep in
    // `updateVisibleChunks` from re-meshing the same chunk on every frame.
    chunk.meshDirty = false;

    this.disposeChunkMeshes(key);

    const groups = this.greedyEnabled
      ? this.buildGreedyGroups(chunk)
      : this.buildNaiveGroups(chunk);
    const naiveTriangleCount = this.lastBuildNaiveTriangles;

    const chunkMeshes: Mesh[] = [];
    let triangleCount = 0;
    for (const [surfaceKey, data] of groups) {
      if (data.positions.length === 0) continue;

      const { blockId, variant } = decodeSurfaceKey(surfaceKey);
      const block = getBlock(blockId);
      const blockName = block.name.toLowerCase().replace(/\s+/g, '_');
      const mesh = new Mesh(`voxel_world_chunk_${cx}_${cz}_${blockName}_${variant}`, this.scene);
      const vertexData = new VertexData();
      // Typed arrays avoid Babylon re-boxing these multi-thousand-element
      // number[]s on every chunk rebuild, which was a real allocation spike
      // while streaming.
      vertexData.positions = new Float32Array(data.positions);
      vertexData.normals = new Float32Array(data.normals);
      vertexData.uvs = new Float32Array(data.uvs);
      vertexData.indices = data.positions.length / 3 > 65535
        ? new Uint32Array(data.indices)
        : new Uint16Array(data.indices);
      const hasAo = data.colors.length > 0;
      if (hasAo) vertexData.colors = new Float32Array(data.colors);
      // `false` = do not keep a CPU-side copy updatable; chunk meshes are
      // rebuilt wholesale rather than mutated in place.
      vertexData.applyToMesh(mesh, false);

      mesh.useVertexColors = hasAo;
      mesh.material = materialForSurface(this.materials, surfaceKey);
      mesh.checkCollisions = block.solid;
      mesh.isPickable = true;
      // Only opaque terrain receives shadows; transparent water/glass
      // receiving them caused dark banding across lakes.
      mesh.receiveShadows = !block.transparent;
      // Terrain is the shadow caster set; registering happens in the engine.
      mesh.metadata = { voxelChunk: true, blockId };

      // --- per-mesh render cost controls ---------------------------------
      // Establish bounds *before* freezing the world matrix. Calling these in
      // the opposite order leaves a few Babylon backends with a frozen,
      // stale bounding volume, so angle-dependent frustum culling can reject
      // a perfectly valid terrain mesh. That looks exactly like a chunk
      // deleting itself when the player looks down or turns around.
      mesh.refreshBoundingInfo();
      // Chunk geometry never moves, so Babylon can skip its world-matrix and
      // bounding-box recomputation every frame after that initial bound pass.
      mesh.freezeWorldMatrix();
      mesh.cullingStrategy = Mesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
      // Static geometry: let Babylon skip per-frame vertex-buffer rebinding.
      mesh.alwaysSelectAsActiveMesh = false;
      // Materials are shared per surface key and never change after bake, so
      // the engine can cache the effect instead of re-evaluating it per frame.
      mesh.material?.freeze();

      chunkMeshes.push(mesh);
      this.onMeshCreated?.(mesh);
      triangleCount += data.indices.length / 3;
    }

    this.meshes.set(key, chunkMeshes);
    this.triangles.set(key, triangleCount);
    // Collected inside the mesher's existing visibility sweep. The previous
    // implementation scanned all 32,768 voxels a second time only for a HUD
    // statistic, nearly doubling rebuild work while chunks streamed.
    this.naiveTriangles.set(key, naiveTriangleCount);
    this.rebuildCount += 1;
  }

  /** Merged-quad geometry. Same visual result, far fewer triangles. */
  private buildGreedyGroups(chunk: Chunk): Map<SurfaceKey, MutableMeshData> {
    const originX = chunk.x * CHUNK_SIZE;
    const originZ = chunk.z * CHUNK_SIZE;
    const sizeY = chunk.getHighestOccupiedY() + 1;
    const stats = { visibleFaces: 0, mergedQuads: 0 };
    if (sizeY <= 0) {
      this.lastBuildNaiveTriangles = 0;
      return new Map();
    }

    const groups = greedyMesh({
      sizeX: CHUNK_SIZE,
      // Most overworld chunks end around y=30-60. Sweeping all 128 layers in
      // all six directions wasted the majority of meshing time on known air.
      sizeY,
      sizeZ: CHUNK_SIZE,
      stats,
      offsetX: originX,
      offsetZ: originZ,
      ambientOcclusion: this.ambientOcclusionEnabled,
      getBlock: (x, y, z) => chunk.getBlock(x, y, z),
      // Neighbour lookups must cross the chunk seam, otherwise every chunk
      // border would be walled off with faces the player can see through.
      getNeighbor: (x, y, z) => {
        if (y < 0 || y >= CHUNK_HEIGHT) return 0;
        if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) return chunk.getBlock(x, y, z);
        return this.getLoadedBlockAt(originX + x, y, originZ + z);
      },
      isFaceVisible: shouldRenderVoxelFace,
      // Grass/log get distinct top and bottom materials; everything else
      // stays a single group so we do not multiply draw calls.
      faceVariantOf: (blockId, direction) => faceVariantFor(blockId, direction),
      // Transparent blocks must not cast ambient occlusion, or a leaf canopy
      // shadows itself into the unreadable black the player reported.
      isOccluder: (blockId) => blockId !== 0 && !getBlock(blockId).transparent,
    }) as Map<SurfaceKey, MutableMeshData>;
    this.lastBuildNaiveTriangles = stats.visibleFaces * 2;
    return groups;
  }

  /** The original one-quad-per-face path, kept for comparison and fallback. */
  private buildNaiveGroups(chunk: Chunk): Map<SurfaceKey, MutableMeshData> {
    const groups = new Map<SurfaceKey, MutableMeshData>();
    this.appendChunkFaces(chunk, groups);
    let triangles = 0;
    for (const data of groups.values()) triangles += data.indices.length / 3;
    this.lastBuildNaiveTriangles = triangles;
    return groups;
  }

  private disposeChunk(cx: number, cz: number): void {
    const key = this.key(cx, cz);
    this.disposeChunkMeshes(key);
    this.chunks.delete(key);
  }

  private disposeChunkMeshes(key: string): void {
    const existing = this.meshes.get(key);
    if (existing) {
      // Materials are shared between chunks, so unfreeze before disposing the
      // mesh — a frozen material on a disposed mesh leaks its cached effect.
      for (const mesh of existing) {
        this.onMeshDisposed?.(mesh);
        mesh.material?.unfreeze();
        mesh.dispose();
      }
    }
    this.meshes.delete(key);
    this.triangles.delete(key);
    this.naiveTriangles.delete(key);
  }

  private appendChunkFaces(chunk: Chunk, groups: Map<SurfaceKey, MutableMeshData>): void {
    const height = chunk.getHighestOccupiedY() + 1;
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      for (let y = 0; y < height; y += 1) {
        for (let z = 0; z < CHUNK_SIZE; z += 1) {
          const blockId = chunk.getBlock(x, y, z);
          if (blockId === 0) continue;

          const worldX = chunk.x * CHUNK_SIZE + x;
          const worldZ = chunk.z * CHUNK_SIZE + z;
          for (let faceIndex = 0; faceIndex < FACE_DEFINITIONS.length; faceIndex += 1) {
            const [dx, dy, dz] = FACE_OFFSETS[faceIndex];
            if (!this.shouldDrawFace(blockId, worldX + dx, y + dy, worldZ + dz)) continue;

            const direction = faceIndex === 0 ? 'top' : faceIndex === 1 ? 'bottom' : 'side';
            const surfaceKey = encodeSurfaceKey(blockId, faceVariantFor(blockId, direction));
            this.appendFace(
              this.dataFor(groups, surfaceKey),
              worldX,
              y,
              worldZ,
              FACE_DEFINITIONS[faceIndex]
            );
          }
        }
      }
    }
  }

  private shouldDrawFace(
    blockId: BlockID,
    neighborWorldX: number,
    neighborY: number,
    neighborWorldZ: number
  ): boolean {
    // Outside vertical storage and outside the loaded horizontal set both act
    // as open space. Emitting this boundary face keeps the current chunk a
    // closed, depth-writing shell while its neighbour is still streaming.
    if (neighborY < 0 || neighborY >= CHUNK_HEIGHT) return true;
    return shouldRenderVoxelFace(
      blockId,
      this.getLoadedBlockAt(neighborWorldX, neighborY, neighborWorldZ)
    );
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

  private dataFor(groups: Map<SurfaceKey, MutableMeshData>, blockId: SurfaceKey): MutableMeshData {
    const existing = groups.get(blockId);
    if (existing) return existing;
    const data: MutableMeshData = { positions: [], normals: [], uvs: [], indices: [], colors: [] };
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

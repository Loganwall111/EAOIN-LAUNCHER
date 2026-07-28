/**
 * ChunkMeshBuilder — chunk mesh pipeline with hidden-face removal.
 *
 * ## What was broken
 *
 * 1. **The index buffer was invalid.** `addFace` pushed 4 vertices and then
 *    `baseIndex + 0..5` as indices — six *sequential* indices for a four-vertex
 *    quad. The last two referenced vertices belonging to the *next* face, or,
 *    on the final quad of a chunk, ran past the end of the vertex array
 *    entirely. Babylon uploads that as-is and the GPU reads garbage, which
 *    renders as torn geometry and black gaps. A quad needs two triangles built
 *    from its own four vertices: (0,1,2) and (0,2,3).
 *
 * 2. **Only two of the six face directions had geometry.** `getFaceVertices`
 *    held a 2-entry table and fell back to `verts[0]` — the top face — for the
 *    other four directions. Every side and bottom face was therefore drawn as
 *    a horizontal quad floating at the block's centre, so the sides of the
 *    terrain were simply missing: you could see straight through a chunk into
 *    the void.
 *
 * 3. **The quads were centred on the block origin** (±0.5) rather than
 *    spanning the unit cell (0..1), so even the top faces sat half a block off
 *    and left a visible half-block gap between adjacent chunks.
 *
 * 4. **Neighbour lookups stopped at the chunk border.** Any voxel outside the
 *    chunk read as air, so every chunk was sealed with a full wall of faces on
 *    all four sides. Those interior walls are invisible from outside but they
 *    z-fight with the neighbour's wall and, more importantly, they are what
 *    makes a "sequential grid" of chunks look like separate boxes. The builder
 *    now accepts an optional neighbour sampler.
 *
 * 5. **The sweep always ran the full 128 layers**, most of which are known
 *    air. It is now bounded by the chunk's highest occupied layer.
 */
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from '../world/Chunk';

export interface MeshData {
  vertices: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  /** Quads emitted. Zero means the chunk contributed no geometry. */
  quadCount: number;
}

/**
 * Samples a voxel that may lie outside the chunk being meshed, in *world*
 * coordinates. Return 0 for air or for "not loaded".
 */
export type NeighborSampler = (worldX: number, worldY: number, worldZ: number) => number;

export interface BuildOptions {
  /**
   * Lets the builder see across the chunk seam so it does not wall off the
   * chunk. Omit it and the chunk is meshed in isolation (the old behaviour),
   * which is correct only for a standalone chunk.
   */
  getNeighbor?: NeighborSampler;
  /**
   * Emit positions in world space rather than chunk-local space. Useful when
   * every chunk mesh shares one root transform at the origin.
   */
  worldSpace?: boolean;
}

/** The six face directions, as unit normals. */
const FACE_NORMALS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 0],   // 0 top
  [0, -1, 0],  // 1 bottom
  [1, 0, 0],   // 2 +x
  [-1, 0, 0],  // 3 -x
  [0, 0, 1],   // 4 +z
  [0, 0, -1],  // 5 -z
];

/**
 * Corner offsets for each face, spanning the unit cell 0..1.
 *
 * Order is counter-clockwise when viewed from outside the block, so the two
 * triangles (0,1,2) and (0,2,3) both wind outward and back-face culling keeps
 * the visible side. Getting this wrong makes terrain vanish when you look at
 * it from one side, which reads as a hole.
 */
const FACE_CORNERS: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  // top (+y)
  [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
  // bottom (-y)
  [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  // +x
  [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
  // -x
  [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
  // +z
  [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
  // -z
  [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]],
];

/** Per-corner UVs, matching the corner order above. */
const FACE_UVS: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];

export class ChunkMeshBuilder {
  build(chunk: Chunk, options: BuildOptions = {}): MeshData {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const originX = chunk.x * CHUNK_SIZE;
    const originZ = chunk.z * CHUNK_SIZE;
    const offsetX = options.worldSpace ? originX : 0;
    const offsetZ = options.worldSpace ? originZ : 0;

    // Bound the sweep by the real content of the chunk. `getHighestOccupiedY`
    // is maintained by `setBlock`, so this is exact and free. It returns -1 for
    // a completely empty chunk, which makes the loop body run zero times — the
    // empty case falls out naturally instead of needing a special path.
    const topY = Math.min(chunk.getHighestOccupiedY(), CHUNK_HEIGHT - 1);

    /** Reads a voxel, crossing the chunk seam when a sampler was provided. */
    const blockAt = (x: number, y: number, z: number): number => {
      if (y < 0 || y >= CHUNK_HEIGHT) return 0;
      if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
        return chunk.getBlock(x, y, z);
      }
      // Outside this chunk: ask the world, in world coordinates.
      return options.getNeighbor?.(originX + x, y, originZ + z) ?? 0;
    };

    let quadCount = 0;

    for (let y = 0; y <= topY; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const block = chunk.getBlock(x, y, z);
          if (block === 0) continue; // air

          for (let face = 0; face < 6; face++) {
            const [dx, dy, dz] = FACE_NORMALS[face];
            if (blockAt(x + dx, y + dy, z + dz) !== 0) continue; // hidden

            // Capture the base index BEFORE appending this face's vertices,
            // and build both triangles from those four vertices only.
            const base = vertices.length / 3;
            const corners = FACE_CORNERS[face];
            for (let c = 0; c < 4; c++) {
              const [ox, oy, oz] = corners[c];
              vertices.push(x + ox + offsetX, y + oy, z + oz + offsetZ);
              normals.push(dx, dy, dz);
              uvs.push(FACE_UVS[c][0], FACE_UVS[c][1]);
            }
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
            quadCount++;
          }
        }
      }
    }

    return {
      vertices: new Float32Array(vertices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices),
      quadCount,
    };
  }

  /** True when the built mesh has no geometry to upload. */
  static isEmpty(mesh: MeshData): boolean {
    return mesh.quadCount === 0 || mesh.indices.length === 0;
  }
}

export default ChunkMeshBuilder;

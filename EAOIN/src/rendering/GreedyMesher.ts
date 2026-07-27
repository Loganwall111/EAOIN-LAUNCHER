/**
 * GreedyMesher — merges coplanar voxel faces into the largest possible quads.
 *
 * The naive mesher emits one quad per visible block face. A flat 16×16 chunk
 * floor becomes 256 quads (512 triangles, 1024 vertices) when a single quad
 * would draw it identically. Across a 12-chunk render radius that is the
 * difference between a few hundred thousand triangles and a few million, and
 * it is the main reason the game stutters on open terrain.
 *
 * The algorithm (the standard "greedy voxel meshing" sweep):
 *
 *   For each of the 6 face directions:
 *     For each slice perpendicular to that direction:
 *       1. Build a 2D mask of which cells in this slice have a visible face
 *          of a given block type.
 *       2. Walk the mask. At each unvisited cell, extend as far right as the
 *          mask stays identical, then extend that whole row downward as far
 *          as every row matches.
 *       3. Emit one quad for the resulting rectangle and clear it from the
 *          mask.
 *
 * Correctness requirements this respects:
 *
 *  - Only faces of the **same block id** merge, so materials stay per-block.
 *  - UVs are set to the quad's **width and height in blocks**, not 0..1, so a
 *    merged 8×3 quad tiles the texture 8×3 times instead of stretching it.
 *    This needs the texture in WRAP address mode, which `BlockMaterials` sets.
 *  - Winding order is preserved per direction so back-face culling still works
 *    and normals point outward.
 *
 * ## Baked ambient occlusion (added in the polish pass)
 *
 * Voxel worlds look flat and "plasticky" without contact darkening in the
 * corners where blocks meet, and the previous renderer compensated by leaning
 * on a very strong directional light — which is exactly why the inside of a
 * tree canopy or a cave came out as unreadable near-black blocks. Real
 * Minecraft bakes a cheap per-vertex AO term instead, so geometry reads
 * correctly under gentle lighting.
 *
 * Each quad corner samples its three touching neighbours (side, side, corner)
 * and gets one of four occlusion levels. Crucially the AO level is folded into
 * the merge mask: two cells only merge when their **four corner AO values
 * match**, otherwise a merged quad would smear one corner's shading across
 * the whole rectangle. This is the standard, correct way to combine greedy
 * meshing with AO.
 *
 * ## Face variants
 *
 * Grass is green on top, dirt underneath and banded on the side; a log shows
 * end grain on the caps and bark on the sides. `faceVariantOf` lets the caller
 * split those blocks into separate groups so each gets its own material, while
 * every other block keeps returning variant 0 and therefore stays a single
 * group — no extra draw calls for the 290 blocks that do not need it.
 *
 * Typical measured reduction on EAOIN terrain: 60-85% fewer triangles.
 */
import { BlockID } from '@shared/blocks/BlockRegistry';

export interface MeshBuffers {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  /**
   * Per-vertex RGBA ambient-occlusion tint. Only populated when
   * `ambientOcclusion` is enabled; consumers should treat an empty array as
   * "no AO data" and skip uploading a colour buffer.
   */
  colors: number[];
}

/** Reads a block at chunk-local coords; must return 0 for air/out of range. */
export type BlockSampler = (x: number, y: number, z: number) => BlockID;

/** Decides whether the face of `blockId` toward `neighborId` is visible. */
export type FaceVisibilityTest = (blockId: BlockID, neighborId: BlockID) => boolean;

/**
 * Group key for one merged surface: the block id plus a face-variant index.
 * Encoded as `blockId | variant << 16` so it stays a plain number (fast Map
 * key) and equals the raw block id whenever the variant is 0.
 */
export type SurfaceKey = number;

export const VARIANT_SHIFT = 16;

export function encodeSurfaceKey(blockId: BlockID, variant: number): SurfaceKey {
  return variant === 0 ? blockId : blockId | (variant << VARIANT_SHIFT);
}

export function decodeSurfaceKey(key: SurfaceKey): { blockId: BlockID; variant: number } {
  return { blockId: key & 0xffff, variant: key >>> VARIANT_SHIFT };
}

/** Which of the 6 directions a face points, for variant selection. */
export type FaceDirection = 'top' | 'bottom' | 'side';

export interface GreedyMeshOptions {
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  /** Samples inside the chunk. */
  getBlock: BlockSampler;
  /**
   * Samples a neighbour that may be outside the chunk, so faces on the chunk
   * seam are not drawn when the adjacent chunk is solid there.
   */
  getNeighbor: BlockSampler;
  isFaceVisible: FaceVisibilityTest;
  /** World-space offset added to every vertex. */
  offsetX?: number;
  offsetZ?: number;
  /**
   * Chooses the material variant for a face. Return 0 (the default) to keep
   * the block as one group.
   */
  faceVariantOf?: (blockId: BlockID, direction: FaceDirection) => number;
  /** Bake per-vertex ambient occlusion. Off by default so tests stay exact. */
  ambientOcclusion?: boolean;
  /**
   * Treats a neighbour as occluding for AO purposes. Defaults to "any non-air
   * block occludes", but callers should exclude transparent blocks such as
   * glass, water and leaves so canopies do not self-shadow into black.
   */
  isOccluder?: (blockId: BlockID) => boolean;
}

/** One axis sweep: the axis index, and the two axes that span the slice. */
interface SweepAxis {
  /** 0 = x, 1 = y, 2 = z. */
  axis: number;
  /** +1 for the positive-facing sweep, -1 for negative. */
  sign: 1 | -1;
}

const SWEEPS: SweepAxis[] = [
  { axis: 0, sign: 1 }, { axis: 0, sign: -1 },
  { axis: 1, sign: 1 }, { axis: 1, sign: -1 },
  { axis: 2, sign: 1 }, { axis: 2, sign: -1 },
];

/**
 * The four AO brightness levels, from fully open to fully enclosed.
 *
 * The darkest level is deliberately only ~30% darker, not black. An earlier
 * build multiplied corners far harder and produced the "blocks that are dark
 * and I cannot see anything" problem inside forests and caves.
 */
const AO_LEVELS = [1.0, 0.86, 0.74, 0.66];

function directionFor(axis: number, sign: 1 | -1): FaceDirection {
  if (axis !== 1) return 'side';
  return sign === 1 ? 'top' : 'bottom';
}

/**
 * Standard voxel AO: a corner is darkened by its two edge-adjacent neighbours
 * and the diagonal one. Two touching edges fully enclose the corner.
 */
function cornerAoLevel(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return 3;
  return (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);
}

/**
 * Build merged geometry, grouped by surface key so each group gets its
 * material. With no `faceVariantOf` the keys are plain block ids.
 */
export function greedyMesh(options: GreedyMeshOptions): Map<SurfaceKey, MeshBuffers> {
  const { sizeX, sizeY, sizeZ, getBlock, getNeighbor, isFaceVisible } = options;
  const offsetX = options.offsetX ?? 0;
  const offsetZ = options.offsetZ ?? 0;
  const aoEnabled = options.ambientOcclusion === true;
  const isOccluder = options.isOccluder ?? ((id: BlockID) => id !== 0);
  const faceVariantOf = options.faceVariantOf;

  const groups = new Map<SurfaceKey, MeshBuffers>();
  const dims = [sizeX, sizeY, sizeZ];

  for (const sweep of SWEEPS) {
    const { axis, sign } = sweep;
    // u and v are the two axes spanning each slice.
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    const direction = directionFor(axis, sign);

    const sliceCount = dims[axis];
    const uCount = dims[u];
    const vCount = dims[v];

    // Mask of block ids with a visible face at each cell of the slice.
    const mask = new Int32Array(uCount * vCount);
    // Packed AO levels for the four corners of each cell (2 bits each).
    const aoMask = new Int32Array(uCount * vCount);

    for (let slice = 0; slice < sliceCount; slice += 1) {
      mask.fill(0);
      if (aoEnabled) aoMask.fill(0);
      let anyFace = false;

      for (let vi = 0; vi < vCount; vi += 1) {
        for (let ui = 0; ui < uCount; ui += 1) {
          const coord = [0, 0, 0];
          coord[axis] = slice;
          coord[u] = ui;
          coord[v] = vi;

          const blockId = getBlock(coord[0], coord[1], coord[2]);
          if (blockId === 0) continue;

          const neighbor = [0, 0, 0];
          neighbor[axis] = slice + sign;
          neighbor[u] = ui;
          neighbor[v] = vi;
          const neighborId = getNeighbor(neighbor[0], neighbor[1], neighbor[2]);

          if (isFaceVisible(blockId, neighborId)) {
            mask[vi * uCount + ui] = blockId;
            anyFace = true;
            if (aoEnabled) {
              aoMask[vi * uCount + ui] = packCornerAo(
                axis, sign, slice, u, v, ui, vi, getNeighbor, isOccluder
              );
            }
          }
        }
      }

      if (!anyFace) continue;

      // ---- greedy rectangle extraction over the mask --------------------
      for (let vi = 0; vi < vCount; vi += 1) {
        let ui = 0;
        while (ui < uCount) {
          const cell = vi * uCount + ui;
          const blockId = mask[cell];
          if (blockId === 0) { ui += 1; continue; }
          const ao = aoEnabled ? aoMask[cell] : 0;

          // Extend along u while the block id (and AO signature) matches.
          let width = 1;
          while (
            ui + width < uCount
            && mask[cell + width] === blockId
            && (!aoEnabled || aoMask[cell + width] === ao)
          ) width += 1;

          // Extend along v while every cell of the candidate row matches.
          let height = 1;
          outer: while (vi + height < vCount) {
            for (let k = 0; k < width; k += 1) {
              const probe = (vi + height) * uCount + ui + k;
              if (mask[probe] !== blockId) break outer;
              if (aoEnabled && aoMask[probe] !== ao) break outer;
            }
            height += 1;
          }

          const variant = faceVariantOf ? faceVariantOf(blockId, direction) : 0;
          emitQuad(
            groupFor(groups, encodeSurfaceKey(blockId, variant)),
            axis, sign, slice, u, v, ui, vi, width, height,
            offsetX, offsetZ, aoEnabled ? ao : null
          );

          // Clear the consumed rectangle so it is not emitted again.
          for (let dv = 0; dv < height; dv += 1) {
            for (let du = 0; du < width; du += 1) {
              mask[(vi + dv) * uCount + ui + du] = 0;
            }
          }

          ui += width;
        }
      }
    }
  }

  return groups;
}

/**
 * Compute and pack the four corner AO levels for one cell into 8 bits.
 *
 * Corner order matches `emitQuad`'s c00 → c10 → c11 → c01 traversal, so the
 * packed value can be unpacked straight into vertex colours.
 */
function packCornerAo(
  axis: number, sign: 1 | -1, slice: number,
  u: number, v: number, ui: number, vi: number,
  getNeighbor: BlockSampler,
  isOccluder: (id: BlockID) => boolean
): number {
  // Sample in the plane one step outside the face, which is where the
  // occluding geometry that shadows this face lives.
  const solidAt = (du: number, dv: number): boolean => {
    const p = [0, 0, 0];
    p[axis] = slice + (sign === 1 ? 1 : -1);
    p[u] = ui + du;
    p[v] = vi + dv;
    return isOccluder(getNeighbor(p[0], p[1], p[2]));
  };

  // For each of the four corners: the two edge neighbours and the diagonal.
  const corners: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
  let packed = 0;
  for (let i = 0; i < 4; i += 1) {
    const [cu, cv] = corners[i];
    // Offsets point away from the quad centre toward this corner.
    const du = cu === 0 ? -1 : 1;
    const dv = cv === 0 ? -1 : 1;
    const level = cornerAoLevel(solidAt(du, 0), solidAt(0, dv), solidAt(du, dv));
    packed |= level << (i * 2);
  }
  return packed;
}

/**
 * Emit one merged quad.
 *
 * `slice` is the layer index along `axis`. A positive-facing quad sits at
 * `slice + 1` (the far side of the block), a negative-facing one at `slice`.
 */
function emitQuad(
  buffers: MeshBuffers,
  axis: number, sign: 1 | -1, slice: number,
  u: number, v: number,
  ui: number, vi: number,
  width: number, height: number,
  offsetX: number, offsetZ: number,
  packedAo: number | null
): void {
  const layer = sign === 1 ? slice + 1 : slice;

  // Four corners of the rectangle in (axis, u, v) space.
  const corner = (du: number, dv: number): [number, number, number] => {
    const p: [number, number, number] = [0, 0, 0];
    p[axis] = layer;
    p[u] = ui + du;
    p[v] = vi + dv;
    return p;
  };

  const c00 = corner(0, 0);
  const c10 = corner(width, 0);
  const c11 = corner(width, height);
  const c01 = corner(0, height);

  // Winding must flip with the face direction, or back-face culling hides it.
  //
  // Because u = (axis+1)%3 and v = (axis+2)%3, the basis (axis, u, v) is always
  // a cyclic — therefore right-handed — permutation of (x, y, z). So for the
  // corner order c00 → c10 → c11 the cross product works out to
  //   (w·û) × (w·û + h·v̂) = w·h·(û × v̂) = w·h·â
  // i.e. it always points along +axis, whatever the axis is. Only the sweep
  // sign needs to reverse the winding; axis parity does not come into it.
  const flip = sign === -1;
  const quad = flip ? [c00, c01, c11, c10] : [c00, c10, c11, c01];

  const base = buffers.positions.length / 3;

  const normal: [number, number, number] = [0, 0, 0];
  normal[axis] = sign;

  for (const point of quad) {
    buffers.positions.push(point[0] + offsetX, point[1], point[2] + offsetZ);
    buffers.normals.push(normal[0], normal[1], normal[2]);
  }

  if (packedAo !== null) {
    // Corner AO order follows c00, c10, c11, c01; reverse for flipped winding
    // so each vertex keeps the shade computed for its own corner.
    const order = flip ? [0, 3, 2, 1] : [0, 1, 2, 3];
    for (const index of order) {
      const level = (packedAo >> (index * 2)) & 0b11;
      const shade = AO_LEVELS[level];
      buffers.colors.push(shade, shade, shade, 1);
    }
  }

  // UVs span the quad in *blocks* so the texture tiles rather than stretches.
  // Requires WRAP addressing, which BlockMaterials configures.
  if (flip) {
    buffers.uvs.push(0, 0, 0, height, width, height, width, 0);
  } else {
    buffers.uvs.push(0, 0, width, 0, width, height, 0, height);
  }

  buffers.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function groupFor(groups: Map<SurfaceKey, MeshBuffers>, key: SurfaceKey): MeshBuffers {
  const existing = groups.get(key);
  if (existing) return existing;
  const created: MeshBuffers = { positions: [], normals: [], uvs: [], indices: [], colors: [] };
  groups.set(key, created);
  return created;
}

/** Total triangles across all groups — used by tests and the stats HUD. */
export function countTriangles(groups: Map<SurfaceKey, MeshBuffers>): number {
  let total = 0;
  for (const buffers of groups.values()) total += buffers.indices.length / 3;
  return total;
}

export default greedyMesh;

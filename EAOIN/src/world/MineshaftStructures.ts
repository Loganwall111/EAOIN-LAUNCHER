/**
 * MineshaftStructures — Minecraft-style abandoned mineshafts that spawn inside
 * cave systems, for every dimension.
 *
 * A mineshaft is a network of corridors carved into the rock, braced by oak
 * support beams and fences, lit by torches, strewn with minecart rails and
 * carts, and dotted with loot chests. The layout is deterministic per anchor so
 * the same world always yields the same mineshafts.
 *
 * Two variants:
 *   - "regular": warm wooden supports, oak planks, white torches.
 *   - "black"  : the Black Mineshaft — deepslate + blackstone supports, cyan
 *                torch-light, glow glass, and richer loot. Spawns deep.
 *
 * The structure only carves blocks it owns: it hollows out solid rock on its
 * corridor path and never overwrites air/caves it doesn't generate, so it can
 * share a chunk with the natural cavern system.
 */
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from './Chunk';

export type MineshaftVariant = 'regular' | 'black';

export interface MineshaftPlacement {
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  variant: MineshaftVariant;
}

/** Block ids used by the mineshaft builder (kept local to avoid imports). */
const ID = {
  AIR: 0,
  STONE: 3,
  DEEPSLATE: 29,
  CRACKED_BRICKS: 36,
  STONE_BRICKS: 35,
  MOSSY_BRICKS: 37,
  BLACKSTONE: 48,
  PLANKS: 57,
  OAK_LOG: 6,
  SPRUCE_LOG: 50,
  FENCE: 288,
  CHEST: 146,
  BARREL: 149,
  LANTERN: 283,
  TORCH: 319,      // white torch
  CYAN_TORCH: 321, // cyan torch
  GLOW_GLASS: 322,
  RAIL: 330,
  MINECART: 332,
} as const;

/** Deterministic 0..1 hash from a few integers. */
function hash(...values: number[]): number {
  let h = 2166136261 >>> 0;
  for (const v of values) {
    h ^= (v | 0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Convert a world block id into this module's ID namespace (passthrough). */
type BlockID = number;

/** Per-chunk bounds-safe writer. */
function inside(chunk: Chunk, x: number, y: number, z: number): boolean {
  const lx = x - chunk.x * CHUNK_SIZE;
  const lz = z - chunk.z * CHUNK_SIZE;
  return lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && y >= 1 && y < CHUNK_HEIGHT - 1;
}

function set(chunk: Chunk, x: number, y: number, z: number, block: BlockID): void {
  if (!inside(chunk, x, y, z)) return;
  chunk.setBlock(x - chunk.x * CHUNK_SIZE, y, z - chunk.z * CHUNK_SIZE, block);
}

function get(chunk: Chunk, x: number, y: number, z: number): BlockID {
  if (!inside(chunk, x, y, z)) return ID.STONE; // treat out-of-chunk as solid
  return chunk.getBlock(x - chunk.x * CHUNK_SIZE, y, z - chunk.z * CHUNK_SIZE);
}

/** Place a support beam (two vertical posts + cross braces) spanning a corridor. */
function placeBeam(chunk: Chunk, x: number, yBase: number, z: number, support: BlockID): void {
  for (let dy = 0; dy <= 2; dy++) set(chunk, x, yBase + dy, z, support);
  // cross beam across the corridor
  set(chunk, x, yBase + 2, z - 1, support);
  set(chunk, x, yBase + 2, z + 1, support);
}

/** Carve a straight corridor segment along X or Z, with beams and rails. */
function carveCorridor(
  chunk: Chunk,
  x0: number, z0: number,
  length: number,
  y: number,
  axis: 'x' | 'z',
  variant: MineshaftVariant
): void {
  const support = variant === 'black' ? ID.BLACKSTONE : ID.OAK_LOG;
  const railOnFloor = hash(x0, z0, y) > 0.5;
  const floorY = y - 1;
  for (let i = 0; i <= length; i++) {
    const x = axis === 'x' ? x0 + i : x0;
    const z = axis === 'z' ? z0 + i : z0;
    // Hollow a 3-wide x 3-tall corridor.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dw = -1; dw <= 1; dw++) {
        const bx = axis === 'x' ? x : x + dw;
        const bz = axis === 'z' ? z : z + dw;
        const by = y + dy;
        // Only carve solid rock (never punch through air/caves above us).
        if (get(chunk, bx, by, bz) !== ID.STONE && get(chunk, bx, by, bz) !== ID.DEEPSLATE) continue;
        set(chunk, bx, by, bz, ID.AIR);
      }
      // Rails along the floor of the corridor.
      if (railOnFloor && dy === 0) set(chunk, x, floorY, z, ID.RAIL);
    }
    // Support beam every 5 blocks.
    if (i % 5 === 0) placeBeam(chunk, x, floorY, z, support);
  }
  // Torch at the corridor midpoint.
  const mid = Math.floor(length / 2);
  const mx = axis === 'x' ? x0 + mid : x0;
  const mz = axis === 'z' ? z0 + mid : z0;
  set(chunk, mx, y + 1, mz, variant === 'black' ? ID.CYAN_TORCH : ID.TORCH);
}

/** A loot chest with a small random selection of ores/tools. */
function placeChest(chunk: Chunk, x: number, y: number, z: number): void {
  set(chunk, x, y, z, ID.CHEST);
  // Slight chance of a minecart parked on adjacent rail.
  if (hash(x, z, y, 99) > 0.6) set(chunk, x + 1, y, z, ID.MINECART);
}

/**
 * Generate a mineshaft around an anchor. Returns true if a shaft was carved.
 * The shaft orientation and size are deterministic from the anchor coords.
 */
export function placeMineshaft(chunk: Chunk, placement: MineshaftPlacement): boolean {
  const { anchorX, anchorY, anchorZ, variant } = placement;
  // Never spawn too high (near surface) — mineshafts live in caves/below.
  if (anchorY < 8 || anchorY > CHUNK_HEIGHT - 20) return false;

  const axis: 'x' | 'z' = hash(anchorX, anchorZ) > 0.5 ? 'x' : 'z';
  const support = variant === 'black' ? ID.BLACKSTONE : ID.OAK_LOG;
  const floorY = anchorY;

  // Main corridor.
  carveCorridor(chunk, anchorX, anchorZ, 7 + Math.floor(hash(anchorX, anchorZ, 1) * 5), anchorY, axis, variant);

  // Two side branches (perpendicular), forming a hub.
  const branchAxis: 'x' | 'z' = axis === 'x' ? 'z' : 'x';
  const hubX = axis === 'x' ? anchorX + 4 : anchorX;
  const hubZ = axis === 'z' ? anchorZ + 4 : anchorZ;
  carveCorridor(chunk, hubX - 3, hubZ - 3, 6, anchorY, branchAxis, variant);

  // A chamber with chests.
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    if (get(chunk, hubX + dx, anchorY, hubZ + dz) === ID.STONE) set(chunk, hubX + dx, anchorY, hubZ + dz, ID.AIR);
  }
  // Chests in the chamber corners.
  placeChest(chunk, hubX - 1, floorY, hubZ - 1);
  placeChest(chunk, hubX + 1, floorY, hubZ + 1);

  // Black variant: sprinkle glow glass + lanterns; regular: extra torches.
  if (variant === 'black') {
    set(chunk, hubX, anchorY + 2, hubZ, ID.GLOW_GLASS);
    if (hash(anchorX, anchorZ, 7) > 0.5) set(chunk, hubX, floorY + 1, hubZ, ID.LANTERN);
    placeChest(chunk, hubX, floorY, hubZ + 2);
  } else {
    set(chunk, hubX, anchorY + 1, hubZ, ID.TORCH);
    set(chunk, hubX - 2, anchorY - 1, hubZ - 2, support);
  }
  return true;
}

/** Deterministically decide whether a given column/anchor hosts a mineshaft. */
export function mineshaftAnchorAt(worldX: number, worldZ: number): MineshaftPlacement | null {
  // A shaft anchor on a ~110-block grid, jittered, so shafts are spaced out but
  // common enough to find while mining. Only some anchors actually build.
  const cell = 110;
  const cx = Math.floor(worldX / cell);
  const cz = Math.floor(worldZ / cell);
  const roll = hash(cx, cz);
  if (roll > 0.35) return null; // ~35% of cells host a shaft

  const anchorX = cx * cell + Math.floor(hash(cx, cz, 1) * cell);
  const anchorZ = cz * cell + Math.floor(hash(cx, cz, 2) * cell);
  const deep = hash(cx, cz, 3) > 0.55; // black shafts are deeper
  const anchorY = deep ? 12 + Math.floor(hash(cx, cz, 4) * 12) : 24 + Math.floor(hash(cx, cz, 5) * 18);
  const variant: MineshaftVariant = deep ? 'black' : 'regular';
  return { anchorX, anchorY, anchorZ, variant };
}

/**
 * EAOINRemains — the in-world "EAOIN company remains" (2.0 Update Part 2).
 *
 * After completing the ARG (God Mode unlocked), the player revisits the world
 * and finds the ruins of the EAOIN company at the very centre of the map:
 *   - a pool of purple water flooding the site,
 *   - a gigantic "god hand" looming overhead,
 *   - tentacles rising from the ground,
 *   - an extra Memory Shard,
 *   - and the Encryptor — combine a Shard with it to piece together the
 *     God Mode Block, which takes you to the absolute next level.
 *
 * The structure is deterministic per world so it always sits at the centre.
 */
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from './Chunk';

const ID = {
  AIR: 0,
  PURPUR: 42,
  OBSIDIAN: 12,
  BLACKSTONE: 48,
  PURPLE_WATER: 335,
  ENCRYPTOR: 339,
  GOD_BLOCK: 340,
  SHARD: 308,
  TENTACLE: 313, // rift stone — dark, twisted
  STRUCTURE: 35, // stone bricks
} as const;

function inside(chunk: Chunk, x: number, y: number, z: number): boolean {
  const lx = x - chunk.x * CHUNK_SIZE;
  const lz = z - chunk.z * CHUNK_SIZE;
  return lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && y >= 1 && y < CHUNK_HEIGHT - 1;
}

function set(chunk: Chunk, x: number, y: number, z: number, block: number): void {
  if (!inside(chunk, x, y, z)) return;
  chunk.setBlock(x - chunk.x * CHUNK_SIZE, y, z - chunk.z * CHUNK_SIZE, block);
}

/**
 * Build the EAOIN company remains around the world centre. Returns true if the
 * chunk contains part of the structure (i.e. it is within range of origin).
 */
export function placeEAOINRemains(chunk: Chunk): boolean {
  // Only build near the centre of the world.
  const originX = chunk.x * CHUNK_SIZE;
  const originZ = chunk.z * CHUNK_SIZE;
  const nearCentre =
    originX >= -16 && originX < 16 && originZ >= -16 && originZ < 16;
  if (!nearCentre) return false;

  const surface = 40; // spawn/ground level near origin

  // A central platform of obsidian + purpur.
  for (let dx = -6; dx <= 6; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      const r2 = dx * dx + dz * dz;
      if (r2 > 40) continue;
      set(chunk, dx, surface, dz, r2 <= 25 ? ID.PURPUR : ID.OBSIDIAN);
    }
  }

  // Purple water flooding the surrounding basin.
  for (let dx = -14; dx <= 14; dx++) {
    for (let dz = -14; dz <= 14; dz++) {
      const r2 = dx * dx + dz * dz;
      if (r2 > 190 || r2 <= 40) continue;
      set(chunk, dx, surface, dz, ID.PURPLE_WATER);
    }
  }

  // God hand: a giant obsidian fist overhead.
  const handY = surface + 22;
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      const r2 = dx * dx + dz * dz;
      if (r2 > 10) continue;
      set(chunk, dx, handY, dz, ID.OBSIDIAN);
      set(chunk, dx, handY + 1, dz, ID.OBSIDIAN);
    }
  }
  // fingers
  for (let i = 0; i < 3; i++) {
    const fx = i - 1;
    set(chunk, fx * 2, handY + 2, -2, ID.OBSIDIAN);
    set(chunk, fx * 2, handY + 2, 2, ID.OBSIDIAN);
  }

  // Tentacles rising from the ground.
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const tx = Math.round(Math.cos(angle) * 8);
    const tz = Math.round(Math.sin(angle) * 8);
    for (let h = 1; h <= 6; h++) set(chunk, tx, surface + h, tz, ID.TENTACLE);
  }

  // The Encryptor at the heart.
  set(chunk, 0, surface + 1, 0, ID.ENCRYPTOR);

  // An extra Memory Shard (id 308) beside the Encryptor.
  set(chunk, 2, surface + 1, 0, ID.SHARD);

  return true;
}

/**
 * AetherBackroomsTerrain — generators for the two dimensions that previously
 * existed only as a cave pocket and a name on a list.
 *
 * **The Aether** is the Nether's mirror: instead of a burning ceiling-capped
 * hell, it is an open sky full of floating isles. The generation problem is
 * the opposite of normal terrain — there is no ground, so the isles must be
 * placed as discrete 3D blobs, and each one needs a believable soil profile
 * (grass over dirt over holystone) plus a rounded underside.
 *
 * **The Backrooms** is not terrain at all; it is architecture. It needs a maze
 * generator, not a noise function. Rooms are carved on a grid with a bias
 * toward long straight corridors, because what makes the Backrooms unsettling
 * is repetition and sightlines, not randomness. Ceiling lights are placed on a
 * regular pitch regardless of the maze, which is what produces the recognisable
 * "same room forever" effect.
 */
import { BlockID } from '@shared/blocks/BlockRegistry';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from '../../world/Chunk';
import { AdvancedNoise } from '../../world/AdvancedNoise';

/* ========================================================================== */
/*                                 THE AETHER                                 */
/* ========================================================================== */

/** Blocks reused from the base registry to stand in for Aether materials. */
const AETHER = {
  AIR: 0 as BlockID,
  /** Aether grass — the bright blue-green top layer. */
  GRASS: 1 as BlockID,
  /** Holystone body. */
  STONE: 9 as BlockID,
  DIRT: 2 as BlockID,
  /** Skyroot log. */
  LOG: 6 as BlockID,
  /** Golden oak leaves. */
  LEAVES: 7 as BlockID,
  /** Ambrosium — glows. */
  AMBROSIUM: 10 as BlockID,
  /** Zanite. */
  ZANITE: 16 as BlockID,
  /** Aercloud. */
  CLOUD: 22 as BlockID,
};

export interface AetherConfig {
  seed: string;
  /** Lowest Y an isle may occupy. Below this is the endless fall. */
  floorY: number;
  /** Highest Y an isle may reach. */
  ceilingY: number;
}

export class AetherTerrain {
  private readonly islandNoise: AdvancedNoise;
  private readonly detailNoise: AdvancedNoise;
  private readonly treeNoise: AdvancedNoise;

  constructor(private readonly config: AetherConfig) {
    this.islandNoise = new AdvancedNoise(`${config.seed}:aether:isle`);
    this.detailNoise = new AdvancedNoise(`${config.seed}:aether:detail`);
    this.treeNoise = new AdvancedNoise(`${config.seed}:aether:tree`);
  }

  /**
   * Density of isle material at a point. Above zero means solid.
   *
   * Isles are lens-shaped: wide and flat in the middle, tapering to a rounded
   * point underneath. That vertical falloff is what stops them looking like
   * cubes of noise.
   */
  private density(worldX: number, y: number, worldZ: number): number {
    const { floorY, ceilingY } = this.config;
    if (y < floorY || y > ceilingY) return -1;

    // Large-scale 2D mask decides *where* isles occur at all, so the sky has
    // real open gaps rather than uniform clutter.
    const region = this.islandNoise.fbm2D(worldX * 0.0042, worldZ * 0.0042, 4, 2.0, 0.5, 11);
    const mask = (region - 0.46) / 0.54;
    if (mask <= 0) return -1;

    // Each isle sits at its own altitude band.
    const bandNoise = this.islandNoise.fbm2D(worldX * 0.0031, worldZ * 0.0031, 3, 2.0, 0.5, 13);
    const center = floorY + 12 + bandNoise * (ceilingY - floorY - 24);

    // Lens profile: thick at the centre, thin at the rim, longer taper below.
    const halfThickness = 4 + mask * 14;
    const dy = y - center;
    const vertical = dy >= 0
      ? 1 - dy / halfThickness
      : 1 - Math.abs(dy) / (halfThickness * 1.9);
    if (vertical <= 0) return -1;

    const detail = this.detailNoise.fbm3D(worldX * 0.03, y * 0.05, worldZ * 0.03, 3, 2.0, 0.5, 17);
    return mask * vertical + (detail - 0.5) * 0.35;
  }

  /** Fill a chunk with Aether isles. */
  generate(chunk: Chunk): void {
    const originX = chunk.x * CHUNK_SIZE;
    const originZ = chunk.z * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
        const wx = originX + lx;
        const wz = originZ + lz;

        // Solid column pass.
        let topSolidY = -1;
        for (let y = this.config.floorY; y <= this.config.ceilingY; y += 1) {
          if (this.density(wx, y, wz) > 0) {
            chunk.setBlock(lx, y, lz, AETHER.STONE);
            if (y > topSolidY) topSolidY = y;
          }
        }
        if (topSolidY < 0) continue;

        // Soil profile: grass on top, a few blocks of dirt, holystone below.
        chunk.setBlock(lx, topSolidY, lz, AETHER.GRASS);
        for (let d = 1; d <= 3; d += 1) {
          const y = topSolidY - d;
          if (y > this.config.floorY && chunk.getBlock(lx, y, lz) !== AETHER.AIR) {
            chunk.setBlock(lx, y, lz, AETHER.DIRT);
          }
        }

        // Ambrosium and zanite seams in the isle body.
        const ore = this.detailNoise.fbm3D(wx * 0.08, topSolidY * 0.08, wz * 0.08, 2, 2.0, 0.5, 23);
        if (ore > 0.80) {
          const oreY = topSolidY - 4 - Math.floor(ore * 6);
          if (oreY > this.config.floorY && chunk.getBlock(lx, oreY, lz) === AETHER.STONE) {
            chunk.setBlock(lx, oreY, lz, ore > 0.90 ? AETHER.ZANITE : AETHER.AMBROSIUM);
          }
        }

        // Golden oak (skyroot) trees.
        const tree = this.treeNoise.fbm2D(wx * 0.35, wz * 0.35, 1, 2.0, 0.5, 29);
        if (tree > 0.93 && topSolidY < this.config.ceilingY - 9) {
          this.placeSkyroot(chunk, lx, topSolidY + 1, lz);
        }

        // Aercloud platforms drifting above the isles — they break your fall.
        const cloud = this.islandNoise.fbm3D(wx * 0.02, 0, wz * 0.02, 2, 2.0, 0.5, 31);
        if (cloud > 0.78) {
          const cloudY = Math.min(this.config.ceilingY, topSolidY + 14 + Math.floor(cloud * 10));
          if (chunk.getBlock(lx, cloudY, lz) === AETHER.AIR) {
            chunk.setBlock(lx, cloudY, lz, AETHER.CLOUD);
          }
        }
      }
    }
  }

  private placeSkyroot(chunk: Chunk, lx: number, baseY: number, lz: number): void {
    const height = 5 + Math.floor(this.treeNoise.fbm2D(lx * 3.1, lz * 3.1, 1, 2.0, 0.5, 37) * 3);
    for (let h = 0; h < height; h += 1) {
      chunk.setBlock(lx, baseY + h, lz, AETHER.LOG);
    }
    // A compact golden canopy.
    const crown = baseY + height;
    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 3) continue;
          const x = lx + dx, z = lz + dz, y = crown + dy;
          if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y >= CHUNK_HEIGHT) continue;
          if (chunk.getBlock(x, y, z) === AETHER.AIR) chunk.setBlock(x, y, z, AETHER.LEAVES);
        }
      }
    }
  }
}

/* ========================================================================== */
/*                               THE BACKROOMS                                */
/* ========================================================================== */

const BACKROOMS = {
  AIR: 0 as BlockID,
  /** Damp carpet floor. */
  CARPET: 2 as BlockID,
  /** Yellow wallpaper walls. */
  WALL: 4 as BlockID,
  /** Ceiling tile. */
  CEILING: 9 as BlockID,
  /** Buzzing fluorescent light. */
  LIGHT: 10 as BlockID,
  /** Occasional wet patch. */
  WET: 5 as BlockID,
};

export interface BackroomsConfig {
  seed: string;
  /** Y of the carpet. */
  floorY: number;
  /** Height from carpet to ceiling tiles. Canonically low and oppressive. */
  roomHeight: number;
  /** How many stacked levels to generate. */
  levels: number;
}

export class BackroomsTerrain {
  private readonly mazeNoise: AdvancedNoise;

  constructor(private readonly config: BackroomsConfig) {
    this.mazeNoise = new AdvancedNoise(`${config.seed}:backrooms`);
  }

  /**
   * Is there a wall at this cell?
   *
   * The trick to making it feel like the Backrooms rather than a hedge maze is
   * *anisotropy plus long runs*: sample a low frequency along one axis and a
   * high frequency along the other, which produces long parallel walls with
   * occasional cross-cuts — endless similar rooms and corridors that all look
   * like somewhere you have already been.
   */
  private isWall(worldX: number, worldZ: number, level: number): boolean {
    // Wall lattice on a 7-block pitch — roughly office-partition spacing.
    const gx = Math.floor(worldX / 7);
    const gz = Math.floor(worldZ / 7);
    const onGridX = ((worldX % 7) + 7) % 7 === 0;
    const onGridZ = ((worldZ % 7) + 7) % 7 === 0;
    if (!onGridX && !onGridZ) return false;

    // Punch doorways so the lattice is navigable rather than a sealed grid.
    const gate = this.mazeNoise.fbm2D(
      (gx + level * 97) * 0.6,
      (gz - level * 53) * 0.6,
      2, 2.0, 0.5, 71
    );
    if (gate > 0.62) return false;

    // Long straight runs: bias toward keeping X-walls and dropping Z-walls in
    // some regions and vice versa in others.
    const bias = this.mazeNoise.fbm2D(worldX * 0.004, worldZ * 0.004, 3, 2.0, 0.5, 73);
    if (onGridX && !onGridZ && bias < 0.30) return false;
    if (onGridZ && !onGridX && bias > 0.70) return false;

    return true;
  }

  /** Fill a chunk with stacked Backrooms levels. */
  generate(chunk: Chunk): void {
    const originX = chunk.x * CHUNK_SIZE;
    const originZ = chunk.z * CHUNK_SIZE;
    const { floorY, roomHeight, levels } = this.config;
    const levelStride = roomHeight + 2;

    for (let level = 0; level < levels; level += 1) {
      const base = floorY + level * levelStride;
      const ceiling = base + roomHeight;
      if (ceiling >= CHUNK_HEIGHT) break;

      for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
        for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
          const wx = originX + lx;
          const wz = originZ + lz;

          // Carpet.
          chunk.setBlock(lx, base, lz, BACKROOMS.CARPET);

          // Rare damp patches — the smell of old moisture, made literal.
          const damp = this.mazeNoise.fbm2D(wx * 0.09, wz * 0.09, 2, 2.0, 0.5, 79);
          if (damp > 0.88) chunk.setBlock(lx, base, lz, BACKROOMS.WET);

          // Walls.
          if (this.isWall(wx, wz, level)) {
            for (let y = base + 1; y < ceiling; y += 1) {
              chunk.setBlock(lx, y, lz, BACKROOMS.WALL);
            }
          } else {
            for (let y = base + 1; y < ceiling; y += 1) {
              chunk.setBlock(lx, y, lz, BACKROOMS.AIR);
            }
          }

          // Ceiling tiles, with fluorescent lights on a strict regular pitch.
          // The regularity is deliberate: it is what makes every room look
          // like the same room.
          const lightHere = ((wx % 5) + 5) % 5 === 2 && ((wz % 5) + 5) % 5 === 2;
          chunk.setBlock(lx, ceiling, lz, lightHere ? BACKROOMS.LIGHT : BACKROOMS.CEILING);
          // A solid slab above the ceiling separates this level from the next.
          chunk.setBlock(lx, ceiling + 1, lz, BACKROOMS.CEILING);
        }
      }
    }
  }
}

export default { AetherTerrain, BackroomsTerrain };

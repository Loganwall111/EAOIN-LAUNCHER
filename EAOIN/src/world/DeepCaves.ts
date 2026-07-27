/**
 * DeepCaves — "Life Comes Apart 2.0" underground overhaul.
 *
 * The old cave pass carved thin "spaghetti" tunnels only. This adds the layer
 * the brief asks for: genuinely **enormous** caverns with their own biomes,
 * bioluminescence, undiscovered ruins, and a molten core at the bottom of the
 * world — all strictly underground, so the surface is untouched.
 *
 * Bands are expressed as *fractions of the available underground column*
 * rather than absolute Y offsets. This matters: EAOIN's surface sits around
 * y=12..78 with bedrock at y=4, so there are only ~10-70 blocks of rock to work
 * with. Absolute Minecraft-style offsets (-20, -55, -85) would fall below
 * bedrock everywhere and carve nothing at all.
 *
 * Layers, as a fraction of the depth from surface to bedrock:
 *
 *   0.00 .. 0.18   untouched roof — keeps the surface intact
 *   0.18 .. 0.55   CAVERN BAND — huge open halls, cave biomes, glow flora
 *   0.55 .. 0.82   DEEP BAND   — bigger halls, ruins, crystal geodes
 *   0.82 .. 1.00   MAGMA BAND  — lava lakes and basalt
 *   bottom layers  THE CORE    — molten, the literal core of the world
 *
 * Cave biomes are chosen by 2D noise so a given (x,z) column belongs to one
 * biome for its whole depth, which makes each cavern feel like a real place
 * rather than randomly speckled blocks.
 */
import { BlockID } from '@shared/blocks/BlockRegistry';
import { AdvancedNoise } from './AdvancedNoise';
import { Chunk, CHUNK_SIZE } from './Chunk';

/** Cave biome identities. */
export type CaveBiomeID =
  | 'dirt_cavern'
  | 'lush_cavern'
  | 'mushroom_valley'
  | 'glowworm_grotto'
  | 'crystal_hollow'
  | 'frozen_cavern'
  | 'magma_cavern'
  | 'fungal_deep'
  | 'ancient_ruins'
  | 'backrooms';

export interface CaveBiomeDefinition {
  id: CaveBiomeID;
  name: string;
  /** Block the cavern floor is paved with. */
  floor: BlockID;
  /** Block the cavern ceiling is made of. */
  ceiling: BlockID;
  /** Decorative block scattered on the floor. */
  scatter: BlockID;
  /** How often scatter appears, 0-1. */
  scatterChance: number;
  /** Emissive block used for bioluminescence. */
  glow: BlockID;
  /** How often glow blocks appear, 0-1. */
  glowChance: number;
  /** Multiplies cavern size for this biome. */
  sizeScale: number;
  description: string;
}

/* Block ids drawn from the shared registry. */
const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WATER: 5,
  OBSIDIAN: 12,
  REDSTONE_LAMP: 14,
  CRYSTAL: 16,
  DEEPSLATE: 29,
  STONE_BRICKS: 35,
  CRACKED_BRICKS: 36,
  MOSSY_BRICKS: 37,
  GLOWSTONE: 49,
  MUSHROOM: 97,
  GLOW_BERRIES: 106,
  SPORE_BLOSSOM: 107,
  MOSS: 108,
  PACKED_ICE: 221,
  LAVA: 227,
  MAGMA: 219,
  BASALT: 47,
  AMETHYST: 84,
} as const;

export const CAVE_BIOMES: Record<CaveBiomeID, CaveBiomeDefinition> = {
  dirt_cavern: {
    id: 'dirt_cavern', name: 'Dirt Cavern',
    floor: B.DIRT, ceiling: B.DIRT, scatter: B.GRASS, scatterChance: 0.18,
    glow: B.GLOW_BERRIES, glowChance: 0.010, sizeScale: 1.15,
    description: 'A vast hollow of packed earth, roots hanging from the roof.',
  },
  lush_cavern: {
    id: 'lush_cavern', name: 'Lush Cavern',
    floor: B.MOSS, ceiling: B.DIRT, scatter: B.GRASS, scatterChance: 0.30,
    glow: B.GLOW_BERRIES, glowChance: 0.032, sizeScale: 1.25,
    description: 'Moss, hanging vines and glowing berries in the dark.',
  },
  mushroom_valley: {
    id: 'mushroom_valley', name: 'Mushroom Valley',
    floor: B.MOSS, ceiling: B.STONE, scatter: B.MUSHROOM, scatterChance: 0.42,
    glow: B.SPORE_BLOSSOM, glowChance: 0.038, sizeScale: 1.45,
    description: 'Giant fungal canopies fill an underground valley.',
  },
  glowworm_grotto: {
    id: 'glowworm_grotto', name: 'Glow-Worm Grotto',
    floor: B.STONE, ceiling: B.DEEPSLATE, scatter: B.MOSS, scatterChance: 0.14,
    // Dense ceiling glow is the whole point of this biome.
    glow: B.GLOW_BERRIES, glowChance: 0.085, sizeScale: 1.35,
    description: 'The ceiling is a false sky of blue-green glow-worms.',
  },
  crystal_hollow: {
    id: 'crystal_hollow', name: 'Crystal Hollow',
    floor: B.DEEPSLATE, ceiling: B.DEEPSLATE, scatter: B.AMETHYST, scatterChance: 0.24,
    glow: B.CRYSTAL, glowChance: 0.048, sizeScale: 1.30,
    description: 'Every surface bristles with luminous crystal.',
  },
  frozen_cavern: {
    id: 'frozen_cavern', name: 'Frozen Cavern',
    floor: B.PACKED_ICE, ceiling: B.PACKED_ICE, scatter: B.PACKED_ICE, scatterChance: 0.20,
    glow: B.CRYSTAL, glowChance: 0.014, sizeScale: 1.20,
    description: 'Ice sheets and frozen waterfalls, far below the frost line.',
  },
  magma_cavern: {
    id: 'magma_cavern', name: 'Magma Cavern',
    floor: B.BASALT, ceiling: B.BASALT, scatter: B.MAGMA, scatterChance: 0.26,
    glow: B.GLOWSTONE, glowChance: 0.030, sizeScale: 1.10,
    description: 'Basalt columns over slow-moving rivers of lava.',
  },
  fungal_deep: {
    id: 'fungal_deep', name: 'Fungal Deep',
    floor: B.MOSS, ceiling: B.DEEPSLATE, scatter: B.MUSHROOM, scatterChance: 0.34,
    glow: B.SPORE_BLOSSOM, glowChance: 0.052, sizeScale: 1.40,
    description: 'Bioluminescent fungus in every colour, kilometres down.',
  },
  ancient_ruins: {
    id: 'ancient_ruins', name: 'Undiscovered Ruins',
    floor: B.STONE_BRICKS, ceiling: B.DEEPSLATE, scatter: B.CRACKED_BRICKS, scatterChance: 0.30,
    glow: B.REDSTONE_LAMP, glowChance: 0.022, sizeScale: 1.32,
    description: 'Something built this, and nobody alive remembers what.',
  },
  backrooms: {
    id: 'backrooms', name: 'The Backrooms',
    // Deliberately wrong-looking: flat, yellow, endless, no natural stone.
    floor: B.STONE_BRICKS, ceiling: B.STONE_BRICKS, scatter: B.AIR, scatterChance: 0,
    glow: B.REDSTONE_LAMP, glowChance: 0.055, sizeScale: 1.0,
    description: 'You noclipped out of reality. The hum never stops.',
  },
};

export interface DeepCaveConfig {
  seed: string;
  bedrockThickness: number;
  worldDepth: number;
  seaLevel: number;
  /** Multiplies every cavern radius. */
  sizeScale?: number;
  /** Enable the rare Backrooms pockets. */
  backroomsEnabled?: boolean;
}

/**
 * Depth bands as a fraction of the surface-to-bedrock column.
 * `ROOF_FRACTION` is the untouched cap that guarantees we never break through
 * to daylight — the brief is explicit that this is caves only.
 */
const ROOF_FRACTION = 0.18;
const CAVERN_BAND_END = 0.55;
const DEEP_BAND_END = 0.82;
/** Never carve closer than this many blocks to the surface, whatever the maths. */
const MIN_ROOF_BLOCKS = 5;
/* ---- cavern system placement (see `cavernPresence`) ---- */
/** Grid cell size, in blocks, that cavern systems are placed on. */
const CAVERN_CELL_SIZE = 170;
/** Fraction of cells that host a cavern system. Uniform on every seed. */
const CAVERN_SYSTEM_CHANCE = 0.62;
/** Smallest cavern-system footprint radius, in blocks. */
const CAVERN_MIN_RADIUS = 70;
/** Largest cavern-system footprint radius, in blocks. */
const CAVERN_MAX_RADIUS = 150;
/**
 * Where a cavern hall sits in the rock column, and how tall it is, as
 * fractions of the carvable span. Centring at 0.45 puts halls in the lower
 * middle of the world with rock above and below — so caverns have a real
 * ceiling and a real floor rather than hollowing the column end to end.
 */
const HALL_CENTER_FRACTION = 0.45;
const HALL_HALF_FRACTION = 0.30;

export class DeepCaveGenerator {
  private readonly cavernNoise: AdvancedNoise;
  private readonly biomeNoise: AdvancedNoise;
  private readonly detailNoise: AdvancedNoise;
  private readonly config: Required<DeepCaveConfig>;

  constructor(config: DeepCaveConfig) {
    this.config = {
      sizeScale: 1,
      backroomsEnabled: true,
      ...config,
    };
    this.cavernNoise = new AdvancedNoise(`${config.seed}:deepcavern`);
    this.biomeNoise = new AdvancedNoise(`${config.seed}:cavebiome`);
    this.detailNoise = new AdvancedNoise(`${config.seed}:cavedetail`);
  }

  /**
   * Pick the cave biome for a column.
   *
   * Uses low-frequency 2D noise so biomes form large contiguous regions, and
   * folds depth in so the deepest bands prefer hotter, stranger biomes.
   */
  getCaveBiomeAt(worldX: number, worldZ: number, depthFraction: number): CaveBiomeDefinition {
    // Rare Backrooms pockets — deliberately hard to find.
    if (this.config.backroomsEnabled && depthFraction > 0.45) {
      const br = this.biomeNoise.fbm2D(worldX * 0.0009, worldZ * 0.0009, 2, 2.0, 0.5, 977);
      if (br > 0.965) return CAVE_BIOMES.backrooms;
    }

    const t = this.biomeNoise.fbm2D(worldX * 0.0032, worldZ * 0.0032, 3, 2.0, 0.5, 401);
    const h = this.biomeNoise.fbm2D(worldX * 0.0027 + 41, worldZ * 0.0027 - 19, 3, 2.0, 0.5, 402);

    // Deepest band is dominated by heat.
    if (depthFraction > DEEP_BAND_END) return CAVE_BIOMES.magma_cavern;

    if (depthFraction > CAVERN_BAND_END) {
      if (t > 0.66) return CAVE_BIOMES.magma_cavern;
      if (t > 0.46) return CAVE_BIOMES.crystal_hollow;
      if (h > 0.58) return CAVE_BIOMES.fungal_deep;
      return CAVE_BIOMES.ancient_ruins;
    }

    // Upper cavern band — the friendly, spectacular ones.
    if (t < 0.24) return CAVE_BIOMES.frozen_cavern;
    if (t < 0.44) return h > 0.52 ? CAVE_BIOMES.lush_cavern : CAVE_BIOMES.dirt_cavern;
    if (t < 0.64) return CAVE_BIOMES.mushroom_valley;
    if (t < 0.82) return CAVE_BIOMES.glowworm_grotto;
    return CAVE_BIOMES.crystal_hollow;
  }

  /**
   * How strongly this column belongs to a cavern system, in [0, 1].
   *
   * ## Why this is cell-based rather than a threshold on fbm
   *
   * The underlying value-noise fbm has a large **seed-dependent DC offset** at
   * the very low frequencies wanted for regional features. Sampled over the
   * same area, one seed's field sat entirely within 0.39-0.44 while another's
   * sat within 0.66-0.72. Any fixed threshold therefore gave a solid world on
   * one seed and a hollow one on the next — measured at 3% air on seed
   * `eaoin_seed_2026` against 82% on `beta`. Subtracting a local mean helped
   * but left the *variance* uncontrolled, so density still swung from 0.1% to
   * 43%.
   *
   * Cavern systems are therefore placed the way structures are: the world is
   * divided into fixed cells, a hash decides whether each cell hosts a system,
   * and a second hash positions and sizes it. Because the hash is uniform by
   * construction, `CAVERN_SYSTEM_CHANCE` *is* the fraction of cells with
   * caverns on every seed. Smooth radial falloff from each centre keeps the
   * edges natural, and neighbouring cells are checked so systems can overlap
   * into larger networks.
   */
  private cavernPresence(worldX: number, worldZ: number): number {
    const cellX = Math.floor(worldX / CAVERN_CELL_SIZE);
    const cellZ = Math.floor(worldZ / CAVERN_CELL_SIZE);

    let best = 0;
    // Check the 3x3 neighbourhood so systems near a cell border still reach
    // in, and adjacent systems merge into bigger networks.
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const cx = cellX + dx;
        const cz = cellZ + dz;
        if (this.biomeNoise.hash(cx, cz, 0, 601) > CAVERN_SYSTEM_CHANCE) continue;

        // Centre jittered inside the cell, radius varied per system.
        const ox = this.biomeNoise.hash(cx, cz, 1, 602);
        const oz = this.biomeNoise.hash(cx, cz, 2, 603);
        const centerX = (cx + ox) * CAVERN_CELL_SIZE;
        const centerZ = (cz + oz) * CAVERN_CELL_SIZE;
        const radius = CAVERN_MIN_RADIUS
          + this.biomeNoise.hash(cx, cz, 3, 604) * (CAVERN_MAX_RADIUS - CAVERN_MIN_RADIUS);

        const distance = Math.hypot(worldX - centerX, worldZ - centerZ);
        if (distance >= radius) continue;

        // Smoothstep falloff: full strength at the core, tapering to nothing
        // at the rim so caverns end in narrowing passages, not sheer walls.
        const t = 1 - distance / radius;
        const strength = t * t * (3 - 2 * t);
        if (strength > best) best = strength;
      }
    }

    return best;
  }

  /**
   * Carve the huge caverns into a chunk and dress them.
   *
   * Called after the base terrain and the existing thin-tunnel cave pass, so it
   * only ever widens and decorates — it never touches the surface.
   */
  apply(chunk: Chunk, getSurfaceHeight: (x: number, z: number) => number): void {
    const { bedrockThickness } = this.config;

    for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
        const wx = chunk.x * CHUNK_SIZE + lx;
        const wz = chunk.z * CHUNK_SIZE + lz;
        const surface = getSurfaceHeight(wx, wz);

        // Available rock column, and the roof we must leave intact so the
        // surface is never broken open.
        const bottom = bedrockThickness + 1;
        const column = surface - bottom;
        if (column < 8) continue;
        const roof = Math.max(MIN_ROOF_BLOCKS, Math.round(column * ROOF_FRACTION));
        const top = surface - roof;
        if (top <= bottom) continue;

        // Regional gate, computed once per column.
        //
        // Previously the carve threshold was a flat 0.50, so roughly half of
        // *every* rock column in the world opened up: the underground came out
        // hollow rather than cavernous, which is exactly the "empty, amplified"
        // look reported. Caverns should instead cluster into a limited number
        // of large systems with real rock between them.
        const presence = this.cavernPresence(wx, wz);
        if (presence <= 0) {
          // Still dress and score the column so tunnels carved by the main
          // cave pass get floors, ceilings and glow.
          this.dressColumn(chunk, lx, lz, wx, wz, surface, bottom, top);
          continue;
        }

        // Same per-band memoisation as `dressColumn`: the biome lookup is
        // several noise samples and only its depth band varies down a column.
        const carveBands: Array<CaveBiomeDefinition | undefined> = [undefined, undefined, undefined];

        for (let y = bottom; y < top; y += 1) {
          // 0 at the surface, 1 at bedrock.
          const depthFraction = (surface - y) / column;
          const band = depthFraction > DEEP_BAND_END ? 2 : depthFraction > CAVERN_BAND_END ? 1 : 0;
          let biome = carveBands[band];
          if (!biome) {
            biome = this.getCaveBiomeAt(wx, wz, depthFraction);
            carveBands[band] = biome;
          }

          if (biome.id === 'backrooms') {
            this.carveBackrooms(chunk, lx, lz, wx, wz, y, depthFraction);
            continue;
          }

          // Cavern density field. Low frequency on Y so caverns are wide and
          // flat-ish halls rather than spherical bubbles.
          const n = this.cavernNoise.fbm3D(
            wx * 0.0125,
            y * 0.028,
            wz * 0.0125,
            4,
            2.0,
            0.5,
            77
          );

          const scale = biome.sizeScale * this.config.sizeScale;

          // --- vertical hall shaping ---------------------------------------
          // A cavern is a *hall*: it has a floor you can stand on and a
          // ceiling above you. Carving on a purely 3D field with a depth ramp
          // hollowed whole columns from bedrock to roof — measured at 99% air
          // in the strongest regions, which is the "hollow" look again, just
          // relocated.
          //
          // Each system therefore gets a hall centred at `hallCenter` with a
          // half-height of `hallHalf`, and the carve strength falls to zero at
          // the hall's floor and ceiling.
          const hallSpan = top - bottom;
          const hallCenter = bottom + hallSpan * HALL_CENTER_FRACTION;
          const hallHalf = Math.max(4, hallSpan * HALL_HALF_FRACTION * (0.7 + presence * 0.6) * scale);
          const vertical = 1 - Math.abs(y - hallCenter) / hallHalf;
          if (vertical <= 0) continue;
          // Smoothstep so the hall's roof arches instead of being cut flat.
          const arch = vertical * vertical * (3 - 2 * vertical);

          // Threshold high enough that solid rock is the default state;
          // `presence` and the vertical arch pull it down inside a hall.
          const threshold = 0.70 - presence * arch * 0.34 * scale;

          if (n > threshold) {
            chunk.setBlock(lx, y, lz, B.AIR);
          }
        }

        // Dress whatever we just opened up.
        this.dressColumn(chunk, lx, lz, wx, wz, surface, bottom, top);
      }
    }

    this.applyMoltenCore(chunk);
  }

  /**
   * Pave floors, cap ceilings, scatter flora and place glow blocks.
   *
   * Walks the column once looking for air/solid transitions, which is far
   * cheaper than re-sampling the noise field.
   */
  private dressColumn(
    chunk: Chunk,
    lx: number,
    lz: number,
    wx: number,
    wz: number,
    surface: number,
    bottom: number,
    top: number
  ): void {
    const column = Math.max(1, surface - bottom);

    // PERF: `getCaveBiomeAt` runs several fbm2D samples and was called once per
    // Y for the whole column. The horizontal component is identical for every
    // Y in a column — only the depth band changes — so the result is memoised
    // per band (there are only three) instead of recomputed ~60 times.
    const bandCache: Array<CaveBiomeDefinition | undefined> = [undefined, undefined, undefined];
    const biomeForDepth = (depthFraction: number): CaveBiomeDefinition => {
      const band = depthFraction > DEEP_BAND_END ? 2 : depthFraction > CAVERN_BAND_END ? 1 : 0;
      const cached = bandCache[band];
      if (cached) return cached;
      const value = this.getCaveBiomeAt(wx, wz, depthFraction);
      bandCache[band] = value;
      return value;
    };

    for (let y = bottom + 1; y < top - 1; y += 1) {
      const here = chunk.getBlock(lx, y, lz);
      if (here !== B.AIR) continue;

      const depthFraction = (surface - y) / column;
      const biome = biomeForDepth(depthFraction);
      const below = chunk.getBlock(lx, y - 1, lz);
      const above = chunk.getBlock(lx, y + 1, lz);

      // --- Floor -------------------------------------------------------
      if (below !== B.AIR && below !== B.LAVA && below !== B.WATER) {
        chunk.setBlock(lx, y - 1, lz, biome.floor);

        const r = this.detailNoise.hash(wx, wz, y, 811);
        if (r < biome.scatterChance && biome.scatter !== B.AIR) {
          chunk.setBlock(lx, y, lz, biome.scatter);
        } else if (r > 1 - biome.glowChance) {
          // Bioluminescence on the floor.
          chunk.setBlock(lx, y, lz, biome.glow);
        }
      }

      // --- Ceiling -----------------------------------------------------
      if (above !== B.AIR && above !== B.LAVA) {
        chunk.setBlock(lx, y + 1, lz, biome.ceiling);
        // Hanging glow — this is what makes glow-worm grottos read as a sky.
        const g = this.detailNoise.hash(wx, wz, y + 4096, 812);
        if (g < biome.glowChance * 1.6) {
          chunk.setBlock(lx, y, lz, biome.glow);
        }
      }
    }
  }

  /**
   * The Backrooms: flat ceilings, flat floors, endless right-angled rooms.
   *
   * A rare, deliberately unnatural pocket — a reference level, exactly as
   * requested, gated behind very high noise so most players never see one.
   */
  private carveBackrooms(
    chunk: Chunk,
    lx: number,
    lz: number,
    wx: number,
    wz: number,
    y: number,
    depthFraction: number
  ): void {
    // Rooms are 4 blocks tall on a fixed vertical grid, so floors and ceilings
    // are perfectly level — the wrongness is the point.
    const floorLevel = Math.floor(y / 6) * 6;
    const inRoom = y > floorLevel && y < floorLevel + 5;
    if (!inRoom) {
      chunk.setBlock(lx, y, lz, B.STONE_BRICKS);
      return;
    }

    // Wall grid: a 9x9 lattice with doorway gaps.
    const wallX = ((wx % 9) + 9) % 9 === 0;
    const wallZ = ((wz % 9) + 9) % 9 === 0;
    const doorway = this.detailNoise.hash(Math.floor(wx / 9), Math.floor(wz / 9), y, 913) > 0.62;

    if ((wallX || wallZ) && !doorway) {
      chunk.setBlock(lx, y, lz, B.STONE_BRICKS);
      return;
    }

    chunk.setBlock(lx, y, lz, B.AIR);

    // Buzzing fluorescent lights in the ceiling.
    if (y === floorLevel + 4) {
      const lamp = this.detailNoise.hash(wx, wz, Math.round(depthFraction * 100), 914);
      if (lamp > 0.94) chunk.setBlock(lx, y, lz, B.REDSTONE_LAMP);
    }
  }

  /**
   * The molten core: the bottom of the world is lava, as requested.
   *
   * Sits directly above bedrock so it is reachable by digging but still has a
   * floor under it.
   */
  private applyMoltenCore(chunk: Chunk): void {
    const { bedrockThickness } = this.config;
    // Thin enough to fit even the shallowest columns in this world.
    const coreTop = bedrockThickness + 3;

    for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
        const wx = chunk.x * CHUNK_SIZE + lx;
        const wz = chunk.z * CHUNK_SIZE + lz;

        for (let y = bedrockThickness; y < coreTop; y += 1) {
          const current = chunk.getBlock(lx, y, lz);
          // Only fill space that is already open, and crust the top layer with
          // magma so you get a warning before you fall in.
          if (current !== B.AIR) continue;
          const crust = y === coreTop - 1;
          const n = this.detailNoise.hash(wx, wz, y, 1021);
          chunk.setBlock(lx, y, lz, crust && n > 0.55 ? B.MAGMA : B.LAVA);
        }
      }
    }
  }

  /** Names of every cave biome, for the codex UI. */
  static allBiomes(): CaveBiomeDefinition[] {
    return Object.values(CAVE_BIOMES);
  }
}

export default DeepCaveGenerator;

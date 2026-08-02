/**
 * DimensionTerrain — distinct, purpose-built terrain per dimension.
 *
 * Previously every dimension that wasn't the Aether or the Backrooms reused
 * the overworld generator with only a recoloured sky/fog, so "dimensions" were
 * the same world wearing a different filter. This module gives each dimension
 * its own generated world by mapping a dimension id to a terrain archetype and
 * emitting distinct chunk geometry:
 *
 *   overworld / nature  → classic rolling hills
 *   nether              → netherrack basins, basalt pillars, lava oceans
 *   end                 → floating obsidian isles over the void
 *   moon / sun / gas    → cratered low-gravity surfaces
 *   frozen_wasteland    → icy snow plains and ice spires
 *   volcanic_realm      → obsidian/basalt with magma pools
 *   crystal_realm       → amethyst/crystal spires
 *   ocean_world         → deep ocean floor with sand + prismarine
 *   giant_forest        → towering trunk columns under a leaf canopy
 *   mushroom_kingdom    → mycelium hillscape
 *   storm_dimension     → churning dark terrain with glowstone sparks
 *   toxic_wasteland     → toxic sludge basins over cracked ground
 *   machine_dimension   → flat metal platforms and deepslate
 *   shadow / spirit     → dark stone spires
 *   cosmic_void         → sparse floating slabs over nothing
 *   corrupted_lands     → warped obsidian spikes
 *
 * Everything is pure and deterministic (seeded noise only), so it meshes and
 * streams exactly like the overworld through ChunkRenderManager.
 */
import { BlockID } from '@shared/blocks/BlockRegistry';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from '../../world/Chunk';
import { AdvancedNoise } from '../../world/AdvancedNoise';

export type DimensionArchetype =
  | 'hills' | 'nether' | 'end' | 'space' | 'frozen' | 'volcanic'
  | 'crystal' | 'ocean' | 'forest' | 'mushroom' | 'storm' | 'toxic'
  | 'machine' | 'dark' | 'void' | 'corrupt';

export interface DimensionTerrainStyle {
  /** Air just above the surface; the sea/void fill baseline. */
  seaLevel: number;
  /** Vertical relief amplitude around seaLevel. */
  amplitude: number;
  /** Primary body block. */
  body: BlockID;
  /** Surface coat block (grass / sand / netherrack / etc). */
  surface: BlockID;
  /** Subsurface layer just beneath the surface. */
  subsurface: BlockID;
  /** Whether below seaLevel is filled with a fluid (water/lava/void = air). */
  fillBlock: BlockID;
  /** Spawn a bounded fluid/void ocean at/below seaLevel. */
  fill: boolean;
  /** Extra decorative material sprinkled on the surface. */
  decor: BlockID;
}

const B = {
  AIR: 0 as BlockID,
  GRASS: 1 as BlockID,
  DIRT: 2 as BlockID,
  STONE: 3 as BlockID,
  SAND: 4 as BlockID,
  WATER: 5 as BlockID,
  OAK_LOG: 6 as BlockID,
  OAK_LEAVES: 7 as BlockID,
  OBSIDIAN: 12 as BlockID,
  MOON_ROCK: 23 as BlockID,
  SANDSTONE: 38 as BlockID,
  PRISMARINE: 40 as BlockID,
  NETHERRACK: 44 as BlockID,
  SOUL_SAND: 45 as BlockID,
  SOUL_SOIL: 46 as BlockID,
  BASALT: 47 as BlockID,
  BLACKSTONE: 48 as BlockID,
  GLOWSTONE: 49 as BlockID,
  CRIMSON_STEM: 55 as BlockID,
  WARPED_STEM: 56 as BlockID,
  MAGMA: 219 as BlockID,
  LAVA: 227 as BlockID,
  TOXIC: 226 as BlockID,
  MYCELIUM: 277 as BlockID,
  CRYSTAL: 16 as BlockID,
  DEEPSLATE: 29 as BlockID,
  ICE: 221 as BlockID,       // Packed Ice
  SNOW: 221 as BlockID,      // Packed Ice (used as snow-white surface)
  PURPUR: 42 as BlockID,
  COMET_ICE: 214 as BlockID,
  PLANKS: 57 as BlockID,       // oak planks — The Humorous uses them for its joke-houses
  KELP: 304 as BlockID,        // playful foliage
  SHARD: 308 as BlockID,       // Chorus shard — glowing comedic bauble
};

export function dimensionArchetype(dimensionId: string): DimensionArchetype {
  switch (dimensionId) {
    case 'overworld': case 'nature_dimension': return 'hills';
    case 'nether': return 'nether';
    case 'end': return 'end';
    case 'moon': case 'sun': case 'gas_giant': case 'alien_worlds': return 'space';
    case 'frozen_wasteland': return 'frozen';
    case 'volcanic_realm': return 'volcanic';
    case 'crystal_realm': return 'crystal';
    case 'ocean_world': return 'ocean';
    case 'giant_forest': case 'prehistoric_world': return 'forest';
    case 'mushroom_kingdom': return 'mushroom';
    case 'storm_dimension': return 'storm';
    case 'toxic_wasteland': return 'toxic';
    case 'machine_dimension': return 'machine';
    case 'shadow_realm': case 'spirit_realm': case 'undead_realm': case 'chaos_dimension':
      return 'dark';
    case 'cosmic_void': case 'astral_plane': case 'dream_realm': case 'humorous': return 'void';
    case 'corrupted_lands': case 'ancient_civilization': return 'corrupt';
    default: return 'hills';
  }
}

function styleFor(archetype: DimensionArchetype): DimensionTerrainStyle {
  switch (archetype) {
    case 'hills': return { seaLevel: 64, amplitude: 14, body: B.STONE, surface: B.GRASS, subsurface: B.DIRT, fillBlock: B.WATER, fill: true, decor: B.OAK_LOG };
    case 'nether': return { seaLevel: 40, amplitude: 16, body: B.NETHERRACK, surface: B.NETHERRACK, subsurface: B.SOUL_SOIL, fillBlock: B.LAVA, fill: true, decor: B.BASALT };
    case 'end': return { seaLevel: 40, amplitude: 26, body: B.OBSIDIAN, surface: B.PURPUR, subsurface: B.BLACKSTONE, fillBlock: B.AIR, fill: false, decor: B.CRYSTAL };
    case 'space': return { seaLevel: 44, amplitude: 10, body: B.MOON_ROCK, surface: B.MOON_ROCK, subsurface: B.DEEPSLATE, fillBlock: B.AIR, fill: false, decor: B.COMET_ICE };
    case 'frozen': return { seaLevel: 62, amplitude: 12, body: B.STONE, surface: B.SNOW, subsurface: B.ICE, fillBlock: B.WATER, fill: true, decor: B.ICE };
    case 'volcanic': return { seaLevel: 42, amplitude: 18, body: B.BASALT, surface: B.BLACKSTONE, subsurface: B.OBSIDIAN, fillBlock: B.LAVA, fill: true, decor: B.MAGMA };
    case 'crystal': return { seaLevel: 60, amplitude: 22, body: B.STONE, surface: B.CRYSTAL, subsurface: B.DEEPSLATE, fillBlock: B.AIR, fill: false, decor: B.CRYSTAL };
    case 'ocean': return { seaLevel: 70, amplitude: 8, body: B.STONE, surface: B.SAND, subsurface: B.SANDSTONE, fillBlock: B.WATER, fill: true, decor: B.PRISMARINE };
    case 'forest': return { seaLevel: 64, amplitude: 20, body: B.STONE, surface: B.GRASS, subsurface: B.DIRT, fillBlock: B.WATER, fill: true, decor: B.OAK_LOG };
    case 'mushroom': return { seaLevel: 60, amplitude: 14, body: B.STONE, surface: B.MYCELIUM, subsurface: B.DIRT, fillBlock: B.WATER, fill: true, decor: B.MYCELIUM };
    case 'storm': return { seaLevel: 52, amplitude: 24, body: B.DEEPSLATE, surface: B.BLACKSTONE, subsurface: B.SOUL_SOIL, fillBlock: B.LAVA, fill: true, decor: B.GLOWSTONE };
    case 'toxic': return { seaLevel: 50, amplitude: 12, body: B.STONE, surface: B.SOUL_SAND, subsurface: B.SOUL_SOIL, fillBlock: B.TOXIC, fill: true, decor: B.OBSIDIAN };
    case 'machine': return { seaLevel: 40, amplitude: 4, body: B.DEEPSLATE, surface: B.DEEPSLATE, subsurface: B.BLACKSTONE, fillBlock: B.AIR, fill: false, decor: B.GLOWSTONE };
    case 'dark': return { seaLevel: 56, amplitude: 26, body: B.BLACKSTONE, surface: B.SOUL_SOIL, subsurface: B.DEEPSLATE, fillBlock: B.AIR, fill: false, decor: B.OBSIDIAN };
    case 'void': return { seaLevel: 48, amplitude: 8, body: B.OBSIDIAN, surface: B.PURPUR, subsurface: B.BLACKSTONE, fillBlock: B.AIR, fill: false, decor: B.CRYSTAL };
    case 'corrupt': return { seaLevel: 58, amplitude: 28, body: B.BLACKSTONE, surface: B.OBSIDIAN, subsurface: B.DEEPSLATE, fillBlock: B.LAVA, fill: true, decor: B.CRYSTAL };
    default: return { seaLevel: 64, amplitude: 14, body: B.STONE, surface: B.GRASS, subsurface: B.DIRT, fillBlock: B.WATER, fill: true, decor: B.OAK_LOG };
  }
}

/**
 * Generate a fully distinct dimension chunk.
 */
export class DimensionTerrainGenerator {
  private readonly noise: AdvancedNoise;
  private readonly style: DimensionTerrainStyle;
  private readonly archetype: DimensionArchetype;

  constructor(dimensionId: string, seed: string) {
    this.archetype = dimensionArchetype(dimensionId);
    this.style = styleFor(this.archetype);
    this.noise = new AdvancedNoise(`${seed}:dimension:${dimensionId}`);
  }

  generate(chunk: Chunk): void {
    const s = this.style;
    const originX = chunk.x * CHUNK_SIZE;
    const originZ = chunk.z * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = originX + lx;
        const wz = originZ + lz;

        let surface: number;
        switch (this.archetype) {
          case 'end': {
            // Floating isles over the void: blobby 3D height.
            const n = this.noise.fbm2D(wx, wz, 3, 2.0, 0.5, 7);
            surface = Math.floor(s.seaLevel + (n - 0.5) * s.amplitude);
            // Lower the column centre so islands are detached globs.
            if (surface > s.seaLevel + 6) surface = s.seaLevel + 6 + Math.floor(n * 4);
            break;
          }
          case 'void': {
            // Sparse floating slabs: occasional platforms.
            const n = this.noise.fbm2D(wx, wz, 3, 2.0, 0.5, 11);
            surface = n > 0.68 ? Math.floor(s.seaLevel + (n - 0.5) * s.amplitude * 2) : -1;
            break;
          }
          case 'machine': {
            // Flat metallic platforms with occasional towers.
            const n = this.noise.fbm2D(wx, wz, 3, 2.0, 0.5, 13);
            surface = s.seaLevel + (n > 0.85 ? Math.floor((n - 0.85) * 60) : 0);
            break;
          }
          default: {
            const n = this.noise.fbm2D(wx, wz, 4, 2.0, 0.5, 3);
            surface = Math.floor(s.seaLevel + (n - 0.5) * s.amplitude * 2);
            break;
          }
        }

        const surfaceClamped = Math.max(1, Math.min(CHUNK_HEIGHT - 1, surface));

        // Fill the column.
        if (this.archetype === 'end' || this.archetype === 'void') {
          // Detached islands: only fill a shell around the surface point.
          const islandRadius = 3 + Math.floor(this.noise.hash(wx, 5, wz) * 3);
          for (let y = surfaceClamped - islandRadius; y <= surfaceClamped + islandRadius; y++) {
            if (y < 0 || y >= CHUNK_HEIGHT) continue;
            const d = Math.abs(y - surfaceClamped);
            if (d <= islandRadius) {
              const id = d === 0 ? s.surface : (d <= 1 ? s.subsurface : s.body);
              chunk.setBlock(lx, y, lz, id);
            }
          }
          // The Humorous: floating isle landmarks — crystal spires, punchline
          // arches, laugh-houses, jesting-frog ponds and glow clusters.
          if (this.archetype === 'void' && surfaceClamped > 2 && surfaceClamped < CHUNK_HEIGHT - 12) {
            this.placeHumorousStructures(chunk, lx, surfaceClamped, lz, wx, wz);
          }
          continue;
        }

        for (let y = 0; y <= surfaceClamped; y++) {
          let id: BlockID = s.body;
          if (y === surfaceClamped) id = s.surface;
          else if (y === surfaceClamped - 1) id = s.subsurface;
          chunk.setBlock(lx, y, lz, id);
        }

        // Fluid/void fill below sea level.
        if (s.fill && surfaceClamped < s.seaLevel) {
          for (let y = surfaceClamped + 1; y < s.seaLevel; y++) {
            if (chunk.getBlock(lx, y, lz) === B.AIR) chunk.setBlock(lx, y, lz, s.fillBlock);
          }
        }

        // Surface decor scattered deterministically.
        this.decorate(chunk, lx, surfaceClamped, lz, wx, wz);
      }
    }
  }

  /** Set a block only if it lands inside this chunk (bounds-safe for wide structures). */
  private setSafe(chunk: Chunk, lx: number, y: number, lz: number, id: BlockID): void {
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT) {
      chunk.setBlock(lx, y, lz, id);
    }
  }

  /**
   * Deeper The Humorous: a varied set of comedic structures on the floating
   * isles — crystal spires, punchline arches, laugh-houses, jest-frog ponds
   * and glowing particle gardens.
   */
  private placeHumorousStructures(chunk: Chunk, lx: number, surfaceY: number, lz: number, wx: number, wz: number): void {
    const r = this.noise.hash(wx, 9, wz);
    const g = this.noise.hash(wx, 10, wz);
    const base = surfaceY + 1;

    if (r > 0.992) {
      // Crystal spire crowned with a glowing Shard + light.
      const h = 5 + Math.floor(g * 4);
      for (let y = base; y <= base + h; y++) chunk.setBlock(lx, y, lz, B.CRYSTAL);
      this.setSafe(chunk, lx, base + h + 1, lz, B.SHARD);
      this.setSafe(chunk, lx, base + h + 2, lz, B.GLOWSTONE);
    } else if (r > 0.975) {
      // Punchline arch: two pillars, a plank beam overhead, a joke bauble hung.
      const h = 3 + Math.floor(g * 2);
      for (let y = base; y <= base + h; y++) chunk.setBlock(lx, y, lz, B.CRYSTAL);
      for (let dx = -3; dx <= 3; dx++) this.setSafe(chunk, lx + dx, base + h + 1, lz, B.PLANKS);
      chunk.setBlock(lx, base + h, lz, B.SHARD);
    } else if (r > 0.955) {
      // Laugh-house: a small plank cabin with a crystal roof and a glow lamp.
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const wall = Math.max(Math.abs(dx), Math.abs(dz)) === 2;
        this.setSafe(chunk, lx + dx, base, lz + dz, wall ? B.PLANKS : B.AIR);
        if (wall) this.setSafe(chunk, lx + dx, base + 1, lz + dz, B.PLANKS);
      }
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        this.setSafe(chunk, lx + dx, base + 2, lz + dz, B.CRYSTAL);
      }
      this.setSafe(chunk, lx, base + 3, lz, B.GLOWSTONE);
    } else if (r > 0.93) {
      // Jest-frog pond: a shallow bowl of water with a glowing Shard lily.
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        this.setSafe(chunk, lx + dx, base, lz + dz, B.WATER);
      }
      this.setSafe(chunk, lx, base, lz, B.SHARD);
      if (g > 0.5) this.setSafe(chunk, lx + 2, base + 1, lz, B.KELP);
    } else if (r > 0.9) {
      // Glow cluster / particle garden.
      chunk.setBlock(lx, base, lz, B.GLOWSTONE);
      this.setSafe(chunk, lx + 1, base + 1, lz, B.CRYSTAL);
      this.setSafe(chunk, lx - 1, base + 1, lz, B.SHARD);
    }
  }

  private decorate(chunk: Chunk, lx: number, surfaceY: number, lz: number, wx: number, wz: number): void {
    if (surfaceY < 2 || surfaceY >= CHUNK_HEIGHT - 6) return;
    const s = this.style;
    const r = this.noise.hash(wx, 3, wz);

    if (s.decor === B.OAK_LOG) {
      // Trees / giant trunks.
      if (r > 0.985) {
        const h = 3 + Math.floor(this.noise.hash(wx, 4, wz) * 3);
        for (let y = surfaceY + 1; y <= surfaceY + h; y++) chunk.setBlock(lx, y, lz, B.OAK_LOG);
        for (let y = surfaceY + h; y <= surfaceY + h + 2; y++) {
          for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
            const bx = lx + dx, bz = lz + dz;
            if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE) chunk.setBlock(bx, y, bz, B.OAK_LEAVES);
          }
        }
      } else if (r > 0.97) {
        chunk.setBlock(lx, surfaceY + 1, lz, B.OAK_LOG);
      }
    } else if (s.decor === B.BASALT) {
      if (r > 0.94) chunk.setBlock(lx, surfaceY + 1, lz, B.BASALT);
      if (r > 0.988) { for (let y = surfaceY + 2; y <= surfaceY + 6; y++) chunk.setBlock(lx, y, lz, B.BASALT); }
    } else if (s.decor === B.CRYSTAL) {
      if (r > 0.93) chunk.setBlock(lx, surfaceY + 1, lz, B.CRYSTAL);
      if (r > 0.985) { for (let y = surfaceY + 2; y <= surfaceY + 5; y++) chunk.setBlock(lx, y, lz, B.CRYSTAL); }
    } else if (s.decor === B.GLOWSTONE) {
      if (r > 0.95) chunk.setBlock(lx, surfaceY + 1, lz, B.GLOWSTONE);
    } else if (s.decor === B.ICE) {
      if (r > 0.9) chunk.setBlock(lx, surfaceY + 1, lz, B.ICE);
      if (r > 0.98) { for (let y = surfaceY + 2; y <= surfaceY + 6; y++) chunk.setBlock(lx, y, lz, B.ICE); }
    } else if (s.decor === B.MAGMA) {
      if (r > 0.9) chunk.setBlock(lx, surfaceY, lz, B.MAGMA);
    }
  }
}

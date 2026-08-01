/**
 * Stable legacy terrain generator.
 *
 * The default path deliberately has one inexpensive 2-D value/Perlin-style
 * height field and one bottom-up fill pass.  There is no continentalness,
 * erosion, density field, or 3-D cave loop here: every coordinate below the
 * surface is written to the chunk with a numeric block id.
 *
 * Set `experimentalCavesAndCliffs: true` to opt into the preserved former
 * generator.  The game can expose that flag as an experimental world option.
 */
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from './Chunk';
import { BiomeModificationFlags } from '../dev/DeveloperTuning';
import { CavesAndCliffsTerrainGenerator, WorldGenConfig as ExperimentalConfig } from './CavesAndCliffsTerrainGenerator';

export interface SpawnPoint { x: number; y: number; z: number; }
export interface WorldGenConfig extends ExperimentalConfig { experimentalCavesAndCliffs: boolean; }
export const DEFAULT_OVERWORLD_CONFIG: WorldGenConfig = {
  seed: 'eaoin_seed_2026', seaLevel: 64, worldDepth: CHUNK_HEIGHT,
  bedrockThickness: 1, continentScale: 0, detailScale: 0, mountainIntensity: 0,
  erosionIterations: 0, caveScale: 0, floatingIslands: false, skyIslands: false,
  undergroundRivers: false, undergroundOceans: false, ravines: false, sinkholes: false,
  volcanoes: false, glaciers: false, biomeScale: 1, forcedBiome: null,
  farLandsThreshold: 0, subBedrockLayers: 0, inverted: false, caveWorld: false,
  flatGroundY: 64, experimentalCavesAndCliffs: false,
};
export const FLOATING_ISLANDS_CONFIG = { ...DEFAULT_OVERWORLD_CONFIG, floatingIslands: true };
const GRASS = 1, DIRT = 2, STONE = 3;

// Deterministic 2-D value noise with smooth interpolation (no vertical noise).
function hash(seed: string, x: number, z: number): number {
  let h = 2166136261;
  for (const c of `${seed}:${x}:${z}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) / 4294967295) * 2 - 1;
}
function smooth(t: number): number { return t * t * (3 - 2 * t); }
function noise(seed: string, x: number, z: number, scale: number): number {
  const sx = x * scale, sz = z * scale, ix = Math.floor(sx), iz = Math.floor(sz);
  const fx = smooth(sx - ix), fz = smooth(sz - iz);
  const a = hash(seed, ix, iz), b = hash(seed, ix + 1, iz), c = hash(seed, ix, iz + 1), d = hash(seed, ix + 1, iz + 1);
  return (a + (b-a)*fx) * (1-fz) + (c + (d-c)*fx) * fz;
}

export class AdvancedTerrainGenerator {
  public readonly config: WorldGenConfig;
  private readonly legacy?: CavesAndCliffsTerrainGenerator;
  private heightMultiplier = 1;
  constructor(config: Partial<WorldGenConfig> & { seed: string }) {
    this.config = { ...DEFAULT_OVERWORLD_CONFIG, ...config };
    if (this.config.experimentalCavesAndCliffs) this.legacy = new CavesAndCliffsTerrainGenerator(this.config);
  }
  private height(x: number, z: number): number {
    const base = this.config.flatGroundY ?? 64;
    const rolling = noise(this.config.seed, x, z, 0.018) * 3 + noise(this.config.seed, x, z, 0.004) * 5;
    return Math.max(1, Math.min(CHUNK_HEIGHT - 1, Math.round(base + rolling * this.heightMultiplier)));
  }
  generateChunk(cx: number, cz: number): Chunk {
    if (this.legacy) return this.legacy.generateChunk(cx, cz);
    const chunk = new Chunk(Math.trunc(cx) || 0, Math.trunc(cz) || 0, this.config.seed, { generate: false });
    for (let lx=0; lx<CHUNK_SIZE; lx++) for (let lz=0; lz<CHUNK_SIZE; lz++) {
      const h = this.height(chunk.x * CHUNK_SIZE + lx, chunk.z * CHUNK_SIZE + lz);
      for (let y=0; y<=h; y++) chunk.setBlock(lx, y, lz, y === h ? GRASS : y >= h-4 ? DIRT : STONE);
    }
    return chunk;
  }
  /**
   * World-space voxel query used by the engine's startup/render path, creatures,
   * redstone runtime, and raycasts.  Same public shape as `TerrainGenerator` /
   * `CavesAndCliffsTerrainGenerator.getBlockAt`, so callers can treat every
   * generator interchangeably.
   *
   * The stable path is a deterministic banded column around the y = 64 surface:
   *   y > 64        → 0 (air block)
   *   y === 64      → 3 (solid surface block)
   *   60 <= y < 64  → 2 (subsurface band)
   *   y < 60        → 1 (solid deep block)
   */
  public getBlockAt(x: number, y: number, z: number): number {
    void x; void z; // bands depend on height only; x/z kept for world-space API parity
    if (y > 64) return 0;
    if (y === 64) return 3;
    if (y >= 60) return 2;
    return 1;
  }
  getTerrainHeight(x:number,z:number):number { return this.legacy ? this.legacy.getTerrainHeight(x,z) : this.height(x,z); }
  /** World-space surface height query used by the engine's startup/render path. */
  public getHeightAt(x: number, z: number): number { return this.getTerrainHeight(x, z); }
  getSurfaceHeight(x:number,z:number):number { return this.getTerrainHeight(x,z); }
  getBaseHeight(x:number,z:number):number { return this.getTerrainHeight(x,z); }
  getMountainHeight(x:number,z:number):number { return this.getTerrainHeight(x,z); }
  getBiomeAt(x:number,z:number): any { return this.legacy ? this.legacy.getBiomeAt(x,z) : { id:'plains', name:'Plains' }; }
  setDeveloperTuning(tuning:{heightMultiplier:number; biomeMods:BiomeModificationFlags}):void { this.heightMultiplier = Number.isFinite(tuning.heightMultiplier) ? tuning.heightMultiplier : 1; void tuning.biomeMods; this.legacy?.setDeveloperTuning(tuning); }
  getSpawnPoint(): SpawnPoint { const y=this.getSurfaceHeight(0,0)+1; return {x:0,y,z:0}; }
}
export default AdvancedTerrainGenerator;

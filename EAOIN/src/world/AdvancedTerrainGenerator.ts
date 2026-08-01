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
import { BlockID } from '../../shared/src/blocks/BlockRegistry';
import { WorldBlockEdit } from './WorldSave';
import { CavesAndCliffsTerrainGenerator, WorldGenConfig as ExperimentalConfig } from './CavesAndCliffsTerrainGenerator';

export interface SpawnPoint { x: number; y: number; z: number; }
export interface WorldGenConfig extends ExperimentalConfig { experimentalCavesAndCliffs: boolean; }
export const DEFAULT_OVERWORLD_CONFIG: WorldGenConfig = {
  seed: 'eaoin_seed_2026', seaLevel: 32, worldDepth: CHUNK_HEIGHT,
  bedrockThickness: 4, continentScale: 0.0012, detailScale: 0.018, mountainIntensity: 1.4,
  erosionIterations: 1, caveScale: 2, floatingIslands: false, skyIslands: false,
  undergroundRivers: true, undergroundOceans: true, ravines: true, sinkholes: true,
  volcanoes: true, glaciers: true, biomeScale: 1, forcedBiome: null,
  farLandsThreshold: 0, subBedrockLayers: 0, inverted: false, caveWorld: false,
  flatGroundY: null, experimentalCavesAndCliffs: true,
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
   * With the full Minecraft-style generator enabled (`this.legacy`), every
   * query delegates straight to it so the voxels the engine reads match the
   * mesh that was generated. The simple banded fallback below is only used
   * when the full generator is disabled.
   */
  public getBlockAt(x: number, y: number, z: number): number {
    if (this.legacy) return this.legacy.getBlockAt(x, y, z);
    void x; void z; // bands depend on height only; x/z kept for world-space API parity
    if (y > 64) return 0;
    if (y === 64) return 3;
    if (y >= 60) return 2;
    return 1;
  }
  getTerrainHeight(x:number,z:number):number { return this.legacy ? this.legacy.getTerrainHeight(x,z) : this.height(x,z); }
  /** World-space surface height query used by the engine's startup/render path. */
  public getHeightAt(x: number, z: number): number { return this.getTerrainHeight(x, z); }
  getSurfaceHeight(x:number,z:number):number { return this.legacy ? this.legacy.getSurfaceHeight(x,z) : this.getTerrainHeight(x,z); }
  getBaseHeight(x:number,z:number):number { return this.legacy ? this.legacy.getBaseHeight(x,z) : this.getTerrainHeight(x,z); }
  getMountainHeight(x:number,z:number):number { return this.legacy ? this.legacy.getMountainHeight(x,z) : this.getTerrainHeight(x,z); }
  getBiomeAt(x:number,z:number): any { return this.legacy ? this.legacy.getBiomeAt(x,z) : { id:'plains', name:'Plains' }; }
  setBlockAt(x: number, y: number, z: number, block: BlockID): boolean {
    if (this.legacy) return this.legacy.setBlockAt(x, y, z, block);
    return false;
  }
  getEdits(): WorldBlockEdit[] { return this.legacy ? this.legacy.getEdits() : []; }
  getEditCount(): number { return this.legacy ? this.legacy.getEditCount() : 0; }
  invalidateGeneratedChunks(): void { if (this.legacy) this.legacy.invalidateGeneratedChunks(); }
  setDeveloperTuning(tuning:{heightMultiplier:number; biomeMods:BiomeModificationFlags}):void { this.heightMultiplier = Number.isFinite(tuning.heightMultiplier) ? tuning.heightMultiplier : 1; void tuning.biomeMods; this.legacy?.setDeveloperTuning(tuning); }
  getSpawnPoint(): SpawnPoint {
    // The camera's Y is the *eye*, and the player stands 1.62 blocks tall
    // (PLAYER_EYE_HEIGHT). Placing the eye exactly at surfaceHeight + 1.62
    // puts the boots directly on the grass top. Earlier values of +1 (feet
    // embedded in the block) or +3.0 (feet hovering above it) were both wrong.
    const surfaceHeight = this.getTerrainHeight(0, 0);
    return { x: 0, y: surfaceHeight + 1.62, z: 0 };
  }
}
export default AdvancedTerrainGenerator;

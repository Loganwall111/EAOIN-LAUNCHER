/**
 * TerrainGenerator — 3.2 Improved: Proper Minecraft-like noise maps,
 * bigger mountains, caves, cliffs, flat areas, volumetric but square.
 * Keeps spawn 26m clear and objective clearings.
 */
import { BlockID } from '@shared/blocks/BlockRegistry';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from './Chunk';
import { editKey, WorldBlockEdit } from './WorldSave';
import { getWorldLayout, SPAWN_PROTECTED_RADIUS } from './WorldDistribution';

export interface SpawnPoint { x: number; y: number; z: number; }
export type BiomeID = 'Plains' | 'Forest' | 'Desert' | 'Highlands' | 'Lake' | 'Mountains' | 'Cliff';

const WATER_LEVEL = 7;
const SPAWN_GROUND_Y = 9;
const BASE_GROUND = 14;

export class TerrainGenerator {
  private readonly chunks = new Map<string, Chunk>();
  private readonly editOverrides = new Map<string, WorldBlockEdit>();
  private cachedLayout: ReturnType<typeof getWorldLayout> | null = null;

  constructor(private readonly seed: string, initialEdits: WorldBlockEdit[] = []) {
    for (const edit of initialEdits) this.editOverrides.set(editKey(edit.x, edit.y, edit.z), { ...edit });
  }

  private getLayout(): ReturnType<typeof getWorldLayout> {
    if (!this.cachedLayout) this.cachedLayout = getWorldLayout(this.seed, { x: 0.5, y: SPAWN_GROUND_Y + 1.95, z: 0.5 });
    return this.cachedLayout!;
  }

  generateChunk(cx: number, cz: number): Chunk {
    const key = this.chunkKey(cx, cz);
    const cached = this.chunks.get(key);
    if (cached) return cached;
    const chunk = new Chunk(cx, cz, this.seed);
    this.applyHeightmapPass(chunk); // NEW: smooth noise terrain
    this.applyCavePass(chunk); // NEW: volumetric caves
    this.applyBiomeSurfacePass(chunk);
    this.addProceduralWorldContent(chunk);
    this.applyPlayableSpawnPatch(chunk);
    this.applyObjectiveClearings(chunk);
    this.addDispersedLandmarks(chunk);
    this.applySavedEdits(chunk);
    this.chunks.set(key, chunk);
    return chunk;
  }

  generateChunkGrid(radius: number): Chunk[] {
    const chunks: Chunk[] = [];
    for (let cx = -radius; cx <= radius; cx += 1) for (let cz = -radius; cz <= radius; cz += 1) chunks.push(this.generateChunk(cx, cz));
    return chunks;
  }

  getBlockAt(worldX: number, y: number, worldZ: number): BlockID {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    const a = this.toChunkAddress(worldX, worldZ);
    return this.generateChunk(a.cx, a.cz).getBlock(a.lx, y, a.lz);
  }

  setBlockAt(worldX: number, y: number, worldZ: number, block: BlockID): boolean {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    const a = this.toChunkAddress(worldX, worldZ);
    const chunk = this.generateChunk(a.cx, a.cz);
    chunk.setBlock(a.lx, y, a.lz, block);
    this.editOverrides.set(editKey(a.worldX, y, a.worldZ), { x: a.worldX, y, z: a.worldZ, block });
    return true;
  }

  getEdits(): WorldBlockEdit[] { return Array.from(this.editOverrides.values()).map(e => ({ ...e })); }
  getEditCount(): number { return this.editOverrides.size; }

  getHeightAt(worldX: number, worldZ: number): number {
    const x = Math.floor(worldX), z = Math.floor(worldZ);
    // Use heightmap directly for speed instead of scanning after generation
    const h = this.getTerrainHeight(x, z);
    return h;
  }

  getBiomeAt(worldX: number, worldZ: number): BiomeID {
    if (this.getLakeDepth(worldX, worldZ) > 0.12) return 'Lake';
    const height = this.getTerrainHeight(worldX, worldZ);
    const ridge = this.ridgeNoise(worldX * 0.006, worldZ * 0.006);
    const flat = this.flatMask(worldX, worldZ);
    if (height > 48 && ridge > 0.72) return 'Mountains';
    if (height > 38 && ridge > 0.62) return 'Cliff';
    const heat = this.smoothValue(worldX, worldZ, 'heat');
    const moist = this.smoothValue(worldX, worldZ, 'moisture');
    const rocky = this.smoothValue(worldX, worldZ, 'rockiness');
    if (flat > 0.7 && height < 24) return 'Plains';
    if (rocky > 0.68) return 'Highlands';
    if (heat > 0.58 && moist < 0.45) return 'Desert';
    if (moist > 0.54) return 'Forest';
    return 'Plains';
  }

  getSpawnPoint(): SpawnPoint {
    const x = 0.5, z = 0.5;
    const groundY = this.getTerrainHeight(Math.floor(x), Math.floor(z));
    return { x, y: groundY + 1.95, z };
  }

  // === NEW NOISE SYSTEM — Minecraft-like ===

  private hash(x: number, y: number, z: number = 0): number {
    // deterministic hash
    let h = 2166136261 ^ (this.hashStr(this.seed) >>> 0);
    h ^= x * 374761393; h = Math.imul(h, 668265263);
    h ^= y * 668265263; h = Math.imul(h, 374761393);
    h ^= z * 1274126177; h = Math.imul(h, 1274126177);
    h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
    return (h >>> 0) / 0xffffffff;
  }

  private hashStr(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  private smoothstep(t: number): number { return t * t * (3 - 2 * t); }
  private lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

  private valueNoise2D(x: number, z: number): number {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const u = this.smoothstep(xf), v = this.smoothstep(zf);
    const n00 = this.hash(xi, zi);
    const n10 = this.hash(xi + 1, zi);
    const n01 = this.hash(xi, zi + 1);
    const n11 = this.hash(xi + 1, zi + 1);
    const nx0 = this.lerp(n00, n10, u);
    const nx1 = this.lerp(n01, n11, u);
    return this.lerp(nx0, nx1, v);
  }

  private valueNoise3D(x: number, y: number, z: number): number {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = this.smoothstep(xf), v = this.smoothstep(yf), w = this.smoothstep(zf);
    const c000 = this.hash(xi, yi, zi);
    const c100 = this.hash(xi + 1, yi, zi);
    const c010 = this.hash(xi, yi + 1, zi);
    const c110 = this.hash(xi + 1, yi + 1, zi);
    const c001 = this.hash(xi, yi, zi + 1);
    const c101 = this.hash(xi + 1, yi, zi + 1);
    const c011 = this.hash(xi, yi + 1, zi + 1);
    const c111 = this.hash(xi + 1, yi + 1, zi + 1);
    const x00 = this.lerp(c000, c100, u);
    const x10 = this.lerp(c010, c110, u);
    const x01 = this.lerp(c001, c101, u);
    const x11 = this.lerp(c011, c111, u);
    const y0 = this.lerp(x00, x10, v);
    const y1 = this.lerp(x01, x11, v);
    return this.lerp(y0, y1, w);
  }

  private fbm2D(x: number, z: number, octaves = 5): number {
    let sum = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.valueNoise2D(x * freq, z * freq) * amp;
      max += amp;
      amp *= 0.5; freq *= 2.02;
    }
    return sum / max;
  }

  private fbm3D(x: number, y: number, z: number, octaves = 3): number {
    let sum = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.valueNoise3D(x * freq, y * freq, z * freq) * amp;
      max += amp;
      amp *= 0.48; freq *= 2.0;
    }
    return sum / max;
  }

  private ridgeNoise(x: number, z: number): number {
    const n = this.fbm2D(x, z, 4);
    return 1 - Math.abs(n * 2 - 1); // sharp ridges
  }

  private flatMask(worldX: number, worldZ: number): number {
    // low freq noise decides flat areas
    return this.fbm2D(worldX * 0.0022, worldZ * 0.0022, 3);
  }

  private cliffFactor(worldX: number, worldZ: number): number {
    // high freq gradient noise for cliffs
    const n = this.fbm2D(worldX * 0.018, worldZ * 0.018, 3);
    const gradX = this.fbm2D((worldX + 1) * 0.018, worldZ * 0.018, 3) - n;
    const gradZ = this.fbm2D(worldX * 0.018, (worldZ + 1) * 0.018, 3) - n;
    return Math.hypot(gradX, gradZ) * 8.5;
  }

  // Core height function — smooth, mountains, cliffs, flats
  private getTerrainHeight(worldX: number, worldZ: number): number {
    // Protected spawn will be overridden later, but for height consistency return flat near 0,0
    if (Math.hypot(worldX, worldZ) < SPAWN_PROTECTED_RADIUS + 2) return SPAWN_GROUND_Y;

    // Objective clearings keep flat
    const layout = this.getLayout();
    for (const p of [layout.rocket, layout.settlement, layout.portalCore, layout.palette, layout.marketplace, layout.woodenDoor, layout.dimensionalDoor]) {
      if (Math.hypot(worldX - p.x, worldZ - p.z) < p.radius + 2) return SPAWN_GROUND_Y + 1;
    }

    const baseLow = this.fbm2D(worldX * 0.0035, worldZ * 0.0035, 5); // 0-1 large continents
    const baseMed = this.fbm2D(worldX * 0.012, worldZ * 0.012, 4) * 0.35;
    const baseHigh = this.fbm2D(worldX * 0.045, worldZ * 0.045, 2) * 0.12;

    let height = BASE_GROUND + baseLow * 28 + baseMed * 12 + baseHigh * 5;

    // Flat areas: lerp towards 20 if flatMask high and baseLow mid
    const flat = this.flatMask(worldX, worldZ);
    if (flat > 0.62) {
      const t = (flat - 0.62) / 0.38; // 0-1
      height = this.lerp(height, 19 + this.fbm2D(worldX * 0.008, worldZ * 0.008, 2) * 3, t * 0.85);
    }

    // Mountains: ridge boost
    const ridge = this.ridgeNoise(worldX * 0.0055, worldZ * 0.0055);
    if (ridge > 0.58 && baseLow > 0.45) {
      const mountainBoost = (ridge - 0.58) / 0.42; // 0-1
      height += mountainBoost * mountainBoost * 34; // up to +34 blocks -> big mountains
    }

    // Cliffs: steep edge adds wall
    const cliff = this.cliffFactor(worldX, worldZ);
    if (cliff > 0.62 && height > 24) {
      height += cliff * 6.5; // cliff wall
    }

    // Additional small variation for non-flat
    height += (this.hash(worldX, worldZ) - 0.5) * 1.2;

    // Clamp
    height = Math.max(6, Math.min(CHUNK_HEIGHT - 28, Math.round(height)));
    return height;
  }

  // === PASSES ===

  private applyHeightmapPass(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (localX, localZ, worldX, worldZ) => {
      const height = this.getTerrainHeight(worldX, worldZ);
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        if (y <= height - 4) chunk.setBlock(localX, y, localZ, 3); // stone foundation
        else if (y <= height - 1) chunk.setBlock(localX, y, localZ, 2); // dirt
        else if (y === height) {
          // surface will be painted by biome pass, but set grass default
          chunk.setBlock(localX, y, localZ, 1);
        } else {
          chunk.setBlock(localX, y, localZ, 0);
        }
      }
    });
  }

  private applyCavePass(chunk: Chunk): void {
    // Volumetric caves: 3D fbm threshold
    this.forEachLocalBlock(chunk, (localX, localZ, worldX, worldZ) => {
      const surfaceY = this.findSurfaceY(chunk, localX, localZ);
      if (surfaceY <= 0) return;
      // Don't carve near spawn clearings or objective clearings
      if (this.isProtectedSpawnColumn(worldX, worldZ, SPAWN_PROTECTED_RADIUS + 2)) return;
      if (this.isInObjectiveClearing(worldX, worldZ)) return;
      // carve only below surface -2
      for (let y = surfaceY - 3; y >= 4; y--) {
        // Bigger caves deeper
        const depthFactor = (surfaceY - y) / surfaceY; // 0 near surface, 1 deep
        const threshold = 0.62 - depthFactor * 0.08; // deeper caves easier to carve
        const n = this.fbm3D(worldX * 0.022, y * 0.022, worldZ * 0.022, 3);
        const n2 = this.fbm3D(worldX * 0.065, y * 0.065, worldZ * 0.065, 2) * 0.35;
        const caveNoise = n + n2;
        if (caveNoise > threshold) {
          // carve air, but keep roof 2 thick near surface to avoid holes? For big caves allow surface entry occasionally
          const roofSafe = y > surfaceY - 5 && caveNoise > 0.72 ? false : true;
          if (roofSafe || caveNoise > 0.74) {
            chunk.setBlock(localX, y, localZ, 0);
            // occasionally make cave a bit wider (3x3-ish) for bigger caves
            if (caveNoise > 0.76 && y > 8 && y < surfaceY - 6) {
              if (localX > 0) chunk.setBlock(localX - 1, y, localZ, 0);
              if (localZ > 0) chunk.setBlock(localX, y, localZ - 1, 0);
            }
          }
        }
      }
    });
  }

  private applyBiomeSurfacePass(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (localX, localZ, worldX, worldZ) => {
      if (this.isProtectedSpawnColumn(worldX, worldZ, SPAWN_PROTECTED_RADIUS)) return;
      if (this.isInObjectiveClearing(worldX, worldZ)) return;
      const lakeDepth = this.getLakeDepth(worldX, worldZ);
      if (lakeDepth > 0.12) { this.carveLakeColumn(chunk, localX, localZ, lakeDepth); return; }
      const surfaceY = this.findSurfaceY(chunk, localX, localZ);
      if (surfaceY <= 0) return;
      const biome = this.getBiomeAt(worldX, worldZ);
      if (biome === 'Desert') this.paintSurfaceLayer(chunk, localX, localZ, surfaceY, 4, 4, 2);
      else if (biome === 'Highlands' || biome === 'Mountains') {
        this.paintSurfaceLayer(chunk, localX, localZ, surfaceY, 3, 3, 1);
        if (this.hashToUnit(`surface-ore:${worldX}:${worldZ}`) > 0.965) chunk.setBlock(localX, surfaceY, localZ, this.pickOreBlock(worldX, worldZ));
      } else if (biome === 'Cliff') {
        this.paintSurfaceLayer(chunk, localX, localZ, surfaceY, 3, 3, 0);
      } else this.paintSurfaceLayer(chunk, localX, localZ, surfaceY, 1, 2, 2);
    });
  }

  private addProceduralWorldContent(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (localX, localZ, worldX, worldZ) => {
      if (this.isProtectedSpawnColumn(worldX, worldZ, SPAWN_PROTECTED_RADIUS + 4)) return;
      if (this.isInObjectiveClearing(worldX, worldZ)) return;
      const biome = this.getBiomeAt(worldX, worldZ);
      if (biome === 'Lake') return;
      const surfaceY = this.findSurfaceY(chunk, localX, localZ);
      if (surfaceY <= 0 || chunk.getBlock(localX, surfaceY, localZ) === 5) return;
      if (biome === 'Forest' && this.isFeatureAnchor(worldX, worldZ, 9, 'forest-tree')) this.placeTreeAt(chunk, worldX, surfaceY, worldZ, 4 + Math.floor(this.hashToUnit(`tree-height:${worldX}:${worldZ}`) * 3));
      if (biome === 'Plains' && this.isFeatureAnchor(worldX, worldZ, 24, 'plains-tree')) this.placeTreeAt(chunk, worldX, surfaceY, worldZ, 3);
      if ((biome === 'Highlands' || biome === 'Plains' || biome === 'Mountains') && this.isFeatureAnchor(worldX, worldZ, 17, 'boulder')) this.placeBoulderAt(chunk, worldX, surfaceY, worldZ, biome === 'Highlands' || biome === 'Mountains' ? 2 : 1);
      if ((biome === 'Highlands' || biome === 'Mountains') && this.isFeatureAnchor(worldX, worldZ, 13, 'ore-outcrop')) this.placeOreOutcropAt(chunk, worldX, surfaceY, worldZ);
      if (this.isFeatureAnchor(worldX, worldZ, 41, 'ruin') && this.hashToUnit(`ruin-gate:${worldX}:${worldZ}`) > 0.62) this.placeStarterRuinAt(chunk, worldX, surfaceY, worldZ, biome);
    });
  }

  private applySavedEdits(chunk: Chunk): void {
    for (const edit of this.editOverrides.values()) {
      const a = this.toChunkAddress(edit.x, edit.z);
      if (a.cx === chunk.x && a.cz === chunk.z) chunk.setBlock(a.lx, edit.y, a.lz, edit.block);
    }
    chunk.modified = false;
  }

  private applyPlayableSpawnPatch(chunk: Chunk): void {
    this.forEachLocalBlock(chunk, (localX, localZ, worldX, worldZ) => {
      const dist = Math.hypot(worldX, worldZ);
      if (dist > SPAWN_PROTECTED_RADIUS) return;
      const groundY = SPAWN_GROUND_Y;
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        if (y < groundY - 4) chunk.setBlock(localX, y, localZ, 3);
        else if (y < groundY) chunk.setBlock(localX, y, localZ, 2);
        else if (y === groundY) chunk.setBlock(localX, y, localZ, 1);
        else if (y <= groundY + 4) chunk.setBlock(localX, y, localZ, 0);
      }
    });
  }

  private applyObjectiveClearings(chunk: Chunk): void {
    const layout = this.getLayout();
    const clearings = [layout.rocket, layout.settlement, layout.portalCore, layout.woodenDoor, layout.dimensionalDoor, layout.palette, layout.marketplace] as Array<{ x: number; z: number; radius: number; label: string }>;
    this.forEachLocalBlock(chunk, (localX, localZ, worldX, worldZ) => {
      for (const c of clearings) {
        const d = Math.hypot(worldX - c.x, worldZ - c.z);
        if (d <= c.radius) {
          const groundY = SPAWN_GROUND_Y + 1;
          for (let y = 0; y < CHUNK_HEIGHT; y++) {
            if (y < groundY - 3) chunk.setBlock(localX, y, localZ, 3);
            else if (y < groundY) chunk.setBlock(localX, y, localZ, 2);
            else if (y === groundY) chunk.setBlock(localX, y, localZ, c.label === 'rocket' ? 3 : 1);
            else if (y <= groundY + 6) chunk.setBlock(localX, y, localZ, 0);
          }
          break;
        }
      }
    });
  }

  private addDispersedLandmarks(chunk: Chunk): void {
    const layout = this.getLayout();
    this.forEachLocalBlock(chunk, (localX, localZ, worldX, worldZ) => {
      const palette: BlockID[] = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12];
      const dx = worldX - Math.round(layout.palette.x);
      const dz = worldZ - Math.round(layout.palette.z);
      if (dz === 0 && dx >= 0 && dx < palette.length) {
        chunk.setBlock(localX, SPAWN_GROUND_Y + 1, localZ, palette[dx]);
        chunk.setBlock(localX, SPAWN_GROUND_Y + 2, localZ, 0);
        chunk.setBlock(localX, SPAWN_GROUND_Y + 3, localZ, 0);
      }
      const pDist = Math.hypot(worldX - layout.pirate.x, worldZ - layout.pirate.z);
      if (pDist < 4) {
        for (let y = 0; y < WATER_LEVEL; y++) if (chunk.getBlock(localX, y, localZ) === 0) chunk.setBlock(localX, y, localZ, 3);
        chunk.setBlock(localX, WATER_LEVEL, localZ, 5);
        for (let y = WATER_LEVEL + 1; y < SPAWN_GROUND_Y + 2; y++) chunk.setBlock(localX, y, localZ, 0);
      }
    });
  }

  // helpers
  private carveLakeColumn(chunk: Chunk, localX: number, localZ: number, depth: number): void {
    const bottomY = Math.max(2, WATER_LEVEL - 1 - Math.floor(depth * 3));
    chunk.setBlock(localX, bottomY - 1, localZ, 4);
    for (let y = bottomY; y <= WATER_LEVEL; y++) chunk.setBlock(localX, y, localZ, 5);
    for (let y = WATER_LEVEL + 1; y < CHUNK_HEIGHT; y++) chunk.setBlock(localX, y, localZ, 0);
  }

  private paintSurfaceLayer(chunk: Chunk, localX: number, localZ: number, surfaceY: number, topBlock: BlockID, fillBlock: BlockID, fillDepth: number): void {
    chunk.setBlock(localX, surfaceY, localZ, topBlock);
    for (let depth = 1; depth <= fillDepth; depth++) { const y = surfaceY - depth; if (y > 0) chunk.setBlock(localX, y, localZ, fillBlock); }
  }

  private findSurfaceY(chunk: Chunk, localX: number, localZ: number): number {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) { const id = chunk.getBlock(localX, y, localZ); if (id !== 0 && id !== 5) return y; }
    return 0;
  }

  private pickOreBlock(worldX: number, worldZ: number): BlockID {
    const r = this.hashToUnit(`ore:${worldX}:${worldZ}`);
    if (r > 0.94) return 11; if (r > 0.82) return 10; if (r > 0.56) return 9; return 8;
  }

  private placeTreeAt(chunk: Chunk, worldX: number, surfaceY: number, worldZ: number, height: number): void {
    for (let y = surfaceY + 1; y <= surfaceY + height; y++) this.setBlockIfInChunk(chunk, worldX, y, worldZ, 6);
    const base = surfaceY + height - 1;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { const d = Math.abs(dx) + Math.abs(dz); for (let dy = 0; dy <= 2; dy++) if (d <= 3 - Math.max(0, dy - 1)) this.setBlockIfInChunk(chunk, worldX + dx, base + dy, worldZ + dz, 7); }
  }

  private placeBoulderAt(chunk: Chunk, worldX: number, surfaceY: number, worldZ: number, radius: number): void {
    for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) { const d = Math.abs(dx) + Math.abs(dz); const h = Math.max(1, radius + 2 - d); for (let dy = 1; dy <= h; dy++) this.setBlockIfInChunk(chunk, worldX + dx, surfaceY + dy, worldZ + dz, 3); }
  }

  private placeOreOutcropAt(chunk: Chunk, worldX: number, surfaceY: number, worldZ: number): void {
    const ore = this.pickOreBlock(worldX, worldZ);
    this.placeBoulderAt(chunk, worldX, surfaceY, worldZ, 1);
    this.setBlockIfInChunk(chunk, worldX, surfaceY + 2, worldZ, ore);
    this.setBlockIfInChunk(chunk, worldX + 1, surfaceY + 1, worldZ, ore);
    this.setBlockIfInChunk(chunk, worldX, surfaceY + 1, worldZ - 1, ore);
  }

  private placeStarterRuinAt(chunk: Chunk, worldX: number, surfaceY: number, worldZ: number, biome: BiomeID): void {
    const wall: BlockID = biome === 'Desert' ? 4 : 3;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -2; dz <= 2; dz++) {
      const wx = worldX + dx, wz = worldZ + dz;
      const border = Math.abs(dx) === 3 || Math.abs(dz) === 2;
      this.setBlockIfInChunk(chunk, wx, surfaceY + 1, wz, wall);
      if (border && this.hashToUnit(`ruin-break:${wx}:${wz}`) > 0.28) {
        this.setBlockIfInChunk(chunk, wx, surfaceY + 2, wz, wall);
        if (this.hashToUnit(`ruin-tall:${wx}:${wz}`) > 0.72) this.setBlockIfInChunk(chunk, wx, surfaceY + 3, wz, wall);
      } else if (!border) { this.setBlockIfInChunk(chunk, wx, surfaceY + 2, wz, 0); this.setBlockIfInChunk(chunk, wx, surfaceY + 3, wz, 0); }
    }
    this.setBlockIfInChunk(chunk, worldX, surfaceY + 2, worldZ, this.pickOreBlock(worldX + 3, worldZ - 3));
  }

  private setBlockIfInChunk(chunk: Chunk, worldX: number, y: number, worldZ: number, block: BlockID): void {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const lx = worldX - chunk.x * CHUNK_SIZE, lz = worldZ - chunk.z * CHUNK_SIZE;
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
    chunk.setBlock(lx, y, lz, block);
  }

  private isFeatureAnchor(worldX: number, worldZ: number, spacing: number, salt: string): boolean {
    const cellX = Math.floor(worldX / spacing), cellZ = Math.floor(worldZ / spacing);
    const startX = cellX * spacing, startZ = cellZ * spacing;
    const ox = Math.floor(this.hashToUnit(`${salt}:x:${cellX}:${cellZ}`) * spacing);
    const oz = Math.floor(this.hashToUnit(`${salt}:z:${cellX}:${cellZ}`) * spacing);
    return worldX === startX + ox && worldZ === startZ + oz;
  }

  private getLakeDepth(worldX: number, worldZ: number): number {
    if (this.isProtectedSpawnColumn(worldX, worldZ, SPAWN_PROTECTED_RADIUS + 8)) return 0;
    const spacing = 48, cellX = Math.floor(worldX / spacing), cellZ = Math.floor(worldZ / spacing);
    let depth = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const lx = cellX + dx, lz = cellZ + dz;
      const centerX = lx * spacing + Math.floor(this.hashToUnit(`lake-x:${lx}:${lz}`) * spacing);
      const centerZ = lz * spacing + Math.floor(this.hashToUnit(`lake-z:${lx}:${lz}`) * spacing);
      const radius = 8 + this.hashToUnit(`lake-radius:${lx}:${lz}`) * 9;
      const dist = Math.hypot(worldX - centerX, worldZ - centerZ);
      depth = Math.max(depth, 1 - dist / radius);
    }
    return Math.max(0, depth);
  }

  private smoothValue(worldX: number, worldZ: number, salt: string): number {
    const offset = this.hashToUnit(`smooth:${salt}`) * 2000;
    const v = Math.sin((worldX + offset) * 0.023) + Math.cos((worldZ - offset) * 0.031) + Math.sin((worldX + worldZ + offset) * 0.015);
    return Math.max(0, Math.min(1, v / 6 + 0.5));
  }

  private isProtectedSpawnColumn(worldX: number, worldZ: number, radius: number): boolean { return Math.hypot(worldX, worldZ) <= radius; }
  private isInObjectiveClearing(worldX: number, worldZ: number): boolean {
    const layout = this.getLayout();
    const pts = [layout.rocket, layout.settlement, layout.portalCore, layout.marketplace, layout.palette];
    for (const p of pts) if (Math.hypot(worldX - p.x, worldZ - p.z) <= p.radius + 1) return true;
    return false;
  }

  private hashToUnit(str: string): number {
    let h = 2166136261;
    const full = `${this.seed}:${str}`;
    for (let i = 0; i < full.length; i++) { h ^= full.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 0xffffffff;
  }

  private chunkKey(cx: number, cz: number): string { return `${cx}:${cz}`; }
  private toChunkAddress(worldX: number, worldZ: number): { cx: number; cz: number; lx: number; lz: number; worldX: number; worldZ: number } {
    const x = Math.floor(worldX), z = Math.floor(worldZ);
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    return { cx, cz, lx: x - cx * CHUNK_SIZE, lz: z - cz * CHUNK_SIZE, worldX: x, worldZ: z };
  }
  private forEachLocalBlock(chunk: Chunk, visit: (localX: number, localZ: number, worldX: number, worldZ: number) => void): void {
    for (let localX = 0; localX < CHUNK_SIZE; localX++) for (let localZ = 0; localZ < CHUNK_SIZE; localZ++) {
      const worldX = chunk.x * CHUNK_SIZE + localX, worldZ = chunk.z * CHUNK_SIZE + localZ;
      visit(localX, localZ, worldX, worldZ);
    }
    chunk.modified = false;
  }
}

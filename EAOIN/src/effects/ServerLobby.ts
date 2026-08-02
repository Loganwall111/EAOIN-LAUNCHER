/**
 * ServerLobby — prebuilt, block-built lobbies for each server type.
 *
 * Joining a server drops you into a real voxel city (not a flat empty world).
 * Each 16×16 chunk is one self-contained city block with a central plaza,
 * radiating roads, varied themed buildings, lampposts, decorative foliage and
 * a perimeter wall — so the whole render radius forms a dense, walkable city.
 *
 *   survival   → wooden town hall, farm, stone walls
 *   creative   → big flat build plots with scaffolding
 *   mmo        → castle keep + market
 *   skyblock   → small floating island hub
 *   minigame   → arena + bleachers
 *   roleplay   → tavern + town square
 *   modded     → tech lab with glowing blocks
 *   anarchy    → cratered ruins
 *   hardcore   → sparse fortified outpost
 */
import { Chunk, CHUNK_SIZE } from '../world/Chunk';
import { AdvancedNoise } from '../world/AdvancedNoise';
import type { ServerType } from '../networking/ServerBrowser';

export interface LobbyPalette {
  plaza: number;
  wall: number;
  roof: number;
  path: number;
  accent: number;
  glow: number;
}

const PALETTES: Record<ServerType, LobbyPalette> = {
  survival: { plaza: 1, wall: 24, roof: 34, path: 4, accent: 6, glow: 49 },
  creative: { plaza: 28, wall: 24, roof: 35, path: 4, accent: 102, glow: 49 },
  mmo: { plaza: 35, wall: 3, roof: 42, path: 4, accent: 12, glow: 49 },
  skyblock: { plaza: 2, wall: 23, roof: 220, path: 4, accent: 40, glow: 49 },
  minigames: { plaza: 24, wall: 35, roof: 102, path: 4, accent: 14, glow: 49 },
  minigame_pvp: { plaza: 24, wall: 35, roof: 102, path: 4, accent: 14, glow: 49 },
  roleplay: { plaza: 24, wall: 6, roof: 34, path: 4, accent: 20, glow: 49 },
  modded: { plaza: 28, wall: 29, roof: 35, path: 4, accent: 186, glow: 49 },
};

function paletteFor(t: ServerType): LobbyPalette {
  return PALETTES[t] ?? PALETTES.survival;
}

type District = 'plaza' | 'suburb' | 'tower' | 'dock';

/** Which city district a chunk belongs to, so the city keeps growing in every direction. */
function districtFor(t: ServerType, cx: number, cz: number): District {
  // The origin block is always the grand central plaza.
  if (cx === 0 && cz === 0) return 'plaza';
  const h = new AdvancedNoise(`district:${t}`).hash(cx, cz, 0);
  if (t === 'skyblock') return h > 0.6 ? 'suburb' : 'plaza';
  if (h > 0.82) return 'dock';
  if (h > 0.52) return 'tower';
  return 'suburb';
}

/** Chunk-local building height at a city-block cell (0 = open ground / road). */
function buildingHeight(t: ServerType, district: District, noise: AdvancedNoise, lx: number, lz: number): number {
  const distC = Math.max(Math.abs(lx - 8), Math.abs(lz - 8)); // from block centre
  if (district === 'dock' && lx === 8) return 0;  // canal runs through the middle of docks
  if (distC <= 2) return 0;   // plaza + fountain
  if (lx === 8 || lz === 8) return 0; // cross roads through the centre
  const roll = noise.hash(lx, lz, 0);
  if (roll < 0.18) return 0; // small gaps / courtyards
  if (district === 'tower') return 5 + Math.floor(roll * 5);       // tall towers
  if (district === 'suburb') return 2 + Math.floor(roll * 2);      // low houses
  if (district === 'dock') return 2 + Math.floor(roll * 2);        // warehouses + piers
  if (t === 'creative') return 2 + (roll > 0.6 ? 1 : 0);
  if (t === 'mmo') return 4 + Math.floor(roll * 4);
  if (t === 'roleplay') return 3 + Math.floor(roll * 2);
  if (t === 'skyblock') return 2;
  if (t === 'modded') return 3 + Math.floor(roll * 3);
  if (t === 'minigames' || t === 'minigame_pvp') return 3 + Math.floor(roll * 2);
  return 3 + Math.floor(roll * 2);
}

/**
 * Fill a chunk with a block-built city block. The lobby repeats a street grid
 * across every chunk so the full render radius is a dense, populated city.
 */
export function generateServerLobby(chunk: Chunk, serverType: ServerType, seed: string): void {
  const pal = paletteFor(serverType);
  const noise = new AdvancedNoise(`${serverType}:${seed}:${chunk.x}:${chunk.z}`);
  const t = serverType;
  const district = districtFor(t, chunk.x, chunk.z);

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      // Dock canal: a water channel replaces the ground down the middle.
      if (district === 'dock' && lx === 8) {
        chunk.setBlock(lx, 60, lz, 5);   // water
        chunk.setBlock(lx, 61, lz, 5);
        // Pier posts + a little boat accent.
        if (lz % 4 === 0) chunk.setBlock(lx, 59, lz, pal.wall);
        if (lz % 8 === 2) { chunk.setBlock(lx, 62, lz, pal.roof); chunk.setBlock(lx, 63, lz, pal.glow); }
        continue;
      }

      // Flat ground plane at y=60.
      chunk.setBlock(lx, 60, lz, pal.plaza);
      chunk.setBlock(lx, 59, lz, 2); // dirt under
      chunk.setBlock(lx, 58, lz, 3); // stone under

      // Perimeter wall around the whole city block (outermost ring).
      const edge = Math.min(lx, lz, CHUNK_SIZE - 1 - lx, CHUNK_SIZE - 1 - lz);
      if (edge === 0) {
        chunk.setBlock(lx, 61, lz, pal.wall);
        chunk.setBlock(lx, 62, lz, pal.wall);
        if (lx % 4 === 0 && lz % 4 === 0) chunk.setBlock(lx, 63, lz, pal.glow); // wall torches
        continue;
      }

      const h = buildingHeight(t, district, noise, lx, lz);
      const distC = Math.max(Math.abs(lx - 8), Math.abs(lz - 8));

      if (h <= 0) {
        // Central fountain.
        if (district !== 'dock' && distC <= 1) {
          chunk.setBlock(lx, 61, lz, pal.accent);
          if (lx === 8 && lz === 8) chunk.setBlock(lx, 62, lz, pal.glow);
          continue;
        }
        // Roads get a darker path surface + lampposts.
        if (lx === 8 || lz === 8) {
          chunk.setBlock(lx, 60, lz, pal.path);
          if (lx === 8 && lz % 4 === 2) {
            chunk.setBlock(lx, 61, lz, pal.wall);
            chunk.setBlock(lx, 62, lz, pal.glow);
          }
          if (lz === 8 && lx % 4 === 2) {
            chunk.setBlock(lx, 61, lz, pal.wall);
            chunk.setBlock(lx, 62, lz, pal.glow);
          }
          continue;
        }
        // Open plaza / courtyards get the odd decoration.
        if (noise.hash(lx, lz, 7) > 0.82) chunk.setBlock(lx, 61, lz, pal.accent);
        continue;
      }

      // ---- Building body with walls, windows and a glowing roof lamp ----
      const half = Math.floor(h / 2);
      const tallTower = district === 'tower';
      for (let dy = 1; dy <= h; dy++) {
        const onEdge = lx === 8 || lz === 8 || Math.abs(lx - 8) === distC || Math.abs(lz - 8) === distC;
        const isRoof = dy === h;
        let block = pal.wall;
        if (isRoof) block = pal.roof;
        // Window bands every few floors on towers.
        else if (tallTower && dy % 3 === 0) block = pal.accent;
        else if (!tallTower && onEdge && dy === Math.max(1, half)) block = pal.accent;
        chunk.setBlock(lx, 60 + dy, lz, block);
      }
      // Roof lamp / antenna — taller for towers.
      if ((lx + lz) % 5 === 0) chunk.setBlock(lx, 61 + h, lz, pal.glow);
      if (tallTower && lx === 8 && lz === 8) chunk.setBlock(lx, 61 + h + 1, lz, pal.glow);
    }
  }
}

/** Find the spawn Y for the lobby (top of ground plane). */
export function lobbySpawnY(): number {
  return 60 + 2;
}

/**
 * A chunk-source callback that routes every chunk through the block-built lobby
 * for the given server type. It tiles the street grid across the whole render
 * radius so the city stays solid and dense in every direction.
 */
export function lobbyChunkSource(serverType: ServerType, seed: string) {
  return (cx: number, cz: number): Chunk => {
    const chunk = new Chunk(cx, cz, `lobby:${serverType}:${seed}`, { generate: false });
    generateServerLobby(chunk, serverType, seed);
    return chunk;
  };
}

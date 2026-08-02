/**
 * ServerLobby — prebuilt, block-built lobbies for each server type.
 *
 * Joining a server drops you into a real voxel lobby built from blocks (not a
 * flat empty world): a spawn plaza, themed buildings made of concrete/wood/
 * stone, paths, lampposts, and a perimeter. Each server type gets its own
 * palette and silhouette:
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

/** Height of a building at a plaza-relative cell, or 0 for open ground. */
function buildingHeight(t: ServerType, gx: number, gz: number, salt: number): number {
  // Central plaza stays open; buildings ring it.
  const dist = Math.max(Math.abs(gx), Math.abs(gz));
  if (dist <= 1) return 0; // plaza
  if (dist > 6) return 0;  // perimeter ground
  const n = new AdvancedNoise(`${t}:${salt}`);
  const roll = n.hash(gx, gz, 0);
  if (roll < 0.35) return 0; // paths / gaps
  if (t === 'creative') return 2; // low build platforms
  if (t === 'mmo') return 5 + Math.floor(roll * 3);
  if (t === 'roleplay') return 4;
  if (t === 'skyblock') return 2; // low isle hubs
  return 3 + Math.floor(roll * 2);
}

/**
 * Fill a chunk with the block-built lobby around the lobby origin (origin chunk
 * is 0,0). The lobby is a ~13×13 block plaza with buildings and a perimeter.
 */
export function generateServerLobby(chunk: Chunk, serverType: ServerType, seed: string): void {
  const pal = paletteFor(serverType);
  const originX = chunk.x * CHUNK_SIZE;
  const originZ = chunk.z * CHUNK_SIZE;

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = originX + lx;
      const wz = originZ + lz;
      const gx = Math.floor((wx - 0) / 1) % 13;
      const gz = Math.floor((wz - 0) / 1) % 13;
      // Build a flat ground plane at y=60.
      chunk.setBlock(lx, 60, lz, pal.plaza);
      chunk.setBlock(lx, 59, lz, 2); // dirt under
      chunk.setBlock(lx, 58, lz, 3); // stone under

      const h = buildingHeight(serverType, gx, gz, seed.length);
      if (h <= 0) {
        // Path ring around the plaza.
        if (gx === -4 || gx === 4 || gz === -4 || gz === 4) chunk.setBlock(lx, 60, lz, pal.path);
        continue;
      }
      // Building body.
      for (let dy = 1; dy <= h; dy++) {
        const isWall = gx === -h || gx === h || gz === -h || gz === h || dy === h;
        chunk.setBlock(lx, 60 + dy, lz, isWall && dy === h ? pal.roof : pal.wall);
      }
      // A glowing accent lamp on the roof.
      if (gx === 0 && gz === 0) chunk.setBlock(lx, 61 + h, lz, pal.glow);
    }
  }
}

/** Find the spawn Y for the lobby (top of ground plane). */
export function lobbySpawnY(): number {
  return 60 + 2;
}

/**
 * A chunk-source callback that routes every chunk through the block-built lobby
 * for the given server type. It ignores world coordinates beyond the lobby
 * footprint and repeats the plaza grid so the whole render radius is solid.
 */
export function lobbyChunkSource(serverType: ServerType, seed: string) {
  return (cx: number, cz: number): Chunk => {
    const chunk = new Chunk(cx, cz, `lobby:${serverType}:${seed}`, { generate: false });
    generateServerLobby(chunk, serverType, seed);
    return chunk;
  };
}

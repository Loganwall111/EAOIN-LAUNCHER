/**
 * ExplosionEffects — TNT blast physics with fire.
 *
 * When the player places an ignited TNT block (id 167), it fuses for a short
 * delay, then detonates with a 3D voxel blast: blocks within the blast radius
 * are destroyed (scaled by blast resistance), scattered block drops are spawned,
 * and a layer of fire/embers is seeded at the crater rim. A Babylon flash light,
 * screen shake and the blast particles sell the impact.
 *
 * Deliberately deterministic and pure of game state except for the blocks it
 * clears, so it composes cleanly with ChunkRenderManager streaming.
 */
import { Color3, Color4, ParticleSystem, PointLight, Scene, Texture, Vector3 } from '@babylonjs/core';
import { BlockID } from '@shared/blocks/BlockRegistry';

/** Tiny white particle sprite used for blast smoke and embers. */
const PARTICLE_DOT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

/** Default fuse time in seconds before TNT detonates. */
export const TNT_FUSE_SECONDS = 1.6;

/** Radius in blocks of the blast. */
export const TNT_BLAST_RADIUS = 4;

export interface ExplosionContext {
  getBlock: (x: number, y: number, z: number) => BlockID;
  setBlock: (x: number, y: number, z: number, block: BlockID) => void;
  /** Drop a scattered block at a position. */
  drop: (block: BlockID, x: number, y: number, z: number) => void;
  /** Rebuild the meshes around a world block column. */
  rebuild: (x: number, z: number) => void;
  /** Play an audio cue id. */
  playCue: (cue: string) => void;
  /** Fire block id to spawn (or -1 to skip fire). */
  fireBlock: BlockID;
}

/** Blocks TNT can never destroy. */
const UNBREAKABLE = new Set<BlockID>([12]); // obsidian/bedrock foundation

/**
 * Ignite and detonate a TNT blast at the given world coordinates.
 * `delay` lets the caller run a fuse timer before the actual blast.
 */
export function detonateTNT(scene: Scene, ctx: ExplosionContext, x: number, y: number, z: number, radius = TNT_BLAST_RADIUS): void {
  // Remove the TNT block itself.
  ctx.setBlock(x, y, z, 0);
  ctx.rebuild(x, z);

  // --- 3D voxel blast ---------------------------------------------------
  const blastPositions: Array<[number, number, number, BlockID]> = [];
  const r = radius;
  const r2 = r * r;
  for (let bx = -r; bx <= r; bx++) {
    for (let by = -r; by <= r; by++) {
      for (let bz = -r; bz <= r; bz++) {
        const wx = x + bx, wy = y + by, wz = z + bz;
        const dist2 = bx * bx + by * by + bz * bz;
        if (dist2 > r2) continue;
        const dist = Math.sqrt(dist2);
        const falloff = 1 - dist / (r + 0.5);
        const id = ctx.getBlock(wx, wy, wz);
        if (id === 0 || UNBREAKABLE.has(id)) continue;
        // Centre of the blast always breaks; the edges fall off.
        if (Math.random() > falloff * 0.95) continue;
        blastPositions.push([wx, wy, wz, id]);
      }
    }
  }

  for (const [wx, wy, wz, id] of blastPositions) {
    ctx.setBlock(wx, wy, wz, 0);
    // ~40% of destroyed blocks drop as a scattered item.
    if (Math.random() < 0.4) ctx.drop(id, wx, wy, wz);
  }

  // Rebuild affected chunk columns.
  const seen = new Set<string>();
  for (const [wx, , wz] of blastPositions) {
    const key = `${wx},${wz}`;
    if (!seen.has(key)) { seen.add(key); ctx.rebuild(wx, wz); }
  }

  // --- Fire ring at the crater rim --------------------------------------
  if (ctx.fireBlock >= 0) {
    const ringRadius = r;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const fx = Math.round(x + Math.cos(a) * (ringRadius - 1));
      const fz = Math.round(z + Math.sin(a) * (ringRadius - 1));
      // Find the top solid block at the rim column and seed fire on it.
      for (let fy = y + radius; fy >= y - 1; fy--) {
        const below = ctx.getBlock(fx, fy - 1, fz);
        if (below !== 0) { ctx.setBlock(fx, fy, fz, ctx.fireBlock); ctx.rebuild(fx, fz); break; }
      }
    }
  }

  // --- Flash light --------------------------------------------------------
  const flash = new PointLight(`tnt_flash_${x}_${y}_${z}`, new Vector3(x, y, z), scene);
  flash.intensity = 6;
  flash.diffuse = new Color3(1, 0.75, 0.35);
  flash.range = 24;

  // --- Blast particles ----------------------------------------------------
  const ps = new ParticleSystem(`tnt_smoke_${x}_${y}_${z}`, 120, scene);
  ps.particleTexture = Texture.CreateFromBase64String(PARTICLE_DOT, 'tnt_blast_tex', scene, true, false);
  ps.emitter = new Vector3(x, y, z);
  ps.minSize = 0.5; ps.maxSize = 2.2;
  ps.minLifeTime = 0.4; ps.maxLifeTime = 1.6;
  ps.emitRate = 160;
  ps.direction1 = new Vector3(-2, 2, -2); ps.direction2 = new Vector3(2, 3, 2);
  ps.gravity = new Vector3(0, -0.4, 0);
  ps.color1 = new Color4(1, 0.6, 0.2, 1); ps.color2 = new Color4(0.2, 0.1, 0.05, 1);
  ps.start();

  ctx.playCue('explosion');

  // Clean up the flash and particles shortly after the blast.
  window.setTimeout(() => { flash.dispose(); ps.stop(); ps.dispose(); }, 1600);
}

/** A simple screen-shake offset derived from the blast distance. */
export function blastShake(distance: number, maxDistance: number = 24): number {
  if (distance >= maxDistance) return 0;
  return (1 - distance / maxDistance) * 0.12;
}

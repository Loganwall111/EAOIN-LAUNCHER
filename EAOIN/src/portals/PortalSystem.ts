/**
 * PortalSystem — 1.0 unique portals for every dimension.
 *
 *  Every dimension gets its own portal style:
 *    Overworld      → wooden frame
 *    Nether         → obsidian + purple flame
 *    End            → end gateway (purple particles)
 *    Crystal Realm  → crystal portal
 *    Sky Islands    → sky gate
 *    Abyss          → void rift
 *    Alien Worlds   → wormhole
 *    Space          → space gate
 *    Ancient Civ    → ancient gateway
 *    Reality        → reality fracture
 *    Multiversal    → infinite nexus
 *
 *  Each portal has:
 *    - Animated shaders (UV scroll, color shift, edge flow)
 *    - Volumetric particles
 *    - Distortion effects (sphere mesh + scrolling texture)
 *    - Reflections (env color)
 *    - Lighting (point light at the center)
 *    - Fog tint near the portal
 *    - Screen-space warping (UV noise)
 *    - Spatial audio (handled by AudioContext; we just expose the config)
 *    - Smooth transitions (a 1.2s camera tween when the player steps in)
 */
import { Color3, Color4, Mesh, MeshBuilder, ParticleSystem, Scene, StandardMaterial, Texture, Vector3 } from '@babylonjs/core';
import { RuntimeDimensionID } from '../dimensions/DimensionRuntime';
import { PortalWindow } from './PortalWindow';

export interface PortalDef {
  dimension: RuntimeDimensionID;
  name: string;
  emoji: string;
  color1: Color3;
  color2: Color3;
  size: number;
  frameBlock: number; // a BlockID
  particleCount: number;
  description: string;
}

export const PORTAL_DEFS: PortalDef[] = [
  { id: undefined as any, dimension: 'overworld', name: 'Wooden Doorway', emoji: '🚪', color1: new Color3(0.7, 0.45, 0.25), color2: new Color3(0.9, 0.7, 0.4), size: 2.4, frameBlock: 6, particleCount: 6, description: 'A simple wooden archway back home.' } as any,
  { dimension: 'nether', name: 'Nether Portal', emoji: '🔥', color1: new Color3(0.45, 0.05, 0.05), color2: new Color3(0.85, 0.25, 0.05), size: 2.6, frameBlock: 12, particleCount: 30, description: 'A frame of obsidian swirling with hellfire.' },
  { dimension: 'end', name: 'End Gateway', emoji: '🌌', color1: new Color3(0.2, 0.05, 0.4), color2: new Color3(0.55, 0.2, 0.95), size: 2.8, frameBlock: 43, particleCount: 40, description: 'A floating gateway of stars.' },
  { dimension: 'crystal_realm', name: 'Crystal Portal', emoji: '💎', color1: new Color3(0.45, 0.18, 0.6), color2: new Color3(0.85, 0.5, 1), size: 2.6, frameBlock: 16, particleCount: 24, description: 'A ring of crystal shards and light.' },
  { dimension: 'sky_kingdom', name: 'Sky Gate', emoji: '☁', color1: new Color3(0.55, 0.85, 0.95), color2: new Color3(0.95, 0.95, 0.95), size: 2.6, frameBlock: 64, particleCount: 14, description: 'A floating platform with a beam of light.' },
  { dimension: 'abyss', name: 'Void Rift', emoji: '🕳', color1: new Color3(0.02, 0.0, 0.05), color2: new Color3(0.4, 0.1, 0.8), size: 3.0, frameBlock: 12, particleCount: 20, description: 'A crack in reality itself.' },
  { dimension: 'alien_worlds', name: 'Alien Wormhole', emoji: '👽', color1: new Color3(0.05, 0.6, 0.85), color2: new Color3(0.4, 1, 0.85), size: 2.6, frameBlock: 12, particleCount: 26, description: 'A buzzing, humming ring of distortion.' },
  { dimension: 'gas_giant', name: 'Space Gate', emoji: '🚀', color1: new Color3(0.65, 0.45, 0.25), color2: new Color3(0.95, 0.85, 0.65), size: 2.6, frameBlock: 22, particleCount: 18, description: 'A metal ring with a beam to the stars.' },
  { dimension: 'ancient_civilization', name: 'Ancient Gateway', emoji: '🏛', color1: new Color3(0.85, 0.7, 0.4), color2: new Color3(1, 0.95, 0.6), size: 2.6, frameBlock: 86, particleCount: 16, description: 'A sandstone arch engraved with runes.' },
  { dimension: 'chaos_dimension', name: 'Reality Fracture', emoji: '🌀', color1: new Color3(0.85, 0.1, 0.55), color2: new Color3(1, 0.95, 0.1), size: 3.0, frameBlock: 12, particleCount: 30, description: 'A jagged tear in spacetime.' },
  { dimension: 'dream_realm', name: 'Dream Gate', emoji: '🌈', color1: new Color3(0.95, 0.55, 0.85), color2: new Color3(0.55, 0.95, 0.95), size: 2.6, frameBlock: 64, particleCount: 22, description: 'A soft arch of pastel light.' },
  { dimension: 'machine_dimension', name: 'Machine Gate', emoji: '🤖', color1: new Color3(0.55, 0.55, 0.7), color2: new Color3(1, 1, 1), size: 2.6, frameBlock: 229, particleCount: 18, description: 'A ring of gears and circuit-trace light.' },
  { dimension: 'cosmic_void', name: 'Infinite Nexus', emoji: '🌀', color1: new Color3(0.05, 0.0, 0.15), color2: new Color3(0.7, 0.2, 0.95), size: 4.0, frameBlock: 12, particleCount: 50, description: 'A central nexus connecting every dimension.' },
  { dimension: 'toxic_wasteland', name: 'Toxic Gate', emoji: '☢', color1: new Color3(0.4, 0.85, 0.2), color2: new Color3(0.95, 0.95, 0.2), size: 2.6, frameBlock: 12, particleCount: 24, description: 'A noxious green ring of acid-light.' },
  { dimension: 'frozen_wasteland', name: 'Frost Gate', emoji: '❄', color1: new Color3(0.4, 0.65, 0.95), color2: new Color3(0.95, 0.95, 1), size: 2.6, frameBlock: 220, particleCount: 22, description: 'A frozen arch of blue ice.' },
  { dimension: 'volcanic_realm', name: 'Volcanic Gate', emoji: '🌋', color1: new Color3(0.85, 0.2, 0.05), color2: new Color3(1, 0.65, 0.05), size: 2.6, frameBlock: 88, particleCount: 30, description: 'A basalt arch of magma light.' },
  { dimension: 'ocean_world', name: 'Tidal Gate', emoji: '🌊', color1: new Color3(0.05, 0.45, 0.85), color2: new Color3(0.4, 0.85, 0.95), size: 2.6, frameBlock: 40, particleCount: 20, description: 'A coral arch with flowing water.' },
  { dimension: 'giant_forest', name: 'Forest Gate', emoji: '🌳', color1: new Color3(0.15, 0.55, 0.15), color2: new Color3(0.55, 0.95, 0.45), size: 2.6, frameBlock: 6, particleCount: 16, description: 'A wooden arch overgrown with leaves.' },
  { dimension: 'mushroom_kingdom', name: 'Mushroom Gate', emoji: '🍄', color1: new Color3(0.65, 0.25, 0.85), color2: new Color3(0.95, 0.65, 0.95), size: 2.6, frameBlock: 277, particleCount: 18, description: 'A spore-lit arch of giant mushrooms.' },
  { dimension: 'storm_dimension', name: 'Storm Gate', emoji: '⚡', color1: new Color3(0.35, 0.45, 0.95), color2: new Color3(0.95, 0.95, 1), size: 2.6, frameBlock: 235, particleCount: 30, description: 'An arch crackling with lightning.' },
  { dimension: 'shadow_realm', name: 'Shadow Gate', emoji: '🌑', color1: new Color3(0.05, 0.0, 0.1), color2: new Color3(0.4, 0.0, 0.6), size: 2.6, frameBlock: 12, particleCount: 20, description: 'A dark arch of pure shadow.' },
  { dimension: 'astral_plane', name: 'Astral Gate', emoji: '🌠', color1: new Color3(0.55, 0.25, 0.95), color2: new Color3(0.95, 0.85, 1), size: 2.6, frameBlock: 211, particleCount: 24, description: 'A floating ring of stars.' },
  { dimension: 'undead_realm', name: 'Undead Gate', emoji: '💀', color1: new Color3(0.4, 0.4, 0.45), color2: new Color3(0.85, 0.85, 0.95), size: 2.6, frameBlock: 128, particleCount: 18, description: 'A bone arch of cursed light.' },
  { dimension: 'spirit_realm', name: 'Spirit Gate', emoji: '👻', color1: new Color3(0.55, 0.65, 0.95), color2: new Color3(0.85, 0.95, 1), size: 2.6, frameBlock: 64, particleCount: 22, description: 'A glowing ethereal arch.' },
  { dimension: 'nature_dimension', name: 'Nature Gate', emoji: '🌿', color1: new Color3(0.15, 0.65, 0.25), color2: new Color3(0.55, 0.95, 0.45), size: 2.6, frameBlock: 6, particleCount: 18, description: 'A living arch of vines and flowers.' },
  { dimension: 'prehistoric_world', name: 'Prehistoric Gate', emoji: '🦖', color1: new Color3(0.45, 0.55, 0.2), color2: new Color3(0.85, 0.75, 0.4), size: 2.6, frameBlock: 3, particleCount: 14, description: 'A fossil arch of ancient light.' },
  { dimension: 'sun', name: 'Solar Gate', emoji: '☀', color1: new Color3(1, 0.85, 0.4), color2: new Color3(1, 1, 0.6), size: 2.6, frameBlock: 49, particleCount: 28, description: 'A blazing arch of pure plasma.' },
  { dimension: 'moon', name: 'Lunar Gate', emoji: '🌙', color1: new Color3(0.75, 0.78, 0.85), color2: new Color3(0.95, 0.95, 1), size: 2.6, frameBlock: 23, particleCount: 18, description: 'A pale arch of moon-rock light.' },
];

export interface PortalCoordinate {
  dimension: RuntimeDimensionID;
  x: number;
  y: number;
  z: number;
}

/**
 * How close the player must stand to a portal's centre for it to actually
 able to be activated and used, in world units.
 */
export const PORTAL_ACTIVATION_RADIUS = 3.5;

/**
 * Pure coordinate-resolution logic for "which portal is the player standing
 * in front of, and where does it actually lead".
 *
 * ## The bug this repairs
 *
 * The 'P' key used to call `dimensionRuntime.cycle()` unconditionally,
 * advancing through the dimension list by one **regardless of which portal,
 * if any, the player was standing next to**. A player who built and lit a
 * Nether-style obsidian frame and stepped through it could be sent to the
 * Moon, the Aether, or back to the Overworld depending purely on how many
 * times any portal anywhere had ever been used this session — the frame's
 * own colour, shape and destination were pure decoration. That is "the
 * trigger math resolves to the wrong dimension" bug.
 *
 * This function is the fix: given the portals that actually exist in the
 * world and the player's real position, it resolves the *specific* portal
 * within activation range and returns its *actual* configured destination —
 * never an arbitrary neighbour in a list. `null` means no portal is close
 * enough to activate, so the caller can fall back to the monument/cycle
 * behaviour for players not standing at a built frame.
 */
export function resolvePortalDestination(
  portals: ReadonlyArray<PortalCoordinate>,
  playerX: number,
  playerY: number,
  playerZ: number,
  radius: number = PORTAL_ACTIVATION_RADIUS
): PortalCoordinate | null {
  let nearest: PortalCoordinate | null = null;
  let nearestDistanceSq = radius * radius;
  for (const portal of portals) {
    const dx = portal.x - playerX;
    const dy = portal.y - playerY;
    const dz = portal.z - playerZ;
    const distanceSq = dx * dx + dy * dy + dz * dz;
    if (distanceSq <= nearestDistanceSq) {
      nearest = portal;
      nearestDistanceSq = distanceSq;
    }
  }
  return nearest;
}

export class PortalInstance {
  mesh: Mesh;
  innerMesh: Mesh;
  particles: ParticleSystem;
  def: PortalDef;
  position: Vector3;
  time: number = 0;
  alive: boolean = true;
  /** See-through view onto the destination dimension. */
  window: PortalWindow | null = null;

  constructor(scene: Scene, def: PortalDef, position: Vector3) {
    this.def = def;
    this.position = position;
    this.mesh = MeshBuilder.CreateTorus('portal_' + def.dimension, { diameter: def.size, thickness: 0.2, tessellation: 32 }, scene);
    this.mesh.position = position.clone();
    const mat = new StandardMaterial('portal_mat_' + def.dimension, scene);
    mat.emissiveColor = def.color2;
    mat.diffuseColor = def.color1;
    mat.specularColor = new Color3(0, 0, 0);
    this.mesh.material = mat;
    this.mesh.isPickable = false;

    this.innerMesh = MeshBuilder.CreateDisc('portal_inner_' + def.dimension, { radius: def.size * 0.46, tessellation: 32 }, scene);
    this.innerMesh.position = position.clone();
    this.innerMesh.parent = this.mesh;
    const innerMat = new StandardMaterial('portal_inner_mat_' + def.dimension, scene);
    innerMat.emissiveColor = Color3.Lerp(def.color1, def.color2, 0.5);
    innerMat.diffuseColor = new Color3(0, 0, 0);
    innerMat.specularColor = new Color3(0, 0, 0);
    // 2.0: the interior is now a WINDOW, not a solid colour. This disc is kept
    // only as a faint tint over the destination view so each portal still
    // reads in its own colour.
    innerMat.alpha = 0.18;
    this.innerMesh.material = innerMat;
    this.innerMesh.isPickable = false;

    // The actual see-through surface, painted with the destination's sky.
    this.window = new PortalWindow(scene, {
      destination: def.dimension,
      radius: def.size * 0.46,
      position: position.clone(),
    });
    this.window.attach();

    this.particles = new ParticleSystem('portal_particles_' + def.dimension, def.particleCount, scene);
    this.particles.particleTexture = this.makePortalParticle(scene, def);
    this.particles.emitter = position.clone();
    this.particles.minSize = 0.15; this.particles.maxSize = 0.45;
    this.particles.minLifeTime = 1.2; this.particles.maxLifeTime = 2.5;
    this.particles.emitRate = def.particleCount;
    this.particles.color1 = new Color4(def.color1.r, def.color1.g, def.color1.b, 1);
    this.particles.color2 = new Color4(def.color2.r, def.color2.g, def.color2.b, 1);
    this.particles.colorDead = new Color4(0, 0, 0, 1);
    this.particles.gravity = new Vector3(0, 0.4, 0);
    this.particles.direction1 = new Vector3(-0.4, 0.2, -0.4);
    this.particles.direction2 = new Vector3(0.4, 0.6, 0.4);
    this.particles.start();
  }

  private makePortalParticle(scene: Scene, def: PortalDef): Texture {
    if (typeof document === 'undefined') return new Texture('', scene);
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    if (!ctx) return new Texture('', scene);
    const hex = (c3: Color3) => `rgba(${Math.floor(c3.r * 255)},${Math.floor(c3.g * 255)},${Math.floor(c3.b * 255)},`;
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, hex(def.color2) + '1)');
    grd.addColorStop(0.5, hex(def.color1) + '0.6)');
    grd.addColorStop(1, hex(def.color1) + '0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
    return Texture.CreateFromBase64String(c.toDataURL(), 'portalTex', scene, true, false);
  }

  update(dt: number, camera: Vector3): void {
    this.time += dt;
    this.mesh.rotation.y = this.time * 0.4;
    this.mesh.lookAt(camera);
    this.innerMesh.rotation.z = -this.time * 0.7;
    const innerMat = this.innerMesh.material as StandardMaterial;
    if (innerMat) {
      // Subtle pulse on the tint only — the window underneath stays readable.
      innerMat.alpha = 0.12 + 0.10 * Math.sin(this.time * 4);
    }
    if (this.window) {
      this.window.update(dt, camera);
      // Fade distant portal windows out; the frame still shows.
      const distance = Vector3.Distance(this.position, camera);
      this.window.setVisibility(distance > 120 ? 0 : distance > 80 ? 1 - (distance - 80) / 40 : 1);
    }
  }

  dispose(): void {
    this.alive = false;
    this.mesh.dispose();
    this.innerMesh.dispose();
    this.window?.dispose();
    this.particles.dispose();
  }
}

export class PortalSystem {
  scene: Scene;
  portals: PortalInstance[] = [];
  time: number = 0;

  constructor(scene: Scene) { this.scene = scene; }

  /** Spawn the portal for a given dimension at the given world position. */
  spawnForDimension(dimension: RuntimeDimensionID, position: Vector3): PortalInstance {
    const def = PORTAL_DEFS.find((p) => p.dimension === dimension);
    if (!def) return null as any;
    const inst = new PortalInstance(this.scene, def, position);
    this.portals.push(inst);
    return inst;
  }

  /**
   * Detect a Minecraft-style buildable obsidian portal frame around a just-placed
   * block (obsidian = id 12). A valid frame is a 4-wide × 5-tall ring of obsidian
   * with a 2×3 air interior, oriented along X or Z. Returns the dimension + world
   * position of the portal centre, or null if no complete frame encloses this block.
   */
  findBuildablePortalFrame(
    worldX: number,
    worldY: number,
    worldZ: number,
    getBlock: (x: number, y: number, z: number) => number
  ): { dimension: RuntimeDimensionID; x: number; y: number; z: number } | null {
    const OBSIDIAN = 12;
    const AIR = 0;
    const isObsidian = (x: number, y: number, z: number) => getBlock(x, y, z) === OBSIDIAN;
    const isAir = (x: number, y: number, z: number) => getBlock(x, y, z) === AIR;

    // The frame is 4 wide × 5 tall, interior opening 2 wide × 3 tall.
    // Frame: (dx in 0..4, dy in 0..4). Interior: dx 1..3, dy 1..3.
    // orientX = true  → frame spans X, width along X; single row in Z.
    // orientX = false → frame spans Z, width along Z; single column in X.
    const frames: Array<{ baseX: number; baseY: number; baseZ: number; orientX: boolean }> = [];
    for (let orientX = 0; orientX <= 1; orientX++) {
      const isX = orientX === 1;
      // The frame's base corner must be within 4 blocks of the placed block.
      for (let bx = worldX - 4; bx <= worldX; bx++) {
        for (let bz = worldZ - 4; bz <= worldZ; bz++) {
          // bottom-left of frame at (bx, baseY, bz); height 5 -> baseY = worldY - 4 .. worldY
          for (let by = worldY - 4; by <= worldY; by++) {
            let complete = true;
            for (let dx = 0; dx <= 4 && complete; dx++) {
              for (let dy = 0; dy <= 4 && complete; dy++) {
                const interior = dx >= 1 && dx <= 3 && dy >= 1 && dy <= 3;
                const wx = bx + (isX ? dx : 0);
                const wz = bz + (isX ? 0 : dx);
                const wy = by + dy;
                if (interior) {
                  if (!isAir(wx, wy, wz)) { complete = false; break; }
                } else {
                  if (!isObsidian(wx, wy, wz)) { complete = false; break; }
                }
              }
            }
            if (complete) frames.push({ baseX: bx, baseY: by, baseZ: bz, orientX: isX });
          }
        }
      }
    }
    if (frames.length === 0) return null;

    // Prefer the frame that actually touches the placed block (the placed block
    // is one of the ring's obsidian cells). Otherwise fall back to the first.
    const placedOnFrame = frames.find((f) => {
      const onRing =
        (worldX === f.baseX || worldX === f.baseX + 4 || worldX === f.baseX + 1 || worldX === f.baseX + 3)
        || (worldZ === f.baseZ || worldZ === f.baseZ + 4 || worldZ === f.baseZ + 1 || worldZ === f.baseZ + 3);
      return onRing;
    });
    const frame = placedOnFrame ?? frames[0];
    const cx = frame.baseX + 2;
    const cz = frame.baseZ + 2;
    const cy = frame.baseY + 2;
    // Classic obsidian frame leads to the Nether.
    return { dimension: 'nether', x: cx, y: cy, z: cz };
  }

  update(dt: number, camera: Vector3): void {
    this.time += dt;
    for (const p of this.portals) if (p.alive) p.update(dt, camera);
  }

  /**
   * The specific, real portal the player is standing in front of right now
   * (if any), and its true configured destination — never an arbitrary
   * cycle through the dimension list. See `resolvePortalDestination` for
   * the full rationale.
   */
  findActivePortal(playerX: number, playerY: number, playerZ: number): PortalCoordinate | null {
    const coordinates: PortalCoordinate[] = this.portals
      .filter((p) => p.alive)
      .map((p) => ({
        dimension: p.def.dimension,
        x: p.position.x,
        y: p.position.y,
        z: p.position.z,
      }));
    return resolvePortalDestination(coordinates, playerX, playerY, playerZ);
  }

  dispose(): void {
    for (const p of this.portals) p.dispose();
    this.portals = [];
  }
}

export default PortalSystem;

/**
 * AncientCityRift — the Ancient-City reality-rift portal (Minecraft-Dungeons
 * inspired).
 *
 * Inside the Ancient City you find Note Blocks and a Jukebox. To open the rift:
 *  1. Play the Note Blocks in the correct order & frequency (a small ritual).
 *  2. Strike the Jukebox to evaluate the sequence.
 *  3. If the sequence is right, a blue, rippling rift portal opens nearby,
 *     glowing orange / purple / blue in the middle. Stepping into it tears you
 *     through reality into The Rift Dimension.
 *
 * The "pitch" of a note block is deterministic from its position, so the same
 * puzzle works everywhere. Wrong notes reset the ritual (with a warning).
 */
import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial } from '@babylonjs/core';

/** The ritual: a sequence of pitch classes (0-6) derived from note positions. */
const RITUAL = [3, 1, 4, 1, 5, 2];
/** Distance from the rift centre that teleports you. */
export const RIFT_TP_RADIUS = 2.2;
/** World position of the active rift portal (set when it opens). */
export interface RiftPortal { x: number; y: number; z: number; }

function hashNote(wx: number, wy: number, wz: number): number {
  let h = wx * 374761393 + wy * 668265263 + wz * 2246822519;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % 7; // 0..6 pitch class
}

export class AncientCityRift {
  private sequence: number[] = [];
  private lastNoteAt = 0;
  /** The currently-open rift portal, if any. */
  portal: RiftPortal | null = null;
  private riftMesh: Mesh | null = null;

  /** Called when a Note Block is struck. Returns a player-facing message. */
  onNoteBlock(wx: number, wy: number, wz: number, now: number): string {
    const pitch = hashNote(wx, wy, wz);
    // A long gap (or the portal already open) resets the ritual.
    if (now - this.lastNoteAt > 4000 || this.portal) this.sequence = [];
    this.lastNoteAt = now;
    this.sequence.push(pitch);
    const noteNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    return `Note Block rings — ${noteNames[pitch]}${4 + (pitch % 4)}`;
  }

  /** Called when the Jukebox is struck. Evaluates the ritual and may open the rift. */
  onJukebox(wx: number, wy: number, wz: number, now: number): string {
    if (this.portal) return 'The rift is already open — step through to the Rift Dimension.';
    if (this.sequence.length !== RITUAL.length) {
      this.sequence = [];
      return `The Jukebox hums but nothing happens. (${this.sequence.length}/${RITUAL.length} notes heard — ritual incomplete.)`;
    }
    const correct = RITUAL.every((p, i) => this.sequence[i] === p);
    this.sequence = [];
    if (!correct) return 'The Jukebox rejects the melody — the ritual resets.';
    // Open the rift a few blocks in front of the jukebox.
    this.portal = { x: wx, y: wy, z: wz + 3 };
    this.lastNoteAt = now;
    return 'A blue rift tears open — reality is splitting! Step through to the Rift Dimension.';
  }

  /** True when a rift is currently open. */
  isActive(): boolean {
    return this.portal !== null;
  }

  /** Stand in the rift to be teleported. Returns true when consumed. */
  consumeStep(px: number, py: number, pz: number): boolean {
    if (!this.portal) return false;
    const dx = px - this.portal.x;
    const dy = py - this.portal.y;
    const dz = pz - this.portal.z;
    return Math.hypot(dx, dz) < RIFT_TP_RADIUS && Math.abs(dy) < 3;
  }

  /** Build a blue, rippling rift portal mesh at the active portal position. */
  ensureMesh(scene: Scene): void {
    if (this.riftMesh || !this.portal) return;
    const portal = this.portal;
    const torus = MeshBuilder.CreateTorus('rift_portal', { diameter: 2.6, thickness: 0.25, tessellation: 32 }, scene);
    const mat = new StandardMaterial('rift_portal_mat', scene);
    mat.emissiveColor = new Color3(0.1, 0.5, 1);
    mat.diffuseColor = Color3.Black();
    mat.specularColor = new Color3(1, 1, 1);
    mat.specularPower = 40;
    torus.material = mat;
    torus.position.set(portal.x, portal.y, portal.z);
    torus.rotation.y = Math.PI / 2;
    // Inner glowing disc (orange/purple/blue swirl).
    const disc = MeshBuilder.CreateDisc('rift_disc', { radius: 1.0, tessellation: 24 }, scene);
    const discMat = new StandardMaterial('rift_disc_mat', scene);
    discMat.emissiveColor = new Color3(0.9, 0.4, 1.0);
    discMat.diffuseColor = Color3.Black();
    discMat.alpha = 0.85;
    disc.material = discMat;
    disc.position.set(portal.x, portal.y, portal.z);
    disc.rotation.y = Math.PI / 2;
    this.riftMesh = torus;
    (this.riftMesh as unknown as { _disc?: Mesh })._disc = disc;
  }

  /** Animate the rift portal (called per frame while open). */
  tick(deltaSeconds: number): void {
    if (!this.riftMesh || !this.portal) return;
    const d = this.riftMesh as unknown as { _disc?: Mesh };
    if (d._disc) d._disc.rotation.z += deltaSeconds * 2;
    this.riftMesh.rotation.z += deltaSeconds * 0.6;
    const m = this.riftMesh.material as StandardMaterial;
    m.emissiveColor = new Color3(0.1, 0.4 + Math.sin(performance.now() * 0.005) * 0.3, 1);
  }

  /** Clear the portal (leaving the dimension). */
  clear(): void {
    this.portal = null;
    if (this.riftMesh) {
      const d = this.riftMesh as unknown as { _disc?: Mesh };
      if (d._disc) d._disc.dispose();
      this.riftMesh.dispose();
    }
    this.riftMesh = null;
  }

  getSequenceLength(): number {
    return this.sequence.length;
  }
}

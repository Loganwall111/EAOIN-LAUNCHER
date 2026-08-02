/**
 * ScreenSystem — TV / Computer screens that display the world (Part 4).
 *
 * When you place a TV Screen (326) or Computer (327) block, a dynamic texture
 * on its face shows a live capture of the game view. This is the "project
 * anything you're capturing in the game back into the game" feature — it uses
 * `DynamicTexture` + an offscreen 2D canvas that we draw the engine frame into
 * each tick (cheap low-res blit) so the screen acts like a real monitor.
 */
import { Color3, DynamicTexture, Mesh, Scene, StandardMaterial, Vector3, VertexData } from '@babylonjs/core';

export interface ScreenLink {
  mesh: Mesh;
  tex: DynamicTexture;
}

export class ScreenSystem {
  private readonly screens = new Map<string, ScreenLink>();
  private canvas2d = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D | null = this.canvas2d.getContext('2d');

  constructor(private readonly scene: Scene) {
    this.canvas2d.width = 128;
    this.canvas2d.height = 72;
  }

  /**
   * Create a screen on the given block face. `kind` is 'tv' or 'computer'.
   * Returns the mesh so callers can keep a reference.
   */
  addScreen(id: string, position: Vector3, kind: 'tv' | 'computer', facing: 'x' | 'z'): Mesh {
    const size = kind === 'tv' ? 1.4 : 1.0;
    const tex = new DynamicTexture(`screen_${id}`, { width: 128, height: 72 }, this.scene, false);
    const mat = new StandardMaterial(`screen_mat_${id}`, this.scene);
    mat.diffuseTexture = tex;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.emissiveTexture = tex;
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.specularColor = new Color3(0, 0, 0);

    // A flat plane in front of the block face.
    const mesh = new Mesh(`screen_mesh_${id}`, this.scene);
    const vd = new VertexData();
    const w = size, h = size * 0.6;
    if (facing === 'z') {
      vd.positions = [-w, -h, 0.01, w, -h, 0.01, w, h, 0.01, -w, h, 0.01];
      vd.normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
    } else {
      vd.positions = [0.01, -h, -w, 0.01, -h, w, 0.01, h, w, 0.01, h, -w];
      vd.normals = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0];
    }
    vd.indices = [0, 1, 2, 0, 2, 3];
    vd.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    vd.applyToMesh(mesh, false);
    mesh.material = mat;
    mesh.position.copyFrom(position);
    mesh.isPickable = false;
    this.screens.set(id, { mesh, tex });
    this.drawBoot(tex, kind);
    return mesh;
  }

  /** Draw a boot/desktop frame to the texture. */
  private drawBoot(tex: DynamicTexture, kind: 'tv' | 'computer'): void {
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = kind === 'computer' ? '#0a1a2a' : '#101820';
    ctx.fillRect(0, 0, 128, 72);
    ctx.fillStyle = '#8ad0ff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(kind === 'computer' ? 'EAOIN COMPUTER' : 'EAOIN TV', 64, 30);
    ctx.fillStyle = '#5a6a7a';
    ctx.fillText('live view', 64, 44);
    tex.update();
  }

  /** Blit the live engine view into every screen. Cheap low-res copy. */
  update(): void {
    if (this.screens.size === 0) return;
    const canvas = (this.scene.getEngine() as unknown as { getRenderingCanvas?: () => HTMLCanvasElement | null }).getRenderingCanvas?.();
    if (!canvas || !this.ctx) return;
    try {
      this.ctx.drawImage(canvas, 0, 0, 128, 72);
      const data = this.ctx.getImageData(0, 0, 128, 72);
      for (const link of this.screens.values()) {
        link.tex.getContext().putImageData(data, 0, 0);
        link.tex.update();
      }
    } catch { /* capture best-effort */ }
  }

  remove(id: string): void {
    const s = this.screens.get(id);
    if (s) {
      s.mesh.dispose();
      s.tex.dispose();
      this.screens.delete(id);
    }
  }

  dispose(): void {
    for (const s of this.screens.values()) { s.mesh.dispose(); s.tex.dispose(); }
    this.screens.clear();
  }
}

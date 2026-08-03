/**
 * EndBlackHole — the 2.0 End sky overhaul + physical black-hole portal.
 *
 * A black hole hangs in the purple/pink void above the End's central island,
 * rendered with a real lensing look (a bright photon ring + a swirling
 * accretion disc, like the Singularity simulator). It is NOT a solid block:
 * it is a physical portal.
 *
 *   - It pulls the player in with growing strength (spaghettification: the
 *     closer you get, the harder it tugs).
 *   - Once you cross the event horizon, `enter()` returns true. In SURVIVAL
 *     you are torn apart and die; in CREATIVE you are teleported into a black
 *     void you can explore freely. There is no loading screen — it is instant.
 */
import {
  Camera, Color3, Color4, DynamicTexture, Effect, Matrix, Mesh, MeshBuilder, ParticleSystem, PostProcess, Scene, StandardMaterial, Texture, Vector3,
} from '@babylonjs/core';

/** Screen-space gravitational-lensing shader, same feel as the Singularity. */
const LENS_SHADER = 'eaoinEndBlackHoleLens';

export class EndBlackHole {
  private core: Mesh | null = null;
  private lens: Mesh | null = null;
  private disc: Mesh | null = null;
  private voidSphere: Mesh | null = null;
  private stars: ParticleSystem | null = null;
  private warpRing: Mesh | null = null;
  private lensPP: PostProcess | null = null;
  private active = false;
  /** Distance at which the black hole starts pulling the player (the Edge). */
  private pullRadius = 90;
  /** Event horizon radius — crossing it means you entered the hole. */
  private horizonRadius = 13;

  constructor(private readonly scene: Scene, private readonly camera?: Camera) {
    Effect.ShadersStore[`${LENS_SHADER}FragmentShader`] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform vec2 holeCenter;
uniform float holeRadius;
uniform float strength;
uniform float aspect;
void main(void){
  vec2 uv = vUV;
  vec2 d = uv - holeCenter;
  d.x *= aspect;
  float dist = length(d);
  if (dist < holeRadius){ gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
  float deflection = strength * holeRadius * holeRadius / (dist*dist);
  deflection = min(deflection, 0.45);
  vec2 dir = normalize(d);
  vec2 warp = dir * deflection;
  warp.x /= aspect;
  vec2 sampleUV = uv - warp;
  float r = texture2D(textureSampler, clamp(uv - warp*0.965, 0.001, 0.999)).r;
  float g = texture2D(textureSampler, clamp(sampleUV, 0.001, 0.999)).g;
  float b = texture2D(textureSampler, clamp(uv - warp*1.045, 0.001, 0.999)).b;
  vec3 col = vec3(r,g,b);
  float ringDist = abs(dist - holeRadius*1.32);
  float ring = exp(-ringDist*90.0) * strength;
  col += vec3(1.0, 0.72, 0.38) * ring * 1.5;
  float shadow = smoothstep(holeRadius*2.6, holeRadius, dist);
  col *= 1.0 - shadow*0.92*strength;
  gl_FragColor = vec4(col, 1.0);
}`;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (this.core) {
      this.core.setEnabled(active);
      this.lens?.setEnabled(active);
      this.disc?.setEnabled(active);
      this.voidSphere?.setEnabled(active);
      this.warpRing?.setEnabled(active);
      if (this.stars) {
        if (active && !this.stars.isStarted()) this.stars.start();
        if (!active && this.stars.isStarted()) this.stars.stop();
      }
    }
    if (active) this.ensureLens();
    else this.disposeLens();
  }

  /** Enable the lensing post-process (only when the hole is active). */
  private ensureLens(): void {
    if (this.lensPP || !this.camera) return;
    try {
      this.lensPP = new PostProcess(LENS_SHADER, LENS_SHADER, ['holeCenter','holeRadius','strength','aspect'], null, 1.0, this.camera);
    } catch (e) {
      console.warn('[EndBlackHole] lensing shader unavailable', e);
      this.lensPP = null;
    }
  }

  private disposeLens(): void {
    this.lensPP?.dispose();
    this.lensPP = null;
  }

  /** Build the black hole above the origin (over the central dragon island). */
  ensure(position: Vector3): void {
    if (this.core) return;
    // Pure black event horizon — a real sphere you can pass INTO.
    this.core = MeshBuilder.CreateSphere('end_black_hole_core', { diameter: this.horizonRadius * 2, segments: 24 }, this.scene);
    const coreMat = new StandardMaterial('end_black_hole_core_mat', this.scene);
    coreMat.emissiveColor = new Color3(0, 0, 0);
    coreMat.diffuseColor = new Color3(0, 0, 0);
    coreMat.specularColor = new Color3(0, 0, 0);
    coreMat.disableLighting = true;
    coreMat.backFaceCulling = false; // visible from inside too
    this.core.material = coreMat;
    this.core.position.copyFrom(position);
    this.core.isPickable = false;

    // Photon ring — a bright, glowing annulus right at the horizon.
    this.lens = MeshBuilder.CreateTorus('end_black_hole_lens', { diameter: this.horizonRadius * 2.4, thickness: 1.4, tessellation: 48 }, this.scene);
    const lensMat = new StandardMaterial('end_black_hole_lens_mat', this.scene);
    lensMat.emissiveColor = new Color3(1.0, 0.75, 0.45);
    lensMat.diffuseColor = new Color3(0.8, 0.5, 0.2);
    lensMat.specularColor = new Color3(0.2, 0.2, 0.2);
    lensMat.alpha = 0.95;
    this.lens.material = lensMat;
    this.lens.position.copyFrom(position);
    this.lens.rotation.x = Math.PI / 2;
    this.lens.isPickable = false;

    // Accretion disc — a flat, glowing warm disc (textured swirl, like the
    // Interstellar look: bright inner edge, wrapped over and under).
    this.disc = MeshBuilder.CreateDisc('end_black_hole_disc', { radius: this.horizonRadius * 4.5, tessellation: 40 }, this.scene);
    const discTex = new DynamicTexture('end_black_hole_disc_tex', { width: 128, height: 128 }, this.scene, false);
    const ctx = discTex.getContext() as unknown as CanvasRenderingContext2D | null;
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, '#fff7e0');
      grad.addColorStop(0.25, '#ffd166');
      grad.addColorStop(0.5, '#ff8c42');
      grad.addColorStop(0.75, '#c0603a');
      grad.addColorStop(1, 'rgba(120,50,20,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      // Animated swirl bands.
      ctx.strokeStyle = 'rgba(255,220,160,0.5)';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(64, 64, 20 + i * 8, i * 0.6, i * 0.6 + 3.4);
        ctx.stroke();
      }
      discTex.update();
    }
    const discMat = new StandardMaterial('end_black_hole_disc_mat', this.scene);
    discMat.emissiveTexture = discTex;
    discMat.diffuseColor = new Color3(0.9, 0.5, 0.2);
    discMat.disableLighting = true;
    discMat.alpha = 0.92;
    discMat.backFaceCulling = false;
    this.disc.material = discMat;
    this.disc.position.copyFrom(position);
    this.disc.rotation.x = Math.PI / 2;
    this.disc.isPickable = false;

    // Interior void — a large black sphere so entering the hole surrounds you
    // with a wall of blackness you can look back out of.
    this.voidSphere = MeshBuilder.CreateSphere('end_black_hole_void', { diameter: this.horizonRadius * 6, segments: 16 }, this.scene);
    const voidMat = new StandardMaterial('end_black_hole_void_mat', this.scene);
    voidMat.emissiveColor = new Color3(0.004, 0.002, 0.01);
    voidMat.diffuseColor = new Color3(0.002, 0.001, 0.005);
    voidMat.specularColor = new Color3(0, 0, 0);
    voidMat.disableLighting = true;
    voidMat.backFaceCulling = false;
    this.voidSphere.material = voidMat;
    this.voidSphere.position.copyFrom(position);
    this.voidSphere.isPickable = false;
    this.voidSphere.isVisible = false; // shown only after entering (creative)

    // Starfield swirling around the hole — a cloud of tiny glowing motes that
    // bend toward the horizon, giving the black hole the same star-warp feel.
    this.stars = new ParticleSystem('end_black_hole_stars', 400, this.scene);
    this.stars.particleTexture = this.makeDotTexture();
    this.stars.emitter = position.clone();
    this.stars.minSize = 0.6; this.stars.maxSize = 2.2;
    this.stars.minLifeTime = 6; this.stars.maxLifeTime = 12;
    this.stars.emitRate = 60;
    this.stars.direction1 = new Vector3(-1, -1, -1);
    this.stars.direction2 = new Vector3(1, 1, 1);
    this.stars.color1 = new Color4(1, 0.95, 0.8, 1);
    this.stars.color2 = new Color4(0.6, 0.85, 1, 1);
    this.stars.colorDead = new Color4(0.4, 0.2, 0.1, 1);
    this.stars.gravity = new Vector3(0, 0, 0);
    this.stars.minEmitPower = 2; this.stars.maxEmitPower = 14;
    this.stars.updateSpeed = 0.01;

    // Warp ring — a faint, large distortion halo so the hole visibly warps
    // the space around it even before the player gets close.
    this.warpRing = MeshBuilder.CreateTorus('end_black_hole_warp', { diameter: this.horizonRadius * 3.4, thickness: 0.6, tessellation: 64 }, this.scene);
    const warpMat = new StandardMaterial('end_black_hole_warp_mat', this.scene);
    warpMat.emissiveColor = new Color3(0.35, 0.55, 0.9);
    warpMat.diffuseColor = new Color3(0.1, 0.15, 0.3);
    warpMat.alpha = 0.35;
    warpMat.disableLighting = true;
    this.warpRing.material = warpMat;
    this.warpRing.position.copyFrom(position);
    this.warpRing.rotation.x = Math.PI / 2;
    this.warpRing.isPickable = false;
  }

  private makeDotTexture(): Texture | null {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 16;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      const grd = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 16, 16);
      return Texture.CreateFromBase64String(c.toDataURL(), 'bhStar', this.scene, true, false);
    } catch {
      return null;
    }
  }

  /** Spin the lens/disc + pulse the ring + feed the lensing post-process. */
  tick(deltaSeconds: number, time = performance.now(), playerPosition?: Vector3): void {
    if (!this.active) return;
    if (this.lens) this.lens.rotation.z += deltaSeconds * 0.6;
    if (this.disc) this.disc.rotation.z += deltaSeconds * 0.2;
    if (this.warpRing) this.warpRing.rotation.z -= deltaSeconds * 0.35;
    if (this.lens) {
      // gentle brightness pulse on the photon ring
      const pulse = 0.9 + 0.1 * Math.sin(time * 0.002);
      (this.lens.material as StandardMaterial).emissiveColor = new Color3(1.0 * pulse, 0.75 * pulse, 0.45 * pulse);
    }
    if (this.stars) this.stars.start();
    this.updateLens(playerPosition ?? this.core?.position ?? Vector3.Zero());
  }

  /** Project the hole to screen space and warp the framebuffer around it. */
  private updateLens(playerPosition: Vector3): void {
    if (!this.lensPP || !this.core || !this.camera) return;
    const engine = this.scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const aspect = width / Math.max(1, height);
    const identity = Matrix.Identity();
    const viewport = this.camera.viewport.toGlobal(width, height);
    const projected = Vector3.Project(this.core.position, identity, this.scene.getTransformMatrix(), viewport);
    const cx = projected.x / width;
    const cy = 1 - projected.y / height;
    const forward = this.camera.getForwardRay().direction;
    const toHole = this.core.position.subtract(playerPosition).normalize();
    const facing = Vector3.Dot(forward, toHole);
    const distance = Vector3.Distance(this.core.position, playerPosition);
    const onScreen = facing > 0 && cx > -0.6 && cx < 1.6 && cy > -0.6 && cy < 1.6;
    const apparentRadius = Math.min(0.55, (this.horizonRadius / Math.max(1, distance)) * 0.85);
    const strength = onScreen ? Math.min(1, 26 / Math.max(1, distance)) : 0;
    this.lensPP.onApply = (effect) => {
      effect.setFloat2('holeCenter', cx, cy);
      effect.setFloat('holeRadius', apparentRadius);
      effect.setFloat('strength', strength);
      effect.setFloat('aspect', aspect);
    };
  }

  /**
   * Pull the player toward the black hole with growing strength (so the closer
   * you get, the harder it tugs — spaghettification). Returns a pull force.
   */
  pull(player: Vector3, out: Vector3): Vector3 {
    out.set(0, 0, 0);
    if (!this.active || !this.core) return out;
    const dx = -player.x;
    const dz = -player.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2) return out; // centred on the axis
    if (dist > this.pullRadius) return out;
    // Strength grows as you approach — stronger than before, so you get
    // visibly pulled in and stretched (spaghettified).
    const falloff = Math.max(0, (this.pullRadius - dist) / this.pullRadius);
    const strength = falloff * falloff * 6.0;
    out.x = (dx / Math.max(1, dist)) * strength;
    out.z = (dz / Math.max(1, dist)) * strength;
    return out;
  }

  /** True when the player has crossed the event horizon (entered the hole). */
  entered(player: Vector3): boolean {
    if (!this.active || !this.core) return false;
    return Math.hypot(player.x, player.z) < this.horizonRadius;
  }

  /**
   * Event-horizon time distortion — gravity dilates time and red-shifts light
   * as the player approaches the hole. Returns a time-scale multiplier (1 = no
   * distortion) and a 0..1 redshift amount, based on the player's distance.
   */
  timeDistortion(player: Vector3): { timeScale: number; redshift: number } {
    if (!this.active || !this.core) return { timeScale: 1, redshift: 0 };
    const dist = Math.hypot(player.x, player.z);
    // 0 (far) .. 1 (at the horizon). Pull radius is the outer edge of effect.
    const t = Math.max(0, Math.min(1, 1 - dist / this.pullRadius));
    // Time slows asymptotically near the horizon.
    const timeScale = 1 - t * t * 0.6;
    // Light red-shifts as gravity deepens.
    const redshift = t * t * 0.9;
    return { timeScale, redshift };
  }

  /** Centre world position of the hole (used to spawn the void in creative). */
  centre(): Vector3 {
    return this.core ? this.core.position.clone() : Vector3.Zero();
  }

  /** Show the black-void interior (creative mode after entering). */
  showVoid(): void {
    if (this.voidSphere) this.voidSphere.isVisible = true;
  }

  dispose(): void {
    this.core?.dispose(); this.lens?.dispose(); this.disc?.dispose(); this.voidSphere?.dispose();
    this.warpRing?.dispose(); this.stars?.dispose(); this.disposeLens();
    this.core = this.lens = this.disc = this.voidSphere = this.warpRing = null;
    this.stars = null;
  }
}


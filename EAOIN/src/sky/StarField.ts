/**
 * StarField — night sky stars, shooting stars and the Aurora Borealis.
 *
 * Stars are GPU thin instances of one tiny box, so ~1400 of them cost a single
 * draw call. Like every other sky element they live on a node that is
 * re-centred on the camera each frame, so they behave as a true skybox.
 *
 * The aurora is a set of tall vertical curtain planes arranged in an arc
 * overhead. Each curtain waves independently and cycles hue along the classic
 * green → cyan → violet aurora ramp.
 */
import {
  Color3,
  Matrix,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
  DynamicTexture,
} from '@babylonjs/core';

/** Radius of the celestial star shell. */
const STAR_SHELL_RADIUS = 1000;
const STAR_COUNT = 1400;
const AURORA_CURTAINS = 14;

interface ShootingStar {
  mesh: Mesh;
  trail: Mesh[];
  direction: Vector3;
  position: Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

export class StarField {
  private readonly scene: Scene;
  private readonly seed: string;
  readonly root: TransformNode;

  private starMesh: Mesh | null = null;
  private starMaterial: StandardMaterial | null = null;
  private starMatrices: Float32Array | null = null;
  private starPhases: Float32Array | null = null;
  private starScales: Float32Array | null = null;
  private starPositions: Float32Array | null = null;

  private auroraRoot: TransformNode | null = null;
  private auroraCurtains: Mesh[] = [];
  private auroraMaterials: StandardMaterial[] = [];

  private shootingStars: ShootingStar[] = [];
  private elapsed = 0;
  private disposed = false;
  private sinceStarRefresh = 0;

  constructor(scene: Scene, seed: string) {
    this.scene = scene;
    this.seed = seed;
    this.root = new TransformNode('star_field_root', scene);
  }

  attach(): void {
    this.createStars();
    this.createAurora();
    this.createShootingStars();
  }

  private hash(s: string): number {
    let h = 2166136261;
    const full = `${this.seed}:${s}`;
    for (let i = 0; i < full.length; i += 1) {
      h ^= full.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 0xffffffff;
  }

  /* ------------------------------------------------------------------ */
  /* Stars                                                               */
  /* ------------------------------------------------------------------ */

  private createStars(): void {
    const mesh = MeshBuilder.CreateBox('star_field_star', { size: 1 }, this.scene);
    const mat = new StandardMaterial('star_field_star_mat', this.scene);
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.disableLighting = true;
    mat.fogEnabled = false;
    mat.alpha = 1;
    mesh.material = mat;
    mesh.parent = this.root;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.applyFog = false;
    mesh.renderingGroupId = 0;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.doNotSyncBoundingInfo = true;

    this.starMatrices = new Float32Array(STAR_COUNT * 16);
    this.starPhases = new Float32Array(STAR_COUNT);
    this.starScales = new Float32Array(STAR_COUNT);
    this.starPositions = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i += 1) {
      // Even distribution over a sphere via the inverse-cosine method, biased
      // to the upper hemisphere so we don't waste instances underground.
      const u = this.hash(`su:${i}`);
      const v = this.hash(`sv:${i}`);
      const theta = u * Math.PI * 2;
      const phi = Math.acos(1 - v * 1.35);
      const x = Math.sin(phi) * Math.cos(theta) * STAR_SHELL_RADIUS;
      const y = Math.abs(Math.cos(phi)) * STAR_SHELL_RADIUS;
      const z = Math.sin(phi) * Math.sin(theta) * STAR_SHELL_RADIUS;

      this.starPositions[i * 3] = x;
      this.starPositions[i * 3 + 1] = y;
      this.starPositions[i * 3 + 2] = z;
      // A few bright stars among many faint ones reads far better than uniform.
      const size = this.hash(`ss:${i}`);
      this.starScales[i] = size > 0.96 ? 6.5 : size > 0.85 ? 4.0 : 2.4;
      this.starPhases[i] = this.hash(`sp:${i}`) * Math.PI * 2;
    }

    this.starMesh = mesh;
    this.starMaterial = mat;
    this.refreshStars(1);
  }

  /** Rewrite star transforms, applying per-star twinkle to the scale. */
  private refreshStars(density: number): void {
    if (!this.starMesh || !this.starMatrices || !this.starScales || !this.starPhases || !this.starPositions) return;

    const visible = Math.floor(STAR_COUNT * Math.max(0, Math.min(1, density)));
    const rotation = Quaternion.Identity();
    for (let i = 0; i < visible; i += 1) {
      const twinkle = 0.72 + 0.28 * Math.sin(this.elapsed * 1.7 + this.starPhases[i]);
      const s = this.starScales[i] * twinkle;
      tempScale.set(s, s, s);
      tempPosition.set(
        this.starPositions[i * 3],
        this.starPositions[i * 3 + 1],
        this.starPositions[i * 3 + 2]
      );
      Matrix.ComposeToRef(tempScale, rotation, tempPosition, tempMatrix);
      tempMatrix.copyToArray(this.starMatrices, i * 16);
    }

    this.starMesh.thinInstanceSetBuffer('matrix', this.starMatrices, 16, false);
    this.starMesh.thinInstanceCount = visible;
  }

  /* ------------------------------------------------------------------ */
  /* Aurora Borealis                                                     */
  /* ------------------------------------------------------------------ */

  private createAurora(): void {
    const root = new TransformNode('aurora_root', this.scene);
    root.parent = this.root;

    // A soft vertical gradient: opaque in the middle, transparent at both ends,
    // so each curtain fades out at top and bottom like the real thing.
    const gradient = new DynamicTexture('aurora_gradient', { width: 8, height: 128 }, this.scene, false);
    const ctx = gradient.getContext() as unknown as CanvasRenderingContext2D;
    const grd = ctx.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0.00, 'rgba(0,0,0,0)');
    grd.addColorStop(0.22, 'rgba(90,90,90,0.55)');
    grd.addColorStop(0.55, 'rgba(255,255,255,1)');
    grd.addColorStop(0.82, 'rgba(120,120,120,0.5)');
    grd.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 8, 128);
    gradient.update(false);

    for (let i = 0; i < AURORA_CURTAINS; i += 1) {
      const curtain = MeshBuilder.CreatePlane(
        `aurora_curtain_${i}`,
        { width: 260, height: 420, sideOrientation: Mesh.DOUBLESIDE },
        this.scene
      );
      const mat = new StandardMaterial(`aurora_curtain_mat_${i}`, this.scene);
      mat.emissiveColor = new Color3(0.25, 1.0, 0.55);
      mat.diffuseColor = Color3.Black();
      mat.specularColor = Color3.Black();
      mat.disableLighting = true;
      mat.opacityTexture = gradient;
      mat.fogEnabled = false;
      mat.backFaceCulling = false;
      // Additive blending is what gives the aurora its luminous, layered look.
      mat.alphaMode = 1;
      mat.alpha = 0.5;
      curtain.material = mat;

      curtain.parent = root;
      curtain.isPickable = false;
      curtain.checkCollisions = false;
      curtain.applyFog = false;
      curtain.renderingGroupId = 0;
      curtain.alwaysSelectAsActiveMesh = true;

      // Arrange the curtains in a wide arc across the northern sky.
      const a = (i / AURORA_CURTAINS) * Math.PI * 1.5 - Math.PI * 0.25;
      const r = 620;
      curtain.position.set(Math.cos(a) * r, 430, Math.sin(a) * r);
      curtain.rotation.y = -a + Math.PI / 2;

      this.auroraCurtains.push(curtain);
      this.auroraMaterials.push(mat);
    }

    this.auroraRoot = root;
  }

  /* ------------------------------------------------------------------ */
  /* Shooting stars                                                      */
  /* ------------------------------------------------------------------ */

  private createShootingStars(): void {
    for (let i = 0; i < 4; i += 1) {
      const mesh = MeshBuilder.CreateBox(`shooting_star_${i}`, { size: 5 }, this.scene);
      const mat = new StandardMaterial(`shooting_star_mat_${i}`, this.scene);
      mat.emissiveColor = new Color3(1, 0.98, 0.90);
      mat.diffuseColor = Color3.Black();
      mat.disableLighting = true;
      mat.fogEnabled = false;
      mesh.material = mat;
      mesh.parent = this.root;
      mesh.isPickable = false;
      mesh.applyFog = false;
      mesh.renderingGroupId = 0;
      mesh.setEnabled(false);

      const trail: Mesh[] = [];
      for (let t = 0; t < 8; t += 1) {
        const seg = MeshBuilder.CreateBox(`shooting_star_trail_${i}_${t}`, { size: 4.2 - t * 0.4 }, this.scene);
        const tm = new StandardMaterial(`shooting_star_trail_mat_${i}_${t}`, this.scene);
        tm.emissiveColor = new Color3(0.82, 0.90, 1);
        tm.diffuseColor = Color3.Black();
        tm.disableLighting = true;
        tm.fogEnabled = false;
        tm.alpha = 0.7 * (1 - t / 8);
        seg.material = tm;
        seg.parent = this.root;
        seg.isPickable = false;
        seg.applyFog = false;
        seg.renderingGroupId = 0;
        seg.setEnabled(false);
        trail.push(seg);
      }

      this.shootingStars.push({
        mesh,
        trail,
        direction: Vector3.Zero(),
        position: Vector3.Zero(),
        life: 0,
        maxLife: 1.6,
        active: false,
      });
    }
  }

  private launchShootingStar(s: ShootingStar): void {
    const a = Math.random() * Math.PI * 2;
    const r = STAR_SHELL_RADIUS * 0.8;
    s.position = new Vector3(Math.cos(a) * r, r * (0.45 + Math.random() * 0.4), Math.sin(a) * r);
    // Streak roughly tangentially, with a downward bias.
    s.direction = new Vector3(-Math.sin(a) + (Math.random() - 0.5) * 0.6, -0.35, Math.cos(a) + (Math.random() - 0.5) * 0.6)
      .normalize()
      .scale(760);
    s.life = 0;
    s.maxLife = 1.1 + Math.random() * 0.9;
    s.active = true;
  }

  /* ------------------------------------------------------------------ */
  /* Update                                                              */
  /* ------------------------------------------------------------------ */

  update(
    deltaSeconds: number,
    cameraPosition: Vector3,
    nightFactor: number,
    starDensity: number,
    auroraStrength: number
  ): void {
    if (this.disposed) return;
    this.elapsed += deltaSeconds;

    // Skybox behaviour: the whole rig tracks the camera in all three axes.
    this.root.position.copyFrom(cameraPosition);

    // Slow celestial rotation of the whole star shell.
    this.root.rotation.y = this.elapsed * 0.0042;

    const starVisible = nightFactor > 0.02 && starDensity > 0.01;
    if (this.starMesh) {
      this.starMesh.setEnabled(starVisible);
      if (this.starMaterial) this.starMaterial.alpha = Math.min(1, nightFactor * 1.5);
      if (starVisible) {
        this.sinceStarRefresh += deltaSeconds;
        if (this.sinceStarRefresh >= 0.10) {
          this.sinceStarRefresh = 0;
          this.refreshStars(starDensity);
        }
      }
    }

    this.updateAurora(deltaSeconds, nightFactor, auroraStrength);
    this.updateShootingStars(deltaSeconds, nightFactor);
  }

  private updateAurora(deltaSeconds: number, nightFactor: number, strength: number): void {
    void deltaSeconds;
    const intensity = nightFactor * strength;
    const visible = intensity > 0.02;
    if (this.auroraRoot) this.auroraRoot.setEnabled(visible);
    if (!visible) return;

    this.auroraCurtains.forEach((curtain, i) => {
      // Each curtain waves on its own phase so the sheet ripples.
      const wave = Math.sin(this.elapsed * 0.34 + i * 0.7);
      const wave2 = Math.cos(this.elapsed * 0.21 + i * 1.3);
      curtain.scaling.y = 0.75 + 0.45 * (0.5 + 0.5 * wave);
      curtain.scaling.x = 0.85 + 0.30 * (0.5 + 0.5 * wave2);
      curtain.position.y = 430 + wave * 46;
      curtain.rotation.z = wave2 * 0.12;

      const mat = this.auroraMaterials[i];
      if (mat) {
        // Cycle along the green → cyan → violet aurora ramp.
        const hue = (this.elapsed * 0.08 + i * 0.11) % 1;
        mat.emissiveColor = auroraColor(hue);
        mat.alpha = intensity * (0.26 + 0.24 * (0.5 + 0.5 * wave));
      }
    });
  }

  private updateShootingStars(deltaSeconds: number, nightFactor: number): void {
    for (const s of this.shootingStars) {
      if (!s.active) {
        if (nightFactor > 0.35 && Math.random() < deltaSeconds * 0.18) this.launchShootingStar(s);
        continue;
      }

      s.life += deltaSeconds;
      if (s.life >= s.maxLife) {
        s.active = false;
        s.mesh.setEnabled(false);
        for (const t of s.trail) t.setEnabled(false);
        continue;
      }

      const t = s.life / s.maxLife;
      const pos = s.position.add(s.direction.scale(t));
      s.mesh.setEnabled(true);
      s.mesh.position.copyFrom(pos);

      const fade = Math.sin(t * Math.PI) * nightFactor;
      const mat = s.mesh.material as StandardMaterial;
      if (mat) mat.alpha = fade;

      s.trail.forEach((seg, i) => {
        seg.setEnabled(true);
        const bt = Math.max(0, t - (i + 1) * 0.018);
        seg.position.copyFrom(s.position.add(s.direction.scale(bt)));
        const sm = seg.material as StandardMaterial;
        if (sm) sm.alpha = fade * 0.62 * (1 - i / s.trail.length);
      });
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.dispose(false, true);
  }
}

/** Green → cyan → violet aurora ramp. */
function auroraColor(t: number): Color3 {
  const green = new Color3(0.22, 1.0, 0.48);
  const cyan = new Color3(0.24, 0.86, 0.96);
  const violet = new Color3(0.62, 0.34, 1.0);
  if (t < 0.5) return Color3.Lerp(green, cyan, t * 2);
  return Color3.Lerp(cyan, violet, (t - 0.5) * 2);
}

const tempMatrix = Matrix.Identity();
const tempScale = new Vector3(1, 1, 1);
const tempPosition = new Vector3(0, 0, 0);

export default StarField;

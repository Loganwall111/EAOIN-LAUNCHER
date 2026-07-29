/**
 * CelestialBodies — "Life Comes Apart 2.0" animated sky objects.
 *
 * Everything here lives on a single `TransformNode` that is re-centred on the
 * camera every frame in **all three axes**, so the whole celestial rig is a
 * true skybox: it can never be approached, entered, or clipped into.
 *
 * Contents:
 *   - Voxel-cube sun with a layered corona + god-ray fan
 *   - Voxel-cube moon with phases
 *   - Ringed gas giant ("the Saturn planet")
 *   - A black hole with an accretion disc and gravitational lens halo
 *   - Two drifting animated planets, each with its own spinning cloud band
 *
 * Scale note: the rig radius is `ORBIT_RADIUS`, comfortably inside the
 * camera's `maxZ` of 1500 but far outside anything the player can reach.
 *
 * ## Removed: the floating white cubes
 *
 * This module used to also emit three families of small, bright, *emissive
 * white boxes*: per-planet `moonlets`, per-planet `trailStars`, and a set of
 * `comets` with 12-segment cube tails. They were the "stray white blocks
 * floating in the sky" artifact.
 *
 * Two things made them read as debris rather than as space decor:
 *
 *  1. They are hard-edged unlit white cubes only ~5-22 units across at a
 *     900-unit orbit, so they never resolved into a recognisable object —
 *     they just looked like untextured geometry someone forgot to delete.
 *  2. Their only visibility gate was `deepSpaceStrength * nightFactor`, and
 *     `applyAlpha` fades *materials* while the meshes stay enabled. Alpha on
 *     an unlit emissive material does not reliably drive it to invisible, so
 *     at midday they remained on screen as white specks against a blue sky.
 *
 * The sun, moon, ringed planet, black hole and the two textured drifting
 * planets are all kept — those are legible, intentional objects. The cube
 * confetti is gone, and the atmospheric layer of the sky is owned by
 * `VolumetricClouds`, which is the correct home for soft sky volume.
 */
import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';

/** Distance from the camera at which celestial bodies orbit. */
export const ORBIT_RADIUS = 900;
/** Cube edge length of the sun. Deliberately huge — "big in the sky". */
export const SUN_SIZE = 132;
/** Cube edge length of the moon. */
export const MOON_SIZE = 96;

export interface CelestialUpdate {
  /** 0-24 world clock. */
  timeOfDay: number;
  /** Camera world position — the rig re-centres here. */
  cameraPosition: Vector3;
  /** Seconds since last frame. */
  deltaSeconds: number;
  /** 0 = no deep-space objects, 1 = fully visible. */
  deepSpaceStrength: number;
  /** Whether this atmosphere has a sun at all. */
  hasSun: boolean;
  /** Tint applied to the sun's emissive. */
  sunTint: Color3;
}

interface DriftingPlanet {
  root: TransformNode;
  body: Mesh;
  clouds: Mesh;
  ring: Mesh | null;
  /** Radians per second around the sky. */
  orbitSpeed: number;
  orbitPhase: number;
  orbitTilt: number;
  orbitRadius: number;
  /** Radians per second of body self-rotation. */
  spinSpeed: number;
  cloudSpinSpeed: number;
}

export class CelestialBodies {
  private readonly scene: Scene;
  /** Parent of everything; re-centred on the camera each frame. */
  readonly root: TransformNode;

  sun: Mesh | null = null;
  sunCorona: Mesh | null = null;
  sunGlow: Mesh | null = null;
  godRays: Mesh[] = [];
  moon: Mesh | null = null;
  moonShadow: Mesh | null = null;

  ringedPlanet: TransformNode | null = null;
  blackHole: TransformNode | null = null;
  blackHoleDisc: Mesh | null = null;

  private planets: DriftingPlanet[] = [];
  private elapsed = 0;
  private disposed = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.root = new TransformNode('celestial_rig', scene);
    // The rig is pure decoration — never picked, never collided with.
    this.root.getChildMeshes = this.root.getChildMeshes.bind(this.root);
  }

  attach(): void {
    this.createSun();
    this.createMoon();
    this.createRingedPlanet();
    this.createBlackHole();
    this.createDriftingPlanets();
  }

  /* ------------------------------------------------------------------ */
  /* Materials                                                           */
  /* ------------------------------------------------------------------ */

  /** Unlit emissive material — celestial bodies are never shaded by scene lights. */
  private emissiveMaterial(name: string, color: Color3, alpha = 1): StandardMaterial {
    const m = new StandardMaterial(name, this.scene);
    m.emissiveColor = color;
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.ambientColor = Color3.Black();
    m.disableLighting = true;
    m.alpha = alpha;
    m.backFaceCulling = false;
    // Never let world fog wash out an object that is nominally at infinity.
    m.fogEnabled = false;
    return m;
  }

  /**
   * Shared setup: a celestial mesh must be unpickable, uncollidable, immune to
   * fog, and drawn in rendering group 0 so world geometry always occludes it.
   */
  private configure(mesh: Mesh, parent: TransformNode): Mesh {
    mesh.parent = parent;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.applyFog = false;
    mesh.renderingGroupId = 0;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.doNotSyncBoundingInfo = true;
    mesh.metadata = { ...(mesh.metadata ?? {}), celestial: true };
    return mesh;
  }

  /** Procedural pixel texture used for planet surfaces and cloud bands. */
  private planetTexture(name: string, base: string, accent: string, bands: number): DynamicTexture {
    const size = 128;
    const tex = new DynamicTexture(name, { width: size, height: size }, this.scene, false);
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // Horizontal cloud/gas bands, Jupiter style.
    for (let i = 0; i < bands; i += 1) {
      const y = (i / bands) * size;
      const h = size / bands;
      const shade = i % 2 === 0 ? accent : base;
      ctx.fillStyle = shade;
      ctx.globalAlpha = 0.35 + ((i * 37) % 40) / 100;
      ctx.fillRect(0, y, size, h * 0.7);
    }
    ctx.globalAlpha = 1;

    // Chunky voxel-ish surface detail so it matches the blocky art direction.
    for (let i = 0; i < 90; i += 1) {
      const x = Math.floor((((i * 71) % size) / 8)) * 8;
      const y = Math.floor((((i * 137) % size) / 8)) * 8;
      ctx.fillStyle = i % 3 === 0 ? accent : base;
      ctx.globalAlpha = 0.30;
      ctx.fillRect(x, y, 8, 8);
    }
    ctx.globalAlpha = 1;

    tex.update(false);
    return tex;
  }

  /* ------------------------------------------------------------------ */
  /* Sun — a cube, not a sphere, per the art direction                   */
  /* ------------------------------------------------------------------ */

  private createSun(): void {
    // "animated sun and planet so they're cubes instead circles"
    const sun = MeshBuilder.CreateBox('celestial_sun_cube', { size: SUN_SIZE }, this.scene);
    sun.material = this.emissiveMaterial('celestial_sun_mat', new Color3(1.0, 0.86, 0.42));
    this.configure(sun, this.root);
    this.sun = sun;

    // Inner corona — a slightly larger, softer cube shell.
    const corona = MeshBuilder.CreateBox('celestial_sun_corona', { size: SUN_SIZE * 1.5 }, this.scene);
    corona.material = this.emissiveMaterial('celestial_sun_corona_mat', new Color3(1.0, 0.60, 0.20), 0.28);
    this.configure(corona, this.root);
    this.sunCorona = corona;

    // Outer atmospheric bloom — a big soft sphere so the glow reads as round
    // light scattering around a hard-edged cube body.
    const glow = MeshBuilder.CreateSphere('celestial_sun_glow', { diameter: SUN_SIZE * 3.4, segments: 12 }, this.scene);
    glow.material = this.emissiveMaterial('celestial_sun_glow_mat', new Color3(1.0, 0.52, 0.18), 0.11);
    this.configure(glow, this.root);
    this.sunGlow = glow;

    // God rays: a fan of long thin blades that rotate slowly around the sun.
    for (let i = 0; i < 10; i += 1) {
      const ray = MeshBuilder.CreatePlane(
        `celestial_god_ray_${i}`,
        { width: SUN_SIZE * 0.30, height: SUN_SIZE * 6.5 },
        this.scene
      );
      ray.material = this.emissiveMaterial(`celestial_god_ray_mat_${i}`, new Color3(1.0, 0.74, 0.34), 0.05);
      ray.rotation.z = (i / 10) * Math.PI;
      this.configure(ray, this.root);
      this.godRays.push(ray);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Moon                                                                */
  /* ------------------------------------------------------------------ */

  private createMoon(): void {
    const moon = MeshBuilder.CreateBox('celestial_moon_cube', { size: MOON_SIZE }, this.scene);
    const mat = this.emissiveMaterial('celestial_moon_mat', new Color3(0.88, 0.91, 0.98));
    mat.emissiveTexture = this.planetTexture('celestial_moon_tex', '#d9dde8', '#9aa2b4', 5);
    moon.material = mat;
    this.configure(moon, this.root);
    this.moon = moon;

    // A dark cube parked just in front of the moon produces the phase
    // terminator when it slides across — cheap, and it reads correctly.
    const shadow = MeshBuilder.CreateBox('celestial_moon_shadow', { size: MOON_SIZE * 1.04 }, this.scene);
    shadow.material = this.emissiveMaterial('celestial_moon_shadow_mat', new Color3(0.01, 0.012, 0.03), 0.94);
    this.configure(shadow, this.root);
    this.moonShadow = shadow;
  }

  /* ------------------------------------------------------------------ */
  /* Ringed gas giant — "the Saturn planet"                              */
  /* ------------------------------------------------------------------ */

  private createRingedPlanet(): void {
    const node = new TransformNode('celestial_ringed_planet', this.scene);
    node.parent = this.root;

    const body = MeshBuilder.CreateBox('celestial_saturn_body', { size: 190 }, this.scene);
    const mat = this.emissiveMaterial('celestial_saturn_mat', new Color3(0.92, 0.80, 0.56));
    mat.emissiveTexture = this.planetTexture('celestial_saturn_tex', '#d8b98a', '#a8814f', 9);
    body.material = mat;
    this.configure(body, node);

    // Ring system: three concentric flat tori, tilted off-axis like Saturn.
    const ringSpecs: Array<[number, number, number, string]> = [
      [300, 14, 0.34, '#e8d4a8'],
      [360, 10, 0.24, '#c9b189'],
      [415, 6, 0.16, '#a89272'],
    ];
    for (const [diameter, thickness, alpha, hex] of ringSpecs) {
      const ring = MeshBuilder.CreateTorus(
        `celestial_saturn_ring_${diameter}`,
        { diameter, thickness, tessellation: 56 },
        this.scene
      );
      ring.material = this.emissiveMaterial(
        `celestial_saturn_ring_mat_${diameter}`,
        Color3.FromHexString(hex),
        alpha
      );
      // Squash into a flat disc, then tilt.
      ring.scaling.y = 0.045;
      this.configure(ring, node);
    }
    node.rotation.x = 0.42;
    node.rotation.z = 0.18;

    this.ringedPlanet = node;
  }

  /* ------------------------------------------------------------------ */
  /* Black hole                                                          */
  /* ------------------------------------------------------------------ */

  private createBlackHole(): void {
    const node = new TransformNode('celestial_black_hole', this.scene);
    node.parent = this.root;

    // Event horizon — pure black, fully opaque, occludes the stars behind it.
    const horizon = MeshBuilder.CreateSphere('celestial_black_hole_core', { diameter: 120, segments: 18 }, this.scene);
    const coreMat = this.emissiveMaterial('celestial_black_hole_core_mat', new Color3(0, 0, 0), 1);
    coreMat.backFaceCulling = true;
    horizon.material = coreMat;
    this.configure(horizon, node);

    // Gravitational lensing halo — a thin bright ring hugging the horizon.
    const lens = MeshBuilder.CreateTorus(
      'celestial_black_hole_lens',
      { diameter: 150, thickness: 9, tessellation: 64 },
      this.scene
    );
    lens.material = this.emissiveMaterial('celestial_black_hole_lens_mat', new Color3(1.0, 0.78, 0.42), 0.70);
    lens.scaling.y = 0.10;
    this.configure(lens, node);

    // Accretion disc — glowing infalling matter, spins fast.
    const disc = MeshBuilder.CreateTorus(
      'celestial_black_hole_disc',
      { diameter: 260, thickness: 46, tessellation: 64 },
      this.scene
    );
    disc.material = this.emissiveMaterial('celestial_black_hole_disc_mat', new Color3(1.0, 0.46, 0.14), 0.44);
    disc.scaling.y = 0.07;
    this.configure(disc, node);
    this.blackHoleDisc = disc;

    // Outer faint disc for depth.
    const outer = MeshBuilder.CreateTorus(
      'celestial_black_hole_disc_outer',
      { diameter: 350, thickness: 30, tessellation: 48 },
      this.scene
    );
    outer.material = this.emissiveMaterial('celestial_black_hole_outer_mat', new Color3(0.72, 0.30, 0.86), 0.20);
    outer.scaling.y = 0.05;
    this.configure(outer, node);

    node.rotation.x = 1.05;
    node.rotation.z = -0.28;
    this.blackHole = node;
  }

  /* ------------------------------------------------------------------ */
  /* Drifting animated planets with cloud bands + trailing stars          */
  /* ------------------------------------------------------------------ */

  private createDriftingPlanets(): void {
    const specs: Array<{
      name: string;
      size: number;
      base: string;
      accent: string;
      cloud: string;
      bands: number;
      orbitRadius: number;
      orbitSpeed: number;
      orbitPhase: number;
      orbitTilt: number;
      spinSpeed: number;
      cloudSpinSpeed: number;
      ring: boolean;
    }> = [
      {
        name: 'verdant',
        size: 128,
        base: '#3f7fb5',
        accent: '#6fb36a',
        cloud: '#eaf4ff',
        bands: 6,
        orbitRadius: ORBIT_RADIUS * 0.86,
        // A slow drift across the sky, distinct from the sun's 20-minute cycle.
        orbitSpeed: 0.0130,
        orbitPhase: 0.8,
        orbitTilt: 0.30,
        spinSpeed: 0.22,
        cloudSpinSpeed: 0.34,
        ring: false,
      },
      {
        name: 'ember',
        size: 104,
        base: '#b5563f',
        accent: '#e8a05a',
        cloud: '#ffd9a8',
        bands: 8,
        orbitRadius: ORBIT_RADIUS * 0.94,
        orbitSpeed: -0.0092,
        orbitPhase: 3.6,
        orbitTilt: -0.44,
        spinSpeed: -0.28,
        cloudSpinSpeed: -0.40,
        ring: true,
      },
    ];

    for (const spec of specs) {
      const root = new TransformNode(`celestial_planet_${spec.name}`, this.scene);
      root.parent = this.root;

      const body = MeshBuilder.CreateBox(`celestial_planet_${spec.name}_body`, { size: spec.size }, this.scene);
      const bodyMat = this.emissiveMaterial(
        `celestial_planet_${spec.name}_mat`,
        Color3.FromHexString(spec.base).scale(1.25)
      );
      bodyMat.emissiveTexture = this.planetTexture(
        `celestial_planet_${spec.name}_tex`,
        spec.base,
        spec.accent,
        spec.bands
      );
      body.material = bodyMat;
      this.configure(body, root);

      // "they have actual animations that the clouds on the planets and move" —
      // a separate translucent shell that counter-rotates over the surface.
      const clouds = MeshBuilder.CreateSphere(
        `celestial_planet_${spec.name}_clouds`,
        { diameter: spec.size * 1.22, segments: 16 },
        this.scene
      );
      const cloudMat = this.emissiveMaterial(
        `celestial_planet_${spec.name}_cloud_mat`,
        Color3.FromHexString(spec.cloud),
        0.30
      );
      cloudMat.opacityTexture = this.planetTexture(
        `celestial_planet_${spec.name}_cloud_tex`,
        '#404040',
        '#ffffff',
        4
      );
      clouds.material = cloudMat;
      this.configure(clouds, root);

      let ring: Mesh | null = null;
      if (spec.ring) {
        ring = MeshBuilder.CreateTorus(
          `celestial_planet_${spec.name}_ring`,
          { diameter: spec.size * 2.3, thickness: 11, tessellation: 48 },
          this.scene
        );
        ring.material = this.emissiveMaterial(
          `celestial_planet_${spec.name}_ring_mat`,
          Color3.FromHexString(spec.accent),
          0.30
        );
        ring.scaling.y = 0.05;
        ring.rotation.x = 0.34;
        this.configure(ring, root);
      }

      this.planets.push({
        root,
        body,
        clouds,
        ring,
        orbitSpeed: spec.orbitSpeed,
        orbitPhase: spec.orbitPhase,
        orbitTilt: spec.orbitTilt,
        orbitRadius: spec.orbitRadius,
        spinSpeed: spec.spinSpeed,
        cloudSpinSpeed: spec.cloudSpinSpeed,
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Per-frame update                                                    */
  /* ------------------------------------------------------------------ */

  update(u: CelestialUpdate): { sunDirection: Vector3; dayFactor: number; nightFactor: number } {
    if (this.disposed) {
      return { sunDirection: new Vector3(0, -1, 0), dayFactor: 1, nightFactor: 0 };
    }

    this.elapsed += u.deltaSeconds;

    // THE FIX for "blue screen when I look up": the entire celestial rig is
    // re-centred on the camera in all three axes every frame. Nothing here can
    // ever end up beside or behind the player, or intersect the near plane.
    this.root.position.copyFrom(u.cameraPosition);

    // Sun rises in the east at 06:00, peaks at 12:00, sets in the west at 18:00.
    const sunAngle = ((u.timeOfDay - 6) / 24) * Math.PI * 2;
    const sunPos = new Vector3(
      Math.cos(sunAngle) * ORBIT_RADIUS,
      Math.sin(sunAngle) * ORBIT_RADIUS,
      Math.sin(sunAngle * 0.5) * ORBIT_RADIUS * 0.28
    );
    const dayFactor = Math.max(0, Math.sin(sunAngle));
    const nightFactor = Math.max(0, -Math.sin(sunAngle));
    // Peaks at dawn and dusk, zero at noon and midnight.
    const horizonFactor = Math.max(0, 1 - Math.abs(Math.sin(sunAngle)) * 3.2);

    this.updateSun(u, sunPos, dayFactor, horizonFactor);
    this.updateMoon(sunPos, nightFactor);
    this.updateDeepSpace(u, nightFactor);
    this.updatePlanets(u, nightFactor);

    const sunDirection = sunPos.clone().normalize().scale(-1);
    return { sunDirection, dayFactor, nightFactor };
  }

  private updateSun(u: CelestialUpdate, sunPos: Vector3, dayFactor: number, horizonFactor: number): void {
    const visible = u.hasSun;
    for (const mesh of [this.sun, this.sunCorona, this.sunGlow]) {
      if (mesh) mesh.setEnabled(visible);
    }
    for (const ray of this.godRays) ray.setEnabled(visible);
    if (!visible || !this.sun) return;

    this.sun.position.copyFrom(sunPos);
    // A slow tumble so the cube reads as a solid object, not a flat sprite.
    this.sun.rotation.y = this.elapsed * 0.07;
    this.sun.rotation.x = this.elapsed * 0.035;

    // Warm the sun towards deep orange as it approaches the horizon — this is
    // what makes the "crazy sunsets" land.
    const sunsetTint = Color3.Lerp(u.sunTint, new Color3(1.0, 0.38, 0.12), horizonFactor);
    const sunMat = this.sun.material as StandardMaterial;
    if (sunMat) sunMat.emissiveColor = sunsetTint;

    if (this.sunCorona) {
      this.sunCorona.position.copyFrom(sunPos);
      this.sunCorona.rotation.y = -this.elapsed * 0.045;
      this.sunCorona.rotation.z = this.elapsed * 0.03;
      const m = this.sunCorona.material as StandardMaterial;
      // The corona swells and reddens dramatically at sunrise/sunset.
      if (m) {
        m.alpha = 0.20 + horizonFactor * 0.34;
        m.emissiveColor = Color3.Lerp(new Color3(1.0, 0.62, 0.22), new Color3(1.0, 0.28, 0.08), horizonFactor);
      }
      const swell = 1 + horizonFactor * 0.42;
      this.sunCorona.scaling.set(swell, swell, swell);
    }

    if (this.sunGlow) {
      this.sunGlow.position.copyFrom(sunPos);
      const m = this.sunGlow.material as StandardMaterial;
      if (m) {
        m.alpha = 0.06 + horizonFactor * 0.20 + dayFactor * 0.05;
        m.emissiveColor = Color3.Lerp(new Color3(1.0, 0.56, 0.20), new Color3(1.0, 0.24, 0.10), horizonFactor);
      }
    }

    // God rays fan out and brighten at low sun angles.
    const rayAlpha = 0.02 + horizonFactor * 0.13 + dayFactor * 0.015;
    this.godRays.forEach((ray, i) => {
      ray.position.copyFrom(sunPos);
      // Always face the player, then spin the fan about the view axis.
      ray.lookAt(this.root.position);
      ray.addRotation(0, 0, (i / this.godRays.length) * Math.PI + this.elapsed * 0.05);
      const m = ray.material as StandardMaterial;
      if (m) m.alpha = rayAlpha * (0.6 + 0.4 * Math.sin(this.elapsed * 0.7 + i));
      const stretch = 1 + horizonFactor * 0.9;
      ray.scaling.set(1, stretch, 1);
    });
  }

  private updateMoon(sunPos: Vector3, nightFactor: number): void {
    if (!this.moon) return;
    // The moon sits opposite the sun.
    const moonPos = sunPos.scale(-1);
    this.moon.position.copyFrom(moonPos);
    this.moon.rotation.y = this.elapsed * 0.02;
    this.moon.setEnabled(nightFactor > 0.01);

    const mat = this.moon.material as StandardMaterial;
    if (mat) mat.alpha = Math.min(1, nightFactor * 1.6);

    if (this.moonShadow) {
      this.moonShadow.setEnabled(nightFactor > 0.01);
      // An 8-phase cycle: the shadow cube slides across the moon's face.
      const phase = (this.elapsed / 240) % 1;
      const offset = Math.cos(phase * Math.PI * 2) * MOON_SIZE * 1.15;
      const toCamera = this.root.position.subtract(moonPos).normalize();
      const right = Vector3.Cross(toCamera, Vector3.Up()).normalize();
      this.moonShadow.position.copyFrom(moonPos.add(right.scale(offset)).add(toCamera.scale(-2)));
      this.moonShadow.rotation.copyFrom(this.moon.rotation);
      const sm = this.moonShadow.material as StandardMaterial;
      if (sm) sm.alpha = 0.94 * Math.min(1, nightFactor * 1.6);
    }
  }

  private updateDeepSpace(u: CelestialUpdate, nightFactor: number): void {
    // Deep-space objects fade in with the night and are suppressed entirely in
    // atmospheres that don't show them (caves, the Nether, the Sun).
    const strength = u.deepSpaceStrength * nightFactor;
    const visible = strength > 0.02;

    if (this.ringedPlanet) {
      this.ringedPlanet.setEnabled(visible);
      if (visible) {
        const a = this.elapsed * 0.006 + 1.9;
        this.ringedPlanet.position.set(
          Math.cos(a) * ORBIT_RADIUS * 0.78,
          ORBIT_RADIUS * 0.46,
          Math.sin(a) * ORBIT_RADIUS * 0.78
        );
        this.ringedPlanet.rotation.y = this.elapsed * 0.045;
        this.applyAlpha(this.ringedPlanet, strength);
      }
    }

    if (this.blackHole) {
      this.blackHole.setEnabled(visible);
      if (visible) {
        const a = -this.elapsed * 0.004 + 4.4;
        this.blackHole.position.set(
          Math.cos(a) * ORBIT_RADIUS * 0.72,
          ORBIT_RADIUS * 0.55,
          Math.sin(a) * ORBIT_RADIUS * 0.72
        );
        // The accretion disc spins much faster than the host node.
        this.blackHole.rotation.y = this.elapsed * 0.09;
        if (this.blackHoleDisc) this.blackHoleDisc.rotation.y = this.elapsed * 0.85;
        this.applyAlpha(this.blackHole, strength);
      }
    }
  }

  /**
   * Scale every descendant material's alpha by `strength`, remembering each
   * material's authored alpha the first time we touch it so repeated fades
   * never compound.
   */
  private applyAlpha(node: TransformNode, strength: number): void {
    for (const mesh of node.getChildMeshes()) {
      const mat = mesh.material as StandardMaterial | null;
      if (!mat) continue;
      const meta = (mat.metadata ??= {}) as { baseAlpha?: number };
      if (meta.baseAlpha === undefined) meta.baseAlpha = mat.alpha;
      mat.alpha = meta.baseAlpha * strength;
    }
  }

  private updatePlanets(u: CelestialUpdate, nightFactor: number): void {
    // Planets linger a little into twilight rather than snapping off at dusk.
    const strength = u.deepSpaceStrength * Math.min(1, nightFactor * 1.35);
    const visible = strength > 0.02;

    for (const p of this.planets) {
      p.root.setEnabled(visible);
      if (!visible) continue;

      const a = this.elapsed * p.orbitSpeed + p.orbitPhase;
      p.root.position.set(
        Math.cos(a) * p.orbitRadius,
        Math.sin(a * 0.5 + p.orbitTilt) * p.orbitRadius * 0.42 + p.orbitRadius * 0.30,
        Math.sin(a) * p.orbitRadius
      );

      // Body and cloud shell rotate at different rates, so the cloud bands
      // visibly drift across the surface.
      p.body.rotation.y = this.elapsed * p.spinSpeed;
      p.clouds.rotation.y = this.elapsed * p.cloudSpinSpeed;
      p.clouds.rotation.x = Math.sin(this.elapsed * 0.11) * 0.06;
      if (p.ring) p.ring.rotation.y = this.elapsed * 0.10;

      this.applyAlpha(p.root, strength);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.dispose(false, true);
  }
}

export default CelestialBodies;

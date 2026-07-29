/**
 * PhysicalPlanets — real, enterable planet meshes in the upper sky layer.
 *
 * `CelestialBodies` owns the purely decorative sky rig (sun, moon, distant
 * drifting planets, the black hole) — that rig is re-centred on the camera
 * every frame so it behaves as a true skybox and can never be approached.
 * This module is the opposite: a small set of planets that sit at *fixed*
 * world coordinates high above the terrain, genuinely get bigger as the
 * player flies toward them (a physical object, not a flat sky sprite), and
 * trigger a real dimension swap when the player crosses into their
 * atmosphere. That is what turns "pretty background decoration" into
 * "a place you can actually go".
 *
 * ## Replacing the placeholder "black boxes"
 *
 * Earlier drafts of the space layer used untextured boxes with a flat
 * diffuse colour and no surface detail — legible as a coloured cube, not as
 * a world. Every planet here is a real sphere mesh with a procedurally
 * painted surface (bands, craters, or storm swirls depending on its type),
 * so each one reads as a distinct, immersive world before the player ever
 * lands on it.
 */
import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import { RuntimeDimensionID } from '../dimensions/DimensionRuntime';

export type PlanetKind = 'desert' | 'volcanic' | 'frozen' | 'gas_giant' | 'ocean';

export interface PlanetDefinition {
  id: string;
  name: string;
  kind: PlanetKind;
  /** The voxel dimension this planet's surface actually loads. */
  dimension: RuntimeDimensionID;
  /** Fixed world position, far above and away from the spawn point. */
  position: Vector3;
  /** Resting visual radius, before approach scaling. */
  radius: number;
  /** Distance at which the player's approach starts swapping the world. */
  atmosphereRadius: number;
  base: string;
  accent: string;
  bandCount: number;
}

/**
 * Registry of physical planets. Positions are well outside ordinary render
 * distance and well above the build ceiling, so they never collide with
 * ordinary terrain streaming, but are still real, fixed coordinates a player
 * can flat-out fly to (unlike the camera-locked `CelestialBodies` rig).
 */
export function buildPlanetRegistry(spawn: Vector3): PlanetDefinition[] {
  return [
    {
      id: 'planet_ember',
      name: 'Ember',
      kind: 'volcanic',
      dimension: 'volcanic_realm',
      position: new Vector3(spawn.x + 2200, spawn.y + 900, spawn.z - 1400),
      radius: 140,
      atmosphereRadius: 220,
      base: '#5a1c10',
      accent: '#ff7a2a',
      bandCount: 5,
    },
    {
      id: 'planet_dune',
      name: 'Dune',
      kind: 'desert',
      dimension: 'toxic_wasteland',
      position: new Vector3(spawn.x - 2400, spawn.y + 1100, spawn.z + 1800),
      radius: 160,
      atmosphereRadius: 240,
      base: '#c9a15a',
      accent: '#8a6a34',
      bandCount: 4,
    },
    {
      id: 'planet_glacius',
      name: 'Glacius',
      kind: 'frozen',
      dimension: 'frozen_wasteland',
      position: new Vector3(spawn.x + 1600, spawn.y + 1400, spawn.z + 2600),
      radius: 150,
      atmosphereRadius: 230,
      base: '#bfe4ff',
      accent: '#6fa8d8',
      bandCount: 6,
    },
    {
      id: 'planet_maren',
      name: 'Maren',
      kind: 'ocean',
      dimension: 'ocean_world',
      position: new Vector3(spawn.x - 1900, spawn.y + 800, spawn.z - 2200),
      radius: 145,
      atmosphereRadius: 225,
      base: '#0e5f9a',
      accent: '#3fb6c9',
      bandCount: 5,
    },
    {
      id: 'planet_kolos',
      name: 'Kolos',
      kind: 'gas_giant',
      dimension: 'gas_giant',
      position: new Vector3(spawn.x + 3200, spawn.y + 1700, spawn.z + 400),
      radius: 260,
      atmosphereRadius: 340,
      base: '#d9b98a',
      accent: '#a8814f',
      bandCount: 9,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Pure functions — the actual physical-approach behaviour             */
/* ------------------------------------------------------------------ */

/**
 * Scale multiplier for a planet at the given distance, so it behaves as a
 * genuine physical object rather than a flat image stuck to a skybox.
 *
 * Modelled on real perspective: apparent size is inversely proportional to
 * distance. `referenceDistance` is the distance at which the planet renders
 * at its authored resting radius (scale 1); closer than that it grows,
 * farther than that it shrinks — both clamped so it can never disappear to
 * nothing or blow up to fill the screen from across the map.
 */
export function approachScale(
  distance: number,
  referenceDistance: number,
  minScale = 0.35,
  maxScale = 5
): number {
  const safeDistance = Math.max(1, distance);
  const raw = referenceDistance / safeDistance;
  return Math.max(minScale, Math.min(maxScale, raw));
}

/**
 * True once the player has crossed into a planet's atmospheric boundary.
 * Pure distance check so it is trivial to unit test independently of a live
 * Babylon scene.
 */
export function isInsideAtmosphere(distance: number, atmosphereRadius: number): boolean {
  return distance <= atmosphereRadius;
}

export interface PlanetApproachEvent {
  planet: PlanetDefinition;
}

/**
 * Edge-triggered atmosphere crossing detector.
 *
 * Tracks which planets the caller was already inside on the previous frame
 * so `update()` reports an entry event exactly once per approach, not every
 * frame the player happens to be near a planet — and reports it again if
 * they leave and come back.
 */
export class PlanetApproachTracker {
  private insideIds = new Set<string>();

  /** Call once per frame with the current camera distance to every planet. */
  update(planets: PlanetDefinition[], cameraPosition: Vector3): PlanetApproachEvent[] {
    const events: PlanetApproachEvent[] = [];
    const stillInside = new Set<string>();

    for (const planet of planets) {
      const distance = Vector3.Distance(planet.position, cameraPosition);
      const inside = isInsideAtmosphere(distance, planet.atmosphereRadius);
      if (inside) {
        stillInside.add(planet.id);
        if (!this.insideIds.has(planet.id)) {
          events.push({ planet });
        }
      }
    }

    this.insideIds = stillInside;
    return events;
  }

  reset(): void {
    this.insideIds.clear();
  }
}

/* ------------------------------------------------------------------ */
/* Babylon-facing rendering                                            */
/* ------------------------------------------------------------------ */

interface PlanetInstance {
  def: PlanetDefinition;
  mesh: Mesh;
  material: StandardMaterial;
}

export class PhysicalPlanets {
  private readonly scene: Scene;
  private readonly planets: PlanetDefinition[];
  private readonly instances: PlanetInstance[] = [];
  private readonly tracker = new PlanetApproachTracker();
  private disposed = false;

  constructor(scene: Scene, spawn: Vector3) {
    this.scene = scene;
    this.planets = buildPlanetRegistry(spawn);
  }

  attach(): void {
    for (const def of this.planets) {
      const mesh = MeshBuilder.CreateSphere(
        `physical_${def.id}`,
        { diameter: def.radius * 2, segments: 28 },
        this.scene
      );
      mesh.position.copyFrom(def.position);
      mesh.isPickable = false;
      mesh.checkCollisions = false;
      mesh.applyFog = false;
      mesh.receiveShadows = false;
      mesh.metadata = { physicalPlanet: def.id, dimension: def.dimension };

      const material = new StandardMaterial(`physical_${def.id}_mat`, this.scene);
      const texture = this.buildSurfaceTexture(def);
      material.diffuseTexture = texture;
      material.emissiveTexture = texture;
      material.emissiveColor = new Color3(0.5, 0.5, 0.5);
      material.specularColor = Color3.Black();
      material.disableLighting = false;
      material.backFaceCulling = true;
      material.fogEnabled = false;
      mesh.material = material;

      this.instances.push({ def, mesh, material });
    }
  }

  /** Procedural surface: distinct bands/spots per planet type, no two alike. */
  private buildSurfaceTexture(def: PlanetDefinition): DynamicTexture {
    const size = 256;
    const texture = new DynamicTexture(`physical_${def.id}_tex`, { width: size, height: size }, this.scene, false);
    const ctx = texture.getContext() as unknown as CanvasRenderingContext2D | null;
    // Headless/test canvases (jsdom without the optional `canvas` package)
    // report no 2D context at all. The mesh and material must still be
    // created correctly in that environment — only the painted detail is
    // skipped — so this never throws during tests or a canvas-less render.
    if (!ctx) return texture;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = def.base;
    ctx.fillRect(0, 0, size, size);

    // Horizontal bands — gas giants and ice caps read clearly this way.
    for (let i = 0; i < def.bandCount; i += 1) {
      const y = (i / def.bandCount) * size;
      const h = size / def.bandCount;
      ctx.fillStyle = i % 2 === 0 ? def.accent : def.base;
      ctx.globalAlpha = 0.30 + ((i * 41) % 45) / 100;
      ctx.fillRect(0, y, size, h * 0.72);
    }
    ctx.globalAlpha = 1;

    if (def.kind === 'volcanic') {
      // Glowing cracks: short bright accent segments scattered over the base.
      for (let i = 0; i < 60; i += 1) {
        const x = (i * 53) % size;
        const y = (i * 97) % size;
        ctx.fillStyle = def.accent;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x, y, 10, 2);
      }
    } else if (def.kind === 'desert' || def.kind === 'frozen') {
      // Crater/ice-sheet speckle.
      for (let i = 0; i < 90; i += 1) {
        const x = (i * 71) % size;
        const y = (i * 137) % size;
        const r = 2 + (i % 4);
        ctx.fillStyle = i % 3 === 0 ? def.accent : def.base;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (def.kind === 'ocean') {
      // Coastline blobs breaking up the water bands.
      for (let i = 0; i < 24; i += 1) {
        const x = (i * 113) % size;
        const y = (i * 61) % size;
        ctx.fillStyle = def.accent;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.ellipse(x, y, 14, 9, i * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Gas giant storm swirl.
      ctx.strokeStyle = def.accent;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(size * 0.62, size * 0.42, 34, 20, 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    texture.update(false);
    return texture;
  }

  /**
   * Advance the field: spin planets slowly, scale each by the player's real
   * distance to it (the "physical object" behaviour), and report any newly
   * entered atmospheres so the caller can trigger the dimension swap.
   */
  update(deltaSeconds: number, cameraPosition: Vector3): PlanetApproachEvent[] {
    if (this.disposed) return [];

    for (const instance of this.instances) {
      instance.mesh.rotation.y += deltaSeconds * 0.05;
      const distance = Vector3.Distance(instance.def.position, cameraPosition);
      const scale = approachScale(distance, instance.def.atmosphereRadius * 2.4);
      instance.mesh.scaling.set(scale, scale, scale);
    }

    return this.tracker.update(this.planets, cameraPosition);
  }

  getPlanets(): ReadonlyArray<PlanetDefinition> {
    return this.planets;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const instance of this.instances) {
      instance.mesh.dispose();
      instance.material.dispose();
    }
    this.instances.length = 0;
    this.tracker.reset();
  }
}

export default PhysicalPlanets;

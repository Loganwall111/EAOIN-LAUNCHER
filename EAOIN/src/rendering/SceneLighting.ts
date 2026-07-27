/**
 * SceneLighting — the world lighting rig: sun, sky light, shadows, spawn beacon.
 *
 * ## BUGFIX 2.0 — this file no longer draws any sky
 *
 * It used to build **two nested `infiniteDistance` BACKSIDE spheres**:
 *
 *   overworld_sky_dome     d=1200  alpha 1.00  flat emissive colour
 *   horizon_gradient_dome  d=800   alpha 0.08
 *
 * `infiniteDistance` pins a mesh to the camera, so both spheres sat at the same
 * effective depth with the smaller permanently inside the larger — they
 * z-fought. Worse, the outer dome was a single flat colour, so pitching the
 * camera above the horizon filled the screen with one uniform blue that
 * flickered, then looked normal again the moment you looked back down at
 * terrain. That is the reported "blue screen flashing when I look at the sky".
 *
 * It also created its own `sun_disk`, `moon_disk` and 120 individual star
 * meshes, all of which duplicated what the sky system already drew.
 *
 * All of that now lives in exactly one place: `sky/AtmosphereSystem`, which
 * owns the dome, the celestial bodies, the stars and `scene.clearColor` /
 * `scene.fogColor`. This module is purely the **lighting** rig now.
 */
import {
  Color3,
  DirectionalLight,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import { SpawnPoint } from '../world/TerrainGenerator';

export interface SceneLightingHandles {
  sun: DirectionalLight;
  sky: HemisphericLight;
  spawnLight: PointLight;
  spawnMarker: Mesh;
  shadowGenerator: ShadowGenerator;
}

export function configureSceneLighting(scene: Scene, spawn: SpawnPoint): SceneLightingHandles {
  scene.ambientColor = new Color3(0.32, 0.40, 0.52);
  // Fog MODE is set here; fog COLOR and DENSITY are owned by AtmosphereSystem
  // so the horizon always matches the sky gradient exactly.
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.environmentIntensity = 0.72;

  const sky = new HemisphericLight('global_sky_light', new Vector3(0.25, 1, 0.18), scene);
  sky.intensity = 0.78;
  sky.diffuse = new Color3(0.68, 0.78, 0.92);
  sky.groundColor = new Color3(0.35, 0.30, 0.22);
  sky.specular = new Color3(0.08, 0.08, 0.08);

  const sun = new DirectionalLight('global_sun_light', new Vector3(-0.45, -0.9, -0.25), scene);
  sun.position = new Vector3(42, 78, 32);
  sun.intensity = 1.18;
  sun.diffuse = new Color3(1.0, 0.96, 0.84);
  sun.specular = new Color3(0.22, 0.20, 0.14);
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 300;

  // Real shadow map — ray-traced style soft shadows
  const shadowGenerator = new ShadowGenerator(2048, sun);
  shadowGenerator.usePoissonSampling = true;
  shadowGenerator.useCloseExponentialShadowMap = true;
  shadowGenerator.bias = 0.0005;
  shadowGenerator.normalBias = 0.02;
  shadowGenerator.setDarkness(0.38);
  shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;

  const spawnLight = new PointLight('spawn_point_light', new Vector3(spawn.x, spawn.y + 1.25, spawn.z), scene);
  spawnLight.diffuse = new Color3(0.35, 0.78, 1.0);
  spawnLight.specular = new Color3(0.4, 0.9, 1.0);
  spawnLight.intensity = 0.62;
  spawnLight.range = 18;

  const spawnMarker = createSpawnMarker(scene, spawn);

  return { sun, sky, spawnLight, spawnMarker, shadowGenerator };
}

function createSpawnMarker(scene: Scene, spawn: SpawnPoint): Mesh {
  const marker = MeshBuilder.CreateCylinder('spawn_marker_beacon', { height: 0.12, diameter: 2.2, tessellation: 48 }, scene);
  marker.position = new Vector3(spawn.x, spawn.y - 1.7, spawn.z);
  marker.isPickable = false;
  marker.checkCollisions = false;
  const material = new StandardMaterial('spawn_marker_material', scene);
  material.diffuseColor = new Color3(0.12, 0.88, 1.0);
  material.emissiveColor = new Color3(0.08, 0.55, 0.92);
  material.alpha = 0.78;
  marker.material = material;
  return marker;
}

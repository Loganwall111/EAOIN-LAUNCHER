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
  /**
   * Follows the camera and lifts nearby surfaces. Without it, standing inside
   * a forest canopy or a cave left every face at pure ambient and the world
   * read as solid black blocks.
   */
  playerLight: PointLight;
}

/**
 * ## The "everything is black underground / in the trees" fix
 *
 * The previous rig lit the world almost entirely with one strong directional
 * sun (intensity 1.18) plus a hemispheric fill. Any face the sun did not hit
 * fell back to `scene.ambientColor`, and because block materials were PBR
 * with `environmentIntensity = 0`, that ambient never actually reached them.
 * Result: readable in the open, pitch black under a canopy or below ground.
 *
 * The new balance is:
 *   - sun intensity roughly halved — it shapes the scene, it is not the only
 *     source of light,
 *   - a much stronger hemispheric fill with a warm ground bounce, so
 *     downward-facing and shadowed faces still carry colour,
 *   - a soft player-carried point light so caves and dense forest are lit
 *     locally, the way a Minecraft player's own light level behaves,
 *   - contact shading now comes from the mesher's baked AO instead of from
 *     crushing the ambient term.
 */
export function configureSceneLighting(scene: Scene, spawn: SpawnPoint): SceneLightingHandles {
  // Raised substantially: this is the floor brightness for any surface the
  // sun cannot see, and it is multiplied by each material's ambientColor.
  scene.ambientColor = new Color3(0.62, 0.66, 0.74);
  // Fog MODE is set here; fog COLOR and DENSITY are owned by AtmosphereSystem
  // so the horizon always matches the sky gradient exactly.
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.environmentIntensity = 0.72;

  const sky = new HemisphericLight('global_sky_light', new Vector3(0.25, 1, 0.18), scene);
  sky.intensity = 0.95;
  sky.diffuse = new Color3(0.74, 0.82, 0.94);
  // A warm ground bounce keeps undersides from going flat grey-black.
  sky.groundColor = new Color3(0.42, 0.38, 0.32);
  sky.specular = new Color3(0.03, 0.03, 0.03);

  const sun = new DirectionalLight('global_sun_light', new Vector3(-0.45, -0.9, -0.25), scene);
  sun.position = new Vector3(42, 78, 32);
  sun.intensity = 0.62;
  sun.diffuse = new Color3(1.0, 0.96, 0.86);
  sun.specular = new Color3(0.05, 0.05, 0.04);
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 220;

  // Real shadow map. Kept at 1024 with exponential filtering: 2048 + Poisson
  // + close-ESM was three filtering modes fighting each other and cost several
  // milliseconds per frame for shadows that were then darkened to mush.
  const shadowGenerator = new ShadowGenerator(1024, sun);
  shadowGenerator.useExponentialShadowMap = true;
  shadowGenerator.bias = 0.0012;
  shadowGenerator.normalBias = 0.03;
  // Much lighter shadows — the AO bake now carries the contact darkening.
  shadowGenerator.setDarkness(0.62);
  shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;

  const spawnLight = new PointLight('spawn_point_light', new Vector3(spawn.x, spawn.y + 1.25, spawn.z), scene);
  spawnLight.diffuse = new Color3(0.35, 0.78, 1.0);
  spawnLight.specular = new Color3(0.1, 0.2, 0.25);
  spawnLight.intensity = 0.5;
  spawnLight.range = 18;

  const playerLight = new PointLight('player_carried_light', new Vector3(spawn.x, spawn.y, spawn.z), scene);
  playerLight.diffuse = new Color3(1.0, 0.94, 0.82);
  playerLight.specular = new Color3(0.05, 0.05, 0.05);
  playerLight.intensity = 0.35;
  playerLight.range = 14;

  const spawnMarker = createSpawnMarker(scene, spawn);

  return { sun, sky, spawnLight, spawnMarker, shadowGenerator, playerLight };
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

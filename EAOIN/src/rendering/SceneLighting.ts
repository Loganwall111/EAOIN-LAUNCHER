/**
 * SceneLighting — global sun/sky/fog plus a spawn beacon so the world is never black.
 */
import {
  Color3,
  DirectionalLight,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import { SpawnPoint } from '../world/TerrainGenerator';

export interface SceneLightingHandles {
  sun: DirectionalLight;
  sky: HemisphericLight;
  spawnLight: PointLight;
  spawnMarker: Mesh;
  stars: Mesh[];
}

export function configureSceneLighting(scene: Scene, spawn: SpawnPoint): SceneLightingHandles {
  scene.ambientColor = new Color3(0.45, 0.52, 0.62);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0045;
  scene.fogColor = new Color3(0.58, 0.7, 0.92);

  // A large inverted dome gives the overworld a stable Minecraft-like sky
  // instead of a flat clear-color void while retaining the procedural horizon.
  const skyDome = MeshBuilder.CreateSphere('overworld_sky_dome', { diameter: 900, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene);
  skyDome.isPickable = false;
  const skyMaterial = new StandardMaterial('overworld_sky_material', scene);
  skyMaterial.backFaceCulling = false;
  skyMaterial.disableLighting = true;
  skyMaterial.emissiveColor = new Color3(0.25, 0.52, 0.82);
  skyMaterial.alpha = 0.48;
  skyDome.material = skyMaterial;

  const sky = new HemisphericLight('global_sky_light', new Vector3(0.2, 1, 0.15), scene);
  sky.intensity = 0.95;
  sky.diffuse = new Color3(0.72, 0.84, 1.0);
  sky.groundColor = new Color3(0.33, 0.28, 0.2);

  const sun = new DirectionalLight('global_sun_light', new Vector3(-0.45, -0.9, -0.25), scene);
  sun.position = new Vector3(36, 64, 28);
  sun.intensity = 1.35;
  sun.diffuse = new Color3(1.0, 0.94, 0.78);
  sun.specular = new Color3(0.2, 0.18, 0.12);

  const spawnLight = new PointLight('spawn_point_light', new Vector3(spawn.x, spawn.y + 1.25, spawn.z), scene);
  spawnLight.diffuse = new Color3(0.35, 0.78, 1.0);
  spawnLight.specular = new Color3(0.4, 0.9, 1.0);
  spawnLight.intensity = 0.75;
  spawnLight.range = 14;

  const spawnMarker = createSpawnMarker(scene, spawn);
  const stars = createStars(scene, spawn);
  return { sun, sky, spawnLight, spawnMarker, stars };
}

function createStars(scene: Scene, spawn: SpawnPoint): Mesh[] {
  const material = new StandardMaterial('night_star_material', scene);
  material.disableLighting = true;
  material.emissiveColor = new Color3(0.75, 0.88, 1);
  const stars: Mesh[] = [];
  for (let i = 0; i < 72; i += 1) {
    const star = MeshBuilder.CreateSphere(`night_star_${i}`, { diameter: 0.16 + (i % 3) * 0.05, segments: 4 }, scene);
    const angle = (i / 72) * Math.PI * 2;
    star.position = new Vector3(spawn.x + Math.cos(angle) * (180 + (i % 5) * 12), spawn.y + 55 + (i % 9) * 8, spawn.z + Math.sin(angle) * (180 + (i % 7) * 10));
    star.material = material;
    star.isPickable = false;
    stars.push(star);
  }
  return stars;
}

function createSpawnMarker(scene: Scene, spawn: SpawnPoint): Mesh {
  const marker = MeshBuilder.CreateCylinder(
    'spawn_marker_beacon',
    { height: 0.08, diameter: 1.4, tessellation: 48 },
    scene
  );
  marker.position = new Vector3(spawn.x, spawn.y - 1.75, spawn.z);
  marker.isPickable = false;
  marker.checkCollisions = false;

  const material = new StandardMaterial('spawn_marker_material', scene);
  material.diffuseColor = new Color3(0.1, 0.75, 1.0);
  material.emissiveColor = new Color3(0.05, 0.42, 0.8);
  material.alpha = 0.72;
  marker.material = material;

  return marker;
}

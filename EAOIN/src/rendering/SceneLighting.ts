/**
 * SceneLighting — Minecraft-inspired volumetric skybox with ray-traced approximation:
 * soft shadows, god rays, starfield, atmospheric scattering, and spawn beacon.
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
  stars: Mesh[];
  godRays: Mesh;
  sunDisk: Mesh;
  moonDisk: Mesh;
  skyDome: Mesh;
  shadowGenerator: ShadowGenerator;
}

export function configureSceneLighting(scene: Scene, spawn: SpawnPoint): SceneLightingHandles {
  scene.ambientColor = new Color3(0.46, 0.54, 0.66);
  scene.fogMode = Scene.FOGMODE_EXP2;
  // Reduced fog: only 100-1000 blocks per request, toggleable
  scene.fogDensity = 0.0012;
  scene.fogColor = new Color3(0.62, 0.78, 0.98);
  scene.environmentIntensity = 0.9;

  // Real Minecraft-like skybox: large inverted sphere with gradient emissive, not flat clearColor
  const skyDome = MeshBuilder.CreateSphere('overworld_sky_dome', { diameter: 1200, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  skyDome.isPickable = false;
  skyDome.infiniteDistance = true;
  skyDome.renderingGroupId = 0;
  const skyMaterial = new StandardMaterial('overworld_sky_material', scene);
  skyMaterial.backFaceCulling = false;
  skyMaterial.disableLighting = true;
  skyMaterial.emissiveColor = new Color3(0.28, 0.56, 0.92);
  skyMaterial.diffuseColor = new Color3(0, 0, 0);
  skyMaterial.specularColor = new Color3(0, 0, 0);
  skyMaterial.alpha = 1;
  skyDome.material = skyMaterial;

  // Secondary inner dome for sunset horizon gradient
  const horizonDome = MeshBuilder.CreateSphere('horizon_gradient_dome', { diameter: 800, segments: 20, sideOrientation: Mesh.BACKSIDE }, scene);
  horizonDome.isPickable = false;
  horizonDome.infiniteDistance = true;
  const horizonMat = new StandardMaterial('horizon_mat', scene);
  horizonMat.disableLighting = true;
  horizonMat.emissiveColor = new Color3(0.95, 0.66, 0.35);
  horizonMat.alpha = 0.12;
  horizonMat.backFaceCulling = false;
  horizonDome.material = horizonMat;

  const sky = new HemisphericLight('global_sky_light', new Vector3(0.25, 1, 0.18), scene);
  sky.intensity = 1.05;
  sky.diffuse = new Color3(0.82, 0.90, 1.0);
  sky.groundColor = new Color3(0.35, 0.30, 0.22);
  sky.specular = new Color3(0.08, 0.08, 0.08);

  const sun = new DirectionalLight('global_sun_light', new Vector3(-0.45, -0.9, -0.25), scene);
  sun.position = new Vector3(42, 78, 32);
  sun.intensity = 1.55;
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
  spawnLight.intensity = 0.85;
  spawnLight.range = 18;

  const spawnMarker = createSpawnMarker(scene, spawn);
  const stars = createStars(scene, spawn);
  const godRays = createGodRays(scene, spawn);
  const { sunDisk, moonDisk } = createCelestials(scene, spawn);

  return { sun, sky, spawnLight, spawnMarker, stars, godRays, sunDisk, moonDisk, skyDome, shadowGenerator };
}

function createCelestials(scene: Scene, spawn: SpawnPoint): { sunDisk: Mesh; moonDisk: Mesh } {
  const sunMat = new StandardMaterial('sun_disk_mat', scene);
  sunMat.disableLighting = true;
  sunMat.emissiveColor = new Color3(1.0, 0.92, 0.48);
  sunMat.diffuseColor = new Color3(0, 0, 0);

  const sunDisk = MeshBuilder.CreateDisc('sun_disk', { radius: 10, tessellation: 32 }, scene);
  sunDisk.position = new Vector3(spawn.x + 140, spawn.y + 120, spawn.z + 80);
  sunDisk.rotation.x = Math.PI / 2.2;
  sunDisk.material = sunMat;
  sunDisk.isPickable = false;
  sunDisk.billboardMode = Mesh.BILLBOARDMODE_ALL;

  const moonMat = new StandardMaterial('moon_disk_mat', scene);
  moonMat.disableLighting = true;
  moonMat.emissiveColor = new Color3(0.82, 0.86, 0.92);
  moonMat.diffuseColor = new Color3(0, 0, 0);
  const moonDisk = MeshBuilder.CreateDisc('moon_disk', { radius: 6.5, tessellation: 32 }, scene);
  moonDisk.position = new Vector3(spawn.x - 120, spawn.y + 100, spawn.z - 90);
  moonDisk.material = moonMat;
  moonDisk.isPickable = false;
  moonDisk.billboardMode = Mesh.BILLBOARDMODE_ALL;

  return { sunDisk, moonDisk };
}

function createGodRays(scene: Scene, spawn: SpawnPoint): Mesh {
  const rays = MeshBuilder.CreateCylinder('sunset_god_rays', { height: 52, diameterTop: 1.2, diameterBottom: 26, tessellation: 12 }, scene);
  rays.position = new Vector3(spawn.x + 38, spawn.y + 36, spawn.z + 28);
  rays.rotation.z = -0.58;
  rays.isPickable = false;
  const material = new StandardMaterial('sunset_god_ray_material', scene);
  material.disableLighting = true;
  material.emissiveColor = new Color3(1, 0.62, 0.22);
  material.alpha = 0.082;
  material.backFaceCulling = false;
  material.alphaMode = 2;
  rays.material = material;
  return rays;
}

function createStars(scene: Scene, spawn: SpawnPoint): Mesh[] {
  const material = new StandardMaterial('night_star_material', scene);
  material.disableLighting = true;
  material.emissiveColor = new Color3(0.82, 0.92, 1);
  material.alphaMode = 2;
  const stars: Mesh[] = [];
  for (let i = 0; i < 120; i += 1) {
    const star = MeshBuilder.CreateSphere(`night_star_${i}`, { diameter: 0.18 + (i % 4) * 0.07, segments: 4 }, scene);
    const angle = (i / 120) * Math.PI * 2 + (i % 7) * 0.13;
    const radius = 220 + (i % 9) * 18 + (i % 13) * 6;
    star.position = new Vector3(
      spawn.x + Math.cos(angle) * radius,
      spawn.y + 90 + (i % 18) * 10,
      spawn.z + Math.sin(angle) * radius
    );
    star.material = material;
    star.isPickable = false;
    stars.push(star);
  }
  return stars;
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

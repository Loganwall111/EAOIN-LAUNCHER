import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { RuntimeDimensionID } from '../dimensions/DimensionRuntime';
import { SpawnPoint, TerrainGenerator } from '../world/TerrainGenerator';
import { getWorldLayout } from '../world/WorldDistribution';

export interface WorldInteractionStats {
  doors: number;
  dimensionalDoors: number;
  rocketReady: boolean;
  moonVisits: number;
}

export class WorldInteractionRuntime {
  private readonly meshes: Mesh[] = [];
  private moonVisits = 0;
  private rocketReady = true;
  private layout: ReturnType<typeof getWorldLayout>;

  constructor(private readonly scene: Scene, private readonly terrain: TerrainGenerator, spawn: SpawnPoint, seed: string) {
    this.layout = getWorldLayout(seed, spawn);
    this.createDoorsAndRocket(spawn);
  }

  tryUseDoor(position: Vector3, cycleDimension: () => RuntimeDimensionID): string {
    const nearest = this.nearestTagged(position, 'door', 4.5);
    if (!nearest) return 'No door in reach (doors spread 45-70 blocks away — check compass)';
    if (nearest.metadata?.doorType === 'dimensional') {
      const dimension = cycleDimension();
      return `Dimensional door opened into ${dimension} [${Math.round(nearest.position.x)},${Math.round(nearest.position.z)}]`;
    }
    return 'Wooden door opened — settlement route marked';
  }

  tryLaunchRocket(position: Vector3, cycleToMoon: () => void): string {
    const rocket = this.nearestTagged(position, 'rocket', 8);
    if (!rocket) return 'No rocket in reach — launchpad is 100+ blocks away in a clearing';
    if (!this.rocketReady) return 'Rocket is refueling';
    this.rocketReady = false;
    this.moonVisits += 1;
    cycleToMoon();
    window.setTimeout(() => {
      this.rocketReady = true;
    }, 5500);
    return 'Rocket launched — moon runtime active';
  }

  update(deltaSeconds: number): void {
    for (const mesh of this.meshes) {
      if (mesh.metadata?.runtimeType === 'rocket') mesh.rotation.y += deltaSeconds * 0.25;
      if (mesh.metadata?.doorType === 'dimensional') mesh.rotation.y += deltaSeconds * 0.35;
    }
  }

  getStats(): WorldInteractionStats {
    return {
      doors: this.meshes.filter((mesh) => mesh.metadata?.runtimeType === 'door').length,
      dimensionalDoors: this.meshes.filter((mesh) => mesh.metadata?.doorType === 'dimensional').length,
      rocketReady: this.rocketReady,
      moonVisits: this.moonVisits,
    };
  }

  dispose(): void {
    for (const mesh of this.meshes) mesh.dispose(false, true);
  }

  private createDoorsAndRocket(_spawn: SpawnPoint): void {
    const wood = this.material('runtime_door_wood', new Color3(0.5, 0.28, 0.12), new Color3(0.02, 0.01, 0));
    const dimensional = this.material('runtime_dimensional_door', new Color3(0.34, 0.12, 0.7), new Color3(0.18, 0.04, 0.45));
    const rocketMat = this.material('runtime_rocket', new Color3(0.8, 0.82, 0.86), new Color3(0.05, 0.08, 0.12));
    const red = this.material('runtime_rocket_red', new Color3(0.8, 0.08, 0.05), new Color3(0.2, 0.01, 0.01));

    // Use distributed layout
    const wd = this.layout.woodenDoor;
    const dd = this.layout.dimensionalDoor;
    const rk = this.layout.rocket;

    const normalDoorPos = new Vector3(wd.x, this.terrain.getHeightAt(Math.floor(wd.x), Math.floor(wd.z)) + 2.1, wd.z);
    const normalDoor = MeshBuilder.CreateBox('runtime_overworld_door', { width: 0.9, height: 2.2, depth: 0.18 }, this.scene);
    normalDoor.position = normalDoorPos;
    normalDoor.material = wood;
    normalDoor.metadata = { runtimeType: 'door', doorType: 'wooden' };
    this.meshes.push(normalDoor);

    const dimDoorPos = new Vector3(dd.x, this.terrain.getHeightAt(Math.floor(dd.x), Math.floor(dd.z)) + 2.35, dd.z);
    const dimDoor = MeshBuilder.CreateBox('runtime_dimensional_door', { width: 1.05, height: 2.55, depth: 0.2 }, this.scene);
    dimDoor.position = dimDoorPos;
    dimDoor.material = dimensional;
    dimDoor.metadata = { runtimeType: 'door', doorType: 'dimensional' };
    this.meshes.push(dimDoor);

    const rocketBase = new Vector3(rk.x, this.terrain.getHeightAt(Math.floor(rk.x), Math.floor(rk.z)) + 1, rk.z);
    const rocket = MeshBuilder.CreateCylinder('runtime_moon_rocket', { height: 4.6, diameterTop: 0.32, diameterBottom: 1.05, tessellation: 18 }, this.scene);
    rocket.position = rocketBase.add(new Vector3(0, 2.35, 0));
    rocket.material = rocketMat;
    rocket.metadata = { runtimeType: 'rocket' };
    this.meshes.push(rocket);

    // Launchpad ring indicator
    const padMat = this.material('rocket_pad', new Color3(0.3, 0.3, 0.32), new Color3(0.02, 0.04, 0.08));
    const pad = MeshBuilder.CreateTorus('rocket_launch_pad', { diameter: 6.5, thickness: 0.35, tessellation: 32 }, this.scene);
    pad.position = rocketBase.add(new Vector3(0, 0.12, 0));
    pad.material = padMat;
    pad.isPickable = false;
    this.meshes.push(pad);

    for (const x of [-0.52, 0.52]) {
      const fin = MeshBuilder.CreateBox('runtime_rocket_fin', { width: 0.26, height: 1.0, depth: 0.46 }, this.scene);
      fin.position = rocketBase.add(new Vector3(x, 0.65, 0));
      fin.material = red;
      fin.metadata = { runtimeType: 'rocket' };
      this.meshes.push(fin);
    }

    // Tower lights around launchpad — atmospheric
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      const lightPost = MeshBuilder.CreateCylinder(`launch_tower_light_${i}`, { height: 3.2, diameter: 0.15, tessellation: 8 }, this.scene);
      lightPost.position = rocketBase.add(new Vector3(Math.cos(ang) * 4.2, 1.6, Math.sin(ang) * 4.2));
      const lm = this.material(`launch_light_mat_${i}`, new Color3(1, 0.9, 0.4), new Color3(1, 0.8, 0.2));
      lm.emissiveColor = new Color3(1, 0.85, 0.2);
      lightPost.material = lm;
      lightPost.isPickable = false;
      this.meshes.push(lightPost);
    }
  }

  private nearestTagged(position: Vector3, runtimeType: string, radius: number): Mesh | null {
    let nearest: Mesh | null = null;
    let nearestDistance = radius;
    for (const mesh of this.meshes) {
      if (mesh.metadata?.runtimeType !== runtimeType) continue;
      const distance = Vector3.Distance(position, mesh.position);
      if (distance < nearestDistance) {
        nearest = mesh;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private material(name: string, diffuse: Color3, emissive: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = diffuse;
    material.emissiveColor = emissive;
    material.specularColor = new Color3(0.08, 0.08, 0.08);
    return material;
  }
}

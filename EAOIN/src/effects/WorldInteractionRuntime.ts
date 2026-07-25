import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { RuntimeDimensionID } from '../dimensions/DimensionRuntime';
import { SpawnPoint, TerrainGenerator } from '../world/TerrainGenerator';

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

  constructor(private readonly scene: Scene, private readonly terrain: TerrainGenerator, spawn: SpawnPoint) {
    this.createDoorsAndRocket(spawn);
  }

  tryUseDoor(position: Vector3, cycleDimension: () => RuntimeDimensionID): string {
    const nearest = this.nearestTagged(position, 'door', 4.2);
    if (!nearest) return 'No door in reach';
    if (nearest.metadata?.doorType === 'dimensional') {
      const dimension = cycleDimension();
      return `Dimensional door opened into ${dimension}`;
    }
    return 'Wooden door opened — settlement route marked';
  }

  tryLaunchRocket(position: Vector3, cycleToMoon: () => void): string {
    const rocket = this.nearestTagged(position, 'rocket', 7.5);
    if (!rocket) return 'No rocket in reach';
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

  private createDoorsAndRocket(spawn: SpawnPoint): void {
    const wood = this.material('runtime_door_wood', new Color3(0.5, 0.28, 0.12), new Color3(0.02, 0.01, 0));
    const dimensional = this.material('runtime_dimensional_door', new Color3(0.34, 0.12, 0.7), new Color3(0.18, 0.04, 0.45));
    const rocketMat = this.material('runtime_rocket', new Color3(0.8, 0.82, 0.86), new Color3(0.05, 0.08, 0.12));
    const red = this.material('runtime_rocket_red', new Color3(0.8, 0.08, 0.05), new Color3(0.2, 0.01, 0.01));

    const normalDoor = MeshBuilder.CreateBox('runtime_overworld_door', { width: 0.9, height: 2.2, depth: 0.18 }, this.scene);
    normalDoor.position = new Vector3(spawn.x - 5.5, this.terrain.getHeightAt(Math.floor(spawn.x - 5.5), Math.floor(spawn.z + 4)) + 2.1, spawn.z + 4);
    normalDoor.material = wood;
    normalDoor.metadata = { runtimeType: 'door', doorType: 'wooden' };
    this.meshes.push(normalDoor);

    const dimDoor = MeshBuilder.CreateBox('runtime_dimensional_door', { width: 1.05, height: 2.55, depth: 0.2 }, this.scene);
    dimDoor.position = new Vector3(spawn.x - 7.5, this.terrain.getHeightAt(Math.floor(spawn.x - 7.5), Math.floor(spawn.z - 5)) + 2.35, spawn.z - 5);
    dimDoor.material = dimensional;
    dimDoor.metadata = { runtimeType: 'door', doorType: 'dimensional' };
    this.meshes.push(dimDoor);

    const rocketBase = new Vector3(spawn.x + 12, this.terrain.getHeightAt(Math.floor(spawn.x + 12), Math.floor(spawn.z - 8)) + 1, spawn.z - 8);
    const rocket = MeshBuilder.CreateCylinder('runtime_moon_rocket', { height: 4.2, diameterTop: 0.32, diameterBottom: 0.95, tessellation: 18 }, this.scene);
    rocket.position = rocketBase.add(new Vector3(0, 2.1, 0));
    rocket.material = rocketMat;
    rocket.metadata = { runtimeType: 'rocket' };
    this.meshes.push(rocket);

    for (const x of [-0.42, 0.42]) {
      const fin = MeshBuilder.CreateBox('runtime_rocket_fin', { width: 0.22, height: 0.9, depth: 0.42 }, this.scene);
      fin.position = rocketBase.add(new Vector3(x, 0.55, 0));
      fin.material = red;
      fin.metadata = { runtimeType: 'rocket' };
      this.meshes.push(fin);
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

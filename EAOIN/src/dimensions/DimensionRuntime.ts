/** Runtime dimension controller: visible portals + scene rule changes. */
import { Color3, Color4, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { SpawnPoint } from '../world/TerrainGenerator';

export type RuntimeDimensionID = 'overworld' | 'crystal_realm' | 'abyss' | 'moon';

export interface RuntimeDimensionDefinition {
  id: RuntimeDimensionID;
  name: string;
  sky: Color4;
  fog: Color3;
  gravity: Vector3;
  tint: Color3;
  message: string;
}

export interface RuntimeDimensionState {
  id: RuntimeDimensionID;
  name: string;
  portalUses: number;
}

const DIMENSIONS: RuntimeDimensionDefinition[] = [
  {
    id: 'overworld',
    name: 'Overworld',
    sky: new Color4(0.58, 0.72, 0.95, 1),
    fog: new Color3(0.58, 0.7, 0.92),
    gravity: new Vector3(0, -0.34, 0),
    tint: new Color3(0.2, 0.8, 1),
    message: 'Returned to the Overworld ruleset',
  },
  {
    id: 'crystal_realm',
    name: 'Crystal Realm',
    sky: new Color4(0.33, 0.16, 0.58, 1),
    fog: new Color3(0.45, 0.28, 0.72),
    gravity: new Vector3(0, -0.22, 0),
    tint: new Color3(0.8, 0.35, 1),
    message: 'Crystal Realm active: lower gravity and violet fog',
  },
  {
    id: 'abyss',
    name: 'Abyss',
    sky: new Color4(0.025, 0.018, 0.05, 1),
    fog: new Color3(0.04, 0.03, 0.08),
    gravity: new Vector3(0, -0.42, 0),
    tint: new Color3(0.95, 0.18, 0.32),
    message: 'Abyss active: heavy gravity and dark fog',
  },
  {
    id: 'moon',
    name: 'Moon',
    sky: new Color4(0.005, 0.008, 0.018, 1),
    fog: new Color3(0.1, 0.12, 0.18),
    gravity: new Vector3(0, -0.08, 0),
    tint: new Color3(0.72, 0.8, 1.0),
    message: 'Moon runtime active: low gravity and cold blue horizon',
  },
];

export class DimensionRuntime {
  private index = 0;
  private portalUses = 0;
  private readonly portalMeshes: Mesh[] = [];
  private readonly overlayMeshes: Array<{ dimension: RuntimeDimensionID; mesh: Mesh }> = [];
  private readonly transitionMeshes: Array<{ mesh: Mesh; ttl: number }> = [];

  constructor(private readonly scene: Scene, spawn: SpawnPoint) {
    this.createPortalMonument(spawn);
    this.createDimensionOverlays(spawn);
    this.applyCurrent();
  }

  cycle(): RuntimeDimensionDefinition {
    this.index = (this.index + 1) % DIMENSIONS.length;
    this.portalUses += 1;
    return this.applyCurrent();
  }

  setDimension(id: RuntimeDimensionID): RuntimeDimensionDefinition {
    const index = DIMENSIONS.findIndex((dimension) => dimension.id === id);
    if (index >= 0) this.index = index;
    this.portalUses += 1;
    return this.applyCurrent();
  }

  applyCurrent(): RuntimeDimensionDefinition {
    const dimension = DIMENSIONS[this.index];
    this.scene.clearColor = dimension.sky;
    this.scene.fogColor = dimension.fog;
    this.scene.gravity = dimension.gravity;

    for (const mesh of this.portalMeshes) {
      const material = mesh.material as StandardMaterial | null;
      if (material) {
        material.diffuseColor = dimension.tint;
        material.emissiveColor = dimension.tint.scale(0.55);
      }
    }

    for (const overlay of this.overlayMeshes) {
      overlay.mesh.isVisible = overlay.dimension === dimension.id;
    }

    return dimension;
  }

  triggerTransitionEffect(position: Vector3, usedPlacedCore: boolean): void {
    const dimension = DIMENSIONS[this.index];
    const material = new StandardMaterial(`dimension_transition_${performance.now()}`, this.scene);
    material.diffuseColor = dimension.tint;
    material.emissiveColor = dimension.tint.scale(0.8);
    material.alpha = usedPlacedCore ? 0.95 : 0.65;

    const ring = MeshBuilder.CreateTorus('dimension_transition_ring', { diameter: usedPlacedCore ? 3.1 : 2.25, thickness: 0.08, tessellation: 40 }, this.scene);
    ring.position = position.add(new Vector3(0, -0.7, 0));
    ring.rotation.x = Math.PI / 2;
    ring.material = material;
    ring.isPickable = false;
    this.transitionMeshes.push({ mesh: ring, ttl: 1.4 });
  }

  update(deltaSeconds: number): void {
    for (const mesh of this.portalMeshes) {
      mesh.rotation.y += deltaSeconds * 0.65;
    }
    for (const entry of Array.from(this.transitionMeshes)) {
      entry.ttl -= deltaSeconds;
      entry.mesh.rotation.z += deltaSeconds * 2.4;
      entry.mesh.scaling.addInPlace(new Vector3(deltaSeconds * 1.4, deltaSeconds * 1.4, deltaSeconds * 1.4));
      if (entry.ttl <= 0) {
        entry.mesh.dispose(false, true);
        this.transitionMeshes.splice(this.transitionMeshes.indexOf(entry), 1);
      }
    }
  }

  getState(): RuntimeDimensionState {
    const dimension = DIMENSIONS[this.index];
    return {
      id: dimension.id,
      name: dimension.name,
      portalUses: this.portalUses,
    };
  }

  dispose(): void {
    for (const mesh of this.portalMeshes) mesh.dispose();
    for (const overlay of this.overlayMeshes) overlay.mesh.dispose();
    for (const entry of this.transitionMeshes) entry.mesh.dispose(false, true);
    this.portalMeshes.length = 0;
    this.overlayMeshes.length = 0;
    this.transitionMeshes.length = 0;
  }

  private createDimensionOverlays(spawn: SpawnPoint): void {
    const crystalMaterial = new StandardMaterial('crystal_realm_overlay_material', this.scene);
    crystalMaterial.diffuseColor = new Color3(0.65, 0.25, 1);
    crystalMaterial.emissiveColor = new Color3(0.3, 0.08, 0.55);
    crystalMaterial.alpha = 0.78;

    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const spike = MeshBuilder.CreateCylinder(`crystal_realm_spike_${i}`, { height: 1.6 + (i % 3) * 0.45, diameterTop: 0.08, diameterBottom: 0.45, tessellation: 5 }, this.scene);
      spike.position = new Vector3(spawn.x + Math.cos(angle) * 7.5, spawn.y - 1.0, spawn.z + Math.sin(angle) * 7.5);
      spike.rotation.z = Math.sin(angle) * 0.25;
      spike.material = crystalMaterial;
      spike.isPickable = false;
      this.overlayMeshes.push({ dimension: 'crystal_realm', mesh: spike });
    }

    const abyssMaterial = new StandardMaterial('abyss_overlay_material', this.scene);
    abyssMaterial.diffuseColor = new Color3(0.09, 0.03, 0.08);
    abyssMaterial.emissiveColor = new Color3(0.45, 0.02, 0.08);

    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2 + 0.35;
      const obelisk = MeshBuilder.CreateBox(`abyss_obelisk_${i}`, { width: 0.7, height: 3 + i * 0.25, depth: 0.7 }, this.scene);
      obelisk.position = new Vector3(spawn.x + Math.cos(angle) * 9, spawn.y + 0.1, spawn.z + Math.sin(angle) * 9);
      obelisk.rotation.y = angle;
      obelisk.material = abyssMaterial;
      obelisk.isPickable = false;
      this.overlayMeshes.push({ dimension: 'abyss', mesh: obelisk });
    }

    const moonMaterial = new StandardMaterial('moon_overlay_material', this.scene);
    moonMaterial.diffuseColor = new Color3(0.55, 0.62, 0.72);
    moonMaterial.emissiveColor = new Color3(0.03, 0.05, 0.09);
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * Math.PI * 2;
      const crater = MeshBuilder.CreateTorus(`moon_crater_${i}`, { diameter: 1.4 + (i % 3) * 0.5, thickness: 0.06, tessellation: 20 }, this.scene);
      crater.position = new Vector3(spawn.x + Math.cos(angle) * 11, spawn.y - 1.65, spawn.z + Math.sin(angle) * 11);
      crater.rotation.x = Math.PI / 2;
      crater.material = moonMaterial;
      crater.isPickable = false;
      this.overlayMeshes.push({ dimension: 'moon', mesh: crater });
    }
  }

  private createPortalMonument(spawn: SpawnPoint): void {
    const material = new StandardMaterial('runtime_dimension_portal_material', this.scene);
    material.diffuseColor = DIMENSIONS[0].tint;
    material.emissiveColor = DIMENSIONS[0].tint.scale(0.55);
    material.alpha = 0.82;

    const base = MeshBuilder.CreateTorus('dimension_portal_ring', { diameter: 2.35, thickness: 0.13, tessellation: 36 }, this.scene);
    base.position = new Vector3(spawn.x + 4.5, spawn.y - 1.0, spawn.z - 4.5);
    base.rotation.x = Math.PI / 2;
    base.material = material;
    base.isPickable = false;

    const core = MeshBuilder.CreateCylinder('dimension_portal_core', { height: 0.08, diameter: 1.45, tessellation: 36 }, this.scene);
    core.position = base.position.clone();
    core.material = material;
    core.isPickable = false;

    this.portalMeshes.push(base, core);
  }
}

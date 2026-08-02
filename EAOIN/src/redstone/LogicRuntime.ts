/** Visible redstone-style signal runtime for playable logic testing. */
import { Color3, Mesh, MeshBuilder, PointLight, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { SpawnPoint, TerrainGenerator } from '../world/TerrainGenerator';

export interface LogicRuntimeStats {
  active: boolean;
  toggles: number;
  blocks: number;
  placedWires: number;
  placedLamps: number;
  poweredLamps: number;
}

export class LogicRuntime {
  private active = false;
  private toggles = 0;
  private readonly meshes: Mesh[] = [];
  private readonly lamps: Mesh[] = [];
  private readonly poweredMarkers = new Map<string, Mesh>();
  private readonly light: PointLight;
  private readonly activeMaterial: StandardMaterial;
  private readonly inactiveMaterial: StandardMaterial;
  private readonly poweredMarkerMaterial: StandardMaterial;
  private placedWires = 0;
  private placedLamps = 0;
  private poweredLamps = 0;

  constructor(private readonly scene: Scene, private readonly terrain: TerrainGenerator, spawn: SpawnPoint) {
    this.activeMaterial = this.createMaterial('logic_active', new Color3(1, 0.08, 0.04), new Color3(0.9, 0.04, 0.02));
    this.inactiveMaterial = this.createMaterial('logic_inactive', new Color3(0.22, 0.02, 0.02), new Color3(0.02, 0, 0));
    this.poweredMarkerMaterial = this.createMaterial('logic_marker_powered', new Color3(1, 0.45, 0.15), new Color3(1, 0.18, 0.05));
    this.light = new PointLight('logic_runtime_signal_light', new Vector3(spawn.x + 9, spawn.y + 2, spawn.z + 2), scene);
    this.light.diffuse = new Color3(1, 0.12, 0.05);
    this.light.range = 14;
    this.light.intensity = 0;
    this.createSignalRig(spawn);
    this.applyState();
  }

  toggle(): LogicRuntimeStats {
    this.active = !this.active;
    this.toggles += 1;
    this.applyState();
    return this.getStats();
  }

  /**
   * Interact with a redstone component placed in the world (lever/button).
   * Toggling a lever flips the global redstone power line, which powers any
   * redstone lamps connected by wire (block 13) within the scan radius.
   * Returns a human-readable message.
   */
  interactComponent(worldX: number, worldY: number, worldZ: number): string | null {
    const block = this.terrain.getBlockAt(worldX, worldY, worldZ);
    if (block === 150) {
      // Lever — toggles the signal.
      this.toggle();
      return this.active
        ? 'Lever pulled — redstone powered'
        : 'Lever released — redstone off';
    }
    if (block === 151) {
      // Button — a momentary pulse (~1.2s).
      const was = this.active;
      this.active = true;
      this.toggles += 1;
      this.applyState();
      window.setTimeout(() => {
        if (!was) { this.active = false; this.applyState(); }
      }, 1200);
      return 'Button pressed — redstone pulsed';
    }
    if (block === 306) {
      // Redstone torch — a constant power source; clicking toggles it.
      this.toggle();
      return this.active
        ? 'Redstone torch lit — circuit powered'
        : 'Redstone torch extinguished — circuit off';
    }
    return null;
  }

  /** Manually set the global signal state (used by the L key toggle). */
  setActive(active: boolean): void {
    if (this.active !== active) {
      this.active = active;
      this.toggles += 1;
      this.applyState();
    }
  }

  update(deltaSeconds: number): void {
    const pulse = this.active ? 0.75 + Math.sin(performance.now() * 0.006) * 0.25 : 0;
    this.light.intensity = pulse;
    for (const lamp of this.lamps) {
      lamp.rotation.y += deltaSeconds * (this.active ? 1.8 : 0.25);
    }
    for (const marker of this.poweredMarkers.values()) {
      marker.rotation.y += deltaSeconds * 2.6;
      marker.scaling.setAll(0.92 + Math.sin(performance.now() * 0.008) * 0.08);
    }
  }

  scanPlacedNetwork(center: Vector3, radius = 18): LogicRuntimeStats {
    let wires = 0;
    const lampPositions: Vector3[] = [];
    const minX = Math.floor(center.x - radius);
    const maxX = Math.floor(center.x + radius);
    const minZ = Math.floor(center.z - radius);
    const maxZ = Math.floor(center.z + radius);

    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        const top = Math.min(80, this.terrain.getHeightAt(x, z) + 8);
        for (let y = Math.max(0, top - 16); y <= top; y += 1) {
          const block = this.terrain.getBlockAt(x, y, z);
          if (block === 13) wires += 1;
          if (block === 14) lampPositions.push(new Vector3(x + 0.5, y + 1.25, z + 0.5));
        }
      }
    }

    this.placedWires = wires;
    this.placedLamps = lampPositions.length;
    this.poweredLamps = this.active && wires > 0 ? lampPositions.length : 0;
    this.syncPoweredMarkers(lampPositions);
    return this.getStats();
  }

  getStats(): LogicRuntimeStats {
    return {
      active: this.active,
      toggles: this.toggles,
      blocks: this.meshes.length + this.placedWires + this.placedLamps,
      placedWires: this.placedWires,
      placedLamps: this.placedLamps,
      poweredLamps: this.poweredLamps,
    };
  }

  dispose(): void {
    for (const mesh of this.meshes) mesh.dispose();
    for (const marker of this.poweredMarkers.values()) marker.dispose();
    this.poweredMarkers.clear();
    this.light.dispose();
    this.activeMaterial.dispose();
    this.inactiveMaterial.dispose();
    this.poweredMarkerMaterial.dispose();
  }

  private syncPoweredMarkers(lampPositions: Vector3[]): void {
    const wanted = new Set<string>();
    if (this.active && this.placedWires > 0) {
      for (const position of lampPositions) {
        const key = `${Math.floor(position.x)}:${Math.floor(position.y)}:${Math.floor(position.z)}`;
        wanted.add(key);
        if (!this.poweredMarkers.has(key)) {
          const marker = MeshBuilder.CreateTorus(`powered_signal_lamp_marker_${key}`, { diameter: 0.78, thickness: 0.055, tessellation: 24 }, this.scene);
          marker.position = position;
          marker.material = this.poweredMarkerMaterial;
          marker.isPickable = false;
          this.poweredMarkers.set(key, marker);
        }
      }
    }

    for (const [key, marker] of Array.from(this.poweredMarkers.entries())) {
      if (!wanted.has(key)) {
        marker.dispose();
        this.poweredMarkers.delete(key);
      }
    }
  }

  private createSignalRig(spawn: SpawnPoint): void {
    const baseX = Math.floor(spawn.x + 9);
    const baseZ = Math.floor(spawn.z + 2);
    const groundY = this.terrain.getSurfaceHeight(baseX, baseZ) + 1;

    for (let i = 0; i < 5; i += 1) {
      const node = MeshBuilder.CreateBox(`logic_signal_wire_${i}`, { width: 0.8, height: 0.12, depth: 0.8 }, this.scene);
      node.position = new Vector3(baseX + i * 1.1, groundY + 0.06, baseZ);
      node.material = this.inactiveMaterial;
      node.isPickable = false;
      this.meshes.push(node);
    }

    const pylon = MeshBuilder.CreateCylinder('logic_signal_pylon', { height: 2.2, diameter: 0.45, tessellation: 12 }, this.scene);
    pylon.position = new Vector3(baseX + 5.8, groundY + 1.1, baseZ);
    pylon.material = this.inactiveMaterial;
    pylon.isPickable = false;
    this.meshes.push(pylon);

    for (let i = 0; i < 3; i += 1) {
      const lamp = MeshBuilder.CreateSphere(`logic_lamp_${i}`, { diameter: 0.52, segments: 12 }, this.scene);
      lamp.position = new Vector3(baseX + 5.8, groundY + 2.5 + i * 0.65, baseZ);
      lamp.material = this.inactiveMaterial;
      lamp.isPickable = false;
      this.meshes.push(lamp);
      this.lamps.push(lamp);
    }
  }

  private applyState(): void {
    const material = this.active ? this.activeMaterial : this.inactiveMaterial;
    for (const mesh of this.meshes) mesh.material = material;
  }

  private createMaterial(name: string, diffuse: Color3, emissive: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = diffuse;
    material.emissiveColor = emissive;
    material.specularColor = new Color3(0.08, 0.02, 0.02);
    return material;
  }
}

/** Runtime settlement placeholders: huts, villagers, discovery, and simple village life. */
import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { TerrainGenerator } from '../world/TerrainGenerator';

export interface SettlementStats {
  name: string;
  discovered: boolean;
  villagers: number;
  huts: number;
  distance: number;
  prosperity: number;
  woodStockpile: number;
  stoneStockpile: number;
  activeTask: string;
  jobProgress: number;
  tradesCompleted: number;
}

interface VillagerRuntime {
  root: TransformNode;
  target: Vector3;
  nextDecisionAt: number;
  seed: number;
}

export class SettlementRuntime {
  private readonly name: string;
  private readonly center: Vector3;
  private readonly meshes: Mesh[] = [];
  private readonly villagers: VillagerRuntime[] = [];
  private discovered = false;
  private discoveryMessage: string | null = null;
  private prosperity = 1;
  private woodStockpile = 0;
  private stoneStockpile = 0;
  private activeTask = 'Awaiting supplies';
  private jobProgress = 0;
  private tradesCompleted = 0;

  constructor(private readonly scene: Scene, private readonly terrain: TerrainGenerator, seed: string) {
    this.name = this.pickName(seed);
    this.center = this.pickCenter(seed);
    this.createSettlement();
  }

  update(playerPosition: Vector3, deltaSeconds: number): void {
    const distance = Vector3.Distance(playerPosition, this.center);
    if (!this.discovered && distance < 34) {
      this.discovered = true;
      this.discoveryMessage = `Discovered settlement: ${this.name}`;
    }

    this.updateEconomy(deltaSeconds);
    const now = performance.now();
    for (const villager of this.villagers) this.updateVillager(villager, now, deltaSeconds);
  }

  consumeDiscoveryMessage(): string | null {
    const message = this.discoveryMessage;
    this.discoveryMessage = null;
    return message;
  }

  deliverSupplies(kind: 'wood' | 'stone' | 'crate', amount: number): string {
    if (!this.discovered) return 'Find the settlement before delivering supplies';
    if (amount <= 0) return 'No supplies delivered';

    if (kind === 'wood') this.woodStockpile += amount;
    if (kind === 'stone') this.stoneStockpile += amount;
    if (kind === 'crate') {
      this.woodStockpile += amount * 2;
      this.stoneStockpile += amount;
    }

    this.prosperity = Math.min(10, this.prosperity + amount * (kind === 'crate' ? 0.6 : 0.25));
    this.activeTask = this.prosperity >= 5 ? 'Expanding village paths' : 'Building supply cache';
    return `${this.name} received ${amount} ${kind} supply${amount === 1 ? '' : 'ies'}`;
  }

  completeTrade(): string {
    if (!this.discovered) return 'Find the settlement before trading';
    this.tradesCompleted += 1;
    this.prosperity = Math.min(10, this.prosperity + 0.18);
    this.activeTask = this.tradesCompleted >= 3 ? 'Trading post operating' : this.activeTask;
    return `${this.name} trade completed (${this.tradesCompleted})`;
  }

  getStats(playerPosition?: Vector3): SettlementStats {
    return {
      name: this.name,
      discovered: this.discovered,
      villagers: this.villagers.length,
      huts: Math.floor(this.meshes.length / 3),
      distance: playerPosition ? Math.round(Vector3.Distance(playerPosition, this.center)) : 0,
      prosperity: Number(this.prosperity.toFixed(1)),
      woodStockpile: this.woodStockpile,
      stoneStockpile: this.stoneStockpile,
      activeTask: this.activeTask,
      jobProgress: Math.round(this.jobProgress),
      tradesCompleted: this.tradesCompleted,
    };
  }

  private updateEconomy(deltaSeconds: number): void {
    if (!this.discovered || (this.woodStockpile <= 0 && this.stoneStockpile <= 0)) return;

    this.jobProgress += deltaSeconds * (6 + this.prosperity);
    if (this.jobProgress >= 100) {
      this.jobProgress = 0;
      if (this.woodStockpile > 0) this.woodStockpile -= 1;
      if (this.stoneStockpile > 0) this.stoneStockpile -= 1;
      this.prosperity = Math.min(10, this.prosperity + 0.35);
      this.activeTask = this.prosperity >= 7 ? 'Training builders' : this.prosperity >= 4 ? 'Expanding village paths' : 'Building supply cache';
    }
  }

  dispose(): void {
    for (const mesh of this.meshes) mesh.dispose();
    for (const villager of this.villagers) villager.root.dispose(false, true);
  }

  private createSettlement(): void {
    const hutMaterial = this.material('settlement_hut_wood', new Color3(0.46, 0.26, 0.12));
    const roofMaterial = this.material('settlement_roof', new Color3(0.22, 0.18, 0.16));
    const villagerMaterial = this.material('settlement_villager', new Color3(0.2, 0.56, 0.86));

    const hutOffsets = [
      new Vector3(-4, 0, -3),
      new Vector3(5, 0, -2),
      new Vector3(0, 0, 5),
    ];

    for (const [index, offset] of hutOffsets.entries()) {
      const position = this.groundPosition(this.center.x + offset.x, this.center.z + offset.z);
      const hut = MeshBuilder.CreateBox(`settlement_hut_${index}`, { width: 3.2, height: 2.1, depth: 3.2 }, this.scene);
      hut.position = position.add(new Vector3(0, 1.05, 0));
      hut.material = hutMaterial;
      hut.checkCollisions = true;
      this.meshes.push(hut);

      const roof = MeshBuilder.CreateCylinder(`settlement_roof_${index}`, { height: 0.9, diameter: 4.2, tessellation: 4 }, this.scene);
      roof.position = position.add(new Vector3(0, 2.55, 0));
      roof.rotation.y = Math.PI / 4;
      roof.material = roofMaterial;
      roof.checkCollisions = true;
      this.meshes.push(roof);
    }

    for (let i = 0; i < 4; i += 1) {
      const root = new TransformNode(`settlement_villager_${i}`, this.scene);
      root.position = this.groundPosition(this.center.x + i - 1.5, this.center.z + 1 + (i % 2));
      const body = MeshBuilder.CreateBox(`settlement_villager_body_${i}`, { width: 0.55, height: 1.25, depth: 0.45 }, this.scene);
      body.parent = root;
      body.position.y = 0.65;
      body.material = villagerMaterial;
      body.isPickable = false;
      const head = MeshBuilder.CreateBox(`settlement_villager_head_${i}`, { width: 0.42, height: 0.42, depth: 0.42 }, this.scene);
      head.parent = root;
      head.position.y = 1.5;
      head.material = this.material('settlement_villager_head', new Color3(0.82, 0.62, 0.42));
      head.isPickable = false;
      this.villagers.push({ root, target: root.position.clone(), nextDecisionAt: 0, seed: i * 9973 + 11 });
    }
  }

  private updateVillager(villager: VillagerRuntime, now: number, deltaSeconds: number): void {
    if (now >= villager.nextDecisionAt || Vector3.Distance(villager.root.position, villager.target) < 0.35) {
      villager.seed = (Math.imul(1664525, villager.seed) + 1013904223) >>> 0;
      const angle = (villager.seed / 0xffffffff) * Math.PI * 2;
      villager.seed = (Math.imul(1664525, villager.seed) + 1013904223) >>> 0;
      const distance = 2 + (villager.seed / 0xffffffff) * 5;
      villager.target = this.groundPosition(this.center.x + Math.cos(angle) * distance, this.center.z + Math.sin(angle) * distance);
      villager.nextDecisionAt = now + 2500 + (villager.seed % 3500);
    }

    const toTarget = villager.target.subtract(villager.root.position);
    const horizontal = new Vector3(toTarget.x, 0, toTarget.z);
    if (horizontal.length() > 0.01) {
      const direction = horizontal.normalize();
      villager.root.position = this.groundPosition(
        villager.root.position.x + direction.x * deltaSeconds * 0.9,
        villager.root.position.z + direction.z * deltaSeconds * 0.9
      );
      villager.root.rotation.y = Math.atan2(direction.x, direction.z);
    }
  }

  private groundPosition(worldX: number, worldZ: number): Vector3 {
    const y = this.terrain.getHeightAt(Math.floor(worldX), Math.floor(worldZ)) + 1;
    return new Vector3(worldX, y, worldZ);
  }

  private pickCenter(seed: string): Vector3 {
    const hash = this.hash(seed);
    const signX = hash % 2 === 0 ? 1 : -1;
    const signZ = hash % 3 === 0 ? 1 : -1;
    return new Vector3(signX * 42, 0, signZ * 36);
  }

  private pickName(seed: string): string {
    const names = ['Dawnfield', 'Stonebrook', 'Pinewatch', 'Sunmere', 'Northveil'];
    return names[this.hash(seed) % names.length];
  }

  private hash(value: string): number {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  private material(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = color;
    material.specularColor = new Color3(0.05, 0.05, 0.05);
    return material;
  }
}

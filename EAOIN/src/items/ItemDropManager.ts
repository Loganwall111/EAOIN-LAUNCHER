/** Runtime collectible item drops for mined blocks and creature loot. */
import { Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { BlockID, getBlock } from '@shared/blocks/BlockRegistry';
import { BlockMaterialMap } from '../rendering/BlockMaterials';

export interface CollectedDrop {
  blockId: BlockID;
  amount: number;
}

interface ItemDrop {
  id: number;
  blockId: BlockID;
  amount: number;
  mesh: Mesh;
  bornAt: number;
}

export class ItemDropManager {
  private drops = new Map<number, ItemDrop>();
  private nextId = 1;

  constructor(private readonly scene: Scene, private readonly materials: BlockMaterialMap) {}

  spawnDrop(blockId: BlockID, position: Vector3, amount = 1): void {
    if (blockId === 0 || amount <= 0) return;
    const id = this.nextId++;
    const mesh = MeshBuilder.CreateBox(`item_drop_${id}_${getBlock(blockId).name.toLowerCase().replace(/\s+/g, '_')}`, { size: 0.34 }, this.scene);
    mesh.position = position.add(new Vector3(0.5, 0.55, 0.5));
    mesh.isPickable = false;
    mesh.checkCollisions = false;

    const sourceMaterial = this.materials.get(blockId);
    if (sourceMaterial) mesh.material = sourceMaterial;
    else {
      const material = new StandardMaterial(`item_drop_material_${blockId}`, this.scene);
      mesh.material = material;
    }

    this.drops.set(id, { id, blockId, amount, mesh, bornAt: performance.now() });
  }

  update(playerPosition: Vector3, deltaSeconds: number): CollectedDrop[] {
    const collected: CollectedDrop[] = [];
    const now = performance.now();

    for (const [id, drop] of Array.from(this.drops.entries())) {
      const age = (now - drop.bornAt) / 1000;
      drop.mesh.rotation.y += deltaSeconds * 2.4;
      drop.mesh.rotation.x += deltaSeconds * 1.1;
      drop.mesh.position.y += Math.sin(now * 0.004 + id) * 0.002;

      if (Vector3.Distance(drop.mesh.position, playerPosition) < 1.65 && age > 0.18) {
        collected.push({ blockId: drop.blockId, amount: drop.amount });
        drop.mesh.dispose();
        this.drops.delete(id);
      } else if (age > 180) {
        drop.mesh.dispose();
        this.drops.delete(id);
      }
    }

    return collected;
  }

  getCount(): number {
    return this.drops.size;
  }

  dispose(): void {
    for (const drop of this.drops.values()) drop.mesh.dispose();
    this.drops.clear();
  }
}

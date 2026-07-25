/**
 * CreatureManager — visible passive creatures with lightweight wander AI.
 *
 * This is intentionally runtime-only and does not replace the deeper creature
 * architecture skeleton. It gives the playable world obvious life right now:
 * cell-based spawning, safe surface placement, simple mesh bodies, wandering,
 * and despawn outside the active area.
 */
import {
  AbstractMesh,
  Color3,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import { BiomeID, TerrainGenerator } from '../world/TerrainGenerator';

export type CreatureKind = 'sheep' | 'deer' | 'goat' | 'hare';

export interface CreatureStats {
  count: number;
  cap: number;
  spawned: number;
  despawned: number;
}

export interface CreatureDamageResult {
  hit: boolean;
  dead: boolean;
  message: string;
  position?: Vector3;
  drops?: Array<{ blockId: number; amount: number }>;
}

interface CreatureEntity {
  id: string;
  kind: CreatureKind;
  health: number;
  maxHealth: number;
  root: TransformNode;
  meshes: AbstractMesh[];
  target: Vector3;
  speed: number;
  nextDecisionAt: number;
  randomState: number;
}

const SPAWN_CELL_SIZE = 18;
const SPAWN_RADIUS = 54;
const DESPAWN_RADIUS = 74;
const CREATURE_CAP = 22;

export class CreatureManager {
  private readonly creatures = new Map<string, CreatureEntity>();
  private readonly materials = new Map<string, StandardMaterial>();
  private spawnAccumulator = 0;
  private spawned = 0;
  private despawned = 0;

  constructor(
    private readonly scene: Scene,
    private readonly terrain: TerrainGenerator,
    private readonly seed: string
  ) {}

  update(playerPosition: Vector3, deltaSeconds: number): void {
    this.spawnAccumulator += deltaSeconds;
    if (this.spawnAccumulator >= 0.75) {
      this.spawnAccumulator = 0;
      this.updatePopulation(playerPosition);
    }

    const now = performance.now();
    for (const creature of this.creatures.values()) {
      this.updateCreature(creature, now, deltaSeconds);
    }
  }

  damageCreature(creatureId: string, damage: number): CreatureDamageResult {
    const creature = this.creatures.get(creatureId);
    if (!creature) return { hit: false, dead: false, message: 'No creature hit' };

    creature.health = Math.max(0, creature.health - damage);
    if (creature.health > 0) {
      creature.root.scaling = new Vector3(1.05, 0.94, 1.05);
      window.setTimeout(() => {
        if (!creature.root.isDisposed()) creature.root.scaling = Vector3.One();
      }, 90);
      return {
        hit: true,
        dead: false,
        message: `${this.creatureName(creature.kind)} hit (${Math.ceil(creature.health)}/${creature.maxHealth})`,
      };
    }

    const position = creature.root.position.clone();
    const drops = this.lootFor(creature.kind);
    creature.root.dispose(false, true);
    this.creatures.delete(creatureId);
    this.despawned += 1;
    return {
      hit: true,
      dead: true,
      position,
      drops,
      message: `${this.creatureName(creature.kind)} defeated`,
    };
  }

  getStats(): CreatureStats {
    return {
      count: this.creatures.size,
      cap: CREATURE_CAP,
      spawned: this.spawned,
      despawned: this.despawned,
    };
  }

  dispose(): void {
    for (const creature of this.creatures.values()) {
      creature.root.dispose(false, true);
    }
    this.creatures.clear();
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
  }

  private updatePopulation(playerPosition: Vector3): void {
    for (const [id, creature] of Array.from(this.creatures.entries())) {
      if (Vector3.Distance(creature.root.position, playerPosition) > DESPAWN_RADIUS) {
        creature.root.dispose(false, true);
        this.creatures.delete(id);
        this.despawned += 1;
      }
    }

    if (this.creatures.size >= CREATURE_CAP) return;

    const centerCellX = Math.floor(playerPosition.x / SPAWN_CELL_SIZE);
    const centerCellZ = Math.floor(playerPosition.z / SPAWN_CELL_SIZE);
    const radiusInCells = Math.ceil(SPAWN_RADIUS / SPAWN_CELL_SIZE);

    for (let cellX = centerCellX - radiusInCells; cellX <= centerCellX + radiusInCells; cellX += 1) {
      for (let cellZ = centerCellZ - radiusInCells; cellZ <= centerCellZ + radiusInCells; cellZ += 1) {
        if (this.creatures.size >= CREATURE_CAP) return;
        this.trySpawnCell(cellX, cellZ, playerPosition);
      }
    }
  }

  private trySpawnCell(cellX: number, cellZ: number, playerPosition: Vector3): void {
    const id = `${cellX}:${cellZ}`;
    if (this.creatures.has(id)) return;
    if (this.hashToUnit(`spawn-gate:${id}`) < 0.42) return;

    const worldX = cellX * SPAWN_CELL_SIZE + 2 + Math.floor(this.hashToUnit(`spawn-x:${id}`) * (SPAWN_CELL_SIZE - 4));
    const worldZ = cellZ * SPAWN_CELL_SIZE + 2 + Math.floor(this.hashToUnit(`spawn-z:${id}`) * (SPAWN_CELL_SIZE - 4));
    const position = this.safeCreaturePosition(worldX, worldZ, playerPosition);
    if (!position) return;

    const biome = this.terrain.getBiomeAt(worldX, worldZ);
    const kind = this.chooseCreatureKind(biome, id);
    const creature = this.createCreature(id, kind, position);
    this.creatures.set(id, creature);
    this.spawned += 1;
  }

  private safeCreaturePosition(worldX: number, worldZ: number, playerPosition: Vector3): Vector3 | null {
    if (Math.hypot(worldX - playerPosition.x, worldZ - playerPosition.z) < 11) return null;
    if (this.terrain.getBiomeAt(worldX, worldZ) === 'Lake') return null;

    const x = Math.floor(worldX);
    const z = Math.floor(worldZ);
    const groundY = this.terrain.getHeightAt(x, z);
    if (groundY < 1) return null;
    if (this.terrain.getBlockAt(x, groundY, z) === 5) return null;
    if (this.terrain.getBlockAt(x, groundY + 1, z) !== 0) return null;
    if (this.terrain.getBlockAt(x, groundY + 2, z) !== 0) return null;

    return new Vector3(x + 0.5, groundY + 1, z + 0.5);
  }

  private createCreature(id: string, kind: CreatureKind, position: Vector3): CreatureEntity {
    const root = new TransformNode(`creature_${kind}_${id}`, this.scene);
    root.position = position.clone();

    const meshes = this.createCreatureMeshes(kind, root);
    const speed = kind === 'hare' ? 2.2 : kind === 'deer' ? 1.45 : 1.05;
    const maxHealth = kind === 'deer' ? 26 : kind === 'goat' ? 24 : kind === 'sheep' ? 20 : 12;
    const randomState = this.hashToInt(`creature-state:${id}`);
    const creature: CreatureEntity = {
      id,
      kind,
      health: maxHealth,
      maxHealth,
      root,
      meshes,
      target: position.clone(),
      speed,
      nextDecisionAt: 0,
      randomState,
    };
    this.chooseNewTarget(creature, performance.now());
    return creature;
  }

  private createCreatureMeshes(kind: CreatureKind, root: TransformNode): AbstractMesh[] {
    const materials = this.creatureMaterials(kind);
    const body = MeshBuilder.CreateBox(`creature_${kind}_body`, { width: 0.9, height: 0.62, depth: 1.25 }, this.scene);
    body.parent = root;
    body.position.y = 0.62;
    body.material = materials.body;

    const head = MeshBuilder.CreateBox(`creature_${kind}_head`, { width: 0.46, height: 0.42, depth: 0.46 }, this.scene);
    head.parent = root;
    head.position = new Vector3(0, 0.84, 0.78);
    head.material = materials.head;

    const meshes: AbstractMesh[] = [body, head];
    for (const x of [-0.32, 0.32]) {
      for (const z of [-0.42, 0.42]) {
        const leg = MeshBuilder.CreateBox(`creature_${kind}_leg`, { width: 0.16, height: 0.5, depth: 0.16 }, this.scene);
        leg.parent = root;
        leg.position = new Vector3(x, 0.25, z);
        leg.material = materials.leg;
        meshes.push(leg);
      }
    }

    if (kind === 'goat') {
      for (const x of [-0.18, 0.18]) {
        const horn = MeshBuilder.CreateCylinder(`creature_${kind}_horn`, { height: 0.34, diameterTop: 0.03, diameterBottom: 0.09 }, this.scene);
        horn.parent = root;
        horn.position = new Vector3(x, 1.14, 0.82);
        horn.material = this.getMaterial('horn', new Color3(0.93, 0.87, 0.72));
        meshes.push(horn);
      }
    }

    if (kind === 'hare') {
      for (const x of [-0.12, 0.12]) {
        const ear = MeshBuilder.CreateBox(`creature_${kind}_ear`, { width: 0.1, height: 0.44, depth: 0.08 }, this.scene);
        ear.parent = root;
        ear.position = new Vector3(x, 1.2, 0.78);
        ear.material = materials.head;
        meshes.push(ear);
      }
    }

    for (const mesh of meshes) {
      mesh.isPickable = true;
      mesh.checkCollisions = false;
      mesh.metadata = { creatureId: root.name.replace(/^creature_[^_]+_/, '') };
    }

    return meshes;
  }

  private updateCreature(creature: CreatureEntity, now: number, deltaSeconds: number): void {
    const toTarget = creature.target.subtract(creature.root.position);
    const horizontalDistance = Math.hypot(toTarget.x, toTarget.z);
    if (horizontalDistance < 0.35 || now >= creature.nextDecisionAt) {
      this.chooseNewTarget(creature, now);
      return;
    }

    const direction = new Vector3(toTarget.x, 0, toTarget.z).normalize();
    const step = Math.min(horizontalDistance, creature.speed * deltaSeconds);
    const nextX = creature.root.position.x + direction.x * step;
    const nextZ = creature.root.position.z + direction.z * step;
    const safe = this.safeGroundPosition(nextX, nextZ);
    if (!safe) {
      this.chooseNewTarget(creature, now);
      return;
    }

    creature.root.position = safe;
    creature.root.rotation.y = Math.atan2(direction.x, direction.z);
    const bob = Math.sin(now * 0.008 + creature.randomState) * 0.035;
    creature.root.position.y += bob;
  }

  private chooseNewTarget(creature: CreatureEntity, now: number): void {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const angle = this.nextRandom(creature) * Math.PI * 2;
      const distance = 4 + this.nextRandom(creature) * 10;
      const candidateX = creature.root.position.x + Math.cos(angle) * distance;
      const candidateZ = creature.root.position.z + Math.sin(angle) * distance;
      const safe = this.safeGroundPosition(candidateX, candidateZ);
      if (safe) {
        creature.target = safe;
        creature.nextDecisionAt = now + 2500 + this.nextRandom(creature) * 4500;
        return;
      }
    }

    creature.target = creature.root.position.clone();
    creature.nextDecisionAt = now + 1500;
  }

  private safeGroundPosition(worldX: number, worldZ: number): Vector3 | null {
    const x = Math.floor(worldX);
    const z = Math.floor(worldZ);
    if (this.terrain.getBiomeAt(x, z) === 'Lake') return null;

    const groundY = this.terrain.getHeightAt(x, z);
    if (groundY < 1) return null;
    if (this.terrain.getBlockAt(x, groundY, z) === 5) return null;
    if (this.terrain.getBlockAt(x, groundY + 1, z) !== 0) return null;
    if (this.terrain.getBlockAt(x, groundY + 2, z) !== 0) return null;
    return new Vector3(worldX, groundY + 1, worldZ);
  }

  private chooseCreatureKind(biome: BiomeID, salt: string): CreatureKind {
    const roll = this.hashToUnit(`kind:${salt}`);
    if (biome === 'Forest') return roll > 0.4 ? 'deer' : 'sheep';
    if (biome === 'Highlands') return roll > 0.28 ? 'goat' : 'sheep';
    if (biome === 'Desert') return 'hare';
    return roll > 0.7 ? 'deer' : 'sheep';
  }


  private lootFor(kind: CreatureKind): Array<{ blockId: number; amount: number }> {
    if (kind === 'goat') return [{ blockId: 3, amount: 1 }];
    if (kind === 'hare') return [{ blockId: 4, amount: 1 }];
    if (kind === 'deer') return [{ blockId: 6, amount: 1 }];
    return [{ blockId: 7, amount: 1 }];
  }

  private creatureName(kind: CreatureKind): string {
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  }

  private creatureMaterials(kind: CreatureKind): { body: StandardMaterial; head: StandardMaterial; leg: StandardMaterial } {
    if (kind === 'deer') {
      return {
        body: this.getMaterial('deer_body', new Color3(0.5, 0.28, 0.12)),
        head: this.getMaterial('deer_head', new Color3(0.42, 0.22, 0.09)),
        leg: this.getMaterial('deer_leg', new Color3(0.24, 0.13, 0.06)),
      };
    }
    if (kind === 'goat') {
      return {
        body: this.getMaterial('goat_body', new Color3(0.72, 0.72, 0.68)),
        head: this.getMaterial('goat_head', new Color3(0.82, 0.82, 0.78)),
        leg: this.getMaterial('goat_leg', new Color3(0.42, 0.42, 0.4)),
      };
    }
    if (kind === 'hare') {
      return {
        body: this.getMaterial('hare_body', new Color3(0.76, 0.58, 0.32)),
        head: this.getMaterial('hare_head', new Color3(0.86, 0.68, 0.42)),
        leg: this.getMaterial('hare_leg', new Color3(0.54, 0.38, 0.2)),
      };
    }
    return {
      body: this.getMaterial('sheep_body', new Color3(0.88, 0.86, 0.76)),
      head: this.getMaterial('sheep_head', new Color3(0.18, 0.18, 0.16)),
      leg: this.getMaterial('sheep_leg', new Color3(0.1, 0.1, 0.09)),
    };
  }

  private getMaterial(name: string, color: Color3): StandardMaterial {
    const existing = this.materials.get(name);
    if (existing) return existing;

    const material = new StandardMaterial(`creature_material_${name}`, this.scene);
    material.diffuseColor = color;
    material.specularColor = new Color3(0.04, 0.04, 0.04);
    this.materials.set(name, material);
    return material;
  }

  private nextRandom(creature: CreatureEntity): number {
    creature.randomState = (Math.imul(1664525, creature.randomState) + 1013904223) >>> 0;
    return creature.randomState / 0xffffffff;
  }

  private hashToInt(str: string): number {
    let h = 2166136261;
    const full = `${this.seed}:${str}`;
    for (let i = 0; i < full.length; i += 1) {
      h ^= full.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  private hashToUnit(str: string): number {
    return this.hashToInt(str) / 0xffffffff;
  }
}

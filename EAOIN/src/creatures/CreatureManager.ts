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
  RawTexture,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import { BiomeID, TerrainGenerator } from '../world/TerrainGenerator';
import { buildMobTexture, MOB_TEXTURE_SIZE, MobPart, MobSpecies } from './CreatureTextures';

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
  /** Legs, for the walk cycle. Front-left/back-right swing together. */
  legs: AbstractMesh[];
  /** Head, for idle grazing and look-at. */
  head: AbstractMesh | null;
  target: Vector3;
  speed: number;
  nextDecisionAt: number;
  randomState: number;
  /** Accumulated walk-cycle phase, advanced by distance travelled. */
  walkPhase: number;
  /** True while the creature is moving, so idle animation can differ. */
  moving: boolean;
}

/**
 * Per-species body proportions, in world units.
 *
 * Kept as data so a hare is genuinely small and hunched while a deer is tall
 * and long-legged, rather than every animal being the same box with a
 * different colour.
 */
interface BodyShape {
  bodyWidth: number; bodyHeight: number; bodyDepth: number; bodyY: number;
  headSize: number; headY: number; headZ: number;
  legThickness: number; legHeight: number; legSpreadX: number; legSpreadZ: number;
  earWidth: number; earHeight: number; earDepth: number;
  tailLength: number;
}

const BODY_SHAPES: Record<CreatureKind, BodyShape> = {
  sheep: {
    bodyWidth: 0.78, bodyHeight: 0.68, bodyDepth: 1.14, bodyY: 0.86,
    headSize: 0.44, headY: 1.02, headZ: 0.70,
    legThickness: 0.18, legHeight: 0.52, legSpreadX: 0.26, legSpreadZ: 0.38,
    earWidth: 0.16, earHeight: 0.08, earDepth: 0.10, tailLength: 0.18,
  },
  deer: {
    bodyWidth: 0.62, bodyHeight: 0.62, bodyDepth: 1.28, bodyY: 1.08,
    headSize: 0.40, headY: 1.42, headZ: 0.76,
    legThickness: 0.14, legHeight: 0.78, legSpreadX: 0.24, legSpreadZ: 0.46,
    earWidth: 0.10, earHeight: 0.20, earDepth: 0.06, tailLength: 0.16,
  },
  goat: {
    bodyWidth: 0.66, bodyHeight: 0.60, bodyDepth: 1.06, bodyY: 0.84,
    headSize: 0.40, headY: 1.04, headZ: 0.64,
    legThickness: 0.15, legHeight: 0.54, legSpreadX: 0.24, legSpreadZ: 0.36,
    earWidth: 0.16, earHeight: 0.07, earDepth: 0.08, tailLength: 0.14,
  },
  hare: {
    bodyWidth: 0.34, bodyHeight: 0.32, bodyDepth: 0.52, bodyY: 0.32,
    headSize: 0.26, headY: 0.44, headZ: 0.32,
    legThickness: 0.09, legHeight: 0.20, legSpreadX: 0.12, legSpreadZ: 0.18,
    earWidth: 0.07, earHeight: 0.30, earDepth: 0.04, tailLength: 0.10,
  },
};

const SPAWN_CELL_SIZE = 18;
const SPAWN_RADIUS = 54;
const DESPAWN_RADIUS = 74;
const CREATURE_CAP = 22;

/** Rotate `current` toward `target` by at most `maxDelta`, wrapping at ±π. */
function approachAngle(current: number, target: number, maxDelta: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

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

  /**
   * Remove every loaded creature. Backs `/kill @e`.
   */
  clearAll(): number {
    const removed = this.creatures.size;
    for (const creature of this.creatures.values()) creature.root.dispose(false, true);
    this.creatures.clear();
    this.despawned += removed;
    return removed;
  }

  /**
   * Spawn one creature near a position. Backs `/summon`.
   *
   * Returns the species actually spawned, or null when there was no safe
   * ground within range.
   */
  spawnNear(position: Vector3, requested: string): string | null {
    const kind = (['sheep', 'deer', 'goat', 'hare'] as CreatureKind[])
      .find((k) => k === requested.toLowerCase()) ?? 'sheep';

    // Try a ring of candidate positions around the player.
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const angle = (attempt / 16) * Math.PI * 2;
      const radius = 3 + (attempt % 4);
      const x = position.x + Math.cos(angle) * radius;
      const z = position.z + Math.sin(angle) * radius;
      const safe = this.safeGroundPosition(x, z);
      if (!safe) continue;
      const id = `summon:${this.spawned}:${attempt}`;
      this.creatures.set(id, this.createCreature(id, kind, safe));
      this.spawned += 1;
      return kind;
    }
    return null;
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

    const { meshes, legs, head } = this.createCreatureMeshes(kind, root);
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
      legs,
      head,
      target: position.clone(),
      speed,
      nextDecisionAt: 0,
      randomState,
      walkPhase: 0,
      moving: false,
    };
    this.chooseNewTarget(creature, performance.now());
    return creature;
  }

  /**
   * Build a mob body from textured cuboids.
   *
   * Parts are proportioned per species (a hare is not a scaled sheep) and each
   * uses a real pixel-art texture rather than a flat colour. Eyes are painted
   * into the head texture, so the extra emissive eye cubes that produced the
   * "white block eye" are gone.
   */
  private createCreatureMeshes(
    kind: CreatureKind,
    root: TransformNode
  ): { meshes: AbstractMesh[]; legs: AbstractMesh[]; head: AbstractMesh | null } {
    const species = this.speciesFor(kind);
    const shape = BODY_SHAPES[kind];
    const bodyMaterial = this.partMaterial(species, 'body');
    const headMaterial = this.partMaterial(species, 'head');
    const legMaterial = this.partMaterial(species, 'leg');

    const meshes: AbstractMesh[] = [];
    const legs: AbstractMesh[] = [];

    const body = MeshBuilder.CreateBox(`creature_${kind}_body`, {
      width: shape.bodyWidth, height: shape.bodyHeight, depth: shape.bodyDepth,
    }, this.scene);
    body.parent = root;
    body.position.y = shape.bodyY;
    body.material = bodyMaterial;
    meshes.push(body);

    const head = MeshBuilder.CreateBox(`creature_${kind}_head`, {
      width: shape.headSize, height: shape.headSize, depth: shape.headSize,
    }, this.scene);
    head.parent = root;
    head.position = new Vector3(0, shape.headY, shape.headZ);
    head.material = headMaterial;
    meshes.push(head);

    // Snout, so the head is not a featureless cube in profile.
    const snout = MeshBuilder.CreateBox(`creature_${kind}_snout`, {
      width: shape.headSize * 0.5, height: shape.headSize * 0.42, depth: shape.headSize * 0.42,
    }, this.scene);
    snout.parent = head;
    snout.position = new Vector3(0, -shape.headSize * 0.18, shape.headSize * 0.62);
    snout.material = headMaterial;
    meshes.push(snout);

    // Ears — small, but they do most of the work in reading a silhouette.
    for (const side of [-1, 1]) {
      const ear = MeshBuilder.CreateBox(`creature_${kind}_ear`, {
        width: shape.earWidth, height: shape.earHeight, depth: shape.earDepth,
      }, this.scene);
      ear.parent = head;
      ear.position = new Vector3(side * shape.headSize * 0.34, shape.headSize * 0.6, 0);
      ear.material = headMaterial;
      meshes.push(ear);
    }

    // Four legs, tracked separately so they can swing.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = MeshBuilder.CreateBox(`creature_${kind}_leg`, {
          width: shape.legThickness, height: shape.legHeight, depth: shape.legThickness,
        }, this.scene);
        leg.parent = root;
        // Pivot at the hip: shift the box down inside a parent-less offset by
        // placing it so rotation about its top edge looks like a stride.
        leg.setPivotPoint(new Vector3(0, shape.legHeight / 2, 0));
        leg.position = new Vector3(
          sx * shape.legSpreadX,
          shape.legHeight / 2,
          sz * shape.legSpreadZ
        );
        leg.material = legMaterial;
        meshes.push(leg);
        legs.push(leg);
      }
    }

    // Tail.
    const tail = MeshBuilder.CreateBox(`creature_${kind}_tail`, {
      width: shape.legThickness * 0.8, height: shape.legThickness * 0.8, depth: shape.tailLength,
    }, this.scene);
    tail.parent = root;
    tail.position = new Vector3(0, shape.bodyY + shape.bodyHeight * 0.25, -shape.bodyDepth * 0.55);
    tail.material = bodyMaterial;
    meshes.push(tail);

    if (kind === 'goat') {
      for (const side of [-1, 1]) {
        const horn = MeshBuilder.CreateCylinder(`creature_${kind}_horn`, {
          height: 0.3, diameterTop: 0.03, diameterBottom: 0.08, tessellation: 6,
        }, this.scene);
        horn.parent = head;
        horn.position = new Vector3(side * shape.headSize * 0.3, shape.headSize * 0.7, -0.02);
        horn.rotation.z = side * 0.35;
        horn.material = this.getMaterial('horn', new Color3(0.9, 0.86, 0.74));
        meshes.push(horn);
      }
    }

    for (const mesh of meshes) {
      mesh.isPickable = true;
      mesh.checkCollisions = false;
      mesh.receiveShadows = true;
      mesh.metadata = { creatureId: root.name.replace(/^creature_[^_]+_/, '') };
    }

    return { meshes, legs, head };
  }

  /** Map the gameplay creature kind onto a texture species. */
  private speciesFor(kind: CreatureKind): MobSpecies {
    return kind;
  }

  /** Cached textured material for one body part of a species. */
  private partMaterial(species: MobSpecies, part: MobPart): StandardMaterial {
    const name = `${species}_${part}`;
    const existing = this.materials.get(name);
    if (existing) return existing;

    const material = new StandardMaterial(`creature_material_${name}`, this.scene);
    const texture = RawTexture.CreateRGBATexture(
      buildMobTexture(species, part),
      MOB_TEXTURE_SIZE,
      MOB_TEXTURE_SIZE,
      this.scene,
      true,
      false,
      Texture.NEAREST_NEAREST_MIPLINEAR
    );
    texture.name = `creature_tex_${name}`;
    material.diffuseTexture = texture;
    // Animals are matte, and a little ambient keeps them readable at dusk.
    material.specularColor = new Color3(0.03, 0.03, 0.03);
    material.ambientColor = new Color3(1, 1, 1);
    this.materials.set(name, material);
    return material;
  }

  private updateCreature(creature: CreatureEntity, now: number, deltaSeconds: number): void {
    const toTarget = creature.target.subtract(creature.root.position);
    const horizontalDistance = Math.hypot(toTarget.x, toTarget.z);
    if (horizontalDistance < 0.35 || now >= creature.nextDecisionAt) {
      creature.moving = false;
      this.animateCreature(creature, now, deltaSeconds, 0);
      this.chooseNewTarget(creature, now);
      return;
    }

    const direction = new Vector3(toTarget.x, 0, toTarget.z).normalize();
    const step = Math.min(horizontalDistance, creature.speed * deltaSeconds);
    const nextX = creature.root.position.x + direction.x * step;
    const nextZ = creature.root.position.z + direction.z * step;
    const safe = this.safeGroundPosition(nextX, nextZ);
    if (!safe) {
      creature.moving = false;
      this.animateCreature(creature, now, deltaSeconds, 0);
      this.chooseNewTarget(creature, now);
      return;
    }

    creature.root.position = safe;
    // Turn smoothly toward the heading rather than snapping, so animals bank
    // into corners instead of pivoting on the spot.
    const desiredYaw = Math.atan2(direction.x, direction.z);
    creature.root.rotation.y = approachAngle(creature.root.rotation.y, desiredYaw, deltaSeconds * 6);
    creature.moving = true;
    this.animateCreature(creature, now, deltaSeconds, step);
  }

  /**
   * Walk cycle and idle motion.
   *
   * Legs swing in diagonal pairs (front-left with back-right), which is how
   * quadrupeds actually move and reads correctly even at 16px. The phase is
   * advanced by **distance travelled**, not by time, so animals never moonwalk
   * when their speed changes. Idle animals graze: the head dips periodically.
   */
  private animateCreature(
    creature: CreatureEntity,
    now: number,
    deltaSeconds: number,
    distance: number
  ): void {
    const shape = BODY_SHAPES[creature.kind];

    if (creature.moving) {
      // One full stride per ~0.9 world units for a sheep-sized animal.
      creature.walkPhase += distance / Math.max(0.2, shape.legHeight * 1.6);
      const swing = Math.sin(creature.walkPhase * Math.PI * 2) * 0.7;
      for (let i = 0; i < creature.legs.length; i += 1) {
        // Legs are ordered (-x,-z) (-x,+z) (+x,-z) (+x,+z); diagonals are
        // indices 0&3 and 1&2.
        const diagonal = i === 0 || i === 3 ? 1 : -1;
        creature.legs[i].rotation.x = swing * diagonal;
      }
      // Body bob synced to the stride, plus a slight forward lean.
      const bob = Math.abs(Math.sin(creature.walkPhase * Math.PI * 2)) * shape.legHeight * 0.06;
      creature.root.position.y += bob;
      if (creature.head) creature.head.rotation.x = 0.06;
    } else {
      // Ease the legs back to neutral so stopping does not freeze mid-stride.
      for (const leg of creature.legs) {
        leg.rotation.x += (0 - leg.rotation.x) * Math.min(1, deltaSeconds * 8);
      }
      // Grazing: dip the head on a slow cycle, offset per animal.
      if (creature.head) {
        const graze = Math.sin(now * 0.0011 + creature.randomState * 0.001);
        creature.head.rotation.x = graze > 0.4 ? 0.62 : 0.06;
      }
    }
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

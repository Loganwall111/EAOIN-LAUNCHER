/**
 * CreatureManager — spawns, builds, animates and despawns the wildlife.
 *
 * ## What changed
 *
 * This used to hard-code four animals (`'sheep' | 'deer' | 'goat' | 'hare'`)
 * with flat-colour boxes, while `WildlifeRegistry.ts` sat in the repo with 41
 * fully-specified species that **nothing imported** — a dead file. So the
 * world had four mobs in it and the data for forty-one.
 *
 * The manager is now a thin, generic spawner driven entirely by that registry:
 *
 *   - **Every species in the roster can spawn**, filtered by biome, habitat
 *     and time of day via `speciesForBiome`.
 *   - **Every species has colour variants** from `SpeciesVariants.ts`, themed
 *     on the animal itself (a wolf rolls timber/tundra/black/dire, never
 *     something unrelated), plus a size tier. Variants are deterministic per
 *     spawn id, so an animal looks the same each time it streams back in.
 *   - **Seven body plans** are built procedurally: quadruped, biped, bird,
 *     serpent, fish, marine and insect.
 *   - **Textures** come from the shared painter, with eyes drawn into the head
 *     texture rather than glued on as emissive cubes.
 *   - **Hostile species attack**, so the world has actual danger in it.
 *
 * Adding an animal is still a single entry in `WildlifeRegistry.ts`.
 */
import {
  AbstractMesh,
  Color3,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  RawTexture,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
/**
 * The surface/voxel/biome queries the spawner needs. Abstracted so the manager
 * can be pointed at the dimension-aware `DimensionChunkSource` (which reads the
 * ACTIVE dimension's real terrain) instead of always the overworld. Previously
 * creatures queried the overworld even inside a dimension, so they spawned
 * buried under that dimension's ground.
 */
export interface CreatureTerrainSource {
  getSurfaceHeight(x: number, z: number): number;
  getBlockAt(x: number, y: number, z: number): number;
  getBiomeAt(x: number, z: number): unknown;
}
import {
  buildMobEmissiveMask,
  buildMobTextureFromPalette,
  CoatStyle,
  MOB_TEXTURE_SIZE,
  MobPart,
} from './CreatureTextures';
import {
  ALL_SPECIES,
  BodyPlan,
  pickSpecies,
  SpeciesDefinition,
  speciesForBiome,
  SPECIES_BY_ID,
} from './WildlifeRegistry';
import { ResolvedVariant, resolveVariant } from './SpeciesVariants';

export interface CreatureStats {
  count: number;
  cap: number;
  spawned: number;
  despawned: number;
  /** Distinct species currently alive — surfaced in the HUD. */
  species: number;
}

export interface CreatureDamageResult {
  hit: boolean;
  dead: boolean;
  message: string;
  position?: Vector3;
  drops?: Array<{ blockId: number; amount: number }>;
}

/** Damage the player takes from a hostile creature this tick. */
export interface CreatureAttack {
  amount: number;
  source: string;
}

interface CreatureEntity {
  id: string;
  species: SpeciesDefinition;
  variant: ResolvedVariant;
  health: number;
  maxHealth: number;
  root: TransformNode;
  meshes: AbstractMesh[];
  /** Limbs driven by the walk cycle (leg hips, wings, or serpent segments). */
  limbs: TransformNode[];
  head: AbstractMesh | null;
  target: Vector3;
  speed: number;
  nextDecisionAt: number;
  randomState: number;
  walkPhase: number;
  moving: boolean;
  /** Timestamp of this creature's last attack, for its cooldown. */
  lastAttackAt: number;
  /** True for water-habitat creatures that swim rather than walk on land. */
  aquatic: boolean;
}

const SPAWN_CELL_SIZE = 18;
const SPAWN_RADIUS = 54;
const DESPAWN_RADIUS = 74;
const DEFAULT_CREATURE_CAP = 26;
/** Seconds between attacks from one hostile creature. */
const ATTACK_COOLDOWN_MS = 1200;
/** How close a hostile has to be to land a hit. */
const ATTACK_REACH = 2.4;
/** Hostiles inside this range will approach the player instead of wandering. */
const AGGRO_RANGE = 16;
const tempCreatureVecA = Vector3.Zero();
const tempCreatureVecB = Vector3.Zero();

/**
 * Base dimensions per body plan, in world units, before the species' own
 * `scale` and its variant's size tier are applied.
 */
interface PlanShape {
  bodyWidth: number; bodyHeight: number; bodyDepth: number; bodyY: number;
  headSize: number; headY: number; headZ: number;
  legThickness: number; legHeight: number; legSpreadX: number; legSpreadZ: number;
  /** Number of legs to build. 0 for legless plans. */
  legCount: 0 | 2 | 4 | 6;
  earWidth: number; earHeight: number; earDepth: number;
  tailLength: number;
  /** Wing planes, for birds and insects. */
  wings: boolean;
  /** Tail fin, for fish and marine animals. */
  fin: boolean;
  /** Chain of body segments, for serpents. */
  segments: number;
}

const PLAN_SHAPES: Record<BodyPlan, PlanShape> = {
  quadruped: {
    bodyWidth: 0.72, bodyHeight: 0.64, bodyDepth: 1.12, bodyY: 0.86,
    headSize: 0.42, headY: 1.02, headZ: 0.70,
    legThickness: 0.17, legHeight: 0.52, legSpreadX: 0.25, legSpreadZ: 0.38,
    legCount: 4, earWidth: 0.14, earHeight: 0.10, earDepth: 0.08,
    tailLength: 0.18, wings: false, fin: false, segments: 0,
  },
  biped: {
    bodyWidth: 0.42, bodyHeight: 0.72, bodyDepth: 0.40, bodyY: 0.74,
    headSize: 0.34, headY: 1.24, headZ: 0.12,
    legThickness: 0.13, legHeight: 0.40, legSpreadX: 0.13, legSpreadZ: 0,
    legCount: 2, earWidth: 0.08, earHeight: 0.06, earDepth: 0.06,
    tailLength: 0.20, wings: true, fin: false, segments: 0,
  },
  bird: {
    bodyWidth: 0.34, bodyHeight: 0.34, bodyDepth: 0.46, bodyY: 0.44,
    headSize: 0.24, headY: 0.70, headZ: 0.22,
    legThickness: 0.07, legHeight: 0.22, legSpreadX: 0.10, legSpreadZ: 0,
    legCount: 2, earWidth: 0.05, earHeight: 0.05, earDepth: 0.05,
    tailLength: 0.22, wings: true, fin: false, segments: 0,
  },
  fish: {
    bodyWidth: 0.22, bodyHeight: 0.34, bodyDepth: 0.62, bodyY: 0.30,
    headSize: 0.24, headY: 0.30, headZ: 0.40,
    legThickness: 0, legHeight: 0, legSpreadX: 0, legSpreadZ: 0,
    legCount: 0, earWidth: 0, earHeight: 0, earDepth: 0,
    tailLength: 0.26, wings: false, fin: true, segments: 0,
  },
  marine: {
    bodyWidth: 0.68, bodyHeight: 0.74, bodyDepth: 2.10, bodyY: 0.60,
    headSize: 0.56, headY: 0.62, headZ: 1.28,
    legThickness: 0, legHeight: 0, legSpreadX: 0, legSpreadZ: 0,
    legCount: 0, earWidth: 0, earHeight: 0, earDepth: 0,
    tailLength: 0.7, wings: false, fin: true, segments: 0,
  },
  serpent: {
    bodyWidth: 0.24, bodyHeight: 0.22, bodyDepth: 0.34, bodyY: 0.16,
    headSize: 0.26, headY: 0.20, headZ: 0.42,
    legThickness: 0, legHeight: 0, legSpreadX: 0, legSpreadZ: 0,
    legCount: 0, earWidth: 0, earHeight: 0, earDepth: 0,
    tailLength: 0, wings: false, fin: false, segments: 6,
  },
  insect: {
    bodyWidth: 0.26, bodyHeight: 0.20, bodyDepth: 0.42, bodyY: 0.20,
    headSize: 0.18, headY: 0.22, headZ: 0.28,
    legThickness: 0.045, legHeight: 0.14, legSpreadX: 0.16, legSpreadZ: 0.12,
    legCount: 6, earWidth: 0.04, earHeight: 0.10, earDepth: 0.03,
    tailLength: 0.16, wings: false, fin: false, segments: 0,
  },
};

/** Surface treatment per body plan, when the species has no better hint. */
const PLAN_COAT: Record<BodyPlan, CoatStyle> = {
  quadruped: 'fur',
  biped: 'feather',
  bird: 'feather',
  fish: 'scale',
  marine: 'slick',
  serpent: 'scale',
  insect: 'chitin',
};

/** Species that should use a specific coat regardless of their body plan. */
const SPECIES_COAT: Record<string, CoatStyle> = {
  sheep: 'wool',
  cow: 'hide',
  pig: 'hide',
  elephant: 'hide',
  crocodile: 'scale',
  frog: 'slick',
  whale: 'slick',
  dolphin: 'slick',
  orca: 'slick',
};

/** Marking style per species; anything unlisted gets none. */
const SPECIES_MARKINGS: Record<string, 'patches' | 'dapples' | 'tufts' | 'stripes' | 'belly'> = {
  cow: 'patches',
  deer: 'dapples',
  sheep: 'tufts',
  giraffe: 'patches',
  clownfish: 'stripes',
  shark: 'belly',
  dolphin: 'belly',
  orca: 'patches',
  whale: 'belly',
  penguin: 'belly',
  crocodile: 'stripes',
  python: 'patches',
  rattlesnake: 'stripes',
  cobra: 'stripes',
  sea_snake: 'stripes',
  tiger: 'stripes',
};

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
  /** Id of the creature the player is currently riding (2.0 pets). */
  private riddenId: string | null = null;
  /** Player steering input applied to the ridden creature each frame (x,z). */
  private rideMove = new Vector3(0, 0, 0);
  private readonly materials = new Map<string, StandardMaterial>();
  private spawnAccumulator = 0;
  private spawned = 0;
  private despawned = 0;
  private creatureCap = DEFAULT_CREATURE_CAP;
  /** Set by the engine; receives contact damage from hostile creatures. */
  onPlayerDamage?: (attack: CreatureAttack) => void;
  /** World clock hour, so nocturnal species only appear at night. */
  private timeOfDay = 12;
  /** Hostile spawn-pressure multiplier from a moon event (blood/crimson/full). */
  private hostilityMultiplier = 1;
  /** True during a full-moon event so full-moon-only creatures may spawn. */
  private fullMoonActive = false;

  constructor(
    private readonly scene: Scene,
    private readonly terrain: CreatureTerrainSource,
    private readonly seed: string
  ) {}

  /** Keep the spawner in step with the world clock. */
  setTimeOfDay(hour: number): void {
    this.timeOfDay = hour;
  }

  /** Set the moon-event spawn pressure (blood/crimson/full moon). */
  setMoonEvent(hostilityMultiplier: number, fullMoonActive: boolean): void {
    this.hostilityMultiplier = hostilityMultiplier;
    this.fullMoonActive = fullMoonActive;
  }

  update(playerPosition: Vector3, deltaSeconds: number): void {
    this.spawnAccumulator += deltaSeconds;
    if (this.spawnAccumulator >= 0.75) {
      this.spawnAccumulator = 0;
      this.updatePopulation(playerPosition);
    }

    const now = performance.now();
    for (const creature of this.creatures.values()) {
      if (creature.id === this.riddenId) {
        this.updateRidden(creature, deltaSeconds);
        continue;
      }
      this.updateCreature(creature, now, deltaSeconds, playerPosition);
    }
  }

  /* ---- 2.0 pet riding ---------------------------------------------- */

  /** Mount the nearest non-hostile-hunting creature within `radius`. */
  mountNearest(position: Vector3, radius = 6): string | null {
    let best: string | null = null;
    let bestD = radius * radius;
    for (const creature of this.creatures.values()) {
      if (creature.species.temperament === 'hostile' && creature.id !== this.riddenId) continue;
      const d = Vector3.DistanceSquared(creature.root.position, position);
      if (d < bestD) { bestD = d; best = creature.id; }
    }
    if (best) { this.riddenId = best; this.rideMove.set(0, 0, 0); }
    return best;
  }

  setRidden(id: string | null): void {
    this.riddenId = id;
    if (id === null) this.rideMove.set(0, 0, 0);
  }

  isRiding(): boolean { return this.riddenId !== null && this.creatures.has(this.riddenId); }

  dismount(): void { this.riddenId = null; this.rideMove.set(0, 0, 0); }

  /** Steering input (world-space x/z, magnitude = speed in units/sec). */
  setRideMove(x: number, z: number): void { this.rideMove.set(x, z, 0); }

  /** Position of the ridden creature (to park the camera on top), or null. */
  getRiddenPosition(): Vector3 | null {
    if (!this.riddenId) return null;
    const creature = this.creatures.get(this.riddenId);
    return creature ? creature.root.position.clone() : null;
  }

  /** Advance the ridden creature along the steering input, staying grounded. */
  private updateRidden(creature: CreatureEntity, deltaSeconds: number): void {
    const now = performance.now();
    const len = Math.hypot(this.rideMove.x, this.rideMove.z);
    if (len < 0.01) {
      creature.moving = false;
      this.animateCreature(creature, now, deltaSeconds, 0);
      return;
    }
    const step = Math.min(len, creature.speed * deltaSeconds);
    const dirX = this.rideMove.x / len;
    const dirZ = this.rideMove.z / len;
    const safe = this.safeGroundPosition(
      creature.root.position.x + dirX * step,
      creature.root.position.z + dirZ * step
    );
    if (safe) {
      creature.root.position.copyFrom(safe);
      creature.root.rotation.y = approachAngle(
        creature.root.rotation.y,
        Math.atan2(dirX, dirZ),
        deltaSeconds * 6
      );
    }
    creature.moving = true;
    this.animateCreature(creature, now, deltaSeconds, step);
  }

  damageCreature(creatureId: string, damage: number): CreatureDamageResult {
    const creature = this.creatures.get(creatureId);
    if (!creature) return { hit: false, dead: false, message: 'No creature hit' };

    creature.health = Math.max(0, creature.health - damage);
    const name = creature.variant.displayName;

    if (creature.health > 0) {
      // Squash-and-stretch hit feedback.
      creature.root.scaling = new Vector3(1.05, 0.94, 1.05);
      window.setTimeout(() => {
        if (!creature.root.isDisposed()) creature.root.scaling = Vector3.One();
      }, 90);
      // Being hit provokes neutral animals and panics skittish ones.
      if (creature.species.temperament === 'skittish') {
        creature.nextDecisionAt = 0;
        creature.speed = creature.variant.speed * 1.8;
      }
      return {
        hit: true,
        dead: false,
        message: `${name} hit (${Math.ceil(creature.health)}/${creature.maxHealth})`,
      };
    }

    const position = creature.root.position.clone();
    const drops = creature.species.loot;
    creature.root.dispose(false, true);
    this.creatures.delete(creatureId);
    this.despawned += 1;
    return { hit: true, dead: true, position, drops, message: `${name} defeated` };
  }

  /** Remove every loaded creature. Backs `/kill @e`. */
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
   * Accepts any species id from the registry, so `/summon wolf`, `/summon
   * elephant` and `/summon shark` all work.
   */
  spawnNear(position: Vector3, requested: string): string | null {
    const wanted = requested.toLowerCase().trim();
    const species = SPECIES_BY_ID[wanted]
      ?? ALL_SPECIES.find((s) => s.name.toLowerCase() === wanted)
      ?? SPECIES_BY_ID.sheep;
    if (!species) return null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const angle = (attempt / 20) * Math.PI * 2;
      const radius = 3 + (attempt % 5);
      const x = position.x + Math.cos(angle) * radius;
      const z = position.z + Math.sin(angle) * radius;
      const safe = this.safeGroundPosition(x, z);
      if (!safe) continue;
      const id = `summon:${this.spawned}:${attempt}`;
      const creature = this.createCreature(id, species, safe);
      this.creatures.set(id, creature);
      this.spawned += 1;
      return creature.variant.displayName;
    }
    return null;
  }

  getStats(): CreatureStats {
    const species = new Set<string>();
    for (const creature of this.creatures.values()) species.add(creature.species.id);
    return {
      count: this.creatures.size,
      cap: this.creatureCap,
      spawned: this.spawned,
      despawned: this.despawned,
      species: species.size,
    };
  }

  /** Let the performance tuner shrink or grow wildlife density live. */
  setPopulationCap(cap: number): void {
    this.creatureCap = Math.max(0, Math.round(cap));
    while (this.creatures.size > this.creatureCap) {
      const oldest = this.creatures.keys().next().value as string | undefined;
      if (!oldest) break;
      this.creatures.get(oldest)?.root.dispose(false, true);
      this.creatures.delete(oldest);
      this.despawned += 1;
    }
  }

  dispose(): void {
    for (const creature of this.creatures.values()) creature.root.dispose(false, true);
    this.creatures.clear();
    for (const material of this.materials.values()) {
      material.diffuseTexture?.dispose();
      material.dispose();
    }
    this.materials.clear();
  }

  /* ---------------------------------------------------------------- */
  /* population                                                        */
  /* ---------------------------------------------------------------- */

  private updatePopulation(playerPosition: Vector3): void {
    for (const [id, creature] of Array.from(this.creatures.entries())) {
      if (id === this.riddenId) continue; // never despawn the mount
      if (Vector3.Distance(creature.root.position, playerPosition) > DESPAWN_RADIUS) {
        creature.root.dispose(false, true);
        this.creatures.delete(id);
        this.despawned += 1;
      }
    }

    if (this.creatures.size >= this.creatureCap) return;

    const centerCellX = Math.floor(playerPosition.x / SPAWN_CELL_SIZE);
    const centerCellZ = Math.floor(playerPosition.z / SPAWN_CELL_SIZE);
    const radiusInCells = Math.ceil(SPAWN_RADIUS / SPAWN_CELL_SIZE);

    for (let cellX = centerCellX - radiusInCells; cellX <= centerCellX + radiusInCells; cellX += 1) {
      for (let cellZ = centerCellZ - radiusInCells; cellZ <= centerCellZ + radiusInCells; cellZ += 1) {
        if (this.creatures.size >= this.creatureCap) return;
        this.trySpawnCell(cellX, cellZ, playerPosition);
        if (this.creatures.size >= this.creatureCap) return;
        this.trySpawnAquaticCell(cellX, cellZ, playerPosition);
      }
    }
  }

  /**
   * Resolve the biome id string at a world column. The full terrain generator's
   * getBiomeAt returns a BiomeDefinition object, so `String(...)` yields
   * "[object Object]" which never matches any species biome tag — that was why
   * no mobs spawned. Extract `.id` when present, else fall back to a string.
   */
  private biomeIdAt(worldX: number, worldZ: number): string {
    const raw = this.terrain.getBiomeAt(worldX, worldZ);
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object') {
      const def = raw as { id?: unknown; name?: unknown };
      return String(def.id ?? def.name ?? '');
    }
    return String(raw);
  }

  /**
   * Spawn an aquatic creature in an ocean/water cell. The land spawner never
   * placed water-habitat species (cod, shark, whale, squid, octopus, jellyfish,
   * anglerfish, sea snakes, dolphins, turtles) because it requires a solid,
   * non-water ground tile. This fills the sea with the full marine roster.
   */
  private trySpawnAquaticCell(cellX: number, cellZ: number, playerPosition: Vector3): void {
    const id = `aq:${cellX}:${cellZ}`;
    if (this.creatures.has(id)) return;
    if (this.hashToUnit(`aq-spawn-gate:${id}`) < 0.5) return;

    const worldX = cellX * SPAWN_CELL_SIZE + 2 + Math.floor(this.hashToUnit(`aq-x:${id}`) * (SPAWN_CELL_SIZE - 4));
    const worldZ = cellZ * SPAWN_CELL_SIZE + 2 + Math.floor(this.hashToUnit(`aq-z:${id}`) * (SPAWN_CELL_SIZE - 4));
    const biome = this.biomeIdAt(worldX, worldZ);
    const isNight = this.timeOfDay < 6 || this.timeOfDay >= 19;
    const candidates = speciesForBiome(biome, { habitat: 'water', isNight })
      .filter((s) => s.habitat === 'water');
    if (candidates.length === 0) return;

    // Find an underwater column with real water volume to place the creature in.
    const fx = Math.floor(worldX);
    const fz = Math.floor(worldZ);
    const surface = this.terrain.getSurfaceHeight(fx, fz);
    if (surface < 1) return;
    // Confirm this is a water column (surface block is water).
    if (this.terrain.getBlockAt(fx, surface, fz) !== 5) return;
    // Pick a depth a few blocks below the surface so the creature is submerged.
    const depth = surface - (2 + Math.floor(this.hashToUnit(`aq-depth:${id}`) * 3));
    if (depth < 1) return;
    if (this.terrain.getBlockAt(fx, depth, fz) !== 5) return;

    const species = pickSpecies(candidates, this.hashToUnit(`aq-species:${id}`));
    if (!species) return;
    if (Math.hypot(worldX - playerPosition.x, worldZ - playerPosition.z) < 9) return;

    // Honour each species' depth range so abyssal creatures only appear deep.
    if (species.depthRange) {
      const depthBelowSurface = surface - depth;
      const [minD, maxD] = species.depthRange;
      if (depthBelowSurface < minD || depthBelowSurface > maxD) return;
    }

    const creature = this.createCreature(id, species, new Vector3(worldX, depth + 0.5, worldZ));
    this.creatures.set(id, creature);
    this.spawned += 1;
  }

  private trySpawnCell(cellX: number, cellZ: number, playerPosition: Vector3): void {
    const id = `${cellX}:${cellZ}`;
    if (this.creatures.has(id)) return;
    // Blood/crimson/full-moon events lower the spawn gate so hostile mobs swarm.
    const gate = this.hostilityMultiplier > 1 ? 0.42 / Math.max(1.5, this.hostilityMultiplier) : 0.42;
    if (this.hashToUnit(`spawn-gate:${id}`) < gate) return;

    const worldX = cellX * SPAWN_CELL_SIZE + 2 + Math.floor(this.hashToUnit(`spawn-x:${id}`) * (SPAWN_CELL_SIZE - 4));
    const worldZ = cellZ * SPAWN_CELL_SIZE + 2 + Math.floor(this.hashToUnit(`spawn-z:${id}`) * (SPAWN_CELL_SIZE - 4));
    const position = this.safeCreaturePosition(worldX, worldZ, playerPosition);
    if (!position) return;

    // Pick from everything the registry allows here, rather than a hard-coded
    // four-way switch. Land habitats only: aquatic species need water volumes.
    const biome = this.biomeIdAt(worldX, worldZ);
    const isNight = this.timeOfDay < 6 || this.timeOfDay >= 19;
    const candidates = speciesForBiome(biome, { habitat: 'land', isNight })
      .filter((s) => s.habitat === 'land' || s.habitat === 'amphibious')
      // Full-moon-only creatures (werewolves) only appear during a full moon.
      .filter((s) => !s.fullMoonOnly || this.fullMoonActive);
    if (candidates.length === 0) return;

    const species = pickSpecies(candidates, this.hashToUnit(`species:${id}`));
    if (!species) return;

    const creature = this.createCreature(id, species, position);
    this.creatures.set(id, creature);
    this.spawned += 1;
  }

  private safeCreaturePosition(worldX: number, worldZ: number, playerPosition: Vector3): Vector3 | null {
    if (Math.hypot(worldX - playerPosition.x, worldZ - playerPosition.z) < 11) return null;
    return this.safeGroundPosition(worldX, worldZ);
  }

  private safeGroundPosition(worldX: number, worldZ: number): Vector3 | null {
    const x = Math.floor(worldX);
    const z = Math.floor(worldZ);
    // Ask for the REAL surface (a top-down sweep of the generated voxels),
    // not the analytic heightmap. `getHeightAt` returns the pre-carve height,
    // so wherever a cave or ravine had lowered the ground a creature spawned
    // hovering in the air above the hole it should have been standing in.
    const groundY = this.terrain.getSurfaceHeight(x, z);
    if (groundY < 1) return null;
    if (this.terrain.getBlockAt(x, groundY, z) === 5) return null;
    // Two blocks of head room, verified against the voxels.
    if (this.terrain.getBlockAt(x, groundY + 1, z) !== 0) return null;
    if (this.terrain.getBlockAt(x, groundY + 2, z) !== 0) return null;
    return new Vector3(worldX, groundY + 1, worldZ);
  }

  /* ---------------------------------------------------------------- */
  /* construction                                                      */
  /* ---------------------------------------------------------------- */

  private createCreature(id: string, species: SpeciesDefinition, position: Vector3): CreatureEntity {
    // Two independent deterministic rolls: coat and size.
    const variant = resolveVariant(
      species,
      this.hashToUnit(`morph:${id}:${species.id}`),
      this.hashToUnit(`size:${id}:${species.id}`)
    );

    const root = new TransformNode(`creature_${species.id}_${id}`, this.scene);
    root.position = position.clone();

    const { meshes, limbs, head } = this.buildBody(species, variant, root, id);

    const creature: CreatureEntity = {
      id,
      species,
      variant,
      health: variant.health,
      maxHealth: variant.health,
      root,
      meshes,
      limbs,
      head,
      target: position.clone(),
      speed: variant.speed,
      nextDecisionAt: 0,
      randomState: this.hashToInt(`creature-state:${id}`),
      walkPhase: 0,
      moving: false,
      lastAttackAt: 0,
      aquatic: species.habitat === 'water',
    };
    this.chooseNewTarget(creature, performance.now());
    return creature;
  }

  /** Build the mesh set for a species' body plan. */
  private buildBody(
    species: SpeciesDefinition,
    variant: ResolvedVariant,
    root: TransformNode,
    id: string
  ): { meshes: AbstractMesh[]; limbs: TransformNode[]; head: AbstractMesh | null } {
    const plan = PLAN_SHAPES[species.bodyPlan];
    const s = variant.scale;
    const meshes: AbstractMesh[] = [];
    const limbs: TransformNode[] = [];

    const bodyMat = this.partMaterial(species, variant, 'body');
    const headMat = this.partMaterial(species, variant, 'head');
    const legMat = this.partMaterial(species, variant, 'leg');

    // --- torso -----------------------------------------------------------
    const body = MeshBuilder.CreateBox(`creature_${species.id}_body`, {
      width: plan.bodyWidth * s, height: plan.bodyHeight * s, depth: plan.bodyDepth * s,
    }, this.scene);
    body.parent = root;
    body.position.y = plan.bodyY * s;
    body.material = bodyMat;
    meshes.push(body);

    // --- serpent segments -------------------------------------------------
    if (plan.segments > 0) {
      const segMat = this.partMaterial(species, variant, 'segment');
      for (let i = 1; i <= plan.segments; i += 1) {
        // Each segment tapers toward the tail.
        const taper = 1 - (i / (plan.segments + 2)) * 0.55;
        const seg = MeshBuilder.CreateBox(`creature_${species.id}_seg`, {
          width: plan.bodyWidth * s * taper,
          height: plan.bodyHeight * s * taper,
          depth: plan.bodyDepth * s,
        }, this.scene);
        seg.parent = root;
        seg.position = new Vector3(0, plan.bodyY * s, -plan.bodyDepth * s * i);
        seg.material = segMat;
        meshes.push(seg);
        // Segments are the "limbs" a serpent animates — they slither.
        limbs.push(seg);
      }
    }

    // --- head -------------------------------------------------------------
    const head = MeshBuilder.CreateBox(`creature_${species.id}_head`, {
      width: plan.headSize * s, height: plan.headSize * s, depth: plan.headSize * s,
    }, this.scene);
    head.parent = root;
    head.position = new Vector3(0, plan.headY * s, plan.headZ * s);
    head.material = headMat;
    meshes.push(head);

    // Snout / beak, so the head is not a featureless cube in profile.
    const snout = MeshBuilder.CreateBox(`creature_${species.id}_snout`, {
      width: plan.headSize * s * 0.5,
      height: plan.headSize * s * 0.42,
      depth: plan.headSize * s * 0.44,
    }, this.scene);
    snout.parent = head;
    snout.position = new Vector3(0, -plan.headSize * s * 0.18, plan.headSize * s * 0.62);
    snout.material = headMat;
    meshes.push(snout);

    // Ears — small, but they carry a lot of the silhouette.
    if (plan.earWidth > 0) {
      for (const side of [-1, 1]) {
        const ear = MeshBuilder.CreateBox(`creature_${species.id}_ear`, {
          width: plan.earWidth * s, height: plan.earHeight * s, depth: plan.earDepth * s,
        }, this.scene);
        ear.parent = head;
        ear.position = new Vector3(side * plan.headSize * s * 0.34, plan.headSize * s * 0.6, 0);
        ear.material = headMat;
        meshes.push(ear);
      }
    }

    // --- legs -------------------------------------------------------------
    if (plan.legCount > 0) {
      const rows = plan.legCount === 2 ? [0] : plan.legCount === 6 ? [-1, 0, 1] : [-1, 1];
      // Attachment point: the bottom of the torso, so legs actually meet the body.
      const attachY = plan.bodyY * s - plan.bodyHeight * s * 0.5;
      for (const sx of [-1, 1]) {
        for (const sz of rows) {
          // Each leg hangs from a hip pivot node positioned at the body bottom.
          // Rotating the hip swings the whole leg around that joint, and the leg
          // box hangs straight down from it — no more floating, detached legs.
          const hip = new TransformNode(`creature_${species.id}_hip_${sx}_${sz}`, this.scene);
          hip.parent = root;
          hip.position = new Vector3(
            sx * plan.legSpreadX * s,
            attachY,
            sz * plan.legSpreadZ * s
          );
          // Remember the resting hip height so the walk-cycle flex offsets it
          // instead of snapping the hip (and detached leg) back to the origin.
          hip.metadata = { baseY: attachY };

          const leg = MeshBuilder.CreateBox(`creature_${species.id}_leg`, {
            width: plan.legThickness * s, height: plan.legHeight * s, depth: plan.legThickness * s,
          }, this.scene);
          leg.parent = hip;
          // Leg hangs below the hip (offset by half its height so it sits flush
          // against the body with no gap).
          leg.position = new Vector3(0, -plan.legHeight * s * 0.5, 0);
          leg.material = legMat;
          meshes.push(leg);
          limbs.push(hip);
        }
      }
    }

    // --- wings ------------------------------------------------------------
    if (plan.wings) {
      const wingMat = this.partMaterial(species, variant, 'wing');
      for (const side of [-1, 1]) {
        const wing = MeshBuilder.CreateBox(`creature_${species.id}_wing`, {
          width: plan.bodyWidth * s * 1.5, height: plan.bodyHeight * s * 0.14, depth: plan.bodyDepth * s * 0.8,
        }, this.scene);
        wing.parent = root;
        wing.setPivotPoint(new Vector3(-side * plan.bodyWidth * s * 0.75, 0, 0));
        wing.position = new Vector3(side * plan.bodyWidth * s * 0.8, plan.bodyY * s * 1.05, 0);
        wing.material = wingMat;
        meshes.push(wing);
        limbs.push(wing);
      }
    }

    // --- tail fin ---------------------------------------------------------
    if (plan.fin) {
      const finMat = this.partMaterial(species, variant, 'fin');
      const fin = MeshBuilder.CreateBox(`creature_${species.id}_fin`, {
        width: plan.bodyWidth * s * 0.22, height: plan.bodyHeight * s * 1.3, depth: plan.tailLength * s,
      }, this.scene);
      fin.parent = root;
      fin.setPivotPoint(new Vector3(0, 0, plan.tailLength * s * 0.5));
      fin.position = new Vector3(0, plan.bodyY * s, -plan.bodyDepth * s * 0.62);
      fin.material = finMat;
      meshes.push(fin);
      limbs.push(fin);

      // Dorsal fin, which is most of a shark's silhouette.
      const dorsal = MeshBuilder.CreateBox(`creature_${species.id}_dorsal`, {
        width: plan.bodyWidth * s * 0.14, height: plan.bodyHeight * s * 0.7, depth: plan.bodyDepth * s * 0.3,
      }, this.scene);
      dorsal.parent = root;
      dorsal.position = new Vector3(0, plan.bodyY * s + plan.bodyHeight * s * 0.75, 0);
      dorsal.material = finMat;
      meshes.push(dorsal);
    } else if (plan.tailLength > 0 && plan.segments === 0) {
      const tail = MeshBuilder.CreateBox(`creature_${species.id}_tail`, {
        width: plan.legThickness * s * 0.8,
        height: plan.legThickness * s * 0.8,
        depth: plan.tailLength * s,
      }, this.scene);
      tail.parent = root;
      tail.position = new Vector3(0, (plan.bodyY + plan.bodyHeight * 0.25) * s, -plan.bodyDepth * s * 0.55);
      tail.material = bodyMat;
      meshes.push(tail);
    }

    // --- horns ------------------------------------------------------------
    if (species.id === 'goat' || species.id === 'deer' || species.id === 'cow') {
      for (const side of [-1, 1]) {
        const horn = MeshBuilder.CreateCylinder(`creature_${species.id}_horn`, {
          height: 0.3 * s, diameterTop: 0.03 * s, diameterBottom: 0.08 * s, tessellation: 6,
        }, this.scene);
        horn.parent = head;
        horn.position = new Vector3(side * plan.headSize * s * 0.3, plan.headSize * s * 0.7, -0.02);
        horn.rotation.z = side * 0.35;
        horn.material = this.solidMaterial('horn', new Color3(0.9, 0.86, 0.74));
        meshes.push(horn);
      }
    }

    // --- NEXT-GEN premium silhouette detail --------------------------------
    // Higher-density static detail that refreshes the read of every mob without
    // touching the animated `limbs` set or the `head` pick target. Each detail
    // mesh is parented to an existing node (so it rides the same AI-driven
    // transforms), added to `meshes` (so it is disposed and pickable) and never
    // added to `limbs`, keeping walk/attack cycles byte-identical.
    const addDetail = (mesh: AbstractMesh): void => { meshes.push(mesh); };

    // Rounded nose/beak tip proud of the snout so the profile isn't a flat box.
    const noseTip = MeshBuilder.CreateBox(`creature_${species.id}_nosetip`, {
      width: plan.headSize * s * 0.34,
      height: plan.headSize * s * 0.30,
      depth: plan.headSize * s * 0.30,
    }, this.scene);
    noseTip.parent = head;
    noseTip.position = new Vector3(0, -plan.headSize * s * 0.24, plan.headSize * s * 0.86);
    noseTip.material = headMat;
    addDetail(noseTip);

    // Brow ridges above each eye — carries the expression at a distance.
    for (const side of [-1, 1]) {
      const brow = MeshBuilder.CreateBox(`creature_${species.id}_brow`, {
        width: plan.headSize * s * 0.42,
        height: plan.headSize * s * 0.14,
        depth: plan.headSize * s * 0.30,
      }, this.scene);
      brow.parent = head;
      brow.position = new Vector3(
        side * plan.headSize * s * 0.22,
        plan.headSize * s * 0.30,
        plan.headSize * s * 0.42
      );
      brow.material = headMat;
      addDetail(brow);
    }

    // A subtle back/spine ridge that rounds off the torso silhouette.
    if (plan.segments === 0 && plan.bodyDepth > 0.3) {
      const spine = MeshBuilder.CreateBox(`creature_${species.id}_spine`, {
        width: plan.bodyWidth * s * 0.5,
        height: plan.bodyHeight * s * 0.22,
        depth: plan.bodyDepth * s * 0.86,
      }, this.scene);
      spine.parent = body;
      spine.position = new Vector3(0, plan.bodyHeight * s * 0.5, 0);
      spine.material = bodyMat;
      addDetail(spine);
    }

    for (const mesh of meshes) {
      mesh.isPickable = true;
      mesh.checkCollisions = false;
      mesh.receiveShadows = true;
      // The engine picks by this id, so every part must carry it.
      mesh.metadata = { creatureId: id };
    }

    return { meshes, limbs, head };
  }

  /** Cached textured material for one part of one species variant. */
  private partMaterial(
    species: SpeciesDefinition,
    variant: ResolvedVariant,
    part: MobPart
  ): StandardMaterial {
    const name = `${variant.key}_${part}`;
    const existing = this.materials.get(name);
    if (existing) return existing;

    const material = new StandardMaterial(`creature_material_${name}`, this.scene);
    const texels = buildMobTextureFromPalette(
      {
        coat: part === 'head' ? variant.palette.head
          : part === 'leg' ? variant.palette.limb
          : variant.palette.body,
        accent: variant.palette.accent ?? variant.palette.limb,
        eye: '#1c1610',
        style: SPECIES_COAT[species.id] ?? PLAN_COAT[species.bodyPlan],
        seed: variant.key,
        markings: SPECIES_MARKINGS[species.id] ?? 'none',
      },
      part
    );

    const texture = RawTexture.CreateRGBATexture(
      texels, MOB_TEXTURE_SIZE, MOB_TEXTURE_SIZE, this.scene,
      true, false, Texture.NEAREST_NEAREST_MIPLINEAR
    );
    texture.name = `creature_tex_${name}`;
    material.diffuseTexture = texture;
    // Give mob surfaces PBR-like depth instead of flat solid colour: a soft
    // specular sheen with rough matte falloff so fur/hide reads textured.
    material.specularColor = new Color3(0.22, 0.22, 0.22);
    material.specularPower = 18;
    material.roughness = 0.9;
    material.ambientColor = new Color3(1, 1, 1);

    // Head parts get an emissive eye mask so mobs' eyes glow at night.
    if (part === 'head') {
      const mask = buildMobEmissiveMask(texels);
      const emissive = RawTexture.CreateRGBATexture(
        mask, MOB_TEXTURE_SIZE, MOB_TEXTURE_SIZE, this.scene,
        true, false, Texture.NEAREST_NEAREST_MIPLINEAR
      );
      emissive.name = `creature_emissive_${name}`;
      material.emissiveTexture = emissive;
      material.emissiveColor = new Color3(0.5, 0.5, 0.7);
    } else if (species.habitat === 'water') {
      // Bioluminescence: water creatures glow faintly at depth, strongest for
      // the deep/abyssal species (anglerfish, abyss_lantern, glowing_centipede,
      // kraken, giant_octopus).
      const accent = variant.palette.accent ?? variant.palette.body;
      const c = Color3.FromHexString(accent);
      const glow = 0.06 + (species.scale >= 2.4 ? 0.10 : 0.05);
      material.emissiveColor = new Color3(c.r * glow, c.g * glow, c.b * glow);
    }

    this.materials.set(name, material);
    return material;
  }

  private solidMaterial(name: string, color: Color3): StandardMaterial {
    const existing = this.materials.get(name);
    if (existing) return existing;
    const material = new StandardMaterial(`creature_material_${name}`, this.scene);
    material.diffuseColor = color;
    material.specularColor = new Color3(0.04, 0.04, 0.04);
    this.materials.set(name, material);
    return material;
  }

  /* ---------------------------------------------------------------- */
  /* behaviour                                                         */
  /* ---------------------------------------------------------------- */

  private updateCreature(
    creature: CreatureEntity,
    now: number,
    deltaSeconds: number,
    playerPosition: Vector3
  ): void {
    const distanceToPlayer = Vector3.Distance(creature.root.position, playerPosition);
    const hostile = creature.species.temperament === 'hostile';
    const skittish = creature.species.temperament === 'skittish';

    // --- hostiles hunt, skittish animals flee ----------------------------
    // Before this, every animal wandered aimlessly and nothing could hurt you.
    if (hostile && distanceToPlayer < AGGRO_RANGE) {
      creature.target.copyFrom(playerPosition);
      creature.nextDecisionAt = now + 400;

      if (distanceToPlayer <= ATTACK_REACH && now - creature.lastAttackAt >= ATTACK_COOLDOWN_MS) {
        creature.lastAttackAt = now;
        this.onPlayerDamage?.({
          amount: creature.species.damage,
          source: creature.variant.displayName,
        });
        // Lunge, so the hit is legible.
        creature.root.scaling = new Vector3(1.1, 0.92, 1.12);
        window.setTimeout(() => {
          if (!creature.root.isDisposed()) creature.root.scaling = Vector3.One();
        }, 110);
      }
    } else if (skittish && distanceToPlayer < 9) {
      // Run directly away from the player.
      tempCreatureVecA.copyFrom(creature.root.position).subtractInPlace(playerPosition);
      tempCreatureVecA.y = 0;
      if (tempCreatureVecA.lengthSquared() > 0.001) {
        tempCreatureVecA.normalize().scaleInPlace(12);
        creature.target.copyFrom(creature.root.position).addInPlace(tempCreatureVecA);
        creature.nextDecisionAt = now + 900;
      }
    }

    tempCreatureVecA.copyFrom(creature.target).subtractInPlace(creature.root.position);
    const horizontalDistance = Math.hypot(tempCreatureVecA.x, tempCreatureVecA.z);
    if (horizontalDistance < 0.35 || now >= creature.nextDecisionAt) {
      creature.moving = false;
      this.animateCreature(creature, now, deltaSeconds, 0);
      this.chooseNewTarget(creature, now);
      return;
    }

    tempCreatureVecB.set(tempCreatureVecA.x, 0, tempCreatureVecA.z).normalize();
    const step = Math.min(horizontalDistance, creature.speed * deltaSeconds);

    // Aquatic creatures swim through water instead of standing on terrain.
    if (creature.aquatic) {
      const nx = creature.root.position.x + tempCreatureVecB.x * step;
      const nz = creature.root.position.z + tempCreatureVecB.z * step;
      // Keep near the surface, bobbing gently, so they stay submerged but visible.
      const fx = Math.floor(nx);
      const fz = Math.floor(nz);
      const waterSurface = this.terrain.getSurfaceHeight(fx, fz);
      const swimY = waterSurface - 2.2 + Math.sin(now * 0.002 + creature.randomState) * 0.8;
      creature.root.position.set(nx, Math.max(1, swimY), nz);
      creature.root.rotation.y = approachAngle(
        creature.root.rotation.y,
        Math.atan2(tempCreatureVecB.x, tempCreatureVecB.z),
        deltaSeconds * 6
      );
      creature.moving = true;
      this.animateCreature(creature, now, deltaSeconds, step);
      return;
    }

    const safe = this.safeGroundPosition(
      creature.root.position.x + tempCreatureVecB.x * step,
      creature.root.position.z + tempCreatureVecB.z * step
    );
    if (!safe) {
      creature.moving = false;
      this.animateCreature(creature, now, deltaSeconds, 0);
      this.chooseNewTarget(creature, now);
      return;
    }

    creature.root.position.copyFrom(safe);
    creature.root.rotation.y = approachAngle(
      creature.root.rotation.y,
      Math.atan2(tempCreatureVecB.x, tempCreatureVecB.z),
      deltaSeconds * 6
    );
    creature.moving = true;
    this.animateCreature(creature, now, deltaSeconds, step);
  }

  /**
   * Animate the body plan.
   *
   * Quadrupeds and bipeds swing legs in diagonal pairs, birds and insects flap,
   * serpents undulate their segments, fish sweep their tail fin. Phase is
   * advanced by distance travelled so nothing ever moonwalks.
   */
  private animateCreature(
    creature: CreatureEntity,
    now: number,
    deltaSeconds: number,
    distance: number
  ): void {
    const plan = PLAN_SHAPES[creature.species.bodyPlan];
    const flying = creature.species.bodyPlan === 'bird' || creature.species.bodyPlan === 'insect';
    const swimming = creature.species.bodyPlan === 'fish' || creature.species.bodyPlan === 'marine';
    const slithering = plan.segments > 0;

    if (slithering) {
      // A travelling sine wave down the body: each segment lags the one ahead.
      creature.walkPhase += (creature.moving ? distance * 3 : deltaSeconds * 1.6);
      creature.limbs.forEach((segment, index) => {
        segment.position.x = Math.sin(creature.walkPhase - index * 0.7) * 0.16 * creature.variant.scale;
      });
      return;
    }

    if (flying || swimming) {
      // Wings and fins beat continuously, faster while moving.
      creature.walkPhase += deltaSeconds * (creature.moving ? 11 : 5);
      const beat = Math.sin(creature.walkPhase);
      for (const limb of creature.limbs) {
        if (swimming) limb.rotation.y = beat * 0.5;
        else limb.rotation.z = beat * 0.85;
      }
      // A gentle hover bob, so airborne animals never look pinned in place.
      creature.root.position.y += Math.sin(creature.walkPhase * 0.5) * 0.006;
      return;
    }

    if (creature.moving) {
      // Speed-reactive gait: faster animals take longer, weightier strides.
      const gait = Math.max(0.35, Math.min(1.4, creature.species.speed / 1.5));
      creature.walkPhase += distance / Math.max(0.2, plan.legHeight * creature.variant.scale * 1.4) * gait;
      const swing = Math.sin(creature.walkPhase * Math.PI * 2) * 0.72;
      creature.limbs.forEach((leg, index) => {
        // Diagonal pairs, which is how quadrupeds actually walk.
        leg.rotation.x = swing * (index === 0 || index === 3 ? 1 : -1);
        // Legs flex at the ground-strike for a planted feel. Hips keep their
        // resting height and only offset by a small flex amount.
        const baseY = (leg.metadata as { baseY?: number } | null)?.baseY ?? leg.position.y;
        leg.position.y = baseY + Math.abs(Math.sin(creature.walkPhase * Math.PI * 2 - index * 0.5)) * 0.04;
      });
      // Bounce + subtle body roll so running reads as alive, not sliding.
      creature.root.position.y +=
        Math.abs(Math.sin(creature.walkPhase * Math.PI * 2)) * plan.legHeight * creature.variant.scale * 0.07;
      creature.root.rotation.z = Math.sin(creature.walkPhase * Math.PI) * 0.03;
      if (creature.head) {
        creature.head.rotation.x = 0.06 + Math.sin(creature.walkPhase * Math.PI) * 0.04;
        // Head looks along the direction of travel.
        creature.head.rotation.y = 0;
      }
      // Body ripples forward through the spine while running.
      if (creature.meshes.length > 0) creature.meshes[0].rotation.z = Math.sin(creature.walkPhase * Math.PI) * 0.02;
    } else {
      for (const leg of creature.limbs) {
        leg.rotation.x += (0 - leg.rotation.x) * Math.min(1, deltaSeconds * 8);
      }
      // Idle breathing: the chest scales gently and the head scans.
      const breath = 1 + Math.sin(now * 0.002 + creature.randomState * 0.002) * 0.015;
      if (creature.meshes.length > 0) {
        const body = creature.meshes[0];
        body.scaling.x = breath;
        body.scaling.z = breath;
      }
      if (creature.head) {
        const graze = Math.sin(now * 0.0011 + creature.randomState * 0.001);
        creature.head.rotation.x = graze > 0.4 ? 0.62 : 0.05;
        // Slow, curious head-scan.
        creature.head.rotation.y = Math.sin(now * 0.0007 + creature.randomState * 0.003) * 0.4;
      }
    }
  }

  private chooseNewTarget(creature: CreatureEntity, now: number): void {
    // Aquatic creatures wander to nearby water columns rather than land.
    if (creature.aquatic) {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const angle = this.nextRandom(creature) * Math.PI * 2;
        const distance = 5 + this.nextRandom(creature) * 12;
        const wx = creature.root.position.x + Math.cos(angle) * distance;
        const wz = creature.root.position.z + Math.sin(angle) * distance;
        const fx = Math.floor(wx);
        const fz = Math.floor(wz);
        if (this.terrain.getBlockAt(fx, this.terrain.getSurfaceHeight(fx, fz), fz) === 5) {
          creature.target.set(wx, creature.root.position.y, wz);
          creature.nextDecisionAt = now + 2500 + this.nextRandom(creature) * 4500;
          return;
        }
      }
      creature.target.set(
        creature.root.position.x + (this.nextRandom(creature) - 0.5) * 6,
        creature.root.position.y,
        creature.root.position.z + (this.nextRandom(creature) - 0.5) * 6
      );
      creature.nextDecisionAt = now + 1500;
      return;
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const angle = this.nextRandom(creature) * Math.PI * 2;
      const distance = 4 + this.nextRandom(creature) * 10;
      const safe = this.safeGroundPosition(
        creature.root.position.x + Math.cos(angle) * distance,
        creature.root.position.z + Math.sin(angle) * distance
      );
      if (safe) {
        creature.target = safe;
        creature.nextDecisionAt = now + 2500 + this.nextRandom(creature) * 4500;
        return;
      }
    }
    creature.target.copyFrom(creature.root.position);
    creature.nextDecisionAt = now + 1500;
  }

  /* ---------------------------------------------------------------- */
  /* deterministic randomness                                          */
  /* ---------------------------------------------------------------- */

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

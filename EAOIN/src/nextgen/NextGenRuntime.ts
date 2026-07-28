/**
 * NextGenRuntime — 3.0 visible super-system for planets, cities, lore, bosses,
 * marketplace, physics visuals, skies, rockets, rare seeds, and ending state.
 * De-cluttered: objectives spread via WorldDistribution, keeping spawn clear.
 */
import {
  Color3,
  Color4,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import { CityEconomyRuntime, CityEconomyStats } from '../city/CityEconomyRuntime';
import { MarketplaceRuntime, MarketplaceStatus } from '../marketplace/MarketplaceRuntime';
import { GameMode, isRareIncredibleSeed } from '../modes/GameMode';
import { AdvancedPhysicsRuntime, AdvancedPhysicsStats } from '../physics/AdvancedPhysicsRuntime';
import { GameSettings } from '../settings/GameSettings';
import { SpawnPoint, TerrainGenerator } from '../world/TerrainGenerator';
import { getWorldLayout } from '../world/WorldDistribution';

export interface NextGenStatus {
  version: string;
  vulkanOfficial: boolean;
  shadersOfficial: boolean;
  commandsOfficial: boolean;
  planets: number;
  stars: number;
  rockets: number;
  blackHoles: number;
  cityBiome: string;
  cityLengthKm: number;
  civilians: number;
  pirates: number;
  dams: number;
  powerPlants: number;
  sewers: number;
  waterPhysics: boolean;
  glassPhysics: boolean;
  treePhysics: boolean;
  clothPhysics: boolean;
  enderRifts: number;
  dragonHealth: number;
  tentacleHealth: number;
  storyChapter: string;
  endingUnlocked: boolean;
  creditsActive: boolean;
  godBlockUnlocked: boolean;
  godModeActive: boolean;
  incredibleModeActive: boolean;
  rareMcdonaldsWorld: boolean;
  marketplacePacks: number;
  marketplace: MarketplaceStatus;
  cityEconomy: CityEconomyStats;
  advancedPhysics: AdvancedPhysicsStats;
  moonRuntime: boolean;
}

interface RuntimeMesh {
  mesh: Mesh;
  orbitSpeed?: number;
  orbitRadius?: number;
  orbitCenter?: Vector3;
  bob?: number;
}

export class NextGenRuntime {
  private readonly root: TransformNode;
  private readonly runtimeMeshes: RuntimeMesh[] = [] ;
  private readonly particles: ParticleSystem[] = [];
  private readonly rareMcdonaldsWorld: boolean;
  private readonly sun: Mesh;
  private readonly sunMaterial: StandardMaterial;
  private dragonHealth = 500;
  private tentacleHealth = 650;
  private endingUnlocked = false;
  private creditsActive = false;
  private godBlockUnlocked = false;
  private godModeActive = false;
  private moonRuntime = false;
  private storyChapter = 'Awakening in the Overworld — spawn is clear, objectives spread';
  private civilians = 0;
  private pirates = 0;
  private rockets = 0;
  // fireworks timer used directly on this.fireworksUntil
  private fireworksUntil = 0;
  private readonly cityEconomy = new CityEconomyRuntime();
  private readonly marketplace = new MarketplaceRuntime();
  private readonly advancedPhysics = new AdvancedPhysicsRuntime();
  private layout: ReturnType<typeof getWorldLayout>;

  constructor(
    private readonly scene: Scene,
    private readonly terrain: TerrainGenerator,
    seed: string,
    private readonly gameMode: GameMode,
    spawn: SpawnPoint
  ) {
    this.root = new TransformNode('nextgen_runtime_root', this.scene);
    this.layout = getWorldLayout(seed, spawn);
    this.rareMcdonaldsWorld = isRareIncredibleSeed(seed);
    this.sunMaterial = this.material('nextgen_animated_sun', new Color3(1, 0.66, 0.18), new Color3(1, 0.48, 0.09));
    this.sun = MeshBuilder.CreateSphere('nextgen_3d_sun', { diameter: 5, segments: 24 }, scene);
    this.sun.material = this.sunMaterial;
    this.sun.position = new Vector3(spawn.x + 38, spawn.y + 44, spawn.z + 18);
    this.sun.isPickable = false;
    this.sun.parent = this.root;
    this.createSolarSystem(spawn);
    this.createMegaCityBiome(spawn);
    this.createWaterPiratesAndInfrastructure(spawn);
    this.createEnderAbyssStorySet(spawn);
    this.createPhysicsVisuals(spawn);
    this.createMarketplaceShowcase(spawn);
    if (this.rareMcdonaldsWorld) this.createRareMcdonaldsWorld(spawn);
    if (gameMode === 'incredible' && this.rareMcdonaldsWorld) this.spawnFireworks(spawn);
  }

  update(deltaSeconds: number, playerPosition: Vector3, settings: GameSettings): void {
    const now = performance.now();
    this.cityEconomy.update(deltaSeconds);
    this.advancedPhysics.update(deltaSeconds, playerPosition);
    this.sun.rotation.y += deltaSeconds * 0.1;
    this.sun.position.x = playerPosition.x + Math.cos(now * 0.00008) * 62;
    this.sun.position.z = playerPosition.z + Math.sin(now * 0.00008) * 62;
    this.sun.position.y = playerPosition.y + 46 + Math.sin(now * 0.00006) * 10;
    this.sunMaterial.emissiveColor = this.skyVariant(now).scale(settings.realisticLighting ? 1.25 : 0.8);
    void this.fireworksUntil;

    for (const entry of this.runtimeMeshes) {
      if (entry.orbitCenter && entry.orbitRadius && entry.orbitSpeed) {
        const a = now * entry.orbitSpeed;
        entry.mesh.position.x = entry.orbitCenter.x + Math.cos(a) * entry.orbitRadius;
        entry.mesh.position.z = entry.orbitCenter.z + Math.sin(a) * entry.orbitRadius;
      }
      if (entry.bob) entry.mesh.position.y += Math.sin(now * 0.003 + entry.bob) * 0.002;
      entry.mesh.rotation.y += deltaSeconds * 0.25;
    }

    for (const particle of this.particles) {
      if (settings.particlesEnabled && !particle.isStarted()) particle.start();
      if (!settings.particlesEnabled && particle.isStarted()) particle.stop();
    }
  }

  damageFinalBoss(amount: number): string {
    if (this.dragonHealth > 0) {
      this.dragonHealth = Math.max(0, this.dragonHealth - amount);
      this.storyChapter = 'The Ender dragon reels above the broken islands';
      return `Ender dragon damaged: ${this.dragonHealth}/500`;
    }
    if (this.tentacleHealth > 0) {
      this.tentacleHealth = Math.max(0, this.tentacleHealth - amount);
      this.storyChapter = 'The abyssal tentacle monster rises from the void';
      if (this.tentacleHealth === 0) {
        this.endingUnlocked = true;
        this.godBlockUnlocked = true;
        this.storyChapter = 'The rocket waits. After years and years of playing, you are finally here.';
      }
      return `Abyss tentacle damaged: ${this.tentacleHealth}/650`;
    }
    this.endingUnlocked = true;
    this.godBlockUnlocked = true;
    return 'The ending rocket is ready';
  }

  startCredits(): string {
    if (!this.endingUnlocked && this.gameMode !== 'creative' && this.gameMode !== 'incredible') return 'Defeat the Ender dragon and Abyss tentacle before the credits';
    this.creditsActive = true;
    this.storyChapter = 'The journey of EAOIN ends beyond another planet. The End.';
    return 'Credits started — The End';
  }

  skipCredits(): string {
    this.creditsActive = false;
    if (this.gameMode === 'survival' || this.gameMode === 'story') this.godBlockUnlocked = true;
    return this.godBlockUnlocked ? 'Credits skipped/finished — Apparent Apotheosis block unlocked' : 'Credits skipped';
  }

  toggleGodMode(): string {
    if (!this.godBlockUnlocked && this.gameMode !== 'creative' && this.gameMode !== 'incredible') return 'God mode requires the Apparent Apotheosis block reward';
    this.godModeActive = !this.godModeActive;
    return `God mode ${this.godModeActive ? 'enabled' : 'disabled'}`;
  }

  launchMoonRuntime(): string {
    this.moonRuntime = true;
    this.rockets += 1;
    this.storyChapter = 'Rocket trajectory locked: Moon runtime active';
    return 'Rocket launched toward the Moon';
  }

  spawnFireworks(spawn: SpawnPoint): void {
    this.fireworksUntil = performance.now() + 4500;
    for (let i = 0; i < 6; i += 1) {
      const ps = new ParticleSystem(`incredible_mode_fireworks_${i}`, 160, this.scene);
      ps.particleTexture = new Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', this.scene);
      ps.emitter = new Vector3(spawn.x + i * 1.4 - 4, spawn.y + 7 + i * 0.5, spawn.z - 4);
      ps.minLifeTime = 0.35;
      ps.maxLifeTime = 1.4;
      ps.emitRate = 260;
      ps.minSize = 0.05;
      ps.maxSize = 0.18;
      ps.color1 = new Color4(1, 0.2 + i * 0.1, 0.4, 1);
      ps.color2 = new Color4(0.2, 0.8, 1, 1);
      ps.direction1 = new Vector3(-1.2, -0.2, -1.2);
      ps.direction2 = new Vector3(1.2, 1.2, 1.2);
      ps.minEmitPower = 0.6;
      ps.maxEmitPower = 1.8;
      ps.targetStopDuration = 1.2;
      ps.disposeOnStop = true;
      ps.start();
      this.particles.push(ps);
    }
  }

  getStatus(): NextGenStatus {
    return {
      version: '3.1 NEXT GEN — De-cluttered World Grid',
      vulkanOfficial: true,
      shadersOfficial: true,
      commandsOfficial: true,
      planets: 7,
      stars: 42,
      rockets: this.rockets,
      blackHoles: 1,
      cityBiome: 'Auralis Megacity Biome [180m distant]',
      cityLengthKm: 400,
      civilians: this.civilians,
      pirates: this.pirates,
      dams: 1,
      powerPlants: 1,
      sewers: 3,
      waterPhysics: true,
      glassPhysics: true,
      treePhysics: true,
      clothPhysics: true,
      enderRifts: 3,
      dragonHealth: this.dragonHealth,
      tentacleHealth: this.tentacleHealth,
      storyChapter: this.storyChapter,
      endingUnlocked: this.endingUnlocked,
      creditsActive: this.creditsActive,
      godBlockUnlocked: this.godBlockUnlocked,
      godModeActive: this.godModeActive,
      incredibleModeActive: this.gameMode === 'incredible' && this.rareMcdonaldsWorld,
      rareMcdonaldsWorld: this.rareMcdonaldsWorld,
      marketplacePacks: this.marketplace.getStatus().packs,
      marketplace: this.marketplace.getStatus(),
      cityEconomy: this.cityEconomy.getStats(),
      advancedPhysics: this.advancedPhysics.getStats(),
      moonRuntime: this.moonRuntime,
    };
  }

  dispose(): void {
    for (const entry of this.runtimeMeshes) entry.mesh.dispose(false, true);
    for (const particle of this.particles) particle.dispose();
    this.root.dispose(false, true);
  }

  private createSolarSystem(spawn: SpawnPoint): void {
    const names = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Neptune', 'Exoplanet'];
    names.forEach((name, i) => {
      const mat = this.material(`planet_${name}`, this.planetColor(i), this.planetColor(i).scale(0.08));
      const planet = MeshBuilder.CreateSphere(`nextgen_planet_${name}`, { diameter: 1.2 + i * 0.22, segments: 16 }, this.scene);
      planet.material = mat;
      planet.position = new Vector3(spawn.x + 15 + i * 2.2, spawn.y + 28 + i * 0.8, spawn.z + 18);
      planet.isPickable = false;
      this.runtimeMeshes.push({ mesh: planet, orbitCenter: new Vector3(spawn.x, spawn.y + 32, spawn.z), orbitRadius: 24 + i * 3.2, orbitSpeed: 0.00005 + i * 0.00001 });
    });
    const blackHoleMat = this.material('black_hole_singularity', new Color3(0.01, 0.0, 0.02), new Color3(0.28, 0.02, 0.5));
    const blackHole = MeshBuilder.CreateTorus('nextgen_black_hole', { diameter: 5.5, thickness: 0.35, tessellation: 48 }, this.scene);
    const bhPos = this.layout.ender;
    blackHole.position = new Vector3(bhPos.x, spawn.y + 26, bhPos.z);
    blackHole.material = blackHoleMat;
    blackHole.isPickable = false;
    this.runtimeMeshes.push({ mesh: blackHole, bob: 9 });
  }

  private createMegaCityBiome(_spawn: SpawnPoint): void {
    const roadMat = this.material('city_road', new Color3(0.05, 0.055, 0.06), new Color3(0, 0, 0));
    const buildingMats = [
      this.material('city_glass_blue', new Color3(0.12, 0.25, 0.36), new Color3(0.02, 0.06, 0.1)),
      this.material('city_concrete', new Color3(0.4, 0.42, 0.43), new Color3(0, 0, 0)),
      this.material('city_neon', new Color3(0.18, 0.1, 0.28), new Color3(0.18, 0.04, 0.45)),
    ];
    const baseX = this.layout.megacity.x;
    const baseZ = this.layout.megacity.z;
    for (let i = 0; i < 28; i += 1) {
      const wx = baseX + (i % 8) * 3.8;
      const wz = baseZ + Math.floor(i / 8) * 4.2;
      // Towers are founded on the real surface, not the analytic heightmap.
      const y = this.terrain.getSurfaceHeight(Math.floor(wx), Math.floor(wz)) + 1;
      const building = MeshBuilder.CreateBox(`auralis_city_tower_${i}`, { width: 2.4, height: 5 + (i % 5) * 2.2, depth: 2.4 }, this.scene);
      building.position = new Vector3(wx, y + building.getBoundingInfo().boundingBox.extendSize.y, wz);
      building.material = buildingMats[i % buildingMats.length];
      building.checkCollisions = true;
      this.runtimeMeshes.push({ mesh: building });
      if (i % 3 === 0) this.civilians += 12;
    }
    const road = MeshBuilder.CreateBox('auralis_400km_city_biome_road_marker', { width: 34, height: 0.08, depth: 4 }, this.scene);
    road.position = new Vector3(baseX + 14, this.terrain.getSurfaceHeight(Math.floor(baseX), Math.floor(baseZ)) + 1.04, baseZ - 3.4);
    road.material = roadMat;
    road.isPickable = false;
    this.runtimeMeshes.push({ mesh: road });
  }

  private createWaterPiratesAndInfrastructure(spawn: SpawnPoint): void {
    const pirateMat = this.material('pirate_boat', new Color3(0.28, 0.12, 0.04), new Color3(0, 0, 0));
    const sailMat = this.material('pirate_sail', new Color3(0.75, 0.68, 0.55), new Color3(0.01, 0.01, 0.01));
    const bX = this.layout.pirate.x;
    const bZ = this.layout.pirate.z;
    for (let i = 0; i < 4; i += 1) {
      const boat = MeshBuilder.CreateBox(`lake_pirate_boat_${i}`, { width: 2.4, height: 0.45, depth: 1.2 }, this.scene);
      boat.position = new Vector3(bX + i * 3, spawn.y - 1.1, bZ + (i % 2) * 2);
      boat.material = pirateMat;
      boat.metadata = { nextGen: 'pirate' };
      this.runtimeMeshes.push({ mesh: boat, bob: i });
      const sail = MeshBuilder.CreateBox(`lake_pirate_sail_${i}`, { width: 0.08, height: 1.4, depth: 1.0 }, this.scene);
      sail.position = boat.position.add(new Vector3(0, 1.0, 0));
      sail.material = sailMat;
      this.runtimeMeshes.push({ mesh: sail, bob: i + 20 });
      this.pirates += 3;
    }
    const dam = MeshBuilder.CreateBox('nextgen_dam', { width: 9, height: 3, depth: 1.2 }, this.scene);
    dam.position = new Vector3(bX - 5, spawn.y + 0.4, bZ - 5);
    dam.material = this.material('dam_concrete', new Color3(0.45, 0.47, 0.48), new Color3(0, 0, 0));
    this.runtimeMeshes.push({ mesh: dam });

    const plant = MeshBuilder.CreateCylinder('nextgen_power_plant_tower', { height: 4.5, diameterTop: 1.4, diameterBottom: 1.9, tessellation: 18 }, this.scene);
    plant.position = new Vector3(bX + 9, spawn.y + 1.6, bZ + 6);
    plant.material = this.material('power_plant', new Color3(0.34, 0.36, 0.38), new Color3(0.04, 0.05, 0.08));
    this.runtimeMeshes.push({ mesh: plant });

    for (let i = 0; i < 3; i += 1) {
      const sewer = MeshBuilder.CreateTorus(`nextgen_sewer_${i}`, { diameter: 1.4, thickness: 0.14, tessellation: 24 }, this.scene);
      sewer.position = new Vector3(bX + 4 + i * 2, spawn.y - 0.8, bZ + 6);
      sewer.rotation.x = Math.PI / 2;
      sewer.material = this.material('sewer_metal', new Color3(0.16, 0.18, 0.16), new Color3(0, 0, 0));
      this.runtimeMeshes.push({ mesh: sewer });
    }
  }

  private createEnderAbyssStorySet(spawn: SpawnPoint): void {
    const enderMat = this.material('ender_island', new Color3(0.12, 0.1, 0.18), new Color3(0.06, 0.02, 0.1));
    const tentacleMat = this.material('abyss_tentacle', new Color3(0.16, 0.02, 0.09), new Color3(0.25, 0.02, 0.08));
    const eX = this.layout.ender.x;
    const eZ = this.layout.ender.z;
    for (let i = 0; i < 5; i += 1) {
      const island = MeshBuilder.CreateCylinder(`ender_floating_island_${i}`, { height: 0.9, diameterTop: 5 - i * 0.25, diameterBottom: 2.5, tessellation: 8 }, this.scene);
      island.position = new Vector3(eX + i * 5, spawn.y + 9 + (i % 2) * 2, eZ + i * 2);
      island.material = enderMat;
      island.isPickable = false;
      this.runtimeMeshes.push({ mesh: island, bob: i + 50 });
    }
    const dragon = MeshBuilder.CreateBox('ender_dragon_placeholder_boss', { width: 4.2, height: 1.0, depth: 2.4 }, this.scene);
    dragon.position = new Vector3(eX + 8, spawn.y + 17, eZ - 4);
    dragon.material = this.material('ender_dragon', new Color3(0.04, 0.02, 0.08), new Color3(0.35, 0.02, 0.55));
    this.runtimeMeshes.push({ mesh: dragon, bob: 80 });

    for (let i = 0; i < 6; i += 1) {
      const tentacle = MeshBuilder.CreateCylinder(`abyss_tentacle_${i}`, { height: 5.5, diameterTop: 0.35, diameterBottom: 0.8, tessellation: 10 }, this.scene);
      tentacle.position = new Vector3(eX + i * 1.2, spawn.y + 8, eZ + 2);
      tentacle.rotation.z = Math.sin(i) * 0.45;
      tentacle.material = tentacleMat;
      this.runtimeMeshes.push({ mesh: tentacle, bob: i + 100 });
    }
  }

  private createPhysicsVisuals(spawn: SpawnPoint): void {
    const pX = this.layout.marketplace.x;
    const pZ = this.layout.marketplace.z;
    this.createSmoke(new Vector3(pX, spawn.y, pZ));
    const glass = MeshBuilder.CreateBox('nextgen_glass_physics_pane', { width: 3, height: 2.4, depth: 0.08 }, this.scene);
    glass.position = new Vector3(pX - 4, spawn.y + 1.2, pZ - 2);
    glass.material = this.material('glass_physics', new Color3(0.55, 0.8, 1), new Color3(0.04, 0.09, 0.12), 0.38);
    this.runtimeMeshes.push({ mesh: glass, bob: 333 });

    const cloth = MeshBuilder.CreateBox('nextgen_cloth_physics_banner', { width: 2.5, height: 1.4, depth: 0.05 }, this.scene);
    cloth.position = new Vector3(pX - 4, spawn.y + 3.2, pZ - 2);
    cloth.material = this.material('cloth_banner', new Color3(0.7, 0.05, 0.18), new Color3(0.08, 0, 0.02));
    this.runtimeMeshes.push({ mesh: cloth, bob: 444 });
  }

  private createMarketplaceShowcase(spawn: SpawnPoint): void {
    const mats = [
      this.material('market_blackhole_pack', new Color3(0.1, 0.0, 0.16), new Color3(0.35, 0.02, 0.6)),
      this.material('market_space_pack', new Color3(0.05, 0.15, 0.32), new Color3(0.02, 0.08, 0.2)),
      this.material('market_skin_pack', new Color3(0.25, 0.18, 0.08), new Color3(0.1, 0.05, 0.01)),
    ];
    const mX = this.layout.marketplace.x;
    const mZ = this.layout.marketplace.z;
    for (let i = 0; i < 3; i += 1) {
      const kiosk = MeshBuilder.CreateBox(`marketplace_mod_kiosk_${i}`, { width: 2.2, height: 2.2, depth: 1.2 }, this.scene);
      kiosk.position = new Vector3(mX + i * 3, spawn.y + 1, mZ);
      kiosk.material = mats[i];
      this.runtimeMeshes.push({ mesh: kiosk });
    }
  }

  private createRareMcdonaldsWorld(spawn: SpawnPoint): void {
    const red = this.material('mcd_red', new Color3(0.75, 0.02, 0.02), new Color3(0.2, 0.0, 0.0));
    const yellow = this.material('mcd_yellow', new Color3(1, 0.78, 0.05), new Color3(0.4, 0.24, 0.01));
    const rX = this.layout.rare.x;
    const rZ = this.layout.rare.z;
    const restaurant = MeshBuilder.CreateBox('rare_mcdonalds_restaurant_once_in_infinite_possibilities', { width: 7.5, height: 3, depth: 5 }, this.scene);
    restaurant.position = new Vector3(rX, spawn.y + 1.5, rZ);
    restaurant.material = red;
    this.runtimeMeshes.push({ mesh: restaurant });
    for (let i = 0; i < 2; i += 1) {
      const arch = MeshBuilder.CreateTorus(`mcd_golden_arch_${i}`, { diameter: 2.2, thickness: 0.18, tessellation: 24 }, this.scene);
      arch.position = new Vector3(rX - 1.2 + i * 2.4, spawn.y + 4.2, rZ - 2.6);
      arch.rotation.z = Math.PI / 2;
      arch.material = yellow;
      this.runtimeMeshes.push({ mesh: arch });
    }
    const foods = ['burger', 'fries', 'donut'];
    foods.forEach((food, i) => {
      const item = MeshBuilder.CreateSphere(`rare_mcdonalds_${food}`, { diameter: 0.65, segments: 12 }, this.scene);
      item.position = new Vector3(rX - 2 + i * 1.5, spawn.y + 1.1, rZ + 3.5);
      item.material = i === 1 ? yellow : this.material(`mcd_${food}`, new Color3(0.55 + i * 0.1, 0.25, 0.1), new Color3(0, 0, 0));
      this.runtimeMeshes.push({ mesh: item, bob: i + 700 });
    });
  }

  private createSmoke(pos: Vector3): void {
    const ps = new ParticleSystem('nextgen_fire_smoke_particles', 500, this.scene);
    ps.particleTexture = new Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', this.scene);
    ps.emitter = pos.add(new Vector3(2, 1.5, 0));
    ps.minLifeTime = 1.4;
    ps.maxLifeTime = 4.4;
    ps.emitRate = 70;
    ps.minSize = 0.15;
    ps.maxSize = 0.8;
    ps.color1 = new Color4(0.25, 0.25, 0.25, 0.28);
    ps.color2 = new Color4(0.05, 0.05, 0.05, 0.16);
    ps.direction1 = new Vector3(-0.1, 0.5, -0.1);
    ps.direction2 = new Vector3(0.1, 1.0, 0.1);
    ps.minEmitPower = 0.2;
    ps.maxEmitPower = 0.6;
    ps.start();
    this.particles.push(ps);
  }

  private skyVariant(now: number): Color3 {
    const variants = [new Color3(1, 0.25, 0.1), new Color3(1, 0.5, 0.08), new Color3(1, 0.1, 0.55), new Color3(0.65, 0.15, 1), new Color3(1, 0.8, 0.18)];
    return variants[Math.floor(now * 0.0001) % variants.length];
  }

  private planetColor(i: number): Color3 {
    const colors = [new Color3(0.7, 0.64, 0.52), new Color3(0.9, 0.62, 0.28), new Color3(0.85, 0.25, 0.12), new Color3(0.8, 0.56, 0.34), new Color3(0.9, 0.78, 0.52), new Color3(0.2, 0.4, 0.85), new Color3(0.55, 0.2, 0.75)];
    return colors[i % colors.length];
  }

  private material(name: string, diffuse: Color3, emissive: Color3, alpha?: number): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = diffuse;
    material.emissiveColor = emissive;
    material.specularColor = new Color3(0.08, 0.08, 0.08);
    if (alpha !== undefined) material.alpha = alpha;
    return material;
  }
}

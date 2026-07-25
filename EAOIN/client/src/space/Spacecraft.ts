/**
 * Spacecraft — Modular Ship System
 */
export interface SpacecraftComponent {
  type: 'hull' | 'engine' | 'control' | 'navigation' | 'shield' | 'sensor';
  id: string;
  properties: Record<string, any>;
}

export interface SpacecraftData {
  id: string;
  name: string;
  components: SpacecraftComponent[];
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  energy: number;
  maxEnergy: number;
  dockedAt?: string;
}

export class SpacecraftSystem {
  private ships = new Map<string, SpacecraftData>();

  createShip(name: string): SpacecraftData {
    const ship: SpacecraftData = {
      id: `ship_${Date.now()}`,
      name,
      components: [
        { type: 'hull', id: 'hull_1', properties: { durability: 100, size: 10 } },
        { type: 'engine', id: 'engine_1', properties: { speed: 100, energyUse: 5 } },
        { type: 'control', id: 'control_1', properties: { pilotCapacity: 4 } },
      ],
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      energy: 100,
      maxEnergy: 100,
    };
    this.ships.set(ship.id, ship);
    console.log(`[Spacecraft] Created ship: ${name}`);
    return ship;
  }

  updateShipPosition(id: string, inputVelocity: { x: number; y: number; z: number }): void {
    const ship = this.ships.get(id);
    if (!ship) return;
    const engine = ship.components.find(c => c.type === 'engine');
    const speed = engine ? (engine.properties.speed ?? 50) / 100 : 1;
    ship.velocity = {
      x: inputVelocity.x * speed,
      y: inputVelocity.y * speed,
      z: inputVelocity.z * speed,
    };
    ship.position = {
      x: ship.position.x + ship.velocity.x,
      y: ship.position.y + ship.velocity.y,
      z: ship.position.z + ship.velocity.z,
    };
    ship.energy = Math.max(0, ship.energy - (engine ? engine.properties.energyUse ?? 5 : 1));
  }

  getShip(id: string): SpacecraftData | null {
    return this.ships.get(id) ?? null;
  }
}

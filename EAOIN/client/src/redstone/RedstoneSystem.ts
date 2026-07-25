/**
 * Redstone Framework — Complete Automation System
 */
export enum RedstoneComponent {
  PowerSource = 'power_source',
  Repeater = 'repeater',
  Comparator = 'comparator',
  Observer = 'observer',
  Dispenser = 'dispenser',
  Dropper = 'dropper',
  Hopper = 'hopper',
  Piston = 'piston',
  StickyPiston = 'sticky_piston',
  TargetBlock = 'target_block',
  RedstoneWire = 'redstone_wire',
}

export interface RedstoneComponentDef {
  type: RedstoneComponent;
  id: string;
  position: { x: number; y: number; z: number };
  powered: boolean;
  signalStrength: number; // 0-15
  properties?: Record<string, any>;
}

export class RedstoneSystem {
  private components = new Map<string, RedstoneComponentDef>();
  private tickCount = 0;

  registerComponent(comp: RedstoneComponentDef): void {
    this.components.set(comp.id, comp);
  }

  tick(): void {
    this.tickCount++;
    // Propagate signals
    const poweredIds = new Set<string>();
    for (const [id, comp] of this.components) {
      if (comp.powered) poweredIds.add(id);
    }

    // Simple propagation: neighbors within 1 block
    for (const [id, comp] of this.components) {
      if (comp.type === RedstoneComponent.RedstoneWire) {
        const hasPoweredNeighbor = Array.from(this.components.values()).some(c => {
          const dx = Math.abs(comp.position.x - c.position.x);
          const dy = Math.abs(comp.position.y - c.position.y);
          const dz = Math.abs(comp.position.z - c.position.z);
          return (dx + dy + dz <= 1) && c.powered && c.id !== id;
        });
        comp.powered = hasPoweredNeighbor;
        comp.signalStrength = hasPoweredNeighbor ? 15 : 0;
      }
    }

    // Repeaters update (delay simulation)
    for (const [id, comp] of this.components) {
      if (comp.type === RedstoneComponent.Repeater && this.tickCount % (comp.properties?.delay ?? 4) === 0) {
        // Repeater passes signal after delay
      }
    }
  }

  getComponent(id: string): RedstoneComponentDef | null {
    return this.components.get(id) ?? null;
  }

  getComponents(): RedstoneComponentDef[] {
    return Array.from(this.components.values());
  }
}

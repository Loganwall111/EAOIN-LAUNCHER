/**
 * RedstoneExecution — Signal Propagation & Component Activation
 */
import { RedstoneSystem, RedstoneComponent } from '../RedstoneSystem';

export class RedstoneExecution {
  constructor(private system: RedstoneSystem) {}

  executeTick(): void {
    // First: collect powered sources
    const poweredSources = new Set<string>();
    for (const comp of this.system.getComponents()) {
      if (comp.type === RedstoneComponent.PowerSource && comp.powered) {
        poweredSources.add(comp.id);
      }
    }

    // Propagate to adjacent wires
    const wireIds = this.system.getComponents()
      .filter(c => c.type === RedstoneComponent.RedstoneWire)
      .map(c => c.id);

    for (const wireId of wireIds) {
      const wire = this.system.getComponents().find(c => c.id === wireId);
      if (!wire) continue;
      const hasPoweredNeighbor = this.system.getComponents().some(c => {
        if (c.id === wireId) return false;
        const dx = Math.abs(wire.position.x - c.position.x);
        const dy = Math.abs(wire.position.y - c.position.y);
        const dz = Math.abs(wire.position.z - c.position.z);
        return (dx + dy + dz <= 1) && (c.powered || poweredSources.has(c.id));
      });
      wire.powered = hasPoweredNeighbor;
      wire.signalStrength = hasPoweredNeighbor ? 15 : 0;
    }

    // Activate pistons/repeaters based on power
    for (const comp of this.system.getComponents()) {
      if (comp.type === RedstoneComponent.Piston || comp.type === RedstoneComponent.StickyPiston) {
        comp.powered = this.system.getComponents().some(c => {
          if (c.id === comp.id) return false;
          const dx = Math.abs(comp.position.x - c.position.x);
          const dy = Math.abs(comp.position.y - c.position.y);
          const dz = Math.abs(comp.position.z - c.position.z);
          return (dx + dy + dz <= 1) && c.powered;
        });
        console.log(`[RedstoneExec] Piston ${comp.id} powered: ${comp.powered}`);
      }
    }
  }
}

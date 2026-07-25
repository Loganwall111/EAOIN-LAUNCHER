/**
 * RedstoneActivationExecution — Component Activation Based on Power
 */
import { RedstoneExecution } from '../execution/RedstoneExecution';
import { RedstoneSystem, RedstoneComponent } from '../RedstoneSystem';

export class RedstoneActivationExecution {
  constructor(private execution: RedstoneExecution) {}

  activateComponents(): void {
    const system = (this.execution as any).system as RedstoneSystem;
    for (const comp of system.getComponents()) {
      if (comp.type === RedstoneComponent.Piston || comp.type === RedstoneComponent.StickyPiston) {
        if (comp.powered) {
          console.log(`[Activation] Piston activated: ${comp.id}`);
        } else {
          console.log(`[Activation] Piston deactivated: ${comp.id}`);
        }
      }
      if (comp.type === RedstoneComponent.Hopper) {
        // Hopper would check for powered state and transfer items
        console.log(`[Activation] Hopper state: powered=${comp.powered}`);
      }
    }
  }
}

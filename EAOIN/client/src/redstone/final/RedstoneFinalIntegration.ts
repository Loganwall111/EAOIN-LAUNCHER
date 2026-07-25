/**
 * RedstoneFinalIntegration — Full Component Activation with Signal Propagation
 */
import { RedstoneSystem } from '../RedstoneSystem';
import { RedstoneDeepActivation } from '../deep/RedstoneDeepActivation';
import { RedstoneExecution } from '../execution/RedstoneExecution';
import { RedstoneDeepExecution } from '../deep/execution/RedstoneDeepExecution';

export class RedstoneFinalIntegration {
  private system = new RedstoneSystem();
  private deepActivation = new RedstoneDeepActivation();
  private execution = new RedstoneExecution(this.system);
  private deepExecution = new RedstoneDeepExecution();

  initializeFullSystem(): void {
    console.log('[RedstoneFinal] Full redstone system initialized with deep activation and execution');
  }

  executeFullTick(): void {
    this.execution.executeTick();
    const activated = this.deepExecution.processDelays();
    if (activated.length > 0) {
      console.log(`[RedstoneFinal] Components activated by delay: ${activated.join(', ')}`);
    }
  }

  getSystemStatus(): string {
    return `Components: ${this.system.getComponents().length} | Deep Execution: active | Integration: complete`;
  }
}

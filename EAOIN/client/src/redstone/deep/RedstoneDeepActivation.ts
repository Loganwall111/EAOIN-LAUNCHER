/**
 * RedstoneDeepActivation — Repeater Delays, Observer Detection, Tick Counting
 */
export class RedstoneDeepActivation {
  private tickCounters = new Map<string, number>();

  tickComponent(componentId: string, delay: number): boolean {
    const current = this.tickCounters.get(componentId) ?? 0;
    const next = current + 1;
    this.tickCounters.set(componentId, next);
    return next >= delay;
  }

  resetComponent(componentId: string): void {
    this.tickCounters.set(componentId, 0);
    console.log(`[RedstoneDeep] Reset tick counter: ${componentId}`);
  }

  observerDetectBlockChange(position: { x: number; y: number; z: number }, changedBlock: boolean): boolean {
    if (changedBlock) {
      console.log(`[RedstoneDeep] Observer detected change at ${position.x},${position.y},${position.z}`);
      return true;
    }
    return false;
  }

  getTickCounter(componentId: string): number {
    return this.tickCounters.get(componentId) ?? 0;
  }
}

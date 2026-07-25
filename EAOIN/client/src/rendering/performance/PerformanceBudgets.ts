/**
 * PerformanceBudgets — Memory & Rendering Budgets for AAA Quality
 */
export interface PerformanceBudget {
  maxFPS: number;
  minFPS: number;
  memoryBudgetMB: number;
  renderDistanceChunks: number;
  maxEntities: number;
  chunkGenerateTimeMs: number;
  saveWriteTimeMs: number;
  networkLatencyMs: number;
}

export const AAA_QUALITY_BUDGETS: PerformanceBudget = {
  maxFPS: 240,
  minFPS: 60,
  memoryBudgetMB: 4096,
  renderDistanceChunks: 8,
  maxEntities: 500,
  chunkGenerateTimeMs: 50,
  saveWriteTimeMs: 200,
  networkLatencyMs: 50,
};

export class PerformanceBudgetTracker {
  private metrics: Partial<PerformanceBudget> = {};

  recordFPS(fps: number): void {
    this.metrics.maxFPS = Math.max(this.metrics.maxFPS ?? 0, fps);
    this.metrics.minFPS = Math.min(this.metrics.minFPS ?? Infinity, fps);
  }

  recordMemory(memoryMB: number): void {
    this.metrics.memoryBudgetMB = memoryMB;
  }

  getStatus(): string {
    const maxFPS = this.metrics.maxFPS ?? 0;
    const minFPS = this.metrics.minFPS ?? Infinity;
    const memory = this.metrics.memoryBudgetMB ?? 0;
    const withinPerformance = minFPS >= AAA_QUALITY_BUDGETS.minFPS && memory <= AAA_QUALITY_BUDGETS.memoryBudgetMB;
    return withinPerformance ? 'PASS' : 'FAIL';
  }

  getBudgets(): PerformanceBudget {
    return AAA_QUALITY_BUDGETS;
  }
}

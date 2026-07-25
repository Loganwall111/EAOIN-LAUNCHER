/**
 * DeepPerformanceTracking — Continuous Monitoring & Budget Enforcement
 */
import { PerformanceBudgetTracker, AAA_QUALITY_BUDGETS } from '../optimization/PerformanceOptimization';

export class DeepPerformanceTracking {
  private tracker = new PerformanceBudgetTracker();
  private history: Array<{ timestamp: number; fps: number; memoryMB: number; status: string }> = [];

  recordSample(fps: number, memoryMB: number): void {
    this.tracker.recordFPS(fps);
    this.tracker.recordMemory(memoryMB);
    const status = this.tracker.getStatus();
    this.history.push({ timestamp: Date.now(), fps, memoryMB, status });
    console.log(`[DeepPerf] Sample recorded — FPS: ${fps}, Memory: ${memoryMB}MB, Status: ${status}`);
  }

  getAverageFPS(lastN: number = 10): number {
    const samples = this.history.slice(-lastN);
    if (samples.length === 0) return 0;
    const total = samples.reduce((sum, s) => sum + s.fps, 0);
    return total / samples.length;
  }

  getPerformanceReport(): string {
    const avgFPS = this.getAverageFPS();
    const avgMemory = this.history.reduce((sum, s) => sum + s.memoryMB, 0) / Math.max(1, this.history.length);
    const withinBudget = avgFPS >= AAA_QUALITY_BUDGETS.minFPS && avgMemory <= AAA_QUALITY_BUDGETS.memoryBudgetMB;
    return `Performance Report — Avg FPS: ${avgFPS.toFixed(1)} / Budget: ${AAA_QUALITY_BUDGETS.minFPS}, Memory: ${avgMemory.toFixed(0)}MB / Budget: ${AAA_QUALITY_BUDGETS.memoryBudgetMB}MB — ${withinBudget ? 'PASS' : 'FAIL'}`;
  }
}

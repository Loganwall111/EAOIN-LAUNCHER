/**
 * PerformanceFinalIntegration — Continuous Monitoring Integration
 */
import { PerformanceOptimization, AAA_QUALITY_BUDGETS } from '../optimization/PerformanceOptimization';
import { DeepPerformanceTracking } from '../deep/DeepPerformanceTracking';

export class PerformanceFinalIntegration {
  private optimization = new PerformanceOptimization();
  private tracking = new DeepPerformanceTracking();

  recordPerformanceSample(fps: number, memoryMB: number): void {
    this.tracking.recordSample(fps, memoryMB);
    const status = this.tracking.getPerformanceReport();
    console.log(`[PerfFinal] Performance recorded: ${status}`);
  }

  enforceBudgets(): boolean {
    const avgFPS = this.tracking.getAverageFPS();
    const withinFPS = avgFPS >= AAA_QUALITY_BUDGETS.minFPS;
    const report = this.tracking.getPerformanceReport();
    console.log(`[PerfFinal] Budget enforcement: ${report}`);
    return withinFPS;
  }

  getIntegrationStatus(): string {
    return `Performance Integration: active | Tracking: ${this.tracking.getAverageFPS().toFixed(1)} FPS avg | Optimization: automatic`;
  }
}

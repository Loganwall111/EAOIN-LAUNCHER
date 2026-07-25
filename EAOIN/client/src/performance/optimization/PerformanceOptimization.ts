/**
 * PerformanceOptimization — Frame Time Monitoring & Optimization Triggers
 */
export interface FrameMetrics {
  frameTimeMs: number;
  fps: number;
  memoryUsageMB: number;
  chunkLoadTimeMs: number;
  entityUpdateTimeMs: number;
}

export interface OptimizationTrigger {
  triggerName: string;
  threshold: number;
  action: () => void;
}

export class PerformanceOptimization {
  private metrics: FrameMetrics = {
    frameTimeMs: 16.67,
    fps: 60,
    memoryUsageMB: 1024,
    chunkLoadTimeMs: 20,
    entityUpdateTimeMs: 2,
  };

  private triggers: OptimizationTrigger[] = [];

  constructor() {
    this.registerDefaultTriggers();
  }

  private registerDefaultTriggers(): void {
    this.registerTrigger({
      triggerName: 'low_fps',
      threshold: 30,
      action: () => console.log('[PerfOpt] Low FPS detected — reducing render distance'),
    });
    this.registerTrigger({
      triggerName: 'high_memory',
      threshold: 3072,
      action: () => console.log('[PerfOpt] High memory — clearing chunk cache'),
    });
    this.registerTrigger({
      triggerName: 'high_chunk_load',
      threshold: 50,
      action: () => console.log('[PerfOpt] Chunk load slow — reducing stream radius'),
    });
  }

  registerTrigger(trigger: OptimizationTrigger): void {
    this.triggers.push(trigger);
  }

  recordFrame(metrics: Partial<FrameMetrics>): void {
    this.metrics = { ...this.metrics, ...metrics };
    for (const trigger of this.triggers) {
      const value = this.getMetricValue(trigger.triggerName);
      if (value > trigger.threshold) {
        trigger.action();
      }
    }
  }

  private getMetricValue(triggerName: string): number {
    switch (triggerName) {
      case 'low_fps': return 60 - this.metrics.fps;
      case 'high_memory': return this.metrics.memoryUsageMB;
      case 'high_chunk_load': return this.metrics.chunkLoadTimeMs;
      default: return 0;
    }
  }

  getMetrics(): FrameMetrics {
    return { ...this.metrics };
  }
}

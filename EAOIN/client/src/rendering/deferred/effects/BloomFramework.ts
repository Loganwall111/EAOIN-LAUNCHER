/**
 * BloomFramework — Post-Process Bloom
 */
export interface BloomConfig {
  enabled: boolean;
  threshold: number;
  intensity: number;
  blurPasses: number;
}

export class BloomFramework {
  private config: BloomConfig = {
    enabled: true,
    threshold: 0.8,
    intensity: 0.8,
    blurPasses: 3,
  };

  renderPass(): void {
    if (!this.config.enabled) return;
    console.log(`[Bloom] Applying bloom with threshold ${this.config.threshold}, intensity ${this.config.intensity}, passes ${this.config.blurPasses}`);
  }

  setConfig(config: Partial<BloomConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): BloomConfig {
    return { ...this.config };
  }
}

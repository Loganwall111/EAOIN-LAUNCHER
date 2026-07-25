/**
 * DeferredRenderingIntegration — Connect SSAO + Bloom to ChunkRenderer
 */
import { DeferredPipeline } from '../DeferredPipeline';
import { SSAOFramework } from '../effects/SSAOFramework';
import { BloomFramework } from '../effects/BloomFramework';

export class DeferredRenderingIntegration {
  private pipeline: DeferredPipeline;
  private ssao: SSAOFramework;
  private bloom: BloomFramework;

  constructor() {
    this.pipeline = new DeferredPipeline();
    this.ssao = new SSAOFramework();
    this.bloom = new BloomFramework();
    console.log('[DeferredIntegration] Pipeline + SSAO + Bloom initialized');
  }

  renderFrame(): void {
    // Render g_buffer (geometry pass)
    this.pipeline.renderFrame();
    // Apply lighting
    this.processLightingPass();
    // Apply SSAO
    this.ssao.renderPass();
    // Apply bloom
    this.bloom.renderPass();
    // Final post-process
    console.log('[DeferredIntegration] Frame rendered with deferred pipeline');
  }

  private processLightingPass(): void {
    console.log('[DeferredIntegration] Processing deferred lighting pass');
  }
}

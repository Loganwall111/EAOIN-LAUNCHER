/**
 * RendererBackend — Babylon runtime engine selection.
 *
 * Browser JavaScript cannot open raw Vulkan directly. This provides the correct
 * browser-compatible Vulkan-adjacent path: BabylonJS WebGPU first, with WebGL
 * fallback. On Chromium/Windows/Linux, WebGPU may be backed by D3D12/Vulkan
 * internally depending on the browser/driver stack.
 */
import { Engine } from '@babylonjs/core';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import { GameSettings } from '../settings/GameSettings';

export type RuntimeBabylonEngine = Engine | WebGPUEngine;
export type RendererBackendID = 'webgpu' | 'webgl';

export interface RendererBackendInfo {
  backend: RendererBackendID;
  label: string;
  requested: GameSettings['rendererPreference'];
  webgpuSupported: boolean;
  fallbackReason?: string;
  vulkanPath: 'browser-webgpu-may-map-to-vulkan' | 'webgl-not-vulkan' | 'native-vulkan-required';
}

export interface RuntimeEngineResult {
  engine: RuntimeBabylonEngine;
  info: RendererBackendInfo;
}

const ENGINE_OPTIONS = {
  preserveDrawingBuffer: true,
  stencil: true,
  antialias: true,
  adaptToDeviceRatio: true,
};

export async function createRuntimeEngine(canvas: HTMLCanvasElement, settings: GameSettings): Promise<RuntimeEngineResult> {
  const requested = settings.rendererPreference;
  const webgpuSupported = await WebGPUEngine.IsSupportedAsync;

  if (requested !== 'webgl' && webgpuSupported) {
    try {
      const engine = await WebGPUEngine.CreateAsync(canvas, ENGINE_OPTIONS);
      applyRenderScale(engine, settings.renderScale);
      return {
        engine,
        info: {
          backend: 'webgpu',
          label: settings.experimentalVulkanMode ? 'Official Vulkan Mode (BabylonJS WebGPU + native bootstrap)' : 'BabylonJS WebGPU',
          requested,
          webgpuSupported,
          vulkanPath: 'browser-webgpu-may-map-to-vulkan',
        },
      };
    } catch (error) {
      const engine = createWebGLEngine(canvas, settings);
      return {
        engine,
        info: {
          backend: 'webgl',
          label: 'BabylonJS WebGL fallback',
          requested,
          webgpuSupported,
          fallbackReason: error instanceof Error ? error.message : 'WebGPU initialization failed',
          vulkanPath: 'webgl-not-vulkan',
        },
      };
    }
  }

  const engine = createWebGLEngine(canvas, settings);
  return {
    engine,
    info: {
      backend: 'webgl',
      label: 'BabylonJS WebGL',
      requested,
      webgpuSupported,
      fallbackReason: requested === 'webgl' ? 'WebGL forced by settings' : 'WebGPU unsupported in this browser/device',
      vulkanPath: requested === 'webgl' ? 'webgl-not-vulkan' : 'native-vulkan-required',
    },
  };
}

export function applyRenderScale(engine: RuntimeBabylonEngine, renderScale: number): void {
  const clampedScale = Math.max(0.5, Math.min(1.5, renderScale));
  engine.setHardwareScalingLevel(1 / clampedScale);
}

function createWebGLEngine(canvas: HTMLCanvasElement, settings: GameSettings): Engine {
  const engine = new Engine(canvas, true, ENGINE_OPTIONS);
  applyRenderScale(engine, settings.renderScale);
  return engine;
}

# EAOIN Rendering Backend Plan — BabylonJS, WebGPU, and Native Vulkan

## What is implemented in Release to Life 1.0

EAOIN now has two rendering/runtime tracks:

1. **Browser playable game**
   - BabylonJS WebGPU-first renderer path.
   - BabylonJS WebGL fallback.
   - Renderer backend settings and HUD status.

2. **Native Vulkan bootstrap**
   - C++ CMake project in `native/vulkan/`.
   - Creates a Vulkan instance.
   - Enumerates Vulkan physical devices.
   - Selects a graphics-capable queue family.
   - Creates a logical Vulkan device and graphics queue.

## Vulkan reality check

Browser JavaScript cannot open raw Vulkan directly. A browser game can use WebGL or WebGPU. On some platforms, browser WebGPU may internally use Vulkan, DirectX 12, or Metal through the browser/GPU driver stack.

Therefore:

- Browser build: BabylonJS WebGPU/WebGL.
- Native build: C++ Vulkan bootstrap.
- Full native Vulkan renderer: future phase after swapchain/window/shader/asset bridge work.

## Current native Vulkan support scope

Implemented:

- Vulkan SDK integration through CMake `find_package(Vulkan REQUIRED)`.
- Instance creation.
- Device enumeration/reporting.
- Queue family scan.
- Logical device creation.
- CLI bootstrap executable.

Not yet implemented:

- Native window/surface/swapchain.
- Native voxel mesh renderer.
- SPIR-V shader pipeline.
- Asset transfer bridge.
- Native input/audio shell.

## Build native Vulkan bootstrap

From `EAOIN/`:

```bash
npm run native:vulkan:configure
npm run native:vulkan:build
npm run native:vulkan:run
```

## Native Vulkan prerequisites checklist

- Vulkan SDK 1.2+
- GPU + driver supporting Vulkan
- CMake 3.20+
- C++20 compiler
- Future: SDL2/GLFW/native window layer
- Future: SPIR-V shader compilation
- Future: native asset bundle format
- Future: CI runners for Windows/Linux

## Recommendation

Keep shipping the browser game through BabylonJS WebGPU-first while expanding the native Vulkan bootstrap toward a swapchain + native voxel renderer in later releases.

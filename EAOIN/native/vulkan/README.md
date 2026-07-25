# EAOIN Native Vulkan Runtime — Release to Life Bootstrap

This folder contains the first native Vulkan support for EAOIN 1.0 "Release to Life".

The web game still runs through BabylonJS WebGPU/WebGL. This native module is a separate C++ Vulkan bootstrap that can create a Vulkan instance, enumerate physical devices, select a graphics-capable device, and create a logical device/graphics queue when the Vulkan SDK and driver are available.

## Build prerequisites

- Vulkan SDK 1.2+
- CMake 3.20+
- C++20 compiler
- GPU/driver with Vulkan support

## Build

From `EAOIN/`:

```bash
npm run native:vulkan:configure
npm run native:vulkan:build
npm run native:vulkan:run
```

Or directly:

```bash
cmake -S native/vulkan -B native/vulkan/build
cmake --build native/vulkan/build --config Release
./native/vulkan/build/eaoin-vulkan-bootstrap
```

On Windows, run the executable from `native/vulkan/build/Release/` depending on the generator.

## Current native support scope

Implemented now:

- Vulkan instance creation
- Vulkan physical device enumeration
- Device/queue capability reporting
- Graphics queue family selection
- Logical device creation
- Release/version metadata

Not yet implemented:

- Native window/surface/swapchain
- Native voxel renderer bridge
- SPIR-V shader pipeline
- Asset transfer from web build to native renderer
- Input/audio/native UI shell

## Why the browser build is separate

Browser JavaScript cannot invoke raw Vulkan. The browser build uses BabylonJS WebGPU-first with WebGL fallback. WebGPU may internally map to Vulkan on supported platforms, but true raw Vulkan requires this native runtime path.

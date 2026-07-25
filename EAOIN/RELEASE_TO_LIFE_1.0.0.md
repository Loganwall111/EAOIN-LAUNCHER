# EAOIN 1.0 — Release to Life

This is the first named playable release build of EAOIN.

## Release promise

Release to Life promotes the project from a blank architecture shell into a playable voxel sandbox vertical slice with visible world simulation, survival, crafting, creatures, dimensions, redstone-style systems, settlement runtime, WebGPU-first BabylonJS rendering, and first native Vulkan bootstrap support.

## Major systems included

- BabylonJS 3D playable canvas
- WebGPU-first renderer with WebGL fallback
- Native Vulkan C++ bootstrap module
- Voxel terrain, chunk streaming, and dirty chunk remeshing
- Biomes, lakes, trees, rocks, ores, ruins
- Mining, block placing, tools, hotbar, inventory
- Crafting recipes and tool unlocks
- Persistent world edits and player progress
- Health, food, stamina, fall damage
- Passive creatures, wandering AI, combat, drops
- Audio cues, settings, pause menu, accessibility options
- Redstone-style signal runtime and buildable logic blocks
- Dimension runtime, portal monument, portal core support
- Settlement/civilization runtime with villagers, supply delivery, barter, prosperity
- Local multiplayer-authority scaffold and sync telemetry
- Objectives/tutorial progression

## Native Vulkan status

Implemented in `native/vulkan/`:

- Vulkan instance creation
- Device enumeration
- Graphics queue selection
- Logical device creation
- Native bootstrap executable target

Still future work:

- Vulkan swapchain/window surface
- Native voxel renderer bridge
- Native shader/asset pipeline
- Native input/audio shell

## Run web game

```bash
npm install
npm run dev
```

## Build/test web game

```bash
npm run build
npm test
```

## Build native Vulkan bootstrap

Requires Vulkan SDK, CMake, and C++20 compiler.

```bash
npm run native:vulkan:configure
npm run native:vulkan:build
npm run native:vulkan:run
```

# EAOIN Release 1.0 — End Game Update

This is the official numeric-release milestone requested after the update-name era. It consolidates the playable browser game, WebGPU/Vulkan path, native Vulkan source pipeline, end-game systems, city economy, multiplayer replication, marketplace backend, modding/resource packs, cinematic credits, and advanced physics foundations.

## Included in Release 1.0

- BabylonJS WebGPU-first playable browser game with WebGL fallback.
- Native Vulkan source path with bootstrap, window/surface abstraction, swapchain, render pass/pipeline, shader inputs, and native voxel buffer upload foundation.
- CMake presets, Dockerfile, dependency install/check scripts for native Vulkan builds.
- Cinematic credits overlay with skip flow.
- City economy runtime and HUD telemetry.
- Multiplayer replication backend.
- Marketplace publishing backend.
- Resource pack loader and modding SDK foundation.
- Advanced physics simulation state.
- Story/end-game runtime, bosses, planets, moon, doors, command console, settlements, redstone-style logic, and objectives.

## Native Vulkan install/build

On a native machine with internet access and package manager support:

```bash
npm run native:vulkan:install-deps
npm run native:vulkan:configure
npm run native:vulkan:build
npm run native:vulkan:run
```

Or use Docker:

```bash
npm run native:vulkan:docker-build
npm run native:vulkan:docker-run
```

## Sandbox note

The current Arena sandbox does not expose working apt repositories for the needed native packages and does not have CMake/Vulkan SDK/GLFW preinstalled, so native compilation cannot be completed inside this sandbox. The repository now includes install scripts, Dockerfile, source code, CMake presets, and shader source required for native development environments.

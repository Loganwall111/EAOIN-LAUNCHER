# EAOIN Implementation Roadmap

This tracker is for continuing feature batches until the mounted design/script is represented by real playable systems. The core architecture skeleton stays intact; batches add runtime bridges, gameplay systems, assets, content, and validation around it.

## Current playable baseline

- [x] Babylon render canvas wired to React app
- [x] Visible voxel terrain around spawn
- [x] Procedural block materials/textures
- [x] Global sky/sun/spawn lighting
- [x] Safe spawn point and spawn marker
- [x] First-person WASD/mouse walking
- [x] Gravity and mesh collisions
- [x] Hotbar block selection
- [x] Left-click block breaking
- [x] Right-click block placement
- [x] Dynamic remeshing after edits
- [x] Seed-scoped local save/load for block edits
- [x] Save status HUD indicator
- [x] Reset-world control for testing
- [x] Inventory stacks and hotbar counts
- [x] Block collection and placement consumption
- [x] Health/food/stamina survival model
- [x] Fall damage and basic recovery loop
- [x] Hold-to-break mining
- [x] Tool tiers and effectiveness
- [x] Block hardness timing
- [x] Break progress feedback UI
- [x] Per-chunk runtime mesh manager
- [x] Dirty block chunk remeshing
- [x] Movement-based chunk streaming
- [x] Far chunk disposal
- [x] Render statistics overlay
- [x] Biome surface material variation
- [x] Procedural trees, boulders, and ore outcrops
- [x] Procedural lake/water generation
- [x] Starter ruins/structures
- [x] Passive creature placeholder meshes
- [x] Creature spawn/despawn manager
- [x] Basic wander AI
- [x] Collision-safe creature placement
- [x] Inventory/crafting panel UI
- [x] Basic recipes and resource validation
- [x] Tool crafting/unlocking
- [x] Player progress save/load
- [x] Reset player progress control
- [x] Audio feedback system
- [x] Settings/options panel with saved preferences
- [x] Creature hit/damage interaction
- [x] Item drop/pickup loop
- [x] Objective/tutorial tracker
- [x] Pause menu handling
- [x] Crosshair target labels
- [x] HUD polish and gameplay counters
- [x] Runtime dimension controller and portal monument
- [x] Redstone-style signal runtime
- [x] Starter settlement/civilization runtime
- [x] Local authority/network scaffold
- [x] Runtime systems status panel
- [x] Expanded objectives for dimensions, redstone, and settlement discovery
- [x] Buildable special block definitions and materials
- [x] Craftable logic wire, signal lamp, portal core, crystal shards, and village crates
- [x] Settlement supply delivery/economy task loop
- [x] Accessibility settings: high contrast and reduced motion
- [x] Responsive HUD/inventory polish
- [x] Placed logic wire/signal lamp scanning
- [x] Placed portal core activation behavior
- [x] Dimension-specific visual overlays
- [x] Settlement background job/economy progress
- [x] Expanded local authority sync stats
- [x] Advanced runtime objectives for powered lamps and authority uptime
- [x] BabylonJS WebGPU-first renderer path
- [x] WebGL fallback renderer path
- [x] Renderer backend status HUD
- [x] Renderer settings: Auto WebGPU, Prefer WebGPU, Force WebGL
- [x] Render scale and quality preset settings
- [x] Fog/post-processing settings foundation
- [x] Vulkan/native runtime requirements documentation
- [x] Native Vulkan preparation stub

## Batch queue

### Macro-batch operating mode
From Batch 29 onward, implementation should bundle 10–15 related features where practical, then run build/test before moving on. Prefer larger coherent systems over tiny single-feature patches, while avoiding risky rewrites of core architecture.

### Batch 23 — Save/load and world edit persistence
- [x] Store block edits by seed in local save data
- [x] Load saved edits back into generated chunks
- [x] Add save status HUD indicator
- [x] Add reset-world option for testing

### Batch 24 — Inventory and survival basics
- [x] Track collected blocks from breaking
- [x] Consume inventory on placement
- [x] Add health/food/stamina data model
- [x] Add fall damage and basic recovery loop

### Batch 25 — Tool tiers and mining rules
- [x] Add hand/tool mining speeds
- [x] Add block hardness timing
- [x] Add simple pickaxe/axe/shovel definitions
- [x] Add break progress feedback

### Batch 26 — Streaming/render performance
- [x] Remesh only dirty chunks instead of full-world remesh
- [x] Stream chunks while moving
- [x] Dispose chunks outside render radius
- [x] Add render statistics overlay

### Batch 27 — World content
- [x] Real biome material variation
- [x] Tree/rock/ore cluster placement
- [x] Water/lake generation pass
- [x] Starter structures and ruins

### Batch 28 — NPC/creature spawn pass
- [x] Spawn passive test creatures
- [x] Add simple AI wander behavior
- [x] Add visible NPC meshes/placeholders
- [x] Add spawn/despawn manager

### Batch 29 — Crafting, progression, and UI macro-batch
- [x] Inventory UI panel
- [x] Basic recipes
- [x] Crafting interaction flow
- [x] Hotbar item counts
- [x] Tool unlock progression
- [x] Crafting resource validation
- [x] Player inventory/tool/survival save-load
- [x] Reset player progress option
- [x] Controls/help hints in inventory panel
- [x] Locked/unlocked toolbelt visualization

### Batch 30 — Polish, interaction, audio, combat/objectives macro-batch
- [x] Audio feedback cues
- [x] Settings/options panel
- [x] Settings persistence
- [x] Creature damage/combat interaction
- [x] Creature loot drops
- [x] Mined block item drops
- [x] Automatic pickup collection
- [x] Objective/tutorial tracker
- [x] Pause menu handling
- [x] Crosshair target labels/tooltips
- [x] HUD polish and gameplay counters
- [x] Camera/audio/stat display tuning

### Batch 31 — Runtime systems parity macro-batch
- [x] Multiplayer/network authority runtime scaffold
- [x] Villages/civilizations runtime placeholders
- [x] Redstone/logic block runtime
- [x] Dimensions/portal runtime
- [x] Quest/progression expansion for runtime systems
- [x] Runtime systems HUD/status panel
- [x] Portal/dimension keybind and scene rules
- [x] Redstone signal keybind and visible logic rig
- [x] Settlement discovery and villager placeholders
- [x] Local authority ticks, ping, client id, action counts

### Batch 32 — Buildable systems, economy, accessibility mega-batch
- [x] Advanced multiplayer status UI expansion
- [x] Buildable logic block definitions
- [x] Craftable redstone wire and signal lamps
- [x] Craftable portal core and crystal shards
- [x] Craftable village supply crates
- [x] Special block materials/textures
- [x] Hotbar updated for runtime/system blocks
- [x] Settlement supply delivery with V
- [x] Settlement prosperity, stockpiles, and active tasks
- [x] Expanded objectives for crafted system blocks and village supply
- [x] High contrast HUD mode
- [x] Reduced motion mode
- [x] Responsive/mobile HUD and inventory polish
- [x] Runtime status panel expansion
- [x] Tool/mining support for special blocks

### Batch 33 — Placed systems simulation and sync mega-batch
- [x] Buildable redstone simulation linking placed blocks
- [x] Full portal placement activation near placed portal cores
- [x] Dimension-specific visual overlays
- [x] Civilization jobs/economy expansion
- [x] Advanced multiplayer synchronization UI
- [x] Quest/progression expansion
- [x] Runtime status expansion for placed systems
- [x] Authority packet/ping/sync metrics
- [x] Settlement task progress loop
- [x] Powered placed lamp objective
- [x] Portal core proximity status
- [x] System block mining/crafting integration verified

### Super Batch 34 — WebGPU/Vulkan-path rendering and native prep
- [x] BabylonJS WebGPU-first engine initialization
- [x] WebGL fallback engine initialization
- [x] Renderer backend detection and HUD display
- [x] Renderer setting: Auto WebGPU-first
- [x] Renderer setting: Prefer WebGPU
- [x] Renderer setting: Force WebGL
- [x] Render scale setting
- [x] Quality preset setting
- [x] Quality preset render distance hookup
- [x] Fog toggle setting
- [x] Post-processing foundation toggle
- [x] Vulkan reality/requirements documentation
- [x] Native Vulkan preparation folder
- [x] Vulkan requirements manifest
- [x] Build/test validation after renderer refactor

### Super Batch 35 — Final systems connection and polish acceleration
- [x] Advanced placed redstone powered-lamp visualization
- [x] Portal-core transition pulse effect
- [x] Dimension transition effect feedback
- [x] Civilization barter/trading keybind
- [x] Settlement trade counters
- [x] Settlement task/prosperity progression refinement
- [x] Advanced multiplayer sync metrics: jitter, snapshots, rollback, prediction error
- [x] Multiplayer sync quality display
- [x] Expanded runtime systems HUD telemetry
- [x] Expanded quest objectives for barter and sync quality
- [x] Build/test validation after systems integration

### Batch 36+ — Remaining final parity super-batches
- [ ] Full portal placement terrain transitions
- [ ] Advanced redstone graph propagation distance/pathfinding
- [ ] Civilization economy task UI and trading panel
- [ ] Advanced multiplayer synchronization visualization
- [ ] Native Vulkan runtime implementation option
- [ ] Final QA, balancing, accessibility, and packaging polish

## Operating rule

Continue in incremental batches with build/test verification after each batch. If the Arena session stops, resume from this file and the latest completed batch report.

### Batch 36 — EAOIN 3.0 Next Generation Unreveals
- [x] Version 3.0.0 release branding
- [x] Official Vulkan/WebGPU mode default
- [x] Official shaders setting default
- [x] Story Mode and Incredible Mode
- [x] Rare McDonald's half seed support
- [x] Official command console and slash commands
- [x] Dynamic time-of-day and time freeze/resume
- [x] Realistic lighting and animated 3D sun
- [x] Solar system and Mars visuals
- [x] Black hole singularity visual runtime
- [x] Rockets and moon runtime
- [x] Doors and dimensional doors
- [x] Megacity biome placeholder and civilians
- [x] Pirates, dams, power plants, sewers
- [x] Ender islands, dragon, Abyss tentacle finale
- [x] Ending credits and god mode reward state
- [x] Water/glass/tree/cloth physics visual foundations
- [x] Particle/smoke upgrades
- [x] Marketplace and modding API foundation
- [x] Texture pack switching
- [x] Command block/time machine/door/rocket/moon blocks and recipes

### Batch 37+ — Remaining finalization
- [ ] Deep production implementations for city AI/economy/quests
- [ ] Full boss fight mechanics and credit sequence cinematics
- [ ] Native Vulkan swapchain and renderer bridge
- [ ] Deep multiplayer servers and replication
- [ ] Marketplace creator/publishing flow
- [ ] Full modding SDK and resource pack loader
- [ ] Final QA/balancing/performance polish

### Batch 37 — EAOIN 3.1 Next Generation Universals Part Two
- [x] Native Vulkan swapchain source module
- [x] Native Vulkan voxel renderer source module
- [x] Native voxel vertex/index buffer upload path
- [x] Native CMake target expansion
- [x] Advanced 400km city economy runtime
- [x] Advanced physics simulation state runtime
- [x] Server-side replication manager
- [x] Dedicated server replication integration
- [x] Server marketplace publishing backend
- [x] Resource pack loader and modding SDK foundation
- [x] Runtime HUD expansion for economy/marketplace/physics
- [x] 3.1 release documentation

### Batch 38+ — Remaining native/production finalization
- [ ] Native Vulkan window/surface creation
- [ ] Native Vulkan render pass/pipeline/command buffers
- [ ] Native SPIR-V shader pipeline
- [ ] Full cinematic credits shot sequencing
- [ ] Deep city NPC pathfinding and economy UI
- [ ] Marketplace creator UI and payment simulation
- [ ] Full resource-pack file import flow
- [ ] Advanced multiplayer client UI and reconciliation debug view

### Batch 38 — EAOIN 4.0 End Game Update
- [x] Native Vulkan window/surface abstraction
- [x] Native Vulkan render pass/pipeline abstraction
- [x] Native GLSL voxel shader sources
- [x] CMake shader compilation hooks
- [x] Full cinematic credits overlay and skip flow
- [x] City economy HUD expansion
- [x] Advanced physics HUD expansion
- [x] Server marketplace publishing backend
- [x] Server replication backend integration
- [x] Resource-pack loader foundation
- [x] Multiplayer replication manager
- [x] 4.0 release documentation

### Batch 39+ — Native build environment and release hardening
- [ ] Compile native Vulkan target on machine with Vulkan SDK/CMake/GLFW
- [ ] Add platform installers/packages
- [ ] Add automated end-to-end browser playtest
- [ ] Add native render loop presentation once platform surface is available
- [ ] Final accessibility/performance certification pass

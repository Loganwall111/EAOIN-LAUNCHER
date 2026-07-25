# EAOIN 3.0 — Next Generation Unreveals Update

This update marks the largest gameplay and presentation jump so far. It expands EAOIN from a playable sandbox into a next-generation experimental world platform with planets, story systems, cities, pirates, official commands, official Vulkan/WebGPU mode, rockets, moon runtime, dimensional doors, marketplace/modding foundations, and ending content.

## Major additions

- Version promoted to `3.0.0`.
- Release name: **Next Generation Unreveals**.
- Official Vulkan mode enabled by default through BabylonJS WebGPU-first rendering plus native Vulkan bootstrap path.
- Official shader setting enabled by default.
- Commands are now official gameplay UI, opened with `/`.
- Added Story Mode and Incredible Mode.
- Added rare seed behavior for `McDonald's half`.
- Added solar system runtime with visible planets including Mars.
- Added star/multiverse presentation counters.
- Added black hole singularity visual runtime.
- Added rocket and moon runtime.
- Added dimensional doors and regular doors.
- Added megacity biome placeholder: Auralis Megacity, 400km lore scale.
- Added civilians/city runtime counters.
- Added pirates roaming lake visuals.
- Added Ender/Abyss story finale runtime.
- Added dragon and tentacle boss health/progression.
- Added ending credits runtime state.
- Added God mode/Apparent Apotheosis reward state.
- Added water/glass/tree/cloth physics visual flags and showcase props.
- Added falling/smoke/ambient particle upgrades.
- Added animated 3D sun with shifting sky color/light variants.
- Added dams, power plants, and sewer system visuals.
- Added marketplace showcase with initial mod packs.
- Added modding API/resource pack status foundation.
- Added texture packs: Classic, Soft, Vibrant, Noir.
- Added command blocks, time machines, doors, dimensional doors, rocket cores, and moon rocks.
- Added recipes for the new experimental systems.

## New controls

- `/` — command console
- `/help` — command list
- `/day`, `/night`, `/time <0-24|infinite|resume>` — time commands
- `/vulkan on|off` — Vulkan/WebGPU mode
- `/shader on|off` — shader toggle
- `/particles on|off` — particles toggle
- `/texture classic|soft|vibrant|noir` — texture pack swap
- `/summon <entity>` — modding API summon preview
- `N` — damage/progress final dragon/tentacle bosses
- `C` — start ending credits if unlocked/creative/incredible
- `H` — toggle god/editor mode when unlocked
- `G` — use nearby regular/dimensional door
- `R` — launch nearby rocket to moon runtime
- `P` — portal/dimension cycle
- `L` — redstone signal toggle
- `V` — deliver settlement supplies
- `B` — barter with settlement
- `I/E` — inventory/crafting
- `O` — settings
- `Esc` — pause

## Vulkan status

EAOIN 3.0 makes Vulkan mode official in the gameplay/settings layer. The browser renderer uses BabylonJS WebGPU-first mode, which is the browser-compatible Vulkan-adjacent route. The native Vulkan bootstrap added in 1.0 remains available for native runtime expansion.

## Validation

- `npm run build` passes.
- `npm test` passes.

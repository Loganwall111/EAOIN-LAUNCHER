# EAOIN 2.0 — UI and Graphics Overhaul

EAOIN 2.0 is a major code-size update that promotes the playable 1.0 vertical slice into a more complete experimental sandbox platform.

## Release focus

- Minecraft-inspired but EAOIN-styled UI overhaul
- Experimental Vulkan/WebGPU mode toggle
- Realistic overworld lighting/time-of-day mechanics
- Switchable particles
- Command console and command-block foundation
- Creative / Survival / Experimental mode selection
- Texture pack and shader experiment settings
- Modding API/resource pack foundation
- Server/multiplayer availability indicators
- Doors, dimensional doors, rockets, and moon runtime

## New controls

- `/` — open command console
- `/day` — set day
- `/night` — set night
- `/time <0-24>` — set time
- `/time infinite` — freeze time
- `/time resume` — resume time
- `/vulkan on|off` — experimental Vulkan/WebGPU mode
- `/shader on|off` — shader experiment toggle
- `/particles on|off` — particle toggle
- `/texture classic|soft|vibrant|noir` — texture pack swap
- `G` — use nearby door/dimensional door
- `R` — launch nearby rocket to moon runtime
- `P` — cycle portal/dimension runtime
- `L` — toggle redstone signal
- `V` — deliver settlement supplies
- `B` — barter with settlement
- `I/E` — inventory/crafting
- `O` — settings
- `Esc` — pause

## Experimental Vulkan mode

The 2.0 experimental Vulkan toggle enables the BabylonJS WebGPU path and realistic lighting profile. In the browser, this is Vulkan-adjacent rather than raw Vulkan. True native Vulkan remains in the native bootstrap path introduced in 1.0.

## Visual updates

- Dynamic time-of-day lighting
- Realistic lighting profile toggle
- Fog toggle
- Particle runtime
- Texture pack runtime: Classic, Soft, Vibrant, Noir
- Moon, Crystal Realm, and Abyss overlays
- More polished HUD panels and toggle switches

## Systems added

- Command runtime
- Ambient particle runtime
- Door/dimensional door runtime
- Rocket/moon runtime
- Modding API/resource pack status foundation
- Expanded block registry for command blocks, time machines, doors, rocket cores, and moon rocks

## Validation

- `npm run build` passes
- `npm test` passes

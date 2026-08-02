# BATCH 48 — Controller & mobile (touch) support (off by default)

Adds gamepad and on-screen mobile controls, both **off by default** (PC
keyboard + mouse stays the default). Each can be switched on in the Options
screen (reachable both from the main menu and in-game).

## What was added

### Settings toggles
- **Controller support** — `controllerSupport: false` by default.
- **Touch controls** — `touchControls: false` by default.
- Both live in Settings → **Gameplay**, shared by the main-menu Options screen
  and the in-game settings panel.

### 🎮 Controller support (when enabled)
A connected gamepad drives the camera on top of the normal scheme:
- **Left stick** — move (walk / strafe).
- **Right stick** — look around.
- **A** — jump / swim up.
- **B** — toggle flight.
- **X / RT** — mine / attack.
- **Y / LT** — place a block.
- **LB / RB** — cycle hotbar slots.
- **Select** — inventory. **Start** — pause.
- **Left trigger / LB** — open chat. **Right trigger / RB** — open the command
  console (the "console button for controllers").
Buttons are edge-triggered so holding one doesn't spam the action.

### 📱 Touch / mobile controls (when enabled)
An on-screen overlay appears over the world:
- **Virtual left joystick** to walk.
- **Drag anywhere on the world** to look around (Minecraft-PE style).
- **Action buttons**: MINE, PLACE, JUMP, FLY, INVENTORY, CHAT, hotbar next/prev.
- **Bottom buttons**: ⏸ Pause and a **console (≣)** button to open commands.

Both schemes layer onto the existing keyboard/mouse input, so they never
conflict — enabling them just adds another input path.

## Build & tests
- Full suite: **54 files, 597 tests — all passing**.
- `npm run build` → **0 type errors**.

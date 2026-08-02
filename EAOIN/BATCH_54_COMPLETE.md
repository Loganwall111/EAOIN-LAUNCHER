# BATCH 54 — Part 3 (Stage B): AI assistant + character creator overhaul

## What was added

### 🤖 AI Assistant (in-game `/ai`)
- Chat commands: `/ai build <what>` (blueprints a structure), `/ai mod <what>`
  (drafts a mod/block), `/ai teleport <x> <z>` (teleports you), `/ai summon
  <npc>` (spawns an NPC player variant), and `/ai help`.
- NPC player variants with unique names / styles / capes (Alex, Aria, Zed,
  Nova).

### 🧍 Character creator overhaul
- The preview avatar now **auto-spins** (a real spinnable 3D-feel turntable),
  with a ▶/⏸ toggle and manual ↺/↻ rotate buttons.
- New **cape** cosmetic: pick from Classic / Cosmic / Ember / Galaxy / Knight
  (or none) in the Accessories tab — rendered as a flowing cape on the avatar.
- CharacterAppearance gained a `cape` field (persisted).

## Build & tests
- Full suite: **54 files, 597 tests — all passing**.
- `npm run build` → **0 type errors**.

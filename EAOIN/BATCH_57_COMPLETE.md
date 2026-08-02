# BATCH 57 — The Final Release: HUD fixes, wake-up fix, voices, World's Edge, rails & minecarts

## UI fixes
- **Quests no longer cover the minimap** — the active-quest panel is moved down
  clear of the minimap.
- **Effects rail moved** — the pickaxe/lightning status effects now sit small at
  the top-right beside the minimap instead of covering the bottom-left game
  menus.

## Wake-up fix
- The Cosmic Girl / eyes-open wake-up sequence now plays **only once per new
  world**. Loading an existing world goes **straight back to where you left off**
  — no repeated wake-up screen.

## Narrator voice fix
- The boot narrator no longer repeats/cuts off. Each realistic voice clip now
  plays **all the way through** and only advances to the next line when the
  audio actually ends (instead of a fixed timer that duplicated words).

## World's Edge (new world type)
- A new exclusive survival world type: the world **has an end**. Cross the Edge
  and tentacles drag you down to the world-eating monster (a death cutscene).
- The monster **punches holes through reality**, corrupting the land, and the
  whole world is on a **56-minute timer** — when it expires the world is
  consumed. Creative (via cheats) is the only way to survive it.
- New rails & minecarts: place Rail / Powered Rail and a Minecart, then click
  the minecart to ride along the track. Cities now have a rail line.

## Caves & water
- **Stalactites & stalagmites** in the rift dimension.
- **Glowing coloured water pools** (purple / pink), plus winter (frozen) and
  beach (turquoise) water variants.

## Final release naming
- The release is now named **"The Final Release — Coloured Lighting & World's
  Edge"**, the launcher version is updated, and a World's Edge build + patch
  note were added.

## Build & tests
- Full suite: **54 files, 597 tests — all passing**.
- `npm run build` → **0 type errors**.

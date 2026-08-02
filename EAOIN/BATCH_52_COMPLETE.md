# BATCH 52 — Severe bug fixes: studio sign overflow, missing intro scenes, launcher typo, HUD spacing

This batch fixes the most important issues you reported.

## What was fixed

### 🪧 "ONEBLOCKAWAY" sign was slanted / cut off the screen
- The studio title was `clamp(58px, 15vw, 200px)` with wide letter-spacing, so
  the full word ran off the right edge on narrower/short screens (iPad etc.).
- It's now scaled to always fit (`clamp(28px, 7vw, 130px)`), the letter-spacing
  is tightened, and it wraps instead of overflowing. The "STUDIO" rule and
  "PRESENTS" stamp were also scaled down / tightened so nothing is cut off.

### 🎬 Warning / Engine / Credits scenes were "missing" (only dots + bottom tags)
- Root cause: a **stray tap / click / keypress was skipping the intro** straight
  to the ready card, so on touch devices you only ever saw the background dots.
- Now **only the Escape key deliberately skips** the intro. Any stray press just
  finishes once the sequence reaches the "Press any key" screen — so the warning,
  the Obsidian Engine card, the credits and the rest all actually play.
- Added a tablet/narrow breakpoint so those scenes collapse to a single column
  and their text is never clipped on smaller screens.

### ✏️ Launcher typo
- The launcher (and its boot flash) now reads **ONEBLOCKAWAY STUDIOS** (with an
  S) instead of "STUDIO".

### 🧩 HUD squished / chat overlapping mobile controls
- The HUD panels now keep clear zones:
  - Chat is raised clear of the hotbar.
  - When **touch controls** are on, the chat, command console and nav shift clear
    of the left joystick, and the abilities/equipped card lift clear of the right
    action-button column — nothing piles on top of the chat anymore.
  - Touch joystick + action buttons were made more compact so they don't crowd
    the hotbar.

## Build & tests
- Full suite: **54 files, 597 tests — all passing** (updated the boot test to
  reflect that only Escape skips the intro).
- `npm run build` → **0 type errors**.

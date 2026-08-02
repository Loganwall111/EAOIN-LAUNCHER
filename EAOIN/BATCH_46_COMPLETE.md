# BATCH 46 — Fix the ONEBLOCKAWAY intro actually showing (two real root causes)

## What was actually happening
You were seeing the studio **status-rail** text ("ONEBLOCKAWAY STUDIO" at the
very top) but the big studio **title card** as a black/blue screen — because two
separate bugs were hiding it:

1. **Invisible title text (opacity 0 fill-mode).** The studio scene and title
   used `animation-fill-mode: both` with keyframes that start at `opacity: 0`,
   and the scene's animation (`cbSceneBeat`) even **fades back out to opacity 0**
   at the end. On your browser the studio title/text stayed stuck invisible, so
   the card read as an empty black screen with only the sigil showing.

2. **Black boot background (404 image).** The boot stylesheet loaded its
   panorama from a hard-coded absolute path `url('/ui/menu-panorama.jpg')`.
   GitHub Pages serves the game from a sub-folder (`/workspace-…/`), so that
   path 404s and the whole intro sat on a black background.

## The fixes
- **Studio scene now uses a dedicated staying-visible fade-in** that lands at
  `opacity: 1` and stays (no fade-out, no hidden fill-mode state).
- **ONEBLOCKAWAY title and "PRESENTS" tagline are now base-visible** — solid
  white with a cyan glow, opacity 1 by default, so they can never be stuck
  hidden by a CSS animation. The cinematic zoom-in reveal is kept.
- **Boot background is now base-path aware.** The panorama URL is resolved with
  `import.meta.env.BASE_URL` (via a `--cb-panorama` CSS variable set at startup)
  and used by every boot phase, so the intro has its real panorama backdrop on
  any deployment instead of a black screen.

## Note on caching
Please do a hard refresh (Ctrl/Cmd+Shift+R) after this deploy. If you still see
the old intro, it's a cached bundle — the CSS/JS is now fixed.

## Build & tests
- Full suite: **54 files, 597 tests — all passing**.
- `npm run build` → **0 type errors**.

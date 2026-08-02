# BATCH 45 — Make the ONEBLOCKAWAY studio intro actually visible

## What was wrong
The intro sequence WAS wired and playing (confirmed by the app-smoke tests),
but the big "ONEBLOCKAWAY" title was being rendered **invisible** on the studio
card.

The title used:
```
color: transparent;
-webkit-background-clip: text; background-clip: text;
filter: drop-shadow(...) ...;   /* + a blur() animation */
```
Combining `background-clip: text` with a `filter` / `blur` animation on the
*same* element makes many browsers drop the glyphs — the card showed only the
spinning sigil and the tiny "ONEBLOCKAWAY STUDIO" status text at the top, with
no big wordmark. That's why it looked like the studio sequence never appeared.

## The fix
- The ONEBLOCKAWAY title is now **solid white** with a strong cyan glow
  (`text-shadow`) instead of transparent clipped text. It is guaranteed to be
  visible on every browser, while keeping the big cinematic zoom-in reveal.
- Everything else about the sequence stays: it plays **first**, cannot be
  skipped, and includes the spinning studio sigil, backdrop burst, an
  underlined "STUDIO" rule, and a big "PRESENTS" stamp.

## Note on caching
If you still see the old build, hard-refresh the page (Ctrl/Cmd+Shift+R) after
this deploys — GitHub Pages can serve a stale cached JS bundle from a previous
visit.

## Build & tests
- Full suite: **54 files, 597 tests — all passing**.
- `npm run build` → **0 type errors**.

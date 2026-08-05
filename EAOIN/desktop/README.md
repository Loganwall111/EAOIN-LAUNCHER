# EAOIN — Desktop Edition (Electron)

This folder turns the web game (built into `EAOIN/dist`) into a **native,
sellable desktop app** using [Electron](https://www.electronjs.org/) +
[electron-builder](https://www.electron.build/). It produces real installers:

| Platform | Output | Notes |
|----------|--------|-------|
| Windows | `.exe` installer (NSIS) **+** portable `.exe` | 64-bit |
| macOS | `.dmg` **+** `.zip` | x64 and arm64 (Apple Silicon) |
| Linux | `.AppImage` **+** `.deb` | |

## Prerequisites (run on your own computer, not a browser)

- **Node.js 20+** and npm.
- On **Windows**, installer signing/`rcedit` needs no extra tools for an
  unsigned build, but for a polished commercial release you'll want a code
  signing cert (see "Selling" below).
- On **macOS**, you must build the `.dmg` **on a Mac**, and signing requires an
  Apple Developer ID (see "Selling").

## Quick start

```bash
# 1. Build the web game once (produces EAOIN/dist)
cd ../        # into EAOIN/
npm install
npm run build
cd desktop

# 2. Install the desktop tooling (Electron + electron-builder)
npm install

# 3a. Run it as a desktop app (dev loop)
npm start

# 3b. Or build installers for your OS
npm run dist           # builds for the current OS
npm run dist:win       # Windows
npm run dist:mac       # macOS (must be run on a Mac)
npm run dist:linux     # Linux
```

Installers land in `desktop/release/`.

## How it works

1. `npm run build` compiles the game into `EAOIN/dist` (Vite, relative asset
   paths so it works over the `file://` protocol Electron uses).
2. `scripts/prepare-game.mjs` copies that build into `desktop/game-build/`.
3. `main.js` opens a native `BrowserWindow` and loads
   `game-build/index.html?launch=1`. The `?launch=1` query reuses the game's
   existing "seamless alpha bridge" — it skips the in-app launcher boot and
   lands straight on the title screen.
4. `preload.cjs` exposes a tiny `window.eaoinDesktop` object (platform/version
   info) through the secure context bridge. No Node APIs leak into the game.
5. electron-builder packages `game-build/` + the Electron runtime into
   installers, using `build/icon.png` (512×512) to auto-generate each
   platform's icon.

### Keyboard / window niceties built in

- **F11** toggles fullscreen.
- External links (e.g. the Alpha Launcher URL) open in the system browser, not
  inside the game window.
- World saves use `localStorage`, which Electron persists under the OS app-data
  directory — so players' worlds survive restarts and uninstalls cleanly.

## Project layout

```
desktop/
├── main.js                 # Electron main process (ESM)
├── preload.cjs             # Secure context bridge
├── electron-builder.yml    # Installer config for all 3 OSes
├── package.json            # Desktop-only deps (electron, electron-builder)
├── scripts/
│   └── prepare-game.mjs    # Copies EAOIN/dist -> game-build
├── build/
│   └── icon.png            # 512x512 app icon (electron-builder converts it)
├── game-build/             # Staged game build (generated, git-ignored)
└── release/                # Produced installers (generated, git-ignored)
```

## Selling it — what to do before you ship

1. **Icons.** Replace `build/icon.png` with your final brand icon (must be
   ≥512×512). electron-builder converts it to `.ico`/`.icns` automatically.

2. **App identity.** Update these in `electron-builder.yml` / `package.json`:
   - `appId` (e.g. `com.yourname.eaoin`) — keep it unique and permanent; it's
     how the OS tracks the app.
   - `productName`, `copyright`, `version`.

3. **Code signing (recommended for paid releases).**
   - **Windows:** buy an Authenticode code-signing cert (e.g. Sectigo/DigiCert)
     and configure it via electron-builder's `win.certificateFile` /
     `WIN_CSC_LINK` env. Without a cert, SmartScreen will warn on install.
   - **macOS:** join the Apple Developer Program and sign with your Developer
     ID + notarize. electron-builder supports `mac.identity` / `CSC_LINK`.
     A `.dmg` built and signed **must be built on macOS**.

4. **Choose a storefront.** These installers are platform-native files, so you
   can sell on:
   - **itch.io** — easiest for indies; upload the `.exe`, `.dmg`, `.AppImage`,
     `.deb`. Great DRM-free option, low fees.
   - **Steam / Epic / GOG** — larger reach but require storefront approval and
     usually their own SDK integration.
   - **Your own site** with a payment provider (Gumroad, Lemon Squeezy) and the
     installers hosted behind a download link.

5. **Set a price & EULA.** electron-builder doesn't embed a EULA by default;
   add one in the NSIS config (`nsis.license`) for Windows if you want an
   install-time agreement.

## Troubleshooting

- **"Missing web build"** → run `npm run build:game` (or `npm install && npm
  run build` in `EAOIN/`) first.
- **Black / blank window** → make sure `EAOIN/dist` was built with the current
  source (`npm run build`), then re-run `npm run prepare` and `npm start`.
- **Windows icon issues** → your `build/icon.png` must be at least 256×256
  (512 recommended). 
- **macOS build from Windows/Linux fails** → that's expected; `.dmg`/`.icns`
  require macOS.

> **Tip for a commercial release:** keep `desktop/` in the same repo so you can
> rebuild installers from any tagged `v2.0.0-*` release. When you cut a new
> game version, just `npm run build` + `npm run dist` again.

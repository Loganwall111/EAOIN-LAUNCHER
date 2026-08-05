/**
 * EAOIN desktop preload script.
 *
 * Runs in an isolated context before the page. We keep the surface tiny: just
 * expose a read-only `window.eaoinDesktop` flag + platform info so the game can
 * (optionally) detect it is running as a native app. No Node APIs leak into the
 * game window beyond this.
 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('eaoinDesktop', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});

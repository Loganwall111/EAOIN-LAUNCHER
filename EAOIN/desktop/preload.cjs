/**
 * EAOIN desktop preload script.
 *
 * Runs in an isolated context before the page. We keep the surface tiny: just
 * expose a read-only `window.eaoinDesktop` flag + platform info so the game can
 * detect it is running as a native app (and, when built as the FREE DEMO, that
 * it is the demo edition). No Node APIs leak into the game window beyond this.
 *
 * The demo is enabled by running with EAOIN_DEMO=1 (set by the demo build /
 * npm scripts). In the full build it is absent and the game is unchanged.
 */
const { contextBridge } = require('electron');

const isDemo = process.env.EAOIN_DEMO === '1';

contextBridge.exposeInMainWorld('eaoinDesktop', {
  isDesktop: true,
  isDemo,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});

/**
 * Desktop Edition detection.
 *
 * The Electron desktop build (EAOIN/desktop) exposes a tiny read-only object
 * via its preload script's context bridge. This declaration lets the game
 * safely detect when it is running as a native app, and (when built as the
 * free demo) that it is the demo edition. It is entirely optional — in the
 * browser this global is simply absent.
 */
interface EaoinDesktopInfo {
  isDesktop: boolean;
  /** True only in the free "EAOIN Demo" desktop build (EAOIN_DEMO=1). */
  isDemo?: boolean;
  platform: string;
  versions: {
    electron: string;
    chrome: string;
    node: string;
  };
}

interface Window {
  eaoinDesktop?: EaoinDesktopInfo;
}

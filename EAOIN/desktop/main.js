/**
 * EAOIN desktop (Electron) main process.
 *
 * Loads the production Vite build (EAOIN/dist) inside a native window. The
 * game boots straight to the title screen via the `?launch=1` query param —
 * the same "seamless alpha bridge" the web build uses to skip its launcher
 * boot.
 *
 * Note: this file is ESM because the desktop package.json declares
 * `"type": "module"` (Electron 28+ supports an ESM main process).
 */
import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where the built game lives:
 *   - dev / this repo: desktop/game-build  (staged by scripts/prepare-game.mjs)
 *   - packaged app:    <resources>/app/game-build
 * Both cases resolve to app.getAppPath() + 'game-build'.
 */
function resolveGameDir() {
  return path.join(app.getAppPath(), 'game-build');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0a0612',
    title: 'EAOIN — Ultimate Sandbox Engine',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  // Show once the game has painted, so the first frame isn't a white/black flash.
  win.once('ready-to-show', () => win.show());

  const gameDir = resolveGameDir();
  win.loadFile(path.join(gameDir, 'index.html'), { query: { launch: '1' } });

  // Open any external links (e.g. the Alpha Launcher URL) in the system browser
  // instead of inside the game window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // F11 toggles fullscreen — a small, familiar desktop nicety.
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
    }
  });

  // Log (don't crash on) load failures. -3 is "aborted", which is normal.
  win.webContents.on('did-fail-load', (_event, code, description) => {
    if (code === -3) return;
    console.error(`[EAOIN desktop] failed to load game: ${code} ${description}`);
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();

  // macOS: re-create a window when the dock icon is clicked.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed (except on macOS).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

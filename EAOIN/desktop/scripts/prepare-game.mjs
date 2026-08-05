/**
 * prepare-game.mjs — stage the freshly-built web game into the desktop app.
 *
 * electron-builder packages files relative to the desktop package root, so we
 * copy the Vite build (EAOIN/dist) into desktop/game-build before packaging.
 * This keeps the Electron packaging self-contained while the actual source
 * lives one directory up.
 *
 * Usage: node scripts/prepare-game.mjs
 */
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url)); // desktop/scripts
const desktopDir = path.join(scriptDir, '..');                   // desktop
const gameDist = path.join(desktopDir, '..', 'dist');            // EAOIN/dist
const target = path.join(desktopDir, 'game-build');              // desktop/game-build

if (!existsSync(gameDist)) {
  console.error(
    `[EAOIN desktop] Missing web build at ${gameDist}. Run "npm run build:game" first.`
  );
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(gameDist, target, { recursive: true });
console.log(`[EAOIN desktop] staged web build -> ${target}`);

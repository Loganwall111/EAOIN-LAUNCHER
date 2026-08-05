#!/usr/bin/env node
/**
 * build-demo.js — build the FREE EAOIN DEMO desktop edition.
 *
 * Cross-platform. It:
 *   1. Verifies game + desktop dependencies (installs desktop deps if missing).
 *   2. Compiles the production web app (Vite -> ../dist).
 *   3. Stages that build into desktop/game-build.
 *   4. Runs electron-builder with the DEMO config while setting EAOIN_DEMO=1 —
 *      the preload exposes window.eaoinDesktop.isDemo=true, which activates the
 *      30-minute Singularity session, the daily experimental-mode allowance,
 *      and the ending locks (all in src/demo/DemoMode.ts).
 *
 * Usage:
 *   node scripts/build-demo.js          (from desktop/)
 *   npm run dist:demo
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.join(scriptDir, '..');
const gameDir = path.join(desktopDir, '..');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxBin = path.join(desktopDir, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder');
const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', BLD = '\x1b[1m', RST = '\x1b[0m';
const ok = (m) => console.log(`${GRN}[demo]${RST} ${m}`);
const warn = (m) => console.log(`${YEL}[demo]${RST} ${m}`);
const fail = (m) => console.error(`${RED}[demo]${RST} ${m}`);

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  if (res.error) { fail(`Failed to launch ${cmd}: ${res.error.message}`); process.exit(1); }
  if (res.status !== 0) { fail(`"${cmd} ${args.join(' ')}" exited with code ${res.status}`); process.exit(res.status); }
}

console.log(`${BLD}\n=== EAOIN · FREE DEMO build ===\n${RST}`);

if (!existsSync(path.join(gameDir, 'node_modules'))) {
  fail(`Game dependencies missing at ${path.join(gameDir, 'node_modules')}. Run \`npm install\` in EAOIN/ first.`);
  process.exit(1);
}
ok(`game dependencies present`);

if (!existsSync(path.join(desktopDir, 'node_modules'))) {
  warn('Desktop dependencies missing — installing now...');
  run(npmCmd, ['install'], { cwd: desktopDir });
}
if (!existsSync(npxBin)) { fail(`electron-builder not found at ${npxBin}`); process.exit(1); }
ok(`electron-builder present`);

ok('building production web app (Vite)...');
run(npmCmd, ['run', 'build'], { cwd: gameDir });
if (!existsSync(path.join(gameDir, 'dist', 'index.html'))) { fail('Vite build produced no dist/index.html'); process.exit(1); }

ok('staging web build into desktop/game-build...');
run('node', [path.join(scriptDir, 'prepare-game.mjs')], { cwd: desktopDir });

ok('packaging EAOIN DEMO with electron-builder (EAOIN_DEMO=1)...');
process.env.EAOIN_DEMO = '1';
run(npxBin, ['--win', 'dir', '-c', path.join(desktopDir, 'electron-builder.demo.yml')], { cwd: desktopDir });

console.log(`${BLD}\n=== DEMO BUILD COMPLETE =========================================================${RST}`);
console.log(`  ${GRN}Demo output:${RST} ${path.join(desktopDir, 'release-demo', 'win-unpacked')}`);
console.log(`  ${GRN}Demo flag:${RST} EAOIN_DEMO=1 (30-min Singularity, daily experimental allowance, ending locked)${RST}\n`);

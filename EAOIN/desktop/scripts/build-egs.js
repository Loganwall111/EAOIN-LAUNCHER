#!/usr/bin/env node
/**
 * build-egs.js — one-command Epic Games Store (EGS) build pipeline.
 *
 * Cross-platform (Windows / macOS / Linux). It:
 *   1. Verifies game + desktop dependencies are installed (auto-installs the
 *      production-only desktop deps if they're missing).
 *   2. Compiles the production web app (Vite -> ../dist).
 *   3. Stages that build into desktop/game-build.
 *   4. Runs electron-builder with the EGS config (win/dir target), which
 *      produces a clean unpacked folder: desktop/release-egs/win-unpacked/.
 *   5. Runs safety checks and logs the final artifact path.
 *
 * It does NOT talk to Epic — see deploy-egs.js for the Build Patch Tool step.
 *
 * Usage:
 *   node scripts/build-egs.js            (from desktop/)
 *   npm run build:egs                    (same)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url)); // desktop/scripts
const desktopDir = path.join(scriptDir, '..');                   // desktop
const gameDir = path.join(desktopDir, '..');                      // EAOIN
const gameDist = path.join(gameDir, 'dist');                      // EAOIN/dist
const gameBuild = path.join(desktopDir, 'game-build');            // desktop/game-build
const egsOutput = path.join(desktopDir, 'release-egs');           // desktop/release-egs
const egsUnpacked = path.join(egsOutput, 'win-unpacked');         // the dir BPT wants

const useNpm = process.platform !== 'win32' || process.env.npm_execpath?.includes('npm');
const npmCmd = useNpm ? (process.platform === 'win32' ? 'npm.cmd' : 'npm') : process.env.npm_execpath;
const npxBin = path.join(desktopDir, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder');

const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', BLD = '\x1b[1m', RST = '\x1b[0m';
const ok = (m) => console.log(`${GRN}[build-egs]${RST} ${m}`);
const warn = (m) => console.log(`${YEL}[build-egs]${RST} ${m}`);
const fail = (m) => console.error(`${RED}[build-egs]${RST} ${m}`);

/** Run a command, streaming output. Aborts the whole pipeline on non-zero exit. */
function run(cmd, args, opts = {}) {
  const label = opts.label || `${cmd} ${args.join(' ')}`;
  ok(`▶ ${label}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  if (res.error) { fail(`Failed to launch ${label}: ${res.error.message}`); process.exit(1); }
  if (res.status !== 0) {
    fail(`"${label}" exited with code ${res.status}`);
    process.exit(res.status);
  }
  return res;
}

/** Ensure a non-empty folder exists, else print a clear actionable error. */
function ensureDir(dir, what) {
  if (!existsSync(dir)) {
    fail(`Missing required directory: ${dir}`);
    fail(`Expected to find ${what}. Something went wrong in an earlier step.`);
    process.exit(1);
  }
  const st = statSync(dir);
  if (!st.isDirectory()) { fail(`${dir} exists but is not a directory.`); process.exit(1); }
  ok(`found ${what}: ${dir}`);
}

console.log(`${BLD}\n=== EAOIN · Epic Games Store build ===\n${RST}`);

/* 1. Dependency checks -------------------------------------------------- */
if (!existsSync(path.join(gameDir, 'node_modules'))) {
  fail(`Game dependencies missing at ${path.join(gameDir, 'node_modules')}.`);
  fail('Run `npm install` in the EAOIN/ folder first, then retry.');
  process.exit(1);
}
ok(`game dependencies present (${gameDir}/node_modules)`);

if (!existsSync(path.join(desktopDir, 'node_modules'))) {
  warn('Desktop (Electron) dependencies not installed — installing now...');
  run(npmCmd, ['install'], { cwd: desktopDir, label: 'npm install (desktop deps)' });
}

if (!existsSync(npxBin)) {
  fail(`electron-builder not found at ${npxBin}.`);
  fail('After `npm install` in desktop/, this file should exist. Re-run the script.');
  process.exit(1);
}
ok(`electron-builder present`);

/* 2. Compile the production web app ------------------------------------ */
ok('building production web app (Vite)...');
run(npmCmd, ['run', 'build'], { cwd: gameDir, label: 'npm run build (web app)' });
ensureDir(gameDist, 'the Vite build output');

/* 3. Stage the web build into the Electron app ------------------------- */
ok('staging web build into desktop/game-build...');
run('node', [path.join(scriptDir, 'prepare-game.mjs')], { cwd: desktopDir, label: 'prepare-game.mjs' });
ensureDir(gameBuild, 'the staged game build');

/* 4. Package with electron-builder (EGS dir target) -------------------- */
ok('running electron-builder (win/dir) for Epic Games Store...');
run(npxBin, ['--win', 'dir', '-c', path.join(desktopDir, 'electron-builder.egs.yml')], {
  cwd: desktopDir,
  label: 'electron-builder --win dir -c electron-builder.egs.yml',
});

/* 5. Verify the unpacked output ---------------------------------------- */
ensureDir(egsUnpacked, 'the unpacked Electron app');
const exe = process.platform === 'win32' ? 'EAOIN.exe' : 'EAOIN.exe'; // dir target is always win
if (!existsSync(path.join(egsUnpacked, exe))) {
  fail(`Expected executable not found at ${path.join(egsUnpacked, exe)}.`);
  fail('The packaged app looks incomplete. Check the electron-builder log above.');
  process.exit(1);
}
ok(`main executable present: ${exe}`);

console.log(`${BLD}\n=== BUILD COMPLETE =============================================================${RST}`);
console.log(`  ${GRN}Unpacked EGS build (BPT buildroot):${RST}`);
console.log(`    ${egsUnpacked}`);
console.log(`  ${GRN}Next step:${RST} run`);
console.log(`    npm run deploy:egs`);
console.log(`  to generate the Epic Build Patch Tool command and stage the upload.${RST}\n`);

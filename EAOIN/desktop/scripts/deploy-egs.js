#!/usr/bin/env node
/**
 * deploy-egs.js — Epic Build Patch Tool (BPT) deployment automation.
 *
 * Takes the unpacked Electron build from build-egs.js (or an existing
 * desktop/release-egs/win-unpacked folder), stages it into a clean, ready-to-
 * upload folder, and formats the exact Build Patch Tool command to push it to
 * your Epic cloud sandbox.
 *
 * IMPORTANT: this script does NOT need your Epic credentials to run. When the
 * secrets are missing it prints the command with clear placeholders so you can
 * fill them in (or it reads them from a .env.egs file / env vars). It NEVER
 * writes secrets to disk outside the optional .env.egs you create yourself.
 *
 * Credential sources (checked in order):
 *   1. Environment variables  (ORGANIZATION_ID, PRODUCT_ID, ARTIFACT_ID,
 *                              CLIENT_ID, CLIENT_SECRET)
 *   2. A desktop/.env.egs file (KEY=value lines; load it by running with
 *      `node --env-file=.env.egs scripts/deploy-egs.js`)
 * If neither is present, the command is emitted with ${PLACEHOLDER}s.
 *
 * Usage:
 *   npm run deploy:egs                 # dry-run: prints the exact command
 *   npm run deploy:egs -- --run        # actually executes the Build Patch Tool
 *
 * Exit codes: 0 = success, 1 = a required precondition failed.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url)); // desktop/scripts
const desktopDir = path.join(scriptDir, '..');                   // desktop
const gameDir = path.join(desktopDir, '..');                      // EAOIN

/** Lightweight .env loader (no dependency). Loads desktop/.env.egs if present,
 *  only filling keys that aren't already set in the real environment, so real
 *  env vars always win. Removes the need for the --env-file flag. */
function loadEnvFile() {
  const envPath = path.join(desktopDir, '.env.egs');
  if (!existsSync(envPath)) return false;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
  return true;
}
loadEnvFile();

// The packaged Electron app that BPT consumes.
const PACKAGED = path.join(desktopDir, 'release-egs', 'win-unpacked');
// The clean staging folder handed to Epic. Relative to the EAOIN folder so it
// is easy to drag-and-drop / upload. (Overridable via EPIC_STAGING_DIR.)
const STAGING = path.resolve(process.env.EPIC_STAGING_DIR || path.join(gameDir, 'dist', 'epic-store-ready'));
// Where BPT writes chunks + manifest (kept in desktop/ so it survives rebuilds).
const BPT_BUILD_DIR = path.join(desktopDir, 'release-egs', 'bpt-build');
const BPT_CHUNKDB_DIR = path.join(desktopDir, 'release-egs', 'bpt-chunkdbs');
const BPT_MANIFEST_DIR = path.join(desktopDir, 'release-egs', 'bpt-manifest');

const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', BLD = '\x1b[1m', RST = '\x1b[0m';
const ok = (m) => console.log(`${GRN}[deploy-egs]${RST} ${m}`);
const warn = (m) => console.log(`${YEL}[deploy-egs]${RST} ${m}`);
const fail = (m) => console.error(`${RED}[deploy-egs]${RST} ${m}`);

function exit(msg, code = 1) { fail(msg); process.exit(code); }

/* ---- Config / credentials ------------------------------------------- */
// BPT executable directory (override with EPIC_BPT_DIR). Search a few common
// install locations so the script works out of the box on Windows + CI.
const BPT_DIR = process.env.EPIC_BPT_DIR || findBptDir();
function findBptDir() {
  const candidates = [
    'C:\\Program Files\\Epic Games\\BuildPatchTool',
    'C:\\Program Files (x86)\\Epic Games\\BuildPatchTool',
    '/opt/Epic/BuildPatchTool',
    path.join(desktopDir, 'bpt'),
    path.join(desktopDir, 'BuildPatchTool'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      const exe = path.join(c, process.platform === 'win32' ? 'BuildPatchTool.exe' : 'BuildPatchTool');
      if (existsSync(exe)) return c;
    }
  }
  return null;
}
const BPT_EXE = BPT_DIR
  ? path.join(BPT_DIR, process.platform === 'win32' ? 'BuildPatchTool.exe' : 'BuildPatchTool')
  : 'BuildPatchTool.exe';

// Credentials — read from env (incl. --env-file) only.
const C = (k) => process.env[k];
const creds = {
  organizationId: C('ORGANIZATION_ID'),
  productId: C('PRODUCT_ID'),
  artifactId: C('ARTIFACT_ID'),
  clientId: C('CLIENT_ID'),
  clientSecret: C('CLIENT_SECRET'),
};

// Game version from desktop/package.json.
const pkg = JSON.parse(readFileSync(path.join(desktopDir, 'package.json'), 'utf8'));
const VERSION = process.env.EGS_VERSION || pkg.version || '1.0.0';

const runMode = process.argv.includes('--run');
const uploadMode = process.argv.includes('--upload'); // skip local Build, go straight to Upload

/* ---- Safety checks --------------------------------------------------- */
if (!existsSync(PACKAGED)) {
  exit(
    `Could not find the packaged Electron app at:\n    ${PACKAGED}\n` +
    `Run \`npm run build:egs\` first to produce it.`
  );
}
if (!existsSync(path.join(PACKAGED, 'EAOIN.exe'))) {
  exit(`Packaged folder exists but EAOIN.exe is missing: ${PACKAGED}`);
}
ok(`packaged Electron app found: ${PACKAGED}`);
if (!existsSync(path.join(gameDir, 'node_modules'))) {
  exit(`Game dependencies missing at ${path.join(gameDir, 'node_modules')} — run \`npm install\` in EAOIN/.`);
}
if (!runMode) {
  warn('Running in DRY-RUN mode (prints commands only). Use --run to execute the Build Patch Tool.');
}

/* ---- Stage files into a clean folder -------------------------------- */
ok(`preparing clean staging folder: ${STAGING}`);
rmSync(STAGING, { recursive: true, force: true });
mkdirSync(STAGING, { recursive: true });
cpSync(PACKAGED, STAGING, { recursive: true });
ok(`staged ${PACKAGED} -> ${STAGING}`);

// A top-level build-id file so the EGS dashboard shows a meaningful label.
writeFileSync(path.join(STAGING, 'buildid.txt'), `EAOIN v${VERSION}\n`, 'utf8');

/* ---- Build Patch Tool commands --------------------------------------- */
function quote(p) { return `"${p}"`; }
const plat = 'Win64';

// 1) Chunk the game into BPT format (skip if --upload given).
const buildCmd = uploadMode ? null : [
  quote(BPT_EXE),
  '-mode=Build',
  `-platform=${plat}`,
  `-buildroot=${quote(STAGING)}`,
  `-buildoutput=${quote(BPT_BUILD_DIR)}`,
  `-manifestoutput=${quote(BPT_MANIFEST_DIR)}`,
  `-chunkdboutputdir=${quote(BPT_CHUNKDB_DIR)}`,
  `-version=${VERSION}`,
].join(' ');

// 2) Upload to the Epic cloud sandbox. Secrets are placeholders when absent.
const uploadCmd = [
  quote(BPT_EXE),
  '-mode=Upload',
  `-platform=${plat}`,
  `-buildroot=${quote(STAGING)}`,
  `-clouddir=${quote(STAGING)}`,
  `-organizationid=${creds.organizationId || '${OrganizationId}'}`,
  `-productid=${creds.productId || '${ProductId}'}`,
  `-artifactid=${creds.artifactId || '${ArtifactId}'}`,
  `-clientid=${creds.clientId || '${ClientId}'}`,
  `-clientsecret=${creds.clientSecret || '${ClientSecret}'}`,
  `-version=${VERSION}`,
].join(' ');

/* ---- Output + optional execution ------------------------------------ */
console.log(`${BLD}\n=== EPIC GAMES STORE · DEPLOY ==============================================${RST}`);
console.log(`  ${GRN}Staging folder (ready to upload / drag & drop):${RST}\n    ${STAGING}\n`);
console.log(`  ${GRN}Version:${RST} ${VERSION}   ${GRN}BPT:${RST} ${BPT_DIR || '(not found — set EPIC_BPT_DIR)'}\n`);

if (buildCmd) {
  console.log(`${BLD}  STEP 1 — Build chunks locally:${RST}\n  ${YEL}${buildCmd}${RST}\n`);
  if (runMode) {
    const r = spawnSync(BPT_EXE, buildCmd.split(' ').map((s) => s.replace(/"/g, '')), {
      cwd: desktopDir, stdio: 'inherit',
    });
    if (r.status !== 0) exit(`Build Patch Tool (Build) exited with code ${r.status}`);
  }
}

console.log(`${BLD}  STEP 2 — Upload to Epic cloud sandbox:${RST}\n  ${YEL}${uploadCmd}${RST}\n`);

if (!creds.organizationId || !creds.clientSecret) {
  warn('Epic credentials were not provided — the Upload command above uses placeholders.');
  warn('Provide them via a desktop/.env.egs file (see .env.egs.example) or env vars, then add --run.');
}

if (runMode) {
  const args = uploadCmd.split(' ').map((s) => s.replace(/"/g, ''));
  if (!creds.clientSecret || creds.clientSecret.startsWith('${')) {
    exit('Refusing to upload with placeholder credentials. Fill in the secrets first.');
  }
  const r = spawnSync(BPT_EXE, args, { cwd: desktopDir, stdio: 'inherit' });
  if (r.status !== 0) exit(`Build Patch Tool (Upload) exited with code ${r.status}`);
  ok('Upload complete!');
}

// Always write the commands to a file for copy/paste convenience.
const outFile = path.join(desktopDir, 'release-egs', 'bpt-commands.txt');
mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, `${buildCmd ? buildCmd + '\n\n' : ''}${uploadCmd}\n`, 'utf8');
ok(`commands also written to: ${outFile}`);

console.log(`${BLD}\n=== READY =====================================================================${RST}`);
console.log(`  ${GRN}Upload-ready staging folder:${RST}`);
console.log(`    ${STAGING}`);
console.log(`  ${GRN}Re-run with --run once credentials are set to actually upload.${RST}\n`);

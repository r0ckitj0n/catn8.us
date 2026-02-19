#!/usr/bin/env node
/**
 * Detect unreferenced assets and optionally quarantine them to backups/stale/.
 *
 * Usage:
 *   node scripts/maintenance/find_stale_assets.mjs [--move] [--db-whitelist] [--json]
 *
 * Notes:
 * - Only reports by default. With --move, moves files into backups/stale/ preserving paths.
 * - Excludes backups/, node_modules/, dist/, vendor/, .git/
 * - Scans common static asset roots: images/, src/styles/, src/js/, src/modules/
 * - For images, only basename search is used; DB references are not scanned.
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const REPO_ROOT = resolve(process.cwd());
const EXCLUDES = ['backups/', 'node_modules/', 'dist/', 'vendor/', '.git/'];
const CANDIDATE_DIRS = [
  'images/',
  'src/styles/',
  'src/js/',
  'src/modules/'
];
const MOVE = process.argv.includes('--move');
const DB_WHITELIST = process.argv.includes('--db-whitelist');
const AS_JSON = process.argv.includes('--json');

function rgAvailable() {
  try { execSync('rg --version', { stdio: 'ignore' }); return true; } catch { return false; }
}

function listFiles(dir) {
  try {
    const out = execSync(
      `find ${JSON.stringify(resolve(REPO_ROOT, dir))} -type f -not -path "*/.*"`,
      { encoding: 'utf8' }
    );
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function isExcluded(pathAbs) {
  const rel = pathAbs.replace(REPO_ROOT + '/', '');
  return EXCLUDES.some((e) => rel.startsWith(e));
}

function referencedAnywhere(basename) {
  if (!rgAvailable()) return true; // be conservative if rg missing
  const args = ['-n', '-F', basename, REPO_ROOT, '--hidden'];
  EXCLUDES.forEach((e) => args.push('--glob', `!${e}**`));
  const res = spawnSync('rg', args, { encoding: 'utf8' });
  if (res.status !== 0) return false; // no matches
  // filter out the file itself as the only match
  const lines = res.stdout.split('\n').filter(Boolean);
  // If lines > 1, likely referenced; if 1, ensure it's not only the source file name match in its own path
  return lines.length > 0;
}

function moveToStale(abs) {
  const rel = abs.replace(REPO_ROOT + '/', '');
  const dest = resolve(REPO_ROOT, 'backups/stale', rel);
  const destDir = dirname(dest);
  mkdirSync(destDir, { recursive: true });
  try {
    // prefer git mv when possible
    execSync(`git ls-files --error-unmatch ${JSON.stringify(rel)}`, { stdio: 'ignore' });
    execSync(`git mv -f ${JSON.stringify(rel)} ${JSON.stringify(dest)}`, { stdio: 'ignore' });
  } catch {
    renameSync(abs, dest);
  }
}

// Load DB whitelist (basenames) if requested
const dbWhitelist = new Set();
let userPatterns = [];
if (DB_WHITELIST) {
  try {
    const phpScript = resolve(REPO_ROOT, 'scripts/maintenance/list_db_asset_references.php');
    if (existsSync(phpScript)) {
      const out = execSync(`php ${JSON.stringify(phpScript)}`, { encoding: 'utf8' });
      const arr = JSON.parse(out);
      if (Array.isArray(arr)) {
        arr.forEach((bn) => { if (typeof bn === 'string' && bn) dbWhitelist.add(bn.toLowerCase()); });
      }
    }
    const wlScript = resolve(REPO_ROOT, 'scripts/maintenance/list_asset_whitelist.php');
    if (existsSync(wlScript)) {
      const out2 = execSync(`php ${JSON.stringify(wlScript)}`, { encoding: 'utf8' });
      const json = JSON.parse(out2);
      if (json && Array.isArray(json.patterns)) {
        userPatterns = json.patterns.map((p) => String(p || '')).filter(Boolean);
      }
    }
  } catch (e) {
    console.warn('DB whitelist unavailable or failed to load; continuing without it.');
  }
}

const stale = [];
for (const d of CANDIDATE_DIRS) {
  const files = listFiles(d);
  for (const f of files) {
    if (isExcluded(f)) continue;
    const bn = f.split('/').pop();
    if (!bn) continue;
    // Skip source maps and manifest files
    if (bn.endsWith('.map') || bn === 'manifest.json') continue;
    if (dbWhitelist.has(bn.toLowerCase())) {
      continue; // referenced in DB
    }
    // Skip if matches any user-defined pattern (substring match on path)
    if (userPatterns.length) {
      const lowerPath = f.toLowerCase();
      const hit = userPatterns.some((p) => lowerPath.includes(String(p).toLowerCase()));
      if (hit) continue;
    }
    if (!referencedAnywhere(bn)) {
      stale.push(f);
    }
  }
}

if (stale.length === 0) {
  console.log('No obvious stale assets found.');
  process.exit(0);
}

if (!MOVE) {
  if (AS_JSON) {
    console.log(JSON.stringify({ stale }));
  } else {
    console.log('Stale assets:\n' + stale.map(s => ` - ${s}`).join('\n'));
  }
  process.exit(0);
}

for (const s of stale) console.log(` - ${s.replace(REPO_ROOT + '/', '')}`);

if (MOVE) {
  console.log('\n--move specified: quarantining to backups/stale/ ...');
  for (const s of stale) moveToStale(s);
  console.log('Quarantine complete. Review and commit the changes.');
}

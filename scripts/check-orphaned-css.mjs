#!/usr/bin/env node
/**
 * Check for orphaned CSS files under src/styles/ that are not imported
 * by the main entry (src/styles/main.css) or any CSS files it imports.
 *
 * Also scans JS modules for direct .css imports and includes those in the
 * referenced set.
 *
 * Usage:
 *   node scripts/check-orphaned-css.mjs           # report and exit 1 if orphans exist
 *   node scripts/check-orphaned-css.mjs --write   # move orphans to backups/unused_styles/
 */
import fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const STYLES_DIR = path.join(ROOT, 'src', 'styles');
const MAIN_CSS = path.join(STYLES_DIR, 'main.css');
const UNUSED_BASE = path.join(ROOT, 'backups', 'unused_styles');

const args = new Set(process.argv.slice(2));
const WRITE = args.has('--write');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function isHttpUrl(spec) {
  return /^https?:\/\//i.test(spec) || spec.startsWith('//');
}

// Extract @import URLs from a CSS source string
function extractCssImports(css, fromFile) {
  const imports = [];
  // Match @import url("..."), @import url('...'), @import "...", @import '...'
  const rx = /@import\s+(?:url\(\s*(?:"([^"]+)"|'([^']+)'|([^\)\s]+))\s*\)|"([^"]+)"|'([^']+)');/g;
  let m;
  while ((m = rx.exec(css))) {
    const spec = m[1] || m[2] || m[3] || m[4] || m[5];
    if (!spec || isHttpUrl(spec)) continue;
    const resolved = resolveImportPath(fromFile, spec);
    if (resolved) imports.push(resolved);
  }
  return imports;
}

// Extract JS imports that end with .css
function extractJsCssImports(jsSource, fromFile) {
  const imports = [];
  const importRx = /import\s*(?:[^'";]*?from\s*)?["']([^"']+\.css)["']/g;
  let m;
  while ((m = importRx.exec(jsSource))) {
    const spec = m[1];
    if (!spec || isHttpUrl(spec)) continue;
    const resolved = resolveImportPath(fromFile, spec);
    if (resolved) imports.push(resolved);
  }
  return imports;
}

function resolveImportPath(fromFile, spec) {
  let cand;
  if (spec.startsWith('/')) {
    cand = path.join(ROOT, spec.replace(/^\/+/, ''));
  } else {
    cand = path.resolve(path.dirname(fromFile), spec);
  }
  const tryFiles = [];
  if (path.extname(cand)) {
    tryFiles.push(cand);
  } else {
    tryFiles.push(`${cand}.css`);
    tryFiles.push(path.join(cand, 'index.css'));
  }
  for (const f of tryFiles) {
    if (fs.existsSync(f)) return path.resolve(f);
  }
  return null;
}

function walkCssGraph(entryFiles) {
  const visited = new Set();
  const stack = [...entryFiles.map(f => path.resolve(f))];
  while (stack.length) {
    const f = stack.pop();
    if (!f || visited.has(f)) continue;
    if (!fs.existsSync(f)) continue;
    visited.add(f);
    const src = readFileSafe(f);
    const next = extractCssImports(src, f);
    for (const n of next) {
      if (!visited.has(n)) stack.push(n);
    }
  }
  return visited;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function gitMvOrRename(src, dest) {
  const res = spawnSync('git', ['mv', '--', src, dest], { cwd: ROOT, stdio: 'ignore' });
  if (res.status !== 0) {
    ensureDir(path.dirname(dest));
    fs.renameSync(src, dest);
  }
}

function main() {
  // Collect all CSS files under src/styles (excluding recovered and backups)
  const allCss = globSync('src/styles/**/*.css', {
    cwd: ROOT,
    nodir: true,
    ignore: [
      'src/styles/recovered/**',
      'backups/**',
      'dist/**',
      'node_modules/**',
    ],
  }).map(p => path.join(ROOT, p));

  // Entry CSS files: main.css by convention
  const entryCss = [];
  if (fs.existsSync(MAIN_CSS)) entryCss.push(MAIN_CSS);

  // Also include any .css directly imported by JS modules under src/
  const jsFiles = globSync('src/**/*.{js,mjs,cjs}', {
    cwd: ROOT,
    nodir: true,
    ignore: [ 'src/recovered/**', 'node_modules/**', 'dist/**' ],
  }).map(p => path.join(ROOT, p));
  const jsCssImports = new Set();
  for (const jf of jsFiles) {
    const src = readFileSafe(jf);
    const cssRefs = extractJsCssImports(src, jf);
    for (const c of cssRefs) jsCssImports.add(c);
  }

  const referenced = walkCssGraph([...entryCss, ...jsCssImports]);

  // Compute orphans: files in allCss not present in referenced
  const referencedNorm = new Set([...referenced].map(p => path.resolve(p)));
  const orphans = allCss.filter(p => !referencedNorm.has(path.resolve(p)));

  if (orphans.length === 0) {
    console.log('[check-orphaned-css] OK: No orphaned CSS under src/styles/.');
    return 0;
  }

  // Report
  console.error('\n[check-orphaned-css] Found orphaned CSS files:');
  for (const o of orphans) {
    console.error(' -', path.relative(ROOT, o));
  }

  if (!WRITE) {
    console.error(`\nTo auto-archive orphans, run: node scripts/check-orphaned-css.mjs --write`);
    return 1;
  }

  // --write: move each orphan to backups/unused_styles/, preserving path relative to src/styles/
  let moved = 0;
  for (const o of orphans) {
    const relFromStyles = path.relative(STYLES_DIR, o);
    const dest = path.join(UNUSED_BASE, relFromStyles);
    ensureDir(path.dirname(dest));
    gitMvOrRename(o, dest);
    moved++;
    console.log('Archived', path.relative(ROOT, o), '->', path.relative(ROOT, dest));
  }
  if (moved > 0) {
    // Ensure backups/unused_styles/ is added to git index if using git
    spawnSync('git', ['add', '-f', '--', 'backups/unused_styles'], { cwd: ROOT, stdio: 'ignore' });
    console.log(`[check-orphaned-css] Moved ${moved} file(s) to backups/unused_styles/.`);
  } else {
    console.log('[check-orphaned-css] No files moved.');
  }
  return 0;
}

const code = main();
process.exitCode = code;

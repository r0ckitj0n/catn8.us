#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const RUNTIME_ROOTS = ['api', 'admin', 'includes', 'src', 'templates'];
const SKIP_TOP = new Set(['backups', 'node_modules', '.git', 'dist', 'vendor', 'logs', '.cache']);
const PATTERNS = [
  'debug', 'smoke', 'test', 'sample', 'old', 'deprecated', 'unused', 'tmp', 'temp', 'wip'
];

const args = new Set(process.argv.slice(2));
const WRITE = args.has('--write');

function shouldSkip(rel) {
  const top = rel.split('/')[0];
  return SKIP_TOP.has(top);
}

function walk(dir, out) {
  const entries = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full).replaceAll('\\', '/');
    if (shouldSkip(rel)) continue; // ignore quarantined and non-runtime
    if (e.isDirectory()) {
      walk(full, out);
    } else {
      const lower = e.name.toLowerCase();
      if (PATTERNS.some(p => lower.includes(p))) out.push(rel);
    }
  }
}

function fileText(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function isReferenced(relPath) {
  // Consider both the exact relative path and the basename (without extension) as signals
  const targetRel = relPath.replaceAll('\\', '/');
  const base = path.basename(relPath);
  const baseNoExt = base.replace(/\.[^.]+$/, '');

  // Search across runtime roots only, skipping backups and heavy dirs
  for (const root of RUNTIME_ROOTS) {
    const rootDir = path.join(ROOT, root);
    const stack = [rootDir];
    while (stack.length) {
      const cur = stack.pop();
      let entries = [];
      try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        const full = path.join(cur, e.name);
        const rel = path.relative(ROOT, full).replaceAll('\\', '/');
        if (shouldSkip(rel)) continue;
        if (e.isDirectory()) { stack.push(full); continue; }
        // Do a quick check: we only scan text-like files
        if (!/[.](php|js|mjs|cjs|css|html|md|yml|yaml|json)$/i.test(e.name)) continue;
        const txt = fileText(full);
        if (!txt) continue;
        if (txt.includes(targetRel) || txt.includes(base) || txt.includes(baseNoExt)) {
          return true;
        }
      }
    }
  }
  return false;
}

// --- JS reachability graph (very simple) ---
const JS_ENTRY_CANDIDATES = [
  'src/js/app.js',
];
// include all files under src/entries/*.js as additional entry points
function listEntryPoints() {
  const entries = new Set();
  for (const p of JS_ENTRY_CANDIDATES) {
    const full = path.join(ROOT, p);
    if (fs.existsSync(full)) entries.add(full);
  }
  // walk src/entries for *.js
  const entriesDir = path.join(ROOT, 'src/entries');
  const stack = [entriesDir];
  while (stack.length) {
    const cur = stack.pop();
    if (!fs.existsSync(cur)) continue;
    const dirents = fs.readdirSync(cur, { withFileTypes: true });
    for (const d of dirents) {
      const full = path.join(cur, d.name);
      if (d.isDirectory()) { stack.push(full); continue; }
      if (/\.js$/i.test(d.name)) entries.add(full);
    }
  }
  return Array.from(entries);
}

function resolveImport(fromFile, spec) {
  // Only handle relative imports for reachability; ignore bare package imports
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null;
  const baseDir = path.dirname(fromFile);
  const candidate = path.normalize(path.join(baseDir, spec));
  // Try standard JS resolution: exact, add .js, index.js
  const tryPaths = [
    candidate,
    candidate + '.js',
    candidate + '.mjs',
    candidate + '.cjs',
    path.join(candidate, 'index.js'),
  ];
  for (const p of tryPaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

function parseImports(filePath) {
  const txt = fileText(filePath);
  const specs = new Set();
  if (!txt) return specs;
  const importRe = /import\s+[^'"\n]*from\s*['\"]([^'\"]+)['\"]/g;
  const importSideRe = /import\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/g; // dynamic import('...')
  const requireRe = /require\(\s*['\"]([^'\"]+)['\"]\s*\)/g;
  let m;
  while ((m = importRe.exec(txt))) specs.add(m[1]);
  while ((m = importSideRe.exec(txt))) specs.add(m[1]);
  while ((m = requireRe.exec(txt))) specs.add(m[1]);
  return Array.from(specs);
}

const reachableJS = new Set();
function buildJsReachability() {
  const queue = listEntryPoints();
  const seen = new Set(queue);
  while (queue.length) {
    const cur = queue.shift();
    reachableJS.add(path.relative(ROOT, cur).replaceAll('\\', '/'));
    const specs = parseImports(cur);
    for (const s of specs) {
      const resolved = resolveImport(cur, s);
      if (!resolved) continue;
      if (!seen.has(resolved)) {
        seen.add(resolved);
        queue.push(resolved);
      }
    }
  }
}

// Kick off JS reachability graph build
buildJsReachability();

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function gitMv(src, dest) {
  const res = spawnSync('git', ['mv', '--', src, dest], { cwd: ROOT, stdio: 'inherit' });
  if (res.status !== 0) {
    // fallback
    ensureDir(path.dirname(dest));
    fs.renameSync(src, dest);
  }
}

// 1) Gather candidates by name patterns
const candidates = [];
for (const root of RUNTIME_ROOTS) {
  walk(path.join(ROOT, root), candidates);
}

// 2) Filter out referenced files
const unreferenced = candidates.filter(rel => !isReferenced(rel));

if (!WRITE) {
  if (unreferenced.length) {
    console.error('✖ Legacy scan found unreferenced potential legacy files in runtime directories:');
    for (const f of unreferenced) console.error(' -', f);
    process.exit(1);
  } else {
    console.log('✓ Legacy scan passed: no unreferenced suspicious files found in runtime directories.');
  }
  process.exit(0);
}

// 3) --write: quarantine unreferenced files
let moved = 0;
for (const rel of unreferenced) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) continue;
  const dest = path.join(ROOT, 'backups/legacy', rel);
  ensureDir(path.dirname(dest));
  console.log('Quarantining', rel, '->', path.relative(ROOT, dest));
  gitMv(src, dest);
  moved++;
}

if (moved > 0) {
  // Stage moved files even if backups is ignored
  spawnSync('git', ['add', '-f', '--', 'backups/legacy'], { cwd: ROOT, stdio: 'inherit' });
  console.log(`Moved ${moved} file(s) to backups/legacy/`);
} else {
  console.log('No files moved.');
}

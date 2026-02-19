#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import _url from 'url';

const projectRoot = process.cwd();
const JS_DIR = path.join(projectRoot, 'js');
const EXCLUDE_DIRS = new Set(['backups', 'scripts', 'node_modules', 'dist', 'vendor']);

const entryFiles = [
  'js/app.js',
  'js/admin-dashboard.js',
  'js/admin-inventory.js',
].map(p => path.join(projectRoot, p));

const visitedJS = new Set();
const visitedCSS = new Set();
const missing = new Set();

const importRegexes = [
  /import\s+[^'";]*?from\s*['\"]([^'\"]+)['\"]/g, // import X from '...'
  /import\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/g,      // import('...')
  /import\s*['\"]([^'\"]+)['\"]/g,                  // import '...'
];

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function resolveImport(fromFile, spec) {
  if (!spec || spec.startsWith('http') || spec.startsWith('//')) return null;
  // Absolute from project root
  let candidate;
  if (spec.startsWith('/')) {
    candidate = path.join(projectRoot, spec.replace(/^\/+/, ''));
  } else {
    candidate = path.resolve(path.dirname(fromFile), spec);
  }

  const tryFiles = [];
  // If already has extension
  if (path.extname(candidate)) {
    tryFiles.push(candidate);
  } else {
    // Try JS variants
    tryFiles.push(candidate + '.js');
    tryFiles.push(candidate + '.mjs');
    tryFiles.push(candidate + '.cjs');
    tryFiles.push(path.join(candidate, 'index.js'));
    // CSS variant
    tryFiles.push(candidate + '.css');
  }
  for (const f of tryFiles) {
    if (await fileExists(f)) return f;
  }
  return null;
}

async function readFileSafe(p) {
  try { return await fs.readFile(p, 'utf8'); } catch { return ''; }
}

async function traverse(filePath) {
  const real = path.resolve(filePath);
  if (visitedJS.has(real) || visitedCSS.has(real)) return;

  const ext = path.extname(real);
  if (ext === '.css') {
    visitedCSS.add(real);
    return; // do not parse css
  }
  visitedJS.add(real);

  const src = await readFileSafe(real);
  for (const rx of importRegexes) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(src))) {
      const spec = m[1];
      const resolved = await resolveImport(real, spec);
      if (!resolved) {
        // record missing relative specs only
        if (!spec.startsWith('http') && !spec.startsWith('//')) {
          missing.add(`${path.relative(projectRoot, real)} -> ${spec}`);
        }
        continue;
      }
      await traverse(resolved);
    }
  }
}

async function walkDir(dir, acc = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (EXCLUDE_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walkDir(full, acc);
    } else if (e.isFile()) {
      acc.push(full);
    }
  }
  return acc;
}

function _isInExcluded(p) {
  const rel = path.relative(projectRoot, p).split(path.sep);
  return rel.length > 0 && EXCLUDE_DIRS.has(rel[0]);
}

(async function main() {
  for (const entry of entryFiles) {
    if (await fileExists(entry)) {
      await traverse(entry);
    }
  }

  // Collect all JS under js/
  const allJS = (await walkDir(JS_DIR)).filter(f => f.endsWith('.js'));
  const allCSS = [
    ...(await walkDir(path.join(projectRoot, 'css')).catch(() => [])),
    ...(await walkDir(path.join(projectRoot, 'src', 'styles')).catch(() => [])),
  ].filter(f => f.endsWith('.css'));

  const visitedJSSet = new Set([...visitedJS]);
  const visitedCSSSet = new Set([...visitedCSS]);

  const orphansJS = allJS.filter(f => !visitedJSSet.has(path.resolve(f)));
  const orphansCSS = allCSS.filter(f => !visitedCSSSet.has(path.resolve(f)));

  const out = {
    projectRoot,
    entries: entryFiles.map(f => path.relative(projectRoot, f)),
    visited: {
      js: [...visitedJS].map(f => path.relative(projectRoot, f)).sort(),
      css: [...visitedCSS].map(f => path.relative(projectRoot, f)).sort(),
    },
    orphans: {
      js: orphansJS.map(f => path.relative(projectRoot, f)).sort(),
      css: orphansCSS.map(f => path.relative(projectRoot, f)).sort(),
    },
    missing: [...missing].sort(),
  };
  console.log(JSON.stringify(out, null, 2));
})();

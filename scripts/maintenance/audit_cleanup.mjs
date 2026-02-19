#!/usr/bin/env node
/*
  Repository Audit & Cleanup Script
  - Default: dry-run audit, writes report to reports/cleanup/<timestamp>/
  - --execute: perform moves to backups/cleanup/<timestamp>/ preserving paths
  - --restore <timestamp>: restore from backups/cleanup/<timestamp>/ to original locations
  - --categories A,B,C,D,E,F: limit categories
  - --root <path>: project root (default: process.cwd())

  Categories implemented:
  A: Numeric duplicates (* 2.*, * 3.*)
  B: Backup/temp/junk (*.bak, *.old, *.orig, *.tmp, *~, .DS_Store)
  C: Root .htaccess snapshots (.htaccess.* except .htaccess)
  D: scripts/migrations/ older than 30 days
  E: Deprecated endpoints (css/dynamic-styles.php, api/css_generator.php)
  F: Dev/test caches (.phpunit.result.cache, .tmp*)
*/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { execute: false, categories: null, restore: null, root: process.cwd() };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--execute') opts.execute = true;
    else if (a === '--root') { opts.root = args[++i] || opts.root; }
    else if (a === '--categories') { opts.categories = (args[++i] || '').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean); }
    else if (a === '--restore') { opts.restore = args[++i] || null; }
  }
  return opts;
}

function ts() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function walk(dir, excludes, results = []) {
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of list) {
    const p = path.join(dir, ent.name);
    const rel = path.relative(root, p);
    if (shouldExclude(rel, ent, excludes)) continue;
    if (ent.isDirectory()) walk(p, excludes, results);
    else results.push(rel);
  }
  return results;
}

function shouldExclude(rel, ent, excludes) {
  const segs = rel.split(path.sep);
  const top = segs[0];
  // Standard excludes
  const std = new Set(['backups','node_modules','.git','logs','documentation','vendor','reports/cleanup']);
  if (std.has(top)) return true;
  // User-requested keep scripts by default, but we still scan scripts/migrations for D
  // Additional excludes via patterns
  for (const ex of excludes) {
    if (typeof ex === 'function' && ex(rel, ent)) return true;
  }
  return false;
}

function sizeOf(relPath) {
  try { return fs.statSync(path.join(root, relPath)).size; } catch { return 0; }
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function movePreserve(relPath, destRoot) {
  const srcAbs = path.join(root, relPath);
  const dstAbs = path.join(destRoot, relPath);
  ensureDir(path.dirname(dstAbs));
  fs.renameSync(srcAbs, dstAbs);
}

function _copyPreserve(relPath, destRoot) {
  const srcAbs = path.join(root, relPath);
  const dstAbs = path.join(destRoot, relPath);
  ensureDir(path.dirname(dstAbs));
  fs.copyFileSync(srcAbs, dstAbs);
}

function writeFile(p, data) { ensureDir(path.dirname(p)); fs.writeFileSync(p, data); }

function daysAgo(n) { return Date.now() - n*24*60*60*1000; }

const opts = parseArgs();
const root = path.resolve(opts.root);

if (!fs.existsSync(root)) { console.error(JSON.stringify({ success:false, error:'Root does not exist', root })); process.exit(1); }

if (opts.restore) {
  const from = path.join(root, 'backups', 'cleanup', opts.restore);
  if (!fs.existsSync(from)) { console.error(JSON.stringify({ success:false, error:'Restore folder not found', from })); process.exit(1); }
  const files = walk(from, [ (rel)=>rel.startsWith('.git') ]).filter(f=>fs.statSync(path.join(from,f)).isFile());
  for (const rel of files) {
    const srcAbs = path.join(from, rel);
    const dstAbs = path.join(root, rel);
    ensureDir(path.dirname(dstAbs));
    fs.renameSync(srcAbs, dstAbs);
  }
  console.log(JSON.stringify({ success:true, action:'restore', restored: files.length, from }));
  process.exit(0);
}

const allFiles = walk(root, [ (rel)=>rel.startsWith('reports/cleanup') ]);

const cats = { A:[], B:[], C:[], D:[], E:[], F:[] };

function pushIf(rel, cat) { cats[cat].push({ path: rel, size: sizeOf(rel) }); }

for (const rel of allFiles) {
  const base = path.basename(rel);
  const dir = path.dirname(rel);
  // A: * 2.* or * 3.*
  if (/\s[23]\.[^/]+$/.test(rel)) pushIf(rel, 'A');
  // B: backups/temp
  if (/(\.bak|\.old|\.orig|\.tmp|~)$/.test(base) || base === '.DS_Store') pushIf(rel, 'B');
  // C: root .htaccess.* except .htaccess
  if ((dir === '.' || dir === '') && base.startsWith('.htaccess') && base !== '.htaccess') pushIf(rel, 'C');
  // D: scripts/migrations older than 30 days
  if (rel.startsWith(path.join('scripts','migrations') + path.sep)) {
    try {
      const st = fs.statSync(path.join(root, rel));
      if (st.mtimeMs < daysAgo(30)) pushIf(rel, 'D');
    } catch {}
  }
  // E: deprecated endpoints
  if (rel === path.join('css','dynamic-styles.php') || rel === path.join('api','css_generator.php')) pushIf(rel,'E');
  // F: dev/test caches
  if (base === '.phpunit.result.cache' || base.startsWith('.tmp')) pushIf(rel,'F');
}

const selected = opts.categories ? Object.fromEntries(Object.entries(cats).map(([k,v])=>[k, opts.categories.includes(k)?v:[]])) : cats;

const timestamp = ts();
const reportDir = path.join(root, 'reports', 'cleanup', timestamp);
const _backupDir = path.join(root, 'backups', 'cleanup', timestamp);

const summary = Object.fromEntries(Object.entries(selected).map(([k,v])=>[k, { count: v.length, bytes: v.reduce((a,b)=>a+(b.size||0),0) }]));

if (!opts.execute) {
  // Dry-run: write report
  const payload = { success:true, action:'audit', timestamp, root, summary, categories: selected };
  writeFile(path.join(reportDir,'audit.json'), JSON.stringify(payload, null, 2));
  // lightweight markdown
  let md = `# Cleanup Audit ${timestamp}\n\n`;
  for (const [k,info] of Object.entries(summary)) {
    md += `- ${k}: ${info.count} files, ${info.bytes} bytes\n`;
  }
  writeFile(path.join(reportDir,'audit.md'), md);
  console.log(JSON.stringify(payload));
  process.exit(0);
}

// Execute: move files
const moved = [];
for (const [_k, list] of Object.entries(selected)) {
  for (const item of list) {
    const rel = item.path;
    const srcAbs = path.join(root, rel);
    if (!fs.existsSync(srcAbs)) continue;
    movePreserve(rel, path.join(root, 'backups', 'cleanup', timestamp));
    moved.push(rel);
  }
}
const payload = { success:true, action:'execute', timestamp, moved_count: moved.length, backupDir: path.join('backups','cleanup',timestamp) };
writeFile(path.join(reportDir,'execute.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload));

#!/usr/bin/env node
/*
  naming-convention-scan.mjs
  Dry-run scanner to audit file names across the project and propose renames per conventions.
  It also detects missing references (src/href/url/import/require/include paths that point to non-existent files),
  to help diagnose styling/background regressions.

  NO FILES ARE RENAMED. Outputs a report under reports/naming-audit/<timestamp>/.

  Categories (from user spec):
  - Category 1 (Public-facing & web assets): kebab-case
  - Category 2 (PHP class files): PascalCase (matches class/interface/trait)
  - Category 3 (Backend & server-side logic): snake_case
  - Category 4 (Config & Docs): kebab-case unless tool/framework dictates conventional names
  - Category 5 (Logs): YYYY_MM_DD_description.log
  - Conventional Exceptions (do not rename): common tool config names (vite.config.js, package.json, composer.json, composer.lock,
    phpunit.xml.*, README.md, .env*, Dockerfile, .gitignore, robots.txt, favicon.ico, eslint.config.js, stylelint.config.cjs,
    .stylelintrc.json, .stylelintignore, postcss.config.cjs, tailwind.config.*, .husky/*, etc.)

  Usage:
    node scripts/naming-convention-scan.mjs --dry-run

  Notes:
    - Heuristics are used to classify PHP files as classes or not.
    - Images may be referenced from the database; such renames are flagged as risky.
*/

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-');
const reportDir = path.join(ROOT, 'reports', 'naming-audit', timestamp);
const _DRY_RUN = process.argv.includes('--dry-run') || true; // scanner is always dry-run

// Basic directory ignores to avoid noise
const DIR_IGNORES = new Set([
  '.git',
  'node_modules',
  'vendor',
  'dist',
  'build',
  '.cache',
  'coverage',
  '.idea',
  '.vscode',
  'reports/naming-audit',
  'backups',
]);

// File-level conventional exceptions (exact base names or patterns)
const EXCEPTIONS_EXACT = new Set([
  'vite.config.js',
  'package.json',
  'package-lock.json',
  'composer.json',
  'composer.lock',
  'phpunit.xml',
  'phpunit.xml.dist',
  'README.md',
  'Dockerfile',
  '.gitignore',
  'robots.txt',
  'favicon.ico',
  '.stylelintrc.json',
  '.stylelintignore',
  'stylelint.config.cjs',
  'eslint.config.js',
  'postcss.config.cjs',
  '.husky', // whole dir
]);

const EXCEPTIONS_PATTERNS = [
  /^\.env(\..+)?$/,
  /^tailwind\.config\..*$/,
  /^phpunit\.xml(\..+)?$/,
  /^com\..+\.plist$/, // macOS launchctl plists
];

// File extensions considered text (for reference scanning)
const TEXT_EXTS = new Set([
  '.php', '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.vue',
  '.css', '.scss', '.less', '.md', '.markdown', '.html', '.htm',
  '.json', '.txt', '.csv', '.yml', '.yaml', '.xml', '.conf', '.ini', '.env',
]);

// Utility: relative path
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

function isIgnoredDir(relPath) {
  const parts = relPath.split('/');
  // ignore any path segment that matches DIR_IGNORES entry
  return parts.some((seg, idx) => {
    if (DIR_IGNORES.has(seg)) return true;
    // also ignore nested specific paths like reports/naming-audit
    const subPath = parts.slice(0, idx + 1).join('/');
    return DIR_IGNORES.has(subPath);
  });
}

function isConventionalException(baseName, relPath) {
  if (EXCEPTIONS_EXACT.has(baseName)) return true;
  if (EXCEPTIONS_EXACT.has(relPath.split('/')[0])) return true; // top-level dir exceptions like .husky
  return EXCEPTIONS_PATTERNS.some(rx => rx.test(baseName));
}

function splitNameCore(name) {
  // Remove extension; return {stem, ext}
  const ext = path.extname(name);
  return { stem: name.slice(0, -ext.length), ext };
}

function toKebabCase(stem) {
  return stem
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[ _]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function toSnakeCase(stem) {
  return stem
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[ -]+/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

function _toPascalCaseFromStem(stem) {
  const parts = stem
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[\-_.]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return parts.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

function detectPhpClassName(content) {
  // Simple heuristic: find first class/interface/trait declaration
  const rx = /^(?:\s*namespace\s+[^;]+;)?[\s\S]*?^(?:\s*abstract\s+|\s*final\s+)?\s*(class|interface|trait)\s+([A-Za-z_][A-Za-z0-9_]*)/m;
  const m = content.match(rx);
  if (m) return m[2];
  return null;
}

function categorize(relPath, contentSample) {
  const ext = path.extname(relPath).toLowerCase();
  const _dir = relPath.split('/')[0] || '';
  const base = path.basename(relPath);
  const { stem } = splitNameCore(base);

  if (isConventionalException(base, relPath)) {
    return { category: 'exception', case: 'n/a', proposed: base, reason: 'Conventional exception', confidence: 'high' };
  }

  // Category 5: logs
  if (ext === '.log') {
    const ok = /^\d{4}_\d{2}_\d{2}_.+\.log$/.test(base);
    return { category: 'logs', case: 'timestamped_snake', proposed: base, reason: ok ? 'compliant' : 'should be YYYY_MM_DD_description.log', confidence: 'high' };
  }

  // Config + Docs
  if (ext === '.md' || ext === '.markdown' || ext === '.yml' || ext === '.yaml') {
    const kebab = toKebabCase(stem) + ext;
    const compliant = base === kebab || base === 'README.md';
    return { category: 'config_docs', case: 'kebab', proposed: compliant ? base : kebab, reason: compliant ? 'compliant' : 'rename to kebab-case', confidence: 'high' };
  }

  // Images & Fonts & Public data
  if (['.png','.jpg','.jpeg','.gif','.svg','.webp','.ico','.woff','.woff2','.ttf','.otf'].includes(ext)) {
    if (base === 'favicon.ico') {
      return { category: 'exception', case: 'n/a', proposed: base, reason: 'Conventional favicon', confidence: 'high' };
    }
    const kebab = toKebabCase(stem) + ext;
    const compliant = base === kebab;
    return { category: 'public_assets', case: 'kebab', proposed: compliant ? base : kebab, reason: compliant ? 'compliant' : 'rename to kebab-case', confidence: 'medium' };
  }

  // Stylesheets
  if (['.css','.scss','.less'].includes(ext)) {
    const kebab = toKebabCase(stem) + ext;
    const compliant = base === kebab;
    return { category: 'public_assets', case: 'kebab', proposed: compliant ? base : kebab, reason: compliant ? 'compliant' : 'rename to kebab-case', confidence: 'high' };
  }

  // Scripts: JS/TS
  if (['.js','.ts','.jsx','.tsx','.vue'].includes(ext)) {
    const underSrc = relPath.startsWith('src/');
    const underScripts = relPath.startsWith('scripts/');
    if (underScripts) {
      const snake = toSnakeCase(stem) + ext;
      const compliant = base === snake;
      return { category: 'backend_scripts', case: 'snake', proposed: compliant ? base : snake, reason: compliant ? 'compliant' : 'internal script: snake_case', confidence: 'high' };
    }
    if (underSrc) {
      const kebab = toKebabCase(stem) + ext;
      const compliant = base === kebab;
      return { category: 'public_assets', case: 'kebab', proposed: compliant ? base : kebab, reason: compliant ? 'compliant' : 'frontend asset: kebab-case', confidence: 'high' };
    }
    // default to kebab-case for web assets
    const kebab = toKebabCase(stem) + ext;
    const compliant = base === kebab;
    return { category: 'public_assets', case: 'kebab', proposed: compliant ? base : kebab, reason: compliant ? 'compliant' : 'default kebab-case', confidence: 'medium' };
  }

  // Shell scripts
  if (ext === '.sh') {
    const snake = toSnakeCase(stem) + ext;
    const compliant = base === snake;
    return { category: 'backend_scripts', case: 'snake', proposed: compliant ? base : snake, reason: compliant ? 'compliant' : 'shell script: snake_case', confidence: 'high' };
  }

  // SQL
  if (ext === '.sql') {
    const snake = toSnakeCase(stem) + ext;
    const compliant = base === snake || /^\d{4}_\d{2}_\d{2}_/.test(base);
    return { category: 'backend_sql', case: 'snake', proposed: compliant ? base : snake, reason: compliant ? 'compliant' : 'sql: snake_case or timestamped prefix', confidence: 'high' };
  }

  // JSON/TXT/CSV
  if (['.json','.txt','.csv'].includes(ext)) {
    const underPublic = relPath.startsWith('public/');
    const desiredCase = underPublic ? 'kebab' : 'snake';
    const desired = desiredCase === 'kebab' ? toKebabCase(stem) + ext : toSnakeCase(stem) + ext;
    const compliant = base === desired;
    return { category: underPublic ? 'public_assets' : 'backend_data', case: desiredCase, proposed: compliant ? base : desired, reason: compliant ? 'compliant' : `${underPublic ? 'public' : 'internal'} data file`, confidence: 'medium' };
  }

  // PHP classification
  if (ext === '.php') {
    const underApi = relPath.startsWith('api/');
    const underIncludes = relPath.startsWith('includes/') || relPath.startsWith('functions/');
    const underAdmin = relPath.startsWith('admin/');
    const underComponents = relPath.startsWith('components/') || relPath.startsWith('partials/') || relPath.startsWith('sections/');
    const rootLevel = relPath.indexOf('/') === -1; // e.g., index.php

    let isClass = false;
    let className = null;
    if (contentSample) {
      className = detectPhpClassName(contentSample);
      isClass = !!className;
    }

    if (isClass) {
      const proposed = `${className}.php`;
      const compliant = base === proposed;
      return { category: 'php_class', case: 'PascalCase', proposed: compliant ? base : proposed, reason: 'PSR-4 class/interface/trait file', confidence: 'high' };
    }

    if (underApi || underIncludes) {
      const snake = toSnakeCase(stem) + ext;
      const compliant = base === snake;
      return { category: 'backend_php', case: 'snake', proposed: compliant ? base : snake, reason: underApi ? 'API endpoint: snake_case' : 'backend include: snake_case', confidence: 'high' };
    }

    if (underComponents || underAdmin || rootLevel) {
      const kebab = toKebabCase(stem) + ext;
      const compliant = base === kebab;
      return { category: 'public_php', case: 'kebab', proposed: compliant ? base : kebab, reason: 'view/template/admin page: kebab-case', confidence: 'medium' };
    }

    // default for other php
    const snake = toSnakeCase(stem) + ext;
    const compliant = base === snake;
    return { category: 'backend_php', case: 'snake', proposed: compliant ? base : snake, reason: 'default backend php', confidence: 'low' };
  }

  // Default: no change
  return { category: 'other', case: 'n/a', proposed: base, reason: 'unclassified or already conventional', confidence: 'low' };
}

async function readTextSample(absPath, maxBytes = 100_000) {
  try {
    const stat = await fsp.stat(absPath);
    if (stat.size === 0) return '';
    const fd = await fsp.open(absPath, 'r');
    try {
      const len = Math.min(stat.size, maxBytes);
      const buf = Buffer.alloc(len);
      await fd.read(buf, 0, len, 0);
      return buf.toString('utf8');
    } finally {
      await fd.close();
    }
  } catch {
    return '';
  }
}

async function walk(dirAbs) {
  const out = [];
  const entries = await fsp.readdir(dirAbs, { withFileTypes: true });
  for (const ent of entries) {
    const abs = path.join(dirAbs, ent.name);
    const r = rel(abs);
    if (ent.isDirectory()) {
      if (isIgnoredDir(r)) continue;
      out.push(...await walk(abs));
    } else if (ent.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

function isTextFileByExt(p) {
  return TEXT_EXTS.has(path.extname(p).toLowerCase());
}

function normalizeRel(p) {
  return p.replaceAll('\\', '/');
}

function resolveRefPath(ref, sourceFile) {
  // Only handle relative './' '../' or root '/'
  if (!ref) return null;
  if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('data:')) return null;
  if (!(ref.startsWith('./') || ref.startsWith('../') || ref.startsWith('/'))) return null;
  const sourceDir = path.dirname(sourceFile);
  const abs = ref.startsWith('/') ? path.join(ROOT, ref) : path.resolve(sourceDir, ref);
  return abs;
}

function* extractReferences(content) {
  // Return {type, match, path, line}
  const patterns = [
    { type: 'html_attr', rx: /(src|href)\s*=\s*(["'])([^"']+)\2/g },
    { type: 'css_url', rx: /url\(\s*(["']?)([^"')]+)\1\s*\)/g },
    { type: 'php_include', rx: /(include|require|include_once|require_once)\s*\(?\s*(["'])([^"']+)\2\s*\)?/g },
    { type: 'js_import', rx: /import\s+[^;]*?from\s*(["'])([^"']+)\1/g },
    { type: 'js_import2', rx: /import\s*\(\s*(["'])([^"']+)\1\s*\)/g },
    { type: 'js_side_import', rx: /import\s*(["'])([^"']+)\1/g },
    { type: 'js_require', rx: /require\(\s*(["'])([^"']+)\1\s*\)/g },
  ];
  // For line numbers, walk lines and test each line with patterns to avoid heavy global match with index-to-line mapping
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of patterns) {
      let m;
      p.rx.lastIndex = 0;
      while ((m = p.rx.exec(line)) !== null) {
        const target = m[3] || m[2];
        if (!target) continue;
        yield { type: p.type, match: m[0], path: target, line: i + 1 };
      }
    }
  }
}

async function main() {
  await fsp.mkdir(reportDir, { recursive: true });

  const allFilesAbs = await walk(ROOT);
  const results = [];
  const nonCompliant = [];
  const missingRefs = [];
  const summary = { counts: {}, byCategory: {}, byDir: {}, notes: [] };

  // Preload content samples only for PHP files to detect classes, and for text files during reference scan
  const contentCache = new Map();

  // First pass: classification
  for (const abs of allFilesAbs) {
    const r = rel(abs);
    const base = path.basename(r);
    const ext = path.extname(r).toLowerCase();
    const _dirTop = r.split('/')[0] || '';

    if (isIgnoredDir(r)) continue;

    // Read sample for PHP
    let sample = '';
    if (ext === '.php') {
      sample = await readTextSample(abs, 80_000);
      contentCache.set(r, sample);
    }

    const info = categorize(r, sample);
    const { stem: _stem } = splitNameCore(base);
    const proposedBase = info.proposed;
    const proposedRel = r.slice(0, -base.length) + proposedBase;

    const compliant = proposedBase === base || info.reason === 'Conventional exception' || info.reason === 'compliant';

    const rec = {
      path: r,
      dir: path.dirname(r),
      base,
      ext,
      category: info.category,
      target_case: info.case,
      proposed_base: proposedBase,
      proposed_path: normalizeRel(proposedRel),
      reason: info.reason,
      confidence: info.confidence,
      compliant,
    };
    results.push(rec);

    if (!compliant && info.category !== 'exception') {
      nonCompliant.push(rec);
    }

    // Summary counts
    summary.counts.total = (summary.counts.total || 0) + 1;
    summary.byCategory[info.category] = (summary.byCategory[info.category] || 0) + 1;
    const d = rec.dir;
    summary.byDir[d] = (summary.byDir[d] || 0) + 1;
  }

  // Second pass: reference scanning for text files
  for (const abs of allFilesAbs) {
    const r = rel(abs);
    if (!isTextFileByExt(r)) continue;
    if (isIgnoredDir(r)) continue;
    let content = contentCache.get(r);
    if (content == null) {
      content = await readTextSample(abs, 500_000);
      contentCache.set(r, content);
    }

    for (const ref of extractReferences(content)) {
      const resolvedAbs = resolveRefPath(ref.path, abs);
      if (!resolvedAbs) continue; // skip bare imports or external urls
      const exists = fs.existsSync(resolvedAbs);
      if (!exists) {
        missingRefs.push({
          source_file: r,
          line: ref.line,
          ref_type: ref.type,
          target: ref.path,
          resolved_path: normalizeRel(rel(resolvedAbs)),
        });
      }
    }
  }

  // Risk flags: images folder references may be in DB; flag image renames
  const risky = nonCompliant.filter(x => x.ext.match(/^\.(png|jpg|jpeg|gif|svg|webp|woff2?|ttf|otf)$/i));
  if (risky.length) {
    summary.notes.push(`${risky.length} asset(s) proposed for rename that may be referenced from the database. These will require coordinated DB updates.`);
  }

  // Output reports
  const jsonPath = path.join(reportDir, 'proposed-renames.json');
  const tsvPath = path.join(reportDir, 'proposed-renames.tsv');
  const missingPath = path.join(reportDir, 'missing-references.json');
  const summaryPath = path.join(reportDir, 'summary.json');
  const readmePath = path.join(reportDir, 'README.md');

  await fsp.writeFile(jsonPath, JSON.stringify({ generated_at: now.toISOString(), non_compliant: nonCompliant, all: results }, null, 2), 'utf8');

  const tsvHeader = ['path','category','target_case','proposed_path','reason','confidence'].join('\t');
  const tsvLines = [tsvHeader, ...nonCompliant.map(r => [r.path, r.category, r.target_case, r.proposed_path, r.reason, r.confidence].join('\t'))];
  await fsp.writeFile(tsvPath, tsvLines.join('\n'), 'utf8');

  await fsp.writeFile(missingPath, JSON.stringify({ generated_at: now.toISOString(), missing: missingRefs }, null, 2), 'utf8');

  await fsp.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  const readme = `# Naming Convention Audit (Dry Run)\n\n- Generated: ${now.toISOString()}\n- Total files scanned: ${results.length}\n- Non-compliant files: ${nonCompliant.length}\n- Missing references: ${missingRefs.length}\n\n## Files\n- proposed-renames.json: Full details for all files and proposed targets\n- proposed-renames.tsv: Quick list of non-compliant files (tab-separated)\n- missing-references.json: Collected missing src/href/url/import/require/include paths found in text files\n- summary.json: Counts and notes\n\n## Notes\n- Images/fonts renames may be referenced from the database; coordinate updates before applying changes.\n- This is a dry-run report; no files were renamed.\n`;
  await fsp.writeFile(readmePath, readme, 'utf8');

  console.log(`\n✅ Dry-run scan complete.`);
  console.log(`Reports written to: ${rel(reportDir)}`);
  console.log(`- ${rel(jsonPath)}`);
  console.log(`- ${rel(tsvPath)}`);
  console.log(`- ${rel(missingPath)}`);
  console.log(`- ${rel(summaryPath)}`);
}

main().catch(err => {
  console.error('Scan failed:', err);
  process.exit(1);
});

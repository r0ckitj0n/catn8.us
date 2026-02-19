#!/usr/bin/env node
// CSS Inventory and Reorg Plan Generator (non-destructive)
//
// Outputs:
//  - logs/css-inventory.json: per-file selectors, media, rule counts
//  - logs/css-duplicates.json: cross-file duplicate and conflict report
//  - documentation/frontend/CSS_REORG_PLAN.md: proposed cohesive structure and mapping
//
// Notes:
//  - Reads from src/styles/**/*.css (excludes backups, dist, node_modules)
//  - Does NOT modify or move any CSS files

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import postcss from 'postcss';

let safeParser = null;
try {
  // Optional, will fallback if not installed
  const mod = await import('postcss-safe-parser');
  safeParser = mod.default || mod;
} catch (_) {
  // Fallback on default parser
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const _repoRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(__dirname, '..');
const SRC_STYLES = path.resolve(projectRoot, 'src/styles');
const LOGS_DIR = path.resolve(projectRoot, 'logs');
const DOCS_DIR = path.resolve(projectRoot, 'documentation/frontend');

const FLAG_PATTERNS = /(legacy|recovered|fixes?|final-fix)/i;

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function getAtRuleContext(node) {
  const parts = [];
  let cur = node.parent;
  while (cur) {
    if (cur.type === 'atrule') {
      parts.push(`@${cur.name} ${cur.params}`.trim());
    }
    cur = cur.parent;
  }
  return parts.reverse().join(' | '); // outer -> inner
}

function serializeDecls(rule) {
  const decls = [];
  rule.nodes?.forEach(n => {
    if (n.type === 'decl') {
      const prop = (n.prop || '').trim();
      const value = (n.value || '').replace(/\s+/g, ' ').trim();
      decls.push(`${prop}:${value}`);
    }
  });
  // Deterministic order
  decls.sort();
  return decls.join(';');
}

function _rankTargetByHeuristics(selector) {
  // Basic routing heuristics to suggest cohesive buckets
  // Pages
  if (/body\s*\[data-page=['"]about['"]\]/.test(selector)) return 'pages/about.css';
  if (/body\s*\[data-page=['"]contact['"]\]/.test(selector)) return 'pages/contact.css';
  if (/room|main-room|room-main|room-page|\.main-room-section|\[data-page=['"]room/.test(selector)) return 'pages/room.css';
  // Admin
  if (/\badmin\b|\badmin-/.test(selector)) return 'admin/admin-base.css';
  // Components
  if (/modal|overlay|dialog/.test(selector)) return 'components/modal.css';
  if (/room-modal/.test(selector)) return 'components/room-modal.css';
  if (/popup/.test(selector)) return 'components/popup.css';
  if (/qty|quantity/.test(selector)) return 'components/qty-button.css';
  // Systems
  if (/sales|cart|checkout/.test(selector)) return 'systems/sales.css';
  // Utilities fallback
  return 'base/site-base.css';
}

function proposedFileMappingForFlagged(fileRel) {
  const base = path.basename(fileRel);
  switch (base) {
    case 'room-modal-header-fixes.css':
      return { type: 'merge', target: 'components/room-modal-header.css', note: 'Merge into existing header component.' };
    case 'room-main-header-fixes.css':
      return { type: 'move', target: 'pages/room.css' };
    case 'legacy_missing_room_main.css':
      return { type: 'move', target: 'pages/room.css' };
    case 'qty-button-final-fix.css':
      return { type: 'move', target: 'components/qty-button.css' };
    case 'detailed-item-modal-fixes.css':
      return { type: 'move', target: 'components/detailed-item-modal.css' };
    case 'modal-fixes.css':
      return { type: 'move', target: 'components/modal.css' };
    case 'legacy_missing_admin.css':
      return { type: 'move', target: 'admin/admin-base.css' };
    case 'legacy_missing_room_modal.css':
      return { type: 'merge', target: 'components/room-modal.css', note: 'Merge into room-modal component.' };
    case 'recovered_components.css':
      return { type: 'split', target: 'components/components-base.css', note: 'Distribute to proper components; temporary staging file.' };
    case 'recovered_missing.css':
      return { type: 'split', target: 'components/aux-styles.css', note: 'Distribute across components/pages; staging before split.' };
    default:
      if (base.includes('recovered') || base.includes('fix')) {
        return { type: 'split', target: 'components/aux-styles.css', note: 'General recovered/fix styles to be distributed.' };
      }
      return null;
  }
}

async function ensureDirs() {
  await fs.mkdir(LOGS_DIR, { recursive: true });
  await fs.mkdir(DOCS_DIR, { recursive: true });
}

async function loadCssFiles() {
  const patterns = [
    toPosix(path.relative(projectRoot, path.join(SRC_STYLES, '**/*.css'))),
    '!**/node_modules/**',
    '!**/dist/**',
    '!backups/**'
  ];
  const files = await glob(patterns, { cwd: projectRoot, nodir: true, absolute: true });
  return files.sort();
}

async function parseCss(file) {
  const css = await fs.readFile(file, 'utf8');
  const root = postcss.parse(css, { from: file, parser: safeParser || undefined });
  return root;
}

function collectFromRoot(root, fileRel) {
  const fileInfo = {
    file: fileRel,
    flaggedByName: FLAG_PATTERNS.test(path.basename(fileRel)),
    totalRules: 0,
    selectors: {}, // selector -> count
    medias: {},    // media string -> count
    comments: [],  // comments containing legacy/recovered/fix
  };

  const dupUnits = []; // for duplicate hashing

  root.walkComments(c => {
    const text = (c.text || '').toLowerCase();
    if (/(legacy|recovered|fix|fixes)/.test(text)) {
      fileInfo.comments.push(text);
    }
  });

  root.walkRules(rule => {
    fileInfo.totalRules += 1;
    const mediaCtx = getAtRuleContext(rule);
    if (mediaCtx) fileInfo.medias[mediaCtx] = (fileInfo.medias[mediaCtx] || 0) + 1;
    const declSig = serializeDecls(rule);
    const selectors = (rule.selector || '').split(',').map(s => s.trim()).filter(Boolean);
    selectors.forEach(sel => {
      fileInfo.selectors[sel] = (fileInfo.selectors[sel] || 0) + 1;
      dupUnits.push({ selector: sel, media: mediaCtx, declSig });
    });
  });

  return { fileInfo, dupUnits };
}

async function main() {
  await ensureDirs();
  const files = await loadCssFiles();
  const inventory = [];

  // For duplicates across files
  const dupIndex = new Map(); // key -> Map(fileRel -> Set(declSig))

  // Proposed mapping for flagged files
  const proposedMappings = [];

  for (const abs of files) {
    const rel = toPosix(path.relative(projectRoot, abs));
    const root = await parseCss(abs);
    const { fileInfo, dupUnits } = collectFromRoot(root, rel);
    inventory.push(fileInfo);

    // Duplicate index population
    const fileKey = rel;
    for (const u of dupUnits) {
      const key = `${u.media}||${u.selector}`;
      if (!dupIndex.has(key)) dupIndex.set(key, new Map());
      const m = dupIndex.get(key);
      if (!m.has(fileKey)) m.set(fileKey, new Set());
      m.get(fileKey).add(u.declSig);
    }

    // Proposed mapping
    if (fileInfo.flaggedByName) {
      const mapping = proposedFileMappingForFlagged(rel);
      if (mapping) proposedMappings.push({ source: rel, ...mapping });
    }
  }

  // Compute duplicates and conflicts across files
  const duplicates = []; // identical declSig across different files for same selector+media
  const conflicts = [];  // different declSig across different files for same selector+media

  for (const [key, fileMap] of dupIndex.entries()) {
    const declSets = [...fileMap.values()].map(s => [...s]);
    const flat = new Set(declSets.flat());
    const filesForKey = [...fileMap.keys()];

    // If more than one file defines this selector+media
    if (filesForKey.length > 1) {
      if (flat.size === 1) {
        // All declarations identical across files
        duplicates.push({ selectorMedia: key, files: filesForKey, declSig: [...flat][0] });
      } else {
        // Differing declarations across files
        conflicts.push({ selectorMedia: key, files: filesForKey, declSigs: declSets });
      }
    }
  }

  // Sort for readability
  inventory.sort((a, b) => a.file.localeCompare(b.file));
  proposedMappings.sort((a, b) => a.source.localeCompare(b.source));
  duplicates.sort((a, b) => a.selectorMedia.localeCompare(b.selectorMedia));
  conflicts.sort((a, b) => a.selectorMedia.localeCompare(b.selectorMedia));

  // Write JSON logs
  await fs.writeFile(path.join(LOGS_DIR, 'css-inventory.json'), JSON.stringify({ generatedAt: new Date().toISOString(), files: inventory }, null, 2));
  await fs.writeFile(path.join(LOGS_DIR, 'css-duplicates.json'), JSON.stringify({ generatedAt: new Date().toISOString(), duplicates, conflicts }, null, 2));

  // Generate reorg plan markdown
  const planMd = generatePlanMarkdown(inventory, proposedMappings, duplicates, conflicts);
  await fs.writeFile(path.join(DOCS_DIR, 'CSS_REORG_PLAN.md'), planMd, 'utf8');

  // Console summary
  console.log(`CSS inventory written to: logs/css-inventory.json`);
  console.log(`Duplicates report written to: logs/css-duplicates.json`);
  console.log(`Reorg plan written to: documentation/frontend/CSS_REORG_PLAN.md`);
}

function generatePlanMarkdown(inventory, proposedMappings, duplicates, conflicts) {
  // Directory structure suggestion
  const structure = [
    'src/styles/',
    '  base/',
    '    reset.css (optional)',
    '    site-base.css',
    '    tokens.css (optional)',
    '  utilities/',
    '    z-index.css',
    '    utilities-ui.css',
    '  components/',
    '    popup.css',
    '    modal.css',
    '    room-modal.css',
    '    room-modal-header.css',
    '    detailed-item-modal.css',
    '    qty-button.css',
    '    search-modal.css',
    '  pages/',
    '    room.css',
    '    contact.css',
    '    about.css',
    '  admin/',
    '    admin-base.css',
    '    admin-inventory.css',
    '    admin-db-tools.css',
    '    admin-modals.css',
    '  systems/',
    '    sales.css',
    '  main.css (imports only)'
  ].join('\n');

  const totalRules = inventory.reduce((sum, f) => sum + (f.totalRules || 0), 0);
  const flagged = inventory.filter(f => f.flaggedByName);

  const header = `# CSS Reorganization Plan (Non-Destructive Draft)\n\n` +
`Generated: ${new Date().toISOString()}\n\n` +
`- Total CSS files analyzed: ${inventory.length}\n` +
`- Total rules counted: ${totalRules}\n` +
`- Files flagged by name (legacy/recovered/fix): ${flagged.length}\n` +
`\n` +
`## Proposed Cohesive Structure\n\n` +
'```\n' + structure + '\n```\n\n' +
`## Proposed Mapping for Flagged Files\n\n` +
(proposedMappings.length ? proposedMappings.map(m => `- ${m.source} -> ${m.type.toUpperCase()} -> src/styles/${m.target}${m.note ? ` (${m.note})` : ''}`).join('\n') : '* None found') +
`\n\n` +
`## Duplicate Rules Across Files (Exact Matches)\n\n` +
(duplicates.length ? duplicates.slice(0, 200).map(d => `- ${d.selectorMedia} in ${d.files.join(', ')}`).join('\n') : '* None') +
`\n\n` +
`## Conflicting Rules Across Files (Same selector/media, different declarations)\n\n` +
(conflicts.length ? conflicts.slice(0, 200).map(c => `- ${c.selectorMedia} in ${c.files.join(', ')}`).join('\n') : '* None') +
`\n\n` +
`## Notes\n\n` +
`- This plan is non-destructive. Next step is to implement moves/merges per mapping, then re-run inventory to confirm no loss.\n` +
`- Recovered and fixes buckets should be distributed into components/pages as indicated.\n` +
`- Conflicts require human review to decide authoritative values.\n`;

  return header;
}

main().catch(err => {
  console.error('[css-inventory] Error:', err);
  process.exitCode = 1;
});

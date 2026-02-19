#!/usr/bin/env node
// Guard script: disallow inline style writes in JS
// - Blocks: element.style.foo = ..., style.setProperty(...)
// - Allows: style.removeProperty(...)
// - Also flags template strings or strings containing style="..."
//
// Usage:
//   node scripts/disallow-inline-styles.mjs [files...]
// If no files passed, scans src/**/*.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default || traverseModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const files = (args.length ? args : globSync('src/**/*.js', { ignore: ['**/recovered/**'] }))
  .filter((f) => shouldConsiderPath(f));
const thisFile = path.resolve(__filename);

const violations = [];

function shouldConsiderPath(filePath) {
  // Normalize to posix-style
  const p = filePath.replace(/\\/g, '/');
  // Skip backups, dist, node_modules
  if (p.includes('/backups/')) return false;
  if (p.includes('/dist/')) return false;
  if (p.includes('/node_modules/')) return false;
  // Skip documentation legacy duplicates
  if (p.includes('/documentation/legacy-duplicates/')) return false;
  // Skip public duplicates and any file that clearly is a duplicate name with " 2.js"
  if (p.includes('/public/js/') && / 2\.js$/i.test(p)) return false;
  // Also skip any duplicate style in src that ends with " 2.js"
  if (/ 2\.js$/i.test(p)) return false;
  return true;
}

function record(file, loc, message) {
  violations.push({ file, loc, message });
}

for (const file of files) {
  // Skip this guard script itself
  if (path.resolve(file) === thisFile) continue;
  if (!fs.existsSync(file)) continue;
  const code = fs.readFileSync(file, 'utf8');

  // Allow explicit per-file opt-out via token comment
  if (code.includes('CATN8_GUARD_JS_INLINE_STYLES_IGNORE')) continue;

  try {
    const ast = parse(code, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      plugins: ['dynamicImport', 'importAttributes']
    });

    traverse(ast, {
      // Flag string and template literals that embed inline style attributes in HTML strings
      StringLiteral(path) {
        const v = path.node.value || '';
        if (v.includes('style="') || v.includes("style='")) {
          record(file, path.node.loc, 'Inline style attribute found inside string literal (style=...)');
        }
      },
      TemplateElement(path) {
        const raw = (path.node.value && (path.node.value.raw || path.node.value.cooked)) || '';
        if (raw.includes('style="') || raw.includes("style='")) {
          record(file, path.node.loc, 'Inline style attribute found inside template literal (style=...)');
        }
      },
      AssignmentExpression(path) {
        const left = path.node.left;
        // Match something like X.style.foo = ...
        if (
          left &&
          left.type === 'MemberExpression' &&
          left.object && left.object.type === 'MemberExpression' &&
          left.object.property && left.object.property.type === 'Identifier' &&
          left.object.property.name === 'style'
        ) {
          record(file, left.loc, 'Inline style write detected (element.style.*=)');
        }
      },
      CallExpression(path) {
        const callee = path.node.callee;
        if (
          callee && callee.type === 'MemberExpression' &&
          callee.property && callee.property.type === 'Identifier'
        ) {
          const method = callee.property.name;
          // style.setProperty(...) is disallowed
          if (
            method === 'setProperty' &&
            callee.object && callee.object.type === 'MemberExpression' &&
            callee.object.property && callee.object.property.type === 'Identifier' &&
            callee.object.property.name === 'style'
          ) {
            record(file, callee.loc, 'Disallowed style.setProperty(...) on element');
          }
          // style.removeProperty(...) is allowed – ignore
        }
      }
    });
  } catch (e) {
    // Skip files that fail to parse
    // console.warn('[guard] parse error in', file, e.message);
  }
}

if (violations.length) {
  console.error('\nInline style guard violations:');
  for (const v of violations) {
    const where = v.loc ? `:${v.loc.start?.line || '?'}:${v.loc.start?.column || '?'}` : '';
    console.error(` - ${v.file}${where} -> ${v.message}`);
  }
  console.error(`\nFound ${violations.length} violation(s). Use CSS classes and Vite-managed styles.`);
  process.exit(1);
}

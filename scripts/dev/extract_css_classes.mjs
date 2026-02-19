#!/usr/bin/env node
/*
  Extract CSS class selectors from the codebase, generate descriptive names and snarky tooltips,
  and optionally seed them into the DB via /api/help_tooltips.php?action=upsert using the admin token.

  Outputs:
  - reports/css-classes.json: { generatedAt, sources: [{file, classes: [".class-name", ...]}], totals }
  - reports/css-tooltips.json: array of { element_id, page_context, title, content, position, is_active }

  Usage:
    node scripts/dev/extract_css_classes.mjs               # generate JSON only
    SEED=true node scripts/dev/extract_css_classes.mjs     # also POST upserts to API

  Env:
    API_BASE=http://localhost:8080 (default)
    ADMIN_TOKEN=whimsical_admin_2024 (default)
*/
import { promises as fs } from 'fs';
import path from 'path';
import url from 'url';
import _os from 'os';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
const srcDirs = [
  'src/styles',
  'src/styles/components',
  'src/css',
  'css'
].map(p => path.join(repoRoot, p));

const reportsDir = path.join(repoRoot, 'reports');
const outJson = path.join(reportsDir, 'css-classes.json');
const outTooltips = path.join(reportsDir, 'css-tooltips.json');
const outSettingsTooltips = path.join(reportsDir, 'settings-tooltips.json');

const API_BASE = process.env.API_BASE || 'http://localhost:8080';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'whimsical_admin_2024';
const SHOULD_SEED = String(process.env.SEED || '').toLowerCase() === 'true';

const CLASS_REGEX = /\.[a-zA-Z_][a-zA-Z0-9_-]*/g; // match .class-name

function titleCaseFromClass(cls) {
  const name = cls.replace(/^\./, '').replace(/[_-]+/g, ' ');
  return name.replace(/\b\w/g, m => m.toUpperCase());
}

function snarkForClass(cls) {
  const base = cls.replace(/^\./, '');
  const nicename = titleCaseFromClass(cls);
  const quips = [
    `Controls the mystical powers of ${nicename}. Use wisely, Gandalf.`,
    `Makes ${nicename} look like you actually meant it. Fancy.`,
    `Because without ${nicename}, the UI looked like a Craigslist ad.`,
    `Sprinkles just enough flair on ${nicename} to impress your future self.`,
    `Turns ${nicename} from "meh" into "chef's kiss". You're welcome.`,
    `What does it do? It ${base.includes('btn') ? 'styles your button like a boss' : 'bosses your layout around'}.`,
    `Keeps ${nicename} from wandering off the layout like a toddler in a candy store.`,
  ];
  return quips[base.length % quips.length];
}

async function walk(dir, acc = []) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p, acc);
      else if (e.isFile() && p.endsWith('.css')) acc.push(p);
    }
  } catch (_) {
    // ignore missing dirs
  }
  return acc;
}

async function extractFromFile(file) {
  const text = await fs.readFile(file, 'utf8');
  const matches = new Set();
  let m;
  while ((m = CLASS_REGEX.exec(text))) {
    // skip CSS pseudo-classes like .btn:hover by trimming at ':'
    const raw = m[0];
    const clean = raw.split(':')[0];
    // ignore utility placeholders like .- or invalid
    if (clean === '.' || clean.length < 2) continue;
    matches.add(clean);
  }
  return Array.from(matches).sort();
}

async function main() {
  await fs.mkdir(reportsDir, { recursive: true });
  const files = (await Promise.all(srcDirs.map(d => walk(d)))).flat();
  const sources = [];
  const globalSet = new Set();

  for (const file of files) {
    const classes = await extractFromFile(file);
    if (classes.length) {
      sources.push({ file: path.relative(repoRoot, file), classes });
      classes.forEach(c => globalSet.add(c));
    }
  }

  const allClasses = Array.from(globalSet).sort();
  const catalog = {
    generatedAt: new Date().toISOString(),
    totals: { files: files.length, sources: sources.length, classes: allClasses.length },
    sources,
    allClasses,
  };
  await fs.writeFile(outJson, JSON.stringify(catalog, null, 2));

  // Build tooltips payloads for page_context 'css_reference'
  const tooltips = allClasses.map(cls => ({
    element_id: `css:${cls}`,
    page_context: 'css_reference',
    title: titleCaseFromClass(cls),
    content: snarkForClass(cls),
    position: 'top',
    is_active: 1,
  }));
  await fs.writeFile(outTooltips, JSON.stringify(tooltips, null, 2));

  // Extract Admin Settings options/modals to generate humorous tooltips
  const settingsPath = path.join(repoRoot, 'sections', 'admin_settings.php');
  let settingsTooltips = [];
  try {
    const settingsHtml = await fs.readFile(settingsPath, 'utf8');
    // Collect element ids (buttons, inputs, modals) and data-action values
    const idRegex = /\bid\s*=\s*"([a-zA-Z0-9_-]+)"/g;
    const actionRegex = /data-action=\s*"([-a-zA-Z0-9_:.]+)"/g;
    const ids = new Set();
    const actions = new Set();
    let m;
    while ((m = idRegex.exec(settingsHtml))) ids.add(m[1]);
    while ((m = actionRegex.exec(settingsHtml))) actions.add(m[1]);

    const toEntry = (key, kind) => ({
      element_id: `${kind}:${key}`,
      page_context: 'settings',
      title: titleCaseFromClass('.' + key.replace(/:/g, '-')),
      content: `Because you clicked ${key}. ${snarkForClass('.' + key.replace(/:/g, '-'))}`,
      position: 'bottom',
      is_active: 1,
    });
    ids.forEach(id => settingsTooltips.push(toEntry(id, 'id')));
    actions.forEach(act => settingsTooltips.push(toEntry(act, 'action')));
    // De-dup by element_id
    const seen = new Set();
    settingsTooltips = settingsTooltips.filter(t => (seen.has(t.element_id) ? false : (seen.add(t.element_id), true)));
  } catch (e) {
    // ignore if settings file missing
  }
  if (settingsTooltips.length) {
    await fs.writeFile(outSettingsTooltips, JSON.stringify(settingsTooltips, null, 2));
    // Seed if requested
    if (SHOULD_SEED) {
      const doFetch = async (url, opts) => {
        if (typeof fetch === 'function') return fetch(url, opts);
        const nf = (await import('node-fetch')).default;
        return nf(url, opts);
      };
      let ok = 0, fail = 0;
      for (const t of settingsTooltips) {
        try {
          const res = await doFetch(`${API_BASE}/api/help_tooltips.php?action=upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...t, admin_token: ADMIN_TOKEN }),
          });
          if (!res.ok) throw new Error(`${res.status}`);
          ok++;
        } catch (e) {
          fail++;
          process.stderr.write(`Failed upsert ${t.element_id}: ${e}\n`);
        }
      }
      console.log(`Upserted Settings tooltips: ${ok} ok, ${fail} failed`);
    }
  }

  // Seed to API if requested
  if (SHOULD_SEED) {
    const doFetch = async (url, opts) => {
      if (typeof fetch === 'function') return fetch(url, opts);
      const nf = (await import('node-fetch')).default;
      return nf(url, opts);
    };
    let ok = 0, fail = 0;
    for (const t of tooltips) {
      try {
        const res = await doFetch(`${API_BASE}/api/help_tooltips.php?action=upsert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...t, admin_token: ADMIN_TOKEN }),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        ok++;
      } catch (e) {
        fail++;
        process.stderr.write(`Failed upsert ${t.element_id}: ${e}\n`);
      }
    }
    console.log(`Upserted CSS tooltips: ${ok} ok, ${fail} failed`);
  }

  console.log(`CSS class catalog written: ${path.relative(repoRoot, outJson)} (${allClasses.length} classes)`);
  if (settingsTooltips.length) {
    console.log(`Settings tooltips written: ${path.relative(repoRoot, outSettingsTooltips)} (${settingsTooltips.length} entries)`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

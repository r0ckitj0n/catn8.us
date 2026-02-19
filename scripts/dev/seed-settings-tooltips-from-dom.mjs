#!/usr/bin/env node
/**
 * Seed Settings page tooltips by scanning the live DOM in headless Chrome
 * - Loads /sections/admin_settings.php
 * - Uses CATN8_TooltipAudit.suggest('settings') when available
 * - Falls back to in-page DOM scan if CATN8_TooltipAudit isn't present
 * - Curates snarky, helpful copy using the same patterns as curate_unique_tooltips
 */

import _fs from 'fs/promises';
import _path from 'path';

let puppeteer = null;
try {
  puppeteer = (await import('puppeteer')).default;
} catch (_) {
  try { puppeteer = (await import('puppeteer-core')).default; } catch (e) {
    console.error('[seed-settings-dom] Missing dependency: install puppeteer-core or puppeteer');
    process.exit(1);
  }
}

const BASE = process.env.CATN8_BASE_URL || 'http://localhost:8888';
const IS_LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const API_URL = `${BASE}/api/help_tooltips.php`;
const ADMIN_TOKEN = process.env.CATN8_ADMIN_TOKEN || 'whimsical_admin_2024';
const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');

async function postJson(url, body) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (IS_LOCAL) headers['X-WF-Dev-Admin'] = '1';
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ ...body, admin_token: ADMIN_TOKEN }) });
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}`);
  return res.json();
}

function generateCopy(elementId) {
  const id = String(elementId || '').toLowerCase();
  // Targeted patterns (subset of curate_unique_tooltips)
  const map = [
    [/^admindashboardtab$/, `Your empire at a glance. Try not to panic.`],
    [/^admincustomerstab$/, `Treat them well. They have the money.`],
    [/^admininventorytab$/, `Where SKUs go to multiply when you’re not looking.`],
    [/^adminorderstab$/, `Organize chaos into packages.`],
    [/^adminpostab$/, `Point-of-Sale, not the other POS you were thinking.`],
    [/^adminreportstab$/, `Because spreadsheets are a love language.`],
    [/^adminmarketingtab$/, `Convince strangers to love your brand. No pressure.`],
    [/^adminsettingstab$/, `The control room. Flip switches, look important.`],
    [/^open[-_]?email[-_]?history|emailhistorybtn/, `Open the email activity log. Proof your messages actually left the building.`],
    [/^refresh[-_]?categories$/, `When in doubt, mash refresh. It fixes everything... eventually.`],
    [/^delete[-_]?item$/, `Send this SKU to the big warehouse in the sky.`],
    [/^navigate[-_]?item$/, `Because scrolling is passé.`],
    [/^open[-_]?cost[-_]?modal$/, `Crunch the numbers so the numbers don't crunch you.`],
    [/^save[-_]?cost[-_]?item$/, `Commit your math to the database like you mean it.`],
    [/^delete[-_]?cost[-_]?item$/, `Goodbye, questionable expense.`],
    [/^clear[-_]?cost[-_]?breakdown$/, `Nuke it from orbit—it’s the only way to be sure.`],
    [/^get[-_]?cost[-_]?suggestion$/, `Ask the machine what it thinks money is.`],
    [/^get[-_]?price[-_]?suggestion$/, `Robot says charge more. You probably should.`],
    [/^apply[-_]?price[-_]?suggestion$/, `Trust the algorithm. What could go wrong?`],
    [/^open[-_]?marketing[-_]?manager$/, `Outsource creativity to silicon.`],
    [/^generate[-_]?marketing[-_]?copy$/, `AI-generated enthusiasm—now with fewer typos.`],
    [/^process[-_]?images[-_]?ai$/, `Let AI crop everything because rectangles are hard.`],
    [/^open[-_]?color[-_]?template[-_]?modal$/, `Because one shade of blue was never enough.`],
    [/^open[-_]?global[-_]?colors[-_]?management$/, `Centralize your rainbow like a responsible adult.`],
  ];
  for (const [re, text] of map) if (re.test(id)) return text;
  // Default variants for settings
  const fallbacks = [
    `Tweaks how the system behaves. Make a change, then make it proud.`,
    `Configuration central. Adjust, test, pretend it was always like this.`,
    `Settings switchboard. Flip wisely; results may vary delightfully.`,
    `Tune the knobs until it sings. Bonus points for not breaking anything.`,
    `House rules for the app. Keep it tidy; future-you will cheer.`
  ];
  const h = Array.from(id).reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0),0);
  return fallbacks[Math.abs(h)%fallbacks.length];
}

async function getSuggestionsFromPage(page) {
  // Try CATN8_TooltipAudit first
  const suggestions = await page.evaluate(async () => {
    try {
      if (window.CATN8_TooltipAudit && typeof window.CATN8_TooltipAudit.suggest === 'function') {
        return window.CATN8_TooltipAudit.suggest('settings');
      }
    } catch {}
    // Fallback: simple DOM scan
    const q = (sel) => Array.from(document.querySelectorAll(sel));
    const candidates = q('button, a, [role="button"], [data-action], label').filter(el => !el.disabled && el.offsetParent !== null);
    const getId = (el) => el.id || el.getAttribute('data-help-id') || el.getAttribute('data-action') || '';
    const textOf = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g,' ').slice(0,120);
    const out = [];
    for (const el of candidates) {
      let id = getId(el);
      if (!id && el.matches && el.matches('label')) {
        const forId = el.getAttribute('for');
        if (forId) id = `label[for="${forId}"]`;
      }
      if (el.matches && el.matches('input, select, textarea')) {
        const fid = el.id || '';
        if (fid) id = `label[for="${fid}"]`;
      }
      if (!id) continue;
      const title = textOf(el) || id;
      out.push({ element_id: id, page_context: 'settings', title, content: '', position: 'top', is_active: 1 });
      if (out.length >= 80) break;
    }
    return out;
  });
  return suggestions || [];
}

async function main() {
  // Launch browser
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '';
  const launchOpts = { headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] };
  if (executablePath) launchOpts.executablePath = executablePath;
  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });

  const url = `${BASE}/sections/admin_settings.php`;
  await page.goto(url, { waitUntil: 'networkidle2' }).catch(()=>{});
  // Give scripts a moment to load and TooltipManager to populate
  await page.waitForTimeout(800);

  const raw = await getSuggestionsFromPage(page);
  await browser.close();

  // Fetch current settings tooltips to filter out existing ones
  const currentRes = await fetch(`${API_URL}?action=get&page_context=settings`, { headers: { 'Accept':'application/json', ...(IS_LOCAL ? { 'X-WF-Dev-Admin': '1' } : {}) } });
  const current = currentRes.ok ? await currentRes.json() : { success:true, tooltips:[] };
  const existing = new Set((current.tooltips || []).map(t => String(t.element_id)));

  const planned = raw.filter(s => !existing.has(String(s.element_id)));
  // Curate copy
  for (const p of planned) p.content = generateCopy(p.element_id);

  console.log(`[seed-settings-dom] Suggestions: ${raw.length}, Existing: ${existing.size}, Missing: ${planned.length}`);
  if (!APPLY) {
    for (const p of planned.slice(0, 60)) console.log(` - [${p.page_context}] ${p.element_id}: ${p.title}`);
    console.log('Run with --apply to create');
    return;
  }

  let upserted = 0;
  for (const p of planned) {
    try {
      const res = await postJson(`${API_URL}?action=upsert`, p);
      if (res && res.success) upserted++;
    } catch {}
  }
  console.log(`[seed-settings-dom] Upserted ${upserted}/${planned.length} tooltips.`);
}

main().catch(err => { console.error('[seed-settings-dom] Fatal:', err); process.exit(1); });

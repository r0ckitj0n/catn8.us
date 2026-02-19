#!/usr/bin/env node
/**
 * Seed Settings page tooltips by fetching HTML and scanning for active controls
 * - Fetches /sections/admin_settings.php?modal=1 to avoid full admin chrome
 * - Finds: buttons, links, [role="button"], [data-action], labels (label[for])
 * - Skips items that already have tooltips
 * - Generates snarky/helpful copy with targeted patterns + context variants
 */

const BASE = process.env.CATN8_BASE_URL || 'http://localhost:8888';
const IS_LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const API_URL = `${BASE}/api/help_tooltips.php`;
const PAGE_URL = `${BASE}/sections/admin_settings.php?modal=1`;
const ADMIN_TOKEN = process.env.CATN8_ADMIN_TOKEN || 'whimsical_admin_2024';
const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');

async function getText(url) {
  const headers = { 'Accept': 'text/html' };
  if (IS_LOCAL) headers['X-WF-Dev-Admin'] = '1';
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}
async function getJson(url) {
  const headers = { 'Accept': 'application/json' };
  if (IS_LOCAL) headers['X-WF-Dev-Admin'] = '1';
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}
async function postJson(url, body) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (IS_LOCAL) headers['X-WF-Dev-Admin'] = '1';
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ ...body, admin_token: ADMIN_TOKEN }) });
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}`);
  return res.json();
}

function unescapeHtml(s='') { return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'"); }
function stripTags(s='') { return unescapeHtml(String(s).replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim(); }

function findAll(regex, text) {
  const out = []; let m;
  while ((m = regex.exec(text)) !== null) out.push(m);
  return out;
}

function collectCandidates(html) {
  const out = [];
  // Buttons
  for (const m of findAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi, html)) {
    const attrs = m[1] || ''; const inner = m[2] || '';
    const id = (attrs.match(/\bid\s*=\s*"([^"]+)"/i) || [])[1] || (attrs.match(/\bid\s*=\s*'([^']+)'/i) || [])[1] || '';
    const da = (attrs.match(/\bdata-action\s*=\s*"([^"]+)"/i) || [])[1] || (attrs.match(/\bdata-action\s*=\s*'([^']+)'/i) || [])[1] || '';
    const aria = (attrs.match(/\baria-label\s*=\s*"([^"]+)"/i) || [])[1] || (attrs.match(/\baria-label\s*=\s*'([^']+)'/i) || [])[1] || '';
    const title = stripTags(aria || inner);
    const element_id = id || da || '';
    if (!element_id) continue;
    out.push({ element_id, title });
  }
  // Links
  for (const m of findAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, html)) {
    const attrs = m[1] || ''; const inner = m[2] || '';
    const id = (attrs.match(/\bid\s*=\s*"([^"]+)"/i) || [])[1] || (attrs.match(/\bid\s*=\s*'([^']+)'/i) || [])[1] || '';
    const da = (attrs.match(/\bdata-action\s*=\s*"([^"]+)"/i) || [])[1] || (attrs.match(/\bdata-action\s*=\s*'([^']+)'/i) || [])[1] || '';
    const aria = (attrs.match(/\baria-label\s*=\s*"([^"]+)"/i) || [])[1] || (attrs.match(/\baria-label\s*=\s*'([^']+)'/i) || [])[1] || '';
    const title = stripTags(aria || inner);
    const element_id = id || da || '';
    if (!element_id) continue;
    out.push({ element_id, title });
  }
  // Generic [data-action]
  for (const m of findAll(/<([a-z0-9:-]+)\b([^>]*)>/gi, html)) {
    const _tag = (m[1] || '').toLowerCase(); const attrs = m[2] || '';
    const da = (attrs.match(/\bdata-action\s*=\s*"([^"]+)"/i) || [])[1] || (attrs.match(/\bdata-action\s*=\s*'([^']+)'/i) || [])[1] || '';
    if (!da) continue;
    // Exclude if already captured by button/a with same id/action
    out.push({ element_id: da, title: da });
  }
  // Labels
  for (const m of findAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi, html)) {
    const attrs = m[1] || ''; const inner = m[2] || '';
    const forId = (attrs.match(/\bfor\s*=\s*"([^"]+)"/i) || [])[1] || (attrs.match(/\bfor\s*=\s*'([^']+)'/i) || [])[1] || '';
    if (!forId) continue;
    const element_id = `label[for="${forId}"]`;
    const title = stripTags(inner) || forId;
    out.push({ element_id, title });
  }
  // De-duplicate by element_id
  const seen = new Set();
  return out.filter(x => { if (seen.has(x.element_id)) return false; seen.add(x.element_id); return true; });
}

function generateCopy(elementId) {
  const id = String(elementId || '').toLowerCase();
  const pairs = [
    [/^admindashboardtab$/, `Your empire at a glance. Try not to panic.`],
    [/^admincustomerstab$/, `Treat them well. They have the money.`],
    [/^admininventorytab$/, `Where SKUs go to multiply when you’re not looking.`],
    [/^adminorderstab$/, `Organize chaos into packages.`],
    [/^adminpostab$/, `Point-of-Sale, not the other POS you were thinking.`],
    [/^adminreportstab$/, `Because spreadsheets are a love language.`],
    [/^adminmarketingtab$/, `Convince strangers to love your brand. No pressure.`],
    [/^adminsettingstab$/, `The control room. Flip switches, look important.`],
    [/^open[-_]?email[-_]?history|emailhistorybtn/, `Open the email activity log. Proof your messages actually left the building.`],
  ];
  for (const [re, txt] of pairs) if (re.test(id)) return txt;
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

async function main() {
  const html = await getText(PAGE_URL).catch(()=>'<html></html>');
  const candidates = collectCandidates(html);

  const res = await getJson(`${API_URL}?action=get&page_context=settings`).catch(()=>({ success:true, tooltips:[] }));
  const existing = new Set((res.tooltips||[]).map(t => String(t.element_id)));

  // Basic blacklist to avoid noisy admin help buttons
  const blacklist = new Set(['adminHelpToggleBtn','adminHelpDocsBtn','adminHelpDocsLink']);
  const planned = candidates
    .filter(c => !blacklist.has(c.element_id))
    .filter(c => !existing.has(String(c.element_id)))
    .map(c => ({ element_id: c.element_id, page_context: 'settings', title: c.title || c.element_id, content: generateCopy(c.element_id), position: 'top', is_active: 1 }));

  console.log(`[seed-settings-html] Candidates: ${candidates.length}, Existing: ${existing.size}, Missing: ${planned.length}`);
  if (!APPLY) {
    for (const p of planned.slice(0, 80)) console.log(` - [${p.page_context}] ${p.element_id}: ${p.title}`);
    console.log('Run with --apply to create');
    return;
  }

  let upserted = 0, errors = 0;
  for (const p of planned) {
    try { const r = await postJson(`${API_URL}?action=upsert`, p); if (r && r.success) upserted++; else errors++; } catch { errors++; }
  }
  console.log(`[seed-settings-html] Upserted ${upserted}/${planned.length}. Errors: ${errors}`);
}

main().catch(err => { console.error('[seed-settings-html] Fatal:', err); process.exit(1); });

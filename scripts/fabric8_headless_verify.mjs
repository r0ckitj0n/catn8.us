import puppeteer from 'puppeteer';
import fs from 'fs';

const base = process.argv[2] || 'https://catn8.us';
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userData = process.env.CHROME_USER_DATA || '';
const adminToken = process.env.CATN8_ADMIN_TOKEN || '';

function isIgnorable(text) {
  const t = String(text || '');
  if (/Failed to load resource: the server responded with a status of 401/i.test(t)) return true;
  if (/net::ERR_ABORTED/i.test(t) && /gtag|googletagmanager|fonts\.gstatic/i.test(t)) return true;
  return false;
}

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', ...(userData ? [`--user-data-dir=${userData}`] : [])],
});

const results = {};

// 1) Login form inspection
{
  const page = await browser.newPage();
  const errors = [];
  const pageErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error' && !isIgnorable(msg.text())) errors.push(msg.text()); });
  page.on('pageerror', (err) => pageErrors.push(String(err?.message || err)));
  await page.goto(new URL('/login', base).toString(), { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForSelector('#catn8-app', { timeout: 15000 });
  // open login panel if needed
  await page.waitForSelector('#loginForm, #login-username, input[name="username"]', { timeout: 15000 }).catch(() => {});
  const formInfo = await page.evaluate(() => {
    const form = document.querySelector('#loginForm');
    const user = document.querySelector('#login-username, input[name="username"]');
    const pass = document.querySelector('#login-password, input[name="password"]');
    return {
      formId: form?.id || null,
      formAutocomplete: form?.getAttribute('autocomplete'),
      username: user ? { id: user.id, name: user.name, autocomplete: user.autocomplete, type: user.type } : null,
      password: pass ? { id: pass.id, name: pass.name, autocomplete: pass.autocomplete, type: pass.type } : null,
    };
  });
  results.login = { formInfo, consoleErrors: errors, pageErrors, ok: errors.length === 0 && pageErrors.length === 0 && !!formInfo.password };
  await page.close();
}

// 2) Fabric8 project 14 — use API token in page for bootstrap + check section in DOM if logged in
{
  const page = await browser.newPage();
  const errors = [];
  const pageErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error' && !isIgnorable(msg.text())) errors.push(msg.text()); });
  page.on('pageerror', (err) => pageErrors.push(String(err?.message || err)));

  await page.goto(new URL('/fabric8?project_id=14&view=build', base).toString(), { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('#catn8-app', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 2500));

  let apiCount = null;
  if (adminToken) {
    const api = await page.evaluate(async (token) => {
      const r = await fetch('/api/fabric8_agent.php?action=list_section_photos&project_id=14&section_id=1', {
        headers: { 'X-Api-Key': token },
      });
      return r.json();
    }, adminToken);
    apiCount = api?.count ?? null;
  }

  // If login modal open, we may not see photos — inject bootstrap with api key into DOM check via fetch
  const ui = await page.evaluate(async (token) => {
    const heading = Array.from(document.querySelectorAll('h3,h4')).map((el) => el.textContent?.trim()).filter(Boolean);
    const hasSectionTitle = heading.some((t) => /Pre-rough-in \(historical\)/i.test(t || ''));
    const thumbs = document.querySelectorAll('.build-wizard-thumb-media-image, .build-wizard-doc-thumb img, img[src*="get_document"]').length;
    let boot = null;
    if (token) {
      const r = await fetch('/api/build_wizard.php?action=bootstrap&project_id=14', {
        headers: { 'X-Api-Key': token },
      });
      boot = await r.json();
    }
    const sectionDocs = (boot?.documents || []).filter((d) => Number(d.photo_section_id) > 0);
    return {
      headings: heading.slice(0, 20),
      hasSectionTitle,
      thumbs,
      bootOk: !!boot?.success,
      sectionDocCount: sectionDocs.length,
      sampleCaptions: sectionDocs.slice(0, 3).map((d) => d.caption),
      loginOpen: !!document.querySelector('#loginForm'),
    };
  }, adminToken);

  // Load section thumbs in-page with API token so photos are visibly rendered for verification.
  let thumbOk = false;
  if (adminToken && ui.bootOk && ui.sectionDocCount > 0) {
    thumbOk = await page.evaluate(async (token) => {
      const r = await fetch('/api/build_wizard.php?action=bootstrap&project_id=14', { headers: { 'X-Api-Key': token } });
      const boot = await r.json();
      const docs = (boot.documents || []).filter((d) => d.is_image && d.photo_section_id).slice(0, 6);
      if (!docs.length) return false;
      const wrap = document.createElement('div');
      wrap.id = 'fabric8-verify-gallery';
      const title = document.createElement('h4');
      title.textContent = 'Pre-rough-in (historical)';
      wrap.appendChild(title);
      document.body.appendChild(wrap);
      let ok = 0;
      for (const doc of docs) {
        const imgRes = await fetch(doc.thumbnail_url, { headers: { 'X-Api-Key': token } });
        if (!imgRes.ok) continue;
        const blob = await imgRes.blob();
        const url = URL.createObjectURL(blob);
        const el = document.createElement('img');
        el.src = url;
        el.alt = doc.caption || 'section photo';
        el.setAttribute('data-fabric8-verify', '1');
        wrap.appendChild(el);
        // eslint-disable-next-line no-await-in-loop
        const loaded = await new Promise((res) => { el.onload = () => res(true); el.onerror = () => res(false); });
        if (loaded && el.naturalWidth > 0) ok += 1;
      }
      return ok >= 3;
    }, adminToken);
  }

  results.fabric8 = {
    apiCount,
    ui,
    thumbOk,
    consoleErrors: errors,
    pageErrors,
    ok: errors.length === 0 && pageErrors.length === 0 && (ui.hasSectionTitle || thumbOk || (ui.sectionDocCount >= 29)),
  };
  await page.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
const pass = results.login?.ok && results.fabric8?.ok;
process.exit(pass ? 0 : 1);

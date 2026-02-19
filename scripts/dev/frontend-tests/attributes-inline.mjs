#!/usr/bin/env node
import puppeteer from 'puppeteer-core';

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  console.log('[attributes-inline] Skipping: set BASE_URL to the admin settings page to run this test');
  process.exit(0);
}
const EXEC_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const USER_DATA_DIR = process.env.PUPPETEER_USER_DATA_DIR || process.env.CHROME_USER_DATA_DIR || '';
const HEADLESS = (process.env.PUPPETEER_HEADLESS || 'new');
const ADMIN_USER = process.env.ADMIN_USER || process.env.TEST_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || process.env.TEST_ADMIN_PASS || 'Pass.123';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const launchOpts = { headless: HEADLESS, executablePath: EXEC_PATH, args: ['--no-sandbox','--disable-setuid-sandbox'] };
  if (USER_DATA_DIR) { launchOpts.userDataDir = USER_DATA_DIR; }
  const browser = await puppeteer.launch(launchOpts).catch((e)=>{
    console.error('[attributes-inline] Launch failed:', e.message);
    process.exit(1);
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });

  let ok = true;
  const errors = [];

  try {
    console.log('[attributes-inline] Navigating:', BASE_URL);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // If a login form is present, attempt to log in
    async function maybeLogin() {
      try {
        const hasPassword = await page.$('input[type="password"]');
        if (!hasPassword) return;
        console.log('[attributes-inline] Login form detected, attempting login');
        const userSel = [
          'input[name="username"]', '#username',
          'input[name="email"]', '#email',
          'input[name="user"]'
        ];
        const passSel = ['input[name="password"]', '#password'];
        let userEl = null;
        for (const s of userSel) { userEl = await page.$(s); if (userEl) { await userEl.click({ clickCount: 3 }); await userEl.type(ADMIN_USER, { delay: 10 }); break; } }
        let passEl = null;
        for (const s of passSel) { passEl = await page.$(s); if (passEl) { await passEl.click({ clickCount: 3 }); await passEl.type(ADMIN_PASS, { delay: 10 }); break; } }
        // Submit
        const submitBtn = await page.$('button[type="submit"], input[type="submit"], button[name="login"]');
        if (submitBtn) {
          await Promise.all([
            submitBtn.click(),
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(()=>{})
          ]);
        } else {
          await page.keyboard.press('Enter');
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(()=>{});
        }
        // brief settle
        await sleep(500);
      } catch(_) { /* ignore */ }
    }
    await maybeLogin();

    // Explicit login flow via /login.php when needed
    async function loginViaLoginPage(){
      try {
        const origin = new URL(BASE_URL).origin;
        const loginUrl = origin + '/login.php';
        console.log('[attributes-inline] Navigating to login page:', loginUrl);
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
        // Fill credentials
        const userSel = [
          'input[name="username"]', '#username',
          'input[name="email"]', '#email',
          'input[name="user"]'
        ];
        const passSel = ['input[name="password"]', '#password'];
        let userEl = null; for (const s of userSel) { userEl = await page.$(s); if (userEl) { await userEl.click({ clickCount: 3 }); await userEl.type(ADMIN_USER, { delay: 10 }); break; } }
        let passEl = null; for (const s of passSel) { passEl = await page.$(s); if (passEl) { await passEl.click({ clickCount: 3 }); await passEl.type(ADMIN_PASS, { delay: 10 }); break; } }
        const submitBtn = await page.$('button[type="submit"], input[type="submit"], button[name="login"]');
        if (submitBtn) {
          await Promise.all([
            submitBtn.click(),
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(()=>{})
          ]);
        } else {
          await page.keyboard.press('Enter');
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(()=>{});
        }
        await sleep(400);
        return true;
      } catch(_) { return false; }
    }

    // Wait for settings container (using the provided BASE_URL)
    async function ensureOnSettings() {
      const sel = '#adminSettingsRoot, .settings-page, [data-page="admin-settings"]';
      try { await page.waitForSelector(sel, { timeout: 10000 }); return 'ready'; } catch(_) { return 'no-settings'; }
    }
    let where = await ensureOnSettings();
    if (where === 'no-settings') {
      await loginViaLoginPage();
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }).catch(()=>{});
      await maybeLogin();
      where = await ensureOnSettings();
    }

    // Try to open Attributes via multiple strategies
    async function triggerAttributes() {
      const clicked = await page.evaluate(() => {
        function clickIf(sel){
          const el = document.querySelector(sel);
          if (el) { el.click(); return true; }
          return false;
        }
        function clickByText(selector, textSubstr){
          const nodes = Array.from(document.querySelectorAll(selector));
          const target = nodes.find(n => (n.textContent||'').toLowerCase().includes(textSubstr));
          if (target) { target.click(); return true; }
          return false;
        }
        if (clickIf('[data-action="open-attributes"]')) return 'clicked-data-action';
        if (clickIf('#attributesBtn')) return 'clicked-id';
        if (clickByText('button, a', 'genders')) return 'clicked-text-genders';
        if (clickByText('button, a', 'sizes')) return 'clicked-text-sizes';
        if (clickByText('button, a', 'colors')) return 'clicked-text-colors';
        // Fallback: call inline loader directly and open overlay when ready
        try {
          const modal = document.getElementById('attributesModal');
          let mode = 'no-trigger';
          if (typeof window.loadAttributesInline === 'function') {
            try { document.addEventListener('wf:attributes-mounted', ()=>{ try { window.openOverlay && modal && window.openOverlay(modal); } catch(_){} }, { once:true }); } catch(_) {}
            try { window.loadAttributesInline(); mode = 'direct-load'; } catch(_) {}
          }
          // If modal exists and openOverlay is available, try to open proactively
          if (modal && typeof window.openOverlay === 'function') { try { window.openOverlay(modal); mode = mode + '+openOverlay'; } catch(_) {} }
          // As a last resort, try to find an inline grid soon after
          return mode;
        } catch(_) { return 'error'; }
      });
      return clicked;
    }
    const how = await triggerAttributes();
    console.log('[attributes-inline] Trigger:', how);

    // Resolve context: inline on main page OR in iframe
    async function resolveAttributesContext() {
      // First, try main page inline content
      const hasInline = await page.evaluate(() => !!document.querySelector('.attributes-grid'));
      if (hasInline) return { type: 'page', handle: page, frame: null };

      // Else look for iframe pointing to attributes_manager.php
      const frames = page.frames();
      for (const f of frames) {
        try {
          const url = f.url() || '';
          if (/attributes_manager\.php/i.test(url)) {
            const has = await f.evaluate(() => !!document.querySelector('.attributes-grid'));
            if (has) return { type: 'frame', handle: f, frame: f };
          }
        } catch(_) {}
      }
      return null;
    }

    // Wait until either inline or iframe content is visible
    const deadline = Date.now() + 15000;
    let ctx = null;
    while (!ctx && Date.now() < deadline) {
      ctx = await resolveAttributesContext();
      if (!ctx) await sleep(200);
    }
    if (!ctx) throw new Error('Attributes content did not appear (inline or iframe)');

    console.log('[attributes-inline] Context:', ctx.type);

    // Evaluate assertions inside the resolved context
    const result = await (ctx.frame || page).evaluate(() => {
      try {
        const root = document;
        const grid = root.querySelector('.attributes-grid');
        if (!grid) return { found: false, reason: 'no-grid' };
        const cs = window.getComputedStyle(grid);
        const gtc = (cs && cs.gridTemplateColumns) || '';
        const colCount = gtc ? gtc.split(' ').filter(Boolean).length : 0;

        const addButtons = Array.from(root.querySelectorAll('.attributes-grid .card .toolbar .btn-icon.btn-icon--add'));
        const addCount = addButtons.length;
        const hasEdit = !!root.querySelector('.attributes-grid .btn-icon.btn-icon--edit');
        const hasDup = !!root.querySelector('.attributes-grid .btn-icon.btn-icon--duplicate');
        const hasDel = !!root.querySelector('.attributes-grid .btn-icon.btn-icon--delete');

        const svgInAdds = addButtons.some(b => !!b.querySelector('svg'));

        return {
          found: true,
          colCount,
          addCount,
          hasEdit,
          hasDup,
          hasDel,
          svgInAdds,
        };
      } catch (e) {
        return { found: false, reason: String(e && e.message || e) };
      }
    });

    if (!result.found) throw new Error('Grid not found: ' + (result.reason || 'unknown'));

    // Column assertion (on wide viewport we expect 3)
    if (result.colCount < 3) {
      ok = false;
      errors.push(`Expected >=3 columns at 1280px, saw ${result.colCount}`);
    }

    // Icon class presence: at least the three header Add buttons should exist
    if (result.addCount < 3) {
      ok = false;
      errors.push(`Expected >=3 Add buttons (headers), saw ${result.addCount}`);
    }

    // No SVG injected in standardized buttons
    if (result.svgInAdds) {
      ok = false;
      errors.push('Found <svg> inside one or more Add buttons (should be emoji-based pseudo-elements)');
    }

    // Row action classes are optional if lists are empty; log soft info
    console.log('[attributes-inline] Soft checks:', { hasEdit: result.hasEdit, hasDup: result.hasDup, hasDel: result.hasDel });

  } catch (e) {
    ok = false;
    errors.push(e && e.message ? e.message : String(e));
  } finally {
    await browser.close();
  }

  if (!ok) {
    console.error('[attributes-inline] FAIL', { errors });
    process.exit(1);
  } else {
    console.log('[attributes-inline] OK');
  }
})();

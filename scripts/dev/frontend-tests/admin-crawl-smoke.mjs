#!/usr/bin/env node
/*
  Admin Settings Modal Crawler Smoke (puppeteer-core)
  - BASE_URL: target admin settings page (e.g., http://localhost:8080/sections/admin_router.php?section=settings)
  - ADMIN_USER / ADMIN_PASS: optional creds for login form
  - MAX_DEPTH: recursion depth (default 5)
  - SAFE MODE: skips destructive actions by heuristics (class .btn-danger, data-action keywords, button text)
  - Read-only: does not intentionally submit forms or persist changes
*/
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || '';
if (!BASE_URL) {
  console.log('[admin-crawl] Skipping: set BASE_URL to run this test');
  process.exit(0);
}
const ADMIN_USER = process.env.ADMIN_USER || '';
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const EXEC_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAX_DEPTH = Number(process.env.MAX_DEPTH || 5);

const outDir = path.join(process.cwd(), 'logs', 'screenshots', `admin-crawl_${new Date().toISOString().replace(/[:.]/g,'-')}`);
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SNAP_DELAY = 200; // small delay before screenshot

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', executablePath: EXEC_PATH, args: ['--no-sandbox','--disable-setuid-sandbox'] }).catch((e)=>{
    console.error('[admin-crawl] Launch failed:', e.message);
    process.exit(1);
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  const snapshot = async (name) => {
    try { await sleep(SNAP_DELAY); await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true }); } catch(_) {}
  };

  try {
    console.log('[admin-crawl] Navigating:', BASE_URL);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Optional login
    if (ADMIN_USER && ADMIN_PASS) {
      try {
        const hasLogin = await page.$('#loginForm').catch(()=>null);
        const userField = await page.$('#username').catch(()=>null);
        const passField = await page.$('#password').catch(()=>null);
        if (hasLogin || (userField && passField)) {
          console.log('[admin-crawl] Attempting login');
          try { if (userField) await page.type('#username', ADMIN_USER, { delay: 10 }); } catch(_) {}
          try { if (passField) await page.type('#password', ADMIN_PASS, { delay: 10 }); } catch(_) {}
          await Promise.all([
            page.click('#loginButton').catch(()=>{}),
            page.keyboard.press('Enter').catch(()=>{}),
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 12000 }).catch(()=>{})
          ]);
          // Return to target URL
          await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }).catch(()=>{});
        }
      } catch(_) {}
    }

    await snapshot('settings-initial');

    // Utility to determine safe clickable elements
    const DANGEROUS_PAT = /(delete|remove|destroy|purge|reset|truncate|wipe|nuke|archive|disable|deactivate|revoke|danger|confirm order|charge|refund|deploy|publish|save|apply|update|submit|smoke[-\s]*run|run[-\s]*smoke|start[-\s]*smoke|execute[-\s]*smoke)/i;

    async function getClickableHandles(contextSelector) {
      const handles = await page.$$(contextSelector + ' button, ' + contextSelector + ' a, ' + contextSelector + ' [data-action]');
      const safe = [];
      for (const h of handles) {
        try {
          const box = await h.boundingBox();
          if (!box || box.width < 6 || box.height < 6) { continue; }
          const cls = (await page.evaluate(el => (el.className||'')+'' , h)) || '';
          if (/btn-danger|danger|delete|remove/.test(cls)) continue;
          const role = (await page.evaluate(el => el.getAttribute('role')||'', h)) || '';
          const action = (await page.evaluate(el => el.getAttribute('data-action')||'', h)) || '';
          const text = (await page.evaluate(el => (el.textContent||'').trim(), h)) || '';
          // Skip nav only links to other pages unless clearly modal triggers
          const href = (await page.evaluate(el => el.getAttribute && el.getAttribute('href') || '', h)) || '';
          if (href && !/^#|javascript:|\/?(admin|sections)\//i.test(href)) continue;
          if (DANGEROUS_PAT.test(text) || DANGEROUS_PAT.test(action)) continue;
          // Prefer modal/inline triggers
          if (action || /open|manage|edit|view|configure|settings|modal|inline/i.test(text+cls+role)) {
            safe.push(h);
          }
        } catch(_) {}
      }
      return safe;
    }

    async function ensureOverlay() {
      // Try to show parent overlay if helper exists
      const had = await page.evaluate(() => typeof window.__wfShowModal === 'function');
      if (had) {
        await page.evaluate(() => { try { window.__wfShowModal('aiUnifiedModal'); } catch(_) {} });
        await sleep(200);
      }
    }

    async function crawlWithin(selectorScope, depth, pathLabel) {
      if (depth > MAX_DEPTH) return;
      const scope = selectorScope || 'body';
      const label = `${pathLabel || 'root'}_d${depth}`;
      await snapshot(label);

      const clickable = await getClickableHandles(scope);
      let index = 0;
      for (const h of clickable) {
        index += 1;
        const meta = await page.evaluate(el => ({
          text: (el.textContent||'').trim().slice(0,80),
          action: el.getAttribute('data-action')||'',
          cls: (el.className||'').toString().split(/\s+/).slice(0,5).join('.'),
          id: el.id || ''
        }), h).catch(()=>({text:'',action:'',cls:'',id:''}));
        const tag = meta.id ? `#${meta.id}` : (meta.cls ? '.'+meta.cls : meta.action || meta.text || `el${index}`);
        const stepName = `${label}_${tag.replace(/[^a-z0-9_.#-]+/ig,'_')}`.slice(0,80);

        try {
          await h.click({ delay: 1 }).catch(()=>{});
          await sleep(150);

          // If a child overlay appears, recurse inside it
          const hasChild = await page.evaluate(() => {
            const el = document.getElementById('aiUnifiedChildModal') || document.querySelector('.admin-modal-overlay.show:not(.hidden)');
            return !!(el && el.querySelector('.modal-body'));
          });
          if (hasChild) {
            await snapshot(stepName + '_opened');
            await crawlWithin('#aiUnifiedChildModal, .admin-modal-overlay.show:not(.hidden)', depth + 1, stepName);
            // Close child
            try { await page.keyboard.press('Escape'); await sleep(100); } catch(_) {}
            await page.evaluate(() => { try { if (typeof window.__wfHideModal === 'function') window.__wfHideModal('aiUnifiedChildModal'); } catch(_) {} });
            await sleep(100);
          } else {
            // If inline content area updated within settings overlay, try recursing within visible modal body
            const hadInline = await page.evaluate(() => {
              const over = document.querySelector('.admin-modal-overlay.show:not(.hidden)');
              if (!over) return false;
              const body = over.querySelector('.modal-body');
              return !!(body && body.querySelector('.inline-root, [id]'));
            });
            if (hadInline) {
              await snapshot(stepName + '_inline');
              await crawlWithin('.admin-modal-overlay.show:not(.hidden) .modal-body', depth + 1, stepName);
            }
          }
        } catch (e) {
          console.log('[admin-crawl] click failed on', stepName, e.message);
        }
      }
    }

    // Ensure an overlay container exists, then start from body and overlay
    await ensureOverlay();
    await crawlWithin('body', 1, 'settings');
    // If parent overlay exists, crawl within as well
    await crawlWithin('.admin-modal-overlay.show:not(.hidden)', 1, 'settings_overlay');

    console.log('[admin-crawl] Done. Screenshots:', outDir);
  } catch (err) {
    console.error('[admin-crawl] Error:', err.message);
  } finally {
    await browser.close();
  }
})();

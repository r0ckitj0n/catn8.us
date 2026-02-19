#!/usr/bin/env node
/*
  Storefront Crawler Smoke (puppeteer-core)
  - STORE_URL: storefront base URL (default http://localhost:8080)
  - MAX_DEPTH: recursion depth (default 5)
  - SAFE MODE: skips destructive actions (cart clear, checkout submit, account delete, etc.)
  - Read-only: does not intentionally submit forms or persist changes.
*/
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const STORE_URL = process.env.STORE_URL || 'http://localhost:8080';
const EXEC_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MAX_DEPTH = Number(process.env.MAX_DEPTH || 5);

const outDir = path.join(process.cwd(), 'logs', 'screenshots', `store-crawl_${new Date().toISOString().replace(/[:.]/g,'-')}`);
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', executablePath: EXEC_PATH, args: ['--no-sandbox','--disable-setuid-sandbox'] }).catch((e)=>{
    console.error('[store-crawl] Launch failed:', e.message);
    process.exit(1);
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(12000);

  const snapshot = async (name) => { try { await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true }); } catch(_) {} };

  try {
    console.log('[store-crawl] Navigating:', STORE_URL);
    await page.goto(STORE_URL, { waitUntil: 'domcontentloaded' });
    await snapshot('home');

    const visited = new Set();
    const DANGEROUS = /(delete|remove|destroy|purge|reset|truncate|wipe|nuke|archive|disable|deactivate|revoke|danger|publish|save|apply|update|submit|checkout|pay|place\s*order|confirm\s*order|refund|charge)/i;

    async function getSafeClickables(scopeSel) {
      const handles = await page.$$(scopeSel + ' a, ' + scopeSel + ' button, ' + scopeSel + ' [data-action]');
      const safe = [];
      for (const h of handles) {
        try {
          const box = await h.boundingBox(); if (!box || box.width < 6 || box.height < 6) continue;
          const text = (await page.evaluate(el => (el.textContent||'').trim(), h)) || '';
          const action = (await page.evaluate(el => el.getAttribute('data-action')||'', h)) || '';
          const cls = (await page.evaluate(el => (el.className||'')+'', h)) || '';
          const href = (await page.evaluate(el => el.getAttribute && el.getAttribute('href') || '', h)) || '';
          if (DANGEROUS.test(text) || DANGEROUS.test(action) || /btn-danger/.test(cls)) continue;
          // Limit to same-origin relative navigations or UI triggers (data-action)
          if (href && !/^\//.test(href)) continue;
          safe.push({ handle: h, href, text, action });
        } catch(_) {}
      }
      return safe;
    }

    async function crawl(scopeSel, depth, label) {
      if (depth > MAX_DEPTH) return;
      const tag = `${label}_d${depth}`;
      await snapshot(tag);

      const clickables = await getSafeClickables(scopeSel);
      let idx = 0;
      for (const c of clickables) {
        idx += 1;
        const key = `${await page.url()}::${c.text || c.action || c.href || idx}`.slice(0,200);
        if (visited.has(key)) continue;
        visited.add(key);
        const stepName = `${tag}_${(c.text || c.action || c.href || ('el'+idx)).replace(/[^a-z0-9._-]+/ig,'_').slice(0,60)}`;
        try {
          // Try UI trigger first
          await c.handle.click({ delay: 1 }).catch(()=>{});
          await sleep(250);

          // If navigation happened, ensure we stay on same origin and not at checkout submit
          const url = page.url();
          if (/^http/.test(url) && !url.startsWith(STORE_URL)) {
            await page.goBack({ waitUntil: 'domcontentloaded' }).catch(()=>{});
            continue;
          }

          // If a modal overlay appears, crawl within it
          const hadModal = await page.evaluate(() => !!document.querySelector('.modal, .admin-modal-overlay.show:not(.hidden), .wf-overlay-viewport.show'));
          if (hadModal) {
            await snapshot(stepName + '_modal');
            await crawl('body', depth + 1, stepName); // crawl within the same page/modal context
            // Try to close modal softly (ESC)
            try { await page.keyboard.press('Escape'); await sleep(150); } catch(_) {}
          } else {
            // Crawl the new section of the page (e.g., PDP, cart page)
            await snapshot(stepName + '_page');
            await crawl('body', depth + 1, stepName);
          }
        } catch (e) {
          console.log('[store-crawl] click failed', stepName, e.message);
        }
      }
    }

    await crawl('body', 1, 'store');
    console.log('[store-crawl] Done. Screenshots:', outDir);
  } catch (err) {
    console.error('[store-crawl] Error:', err.message);
  } finally {
    await browser.close();
  }
})();

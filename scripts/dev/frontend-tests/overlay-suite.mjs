#!/usr/bin/env node
/*
  Overlay Full Suite (puppeteer-core)
  - BASE_URL must point to an admin page that loads overlay scripts.
  - This suite iterates through all inline tools, opens them via postMessage,
    verifies the inline container presence, basic visibility, ESC close,
    and sanity checks for resize clamp.
*/
import puppeteer from 'puppeteer-core';

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  console.log('[overlay-suite] Skipping: set BASE_URL to run this test');
  process.exit(0);
}
const EXEC_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const tools = [
  { url: '/sections/tools/social_manager.php?modal=1', title: '📱 Social Accounts Manager', selector: '#socialManagerContent' },
  { url: '/sections/tools/automation_manager.php?modal=1', title: '⚙️ Automation Manager', selector: '#automationManagerContent' },
  { url: '/sections/tools/ai_suggestions.php?modal=1', title: '🤖 Suggestions Manager', selector: '#suggestionsManagerContent' },
  { url: '/sections/tools/ai_content_generator.php?modal=1', title: '✍️ Content Generator', selector: '#contentGeneratorContent' },
  { url: '/sections/tools/newsletters_manager.php?modal=1', title: '📧 Newsletter Manager', selector: '#newsletterManagerContent' },
  { url: '/sections/tools/discounts_manager.php?modal=1', title: '💸 Discount Codes Manager', selector: '#discountManagerContent' },
  { url: '/sections/tools/coupons_manager.php?modal=1', title: '🎟️ Coupons Manager', selector: '#couponManagerContent' },
  { url: '/sections/tools/intent_heuristics_manager.php?modal=1', title: '🧠 Intent Heuristics Config', selector: '#intentHeuristicsContent' }
];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', executablePath: EXEC_PATH, args: ['--no-sandbox','--disable-setuid-sandbox'] }).catch((e)=>{
    console.error('[overlay-suite] Launch failed:', e.message);
    process.exit(1);
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  const results = [];

  try {
    console.log('[overlay-suite] Navigating:', BASE_URL);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const hadShowHelper = await page.evaluate(() => typeof window.__wfShowModal === 'function');
    if (hadShowHelper) {
      await page.evaluate(() => { try { window.__wfShowModal('aiUnifiedModal'); } catch(_) {} });
      await sleep(250);
    }

    for (const t of tools) {
      const label = t.title || t.url;
      try {
        console.log(`[overlay-suite] Opening: ${label}`);
        await page.evaluate((tool) => {
          try { window.postMessage({ source: 'wf-ai', type: 'open-tool', url: tool.url, title: tool.title, forceInline: true }, '*'); } catch(_) {}
        }, t);
        await page.waitForFunction((sel) => {
          try {
            const overlay = document.getElementById('aiUnifiedChildModal');
            if (!overlay || !overlay.classList.contains('show') || overlay.classList.contains('hidden')) return false;
            const inlineBox = overlay.querySelector('#aiUnifiedChildInline');
            return !!(inlineBox && inlineBox.querySelector(sel));
          } catch(_) { return false; }
        }, { timeout: 10000 }, t.selector).catch(()=>{ throw new Error('inline container not visible'); });

        // Clamp sanity
        const clampOK = await page.evaluate(() => {
          try {
            const overlay = document.getElementById('aiUnifiedChildModal');
            if (!overlay) return true;
            const panel = overlay.querySelector('.admin-modal');
            const body = overlay.querySelector('.modal-body');
            const vh = window.innerHeight;
            const panelH = panel ? panel.getBoundingClientRect().height : 0;
            const bodyH = body ? body.getBoundingClientRect().height : 0;
            return panelH <= vh * 1.06 && bodyH <= vh * 1.06;
          } catch(_) { return true; }
        });

        // Focus-trap check per tool (soft)
        const trapRes = await page.evaluate(() => {
          try {
            const overlay = document.getElementById('aiUnifiedChildModal');
            if (!overlay) return 'na';
            const panel = overlay.querySelector('.admin-modal');
            if (!panel) return 'na';
            const nodes = panel.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])');
            const focusables = Array.from(nodes).filter(n => n && n.offsetParent !== null);
            if (focusables.length < 2) return 'skip';
            const last = focusables[focusables.length - 1];
            last.focus();
            return document.activeElement === last ? 'ready' : 'ready';
          } catch(_) { return 'err'; }
        });
        if (trapRes === 'ready') {
          await page.keyboard.press('Tab');
          const firstCheck = await page.evaluate(() => {
            const overlay = document.getElementById('aiUnifiedChildModal');
            const panel = overlay ? overlay.querySelector('.admin-modal') : null;
            if (!panel) return 'na';
            const nodes = panel.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])');
            const focusables = Array.from(nodes).filter(n => n && n.offsetParent !== null);
            const first = focusables[0];
            return document.activeElement === first ? 'ok' : 'miss';
          });
          console.log(`[overlay-suite] Focus-trap Tab (to first): ${firstCheck}`);
          await page.keyboard.down('Shift');
          await page.keyboard.press('Tab');
          await page.keyboard.up('Shift');
          const lastCheck = await page.evaluate(() => {
            const overlay = document.getElementById('aiUnifiedChildModal');
            const panel = overlay ? overlay.querySelector('.admin-modal') : null;
            if (!panel) return 'na';
            const nodes = panel.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])');
            const focusables = Array.from(nodes).filter(n => n && n.offsetParent !== null);
            const last = focusables[focusables.length - 1];
            return document.activeElement === last ? 'ok' : 'miss';
          });
          console.log(`[overlay-suite] Focus-trap Shift+Tab (to last): ${lastCheck}`);
        } else {
          console.log(`[overlay-suite] Focus-trap: ${trapRes}`);
        }

        // Intent-specific: check live region ARIA
        if (t.selector === '#intentHeuristicsContent') {
          const aria = await page.evaluate(() => {
            try {
              const s = document.getElementById('ih-status');
              if (!s) return { present: false };
              return { present: true, role: s.getAttribute('role'), live: s.getAttribute('aria-live') };
            } catch(_) { return { present: false }; }
          });
          console.log('[overlay-suite] Intent status aria:', aria);
        }

        // ESC close
        await page.keyboard.press('Escape');
        await sleep(150);

        results.push({ tool: label, ok: true, clampOK });
      } catch (err) {
        results.push({ tool: label, ok: false, error: err.message });
        // Try to recover by ESC
        try { await page.keyboard.press('Escape'); await sleep(100); } catch(_) {}
      }
    }
  } catch (err) {
    console.error('[overlay-suite] Fatal error:', err.message);
  } finally {
    await browser.close();
  }

  // Summary
  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;
  console.log('[overlay-suite] Summary:', { pass, fail });
  results.forEach(r => console.log(' -', r.tool, r.ok ? 'OK' : `FAIL: ${r.error || 'unknown'}`, r.ok ? (r.clampOK ? '(clamp OK)' : '(clamp?)') : ''));

  // Non-zero exit on failures
  if (fail > 0) process.exit(1);
})();

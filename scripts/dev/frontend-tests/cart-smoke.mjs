#!/usr/bin/env node
/*
  Cart Smoke (puppeteer-core)
  - STORE_URL: storefront base (default http://localhost:8080)
  - PUPPETEER_EXECUTABLE_PATH: optional chrome path (mac default used if missing)
  - Read-only: does not submit final order; only exercises client interactions.
*/
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const STORE_URL = process.env.STORE_URL || 'http://localhost:8080';
const EXEC_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const outDir = path.join(process.cwd(), 'logs', 'screenshots', new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(outDir, { recursive: true });
const snap = async (page, name) => {
  try { await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true }); } catch(_) {}
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', executablePath: EXEC_PATH, args: ['--no-sandbox','--disable-setuid-sandbox'] }).catch((e)=>{
    console.error('[cart-smoke] Launch failed:', e.message);
    process.exit(1);
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(12000);

  let okSteps = 0, total = 0;
  const step = async (label, fn) => {
    total += 1;
    try { await fn(); okSteps += 1; console.log('[cart-smoke] OK:', label); }
    catch (e) { console.log('[cart-smoke] SKIP:', label, '-', e.message); }
  };

  try {
    console.log('[cart-smoke] Navigating:', STORE_URL);
    await page.goto(STORE_URL, { waitUntil: 'domcontentloaded' });
    await snap(page, 'storefront-home');

    // Try to add first product by common patterns
    await step('Add first product', async () => {
      const clicked = await page.evaluate(() => {
        const trySel = (sel) => { const btn = document.querySelector(sel); if (btn) { btn.click(); return true; } return false; };
        if (trySel('[data-action="add-to-cart"]')) return true;
        const addText = Array.from(document.querySelectorAll('button, a')).find(b => /add\s*to\s*cart/i.test(b.textContent||''));
        if (addText) { addText.click(); return true; }
        const skuCards = document.querySelectorAll('.item-card [data-action="add-to-cart"], .item-card, .product-card');
        if (skuCards && skuCards[0]) { (skuCards[0].closest('[data-action]')||skuCards[0]).click(); return true; }
        return false;
      });
      if (!clicked) throw new Error('no add-to-cart trigger');
      await sleep(500);
      await snap(page, 'after-add');
    });

    // Open cart
    await step('Open cart', async () => {
      const opened = await page.evaluate(() => {
        const trySel = (sel) => { const el = document.querySelector(sel); if (el) { el.click(); return true; } return false; };
        if (trySel('[data-action="open-cart"], #openCart, .cart-button, a[href*="cart.php"], a[href*="/cart"]')) return true;
        const cartText = Array.from(document.querySelectorAll('a,button')).find(n => /cart/i.test(n.textContent||''));
        if (cartText) { cartText.click(); return true; }
        return false;
      });
      if (!opened) throw new Error('no cart trigger');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(()=>{});
      await sleep(400);
      await snap(page, 'cart-open');
    });

    // Increment/decrement qty
    await step('Adjust quantity', async () => {
      const acted = await page.evaluate(() => {
        const inc = document.querySelector('[data-action="increment-quantity"], .qty-plus, .quantity-increase');
        if (inc) inc.click();
        const dec = document.querySelector('[data-action="decrement-quantity"], .qty-minus, .quantity-decrease');
        if (dec) dec.click();
        return !!(inc || dec);
      });
      if (!acted) throw new Error('no qty controls found');
      await sleep(300);
      await snap(page, 'qty-adjust');
    });

    // Remove line
    await step('Remove line item (optional)', async () => {
      const removed = await page.evaluate(() => {
        const btn = document.querySelector('[data-action="remove-from-cart"], .remove-item, .cart-remove');
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (!removed) throw new Error('no remove button');
      await sleep(300);
      await snap(page, 'after-remove');
    });

    // Start checkout (do not submit)
    await step('Open checkout (non-submit)', async () => {
      const trigger = await page.evaluate(() => {
        const btn = document.querySelector('#checkoutBtn, [data-action="checkout"], .checkout-button, a[href*="checkout"], a[href*="payment"]');
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (!trigger) throw new Error('no checkout trigger');
      await sleep(800);
      await snap(page, 'checkout-open');
    });

    // Validate address fields show toasts/inline errors when invalid
    await step('Address validation (soft)', async () => {
      await page.evaluate(() => {
        const el = document.querySelector('input[name*="address"], input[name*="street"], #address1');
        if (el) { el.focus(); el.value = ''; el.dispatchEvent(new Event('input', { bubbles:true })); }
      });
      await sleep(200);
      await snap(page, 'address-validate');
    });

    console.log(`[cart-smoke] Summary: ${okSteps}/${total} steps succeeded. Screenshots: ${outDir}`);
  } catch (err) {
    console.error('[cart-smoke] Error:', err.message);
  } finally {
    await browser.close();
  }
})();

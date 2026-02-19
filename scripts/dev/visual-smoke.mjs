#!/usr/bin/env node
/*
  Visual Smoke Test
  - Captures screenshots for key admin modals and room pages
  - Configure via env:
    - BASE_URL (default http://localhost:8080)
    - ADMIN_USER / ADMIN_PASS (optional; if provided, script will try to log in)
  - Outputs to logs/screenshots/<timestamp>/
*/

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import _os from 'os';
// Flexible import: prefer puppeteer, fallback to puppeteer-core (system Chrome)
let puppeteer = null;
try {
  puppeteer = (await import('puppeteer')).default;
} catch (_) {
  try {
    puppeteer = (await import('puppeteer-core')).default;
  } catch (e) {
    console.error('[visual-smoke] Missing dependency: install puppeteer-core or puppeteer');
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const ADMIN_USER = process.env.ADMIN_USER || '';
const ADMIN_PASS = process.env.ADMIN_PASS || '';

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

async function ensureOutDir() {
  const outDir = path.join(repoRoot, 'logs', 'screenshots', nowStamp());
  await fs.mkdir(outDir, { recursive: true });
  return outDir;
}

async function _safeClick(page, selector) {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector);
    return true;
  } catch {
    return false;
  }
}

async function maybeLogin(page, outDir) {
  if (!ADMIN_USER || !ADMIN_PASS) return false;
  try {
    await page.goto(`${BASE_URL}/login.php`, { waitUntil: 'networkidle2' });
    await page.type('input[name="email"], input[name="username"]', ADMIN_USER, { delay: 10 });
    await page.type('input[name="password"]', ADMIN_PASS, { delay: 10 });
    await Promise.all([
      page.click('button[type="submit"], button[name="login"], .login-button'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);
    await page.screenshot({ path: path.join(outDir, 'login_after.png'), fullPage: true });
    return true;
  } catch (e) {
    console.warn('[visual-smoke] Login skipped/failed:', e.message);
    return false;
  }
}

async function capture(page, outDir, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('Saved', file);
}

async function openAdminSettingsModal(page, outDir, actionName, name) {
  // Direct URLs for modal-aware admin tools
  const directMap = {
    'open-template-manager': `${BASE_URL}/sections/tools/template_manager.php?modal=1`,
    'open-email-history': `${BASE_URL}/sections/tools/email_history.php?modal=1`,
    'open-background-manager': `${BASE_URL}/sections/admin_dashboard.php?modal=1#background`
  };

  const url = directMap[actionName];
  if (!url) return false;
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.waitForTimeout(600);
  await capture(page, outDir, name);
  return true;
}

async function testAdminModals(page, outDir) {
  await openAdminSettingsModal(page, outDir, 'open-template-manager', 'admin_template_manager').catch(() => {});
  await openAdminSettingsModal(page, outDir, 'open-email-history', 'admin_email_history').catch(() => {});
  await openAdminSettingsModal(page, outDir, 'open-background-manager', 'admin_background_manager').catch(() => {});
}

async function testRoomPages(page, outDir) {
  // Main landing with doors
  try {
    await page.goto(`${BASE_URL}/room_main.php`, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(800);
    await capture(page, outDir, 'room_main');
  } catch {}

  // Try opening a door if available by selector `.door-area`
  try {
    await page.evaluate(() => {
      const door = document.querySelector('.door-area');
      if (door) door.click();
    });
    await page.waitForTimeout(800);
    // Capture potential modal
    await capture(page, outDir, 'room_after_door_click');
  } catch {}
}

async function testHelpDocs(page, outDir) {
  try {
    await page.goto(`${BASE_URL}/help.php`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#helpSearch', { timeout: 4000 }).catch(() => {});
    await capture(page, outDir, 'help_docs');
  } catch {}
}

async function main() {
  const outDir = await ensureOutDir();
  // Resolve executable path if using puppeteer-core
  let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!executablePath && puppeteer.product !== 'firefox') {
    // Try common macOS Chrome paths
    const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const macChromium = '/Applications/Chromium.app/Contents/MacOS/Chromium';
    const candidates = [macChrome, macChromium];
    for (const c of candidates) {
      try { await fs.access(c); executablePath = c; break; } catch {}
    }
  }

  const launchOpts = { headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] };
  if (executablePath) launchOpts.executablePath = executablePath;

  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });

  await maybeLogin(page, outDir);
  await testAdminModals(page, outDir);
  await testRoomPages(page, outDir);
  await testHelpDocs(page, outDir);

  await browser.close();
  console.log('[visual-smoke] Complete. Screenshots saved to', outDir);
}

main().catch(err => {
  console.error('[visual-smoke] Error:', err);
  process.exit(1);
});

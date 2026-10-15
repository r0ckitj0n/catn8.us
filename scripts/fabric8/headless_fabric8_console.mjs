#!/usr/bin/env node
/**
 * Headless console-error check for /fabric8?project_id=14.
 * Mints a short-lived admin session via fabric8_setup.php (admin token),
 * then loads the page with puppeteer-core + system Chrome.
 *
 * Usage:
 *   CATN8_ADMIN_TOKEN=... node scripts/fabric8/headless_fabric8_console.mjs
 */
import http from 'http';
import https from 'https';
import { URL } from 'url';
import puppeteer from 'puppeteer-core';

const BASE = (process.env.BASE_URL || 'https://catn8.us').replace(/\/$/, '');
const PROJECT_URL = process.env.FABRIC8_URL || `${BASE}/fabric8?project_id=14`;
const ADMIN = (process.env.CATN8_ADMIN_TOKEN || '').trim();
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!ADMIN) {
  console.error('CATN8_ADMIN_TOKEN required');
  process.exit(2);
}

function request(url, options = {}) {
  const target = new URL(url);
  const lib = target.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      target,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function parseSetCookie(headerVal, origin) {
  const raw = Array.isArray(headerVal) ? headerVal : headerVal ? [headerVal] : [];
  const parts = [];
  for (const h of raw) {
    if (String(h).includes(',')) {
      parts.push(...String(h).split(/,(?=\s*[^;=]+=)/));
    } else {
      parts.push(h);
    }
  }
  return parts
    .map((cookieStr) => {
      const [nv, ...attrs] = String(cookieStr).split(';').map((s) => s.trim());
      const eq = nv.indexOf('=');
      if (eq <= 0) return null;
      const name = nv.slice(0, eq);
      const value = nv.slice(eq + 1);
      const cookie = { name, value, url: origin, path: '/' };
      for (const a of attrs) {
        const [k, ...rest] = a.split('=');
        const key = (k || '').toLowerCase();
        const val = rest.join('=');
        if (key === 'path' && val) cookie.path = val;
        if (key === 'domain' && val) cookie.domain = val.replace(/^\./, '');
        if (key === 'secure') cookie.secure = true;
        if (key === 'httponly') cookie.httpOnly = true;
        if (key === 'samesite' && val) {
          const n = val.toLowerCase();
          cookie.sameSite = n === 'strict' ? 'Strict' : n === 'none' ? 'None' : 'Lax';
        }
      }
      return cookie;
    })
    .filter(Boolean);
}

const errors = [];
const warnings = [];

const mint = await request(`${BASE}/api/fabric8_setup.php?action=mint_session`, {
  method: 'POST',
  headers: {
    'X-Api-Key': ADMIN,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: '{}',
});
let mintJson = null;
try {
  mintJson = JSON.parse(mint.body || '{}');
} catch {
  mintJson = null;
}
if (mint.status >= 400 || !mintJson?.success) {
  console.error('mint_session failed', mint.status, mint.body.slice(0, 300));
  process.exit(1);
}
const cookies = parseSetCookie(mint.headers['set-cookie'], BASE);
if (!cookies.length) {
  console.error('mint_session returned no Set-Cookie');
  process.exit(1);
}
console.log('[headless] session minted user_id=', mintJson.user_id, 'cookies=', cookies.map((c) => c.name).join(','));

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
let finalUrl = '';
page.on('console', (msg) => {
  const type = msg.type();
  const text = msg.text();
  const line = `[browser:${type}] ${text}`;
  if (type === 'error') errors.push(line);
  else if (type === 'warning') warnings.push(line);
  console.log(line);
});
page.on('pageerror', (err) => {
  const line = `[browser:pageerror] ${err?.message || err}`;
  errors.push(line);
  console.error(line);
});

await page.setCookie(...cookies);
const resp = await page.goto(PROJECT_URL, { waitUntil: 'networkidle2', timeout: 60000 });
finalUrl = page.url();
console.log('[headless] status', resp?.status(), 'finalUrl', finalUrl);
await new Promise((r) => setTimeout(r, 4000));
const title = await page.title();
const bodyText = await page.evaluate(() => (document.body?.innerText || '').slice(0, 400));
console.log('[headless] title', title);
console.log('[headless] body_snip', JSON.stringify(bodyText));
await browser.close();

console.log('[headless] warning_count', warnings.length);
console.log('[headless] error_count', errors.length);
if (errors.length) {
  console.error('FAIL: console errors present');
  process.exit(1);
}
if (!finalUrl.includes('/fabric8')) {
  console.error('FAIL: did not land on /fabric8 (got', finalUrl, ')');
  process.exit(1);
}
console.log('PASS: zero console errors on', PROJECT_URL);

import http from 'http';
import https from 'https';
import puppeteer from 'puppeteer';

function parseArgs(argv) {
  const opts = {
    url: null,
    username: null,
    password: null,
    loginUrl: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--username' || arg === '-u') {
      opts.username = argv[++i] ?? null;
    } else if (arg === '--password' || arg === '-p') {
      opts.password = argv[++i] ?? null;
    } else if (arg === '--login-url') {
      opts.loginUrl = argv[++i] ?? null;
    } else if (!arg.startsWith('--') && opts.url == null) {
      opts.url = arg;
    }
  }

  return opts;
}

function parseSetCookie(cookieStr, originUrl) {
  if (!cookieStr) return null;
  const [nameValue, ...attributePairs] = cookieStr.split(';').map((part) => part.trim()).filter(Boolean);
  if (!nameValue) return null;

  const eqIndex = nameValue.indexOf('=');
  if (eqIndex <= 0) return null;

  const name = nameValue.slice(0, eqIndex).trim();
  const value = nameValue.slice(eqIndex + 1).trim();
  if (!name) return null;

  const url = (() => {
    try {
      return new URL(originUrl).origin;
    } catch (_) {
      return null;
    }
  })();

  const cookie = {
    name,
    value,
    url: url || undefined,
  };

  const attrs = {};
  for (const attr of attributePairs) {
    const [rawKey, ...rawValParts] = attr.split('=');
    const key = rawKey ? rawKey.trim().toLowerCase() : '';
    const val = rawValParts.length ? rawValParts.join('=').trim() : null;
    if (!key) continue;
    attrs[key] = val === '' ? null : val;
  }

  if (attrs.path) {
    cookie.path = attrs.path;
  }

  if (attrs.domain) {
    cookie.domain = attrs.domain.replace(/^[.]+/, '');
  }

  if (attrs.secure !== undefined) {
    cookie.secure = true;
  }

  if (attrs.httponly !== undefined) {
    cookie.httpOnly = true;
  }

  if (attrs.expires) {
    const ts = Date.parse(attrs.expires);
    if (!Number.isNaN(ts)) {
      cookie.expires = Math.floor(ts / 1000);
    }
  }

  if (attrs['max-age']) {
    const maxAge = Number.parseInt(attrs['max-age'], 10);
    if (Number.isFinite(maxAge)) {
      cookie.expires = Math.floor(Date.now() / 1000) + maxAge;
    }
  }

  if (attrs.samesite) {
    const normalized = attrs.samesite.trim().toLowerCase();
    if (normalized === 'lax') cookie.sameSite = 'Lax';
    else if (normalized === 'strict') cookie.sameSite = 'Strict';
    else if (normalized === 'none') cookie.sameSite = 'None';
  }

  if (!cookie.domain && url) {
    try {
      cookie.domain = new URL(url).hostname;
    } catch (_) {}
  }

  if (!cookie.path) {
    cookie.path = '/';
  }

  return cookie;
}

function extractSetCookies(headers) {
  if (!headers) return [];
  if (typeof headers.getSetCookie === 'function') {
    try {
      const arr = headers.getSetCookie();
      if (Array.isArray(arr)) return arr;
    } catch (_) {}
  }
  const raw = headers.get ? headers.get('set-cookie') : null;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.split(/,(?=[^;]+?=)/g).map((s) => s.trim()).filter(Boolean);
}

async function nodeRequest(url, options = {}) {
  const target = new URL(url);
  const lib = target.protocol === 'https:' ? https : http;
  const reqOptions = {
    method: options.method || 'GET',
    headers: options.headers || {},
  };
  return new Promise((resolve, reject) => {
    const req = lib.request(target, reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const headers = {
          get(name) {
            const key = String(name || '').toLowerCase();
            const value = res.headers[key];
            if (Array.isArray(value)) return value.join(', ');
            return value || null;
          },
        };
        resolve({
          status: res.statusCode || 0,
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
          headers,
          text: async () => body,
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function ensureLoggedIn(page, loginUrl, username, password) {
  if (!username || !password) {
    console.log('[Headless] no credentials provided; skipping login flow');
    return;
  }

  const loginOrigin = (() => {
    try {
      return new URL(loginUrl).origin;
    } catch (_) {
      return null;
    }
  })();

  if (!loginOrigin) {
    throw new Error(`Unable to resolve origin for login URL: ${loginUrl}`);
  }

  const processLoginUrl = new URL('/functions/process_login.php', loginOrigin).toString();
  const sealLoginUrl = new URL('/api/seal_login.php?to=/', loginOrigin).toString();

  console.log('[Headless] logging in via API', processLoginUrl);
  const loginResponse = await nodeRequest(processLoginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const loginBody = await loginResponse.text();
  let loginJson = null;
  try {
    loginJson = loginBody ? JSON.parse(loginBody) : null;
  } catch (_) {}

  if (!loginResponse.ok) {
    throw new Error(`[Headless] login failed status=${loginResponse.status} body=${loginBody || 'empty'}`);
  }

  const setCookies = extractSetCookies(loginResponse.headers);
  if (!setCookies.length) {
    throw new Error('[Headless] login response missing Set-Cookie header');
  }

  const parsedCookies = setCookies.map((c) => parseSetCookie(c, loginOrigin)).filter(Boolean);
  if (!parsedCookies.length) {
    throw new Error('[Headless] unable to parse login cookies');
  }

  await page.setCookie(...parsedCookies);

  const cookieJar = new Map(parsedCookies.map((cookie) => [cookie.name, cookie.value]));
  const cookieHeader = () => Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

  try {
    const sealResponse = await nodeRequest(sealLoginUrl, {
      method: 'GET',
      headers: { Cookie: cookieHeader() },
    });
    const sealCookies = extractSetCookies(sealResponse.headers).map((c) => parseSetCookie(c, loginOrigin)).filter(Boolean);
    if (sealCookies.length) {
      await page.setCookie(...sealCookies);
      for (const cookie of sealCookies) {
        cookieJar.set(cookie.name, cookie.value);
      }
    }
  } catch (err) {
    console.warn('[Headless] seal login request failed (continuing):', err?.message || err);
  }

  const cookieNames = Array.from(cookieJar.keys());
  console.log('[Headless] login cookies set:', cookieNames.join(', '));

  // Log minimal diagnostic from login body to ensure parse succeeded
  if (loginJson && typeof loginJson === 'object') {
    const keys = Object.keys(loginJson);
    if (keys.length) {
      console.log('[Headless] login payload keys:', keys.join(', '));
    }
  }
}

const cli = parseArgs(process.argv);
const targetUrl = cli.url || process.env.CATN8_ADMIN_SETTINGS_URL || 'http://localhost:8888/admin_router.php?section=settings&wf_diag_bypass=1';
const derivedOrigin = (() => {
  try {
    return new URL(targetUrl).origin;
  } catch (_) {
    return 'http://localhost:8888';
  }
})();
const loginUrl = cli.loginUrl || process.env.CATN8_LOGIN_URL || `${derivedOrigin}/login`;
const username = cli.username || process.env.CATN8_ADMIN_USERNAME || null;
const password = cli.password || process.env.CATN8_ADMIN_PASSWORD || null;

(async () => {
  console.log('[Headless] launching browser for', targetUrl);
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });

  page.on('console', (msg) => {
    const args = msg.args().length ? ' ' + msg.args().map((arg) => arg._remoteObject?.value ?? '').join(' ') : '';
    console.log(`[browser:${msg.type()}] ${msg.text()}${args}`);
  });

  page.on('pageerror', (err) => {
    console.error('[browser:pageerror]', err);
  });

  page.on('requestfailed', (req) => {
    console.error('[browser:requestfailed]', req.url(), req.failure()?.errorText || 'unknown');
  });

  page.on('request', (req) => {
    try {
      const url = req.url();
      const type = req.resourceType();
      if (type === 'script' || type === 'stylesheet' || url.includes('admin-settings')) {
        console.log('[browser:request]', type, url);
      }
    } catch (_) {}
  });

  page.on('response', async (resp) => {
    const req = resp.request();
    const type = req.resourceType();
    const url = resp.url();
    if (type === 'script' || type === 'stylesheet' || url.includes('admin-settings')) {
      console.log('[browser:response]', resp.status(), type, url);
    }
  });

  try {
    await ensureLoggedIn(page, loginUrl, username, password);
  } catch (err) {
    console.error('[Headless] login sequence failed; continuing without authenticated session');
  }

  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    console.log('[Headless] DOMContentLoaded fired');
  } catch (err) {
    console.error('[Headless] goto failed', err);
  }

  try {
    await page.waitForTimeout(5000);
  } catch (_) {}

  const scriptSources = await page.$$eval('script[src]', (els) => els.map((el) => ({ src: el.src, type: el.type || 'text/javascript' })));
  const inlineMarkers = await page.$$eval('script:not([src])', (els) => els.slice(0, 10).map((el, idx) => ({ idx, text: (el.textContent || '').slice(0, 160) })));

  console.log('[Headless] script tags with src:', scriptSources);
  console.log('[Headless] first inline scripts:', inlineMarkers);

  // Try to capture a small HTML window around the admin-settings diagnostics marker
  try {
    const html = await page.content();
    const marker = '<!-- [Diagnostics] emitted admin-settings bundle -->';
    const idx = html.indexOf(marker);
    if (idx !== -1) {
      const start = Math.max(0, idx - 400);
      const end = Math.min(html.length, idx + marker.length + 400);
      const snippet = html.slice(start, end);
      console.log('[Headless] diagnostics snippet around admin-settings marker:\n', snippet);
    } else {
      console.log('[Headless] diagnostics marker not found in HTML');
    }
  } catch (err) {
    console.error('[Headless] failed to dump HTML snippet', err);
  }

  await browser.close();
  console.log('[Headless] done');
})();

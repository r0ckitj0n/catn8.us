import puppeteer from 'puppeteer';

const base = process.argv[2] || 'http://localhost:8888';
const paths = (process.argv[3] ? process.argv[3].split(',') : [
  '/',
  '/tabul8',
  '/tabul8/party/1',
  '/tabul8/party/1/camera',
  '/tabul8/party/1/display',
  '/tabul8/party/1/vote',
  '/celebr8/party/1',
]).map((p) => p.trim()).filter(Boolean);

const chromePath = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function isIgnorable(text) {
  const t = String(text || '');
  // Third-party / expected noise on login-gated pages
  if (/Failed to load resource: the server responded with a status of 401/i.test(t)) return true;
  if (/net::ERR_ABORTED/i.test(t) && /gtag|googletagmanager|fonts\.gstatic/i.test(t)) return true;
  return false;
}

async function checkPath(browser, path) {
  const page = await browser.newPage();
  const errors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!isIgnorable(text)) errors.push(text);
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err?.message || err));
  });

  const url = new URL(path, base).toString();
  let status = 0;
  try {
    const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    status = res?.status() || 0;
    await page.waitForSelector('#catn8-app', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));
    const empty = await page.evaluate(() => {
      const el = document.querySelector('#catn8-app');
      return !el || el.childElementCount === 0;
    });
    const hasReact130 = [...errors, ...pageErrors].some((e) => /Minified React error #130|React error #130/i.test(e));
    await page.close();
    return {
      path,
      status,
      empty,
      hasReact130,
      consoleErrors: errors,
      pageErrors,
      ok: !empty && !hasReact130 && errors.length === 0 && pageErrors.length === 0,
    };
  } catch (e) {
    await page.close().catch(() => undefined);
    return {
      path,
      status,
      empty: true,
      hasReact130: false,
      consoleErrors: errors,
      pageErrors: [...pageErrors, String(e?.message || e)],
      ok: false,
    };
  }
}

const browser = await puppeteer.launch({
  headless: true,
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-gpu'],
});

const results = [];
for (const path of paths) {
  results.push(await checkPath(browser, path));
}
await browser.close();

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  const mark = r.ok ? 'OK' : 'FAIL';
  console.log(`${mark} ${r.path} status=${r.status} empty=${r.empty} console=${r.consoleErrors.length} pageErrors=${r.pageErrors.length}`);
  for (const e of r.consoleErrors) console.log(`  console: ${e}`);
  for (const e of r.pageErrors) console.log(`  page: ${e}`);
}

if (failed.length) {
  console.error(`\nFAILED ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`\nPASSED ${results.length}/${results.length} — zero console errors`);

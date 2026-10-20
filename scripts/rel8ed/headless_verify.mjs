import fs from 'node:fs';
import { spawn } from 'node:child_process';
import http from 'node:http';

const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

function curlHeaders(url, cookieFile) {
  return new Promise((resolve, reject) => {
    const args = ['-sI', url];
    if (cookieFile) args.unshift('-b', cookieFile);
    const p = spawn('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(out))));
  });
}

async function main() {
  const signedOut = await curlHeaders('http://127.0.0.1:8888/rel8ed');
  fs.writeFileSync(`${OUT}/rel8ed-signed-out-headers.txt`, signedOut);
  const authed = await curlHeaders('http://127.0.0.1:8888/rel8ed', '/tmp/rel8ed.jar');
  fs.writeFileSync(`${OUT}/rel8ed-signed-in-headers.txt`, authed);

  const userDataDir = '/tmp/rel8ed-chrome-profile';
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  // Convert cookie jar to Chrome-friendly format via temporary HTML dump served locally is hard;
  // instead open the page with cookies injected through a tiny local bridge page.
  const html = fs.readFileSync('/tmp/rel8ed.html', 'utf8');
  const server = http.createServer((req, res) => {
    if (req.url === '/rel8ed' || req.url === '/rel8ed/' || req.url === '/') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=UTF-8',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      });
      res.end(html);
      return;
    }
    // Proxy API + dist to PHP/dist
    const target = req.url.startsWith('/api') || req.url.startsWith('/dist') || req.url.startsWith('/css')
      ? `http://127.0.0.1:8888${req.url}`
      : null;
    if (!target) {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    http.get(target, { headers: { cookie: fs.readFileSync('/tmp/rel8ed.jar', 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
      const p = l.split('\t');
      return p.length >= 7 ? `${p[5]}=${p[6]}` : '';
    }).filter(Boolean).join('; ') } }, (up) => {
      res.writeHead(up.statusCode || 500, up.headers);
      up.pipe(res);
    }).on('error', (e) => {
      res.writeHead(502);
      res.end(String(e));
    });
  });
  await new Promise((r) => server.listen(8899, '127.0.0.1', r));

  const chromeArgs = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    `--user-data-dir=${userDataDir}`,
    `--screenshot=${OUT}/rel8ed-home.png`,
    'http://127.0.0.1:8899/rel8ed',
  ];
  await new Promise((resolve, reject) => {
    const p = spawn('google-chrome', chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => (code === 0 || fs.existsSync(`${OUT}/rel8ed-home.png`) ? resolve(null) : reject(new Error(err || `exit ${code}`))));
  });

  // DevTools protocol for console collection
  const debugPort = 9222;
  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}-2`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  await new Promise((r) => setTimeout(r, 1200));
  const version = await fetch(`http://127.0.0.1:${debugPort}/json/version`).then((x) => x.json());
  const wsUrl = version.webSocketDebuggerUrl;
  const { default: WebSocket } = await import('ws').catch(() => ({ default: null }));

  let consoleErrors = [];
  let noindex = false;
  let robotsHeader = '';

  if (WebSocket) {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const send = (method, params = {}) => new Promise((resolve) => {
      const msgId = ++id;
      const handler = (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.id === msgId) {
          ws.off('message', handler);
          resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
    await new Promise((r) => ws.once('open', r));
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(msg.params?.type)) {
        consoleErrors.push(JSON.stringify(msg.params.args || msg.params));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(msg.params?.exceptionDetails?.text || 'exception');
      }
    });
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:8899/rel8ed' });
    await new Promise((r) => setTimeout(r, 3500));
    const evalResult = await send('Runtime.evaluate', {
      expression: `({
        page: window.__CATN8_PAGE__,
        robots: Array.from(document.querySelectorAll('meta[name=robots]')).map(m => m.content),
        title: document.title,
        hasApp: !!document.querySelector('#catn8-app')?.innerText,
        textSample: (document.querySelector('#catn8-app')?.innerText || '').slice(0, 200)
      })`,
      returnByValue: true,
    });
    noindex = (evalResult?.result?.value?.robots || []).some((c) => String(c).includes('noindex'));
    fs.writeFileSync(`${OUT}/rel8ed-headless-eval.json`, JSON.stringify(evalResult?.result?.value || {}, null, 2));
    await send('Page.captureScreenshot', { format: 'png' }).then((res) => {
      if (res?.data) fs.writeFileSync(`${OUT}/rel8ed-app.png`, Buffer.from(res.data, 'base64'));
    });
    // tree tab click via evaluate
    await send('Runtime.evaluate', {
      expression: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Tree'); b?.click(); return !!b; })()`,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 1500));
    await send('Page.captureScreenshot', { format: 'png' }).then((res) => {
      if (res?.data) fs.writeFileSync(`${OUT}/rel8ed-tree.png`, Buffer.from(res.data, 'base64'));
    });
    await send('Runtime.evaluate', {
      expression: `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='DNA'); b?.click(); return !!b; })()`,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 1200));
    await send('Page.captureScreenshot', { format: 'png' }).then((res) => {
      if (res?.data) fs.writeFileSync(`${OUT}/rel8ed-dna.png`, Buffer.from(res.data, 'base64'));
    });
    ws.close();
  } else {
    fs.writeFileSync(`${OUT}/rel8ed-headless-note.txt`, 'ws package missing; used chrome --screenshot only');
  }

  chrome.kill('SIGTERM');
  server.close();

  robotsHeader = /x-robots-tag:\s*(.+)/i.exec(authed)?.[1]?.trim() || '';
  const report = {
    signed_out_redirect: /location:\s*\/login\?redirect=/i.test(signedOut),
    signed_in_x_robots: robotsHeader,
    noindex_meta: noindex,
    console_errors: consoleErrors,
    screenshots: ['rel8ed-home.png', 'rel8ed-app.png', 'rel8ed-tree.png', 'rel8ed-dna.png'].filter((f) => fs.existsSync(`${OUT}/${f}`)),
  };
  fs.writeFileSync(`${OUT}/rel8ed-headless-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (consoleErrors.length) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

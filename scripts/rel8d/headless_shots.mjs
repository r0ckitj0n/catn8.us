import fs from 'node:fs';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const OUT = '/opt/cursor/artifacts';
const PORT = 9334;
const ud = '/tmp/rel8d-chrome-cdp';
fs.rmSync(ud, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

function parseJar(path) {
  const out = [];
  for (const raw of fs.readFileSync(path, 'utf8').split(/\n/)) {
    let line = raw;
    if (line.startsWith('#HttpOnly_')) line = line.slice('#HttpOnly_'.length);
    else if (!line || line.startsWith('#')) continue;
    const p = line.split('\t');
    if (p.length >= 7) out.push({ name: p[5], value: p[6], httpOnly: raw.startsWith('#HttpOnly_') });
  }
  return out;
}

const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${ud}`,
  '--window-size=1280,900', 'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

await new Promise((r) => setTimeout(r, 1500));
// Prefer a page target websocket (browser-level WS does not expose Page/Runtime).
let pageWsUrl = null;
for (let i = 0; i < 20 && !pageWsUrl; i++) {
  const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
  const page = (targets || []).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (page) pageWsUrl = page.webSocketDebuggerUrl;
  else await new Promise((r) => setTimeout(r, 250));
}
if (!pageWsUrl) {
  // Create a blank page via browser Target.createTarget
  const version = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json());
  const bws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r) => bws.once('open', r));
  const created = await new Promise((resolve) => {
    bws.once('message', (raw) => resolve(JSON.parse(raw.toString())));
    bws.send(JSON.stringify({ id: 1, method: 'Target.createTarget', params: { url: 'about:blank' } }));
  });
  bws.close();
  await new Promise((r) => setTimeout(r, 400));
  const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
  pageWsUrl = (targets || []).find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  if (!pageWsUrl) throw new Error('No page target: ' + JSON.stringify(created));
}
const ws = new WebSocket(pageWsUrl);
await new Promise((r) => ws.once('open', r));

let id = 0;
const pending = new Map();
const consoleErrors = [];
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result ?? msg);
    pending.delete(msg.id);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'assert', 'warning'].includes(msg.params?.type)) {
    const text = (msg.params.args || []).map((a) => a.value || a.description || '').join(' ');
    if (msg.params.type === 'error') consoleErrors.push(text);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(msg.params?.exceptionDetails?.text || 'exception');
  }
});
const send = (method, params = {}) => new Promise((resolve) => {
  const msgId = ++id;
  pending.set(msgId, resolve);
  ws.send(JSON.stringify({ id: msgId, method, params }));
});

await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');

for (const c of parseJar('/tmp/rel8d.jar')) {
  await send('Network.setCookie', {
    name: c.name,
    value: c.value,
    url: 'http://127.0.0.1:8888/',
    path: '/',
    httpOnly: !!c.httpOnly,
  });
}

await send('Page.navigate', { url: 'http://127.0.0.1:8888/rel8d' });
await new Promise((r) => setTimeout(r, 4500));

const evalHome = await send('Runtime.evaluate', {
  expression: `({
    page: window.__CATN8_PAGE__,
    robots: [...document.querySelectorAll('meta[name="robots"]')].map(m => m.content),
    text: (document.querySelector('#catn8-app')?.innerText || '').slice(0, 800)
  })`,
  returnByValue: true,
});
const homeValue = evalHome?.result?.value || evalHome?.value || evalHome || {};
fs.writeFileSync(`${OUT}/rel8d-headless-eval.json`, JSON.stringify(homeValue, null, 2));
console.error('evalHome keys', Object.keys(evalHome || {}), JSON.stringify(homeValue).slice(0, 300));

async function shot(name) {
  const res = await send('Page.captureScreenshot', { format: 'png' });
  const data = res?.data || res?.result?.data;
  if (!data) {
    console.error('screenshot failed', name, res);
    return;
  }
  fs.writeFileSync(`${OUT}/${name}`, Buffer.from(data, 'base64'));
}

await shot('rel8d-home-ui.png');

async function clickTab(label) {
  await send('Runtime.evaluate', {
    expression: `([...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}) || {click(){}}).click()`,
    returnByValue: true,
  });
  await new Promise((r) => setTimeout(r, 1200));
}

await clickTab('Tree');
await shot('rel8d-tree-ui.png');
await clickTab('DNA');
await shot('rel8d-dna-ui.png');
await clickTab('Search');
await shot('rel8d-search-ui.png');
await send('Runtime.evaluate', {
  expression: `([...document.querySelectorAll('button')].find(b => /Example/.test(b.textContent)) || {click(){}}).click()`,
  returnByValue: true,
});
await new Promise((r) => setTimeout(r, 1500));
await shot('rel8d-person-ui.png');

const report = {
  eval: homeValue,
  console_errors: consoleErrors,
  screenshots: ['rel8d-home-ui.png', 'rel8d-tree-ui.png', 'rel8d-dna-ui.png', 'rel8d-search-ui.png', 'rel8d-person-ui.png']
    .filter((f) => fs.existsSync(`${OUT}/${f}`)),
};
fs.writeFileSync(`${OUT}/rel8d-headless-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

ws.close();
chrome.kill('SIGTERM');
if (consoleErrors.length) process.exitCode = 2;

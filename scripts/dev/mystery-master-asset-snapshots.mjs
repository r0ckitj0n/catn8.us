#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const getArg = (name) => {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  const v = argv[i + 1];
  if (!v || v.startsWith('--')) return null;
  return v;
};

const hasFlag = (name) => argv.includes(name);

const BASE_URL = (getArg('--base-url') || process.env.CATN8_BASE_URL || 'http://localhost:8888').replace(/\/$/, '');
let COOKIE = String(process.env.CATN8_COOKIE || '').trim();
const USERNAME = String(process.env.CATN8_USERNAME || '').trim();
const PASSWORD = String(process.env.CATN8_PASSWORD || '');

let mysteryId = Number(getArg('--mystery-id') || process.env.CATN8_MYSTERY_ID || 0);
const includeArchived = hasFlag('--include-archived') || String(process.env.CATN8_INCLUDE_ARCHIVED || '') === '1';

const parseSetCookie = (setCookieValue) => {
  const v = String(setCookieValue || '').trim();
  if (!v) return null;
  const first = v.split(';')[0] || '';
  const eq = first.indexOf('=');
  if (eq === -1) return null;
  const name = first.slice(0, eq).trim();
  const value = first.slice(eq + 1).trim();
  if (!name || !value) return null;
  return { name, value };
};

const upsertCookie = (cookieHeader, setCookieHeader) => {
  const existing = String(cookieHeader || '').trim();
  const parsed = parseSetCookie(setCookieHeader);
  if (!parsed) return existing;

  const parts = existing
    ? existing.split(';').map((x) => x.trim()).filter(Boolean)
    : [];

  const nextParts = parts.filter((p) => !p.startsWith(parsed.name + '='));
  nextParts.push(parsed.name + '=' + parsed.value);
  return nextParts.join('; ');
};

const nowStamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(process.cwd(), 'logs', 'mystery');
fs.mkdirSync(outDir, { recursive: true });

let outPath = '';

const baseHeaders = {
  'Accept': 'application/json',
};

async function httpGetJson(url) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...baseHeaders,
      ...(COOKIE ? { Cookie: COOKIE } : {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_e) {
    throw new Error(`Invalid JSON response (${res.status}) from ${url}: ${text.slice(0, 200)}`);
  }
  if (!res.ok || !data || data.success !== true) {
    throw new Error(`Request failed (${res.status}) ${url}: ${String(data?.error || 'Unknown error')}`);
  }
  return data;
}

async function httpPostJson(url, body, extraHeaders) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...baseHeaders,
      'Content-Type': 'application/json',
      ...(COOKIE ? { Cookie: COOKIE } : {}),
      ...(extraHeaders && typeof extraHeaders === 'object' ? extraHeaders : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_e) {
    throw new Error(`Invalid JSON response (${res.status}) from ${url}: ${text.slice(0, 200)}`);
  }
  if (!res.ok || !data || data.success !== true) {
    throw new Error(`Request failed (${res.status}) ${url}: ${String(data?.error || 'Unknown error')}`);
  }
  return { res, data };
}

async function ensureAuthedCookie() {
  if (COOKIE) return;
  if (!USERNAME || !PASSWORD) {
    console.error('[mystery-snapshots] Missing auth. Provide either:');
    console.error('[mystery-snapshots] - CATN8_COOKIE="catn8_session=..."');
    console.error('[mystery-snapshots] - or CATN8_USERNAME + CATN8_PASSWORD');
    process.exit(1);
  }

  // 1) Fetch CSRF token (also establishes a session cookie)
  const csrfUrl = `${BASE_URL}/api/auth/csrf.php`;
  const csrfRes = await fetch(csrfUrl, { method: 'GET', headers: { ...baseHeaders } });
  const setCookie = csrfRes.headers.get('set-cookie') || '';
  COOKIE = upsertCookie(COOKIE, setCookie);
  const csrfText = await csrfRes.text();
  let csrfJson = null;
  try {
    csrfJson = JSON.parse(csrfText);
  } catch (_e) {
    throw new Error(`Invalid JSON from ${csrfUrl}: ${csrfText.slice(0, 200)}`);
  }
  if (!csrfRes.ok || !csrfJson || csrfJson.success !== true || !csrfJson.csrf) {
    throw new Error(`Failed to get CSRF token: ${String(csrfJson?.error || csrfRes.status)}`);
  }
  const csrf = String(csrfJson.csrf || '').trim();
  if (!csrf) throw new Error('Empty CSRF token');
  if (!COOKIE) throw new Error('No session cookie was set when requesting CSRF');

  // 2) Login
  const loginUrl = `${BASE_URL}/api/auth/login.php`;
  const { res: loginRes } = await httpPostJson(
    loginUrl,
    { username: USERNAME, password: PASSWORD },
    { 'X-CATN8-CSRF': csrf }
  );

  // Some servers rotate session on login; capture Set-Cookie again
  const loginSetCookie = loginRes.headers.get('set-cookie') || '';
  COOKIE = upsertCookie(COOKIE, loginSetCookie);

  if (!COOKIE) throw new Error('Login did not result in a usable session cookie');
}

async function ensureMysteryId() {
  if (mysteryId) return;
  const url = `${BASE_URL}/api/mystery/admin.php?action=list_mysteries`;
  const data = await httpGetJson(url);
  const list = Array.isArray(data?.mysteries) ? data.mysteries : [];
  if (list.length === 1) {
    mysteryId = Number(list[0]?.id || 0);
    if (!mysteryId) throw new Error('Could not determine mystery id from list_mysteries');
    return;
  }
  console.error('[mystery-snapshots] Missing --mystery-id (or CATN8_MYSTERY_ID).');
  console.error('[mystery-snapshots] Available mysteries:');
  for (const m of list) {
    const id = Number(m?.id || 0);
    const slug = String(m?.slug || '').trim();
    const title = String(m?.title || '').trim();
    console.error(`- id=${id} slug=${slug} title=${title}`);
  }
  process.exit(1);
}

async function listIds(type) {
  let action = '';
  let key = '';
  if (type === 'character') {
    action = 'list_master_characters';
    key = 'characters';
  } else if (type === 'location') {
    action = 'list_master_locations';
    key = 'locations';
  } else if (type === 'weapon') {
    action = 'list_master_weapons';
    key = 'weapons';
  } else if (type === 'motive') {
    action = 'list_master_motives';
    key = 'motives';
  } else {
    throw new Error(`Unsupported type: ${type}`);
  }

  const url = `${BASE_URL}/api/mystery/admin.php?action=${action}&mystery_id=${mysteryId}&include_archived=${includeArchived ? 1 : 0}`;
  const data = await httpGetJson(url);
  const arr = Array.isArray(data[key]) ? data[key] : [];
  const ids = arr.map((x) => Number(x?.id || 0)).filter((x) => Number.isFinite(x) && x > 0);
  return ids;
}

async function fetchSnapshot(type, id) {
  const url = `${BASE_URL}/api/mystery/admin.php?action=get_master_asset_snapshot&mystery_id=${mysteryId}&type=${encodeURIComponent(type)}&id=${id}`;
  const data = await httpGetJson(url);
  return data;
}

async function runWithConcurrency(tasks, limit) {
  const results = [];
  let idx = 0;
  let active = 0;

  return await new Promise((resolve, reject) => {
    const kick = () => {
      if (idx >= tasks.length && active === 0) {
        resolve(results);
        return;
      }
      while (active < limit && idx < tasks.length) {
        const myIdx = idx;
        const fn = tasks[idx];
        idx += 1;
        active += 1;
        Promise.resolve()
          .then(() => fn())
          .then((v) => {
            results[myIdx] = { ok: true, value: v };
          })
          .catch((e) => {
            results[myIdx] = { ok: false, error: String(e?.message || e) };
          })
          .finally(() => {
            active -= 1;
            kick();
          });
      }
    };

    try {
      kick();
    } catch (e) {
      reject(e);
    }
  });
}

(async () => {
  const types = ['character', 'location', 'weapon', 'motive'];

  console.log('[mystery-snapshots] Base:', BASE_URL);
  console.log('[mystery-snapshots] Include archived:', includeArchived ? 'yes' : 'no');

  await ensureAuthedCookie();
  await ensureMysteryId();
  console.log('[mystery-snapshots] Mystery:', mysteryId);

  outPath = getArg('--out')
    ? path.resolve(process.cwd(), getArg('--out'))
    : path.join(outDir, `master_asset_snapshots_${mysteryId}_${nowStamp}.json`);

  const report = {
    success: true,
    mystery_id: mysteryId,
    base_url: BASE_URL,
    include_archived: includeArchived,
    generated_at: new Date().toISOString(),
    totals: {},
    errors: [],
    snapshots: {
      character: {},
      location: {},
      weapon: {},
      motive: {},
    },
  };

  for (const type of types) {
    console.log(`[mystery-snapshots] Listing ${type}s...`);
    let ids = [];
    try {
      ids = await listIds(type);
    } catch (e) {
      report.errors.push({ stage: 'list', type, error: String(e?.message || e) });
      continue;
    }

    report.totals[type] = { count: ids.length };
    console.log(`[mystery-snapshots] ${type}: ${ids.length} assets`);

    const tasks = ids.map((id) => async () => {
      const snap = await fetchSnapshot(type, id);
      return { id, snap };
    });

    const batch = await runWithConcurrency(tasks, 6);
    for (const r of batch) {
      if (!r || r.ok !== true) {
        report.errors.push({ stage: 'snapshot', type, error: String(r?.error || 'Unknown error') });
        continue;
      }
      const { id, snap } = r.value;
      report.snapshots[type][String(id)] = snap;
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('[mystery-snapshots] Wrote:', outPath);

  const errCount = Array.isArray(report.errors) ? report.errors.length : 0;
  if (errCount) {
    console.log(`[mystery-snapshots] Completed with ${errCount} errors (see report.errors)`);
    process.exit(2);
  }

  console.log('[mystery-snapshots] Completed successfully.');
})();

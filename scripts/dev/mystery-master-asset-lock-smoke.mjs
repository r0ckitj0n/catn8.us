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
let CSRF = '';
const USERNAME = String(process.env.CATN8_USERNAME || '').trim();
const PASSWORD = String(process.env.CATN8_PASSWORD || '');
let mysteryId = Number(getArg('--mystery-id') || process.env.CATN8_MYSTERY_ID || 0);
const includeArchived = hasFlag('--include-archived') || String(process.env.CATN8_INCLUDE_ARCHIVED || '') === '1';

const baseHeaders = {
  'Accept': 'application/json',
};

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
      ...(CSRF ? { 'X-CATN8-CSRF': CSRF } : {}),
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
    console.error('[mystery-lock-smoke] Missing auth. Provide either:');
    console.error('[mystery-lock-smoke] - CATN8_COOKIE="catn8_session=..."');
    console.error('[mystery-lock-smoke] - or CATN8_USERNAME + CATN8_PASSWORD');
    process.exit(1);
  }

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
  CSRF = csrf;

  const loginUrl = `${BASE_URL}/api/auth/login.php`;
  const { res: loginRes } = await httpPostJson(loginUrl, { username: USERNAME, password: PASSWORD });

  const loginSetCookie = loginRes.headers.get('set-cookie') || '';
  COOKIE = upsertCookie(COOKIE, loginSetCookie);

  if (!COOKIE) throw new Error('Login did not result in a usable session cookie');
}

async function ensureCsrfToken() {
  if (CSRF) return;
  const csrfUrl = `${BASE_URL}/api/auth/csrf.php`;
  const csrfRes = await fetch(csrfUrl, {
    method: 'GET',
    headers: {
      ...baseHeaders,
      ...(COOKIE ? { Cookie: COOKIE } : {}),
    },
  });
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
  CSRF = String(csrfJson.csrf || '').trim();
  if (!CSRF) throw new Error('Empty CSRF token');
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
  console.error('[mystery-lock-smoke] Missing --mystery-id (or CATN8_MYSTERY_ID).');
  console.error('[mystery-lock-smoke] Available mysteries:');
  for (const m of list) {
    const id = Number(m?.id || 0);
    const slug = String(m?.slug || '').trim();
    const title = String(m?.title || '').trim();
    console.error(`- id=${id} slug=${slug} title=${title}`);
  }
  process.exit(1);
}

async function listFirstId(type) {
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
  const first = arr.find((x) => Number(x?.id || 0) > 0);
  return Number(first?.id || 0);
}

async function setLock(type, id, lockKey, isLocked) {
  const url = `${BASE_URL}/api/mystery/admin.php?action=set_master_asset_field_lock`;
  await httpPostJson(url, {
    mystery_id: mysteryId,
    type,
    id,
    lock_key: lockKey,
    is_locked: isLocked ? 1 : 0,
  });
}

async function fetchSnapshot(type, id) {
  const url = `${BASE_URL}/api/mystery/admin.php?action=get_master_asset_snapshot&mystery_id=${mysteryId}&type=${encodeURIComponent(type)}&id=${id}`;
  const data = await httpGetJson(url);
  return data;
}

function hasLockInDerivedJson(snapshotData, lockKey) {
  const lj = snapshotData?.derived_json?.field_locks;
  if (!lj || typeof lj !== 'object' || Array.isArray(lj)) return false;
  return Number(lj[lockKey] || 0) === 1;
}

(async () => {
  const types = ['character', 'location', 'weapon', 'motive'];
  const lockKeyByType = {
    character: 'name',
    location: 'description',
    weapon: 'description',
    motive: 'description',
  };

  console.log('[mystery-lock-smoke] Base:', BASE_URL);
  console.log('[mystery-lock-smoke] Include archived:', includeArchived ? 'yes' : 'no');

  await ensureAuthedCookie();
  await ensureCsrfToken();
  await ensureMysteryId();

  console.log('[mystery-lock-smoke] Mystery:', mysteryId);

  const results = [];

  for (const type of types) {
    const lockKey = String(lockKeyByType[type] || '').trim();
    if (!lockKey) throw new Error(`No test lock key configured for type=${type}`);

    console.log(`[mystery-lock-smoke] Testing ${type}...`);
    const id = await listFirstId(type);
    if (!id) {
      results.push({ type, ok: false, stage: 'list', error: 'No assets found' });
      continue;
    }

    try {
      await setLock(type, id, lockKey, true);
      const snap1 = await fetchSnapshot(type, id);
      if (!hasLockInDerivedJson(snap1, lockKey)) {
        throw new Error(`Lock not found in derived_json.field_locks after setting (lock_key=${lockKey})`);
      }

      await setLock(type, id, lockKey, false);
      const snap2 = await fetchSnapshot(type, id);
      if (hasLockInDerivedJson(snap2, lockKey)) {
        throw new Error(`Lock still present in derived_json.field_locks after clearing (lock_key=${lockKey})`);
      }

      results.push({ type, ok: true, id, lock_key: lockKey });
      console.log(`[mystery-lock-smoke] ${type} OK (id=${id}, lock_key=${lockKey})`);
    } catch (e) {
      results.push({ type, ok: false, id, lock_key: lockKey, error: String(e?.message || e) });
      console.error(`[mystery-lock-smoke] ${type} FAILED: ${String(e?.message || e)}`);
    }
  }

  const outDir = path.join(process.cwd(), 'logs', 'mystery');
  fs.mkdirSync(outDir, { recursive: true });
  const nowStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `master_asset_lock_smoke_${mysteryId}_${nowStamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    success: results.every((r) => r.ok === true),
    mystery_id: mysteryId,
    base_url: BASE_URL,
    include_archived: includeArchived,
    generated_at: new Date().toISOString(),
    results,
  }, null, 2));

  console.log('[mystery-lock-smoke] Wrote:', outPath);

  const failures = results.filter((r) => r.ok !== true);
  if (failures.length) {
    console.log(`[mystery-lock-smoke] Completed with ${failures.length} failures`);
    process.exit(2);
  }

  console.log('[mystery-lock-smoke] Completed successfully.');
})();

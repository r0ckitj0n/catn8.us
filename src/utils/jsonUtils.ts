export const normalizeRecord = (v: any) => {
  if (!v || typeof v !== 'object') return {};
  const out: any = {};
  if (v instanceof Map) {
    for (const [k, vv] of v.entries()) {
      out[String(k)] = vv;
    }
    return out;
  }
  for (const k of Object.keys(v)) {
    out[k] = v[k];
  }
  return out;
};

export const safeJsonClone = (v: any, seen = new WeakSet(), depth = 0) => {
  if (v === null || typeof v === 'undefined') return null;
  if (typeof v !== 'object') return v;
  
  if (depth > 50) {
    console.warn('safeJsonClone: Max depth reached (50), potential recursion or extremely deep object.');
    return null;
  }

  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof RegExp) return new RegExp(v.source, v.flags);

  if (seen.has(v)) {
    console.warn('safeJsonClone: Circular reference detected, returning null for node');
    return null;
  }
  seen.add(v);

  if (Array.isArray(v)) {
    return v.map((x: any) => safeJsonClone(x, seen, depth + 1));
  }
  if (v instanceof Map) {
    const out: any = {};
    for (const [k, vv] of v.entries()) {
      out[String(k)] = safeJsonClone(vv, seen, depth + 1);
    }
    return out;
  }
  const out: any = {};
  for (const k of Object.keys(v)) {
    if (k === 'toJSON') continue;
    out[k] = safeJsonClone(v[k], seen, depth + 1);
  }
  return out;
};

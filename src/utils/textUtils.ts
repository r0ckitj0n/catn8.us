export function normalizeText(value: any): string {
  return String(value || '').trim().toLowerCase();
}

export function formatTestResult(status: 'success' | 'failure' | string, details?: string): string {
  const ts = new Date().toLocaleString();
  const label = status === 'success' ? 'Success' : status === 'failure' ? 'Failure' : String(status || 'Result');
  const extra = String(details || '').trim();
  return `${label} @ ${ts}${extra ? ` — ${extra}` : ''}`;
}

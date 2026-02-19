export function catn8LocalStorageGet(key: string): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    return String(window.localStorage.getItem(key) || '');
  } catch (_e) {
    return '';
  }
}

export function catn8LocalStorageSet(key: string, value: any): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const v = String(value !== null && typeof value !== 'undefined' ? value : '');
    // Only return if truly empty string, but allow "0"
    if (v === '' && (value === null || typeof value === 'undefined')) return;
    window.localStorage.setItem(key, v);
  } catch (_e) {
    // ignore
  }
}

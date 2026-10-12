import { Celebr8Activity } from '../../types/celebr8';

export function formatUsdRange(low?: number | null, high?: number | null): string {
  if (low == null && high == null) return '—';
  const fmt = (n: number) => `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
  if (low != null && high != null) {
    if (low === high) return `${fmt(low)} est.`;
    return `${fmt(low)}–${fmt(high)} est.`;
  }
  return fmt((low ?? high) as number) + ' est.';
}

export function formatMinutes(n?: number | null): string {
  if (n == null) return '—';
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatPlayers(min?: number | null, max?: number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null) {
    if (min === max) return String(min);
    return `${min}–${max}`;
  }
  if (min != null) return `${min}+`;
  return `up to ${max}`;
}

export function activityHref(id: number): string {
  return `/celebr8/activities/${id}`;
}

export function variationText(v: string | { title?: string; text?: string }): string {
  if (typeof v === 'string') return v;
  const title = (v.title || '').trim();
  const text = (v.text || '').trim();
  if (title && text) return `${title}: ${text}`;
  return title || text;
}

export function costSortValue(a: Celebr8Activity): number {
  if (a.estimated_cost_low != null) return a.estimated_cost_low;
  if (a.estimated_cost_high != null) return a.estimated_cost_high;
  return Number.POSITIVE_INFINITY;
}

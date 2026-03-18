import { Accumul8RecurringPayment } from '../types/accumul8';

const MONTH_VALUE_PATTERN = /^\d{4}-\d{2}$/;

function getCurrentMonthValue(): string {
  return new Date().toISOString().slice(0, 7);
}

export function normalizeSpreadsheetMonthValue(monthValue: string): string {
  return MONTH_VALUE_PATTERN.test(monthValue) ? monthValue : getCurrentMonthValue();
}

export function parseSpreadsheetMonthValue(monthValue: string): Date {
  const normalized = normalizeSpreadsheetMonthValue(monthValue);
  const [year, month] = normalized.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function parseDate(dateValue: string): Date | null {
  if (!dateValue) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) {
    return null;
  }
  const [, yearRaw, monthRaw, dayRaw] = match;
  return new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw)));
}

function formatDate(dateValue: Date): string {
  return `${dateValue.getUTCFullYear()}-${String(dateValue.getUTCMonth() + 1).padStart(2, '0')}-${String(dateValue.getUTCDate()).padStart(2, '0')}`;
}

export function formatSpreadsheetDayLabel(dateValue: string): string {
  if (!dateValue) {
    return '-';
  }
  const day = Number(dateValue.slice(8, 10));
  return Number.isFinite(day) && day > 0 ? String(day).padStart(2, '0') : '-';
}

function addDays(base: Date, count: number): Date {
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + count);
  return next;
}

function addMonths(base: Date, count: number): Date {
  const day = base.getUTCDate();
  const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + count, 1));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

function shiftOccurrence(base: Date, frequency: string, intervalCount: number, direction: 1 | -1): Date {
  const safeInterval = Math.max(1, intervalCount || 1);
  if (frequency === 'daily') {
    return addDays(base, safeInterval * direction);
  }
  if (frequency === 'weekly') {
    return addDays(base, safeInterval * 7 * direction);
  }
  if (frequency === 'biweekly') {
    return addDays(base, safeInterval * 14 * direction);
  }
  return addMonths(base, safeInterval * direction);
}

export function buildOccurrencesForMonth(recurring: Accumul8RecurringPayment, monthValue: string): string[] {
  const anchor = parseDate(String(recurring.next_due_date || ''));
  if (!anchor) {
    return [];
  }
  const monthStart = parseSpreadsheetMonthValue(monthValue);
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
  const dates: string[] = [];

  let cursor = anchor;
  let guard = 0;
  while (cursor > monthEnd && guard < 240) {
    cursor = shiftOccurrence(cursor, recurring.frequency || 'monthly', Number(recurring.interval_count || 1), -1);
    guard += 1;
  }
  while (shiftOccurrence(cursor, recurring.frequency || 'monthly', Number(recurring.interval_count || 1), 1) <= monthEnd && guard < 480) {
    cursor = shiftOccurrence(cursor, recurring.frequency || 'monthly', Number(recurring.interval_count || 1), 1);
    guard += 1;
  }

  guard = 0;
  while (cursor >= monthStart && cursor <= monthEnd && guard < 240) {
    dates.push(formatDate(cursor));
    cursor = shiftOccurrence(cursor, recurring.frequency || 'monthly', Number(recurring.interval_count || 1), -1);
    guard += 1;
  }

  return dates.reverse();
}

export function shiftSpreadsheetMonthValue(monthValue: string, offset: number): string {
  const base = parseSpreadsheetMonthValue(monthValue);
  base.setUTCMonth(base.getUTCMonth() + offset);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatSpreadsheetMonthLabel(monthValue: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseSpreadsheetMonthValue(monthValue));
}

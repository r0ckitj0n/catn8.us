import { Accumul8RecurringPayment } from '../types/accumul8';

export interface Accumul8SpreadsheetMonthOption {
  value: string;
  label: string;
}

export interface Accumul8SpreadsheetMonthSummary {
  recurringCount: number;
  inflow: number;
  outflow: number;
  net: number;
}

export interface Accumul8SpreadsheetMonthRow {
  rowKey: string;
  recurring_id: number;
  entity_id: number | null;
  entity_name: string;
  contact_id: number | null;
  contact_name: string;
  account_id: number | null;
  banking_organization_id: number | null;
  title: string;
  due_date: string;
  dueDayLabel: string;
  amount: number;
  direction: string;
  frequency: string;
  payment_method: string;
  account_name: string;
  banking_organization_name: string;
  notes: string;
}

export interface Accumul8SpreadsheetMonthData {
  monthValue: string;
  monthLabel: string;
  rows: Accumul8SpreadsheetMonthRow[];
  summary: Accumul8SpreadsheetMonthSummary;
}

const MONTH_VALUE_PATTERN = /^\d{4}-\d{2}$/;

function getCurrentMonthValue(): string {
  return new Date().toISOString().slice(0, 7);
}

function normalizeMonthValue(monthValue: string): string {
  return MONTH_VALUE_PATTERN.test(monthValue) ? monthValue : getCurrentMonthValue();
}

function parseMonthValue(monthValue: string): Date {
  const normalized = normalizeMonthValue(monthValue);
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

function formatDayLabel(dateValue: string): string {
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

function buildOccurrencesForMonth(recurring: Accumul8RecurringPayment, monthValue: string): string[] {
  const anchor = parseDate(String(recurring.next_due_date || ''));
  if (!anchor) {
    return [];
  }
  const monthStart = parseMonthValue(monthValue);
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

export function shiftMonthValue(monthValue: string, offset: number): string {
  const base = parseMonthValue(monthValue);
  base.setUTCMonth(base.getUTCMonth() + offset);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthValue: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseMonthValue(monthValue));
}

export function buildSpreadsheetMonthOptions(
  recurringPayments: Accumul8RecurringPayment[],
  selectedMonth: string,
): Accumul8SpreadsheetMonthOption[] {
  const normalizedSelectedMonth = normalizeMonthValue(selectedMonth);
  const monthValues = new Set<string>([
    normalizedSelectedMonth,
    shiftMonthValue(normalizedSelectedMonth, -2),
    shiftMonthValue(normalizedSelectedMonth, -1),
    shiftMonthValue(normalizedSelectedMonth, 1),
    shiftMonthValue(normalizedSelectedMonth, 2),
  ]);

  recurringPayments.forEach((recurring) => {
    const monthValue = String(recurring.next_due_date || '').slice(0, 7);
    if (MONTH_VALUE_PATTERN.test(monthValue)) {
      monthValues.add(monthValue);
    }
  });

  return Array.from(monthValues)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({
      value,
      label: formatMonthLabel(value),
    }));
}

export function buildSpreadsheetMonthData(
  recurringPayments: Accumul8RecurringPayment[],
  monthValue: string,
): Accumul8SpreadsheetMonthData {
  const normalizedMonth = normalizeMonthValue(monthValue);
  const rows: Accumul8SpreadsheetMonthRow[] = [];

  recurringPayments.forEach((recurring) => {
    if (!Number(recurring.is_active || 0) || !Number(recurring.is_budget_planner || 0)) {
      return;
    }
    buildOccurrencesForMonth(recurring, normalizedMonth).forEach((occurrenceDate) => {
      const signedAmount = recurring.direction === 'inflow'
        ? Math.abs(Number(recurring.amount || 0))
        : -Math.abs(Number(recurring.amount || 0));
      rows.push({
        rowKey: `${recurring.id}:${occurrenceDate}`,
        recurring_id: recurring.id,
        entity_id: recurring.entity_id ?? null,
        entity_name: recurring.entity_name || '',
        contact_id: recurring.contact_id ?? null,
        contact_name: recurring.contact_name || '',
        account_id: recurring.account_id ?? null,
        banking_organization_id: recurring.banking_organization_id ?? null,
        title: recurring.title || 'Recurring Payment',
        due_date: occurrenceDate,
        dueDayLabel: formatDayLabel(occurrenceDate),
        amount: Number(signedAmount.toFixed(2)),
        direction: recurring.direction || 'outflow',
        frequency: recurring.frequency || 'monthly',
        payment_method: recurring.payment_method || 'unspecified',
        account_name: recurring.account_name || '',
        banking_organization_name: recurring.banking_organization_name || '',
        notes: recurring.notes || '',
      });
    });
  });

  rows.sort((left, right) => {
    if (left.due_date !== right.due_date) {
      return left.due_date.localeCompare(right.due_date);
    }
    if (left.account_name !== right.account_name) {
      return left.account_name.localeCompare(right.account_name);
    }
    return left.title.localeCompare(right.title);
  });

  let inflow = 0;
  let outflow = 0;
  rows.forEach((row) => {
    if (row.amount > 0) {
      inflow += row.amount;
    } else if (row.amount < 0) {
      outflow += Math.abs(row.amount);
    }
  });

  return {
    monthValue: normalizedMonth,
    monthLabel: formatMonthLabel(normalizedMonth),
    rows,
    summary: {
      recurringCount: rows.length,
      inflow: Number(inflow.toFixed(2)),
      outflow: Number(outflow.toFixed(2)),
      net: Number((inflow - outflow).toFixed(2)),
    },
  };
}

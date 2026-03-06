import { Accumul8Transaction } from '../types/accumul8';

export interface Accumul8SpreadsheetMonthOption {
  value: string;
  label: string;
}

export interface Accumul8SpreadsheetMonthSummary {
  transactionCount: number;
  paidCount: number;
  reconciledCount: number;
  inflow: number;
  outflow: number;
  rta: number;
  net: number;
  openingBalance: number | null;
  closingBalance: number | null;
  hasMixedAccounts: boolean;
}

export interface Accumul8SpreadsheetMonthRow extends Accumul8Transaction {
  sortDate: string;
  payDayLabel: string;
  dueDayLabel: string;
  notesLabel: string;
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

function parseMonthValue(monthValue: string): Date {
  const normalized = normalizeMonthValue(monthValue);
  const [year, month] = normalized.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function formatDayLabel(dateValue: string): string {
  if (!dateValue) {
    return '-';
  }
  const day = Number(dateValue.slice(8, 10));
  return Number.isFinite(day) && day > 0 ? String(day).padStart(2, '0') : '-';
}

function buildNotesLabel(transaction: Accumul8Transaction): string {
  const parts = [
    transaction.memo,
    transaction.contact_name,
    transaction.debtor_name,
    transaction.account_name,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(' | ') : '-';
}

export function normalizeMonthValue(monthValue: string): string {
  return MONTH_VALUE_PATTERN.test(monthValue) ? monthValue : getCurrentMonthValue();
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
  transactions: Accumul8Transaction[],
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

  transactions.forEach((transaction) => {
    const monthValue = String(transaction.transaction_date || '').slice(0, 7);
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
  transactions: Accumul8Transaction[],
  monthValue: string,
): Accumul8SpreadsheetMonthData {
  const normalizedMonth = normalizeMonthValue(monthValue);
  const rows = transactions
    .filter((transaction) => String(transaction.transaction_date || '').slice(0, 7) === normalizedMonth)
    .sort((left, right) => {
      const leftDate = String(left.transaction_date || '');
      const rightDate = String(right.transaction_date || '');
      if (leftDate !== rightDate) {
        return leftDate.localeCompare(rightDate);
      }
      return left.id - right.id;
    })
    .map((transaction) => ({
      ...transaction,
      sortDate: String(transaction.transaction_date || ''),
      payDayLabel: formatDayLabel(transaction.transaction_date),
      dueDayLabel: formatDayLabel(transaction.due_date),
      notesLabel: buildNotesLabel(transaction),
    }));

  const accountIds = new Set(rows.map((row) => Number(row.account_id || 0)));
  let inflow = 0;
  let outflow = 0;
  let rta = 0;
  let net = 0;
  let paidCount = 0;
  let reconciledCount = 0;

  rows.forEach((row) => {
    const amount = Number(row.amount || 0);
    const rowRta = Number(row.rta_amount || 0);
    if (amount > 0) {
      inflow += amount;
    } else if (amount < 0) {
      outflow += Math.abs(amount);
    }
    rta += rowRta;
    net += amount + rowRta;
    if (Number(row.is_paid || 0) === 1) {
      paidCount += 1;
    }
    if (Number(row.is_reconciled || 0) === 1) {
      reconciledCount += 1;
    }
  });

  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  const hasMixedAccounts = accountIds.size > 1;

  return {
    monthValue: normalizedMonth,
    monthLabel: formatMonthLabel(normalizedMonth),
    rows,
    summary: {
      transactionCount: rows.length,
      paidCount,
      reconciledCount,
      inflow: Number(inflow.toFixed(2)),
      outflow: Number(outflow.toFixed(2)),
      rta: Number(rta.toFixed(2)),
      net: Number(net.toFixed(2)),
      openingBalance: firstRow && !hasMixedAccounts
        ? Number((firstRow.running_balance - firstRow.amount - firstRow.rta_amount).toFixed(2))
        : null,
      closingBalance: lastRow && !hasMixedAccounts
        ? Number(Number(lastRow.running_balance || 0).toFixed(2))
        : null,
      hasMixedAccounts,
    },
  };
}

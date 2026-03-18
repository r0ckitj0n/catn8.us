import { Accumul8RecurringPayment, Accumul8Transaction } from '../types/accumul8';
import {
  buildOccurrencesForMonth,
  formatSpreadsheetDayLabel,
  formatSpreadsheetMonthLabel,
  normalizeSpreadsheetMonthValue,
  shiftSpreadsheetMonthValue,
} from './accumul8SpreadsheetDateUtils';

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
  transaction_id: number;
  recurring_id: number;
  entity_id: number | null;
  entity_name: string;
  contact_id: number | null;
  contact_name: string;
  account_id: number | null;
  banking_organization_id: number | null;
  title: string;
  transaction_date: string;
  due_date: string;
  paid_date: string;
  dueDayLabel: string;
  amount: number;
  rta_amount: number;
  is_paid: number;
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

export function shiftMonthValue(monthValue: string, offset: number): string {
  return shiftSpreadsheetMonthValue(monthValue, offset);
}

export function formatMonthLabel(monthValue: string): string {
  return formatSpreadsheetMonthLabel(monthValue);
}

export function buildSpreadsheetMonthOptions(
  recurringPayments: Accumul8RecurringPayment[],
  selectedMonth: string,
): Accumul8SpreadsheetMonthOption[] {
  const normalizedSelectedMonth = normalizeSpreadsheetMonthValue(selectedMonth);
  const monthValues = new Set<string>([
    normalizedSelectedMonth,
    shiftMonthValue(normalizedSelectedMonth, -2),
    shiftMonthValue(normalizedSelectedMonth, -1),
    shiftMonthValue(normalizedSelectedMonth, 1),
    shiftMonthValue(normalizedSelectedMonth, 2),
  ]);

  recurringPayments.forEach((recurring) => {
    const monthValue = String(recurring.next_due_date || '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(monthValue)) {
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
  transactions: Accumul8Transaction[],
  monthValue: string,
): Accumul8SpreadsheetMonthData {
  const normalizedMonth = normalizeSpreadsheetMonthValue(monthValue);
  const rows: Accumul8SpreadsheetMonthRow[] = [];
  const recurringById = new Map<number, Accumul8RecurringPayment>();

  recurringPayments.forEach((recurring) => {
    recurringById.set(recurring.id, recurring);
  });

  transactions.forEach((transaction) => {
    const recurringId = Number(transaction.recurring_payment_id || 0);
    if (recurringId <= 0 || Number(transaction.is_budget_planner || 0) !== 1) {
      return;
    }
    const dueDate = String(transaction.due_date || transaction.transaction_date || '');
    if (dueDate.slice(0, 7) !== normalizedMonth) {
      return;
    }
    const recurring = recurringById.get(recurringId);
    rows.push({
      rowKey: `tx:${transaction.id}`,
      transaction_id: transaction.id,
      recurring_id: recurringId,
      entity_id: transaction.entity_id ?? recurring?.entity_id ?? null,
      entity_name: transaction.entity_name || recurring?.entity_name || '',
      contact_id: transaction.contact_id ?? recurring?.contact_id ?? null,
      contact_name: transaction.contact_name || recurring?.contact_name || '',
      account_id: transaction.account_id ?? recurring?.account_id ?? null,
      banking_organization_id: transaction.banking_organization_id ?? recurring?.banking_organization_id ?? null,
      title: transaction.description || recurring?.title || 'Recurring Payment',
      transaction_date: String(transaction.transaction_date || dueDate),
      due_date: dueDate,
      paid_date: transaction.paid_date || '',
      dueDayLabel: formatSpreadsheetDayLabel(dueDate),
      amount: Number(Number(transaction.amount || 0).toFixed(2)),
      rta_amount: Number(Number(transaction.rta_amount || 0).toFixed(2)),
      is_paid: Number(transaction.is_paid || 0),
      direction: Number(transaction.amount || 0) >= 0 ? 'inflow' : 'outflow',
      frequency: recurring?.frequency || 'monthly',
      payment_method: recurring?.payment_method || 'unspecified',
      account_name: transaction.account_name || recurring?.account_name || '',
      banking_organization_name: transaction.banking_organization_name || recurring?.banking_organization_name || '',
      notes: transaction.memo || recurring?.notes || '',
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

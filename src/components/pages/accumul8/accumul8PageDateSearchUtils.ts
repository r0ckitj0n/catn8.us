import {
  Accumul8Account,
  Accumul8Direction,
  Accumul8MessageBoardMessage,
  Accumul8PaymentMethod,
  Accumul8Transaction,
} from '../../../types/accumul8';
import { getAccumul8AccountDisplayName } from '../../../utils/accumul8Accounts';

export type OpeningBalanceMessageMeta = {
  accountName: string;
  adjustmentAmount: number | null;
  bankBalance: number | null;
  priorLedgerBalance: number | null;
  transactionDate: string;
  transactionId: number | null;
};

export function formatRecurringTitle(value: string): string {
  return formatInlineText(value, 'Untitled recurring item');
}

export function formatRecurringAmount(value: number, direction: Accumul8Direction): string {
  const normalized = Number(value || 0);
  return `${direction === 'inflow' ? '+' : '-'}${Math.abs(normalized).toFixed(2)}`;
}

export function formatInlineDate(value: string): string {
  if (!value) return '-';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'numeric', day: 'numeric', year: '2-digit' });
}

export function formatInlineDateTime(value: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' });
}

export function formatSummaryWindowLabel(window: 'current' | number): string {
  return window === 'current' ? 'Current' : `${window} days`;
}

export function formatInlineText(value: string | number | null | undefined, fallback = '-'): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : fallback;
  return String(value || '').trim() || fallback;
}

export function formatAccountOptionLabel(account: Pick<Accumul8Account, 'account_name' | 'account_nickname' | 'banking_organization_name' | 'mask_last4'>): string {
  const primaryName = formatInlineText(getAccumul8AccountDisplayName(account), 'Unnamed account');
  const bankingName = formatInlineText(account.banking_organization_name, '');
  const maskLast4 = formatInlineText(account.mask_last4, '');
  return [primaryName, bankingName, maskLast4 ? `••••${maskLast4}` : ''].filter(Boolean).join(' • ');
}

export function addUtcDays(baseDate: string, days: number): string {
  const parsed = new Date(`${baseDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return baseDate;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function endOfUtcMonth(baseDate: string): string {
  const parsed = new Date(`${baseDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return baseDate;
  parsed.setUTCMonth(parsed.getUTCMonth() + 1, 0);
  return parsed.toISOString().slice(0, 10);
}

export function isDateInRange(value: string, range: { startDate: string; endDate: string }): boolean {
  if (!value) return false;
  if (range.startDate && value < range.startDate) return false;
  if (range.endDate && value > range.endDate) return false;
  return true;
}

export function getLedgerEffectiveDate(transaction: Pick<Accumul8Transaction, 'transaction_date' | 'due_date'>): string {
  return String(transaction.due_date || transaction.transaction_date || '');
}

export function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

export function formatCurrencyAmount(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function normalizeSearchQuery(value: string): string {
  return value.trim().toLowerCase();
}

export function buildSearchTokens(field: string | number | null | undefined): string[] {
  if (field === null || field === undefined) return [];
  if (typeof field === 'number' && Number.isFinite(field)) {
    const fixed = field.toFixed(2);
    const normalizedFixed = fixed.replace(/[^0-9.-]+/g, '');
    return Array.from(new Set([String(field).toLowerCase(), fixed.toLowerCase(), normalizedFixed.toLowerCase()].filter(Boolean)));
  }
  const raw = String(field).toLowerCase();
  const normalized = raw.replace(/[$,\s]+/g, '');
  return Array.from(new Set([raw, normalized].filter(Boolean)));
}

export function matchesSearchQuery(query: string, fields: Array<string | number | null | undefined>): boolean {
  if (!query) return true;
  const normalizedQuery = query.replace(/[$,\s]+/g, '');
  return fields.some((field) => buildSearchTokens(field).some((token) => token.includes(query) || token.includes(normalizedQuery)));
}

export function parseFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getOpeningBalanceMessageMeta(message: Accumul8MessageBoardMessage): OpeningBalanceMessageMeta | null {
  if (String(message.source_kind || '') !== 'aicountant_opening_balance') return null;
  const meta = message.meta && typeof message.meta === 'object' ? message.meta : {};
  const safeMeta = meta as Record<string, unknown>;
  const accountName = String(safeMeta.account_name || '').trim();
  const transactionDate = String(safeMeta.transaction_date || '').trim();
  const transactionId = Number(safeMeta.transaction_id || 0);
  const adjustmentAmount = parseFiniteNumber(safeMeta.adjustment_amount);
  const bankBalance = parseFiniteNumber(safeMeta.bank_balance);
  const priorLedgerBalance = parseFiniteNumber(safeMeta.prior_ledger_balance);
  if (!accountName && !transactionDate && transactionId <= 0 && adjustmentAmount === null && bankBalance === null && priorLedgerBalance === null) return null;
  return { accountName, adjustmentAmount, bankBalance, priorLedgerBalance, transactionDate, transactionId: transactionId > 0 ? transactionId : null };
}

export function formatPayBillStatusLabel(transaction: Pick<Accumul8Transaction, 'is_paid' | 'due_date' | 'transaction_date'>, todayDate: string): string {
  if (Number(transaction.is_paid || 0) === 1) return 'Paid';
  return ((transaction.due_date || transaction.transaction_date) < todayDate) ? 'Past due' : 'Upcoming';
}

export const RECURRING_PAYMENT_METHOD_LABELS: Record<Accumul8PaymentMethod, string> = {
  unspecified: 'Unspecified',
  autopay: 'Auto debit / autopay',
  manual: 'Manual payment',
};

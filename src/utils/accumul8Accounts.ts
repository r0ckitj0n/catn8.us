import { Accumul8Account, Accumul8RecurringPayment, Accumul8Transaction } from '../types/accumul8';

export function getAccumul8AccountDisplayName(
  account?: (Pick<Accumul8Account, 'account_name' | 'account_nickname'> & Partial<Pick<Accumul8Account, 'institution_name' | 'banking_organization_name' | 'mask_last4'>>) | null,
  fallback = 'Unnamed account',
): string {
  const nickname = String(account?.account_nickname || '').trim();
  const name = String(account?.account_name || '').trim();
  const primary = nickname || name || fallback;
  const last4 = String(account?.mask_last4 || '').replace(/\D+/g, '').slice(-4);
  const institution = String(account?.institution_name || account?.banking_organization_name || '').trim();
  return [primary, institution && institution !== primary ? institution : '', last4 ? `••••${last4}` : ''].filter(Boolean).join(' • ');
}

export type Accumul8AccountKindFields = Pick<Accumul8Account, 'account_type' | 'account_name' | 'institution_name'> & {
  account_subtype?: string | null;
  account_nickname?: string | null;
  banking_organization_name?: string | null;
  mask_last4?: string | null;
  notes?: string | null;
};

function accumul8AccountKindHaystack(account: Accumul8AccountKindFields): string {
  return [
    account.account_type,
    account.account_subtype,
    account.account_name,
    account.account_nickname,
    account.institution_name,
    account.banking_organization_name,
    account.mask_last4,
  ].map((value) => String(value || '').trim().toLowerCase()).join(' ');
}

export function isAccumul8CreditCardAccount(account: Accumul8AccountKindFields): boolean {
  const accountType = String(account.account_type || '').trim().toLowerCase();
  const accountSubtype = String(account.account_subtype || '').trim().toLowerCase();
  const institution = `${String(account.institution_name || '')} ${String(account.banking_organization_name || '')}`.trim().toLowerCase();
  const haystack = accumul8AccountKindHaystack(account);
  if (haystack.includes('debit')) return false;
  if (accountType === 'credit'
    || accountType.includes('credit')
    || accountType.includes('card')
    || accountSubtype.includes('credit card')
    || /\bcredit[\s-]?card\b/.test(haystack)) {
    return true;
  }
  if (/\b(mastercard|visa|amex|american express|discover|juniper|barclays?)\b/.test(haystack)) return true;
  if (/\bcards?\b/.test(institution)) return true;
  return false;
}

export function isAccumul8CashBankAccount(account: Accumul8AccountKindFields): boolean {
  const accountType = String(account.account_type || '').trim().toLowerCase();
  const accountName = String(account.account_name || '').trim().toLowerCase();
  if (isAccumul8CreditCardAccount(account)) return false;
  if (accountType.includes('iou') || accountType.includes('receivable') || accountType.includes('payable')) return false;
  if (accountType.includes('loan') || accountType.includes('mortgage') || accountType.includes('investment') || accountType.includes('brokerage')) return false;
  if (accountName.includes('family ledger') || /\biou\b/.test(accountName)) return false;
  return true;
}

const ACCUMUL8_HOUSEHOLD_HOLDERS = new Set(['jon', 'sarah', 'family', 'household']);
const ACCUMUL8_SHARED_HOLDER_LABELS = new Set(['checking', 'savings', 'money', 'depository', 'share']);

function accumul8AccountHolderKey(account: Accumul8AccountKindFields): string {
  const source = String(account.account_nickname || account.account_name || '').trim();
  const parts = source.split(/\s+-\s+/);
  if (parts.length < 2) return 'household';
  const last = parts[parts.length - 1].trim().toLowerCase();
  if (last === '') return 'household';
  if (ACCUMUL8_HOUSEHOLD_HOLDERS.has(last)) return last;
  if (ACCUMUL8_SHARED_HOLDER_LABELS.has(last) || last.includes('checking') || last.includes('savings')) return 'household';
  return last;
}

export function isAccumul8JonSarahHouseholdBankAccount(account: Accumul8AccountKindFields): boolean {
  if (!isAccumul8CashBankAccount(account)) return false;
  const haystack = `${String(account.account_nickname || '')} ${String(account.account_name || '')} ${String(account.notes || '')}`.toLowerCase();
  if (/\b(elijah|ezra|reuel|veronica|kid|child|children)\b/.test(haystack)) return false;
  const holder = accumul8AccountHolderKey(account);
  if (ACCUMUL8_HOUSEHOLD_HOLDERS.has(holder) || holder === 'household') return true;
  return /\b(jon|sarah)\b/.test(haystack);
}

export function getAccumul8AccountLast4(
  account: Pick<Accumul8Account, 'account_name' | 'account_nickname' | 'mask_last4'> & {
    account_number_mask?: string | null;
  },
): string {
  const fromMasks = [account.mask_last4, account.account_number_mask]
    .map((value) => String(value || '').replace(/\D+/g, ''))
    .find((digits) => digits.length >= 4);
  if (fromMasks) {
    return fromMasks.slice(-4);
  }
  const fromName = [account.account_nickname, account.account_name]
    .map((value) => String(value || '').replace(/\D+/g, ''))
    .find((digits) => digits.length >= 4);
  return fromName ? fromName.slice(-4) : '';
}

export function getAccumul8HeaderCardRowLabel(
  account: Pick<Accumul8Account, 'account_name' | 'account_nickname' | 'institution_name' | 'banking_organization_name' | 'mask_last4'> & {
    account_number_mask?: string | null;
  },
): string {
  const last4 = getAccumul8AccountLast4(account);
  const institution = String(account.institution_name || account.banking_organization_name || '').trim();
  const nickname = String(account.account_nickname || '').trim();
  const name = String(account.account_name || '').trim();
  let primary = institution || nickname || name || 'Card';
  if (last4) {
    const trailingLast4 = new RegExp(`(?:[•·.xX*\\-\\s]|\\b)${last4}\\s*$`);
    primary = primary.replace(trailingLast4, '').replace(/[•·.\s-]+$/g, '').trim() || primary;
    return `${primary} ••••${last4}`;
  }
  return primary;
}

export function getAccumul8CardAvailableCredit(account: Pick<Accumul8Account, 'available_balance' | 'credit_limit' | 'current_balance'>): number | null {
  const available = Number(account.available_balance);
  const limit = Number(account.credit_limit);
  const owed = Math.abs(Number(account.current_balance || 0));
  const hasLimit = Number.isFinite(limit) && limit > 0;
  const hasAvailable = Number.isFinite(available) && available >= 0 && (available > 0 || hasLimit);
  if (hasAvailable) {
    return Math.round(available * 100) / 100;
  }
  if (hasLimit) {
    return Math.round(Math.max(0, limit - owed) * 100) / 100;
  }
  return null;
}

export function isAccumul8HiddenLedgerRow(transaction: { description?: string | null; memo?: string | null }): boolean {
  const haystack = `${String(transaction?.description || '')} ${String(transaction?.memo || '')}`.trim().toUpperCase();
  if (haystack === '') return false;
  if (haystack.includes('DEACTIVATED DUPLICATE')) return true;
  if (haystack.includes('BALANCE SYNC ADJUSTMENT') || haystack.includes('PLAID BALANCE SYNC') || haystack.includes('TELLER BALANCE SYNC')) return true;
  return /(?:^|\s)(TEST|TEST_BAL_SYNC)(?:\s|$)/.test(haystack);
}

export function isAccumul8TransactionPaid(transaction: { is_paid?: number | null; paid_date?: string | null }): boolean {
  return Number(transaction?.is_paid || 0) === 1 || String(transaction?.paid_date || '').trim() !== '';
}

export function resolveAccumul8BillAccountId(
  transaction: Pick<Accumul8Transaction, 'account_id' | 'recurring_payment_id'>,
  recurringPayments: Array<Pick<Accumul8RecurringPayment, 'id'> & { account_id?: number | null }> = [],
): number | null {
  const directId = Number(transaction?.account_id || 0);
  if (directId > 0) return directId;
  const recurringId = Number(transaction?.recurring_payment_id || 0);
  if (recurringId <= 0) return null;
  const recurring = recurringPayments.find((item) => Number(item.id || 0) === recurringId);
  const recurringAccountId = Number(recurring?.account_id || 0);
  return recurringAccountId > 0 ? recurringAccountId : null;
}

function normalizeBillMatchKey(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function billStatementAlias(value: string): string | null {
  const key = normalizeBillMatchKey(value);
  if (key === '') return null;
  if (/\blowes?\b/.test(key) || key.includes('lowe')) return 'lowes';
  if (key.includes('home depot') || /(^|\s)hd(\s|$)/.test(key)) return 'homedepot';
  return null;
}

function roundStatementBalance(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100;
}

export function resolveAccumul8BillStatementBalance(
  transaction: Pick<Accumul8Transaction, 'recurring_payment_id' | 'description'> & { statement_balance?: number | null },
  recurringPayments: Array<Pick<Accumul8RecurringPayment, 'id'> & { title?: string | null; statement_balance?: number | null }> = [],
): number {
  const direct = Number(transaction?.statement_balance || 0);
  if (direct > 0) return roundStatementBalance(direct);

  const recurringId = Number(transaction?.recurring_payment_id || 0);
  if (recurringId > 0) {
    const recurring = recurringPayments.find((item) => Number(item.id || 0) === recurringId);
    const fromId = roundStatementBalance(Number(recurring?.statement_balance || 0));
    if (fromId > 0) return fromId;
  }

  const description = String(transaction?.description || '');
  const descriptionKey = normalizeBillMatchKey(description);
  const descriptionAlias = billStatementAlias(description);
  const matches = recurringPayments.filter((item) => {
    const title = String(item.title || '');
    const titleKey = normalizeBillMatchKey(title);
    if (!titleKey) return false;
    const titleAlias = billStatementAlias(title);
    if (descriptionAlias && titleAlias && descriptionAlias === titleAlias) return true;
    return Boolean(descriptionKey) && (descriptionKey.includes(titleKey) || titleKey.includes(descriptionKey));
  });
  const withBalance = matches.filter((item) => Number(item.statement_balance || 0) > 0);
  if (withBalance.length === 1) return roundStatementBalance(Number(withBalance[0].statement_balance || 0));
  if (descriptionAlias) {
    const aliased = withBalance.filter((item) => billStatementAlias(String(item.title || '')) === descriptionAlias);
    if (aliased.length > 0) return roundStatementBalance(Number(aliased[0].statement_balance || 0));
  }
  return 0;
}

export function normalizeAccumul8WindfallIncomeFamily(value: string): string {
  const key = String(value || '').toLowerCase();
  if (key.includes('trs of georgia') || /\btrs\b/.test(key)) return 'trs';
  if (key.includes('sarah - adc') || key.includes('adc paycheck') || key.includes('sarah adc')) return 'sarah-adc';
  return '';
}

export function isAccumul8IncomeWindfallTransaction(
  transaction: Pick<Accumul8Transaction, 'amount' | 'entry_type' | 'description' | 'recurring_payment_id'>,
  recurringPayments: Array<Pick<Accumul8RecurringPayment, 'id' | 'direction' | 'title'>> = [],
): boolean {
  const amount = Number(transaction?.amount || 0);
  if (amount <= 0) return false;
  const entryType = String(transaction?.entry_type || '');
  if (entryType === 'bill' || entryType === 'transfer') return false;
  const recurringId = Number(transaction?.recurring_payment_id || 0);
  const recurring = recurringId > 0 ? recurringPayments.find((item) => Number(item.id || 0) === recurringId) : undefined;
  const haystack = `${String(transaction?.description || '')} ${recurring?.title || ''}`;
  if (normalizeAccumul8WindfallIncomeFamily(haystack)) return true;
  if (String(recurring?.direction || '') === 'inflow' && normalizeAccumul8WindfallIncomeFamily(String(recurring?.title || ''))) return true;
  return false;
}

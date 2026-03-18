import {
  Accumul8Direction,
  Accumul8EntryType,
  Accumul8Frequency,
  Accumul8PaymentMethod,
  Accumul8RecurringPayment,
  Accumul8Transaction,
} from '../../../types/accumul8';
import { getLedgerEffectiveDate } from './accumul8PageDateSearchUtils';

export type RecurringFormState = {
  title: string;
  direction: Accumul8Direction;
  amount: number;
  frequency: Accumul8Frequency;
  payment_method: Accumul8PaymentMethod;
  interval_count: number;
  next_due_date: string;
  entity_id: string;
  account_id: string;
  is_budget_planner: number;
  notes: string;
};

export type DebtorFormState = {
  debtor_name: string;
  notes: string;
  is_active: number;
};

export type LedgerFormState = {
  transaction_date: string;
  due_date: string;
  paid_date: string;
  entry_type: Accumul8EntryType;
  description: string;
  memo: string;
  amount: number;
  rta_amount: number;
  is_paid: number;
  is_reconciled: number;
  is_budget_planner: number;
  entity_id: string;
  account_id: string;
  balance_entity_id: string;
  debtor_id: string;
};

export type LedgerInlineDraft = Partial<Pick<Accumul8Transaction, 'transaction_date' | 'due_date' | 'paid_date' | 'description' | 'memo' | 'amount' | 'rta_amount' | 'is_paid' | 'is_reconciled' | 'is_budget_planner' | 'entity_id' | 'entity_name' | 'account_id' | 'balance_entity_id' | 'balance_entity_name' | 'debtor_id' | 'debtor_name'>>;

export function createDefaultDebtorForm(): DebtorFormState {
  return { debtor_name: '', notes: '', is_active: 1 };
}

export function createDefaultLedgerForm(defaults?: { accountId?: string; balanceEntityId?: string; debtorId?: string }): LedgerFormState {
  return {
    transaction_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    paid_date: '',
    entry_type: 'manual',
    description: '',
    memo: '',
    amount: 0,
    rta_amount: 0,
    is_paid: 0,
    is_reconciled: 0,
    is_budget_planner: defaults?.balanceEntityId ? 0 : 1,
    entity_id: '',
    account_id: defaults?.accountId || '',
    balance_entity_id: defaults?.balanceEntityId || '',
    debtor_id: defaults?.debtorId || '',
  };
}

export function buildRecurringPayload(form: RecurringFormState) {
  return {
    ...form,
    amount: Number(form.amount),
    interval_count: Number(form.interval_count),
    entity_id: form.entity_id ? Number(form.entity_id) : null,
    account_id: form.account_id ? Number(form.account_id) : null,
    is_budget_planner: Number(form.is_budget_planner),
  };
}

export function isProjectedPlanningTransaction(
  transaction: Pick<Accumul8Transaction, 'due_date' | 'transaction_date' | 'is_budget_planner' | 'source_kind'>,
  todayDate: string,
): boolean {
  const effectiveDate = getLedgerEffectiveDate(transaction);
  const sourceKind = String(transaction.source_kind || '');
  const isPlannerOnly = Number(transaction.is_budget_planner || 0) === 1 && sourceKind !== 'teller';
  if (isPlannerOnly) return true;
  if (!effectiveDate || sourceKind === 'statement_pdf') return false;
  return effectiveDate > todayDate;
}

export function normalizePaidStateDraft(
  current: Pick<Accumul8Transaction, 'transaction_date' | 'due_date' | 'paid_date' | 'is_paid'>,
  existingDraft: LedgerInlineDraft | undefined,
  patch: LedgerInlineDraft,
): LedgerInlineDraft {
  const normalizedPatch: LedgerInlineDraft = { ...patch };
  const currentPaidDate = String(existingDraft?.paid_date ?? current.paid_date ?? '').trim();
  const currentDueDate = String(existingDraft?.due_date ?? current.due_date ?? '').trim();
  const currentTransactionDate = String(existingDraft?.transaction_date ?? current.transaction_date ?? '').trim();
  if (Object.prototype.hasOwnProperty.call(patch, 'paid_date')) {
    const nextPaidDate = String(patch.paid_date || '').trim();
    normalizedPatch.paid_date = nextPaidDate;
    normalizedPatch.is_paid = nextPaidDate !== '' ? 1 : 0;
    return normalizedPatch;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'is_paid')) {
    const nextIsPaid = Number(patch.is_paid || 0) === 1 ? 1 : 0;
    normalizedPatch.is_paid = nextIsPaid;
    normalizedPatch.paid_date = nextIsPaid === 1 ? (currentPaidDate || currentDueDate || currentTransactionDate) : '';
  }
  return normalizedPatch;
}

export function buildLedgerFormFromTransaction(tx: Accumul8Transaction): LedgerFormState {
  return {
    transaction_date: tx.transaction_date || new Date().toISOString().slice(0, 10),
    due_date: tx.due_date || '',
    paid_date: tx.paid_date || '',
    entry_type: (tx.entry_type || 'manual') as Accumul8EntryType,
    description: tx.description || '',
    memo: tx.memo || '',
    amount: Number(tx.amount || 0),
    rta_amount: Number(tx.rta_amount || 0),
    is_paid: Number(tx.is_paid || 0),
    is_reconciled: Number(tx.is_reconciled || 0),
    is_budget_planner: Number(tx.is_budget_planner || 0),
    entity_id: tx.entity_id ? String(tx.entity_id) : '',
    account_id: tx.account_id ? String(tx.account_id) : '',
    balance_entity_id: tx.balance_entity_id ? String(tx.balance_entity_id) : '',
    debtor_id: tx.debtor_id ? String(tx.debtor_id) : '',
  };
}

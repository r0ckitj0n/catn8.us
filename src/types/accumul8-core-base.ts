export type Accumul8ContactType = 'payee' | 'payer' | 'repayment';
export type Accumul8Direction = 'outflow' | 'inflow';
export type Accumul8Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type Accumul8EntryType = 'manual' | 'auto' | 'transfer' | 'deposit' | 'bill';
export type Accumul8PaymentMethod = 'unspecified' | 'autopay' | 'manual';

export interface Accumul8Contact {
  id: number;
  entity_id: number | null;
  contact_name: string;
  contact_type: Accumul8ContactType;
  default_amount: number;
  email: string;
  phone_number: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  is_active: number;
}

export interface Accumul8ContactUpsertRequest {
  contact_name: string;
  contact_type: Accumul8ContactType;
  default_amount: number;
  email: string;
  phone_number: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
}

export interface Accumul8RecurringPayment {
  id: number;
  entity_id: number | null;
  entity_name: string;
  contact_id: number | null;
  account_id: number | null;
  banking_organization_id: number | null;
  title: string;
  direction: Accumul8Direction;
  amount: number;
  frequency: Accumul8Frequency;
  payment_method: Accumul8PaymentMethod;
  interval_count: number;
  day_of_month: number | null;
  day_of_week: number | null;
  next_due_date: string;
  paid_date: string;
  notes: string;
  is_active: number;
  is_budget_planner: number;
  contact_name: string;
  account_name: string;
  banking_organization_name: string;
  recurring_link_count: number;
  recurring_bank_aliases: string[];
}

export interface Accumul8RecurringUpsertRequest {
  title: string;
  direction: Accumul8Direction;
  amount: number;
  frequency: Accumul8Frequency;
  payment_method: Accumul8PaymentMethod;
  interval_count: number;
  next_due_date: string;
  paid_date?: string;
  entity_id?: number | null;
  contact_id?: number | null;
  account_id?: number | null;
  is_budget_planner?: number;
  notes?: string;
  recurring_bank_aliases?: string[];
}

export interface Accumul8Transaction {
  id: number;
  account_id: number | null;
  banking_organization_id: number | null;
  recurring_payment_id: number | null;
  entity_id: number | null;
  entity_name: string;
  balance_entity_id: number | null;
  balance_entity_name: string;
  contact_id: number | null;
  debtor_id: number | null;
  transaction_date: string;
  due_date: string;
  paid_date: string;
  entry_type: Accumul8EntryType;
  description: string;
  memo: string;
  amount: number;
  rta_amount: number;
  running_balance: number;
  is_paid: number;
  is_reconciled: number;
  is_budget_planner: number;
  source_kind: string;
  source_ref: string;
  statement_upload_id: number | null;
  statement_page_number: number | null;
  pending_status: number;
  contact_name: string;
  account_name: string;
  banking_organization_name: string;
  debtor_name: string;
}

export interface Accumul8TransactionUpsertRequest {
  transaction_date: string;
  due_date?: string;
  paid_date?: string;
  entry_type: Accumul8EntryType;
  description: string;
  memo?: string;
  amount: number;
  rta_amount: number;
  is_paid: number;
  is_reconciled: number;
  is_budget_planner: number;
  entity_id?: number | null;
  balance_entity_id?: number | null;
  contact_id?: number | null;
  account_id?: number | null;
  debtor_id?: number | null;
  skip_recurring_template_sync?: number;
}

export interface Accumul8TransactionMoveRequest {
  transaction_ids: number[];
  account_id: number;
}

export interface Accumul8BudgetMonthEnsureRequest {
  month_value: string;
}

export interface Accumul8BudgetMonthEnsureResponse {
  success: boolean;
  created: number;
}

export interface Accumul8RecurringLedgerSyncResponse {
  success: boolean;
  created: number;
  window_start: string;
  window_end: string;
  normalized_template_count: number;
}

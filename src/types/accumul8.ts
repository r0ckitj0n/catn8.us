export type Accumul8ContactType = 'payee' | 'payer' | 'both';
export type Accumul8Direction = 'outflow' | 'inflow';
export type Accumul8Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type Accumul8EntryType = 'manual' | 'auto' | 'transfer' | 'deposit' | 'bill';

export interface Accumul8Contact {
  id: number;
  contact_name: string;
  contact_type: Accumul8ContactType;
  default_amount: number;
  email: string;
  notes: string;
  is_active: number;
}

export interface Accumul8ContactUpsertRequest {
  contact_name: string;
  contact_type: Accumul8ContactType;
  default_amount: number;
  email: string;
  notes: string;
}

export interface Accumul8RecurringPayment {
  id: number;
  contact_id: number | null;
  account_id: number | null;
  title: string;
  direction: Accumul8Direction;
  amount: number;
  frequency: Accumul8Frequency;
  interval_count: number;
  day_of_month: number | null;
  day_of_week: number | null;
  next_due_date: string;
  notes: string;
  is_active: number;
  contact_name: string;
  account_name: string;
}

export interface Accumul8RecurringUpsertRequest {
  title: string;
  direction: Accumul8Direction;
  amount: number;
  frequency: Accumul8Frequency;
  interval_count: number;
  next_due_date: string;
  contact_id?: number | null;
  account_id?: number | null;
  notes?: string;
}

export interface Accumul8Transaction {
  id: number;
  account_id: number | null;
  contact_id: number | null;
  debtor_id: number | null;
  transaction_date: string;
  due_date: string;
  entry_type: Accumul8EntryType;
  description: string;
  memo: string;
  amount: number;
  rta_amount: number;
  running_balance: number;
  is_paid: number;
  is_reconciled: number;
  source_kind: string;
  pending_status: number;
  contact_name: string;
  account_name: string;
  debtor_name: string;
}

export interface Accumul8TransactionUpsertRequest {
  transaction_date: string;
  due_date?: string;
  entry_type: Accumul8EntryType;
  description: string;
  memo?: string;
  amount: number;
  rta_amount: number;
  is_paid: number;
  is_reconciled: number;
  contact_id?: number | null;
  account_id?: number | null;
  debtor_id?: number | null;
}

export interface Accumul8Account {
  id: number;
  account_name: string;
  account_type: string;
  institution_name: string;
  mask_last4: string;
  current_balance: number;
  available_balance: number;
  is_active: number;
}

export interface Accumul8AccessibleOwner {
  owner_user_id: number;
  username: string;
  email: string;
  is_self: number;
}

export interface Accumul8AccessUser {
  id: number;
  username: string;
  email: string;
  is_active: number;
}

export interface Accumul8AccessGrant {
  id: number;
  grantee_user_id: number;
  owner_user_id: number;
  granted_by_user_id: number | null;
  grantee_username: string;
  grantee_email: string;
  owner_username: string;
  owner_email: string;
  granted_by_username: string;
  created_at: string;
  updated_at: string;
}

export interface Accumul8AccessListResponse {
  success: boolean;
  users: Accumul8AccessUser[];
  grants: Accumul8AccessGrant[];
}

export interface Accumul8NotificationRule {
  id: number;
  rule_name: string;
  trigger_type: string;
  days_before_due: number;
  target_scope: 'group' | 'custom';
  custom_user_ids: number[];
  email_subject_template: string;
  email_body_template: string;
  is_active: number;
  last_triggered_at: string;
}

export interface Accumul8NotificationRuleUpsertRequest {
  rule_name: string;
  trigger_type: string;
  days_before_due: number;
  target_scope: 'group' | 'custom';
  custom_user_ids: number[];
  email_subject_template: string;
  email_body_template: string;
}

export interface Accumul8BillItem {
  id: number;
  transaction_date: string;
  due_date: string;
  description: string;
  amount: number;
  is_paid: number;
  source_kind: string;
}

export interface Accumul8BankConnection {
  id: number;
  provider_name: string;
  institution_id: string;
  institution_name: string;
  plaid_item_id: string;
  status: string;
  last_sync_at: string;
  last_error: string;
}

export interface Accumul8Summary {
  net_amount: number;
  inflow_total: number;
  outflow_total: number;
  unpaid_outflow_total: number;
}

export interface Accumul8Debtor {
  id: number;
  contact_id: number | null;
  debtor_name: string;
  notes: string;
  is_active: number;
  total_loaned: number;
  total_repaid: number;
  outstanding_balance: number;
  transaction_count: number;
  last_activity_date: string;
  contact_name: string;
}

export interface Accumul8DebtorUpsertRequest {
  debtor_name: string;
  contact_id?: number | null;
  notes?: string;
  is_active?: number;
}

export interface Accumul8BudgetRow {
  id: number;
  row_order: number;
  category_name: string;
  monthly_budget: number;
  match_pattern: string;
  is_active: number;
}

export interface Accumul8BudgetRowUpsertRequest {
  category_name: string;
  monthly_budget: number;
  match_pattern?: string;
  row_order?: number;
  is_active?: number;
}

export interface Accumul8BootstrapResponse {
  success: boolean;
  selected_owner_user_id: number;
  accessible_account_owners: Accumul8AccessibleOwner[];
  contacts: Accumul8Contact[];
  recurring_payments: Accumul8RecurringPayment[];
  transactions: Accumul8Transaction[];
  accounts: Accumul8Account[];
  notification_rules: Accumul8NotificationRule[];
  pay_bills: Accumul8BillItem[];
  bank_connections: Accumul8BankConnection[];
  debtors: Accumul8Debtor[];
  debtor_ledger: Accumul8Transaction[];
  budget_rows: Accumul8BudgetRow[];
  sync_provider: {
    provider: string;
    env: string;
    configured: number;
  };
  summary: Accumul8Summary;
}

export interface Accumul8PlaidCreateLinkTokenResponse {
  success: boolean;
  link_token: string;
  expiration: string;
}

export interface Accumul8PlaidExchangeResponse {
  success: boolean;
  connection_id: number;
  item_id: string;
}

export interface Accumul8PlaidSyncResponse {
  success: boolean;
  added: number;
  modified: number;
  removed: number;
}

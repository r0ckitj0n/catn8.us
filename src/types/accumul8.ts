export type Accumul8ContactType = 'payee' | 'payer' | 'repayment';
export type Accumul8Direction = 'outflow' | 'inflow';
export type Accumul8Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type Accumul8EntryType = 'manual' | 'auto' | 'transfer' | 'deposit' | 'bill';
export type Accumul8PaymentMethod = 'unspecified' | 'autopay' | 'manual';
export type Accumul8StatementKind = 'bank_account' | 'credit_card' | 'loan' | 'mortgage' | 'other';

export interface Accumul8StatementAlert {
  severity: string;
  reason: string;
  transaction_description: string;
  transaction_date: string;
  amount: number;
  baseline_mean: number | null;
  baseline_max: number | null;
}

export interface Accumul8StatementTransactionLocator {
  transaction_date: string;
  description: string;
  amount: number;
  running_balance: number | null;
  page_number: number | null;
}

export interface Accumul8StatementPageCatalogEntry {
  page_number: number;
  text_excerpt: string;
}

export interface Accumul8StatementPlanSuggestedAccount {
  account_name: string;
  account_type: string;
  institution_name: string;
  mask_last4: string;
}

export interface Accumul8StatementPlan {
  suggested_account_id: number | null;
  suggested_account_label: string;
  account_match_score: number;
  account_match_reason: string;
  requires_account_confirmation: number;
  statement_kind: Accumul8StatementKind;
  institution_name: string;
  account_name_hint: string;
  account_last4: string;
  period_start: string | null;
  period_end: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  transaction_count: number;
  importable_transaction_count: number;
  invalid_transaction_count: number;
  estimated_duplicate_count: number;
  inflow_total: number;
  outflow_total: number;
  first_transaction_date: string;
  last_transaction_date: string;
  suggested_new_account: Accumul8StatementPlanSuggestedAccount;
}

export interface Accumul8StatementImportResultRow {
  transaction_date?: string;
  description?: string;
  amount?: number;
  reason?: string;
  existing_transaction_id?: number;
  id?: number;
}

export interface Accumul8StatementImportResult {
  imported_count: number;
  duplicate_count: number;
  failed_count: number;
  successful_rows: Accumul8StatementImportResultRow[];
  duplicate_rows: Accumul8StatementImportResultRow[];
  failed_rows: Accumul8StatementImportResultRow[];
}

export interface Accumul8StatementSearchResult {
  upload_id: number;
  original_filename: string;
  status: string;
  account_name: string;
  institution_name: string;
  period_start: string;
  period_end: string;
  matched_page_number: number | null;
  snippet: string;
  score: number;
}

export interface Accumul8StatementUpload {
  id: number;
  account_id: number | null;
  account_name: string;
  banking_organization_name: string;
  institution_name: string;
  account_name_hint: string;
  account_mask_last4: string;
  statement_kind: Accumul8StatementKind;
  status: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  extracted_method: string;
  ai_provider: string;
  ai_model: string;
  period_start: string;
  period_end: string;
  opening_balance: number | null;
  closing_balance: number | null;
  imported_transaction_count: number;
  duplicate_transaction_count: number;
  suspicious_item_count: number;
  reconciliation_status: string;
  reconciliation_note: string;
  suspicious_items: Accumul8StatementAlert[];
  processing_notes: string[];
  transaction_locators: Accumul8StatementTransactionLocator[];
  page_catalog: Accumul8StatementPageCatalogEntry[];
  catalog_summary: string;
  catalog_keywords: string[];
  plan: Accumul8StatementPlan | null;
  import_result: Accumul8StatementImportResult | null;
  last_error: string;
  last_scanned_at: string;
  processed_at: string;
  created_at: string;
}

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
  notes: string;
  is_active: number;
  is_budget_planner: number;
  contact_name: string;
  account_name: string;
  banking_organization_name: string;
}

export interface Accumul8RecurringUpsertRequest {
  title: string;
  direction: Accumul8Direction;
  amount: number;
  frequency: Accumul8Frequency;
  payment_method: Accumul8PaymentMethod;
  interval_count: number;
  next_due_date: string;
  entity_id?: number | null;
  contact_id?: number | null;
  account_id?: number | null;
  is_budget_planner?: number;
  notes?: string;
}

export interface Accumul8Transaction {
  id: number;
  account_id: number | null;
  banking_organization_id: number | null;
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

export interface Accumul8BankingOrganization {
  id: number;
  banking_organization_name: string;
  institution_name: string;
  website_url: string;
  login_url: string;
  support_url: string;
  support_phone: string;
  support_email: string;
  routing_number: string;
  mailing_address: string;
  icon_path: string;
  notes: string;
  is_active: number;
}

export interface Accumul8BankingOrganizationUpsertRequest {
  banking_organization_name: string;
  institution_name?: string;
  website_url?: string;
  login_url?: string;
  support_url?: string;
  support_phone?: string;
  support_email?: string;
  routing_number?: string;
  mailing_address?: string;
  icon_path?: string;
  notes?: string;
  is_active?: number;
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
}

export interface Accumul8TransactionMoveRequest {
  transaction_ids: number[];
  account_id: number;
}

export interface Accumul8Account {
  id: number;
  banking_organization_id: number | null;
  account_name: string;
  account_nickname: string;
  banking_organization_name: string;
  account_type: string;
  account_subtype: string;
  institution_name: string;
  account_number_mask: string;
  mask_last4: string;
  routing_number: string;
  currency_code: string;
  statement_day_of_month: number | null;
  payment_due_day_of_month: number | null;
  autopay_enabled: number;
  credit_limit: number;
  interest_rate: number;
  minimum_payment: number;
  opened_on: string;
  closed_on: string;
  notes: string;
  current_balance: number;
  available_balance: number;
  is_active: number;
}

export interface Accumul8AccountUpsertRequest {
  banking_organization_id?: number | null;
  account_name: string;
  account_nickname?: string;
  account_type?: string;
  account_subtype?: string;
  institution_name?: string;
  account_number_mask?: string;
  mask_last4?: string;
  routing_number?: string;
  currency_code?: string;
  statement_day_of_month?: number | null;
  payment_due_day_of_month?: number | null;
  autopay_enabled?: number;
  credit_limit?: number;
  interest_rate?: number;
  minimum_payment?: number;
  opened_on?: string | null;
  closed_on?: string | null;
  notes?: string;
  is_active?: number;
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
  paid_date: string;
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
  entity_id: number | null;
  entity_name: string;
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

export interface Accumul8Entity {
  id: number;
  owner_user_id: number;
  display_name: string;
  entity_kind: string;
  contact_type: Accumul8ContactType;
  is_payee: number;
  is_payer: number;
  is_vendor: number;
  is_balance_person: number;
  default_amount: number;
  email: string;
  phone_number: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  is_active: number;
  legacy_contact_id: number | null;
  legacy_debtor_id: number | null;
  contact_id: number | null;
  debtor_id: number | null;
  contact_name: string;
  debtor_name: string;
  aliases: Accumul8EntityAlias[];
}

export interface Accumul8EntityAlias {
  id: number;
  entity_id: number;
  alias_name: string;
}

export interface Accumul8EntityEndexGuide {
  parent_name: string;
  match_rule: string;
  examples: string[];
}

export interface Accumul8EntityAliasDraft {
  alias_name: string;
  merge_entity_id: number | null;
  pending_alias_names: string[];
}

export interface Accumul8EntityUpsertRequest {
  display_name: string;
  entity_kind?: string;
  contact_type: Accumul8ContactType;
  is_payee?: number;
  is_payer?: number;
  is_vendor?: number;
  is_balance_person?: number;
  default_amount?: number;
  email?: string;
  phone_number?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  is_active?: number;
}

export interface Accumul8EntityAliasUpsertRequest {
  entity_id: number;
  alias_name: string;
  merge_entity_id?: number | null;
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
  entities: Accumul8Entity[];
  entity_aliases: Accumul8EntityAlias[];
  entity_endex_guides: Accumul8EntityEndexGuide[];
  contacts: Accumul8Contact[];
  recurring_payments: Accumul8RecurringPayment[];
  transactions: Accumul8Transaction[];
  banking_organizations: Accumul8BankingOrganization[];
  accounts: Accumul8Account[];
  notification_rules: Accumul8NotificationRule[];
  pay_bills: Accumul8BillItem[];
  bank_connections: Accumul8BankConnection[];
  statement_uploads: Accumul8StatementUpload[];
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

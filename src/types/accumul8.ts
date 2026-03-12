export type Accumul8ContactType = 'payee' | 'payer' | 'repayment';
export type Accumul8Direction = 'outflow' | 'inflow';
export type Accumul8Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type Accumul8EntryType = 'manual' | 'auto' | 'transfer' | 'deposit' | 'bill';
export type Accumul8PaymentMethod = 'unspecified' | 'autopay' | 'manual';
export type Accumul8StatementKind = 'bank_account' | 'credit_card' | 'loan' | 'mortgage' | 'other';
export type Accumul8StatementArchiveSection = 'inbox' | 'library' | 'signals';

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
  row_index?: number;
  transaction_date: string;
  description: string;
  amount: number;
  running_balance: number | null;
  page_number: number | null;
  statement_account_name_hint?: string;
  statement_account_last4?: string;
  statement_account_label?: string;
}

export interface Accumul8StatementPageCatalogEntry {
  page_number: number;
  text_excerpt: string;
}

export interface Accumul8StatementCatalogVerificationSection {
  statement_account_label: string;
  statement_account_name_hint: string;
  statement_account_last4: string;
  transaction_count: number;
  invalid_row_count: number;
  opening_balance: number | null;
  closing_balance: number | null;
  transaction_total: number;
  expected_closing_balance: number | null;
  closing_delta: number | null;
  status: string;
  note: string;
}

export interface Accumul8StatementCatalogVerification {
  status: string;
  summary: string;
  authoritative: number;
  verified_section_count: number;
  warning_section_count: number;
  failed_section_count: number;
  sections: Accumul8StatementCatalogVerificationSection[];
}

export interface Accumul8StatementOcrRow {
  row_index: number;
  transaction_date: string | null;
  description: string;
  memo: string;
  amount: number | null;
  running_balance: number | null;
  page_number: number | null;
  reason: string;
}

export interface Accumul8StatementOcrSection {
  statement_account_label: string;
  statement_account_name_hint: string;
  statement_account_last4: string;
  opening_balance: number | null;
  closing_balance: number | null;
  rows: Accumul8StatementOcrRow[];
}

export interface Accumul8StatementOcrDocument {
  original_filename: string;
  institution_name: string;
  statement_kind: Accumul8StatementKind;
  period_start: string | null;
  period_end: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  sections: Accumul8StatementOcrSection[];
}

export interface Accumul8StatementPlanSuggestedAccount {
  account_name: string;
  account_type: string;
  institution_name: string;
  mask_last4: string;
}

export interface Accumul8StatementAccountSectionOption {
  account_name_hint: string;
  account_last4: string;
  label: string;
}

export interface Accumul8StatementPlan {
  suggested_account_id: number | null;
  suggested_account_label: string;
  account_match_score: number;
  account_match_reason: string;
  account_section_options: Accumul8StatementAccountSectionOption[];
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
  row_index?: number;
  transaction_date?: string;
  description?: string;
  amount?: number;
  memo?: string;
  running_balance?: number | null;
  page_number?: number | null;
  reason?: string;
  existing_transaction_id?: number;
  suggested_account_id?: number | null;
  statement_account_name_hint?: string;
  statement_account_last4?: string;
  statement_account_label?: string;
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

export interface Accumul8StatementReconciliationDetail {
  row_index: number;
  transaction_date: string;
  description: string;
  amount: number | null;
  transaction_id: number | null;
  result: string;
  details: string;
  resolved_account_id?: number | null;
  statement_account_name_hint?: string;
  statement_account_last4?: string;
  statement_account_label?: string;
}

export interface Accumul8StatementAuditSection {
  statement_account_label: string;
  statement_account_name_hint: string;
  statement_account_last4: string;
  expected_account_id: number | null;
  statement_total: number;
  matched_total: number;
  amount_delta: number;
  row_count: number;
  matched_count: number;
}

export interface Accumul8StatementAuditIssue {
  row_index: number;
  result: string;
  details: string;
  statement_account_label: string;
  description: string;
  transaction_date: string;
  amount: number | null;
  matched_transaction_ids?: number[];
  matched_account_ids?: number[];
}

export interface Accumul8StatementAuditAction {
  row_index: number;
  result: string;
  details: string;
  statement_account_label: string;
  description: string;
  transaction_date: string;
  amount: number | null;
  transaction_id?: number | null;
  from_account_id?: number | null;
  to_account_id?: number | null;
}

export interface Accumul8StatementAuditCounts {
  valid_rows: number;
  matched_rows: number;
  wrong_account_rows: number;
  missing_rows: number;
  invalid_rows: number;
  fixed_wrong_account_rows?: number;
  imported_missing_rows?: number;
  linked_rows?: number;
  reconciled_rows?: number;
}

export interface Accumul8StatementAuditReportItem {
  upload_id: number;
  original_filename: string;
  status: string;
  summary: string;
  counts: Accumul8StatementAuditCounts;
  account_sections: Accumul8StatementAuditSection[];
  catalog_refresh_performed?: number;
  issues?: Accumul8StatementAuditIssue[];
  actions?: Accumul8StatementAuditAction[];
}

export interface Accumul8StatementAuditRun {
  id: number;
  audit_start_date: string;
  audit_end_date: string;
  upload_count: number;
  passed_count: number;
  warning_count: number;
  failed_count: number;
  summary_text: string;
  report: Accumul8StatementAuditReportItem[];
  created_at: string;
}

export interface Accumul8StatementAuditRequest {
  start_date?: string | null;
  end_date?: string | null;
  auto_catalog_missing?: boolean;
  auto_fix_ledger?: boolean;
  force_rescan?: boolean;
}

export interface Accumul8StatementAuditResponse {
  success: boolean;
  run: Accumul8StatementAuditRun;
  runs: Accumul8StatementAuditRun[];
}

export interface Accumul8ImportedTransactionCleanupCandidate {
  transaction_id: number;
  account_id: number | null;
  account_name: string;
  banking_organization_name: string;
  transaction_date: string;
  description: string;
  amount: number;
  source_kind: string;
  source_ref: string;
  statement_upload_id: number | null;
  category: string;
  category_label: string;
  reason: string;
  safe_to_purge: number;
  teller_history_start: string;
  teller_history_end: string;
  matched_teller_transaction_id: number | null;
}

export interface Accumul8ImportedTransactionCleanupCategoryCount {
  category: string;
  category_label: string;
  count: number;
  safe_to_purge: number;
}

export interface Accumul8ImportedTransactionCleanupReport {
  generated_at: string;
  total_candidates: number;
  safe_candidate_count: number;
  summary_text: string;
  category_counts: Accumul8ImportedTransactionCleanupCategoryCount[];
  candidates: Accumul8ImportedTransactionCleanupCandidate[];
}

export interface Accumul8ImportedTransactionCleanupAuditResponse {
  success: boolean;
  report: Accumul8ImportedTransactionCleanupReport;
}

export interface Accumul8ImportedTransactionCleanupPurgeResponse {
  success: boolean;
  deleted_count: number;
  affected_upload_ids: number[];
}

export interface Accumul8StatementReconciliationRun {
  id: number;
  reconciliation_status: string;
  transaction_count: number;
  already_reconciled_count: number;
  reconciled_now_count: number;
  linked_match_count: number;
  missing_match_count: number;
  invalid_row_count: number;
  summary_text: string;
  details: Accumul8StatementReconciliationDetail[];
  created_at: string;
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
  review_rows: Accumul8StatementImportResultRow[];
  page_catalog: Accumul8StatementPageCatalogEntry[];
  catalog_summary: string;
  catalog_keywords: string[];
  catalog_trace: Record<string, unknown> | null;
  catalog_verification: Accumul8StatementCatalogVerification | null;
  ocr_statement: Accumul8StatementOcrDocument | null;
  plan: Accumul8StatementPlan | null;
  import_result: Accumul8StatementImportResult | null;
  reconciliation_runs: Accumul8StatementReconciliationRun[];
  last_error: string;
  last_scanned_at: string;
  processed_at: string;
  is_archived: number;
  archived_at: string;
  archived_from_status: string;
  archived_from_section: Accumul8StatementArchiveSection | '';
  created_at: string;
}

export interface Accumul8StatementArchiveRequest {
  id: number;
  archived_from_section?: Accumul8StatementArchiveSection;
}

export interface Accumul8StatementArchiveResponse {
  success: boolean;
  upload: Accumul8StatementUpload;
}

export interface Accumul8StatementRestoreResponse {
  success: boolean;
  upload: Accumul8StatementUpload;
  restored_to_section: Accumul8StatementArchiveSection;
}

export interface Accumul8StatementDeleteArchivedResponse {
  success: boolean;
  id: number;
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
  paid_date: string;
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
  paid_date?: string;
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
  bank_connection_id: number | null;
  provider_name: string;
  teller_account_id: string;
  teller_enrollment_id: string;
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
  teller_sync_anchor_date: string;
  teller_backfill_cursor_id: string;
  teller_backfill_complete: number;
  teller_history_start_date: string;
  teller_history_end_date: string;
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

export interface Accumul8AccountDeleteRequest {
  id: number;
  delete_associated_records?: number;
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
  teller_enrollment_id: string;
  teller_user_id: string;
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

export interface Accumul8EntityAliasScanRequest {
  entity_id: number;
}

export interface Accumul8EntityAliasScanResponse {
  success: boolean;
  entity_id: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  conflict_count: number;
  alias_names: string[];
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
  archived_statement_uploads: Accumul8StatementUpload[];
  debtors: Accumul8Debtor[];
  debtor_ledger: Accumul8Transaction[];
  budget_rows: Accumul8BudgetRow[];
  statement_audit_runs: Accumul8StatementAuditRun[];
  sync_provider: {
    provider: string;
    env: string;
    configured: number;
  };
  summary: Accumul8Summary;
}

export interface Accumul8TellerConnectTokenResponse {
  success: boolean;
  application_id: string;
  environment: string;
}

export type Accumul8TellerDiagnosticEventName =
  | 'open_requested'
  | 'init'
  | 'iframe_detected'
  | 'message'
  | 'success'
  | 'exit'
  | 'failure'
  | 'error'
  | 'enroll_success'
  | 'sync_success'
  | 'sync_error';

export interface Accumul8TellerDiagnosticRequest {
  source: string;
  event_name: Accumul8TellerDiagnosticEventName;
  institution_id?: string;
  institution_name?: string;
  enrollment_id?: string;
  connection_id?: number;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface Accumul8TellerDiagnosticResponse {
  success: boolean;
}

export interface Accumul8TellerEnrollmentResponse {
  success: boolean;
  connection_id: number;
  enrollment_id: string;
}

export interface Accumul8TellerSyncResponse {
  success: boolean;
  added: number;
  modified: number;
  unchanged: number;
  removed: number;
  accounts: Accumul8TellerSyncAccountSummary[];
}

export interface Accumul8TellerSyncAccountSummary {
  remote_account_id: string;
  remote_account_name: string;
  remote_account_type: string;
  remote_account_subtype: string;
  mask_last4: string;
  local_account_id: number;
  local_account_name: string;
  institution_name: string;
  mapping_action: 'created' | 'updated';
  transactions_supported: number;
  balances_supported: number;
  details_supported: number;
  sync_skipped_reason: string;
  history_start_date: string;
  history_end_date: string;
  recent_window_start_date: string;
  recent_window_end_date: string;
  backfill_cursor_id: string;
  backfill_complete: number;
  backfill_pages_fetched: number;
  transactions_added: number;
  transactions_modified: number;
  transactions_unchanged: number;
  transactions_removed: number;
  stale_teller_removed: number;
  statement_imports_removed: number;
}

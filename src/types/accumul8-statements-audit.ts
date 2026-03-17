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

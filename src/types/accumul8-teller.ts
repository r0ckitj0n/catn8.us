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

import type { Accumul8StatementKind } from './accumul8-statements';

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

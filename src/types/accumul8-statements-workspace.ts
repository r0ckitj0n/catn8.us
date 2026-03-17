import type {
  Accumul8StatementAlert,
  Accumul8StatementCatalogVerification,
  Accumul8StatementOcrDocument,
  Accumul8StatementPageCatalogEntry,
  Accumul8StatementPlan,
  Accumul8StatementTransactionLocator,
} from './accumul8-statements-catalog';
import type {
  Accumul8StatementArchiveSection,
  Accumul8StatementKind,
} from './accumul8-statements';
import type {
  Accumul8StatementAuditRun,
  Accumul8StatementImportResult,
  Accumul8StatementImportResultRow,
  Accumul8StatementReconciliationRun,
} from './accumul8-statements-audit';

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

export interface Accumul8StatementWorkspaceResponse {
  success: boolean;
  statement_uploads: Accumul8StatementUpload[];
  archived_statement_uploads: Accumul8StatementUpload[];
  statement_audit_runs: Accumul8StatementAuditRun[];
}

import {
  Accumul8Account,
  Accumul8BankingOrganization,
  Accumul8ImportedTransactionCleanupPurgeResponse,
  Accumul8ImportedTransactionCleanupReport,
  Accumul8StatementArchiveResponse,
  Accumul8StatementArchiveSection,
  Accumul8StatementAuditRequest,
  Accumul8StatementAuditRun,
  Accumul8StatementImportResult,
  Accumul8StatementRestoreResponse,
  Accumul8StatementSearchResult,
  Accumul8StatementUpload,
  Accumul8Transaction,
} from '../../types/accumul8';

export interface Accumul8StatementsPanelProps {
  busy: boolean;
  accounts: Accumul8Account[];
  bankingOrganizations: Accumul8BankingOrganization[];
  statementUploads: Accumul8StatementUpload[];
  archivedStatementUploads: Accumul8StatementUpload[];
  statementAuditRuns: Accumul8StatementAuditRun[];
  transactions: Accumul8Transaction[];
  ownerUserId: number;
  onUpload: (formData: FormData) => Promise<Accumul8StatementUpload | undefined>;
  onRescan: (id: number, accountId?: number | null) => Promise<Accumul8StatementUpload | undefined>;
  onUpdateMetadata: (payload: { id: number; statement_kind?: string; account_name_hint?: string; account_last4?: string }) => Promise<{ success: boolean; upload: Accumul8StatementUpload }>;
  onArchiveStatement: (payload: { id: number; archived_from_section?: Accumul8StatementArchiveSection }) => Promise<Accumul8StatementArchiveResponse>;
  onRestoreStatement: (id: number) => Promise<Accumul8StatementRestoreResponse>;
  onDeleteArchivedStatement: (id: number) => Promise<{ success: boolean; id: number }>;
  onConfirmImport: (payload: { id: number }) => Promise<{ success: boolean; upload: Accumul8StatementUpload; import_result: Accumul8StatementImportResult | null }>;
  onReconcile: (payload: { id: number }) => Promise<{ success: boolean; upload: Accumul8StatementUpload }>;
  onImportReviewRow: (payload: { id: number; row_index: number; transaction_date?: string; description?: string; memo?: string; amount?: number; account_id?: number | null }) => Promise<{ success: boolean; upload: Accumul8StatementUpload; transaction_id: number }>;
  onLinkReviewRow: (payload: { id: number; row_index: number; transaction_id: number }) => Promise<{ success: boolean; upload: Accumul8StatementUpload; linked_transaction_id: number }>;
  onSearch: (query: string) => Promise<Accumul8StatementSearchResult[]>;
  onAuditStatements: (payload: Accumul8StatementAuditRequest) => Promise<{ success: boolean; run: Accumul8StatementAuditRun }>;
  onAuditImportedCleanup: (payload?: { start_date?: string | null; end_date?: string | null; limit?: number }) => Promise<Accumul8ImportedTransactionCleanupReport | undefined>;
  onPurgeImportedCleanup: (transactionIds: number[]) => Promise<Accumul8ImportedTransactionCleanupPurgeResponse | undefined>;
  onPurgeAllImportedTransactions: () => Promise<Accumul8ImportedTransactionCleanupPurgeResponse | undefined>;
  onPurgeAllStatementUploads: () => Promise<{ success: boolean; deleted_count: number } | undefined>;
  onOpenTransaction: (id: number) => void;
  onDeleteTransaction: (id: number, description: string) => void;
}

export type CleanupMode = 'transactions' | 'files';

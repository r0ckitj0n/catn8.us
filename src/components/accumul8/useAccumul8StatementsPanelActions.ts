import React from 'react';
import {
  Accumul8ImportedTransactionCleanupReport,
  Accumul8StatementArchiveSection,
  Accumul8StatementSearchResult,
  Accumul8StatementAuditRun,
  Accumul8StatementImportResult,
  Accumul8StatementUpload,
} from '../../types/accumul8';
import { StatementHistoryPanel } from '../modals/Accumul8StatementHistoryCard';
import { StatementWorkspacePanel, StatementWorkspaceRow } from '../modals/accumul8StatementWorkspaceUtils';
import { CleanupMode } from './accumul8StatementsPanelTypes';
import { useAccumul8StatementsArchiveActions } from './useAccumul8StatementsArchiveActions';
import { useAccumul8StatementsCleanupActions } from './useAccumul8StatementsCleanupActions';

interface UseAccumul8StatementsPanelActionsArgs {
  files: File[];
  isAwaitingImportApproval: (upload: Accumul8StatementUpload) => boolean;
  onArchiveStatement: (payload: { id: number; archived_from_section?: Accumul8StatementArchiveSection }) => Promise<unknown>;
  onAuditImportedCleanup: (payload?: { start_date?: string | null; end_date?: string | null; limit?: number }) => Promise<Accumul8ImportedTransactionCleanupReport | undefined>;
  onAuditStatements: (payload: { start_date: string | null; end_date: string | null; auto_catalog_missing: boolean; auto_fix_ledger: boolean; force_rescan: boolean }) => Promise<{ success: boolean; run: Accumul8StatementAuditRun }>;
  onConfirmImport: (payload: { id: number }) => Promise<{ success: boolean; upload: Accumul8StatementUpload; import_result: Accumul8StatementImportResult | null }>;
  onDeleteArchivedStatement: (id: number) => Promise<unknown>;
  onImportReviewRow: (payload: { id: number; row_index: number; transaction_date?: string; description?: string; memo?: string; amount?: number; account_id?: number | null }) => Promise<unknown>;
  onLinkReviewRow: (payload: { id: number; row_index: number; transaction_id: number }) => Promise<unknown>;
  onPurgeAllImportedTransactions: () => Promise<unknown>;
  onPurgeAllStatementUploads: () => Promise<unknown>;
  onPurgeImportedCleanup: (transactionIds: number[]) => Promise<unknown>;
  onReconcile: (payload: { id: number }) => Promise<unknown>;
  onRescan: (id: number, accountId?: number | null) => Promise<unknown>;
  onRestoreStatement: (id: number) => Promise<{ restored_to_section: Accumul8StatementArchiveSection; upload: Accumul8StatementUpload }>;
  onSearch: (query: string) => Promise<Accumul8StatementSearchResult[]>;
  onUpload: (formData: FormData) => Promise<unknown>;
  pendingUploads: Accumul8StatementUpload[];
  searchQuery: string;
  setActiveSection: (section: 'inbox' | 'library' | 'search' | 'signals') => void;
  setArchiveDialogOpen: (open: boolean) => void;
  setAuditBusy: (busy: boolean) => void;
  setCleanupBusy: (busy: boolean) => void;
  setCleanupModalOpen: (open: boolean) => void;
  setCleanupMode: (mode: CleanupMode) => void;
  setCleanupReport: (report: Accumul8ImportedTransactionCleanupReport | null) => void;
  setCleanupSelectedIds: (ids: number[]) => void;
  setDismissedRowKeysByUpload: React.Dispatch<React.SetStateAction<Record<number, string[]>>>;
  setFiles: (files: File[]) => void;
  setLatestImportResult: (result: { uploadId: number; filename: string; result: Accumul8StatementImportResult | null } | null) => void;
  setSearchBusy: (busy: boolean) => void;
  setSearchResults: React.Dispatch<React.SetStateAction<Accumul8StatementSearchResult[]>>;
  setSelectedLibraryUploadId: (id: number | null) => void;
  setSelectedReviewUploadId: (id: number | null) => void;
  setSelectedSignalUploadId: (id: number | null) => void;
  setSelectedWorkspacePanel: (panel: StatementWorkspacePanel) => void;
  statementKind: string;
}

export function useAccumul8StatementsPanelActions(args: UseAccumul8StatementsPanelActionsArgs) {
  const {
    files,
    isAwaitingImportApproval,
    onArchiveStatement,
    onAuditImportedCleanup,
    onAuditStatements,
    onConfirmImport,
    onDeleteArchivedStatement,
    onImportReviewRow,
    onLinkReviewRow,
    onPurgeAllImportedTransactions,
    onPurgeAllStatementUploads,
    onPurgeImportedCleanup,
    onReconcile,
    onRescan,
    onRestoreStatement,
    onSearch,
    onUpload,
    pendingUploads,
    searchQuery,
    setActiveSection,
    setArchiveDialogOpen,
    setAuditBusy,
    setCleanupBusy,
    setCleanupModalOpen,
    setCleanupMode,
    setCleanupReport,
    setCleanupSelectedIds,
    setDismissedRowKeysByUpload,
    setFiles,
    setLatestImportResult,
    setSearchBusy,
    setSearchResults,
    setSelectedLibraryUploadId,
    setSelectedReviewUploadId,
    setSelectedSignalUploadId,
    setSelectedWorkspacePanel,
    statementKind,
  } = args;

  const cleanupActions = useAccumul8StatementsCleanupActions({
    onAuditImportedCleanup, onPurgeAllImportedTransactions, onPurgeAllStatementUploads, onPurgeImportedCleanup, setArchiveDialogOpen,
    setCleanupBusy, setCleanupMode, setCleanupModalOpen, setCleanupReport, setCleanupSelectedIds,
  });
  const archiveActions = useAccumul8StatementsArchiveActions({
    isAwaitingImportApproval, onArchiveStatement, onDeleteArchivedStatement, onRestoreStatement, setActiveSection, setArchiveDialogOpen,
    setSelectedLibraryUploadId, setSelectedReviewUploadId, setSelectedSignalUploadId, setSelectedWorkspacePanel,
  });

  const handleSubmit = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (files.length === 0) return;
    setLatestImportResult(null);
    for (const file of files) {
      const formData = new FormData();
      formData.append('statement_kind', statementKind || 'bank_account');
      formData.append('statement_file', file);
      await onUpload(formData);
    }
    setFiles([]);
  }, [files, onUpload, setFiles, setLatestImportResult, statementKind]);

  const handleSearch = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return setSearchResults([]);
    setSearchBusy(true);
    try { setSearchResults(await onSearch(query)); } finally { setSearchBusy(false); }
  }, [onSearch, searchQuery, setSearchBusy, setSearchResults]);

  const handleConfirmImport = React.useCallback(async (upload: Accumul8StatementUpload) => {
    const response = await onConfirmImport({ id: upload.id });
    setLatestImportResult({ uploadId: upload.id, filename: upload.original_filename, result: response.import_result });
  }, [onConfirmImport, setLatestImportResult]);

  const handleReconcile = React.useCallback(async (upload: Accumul8StatementUpload) => {
    await onReconcile({ id: upload.id });
    setSelectedWorkspacePanel('reconciliation');
  }, [onReconcile, setSelectedWorkspacePanel]);

  const openReview = React.useCallback((uploadId: number) => {
    setActiveSection('inbox');
    setSelectedReviewUploadId(uploadId);
    setSelectedWorkspacePanel('review');
  }, [setActiveSection, setSelectedReviewUploadId, setSelectedWorkspacePanel]);

  const openWorkspace = React.useCallback((uploadId: number, panel: Exclude<StatementHistoryPanel, 'status' | null>) => {
    setActiveSection('inbox');
    setSelectedReviewUploadId(uploadId);
    setSelectedWorkspacePanel(panel === 'reconciliation' || panel === 'suspicious' || panel === 'imported' || panel === 'duplicates' || panel === 'failed' || panel === 'review' ? panel : 'review');
  }, [setActiveSection, setSelectedReviewUploadId, setSelectedWorkspacePanel]);

  const dismissWorkspaceRow = React.useCallback((uploadId: number, key: string) => {
    setDismissedRowKeysByUpload((prev) => ({ ...prev, [uploadId]: Array.from(new Set([...(prev[uploadId] || []), key])) }));
  }, [setDismissedRowKeysByUpload]);

  const acceptWorkspaceRow = React.useCallback(async (upload: Accumul8StatementUpload, row: StatementWorkspaceRow) => {
    const nextDescription = window.prompt('Description', row.description || '');
    if (nextDescription === null) return;
    const nextDate = window.prompt('Transaction date (YYYY-MM-DD)', row.transaction_date || '') || row.transaction_date || '';
    const nextAmountRaw = window.prompt('Amount', row.amount !== undefined ? String(row.amount) : '');
    if (nextAmountRaw === null) return;
    const nextAmount = Number(nextAmountRaw);
    if (!Number.isFinite(nextAmount)) return;
    const nextMemo = window.prompt('Memo', row.memo || '') || row.memo || '';
    await onImportReviewRow({ id: upload.id, row_index: row.row_index, transaction_date: nextDate, description: nextDescription, memo: nextMemo, amount: nextAmount });
  }, [onImportReviewRow]);

  const linkWorkspaceRow = React.useCallback(async (upload: Accumul8StatementUpload, row: StatementWorkspaceRow, transactionId: number | null) => {
    if (!transactionId) return;
    await onLinkReviewRow({ id: upload.id, row_index: row.row_index, transaction_id: transactionId });
  }, [onLinkReviewRow]);

  const handleBatchProcessInbox = React.useCallback(async () => {
    if (pendingUploads.length === 0 || !window.confirm(`Process ${pendingUploads.length} inbox statement(s) by re-scan, reconcile, and approve/import in order?`)) return;
    for (const uploadId of pendingUploads.map((upload) => upload.id)) {
      await onRescan(uploadId, null);
      await onReconcile({ id: uploadId });
      await onConfirmImport({ id: uploadId });
    }
  }, [onConfirmImport, onReconcile, onRescan, pendingUploads]);

  const handleAuditStatements = React.useCallback(async () => {
    const startDate = window.prompt('Audit start date (YYYY-MM-DD, optional)', '') || '';
    if (startDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return;
    const endDate = window.prompt('Audit end date (YYYY-MM-DD, optional)', '') || '';
    if (endDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return;
    setAuditBusy(true);
    try {
      const response = await onAuditStatements({ start_date: startDate || null, end_date: endDate || null, auto_catalog_missing: true, auto_fix_ledger: true, force_rescan: false });
      window.alert(response.run.summary_text);
    } finally { setAuditBusy(false); }
  }, [onAuditStatements, setAuditBusy]);

  return {
    acceptWorkspaceRow,
    archiveActiveReviewUpload: archiveActions.archiveActiveReviewUpload,
    deleteArchivedUpload: archiveActions.deleteArchivedUpload,
    dismissWorkspaceRow,
    handleAuditImportedCleanup: cleanupActions.handleAuditImportedCleanup,
    handleAuditStatements,
    handleBatchProcessInbox,
    handleConfirmImport,
    handlePurgeAllImportedTransactions: cleanupActions.handlePurgeAllImportedTransactions,
    handlePurgeAllStatementUploads: cleanupActions.handlePurgeAllStatementUploads,
    handlePurgeImportedCleanup: cleanupActions.handlePurgeImportedCleanup,
    handleReconcile,
    handleSearch,
    handleSubmit,
    linkWorkspaceRow,
    openReview,
    openWorkspace,
    restoreArchivedUpload: archiveActions.restoreArchivedUpload,
  };
}

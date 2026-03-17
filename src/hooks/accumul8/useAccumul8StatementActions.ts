import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import {
  Accumul8ImportedTransactionCleanupAuditResponse,
  Accumul8ImportedTransactionCleanupPurgeResponse,
  Accumul8StatementArchiveRequest,
  Accumul8StatementArchiveResponse,
  Accumul8StatementAuditRequest,
  Accumul8StatementAuditResponse,
  Accumul8StatementDeleteArchivedResponse,
  Accumul8StatementImportResult,
  Accumul8StatementRestoreResponse,
  Accumul8StatementSearchResult,
  Accumul8StatementUpload,
} from '../../types/accumul8';

export function useAccumul8StatementActions(args: {
  setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  load: () => Promise<void>;
  loadStatementWorkspace: () => Promise<any>;
  handleError: (error: any, fallback?: string) => void;
  onToast?: (payload: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  scopedActionUrl: (action: string) => string;
  isTellerRateLimitError: (error: unknown) => boolean;
}) {
  const { setBusy, load, loadStatementWorkspace, handleError, onToast, scopedActionUrl, isTellerRateLimitError } = args;

  const syncBankConnection = React.useCallback(async (connectionId: number) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<any>(scopedActionUrl('teller_sync_transactions'), { connection_id: connectionId });
      if (onToast) onToast({ tone: 'success', message: `Synced bank transactions (added ${Number(res?.added || 0)}).` });
      await load();
      return res;
    } catch (error: any) {
      if (isTellerRateLimitError(error) && onToast) {
        onToast({ tone: 'warning', message: 'Teller asked us to wait before syncing again. Give it a little time, then retry.' });
      } else {
        handleError(error, 'Bank sync failed');
      }
    } finally {
      setBusy(false);
    }
  }, [handleError, isTellerRateLimitError, load, onToast, scopedActionUrl, setBusy]);

  const withStatementReload = React.useCallback(async <T,>(action: () => Promise<T>, successMessage: string, fallback: string) => {
    setBusy(true);
    try {
      const res = await action();
      await Promise.all([load(), loadStatementWorkspace()]);
      onToast?.({ tone: 'success', message: successMessage });
      return res;
    } catch (error: any) {
      handleError(error, fallback);
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, loadStatementWorkspace, onToast, setBusy]);

  const uploadStatement = React.useCallback(async (formData: FormData) => {
    setBusy(true);
    try {
      const res = await ApiClient.postFormData<{ success: boolean; upload: Accumul8StatementUpload }>(scopedActionUrl('upload_statement'), formData);
      await Promise.all([load(), loadStatementWorkspace()]);
      onToast?.({ tone: 'success', message: 'Statement scanned. Review the import plan before approving.' });
      return res?.upload;
    } catch (error: any) {
      if (Number(error?.status || 0) === 409 && Number(error?.payload?.duplicate ? 1 : 0) === 1) {
        const statementFile = formData.get('statement_file');
        const fallbackName = statementFile instanceof File ? statementFile.name : '';
        const existingName = String(error?.payload?.existing_upload?.original_filename || fallbackName);
        onToast?.({ tone: 'warning', message: existingName ? `Upload canceled because "${existingName}" is a duplicate statement.` : 'Upload canceled because this statement was already uploaded.' });
        return;
      }
      handleError(error, 'Failed to upload statement');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, loadStatementWorkspace, onToast, scopedActionUrl, setBusy]);

  const rescanStatementUpload = React.useCallback(async (id: number, accountId?: number | null) => {
    const res = await withStatementReload(
      () => ApiClient.post<{ success: boolean; upload: Accumul8StatementUpload }>(scopedActionUrl('rescan_statement_upload'), { id, account_id: accountId || null }),
      'Statement rescanned. Review the refreshed import plan.',
      'Failed to rescan statement',
    );
    return res?.upload;
  }, [scopedActionUrl, withStatementReload]);

  const updateStatementUploadMetadata = React.useCallback(async (payload: { id: number; statement_kind?: string; account_name_hint?: string; account_last4?: string }) => {
    const res = await withStatementReload(
      () => ApiClient.post<{ success: boolean; upload: Accumul8StatementUpload }>(scopedActionUrl('update_statement_upload_metadata'), payload),
      'Statement metadata updated.',
      'Failed to update statement metadata',
    );
    return res;
  }, [scopedActionUrl, withStatementReload]);

  const archiveStatementUpload = React.useCallback(async (payload: Accumul8StatementArchiveRequest) => withStatementReload(
    () => ApiClient.post<Accumul8StatementArchiveResponse>(scopedActionUrl('archive_statement_upload'), payload),
    'Statement moved to the archive.',
    'Failed to archive statement',
  ), [scopedActionUrl, withStatementReload]);

  const restoreStatementUpload = React.useCallback(async (id: number) => withStatementReload(
    () => ApiClient.post<Accumul8StatementRestoreResponse>(scopedActionUrl('restore_statement_upload'), { id }),
    'Statement restored from the archive.',
    'Failed to restore statement',
  ), [scopedActionUrl, withStatementReload]);

  const deleteArchivedStatementUpload = React.useCallback(async (id: number) => withStatementReload(
    () => ApiClient.post<Accumul8StatementDeleteArchivedResponse>(scopedActionUrl('delete_archived_statement_upload'), { id }),
    'Archived statement deleted permanently.',
    'Failed to delete archived statement',
  ), [scopedActionUrl, withStatementReload]);

  const confirmStatementImport = React.useCallback(async (payload: { id: number; account_id?: number | null; create_account?: { banking_organization_name?: string; account_name: string; account_type?: string; institution_name?: string; mask_last4?: string } | null }) => withStatementReload(
    () => ApiClient.post<{ success: boolean; upload: Accumul8StatementUpload; import_result: Accumul8StatementImportResult | null }>(scopedActionUrl('confirm_statement_import'), payload),
    'Statement import finished. Review imported, skipped, and failed rows below.',
    'Failed to import statement',
  ), [scopedActionUrl, withStatementReload]);

  const reconcileStatementUpload = React.useCallback(async (payload: { id: number; account_id?: number | null; create_account?: { banking_organization_name?: string; account_name: string; account_type?: string; institution_name?: string; mask_last4?: string } | null }) => withStatementReload(
    () => ApiClient.post<{ success: boolean; upload: Accumul8StatementUpload }>(scopedActionUrl('reconcile_statement_upload'), payload),
    'Statement reconciliation finished. Review the reconciliation panel for the action log.',
    'Failed to reconcile statement',
  ), [scopedActionUrl, withStatementReload]);

  const importStatementReviewRow = React.useCallback(async (payload: { id: number; row_index: number; transaction_date?: string; description?: string; memo?: string; amount?: number; account_id?: number | null }) => withStatementReload(
    () => ApiClient.post<{ success: boolean; upload: Accumul8StatementUpload; transaction_id: number }>(scopedActionUrl('import_statement_review_row'), payload),
    'Statement row accepted into the ledger.',
    'Failed to accept statement row',
  ), [scopedActionUrl, withStatementReload]);

  const linkStatementReviewRow = React.useCallback(async (payload: { id: number; row_index: number; transaction_id: number }) => withStatementReload(
    () => ApiClient.post<{ success: boolean; upload: Accumul8StatementUpload; linked_transaction_id: number }>(scopedActionUrl('link_statement_review_row'), payload),
    'Ledger entry linked to statement row.',
    'Failed to link ledger entry to statement row',
  ), [scopedActionUrl, withStatementReload]);

  const searchStatementUploads = React.useCallback(async (query: string) => {
    const normalized = String(query || '').trim();
    if (!normalized) return [] as Accumul8StatementSearchResult[];
    try {
      const res = await ApiClient.get<{ success: boolean; results: Accumul8StatementSearchResult[] }>(`${scopedActionUrl('search_statement_uploads')}&q=${encodeURIComponent(normalized)}`);
      return Array.isArray(res?.results) ? res.results : [];
    } catch (error: any) {
      handleError(error, 'Failed to search bank statements');
      throw error;
    }
  }, [handleError, scopedActionUrl]);

  const auditStatementUploads = React.useCallback(async (payload: Accumul8StatementAuditRequest) => withStatementReload(
    () => ApiClient.post<Accumul8StatementAuditResponse>(scopedActionUrl('audit_statement_uploads'), payload),
    'Statement audit finished. Missing catalogs were refreshed and deterministic ledger fixes were applied where possible.',
    'Failed to audit bank statements',
  ), [scopedActionUrl, withStatementReload]);

  const auditImportedTransactionCleanup = React.useCallback(async (payload?: { start_date?: string | null; end_date?: string | null; limit?: number }) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Accumul8ImportedTransactionCleanupAuditResponse>(scopedActionUrl('audit_imported_transaction_cleanup'), payload || {});
      return res?.report;
    } catch (error: any) {
      handleError(error, 'Failed to audit imported transaction cleanup candidates');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, scopedActionUrl, setBusy]);

  const purgeImportedTransactionCleanup = React.useCallback(async (transactionIds: number[]) => withStatementReload(
    () => ApiClient.post<Accumul8ImportedTransactionCleanupPurgeResponse>(scopedActionUrl('purge_imported_transaction_cleanup'), { transaction_ids: transactionIds }),
    'Purged imported transaction cleanup results.',
    'Failed to purge imported transactions',
  ), [scopedActionUrl, withStatementReload]);

  const purgeAllImportedStatementTransactions = React.useCallback(async () => withStatementReload(
    () => ApiClient.post<Accumul8ImportedTransactionCleanupPurgeResponse>(scopedActionUrl('purge_all_imported_statement_transactions'), {}),
    'Purged bank-statement transactions.',
    'Failed to purge bank-statement transactions',
  ), [scopedActionUrl, withStatementReload]);

  const purgeAllStatementUploads = React.useCallback(async () => withStatementReload(
    () => ApiClient.post<{ success: boolean; deleted_count: number }>(scopedActionUrl('purge_all_statement_uploads'), {}),
    'Deleted all bank statement files.',
    'Failed to purge bank statement files',
  ), [scopedActionUrl, withStatementReload]);

  return {
    syncBankConnection,
    uploadStatement,
    rescanStatementUpload,
    updateStatementUploadMetadata,
    archiveStatementUpload,
    restoreStatementUpload,
    deleteArchivedStatementUpload,
    confirmStatementImport,
    reconcileStatementUpload,
    importStatementReviewRow,
    linkStatementReviewRow,
    searchStatementUploads,
    auditStatementUploads,
    auditImportedTransactionCleanup,
    purgeImportedTransactionCleanup,
    purgeAllImportedStatementTransactions,
    purgeAllStatementUploads,
  };
}

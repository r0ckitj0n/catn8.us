import React from 'react';

import { Accumul8ImportedTransactionCleanupReport } from '../../types/accumul8';
import { CleanupMode } from './accumul8StatementsPanelTypes';

interface UseAccumul8StatementsCleanupActionsArgs {
  onAuditImportedCleanup: (payload?: { start_date?: string | null; end_date?: string | null; limit?: number }) => Promise<Accumul8ImportedTransactionCleanupReport | undefined>;
  onPurgeAllImportedTransactions: () => Promise<unknown>;
  onPurgeAllStatementUploads: () => Promise<unknown>;
  onPurgeImportedCleanup: (transactionIds: number[]) => Promise<unknown>;
  setArchiveDialogOpen: (open: boolean) => void;
  setCleanupBusy: (busy: boolean) => void;
  setCleanupMode: (mode: CleanupMode) => void;
  setCleanupModalOpen: (open: boolean) => void;
  setCleanupReport: (report: Accumul8ImportedTransactionCleanupReport | null) => void;
  setCleanupSelectedIds: (ids: number[]) => void;
}

export function useAccumul8StatementsCleanupActions({
  onAuditImportedCleanup,
  onPurgeAllImportedTransactions,
  onPurgeAllStatementUploads,
  onPurgeImportedCleanup,
  setArchiveDialogOpen,
  setCleanupBusy,
  setCleanupMode,
  setCleanupModalOpen,
  setCleanupReport,
  setCleanupSelectedIds,
}: UseAccumul8StatementsCleanupActionsArgs) {
  const handleAuditImportedCleanup = React.useCallback(async () => {
    setCleanupBusy(true);
    setCleanupMode('transactions');
    try {
      const report = await onAuditImportedCleanup({ limit: 1000 });
      setCleanupReport(report || null);
      setCleanupSelectedIds((report?.candidates || []).filter((candidate) => Number(candidate.safe_to_purge || 0) === 1).map((candidate) => candidate.transaction_id));
      setCleanupModalOpen(true);
    } finally {
      setCleanupBusy(false);
    }
  }, [onAuditImportedCleanup, setCleanupBusy, setCleanupMode, setCleanupModalOpen, setCleanupReport, setCleanupSelectedIds]);

  const handlePurgeImportedCleanup = React.useCallback(async (cleanupSelectedIds: number[]) => {
    if (cleanupSelectedIds.length === 0 || !window.confirm(`Purge ${cleanupSelectedIds.length} imported transaction${cleanupSelectedIds.length === 1 ? '' : 's'} from the ledger?`)) return;
    setCleanupBusy(true);
    setCleanupMode('transactions');
    try {
      await onPurgeImportedCleanup(cleanupSelectedIds);
      const report = await onAuditImportedCleanup({ limit: 1000 });
      setCleanupReport(report || null);
      setCleanupSelectedIds((report?.candidates || []).filter((candidate) => Number(candidate.safe_to_purge || 0) === 1).map((candidate) => candidate.transaction_id));
      if (!report || report.candidates.length === 0) setCleanupModalOpen(false);
    } finally {
      setCleanupBusy(false);
    }
  }, [onAuditImportedCleanup, onPurgeImportedCleanup, setCleanupBusy, setCleanupMode, setCleanupModalOpen, setCleanupReport, setCleanupSelectedIds]);

  const handlePurgeAllImportedTransactions = React.useCallback(async () => {
    if (!window.confirm('Purge every ledger transaction that came from a bank statement import for this owner? This will leave the statement files in place, but remove all imported statement rows from the ledger.')) return;
    setCleanupBusy(true);
    setCleanupMode('transactions');
    try {
      await onPurgeAllImportedTransactions();
      setCleanupReport(null);
      setCleanupSelectedIds([]);
      setCleanupModalOpen(false);
    } finally {
      setCleanupBusy(false);
    }
  }, [onPurgeAllImportedTransactions, setCleanupBusy, setCleanupMode, setCleanupModalOpen, setCleanupReport, setCleanupSelectedIds]);

  const handlePurgeAllStatementUploads = React.useCallback(async () => {
    if (!window.confirm('Delete every saved bank statement file for this owner? Imported statement ledger rows are already gone, so this will clear the statement library and free up space.')) return;
    setCleanupBusy(true);
    setCleanupMode('files');
    try {
      await onPurgeAllStatementUploads();
      setCleanupReport(null);
      setCleanupSelectedIds([]);
      setCleanupModalOpen(false);
      setArchiveDialogOpen(false);
    } finally {
      setCleanupBusy(false);
    }
  }, [onPurgeAllStatementUploads, setArchiveDialogOpen, setCleanupBusy, setCleanupMode, setCleanupModalOpen, setCleanupReport, setCleanupSelectedIds]);

  return {
    handleAuditImportedCleanup,
    handlePurgeAllImportedTransactions,
    handlePurgeAllStatementUploads,
    handlePurgeImportedCleanup,
  };
}

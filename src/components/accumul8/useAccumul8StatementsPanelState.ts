import React from 'react';

import {
  Accumul8StatementAuditRun,
  Accumul8ImportedTransactionCleanupReport,
  Accumul8StatementImportResult,
  Accumul8StatementKind,
  Accumul8StatementSearchResult,
  Accumul8StatementUpload,
  Accumul8Transaction,
} from '../../types/accumul8';
import {
  buildWorkspace,
  getStatementSortDate,
  matchesLibraryFilter,
  StatementLibraryFilter,
  StatementModalSection,
  StatementWorkspaceData,
  StatementWorkspacePanel,
} from '../modals/accumul8StatementWorkspaceUtils';
import { CleanupMode } from './accumul8StatementsPanelTypes';
import { useAccumul8StatementsPanelSelectionSync } from './useAccumul8StatementsPanelSelectionSync';

const DEFAULT_KIND: Accumul8StatementKind = 'bank_account';

interface UseAccumul8StatementsPanelStateArgs {
  ownerUserId: number;
  statementAuditRuns: Accumul8StatementAuditRun[];
  statementUploads: Accumul8StatementUpload[];
  transactions: Accumul8Transaction[];
}

export function useAccumul8StatementsPanelState({
  ownerUserId,
  statementAuditRuns,
  statementUploads,
  transactions,
}: UseAccumul8StatementsPanelStateArgs) {
  const [auditBusy, setAuditBusy] = React.useState(false);
  const [cleanupBusy, setCleanupBusy] = React.useState(false);
  const [cleanupMode, setCleanupMode] = React.useState<CleanupMode>('transactions');
  const [statementKind, setStatementKind] = React.useState<Accumul8StatementKind | ''>('');
  const [files, setFiles] = React.useState<File[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchBusy, setSearchBusy] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<Accumul8StatementSearchResult[]>([]);
  const [latestImportResult, setLatestImportResult] = React.useState<{ uploadId: number; filename: string; result: Accumul8StatementImportResult | null } | null>(null);
  const [selectedReviewUploadId, setSelectedReviewUploadId] = React.useState<number | null>(null);
  const [activeSection, setActiveSection] = React.useState<StatementModalSection>('inbox');
  const [selectedWorkspacePanel, setSelectedWorkspacePanel] = React.useState<StatementWorkspacePanel>('review');
  const [selectedLibraryUploadId, setSelectedLibraryUploadId] = React.useState<number | null>(null);
  const [selectedSignalUploadId, setSelectedSignalUploadId] = React.useState<number | null>(null);
  const [cleanupModalOpen, setCleanupModalOpen] = React.useState(false);
  const [cleanupReport, setCleanupReport] = React.useState<Accumul8ImportedTransactionCleanupReport | null>(null);
  const [cleanupSelectedIds, setCleanupSelectedIds] = React.useState<number[]>([]);
  const [archiveDialogOpen, setArchiveDialogOpen] = React.useState(false);
  const [libraryFilter, setLibraryFilter] = React.useState<StatementLibraryFilter>('all');
  const [libraryQuery, setLibraryQuery] = React.useState('');
  const [dismissedRowKeysByUpload, setDismissedRowKeysByUpload] = React.useState<Record<number, string[]>>({});

  React.useEffect(() => {
    setStatementKind('');
    setFiles([]);
    setSearchQuery('');
    setSearchResults([]);
    setLatestImportResult(null);
    setSelectedReviewUploadId(null);
    setActiveSection('inbox');
    setSelectedWorkspacePanel('review');
    setSelectedLibraryUploadId(null);
    setSelectedSignalUploadId(null);
    setCleanupModalOpen(false);
    setCleanupReport(null);
    setCleanupSelectedIds([]);
    setCleanupMode('transactions');
    setArchiveDialogOpen(false);
    setLibraryFilter('all');
    setLibraryQuery('');
    setDismissedRowKeysByUpload({});
  }, [ownerUserId]);

  const transactionsById = React.useMemo(() => transactions.reduce<Record<number, Accumul8Transaction>>((acc, tx) => {
    acc[tx.id] = tx;
    return acc;
  }, {}), [transactions]);

  const isAwaitingImportApproval = React.useCallback((upload: Accumul8StatementUpload) => Boolean(
    upload.plan
    && !String(upload.processed_at || '').trim()
    && (upload.status === 'scanned' || upload.status === 'needs_review' || upload.status === 'failed')
  ), []);

  const pendingUploads = React.useMemo(() => statementUploads.filter((upload) => isAwaitingImportApproval(upload)), [isAwaitingImportApproval, statementUploads]);
  const sortedStatementUploads = React.useMemo(() => [...statementUploads].sort((a, b) => getStatementSortDate(b).localeCompare(getStatementSortDate(a)) || b.id - a.id), [statementUploads]);
  const workspaceByUploadId = React.useMemo(() => statementUploads.reduce<Record<number, StatementWorkspaceData>>((acc, upload) => {
    acc[upload.id] = buildWorkspace(upload, transactions, new Set<string>(dismissedRowKeysByUpload[upload.id] || []));
    return acc;
  }, {}), [dismissedRowKeysByUpload, statementUploads, transactions]);
  const activeReviewUpload = React.useMemo(() => pendingUploads.find((upload) => upload.id === selectedReviewUploadId) || pendingUploads[0] || null, [pendingUploads, selectedReviewUploadId]);
  const activeWorkspace = React.useMemo(() => (activeReviewUpload ? workspaceByUploadId[activeReviewUpload.id] || null : null), [activeReviewUpload, workspaceByUploadId]);
  const latestAuditRun = React.useMemo(() => statementAuditRuns[0] || null, [statementAuditRuns]);
  const recommendedCleanupIds = React.useMemo(() => (
    cleanupReport?.candidates.filter((candidate) => Number(candidate.safe_to_purge || 0) === 1).map((candidate) => candidate.transaction_id) || []
  ), [cleanupReport]);
  const filteredLibraryUploads = React.useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    return sortedStatementUploads.filter((upload) => {
      const workspace = workspaceByUploadId[upload.id];
      if (!workspace || !matchesLibraryFilter(upload, workspace, libraryFilter)) return false;
      if (!query) return true;
      return [
        upload.original_filename,
        upload.account_name,
        upload.account_name_hint,
        upload.institution_name,
        upload.banking_organization_name,
        upload.period_start,
        upload.period_end,
        upload.status,
      ].join(' ').toLowerCase().includes(query);
    });
  }, [libraryFilter, libraryQuery, sortedStatementUploads, workspaceByUploadId]);
  const selectedLibraryUpload = React.useMemo(() => filteredLibraryUploads.find((upload) => upload.id === selectedLibraryUploadId)
    || sortedStatementUploads.find((upload) => upload.id === selectedLibraryUploadId)
    || filteredLibraryUploads[0]
    || sortedStatementUploads[0]
    || null, [filteredLibraryUploads, selectedLibraryUploadId, sortedStatementUploads]);
  const selectedLibraryWorkspace = React.useMemo(() => (selectedLibraryUpload ? workspaceByUploadId[selectedLibraryUpload.id] || null : null), [selectedLibraryUpload, workspaceByUploadId]);
  const signalUploads = React.useMemo(() => sortedStatementUploads.filter((upload) => {
    const workspace = workspaceByUploadId[upload.id];
    return Boolean(workspace && (workspace.failed.length > 0 || workspace.suspicious.length > 0));
  }), [sortedStatementUploads, workspaceByUploadId]);
  const selectedSignalUpload = React.useMemo(() => signalUploads.find((upload) => upload.id === selectedSignalUploadId)
    || sortedStatementUploads.find((upload) => upload.id === selectedSignalUploadId)
    || signalUploads[0]
    || null, [selectedSignalUploadId, signalUploads, sortedStatementUploads]);
  const selectedSignalWorkspace = React.useMemo(() => (selectedSignalUpload ? workspaceByUploadId[selectedSignalUpload.id] || null : null), [selectedSignalUpload, workspaceByUploadId]);
  const overview = React.useMemo(() => ({
    review: pendingUploads.length,
    imported: statementUploads.reduce((sum, upload) => sum + (workspaceByUploadId[upload.id]?.imported.length || upload.imported_transaction_count || 0), 0),
    failed: statementUploads.reduce((sum, upload) => sum + (workspaceByUploadId[upload.id]?.failed.length || 0), 0),
    suspicious: statementUploads.reduce((sum, upload) => sum + (workspaceByUploadId[upload.id]?.suspicious.length || 0), 0),
  }), [pendingUploads.length, statementUploads, workspaceByUploadId]);

  useAccumul8StatementsPanelSelectionSync({
    filteredLibraryUploads,
    pendingUploads,
    selectedLibraryUploadId,
    selectedReviewUploadId,
    selectedSignalUploadId,
    setSelectedLibraryUploadId,
    setSelectedReviewUploadId,
    setSelectedSignalUploadId,
    signalUploads,
    sortedStatementUploads,
  });

  return {
    activeReviewUpload,
    activeSection,
    activeWorkspace,
    archiveDialogOpen,
    auditBusy,
    cleanupBusy,
    cleanupModalOpen,
    cleanupMode,
    cleanupReport,
    cleanupSelectedIds,
    dismissedRowKeysByUpload,
    files,
    filteredLibraryUploads,
    isAwaitingImportApproval,
    latestAuditRun,
    latestImportResult,
    libraryFilter,
    libraryQuery,
    overview,
    pendingUploads,
    recommendedCleanupIds,
    searchBusy,
    searchQuery,
    searchResults,
    selectedLibraryUpload,
    selectedLibraryUploadId,
    selectedLibraryWorkspace,
    selectedReviewUploadId,
    selectedSignalUpload,
    selectedSignalUploadId,
    selectedSignalWorkspace,
    selectedWorkspacePanel,
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
    setLibraryFilter,
    setLibraryQuery,
    setSearchBusy,
    setSearchQuery,
    setSearchResults,
    setSelectedLibraryUploadId,
    setSelectedReviewUploadId,
    setSelectedSignalUploadId,
    setSelectedWorkspacePanel,
    setStatementKind,
    signalUploads,
    statementKind,
    transactionsById,
    workspaceByUploadId,
  };
}

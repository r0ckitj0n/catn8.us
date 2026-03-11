import React from 'react';
import {
  Accumul8Account,
  Accumul8BankingOrganization,
  Accumul8StatementImportResult,
  Accumul8StatementImportResultRow,
  Accumul8StatementKind,
  Accumul8StatementSearchResult,
  Accumul8StatementUpload,
  Accumul8Transaction,
} from '../../types/accumul8';
import { Accumul8ModalHelp } from '../modals/Accumul8ModalHelp';
import { WebpImage } from '../common/WebpImage';
import { Accumul8StatementHistoryCard, Accumul8StatementSearchResultCard, StatementHistoryPanel } from '../modals/Accumul8StatementHistoryCard';
import { Accumul8StatementNewAccountDraft, Accumul8StatementPlanCard } from '../modals/Accumul8StatementPlanCard';
import { createStatementNewAccountDraft, formatStatementDateRange, formatStatementFileSize } from '../modals/accumul8StatementUtils';
import './Accumul8StatementsPanel.css';

interface Accumul8StatementsPanelProps {
  busy: boolean;
  accounts: Accumul8Account[];
  bankingOrganizations: Accumul8BankingOrganization[];
  statementUploads: Accumul8StatementUpload[];
  transactions: Accumul8Transaction[];
  ownerUserId: number;
  onUpload: (formData: FormData) => Promise<Accumul8StatementUpload | undefined>;
  onRescan: (id: number, accountId?: number | null) => Promise<Accumul8StatementUpload | undefined>;
  onConfirmImport: (payload: {
    id: number;
    account_id?: number | null;
    create_account?: Accumul8StatementNewAccountDraft | null;
  }) => Promise<{ success: boolean; upload: Accumul8StatementUpload; import_result: Accumul8StatementImportResult | null }>;
  onImportReviewRow: (payload: {
    id: number;
    row_index: number;
    transaction_date?: string;
    description?: string;
    memo?: string;
    amount?: number;
    account_id?: number | null;
  }) => Promise<{ success: boolean; upload: Accumul8StatementUpload; transaction_id: number }>;
  onLinkReviewRow: (payload: {
    id: number;
    row_index: number;
    transaction_id: number;
  }) => Promise<{ success: boolean; upload: Accumul8StatementUpload; linked_transaction_id: number }>;
  onSearch: (query: string) => Promise<Accumul8StatementSearchResult[]>;
  onOpenTransaction: (id: number) => void;
  onDeleteTransaction: (id: number, description: string) => void;
}
const DEFAULT_KIND: Accumul8StatementKind = 'bank_account';

type StatementModalSection = 'inbox' | 'library' | 'search' | 'signals';
type StatementLibraryFilter = 'all' | 'review' | 'processed' | 'failed' | 'suspicious';
type StatementWorkspacePanel = 'review' | 'imported' | 'duplicates' | 'failed' | 'suspicious' | 'reconciliation';

interface StatementWorkspaceRow extends Accumul8StatementImportResultRow {
  row_index: number;
  row_key: string;
  matchedTransactionId: number | null;
  linkedTransactionId: number | null;
}

interface StatementWorkspaceData {
  review: StatementWorkspaceRow[];
  imported: StatementWorkspaceRow[];
  duplicates: StatementWorkspaceRow[];
  failed: StatementWorkspaceRow[];
  suspicious: StatementWorkspaceRow[];
}

interface StatementPickerItemProps {
  upload: Accumul8StatementUpload;
  active: boolean;
  reviewCount: number;
  failedCount: number;
  suspiciousCount: number;
  onClick: () => void;
}

function rowKey(uploadId: number, rowIndex: number): string {
  return `${uploadId}:${rowIndex}`;
}

function amountsMatch(a: number | undefined, b: number | undefined): boolean {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= 0.01;
}

function getStatementSortDate(upload: Accumul8StatementUpload): string {
  return upload.period_end || upload.last_scanned_at || upload.processed_at || upload.created_at || '';
}

function matchesLibraryFilter(
  upload: Accumul8StatementUpload,
  workspace: StatementWorkspaceData,
  filter: StatementLibraryFilter,
): boolean {
  if (filter === 'review') return workspace.review.length > 0;
  if (filter === 'processed') return upload.imported_transaction_count > 0 || workspace.imported.length > 0;
  if (filter === 'failed') return workspace.failed.length > 0 || Boolean(upload.last_error);
  if (filter === 'suspicious') return workspace.suspicious.length > 0;
  return true;
}

function StatementPickerItem({
  upload,
  active,
  reviewCount,
  failedCount,
  suspiciousCount,
  onClick,
}: StatementPickerItemProps) {
  return (
    <button
      type="button"
      className={`accumul8-statement-picker-item${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <div className="accumul8-statement-picker-item-head">
        <strong>{upload.original_filename}</strong>
        <span className={`accumul8-statement-chip is-${upload.status}`}>{upload.status}</span>
      </div>
      <div className="small text-muted">
        {[upload.account_name || upload.account_name_hint || 'Unmatched account', formatStatementDateRange(upload)].filter(Boolean).join(' · ')}
      </div>
      <div className="accumul8-statement-picker-meta">
        {reviewCount > 0 ? <span className="accumul8-statement-chip is-warning">{reviewCount} review</span> : null}
        {upload.imported_transaction_count > 0 ? <span className="accumul8-statement-chip is-processed">{upload.imported_transaction_count} imported</span> : null}
        {failedCount > 0 ? <span className="accumul8-statement-chip is-warning">{failedCount} failed</span> : null}
        {suspiciousCount > 0 ? <span className="accumul8-statement-chip is-warning">{suspiciousCount} suspicious</span> : null}
      </div>
    </button>
  );
}

function buildWorkspace(
  upload: Accumul8StatementUpload,
  transactions: Accumul8Transaction[],
  selectedAccountId: number | null,
  dismissedKeys: Set<string>,
): StatementWorkspaceData {
  const importedCandidates = transactions.filter((tx) => tx.source_ref === `statement_upload:${upload.id}`);
  const duplicateCandidates = selectedAccountId
    ? transactions.filter((tx) => Number(tx.account_id || 0) === selectedAccountId)
    : [];

  const imported: StatementWorkspaceRow[] = [];
  const duplicates: StatementWorkspaceRow[] = [];
  const failed: StatementWorkspaceRow[] = [];
  const review: StatementWorkspaceRow[] = [];

  upload.review_rows.forEach((row, fallbackIndex) => {
    const rowIndex = Number(row.row_index ?? fallbackIndex);
    const key = rowKey(upload.id, rowIndex);
    if (dismissedKeys.has(key)) {
      return;
    }

    const linked = importedCandidates.find((tx) => (
      String(tx.transaction_date || '') === String(row.transaction_date || '')
      && String(tx.description || '').trim() === String(row.description || '').trim()
      && amountsMatch(tx.amount, row.amount)
    )) || null;
    const duplicate = !linked ? duplicateCandidates.find((tx) => (
      String(tx.transaction_date || '') === String(row.transaction_date || '')
      && String(tx.description || '').trim() === String(row.description || '').trim()
      && amountsMatch(tx.amount, row.amount)
    )) || null : null;
    const workspaceRow: StatementWorkspaceRow = {
      ...row,
      row_index: rowIndex,
      row_key: key,
      linkedTransactionId: linked?.id ?? null,
      matchedTransactionId: duplicate?.id ?? null,
    };

    if (linked) {
      imported.push(workspaceRow);
      return;
    }
    if (row.reason) {
      failed.push(workspaceRow);
      review.push(workspaceRow);
      return;
    }
    if (duplicate) {
      duplicates.push(workspaceRow);
      review.push(workspaceRow);
      return;
    }
    review.push(workspaceRow);
  });

  const importFailures = (upload.import_result?.failed_rows || [])
    .map((row, index) => {
      const matchedReview = upload.review_rows.find((candidate) => (
        String(candidate.transaction_date || '') === String(row.transaction_date || '')
        && String(candidate.description || '').trim() === String(row.description || '').trim()
        && amountsMatch(candidate.amount, row.amount)
      ));
      const rowIndex = Number(matchedReview?.row_index ?? row.row_index ?? (100000 + index));
      const key = rowKey(upload.id, rowIndex);
      if (dismissedKeys.has(key)) {
        return null;
      }
      return {
        ...matchedReview,
        ...row,
        row_index: rowIndex,
        row_key: key,
        linkedTransactionId: null,
        matchedTransactionId: null,
      } as StatementWorkspaceRow;
    })
    .filter((row): row is StatementWorkspaceRow => Boolean(row));

  importFailures.forEach((row) => {
    if (!failed.some((candidate) => candidate.row_key === row.row_key)) {
      failed.push(row);
    }
  });

  return {
    review,
    imported,
    duplicates,
    failed,
    suspicious: upload.suspicious_items.map((item, index) => ({
      row_index: 200000 + index,
      row_key: `${upload.id}:suspicious:${index}`,
      transaction_date: item.transaction_date,
      description: item.transaction_description,
      amount: item.amount,
      reason: item.reason,
      linkedTransactionId: null,
      matchedTransactionId: null,
    })),
  };
}

export function Accumul8StatementsPanel({
  busy,
  accounts,
  bankingOrganizations,
  statementUploads,
  transactions,
  ownerUserId,
  onUpload,
  onRescan,
  onConfirmImport,
  onImportReviewRow,
  onLinkReviewRow,
  onSearch,
  onOpenTransaction,
  onDeleteTransaction,
}: Accumul8StatementsPanelProps) {
  const [statementKind, setStatementKind] = React.useState<Accumul8StatementKind | ''>('');
  const [accountId, setAccountId] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchBusy, setSearchBusy] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<Accumul8StatementSearchResult[]>([]);
  const [accountModeById, setAccountModeById] = React.useState<Record<number, 'existing' | 'new'>>({});
  const [selectedAccountById, setSelectedAccountById] = React.useState<Record<number, string>>({});
  const [newAccountById, setNewAccountById] = React.useState<Record<number, Accumul8StatementNewAccountDraft>>({});
  const [latestImportResult, setLatestImportResult] = React.useState<{ uploadId: number; filename: string; result: Accumul8StatementImportResult | null } | null>(null);
  const [selectedReviewUploadId, setSelectedReviewUploadId] = React.useState<number | null>(null);
  const [activeSection, setActiveSection] = React.useState<StatementModalSection>('inbox');
  const [selectedWorkspacePanel, setSelectedWorkspacePanel] = React.useState<StatementWorkspacePanel>('review');
  const [selectedLibraryUploadId, setSelectedLibraryUploadId] = React.useState<number | null>(null);
  const [selectedSignalUploadId, setSelectedSignalUploadId] = React.useState<number | null>(null);
  const [libraryFilter, setLibraryFilter] = React.useState<StatementLibraryFilter>('all');
  const [libraryQuery, setLibraryQuery] = React.useState('');
  const [dismissedRowKeysByUpload, setDismissedRowKeysByUpload] = React.useState<Record<number, string[]>>({});

  React.useEffect(() => {
    setStatementKind('');
    setAccountId('');
    setFiles([]);
    setSearchQuery('');
    setSearchResults([]);
    setLatestImportResult(null);
    setSelectedReviewUploadId(null);
    setActiveSection('inbox');
    setSelectedWorkspacePanel('review');
    setSelectedLibraryUploadId(null);
    setSelectedSignalUploadId(null);
    setLibraryFilter('all');
    setLibraryQuery('');
    setDismissedRowKeysByUpload({});
  }, [ownerUserId]);

  React.useEffect(() => {
    setSelectedAccountById((prev) => {
      const next = { ...prev };
      statementUploads.forEach((upload) => {
        if (!(upload.id in next)) {
          next[upload.id] = upload.account_id ? String(upload.account_id) : (upload.plan?.suggested_account_id ? String(upload.plan.suggested_account_id) : '');
        }
      });
      return next;
    });
    setAccountModeById((prev) => {
      const next = { ...prev };
      statementUploads.forEach((upload) => {
        if (!(upload.id in next)) {
          next[upload.id] = upload.plan?.suggested_account_id ? 'existing' : 'new';
        }
      });
      return next;
    });
    setNewAccountById((prev) => {
      const next = { ...prev };
      statementUploads.forEach((upload) => {
        if (!(upload.id in next)) {
          next[upload.id] = createStatementNewAccountDraft(upload);
        }
      });
      return next;
    });
  }, [statementUploads]);

  const sortedAccounts = React.useMemo(
    () => [...accounts].sort((a, b) => `${a.banking_organization_name} ${a.account_name}`.localeCompare(`${b.banking_organization_name} ${b.account_name}`)),
    [accounts],
  );
  const transactionsById = React.useMemo(
    () => transactions.reduce<Record<number, Accumul8Transaction>>((acc, tx) => {
      acc[tx.id] = tx;
      return acc;
    }, {}),
    [transactions],
  );
  const isAwaitingImportApproval = React.useCallback(
    (upload: Accumul8StatementUpload) => Boolean(upload.plan && (upload.status === 'scanned' || upload.status === 'needs_review' || upload.status === 'failed')),
    [],
  );
  const pendingUploads = React.useMemo(
    () => statementUploads.filter((upload) => isAwaitingImportApproval(upload)),
    [isAwaitingImportApproval, statementUploads],
  );
  const sortedStatementUploads = React.useMemo(
    () => [...statementUploads].sort((a, b) => getStatementSortDate(b).localeCompare(getStatementSortDate(a)) || b.id - a.id),
    [statementUploads],
  );
  const workspaceByUploadId = React.useMemo(
    () => statementUploads.reduce<Record<number, StatementWorkspaceData>>((acc, upload) => {
      const selectedAccount = selectedAccountById[upload.id] || '';
      acc[upload.id] = buildWorkspace(
        upload,
        transactions,
        selectedAccount ? Number(selectedAccount) : (upload.account_id || upload.plan?.suggested_account_id || null),
        new Set<string>(dismissedRowKeysByUpload[upload.id] || []),
      );
      return acc;
    }, {}),
    [dismissedRowKeysByUpload, selectedAccountById, statementUploads, transactions],
  );
  const activeReviewUpload = React.useMemo(
    () => pendingUploads.find((upload) => upload.id === selectedReviewUploadId) || pendingUploads[0] || null,
    [pendingUploads, selectedReviewUploadId],
  );
  const activeReviewAccountId = React.useMemo(() => {
    if (!activeReviewUpload) {
      return null;
    }
    const selectedAccount = selectedAccountById[activeReviewUpload.id] || '';
    return selectedAccount ? Number(selectedAccount) : (activeReviewUpload.account_id || activeReviewUpload.plan?.suggested_account_id || null);
  }, [activeReviewUpload, selectedAccountById]);
  const activeWorkspace = React.useMemo(
    () => (activeReviewUpload ? workspaceByUploadId[activeReviewUpload.id] || null : null),
    [activeReviewUpload, workspaceByUploadId],
  );
  const filteredLibraryUploads = React.useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    return sortedStatementUploads.filter((upload) => {
      const workspace = workspaceByUploadId[upload.id];
      if (!workspace || !matchesLibraryFilter(upload, workspace, libraryFilter)) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        upload.original_filename,
        upload.account_name,
        upload.account_name_hint,
        upload.institution_name,
        upload.banking_organization_name,
        upload.period_start,
        upload.period_end,
        upload.status,
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [libraryFilter, libraryQuery, sortedStatementUploads, workspaceByUploadId]);
  const selectedLibraryUpload = React.useMemo(
    () => filteredLibraryUploads.find((upload) => upload.id === selectedLibraryUploadId)
      || sortedStatementUploads.find((upload) => upload.id === selectedLibraryUploadId)
      || filteredLibraryUploads[0]
      || sortedStatementUploads[0]
      || null,
    [filteredLibraryUploads, selectedLibraryUploadId, sortedStatementUploads],
  );
  const selectedLibraryWorkspace = React.useMemo(
    () => (selectedLibraryUpload ? workspaceByUploadId[selectedLibraryUpload.id] || null : null),
    [selectedLibraryUpload, workspaceByUploadId],
  );
  const signalUploads = React.useMemo(
    () => sortedStatementUploads.filter((upload) => {
      const workspace = workspaceByUploadId[upload.id];
      return Boolean(workspace && (workspace.failed.length > 0 || workspace.suspicious.length > 0));
    }),
    [sortedStatementUploads, workspaceByUploadId],
  );
  const selectedSignalUpload = React.useMemo(
    () => signalUploads.find((upload) => upload.id === selectedSignalUploadId)
      || sortedStatementUploads.find((upload) => upload.id === selectedSignalUploadId)
      || signalUploads[0]
      || null,
    [selectedSignalUploadId, signalUploads, sortedStatementUploads],
  );
  const selectedSignalWorkspace = React.useMemo(
    () => (selectedSignalUpload ? workspaceByUploadId[selectedSignalUpload.id] || null : null),
    [selectedSignalUpload, workspaceByUploadId],
  );
  const overview = React.useMemo(() => ({
    review: pendingUploads.length,
    imported: statementUploads.reduce((sum, upload) => sum + (workspaceByUploadId[upload.id]?.imported.length || upload.imported_transaction_count || 0), 0),
    failed: statementUploads.reduce((sum, upload) => sum + (workspaceByUploadId[upload.id]?.failed.length || 0), 0),
    suspicious: statementUploads.reduce((sum, upload) => sum + (workspaceByUploadId[upload.id]?.suspicious.length || 0), 0),
  }), [pendingUploads.length, statementUploads, workspaceByUploadId]);

  React.useEffect(() => {
    if (pendingUploads.length === 0) {
      setSelectedReviewUploadId(null);
      return;
    }
    if (!pendingUploads.some((upload) => upload.id === selectedReviewUploadId)) {
      setSelectedReviewUploadId(pendingUploads[0].id);
    }
  }, [pendingUploads, selectedReviewUploadId]);
  React.useEffect(() => {
    if (sortedStatementUploads.length === 0) {
      setSelectedLibraryUploadId(null);
      return;
    }
    if (!sortedStatementUploads.some((upload) => upload.id === selectedLibraryUploadId)) {
      setSelectedLibraryUploadId(sortedStatementUploads[0].id);
    }
  }, [selectedLibraryUploadId, sortedStatementUploads]);
  React.useEffect(() => {
    if (filteredLibraryUploads.length === 0) {
      return;
    }
    if (!filteredLibraryUploads.some((upload) => upload.id === selectedLibraryUploadId)) {
      setSelectedLibraryUploadId(filteredLibraryUploads[0].id);
    }
  }, [filteredLibraryUploads, selectedLibraryUploadId]);
  React.useEffect(() => {
    if (signalUploads.length === 0) {
      setSelectedSignalUploadId(null);
      return;
    }
    if (!signalUploads.some((upload) => upload.id === selectedSignalUploadId)) {
      setSelectedSignalUploadId(signalUploads[0].id);
    }
  }, [selectedSignalUploadId, signalUploads]);

  const handleSubmit = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (files.length === 0) return;
    setLatestImportResult(null);
    for (const file of files) {
      const formData = new FormData();
      formData.append('statement_kind', statementKind || DEFAULT_KIND);
      if (accountId) formData.append('account_id', accountId);
      formData.append('statement_file', file);
      await onUpload(formData);
    }
    setFiles([]);
  }, [accountId, files, onUpload, statementKind]);

  const handleSearch = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    setSearchBusy(true);
    try {
      setSearchResults(await onSearch(query));
    } finally {
      setSearchBusy(false);
    }
  }, [onSearch, searchQuery]);

  const handleConfirmImport = React.useCallback(async (upload: Accumul8StatementUpload) => {
    const mode = accountModeById[upload.id] || 'existing';
    const selectedAccount = selectedAccountById[upload.id] || '';
    const createAccount = newAccountById[upload.id] || createStatementNewAccountDraft(upload);
    const response = await onConfirmImport({
      id: upload.id,
      account_id: mode === 'existing' && selectedAccount ? Number(selectedAccount) : null,
      create_account: mode === 'new' ? createAccount : null,
    });
    setLatestImportResult({
      uploadId: upload.id,
      filename: upload.original_filename,
      result: response.import_result,
    });
  }, [accountModeById, newAccountById, onConfirmImport, selectedAccountById]);

  const openReview = React.useCallback((uploadId: number) => {
    setActiveSection('inbox');
    setSelectedReviewUploadId(uploadId);
    setSelectedWorkspacePanel('review');
  }, []);
  const openWorkspace = React.useCallback((uploadId: number, panel: Exclude<StatementHistoryPanel, 'status' | null>) => {
    setActiveSection('inbox');
    setSelectedReviewUploadId(uploadId);
    if (panel === 'reconciliation' || panel === 'suspicious' || panel === 'imported' || panel === 'duplicates' || panel === 'failed' || panel === 'review') {
      setSelectedWorkspacePanel(panel);
    } else {
      setSelectedWorkspacePanel('review');
    }
  }, []);
  const dismissWorkspaceRow = React.useCallback((uploadId: number, key: string) => {
    setDismissedRowKeysByUpload((prev) => ({
      ...prev,
      [uploadId]: Array.from(new Set([...(prev[uploadId] || []), key])),
    }));
  }, []);
  const acceptWorkspaceRow = React.useCallback(async (upload: Accumul8StatementUpload, row: StatementWorkspaceRow) => {
    const nextDescription = window.prompt('Description', row.description || '');
    if (nextDescription === null) {
      return;
    }
    const nextDate = window.prompt('Transaction date (YYYY-MM-DD)', row.transaction_date || '') || row.transaction_date || '';
    const nextAmountRaw = window.prompt('Amount', row.amount !== undefined ? String(row.amount) : '');
    if (nextAmountRaw === null) {
      return;
    }
    const nextAmount = Number(nextAmountRaw);
    if (!Number.isFinite(nextAmount)) {
      return;
    }
    const nextMemo = window.prompt('Memo', row.memo || '') || row.memo || '';
    await onImportReviewRow({
      id: upload.id,
      row_index: row.row_index,
      transaction_date: nextDate,
      description: nextDescription,
      memo: nextMemo,
      amount: nextAmount,
      account_id: activeReviewAccountId,
    });
  }, [activeReviewAccountId, onImportReviewRow]);
  const linkWorkspaceRow = React.useCallback(async (upload: Accumul8StatementUpload, row: StatementWorkspaceRow, transactionId: number | null) => {
    if (!transactionId) {
      return;
    }
    await onLinkReviewRow({
      id: upload.id,
      row_index: row.row_index,
      transaction_id: transactionId,
    });
  }, [onLinkReviewRow]);

  return (
    <section className="accumul8-statements-page">
      {busy ? (
        <div className="accumul8-statement-busy-overlay" role="status" aria-live="polite" aria-label="Statement scan in progress">
          <div className="accumul8-statement-busy-card">
            <WebpImage
              className="accumul8-statement-busy-logo"
              src="/images/catn8_logo.png"
              alt=""
              aria-hidden="true"
            />
            <div className="accumul8-statement-busy-text">Scanning statement...</div>
          </div>
        </div>
      ) : null}
      <div className="accumul8-statements-page-header">
        <h2 className="accumul8-statements-page-title mb-0">Bank Statements</h2>
        <section className="accumul8-statement-summary-grid">
          <button type="button" className={`accumul8-statement-summary-card${activeSection === 'inbox' ? ' is-active' : ''}`} onClick={() => setActiveSection('inbox')}>
            <span className="accumul8-statement-summary-label">Inbox</span>
            <strong>{overview.review}</strong>
          </button>
          <button type="button" className={`accumul8-statement-summary-card${activeSection === 'library' ? ' is-active' : ''}`} onClick={() => setActiveSection('library')}>
            <span className="accumul8-statement-summary-label">Library</span>
            <strong>{statementUploads.length}</strong>
          </button>
          <button type="button" className={`accumul8-statement-summary-card${activeSection === 'search' ? ' is-active' : ''}`} onClick={() => setActiveSection('search')}>
            <span className="accumul8-statement-summary-label">Search</span>
            <strong>{searchResults.length}</strong>
          </button>
          <button type="button" className={`accumul8-statement-summary-card${activeSection === 'signals' ? ' is-active' : ''}`} onClick={() => setActiveSection('signals')}>
            <span className="accumul8-statement-summary-label">Signals</span>
            <strong>{overview.failed + overview.suspicious}</strong>
          </button>
        </section>
        <div className="accumul8-statement-modal-header-actions">
          <Accumul8ModalHelp buttonLabel="Statement upload help" buttonTitle="Statement upload help" modalTitle="Statement Upload Help" parentOpen>
            <div className="accumul8-statement-hero">
              <div className="accumul8-statement-hero-card">
                <strong>Scan first, import second</strong>
                <p className="mb-0">Each file is OCR scanned, cataloged, and converted into an AI import plan first. Nothing reaches the ledger until you approve the plan.</p>
              </div>
              <div className="accumul8-statement-hero-card">
                <strong>Review and retry</strong>
                <p className="mb-0">You can re-scan any saved statement, choose an existing account, create a new account for unmatched statements, and review imported, duplicate, and failed rows afterward.</p>
              </div>
            </div>
          </Accumul8ModalHelp>
        </div>
      </div>
      <div className="accumul8-statements-page-body">
        <div className="accumul8-statement-shell">
          <section className="accumul8-statement-top-grid is-single-column">
            <div className="accumul8-statement-upload-card">
              <div className="accumul8-statement-upload-toolbar">
                <div className="accumul8-statement-section-head">
                  <div className="accumul8-statement-action-row">
                    <label htmlFor="accumul8-statement-files" className={`btn btn-success btn-sm${busy ? ' disabled' : ''}`}>Upload Statements</label>
                    <button type="submit" className="btn btn-success btn-sm" disabled={busy || files.length === 0} form="accumul8-statement-upload-form">Scan Statements</button>
                  </div>
                </div>
                <form id="accumul8-statement-upload-form" className="accumul8-statement-upload-form" onSubmit={handleSubmit}>
                  <div className="accumul8-statement-upload-fields">
                    <select id="accumul8-statement-kind" className="form-select" value={statementKind} onChange={(event) => setStatementKind(event.target.value as Accumul8StatementKind | '')} disabled={busy}>
                      <option value="">Statement type</option>
                      <option value="bank_account">Bank account</option>
                      <option value="credit_card">Credit card</option>
                      <option value="loan">Car loan / installment</option>
                      <option value="mortgage">Mortgage</option>
                      <option value="other">Other</option>
                    </select>
                    <select id="accumul8-statement-account" className="form-select" value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={busy}>
                      <option value="">Preferred account</option>
                      {sortedAccounts.map((uploadAccount) => (
                        <option key={uploadAccount.id} value={String(uploadAccount.id)}>
                          {[uploadAccount.banking_organization_name, uploadAccount.account_name, uploadAccount.mask_last4 ? `••${uploadAccount.mask_last4}` : ''].filter(Boolean).join(' · ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input id="accumul8-statement-files" className="accumul8-statement-file-input" type="file" accept=".pdf,image/*" multiple disabled={busy} onChange={(event) => setFiles(Array.from(event.target.files || []))} />
                </form>
              </div>
              {files.length > 0 ? (
                <div className="small text-muted">{`${files.length} file(s) queued: ${files.map((file) => file.name).join(', ')}`}</div>
              ) : null}
            </div>
          </section>

          {activeSection === 'search' ? (
            <section className="accumul8-statement-panel">
              <div className="accumul8-statement-section-head">
                <div>
                  <strong>Statement search</strong>
                </div>
              </div>
              <form className="accumul8-statement-search" onSubmit={handleSearch}>
                <input className="form-control" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search scanned statement contents, payees, memo text, or dates" disabled={busy || searchBusy} />
                <button type="submit" className="btn btn-outline-primary" disabled={busy || searchBusy || searchQuery.trim() === ''}>Search</button>
              </form>
              <div className="accumul8-statement-search-results">
                {searchResults.length > 0 ? searchResults.map((result) => <Accumul8StatementSearchResultCard key={result.upload_id} ownerUserId={ownerUserId} result={result} />) : (
                  <div className="accumul8-statement-history-empty">Run a search to find a statement by its contents instead of browsing manually.</div>
                )}
              </div>
            </section>
          ) : null}

          {activeSection === 'inbox' ? (
            <section className="accumul8-statement-panel accumul8-statement-workspace-shell">
              <div className="accumul8-statement-section-head">
                <div>
                  <strong>Review inbox</strong>
                </div>
                {latestImportResult ? (
                  <section className="accumul8-statement-history-card accumul8-statement-result-card is-inline">
                    <strong>Latest import result</strong>
                    <div className="small text-muted">{latestImportResult.filename}</div>
                    <div className="accumul8-statement-chip-row">
                      <span className="accumul8-statement-chip is-processed">{latestImportResult.result?.imported_count || 0} imported</span>
                      <span className="accumul8-statement-chip">{latestImportResult.result?.duplicate_count || 0} duplicates skipped</span>
                      <span className={`accumul8-statement-chip${(latestImportResult.result?.failed_count || 0) > 0 ? ' is-warning' : ''}`}>{latestImportResult.result?.failed_count || 0} failed</span>
                    </div>
                  </section>
                ) : null}
              </div>
              {pendingUploads.length === 0 ? (
                <div className="accumul8-statement-history-empty">Nothing is waiting for review. Open Library to inspect previous statements, or scan a new file to create a fresh review item.</div>
              ) : (
                <div className="accumul8-statement-workspace-grid">
                  <div className="accumul8-statement-picker-column">
                    <div className="accumul8-statement-picker-list">
                      {pendingUploads.map((upload) => {
                        const workspace = workspaceByUploadId[upload.id];
                        return (
                          <StatementPickerItem
                            key={`inbox-${upload.id}`}
                            upload={upload}
                            active={activeReviewUpload?.id === upload.id}
                            reviewCount={workspace?.review.length || 0}
                            failedCount={workspace?.failed.length || 0}
                            suspiciousCount={workspace?.suspicious.length || 0}
                            onClick={() => openReview(upload.id)}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="accumul8-statement-detail-column">
                    {activeReviewUpload ? (
                      <section id={`accumul8-statement-review-${activeReviewUpload.id}`} className="accumul8-statement-review-section">
                        {(() => {
                          const upload = activeReviewUpload;
                          const mode = accountModeById[upload.id] || 'existing';
                          const selectedUploadAccount = selectedAccountById[upload.id] || '';
                          const newAccount = newAccountById[upload.id] || createStatementNewAccountDraft(upload);
                          return (
                            <Accumul8StatementPlanCard
                              key={`plan-${upload.id}`}
                              busy={busy}
                              upload={upload}
                              sortedAccounts={sortedAccounts}
                              bankingOrganizations={bankingOrganizations}
                              accountMode={mode}
                              selectedAccountId={selectedUploadAccount}
                              newAccount={newAccount}
                              onModeChange={(nextMode) => setAccountModeById((prev) => ({ ...prev, [upload.id]: nextMode }))}
                              onSelectedAccountChange={(nextAccountId) => setSelectedAccountById((prev) => ({ ...prev, [upload.id]: nextAccountId }))}
                              onNewAccountChange={(draft) => setNewAccountById((prev) => ({ ...prev, [upload.id]: draft }))}
                              onRescan={() => void onRescan(upload.id, selectedUploadAccount ? Number(selectedUploadAccount) : null)}
                              onConfirm={() => void handleConfirmImport(upload)}
                              onOpenWorkspace={(panel) => openWorkspace(upload.id, panel)}
                              formatDateRange={formatStatementDateRange}
                              formatFileSize={formatStatementFileSize}
                            />
                          );
                        })()}
                        {activeWorkspace ? (
                          <section className="accumul8-statement-workspace">
                            <div className="accumul8-statement-chip-row">
                              <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button${selectedWorkspacePanel === 'review' ? ' is-active' : ''}`} onClick={() => setSelectedWorkspacePanel('review')}>needs review {activeWorkspace.review.length}</button>
                              <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button${selectedWorkspacePanel === 'imported' ? ' is-active' : ''}`} onClick={() => setSelectedWorkspacePanel('imported')}>imported {activeWorkspace.imported.length}</button>
                              <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button${selectedWorkspacePanel === 'duplicates' ? ' is-active' : ''}`} onClick={() => setSelectedWorkspacePanel('duplicates')}>duplicates {activeWorkspace.duplicates.length}</button>
                              <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button${selectedWorkspacePanel === 'failed' ? ' is-active' : ''}`} onClick={() => setSelectedWorkspacePanel('failed')}>failed {activeWorkspace.failed.length}</button>
                              <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button${selectedWorkspacePanel === 'suspicious' ? ' is-active' : ''}`} onClick={() => setSelectedWorkspacePanel('suspicious')}>suspicious {activeWorkspace.suspicious.length}</button>
                              <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button${selectedWorkspacePanel === 'reconciliation' ? ' is-active' : ''}`} onClick={() => setSelectedWorkspacePanel('reconciliation')}>reconciliation</button>
                            </div>
                            {selectedWorkspacePanel === 'reconciliation' ? (
                              <div className="accumul8-statement-detail-panel">
                                <strong>Reconciliation</strong>
                                <div className="small text-muted">{activeReviewUpload.reconciliation_note || 'No reconciliation note is available yet.'}</div>
                                {activeReviewUpload.processing_notes.length > 0 ? <div className="small text-muted">{activeReviewUpload.processing_notes.join(' ')}</div> : null}
                              </div>
                            ) : null}
                            {(selectedWorkspacePanel !== 'reconciliation') ? (
                              <div className="accumul8-statement-detail-panel">
                                <strong>
                                  {selectedWorkspacePanel === 'review' ? 'Review queue'
                                    : selectedWorkspacePanel === 'imported' ? 'Imported rows'
                                      : selectedWorkspacePanel === 'duplicates' ? 'Duplicate candidates'
                                        : selectedWorkspacePanel === 'failed' ? 'Failed or invalid rows'
                                          : 'Suspicious rows'}
                                </strong>
                                <div className="accumul8-statement-detail-list">
                                  {(selectedWorkspacePanel === 'review'
                                    ? activeWorkspace.review
                                    : selectedWorkspacePanel === 'imported'
                                      ? activeWorkspace.imported
                                      : selectedWorkspacePanel === 'duplicates'
                                        ? activeWorkspace.duplicates
                                        : selectedWorkspacePanel === 'failed'
                                          ? activeWorkspace.failed
                                          : activeWorkspace.suspicious
                                  ).map((row) => {
                                    const pageHref = row.page_number ? `/api/accumul8.php?action=download_statement_upload&id=${activeReviewUpload.id}&owner_user_id=${ownerUserId}#page=${row.page_number}` : '';
                                    const targetId = row.linkedTransactionId || row.matchedTransactionId || null;
                                    return (
                                      <div key={row.row_key} className="accumul8-statement-detail-row">
                                        <div className="accumul8-statement-detail-main">
                                          <div className="accumul8-statement-detail-title">
                                            <span>{row.description || 'Untitled transaction'}</span>
                                            <span className="accumul8-statement-detail-amount">{Number(row.amount || 0).toFixed(2)}</span>
                                          </div>
                                          <div className="small text-muted">
                                            {[row.transaction_date || 'No date', row.page_number ? `Page ${row.page_number}` : '', row.running_balance !== undefined && row.running_balance !== null ? `Balance ${Number(row.running_balance).toFixed(2)}` : ''].filter(Boolean).join(' · ')}
                                          </div>
                                          {row.reason ? <div className="accumul8-statement-error mt-1">{row.reason}</div> : null}
                                          {row.memo ? <div className="small text-muted mt-1">{row.memo}</div> : null}
                                        </div>
                                        <div className="accumul8-statement-detail-actions">
                                          {pageHref ? <a className="btn btn-sm btn-outline-secondary" href={pageHref} target="_blank" rel="noreferrer">Open statement page</a> : null}
                                          {targetId ? <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onOpenTransaction(targetId)}>Open ledger entry</button> : null}
                                          {selectedWorkspacePanel !== 'imported' && selectedWorkspacePanel !== 'suspicious' ? <button type="button" className="btn btn-sm btn-success" disabled={busy} onClick={() => void acceptWorkspaceRow(activeReviewUpload, row)}>Accept proposed transaction</button> : null}
                                          {selectedWorkspacePanel === 'duplicates' && row.matchedTransactionId ? <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy} onClick={() => void linkWorkspaceRow(activeReviewUpload, row, row.matchedTransactionId)}>Link existing entry</button> : null}
                                          {selectedWorkspacePanel === 'imported' && row.linkedTransactionId ? <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => onDeleteTransaction(row.linkedTransactionId || 0, row.description || 'Imported transaction')}>Delete malformed import</button> : null}
                                          {selectedWorkspacePanel !== 'imported' && selectedWorkspacePanel !== 'suspicious' ? <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => dismissWorkspaceRow(activeReviewUpload.id, row.row_key)}>{selectedWorkspacePanel === 'duplicates' ? 'Keep skipped' : 'Dismiss from review'}</button> : null}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {(selectedWorkspacePanel === 'review'
                                    ? activeWorkspace.review
                                    : selectedWorkspacePanel === 'imported'
                                      ? activeWorkspace.imported
                                      : selectedWorkspacePanel === 'duplicates'
                                        ? activeWorkspace.duplicates
                                        : selectedWorkspacePanel === 'failed'
                                          ? activeWorkspace.failed
                                          : activeWorkspace.suspicious
                                  ).length === 0 ? <div className="small text-muted">No rows in this review set.</div> : null}
                                </div>
                              </div>
                            ) : null}
                          </section>
                        ) : null}
                      </section>
                    ) : null}
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {activeSection === 'library' ? (
            <section className="accumul8-statement-panel accumul8-statement-workspace-shell">
              <div className="accumul8-statement-section-head">
                <div>
                  <strong>Statement library</strong>
                </div>
              </div>
              <div className="accumul8-statement-library-toolbar">
                <div className="accumul8-statement-chip-row">
                  {(['all', 'review', 'processed', 'failed', 'suspicious'] as StatementLibraryFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={`accumul8-statement-chip accumul8-statement-chip-button${libraryFilter === filter ? ' is-active' : ''}${filter === 'failed' || filter === 'suspicious' ? ' is-warning' : filter === 'processed' ? ' is-processed' : ''}`}
                      onClick={() => setLibraryFilter(filter)}
                    >
                      {filter === 'all' ? 'all statements' : filter}
                    </button>
                  ))}
                </div>
                <input
                  className="form-control"
                  value={libraryQuery}
                  onChange={(event) => setLibraryQuery(event.target.value)}
                  placeholder="Filter by file name, account, institution, period, or status"
                />
              </div>
              <div className="accumul8-statement-workspace-grid">
                <div className="accumul8-statement-picker-column">
                  <div className="accumul8-statement-picker-list">
                    {filteredLibraryUploads.length === 0 ? (
                      <div className="accumul8-statement-history-empty">No statements match this filter.</div>
                    ) : filteredLibraryUploads.map((upload) => {
                      const workspace = selectedLibraryWorkspace && selectedLibraryUpload?.id === upload.id
                        ? selectedLibraryWorkspace
                        : workspaceByUploadId[upload.id];
                      return (
                        <StatementPickerItem
                          key={`library-${upload.id}`}
                          upload={upload}
                          active={selectedLibraryUpload?.id === upload.id}
                          reviewCount={workspace?.review.length || 0}
                          failedCount={workspace?.failed.length || 0}
                          suspiciousCount={workspace?.suspicious.length || 0}
                          onClick={() => setSelectedLibraryUploadId(upload.id)}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="accumul8-statement-detail-column">
                  {selectedLibraryUpload ? (
                    <Accumul8StatementHistoryCard
                      key={selectedLibraryUpload.id}
                      busy={busy}
                      ownerUserId={ownerUserId}
                      upload={selectedLibraryUpload}
                      counts={{
                        review: selectedLibraryWorkspace?.review.length || 0,
                        imported: selectedLibraryWorkspace?.imported.length || 0,
                        duplicates: selectedLibraryWorkspace?.duplicates.length || 0,
                        failed: selectedLibraryWorkspace?.failed.length || 0,
                        suspicious: selectedLibraryWorkspace?.suspicious.length || 0,
                      }}
                      transactionsById={transactionsById}
                      onRescan={() => void onRescan(selectedLibraryUpload.id, selectedLibraryUpload.account_id)}
                      onReview={selectedLibraryUpload.plan ? () => openReview(selectedLibraryUpload.id) : undefined}
                      onOpenTransaction={onOpenTransaction}
                      onDeleteTransaction={onDeleteTransaction}
                      isReviewable={isAwaitingImportApproval(selectedLibraryUpload)}
                      formatDateRange={formatStatementDateRange}
                      formatFileSize={formatStatementFileSize}
                    />
                  ) : (
                    <div className="accumul8-statement-history-empty">Select a statement to inspect its details.</div>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === 'signals' ? (
            <section className="accumul8-statement-panel accumul8-statement-workspace-shell">
              <div className="accumul8-statement-section-head">
                <div>
                  <strong>Signals</strong>
                </div>
              </div>
              {signalUploads.length === 0 ? (
                <div className="accumul8-statement-history-empty">No failed or suspicious statement rows are waiting for attention.</div>
              ) : (
                <div className="accumul8-statement-workspace-grid">
                  <div className="accumul8-statement-picker-column">
                    <div className="accumul8-statement-picker-list">
                      {signalUploads.map((upload) => {
                        const workspace = selectedSignalWorkspace && selectedSignalUpload?.id === upload.id
                          ? selectedSignalWorkspace
                          : workspaceByUploadId[upload.id];
                        return (
                          <StatementPickerItem
                            key={`signals-${upload.id}`}
                            upload={upload}
                            active={selectedSignalUpload?.id === upload.id}
                            reviewCount={workspace?.review.length || 0}
                            failedCount={workspace?.failed.length || 0}
                            suspiciousCount={workspace?.suspicious.length || 0}
                            onClick={() => setSelectedSignalUploadId(upload.id)}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="accumul8-statement-detail-column">
                    {selectedSignalUpload ? (
                      <Accumul8StatementHistoryCard
                        key={`signal-${selectedSignalUpload.id}`}
                        busy={busy}
                        ownerUserId={ownerUserId}
                        upload={selectedSignalUpload}
                        counts={{
                          review: selectedSignalWorkspace?.review.length || 0,
                          imported: selectedSignalWorkspace?.imported.length || 0,
                          duplicates: selectedSignalWorkspace?.duplicates.length || 0,
                          failed: selectedSignalWorkspace?.failed.length || 0,
                          suspicious: selectedSignalWorkspace?.suspicious.length || 0,
                        }}
                        transactionsById={transactionsById}
                        onRescan={() => void onRescan(selectedSignalUpload.id, selectedSignalUpload.account_id)}
                        onReview={() => openWorkspace(
                          selectedSignalUpload.id,
                          (selectedSignalWorkspace?.failed.length || 0) > 0 ? 'failed' : 'suspicious',
                        )}
                        onOpenTransaction={onOpenTransaction}
                        onDeleteTransaction={onDeleteTransaction}
                        isReviewable={isAwaitingImportApproval(selectedSignalUpload)}
                        formatDateRange={formatStatementDateRange}
                        formatFileSize={formatStatementFileSize}
                      />
                    ) : (
                      <div className="accumul8-statement-history-empty">Select a signal to inspect its statement details.</div>
                    )}
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

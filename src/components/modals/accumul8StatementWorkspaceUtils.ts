import {
  Accumul8StatementArchiveSection,
  Accumul8StatementImportResultRow,
  Accumul8StatementUpload,
  Accumul8Transaction,
} from '../../types/accumul8';

export type StatementModalSection = 'inbox' | 'library' | 'search' | 'signals';
export type StatementLibraryFilter = 'all' | 'review' | 'processed' | 'failed' | 'suspicious';
export type StatementWorkspacePanel = 'review' | 'imported' | 'duplicates' | 'failed' | 'suspicious' | 'reconciliation';

export interface StatementWorkspaceRow extends Accumul8StatementImportResultRow {
  row_index: number;
  row_key: string;
  matchedTransactionId: number | null;
  linkedTransactionId: number | null;
}

export interface StatementWorkspaceData {
  review: StatementWorkspaceRow[];
  imported: StatementWorkspaceRow[];
  duplicates: StatementWorkspaceRow[];
  failed: StatementWorkspaceRow[];
  suspicious: StatementWorkspaceRow[];
}

export function rowKey(uploadId: number, rowIndex: number): string {
  return `${uploadId}:${rowIndex}`;
}

export function amountsMatch(a: number | undefined, b: number | undefined): boolean {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= 0.01;
}

export function getStatementSortDate(upload: Accumul8StatementUpload): string {
  return upload.period_end || upload.last_scanned_at || upload.processed_at || upload.created_at || '';
}

export function matchesLibraryFilter(
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

export function buildWorkspace(
  upload: Accumul8StatementUpload,
  transactions: Accumul8Transaction[],
  dismissedKeys: Set<string>,
): StatementWorkspaceData {
  const importedCandidates = transactions.filter((tx) => tx.source_ref === `statement_upload:${upload.id}`);
  const duplicateCandidates = transactions;
  const imported: StatementWorkspaceRow[] = [];
  const duplicates: StatementWorkspaceRow[] = [];
  const failed: StatementWorkspaceRow[] = [];
  const review: StatementWorkspaceRow[] = [];

  upload.review_rows.forEach((row, fallbackIndex) => {
    const rowIndex = Number(row.row_index ?? fallbackIndex);
    const key = rowKey(upload.id, rowIndex);
    if (dismissedKeys.has(key)) return;

    const linked = importedCandidates.find((tx) => (
      String(tx.transaction_date || '') === String(row.transaction_date || '')
      && String(tx.description || '').trim() === String(row.description || '').trim()
      && amountsMatch(tx.amount, row.amount)
    )) || null;

    const duplicate = !linked ? duplicateCandidates.find((tx) => (
      Number(row.suggested_account_id || 0) > 0
      && Number(tx.account_id || 0) === Number(row.suggested_account_id || 0)
      && String(tx.transaction_date || '') === String(row.transaction_date || '')
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
      if (dismissedKeys.has(key)) return null;
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

export function focusRestoredSection(
  upload: Accumul8StatementUpload,
  restoredToSection: Accumul8StatementArchiveSection,
  isAwaitingImportApproval: (upload: Accumul8StatementUpload) => boolean,
) {
  if (restoredToSection === 'inbox' && isAwaitingImportApproval(upload)) {
    return { section: 'inbox' as StatementModalSection, reviewUploadId: upload.id, workspacePanel: 'review' as StatementWorkspacePanel, libraryUploadId: null };
  }
  if (isAwaitingImportApproval(upload)) {
    return { section: 'inbox' as StatementModalSection, reviewUploadId: upload.id, workspacePanel: 'review' as StatementWorkspacePanel, libraryUploadId: null };
  }
  return { section: 'library' as StatementModalSection, reviewUploadId: null, workspacePanel: 'review' as StatementWorkspacePanel, libraryUploadId: upload.id };
}

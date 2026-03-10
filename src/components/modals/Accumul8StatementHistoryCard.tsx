import React from 'react';
import { Accumul8StatementImportResultRow, Accumul8StatementSearchResult, Accumul8StatementTransactionLocator, Accumul8StatementUpload, Accumul8Transaction } from '../../types/accumul8';
import { getAccumul8TransactionEditPolicy } from '../../utils/accumul8TransactionPolicy';

type StatementHistoryPanel = 'status' | 'reconciliation' | 'imported' | 'duplicates' | 'failed' | 'suspicious' | null;

interface Accumul8StatementHistoryCardProps {
  busy: boolean;
  ownerUserId: number;
  upload: Accumul8StatementUpload;
  transactionsById: Record<number, Accumul8Transaction>;
  onRescan: () => void;
  onReview?: () => void;
  onOpenTransaction?: (id: number) => void;
  onDeleteTransaction?: (id: number, description: string) => void;
  isReviewable?: boolean;
  formatDateRange: (upload: Accumul8StatementUpload) => string;
  formatFileSize: (bytes: number) => string;
}

function formatAmount(value: number | null | undefined): string {
  return `${Number(value || 0).toFixed(2)}`;
}

function buildStatementHref(uploadId: number, ownerUserId: number, pageNumber?: number | null): string {
  return `/api/accumul8.php?action=download_statement_upload&id=${uploadId}&owner_user_id=${ownerUserId}${pageNumber ? `#page=${pageNumber}` : ''}`;
}

function findTransactionLocator(
  upload: Accumul8StatementUpload,
  row: Pick<Accumul8StatementImportResultRow, 'transaction_date' | 'description' | 'amount'>,
): Accumul8StatementTransactionLocator | null {
  const txDate = String(row.transaction_date || '').trim();
  const description = String(row.description || '').trim().toLowerCase();
  const amount = Number(row.amount || 0).toFixed(2);

  return upload.transaction_locators.find((locator) => (
    String(locator.transaction_date || '').trim() === txDate
    && String(locator.description || '').trim().toLowerCase() === description
    && Number(locator.amount || 0).toFixed(2) === amount
  )) || null;
}

function StatementDetailChip({
  active,
  disabled = false,
  toneClass = '',
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  toneClass?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`accumul8-statement-chip accumul8-statement-chip-button${toneClass ? ` ${toneClass}` : ''}${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function StatementRowList({
  upload,
  ownerUserId,
  rows,
  emptyLabel,
  transactionsById,
  allowDelete,
  onOpenTransaction,
  onDeleteTransaction,
  mode,
}: {
  upload: Accumul8StatementUpload;
  ownerUserId: number;
  rows: Accumul8StatementImportResultRow[];
  emptyLabel: string;
  transactionsById: Record<number, Accumul8Transaction>;
  allowDelete?: boolean;
  onOpenTransaction?: (id: number) => void;
  onDeleteTransaction?: (id: number, description: string) => void;
  mode: 'imported' | 'duplicates' | 'failed';
}) {
  if (rows.length === 0) {
    return <div className="small text-muted">{emptyLabel}</div>;
  }

  return (
    <div className="accumul8-statement-detail-list">
      {rows.map((row, index) => {
        const rowId = mode === 'duplicates' ? Number(row.existing_transaction_id || 0) : Number(row.id || 0);
        const transaction = rowId > 0 ? transactionsById[rowId] || null : null;
        const editPolicy = transaction ? getAccumul8TransactionEditPolicy(transaction) : null;
        const locator = findTransactionLocator(upload, row);
        const pageHref = locator?.page_number ? buildStatementHref(upload.id, ownerUserId, locator.page_number) : '';
        const description = String(row.description || 'Untitled transaction').trim() || 'Untitled transaction';

        return (
          <div key={`${mode}-${rowId || index}-${description}`} className="accumul8-statement-detail-row">
            <div className="accumul8-statement-detail-main">
              <div className="accumul8-statement-detail-title">
                <span>{description}</span>
                <span className="accumul8-statement-detail-amount">{formatAmount(row.amount)}</span>
              </div>
              <div className="small text-muted">
                {[row.transaction_date || 'No date', locator?.running_balance !== null && locator?.running_balance !== undefined ? `Balance ${formatAmount(locator.running_balance)}` : '', locator?.page_number ? `Page ${locator.page_number}` : ''].filter(Boolean).join(' · ')}
              </div>
              {row.reason ? <div className="accumul8-statement-error mt-1">{row.reason}</div> : null}
            </div>
            <div className="accumul8-statement-detail-actions">
              {pageHref ? (
                <a className="btn btn-sm btn-outline-secondary" href={pageHref} target="_blank" rel="noreferrer">
                  Open statement page
                </a>
              ) : null}
              {rowId > 0 && onOpenTransaction ? (
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onOpenTransaction(rowId)}>
                  {mode === 'duplicates' ? 'Open existing entry' : 'Open ledger entry'}
                </button>
              ) : null}
              {allowDelete && rowId > 0 && transaction && editPolicy?.canDelete && onDeleteTransaction ? (
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDeleteTransaction(rowId, description)}>
                  Delete imported entry
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Accumul8StatementHistoryCard({
  busy,
  ownerUserId,
  upload,
  transactionsById,
  onRescan,
  onReview,
  onOpenTransaction,
  onDeleteTransaction,
  isReviewable = false,
  formatDateRange,
  formatFileSize,
}: Accumul8StatementHistoryCardProps) {
  const [activePanel, setActivePanel] = React.useState<StatementHistoryPanel>(null);
  const importedRows = upload.import_result?.successful_rows || [];
  const duplicateRows = upload.import_result?.duplicate_rows || [];
  const failedRows = upload.import_result?.failed_rows || [];

  const togglePanel = React.useCallback((panel: Exclude<StatementHistoryPanel, null>) => {
    setActivePanel((current) => (current === panel ? null : panel));
  }, []);

  const renderPanel = () => {
    if (activePanel === 'status') {
      return (
        <div className="accumul8-statement-detail-panel">
          <strong>Scan status</strong>
          <div className="small text-muted">
            {upload.status === 'scanned'
              ? 'This statement has a fresh import plan and is waiting on a review/import decision.'
              : upload.status === 'needs_review'
                ? 'This statement has unresolved issues or reconciliation gaps that need review before you trust the import.'
                : upload.status === 'processed'
                  ? 'This statement has already posted rows to the ledger. Re-scan it to refresh page matching or import any newly detected missing rows.'
                  : upload.status === 'failed'
                    ? 'The scan failed. Open the error details below, then re-scan after fixing the source statement or account selection.'
                    : 'This statement has been saved but still needs a scan/import decision.'}
          </div>
        </div>
      );
    }

    if (activePanel === 'reconciliation') {
      return (
        <div className="accumul8-statement-detail-panel">
          <strong>Reconciliation</strong>
          <div className="small text-muted">{upload.reconciliation_note || 'No reconciliation note is available yet.'}</div>
          {upload.processing_notes.length > 0 ? (
            <div className="small text-muted mt-2">{upload.processing_notes.join(' ')}</div>
          ) : null}
        </div>
      );
    }

    if (activePanel === 'imported') {
      return (
        <div className="accumul8-statement-detail-panel">
          <strong>Imported rows</strong>
          <div className="small text-muted mb-2">Open the ledger entry, jump back to the statement page, or delete a malformed imported row.</div>
          <StatementRowList
            upload={upload}
            ownerUserId={ownerUserId}
            rows={importedRows}
            emptyLabel="No imported rows are stored for this result yet."
            transactionsById={transactionsById}
            allowDelete
            onOpenTransaction={onOpenTransaction}
            onDeleteTransaction={onDeleteTransaction}
            mode="imported"
          />
        </div>
      );
    }

    if (activePanel === 'duplicates') {
      return (
        <div className="accumul8-statement-detail-panel">
          <strong>Duplicates skipped</strong>
          <div className="small text-muted mb-2">These rows matched existing ledger entries, so import will skip them instead of posting duplicates.</div>
          <StatementRowList
            upload={upload}
            ownerUserId={ownerUserId}
            rows={duplicateRows}
            emptyLabel="No duplicate rows were recorded for this statement."
            transactionsById={transactionsById}
            onOpenTransaction={onOpenTransaction}
            mode="duplicates"
          />
        </div>
      );
    }

    if (activePanel === 'failed') {
      return (
        <div className="accumul8-statement-detail-panel">
          <strong>Failed rows</strong>
          <div className="small text-muted mb-2">These rows were not posted. Review the reason before re-scanning or approving another pass.</div>
          <StatementRowList
            upload={upload}
            ownerUserId={ownerUserId}
            rows={failedRows}
            emptyLabel={upload.last_error || 'No failed rows were recorded for this statement.'}
            transactionsById={transactionsById}
            mode="failed"
          />
          {upload.last_error && failedRows.length === 0 ? <div className="accumul8-statement-error mt-2">{upload.last_error}</div> : null}
        </div>
      );
    }

    if (activePanel === 'suspicious') {
      return (
        <div className="accumul8-statement-detail-panel">
          <strong>Suspicious rows</strong>
          {upload.suspicious_items.length === 0 ? (
            <div className="small text-muted">No suspicious items were flagged for this statement.</div>
          ) : (
            <div className="accumul8-statement-detail-list">
              {upload.suspicious_items.map((item, index) => (
                <div key={`suspicious-${index}-${item.transaction_description}`} className="accumul8-statement-detail-row">
                  <div className="accumul8-statement-detail-main">
                    <div className="accumul8-statement-detail-title">
                      <span>{item.transaction_description || 'Flagged transaction'}</span>
                      <span className="accumul8-statement-detail-amount">{formatAmount(item.amount)}</span>
                    </div>
                    <div className="small text-muted">
                      {[item.transaction_date || 'No date', item.reason || '', item.baseline_mean !== null ? `Typical ${formatAmount(item.baseline_mean)}` : ''].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <article className="accumul8-statement-history-card">
      <div className="accumul8-statement-history-card-head">
        <div>
          <strong>{upload.original_filename}</strong>
          <div className="small text-muted">{[upload.statement_kind.replace('_', ' '), upload.account_name || 'Unmatched account', formatDateRange(upload), formatFileSize(upload.file_size_bytes)].join(' · ')}</div>
        </div>
        <div className="accumul8-statement-card-actions">
          {isReviewable && onReview ? (
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={onReview}>Review plan</button>
          ) : null}
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={onRescan}>Re-scan</button>
          <a className="btn btn-sm btn-outline-primary" href={buildStatementHref(upload.id, ownerUserId)} target="_blank" rel="noreferrer">View</a>
        </div>
      </div>
      <div className="accumul8-statement-chip-row">
        <StatementDetailChip active={activePanel === 'status'} toneClass={`is-${upload.status}`} label={upload.status} onClick={() => togglePanel('status')} disabled={busy} />
        <StatementDetailChip active={activePanel === 'reconciliation'} toneClass={`is-${upload.reconciliation_status}`} label={upload.reconciliation_status} onClick={() => togglePanel('reconciliation')} disabled={busy} />
        <StatementDetailChip active={activePanel === 'imported'} toneClass={upload.imported_transaction_count > 0 ? 'is-processed' : ''} label={`${upload.imported_transaction_count} imported`} onClick={() => togglePanel('imported')} disabled={busy} />
        <StatementDetailChip active={activePanel === 'duplicates'} label={`${upload.duplicate_transaction_count} duplicates skipped`} onClick={() => togglePanel('duplicates')} disabled={busy} />
        <StatementDetailChip active={activePanel === 'failed'} toneClass={((upload.import_result?.failed_count || 0) > 0 || upload.last_error) ? 'is-warning' : ''} label={`${upload.import_result?.failed_count || 0} failed`} onClick={() => togglePanel('failed')} disabled={busy} />
        <StatementDetailChip active={activePanel === 'suspicious'} toneClass={upload.suspicious_item_count > 0 ? 'is-warning' : ''} label={`${upload.suspicious_item_count} suspicious`} onClick={() => togglePanel('suspicious')} disabled={busy} />
      </div>
      {renderPanel()}
      {upload.catalog_summary ? <div className="accumul8-statement-note">{upload.catalog_summary}</div> : null}
      {!activePanel && upload.reconciliation_note ? <div className="small text-muted">{upload.reconciliation_note}</div> : null}
      {!activePanel && upload.processing_notes.length > 0 ? <div className="small text-muted">{upload.processing_notes.join(' ')}</div> : null}
      {!activePanel && upload.last_error ? <div className="accumul8-statement-error">{upload.last_error}</div> : null}
    </article>
  );
}

interface Accumul8StatementSearchResultCardProps {
  ownerUserId: number;
  result: Accumul8StatementSearchResult;
}

export function Accumul8StatementSearchResultCard({ ownerUserId, result }: Accumul8StatementSearchResultCardProps) {
  return (
    <article className="accumul8-statement-history-card">
      <div className="accumul8-statement-history-card-head">
        <div>
          <strong>{result.original_filename}</strong>
          <div className="small text-muted">{[result.institution_name || 'Institution unknown', result.account_name || 'No linked account', result.period_start && result.period_end ? `${result.period_start} to ${result.period_end}` : 'Period not detected'].filter(Boolean).join(' · ')}</div>
        </div>
        <a className="btn btn-sm btn-outline-primary" href={`/api/accumul8.php?action=download_statement_upload&id=${result.upload_id}&owner_user_id=${ownerUserId}${result.matched_page_number ? `#page=${result.matched_page_number}` : ''}`} target="_blank" rel="noreferrer">
          {result.matched_page_number ? `Open page ${result.matched_page_number}` : 'Open statement'}
        </a>
      </div>
      <div className="small text-muted">{result.snippet || 'No snippet available.'}</div>
    </article>
  );
}

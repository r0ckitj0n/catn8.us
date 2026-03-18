import React from 'react';

import {
  Accumul8StatementImportResultRow,
  Accumul8StatementSearchResult,
  Accumul8StatementTransactionLocator,
  Accumul8StatementUpload,
  Accumul8Transaction,
} from '../../types/accumul8';
import { getAccumul8TransactionEditPolicy } from '../../utils/accumul8TransactionPolicy';

export function formatStatementHistoryAmount(value: number | null | undefined): string {
  return `${Number(value || 0).toFixed(2)}`;
}

export function buildStatementHistoryHref(uploadId: number, ownerUserId: number, pageNumber?: number | null): string {
  return `/api/accumul8.php?action=download_statement_upload&id=${uploadId}&owner_user_id=${ownerUserId}${pageNumber ? `#page=${pageNumber}` : ''}`;
}

export function findStatementTransactionLocator(
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

export function StatementDetailChip({
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
      role="tab"
      aria-selected={active}
      className={`accumul8-statement-chip accumul8-statement-chip-button accumul8-statement-chip-button--tab${toneClass ? ` ${toneClass}` : ''}${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

export function StatementRowList({
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
        const locator = findStatementTransactionLocator(upload, row);
        const pageHref = locator?.page_number ? buildStatementHistoryHref(upload.id, ownerUserId, locator.page_number) : '';
        const description = String(row.description || 'Untitled transaction').trim() || 'Untitled transaction';

        return (
          <div key={`${mode}-${rowId || index}-${description}`} className="accumul8-statement-detail-row">
            <div className="accumul8-statement-detail-main">
              <div className="accumul8-statement-detail-title">
                <span>{description}</span>
                <span className="accumul8-statement-detail-amount">{formatStatementHistoryAmount(row.amount)}</span>
              </div>
              <div className="small text-muted">
                {[row.transaction_date || 'No date', locator?.running_balance !== null && locator?.running_balance !== undefined ? `Balance ${formatStatementHistoryAmount(locator.running_balance)}` : '', locator?.page_number ? `Page ${locator.page_number}` : ''].filter(Boolean).join(' · ')}
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
        <a className="btn btn-sm btn-outline-primary" href={buildStatementHistoryHref(result.upload_id, ownerUserId, result.matched_page_number)} target="_blank" rel="noreferrer">
          {result.matched_page_number ? `Open page ${result.matched_page_number}` : 'Open statement'}
        </a>
      </div>
      <div className="small text-muted">{result.snippet || 'No snippet available.'}</div>
    </article>
  );
}

import React from 'react';
import { Accumul8StatementSearchResult, Accumul8StatementUpload } from '../../types/accumul8';

interface Accumul8StatementHistoryCardProps {
  busy: boolean;
  ownerUserId: number;
  upload: Accumul8StatementUpload;
  onRescan: () => void;
  formatDateRange: (upload: Accumul8StatementUpload) => string;
  formatFileSize: (bytes: number) => string;
}

export function Accumul8StatementHistoryCard({ busy, ownerUserId, upload, onRescan, formatDateRange, formatFileSize }: Accumul8StatementHistoryCardProps) {
  return (
    <article className="accumul8-statement-history-card">
      <div className="accumul8-statement-history-card-head">
        <div>
          <strong>{upload.original_filename}</strong>
          <div className="small text-muted">{[upload.statement_kind.replace('_', ' '), upload.account_name || 'Unmatched account', formatDateRange(upload), formatFileSize(upload.file_size_bytes)].join(' · ')}</div>
        </div>
        <div className="accumul8-statement-card-actions">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={onRescan}>Re-scan</button>
          <a className="btn btn-sm btn-outline-primary" href={`/api/accumul8.php?action=download_statement_upload&id=${upload.id}&owner_user_id=${ownerUserId}`} target="_blank" rel="noreferrer">View</a>
        </div>
      </div>
      <div className="accumul8-statement-chip-row">
        <span className={`accumul8-statement-chip is-${upload.status}`}>{upload.status}</span>
        <span className={`accumul8-statement-chip is-${upload.reconciliation_status}`}>{upload.reconciliation_status}</span>
        <span className="accumul8-statement-chip">{upload.imported_transaction_count} imported</span>
        {upload.duplicate_transaction_count > 0 ? <span className="accumul8-statement-chip">{upload.duplicate_transaction_count} duplicates skipped</span> : null}
        {upload.suspicious_item_count > 0 ? <span className="accumul8-statement-chip is-warning">{upload.suspicious_item_count} suspicious</span> : null}
      </div>
      {upload.catalog_summary ? <div className="accumul8-statement-note">{upload.catalog_summary}</div> : null}
      {upload.reconciliation_note ? <div className="small text-muted">{upload.reconciliation_note}</div> : null}
      {upload.processing_notes.length > 0 ? <div className="small text-muted">{upload.processing_notes.join(' ')}</div> : null}
      {upload.last_error ? <div className="accumul8-statement-error">{upload.last_error}</div> : null}
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

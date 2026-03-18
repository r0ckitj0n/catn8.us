import React from 'react';

import { Accumul8StatementUpload } from '../../types/accumul8';
import { formatStatementDateRange } from './accumul8StatementUtils';

interface StatementPickerItemProps {
  upload: Accumul8StatementUpload;
  active: boolean;
  reviewCount: number;
  failedCount: number;
  suspiciousCount: number;
  onClick: () => void;
  onDiscard?: () => void;
  discardDisabled?: boolean;
}

export function Accumul8StatementPickerItem({
  upload,
  active,
  reviewCount,
  failedCount,
  suspiciousCount,
  onClick,
  onDiscard,
  discardDisabled = false,
}: StatementPickerItemProps) {
  return (
    <div className={`accumul8-statement-picker-shell${active ? ' is-active' : ''}`}>
      <button
        type="button"
        className={`accumul8-statement-picker-item${active ? ' is-active' : ''}${active && onDiscard ? ' has-trash-action' : ''}`}
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
      {active && onDiscard ? (
        <button
          type="button"
          className="accumul8-statement-picker-trash"
          onClick={(event) => {
            event.stopPropagation();
            onDiscard();
          }}
          disabled={discardDisabled}
          aria-label={`Discard ${upload.original_filename}`}
          title="Discard"
        >
          🗑️
        </button>
      ) : null}
    </div>
  );
}

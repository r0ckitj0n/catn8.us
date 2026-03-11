import React from 'react';
import { Accumul8StatementUpload } from '../../types/accumul8';
import { formatStatementDateRange, formatStatementFileSize } from './accumul8StatementUtils';
import './Accumul8StatementArchiveDialog.css';

interface Accumul8StatementArchiveDialogProps {
  open: boolean;
  busy: boolean;
  ownerUserId: number;
  uploads: Accumul8StatementUpload[];
  onClose: () => void;
  onRestore: (upload: Accumul8StatementUpload) => void;
  onEdit: (upload: Accumul8StatementUpload) => void;
  onDelete: (upload: Accumul8StatementUpload) => void;
}

function buildStatementHref(uploadId: number, ownerUserId: number): string {
  return `/api/accumul8.php?action=download_statement_upload&id=${uploadId}&owner_user_id=${ownerUserId}`;
}

export function Accumul8StatementArchiveDialog({
  open,
  busy,
  ownerUserId,
  uploads,
  onClose,
  onRestore,
  onEdit,
  onDelete,
}: Accumul8StatementArchiveDialogProps) {
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const filteredUploads = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return uploads;
    }
    return uploads.filter((upload) => (
      [
        upload.original_filename,
        upload.account_name,
        upload.account_name_hint,
        upload.institution_name,
        upload.banking_organization_name,
        upload.archived_from_status,
        upload.archived_from_section,
        upload.period_start,
        upload.period_end,
      ].join(' ').toLowerCase().includes(normalized)
    ));
  }, [query, uploads]);

  if (!open) {
    return null;
  }

  return (
    <div className="accumul8-statement-archive-overlay" role="dialog" aria-modal="true" aria-label="Archived bank statements" onClick={onClose}>
      <div className="accumul8-statement-archive-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="accumul8-statement-archive-header">
          <div>
            <h3 className="mb-0">Archived Statements</h3>
            <div className="small text-muted">{uploads.length} archived statement{uploads.length === 1 ? '' : 's'}</div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Close</button>
        </div>
        <div className="accumul8-statement-archive-toolbar">
          <input
            className="form-control"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter archived statements by file, account, institution, or archive source"
            disabled={busy}
          />
        </div>
        <div className="accumul8-statement-archive-list">
          {filteredUploads.length === 0 ? (
            <div className="accumul8-statement-history-empty">
              {uploads.length === 0 ? 'No statements have been archived.' : 'No archived statements match this filter.'}
            </div>
          ) : filteredUploads.map((upload) => (
            <article key={upload.id} className="accumul8-statement-history-card accumul8-statement-archive-card">
              <div className="accumul8-statement-history-card-head">
                <div>
                  <strong>{upload.original_filename}</strong>
                  <div className="small text-muted">
                    {[
                      upload.account_name || upload.account_name_hint || 'Unmatched account',
                      formatStatementDateRange(upload),
                      formatStatementFileSize(upload.file_size_bytes),
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className="accumul8-statement-chip">archived</span>
              </div>
              <div className="small text-muted">
                {[
                  upload.archived_at ? `Archived ${upload.archived_at}` : '',
                  upload.archived_from_section ? `from ${upload.archived_from_section}` : '',
                  upload.archived_from_status ? `status ${upload.archived_from_status}` : '',
                ].filter(Boolean).join(' · ')}
              </div>
              {upload.catalog_summary ? <div className="accumul8-statement-note">{upload.catalog_summary}</div> : null}
              <div className="accumul8-statement-card-actions">
                <a className="btn btn-sm btn-outline-primary" href={buildStatementHref(upload.id, ownerUserId)} target="_blank" rel="noreferrer">View</a>
                <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => onRestore(upload)}>Restore</button>
                <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => onEdit(upload)}>Edit / Update</button>
                <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => onDelete(upload)}>Delete Permanently</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

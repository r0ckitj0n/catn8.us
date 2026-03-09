import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { Accumul8Account, Accumul8StatementKind, Accumul8StatementUpload } from '../../types/accumul8';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import './Accumul8StatementModal.css';

interface Accumul8StatementModalProps {
  open: boolean;
  busy: boolean;
  accounts: Accumul8Account[];
  statementUploads: Accumul8StatementUpload[];
  ownerUserId: number;
  onClose: () => void;
  onUpload: (formData: FormData) => Promise<void>;
}

const DEFAULT_KIND: Accumul8StatementKind = 'bank_account';

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function formatDateRange(upload: Accumul8StatementUpload): string {
  if (upload.period_start && upload.period_end) {
    return `${upload.period_start} to ${upload.period_end}`;
  }
  if (upload.period_end) {
    return `Ending ${upload.period_end}`;
  }
  return 'Period not detected';
}

export function Accumul8StatementModal({
  open,
  busy,
  accounts,
  statementUploads,
  ownerUserId,
  onClose,
  onUpload,
}: Accumul8StatementModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [statementKind, setStatementKind] = React.useState<Accumul8StatementKind>(DEFAULT_KIND);
  const [accountId, setAccountId] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [modalApiRef, open]);

  React.useEffect(() => {
    if (!open) {
      setStatementKind(DEFAULT_KIND);
      setAccountId('');
      setFiles([]);
    }
  }, [open]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('accumul8-contact-modal-open', open);
    return () => document.body.classList.remove('accumul8-contact-modal-open');
  }, [open]);

  const sortedAccounts = React.useMemo(
    () => [...accounts].sort((a, b) => `${a.banking_organization_name} ${a.account_name}`.localeCompare(`${b.banking_organization_name} ${b.account_name}`)),
    [accounts],
  );

  const handleSubmit = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (files.length === 0) {
      return;
    }
    for (const file of files) {
      const formData = new FormData();
      formData.append('statement_kind', statementKind);
      if (accountId) {
        formData.append('account_id', accountId);
      }
      formData.append('statement_file', file);
      await onUpload(formData);
    }
    setFiles([]);
  }, [accountId, files, onUpload, statementKind]);

  return (
    <div className="modal fade accumul8-contact-modal accumul8-statement-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Bank Statements</h5>
            <ModalCloseIconButton />
          </div>
          <div className="modal-body">
            <div className="accumul8-statement-hero">
              <div className="accumul8-statement-hero-card">
                <strong>Upload and reconcile</strong>
                <p className="mb-0">Drop in statements for bank accounts, cards, loans, or mortgages. OCR extracts the text, the configured site AI normalizes it, Accumul8 imports the transactions, and suspicious outliers are flagged against roughly two years of history.</p>
              </div>
              <div className="accumul8-statement-hero-card">
                <strong>Best results</strong>
                <p className="mb-0">Select a target account when you know it. If you leave it blank, the importer tries to infer the account from the statement metadata and still records reconciliation notes when it needs review.</p>
              </div>
            </div>

            <form className="row g-3 mb-4" onSubmit={handleSubmit}>
              <div className="col-md-3">
                <label className="form-label" htmlFor="accumul8-statement-kind">Statement type</label>
                <select id="accumul8-statement-kind" className="form-select" value={statementKind} onChange={(event) => setStatementKind(event.target.value as Accumul8StatementKind)} disabled={busy}>
                  <option value="bank_account">Bank account</option>
                  <option value="credit_card">Credit card</option>
                  <option value="loan">Car loan / installment</option>
                  <option value="mortgage">Mortgage</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="col-md-5">
                <label className="form-label" htmlFor="accumul8-statement-account">Target account</label>
                <select id="accumul8-statement-account" className="form-select" value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={busy}>
                  <option value="">Let AI infer the account</option>
                  {sortedAccounts.map((account) => (
                    <option key={account.id} value={String(account.id)}>
                      {[account.banking_organization_name, account.account_name, account.mask_last4 ? `••${account.mask_last4}` : ''].filter(Boolean).join(' · ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-statement-files">Statement files</label>
                <input
                  id="accumul8-statement-files"
                  className="form-control"
                  type="file"
                  accept=".pdf,image/*"
                  multiple
                  disabled={busy}
                  onChange={(event) => setFiles(Array.from(event.target.files || []))}
                />
              </div>
              <div className="col-12">
                <div className="accumul8-statement-upload-actions">
                  <div className="small text-muted">
                    {files.length > 0 ? `${files.length} file(s) queued: ${files.map((file) => file.name).join(', ')}` : 'Choose one or more statements to process.'}
                  </div>
                  <button type="submit" className="btn btn-success" disabled={busy || files.length === 0}>Upload Statements</button>
                </div>
              </div>
            </form>

            <div className="accumul8-statement-history-head">
              <div>
                <h6 className="mb-1">Previous uploads</h6>
                <div className="small text-muted">Each upload keeps the original statement, reconciliation notes, and any suspicious-spend flags.</div>
              </div>
              <div className="small text-muted">Owner #{ownerUserId}</div>
            </div>

            <div className="accumul8-statement-history-list">
              {statementUploads.length === 0 ? (
                <div className="accumul8-statement-history-empty">No statements uploaded yet.</div>
              ) : statementUploads.map((upload) => (
                <article key={upload.id} className="accumul8-statement-history-card">
                  <div className="accumul8-statement-history-card-head">
                    <div>
                      <strong>{upload.original_filename}</strong>
                      <div className="small text-muted">
                        {[upload.statement_kind.replace('_', ' '), upload.account_name || 'Unmatched account', formatDateRange(upload), formatFileSize(upload.file_size_bytes)].join(' · ')}
                      </div>
                    </div>
                    <a
                      className="btn btn-sm btn-outline-primary"
                      href={`/api/accumul8.php?action=download_statement_upload&id=${upload.id}&owner_user_id=${ownerUserId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View
                    </a>
                  </div>
                  <div className="accumul8-statement-chip-row">
                    <span className={`accumul8-statement-chip is-${upload.status}`}>{upload.status}</span>
                    <span className={`accumul8-statement-chip is-${upload.reconciliation_status}`}>{upload.reconciliation_status}</span>
                    <span className="accumul8-statement-chip">{upload.imported_transaction_count} imported</span>
                    {upload.duplicate_transaction_count > 0 ? <span className="accumul8-statement-chip">{upload.duplicate_transaction_count} duplicates skipped</span> : null}
                    {upload.suspicious_item_count > 0 ? <span className="accumul8-statement-chip is-warning">{upload.suspicious_item_count} suspicious</span> : null}
                  </div>
                  {upload.reconciliation_note ? <div className="accumul8-statement-note">{upload.reconciliation_note}</div> : null}
                  {upload.processing_notes.length > 0 ? (
                    <div className="small text-muted">{upload.processing_notes.join(' ')}</div>
                  ) : null}
                  {upload.suspicious_items.length > 0 ? (
                    <div className="accumul8-statement-alert-list">
                      {upload.suspicious_items.slice(0, 4).map((alert, index) => (
                        <div key={`${upload.id}-${index}`} className="accumul8-statement-alert">
                          <strong>{alert.transaction_description || 'Suspicious item'}</strong>
                          <span>{[alert.transaction_date, alert.amount.toFixed(2), alert.reason].filter(Boolean).join(' · ')}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {upload.last_error ? <div className="accumul8-statement-error">{upload.last_error}</div> : null}
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

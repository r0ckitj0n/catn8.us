import React from 'react';
import { Accumul8StatementUpload } from '../../types/accumul8';
import './Accumul8StatementOcrDialog.css';

interface Accumul8StatementOcrDialogProps {
  open: boolean;
  upload: Accumul8StatementUpload;
  ownerUserId: number;
  onClose: () => void;
}

function formatAmount(value: number | null | undefined): string {
  return Number(value || 0).toFixed(2);
}

function formatPeriod(start: string | null | undefined, end: string | null | undefined): string {
  const left = String(start || '').trim();
  const right = String(end || '').trim();
  if (left && right) return `${left} to ${right}`;
  return left || right || 'Period not detected';
}

export function Accumul8StatementOcrDialog({
  open,
  upload,
  ownerUserId,
  onClose,
}: Accumul8StatementOcrDialogProps) {
  const ocrStatement = upload.ocr_statement;
  const verification = upload.catalog_verification;

  React.useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open || !ocrStatement) {
    return null;
  }

  const sourceHref = `/api/accumul8.php?action=download_statement_upload&id=${upload.id}&owner_user_id=${ownerUserId}`;

  return (
    <div className="accumul8-ocr-dialog-backdrop" role="dialog" aria-modal="true" aria-label={`OCR statement for ${upload.original_filename}`} onClick={onClose}>
      <div className="accumul8-ocr-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="accumul8-ocr-dialog__header">
          <div>
            <div className="accumul8-ocr-dialog__eyebrow">Digitally Reproduced Statement</div>
            <strong>{ocrStatement.original_filename}</strong>
            <div className="small text-muted">{[ocrStatement.institution_name || 'Institution not detected', formatPeriod(ocrStatement.period_start, ocrStatement.period_end), ocrStatement.statement_kind.replace('_', ' ')].join(' · ')}</div>
          </div>
          <div className="accumul8-ocr-dialog__actions">
            <a className="btn btn-sm btn-outline-secondary" href={sourceHref} target="_blank" rel="noreferrer">Source PDF</a>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={onClose}>Close</button>
          </div>
        </div>

        {verification ? (
          <div className={`accumul8-ocr-dialog__verification is-${verification.status}`}>
            <strong>Catalog Checksum</strong>
            <div className="small">{verification.summary}</div>
          </div>
        ) : null}

        <div className="accumul8-ocr-dialog__body">
          <div className="accumul8-ocr-dialog__summary">
            <div><span>Opening</span><strong>{ocrStatement.opening_balance !== null ? formatAmount(ocrStatement.opening_balance) : 'N/A'}</strong></div>
            <div><span>Closing</span><strong>{ocrStatement.closing_balance !== null ? formatAmount(ocrStatement.closing_balance) : 'N/A'}</strong></div>
            <div><span>Sections</span><strong>{ocrStatement.sections.length}</strong></div>
          </div>

          {ocrStatement.sections.map((section) => {
            const verificationSection = verification?.sections.find((candidate) => candidate.statement_account_label === section.statement_account_label);
            return (
              <section key={section.statement_account_label || `${section.statement_account_name_hint}-${section.statement_account_last4}`} className="accumul8-ocr-dialog__section">
                <div className="accumul8-ocr-dialog__section-head">
                  <div>
                    <strong>{section.statement_account_label || 'Unlabeled account section'}</strong>
                    <div className="small text-muted">
                      {[section.statement_account_name_hint || '', section.statement_account_last4 ? `••${section.statement_account_last4}` : '', `${section.rows.length} row(s)`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {verificationSection ? (
                    <div className={`accumul8-ocr-dialog__chip is-${verificationSection.status}`}>{verificationSection.status}</div>
                  ) : null}
                </div>

                <div className="accumul8-ocr-dialog__balances">
                  <div><span>Opening</span><strong>{section.opening_balance !== null ? formatAmount(section.opening_balance) : 'N/A'}</strong></div>
                  <div><span>Activity</span><strong>{verificationSection ? formatAmount(verificationSection.transaction_total) : 'N/A'}</strong></div>
                  <div><span>Expected Closing</span><strong>{verificationSection?.expected_closing_balance !== null && verificationSection?.expected_closing_balance !== undefined ? formatAmount(verificationSection.expected_closing_balance) : 'N/A'}</strong></div>
                  <div><span>Closing</span><strong>{section.closing_balance !== null ? formatAmount(section.closing_balance) : 'N/A'}</strong></div>
                  <div><span>Delta</span><strong>{verificationSection?.closing_delta !== null && verificationSection?.closing_delta !== undefined ? formatAmount(verificationSection.closing_delta) : 'N/A'}</strong></div>
                </div>

                {verificationSection?.note ? <div className="small text-muted">{verificationSection.note}</div> : null}

                {section.rows.length > 0 ? (
                  <div className="accumul8-ocr-dialog__table-wrap">
                    <table className="table table-sm accumul8-ocr-dialog__table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>Memo</th>
                          <th>Amount</th>
                          <th>Balance</th>
                          <th>Page</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row) => (
                          <tr key={`${section.statement_account_label}-${row.row_index}`}>
                            <td>{row.transaction_date || 'N/A'}</td>
                            <td>
                              <div>{row.description || 'Untitled transaction'}</div>
                              {row.reason ? <div className="accumul8-ocr-dialog__error">{row.reason}</div> : null}
                            </td>
                            <td>{row.memo || ' '}</td>
                            <td>{row.amount !== null ? formatAmount(row.amount) : 'N/A'}</td>
                            <td>{row.running_balance !== null ? formatAmount(row.running_balance) : 'N/A'}</td>
                            <td>{row.page_number || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="small text-muted">No transaction rows were cataloged for this account section.</div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

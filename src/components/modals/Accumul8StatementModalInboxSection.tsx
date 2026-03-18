import React from 'react';

import { Accumul8StatementUpload } from '../../types/accumul8';
import { StatementHistoryPanel } from './Accumul8StatementHistoryCard';
import { Accumul8StatementPickerItem } from './Accumul8StatementPickerItem';
import { Accumul8StatementPlanCard } from './Accumul8StatementPlanCard';
import { formatStatementDateRange, formatStatementFileSize } from './accumul8StatementUtils';
import { StatementWorkspaceData, StatementWorkspacePanel, StatementWorkspaceRow } from './accumul8StatementWorkspaceUtils';

interface Accumul8StatementModalInboxSectionProps {
  activeReviewUpload: Accumul8StatementUpload | null;
  activeWorkspace: StatementWorkspaceData | null;
  busy: boolean;
  latestAuditRunSummary?: React.ReactNode;
  latestImportResultSummary?: React.ReactNode;
  onAcceptRow: (upload: Accumul8StatementUpload, row: StatementWorkspaceRow) => Promise<void>;
  onArchiveUpload: (upload: Accumul8StatementUpload) => void;
  onConfirmImport: (upload: Accumul8StatementUpload) => void;
  onDeleteTransaction: (id: number, description: string) => void;
  onDismissRow: (uploadId: number, rowKey: string) => void;
  onHandleReconcile: (upload: Accumul8StatementUpload) => void;
  onLinkRow: (upload: Accumul8StatementUpload, row: StatementWorkspaceRow, transactionId: number | null) => Promise<void>;
  onOpenReview: (uploadId: number) => void;
  onOpenTransaction: (id: number) => void;
  onOpenWorkspace: (uploadId: number, panel: Exclude<StatementHistoryPanel, 'status' | null>) => void;
  onRescan: (uploadId: number) => void;
  ownerUserId: number;
  pendingUploads: Accumul8StatementUpload[];
  selectedWorkspacePanel: StatementWorkspacePanel;
  setSelectedWorkspacePanel: (panel: StatementWorkspacePanel) => void;
  workspaceByUploadId: Record<number, StatementWorkspaceData>;
}

function workspaceRows(workspace: StatementWorkspaceData, panel: StatementWorkspacePanel) {
  if (panel === 'review') return workspace.review;
  if (panel === 'imported') return workspace.imported;
  if (panel === 'duplicates') return workspace.duplicates;
  if (panel === 'failed') return workspace.failed;
  if (panel === 'suspicious') return workspace.suspicious;
  return [];
}

export function Accumul8StatementModalInboxSection({
  activeReviewUpload,
  activeWorkspace,
  busy,
  latestAuditRunSummary,
  latestImportResultSummary,
  onAcceptRow,
  onArchiveUpload,
  onConfirmImport,
  onDeleteTransaction,
  onDismissRow,
  onHandleReconcile,
  onLinkRow,
  onOpenReview,
  onOpenTransaction,
  onOpenWorkspace,
  onRescan,
  ownerUserId,
  pendingUploads,
  selectedWorkspacePanel,
  setSelectedWorkspacePanel,
  workspaceByUploadId,
}: Accumul8StatementModalInboxSectionProps) {
  return (
    <section className="accumul8-statement-panel accumul8-statement-workspace-shell">
      <div className="accumul8-statement-section-head">
        <div>
          <strong>Review inbox</strong>
          <div className="small text-muted">Work only the statements that still need action, then leave the full history in the library.</div>
        </div>
        {latestImportResultSummary}
        {latestAuditRunSummary}
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
                  <Accumul8StatementPickerItem
                    key={`inbox-${upload.id}`}
                    upload={upload}
                    active={activeReviewUpload?.id === upload.id}
                    reviewCount={workspace?.review.length || 0}
                    failedCount={workspace?.failed.length || 0}
                    suspiciousCount={workspace?.suspicious.length || 0}
                    onClick={() => onOpenReview(upload.id)}
                    onDiscard={() => onArchiveUpload(upload)}
                    discardDisabled={busy}
                  />
                );
              })}
            </div>
          </div>
          <div className="accumul8-statement-detail-column">
            {activeReviewUpload ? (
              <section id={`accumul8-statement-review-${activeReviewUpload.id}`} className="accumul8-statement-review-section">
                <Accumul8StatementPlanCard
                  key={`plan-${activeReviewUpload.id}`}
                  busy={busy}
                  ownerUserId={ownerUserId}
                  upload={activeReviewUpload}
                  onRescan={() => onRescan(activeReviewUpload.id)}
                  onDiscard={() => onArchiveUpload(activeReviewUpload)}
                  onConfirm={() => onConfirmImport(activeReviewUpload)}
                  onReconcile={() => onHandleReconcile(activeReviewUpload)}
                  onOpenWorkspace={(panel) => onOpenWorkspace(activeReviewUpload.id, panel)}
                  formatDateRange={formatStatementDateRange}
                  formatFileSize={formatStatementFileSize}
                  rightColumn={activeWorkspace ? (
                    <div className="accumul8-statement-chip-stack accumul8-statement-chip-stack--right">
                      {(['review', 'imported', 'duplicates', 'failed', 'suspicious'] as const).map((panel) => (
                        <button key={panel} type="button" className={`accumul8-statement-chip accumul8-statement-chip-button${selectedWorkspacePanel === panel ? ' is-active' : ''}`} onClick={() => setSelectedWorkspacePanel(panel)}>
                          {panel} {workspaceRows(activeWorkspace, panel).length}
                        </button>
                      ))}
                      <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button${selectedWorkspacePanel === 'reconciliation' ? ' is-active' : ''}`} onClick={() => onHandleReconcile(activeReviewUpload)}>reconciliation</button>
                    </div>
                  ) : null}
                />
                {activeWorkspace ? (
                  <section className="accumul8-statement-workspace">
                    <div className="accumul8-statement-workspace-main">
                      {selectedWorkspacePanel === 'reconciliation' ? (
                        <div className="accumul8-statement-detail-panel">
                          <strong>Reconciliation</strong>
                          <div className="small text-muted">{activeReviewUpload.reconciliation_runs[0]?.summary_text || activeReviewUpload.reconciliation_note || 'No reconciliation note is available yet.'}</div>
                          {activeReviewUpload.reconciliation_runs[0]?.details.length ? (
                            <div className="accumul8-statement-detail-list mt-2">
                              {activeReviewUpload.reconciliation_runs[0].details.map((detail) => (
                                <div key={`reconciliation-${detail.row_index}-${detail.transaction_id || detail.description}`} className="accumul8-statement-detail-row">
                                  <div className="accumul8-statement-detail-main">
                                    <div className="accumul8-statement-detail-title">
                                      <span>{detail.description || 'Statement row'}</span>
                                      <span className="accumul8-statement-detail-amount">{Number(detail.amount || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="small text-muted">{[detail.statement_account_label || '', detail.transaction_date || 'No date', detail.result || '', detail.details || ''].filter(Boolean).join(' · ')}</div>
                                  </div>
                                  <div className="accumul8-statement-detail-actions">
                                    {detail.transaction_id ? <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onOpenTransaction(detail.transaction_id || 0)}>Open ledger entry</button> : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="accumul8-statement-detail-panel">
                          <strong>{selectedWorkspacePanel === 'review' ? 'Review queue' : selectedWorkspacePanel === 'imported' ? 'Imported rows' : selectedWorkspacePanel === 'duplicates' ? 'Duplicate candidates' : selectedWorkspacePanel === 'failed' ? 'Failed or invalid rows' : 'Suspicious rows'}</strong>
                          <div className="accumul8-statement-detail-list">
                            {workspaceRows(activeWorkspace, selectedWorkspacePanel).map((row) => {
                              const pageHref = row.page_number ? `/api/accumul8.php?action=download_statement_upload&id=${activeReviewUpload.id}&owner_user_id=${ownerUserId}#page=${row.page_number}` : '';
                              const targetId = row.linkedTransactionId || row.matchedTransactionId || null;
                              return (
                                <div key={row.row_key} className="accumul8-statement-detail-row">
                                  <div className="accumul8-statement-detail-main">
                                    <div className="accumul8-statement-detail-title">
                                      <span>{row.description || 'Untitled transaction'}</span>
                                      <span className="accumul8-statement-detail-amount">{Number(row.amount || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="small text-muted">{[row.statement_account_label || '', row.transaction_date || 'No date', row.page_number ? `Page ${row.page_number}` : '', row.running_balance !== undefined && row.running_balance !== null ? `Balance ${Number(row.running_balance).toFixed(2)}` : ''].filter(Boolean).join(' · ')}</div>
                                    {row.reason ? <div className="accumul8-statement-error mt-1">{row.reason}</div> : null}
                                    {row.memo ? <div className="small text-muted mt-1">{row.memo}</div> : null}
                                  </div>
                                  <div className="accumul8-statement-detail-actions">
                                    {pageHref ? <a className="btn btn-sm btn-outline-secondary" href={pageHref} target="_blank" rel="noreferrer">Open statement page</a> : null}
                                    {targetId ? <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onOpenTransaction(targetId)}>Open ledger entry</button> : null}
                                    {selectedWorkspacePanel !== 'imported' && selectedWorkspacePanel !== 'suspicious' ? <button type="button" className="btn btn-sm btn-success" disabled={busy} onClick={() => void onAcceptRow(activeReviewUpload, row)}>Accept proposed transaction</button> : null}
                                    {selectedWorkspacePanel === 'duplicates' && row.matchedTransactionId ? <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy} onClick={() => void onLinkRow(activeReviewUpload, row, row.matchedTransactionId)}>Link existing entry</button> : null}
                                    {selectedWorkspacePanel === 'imported' && row.linkedTransactionId ? <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => onDeleteTransaction(row.linkedTransactionId || 0, row.description || 'Imported transaction')}>Delete malformed import</button> : null}
                                    {selectedWorkspacePanel !== 'imported' && selectedWorkspacePanel !== 'suspicious' ? <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => onDismissRow(activeReviewUpload.id, row.row_key)}>{selectedWorkspacePanel === 'duplicates' ? 'Keep skipped' : 'Dismiss from review'}</button> : null}
                                  </div>
                                </div>
                              );
                            })}
                            {workspaceRows(activeWorkspace, selectedWorkspacePanel).length === 0 ? <div className="small text-muted">No rows in this review set.</div> : null}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

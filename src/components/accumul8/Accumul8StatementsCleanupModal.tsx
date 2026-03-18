import React from 'react';

import { Accumul8ImportedTransactionCleanupReport } from '../../types/accumul8';

interface Accumul8StatementsCleanupModalProps {
  busy: boolean;
  cleanupModalOpen: boolean;
  cleanupReport: Accumul8ImportedTransactionCleanupReport | null;
  cleanupSelectedIds: number[];
  recommendedCleanupIds: number[];
  setCleanupModalOpen: (open: boolean) => void;
  setCleanupSelectedIds: React.Dispatch<React.SetStateAction<number[]>>;
  onPurgeImportedCleanup: (cleanupSelectedIds: number[]) => void;
}

export function Accumul8StatementsCleanupModal({
  busy,
  cleanupModalOpen,
  cleanupReport,
  cleanupSelectedIds,
  recommendedCleanupIds,
  setCleanupModalOpen,
  setCleanupSelectedIds,
  onPurgeImportedCleanup,
}: Accumul8StatementsCleanupModalProps) {
  if (!cleanupModalOpen) {
    return null;
  }

  return (
    <div className="accumul8-help-overlay" role="dialog" aria-modal="true" aria-label="Imported transaction cleanup audit" onClick={() => setCleanupModalOpen(false)}>
      <div className="accumul8-help-modal accumul8-import-cleanup-modal" onClick={(event) => event.stopPropagation()}>
        <div className="accumul8-settings-modal-header">
          <div>
            <h2 className="accumul8-settings-modal-title mb-0">Imported Transaction Cleanup</h2>
            <div className="small text-muted">{cleanupReport?.summary_text || 'Review imported transaction cleanup candidates.'}</div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setCleanupModalOpen(false)}>Close</button>
        </div>
        <div className="accumul8-import-cleanup-modal__body">
          {cleanupReport ? (
            <>
              <div className="accumul8-statement-chip-row">
                <span className="accumul8-statement-chip is-warning">{cleanupReport.total_candidates} candidate{cleanupReport.total_candidates === 1 ? '' : 's'}</span>
                <span className="accumul8-statement-chip is-processed">{cleanupReport.safe_candidate_count} recommended</span>
                {cleanupReport.category_counts.map((category) => (
                  <span key={category.category} className={`accumul8-statement-chip${category.safe_to_purge ? ' is-processed' : ''}`}>{category.category_label}: {category.count}</span>
                ))}
              </div>
              <div className="accumul8-import-cleanup-modal__actions">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setCleanupSelectedIds(recommendedCleanupIds)} disabled={busy}>Select Recommended</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setCleanupSelectedIds(cleanupReport.candidates.map((candidate) => candidate.transaction_id))} disabled={busy}>Select All</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setCleanupSelectedIds([])} disabled={busy}>Clear</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => onPurgeImportedCleanup(cleanupSelectedIds)} disabled={busy || cleanupSelectedIds.length === 0}>Purge Selected ({cleanupSelectedIds.length})</button>
              </div>
              <div className="accumul8-import-cleanup-modal__list">
                {cleanupReport.candidates.length > 0 ? cleanupReport.candidates.map((candidate) => {
                  const selected = cleanupSelectedIds.includes(candidate.transaction_id);
                  return (
                    <label key={candidate.transaction_id} className={`accumul8-import-cleanup-row${selected ? ' is-selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => {
                          setCleanupSelectedIds((current) => (
                            event.target.checked
                              ? [...current, candidate.transaction_id]
                              : current.filter((value) => value !== candidate.transaction_id)
                          ));
                        }}
                      />
                      <div className="accumul8-import-cleanup-row__content">
                        <div className="accumul8-import-cleanup-row__head">
                          <strong>{candidate.description || 'Imported transaction'}</strong>
                          <span className={`accumul8-statement-chip${candidate.safe_to_purge ? ' is-processed' : ' is-warning'}`}>{candidate.category_label}</span>
                        </div>
                        <div className="small text-muted">
                          {[candidate.transaction_date, candidate.account_name || 'Unknown account', candidate.banking_organization_name || candidate.source_kind, candidate.amount.toFixed(2)].filter(Boolean).join(' · ')}
                        </div>
                        <div className="small text-muted">{candidate.reason}</div>
                        {candidate.teller_history_start && candidate.teller_history_end ? (
                          <div className="small text-muted">Teller history: {candidate.teller_history_start} to {candidate.teller_history_end}</div>
                        ) : null}
                      </div>
                    </label>
                  );
                }) : (
                  <div className="accumul8-statement-history-empty">No imported transactions need cleanup right now.</div>
                )}
              </div>
            </>
          ) : (
            <div className="accumul8-statement-history-empty">Run the cleanup audit to load imported transaction candidates.</div>
          )}
        </div>
      </div>
    </div>
  );
}

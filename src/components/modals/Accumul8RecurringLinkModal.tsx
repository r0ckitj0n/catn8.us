import React from 'react';

import {
  Accumul8RecurringLinkCandidatesResponse,
  Accumul8RecurringLinkHistoryResponse,
  Accumul8RecurringLinkRequest,
  Accumul8RecurringPayment,
  Accumul8Transaction,
} from '../../types/accumul8';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';

interface Accumul8RecurringLinkModalProps {
  open: boolean;
  busy: boolean;
  recurring: Accumul8RecurringPayment | null;
  onClose: () => void;
  onLink: (payload: Accumul8RecurringLinkRequest) => Promise<unknown>;
  onLoadCandidates: (recurringId: number, query?: string) => Promise<Accumul8RecurringLinkCandidatesResponse>;
  onLoadHistory: (recurringId: number, query?: string) => Promise<Accumul8RecurringLinkHistoryResponse>;
  onOpenTransaction?: (transactionId: number) => void;
}

function formatRecurringLinkAmount(amount: number): string {
  const value = Number(amount || 0);
  return `${value < 0 ? '-' : ''}$${Math.abs(value).toFixed(2)}`;
}

function formatRecurringLinkDate(transaction: Accumul8Transaction): string {
  return String(transaction.due_date || transaction.transaction_date || '').trim() || 'No date';
}

export function Accumul8RecurringLinkModal({
  open,
  busy,
  recurring,
  onClose,
  onLink,
  onLoadCandidates,
  onLoadHistory,
  onOpenTransaction,
}: Accumul8RecurringLinkModalProps) {
  const [candidateQuery, setCandidateQuery] = React.useState('');
  const [historyQuery, setHistoryQuery] = React.useState('');
  const [candidateRows, setCandidateRows] = React.useState<Accumul8Transaction[]>([]);
  const [historyRows, setHistoryRows] = React.useState<Accumul8Transaction[]>([]);
  const [loadingCandidates, setLoadingCandidates] = React.useState(false);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [candidateError, setCandidateError] = React.useState('');
  const [historyError, setHistoryError] = React.useState('');
  const [linkingTransactionId, setLinkingTransactionId] = React.useState<number | null>(null);

  const recurringId = Number(recurring?.id || 0);

  React.useEffect(() => {
    if (!open) {
      setCandidateQuery('');
      setHistoryQuery('');
      setCandidateRows([]);
      setHistoryRows([]);
      setCandidateError('');
      setHistoryError('');
      setLinkingTransactionId(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || recurringId <= 0) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setLoadingCandidates(true);
      setCandidateError('');
      void onLoadCandidates(recurringId, candidateQuery.trim())
        .then((response) => setCandidateRows(Array.isArray(response.transactions) ? response.transactions : []))
        .catch((error: any) => {
          setCandidateRows([]);
          setCandidateError(String(error?.message || 'Failed to load ledger candidates.'));
        })
        .finally(() => setLoadingCandidates(false));
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [candidateQuery, onLoadCandidates, open, recurringId]);

  React.useEffect(() => {
    if (!open || recurringId <= 0) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setLoadingHistory(true);
      setHistoryError('');
      void onLoadHistory(recurringId, historyQuery.trim())
        .then((response) => setHistoryRows(Array.isArray(response.transactions) ? response.transactions : []))
        .catch((error: any) => {
          setHistoryRows([]);
          setHistoryError(String(error?.message || 'Failed to load recurring history.'));
        })
        .finally(() => setLoadingHistory(false));
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [historyQuery, onLoadHistory, open, recurringId]);

  React.useEffect(() => {
    if (!open || typeof window === 'undefined') {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, open]);

  const handleLink = React.useCallback(async (transactionId: number) => {
    if (recurringId <= 0 || transactionId <= 0) {
      return;
    }
    setLinkingTransactionId(transactionId);
    try {
      await onLink({ recurring_id: recurringId, transaction_id: transactionId });
      const [candidatesResponse, historyResponse] = await Promise.all([
        onLoadCandidates(recurringId, candidateQuery.trim()),
        onLoadHistory(recurringId, historyQuery.trim()),
      ]);
      setCandidateRows(Array.isArray(candidatesResponse.transactions) ? candidatesResponse.transactions : []);
      setHistoryRows(Array.isArray(historyResponse.transactions) ? historyResponse.transactions : []);
    } finally {
      setLinkingTransactionId(null);
    }
  }, [candidateQuery, historyQuery, onLink, onLoadCandidates, onLoadHistory, recurringId]);

  if (!open || !recurring) {
    return null;
  }

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div
        className="modal fade show"
        tabIndex={-1}
        aria-hidden={!open}
        aria-modal="true"
        role="dialog"
        style={{ display: 'block' }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <div className="fw-bold">Teach Recurring Match</div>
                <div className="small text-muted">
                  Link a real ledger transaction to <strong>{recurring.title}</strong>, then Accumul8 will reuse that example and show linked history here.
                </div>
              </div>
              <ModalCloseIconButton onClick={onClose} />
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-12 col-lg-6">
                  <div className="card h-100 shadow-sm">
                    <div className="card-body d-flex flex-column gap-3">
                      <div>
                        <div className="fw-semibold">Ledger Candidates</div>
                        <div className="small text-muted">Search the ledger, then teach this recurring rule from a real example.</div>
                      </div>
                      <input
                        type="text"
                        className="form-control"
                        value={candidateQuery}
                        onChange={(event) => setCandidateQuery(event.target.value)}
                        placeholder="Filter candidate ledger entries"
                        aria-label="Filter candidate ledger entries"
                      />
                      {candidateError ? <div className="alert alert-danger py-2 mb-0">{candidateError}</div> : null}
                      {loadingCandidates ? <div className="text-muted">Loading candidate transactions...</div> : null}
                      {!loadingCandidates && candidateRows.length === 0 ? <div className="text-muted">No candidate ledger entries found.</div> : null}
                      {!loadingCandidates && candidateRows.length > 0 ? (
                        <div className="d-flex flex-column gap-2">
                          {candidateRows.map((transaction) => (
                            <article key={`candidate-${transaction.id}`} className="card border-0 bg-light-subtle">
                              <div className="card-body py-3">
                                <div className="d-flex justify-content-between align-items-start gap-3">
                                  <div>
                                    <div className="fw-semibold">{transaction.description || 'Untitled transaction'}</div>
                                    <div className="small text-muted">
                                      {formatRecurringLinkDate(transaction)} · {transaction.account_name || 'No account'} · {transaction.entity_name || transaction.contact_name || transaction.debtor_name || 'No entity'}
                                    </div>
                                    {transaction.memo ? <div className="small text-muted mt-1">{transaction.memo}</div> : null}
                                  </div>
                                  <div className="text-end">
                                    <div className="fw-semibold">{formatRecurringLinkAmount(transaction.amount)}</div>
                                    <div className="small text-muted text-uppercase">{transaction.source_kind || 'manual'}</div>
                                  </div>
                                </div>
                                <div className="d-flex justify-content-end gap-2 mt-3">
                                  {onOpenTransaction ? (
                                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onOpenTransaction(transaction.id)} disabled={busy || linkingTransactionId !== null}>
                                      Open
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => void handleLink(transaction.id)}
                                    disabled={busy || linkingTransactionId === transaction.id}
                                  >
                                    {linkingTransactionId === transaction.id ? 'Linking...' : 'Teach From This Entry'}
                                  </button>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="col-12 col-lg-6">
                  <div className="card h-100 shadow-sm">
                    <div className="card-body d-flex flex-column gap-3">
                      <div>
                        <div className="fw-semibold">Linked History</div>
                        <div className="small text-muted">All ledger entries currently tied to this recurring rule.</div>
                      </div>
                      <input
                        type="text"
                        className="form-control"
                        value={historyQuery}
                        onChange={(event) => setHistoryQuery(event.target.value)}
                        placeholder="Filter linked history"
                        aria-label="Filter linked history"
                      />
                      {historyError ? <div className="alert alert-danger py-2 mb-0">{historyError}</div> : null}
                      {loadingHistory ? <div className="text-muted">Loading recurring history...</div> : null}
                      {!loadingHistory && historyRows.length === 0 ? <div className="text-muted">No linked history yet.</div> : null}
                      {!loadingHistory && historyRows.length > 0 ? (
                        <div className="d-flex flex-column gap-2">
                          {historyRows.map((transaction) => (
                            <article key={`history-${transaction.id}`} className="card border-0 bg-light-subtle">
                              <div className="card-body py-3">
                                <div className="d-flex justify-content-between align-items-start gap-3">
                                  <div>
                                    <div className="fw-semibold">{transaction.description || 'Untitled transaction'}</div>
                                    <div className="small text-muted">
                                      {formatRecurringLinkDate(transaction)} · {transaction.account_name || 'No account'} · {transaction.entity_name || transaction.contact_name || transaction.debtor_name || 'No entity'}
                                    </div>
                                    {transaction.memo ? <div className="small text-muted mt-1">{transaction.memo}</div> : null}
                                  </div>
                                  <div className="text-end">
                                    <div className="fw-semibold">{formatRecurringLinkAmount(transaction.amount)}</div>
                                    <div className="small text-muted text-uppercase">{transaction.source_kind || 'manual'}</div>
                                  </div>
                                </div>
                                {onOpenTransaction ? (
                                  <div className="d-flex justify-content-end mt-3">
                                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onOpenTransaction(transaction.id)} disabled={busy || linkingTransactionId !== null}>
                                      Open
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

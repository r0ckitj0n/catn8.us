import React from 'react';

import { StandardIconButton } from '../../common/StandardIconButton';
import { Accumul8Entity, Accumul8MessageBoardMessage, Accumul8Transaction } from '../../../types/accumul8';
import { OpeningBalanceMessageMeta, formatCurrencyAmount, formatInlineDate, formatInlineDateTime, formatInlineText, getOpeningBalanceMessageMeta } from './accumul8PageDateSearchUtils';
import { getLedgerDescriptionLabel } from './accumul8PageEntityUtils';

type EntityEndexLog = {
  id: number;
  conflict_count: number;
  created_at: string;
  created_count: number;
  items: Array<{
    alias_name: string;
    parent_entity_id: number;
    parent_name: string;
    status: 'created' | 'updated';
  }>;
  scanned_entity_count: number;
  summary_text: string;
  touched_entity_count: number;
  updated_count: number;
};

interface Accumul8PageOverlaysProps {
  acknowledgeAllMessageBoardMessages: () => Promise<unknown>;
  acknowledgeMessageBoardMessage: (id: number) => Promise<unknown>;
  beginEditEntity: (id: number) => void;
  beginViewTransaction: (id: number) => void;
  formatAccountDisplayName: (accountId: number | null | undefined, accountName?: string | null, bankingOrganizationName?: string | null) => string;
  formatInlineDate: typeof formatInlineDate;
  formatInlineDateTime: typeof formatInlineDateTime;
  loadMessageBoard: () => Promise<unknown>;
  messageBoardLoading: boolean;
  messageBoardMessages: Accumul8MessageBoardMessage[];
  messageBoardOpen: boolean;
  messageBoardUnacknowledgedCount: number;
  onCloseEntityEndexLog: () => void;
  onCloseEntityHistory: () => void;
  onCloseMessageBoard: () => void;
  onCloseSyncHelp: () => void;
  onOpenStatementImportFallback: () => void;
  onOpenTransactionFromMessageBoard: (transactionId: number) => void;
  selectedEntityHistory: Accumul8Entity | null;
  selectedEntityTransactions: Accumul8Transaction[];
  setTabToLedger: () => void;
  syncHelpError: string;
  syncHelpOpen: boolean;
  syncHelpToken: string;
  entityEndexLogOpen: boolean;
  entityEndexScanLogs: EntityEndexLog[];
}

function getMessageSourceEmoji(message: Accumul8MessageBoardMessage) {
  switch (message.source_kind) {
    case 'aicountant_housekeeping':
      return '🧹';
    case 'aicountant_watchlist':
      return '👀';
    case 'aicountant_balance_books':
      return '🏦';
    case 'aicountant_opening_balance':
      return '⚖️';
    case 'aicountant_entity_maintenance':
      return '🧠';
    default:
      return '📌';
  }
}

function renderOpeningBalanceMeta(meta: OpeningBalanceMessageMeta) {
  return (
    <div className="accumul8-message-board-item-meta">
      {meta.accountName ? <span>Account: {meta.accountName}</span> : null}
      {meta.transactionDate ? <span>Adjustment date: {formatInlineDate(meta.transactionDate)}</span> : null}
      {meta.adjustmentAmount !== null ? <span>Adjustment: {formatCurrencyAmount(meta.adjustmentAmount)}</span> : null}
      {meta.priorLedgerBalance !== null ? <span>Ledger before: {formatCurrencyAmount(meta.priorLedgerBalance)}</span> : null}
      {meta.bankBalance !== null ? <span>Bank target: {formatCurrencyAmount(meta.bankBalance)}</span> : null}
    </div>
  );
}

export function Accumul8PageOverlays({
  acknowledgeAllMessageBoardMessages,
  acknowledgeMessageBoardMessage,
  beginEditEntity,
  beginViewTransaction,
  formatAccountDisplayName,
  loadMessageBoard,
  messageBoardLoading,
  messageBoardMessages,
  messageBoardOpen,
  messageBoardUnacknowledgedCount,
  onCloseEntityEndexLog,
  onCloseEntityHistory,
  onCloseMessageBoard,
  onCloseSyncHelp,
  onOpenStatementImportFallback,
  onOpenTransactionFromMessageBoard,
  selectedEntityHistory,
  selectedEntityTransactions,
  setTabToLedger,
  syncHelpError,
  syncHelpOpen,
  syncHelpToken,
  entityEndexLogOpen,
  entityEndexScanLogs,
}: Accumul8PageOverlaysProps) {
  return (
    <>
      {messageBoardOpen && (
        <div className="accumul8-help-overlay" role="dialog" aria-modal="true" aria-label="AIcountant message board" onClick={onCloseMessageBoard}>
          <div className="accumul8-help-modal accumul8-message-board-modal" onClick={(e) => e.stopPropagation()}>
            <div className="accumul8-settings-modal-header">
              <div>
                <h2 className="accumul8-settings-modal-title mb-0">AIcountant Message Board</h2>
                <div className="small text-muted">
                  {messageBoardUnacknowledgedCount} unacknowledged message{messageBoardUnacknowledgedCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={() => { void acknowledgeAllMessageBoardMessages(); }}
                  disabled={messageBoardLoading || messageBoardUnacknowledgedCount <= 0}
                >
                  Acknowledge All
                </button>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { void loadMessageBoard(); }} disabled={messageBoardLoading}>Refresh</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCloseMessageBoard}>Close</button>
              </div>
            </div>
            <div className="accumul8-message-board-list">
              {messageBoardMessages.map((message) => {
                const openingBalanceMeta = getOpeningBalanceMessageMeta(message);
                const duplicateCount = Math.max(1, Number(message.duplicate_count || 1));
                const sourceEmoji = getMessageSourceEmoji(message);
                return (
                  <label key={message.id} className={`accumul8-message-board-item is-${message.message_level}${Number(message.is_acknowledged || 0) === 1 ? ' is-acknowledged' : ''}`}>
                    <div className="accumul8-message-board-item-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={Number(message.is_acknowledged || 0) === 1}
                        disabled={Number(message.is_acknowledged || 0) === 1 || messageBoardLoading}
                        onChange={() => {
                          void acknowledgeMessageBoardMessage(message.id);
                        }}
                        aria-label={`Acknowledge ${message.title || 'message'}`}
                      />
                    </div>
                    <div className="accumul8-message-board-item-body">
                      <div className="accumul8-message-board-item-header">
                        <strong>
                          <span aria-hidden="true">{sourceEmoji}</span>{' '}
                          {duplicateCount > 1 ? <span aria-hidden="true">🔁 </span> : null}
                          {message.title || 'Update'}
                          {duplicateCount > 1 ? ` x${duplicateCount}` : ''}
                        </strong>
                        <span>{formatInlineDateTime(message.created_at)}</span>
                      </div>
                      <div className="accumul8-message-board-item-text">{message.body_text}</div>
                      {openingBalanceMeta ? renderOpeningBalanceMeta(openingBalanceMeta) : null}
                      {openingBalanceMeta?.transactionId ? (
                        <div className="accumul8-message-board-item-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setTabToLedger();
                              onOpenTransactionFromMessageBoard(openingBalanceMeta.transactionId || 0);
                              onCloseMessageBoard();
                            }}
                          >
                            Open ledger entry
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </label>
                );
              })}
              {!messageBoardMessages.length ? (
                <div className="text-muted">No message board items yet.</div>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {syncHelpOpen && (
        <div className="accumul8-help-overlay" role="dialog" aria-modal="true" aria-label="Teller setup guide">
          <div className="accumul8-help-modal">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <h4 className="h6 mb-0">Teller Sync Setup Guide</h4>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCloseSyncHelp}>Close</button>
            </div>
            {syncHelpError ? <div className="alert alert-warning py-2"><strong>Current error:</strong> {syncHelpError}</div> : null}
            {syncHelpToken ? <div className="alert alert-success py-2"><strong>Teller application loaded:</strong> <code>{syncHelpToken.slice(0, 40)}...</code></div> : null}
            <ol className="mb-2 ps-3">
              <li>Create your Teller application credentials in <a href="https://teller.io/dashboard" target="_blank" rel="noreferrer">Teller Dashboard</a>.</li>
              <li>Save your Teller Application ID, certificate PEM, private key PEM, and environment in Settings.</li>
              <li>Click <strong>Connect Bank via Teller</strong> in this tab.</li>
              <li>Complete Teller Connect and authorize your institution.</li>
              <li>Accumul8 will automatically exchange token, save the connection, and sync transactions.</li>
            </ol>
            <div className="alert alert-info py-2">
              If Teller shows a message like &quot;no suitable accounts,&quot; the institution/login did not expose any eligible accounts for Teller sync. Accumul8 cannot force that connection, so import those accounts from the Bank Statements tab instead.
              <div className="mt-2">
                <strong>Fifth Third / Truist guidance:</strong> Chase credit cards can sync through Teller, but some Fifth Third and Truist credit-card logins are still getting rejected inside Teller Connect before Accumul8 receives any account metadata. When that happens, statement import is the reliable fallback path.
              </div>
              <div className="mt-2">
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={onOpenStatementImportFallback}>Go To Bank Statements</button>
              </div>
            </div>
            <div className="small">
              Quick references: <a href="https://teller.io/docs/connect" target="_blank" rel="noreferrer">Teller Connect</a> | <a href="https://teller.io/docs/api" target="_blank" rel="noreferrer">Teller API</a>
            </div>
          </div>
        </div>
      )}
      {selectedEntityHistory && (
        <div className="accumul8-help-overlay" role="dialog" aria-modal="true" aria-label={`${selectedEntityHistory.display_name} transactions`} onClick={onCloseEntityHistory}>
          <div className="accumul8-help-modal accumul8-entity-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="accumul8-settings-modal-header">
              <div>
                <h2 className="accumul8-settings-modal-title mb-0">{selectedEntityHistory.display_name}</h2>
                <div className="small text-muted">
                  {selectedEntityTransactions.length} linked transaction{selectedEntityTransactions.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <StandardIconButton
                  iconKey="edit"
                  ariaLabel={`Edit ${selectedEntityHistory.display_name}`}
                  title={`Edit ${selectedEntityHistory.display_name}`}
                  className="btn btn-outline-primary btn-sm catn8-action-icon-btn"
                  onClick={() => {
                    onCloseEntityHistory();
                    beginEditEntity(selectedEntityHistory.id);
                  }}
                />
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCloseEntityHistory}>Close</button>
              </div>
            </div>
            <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--cards">
              <table className="table table-sm accumul8-table accumul8-entity-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Memo</th>
                    <th>Account</th>
                    <th className="text-end">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEntityTransactions.map((tx) => (
                    <tr key={tx.id} className={Number(tx.amount || 0) < 0 ? 'is-outflow' : 'is-inflow'}>
                      <td>{formatInlineDate(tx.transaction_date || tx.due_date)}</td>
                      <td>{getLedgerDescriptionLabel(tx)}</td>
                      <td>{formatInlineText(tx.memo, '-')}</td>
                      <td>{formatAccountDisplayName(tx.account_id, tx.account_name, tx.banking_organization_name)}</td>
                      <td className="text-end">{Number(tx.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  {selectedEntityTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">No transactions are linked to this entity yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {entityEndexLogOpen && (
        <div className="accumul8-help-overlay" role="dialog" aria-modal="true" aria-label="Entity Endex scan history" onClick={onCloseEntityEndexLog}>
          <div className="accumul8-help-modal accumul8-entity-endex-log-modal" onClick={(e) => e.stopPropagation()}>
            <div className="accumul8-settings-modal-header">
              <div>
                <h2 className="accumul8-settings-modal-title mb-0">Entity Endex Scan History</h2>
                <div className="small text-muted">Recent global runs and the parent-to-alias changes they made.</div>
              </div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCloseEntityEndexLog}>Close</button>
            </div>
            <div className="accumul8-entity-endex-log-list accumul8-scroll-area accumul8-scroll-area--cards">
              {entityEndexScanLogs.length > 0 ? entityEndexScanLogs.map((log) => (
                <section key={log.id} className="accumul8-entity-endex-log-card">
                  <div className="accumul8-entity-endex-log-card-head">
                    <div>
                      <strong>{formatInlineDate(log.created_at)}</strong>
                      <div className="small text-muted">{log.summary_text}</div>
                    </div>
                    <div className="small text-muted">
                      {log.created_count + log.updated_count} change{log.created_count + log.updated_count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="accumul8-entity-endex-log-meta">
                    <span>{log.scanned_entity_count} scanned</span>
                    <span>{log.touched_entity_count} touched</span>
                    <span>{log.conflict_count} conflicts</span>
                  </div>
                  <div className="accumul8-entity-endex-log-items">
                    {log.items.length > 0 ? log.items.map((item, index) => (
                      <div key={`${log.id}-${item.parent_entity_id}-${item.alias_name}-${index}`} className="accumul8-entity-endex-log-item">
                        <span className="accumul8-entity-endex-log-item-status">{item.status === 'created' ? 'Added' : 'Updated'}</span>
                        <span>{item.parent_name} ← {item.alias_name}</span>
                      </div>
                    )) : <div className="small text-muted">This run did not record any parent-to-alias changes.</div>}
                  </div>
                </section>
              )) : (
                <div className="text-muted">No Entity Endex scan history yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

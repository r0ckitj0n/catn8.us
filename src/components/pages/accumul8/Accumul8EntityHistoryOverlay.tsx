import React from 'react';

import { StandardIconButton } from '../../common/StandardIconButton';
import { Accumul8Entity, Accumul8Transaction } from '../../../types/accumul8';
import { formatInlineDate, formatInlineText } from './accumul8PageDateSearchUtils';
import { getLedgerDescriptionLabel } from './accumul8PageEntityUtils';

interface Accumul8EntityHistoryOverlayProps {
  beginEditEntity: (id: number) => void;
  formatAccountDisplayName: (accountId: number | null | undefined, accountName?: string | null, bankingOrganizationName?: string | null) => string;
  onCloseEntityHistory: () => void;
  selectedEntityHistory: Accumul8Entity | null;
  selectedEntityTransactions: Accumul8Transaction[];
}

export function Accumul8EntityHistoryOverlay({
  beginEditEntity,
  formatAccountDisplayName,
  onCloseEntityHistory,
  selectedEntityHistory,
  selectedEntityTransactions,
}: Accumul8EntityHistoryOverlayProps) {
  if (!selectedEntityHistory) {
    return null;
  }

  return (
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
  );
}

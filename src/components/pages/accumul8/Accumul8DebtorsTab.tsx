import React from 'react';

import { Accumul8TableHeaderCell } from '../../accumul8/Accumul8TableHeaderCell';
import { ACCUMUL8_EDIT_BUTTON_EMOJI, ACCUMUL8_MAP_BUTTON_EMOJI, ACCUMUL8_SAVE_BUTTON_EMOJI, ACCUMUL8_STATEMENT_BUTTON_EMOJI, ACCUMUL8_VIEW_BUTTON_EMOJI } from '../../accumul8/accumul8Ui';
import { PriorityTableSortState } from '../../../hooks/usePriorityTableLayout';
import { Accumul8Transaction } from '../../../types/accumul8';
import { resolveAccumul8StatementLink } from '../../../utils/accumul8StatementLink';
import { Accumul8DebtorGroupRow, getActiveFilterClass } from './accumul8PageEntityUtils';
import { formatInlineDate, formatInlineText } from './accumul8PageDateSearchUtils';
import { LedgerInlineDraft } from './accumul8PageFormUtils';

type DebtorInlineDraft = { debtor_name?: string; notes?: string; is_active?: number };

interface TableLayout<T> {
  getColumnStyle: (key: string) => React.CSSProperties;
  requestSort: (columnKey: string) => void;
  rows: T[];
  sortState: PriorityTableSortState;
  startResize: (columnKey: string, event: React.MouseEvent<HTMLSpanElement>) => void;
  tableStyle: React.CSSProperties;
}

interface Accumul8DebtorsTabProps {
  activateDebtorRow: (id: number) => void;
  activeDebtorRowId: number | null;
  activeLedgerRowId: number | null;
  activeOwnerUserId: number | null;
  balanceLedgerTable: TableLayout<Accumul8Transaction>;
  balanceLedgerTableRef: React.RefObject<HTMLTableElement | null>;
  beginEditTransaction: (id: number) => void;
  beginViewTransaction: (id: number) => void;
  busy: boolean;
  debtorDraftById: Record<number, DebtorInlineDraft>;
  debtorRunningBalanceByTxId: Map<number, number>;
  debtorsTable: TableLayout<Accumul8DebtorGroupRow>;
  debtorsTableRef: React.RefObject<HTMLTableElement | null>;
  deleteDebtor: (id: number) => Promise<void>;
  flashingSaveButtonKey: string | null;
  groupedDebtors: Accumul8DebtorGroupRow[];
  handleDeleteTransaction: (id: number, description?: string) => void | Promise<void>;
  ledgerDraftById: Record<number, LedgerInlineDraft>;
  listSearchQuery: string;
  openCreateDebtorModal: () => void;
  openCreateIouTransactionModal: (defaults?: { debtorId?: string }) => void;
  openLedgerEntityModal: (transactionId: number) => void;
  saveDebtorRow: (debtor: Accumul8DebtorGroupRow) => Promise<void>;
  saveLedgerRow: (row: Accumul8Transaction, draftOverride?: LedgerInlineDraft) => Promise<void>;
  selectedDebtorId: string;
  selectedOwnerUserId: number | null;
  setDebtorRowDraft: (debtor: Accumul8DebtorGroupRow, patch: DebtorInlineDraft) => void;
  setInlineRowRef: (key: string, node: HTMLTableRowElement | null) => void;
  setListSearchQuery: (value: string) => void;
  setSelectedDebtorId: React.Dispatch<React.SetStateAction<string>>;
  statementUploads: Array<unknown>;
}

export function Accumul8DebtorsTab({
  activateDebtorRow,
  activeDebtorRowId,
  activeLedgerRowId,
  activeOwnerUserId,
  balanceLedgerTable,
  balanceLedgerTableRef,
  beginEditTransaction,
  beginViewTransaction,
  busy,
  debtorDraftById,
  debtorRunningBalanceByTxId,
  debtorsTable,
  debtorsTableRef,
  deleteDebtor,
  flashingSaveButtonKey,
  groupedDebtors,
  handleDeleteTransaction,
  ledgerDraftById,
  listSearchQuery,
  openCreateDebtorModal,
  openCreateIouTransactionModal,
  openLedgerEntityModal,
  saveDebtorRow,
  saveLedgerRow,
  selectedDebtorId,
  selectedOwnerUserId,
  setDebtorRowDraft,
  setInlineRowRef,
  setListSearchQuery,
  setSelectedDebtorId,
  statementUploads,
}: Accumul8DebtorsTabProps) {
  return (
    <div className="accumul8-panel">
      <div className="accumul8-panel-toolbar mb-3">
        <h3 className="mb-0">Personal IOUs</h3>
        <div className="accumul8-panel-toolbar-search">
          <input type="text" className={getActiveFilterClass('form-control form-control-sm', listSearchQuery.trim() !== '')} value={listSearchQuery} onChange={(e) => setListSearchQuery(e.target.value)} placeholder="Filter IOU fields" aria-label="Filter personal IOU fields" />
        </div>
        <button type="button" className="btn btn-success btn-sm" onClick={openCreateDebtorModal} disabled={busy}>Add Person</button>
      </div>
      <div className="table-responsive mt-3 accumul8-scroll-area accumul8-scroll-area--debtors-list">
        <table ref={debtorsTableRef} className="table table-sm accumul8-table accumul8-table--measured accumul8-table--debtors accumul8-sticky-head" style={debtorsTable.tableStyle}>
          <colgroup>
            <col style={debtorsTable.getColumnStyle('person')} />
            <col style={debtorsTable.getColumnStyle('charges')} />
            <col style={debtorsTable.getColumnStyle('credits')} />
            <col style={debtorsTable.getColumnStyle('net')} />
            <col style={debtorsTable.getColumnStyle('activity')} />
            <col style={debtorsTable.getColumnStyle('actions')} />
          </colgroup>
          <thead><tr>
            <Accumul8TableHeaderCell label="Person" columnKey="person" sortState={debtorsTable.sortState} onSort={debtorsTable.requestSort} onResizeStart={debtorsTable.startResize} />
            <Accumul8TableHeaderCell label="Charges" columnKey="charges" className="text-end" sortState={debtorsTable.sortState} onSort={debtorsTable.requestSort} onResizeStart={debtorsTable.startResize} />
            <Accumul8TableHeaderCell label="Credits" columnKey="credits" className="text-end" sortState={debtorsTable.sortState} onSort={debtorsTable.requestSort} onResizeStart={debtorsTable.startResize} />
            <Accumul8TableHeaderCell label="Net IOU" columnKey="net" className="text-end" sortState={debtorsTable.sortState} onSort={debtorsTable.requestSort} onResizeStart={debtorsTable.startResize} />
            <Accumul8TableHeaderCell label="Last Activity" columnKey="activity" sortState={debtorsTable.sortState} onSort={debtorsTable.requestSort} onResizeStart={debtorsTable.startResize} />
            <Accumul8TableHeaderCell label="Actions" columnKey="actions" className="text-end" sortable={false} sortState={debtorsTable.sortState} onSort={debtorsTable.requestSort} onResizeStart={debtorsTable.startResize} />
          </tr></thead>
          <tbody>
            {debtorsTable.rows.map((debtor) => (
              <tr ref={(node) => setInlineRowRef(`debtor-${debtor.id}`, node)} key={debtor.id} className={['accumul8-list-item', activeDebtorRowId === debtor.id ? 'is-editing' : '', debtorDraftById[debtor.id] ? 'has-draft' : ''].filter(Boolean).join(' ')}>
                <td>{activeDebtorRowId === debtor.id && !debtor.has_duplicate_members ? <input className="form-control form-control-sm accumul8-month-table-input" value={debtorDraftById[debtor.id]?.debtor_name ?? debtor.debtor_name} onChange={(e) => setDebtorRowDraft(debtor, { debtor_name: e.target.value })} disabled={busy} /> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => { if (!debtor.has_duplicate_members) { activateDebtorRow(debtor.id); } }} disabled={busy || debtor.has_duplicate_members} title={debtor.has_duplicate_members ? 'Grouped duplicate people are shown together here to avoid duplicate IOU rows.' : undefined}>{formatInlineText(debtor.debtor_name, '-')}</button>}</td>
                <td className="text-end">{Number(debtor.total_loaned || 0).toFixed(2)}</td>
                <td className="text-end">{Number(debtor.total_repaid || 0).toFixed(2)}</td>
                <td className="text-end">{Number(debtor.outstanding_balance || 0).toFixed(2)}</td>
                <td>{activeDebtorRowId === debtor.id && !debtor.has_duplicate_members ? <input className="form-control form-control-sm accumul8-month-table-input" value={debtorDraftById[debtor.id]?.notes ?? debtor.notes ?? ''} onChange={(e) => setDebtorRowDraft(debtor, { notes: e.target.value })} disabled={busy} placeholder="Notes" /> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => { if (!debtor.has_duplicate_members) { activateDebtorRow(debtor.id); } }} disabled={busy || debtor.has_duplicate_members} title={debtor.has_duplicate_members ? 'Grouped duplicate people are shown together here to avoid duplicate IOU rows.' : undefined}>{formatInlineText(debtor.last_activity_date, '-')}</button>}</td>
                <td className="text-end is-compact-actions">
                  <div className="accumul8-row-actions accumul8-row-actions--always-on">
                    <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => setSelectedDebtorId(debtor.group_key)} disabled={busy} aria-label={`View ledger for ${debtor.debtor_name}`} title={`View ledger for ${debtor.debtor_name}`}><span aria-hidden="true">{ACCUMUL8_VIEW_BUTTON_EMOJI}</span></button>
                    <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => activateDebtorRow(debtor.id)} disabled={busy || debtor.has_duplicate_members} aria-label={`Edit ${debtor.debtor_name}`} title={debtor.has_duplicate_members ? 'Edit duplicate debtor records individually before changing the grouped row.' : `Edit ${debtor.debtor_name}`}><span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span></button>
                    <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => { if (window.confirm('Delete this debtor? Linked ledger rows will remain but be unassigned.')) { void deleteDebtor(debtor.id); if (selectedDebtorId === debtor.group_key) setSelectedDebtorId(''); } }} disabled={busy || debtor.has_duplicate_members} aria-label={`Delete ${debtor.debtor_name}`} title={debtor.has_duplicate_members ? 'Grouped duplicate debtors are hidden together here and cannot be deleted from the merged row.' : undefined}><i className="bi bi-trash"></i></button>
                    <button type="button" className={`btn btn-sm btn-outline-primary accumul8-icon-action${flashingSaveButtonKey === `debtor-${debtor.id}` ? ' is-flashing' : ''}`} onClick={() => void saveDebtorRow(debtor)} disabled={busy || debtor.has_duplicate_members || !debtorDraftById[debtor.id]} aria-label={`Save ${debtor.debtor_name}`} title={debtor.has_duplicate_members ? 'Grouped duplicate debtors are read-only from the merged row.' : (debtorDraftById[debtor.id] ? `Save ${debtor.debtor_name}` : `No changes to save for ${debtor.debtor_name}`)}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button>
                  </div>
                </td>
              </tr>
            ))}
            {debtorsTable.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted py-4">No personal IOUs matched the current filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="accumul8-panel mt-3">
        <div className="d-flex justify-content-between align-items-center gap-2 mb-2 flex-wrap">
          <h4 className="h6 mb-0">IOU Ledger</h4>
          <div className="d-flex gap-2 accumul8-iou-ledger-controls">
            <select className="form-select form-select-sm accumul8-iou-ledger-controls__select" value={selectedDebtorId} onChange={(e) => setSelectedDebtorId(e.target.value)}>
              <option value="">All People</option>
              {groupedDebtors.map((debtor) => <option key={debtor.group_key} value={debtor.group_key}>{debtor.debtor_name}</option>)}
            </select>
            <button type="button" className="btn btn-sm btn-outline-primary accumul8-iou-ledger-controls__button" onClick={() => { const selectedDebtor = groupedDebtors.find((debtor) => debtor.group_key === selectedDebtorId) || null; openCreateIouTransactionModal({ debtorId: selectedDebtor?.id ? String(selectedDebtor.id) : '' }); }} disabled={busy}>Add Charge / Credit</button>
          </div>
        </div>
        <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--ledger">
          <table ref={balanceLedgerTableRef} className="table table-sm accumul8-table accumul8-table--measured accumul8-table--balance-ledger accumul8-sticky-head" style={balanceLedgerTable.tableStyle}>
            <colgroup>
              <col style={balanceLedgerTable.getColumnStyle('date')} />
              <col style={balanceLedgerTable.getColumnStyle('person')} />
              <col style={balanceLedgerTable.getColumnStyle('description')} />
              <col style={balanceLedgerTable.getColumnStyle('memo')} />
              <col style={balanceLedgerTable.getColumnStyle('amount')} />
              <col style={balanceLedgerTable.getColumnStyle('running')} />
              <col style={balanceLedgerTable.getColumnStyle('actions')} />
            </colgroup>
            <thead><tr>
              <Accumul8TableHeaderCell label="Date" columnKey="date" sortState={balanceLedgerTable.sortState} onSort={balanceLedgerTable.requestSort} onResizeStart={balanceLedgerTable.startResize} />
              <Accumul8TableHeaderCell label="Person" columnKey="person" sortState={balanceLedgerTable.sortState} onSort={balanceLedgerTable.requestSort} onResizeStart={balanceLedgerTable.startResize} />
              <Accumul8TableHeaderCell label="Description" columnKey="description" sortState={balanceLedgerTable.sortState} onSort={balanceLedgerTable.requestSort} onResizeStart={balanceLedgerTable.startResize} />
              <Accumul8TableHeaderCell label="Memo" columnKey="memo" sortState={balanceLedgerTable.sortState} onSort={balanceLedgerTable.requestSort} onResizeStart={balanceLedgerTable.startResize} />
              <Accumul8TableHeaderCell label="Amt" columnKey="amount" className="text-end" sortState={balanceLedgerTable.sortState} onSort={balanceLedgerTable.requestSort} onResizeStart={balanceLedgerTable.startResize} />
              <Accumul8TableHeaderCell label="Running IOU" columnKey="running" className="text-end" sortState={balanceLedgerTable.sortState} onSort={balanceLedgerTable.requestSort} onResizeStart={balanceLedgerTable.startResize} />
              <Accumul8TableHeaderCell label="Actions" columnKey="actions" className="text-end" sortable={false} sortState={balanceLedgerTable.sortState} onSort={balanceLedgerTable.requestSort} onResizeStart={balanceLedgerTable.startResize} />
            </tr></thead>
            <tbody>
              {balanceLedgerTable.rows.map((tx) => {
                const statementLink = resolveAccumul8StatementLink(tx, statementUploads as any, selectedOwnerUserId || activeOwnerUserId || 0);
                return (
                  <tr key={tx.id} ref={(node) => setInlineRowRef(`ledger-${tx.id}`, node)} className={['accumul8-list-item', tx.amount < 0 ? 'is-outflow' : 'is-inflow', activeLedgerRowId === tx.id ? 'is-editing' : '', ledgerDraftById[tx.id] ? 'has-draft' : ''].filter(Boolean).join(' ')}>
                    <td><button type="button" className="accumul8-inline-cell-trigger" onClick={() => beginViewTransaction(tx.id)} disabled={busy}>{formatInlineDate(tx.transaction_date)}</button></td>
                    <td><button type="button" className="accumul8-inline-cell-trigger" onClick={() => beginViewTransaction(tx.id)} disabled={busy}>{formatInlineText(tx.debtor_name, '-')}</button></td>
                    <td><button type="button" className="accumul8-inline-cell-trigger" onClick={() => beginViewTransaction(tx.id)} disabled={busy}>{formatInlineText(tx.description, '-')}</button></td>
                    <td><button type="button" className="accumul8-inline-cell-trigger" onClick={() => beginViewTransaction(tx.id)} disabled={busy}>{formatInlineText(tx.memo, '-')}</button></td>
                    <td className="text-end"><button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => beginViewTransaction(tx.id)} disabled={busy}>{Number(tx.amount || 0).toFixed(2)}</button></td>
                    <td className="text-end">{Number(debtorRunningBalanceByTxId.get(tx.id) || 0).toFixed(2)}</td>
                    <td className="text-end is-compact-actions">
                      <div className="accumul8-row-actions accumul8-row-actions--always-on">
                        {statementLink ? <a className="btn btn-sm btn-outline-primary accumul8-icon-action" href={statementLink.href} target="_blank" rel="noreferrer" aria-label={`Open statement for ${tx.description}`} title={statementLink.label}><span aria-hidden="true">{ACCUMUL8_STATEMENT_BUTTON_EMOJI}</span></a> : null}
                        <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => beginViewTransaction(tx.id)} disabled={busy} aria-label={`View ${tx.description}`} title={`View ${tx.description}`}><span aria-hidden="true">{ACCUMUL8_VIEW_BUTTON_EMOJI}</span></button>
                        <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => beginEditTransaction(tx.id)} disabled={busy} aria-label={`Edit ${tx.description}`} title={`Edit ${tx.description}`}><span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span></button>
                        <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => openLedgerEntityModal(tx.id)} disabled={busy} aria-label={`Map ${tx.description} to an entity alias`} title={`Map ${tx.description} to an entity alias`}><span aria-hidden="true">{ACCUMUL8_MAP_BUTTON_EMOJI}</span></button>
                        <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => void handleDeleteTransaction(tx.id, tx.description)} disabled={busy} aria-label={`Delete ${tx.description}`}><i className="bi bi-trash"></i></button>
                        <button type="button" className={`btn btn-sm btn-outline-primary accumul8-icon-action${flashingSaveButtonKey === `ledger-${tx.id}` ? ' is-flashing' : ''}`} onClick={() => void saveLedgerRow(tx, ledgerDraftById[tx.id])} disabled={busy || !ledgerDraftById[tx.id]} aria-label={`Save ${tx.description}`} title={ledgerDraftById[tx.id] ? `Save ${tx.description}` : `No changes to save for ${tx.description}`}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

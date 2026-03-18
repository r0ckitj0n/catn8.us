import React from 'react';

import { Accumul8TableHeaderCell } from '../../accumul8/Accumul8TableHeaderCell';
import { ACCUMUL8_EDIT_BUTTON_EMOJI, ACCUMUL8_MAP_BUTTON_EMOJI, ACCUMUL8_SAVE_BUTTON_EMOJI, ACCUMUL8_STATEMENT_BUTTON_EMOJI, ACCUMUL8_VIEW_BUTTON_EMOJI } from '../../accumul8/accumul8Ui';
import { PriorityTableSortState } from '../../../hooks/usePriorityTableLayout';
import { Accumul8Account, Accumul8Transaction } from '../../../types/accumul8';
import { getAccumul8TransactionEditPolicy } from '../../../utils/accumul8TransactionPolicy';
import { resolveAccumul8StatementLink } from '../../../utils/accumul8StatementLink';
import { formatAccountOptionLabel, formatInlineDate, formatInlineText } from './accumul8PageDateSearchUtils';
import { getActiveFilterClass } from './accumul8PageEntityUtils';
import { LedgerInlineDraft } from './accumul8PageFormUtils';

type DateFilterKey = string;
type AccountOption = Pick<Accumul8Account, 'id' | 'account_name' | 'account_nickname' | 'banking_organization_name' | 'mask_last4'>;

interface PayBillsTableLayout {
  getColumnStyle: (key: string) => React.CSSProperties;
  requestSort: (columnKey: string) => void;
  rows: Accumul8Transaction[];
  sortState: PriorityTableSortState;
  startResize: (columnKey: string, event: React.MouseEvent<HTMLSpanElement>) => void;
  tableStyle: React.CSSProperties;
}

interface Accumul8PayBillsTabProps {
  activatePayBillRow: (id: number) => void;
  activeOwnerUserId: number | null;
  activePayBillRowId: number | null;
  beginViewTransaction: (id: number) => void;
  busy: boolean;
  customPayBillsEndDate: string;
  customPayBillsStartDate: string;
  deleteTransaction: (id: number) => Promise<void>;
  flashingSaveButtonKey: string | null;
  getAccountDisplayName: (accountId: number | null | undefined, accountName?: string | null, bankingOrganizationName?: string | null, fallback?: string) => string;
  listSearchQuery: string;
  openLedgerEntityModal: (transactionId: number) => void;
  payBillsAccountOptions: AccountOption[];
  payBillsDateFilter: DateFilterKey;
  payBillsTable: PayBillsTableLayout;
  payBillsTableRef: React.RefObject<HTMLTableElement | null>;
  payBillDraftById: Record<number, LedgerInlineDraft>;
  renderDateRangeControls: (
    contextKey: 'ledger' | 'pay-bills',
    filter: string,
    setFilter: (value: string) => void,
    startDate: string,
    setStartDate: (value: string) => void,
    endDate: string,
    setEndDate: (value: string) => void,
    includeEoy?: boolean,
  ) => React.ReactNode;
  savePayBillRow: (row: Accumul8Transaction) => Promise<void>;
  selectedOwnerUserId: number | null;
  setCustomPayBillsEndDate: (value: string) => void;
  setCustomPayBillsStartDate: (value: string) => void;
  setInlineRowRef: (key: string, node: HTMLTableRowElement | null) => void;
  setListSearchQuery: (value: string) => void;
  setPayBillRowDraft: (row: Accumul8Transaction, patch: LedgerInlineDraft) => void;
  setPayBillsDateFilter: (value: DateFilterKey) => void;
  todayDate: string;
  statementUploads: Array<unknown>;
}

export function Accumul8PayBillsTab({
  activatePayBillRow,
  activeOwnerUserId,
  activePayBillRowId,
  beginViewTransaction,
  busy,
  customPayBillsEndDate,
  customPayBillsStartDate,
  deleteTransaction,
  flashingSaveButtonKey,
  getAccountDisplayName,
  listSearchQuery,
  openLedgerEntityModal,
  payBillsAccountOptions,
  payBillsDateFilter,
  payBillsTable,
  payBillsTableRef,
  payBillDraftById,
  renderDateRangeControls,
  savePayBillRow,
  selectedOwnerUserId,
  setCustomPayBillsEndDate,
  setCustomPayBillsStartDate,
  setInlineRowRef,
  setListSearchQuery,
  setPayBillRowDraft,
  setPayBillsDateFilter,
  statementUploads,
  todayDate,
}: Accumul8PayBillsTabProps) {
  return (
    <div className="accumul8-panel accumul8-panel--viewport-fill">
      <div className="accumul8-panel-toolbar mb-3">
        <h3 className="mb-0">Pay Bills</h3>
        {renderDateRangeControls('pay-bills', payBillsDateFilter, setPayBillsDateFilter, customPayBillsStartDate, setCustomPayBillsStartDate, customPayBillsEndDate, setCustomPayBillsEndDate)}
        <div className="accumul8-panel-toolbar-search">
          <input type="text" className={getActiveFilterClass('form-control form-control-sm', listSearchQuery.trim() !== '')} value={listSearchQuery} onChange={(e) => setListSearchQuery(e.target.value)} placeholder="Filter bill fields" aria-label="Filter pay bills fields" />
        </div>
      </div>
      <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--bills">
        <table ref={payBillsTableRef} className="table table-sm accumul8-table accumul8-table--measured accumul8-table--pay-bills accumul8-sticky-head" style={payBillsTable.tableStyle}>
          <colgroup>
            <col style={payBillsTable.getColumnStyle('due')} />
            <col style={payBillsTable.getColumnStyle('paidDate')} />
            <col style={payBillsTable.getColumnStyle('description')} />
            <col style={payBillsTable.getColumnStyle('account')} />
            <col style={payBillsTable.getColumnStyle('amount')} />
            <col style={payBillsTable.getColumnStyle('status')} />
            <col style={payBillsTable.getColumnStyle('actions')} />
          </colgroup>
          <thead><tr>
            <Accumul8TableHeaderCell label="Due" columnKey="due" sortState={payBillsTable.sortState} onSort={payBillsTable.requestSort} onResizeStart={payBillsTable.startResize} />
            <Accumul8TableHeaderCell label="Paid" columnKey="paidDate" sortState={payBillsTable.sortState} onSort={payBillsTable.requestSort} onResizeStart={payBillsTable.startResize} />
            <Accumul8TableHeaderCell label="Description" columnKey="description" sortState={payBillsTable.sortState} onSort={payBillsTable.requestSort} onResizeStart={payBillsTable.startResize} />
            <Accumul8TableHeaderCell label="Acct" columnKey="account" sortState={payBillsTable.sortState} onSort={payBillsTable.requestSort} onResizeStart={payBillsTable.startResize} />
            <Accumul8TableHeaderCell label="Amt" columnKey="amount" className="text-end" sortState={payBillsTable.sortState} onSort={payBillsTable.requestSort} onResizeStart={payBillsTable.startResize} />
            <Accumul8TableHeaderCell label="Status" columnKey="status" sortState={payBillsTable.sortState} onSort={payBillsTable.requestSort} onResizeStart={payBillsTable.startResize} />
            <Accumul8TableHeaderCell label="Actions" columnKey="actions" className="text-end" sortable={false} sortState={payBillsTable.sortState} onSort={payBillsTable.requestSort} onResizeStart={payBillsTable.startResize} />
          </tr></thead>
          <tbody>
            {payBillsTable.rows.map((billTx) => {
              const billEditPolicy = getAccumul8TransactionEditPolicy(billTx);
              const statementLink = resolveAccumul8StatementLink(billTx, statementUploads as any, selectedOwnerUserId || activeOwnerUserId || 0);
              return (
                <tr ref={(node) => setInlineRowRef(`paybill-${billTx.id}`, node)} key={billTx.id} className={['accumul8-list-item', activePayBillRowId === billTx.id ? 'is-editing' : '', payBillDraftById[billTx.id] ? 'has-draft' : ''].filter(Boolean).join(' ')}>
                  <td>{activePayBillRowId === billTx.id ? <input className="form-control form-control-sm accumul8-month-table-input" type="date" value={payBillDraftById[billTx.id]?.due_date ?? billTx.due_date ?? billTx.transaction_date} onChange={(e) => setPayBillRowDraft(billTx, { due_date: e.target.value })} disabled={busy || !billEditPolicy.canEditCoreFields} /> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activatePayBillRow(billTx.id)} disabled={busy}>{formatInlineDate(billTx.due_date || billTx.transaction_date)}</button>}</td>
                  <td>{activePayBillRowId === billTx.id ? <input className="form-control form-control-sm accumul8-month-table-input" type="date" value={payBillDraftById[billTx.id]?.paid_date ?? billTx.paid_date ?? ''} onChange={(e) => setPayBillRowDraft(billTx, { paid_date: e.target.value })} disabled={busy || !billEditPolicy.canEditPaidState} /> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activatePayBillRow(billTx.id)} disabled={busy}>{formatInlineDate(billTx.paid_date)}</button>}</td>
                  <td>{activePayBillRowId === billTx.id ? <input className="form-control form-control-sm accumul8-month-table-input" value={payBillDraftById[billTx.id]?.description ?? billTx.description} onChange={(e) => setPayBillRowDraft(billTx, { description: e.target.value })} disabled={busy || !billEditPolicy.canEditCoreFields} /> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activatePayBillRow(billTx.id)} disabled={busy}>{formatInlineText(billTx.description, '-')}</button>}</td>
                  <td>{activePayBillRowId === billTx.id ? <select className="form-select form-select-sm accumul8-month-table-select" value={String(payBillDraftById[billTx.id]?.account_id ?? billTx.account_id ?? '')} onChange={(e) => setPayBillRowDraft(billTx, { account_id: e.target.value ? Number(e.target.value) : null })} disabled={busy || !billEditPolicy.canEditCoreFields}><option value="">No account</option>{payBillsAccountOptions.map((account) => <option key={account.id} value={account.id}>{formatAccountOptionLabel(account)}</option>)}</select> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activatePayBillRow(billTx.id)} disabled={busy}>{getAccountDisplayName(billTx.account_id, billTx.account_name, '', 'No account')}</button>}</td>
                  <td className="text-end">{activePayBillRowId === billTx.id ? <input className="form-control form-control-sm accumul8-month-table-input" type="number" step="0.01" value={payBillDraftById[billTx.id]?.amount ?? billTx.amount} onChange={(e) => setPayBillRowDraft(billTx, { amount: Number(e.target.value) })} disabled={busy || !billEditPolicy.canEditCoreFields} /> : <button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => activatePayBillRow(billTx.id)} disabled={busy}>{Number(billTx.amount || 0).toFixed(2)}</button>}</td>
                  <td>
                    {activePayBillRowId === billTx.id ? (
                      <select className="form-select form-select-sm accumul8-month-table-select" value={String(payBillDraftById[billTx.id]?.is_paid ?? billTx.is_paid)} onChange={(e) => setPayBillRowDraft(billTx, { is_paid: Number(e.target.value) })} disabled={busy || !billEditPolicy.canEditPaidState}>
                        <option value="0">Upcoming</option>
                        <option value="1">Paid</option>
                      </select>
                    ) : (
                      <button type="button" className={`accumul8-inline-cell-trigger${Number(billTx.is_paid || 0) !== 1 && (billTx.due_date || billTx.transaction_date) < todayDate ? ' accumul8-inline-cell-trigger--past-due' : ''}`} onClick={() => activatePayBillRow(billTx.id)} disabled={busy}>
                        {Number(billTx.is_paid || 0) === 1 ? 'Paid' : ((billTx.due_date || billTx.transaction_date) < todayDate ? 'Past due' : 'Upcoming')}
                      </button>
                    )}
                  </td>
                  <td className="text-end">
                    <div className="accumul8-row-actions">
                      {statementLink ? <a className="btn btn-sm btn-outline-primary accumul8-icon-action" href={statementLink.href} target="_blank" rel="noreferrer" aria-label={`Open statement for ${billTx.description}`} title={statementLink.label}><span aria-hidden="true">{ACCUMUL8_STATEMENT_BUTTON_EMOJI}</span></a> : null}
                      <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => beginViewTransaction(billTx.id)} disabled={busy} aria-label={`View ${billTx.description}`} title={`View ${billTx.description}`}><span aria-hidden="true">{ACCUMUL8_VIEW_BUTTON_EMOJI}</span></button>
                      <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => openLedgerEntityModal(billTx.id)} disabled={busy} aria-label={`Map ${billTx.description} to an entity alias`} title={`Map ${billTx.description} to an entity alias`}><span aria-hidden="true">{ACCUMUL8_MAP_BUTTON_EMOJI}</span></button>
                      <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => activatePayBillRow(billTx.id)} disabled={busy} aria-label={`Edit ${billTx.description}`} title={`Edit ${billTx.description}`}><span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span></button>
                      <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => { if (window.confirm('Delete this bill item?')) { void deleteTransaction(billTx.id); } }} disabled={busy || !billEditPolicy.canDelete} aria-label={`Delete ${billTx.description}`} title={billEditPolicy.canDelete ? `Delete ${billTx.description}` : `${billEditPolicy.sourceLabel} transactions cannot be deleted here`}><i className="bi bi-trash"></i></button>
                      <button type="button" className={`btn btn-sm btn-outline-primary accumul8-icon-action${flashingSaveButtonKey === `paybill-${billTx.id}` ? ' is-flashing' : ''}`} onClick={() => void savePayBillRow(billTx)} disabled={busy || !payBillDraftById[billTx.id]} aria-label={`Save ${billTx.description}`} title={payBillDraftById[billTx.id] ? `Save ${billTx.description}` : `No changes to save for ${billTx.description}`}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {payBillsTable.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted py-4">No unpaid upcoming or past-due bills matched the current filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

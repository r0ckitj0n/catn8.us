import React from 'react';

import { Accumul8Account, Accumul8Entity, Accumul8PaymentMethod } from '../../types/accumul8';
import { PriorityTableLayout } from '../../hooks/usePriorityTableLayout';
import { ACCUMUL8_EDIT_BUTTON_EMOJI, ACCUMUL8_SAVE_BUTTON_EMOJI, ACCUMUL8_VIEW_BUTTON_EMOJI } from './accumul8Ui';
import { Accumul8TableHeaderCell } from './Accumul8TableHeaderCell';
import { EditableSpreadsheetMonthPanel, EditableSpreadsheetRow } from './accumul8SpreadsheetTypes';
import { formatCurrency, formatDateLabel, formatEditableValue } from './accumul8SpreadsheetViewUtils';

interface Accumul8SpreadsheetTableProps {
  accounts: Accumul8Account[];
  accountDisplayNameById: Record<number, string>;
  activeRowKey: string | null;
  budgetTable: PriorityTableLayout<EditableSpreadsheetRow>;
  budgetTableRef: React.MutableRefObject<HTMLTableElement | null>;
  busy: boolean;
  draftRowByKey: Record<string, EditableSpreadsheetRow>;
  entities: Accumul8Entity[];
  normalizedBudgetFilterQuery: string;
  panel: EditableSpreadsheetMonthPanel;
  paymentMethodLabels: Record<Accumul8PaymentMethod, string>;
  setActiveRowKey: (rowKey: string | null) => void;
  setInlineRowRef: (rowKey: string, node: HTMLTableRowElement | null) => void;
  setRowDraft: (row: EditableSpreadsheetRow, patch: Partial<EditableSpreadsheetRow>) => void;
  onDeleteRecurring: (id: number, description: string) => void;
  onHandleRowRtaChange: (row: EditableSpreadsheetRow, rawValue: string) => void;
  onOpenRecurring: (id: number) => void;
  onSaveRow: (row: EditableSpreadsheetRow) => void;
}

function getRowAccountDisplayName(row: EditableSpreadsheetRow, accountDisplayNameById: Record<number, string>, fallback = 'None') {
  const resolved = row.account_id ? accountDisplayNameById[row.account_id] : '';
  return resolved || formatEditableValue(row.account_name || row.banking_organization_name, fallback);
}

export function Accumul8SpreadsheetTable({
  accounts,
  accountDisplayNameById,
  activeRowKey,
  budgetTable,
  budgetTableRef,
  busy,
  draftRowByKey,
  entities,
  normalizedBudgetFilterQuery,
  panel,
  paymentMethodLabels,
  setActiveRowKey,
  setInlineRowRef,
  setRowDraft,
  onDeleteRecurring,
  onHandleRowRtaChange,
  onOpenRecurring,
  onSaveRow,
}: Accumul8SpreadsheetTableProps) {
  return (
    <section className="accumul8-month-panel is-center" aria-label={`${panel.monthLabel} spreadsheet panel`}>
      <div className="accumul8-scroll-area accumul8-scroll-area--spreadsheet">
        <table ref={budgetTableRef} className="table accumul8-table accumul8-sticky-head accumul8-month-table accumul8-spreadsheet-table" style={budgetTable.tableStyle}>
          <colgroup>
            {['due', 'paidDate', 'vendor', 'account', 'method', 'frequency', 'amount', 'rta', 'balance', 'notes', 'actions'].map((key) => <col key={key} style={budgetTable.getColumnStyle(key)} />)}
          </colgroup>
          <thead>
            <tr>
              <Accumul8TableHeaderCell label="Due" columnKey="due" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
              <Accumul8TableHeaderCell label="Paid" columnKey="paidDate" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
              <Accumul8TableHeaderCell label="Name" columnKey="vendor" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
              <Accumul8TableHeaderCell label="Acct" columnKey="account" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
              <Accumul8TableHeaderCell label="Method" columnKey="method" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
              <Accumul8TableHeaderCell label="Frequency" columnKey="frequency" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
              <Accumul8TableHeaderCell label="Amt" columnKey="amount" className="text-end" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
              <Accumul8TableHeaderCell label="RTA" columnKey="rta" className="text-end" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
              <Accumul8TableHeaderCell label="Bal" columnKey="balance" className="text-end" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
              <Accumul8TableHeaderCell label="Notes" columnKey="notes" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
              <Accumul8TableHeaderCell label="Actions" columnKey="actions" className="text-end" sortable={false} sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
            </tr>
          </thead>
          <tbody>
            {budgetTable.rows.length > 0 ? budgetTable.rows.map((row) => (
              <tr ref={(node) => setInlineRowRef(row.rowKey, node)} key={row.rowKey} className={['accumul8-list-item', row.amount < 0 ? 'is-outflow' : 'is-inflow', activeRowKey === row.rowKey ? 'is-editing' : '', draftRowByKey[row.rowKey] ? 'has-draft' : ''].filter(Boolean).join(' ')}>
                <td title={row.due_date || ''}>{activeRowKey === row.rowKey ? <input className="form-control form-control-sm accumul8-month-table-input" type="date" value={row.due_date} onChange={(event) => setRowDraft(row, { due_date: event.target.value, dueDayLabel: event.target.value.slice(8, 10) })} disabled={busy} /> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => setActiveRowKey(row.rowKey)} disabled={busy}>{formatDateLabel(row.due_date)}</button>}</td>
                <td title={row.paid_date || ''}>{activeRowKey === row.rowKey ? <input className="form-control form-control-sm accumul8-month-table-input" type="date" value={row.paid_date || ''} onChange={(event) => setRowDraft(row, { paid_date: event.target.value })} disabled={busy} /> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => setActiveRowKey(row.rowKey)} disabled={busy}>{formatDateLabel(row.paid_date)}</button>}</td>
                <td>{activeRowKey === row.rowKey ? <input className="form-control form-control-sm accumul8-month-table-input" list={`accumul8-vendor-options-${panel.monthValue}`} value={row.vendor_input} onChange={(event) => setRowDraft(row, { vendor_input: event.target.value, title: event.target.value })} disabled={busy} /> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => setActiveRowKey(row.rowKey)} disabled={busy}>{formatEditableValue(row.vendor_input, 'Add vendor')}</button>}</td>
                <td>{activeRowKey === row.rowKey ? (
                  <select className="form-select form-select-sm accumul8-month-table-select" value={row.account_id ?? ''} onChange={(event) => {
                    const selectedAccountId = event.target.value === '' ? null : Number(event.target.value);
                    const account = accounts.find((item) => item.id === selectedAccountId) || null;
                    setRowDraft(row, { account_id: selectedAccountId, banking_organization_id: account?.banking_organization_id ?? null, account_name: account ? accountDisplayNameById[account.id] || '' : '', banking_organization_name: account?.banking_organization_name || '' });
                  }} disabled={busy}>
                    <option value="">None</option>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{accountDisplayNameById[account.id] || ''}</option>)}
                  </select>
                ) : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => setActiveRowKey(row.rowKey)} disabled={busy}>{getRowAccountDisplayName(row, accountDisplayNameById)}</button>}</td>
                <td>{activeRowKey === row.rowKey ? <span className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--static">{paymentMethodLabels[row.payment_method as Accumul8PaymentMethod] || 'Unspecified'}</span> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => setActiveRowKey(row.rowKey)} disabled={busy}>{paymentMethodLabels[row.payment_method as Accumul8PaymentMethod] || 'Unspecified'}</button>}</td>
                <td>{activeRowKey === row.rowKey ? <span className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--static">{formatEditableValue(row.frequency, '-')}</span> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => setActiveRowKey(row.rowKey)} disabled={busy}>{formatEditableValue(row.frequency, '-')}</button>}</td>
                <td className="text-end">{activeRowKey === row.rowKey ? <input className="form-control form-control-sm accumul8-month-table-input" type="number" step="0.01" value={row.amount} onChange={(event) => { const parsed = Number(event.target.value); setRowDraft(row, { amount: Number.isFinite(parsed) ? parsed : 0 }); }} disabled={busy} /> : <button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => setActiveRowKey(row.rowKey)} disabled={busy}>{formatCurrency(Number(row.amount || 0))}</button>}</td>
                <td className="text-end">{activeRowKey === row.rowKey ? <input className="form-control form-control-sm accumul8-month-table-input" type="number" step="0.01" value={row.rta_amount} onChange={(event) => onHandleRowRtaChange(row, event.target.value)} disabled={busy} aria-label={`${row.title} real time adjustment`} /> : <button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => setActiveRowKey(row.rowKey)} disabled={busy}>{Number(row.rta_amount || 0).toFixed(2)}</button>}</td>
                <td className="text-end">{Number.isFinite(row.balance) ? Number(row.balance || 0).toFixed(2) : '-'}</td>
                <td>{activeRowKey === row.rowKey ? <input className="form-control form-control-sm accumul8-month-table-input" value={row.notes || ''} onChange={(event) => setRowDraft(row, { notes: event.target.value })} disabled={busy} /> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => setActiveRowKey(row.rowKey)} disabled={busy}>{formatEditableValue(row.notes)}</button>}</td>
                <td className="text-end is-compact-actions">
                  <div className="accumul8-row-actions accumul8-row-actions--always-on">
                    <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => onOpenRecurring(row.recurring_id)} disabled={busy || row.recurring_id <= 0} aria-label={`View ${row.title || 'row'}`} title={`View ${row.title || 'row'}`}><span aria-hidden="true">{ACCUMUL8_VIEW_BUTTON_EMOJI}</span></button>
                    <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => setActiveRowKey(row.rowKey)} disabled={busy} aria-label={`Edit ${row.title || 'row'}`} title={`Edit ${row.title || 'row'}`}><span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span></button>
                    <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => onDeleteRecurring(row.recurring_id, row.title)} disabled={busy || row.recurring_id <= 0} aria-label={`Delete ${row.title}`}><i className="bi bi-trash"></i></button>
                    {draftRowByKey[row.rowKey] ? <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => onSaveRow(row)} disabled={busy} aria-label={`Save ${row.title || 'row'}`} title={`Save ${row.title || 'row'}`}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button> : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={11} className="text-center text-muted py-4">{normalizedBudgetFilterQuery === '' ? 'No budget-planner recurring items in this month yet.' : 'No budget items match the current filter.'}</td>
              </tr>
            )}
          </tbody>
        </table>
        <datalist id={`accumul8-vendor-options-${panel.monthValue}`}>
          {entities.filter((entity) => Number(entity.is_balance_person || 0) === 0).map((entity) => <option key={entity.id} value={entity.display_name} />)}
        </datalist>
      </div>
    </section>
  );
}

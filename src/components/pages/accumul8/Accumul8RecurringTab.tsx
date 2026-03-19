import React from 'react';

import { Accumul8TableHeaderCell } from '../../accumul8/Accumul8TableHeaderCell';
import { ACCUMUL8_EDIT_BUTTON_EMOJI, ACCUMUL8_MAP_BUTTON_EMOJI, ACCUMUL8_SAVE_BUTTON_EMOJI, ACCUMUL8_VIEW_BUTTON_EMOJI } from '../../accumul8/accumul8Ui';
import { PriorityTableSortState } from '../../../hooks/usePriorityTableLayout';
import { Accumul8Account, Accumul8Direction, Accumul8Frequency, Accumul8PaymentMethod, Accumul8RecurringPayment } from '../../../types/accumul8';
import { RECURRING_PAYMENT_METHOD_LABELS, formatAccountOptionLabel, formatInlineDate, formatInlineText, formatRecurringAmount, formatRecurringTitle } from './accumul8PageDateSearchUtils';
import { getActiveFilterClass } from './accumul8PageEntityUtils';

type RecurringInlineDraft = Partial<Pick<Accumul8RecurringPayment, 'title' | 'next_due_date' | 'amount' | 'frequency' | 'payment_method' | 'is_budget_planner' | 'is_active' | 'notes' | 'account_id'>>;

type AccountOption = Pick<Accumul8Account, 'id' | 'account_name' | 'account_nickname' | 'banking_organization_name' | 'mask_last4'>;

interface Accumul8RecurringTabProps {
  activeRecurringRowId: number | null;
  beginEditRecurring: (id: number) => void;
  busy: boolean;
  deleteRecurring: (id: number) => Promise<unknown>;
  flashingSaveButtonKey: string | null;
  getAccountDisplayName: (accountId: number | null | undefined, accountName?: string | null, bankingOrganizationName?: string | null, fallback?: string) => string;
  listSearchQuery: string;
  openCreateRecurringModal: () => void;
  openRecurringLinkModal: (id: number) => void;
  payBillsAccountOptions: AccountOption[];
  recurringDraftById: Record<number, RecurringInlineDraft>;
  recurringTable: {
    getColumnStyle: (key: string) => React.CSSProperties;
    requestSort: (columnKey: string) => void;
    rows: Accumul8RecurringPayment[];
    sortState: PriorityTableSortState;
    startResize: (columnKey: string, event: React.MouseEvent<HTMLSpanElement>) => void;
    tableStyle: React.CSSProperties;
  };
  recurringTableRef: React.RefObject<HTMLTableElement | null>;
  saveRecurringRow: (row: Accumul8RecurringPayment) => Promise<unknown>;
  setInlineRowRef: (key: string, node: HTMLTableRowElement | null) => void;
  setListSearchQuery: (value: string) => void;
  setRecurringRowDraft: (row: Accumul8RecurringPayment, patch: RecurringInlineDraft) => void;
}

export function Accumul8RecurringTab({
  activeRecurringRowId,
  beginEditRecurring,
  busy,
  deleteRecurring,
  flashingSaveButtonKey,
  getAccountDisplayName,
  listSearchQuery,
  openCreateRecurringModal,
  openRecurringLinkModal,
  payBillsAccountOptions,
  recurringDraftById,
  recurringTable,
  recurringTableRef,
  saveRecurringRow,
  setInlineRowRef,
  setListSearchQuery,
  setRecurringRowDraft,
}: Accumul8RecurringTabProps) {
  return (
    <div className="accumul8-panel accumul8-panel--viewport-fill">
      <div className="accumul8-panel-toolbar mb-3">
        <h3 className="mb-0">Recurring</h3>
        <div className="accumul8-panel-toolbar-search">
          <input
            type="text"
            className={getActiveFilterClass('form-control form-control-sm', listSearchQuery.trim() !== '')}
            value={listSearchQuery}
            onChange={(e) => setListSearchQuery(e.target.value)}
            placeholder="Filter recurring fields"
            aria-label="Filter recurring fields"
          />
        </div>
        <button type="button" className="btn btn-success btn-sm" onClick={openCreateRecurringModal} disabled={busy}>Add Recurring Item</button>
      </div>
      <div className="table-responsive mt-3 accumul8-scroll-area accumul8-scroll-area--recurring">
        <table
          ref={recurringTableRef}
          className="table table-sm accumul8-table accumul8-table--measured accumul8-table--recurring accumul8-sticky-head"
          style={recurringTable.tableStyle}
        >
          <colgroup>
            <col style={recurringTable.getColumnStyle('title')} />
            <col style={recurringTable.getColumnStyle('nextDue')} />
            <col style={recurringTable.getColumnStyle('amount')} />
            <col style={recurringTable.getColumnStyle('frequency')} />
            <col style={recurringTable.getColumnStyle('account')} />
            <col style={recurringTable.getColumnStyle('paymentMethod')} />
            <col style={recurringTable.getColumnStyle('planner')} />
            <col style={recurringTable.getColumnStyle('status')} />
            <col style={recurringTable.getColumnStyle('actions')} />
          </colgroup>
          <thead><tr>
            <Accumul8TableHeaderCell label="Title" columnKey="title" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
            <Accumul8TableHeaderCell label="Next Date" columnKey="nextDue" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
            <Accumul8TableHeaderCell label="Amt" columnKey="amount" className="text-end" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
            <Accumul8TableHeaderCell label="Frequency" columnKey="frequency" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
            <Accumul8TableHeaderCell label="Acct" columnKey="account" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
            <Accumul8TableHeaderCell label="Method" columnKey="paymentMethod" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
            <Accumul8TableHeaderCell label="Planner" columnKey="planner" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
            <Accumul8TableHeaderCell label="Status" columnKey="status" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
            <Accumul8TableHeaderCell label="Actions" columnKey="actions" className="text-end" sortable={false} sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
          </tr></thead>
          <tbody>
            {recurringTable.rows.map((rp) => {
              const recurringDraft = recurringDraftById[rp.id];
              return (
                <tr ref={(node) => setInlineRowRef(`recurring-${rp.id}`, node)} key={rp.id} className={['accumul8-list-item', activeRecurringRowId === rp.id ? 'is-editing' : '', recurringDraft ? 'has-draft' : ''].filter(Boolean).join(' ')}>
                  <td>
                    {activeRecurringRowId === rp.id ? (
                      <div className="accumul8-inline-stack">
                        <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text" value={recurringDraft?.title ?? rp.title} onChange={(e) => setRecurringRowDraft(rp, { title: e.target.value })} disabled={busy} />
                        <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={recurringDraft?.notes ?? rp.notes ?? ''} onChange={(e) => setRecurringRowDraft(rp, { notes: e.target.value })} disabled={busy} placeholder="Notes" />
                      </div>
                    ) : (
                      <button type="button" className="accumul8-inline-cell-trigger" onClick={() => beginEditRecurring(rp.id)} disabled={busy}>
                        {formatRecurringTitle(rp.title)}
                        {rp.notes ? <span className="small text-muted d-block">{rp.notes}</span> : null}
                      </button>
                    )}
                  </td>
                  <td>
                    {activeRecurringRowId === rp.id ? (
                      <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--date" type="date" value={recurringDraft?.next_due_date ?? rp.next_due_date} onChange={(e) => setRecurringRowDraft(rp, { next_due_date: e.target.value })} disabled={busy} />
                    ) : (
                      <button type="button" className="accumul8-inline-cell-trigger" onClick={() => beginEditRecurring(rp.id)} disabled={busy}>{formatInlineDate(rp.next_due_date)}</button>
                    )}
                  </td>
                  <td className="text-end">
                    {activeRecurringRowId === rp.id ? (
                      <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--numeric" type="number" step="0.01" value={recurringDraft?.amount ?? rp.amount} onChange={(e) => setRecurringRowDraft(rp, { amount: Number(e.target.value) })} disabled={busy} />
                    ) : (
                      <button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => beginEditRecurring(rp.id)} disabled={busy}>{formatRecurringAmount(rp.amount, (rp.direction || 'outflow') as Accumul8Direction)}</button>
                    )}
                  </td>
                  <td>
                    {activeRecurringRowId === rp.id ? (
                      <select className="form-select form-select-sm accumul8-inline-editor accumul8-inline-editor--select" value={recurringDraft?.frequency ?? rp.frequency} onChange={(e) => setRecurringRowDraft(rp, { frequency: e.target.value as Accumul8Frequency })} disabled={busy}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    ) : (
                      <button type="button" className="accumul8-inline-cell-trigger" onClick={() => beginEditRecurring(rp.id)} disabled={busy}>{formatInlineText(rp.frequency)}</button>
                    )}
                  </td>
                  <td>
                    {activeRecurringRowId === rp.id ? (
                      <select className="form-select form-select-sm accumul8-inline-editor accumul8-inline-editor--select" value={String(recurringDraft?.account_id ?? rp.account_id ?? '')} onChange={(e) => setRecurringRowDraft(rp, { account_id: e.target.value ? Number(e.target.value) : null })} disabled={busy}>
                        <option value="">No account</option>
                        {payBillsAccountOptions.map((account) => (
                          <option key={account.id} value={account.id}>{formatAccountOptionLabel(account)}</option>
                        ))}
                      </select>
                    ) : (
                      <button type="button" className="accumul8-inline-cell-trigger" onClick={() => beginEditRecurring(rp.id)} disabled={busy}>{getAccountDisplayName(rp.account_id, rp.account_name, '', 'No account')}</button>
                    )}
                  </td>
                  <td>
                    {activeRecurringRowId === rp.id ? (
                      <select className="form-select form-select-sm accumul8-inline-editor accumul8-inline-editor--select" value={recurringDraft?.payment_method ?? rp.payment_method} onChange={(e) => setRecurringRowDraft(rp, { payment_method: e.target.value as Accumul8PaymentMethod })} disabled={busy}>
                        {Object.entries(RECURRING_PAYMENT_METHOD_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      <button type="button" className="accumul8-inline-cell-trigger" onClick={() => beginEditRecurring(rp.id)} disabled={busy}>{RECURRING_PAYMENT_METHOD_LABELS[(rp.payment_method || 'unspecified') as Accumul8PaymentMethod]}</button>
                    )}
                  </td>
                  <td>
                    {activeRecurringRowId === rp.id ? (
                      <select className="form-select form-select-sm accumul8-inline-editor accumul8-inline-editor--select" value={String(recurringDraft?.is_budget_planner ?? rp.is_budget_planner)} onChange={(e) => setRecurringRowDraft(rp, { is_budget_planner: Number(e.target.value) })} disabled={busy}>
                        <option value="1">Shown</option>
                        <option value="0">Hidden</option>
                      </select>
                    ) : (
                      <button type="button" className="accumul8-inline-cell-trigger" onClick={() => beginEditRecurring(rp.id)} disabled={busy}>{rp.is_budget_planner ? 'Shown' : 'Hidden'}</button>
                    )}
                  </td>
                  <td>
                    {activeRecurringRowId === rp.id ? (
                      <select className="form-select form-select-sm accumul8-inline-editor accumul8-inline-editor--select" value={String(recurringDraft?.is_active ?? rp.is_active)} onChange={(e) => setRecurringRowDraft(rp, { is_active: Number(e.target.value) })} disabled={busy}>
                        <option value="1">Active</option>
                        <option value="0">Paused</option>
                      </select>
                    ) : (
                      <button type="button" className="accumul8-inline-cell-trigger" onClick={() => beginEditRecurring(rp.id)} disabled={busy}>{rp.is_active ? 'Active' : 'Paused'}</button>
                    )}
                  </td>
                  <td className="text-end is-compact-actions">
                    <div className="accumul8-row-actions accumul8-row-actions--always-on">
                      <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => beginEditRecurring(rp.id)} disabled={busy} aria-label={`View ${rp.title}`} title={`View ${rp.title}`}><span aria-hidden="true">{ACCUMUL8_VIEW_BUTTON_EMOJI}</span></button>
                      <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => beginEditRecurring(rp.id)} disabled={busy} aria-label={`Edit ${rp.title}`} title={`Edit ${rp.title}`}><span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span></button>
                      <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => openRecurringLinkModal(rp.id)} disabled={busy} aria-label={`Teach matching history for ${rp.title}`} title={`Teach matching history for ${rp.title}`}><span aria-hidden="true">{ACCUMUL8_MAP_BUTTON_EMOJI}</span></button>
                      <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => { if (window.confirm('Delete this recurring item?')) { void deleteRecurring(rp.id); } }} disabled={busy} aria-label={`Delete ${rp.title}`}><i className="bi bi-trash"></i></button>
                      <button type="button" className={`btn btn-sm btn-outline-primary accumul8-icon-action${flashingSaveButtonKey === `recurring-${rp.id}` ? ' is-flashing' : ''}`} onClick={() => void saveRecurringRow(rp)} disabled={busy || !recurringDraft} aria-label={`Save ${rp.title}`} title={recurringDraft ? `Save ${rp.title}` : `No changes to save for ${rp.title}`}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {recurringTable.rows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-muted py-4">No recurring items matched the current filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

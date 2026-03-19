import React from 'react';

import { Accumul8TableHeaderCell } from '../../accumul8/Accumul8TableHeaderCell';
import { ACCUMUL8_EDIT_BUTTON_EMOJI, ACCUMUL8_MAP_BUTTON_EMOJI, ACCUMUL8_SAVE_BUTTON_EMOJI, ACCUMUL8_VIEW_BUTTON_EMOJI } from '../../accumul8/accumul8Ui';
import { PriorityTableSortState } from '../../../hooks/usePriorityTableLayout';
import { Accumul8Transaction } from '../../../types/accumul8';
import { getAccumul8TransactionEditPolicy } from '../../../utils/accumul8TransactionPolicy';
import { formatInlineDate, formatInlineText } from './accumul8PageDateSearchUtils';
import { getActiveFilterClass, getLedgerDescriptionLabel, isOpeningBalanceTransaction } from './accumul8PageEntityUtils';
import { LedgerInlineDraft } from './accumul8PageFormUtils';

type LedgerFilterPreset = string;
type LedgerPaginationMode = '100' | 'all';

interface LedgerPagination {
  archivedCount: number;
  currentPage: number;
  isServerPaginated?: boolean;
  recentCount: number;
  rows: Accumul8Transaction[];
  totalPages: number;
  totalRows: number;
}

interface LedgerTableLayout {
  getColumnStyle: (key: string) => React.CSSProperties;
  requestSort: (columnKey: string) => void;
  sortState: PriorityTableSortState;
  startResize: (columnKey: string, event: React.MouseEvent<HTMLSpanElement>) => void;
  tableStyle: React.CSSProperties;
}

interface Accumul8LedgerTabProps {
  activeLedgerRowId: number | null;
  activateLedgerRow: (id: number) => void;
  beginEditTransaction: (id: number) => void;
  beginViewTransaction: (id: number) => void;
  busy: boolean;
  customLedgerEndDate: string;
  customLedgerStartDate: string;
  flashingSaveButtonKey: string | null;
  getAccountDisplayName: (accountId: number | null | undefined, accountName?: string | null, bankingOrganizationName?: string | null) => string;
  handleDeleteTransaction: (id: number, description?: string) => void | Promise<void>;
  ledgerDateFilter: string;
  ledgerDisplayBalanceById: Map<number, number>;
  ledgerDraftById: Record<number, LedgerInlineDraft>;
  ledgerFilterPreset: LedgerFilterPreset;
  ledgerPagination: LedgerPagination;
  ledgerPaginationMode: LedgerPaginationMode;
  ledgerTable: LedgerTableLayout;
  ledgerTableRef: React.RefObject<HTMLTableElement | null>;
  listSearchQuery: string;
  openCreateTransactionModal: () => void;
  openLedgerEntityModal: (transactionId: number) => void;
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
  saveLedgerRow: (row: Accumul8Transaction) => Promise<void>;
  setCustomLedgerEndDate: (value: string) => void;
  setCustomLedgerStartDate: (value: string) => void;
  setInlineRowRef: (key: string, node: HTMLTableRowElement | null) => void;
  setLedgerArchivePage: React.Dispatch<React.SetStateAction<number>>;
  setLedgerDateFilter: (value: string) => void;
  setLedgerFilterPreset: (value: LedgerFilterPreset) => void;
  setLedgerPaginationMode: (value: LedgerPaginationMode) => void;
  setLedgerRowDraft: (tx: Accumul8Transaction, patch: LedgerInlineDraft) => void;
  setListSearchQuery: (value: string) => void;
  filterPresetOptions: Array<{ value: LedgerFilterPreset; label: string }>;
}

export function Accumul8LedgerTab({
  activeLedgerRowId,
  activateLedgerRow,
  beginEditTransaction,
  beginViewTransaction,
  busy,
  customLedgerEndDate,
  customLedgerStartDate,
  filterPresetOptions,
  flashingSaveButtonKey,
  getAccountDisplayName,
  handleDeleteTransaction,
  ledgerDateFilter,
  ledgerDisplayBalanceById,
  ledgerDraftById,
  ledgerFilterPreset,
  ledgerPagination,
  ledgerPaginationMode,
  ledgerTable,
  ledgerTableRef,
  listSearchQuery,
  openCreateTransactionModal,
  openLedgerEntityModal,
  renderDateRangeControls,
  saveLedgerRow,
  setCustomLedgerEndDate,
  setCustomLedgerStartDate,
  setInlineRowRef,
  setLedgerArchivePage,
  setLedgerDateFilter,
  setLedgerFilterPreset,
  setLedgerPaginationMode,
  setLedgerRowDraft,
  setListSearchQuery,
}: Accumul8LedgerTabProps) {
  return (
    <div className="accumul8-panel accumul8-panel--viewport-fill">
      <div className="accumul8-panel-toolbar accumul8-panel-toolbar--ledger">
        <h3 className="mb-0">Ledger</h3>
        <div className="accumul8-panel-toolbar-controls accumul8-panel-toolbar-controls--ledger">
          {renderDateRangeControls(
            'ledger',
            ledgerDateFilter,
            setLedgerDateFilter,
            customLedgerStartDate,
            setCustomLedgerStartDate,
            customLedgerEndDate,
            setCustomLedgerEndDate,
            true,
          )}
          <div className="accumul8-panel-toolbar-search">
            <select className={getActiveFilterClass('form-select form-select-sm', ledgerFilterPreset !== 'all')} value={ledgerFilterPreset} onChange={(e) => setLedgerFilterPreset(e.target.value)} aria-label="Ledger quick filter">
              {filterPresetOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              type="text"
              className={getActiveFilterClass('form-control form-control-sm', listSearchQuery.trim() !== '')}
              value={listSearchQuery}
              onChange={(e) => setListSearchQuery(e.target.value)}
              placeholder="Search visible ledger rows"
              aria-label="Search visible ledger rows"
            />
          </div>
          <div className="accumul8-ledger-pagination-toolbar" aria-label="Ledger pagination controls">
            <label className="visually-hidden" htmlFor="accumul8-ledger-page-mode">Ledger page size</label>
            <select id="accumul8-ledger-page-mode" className={getActiveFilterClass('form-select form-select-sm', ledgerPaginationMode !== '100')} value={ledgerPaginationMode} onChange={(e) => setLedgerPaginationMode(e.target.value as LedgerPaginationMode)} aria-label="Ledger page size">
              <option value="100">{ledgerPagination.isServerPaginated ? 'One server page at a time' : '100 older rows per page'}</option>
              <option value="all">Load all rows</option>
            </select>
            {ledgerPaginationMode !== 'all' && ledgerPagination.totalPages > 1 ? (
              <div className="accumul8-ledger-pagination-nav">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setLedgerArchivePage((current) => Math.max(current - 1, 1))} disabled={ledgerPagination.currentPage <= 1}>Prev</button>
                <span className="accumul8-ledger-pagination-status">{ledgerPagination.isServerPaginated ? 'Page' : 'Older pages'} {ledgerPagination.currentPage} / {ledgerPagination.totalPages}</span>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setLedgerArchivePage((current) => Math.min(current + 1, ledgerPagination.totalPages))} disabled={ledgerPagination.currentPage >= ledgerPagination.totalPages}>Next</button>
              </div>
            ) : null}
          </div>
        </div>
        <button type="button" className="btn btn-success btn-sm" onClick={openCreateTransactionModal} disabled={busy}>Add Ledger Entry</button>
      </div>
      <div className="accumul8-ledger-pagination-summary">
        {ledgerPaginationMode === 'all'
          ? `Showing all ${ledgerPagination.totalRows} filtered ledger transaction${ledgerPagination.totalRows === 1 ? '' : 's'} on one page.`
          : ledgerPagination.isServerPaginated
            ? `Showing ${ledgerPagination.rows.length} ledger transaction${ledgerPagination.rows.length === 1 ? '' : 's'} from server page ${ledgerPagination.currentPage} of ${ledgerPagination.totalPages}. Load all rows to search or filter across the full ledger history.`
            : `Showing ${ledgerPagination.rows.length} filtered ledger transaction${ledgerPagination.rows.length === 1 ? '' : 's'} on this page, including ${ledgerPagination.recentCount} from the last 60 days and ${ledgerPagination.archivedCount} older transaction${ledgerPagination.archivedCount === 1 ? '' : 's'} split into ${ledgerPagination.totalPages} page${ledgerPagination.totalPages === 1 ? '' : 's'}.`}
      </div>
      <div className="table-responsive mt-3 accumul8-scroll-area accumul8-scroll-area--ledger">
        <table ref={ledgerTableRef} className="table table-sm accumul8-table accumul8-table--measured accumul8-table--ledger accumul8-ledger-table accumul8-sticky-head" style={ledgerTable.tableStyle}>
          <colgroup>
            <col style={ledgerTable.getColumnStyle('date')} />
            <col style={ledgerTable.getColumnStyle('due')} />
            <col style={ledgerTable.getColumnStyle('account')} />
            <col style={ledgerTable.getColumnStyle('description')} />
            <col style={ledgerTable.getColumnStyle('memo')} />
            <col style={ledgerTable.getColumnStyle('amount')} />
            <col style={ledgerTable.getColumnStyle('balance')} />
            <col style={ledgerTable.getColumnStyle('paid')} />
            <col style={ledgerTable.getColumnStyle('reconciled')} />
            <col style={ledgerTable.getColumnStyle('actions')} />
          </colgroup>
          <thead><tr>
            <Accumul8TableHeaderCell label="Date" columnKey="date" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
            <Accumul8TableHeaderCell label="Due" columnKey="due" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
            <Accumul8TableHeaderCell label="Acct" columnKey="account" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
            <Accumul8TableHeaderCell label="Description" columnKey="description" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
            <Accumul8TableHeaderCell label="Memo" columnKey="memo" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
            <Accumul8TableHeaderCell label="Amt" columnKey="amount" className="text-end" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
            <Accumul8TableHeaderCell label="Bal" columnKey="balance" className="text-end" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
            <Accumul8TableHeaderCell label="Paid" columnKey="paid" className="text-center" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
            <Accumul8TableHeaderCell label="Rec'd" columnKey="reconciled" className="text-center" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
            <Accumul8TableHeaderCell label="Actions" columnKey="actions" className="text-end" sortable={false} sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
          </tr></thead>
          <tbody>
            {ledgerPagination.rows.map((tx) => {
              const txEditPolicy = getAccumul8TransactionEditPolicy(tx);
              return (
                <tr
                  key={tx.id}
                  ref={(node) => setInlineRowRef(`ledger-${tx.id}`, node)}
                  className={['accumul8-list-item', tx.amount < 0 ? 'is-outflow' : 'is-inflow', isOpeningBalanceTransaction(tx) ? 'is-opening-balance' : '', activeLedgerRowId === tx.id ? 'is-editing' : '', ledgerDraftById[tx.id] ? 'has-draft' : ''].filter(Boolean).join(' ')}
                >
                  <td>{activeLedgerRowId === tx.id ? <input className="form-control form-control-sm accumul8-month-table-input" type="date" value={ledgerDraftById[tx.id]?.transaction_date ?? tx.transaction_date} onChange={(e) => setLedgerRowDraft(tx, { transaction_date: e.target.value })} disabled={busy || !txEditPolicy.canEditCoreFields} /> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineDate(tx.transaction_date)}</button>}</td>
                  <td>{activeLedgerRowId === tx.id ? <input className="form-control form-control-sm accumul8-month-table-input" type="date" value={ledgerDraftById[tx.id]?.due_date ?? tx.due_date ?? ''} onChange={(e) => setLedgerRowDraft(tx, { due_date: e.target.value })} disabled={busy || !txEditPolicy.canEditCoreFields} /> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineDate(tx.due_date)}</button>}</td>
                  <td><button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{getAccountDisplayName(tx.account_id, tx.account_name, tx.banking_organization_name)}</button></td>
                  <td>
                    {activeLedgerRowId === tx.id ? (
                      <input className="form-control form-control-sm accumul8-month-table-input" value={ledgerDraftById[tx.id]?.description ?? tx.description} onChange={(e) => setLedgerRowDraft(tx, { description: e.target.value })} disabled={busy || !txEditPolicy.canEditCoreFields} />
                    ) : (
                      <button type="button" className={`accumul8-inline-cell-trigger${isOpeningBalanceTransaction(tx) ? ' accumul8-inline-cell-trigger--ledger-description' : ''}`} onClick={() => activateLedgerRow(tx.id)} disabled={busy}>
                        {isOpeningBalanceTransaction(tx) && <span className="accumul8-opening-balance-pin">Pinned</span>}
                        <span>{getLedgerDescriptionLabel(tx, ledgerDraftById[tx.id])}</span>
                      </button>
                    )}
                  </td>
                  <td>{activeLedgerRowId === tx.id ? <input className="form-control form-control-sm accumul8-month-table-input" value={ledgerDraftById[tx.id]?.memo ?? tx.memo} onChange={(e) => setLedgerRowDraft(tx, { memo: e.target.value })} disabled={busy} /> : <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineText(tx.memo, '-')}</button>}</td>
                  <td className="text-end">{activeLedgerRowId === tx.id ? <input className="form-control form-control-sm accumul8-month-table-input" type="number" step="0.01" value={ledgerDraftById[tx.id]?.amount ?? tx.amount} onChange={(e) => setLedgerRowDraft(tx, { amount: Number(e.target.value) })} disabled={busy || !txEditPolicy.canEditCoreFields} /> : <button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{tx.amount.toFixed(2)}</button>}</td>
                  <td className="text-end">{Number(ledgerDisplayBalanceById.get(tx.id) ?? tx.running_balance ?? 0).toFixed(2)}</td>
                  <td className="text-center accumul8-ledger-toggle-cell">
                    <input className="form-check-input accumul8-ledger-checkbox" type="checkbox" checked={Number(ledgerDraftById[tx.id]?.is_paid ?? tx.is_paid) === 1} onChange={(e) => setLedgerRowDraft(tx, { is_paid: e.target.checked ? 1 : 0 })} disabled={busy || !txEditPolicy.canEditPaidState} aria-label={`Mark ${tx.description} as paid`} />
                  </td>
                  <td className="text-center accumul8-ledger-toggle-cell">
                    <input className="form-check-input accumul8-ledger-checkbox" type="checkbox" checked={Number(ledgerDraftById[tx.id]?.is_reconciled ?? tx.is_reconciled) === 1} onChange={(e) => setLedgerRowDraft(tx, { is_reconciled: e.target.checked ? 1 : 0 })} disabled={busy} aria-label={`Mark ${tx.description} as reconciled`} />
                  </td>
                  <td className="text-end is-compact-actions">
                    <div className="accumul8-row-actions">
                      <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => beginViewTransaction(tx.id)} disabled={busy} aria-label={`View ${tx.description}`} title={`View ${tx.description}`}><span aria-hidden="true">{ACCUMUL8_VIEW_BUTTON_EMOJI}</span></button>
                      <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => (Number(tx.debtor_id || 0) > 0 ? beginEditTransaction(tx.id) : activateLedgerRow(tx.id))} disabled={busy} aria-label={`Edit ${tx.description}`} title={`Edit ${tx.description}`}><span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span></button>
                      {Number(tx.debtor_id || 0) <= 0 ? <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => openLedgerEntityModal(tx.id)} disabled={busy} aria-label={`Map ${tx.description} to an entity alias`} title={`Map ${tx.description} to an entity alias`}><span aria-hidden="true">{ACCUMUL8_MAP_BUTTON_EMOJI}</span></button> : null}
                      <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => void handleDeleteTransaction(tx.id, tx.description)} disabled={busy || !txEditPolicy.canDelete} aria-label={`Delete ${tx.description}`} title={txEditPolicy.canDelete ? `Delete ${tx.description}` : `${txEditPolicy.sourceLabel} transactions cannot be deleted here`}><span aria-hidden="true">🗑️</span></button>
                      <button type="button" className={`btn btn-sm btn-outline-primary accumul8-icon-action${flashingSaveButtonKey === `ledger-${tx.id}` ? ' is-flashing' : ''}`} onClick={() => void saveLedgerRow(tx)} disabled={busy || !ledgerDraftById[tx.id]} aria-label={`Save ${tx.description}`} title={ledgerDraftById[tx.id] ? `Save ${tx.description}` : `No changes to save for ${tx.description}`}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {ledgerPagination.rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-muted py-4">No ledger entries matched the current filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

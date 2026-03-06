import React from 'react';
import { Accumul8Transaction } from '../../types/accumul8';
import {
  buildSpreadsheetMonthData,
  buildSpreadsheetMonthOptions,
  shiftMonthValue,
} from '../../utils/accumul8Spreadsheet';

interface Accumul8SpreadsheetViewProps {
  busy: boolean;
  selectedMonth: string;
  transactions: Accumul8Transaction[];
  onSelectedMonthChange: (monthValue: string) => void;
  onEditTransaction: (id: number) => void;
  onDeleteTransaction: (id: number, description: string) => void;
}

function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

export function Accumul8SpreadsheetView({
  busy,
  selectedMonth,
  transactions,
  onSelectedMonthChange,
  onEditTransaction,
  onDeleteTransaction,
}: Accumul8SpreadsheetViewProps) {
  const monthOptions = React.useMemo(
    () => buildSpreadsheetMonthOptions(transactions, selectedMonth),
    [selectedMonth, transactions],
  );

  const visibleMonths = React.useMemo(
    () => [
      shiftMonthValue(selectedMonth, -1),
      selectedMonth,
      shiftMonthValue(selectedMonth, 1),
    ],
    [selectedMonth],
  );

  const monthPanels = React.useMemo(
    () => visibleMonths.map((monthValue) => buildSpreadsheetMonthData(transactions, monthValue)),
    [transactions, visibleMonths],
  );

  return (
    <div className="accumul8-spreadsheet">
      <div className="accumul8-panel-toolbar mb-3">
        <div>
          <h3 className="mb-1">Budget Planner</h3>
          <p className="small text-muted mb-0">Choose the center month to view the previous, current, and next month side-by-side from the ledger.</p>
        </div>
        <div className="accumul8-spreadsheet-selector">
          <label htmlFor="budget-month" className="small text-muted mb-1">Center month</label>
          <select
            id="budget-month"
            className="form-select form-select-sm"
            value={selectedMonth}
            onChange={(event) => onSelectedMonthChange(event.target.value)}
            disabled={busy}
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="accumul8-spreadsheet-grid">
        {monthPanels.map((panel, panelIndex) => {
          const isCenter = panelIndex === 1;
          const summary = panel.summary;
          return (
            <section
              key={panel.monthValue}
              className={`accumul8-month-panel ${isCenter ? 'is-center' : ''}`}
              aria-label={`${panel.monthLabel} spreadsheet panel`}
            >
              <header className="accumul8-month-panel-header">
                <div>
                  <p className="accumul8-month-panel-kicker mb-1">{isCenter ? 'Selected month' : 'Adjacent month'}</p>
                  <h4 className="mb-0">{panel.monthLabel}</h4>
                </div>
                <div className="accumul8-month-stats">
                  <span>{summary.transactionCount} rows</span>
                  <span>{summary.paidCount} paid</span>
                  <span>{summary.reconciledCount} reconciled</span>
                </div>
              </header>

              <div className="accumul8-month-summary">
                <div>
                  <span>Inflow</span>
                  <strong>{formatCurrency(summary.inflow)}</strong>
                </div>
                <div>
                  <span>Outflow</span>
                  <strong>{formatCurrency(summary.outflow)}</strong>
                </div>
                <div>
                  <span>RTA</span>
                  <strong>{formatCurrency(summary.rta)}</strong>
                </div>
                <div>
                  <span>Net</span>
                  <strong>{formatCurrency(summary.net)}</strong>
                </div>
              </div>

              <div className="accumul8-month-balance-row">
                <span>
                  Opening balance:{' '}
                  <strong>{summary.openingBalance === null ? (summary.hasMixedAccounts ? 'Mixed accounts' : '-') : formatCurrency(summary.openingBalance)}</strong>
                </span>
                <span>
                  Closing balance:{' '}
                  <strong>{summary.closingBalance === null ? (summary.hasMixedAccounts ? 'Mixed accounts' : '-') : formatCurrency(summary.closingBalance)}</strong>
                </span>
              </div>

              <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--spreadsheet">
                <table className="table table-sm accumul8-sticky-head accumul8-month-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Pay</th>
                      <th>Due</th>
                      <th>Vendor</th>
                      <th>Paid</th>
                      <th>Reconciled</th>
                      <th className="text-end">Amount</th>
                      <th className="text-end">Balance</th>
                      <th className="text-end">RTA</th>
                      <th>Notes</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panel.rows.length > 0 ? panel.rows.map((transaction) => (
                      <tr key={transaction.id} className={transaction.amount < 0 ? 'is-outflow' : 'is-inflow'}>
                        <td>{transaction.entry_type || 'manual'}</td>
                        <td title={transaction.transaction_date || ''}>{transaction.payDayLabel}</td>
                        <td title={transaction.due_date || ''}>{transaction.dueDayLabel}</td>
                        <td>{transaction.description || '-'}</td>
                        <td>
                          <span className={`accumul8-status-pill ${transaction.is_paid ? 'is-on' : 'is-off'}`}>
                            {transaction.is_paid ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td>
                          <span className={`accumul8-status-pill ${transaction.is_reconciled ? 'is-on' : 'is-off'}`}>
                            {transaction.is_reconciled ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="text-end">{Number(transaction.amount || 0).toFixed(2)}</td>
                        <td className="text-end">{Number(transaction.running_balance || 0).toFixed(2)}</td>
                        <td className="text-end">{Number(transaction.rta_amount || 0).toFixed(2)}</td>
                        <td>{transaction.notesLabel}</td>
                        <td className="text-end">
                          <div className="accumul8-row-actions accumul8-row-actions--always-on">
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onEditTransaction(transaction.id)} disabled={busy} aria-label={`Edit ${transaction.description}`}>
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => onDeleteTransaction(transaction.id, transaction.description)}
                              disabled={busy}
                              aria-label={`Delete ${transaction.description}`}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={11} className="text-center text-muted py-4">No ledger rows in this month yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

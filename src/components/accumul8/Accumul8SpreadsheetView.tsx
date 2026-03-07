import React from 'react';
import { Accumul8PaymentMethod, Accumul8RecurringPayment } from '../../types/accumul8';
import {
  buildSpreadsheetMonthData,
  buildSpreadsheetMonthOptions,
  shiftMonthValue,
} from '../../utils/accumul8Spreadsheet';

interface Accumul8SpreadsheetViewProps {
  busy: boolean;
  selectedMonth: string;
  recurringPayments: Accumul8RecurringPayment[];
  onSelectedMonthChange: (monthValue: string) => void;
  onEditRecurring: (id: number) => void;
  onDeleteRecurring: (id: number, description: string) => void;
}

function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

export function Accumul8SpreadsheetView({
  busy,
  selectedMonth,
  recurringPayments,
  onSelectedMonthChange,
  onEditRecurring,
  onDeleteRecurring,
}: Accumul8SpreadsheetViewProps) {
  const paymentMethodLabels: Record<Accumul8PaymentMethod, string> = {
    unspecified: 'Unspecified',
    autopay: 'Autopay',
    manual: 'Manual',
  };
  const monthOptions = React.useMemo(
    () => buildSpreadsheetMonthOptions(recurringPayments, selectedMonth),
    [recurringPayments, selectedMonth],
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
    () => visibleMonths.map((monthValue) => buildSpreadsheetMonthData(recurringPayments, monthValue)),
    [recurringPayments, visibleMonths],
  );

  return (
    <div className="accumul8-spreadsheet">
      <div className="accumul8-panel-toolbar mb-3">
        <div>
          <h3 className="mb-1">Budget Planner</h3>
          <p className="small text-muted mb-0">Reflect on last month, work through this month, and plan the next month using only your curated budget-planner records.</p>
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
                  <span>{summary.recurringCount} recurring</span>
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
                  <span>Net</span>
                  <strong>{formatCurrency(summary.net)}</strong>
                </div>
              </div>

              <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--spreadsheet">
                <table className="table table-sm accumul8-sticky-head accumul8-month-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Due</th>
                      <th>Vendor</th>
                      <th>Account</th>
                      <th>Method</th>
                      <th>Frequency</th>
                      <th className="text-end">Amount</th>
                      <th>Notes</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panel.rows.length > 0 ? panel.rows.map((row) => (
                      <tr key={row.rowKey} className={row.amount < 0 ? 'is-outflow' : 'is-inflow'}>
                        <td>{row.direction === 'inflow' ? 'Inflow' : 'Outflow'}</td>
                        <td title={row.due_date || ''}>{row.dueDayLabel}</td>
                        <td>{row.title || '-'}</td>
                        <td>{row.account_name || row.banking_organization_name || '-'}</td>
                        <td>{paymentMethodLabels[(row.payment_method || 'unspecified') as Accumul8PaymentMethod]}</td>
                        <td>{row.frequency}</td>
                        <td className="text-end">{Number(row.amount || 0).toFixed(2)}</td>
                        <td>{row.notes || '-'}</td>
                        <td className="text-end">
                          <div className="accumul8-row-actions accumul8-row-actions--always-on">
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onEditRecurring(row.recurring_id)} disabled={busy} aria-label={`Edit ${row.title}`}>
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => onDeleteRecurring(row.recurring_id, row.title)}
                              disabled={busy}
                              aria-label={`Delete ${row.title}`}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={9} className="text-center text-muted py-4">No budget-planner recurring payments in this month yet.</td>
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

import React from 'react';
import {
  Accumul8Account,
  Accumul8Contact,
  Accumul8PaymentMethod,
  Accumul8RecurringPayment,
  Accumul8RecurringUpsertRequest,
} from '../../types/accumul8';
import {
  Accumul8SpreadsheetMonthRow,
  buildSpreadsheetMonthData,
  buildSpreadsheetMonthOptions,
  shiftMonthValue,
} from '../../utils/accumul8Spreadsheet';

interface Accumul8SpreadsheetViewProps {
  busy: boolean;
  selectedMonth: string;
  recurringPayments: Accumul8RecurringPayment[];
  contacts: Accumul8Contact[];
  accounts: Accumul8Account[];
  onSelectedMonthChange: (monthValue: string) => void;
  onCreateContact: (form: {
    contact_name: string;
    contact_type: 'payee' | 'payer' | 'both';
    default_amount: number;
    email: string;
    phone_number: string;
    street_address: string;
    city: string;
    state: string;
    zip: string;
    notes: string;
  }) => Promise<{ id?: number } | void>;
  onUpdateRecurring: (id: number, form: Accumul8RecurringUpsertRequest) => Promise<void>;
  onDeleteRecurring: (id: number, description: string) => void;
}

interface EditableSpreadsheetRow extends Accumul8SpreadsheetMonthRow {
  original_due_date: string;
  rta: number;
  balance: number;
  vendor_input: string;
}

function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function shiftDateByDays(dateValue: string, dayDelta: number): string {
  const base = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) {
    return dateValue;
  }
  base.setUTCDate(base.getUTCDate() + dayDelta);
  return base.toISOString().slice(0, 10);
}

function getTodayDateValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function compareRowTimeline(left: EditableSpreadsheetRow, right: EditableSpreadsheetRow): number {
  if (left.due_date !== right.due_date) {
    return left.due_date.localeCompare(right.due_date);
  }
  return left.rowKey.localeCompare(right.rowKey);
}

function resolveBalanceScopeKey(row: EditableSpreadsheetRow): string {
  if (Number(row.account_id || 0) > 0) {
    return `account:${Number(row.account_id)}`;
  }
  if (Number(row.banking_organization_id || 0) > 0) {
    return `banking_organization:${Number(row.banking_organization_id)}`;
  }
  return 'unassigned';
}

export function Accumul8SpreadsheetView({
  busy,
  selectedMonth,
  recurringPayments,
  contacts,
  accounts,
  onSelectedMonthChange,
  onCreateContact,
  onUpdateRecurring,
  onDeleteRecurring,
}: Accumul8SpreadsheetViewProps) {
  const [rowRtaByKey, setRowRtaByKey] = React.useState<Record<string, number>>({});
  const [draftRowByKey, setDraftRowByKey] = React.useState<Record<string, EditableSpreadsheetRow>>({});
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
      selectedMonth,
      shiftMonthValue(selectedMonth, 1),
    ],
    [selectedMonth],
  );

  const monthPanels = React.useMemo(
    () => visibleMonths.map((monthValue) => buildSpreadsheetMonthData(recurringPayments, monthValue)),
    [recurringPayments, visibleMonths],
  );
  const todayDateValue = React.useMemo(() => getTodayDateValue(), []);
  const balanceBaseByScope = React.useMemo(() => {
    const next: Record<string, number> = { unassigned: NaN };
    accounts.forEach((account) => {
      next[`account:${account.id}`] = Number(account.current_balance || 0);
    });
    const totalsByBankingOrganization: Record<string, number> = {};
    accounts.forEach((account) => {
      const bankingOrganizationId = Number(account.banking_organization_id || 0);
      if (bankingOrganizationId <= 0) {
        return;
      }
      const key = `banking_organization:${bankingOrganizationId}`;
      totalsByBankingOrganization[key] = Number((totalsByBankingOrganization[key] || 0) + Number(account.current_balance || 0));
    });
    Object.entries(totalsByBankingOrganization).forEach(([key, value]) => {
      next[key] = Number(value.toFixed(2));
    });
    return next;
  }, [accounts]);
  const projectionRows = React.useMemo(() => {
    const earliestMonth = todayDateValue.slice(0, 7) < visibleMonths[0] ? todayDateValue.slice(0, 7) : visibleMonths[0];
    const latestMonth = todayDateValue.slice(0, 7) > visibleMonths[visibleMonths.length - 1] ? todayDateValue.slice(0, 7) : visibleMonths[visibleMonths.length - 1];
    const allRows: EditableSpreadsheetRow[] = [];
    let cursor = earliestMonth;
    while (cursor <= latestMonth) {
      buildSpreadsheetMonthData(recurringPayments, cursor).rows.forEach((row) => {
        const draft = draftRowByKey[row.rowKey] || null;
        allRows.push({
          ...row,
          original_due_date: row.due_date,
          vendor_input: row.contact_name || row.title || '',
          rta: Number(rowRtaByKey[row.rowKey] || 0),
          balance: 0,
          ...draft,
        });
      });
      cursor = shiftMonthValue(cursor, 1);
    }
    return allRows.sort(compareRowTimeline);
  }, [draftRowByKey, recurringPayments, rowRtaByKey, todayDateValue, visibleMonths]);
  const monthPanelsWithProjection = React.useMemo(
    () => {
      const balanceByRowKey: Record<string, number> = {};
      const rowsByScope = new Map<string, EditableSpreadsheetRow[]>();
      projectionRows.forEach((row) => {
        const scopeKey = resolveBalanceScopeKey(row);
        const bucket = rowsByScope.get(scopeKey) || [];
        bucket.push(row);
        rowsByScope.set(scopeKey, bucket);
      });

      rowsByScope.forEach((scopeRows, scopeKey) => {
        const baseBalance = Number(balanceBaseByScope[scopeKey]);
        if (!Number.isFinite(baseBalance)) {
          scopeRows.forEach((row) => {
            balanceByRowKey[row.rowKey] = NaN;
          });
          return;
        }

        const pastRows = scopeRows.filter((row) => row.due_date < todayDateValue).sort(compareRowTimeline);
        let cumulativeLater = 0;
        for (let index = pastRows.length - 1; index >= 0; index -= 1) {
          const row = pastRows[index];
          balanceByRowKey[row.rowKey] = Number((baseBalance - cumulativeLater).toFixed(2));
          cumulativeLater = Number((cumulativeLater + Number(row.amount || 0) + Number(row.rta || 0)).toFixed(2));
        }

        const todayRows = scopeRows.filter((row) => row.due_date === todayDateValue).sort(compareRowTimeline);
        todayRows.forEach((row) => {
          balanceByRowKey[row.rowKey] = Number(baseBalance.toFixed(2));
        });

        const futureRows = scopeRows.filter((row) => row.due_date > todayDateValue).sort(compareRowTimeline);
        let cumulativeFuture = 0;
        futureRows.forEach((row) => {
          cumulativeFuture = Number((cumulativeFuture + Number(row.amount || 0) + Number(row.rta || 0)).toFixed(2));
          balanceByRowKey[row.rowKey] = Number((baseBalance + cumulativeFuture).toFixed(2));
        });
      });

      return monthPanels.map((panel) => ({
        ...panel,
        rows: panel.rows.map((row) => {
          const draft = draftRowByKey[row.rowKey] || null;
          return {
            ...row,
            original_due_date: row.due_date,
            vendor_input: row.contact_name || row.title || '',
            rta: Number(rowRtaByKey[row.rowKey] || 0),
            balance: Number.isFinite(balanceByRowKey[row.rowKey]) ? balanceByRowKey[row.rowKey] : NaN,
            ...draft,
          };
        }),
      }));
    },
    [balanceBaseByScope, draftRowByKey, monthPanels, projectionRows, rowRtaByKey, todayDateValue],
  );

  const handleMonthShift = React.useCallback((offset: number) => {
    onSelectedMonthChange(shiftMonthValue(selectedMonth, offset));
  }, [onSelectedMonthChange, selectedMonth]);

  const handleRowRtaChange = React.useCallback((rowKey: string, rawValue: string) => {
    const parsed = rawValue === '' ? 0 : Number(rawValue);
    setRowRtaByKey((prev) => ({
      ...prev,
      [rowKey]: Number.isFinite(parsed) ? parsed : 0,
    }));
    setDraftRowByKey((prev) => {
      const existing = prev[rowKey];
      if (!existing) {
        return prev;
      }
      return {
        ...prev,
        [rowKey]: {
          ...existing,
          rta: Number.isFinite(parsed) ? parsed : 0,
        },
      };
    });
  }, []);
  const setRowDraft = React.useCallback((row: EditableSpreadsheetRow, patch: Partial<EditableSpreadsheetRow>) => {
    setDraftRowByKey((prev) => ({
      ...prev,
      [row.rowKey]: {
        ...row,
        ...prev[row.rowKey],
        ...patch,
      },
    }));
  }, []);
  const saveRow = React.useCallback(async (row: EditableSpreadsheetRow) => {
    const recurring = recurringPayments.find((item) => item.id === row.recurring_id);
    if (!recurring) {
      return;
    }

    let contactId: number | null = row.contact_id ?? null;
    const vendorName = String(row.vendor_input || '').trim();
    if (vendorName !== '') {
      const matched = contacts.find((contact) => contact.contact_name.trim().toLowerCase() === vendorName.toLowerCase());
      if (matched) {
        contactId = matched.id;
      } else {
        const created = await onCreateContact({
          contact_name: vendorName,
          contact_type: 'payee',
          default_amount: 0,
          email: '',
          phone_number: '',
          street_address: '',
          city: '',
          state: '',
          zip: '',
          notes: '',
        });
        const createdId = created && typeof created === 'object' && 'id' in created ? Number(created.id || 0) : 0;
        contactId = createdId > 0 ? createdId : null;
      }
    } else {
      contactId = null;
    }

    const dayDelta = (() => {
      const previous = new Date(`${row.original_due_date}T00:00:00Z`).getTime();
      const next = new Date(`${String(row.due_date || '')}T00:00:00Z`).getTime();
      if (!Number.isFinite(previous) || !Number.isFinite(next)) {
        return 0;
      }
      return Math.round((next - previous) / 86400000);
    })();

    const nextDueDate = dayDelta === 0
      ? recurring.next_due_date
      : shiftDateByDays(recurring.next_due_date, dayDelta);

    await onUpdateRecurring(row.recurring_id, {
      title: vendorName || row.title || recurring.title,
      direction: row.direction === 'inflow' ? 'inflow' : 'outflow',
      amount: Math.abs(Number(row.amount || 0)),
      frequency: (row.frequency || recurring.frequency) as 'daily' | 'weekly' | 'biweekly' | 'monthly',
      payment_method: (row.payment_method || recurring.payment_method) as Accumul8PaymentMethod,
      interval_count: Number(recurring.interval_count || 1),
      next_due_date: nextDueDate,
      contact_id: contactId,
      account_id: row.account_id ?? null,
      is_budget_planner: Number(recurring.is_budget_planner || 0),
      notes: row.notes || '',
    });
    setDraftRowByKey((prev) => {
      const next = { ...prev };
      delete next[row.rowKey];
      return next;
    });
  }, [contacts, onCreateContact, onUpdateRecurring, recurringPayments]);

  return (
    <div className="accumul8-spreadsheet">
      <div className="accumul8-panel-toolbar mb-3">
        <div>
          <h3 className="mb-1">Budget Planner</h3>
          <p className="small text-muted mb-0">Step month by month through your budget-planner records and test quick adjustments inline.</p>
        </div>
        <div className="accumul8-spreadsheet-nav">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => handleMonthShift(-1)} disabled={busy} aria-label="Previous month">
            <i className="bi bi-chevron-left"></i>
          </button>
          <div className="accumul8-spreadsheet-nav-label">
            {monthOptions.find((option) => option.value === selectedMonth)?.label || selectedMonth}
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => handleMonthShift(1)} disabled={busy} aria-label="Next month">
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>

      <div className="accumul8-spreadsheet-grid">
        {monthPanelsWithProjection.map((panel, panelIndex) => {
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

              <div className="accumul8-scroll-area accumul8-scroll-area--spreadsheet">
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
                      <th className="text-end">RTA</th>
                      <th className="text-end">Balance</th>
                      <th>Notes</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panel.rows.length > 0 ? panel.rows.map((row) => (
                      <tr key={row.rowKey} className={row.amount < 0 ? 'is-outflow' : 'is-inflow'}>
                        <td>
                          <select
                            className="form-select form-select-sm accumul8-month-table-select"
                            value={row.direction}
                            onChange={(event) => setRowDraft(row, { direction: event.target.value })}
                            disabled={busy}
                          >
                            <option value="outflow">Outflow</option>
                            <option value="inflow">Inflow</option>
                          </select>
                        </td>
                        <td title={row.due_date || ''}>
                          <input
                            className="form-control form-control-sm accumul8-month-table-input"
                            type="date"
                            value={row.due_date}
                            onChange={(event) => setRowDraft(row, { due_date: event.target.value, dueDayLabel: event.target.value.slice(8, 10) })}
                            disabled={busy}
                          />
                        </td>
                        <td>
                          <input
                            className="form-control form-control-sm accumul8-month-table-input"
                            list={`accumul8-vendor-options-${panel.monthValue}`}
                            value={row.vendor_input}
                            onChange={(event) => setRowDraft(row, { vendor_input: event.target.value, title: event.target.value })}
                            disabled={busy}
                          />
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm accumul8-month-table-select"
                            value={row.account_id ?? ''}
                            onChange={(event) => {
                              const selectedAccountId = event.target.value === '' ? null : Number(event.target.value);
                              const account = accounts.find((item) => item.id === selectedAccountId) || null;
                              setRowDraft(row, {
                                account_id: selectedAccountId,
                                banking_organization_id: account?.banking_organization_id ?? null,
                                account_name: account?.account_name || '',
                                banking_organization_name: account?.banking_organization_name || '',
                              });
                            }}
                            disabled={busy}
                          >
                            <option value="">None</option>
                            {accounts.map((account) => (
                              <option key={account.id} value={account.id}>{account.account_name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm accumul8-month-table-select"
                            value={row.payment_method}
                            onChange={(event) => setRowDraft(row, { payment_method: event.target.value })}
                            disabled={busy}
                          >
                            {Object.entries(paymentMethodLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm accumul8-month-table-select"
                            value={row.frequency}
                            onChange={(event) => setRowDraft(row, { frequency: event.target.value })}
                            disabled={busy}
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Biweekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </td>
                        <td className="text-end">
                          <input
                            className="form-control form-control-sm accumul8-month-table-input"
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(event) => {
                              const parsed = Number(event.target.value);
                              setRowDraft(row, { amount: Number.isFinite(parsed) ? parsed : 0 });
                            }}
                            disabled={busy}
                          />
                        </td>
                        <td className="text-end">
                          <input
                            className="form-control form-control-sm accumul8-month-table-input"
                            type="number"
                            step="0.01"
                            value={row.rta}
                            onChange={(event) => handleRowRtaChange(row.rowKey, event.target.value)}
                            disabled={busy}
                            aria-label={`${row.title} real time adjustment`}
                          />
                        </td>
                        <td className="text-end">{Number.isFinite(row.balance) ? Number(row.balance || 0).toFixed(2) : '-'}</td>
                        <td>
                          <input
                            className="form-control form-control-sm accumul8-month-table-input"
                            value={row.notes || ''}
                            onChange={(event) => setRowDraft(row, { notes: event.target.value })}
                            disabled={busy}
                          />
                        </td>
                        <td className="text-end">
                          <div className="accumul8-row-actions accumul8-row-actions--always-on">
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void saveRow(row)} disabled={busy} aria-label={`Save ${row.title || 'row'}`}>Save</button>
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
                        <td colSpan={11} className="text-center text-muted py-4">No budget-planner recurring payments in this month yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <datalist id={`accumul8-vendor-options-${panel.monthValue}`}>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.contact_name} />
                  ))}
                </datalist>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

import React from 'react';
import {
  Accumul8Account,
  Accumul8Entity,
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
import { getAccumul8AccountDisplayName } from '../../utils/accumul8Accounts';
import {
  ACCUMUL8_EDIT_BUTTON_EMOJI,
  ACCUMUL8_SAVE_BUTTON_EMOJI,
  ACCUMUL8_VIEW_BUTTON_EMOJI,
} from './accumul8Ui';
import { Accumul8TableHeaderCell } from './Accumul8TableHeaderCell';
import { PriorityTableColumn, usePriorityTableLayout } from '../../hooks/usePriorityTableLayout';

interface Accumul8SpreadsheetViewProps {
  busy: boolean;
  selectedMonth: string;
  recurringPayments: Accumul8RecurringPayment[];
  entities: Accumul8Entity[];
  accounts: Accumul8Account[];
  onSelectedMonthChange: (monthValue: string) => void;
  onUpdateRecurring: (id: number, form: Accumul8RecurringUpsertRequest) => Promise<void>;
  onDeleteRecurring: (id: number, description: string) => void;
  onOpenRecurring: (id: number) => void;
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

function formatDateLabel(value: string): string {
  if (!value) {
    return '-';
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  });
}

function formatEditableValue(value: string | number | null | undefined, fallback = '-'): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback;
  }
  return String(value || '').trim() || fallback;
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
  entities,
  accounts,
  onSelectedMonthChange,
  onUpdateRecurring,
  onDeleteRecurring,
  onOpenRecurring,
}: Accumul8SpreadsheetViewProps) {
  const [activeRowKey, setActiveRowKey] = React.useState<string | null>(null);
  const [budgetFilterQuery, setBudgetFilterQuery] = React.useState('');
  const [rowRtaByKey, setRowRtaByKey] = React.useState<Record<string, number>>({});
  const [draftRowByKey, setDraftRowByKey] = React.useState<Record<string, EditableSpreadsheetRow>>({});
  const inlineRowRefs = React.useRef<Record<string, HTMLTableRowElement | null>>({});
  const budgetTableRef = React.useRef<HTMLTableElement | null>(null);
  const paymentMethodLabels: Record<Accumul8PaymentMethod, string> = {
    unspecified: 'Unspecified',
    autopay: 'Autopay',
    manual: 'Manual',
  };
  const accountDisplayNameById = React.useMemo(() => {
    const next: Record<number, string> = {};
    accounts.forEach((account) => {
      next[account.id] = getAccumul8AccountDisplayName(account);
    });
    return next;
  }, [accounts]);
  const getRowAccountDisplayName = React.useCallback((row: Pick<EditableSpreadsheetRow, 'account_id' | 'account_name' | 'banking_organization_name'>, fallback = 'None') => {
    const resolved = row.account_id ? accountDisplayNameById[row.account_id] : '';
    if (resolved) {
      return resolved;
    }
    return formatEditableValue(row.account_name || row.banking_organization_name, fallback);
  }, [accountDisplayNameById]);
  const monthOptions = React.useMemo(
    () => buildSpreadsheetMonthOptions(recurringPayments, selectedMonth),
    [recurringPayments, selectedMonth],
  );

  const visibleMonths = React.useMemo(
    () => [selectedMonth],
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
          vendor_input: row.entity_name || row.contact_name || row.title || '',
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
            vendor_input: row.entity_name || row.contact_name || row.title || '',
            rta: Number(rowRtaByKey[row.rowKey] || 0),
            balance: Number.isFinite(balanceByRowKey[row.rowKey]) ? balanceByRowKey[row.rowKey] : NaN,
            ...draft,
          };
        }),
      }));
    },
    [balanceBaseByScope, draftRowByKey, monthPanels, projectionRows, rowRtaByKey, todayDateValue],
  );
  const normalizedBudgetFilterQuery = React.useMemo(
    () => budgetFilterQuery.trim().toLowerCase(),
    [budgetFilterQuery],
  );
  const filteredMonthPanels = React.useMemo(
    () => monthPanelsWithProjection.map((panel) => ({
      ...panel,
      rows: normalizedBudgetFilterQuery === ''
        ? panel.rows
        : panel.rows.filter((row) => [
          row.direction === 'inflow' ? 'inflow' : 'outflow',
          formatDateLabel(row.due_date),
          row.due_date,
          row.vendor_input,
          row.title,
          getRowAccountDisplayName(row, ''),
          row.banking_organization_name,
          paymentMethodLabels[row.payment_method] || row.payment_method,
          row.frequency,
          formatCurrency(Number(row.amount || 0)),
          Number(row.rta || 0).toFixed(2),
          Number.isFinite(row.balance) ? Number(row.balance || 0).toFixed(2) : '',
          row.notes,
        ].some((value) => String(value || '').toLowerCase().includes(normalizedBudgetFilterQuery))),
    })),
    [getRowAccountDisplayName, monthPanelsWithProjection, normalizedBudgetFilterQuery, paymentMethodLabels],
  );

  const handleMonthShift = React.useCallback((offset: number) => {
    onSelectedMonthChange(shiftMonthValue(selectedMonth, offset));
  }, [onSelectedMonthChange, selectedMonth]);
  const selectedPanel = filteredMonthPanels[0] || null;
  const selectedSummary = selectedPanel?.summary || null;
  const budgetTableColumns = React.useMemo<Array<PriorityTableColumn<EditableSpreadsheetRow>>>(() => ([
    { key: 'type', header: 'Type', minWidth: 110, maxAutoWidth: 140, priority: 2, sortable: true, sortAccessor: (row) => row.direction, contentAccessor: (row) => row.direction === 'inflow' ? 'Inflow' : 'Outflow' },
    { key: 'due', header: 'Due', minWidth: 96, maxAutoWidth: 112, sortable: true, sortAccessor: (row) => row.due_date, contentAccessor: (row) => formatDateLabel(row.due_date) },
    { key: 'vendor', header: 'Vendor', minWidth: 200, maxAutoWidth: 360, priority: 6, sortable: true, sortAccessor: (row) => row.vendor_input || row.title, contentAccessor: (row) => row.vendor_input || row.title || 'Add vendor' },
    { key: 'account', header: 'Account', minWidth: 140, maxAutoWidth: 220, priority: 4, sortable: true, sortAccessor: (row) => getRowAccountDisplayName(row, ''), contentAccessor: (row) => getRowAccountDisplayName(row) },
    { key: 'method', header: 'Method', minWidth: 120, maxAutoWidth: 170, priority: 3, sortable: true, sortAccessor: (row) => paymentMethodLabels[row.payment_method] || row.payment_method, contentAccessor: (row) => paymentMethodLabels[row.payment_method] || 'Unspecified' },
    { key: 'frequency', header: 'Frequency', minWidth: 120, maxAutoWidth: 150, priority: 3, sortable: true, sortAccessor: (row) => row.frequency, contentAccessor: (row) => formatEditableValue(row.frequency, '-') },
    { key: 'amount', header: 'Amount', minWidth: 132, maxAutoWidth: 156, sortable: true, sortAccessor: (row) => Number(row.amount || 0), contentAccessor: (row) => formatCurrency(Number(row.amount || 0)) },
    { key: 'rta', header: 'RTA', minWidth: 100, maxAutoWidth: 120, sortable: true, sortAccessor: (row) => Number(row.rta || 0), contentAccessor: (row) => Number(row.rta || 0).toFixed(2) },
    { key: 'balance', header: 'Balance', minWidth: 136, maxAutoWidth: 170, sortable: true, sortAccessor: (row) => Number.isFinite(row.balance) ? Number(row.balance || 0) : Number.NEGATIVE_INFINITY, contentAccessor: (row) => Number.isFinite(row.balance) ? Number(row.balance || 0).toFixed(2) : '-' },
    { key: 'notes', header: 'Notes', minWidth: 180, maxAutoWidth: 300, priority: 4, sortable: true, sortAccessor: (row) => row.notes || '', contentAccessor: (row) => formatEditableValue(row.notes, 'Add notes') },
    { key: 'actions', header: 'Actions', minWidth: 126, maxAutoWidth: 180, sortable: false, resizable: true },
  ]), [getRowAccountDisplayName, paymentMethodLabels]);
  const budgetTable = usePriorityTableLayout({
    tableRef: budgetTableRef,
    rows: selectedPanel?.rows || [],
    columns: budgetTableColumns,
  });

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
  const activateRow = React.useCallback((rowKey: string) => {
    setActiveRowKey(rowKey);
  }, []);
  const setInlineRowRef = React.useCallback((rowKey: string, node: HTMLTableRowElement | null) => {
    if (node) {
      inlineRowRefs.current[rowKey] = node;
      return;
    }
    delete inlineRowRefs.current[rowKey];
  }, []);
  const saveRow = React.useCallback(async (row: EditableSpreadsheetRow) => {
    const recurring = recurringPayments.find((item) => item.id === row.recurring_id);
    if (!recurring) {
      return;
    }

    let entityId: number | null = row.entity_id ?? null;
    const vendorName = String(row.vendor_input || '').trim();
    if (vendorName !== '') {
      const matched = entities.find((entity) => entity.display_name.trim().toLowerCase() === vendorName.toLowerCase());
      if (matched) {
        entityId = matched.id;
      } else {
        entityId = null;
      }
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
      entity_id: entityId,
      account_id: row.account_id ?? null,
      is_budget_planner: Number(recurring.is_budget_planner || 0),
      notes: row.notes || '',
    });
    setDraftRowByKey((prev) => {
      const next = { ...prev };
      delete next[row.rowKey];
      return next;
    });
    setActiveRowKey((current) => (current === row.rowKey ? null : current));
  }, [entities, onUpdateRecurring, recurringPayments]);

  React.useEffect(() => {
    if (!activeRowKey || typeof document === 'undefined') {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const node = inlineRowRefs.current[activeRowKey];
      if (!node || node.contains(target)) {
        return;
      }
      setActiveRowKey((current) => (current === activeRowKey ? null : current));
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [activeRowKey]);

  return (
    <div className="accumul8-spreadsheet">
      <div className="accumul8-panel-toolbar">
        <div className="accumul8-spreadsheet-toolbar-controls">
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
          {selectedSummary ? (
            <div className="accumul8-month-stats">
              <span>{selectedSummary.recurringCount} recurring</span>
            </div>
          ) : null}
        </div>
        <div className="accumul8-spreadsheet-filter">
          <input
            type="text"
            className="form-control"
            value={budgetFilterQuery}
            onChange={(event) => setBudgetFilterQuery(event.target.value)}
            placeholder="Filter budget list"
            aria-label="Filter budget list"
            disabled={busy}
          />
        </div>
        {selectedSummary ? (
          <div className="accumul8-month-summary">
            <div>
              <span>Inflow</span>
              <strong>{formatCurrency(selectedSummary.inflow)}</strong>
            </div>
            <div>
              <span>Outflow</span>
              <strong>{formatCurrency(selectedSummary.outflow)}</strong>
            </div>
            <div>
              <span>Net</span>
              <strong>{formatCurrency(selectedSummary.net)}</strong>
            </div>
          </div>
        ) : null}
      </div>

      <div className="accumul8-spreadsheet-grid">
        {filteredMonthPanels.map((panel) => {
          return (
            <section
              key={panel.monthValue}
              className="accumul8-month-panel is-center"
              aria-label={`${panel.monthLabel} spreadsheet panel`}
            >
              <div className="accumul8-scroll-area accumul8-scroll-area--spreadsheet">
                <table
                  ref={budgetTableRef}
                  className="table accumul8-table accumul8-sticky-head accumul8-month-table accumul8-spreadsheet-table"
                  style={budgetTable.tableStyle}
                >
                  <colgroup>
                    <col style={budgetTable.getColumnStyle('type')} />
                    <col style={budgetTable.getColumnStyle('due')} />
                    <col style={budgetTable.getColumnStyle('vendor')} />
                    <col style={budgetTable.getColumnStyle('account')} />
                    <col style={budgetTable.getColumnStyle('method')} />
                    <col style={budgetTable.getColumnStyle('frequency')} />
                    <col style={budgetTable.getColumnStyle('amount')} />
                    <col style={budgetTable.getColumnStyle('rta')} />
                    <col style={budgetTable.getColumnStyle('balance')} />
                    <col style={budgetTable.getColumnStyle('notes')} />
                    <col style={budgetTable.getColumnStyle('actions')} />
                  </colgroup>
                  <thead>
                    <tr>
                      <Accumul8TableHeaderCell label="Type" columnKey="type" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
                      <Accumul8TableHeaderCell label="Due" columnKey="due" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
                      <Accumul8TableHeaderCell label="Vendor" columnKey="vendor" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
                      <Accumul8TableHeaderCell label="Account" columnKey="account" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
                      <Accumul8TableHeaderCell label="Method" columnKey="method" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
                      <Accumul8TableHeaderCell label="Frequency" columnKey="frequency" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
                      <Accumul8TableHeaderCell label="Amount" columnKey="amount" className="text-end" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
                      <Accumul8TableHeaderCell label="RTA" columnKey="rta" className="text-end" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
                      <Accumul8TableHeaderCell label="Balance" columnKey="balance" className="text-end" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
                      <Accumul8TableHeaderCell label="Notes" columnKey="notes" sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
                      <Accumul8TableHeaderCell label="Actions" columnKey="actions" className="text-end" sortable={false} sortState={budgetTable.sortState} onSort={budgetTable.requestSort} onResizeStart={budgetTable.startResize} />
                    </tr>
                  </thead>
                  <tbody>
                    {budgetTable.rows.length > 0 ? budgetTable.rows.map((row) => (
                      <tr
                        ref={(node) => setInlineRowRef(row.rowKey, node)}
                        key={row.rowKey}
                        className={[
                          'accumul8-list-item',
                          row.amount < 0 ? 'is-outflow' : 'is-inflow',
                          activeRowKey === row.rowKey ? 'is-editing' : '',
                          draftRowByKey[row.rowKey] ? 'has-draft' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <td>
                          {activeRowKey === row.rowKey ? (
                            <select
                              className="form-select form-select-sm accumul8-month-table-select"
                              value={row.direction}
                              onChange={(event) => setRowDraft(row, { direction: event.target.value })}
                              disabled={busy}
                            >
                              <option value="outflow">Outflow</option>
                              <option value="inflow">Inflow</option>
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateRow(row.rowKey)} disabled={busy}>
                              {row.direction === 'inflow' ? 'Inflow' : 'Outflow'}
                            </button>
                          )}
                        </td>
                        <td title={row.due_date || ''}>
                          {activeRowKey === row.rowKey ? (
                            <input
                              className="form-control form-control-sm accumul8-month-table-input"
                              type="date"
                              value={row.due_date}
                              onChange={(event) => setRowDraft(row, { due_date: event.target.value, dueDayLabel: event.target.value.slice(8, 10) })}
                              disabled={busy}
                            />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateRow(row.rowKey)} disabled={busy}>
                              {formatDateLabel(row.due_date)}
                            </button>
                          )}
                        </td>
                        <td>
                          {activeRowKey === row.rowKey ? (
                            <input
                              className="form-control form-control-sm accumul8-month-table-input"
                              list={`accumul8-vendor-options-${panel.monthValue}`}
                              value={row.vendor_input}
                              onChange={(event) => setRowDraft(row, { vendor_input: event.target.value, title: event.target.value })}
                              disabled={busy}
                            />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateRow(row.rowKey)} disabled={busy}>
                              {formatEditableValue(row.vendor_input, 'Add vendor')}
                            </button>
                          )}
                        </td>
                        <td>
                          {activeRowKey === row.rowKey ? (
                            <select
                              className="form-select form-select-sm accumul8-month-table-select"
                              value={row.account_id ?? ''}
                              onChange={(event) => {
                                const selectedAccountId = event.target.value === '' ? null : Number(event.target.value);
                                const account = accounts.find((item) => item.id === selectedAccountId) || null;
                                setRowDraft(row, {
                                  account_id: selectedAccountId,
                                  banking_organization_id: account?.banking_organization_id ?? null,
                                  account_name: getAccumul8AccountDisplayName(account, ''),
                                  banking_organization_name: account?.banking_organization_name || '',
                                });
                              }}
                              disabled={busy}
                            >
                              <option value="">None</option>
                              {accounts.map((account) => (
                                <option key={account.id} value={account.id}>{getAccumul8AccountDisplayName(account)}</option>
                              ))}
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateRow(row.rowKey)} disabled={busy}>
                              {getRowAccountDisplayName(row)}
                            </button>
                          )}
                        </td>
                        <td>
                          {activeRowKey === row.rowKey ? (
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
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateRow(row.rowKey)} disabled={busy}>
                              {paymentMethodLabels[row.payment_method] || 'Unspecified'}
                            </button>
                          )}
                        </td>
                        <td>
                          {activeRowKey === row.rowKey ? (
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
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateRow(row.rowKey)} disabled={busy}>
                              {formatEditableValue(row.frequency, '-')}
                            </button>
                          )}
                        </td>
                        <td className="text-end">
                          {activeRowKey === row.rowKey ? (
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
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => activateRow(row.rowKey)} disabled={busy}>
                              {formatCurrency(Number(row.amount || 0))}
                            </button>
                          )}
                        </td>
                        <td className="text-end">
                          {activeRowKey === row.rowKey ? (
                            <input
                              className="form-control form-control-sm accumul8-month-table-input"
                              type="number"
                              step="0.01"
                              value={row.rta}
                              onChange={(event) => handleRowRtaChange(row.rowKey, event.target.value)}
                              disabled={busy}
                              aria-label={`${row.title} real time adjustment`}
                            />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => activateRow(row.rowKey)} disabled={busy}>
                              {Number(row.rta || 0).toFixed(2)}
                            </button>
                          )}
                        </td>
                        <td className="text-end">{Number.isFinite(row.balance) ? Number(row.balance || 0).toFixed(2) : '-'}</td>
                        <td>
                          {activeRowKey === row.rowKey ? (
                            <input
                              className="form-control form-control-sm accumul8-month-table-input"
                              value={row.notes || ''}
                              onChange={(event) => setRowDraft(row, { notes: event.target.value })}
                              disabled={busy}
                            />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateRow(row.rowKey)} disabled={busy}>
                              {formatEditableValue(row.notes, 'Add notes')}
                            </button>
                          )}
                        </td>
                        <td className="text-end is-compact-actions">
                          <div className="accumul8-row-actions accumul8-row-actions--always-on">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary accumul8-icon-action"
                              onClick={() => onOpenRecurring(row.recurring_id)}
                              disabled={busy}
                              aria-label={`View ${row.title || 'row'}`}
                              title={`View ${row.title || 'row'}`}
                            >
                              <span aria-hidden="true">{ACCUMUL8_VIEW_BUTTON_EMOJI}</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary accumul8-icon-action"
                              onClick={() => activateRow(row.rowKey)}
                              disabled={busy}
                              aria-label={`Edit ${row.title || 'row'}`}
                              title={`Edit ${row.title || 'row'}`}
                            >
                              <span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger accumul8-icon-action"
                              onClick={() => onDeleteRecurring(row.recurring_id, row.title)}
                              disabled={busy}
                              aria-label={`Delete ${row.title}`}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                            {draftRowByKey[row.rowKey] ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary accumul8-icon-action"
                                onClick={() => void saveRow(row)}
                                disabled={busy}
                                aria-label={`Save ${row.title || 'row'}`}
                                title={`Save ${row.title || 'row'}`}
                              >
                                <span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span>
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={11} className="text-center text-muted py-4">
                          {normalizedBudgetFilterQuery === ''
                            ? 'No budget-planner recurring payments in this month yet.'
                            : 'No budget items match the current filter.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <datalist id={`accumul8-vendor-options-${panel.monthValue}`}>
                  {entities
                    .filter((entity) => Number(entity.is_balance_person || 0) === 0)
                    .map((entity) => (
                    <option key={entity.id} value={entity.display_name} />
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

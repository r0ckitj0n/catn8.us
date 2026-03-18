import { Accumul8Account, Accumul8Entity, Accumul8PaymentMethod, Accumul8RecurringPayment, Accumul8Transaction } from '../../types/accumul8';
import { PriorityTableColumn } from '../../hooks/usePriorityTableLayout';
import { Accumul8SpreadsheetMonthData, buildSpreadsheetMonthData, shiftMonthValue } from '../../utils/accumul8Spreadsheet';
import { getAccumul8AccountDisplayName } from '../../utils/accumul8Accounts';
import { EditableSpreadsheetMonthPanel, EditableSpreadsheetRow } from './accumul8SpreadsheetTypes';

export function formatCurrency(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

export function shiftDateByDays(dateValue: string, dayDelta: number): string {
  const base = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return dateValue;
  base.setUTCDate(base.getUTCDate() + dayDelta);
  return base.toISOString().slice(0, 10);
}

export function getTodayDateValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getPlanningLimitDateValue(): string {
  const limit = new Date();
  limit.setUTCDate(limit.getUTCDate() + 90);
  return limit.toISOString().slice(0, 10);
}

export function formatDateLabel(value: string): string {
  if (!value) return '-';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'numeric', day: 'numeric', year: '2-digit' });
}

export function formatEditableValue(value: string | number | null | undefined, fallback = '-'): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : fallback;
  return String(value || '').trim() || fallback;
}

function compareRowTimeline(left: EditableSpreadsheetRow, right: EditableSpreadsheetRow): number {
  if (left.due_date !== right.due_date) return left.due_date.localeCompare(right.due_date);
  return left.rowKey.localeCompare(right.rowKey);
}

function resolveBalanceScopeKey(row: EditableSpreadsheetRow): string {
  if (Number(row.account_id || 0) > 0) return `account:${Number(row.account_id)}`;
  if (Number(row.banking_organization_id || 0) > 0) return `banking_organization:${Number(row.banking_organization_id)}`;
  return 'unassigned';
}

export function buildAccountDisplayNameById(accounts: Accumul8Account[]) {
  return accounts.reduce<Record<number, string>>((acc, account) => {
    acc[account.id] = getAccumul8AccountDisplayName(account);
    return acc;
  }, {});
}

export function getRowAccountDisplayName(
  row: Pick<EditableSpreadsheetRow, 'account_id' | 'account_name' | 'banking_organization_name'>,
  accountDisplayNameById: Record<number, string>,
  fallback = 'None',
) {
  const resolved = row.account_id ? accountDisplayNameById[row.account_id] : '';
  return resolved || formatEditableValue(row.account_name || row.banking_organization_name, fallback);
}

export function buildBalanceBaseByScope(accounts: Accumul8Account[]) {
  const next: Record<string, number> = { unassigned: NaN };
  const totalsByBankingOrganization: Record<string, number> = {};
  accounts.forEach((account) => {
    next[`account:${account.id}`] = Number(account.current_balance || 0);
    const bankingOrganizationId = Number(account.banking_organization_id || 0);
    if (bankingOrganizationId > 0) {
      const key = `banking_organization:${bankingOrganizationId}`;
      totalsByBankingOrganization[key] = Number((totalsByBankingOrganization[key] || 0) + Number(account.current_balance || 0));
    }
  });
  Object.entries(totalsByBankingOrganization).forEach(([key, value]) => {
    next[key] = Number(value.toFixed(2));
  });
  return next;
}

export function buildProjectionRows(
  draftRowByKey: Record<string, EditableSpreadsheetRow>,
  recurringPayments: Accumul8RecurringPayment[],
  rowRtaByKey: Record<string, number>,
  todayDateValue: string,
  transactions: Accumul8Transaction[],
  visibleMonths: string[],
) {
  const earliestMonth = todayDateValue.slice(0, 7) < visibleMonths[0] ? todayDateValue.slice(0, 7) : visibleMonths[0];
  const latestMonth = todayDateValue.slice(0, 7) > visibleMonths[visibleMonths.length - 1] ? todayDateValue.slice(0, 7) : visibleMonths[visibleMonths.length - 1];
  const allRows: EditableSpreadsheetRow[] = [];
  let cursor = earliestMonth;
  while (cursor <= latestMonth) {
    buildSpreadsheetMonthData(recurringPayments, transactions, cursor).rows.forEach((row) => {
      const draft = draftRowByKey[row.rowKey] || null;
      allRows.push({ ...row, original_due_date: row.due_date, vendor_input: row.entity_name || row.contact_name || row.title || '', balance: 0, ...draft });
    });
    cursor = shiftMonthValue(cursor, 1);
  }
  return allRows.sort(compareRowTimeline).map((row) => ({ ...row, rta_amount: Number(rowRtaByKey[row.rowKey] ?? row.rta_amount ?? 0) }));
}

export function buildMonthPanelsWithProjection(
  balanceBaseByScope: Record<string, number>,
  draftRowByKey: Record<string, EditableSpreadsheetRow>,
  monthPanels: Accumul8SpreadsheetMonthData[],
  projectionRows: EditableSpreadsheetRow[],
  rowRtaByKey: Record<string, number>,
  todayDateValue: string,
): EditableSpreadsheetMonthPanel[] {
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
      scopeRows.forEach((row) => { balanceByRowKey[row.rowKey] = NaN; });
      return;
    }
    const pastRows = scopeRows.filter((row) => row.due_date < todayDateValue).sort(compareRowTimeline);
    let cumulativeLater = 0;
    for (let index = pastRows.length - 1; index >= 0; index -= 1) {
      const row = pastRows[index];
      balanceByRowKey[row.rowKey] = Number((baseBalance - cumulativeLater).toFixed(2));
      cumulativeLater = Number((cumulativeLater + Number(row.amount || 0) + Number(row.rta_amount || 0)).toFixed(2));
    }
    scopeRows.filter((row) => row.due_date === todayDateValue).sort(compareRowTimeline).forEach((row) => {
      balanceByRowKey[row.rowKey] = Number(baseBalance.toFixed(2));
    });
    let cumulativeFuture = 0;
    scopeRows.filter((row) => row.due_date > todayDateValue).sort(compareRowTimeline).forEach((row) => {
      cumulativeFuture = Number((cumulativeFuture + Number(row.amount || 0) + Number(row.rta_amount || 0)).toFixed(2));
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
        rta_amount: Number(rowRtaByKey[row.rowKey] ?? row.rta_amount ?? 0),
        balance: Number.isFinite(balanceByRowKey[row.rowKey]) ? balanceByRowKey[row.rowKey] : NaN,
        ...draft,
      };
    }),
  }));
}

export function filterMonthPanels(
  monthPanelsWithProjection: EditableSpreadsheetMonthPanel[],
  normalizedBudgetFilterQuery: string,
  paymentMethodLabels: Record<Accumul8PaymentMethod, string>,
  accountDisplayNameById: Record<number, string>,
): EditableSpreadsheetMonthPanel[] {
  return monthPanelsWithProjection.map((panel) => ({
    ...panel,
    rows: normalizedBudgetFilterQuery === ''
      ? panel.rows
      : panel.rows.filter((row) => [
        formatDateLabel(row.due_date),
        row.due_date,
        formatDateLabel(row.paid_date),
        row.paid_date,
        row.vendor_input,
        row.title,
        getRowAccountDisplayName(row, accountDisplayNameById, ''),
        row.banking_organization_name,
        paymentMethodLabels[row.payment_method] || row.payment_method,
        row.frequency,
        formatCurrency(Number(row.amount || 0)),
        Number(row.rta_amount || 0).toFixed(2),
        Number.isFinite(row.balance) ? Number(row.balance || 0).toFixed(2) : '',
        row.notes,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedBudgetFilterQuery))),
  }));
}

export function buildBudgetTableColumns(
  accountDisplayNameById: Record<number, string>,
  paymentMethodLabels: Record<Accumul8PaymentMethod, string>,
): Array<PriorityTableColumn<EditableSpreadsheetRow>> {
  return [
    { key: 'due', header: 'Due', minWidth: 96, maxAutoWidth: 112, sortable: true, sortAccessor: (row) => row.due_date, contentAccessor: (row) => formatDateLabel(row.due_date) },
    { key: 'paidDate', header: 'Paid', minWidth: 96, maxAutoWidth: 114, sortable: true, sortAccessor: (row) => row.paid_date || '', contentAccessor: (row) => formatDateLabel(row.paid_date) },
    { key: 'vendor', header: 'Vendor', minWidth: 200, maxAutoWidth: 360, priority: 6, sortable: true, sortAccessor: (row) => row.vendor_input || row.title, contentAccessor: (row) => row.vendor_input || row.title || 'Add vendor' },
    { key: 'account', header: 'Acct', minWidth: 128, maxAutoWidth: 190, priority: 4, sortable: true, sortAccessor: (row) => getRowAccountDisplayName(row, accountDisplayNameById, ''), contentAccessor: (row) => getRowAccountDisplayName(row, accountDisplayNameById) },
    { key: 'method', header: 'Method', minWidth: 90, maxAutoWidth: 126, priority: 3, sortable: true, sortAccessor: (row) => paymentMethodLabels[row.payment_method] || row.payment_method, contentAccessor: (row) => paymentMethodLabels[row.payment_method] || 'Unspecified' },
    { key: 'frequency', header: 'Frequency', minWidth: 92, maxAutoWidth: 114, priority: 3, sortable: true, sortAccessor: (row) => row.frequency, contentAccessor: (row) => formatEditableValue(row.frequency, '-') },
    { key: 'amount', header: 'Amt', minWidth: 102, maxAutoWidth: 128, sortable: true, sortAccessor: (row) => Number(row.amount || 0), contentAccessor: (row) => formatCurrency(Number(row.amount || 0)) },
    { key: 'rta', header: 'RTA', minWidth: 82, maxAutoWidth: 100, sortable: true, sortAccessor: (row) => Number(row.rta_amount || 0), contentAccessor: (row) => Number(row.rta_amount || 0).toFixed(2) },
    { key: 'balance', header: 'Bal', minWidth: 104, maxAutoWidth: 132, sortable: true, sortAccessor: (row) => Number.isFinite(row.balance) ? Number(row.balance || 0) : Number.NEGATIVE_INFINITY, contentAccessor: (row) => Number.isFinite(row.balance) ? Number(row.balance || 0).toFixed(2) : '-' },
    { key: 'notes', header: 'Notes', minWidth: 180, maxAutoWidth: 300, priority: 4, sortable: true, sortAccessor: (row) => row.notes || '', contentAccessor: (row) => formatEditableValue(row.notes) },
    { key: 'actions', header: 'Actions', minWidth: 148, maxAutoWidth: 156, sortable: false, resizable: true, contentAccessor: () => 'Actions' },
  ];
}

export function resolveEntityId(entities: Accumul8Entity[], row: EditableSpreadsheetRow) {
  const vendorName = String(row.vendor_input || '').trim();
  if (vendorName === '') return row.entity_id ?? null;
  const matched = entities.find((entity) => entity.display_name.trim().toLowerCase() === vendorName.toLowerCase());
  return matched ? matched.id : null;
}

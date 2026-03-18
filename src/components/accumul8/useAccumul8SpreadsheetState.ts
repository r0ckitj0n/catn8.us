import React from 'react';

import { Accumul8PaymentMethod } from '../../types/accumul8';
import { usePriorityTableLayout } from '../../hooks/usePriorityTableLayout';
import { buildSpreadsheetMonthData, buildSpreadsheetMonthOptions, shiftMonthValue } from '../../utils/accumul8Spreadsheet';
import { EditableSpreadsheetMonthPanel, EditableSpreadsheetRow, Accumul8SpreadsheetViewProps } from './accumul8SpreadsheetTypes';
import {
  buildAccountDisplayNameById,
  buildBalanceBaseByScope,
  buildBudgetTableColumns,
  buildMonthPanelsWithProjection,
  buildProjectionRows,
  filterMonthPanels,
  getPlanningLimitDateValue,
  getTodayDateValue,
  resolveEntityId,
  shiftDateByDays,
} from './accumul8SpreadsheetViewUtils';

export function useAccumul8SpreadsheetState({
  accounts,
  entities,
  onEnsureBudgetMonth,
  onSelectedMonthChange,
  onUpdateTransaction,
  recurringPayments,
  selectedMonth,
  transactions,
}: Pick<Accumul8SpreadsheetViewProps, 'accounts' | 'entities' | 'onEnsureBudgetMonth' | 'onSelectedMonthChange' | 'onUpdateTransaction' | 'recurringPayments' | 'selectedMonth' | 'transactions'>) {
  const [activeRowKey, setActiveRowKey] = React.useState<string | null>(null);
  const [budgetFilterQuery, setBudgetFilterQuery] = React.useState('');
  const [rowRtaByKey, setRowRtaByKey] = React.useState<Record<string, number>>({});
  const [draftRowByKey, setDraftRowByKey] = React.useState<Record<string, EditableSpreadsheetRow>>({});
  const inlineRowRefs = React.useRef<Record<string, HTMLTableRowElement | null>>({});
  const budgetTableRef = React.useRef<HTMLTableElement | null>(null);
  const paymentMethodLabels: Record<Accumul8PaymentMethod, string> = { unspecified: 'Unspecified', autopay: 'Autopay', manual: 'Manual' };
  const accountDisplayNameById = React.useMemo(() => buildAccountDisplayNameById(accounts), [accounts]);
  const monthOptions = React.useMemo(() => buildSpreadsheetMonthOptions(recurringPayments, selectedMonth), [recurringPayments, selectedMonth]);
  const visibleMonths = React.useMemo(() => [selectedMonth], [selectedMonth]);
  const monthPanels = React.useMemo(() => visibleMonths.map((monthValue) => buildSpreadsheetMonthData(recurringPayments, transactions, monthValue)), [recurringPayments, transactions, visibleMonths]);
  const todayDateValue = React.useMemo(() => getTodayDateValue(), []);
  const planningLimitDateValue = React.useMemo(() => getPlanningLimitDateValue(), []);
  const planningLimitMonthValue = React.useMemo(() => planningLimitDateValue.slice(0, 7), [planningLimitDateValue]);
  const isAtPlanningLimit = selectedMonth >= planningLimitMonthValue;
  const balanceBaseByScope = React.useMemo(() => buildBalanceBaseByScope(accounts), [accounts]);
  const projectionRows = React.useMemo(() => buildProjectionRows(draftRowByKey, recurringPayments, rowRtaByKey, todayDateValue, transactions, visibleMonths), [draftRowByKey, recurringPayments, rowRtaByKey, todayDateValue, transactions, visibleMonths]);
  const monthPanelsWithProjection = React.useMemo(() => buildMonthPanelsWithProjection(balanceBaseByScope, draftRowByKey, monthPanels, projectionRows, rowRtaByKey, todayDateValue), [balanceBaseByScope, draftRowByKey, monthPanels, projectionRows, rowRtaByKey, todayDateValue]);
  const normalizedBudgetFilterQuery = React.useMemo(() => budgetFilterQuery.trim().toLowerCase(), [budgetFilterQuery]);
  const filteredMonthPanels = React.useMemo<EditableSpreadsheetMonthPanel[]>(() => filterMonthPanels(monthPanelsWithProjection, normalizedBudgetFilterQuery, paymentMethodLabels, accountDisplayNameById), [accountDisplayNameById, monthPanelsWithProjection, normalizedBudgetFilterQuery]);
  const selectedPanel: EditableSpreadsheetMonthPanel | null = filteredMonthPanels[0] || null;
  const selectedSummary = selectedPanel?.summary || null;
  const budgetTable = usePriorityTableLayout<EditableSpreadsheetRow>({ tableRef: budgetTableRef, rows: selectedPanel?.rows || [], columns: React.useMemo(() => buildBudgetTableColumns(accountDisplayNameById, paymentMethodLabels), [accountDisplayNameById]) });

  const handleMonthShift = React.useCallback((offset: number) => {
    const nextMonth = shiftMonthValue(selectedMonth, offset);
    onSelectedMonthChange(offset > 0 && nextMonth > planningLimitMonthValue ? planningLimitMonthValue : nextMonth);
  }, [onSelectedMonthChange, planningLimitMonthValue, selectedMonth]);
  const handleRowRtaChange = React.useCallback((row: EditableSpreadsheetRow, rawValue: string) => {
    const parsed = rawValue === '' ? 0 : Number(rawValue);
    const normalized = Number.isFinite(parsed) ? parsed : 0;
    setRowRtaByKey((prev) => ({ ...prev, [row.rowKey]: normalized }));
    setDraftRowByKey((prev) => ({ ...prev, [row.rowKey]: { ...row, ...prev[row.rowKey], rta_amount: normalized } }));
  }, []);
  const setRowDraft = React.useCallback((row: EditableSpreadsheetRow, patch: Partial<EditableSpreadsheetRow>) => {
    const normalizedPatch: Partial<EditableSpreadsheetRow> = { ...patch };
    if (Object.prototype.hasOwnProperty.call(patch, 'paid_date')) {
      normalizedPatch.paid_date = String(patch.paid_date || '').trim();
      normalizedPatch.is_paid = normalizedPatch.paid_date !== '' ? 1 : 0;
    }
    setDraftRowByKey((prev) => ({ ...prev, [row.rowKey]: { ...row, ...prev[row.rowKey], ...normalizedPatch } }));
  }, []);
  const setInlineRowRef = React.useCallback((rowKey: string, node: HTMLTableRowElement | null) => {
    if (node) inlineRowRefs.current[rowKey] = node;
    else delete inlineRowRefs.current[rowKey];
  }, []);
  const saveRow = React.useCallback(async (row: EditableSpreadsheetRow) => {
    const transaction = transactions.find((item) => item.id === row.transaction_id);
    if (!transaction) return;
    const previous = new Date(`${row.original_due_date}T00:00:00Z`).getTime();
    const next = new Date(`${String(row.due_date || '')}T00:00:00Z`).getTime();
    const dayDelta = Number.isFinite(previous) && Number.isFinite(next) ? Math.round((next - previous) / 86400000) : 0;
    const nextDueDate = dayDelta === 0 ? row.due_date : shiftDateByDays(row.original_due_date, dayDelta);
    await onUpdateTransaction(row.transaction_id, {
      transaction_date: nextDueDate, due_date: nextDueDate, paid_date: row.paid_date || '', entry_type: transaction.entry_type,
      description: String(row.vendor_input || '').trim() || row.title || transaction.description, memo: row.notes || '', amount: Number(row.amount || 0),
      rta_amount: Number(row.rta_amount || 0), is_paid: String(row.paid_date || '').trim() ? 1 : 0, is_reconciled: Number(transaction.is_reconciled || 0),
      is_budget_planner: Number(transaction.is_budget_planner || 0), entity_id: resolveEntityId(entities, row), balance_entity_id: transaction.balance_entity_id ?? null,
      contact_id: transaction.contact_id ?? null, account_id: row.account_id ?? null, debtor_id: transaction.debtor_id ?? null, skip_recurring_template_sync: 1,
    });
    setDraftRowByKey((prev) => {
      const nextDrafts = { ...prev };
      delete nextDrafts[row.rowKey];
      return nextDrafts;
    });
    setActiveRowKey((current) => (current === row.rowKey ? null : current));
  }, [entities, onUpdateTransaction, transactions]);

  const lastEnsuredKeyRef = React.useRef('');
  React.useEffect(() => {
    if (selectedMonth > planningLimitMonthValue) onSelectedMonthChange(planningLimitMonthValue);
  }, [onSelectedMonthChange, planningLimitMonthValue, selectedMonth]);
  React.useEffect(() => {
    const ensureKey = `${selectedMonth}:${recurringPayments.length}:${transactions.length}`;
    if (lastEnsuredKeyRef.current === ensureKey) return;
    lastEnsuredKeyRef.current = ensureKey;
    void onEnsureBudgetMonth(selectedMonth);
  }, [onEnsureBudgetMonth, recurringPayments.length, selectedMonth, transactions.length]);
  React.useEffect(() => {
    if (!activeRowKey || typeof document === 'undefined') return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const node = inlineRowRefs.current[activeRowKey];
      if (!node || node.contains(target)) return;
      setActiveRowKey((current) => (current === activeRowKey ? null : current));
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [activeRowKey]);

  return {
    accountDisplayNameById,
    activeRowKey,
    budgetFilterQuery,
    budgetTable,
    budgetTableRef,
    draftRowByKey,
    filteredMonthPanels,
    handleMonthShift,
    handleRowRtaChange,
    isAtPlanningLimit,
    monthOptions,
    normalizedBudgetFilterQuery,
    paymentMethodLabels,
    selectedSummary,
    setActiveRowKey,
    setBudgetFilterQuery,
    setInlineRowRef,
    setRowDraft,
    saveRow,
  };
}

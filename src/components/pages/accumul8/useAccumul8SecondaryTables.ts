import React from 'react';

import { PriorityTableColumn, usePriorityTableLayout } from '../../../hooks/usePriorityTableLayout';
import { Accumul8RecurringPayment, Accumul8Transaction } from '../../../types/accumul8';
import { Accumul8DebtorGroupRow } from './accumul8PageEntityUtils';
import { RECURRING_PAYMENT_METHOD_LABELS, formatInlineDate, formatPayBillStatusLabel } from './accumul8PageDateSearchUtils';

interface UseAccumul8SecondaryTablesOptions {
  debtorsTableRef: React.RefObject<HTMLTableElement | null>;
  debtorRows: Accumul8DebtorGroupRow[];
  getAccountDisplayName: (accountId: number | null | undefined, accountName?: string | null, bankingOrganizationName?: string | null, emptyLabel?: string) => string;
  payBillsRows: Accumul8Transaction[];
  payBillsTableRef: React.RefObject<HTMLTableElement | null>;
  recurringRows: Accumul8RecurringPayment[];
  recurringTableRef: React.RefObject<HTMLTableElement | null>;
  todayDate: string;
}

export function useAccumul8SecondaryTables({
  debtorsTableRef,
  debtorRows,
  getAccountDisplayName,
  payBillsRows,
  payBillsTableRef,
  recurringRows,
  recurringTableRef,
  todayDate,
}: UseAccumul8SecondaryTablesOptions) {
  const debtorsTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8DebtorGroupRow>>>(() => ([
    { key: 'person', header: 'Person', minWidth: 220, maxAutoWidth: 320, priority: 4, sortable: true, sortAccessor: (debtor) => debtor.debtor_name || '', contentAccessor: (debtor) => debtor.debtor_name || '-' },
    { key: 'charges', header: 'Charges', minWidth: 120, maxAutoWidth: 142, sortable: true, defaultSortDirection: 'desc', sortAccessor: (debtor) => Number(debtor.total_loaned || 0), contentAccessor: (debtor) => Number(debtor.total_loaned || 0).toFixed(2) },
    { key: 'credits', header: 'Credits', minWidth: 120, maxAutoWidth: 142, sortable: true, defaultSortDirection: 'desc', sortAccessor: (debtor) => Number(debtor.total_repaid || 0), contentAccessor: (debtor) => Number(debtor.total_repaid || 0).toFixed(2) },
    { key: 'net', header: 'Net IOU', minWidth: 132, maxAutoWidth: 152, sortable: true, defaultSortDirection: 'desc', sortAccessor: (debtor) => Number(debtor.outstanding_balance || 0), contentAccessor: (debtor) => Number(debtor.outstanding_balance || 0).toFixed(2) },
    { key: 'activity', header: 'Last Activity', minWidth: 136, maxAutoWidth: 170, priority: 1, sortable: true, defaultSortDirection: 'desc', sortAccessor: (debtor) => debtor.last_activity_date || '', contentAccessor: (debtor) => debtor.last_activity_date || '-' },
    { key: 'actions', header: 'Actions', minWidth: 148, maxAutoWidth: 156, sortable: false, contentAccessor: () => 'Actions' },
  ]), []);
  const payBillsTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8Transaction>>>(() => ([
    { key: 'due', header: 'Due', minWidth: 96, maxAutoWidth: 114, sortable: true, sortAccessor: (tx) => tx.due_date || tx.transaction_date || '', contentAccessor: (tx) => formatInlineDate(tx.due_date || tx.transaction_date) },
    { key: 'paidDate', header: 'Paid', minWidth: 96, maxAutoWidth: 114, sortable: true, sortAccessor: (tx) => tx.paid_date || '', contentAccessor: (tx) => formatInlineDate(tx.paid_date) },
    { key: 'description', header: 'Description', minWidth: 250, maxAutoWidth: 520, priority: 6, sortable: true, sortAccessor: (tx) => tx.description || '', contentAccessor: (tx) => tx.description || '-' },
    { key: 'account', header: 'Acct', minWidth: 132, maxAutoWidth: 220, priority: 2, sortable: true, sortAccessor: (tx) => getAccountDisplayName(tx.account_id, tx.account_name, '', ''), contentAccessor: (tx) => getAccountDisplayName(tx.account_id, tx.account_name, '', 'No account') },
    { key: 'amount', header: 'Amt', minWidth: 100, maxAutoWidth: 126, sortable: true, defaultSortDirection: 'asc', sortAccessor: (tx) => Number(tx.amount || 0), contentAccessor: (tx) => Number(tx.amount || 0).toFixed(2) },
    { key: 'status', header: 'Status', minWidth: 92, maxAutoWidth: 112, sortable: true, sortAccessor: (tx) => formatPayBillStatusLabel(tx, todayDate), contentAccessor: (tx) => formatPayBillStatusLabel(tx, todayDate) },
    { key: 'actions', header: 'Actions', minWidth: 148, maxAutoWidth: 156, sortable: false, contentAccessor: () => 'Actions' },
  ]), [getAccountDisplayName, todayDate]);
  const recurringTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8RecurringPayment>>>(() => ([
    { key: 'title', header: 'Title', minWidth: 230, maxAutoWidth: 520, priority: 6, sortable: true, sortAccessor: (item) => item.title || '', contentAccessor: (item) => [item.title || 'Untitled recurring item', item.notes || ''] },
    { key: 'nextDue', header: 'Next Due', minWidth: 126, maxAutoWidth: 144, sortable: true, sortAccessor: (item) => item.next_due_date || '', contentAccessor: (item) => formatInlineDate(item.next_due_date) },
    { key: 'amount', header: 'Amt', minWidth: 100, maxAutoWidth: 126, sortable: true, defaultSortDirection: 'desc', sortAccessor: (item) => Number(item.amount || 0), contentAccessor: (item) => Number(item.amount || 0).toFixed(2) },
    { key: 'frequency', header: 'Frequency', minWidth: 96, maxAutoWidth: 118, sortable: true, sortAccessor: (item) => item.frequency || '', contentAccessor: (item) => item.frequency || '-' },
    { key: 'account', header: 'Acct', minWidth: 132, maxAutoWidth: 220, priority: 2, sortable: true, sortAccessor: (item) => getAccountDisplayName(item.account_id, item.account_name, '', ''), contentAccessor: (item) => getAccountDisplayName(item.account_id, item.account_name, '', 'No account') },
    { key: 'paymentMethod', header: 'Method', minWidth: 98, maxAutoWidth: 136, priority: 1, sortable: true, sortAccessor: (item) => RECURRING_PAYMENT_METHOD_LABELS[item.payment_method || 'unspecified'], contentAccessor: (item) => RECURRING_PAYMENT_METHOD_LABELS[item.payment_method || 'unspecified'] },
    { key: 'planner', header: 'Planner', minWidth: 108, maxAutoWidth: 120, sortable: true, sortAccessor: (item) => Number(item.is_budget_planner || 0), contentAccessor: (item) => Number(item.is_budget_planner || 0) === 1 ? 'Shown' : 'Hidden' },
    { key: 'status', header: 'Status', minWidth: 92, maxAutoWidth: 108, sortable: true, sortAccessor: (item) => Number(item.is_active || 0), contentAccessor: (item) => Number(item.is_active || 0) === 1 ? 'Active' : 'Paused' },
    { key: 'actions', header: 'Actions', minWidth: 148, maxAutoWidth: 156, sortable: false, contentAccessor: () => 'Actions' },
  ]), [getAccountDisplayName]);
  const debtorsTable = usePriorityTableLayout({ tableRef: debtorsTableRef, rows: debtorRows, columns: debtorsTableColumns });
  const payBillsTable = usePriorityTableLayout({ tableRef: payBillsTableRef, rows: payBillsRows, columns: payBillsTableColumns });
  const recurringTable = usePriorityTableLayout({ tableRef: recurringTableRef, rows: recurringRows, columns: recurringTableColumns });
  return { debtorsTable, payBillsTable, recurringTable };
}

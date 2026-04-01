import React from 'react';

import { PriorityTableColumn, usePriorityTableLayout } from '../../../hooks/usePriorityTableLayout';
import { Accumul8Transaction, Accumul8TransactionsPagination } from '../../../types/accumul8';
import { addUtcDays, formatInlineDate, getLedgerEffectiveDate } from './accumul8PageDateSearchUtils';
import { getLedgerDescriptionLabel } from './accumul8PageEntityUtils';

interface UseAccumul8LedgerTableOptions {
  customLedgerEndDate: string;
  customLedgerStartDate: string;
  getAccountDisplayName: (accountId: number | null | undefined, accountName?: string | null, bankingOrganizationName?: string | null, emptyLabel?: string) => string;
  ledgerArchivePage: number;
  ledgerDateFilter: string;
  ledgerDisplayBalanceById: Map<number, number>;
  ledgerFilterPreset: string;
  ledgerPaginationMode: '100' | 'all';
  ledgerRows: Accumul8Transaction[];
  ledgerSearchQuery: string;
  ledgerTableRef: React.RefObject<HTMLTableElement | null>;
  setLedgerArchivePage: React.Dispatch<React.SetStateAction<number>>;
  selectedBankAccountId: string;
  selectedBankingOrganizationId: string;
  todayDate: string;
  transactionsPagination: Accumul8TransactionsPagination;
}

export function useAccumul8LedgerTable({
  customLedgerEndDate,
  customLedgerStartDate,
  getAccountDisplayName,
  ledgerArchivePage,
  ledgerDateFilter,
  ledgerDisplayBalanceById,
  ledgerFilterPreset,
  ledgerPaginationMode,
  ledgerRows,
  ledgerSearchQuery,
  ledgerTableRef,
  selectedBankAccountId,
  selectedBankingOrganizationId,
  setLedgerArchivePage,
  todayDate,
  transactionsPagination,
}: UseAccumul8LedgerTableOptions) {
  const ledgerTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8Transaction>>>(() => ([
    { key: 'date', header: 'Date', minWidth: 82, maxAutoWidth: 110, sortable: true, sortAccessor: (tx) => tx.transaction_date || '', contentAccessor: (tx) => formatInlineDate(tx.transaction_date) },
    { key: 'due', header: 'Due', minWidth: 82, maxAutoWidth: 110, sortable: true, sortAccessor: (tx) => tx.due_date || '', contentAccessor: (tx) => formatInlineDate(tx.due_date) },
    { key: 'account', header: 'Acct', minWidth: 100, maxAutoWidth: 180, priority: 2, sortable: true, sortAccessor: (tx) => getAccountDisplayName(tx.account_id, tx.account_name, tx.banking_organization_name, ''), contentAccessor: (tx) => getAccountDisplayName(tx.account_id, tx.account_name, tx.banking_organization_name) },
    { key: 'description', header: 'Description', minWidth: 160, maxAutoWidth: 420, priority: 6, sortable: true, sortAccessor: (tx) => getLedgerDescriptionLabel(tx), contentAccessor: (tx) => getLedgerDescriptionLabel(tx) },
    { key: 'memo', header: 'Memo', minWidth: 110, maxAutoWidth: 280, priority: 3, sortable: true, sortAccessor: (tx) => tx.memo || '', contentAccessor: (tx) => tx.memo || '-' },
    { key: 'amount', header: 'Amt', minWidth: 82, maxAutoWidth: 112, sortable: true, defaultSortDirection: 'desc', sortAccessor: (tx) => Number(tx.amount || 0), contentAccessor: (tx) => Number(tx.amount || 0).toFixed(2) },
    { key: 'balance', header: 'Bal', minWidth: 88, maxAutoWidth: 116, sortable: true, defaultSortDirection: 'desc', sortAccessor: (tx) => Number(ledgerDisplayBalanceById.get(tx.id) ?? tx.running_balance ?? 0), contentAccessor: (tx) => Number(ledgerDisplayBalanceById.get(tx.id) ?? tx.running_balance ?? 0).toFixed(2) },
    { key: 'paid', header: 'Paid', minWidth: 64, maxAutoWidth: 88, sortable: true, sortAccessor: (tx) => Number(tx.is_paid || 0), contentAccessor: (tx) => Number(tx.is_paid || 0) === 1 ? 'Paid' : 'Unpaid' },
    { key: 'reconciled', header: "Rec'd", minWidth: 64, maxAutoWidth: 92, sortable: true, sortAccessor: (tx) => Number(tx.is_reconciled || 0), contentAccessor: (tx) => Number(tx.is_reconciled || 0) === 1 ? 'Reconciled' : 'Open' },
    { key: 'actions', header: 'Actions', minWidth: 168, maxAutoWidth: 188, sortable: false, contentAccessor: () => 'Actions' },
  ]), [getAccountDisplayName, ledgerDisplayBalanceById]);

  const ledgerTable = usePriorityTableLayout({ tableRef: ledgerTableRef, rows: ledgerRows, columns: ledgerTableColumns });
  const ledgerPaginationCutoffDate = React.useMemo(() => addUtcDays(todayDate, -60), [todayDate]);
  const ledgerPagination = React.useMemo(() => {
    const allRows = ledgerTable.rows;
    const isServerPaginated = Number(transactionsPagination.is_full_dataset ? 1 : 0) !== 1;
    if (isServerPaginated) {
      return {
        rows: allRows,
        recentCount: allRows.length,
        archivedCount: Math.max(Number(transactionsPagination.total_rows || 0) - allRows.length, 0),
        totalRows: Number(transactionsPagination.total_rows || allRows.length),
        currentPage: Number(transactionsPagination.current_page || 1),
        totalPages: Number(transactionsPagination.total_pages || 1),
        hasArchivedPages: Number(transactionsPagination.total_pages || 1) > 1,
        isServerPaginated: true,
      };
    }
    if (ledgerPaginationMode === 'all') {
      return {
        rows: allRows,
        recentCount: allRows.filter((tx) => {
          const effectiveDate = getLedgerEffectiveDate(tx);
          return Boolean(effectiveDate) && effectiveDate >= ledgerPaginationCutoffDate;
        }).length,
        archivedCount: allRows.filter((tx) => {
          const effectiveDate = getLedgerEffectiveDate(tx);
          return Boolean(effectiveDate) && effectiveDate < ledgerPaginationCutoffDate;
        }).length,
        totalRows: allRows.length,
        currentPage: 1,
        totalPages: 1,
        hasArchivedPages: false,
        isServerPaginated: false,
      };
    }
    const recentRows: Accumul8Transaction[] = [];
    const archivedRows: Accumul8Transaction[] = [];
    allRows.forEach((tx) => {
      const effectiveDate = getLedgerEffectiveDate(tx);
      if (effectiveDate && effectiveDate < ledgerPaginationCutoffDate) {
        archivedRows.push(tx);
      } else {
        recentRows.push(tx);
      }
    });
    const totalPages = Math.max(1, Math.ceil(archivedRows.length / 100));
    const currentPage = Math.min(Math.max(ledgerArchivePage, 1), totalPages);
    const archivedStart = (currentPage - 1) * 100;
    const archivedSlice = archivedRows.slice(archivedStart, archivedStart + 100);
    return { rows: currentPage === 1 ? [...recentRows, ...archivedSlice] : archivedSlice, recentCount: recentRows.length, archivedCount: archivedRows.length, totalRows: allRows.length, currentPage, totalPages, hasArchivedPages: archivedRows.length > 100, isServerPaginated: false };
  }, [ledgerArchivePage, ledgerPaginationCutoffDate, ledgerPaginationMode, ledgerTable.rows, transactionsPagination]);

  React.useEffect(() => {
    if (Number(transactionsPagination.is_full_dataset ? 1 : 0) !== 1) {
      return;
    }
    setLedgerArchivePage(1);
  }, [customLedgerEndDate, customLedgerStartDate, ledgerDateFilter, ledgerFilterPreset, ledgerPaginationMode, ledgerSearchQuery, ledgerTable.sortState?.direction, ledgerTable.sortState?.key, selectedBankAccountId, selectedBankingOrganizationId, setLedgerArchivePage, transactionsPagination.is_full_dataset]);

  React.useEffect(() => {
    if (ledgerPaginationMode === 'all') {
      if (ledgerArchivePage !== 1) {
        setLedgerArchivePage(1);
      }
      return;
    }
    if (Number(transactionsPagination.is_full_dataset ? 1 : 0) !== 1) {
      return;
    }
    if (ledgerArchivePage > ledgerPagination.totalPages) {
      setLedgerArchivePage(ledgerPagination.totalPages);
    }
  }, [ledgerArchivePage, ledgerPagination.totalPages, ledgerPaginationMode, setLedgerArchivePage, transactionsPagination.is_full_dataset]);

  return { ledgerPagination, ledgerTable };
}

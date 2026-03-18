import React from 'react';

import { PriorityTableColumn, usePriorityTableLayout } from '../../../hooks/usePriorityTableLayout';
import { Accumul8Entity, Accumul8Transaction } from '../../../types/accumul8';
import { Accumul8DebtorGroupRow, EntityTransactionSummary, formatEntityContactSummary, formatEntityRoles, formatEntityTransactionSummaryLabel } from './accumul8PageEntityUtils';
import { formatInlineDate } from './accumul8PageDateSearchUtils';

interface UseAccumul8EntityTablesOptions {
  balanceLedgerTableRef: React.RefObject<HTMLTableElement | null>;
  debtorRunningBalanceByTxId: Map<number, number>;
  entitiesTableRef: React.RefObject<HTMLTableElement | null>;
  entityRows: Accumul8Entity[];
  entityTransactionSummaryById: Record<number, EntityTransactionSummary>;
  selectedDebtorEntries: Accumul8Transaction[];
}

export function useAccumul8EntityTables({
  balanceLedgerTableRef,
  debtorRunningBalanceByTxId,
  entitiesTableRef,
  entityRows,
  entityTransactionSummaryById,
  selectedDebtorEntries,
}: UseAccumul8EntityTablesOptions) {
  const entitiesTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8Entity>>>(() => ([
    { key: 'name', header: 'Name', minWidth: 240, maxAutoWidth: 520, priority: 5, sortable: true, sortAccessor: (entity) => entity.display_name || '', contentAccessor: (entity) => [entity.display_name || 'Unnamed entity', entity.notes || '', entity.aliases.map((alias) => alias.alias_name).join(' | ')] },
    { key: 'roles', header: 'Roles', minWidth: 126, maxAutoWidth: 180, priority: 1, sortable: true, sortAccessor: (entity) => formatEntityRoles(entity), contentAccessor: (entity) => formatEntityRoles(entity) },
    { key: 'contactInfo', header: 'Contact Info', minWidth: 220, maxAutoWidth: 420, priority: 4, sortable: true, sortAccessor: (entity) => formatEntityContactSummary(entity).join(' | '), contentAccessor: (entity) => formatEntityContactSummary(entity) },
    { key: 'lastTransaction', header: 'Last Transaction', minWidth: 172, maxAutoWidth: 220, sortable: true, defaultSortDirection: 'desc', sortAccessor: (entity) => (entityTransactionSummaryById[entity.id]?.lastDate || ''), contentAccessor: (entity) => formatEntityTransactionSummaryLabel(entityTransactionSummaryById[entity.id] || { count: 0, lastAmount: null, lastDate: '' }) },
    { key: 'status', header: 'Status', minWidth: 92, maxAutoWidth: 108, sortable: true, sortAccessor: (entity) => Number(entity.is_active || 0), contentAccessor: (entity) => Number(entity.is_active || 0) === 1 ? 'Active' : 'Paused' },
    { key: 'actions', header: 'Actions', minWidth: 148, maxAutoWidth: 156, sortable: false, contentAccessor: () => 'Actions' },
  ]), [entityTransactionSummaryById]);
  const balanceLedgerTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8Transaction>>>(() => ([
    { key: 'date', header: 'Date', minWidth: 110, maxAutoWidth: 126, sortable: true, defaultSortDirection: 'desc', sortAccessor: (tx) => tx.transaction_date || '', contentAccessor: (tx) => formatInlineDate(tx.transaction_date) },
    { key: 'person', header: 'Person', minWidth: 156, maxAutoWidth: 230, priority: 2, sortable: true, sortAccessor: (tx) => tx.debtor_name || '', contentAccessor: (tx) => tx.debtor_name || '-' },
    { key: 'description', header: 'Description', minWidth: 220, maxAutoWidth: 520, priority: 5, sortable: true, sortAccessor: (tx) => tx.description || '', contentAccessor: (tx) => tx.description || '-' },
    { key: 'memo', header: 'Memo', minWidth: 148, maxAutoWidth: 340, priority: 3, sortable: true, sortAccessor: (tx) => tx.memo || '', contentAccessor: (tx) => tx.memo || '-' },
    { key: 'amount', header: 'Amt', minWidth: 100, maxAutoWidth: 126, sortable: true, defaultSortDirection: 'desc', sortAccessor: (tx) => Number(tx.amount || 0), contentAccessor: (tx) => Number(tx.amount || 0).toFixed(2) },
    { key: 'running', header: 'Running IOU', minWidth: 166, maxAutoWidth: 196, sortable: true, defaultSortDirection: 'desc', sortAccessor: (tx) => Number(debtorRunningBalanceByTxId.get(tx.id) || 0), contentAccessor: (tx) => Number(debtorRunningBalanceByTxId.get(tx.id) || 0).toFixed(2) },
    { key: 'actions', header: 'Actions', minWidth: 148, maxAutoWidth: 156, sortable: false, contentAccessor: () => 'Actions' },
  ]), [debtorRunningBalanceByTxId]);
  const entitiesTable = usePriorityTableLayout({ tableRef: entitiesTableRef, rows: entityRows, columns: entitiesTableColumns });
  const balanceLedgerTable = usePriorityTableLayout({ tableRef: balanceLedgerTableRef, rows: selectedDebtorEntries, columns: balanceLedgerTableColumns });
  return { balanceLedgerTable, entitiesTable };
}

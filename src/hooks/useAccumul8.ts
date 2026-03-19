import React from 'react';
import {
  Accumul8LogListResponse,
} from '../types/accumul8';
import { ApiClient } from '../core/ApiClient';
import { useAccumul8CrudActions } from './accumul8/useAccumul8CrudActions';
import { useAccumul8Loader } from './accumul8/useAccumul8Loader';
import { useAccumul8State } from './accumul8/useAccumul8State';
import { useAccumul8StatementActions } from './accumul8/useAccumul8StatementActions';
export function useAccumul8(
  onToast?: (payload: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void,
  selectedOwnerUserId?: number | null,
) {
  const state = useAccumul8State();
  const handleError = React.useCallback((error: any, fallback = 'Accumul8 request failed') => {
    const message = String(error?.message || fallback);
    if (onToast) {
      onToast({ tone: 'error', message });
    }
  }, [onToast]);
  const isTellerRateLimitError = React.useCallback((error: unknown) => {
    const message = String((error as any)?.message || '').toLowerCase();
    return message.includes('too_many_requests')
      || message.includes('request rate limit exceeded')
      || message.includes('http 429')
      || message.includes('status of 429');
  }, []);
  const scopedActionUrl = React.useCallback((action: string) => {
    const params = new URLSearchParams({ action });
    const ownerUserId = Number(selectedOwnerUserId || 0);
    if (ownerUserId > 0) {
      params.set('owner_user_id', String(ownerUserId));
    }
    return `/api/accumul8.php?${params.toString()}`;
  }, [selectedOwnerUserId]);
  const { loadAllTransactions, loadStatementWorkspace, loadTransactionsPage, load } = useAccumul8Loader({ state, handleError, scopedActionUrl });
  const crudActions = useAccumul8CrudActions({ setBusy: state.setBusy, load, handleError, onToast, scopedActionUrl });
  const statementActions = useAccumul8StatementActions({
    setBusy: state.setBusy,
    load,
    loadStatementWorkspace,
    handleError,
    onToast,
    scopedActionUrl,
    isTellerRateLimitError,
  });
  const ownerScopeKey = Number(selectedOwnerUserId || 0);
  React.useEffect(() => {
    void load();
    // Intentionally keyed to owner scope so Accumul8 bootstrap runs once per owner change,
    // instead of re-running on every render from callback identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerScopeKey]);
  const loadLogs = React.useCallback(async (logType: string) => {
    return ApiClient.get<Accumul8LogListResponse>(`${scopedActionUrl('list_logs')}&log_type=${encodeURIComponent(logType)}`);
  }, [scopedActionUrl]);
  return {
    busy: state.busy,
    loading: state.loading,
    loaded: state.loaded,
    statementsLoaded: state.statementsLoaded,
    summary: state.summary,
    activeOwnerUserId: state.activeOwnerUserId,
    accessibleAccountOwners: state.accessibleAccountOwners,
    entities: state.entities,
    entityAliases: state.entityAliases,
    entityEndexGuides: state.entityEndexGuides,
    entityEndexScanLogs: state.entityEndexScanLogs,
    contacts: state.contacts,
    recurringPayments: state.recurringPayments,
    transactions: state.transactions,
    transactionsPagination: state.transactionsPagination,
    bankingOrganizations: state.bankingOrganizations,
    accounts: state.accounts,
    notificationRules: state.notificationRules,
    payBills: state.payBills,
    debtors: state.debtors,
    debtorLedger: state.debtorLedger,
    budgetRows: state.budgetRows,
    bankConnections: state.bankConnections,
    statementUploads: state.statementUploads,
    archivedStatementUploads: state.archivedStatementUploads,
    statementAuditRuns: state.statementAuditRuns,
    syncProvider: state.syncProvider,
    load,
    loadAllTransactions,
    loadLogs,
    loadStatementWorkspace,
    loadTransactionsPage,
    ...crudActions,
    ...statementActions,
  };
}

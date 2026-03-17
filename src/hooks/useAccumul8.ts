import React from 'react';
import {
  Accumul8StatementWorkspaceResponse,
} from '../types/accumul8';
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
  const { loadStatementWorkspace, load } = useAccumul8Loader({ state, handleError, scopedActionUrl });
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
  React.useEffect(() => {
    void load();
  }, [load]);
  return {
    busy: state.busy,
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
    loadStatementWorkspace,
    ...crudActions,
    ...statementActions,
  };
}

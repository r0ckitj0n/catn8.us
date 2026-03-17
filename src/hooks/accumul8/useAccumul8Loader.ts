import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import { Accumul8BootstrapResponse, Accumul8StatementWorkspaceResponse } from '../../types/accumul8';

type State = ReturnType<typeof import('./useAccumul8State').useAccumul8State>;

export function useAccumul8Loader(args: {
  state: State;
  handleError: (error: any, fallback?: string) => void;
  scopedActionUrl: (action: string) => string;
}) {
  const { state, handleError, scopedActionUrl } = args;

  const applyStatementWorkspace = React.useCallback((res?: Partial<Accumul8StatementWorkspaceResponse> | null) => {
    state.setStatementUploads(Array.isArray(res?.statement_uploads) ? res.statement_uploads : []);
    state.setArchivedStatementUploads(Array.isArray(res?.archived_statement_uploads) ? res.archived_statement_uploads : []);
    state.setStatementAuditRuns(Array.isArray(res?.statement_audit_runs) ? res.statement_audit_runs : []);
    state.setStatementsLoaded(true);
  }, [state]);

  const loadStatementWorkspace = React.useCallback(async () => {
    state.setBusy(true);
    try {
      const res = await ApiClient.get<Accumul8StatementWorkspaceResponse>(scopedActionUrl('list_statement_workspace'));
      applyStatementWorkspace(res);
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to load statement workspace');
      throw error;
    } finally {
      state.setBusy(false);
    }
  }, [applyStatementWorkspace, handleError, scopedActionUrl, state]);

  const load = React.useCallback(async () => {
    state.setBusy(true);
    try {
      const res = await ApiClient.get<Accumul8BootstrapResponse>(scopedActionUrl('bootstrap'));
      state.setActiveOwnerUserId(Number(res?.selected_owner_user_id || 0));
      state.setAccessibleAccountOwners(Array.isArray(res?.accessible_account_owners) ? res.accessible_account_owners : []);
      state.setEntities(Array.isArray(res?.entities) ? res.entities : []);
      state.setEntityAliases(Array.isArray(res?.entity_aliases) ? res.entity_aliases : []);
      state.setEntityEndexGuides(Array.isArray(res?.entity_endex_guides) ? res.entity_endex_guides : []);
      state.setEntityEndexScanLogs(Array.isArray(res?.entity_endex_scan_logs) ? res.entity_endex_scan_logs : []);
      state.setContacts(Array.isArray(res?.contacts) ? res.contacts : []);
      state.setRecurringPayments(Array.isArray(res?.recurring_payments) ? res.recurring_payments : []);
      state.setTransactions(Array.isArray(res?.transactions) ? res.transactions : []);
      state.setBankingOrganizations(Array.isArray(res?.banking_organizations) ? res.banking_organizations : []);
      state.setAccounts(Array.isArray(res?.accounts) ? res.accounts : []);
      state.setNotificationRules(Array.isArray(res?.notification_rules) ? res.notification_rules : []);
      state.setPayBills(Array.isArray(res?.pay_bills) ? res.pay_bills : []);
      state.setDebtors(Array.isArray(res?.debtors) ? res.debtors : []);
      state.setDebtorLedger(Array.isArray(res?.debtor_ledger) ? res.debtor_ledger : []);
      state.setBudgetRows(Array.isArray(res?.budget_rows) ? res.budget_rows : []);
      state.setBankConnections(Array.isArray(res?.bank_connections) ? res.bank_connections : []);
      state.setSyncProvider(res?.sync_provider || { provider: 'teller', env: 'sandbox', configured: 0 });
      state.setSummary(res?.summary || { net_amount: 0, inflow_total: 0, outflow_total: 0, unpaid_outflow_total: 0 });
      if (res?.statement_uploads || res?.archived_statement_uploads || res?.statement_audit_runs) {
        applyStatementWorkspace(res);
      } else {
        state.setStatementUploads([]);
        state.setArchivedStatementUploads([]);
        state.setStatementAuditRuns([]);
        state.setStatementsLoaded(false);
      }
      state.setLoaded(true);
    } catch (error: any) {
      handleError(error, 'Failed to load Accumul8 data');
    } finally {
      state.setBusy(false);
    }
  }, [applyStatementWorkspace, handleError, scopedActionUrl, state]);

  return { applyStatementWorkspace, loadStatementWorkspace, load };
}

import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import { Accumul8BootstrapResponse, Accumul8StatementWorkspaceResponse, Accumul8TransactionsPagination } from '../../types/accumul8';

type State = ReturnType<typeof import('./useAccumul8State').useAccumul8State>;

export function useAccumul8Loader(args: {
  state: State;
  handleError: (error: any, fallback?: string) => void;
  scopedActionUrl: (action: string) => string;
}) {
  const { state, handleError, scopedActionUrl } = args;
  const DEFAULT_PAGE_SIZE = 250;

  const applyTransactionPayload = React.useCallback((res?: Partial<Accumul8BootstrapResponse> | { transactions?: unknown; transactions_pagination?: Partial<Accumul8TransactionsPagination> } | null) => {
    state.setTransactions(Array.isArray(res?.transactions) ? res.transactions : []);
    state.setDebtorLedger(Array.isArray(res?.transactions)
      ? res.transactions.filter((tx: any) => Number(tx?.debtor_id || 0) > 0)
      : []);
    state.setTransactionsPagination({
      current_page: Number(res?.transactions_pagination?.current_page || 1),
      page_size: Number(res?.transactions_pagination?.page_size || DEFAULT_PAGE_SIZE),
      total_pages: Number(res?.transactions_pagination?.total_pages || 1),
      total_rows: Number(res?.transactions_pagination?.total_rows || 0),
      is_full_dataset: Number(res?.transactions_pagination?.is_full_dataset ? 1 : 0) === 1,
    });
  }, [state]);

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

  const loadTransactionsPage = React.useCallback(async (page = 1, pageSize = DEFAULT_PAGE_SIZE) => {
    state.setBusy(true);
    try {
      const params = new URLSearchParams({
        action: 'list_transactions_page',
        page: String(Math.max(1, page)),
        page_size: String(Math.max(1, Math.min(pageSize, 500))),
      });
      const ownerMatch = scopedActionUrl('bootstrap').match(/[?&]owner_user_id=(\d+)/);
      if (ownerMatch?.[1]) {
        params.set('owner_user_id', ownerMatch[1]);
      }
      const res = await ApiClient.get<{ success: boolean; transactions: any[]; transactions_pagination: Accumul8TransactionsPagination }>(`/api/accumul8.php?${params.toString()}`);
      applyTransactionPayload(res);
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to load ledger page');
      throw error;
    } finally {
      state.setBusy(false);
    }
  }, [applyTransactionPayload, handleError, scopedActionUrl, state]);

  const loadAllTransactions = React.useCallback(async () => {
    if (state.transactionsPagination.is_full_dataset) {
      return {
        success: true,
        transactions: state.transactions,
        transactions_pagination: state.transactionsPagination,
      };
    }
    state.setBusy(true);
    try {
      const params = new URLSearchParams({
        action: 'list_transactions_page',
        mode: 'all',
      });
      const ownerMatch = scopedActionUrl('bootstrap').match(/[?&]owner_user_id=(\d+)/);
      if (ownerMatch?.[1]) {
        params.set('owner_user_id', ownerMatch[1]);
      }
      const res = await ApiClient.get<{ success: boolean; transactions: any[]; transactions_pagination: Accumul8TransactionsPagination }>(`/api/accumul8.php?${params.toString()}`);
      applyTransactionPayload(res);
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to load full ledger history');
      throw error;
    } finally {
      state.setBusy(false);
    }
  }, [applyTransactionPayload, handleError, scopedActionUrl, state]);

  const load = React.useCallback(async () => {
    state.setLoading(true);
    try {
      const bootstrapUrl = `${scopedActionUrl('bootstrap')}&transaction_page=1&transaction_page_size=${DEFAULT_PAGE_SIZE}`;
      const res = await ApiClient.get<Accumul8BootstrapResponse>(bootstrapUrl);
      state.setActiveOwnerUserId(Number(res?.selected_owner_user_id || 0));
      state.setAccessibleAccountOwners(Array.isArray(res?.accessible_account_owners) ? res.accessible_account_owners : []);
      state.setEntities(Array.isArray(res?.entities) ? res.entities : []);
      state.setEntityAliases(Array.isArray(res?.entity_aliases) ? res.entity_aliases : []);
      state.setEntityEndexGuides(Array.isArray(res?.entity_endex_guides) ? res.entity_endex_guides : []);
      state.setEntityEndexScanLogs(Array.isArray(res?.entity_endex_scan_logs) ? res.entity_endex_scan_logs : []);
      state.setContacts(Array.isArray(res?.contacts) ? res.contacts : []);
      state.setRecurringPayments(Array.isArray(res?.recurring_payments) ? res.recurring_payments : []);
      state.setBankingOrganizations(Array.isArray(res?.banking_organizations) ? res.banking_organizations : []);
      state.setAccounts(Array.isArray(res?.accounts) ? res.accounts : []);
      state.setNotificationRules(Array.isArray(res?.notification_rules) ? res.notification_rules : []);
      state.setPayBills(Array.isArray(res?.pay_bills) ? res.pay_bills : []);
      state.setDebtors(Array.isArray(res?.debtors) ? res.debtors : []);
      applyTransactionPayload(res);
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
      state.setLoading(false);
    }
  }, [applyStatementWorkspace, applyTransactionPayload, handleError, scopedActionUrl, state]);

  return { applyStatementWorkspace, loadAllTransactions, loadStatementWorkspace, loadTransactionsPage, load };
}

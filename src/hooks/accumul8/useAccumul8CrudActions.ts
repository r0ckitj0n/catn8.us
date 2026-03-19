import React from 'react';

import { ApiClient } from '../../core/ApiClient';
import {
  Accumul8AccountDeleteRequest,
  Accumul8AccountUpsertRequest,
  Accumul8BankConnectionDeleteRequest,
  Accumul8BankConnectionUpsertRequest,
  Accumul8BankingOrganizationUpsertRequest,
  Accumul8BudgetMonthEnsureRequest,
  Accumul8BudgetMonthEnsureResponse,
  Accumul8BudgetRowUpsertRequest,
  Accumul8ContactUpsertRequest,
  Accumul8DebtorUpsertRequest,
  Accumul8EntityAliasGlobalScanResponse,
  Accumul8EntityAliasScanRequest,
  Accumul8EntityAliasScanResponse,
  Accumul8EntityAliasUpsertRequest,
  Accumul8EntityEndexGuideUpsertRequest,
  Accumul8EntityUpsertRequest,
  Accumul8IdResponse,
  Accumul8NotificationRuleUpsertRequest,
  Accumul8RecurringLinkCandidatesResponse,
  Accumul8RecurringLinkHistoryResponse,
  Accumul8RecurringLinkRequest,
  Accumul8RecurringLinkResponse,
  Accumul8RecurringUpsertRequest,
  Accumul8TransactionMoveRequest,
  Accumul8TransactionUpsertRequest,
} from '../../types/accumul8';

export function useAccumul8CrudActions(args: {
  setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  load: () => Promise<void>;
  handleError: (error: any, fallback?: string) => void;
  onToast?: (payload: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  scopedActionUrl: (action: string) => string;
}) {
  const { setBusy, load, handleError, onToast, scopedActionUrl } = args;

  const withReload = React.useCallback(async <T,>(action: () => Promise<T>, successMessage?: string): Promise<T> => {
    setBusy(true);
    try {
      const result = await action();
      await load();
      if (successMessage && onToast) {
        onToast({ tone: 'success', message: successMessage });
      }
      return result;
    } catch (error: any) {
      handleError(error);
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, setBusy]);

  const createContact = React.useCallback(async (form: Accumul8ContactUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('create_contact'), form), 'Contact saved'), [scopedActionUrl, withReload]);
  const createEntity = React.useCallback(async (form: Accumul8EntityUpsertRequest) => withReload<Accumul8IdResponse>(() => ApiClient.post<Accumul8IdResponse>(scopedActionUrl('create_entity'), form), 'Entity saved'), [scopedActionUrl, withReload]);
  const updateEntity = React.useCallback(async (id: number, form: Accumul8EntityUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('update_entity'), { id, ...form }), 'Entity updated'), [scopedActionUrl, withReload]);
  const createEntityAlias = React.useCallback(async (payload: Accumul8EntityAliasUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('create_entity_alias'), payload), 'Alias saved'), [scopedActionUrl, withReload]);
  const deleteEntityAlias = React.useCallback(async (id: number) => withReload(() => ApiClient.post(scopedActionUrl('delete_entity_alias'), { id }), 'Alias deleted'), [scopedActionUrl, withReload]);

  const findEntityAliases = React.useCallback(async (payload: Accumul8EntityAliasScanRequest) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Accumul8EntityAliasScanResponse>(scopedActionUrl('scan_entity_aliases'), payload);
      await load();
      if (onToast) {
        const createdCount = Number(res?.created_count || 0);
        const updatedCount = Number(res?.updated_count || 0);
        const conflictCount = Number(res?.conflict_count || 0);
        const skippedCount = Number(res?.skipped_count || 0);
        const reviewedCount = Number(res?.reviewed_count || 0);
        const rejectedCount = Number(res?.rejected_count || 0);
        const actionCount = createdCount + updatedCount;
        let message = actionCount > 0 ? `Added ${actionCount} related name${actionCount === 1 ? '' : 's'} to the parent.` : 'No new related names were found for that parent.';
        if (reviewedCount > 0) message += ` AI reviewed ${reviewedCount} candidate${reviewedCount === 1 ? '' : 's'}.`;
        if (rejectedCount > 0) message += ` ${rejectedCount} ${rejectedCount === 1 ? 'was' : 'were'} rejected and protected from repeat scans.`;
        if (conflictCount > 0) {
          message += ` ${conflictCount} conflict${conflictCount === 1 ? ' was' : 's were'} skipped.`;
        } else if (skippedCount > 0 && actionCount > 0) {
          message += ` ${skippedCount} existing match${skippedCount === 1 ? ' was' : 'es were'} already covered.`;
        }
        onToast({ tone: actionCount > 0 ? 'success' : 'info', message });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to scan for related entity names');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl, setBusy]);

  const findAllEntityAliases = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await ApiClient.post<Accumul8EntityAliasGlobalScanResponse>(scopedActionUrl('scan_all_entity_aliases'), {});
      await load();
      if (onToast) {
        const touchedEntityCount = Number(res?.touched_entity_count || 0);
        const createdCount = Number(res?.created_count || 0);
        const updatedCount = Number(res?.updated_count || 0);
        const conflictCount = Number(res?.conflict_count || 0);
        const reviewedCount = Number(res?.reviewed_count || 0);
        const rejectedCount = Number(res?.rejected_count || 0);
        const protectedSkipCount = Number(res?.protected_skip_count || 0);
        const actionCount = createdCount + updatedCount;
        let message = actionCount > 0 ? `Updated ${touchedEntityCount} parent${touchedEntityCount === 1 ? '' : 's'} and added ${actionCount} related name${actionCount === 1 ? '' : 's'}.` : 'No new related names were found across the Entity Endex.';
        if (reviewedCount > 0) message += ` AI reviewed ${reviewedCount} candidate${reviewedCount === 1 ? '' : 's'}.`;
        if (rejectedCount > 0) message += ` ${rejectedCount} ${rejectedCount === 1 ? 'was' : 'were'} rejected and protected.`;
        if (protectedSkipCount > 0) message += ` ${protectedSkipCount} protected match${protectedSkipCount === 1 ? ' was' : 'es were'} skipped automatically.`;
        if (conflictCount > 0) message += ` ${conflictCount} conflict${conflictCount === 1 ? ' was' : 's were'} skipped.`;
        onToast({ tone: actionCount > 0 ? 'success' : 'info', message });
      }
      return res;
    } catch (error: any) {
      handleError(error, 'Failed to scan all entity parents for related names');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl, setBusy]);

  const createEntityEndexGuide = React.useCallback(async (form: Accumul8EntityEndexGuideUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('create_entity_endex_guide'), form), 'Grouping guide saved'), [scopedActionUrl, withReload]);
  const updateEntityEndexGuide = React.useCallback(async (id: number, form: Accumul8EntityEndexGuideUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('update_entity_endex_guide'), { id, ...form }), 'Grouping guide updated'), [scopedActionUrl, withReload]);
  const deleteEntityEndexGuide = React.useCallback(async (id: number) => withReload(() => ApiClient.post(scopedActionUrl('delete_entity_endex_guide'), { id }), 'Grouping guide deleted'), [scopedActionUrl, withReload]);
  const createBankingOrganization = React.useCallback(async (form: Accumul8BankingOrganizationUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('create_banking_organization'), form), 'Banking organization saved'), [scopedActionUrl, withReload]);
  const updateBankingOrganization = React.useCallback(async (id: number, form: Accumul8BankingOrganizationUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('update_banking_organization'), { id, ...form }), 'Banking organization updated'), [scopedActionUrl, withReload]);
  const deleteBankingOrganization = React.useCallback(async (id: number) => withReload(() => ApiClient.post(scopedActionUrl('delete_banking_organization'), { id }), 'Banking organization deleted'), [scopedActionUrl, withReload]);
  const createBankConnection = React.useCallback(async (form: Accumul8BankConnectionUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('create_bank_connection'), form), 'Connected institution saved'), [scopedActionUrl, withReload]);
  const updateBankConnection = React.useCallback(async (id: number, form: Accumul8BankConnectionUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('update_bank_connection'), { id, ...form }), 'Connected institution updated'), [scopedActionUrl, withReload]);
  const deleteBankConnection = React.useCallback(async (request: Accumul8BankConnectionDeleteRequest) => withReload(() => ApiClient.post(scopedActionUrl('delete_bank_connection'), request), 'Connected institution deleted'), [scopedActionUrl, withReload]);
  const createAccount = React.useCallback(async (form: Accumul8AccountUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('create_account'), form), 'Bank account saved'), [scopedActionUrl, withReload]);
  const updateAccount = React.useCallback(async (id: number, form: Accumul8AccountUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('update_account'), { id, ...form }), 'Bank account updated'), [scopedActionUrl, withReload]);
  const deleteAccount = React.useCallback(async (request: Accumul8AccountDeleteRequest) => withReload(() => ApiClient.post(scopedActionUrl('delete_account'), request), 'Bank account deleted'), [scopedActionUrl, withReload]);
  const updateContact = React.useCallback(async (id: number, form: Accumul8ContactUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('update_contact'), { id, ...form }), 'Contact updated'), [scopedActionUrl, withReload]);
  const deleteContact = React.useCallback(async (id: number) => withReload(() => ApiClient.post(scopedActionUrl('delete_contact'), { id }), 'Contact deleted'), [scopedActionUrl, withReload]);
  const createDebtor = React.useCallback(async (form: Accumul8DebtorUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('create_debtor'), form), 'Debtor saved'), [scopedActionUrl, withReload]);
  const updateDebtor = React.useCallback(async (id: number, form: Accumul8DebtorUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('update_debtor'), { id, ...form }), 'Debtor updated'), [scopedActionUrl, withReload]);
  const deleteDebtor = React.useCallback(async (id: number) => withReload(() => ApiClient.post(scopedActionUrl('delete_debtor'), { id }), 'Debtor deleted'), [scopedActionUrl, withReload]);
  const createRecurring = React.useCallback(async (form: Accumul8RecurringUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('create_recurring'), form), 'Recurring item saved'), [scopedActionUrl, withReload]);
  const updateRecurring = React.useCallback(async (id: number, form: Accumul8RecurringUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('update_recurring'), { id, ...form }), 'Recurring item updated'), [scopedActionUrl, withReload]);
  const toggleRecurring = React.useCallback(async (id: number) => withReload(() => ApiClient.post(scopedActionUrl('toggle_recurring'), { id }), 'Recurring item updated'), [scopedActionUrl, withReload]);
  const deleteRecurring = React.useCallback(async (id: number) => withReload(() => ApiClient.post(scopedActionUrl('delete_recurring'), { id }), 'Recurring item deleted'), [scopedActionUrl, withReload]);
  const listRecurringLinkCandidates = React.useCallback(async (recurringId: number, query = '') => (
    ApiClient.get<Accumul8RecurringLinkCandidatesResponse>(`${scopedActionUrl('list_recurring_link_candidates')}&recurring_id=${recurringId}&q=${encodeURIComponent(query)}`)
  ), [scopedActionUrl]);
  const listRecurringLinkHistory = React.useCallback(async (recurringId: number, query = '') => (
    ApiClient.get<Accumul8RecurringLinkHistoryResponse>(`${scopedActionUrl('list_recurring_link_history')}&recurring_id=${recurringId}&q=${encodeURIComponent(query)}`)
  ), [scopedActionUrl]);
  const linkRecurringTransactionExample = React.useCallback(async (payload: Accumul8RecurringLinkRequest) => {
    setBusy(true);
    try {
      const result = await ApiClient.post<Accumul8RecurringLinkResponse>(scopedActionUrl('link_recurring_transaction_example'), payload);
      await load();
      if (onToast) {
        const linkedHistoryCount = Number(result?.linked_history_count || 0);
        const historyCount = Number(result?.history_count || 0);
        onToast({
          tone: 'success',
          message: linkedHistoryCount > 0
            ? `Recurring history updated and linked ${linkedHistoryCount} additional ledger ${linkedHistoryCount === 1 ? 'entry' : 'entries'} (${historyCount} total).`
            : `Recurring example linked (${historyCount} total linked ledger ${historyCount === 1 ? 'entry' : 'entries'}).`,
        });
      }
      return result;
    } catch (error: any) {
      handleError(error, 'Failed to link recurring item to ledger history');
      throw error;
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl, setBusy]);
  const materializeDueRecurring = React.useCallback(async () => withReload(() => ApiClient.post(scopedActionUrl('materialize_due_recurring'), {}), 'Recurring items posted to ledger'), [scopedActionUrl, withReload]);
  const ensureBudgetMonth = React.useCallback(async (payload: Accumul8BudgetMonthEnsureRequest) => withReload<Accumul8BudgetMonthEnsureResponse>(() => ApiClient.post<Accumul8BudgetMonthEnsureResponse>(scopedActionUrl('ensure_budget_month'), payload)), [scopedActionUrl, withReload]);
  const createTransaction = React.useCallback(async (form: Accumul8TransactionUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('create_transaction'), form), 'Transaction saved'), [scopedActionUrl, withReload]);
  const updateTransaction = React.useCallback(async (id: number, form: Accumul8TransactionUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('update_transaction'), { id, ...form }), 'Transaction updated'), [scopedActionUrl, withReload]);
  const deleteTransaction = React.useCallback(async (id: number) => withReload(() => ApiClient.post(scopedActionUrl('delete_transaction'), { id }), 'Transaction deleted'), [scopedActionUrl, withReload]);
  const moveTransactionsToAccount = React.useCallback(async (payload: Accumul8TransactionMoveRequest) => withReload(() => ApiClient.post(scopedActionUrl('move_transactions_to_account'), payload), 'Transactions moved'), [scopedActionUrl, withReload]);
  const toggleTransactionPaid = React.useCallback(async (id: number) => withReload(() => ApiClient.post(scopedActionUrl('toggle_transaction_paid'), { id })), [scopedActionUrl, withReload]);
  const toggleTransactionReconciled = React.useCallback(async (id: number) => withReload(() => ApiClient.post(scopedActionUrl('toggle_transaction_reconciled'), { id })), [scopedActionUrl, withReload]);
  const toggleTransactionBudgetPlanner = React.useCallback(async (id: number) => withReload(() => ApiClient.post(scopedActionUrl('toggle_transaction_budget_planner'), { id }), 'Budget planner inclusion updated'), [scopedActionUrl, withReload]);
  const createBudgetRow = React.useCallback(async (form: Accumul8BudgetRowUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('create_budget_row'), form), 'Spreadsheet row saved'), [scopedActionUrl, withReload]);
  const updateBudgetRow = React.useCallback(async (id: number, form: Accumul8BudgetRowUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('update_budget_row'), { id, ...form }), 'Spreadsheet row updated'), [scopedActionUrl, withReload]);
  const deleteBudgetRow = React.useCallback(async (id: number) => withReload(() => ApiClient.post(scopedActionUrl('delete_budget_row'), { id }), 'Spreadsheet row deleted'), [scopedActionUrl, withReload]);
  const createNotificationRule = React.useCallback(async (form: Accumul8NotificationRuleUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('create_notification_rule'), form), 'Notification rule saved'), [scopedActionUrl, withReload]);
  const updateNotificationRule = React.useCallback(async (id: number, form: Accumul8NotificationRuleUpsertRequest) => withReload(() => ApiClient.post(scopedActionUrl('update_notification_rule'), { id, ...form }), 'Notification rule updated'), [scopedActionUrl, withReload]);
  const toggleNotificationRule = React.useCallback(async (id: number) => withReload(() => ApiClient.post(scopedActionUrl('toggle_notification_rule'), { id }), 'Notification rule updated'), [scopedActionUrl, withReload]);
  const deleteNotificationRule = React.useCallback(async (id: number) => withReload(() => ApiClient.post(scopedActionUrl('delete_notification_rule'), { id }), 'Notification rule deleted'), [scopedActionUrl, withReload]);

  const sendNotification = React.useCallback(async (payload: { rule_id?: number; subject?: string; body?: string; target_scope?: 'group' | 'custom'; custom_user_ids?: number[] }) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<any>(scopedActionUrl('send_notification'), payload);
      const sent = Number(res?.sent_count || 0);
      const failed = Number(res?.failed_count || 0);
      if (onToast) onToast({ tone: failed > 0 ? 'warning' : 'success', message: `Email sent to ${sent} user(s)${failed > 0 ? `, failed for ${failed}` : ''}.` });
      await load();
    } catch (error: any) {
      handleError(error, 'Failed to send notification');
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast, scopedActionUrl, setBusy]);

  return {
    withReload,
    createContact, createEntity, updateEntity, createEntityAlias, deleteEntityAlias, findEntityAliases, findAllEntityAliases,
    createEntityEndexGuide, updateEntityEndexGuide, deleteEntityEndexGuide,
    createBankingOrganization, updateBankingOrganization, deleteBankingOrganization,
    createBankConnection, updateBankConnection, deleteBankConnection,
    createAccount, updateAccount, deleteAccount, updateContact, deleteContact,
    createDebtor, updateDebtor, deleteDebtor,
    createRecurring, updateRecurring, toggleRecurring, deleteRecurring, listRecurringLinkCandidates, listRecurringLinkHistory, linkRecurringTransactionExample, materializeDueRecurring,
    ensureBudgetMonth,
    createTransaction, updateTransaction, deleteTransaction, moveTransactionsToAccount,
    toggleTransactionPaid, toggleTransactionReconciled, toggleTransactionBudgetPlanner,
    createBudgetRow, updateBudgetRow, deleteBudgetRow,
    createNotificationRule, updateNotificationRule, toggleNotificationRule, deleteNotificationRule,
    sendNotification,
  };
}

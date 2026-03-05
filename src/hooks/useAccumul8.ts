import React from 'react';
import { ApiClient } from '../core/ApiClient';
import {
  Accumul8Account,
  Accumul8BudgetRow,
  Accumul8BudgetRowUpsertRequest,
  Accumul8BillItem,
  Accumul8BootstrapResponse,
  Accumul8Contact,
  Accumul8ContactUpsertRequest,
  Accumul8Debtor,
  Accumul8DebtorUpsertRequest,
  Accumul8NotificationRule,
  Accumul8NotificationRuleUpsertRequest,
  Accumul8RecurringPayment,
  Accumul8RecurringUpsertRequest,
  Accumul8Transaction,
  Accumul8TransactionUpsertRequest,
} from '../types/accumul8';
export function useAccumul8(onToast?: (payload: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void) {
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [summary, setSummary] = React.useState({ net_amount: 0, inflow_total: 0, outflow_total: 0, unpaid_outflow_total: 0 });
  const [contacts, setContacts] = React.useState<Accumul8Contact[]>([]);
  const [recurringPayments, setRecurringPayments] = React.useState<Accumul8RecurringPayment[]>([]);
  const [transactions, setTransactions] = React.useState<Accumul8Transaction[]>([]);
  const [accounts, setAccounts] = React.useState<Accumul8Account[]>([]);
  const [notificationRules, setNotificationRules] = React.useState<Accumul8NotificationRule[]>([]);
  const [payBills, setPayBills] = React.useState<Accumul8BillItem[]>([]);
  const [debtors, setDebtors] = React.useState<Accumul8Debtor[]>([]);
  const [debtorLedger, setDebtorLedger] = React.useState<Accumul8Transaction[]>([]);
  const [budgetRows, setBudgetRows] = React.useState<Accumul8BudgetRow[]>([]);
  const [bankConnections, setBankConnections] = React.useState<any[]>([]);
  const [syncProvider, setSyncProvider] = React.useState({ provider: 'plaid', env: 'sandbox', configured: 0 });
  const handleError = React.useCallback((error: any, fallback = 'Accumul8 request failed') => {
    const message = String(error?.message || fallback);
    if (onToast) {
      onToast({ tone: 'error', message });
    }
  }, [onToast]);
  const load = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await ApiClient.get<Accumul8BootstrapResponse>('/api/accumul8.php?action=bootstrap');
      setContacts(Array.isArray(res?.contacts) ? res.contacts : []);
      setRecurringPayments(Array.isArray(res?.recurring_payments) ? res.recurring_payments : []);
      setTransactions(Array.isArray(res?.transactions) ? res.transactions : []);
      setAccounts(Array.isArray(res?.accounts) ? res.accounts : []);
      setNotificationRules(Array.isArray(res?.notification_rules) ? res.notification_rules : []);
      setPayBills(Array.isArray(res?.pay_bills) ? res.pay_bills : []);
      setDebtors(Array.isArray(res?.debtors) ? res.debtors : []);
      setDebtorLedger(Array.isArray(res?.debtor_ledger) ? res.debtor_ledger : []);
      setBudgetRows(Array.isArray(res?.budget_rows) ? res.budget_rows : []);
      setBankConnections(Array.isArray(res?.bank_connections) ? res.bank_connections : []);
      setSyncProvider(res?.sync_provider || { provider: 'plaid', env: 'sandbox', configured: 0 });
      setSummary(res?.summary || { net_amount: 0, inflow_total: 0, outflow_total: 0, unpaid_outflow_total: 0 });
      setLoaded(true);
    } catch (error: any) {
      handleError(error, 'Failed to load Accumul8 data');
    } finally {
      setBusy(false);
    }
  }, [handleError]);
  const withReload = React.useCallback(async (action: () => Promise<any>, successMessage?: string) => {
    setBusy(true);
    try {
      await action();
      await load();
      if (successMessage && onToast) {
        onToast({ tone: 'success', message: successMessage });
      }
    } catch (error: any) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast]);
  const createContact = React.useCallback(async (form: Accumul8ContactUpsertRequest) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=create_contact', form),
      'Contact saved',
    );
  }, [withReload]);
  const updateContact = React.useCallback(async (id: number, form: Accumul8ContactUpsertRequest) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=update_contact', { id, ...form }),
      'Contact updated',
    );
  }, [withReload]);
  const deleteContact = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=delete_contact', { id }),
      'Contact deleted',
    );
  }, [withReload]);
  const createDebtor = React.useCallback(async (form: Accumul8DebtorUpsertRequest) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=create_debtor', form),
      'Debtor saved',
    );
  }, [withReload]);
  const updateDebtor = React.useCallback(async (id: number, form: Accumul8DebtorUpsertRequest) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=update_debtor', { id, ...form }),
      'Debtor updated',
    );
  }, [withReload]);
  const deleteDebtor = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=delete_debtor', { id }),
      'Debtor deleted',
    );
  }, [withReload]);
  const createRecurring = React.useCallback(async (form: Accumul8RecurringUpsertRequest) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=create_recurring', form),
      'Recurring payment saved',
    );
  }, [withReload]);
  const updateRecurring = React.useCallback(async (id: number, form: Accumul8RecurringUpsertRequest) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=update_recurring', { id, ...form }),
      'Recurring payment updated',
    );
  }, [withReload]);
  const toggleRecurring = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=toggle_recurring', { id }),
      'Recurring payment updated',
    );
  }, [withReload]);
  const deleteRecurring = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=delete_recurring', { id }),
      'Recurring payment deleted',
    );
  }, [withReload]);
  const materializeDueRecurring = React.useCallback(async () => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=materialize_due_recurring', {}),
      'Recurring payments posted to ledger',
    );
  }, [withReload]);
  const createTransaction = React.useCallback(async (form: Accumul8TransactionUpsertRequest) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=create_transaction', form),
      'Transaction saved',
    );
  }, [withReload]);
  const updateTransaction = React.useCallback(async (id: number, form: Accumul8TransactionUpsertRequest) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=update_transaction', { id, ...form }),
      'Transaction updated',
    );
  }, [withReload]);
  const deleteTransaction = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=delete_transaction', { id }),
      'Transaction deleted',
    );
  }, [withReload]);
  const toggleTransactionPaid = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=toggle_transaction_paid', { id }),
    );
  }, [withReload]);
  const toggleTransactionReconciled = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=toggle_transaction_reconciled', { id }),
    );
  }, [withReload]);
  const createNotificationRule = React.useCallback(async (form: Accumul8NotificationRuleUpsertRequest) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=create_notification_rule', form),
      'Notification rule saved',
    );
  }, [withReload]);
  const updateNotificationRule = React.useCallback(async (id: number, form: Accumul8NotificationRuleUpsertRequest) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=update_notification_rule', { id, ...form }),
      'Notification rule updated',
    );
  }, [withReload]);
  const toggleNotificationRule = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=toggle_notification_rule', { id }),
      'Notification rule updated',
    );
  }, [withReload]);
  const deleteNotificationRule = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=delete_notification_rule', { id }),
      'Notification rule deleted',
    );
  }, [withReload]);
  const sendNotification = React.useCallback(async (payload: { rule_id?: number; subject?: string; body?: string; target_scope?: 'group' | 'custom'; custom_user_ids?: number[] }) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<any>('/api/accumul8.php?action=send_notification', payload);
      const sent = Number(res?.sent_count || 0);
      const failed = Number(res?.failed_count || 0);
      if (onToast) {
        onToast({ tone: failed > 0 ? 'warning' : 'success', message: `Email sent to ${sent} user(s)${failed > 0 ? `, failed for ${failed}` : ''}.` });
      }
      await load();
    } catch (error: any) {
      handleError(error, 'Failed to send notification');
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast]);
  const syncBankConnection = React.useCallback(async (connectionId: number) => {
    setBusy(true);
    try {
      const res = await ApiClient.post<any>('/api/accumul8.php?action=plaid_sync_transactions', { connection_id: connectionId });
      if (onToast) {
        onToast({ tone: 'success', message: `Synced bank transactions (added ${Number(res?.added || 0)}).` });
      }
      await load();
    } catch (error: any) {
      handleError(error, 'Bank sync failed');
    } finally {
      setBusy(false);
    }
  }, [handleError, load, onToast]);
  const createBudgetRow = React.useCallback(async (form: Accumul8BudgetRowUpsertRequest) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=create_budget_row', form),
      'Spreadsheet row saved',
    );
  }, [withReload]);
  const updateBudgetRow = React.useCallback(async (id: number, form: Accumul8BudgetRowUpsertRequest) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=update_budget_row', { id, ...form }),
      'Spreadsheet row updated',
    );
  }, [withReload]);
  const deleteBudgetRow = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=delete_budget_row', { id }),
      'Spreadsheet row deleted',
    );
  }, [withReload]);
  React.useEffect(() => {
    void load();
  }, [load]);
  return {
    busy,
    loaded,
    summary,
    contacts,
    recurringPayments,
    transactions,
    accounts,
    notificationRules,
    payBills,
    debtors,
    debtorLedger,
    budgetRows,
    bankConnections,
    syncProvider,
    load,
    createContact,
    updateContact,
    deleteContact,
    createDebtor,
    updateDebtor,
    deleteDebtor,
    createRecurring,
    updateRecurring,
    toggleRecurring,
    deleteRecurring,
    materializeDueRecurring,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    toggleTransactionPaid,
    toggleTransactionReconciled,
    createBudgetRow,
    updateBudgetRow,
    deleteBudgetRow,
    createNotificationRule,
    updateNotificationRule,
    toggleNotificationRule,
    deleteNotificationRule,
    sendNotification,
    syncBankConnection,
  };
}

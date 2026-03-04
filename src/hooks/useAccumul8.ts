import React from 'react';
import { ApiClient } from '../core/ApiClient';
import {
  Accumul8Account,
  Accumul8BillItem,
  Accumul8BootstrapResponse,
  Accumul8Contact,
  Accumul8NotificationRule,
  Accumul8RecurringPayment,
  Accumul8Transaction,
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
  const createContact = React.useCallback(async (form: { contact_name: string; contact_type: string; default_amount: number; email: string; notes: string }) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=create_contact', form),
      'Contact saved',
    );
  }, [withReload]);
  const deleteContact = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=delete_contact', { id }),
      'Contact deleted',
    );
  }, [withReload]);
  const createRecurring = React.useCallback(async (form: {
    title: string;
    direction: string;
    amount: number;
    frequency: string;
    interval_count: number;
    next_due_date: string;
    contact_id?: number | null;
    account_id?: number | null;
    notes?: string;
  }) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=create_recurring', form),
      'Recurring payment saved',
    );
  }, [withReload]);
  const toggleRecurring = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=toggle_recurring', { id }),
      'Recurring payment updated',
    );
  }, [withReload]);
  const materializeDueRecurring = React.useCallback(async () => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=materialize_due_recurring', {}),
      'Recurring payments posted to ledger',
    );
  }, [withReload]);
  const createTransaction = React.useCallback(async (form: {
    transaction_date: string;
    due_date?: string;
    entry_type: string;
    description: string;
    memo?: string;
    amount: number;
    rta_amount: number;
    is_paid: number;
    is_reconciled: number;
    contact_id?: number | null;
    account_id?: number | null;
  }) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=create_transaction', form),
      'Transaction saved',
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
  const createNotificationRule = React.useCallback(async (form: {
    rule_name: string;
    trigger_type: string;
    days_before_due: number;
    target_scope: 'group' | 'custom';
    custom_user_ids: number[];
    email_subject_template: string;
    email_body_template: string;
  }) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=create_notification_rule', form),
      'Notification rule saved',
    );
  }, [withReload]);
  const toggleNotificationRule = React.useCallback(async (id: number) => {
    await withReload(
      () => ApiClient.post('/api/accumul8.php?action=toggle_notification_rule', { id }),
      'Notification rule updated',
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
    bankConnections,
    syncProvider,
    load,
    createContact,
    deleteContact,
    createRecurring,
    toggleRecurring,
    materializeDueRecurring,
    createTransaction,
    toggleTransactionPaid,
    toggleTransactionReconciled,
    createNotificationRule,
    toggleNotificationRule,
    sendNotification,
    syncBankConnection,
  };
}

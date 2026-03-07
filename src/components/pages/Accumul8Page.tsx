import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { BankingOrganizationManagerModal } from '../modals/BankingOrganizationManagerModal';
import { Accumul8ContactModal } from '../modals/Accumul8ContactModal';
import { Accumul8DebtorModal } from '../modals/Accumul8DebtorModal';
import { Accumul8RecurringModal } from '../modals/Accumul8RecurringModal';
import { Accumul8SpreadsheetView } from '../accumul8/Accumul8SpreadsheetView';
import { Accumul8TransactionModal } from '../modals/Accumul8TransactionModal';
import { ACCUMUL8_SAVE_BUTTON_EMOJI } from '../accumul8/accumul8Ui';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { useAccumul8 } from '../../hooks/useAccumul8';
import { ApiClient } from '../../core/ApiClient';
import { openPlaidLink } from '../../core/plaidLink';
import {
  Accumul8PlaidCreateLinkTokenResponse,
  Accumul8PlaidExchangeResponse,
  Accumul8PlaidSyncResponse,
  Accumul8ContactType,
  Accumul8Direction,
  Accumul8EntryType,
  Accumul8Frequency,
  Accumul8PaymentMethod,
  Accumul8RecurringPayment,
  Accumul8Transaction,
  Accumul8Debtor,
} from '../../types/accumul8';
import './Accumul8Page.css';
interface Accumul8PageProps extends AppShellPageProps {
  onToast?: (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}
type TabKey = 'ledger' | 'spreadsheet' | 'debtors' | 'pay_bills' | 'contacts' | 'recurring' | 'notifications' | 'sync';
const ACCUMUL8_OWNER_STORAGE_KEY = 'accumul8.selected_owner_user_id';
const RECURRING_PAYMENT_METHOD_LABELS: Record<Accumul8PaymentMethod, string> = {
  unspecified: 'Unspecified',
  autopay: 'Auto debit / autopay',
  manual: 'Manual payment',
};
const ACCUMUL8_EDIT_BUTTON_EMOJI = '✏️';
type RecurringFormState = {
  title: string;
  direction: Accumul8Direction;
  amount: number;
  frequency: Accumul8Frequency;
  payment_method: Accumul8PaymentMethod;
  interval_count: number;
  next_due_date: string;
  contact_id: string;
  account_id: string;
  is_budget_planner: number;
  notes: string;
};
type DebtorFormState = {
  debtor_name: string;
  contact_id: string;
  notes: string;
  is_active: number;
};
type LedgerFormState = {
  transaction_date: string;
  due_date: string;
  entry_type: Accumul8EntryType;
  description: string;
  memo: string;
  amount: number;
  rta_amount: number;
  is_paid: number;
  is_reconciled: number;
  is_budget_planner: number;
  contact_id: string;
  account_id: string;
  debtor_id: string;
};
type LedgerInlineDraft = Partial<Pick<Accumul8Transaction, 'transaction_date' | 'due_date' | 'description' | 'memo' | 'amount' | 'rta_amount' | 'is_paid' | 'is_reconciled' | 'is_budget_planner' | 'debtor_id' | 'debtor_name'>>;
type DebtorInlineDraft = Partial<Pick<Accumul8Debtor, 'debtor_name' | 'contact_id' | 'contact_name' | 'notes' | 'is_active'>>;
const DEFAULT_CONTACT_FORM = {
  contact_name: '',
  contact_type: 'both' as Accumul8ContactType,
  default_amount: 0,
  email: '',
  phone_number: '',
  street_address: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
};
const DEFAULT_RECURRING_FORM: RecurringFormState = {
  title: '',
  direction: 'outflow',
  amount: 0,
  frequency: 'monthly',
  payment_method: 'unspecified',
  interval_count: 1,
  next_due_date: '',
  contact_id: '',
  account_id: '',
  is_budget_planner: 0,
  notes: '',
};
function createDefaultDebtorForm(): DebtorFormState {
  return { debtor_name: '', contact_id: '', notes: '', is_active: 1 };
}
function createDefaultLedgerForm(defaults?: { accountId?: string; debtorId?: string }): LedgerFormState {
  return {
    transaction_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    entry_type: 'manual',
    description: '',
    memo: '',
    amount: 0,
    rta_amount: 0,
    is_paid: 0,
    is_reconciled: 0,
    is_budget_planner: defaults?.debtorId ? 0 : 1,
    contact_id: '',
    account_id: defaults?.accountId || '',
    debtor_id: defaults?.debtorId || '',
  };
}
function buildRecurringPayload(form: RecurringFormState) {
  return {
    ...form,
    amount: Number(form.amount),
    interval_count: Number(form.interval_count),
    contact_id: form.contact_id ? Number(form.contact_id) : null,
    account_id: form.account_id ? Number(form.account_id) : null,
    is_budget_planner: Number(form.is_budget_planner),
  };
}

function formatInlineDate(value: string): string {
  if (!value) {
    return '-';
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  });
}

function formatInlineText(value: string | number | null | undefined, fallback = '-'): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback;
  }
  return String(value || '').trim() || fallback;
}
export function Accumul8Page({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle, onToast }: Accumul8PageProps) {
  const isAuthed = Boolean(viewer?.id);
  const isAdministrator = Number(viewer?.is_admin || 0) === 1 || Number(viewer?.is_administrator || 0) === 1;
  const isAccumul8User = Number(viewer?.is_accumul8_user || 0) === 1;
  const canAccess = isAuthed && (isAdministrator || isAccumul8User);
  const [selectedOwnerUserId, setSelectedOwnerUserId] = React.useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const raw = window.localStorage.getItem(ACCUMUL8_OWNER_STORAGE_KEY);
    const parsed = Number(raw || 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  });
  const {
    busy,
    loaded,
    activeOwnerUserId,
    accessibleAccountOwners,
    contacts,
    recurringPayments,
    transactions,
    bankingOrganizations,
    accounts,
    notificationRules,
    payBills,
    debtors,
    debtorLedger,
    budgetRows,
    bankConnections,
    syncProvider,
    load,
    createBankingOrganization,
    updateBankingOrganization,
    deleteBankingOrganization,
    createAccount,
    updateAccount,
    deleteAccount,
    createContact,
    updateContact,
    deleteContact,
    createDebtor,
    updateDebtor,
    deleteDebtor,
    createRecurring,
    updateRecurring,
    deleteRecurring,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    createBudgetRow,
    updateBudgetRow,
    deleteBudgetRow,
    createNotificationRule,
    updateNotificationRule,
    toggleNotificationRule,
    deleteNotificationRule,
    sendNotification,
    syncBankConnection,
  } = useAccumul8(onToast, selectedOwnerUserId > 0 ? selectedOwnerUserId : undefined);
  const [tab, setTab] = React.useState<TabKey>('ledger');
  const [contactForm, setContactForm] = React.useState(DEFAULT_CONTACT_FORM);
  const [debtorForm, setDebtorForm] = React.useState<DebtorFormState>(createDefaultDebtorForm);
  const [ledgerForm, setLedgerForm] = React.useState<LedgerFormState>(createDefaultLedgerForm);
  const [budgetForm, setBudgetForm] = React.useState<{ category_name: string; monthly_budget: number; match_pattern: string; row_order: number; is_active: number }>({ category_name: '', monthly_budget: 0, match_pattern: '', row_order: 0, is_active: 1 });
  const [budgetMonth, setBudgetMonth] = React.useState<string>(new Date().toISOString().slice(0, 7));
  const [notificationForm, setNotificationForm] = React.useState({ rule_name: '', trigger_type: 'upcoming_due', days_before_due: 3, target_scope: 'group' as 'group' | 'custom', custom_user_ids: '', email_subject_template: '', email_body_template: '' });
  const [editingContactId, setEditingContactId] = React.useState<number | null>(null);
  const [editingDebtorId, setEditingDebtorId] = React.useState<number | null>(null);
  const [editingRecurringId, setEditingRecurringId] = React.useState<number | null>(null);
  const [editingRecurringForm, setEditingRecurringForm] = React.useState<RecurringFormState>(DEFAULT_RECURRING_FORM);
  const [editingTransactionId, setEditingTransactionId] = React.useState<number | null>(null);
  const [editingBudgetRowId, setEditingBudgetRowId] = React.useState<number | null>(null);
  const [editingNotificationRuleId, setEditingNotificationRuleId] = React.useState<number | null>(null);
  const [activeLedgerRowId, setActiveLedgerRowId] = React.useState<number | null>(null);
  const [activePayBillRowId, setActivePayBillRowId] = React.useState<number | null>(null);
  const [activeDebtorRowId, setActiveDebtorRowId] = React.useState<number | null>(null);
  const [ledgerDraftById, setLedgerDraftById] = React.useState<Record<number, LedgerInlineDraft>>({});
  const [payBillDraftById, setPayBillDraftById] = React.useState<Record<number, LedgerInlineDraft>>({});
  const [debtorDraftById, setDebtorDraftById] = React.useState<Record<number, DebtorInlineDraft>>({});
  const [contactModalOpen, setContactModalOpen] = React.useState(false);
  const [debtorModalOpen, setDebtorModalOpen] = React.useState(false);
  const [recurringModalOpen, setRecurringModalOpen] = React.useState(false);
  const [transactionModalOpen, setTransactionModalOpen] = React.useState(false);
  const [selectedDebtorId, setSelectedDebtorId] = React.useState<string>('');
  const [selectedBankingOrganizationId, setSelectedBankingOrganizationId] = React.useState<string>('');
  const [selectedBankAccountId, setSelectedBankAccountId] = React.useState<string>('');
  const [bankingOrganizationManagerOpen, setBankingOrganizationManagerOpen] = React.useState(false);
  const [accountManagerOpen, setAccountManagerOpen] = React.useState(false);
  const [syncHelpOpen, setSyncHelpOpen] = React.useState(false);
  const [syncHelpToken, setSyncHelpToken] = React.useState('');
  const [syncHelpError, setSyncHelpError] = React.useState('');
  const scopedActionUrl = React.useCallback((action: string) => {
    const params = new URLSearchParams({ action });
    const ownerUserId = Number(selectedOwnerUserId || activeOwnerUserId || 0);
    if (ownerUserId > 0) {
      params.set('owner_user_id', String(ownerUserId));
    }
    return `/api/accumul8.php?${params.toString()}`;
  }, [activeOwnerUserId, selectedOwnerUserId]);
  React.useEffect(() => {
    if (activeOwnerUserId <= 0) return;
    setSelectedOwnerUserId((prev) => (prev === activeOwnerUserId ? prev : activeOwnerUserId));
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACCUMUL8_OWNER_STORAGE_KEY, String(activeOwnerUserId));
    }
  }, [activeOwnerUserId]);
  const visibleAccounts = React.useMemo(() => {
    const bankingOrganizationId = Number(selectedBankingOrganizationId || 0);
    if (bankingOrganizationId <= 0) {
      return accounts;
    }
    return accounts.filter((account) => Number(account.banking_organization_id || 0) === bankingOrganizationId);
  }, [accounts, selectedBankingOrganizationId]);
  React.useEffect(() => {
    const bankAccountId = Number(selectedBankAccountId || 0);
    if (bankAccountId <= 0) {
      return;
    }
    if (!visibleAccounts.some((account) => account.id === bankAccountId)) {
      setSelectedBankAccountId('');
    }
  }, [selectedBankAccountId, visibleAccounts]);
  const filteredTransactions = React.useMemo(() => {
    const bankingOrganizationId = Number(selectedBankingOrganizationId || 0);
    const bankAccountId = Number(selectedBankAccountId || 0);
    return transactions.filter((tx) => {
      if (bankingOrganizationId > 0 && Number(tx.banking_organization_id || 0) !== bankingOrganizationId) {
        return false;
      }
      if (bankAccountId > 0 && Number(tx.account_id || 0) !== bankAccountId) {
        return false;
      }
      return true;
    });
  }, [selectedBankingOrganizationId, selectedBankAccountId, transactions]);
  const filteredRecurringPayments = React.useMemo(() => {
    const bankingOrganizationId = Number(selectedBankingOrganizationId || 0);
    const bankAccountId = Number(selectedBankAccountId || 0);
    return recurringPayments.filter((item) => {
      if (bankingOrganizationId > 0 && Number(item.banking_organization_id || 0) !== bankingOrganizationId) {
        return false;
      }
      if (bankAccountId > 0 && Number(item.account_id || 0) !== bankAccountId) {
        return false;
      }
      return true;
    });
  }, [recurringPayments, selectedBankingOrganizationId, selectedBankAccountId]);
  const todayDate = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const filteredPayBills = React.useMemo(() => {
    const transactionIds = new Set(filteredTransactions.map((tx) => tx.id));
    return payBills.filter((bill) => {
      if (!transactionIds.has(bill.id)) {
        return false;
      }
      if (Number(bill.is_paid || 0) !== 0) {
        return false;
      }
      const effectiveDueDate = bill.due_date || bill.transaction_date;
      return effectiveDueDate !== '';
    });
  }, [filteredTransactions, payBills]);
  const payBillRows = React.useMemo(() => {
    const transactionById = new Map<number, Accumul8Transaction>();
    filteredTransactions.forEach((tx) => {
      transactionById.set(tx.id, tx);
    });
    return filteredPayBills
      .map((bill) => transactionById.get(bill.id) || null)
      .filter((tx): tx is Accumul8Transaction => tx !== null);
  }, [filteredPayBills, filteredTransactions]);
  const upcomingRecurringPayBills = React.useMemo(() => (
    filteredRecurringPayments
      .filter((item) => Number(item.is_active || 0) === 1 && String(item.direction || 'outflow') === 'outflow' && String(item.next_due_date || '').trim() !== '')
      .slice()
      .sort((a, b) => {
        const dateCompare = String(a.next_due_date || '').localeCompare(String(b.next_due_date || ''));
        if (dateCompare !== 0) {
          return dateCompare;
        }
        return a.id - b.id;
      })
  ), [filteredRecurringPayments]);
  const filteredSummary = React.useMemo(() => {
    const next = { net_amount: 0, inflow_total: 0, outflow_total: 0, unpaid_outflow_total: 0 };
    filteredTransactions.forEach((tx) => {
      const amount = Number(tx.amount || 0);
      next.net_amount += amount;
      if (amount > 0) {
        next.inflow_total += amount;
      } else if (amount < 0) {
        next.outflow_total += amount;
        if (!Number(tx.is_paid || 0)) {
          next.unpaid_outflow_total += amount;
        }
      }
    });
    return next;
  }, [filteredTransactions]);
  const openSyncHelp = React.useCallback((opts?: { token?: string; error?: string }) => {
    setSyncHelpToken(String(opts?.token || ''));
    setSyncHelpError(String(opts?.error || ''));
    setSyncHelpOpen(true);
  }, []);
  const resetContactForm = React.useCallback(() => {
    setEditingContactId(null);
    setContactForm(DEFAULT_CONTACT_FORM);
  }, []);
  const resetDebtorForm = React.useCallback(() => {
    setEditingDebtorId(null);
    setDebtorForm(createDefaultDebtorForm());
  }, []);
  const resetRecurringEditor = React.useCallback(() => {
    setEditingRecurringId(null);
    setEditingRecurringForm(DEFAULT_RECURRING_FORM);
    setRecurringModalOpen(false);
  }, []);
  const resetLedgerForm = React.useCallback(() => {
    setEditingTransactionId(null);
    setLedgerForm(createDefaultLedgerForm({ accountId: selectedBankAccountId }));
  }, [selectedBankAccountId]);
  const resetBudgetForm = React.useCallback(() => {
    setEditingBudgetRowId(null);
    setBudgetForm({ category_name: '', monthly_budget: 0, match_pattern: '', row_order: 0, is_active: 1 });
  }, []);
  const resetNotificationForm = React.useCallback(() => {
    setEditingNotificationRuleId(null);
    setNotificationForm({ rule_name: '', trigger_type: 'upcoming_due', days_before_due: 3, target_scope: 'group', custom_user_ids: '', email_subject_template: '', email_body_template: '' });
  }, []);
  const parseCustomUserIds = React.useCallback((raw: string): number[] => (
    raw.split(',').map((v) => Number(v.trim())).filter((n) => Number.isFinite(n) && n > 0)
  ), []);
  const beginEditTransaction = React.useCallback((id: number) => {
    const tx = transactions.find((v) => v.id === id);
    if (!tx) return;
    setEditingTransactionId(tx.id);
    setLedgerForm({
      transaction_date: tx.transaction_date || new Date().toISOString().slice(0, 10),
      due_date: tx.due_date || '',
      entry_type: (tx.entry_type || 'manual') as Accumul8EntryType,
      description: tx.description || '',
      memo: tx.memo || '',
      amount: Number(tx.amount || 0),
      rta_amount: Number(tx.rta_amount || 0),
      is_paid: Number(tx.is_paid || 0),
      is_reconciled: Number(tx.is_reconciled || 0),
      is_budget_planner: Number(tx.is_budget_planner || 0),
      contact_id: tx.contact_id ? String(tx.contact_id) : '',
      account_id: tx.account_id ? String(tx.account_id) : '',
      debtor_id: tx.debtor_id ? String(tx.debtor_id) : '',
    });
    setTransactionModalOpen(true);
  }, [transactions]);
  const beginEditContact = React.useCallback((id: number) => {
    const contact = contacts.find((v) => v.id === id);
    if (!contact) return;
    setEditingContactId(contact.id);
    setContactForm({
      contact_name: contact.contact_name || '',
      contact_type: (contact.contact_type || 'both') as Accumul8ContactType,
      default_amount: Number(contact.default_amount || 0),
      email: contact.email || '',
      phone_number: contact.phone_number || '',
      street_address: contact.street_address || '',
      city: contact.city || '',
      state: contact.state || '',
      zip: contact.zip || '',
      notes: contact.notes || '',
    });
    setContactModalOpen(true);
  }, [contacts]);
  const openCreateContactModal = React.useCallback(() => {
    resetContactForm();
    setContactModalOpen(true);
  }, [resetContactForm]);
  const closeContactModal = React.useCallback(() => {
    setContactModalOpen(false);
    resetContactForm();
  }, [resetContactForm]);
  const openCreateDebtorModal = React.useCallback(() => {
    resetDebtorForm();
    setDebtorModalOpen(true);
  }, [resetDebtorForm]);
  const closeDebtorModal = React.useCallback(() => {
    setDebtorModalOpen(false);
    resetDebtorForm();
  }, [resetDebtorForm]);
  const openCreateTransactionModal = React.useCallback((defaults?: { debtorId?: string }) => {
    setEditingTransactionId(null);
    setLedgerForm(createDefaultLedgerForm({ accountId: selectedBankAccountId, debtorId: defaults?.debtorId || '' }));
    setTransactionModalOpen(true);
  }, [selectedBankAccountId]);
  const closeTransactionModal = React.useCallback(() => {
    setTransactionModalOpen(false);
    resetLedgerForm();
  }, [resetLedgerForm]);
  const submitContactForm = React.useCallback(async (form: typeof DEFAULT_CONTACT_FORM) => {
    const payload = { ...form, default_amount: Number(form.default_amount) };
    if (editingContactId) {
      await updateContact(editingContactId, payload);
    } else {
      await createContact(payload);
    }
    closeContactModal();
  }, [closeContactModal, createContact, editingContactId, updateContact]);
  const beginEditRecurring = React.useCallback((id: number) => {
    const recurring = recurringPayments.find((v) => v.id === id);
    if (!recurring) return;
    setEditingRecurringId(recurring.id);
    setEditingRecurringForm({
      title: recurring.title || '',
      direction: (recurring.direction || 'outflow') as Accumul8Direction,
      amount: Number(recurring.amount || 0),
      frequency: (recurring.frequency || 'monthly') as Accumul8Frequency,
      payment_method: (recurring.payment_method || 'unspecified') as Accumul8PaymentMethod,
      interval_count: Number(recurring.interval_count || 1),
      next_due_date: recurring.next_due_date || '',
      contact_id: recurring.contact_id ? String(recurring.contact_id) : '',
      account_id: recurring.account_id ? String(recurring.account_id) : '',
      is_budget_planner: Number(recurring.is_budget_planner || 0),
      notes: recurring.notes || '',
    });
    setRecurringModalOpen(true);
  }, [recurringPayments]);
  const openCreateRecurringModal = React.useCallback(() => {
    setEditingRecurringId(null);
    setEditingRecurringForm(DEFAULT_RECURRING_FORM);
    setRecurringModalOpen(true);
  }, []);
  const closeRecurringModal = React.useCallback(() => {
    resetRecurringEditor();
  }, [resetRecurringEditor]);
  const submitDebtorModal = React.useCallback(async (form: { debtor_name: string; contact_id?: number | null; notes?: string; is_active?: number }) => {
    if (editingDebtorId) {
      await updateDebtor(editingDebtorId, form);
    } else {
      await createDebtor(form);
    }
    closeDebtorModal();
  }, [closeDebtorModal, createDebtor, editingDebtorId, updateDebtor]);
  const submitTransactionModal = React.useCallback(async (form: {
    transaction_date: string;
    due_date?: string;
    entry_type: Accumul8EntryType;
    description: string;
    memo?: string;
    amount: number;
    rta_amount: number;
    is_paid: number;
    is_reconciled: number;
    is_budget_planner: number;
    contact_id?: number | null;
    account_id?: number | null;
    debtor_id?: number | null;
  }) => {
    if (editingTransactionId) {
      await updateTransaction(editingTransactionId, form);
    } else {
      await createTransaction(form);
    }
    closeTransactionModal();
  }, [closeTransactionModal, createTransaction, editingTransactionId, updateTransaction]);
  const submitRecurringModal = React.useCallback(async (form: ReturnType<typeof buildRecurringPayload>) => {
    if (editingRecurringId) {
      await updateRecurring(editingRecurringId, form);
    } else {
      await createRecurring(form);
    }
    closeRecurringModal();
  }, [closeRecurringModal, createRecurring, editingRecurringId, updateRecurring]);
  const beginEditBudgetRow = React.useCallback((id: number) => {
    const row = budgetRows.find((v) => v.id === id);
    if (!row) return;
    setEditingBudgetRowId(row.id);
    setBudgetForm({
      category_name: row.category_name || '',
      monthly_budget: Number(row.monthly_budget || 0),
      match_pattern: row.match_pattern || '',
      row_order: Number(row.row_order || 0),
      is_active: Number(row.is_active || 0),
    });
  }, [budgetRows]);
  const beginEditNotificationRule = React.useCallback((id: number) => {
    const rule = notificationRules.find((v) => v.id === id);
    if (!rule) return;
    setEditingNotificationRuleId(rule.id);
    setNotificationForm({
      rule_name: rule.rule_name || '',
      trigger_type: rule.trigger_type || 'upcoming_due',
      days_before_due: Number(rule.days_before_due || 0),
      target_scope: rule.target_scope === 'custom' ? 'custom' : 'group',
      custom_user_ids: Array.isArray(rule.custom_user_ids) ? rule.custom_user_ids.join(',') : '',
      email_subject_template: rule.email_subject_template || '',
      email_body_template: rule.email_body_template || '',
    });
  }, [notificationRules]);
  const runPlaidLink = React.useCallback(async () => {
    if (!onToast) return;
    if (!syncProvider.configured) {
      onToast({ tone: 'error', message: 'Plaid is not configured. Save credentials in Settings first.' });
      return;
    }

    try {
      const tokenRes = await ApiClient.post<Accumul8PlaidCreateLinkTokenResponse>(scopedActionUrl('plaid_create_link_token'), { client_name: 'Accumul8' });
      const token = String(tokenRes?.link_token || '');
      if (!token) {
        throw new Error('No link token returned');
      }

      setSyncHelpError('');
      setSyncHelpToken(token);

      const linkResult = await openPlaidLink(token);

      if (linkResult.outcome === 'cancelled') {
        onToast({ tone: 'info', message: 'Plaid Link was closed before connecting an account.' });
        return;
      }

      const institutionId = String(linkResult.metadata?.institution?.institution_id || '');
      const institutionName = String(linkResult.metadata?.institution?.name || '');
      const exchangeRes = await ApiClient.post<Accumul8PlaidExchangeResponse>(scopedActionUrl('plaid_exchange_public_token'), {
        public_token: String(linkResult.publicToken || ''),
        institution_id: institutionId,
        institution_name: institutionName,
      });
      const connectionId = Number(exchangeRes?.connection_id || 0);
      if (connectionId <= 0) {
        throw new Error('Plaid exchange did not return a valid connection id');
      }
      const syncRes = await ApiClient.post<Accumul8PlaidSyncResponse>(scopedActionUrl('plaid_sync_transactions'), {
        connection_id: connectionId,
      });
      const added = Number(syncRes?.added || 0);
      onToast({ tone: 'success', message: `Plaid connected and synced (${added} transaction${added === 1 ? '' : 's'} imported).` });
      await load();
    } catch (error: any) {
      const message = String(error?.message || 'Failed to create Plaid link token');
      openSyncHelp({ error: message });
      onToast({ tone: 'error', message });
    }
  }, [load, onToast, openSyncHelp, scopedActionUrl, syncProvider.configured]);
  const budgetRowsSorted = React.useMemo(() => (
    [...budgetRows].sort((a, b) => (a.row_order - b.row_order) || (a.id - b.id))
  ), [budgetRows]);
  const ledgerRowsForBudgetMonth = React.useMemo(() => (
    filteredTransactions.filter((tx) => String(tx.transaction_date || '').slice(0, 7) === budgetMonth)
  ), [budgetMonth, filteredTransactions]);
  const budgetActualByRowId = React.useMemo(() => {
    const map: Record<number, number> = {};
    for (const row of budgetRowsSorted) {
      const pattern = String(row.match_pattern || '').trim().toLowerCase();
      if (pattern === '') {
        map[row.id] = 0;
        continue;
      }
      let total = 0;
      for (const tx of ledgerRowsForBudgetMonth) {
        const haystack = `${tx.description || ''} ${tx.memo || ''} ${tx.contact_name || ''} ${tx.debtor_name || ''}`.toLowerCase();
        if (haystack.includes(pattern)) {
          total += Math.abs(Number(tx.amount || 0));
        }
      }
      map[row.id] = Number(total.toFixed(2));
    }
    return map;
  }, [budgetRowsSorted, ledgerRowsForBudgetMonth]);
  const spreadsheetTotals = React.useMemo(() => {
    let budget = 0;
    let actual = 0;
    for (const row of budgetRowsSorted) {
      if (!row.is_active) continue;
      budget += Number(row.monthly_budget || 0);
      actual += Number(budgetActualByRowId[row.id] || 0);
    }
    return {
      budget: Number(budget.toFixed(2)),
      actual: Number(actual.toFixed(2)),
      remaining: Number((budget - actual).toFixed(2)),
    };
  }, [budgetActualByRowId, budgetRowsSorted]);
  const budgetPlannerRecurringPayments = React.useMemo(() => (
    filteredRecurringPayments.filter((rp) => Number(rp.is_budget_planner || 0) === 1 && String(rp.direction || 'outflow') === 'outflow')
  ), [filteredRecurringPayments]);
  const selectedDebtorEntries = React.useMemo(() => {
    const debtorId = Number(selectedDebtorId || 0);
    if (debtorId <= 0) {
      return debtorLedger;
    }
    return debtorLedger.filter((tx) => Number(tx.debtor_id || 0) === debtorId);
  }, [debtorLedger, selectedDebtorId]);
  const handleDeleteTransaction = React.useCallback((id: number, description: string) => {
    if (window.confirm(`Delete "${description || 'this ledger item'}"?`)) {
      void deleteTransaction(id);
    }
  }, [deleteTransaction]);
  const handleDeleteRecurring = React.useCallback((id: number, description: string) => {
    if (window.confirm(`Delete "${description || 'this recurring payment'}"?`)) {
      void deleteRecurring(id);
    }
  }, [deleteRecurring]);
  const activateLedgerRow = React.useCallback((id: number) => {
    setActiveLedgerRowId(id);
  }, []);
  const activatePayBillRow = React.useCallback((id: number) => {
    setActivePayBillRowId(id);
  }, []);
  const activateDebtorRow = React.useCallback((id: number) => {
    setActiveDebtorRowId(id);
  }, []);
  const setLedgerRowDraft = React.useCallback((tx: Accumul8Transaction, patch: LedgerInlineDraft) => {
    setLedgerDraftById((prev) => ({
      ...prev,
      [tx.id]: {
        ...prev[tx.id],
        ...patch,
      },
    }));
  }, []);
  const setDebtorRowDraft = React.useCallback((row: Accumul8Debtor, patch: DebtorInlineDraft) => {
    setDebtorDraftById((prev) => ({
      ...prev,
      [row.id]: {
        ...prev[row.id],
        ...patch,
      },
    }));
  }, []);
  const setPayBillRowDraft = React.useCallback((tx: Accumul8Transaction, patch: LedgerInlineDraft) => {
    setPayBillDraftById((prev) => ({
      ...prev,
      [tx.id]: {
        ...prev[tx.id],
        ...patch,
      },
    }));
  }, []);
  const saveLedgerRow = React.useCallback(async (tx: Accumul8Transaction) => {
    const draft = ledgerDraftById[tx.id];
    if (!draft) {
      return;
    }
    await updateTransaction(tx.id, {
      transaction_date: draft.transaction_date ?? tx.transaction_date,
      due_date: draft.due_date ?? tx.due_date,
      entry_type: tx.entry_type,
      description: draft.description ?? tx.description,
      memo: draft.memo ?? tx.memo,
      amount: Number(draft.amount ?? tx.amount ?? 0),
      rta_amount: Number(draft.rta_amount ?? tx.rta_amount ?? 0),
      is_paid: Number(draft.is_paid ?? tx.is_paid ?? 0),
      is_reconciled: Number(draft.is_reconciled ?? tx.is_reconciled ?? 0),
      is_budget_planner: Number(draft.is_budget_planner ?? tx.is_budget_planner ?? 0),
      contact_id: tx.contact_id ?? null,
      account_id: tx.account_id ?? null,
      debtor_id: draft.debtor_id ?? tx.debtor_id ?? null,
    });
    setLedgerDraftById((prev) => {
      const next = { ...prev };
      delete next[tx.id];
      return next;
    });
    setActiveLedgerRowId((current) => (current === tx.id ? null : current));
  }, [ledgerDraftById, updateTransaction]);
  const savePayBillRow = React.useCallback(async (tx: Accumul8Transaction) => {
    const draft = payBillDraftById[tx.id];
    if (!draft) {
      return;
    }
    await updateTransaction(tx.id, {
      transaction_date: draft.transaction_date ?? tx.transaction_date,
      due_date: draft.due_date ?? tx.due_date,
      entry_type: tx.entry_type,
      description: draft.description ?? tx.description,
      memo: draft.memo ?? tx.memo,
      amount: Number(draft.amount ?? tx.amount ?? 0),
      rta_amount: Number(draft.rta_amount ?? tx.rta_amount ?? 0),
      is_paid: Number(draft.is_paid ?? tx.is_paid ?? 0),
      is_reconciled: Number(draft.is_reconciled ?? tx.is_reconciled ?? 0),
      is_budget_planner: Number(draft.is_budget_planner ?? tx.is_budget_planner ?? 0),
      contact_id: tx.contact_id ?? null,
      account_id: tx.account_id ?? null,
      debtor_id: draft.debtor_id ?? tx.debtor_id ?? null,
    });
    setPayBillDraftById((prev) => {
      const next = { ...prev };
      delete next[tx.id];
      return next;
    });
    setActivePayBillRowId((current) => (current === tx.id ? null : current));
  }, [payBillDraftById, updateTransaction]);
  const saveDebtorRow = React.useCallback(async (row: Accumul8Debtor) => {
    const draft = debtorDraftById[row.id];
    if (!draft) {
      return;
    }
    await updateDebtor(row.id, {
      debtor_name: draft.debtor_name ?? row.debtor_name,
      contact_id: draft.contact_id ?? row.contact_id ?? null,
      notes: draft.notes ?? row.notes ?? '',
      is_active: Number(draft.is_active ?? row.is_active ?? 0),
    });
    setDebtorDraftById((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
    setActiveDebtorRowId((current) => (current === row.id ? null : current));
  }, [debtorDraftById, updateDebtor]);
  if (!isAuthed) {
    return (
      <PageLayout page="accumul8" title="ACCUMUL8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section">
          <div className="container">
            <h1 className="section-title">ACCUMUL8</h1>
            <div className="catn8-card p-3">
              <p className="mb-2">Login required.</p>
              <button type="button" className="btn btn-primary" onClick={onLoginClick}>Log in</button>
            </div>
          </div>
        </section>
      </PageLayout>
    );
  }
  if (!canAccess) {
    return (
      <PageLayout page="accumul8" title="ACCUMUL8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section">
          <div className="container">
            <h1 className="section-title">ACCUMUL8</h1>
            <div className="catn8-card p-3">
              <p className="mb-0">Your account is not in the <strong>Accumul8 Users</strong> group. Ask an administrator to grant access.</p>
            </div>
          </div>
        </section>
      </PageLayout>
    );
  }
  return (
    <PageLayout page="accumul8" title="ACCUMUL8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="section">
        <div className="container accumul8-page">
          <div className="accumul8-page-header mb-2">
            <div className="accumul8-page-title-row">
              <h1 className="section-title mb-0">ACCUMUL8</h1>
              <div className="accumul8-tabs accumul8-tabs--header">
                {[
                  ['ledger', 'Ledger'],
                  ['spreadsheet', 'Budget'],
                  ['debtors', 'Balances'],
                  ['pay_bills', 'Pay Bills'],
                  ['contacts', 'Payees/Payers'],
                  ['recurring', 'Recurring'],
                  ['notifications', 'Notifications'],
                  ['sync', 'Sync'],
                ].map(([key, label]) => (
                  <button key={key} type="button" className={`btn ${tab === key ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab(key as TabKey)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="accumul8-page-toolbar mb-3">
              <div className="accumul8-page-filters">
                <div className="accumul8-toolbar-field">
                  <div className="accumul8-filter-label-row">
                    <label htmlFor="accumul8-group-filter" className="form-label small text-muted mb-1">Banking Organization</label>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm accumul8-filter-gear"
                      onClick={() => setBankingOrganizationManagerOpen(true)}
                      aria-label="Manage banking organizations"
                      title="Manage banking organizations"
                    >
                      <i className="bi bi-gear"></i>
                    </button>
                  </div>
                  <select
                    id="accumul8-group-filter"
                    className="form-select form-select-sm"
                    value={selectedBankingOrganizationId}
                    onChange={(e) => setSelectedBankingOrganizationId(e.target.value)}
                  >
                    <option value="">All Banking Organizations</option>
                    {bankingOrganizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>{organization.banking_organization_name}</option>
                    ))}
                  </select>
                </div>
                <div className="accumul8-toolbar-field">
                  <div className="accumul8-filter-label-row">
                    <label htmlFor="accumul8-bank-filter" className="form-label small text-muted mb-1">Bank account</label>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm accumul8-filter-gear"
                      onClick={() => setAccountManagerOpen(true)}
                      aria-label="Manage bank accounts"
                      title="Manage bank accounts"
                    >
                      <i className="bi bi-gear"></i>
                    </button>
                  </div>
                  <select
                    id="accumul8-bank-filter"
                    className="form-select form-select-sm"
                    value={selectedBankAccountId}
                    onChange={(e) => setSelectedBankAccountId(e.target.value)}
                  >
                    <option value="">All bank accounts</option>
                    {visibleAccounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.account_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="accumul8-owner-selector">
                <label htmlFor="accumul8-owner-select" className="form-label mb-0 small text-muted">Viewing owner</label>
                <select
                  id="accumul8-owner-select"
                  className="form-select form-select-sm"
                  value={activeOwnerUserId > 0 ? String(activeOwnerUserId) : ''}
                  onChange={(e) => {
                    const next = Number(e.target.value || 0);
                    if (!Number.isFinite(next) || next <= 0) return;
                    setSelectedOwnerUserId(next);
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem(ACCUMUL8_OWNER_STORAGE_KEY, String(next));
                    }
                  }}
                  disabled={busy || accessibleAccountOwners.length <= 1}
                >
                  {accessibleAccountOwners.map((owner) => (
                    <option key={owner.owner_user_id} value={owner.owner_user_id}>
                      {owner.username}
                      {owner.is_self ? ' (You)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="accumul8-summary-grid">
            <div className="accumul8-summary-card"><span>Net</span><strong>${filteredSummary.net_amount.toFixed(2)}</strong></div>
            <div className="accumul8-summary-card"><span>Inflow</span><strong>${filteredSummary.inflow_total.toFixed(2)}</strong></div>
            <div className="accumul8-summary-card"><span>Outflow</span><strong>${filteredSummary.outflow_total.toFixed(2)}</strong></div>
            <div className="accumul8-summary-card"><span>Unpaid Bills</span><strong>${filteredSummary.unpaid_outflow_total.toFixed(2)}</strong></div>
          </div>
          {tab === 'ledger' && (
            <div className="accumul8-panel">
              <div className="accumul8-panel-toolbar mb-3">
                <h3 className="mb-0">Ledger (Checkbook Style)</h3>
                <button type="button" className="btn btn-success btn-sm" onClick={() => openCreateTransactionModal()} disabled={busy}>Add Ledger Entry</button>
              </div>
              <div className="table-responsive mt-3 accumul8-scroll-area accumul8-scroll-area--ledger">
                <table className="table table-sm accumul8-ledger-table accumul8-sticky-head">
                  <thead><tr><th>Date</th><th>Due</th><th>Description</th><th>Debtor</th><th>Memo</th><th className="text-end">Amount</th><th className="text-end">Balance</th><th>Paid</th><th>Reconciled</th><th>Planner</th><th className="text-end">Actions</th></tr></thead>
                  <tbody>
                    {filteredTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className={[
                          'accumul8-list-item',
                          tx.amount < 0 ? 'is-outflow' : 'is-inflow',
                          activeLedgerRowId === tx.id ? 'is-editing' : '',
                          ledgerDraftById[tx.id] ? 'has-draft' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <td>
                          {activeLedgerRowId === tx.id ? (
                            <input className="form-control form-control-sm accumul8-month-table-input" type="date" value={ledgerDraftById[tx.id]?.transaction_date ?? tx.transaction_date} onChange={(e) => setLedgerRowDraft(tx, { transaction_date: e.target.value })} disabled={busy} />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineDate(tx.transaction_date)}</button>
                          )}
                        </td>
                        <td>
                          {activeLedgerRowId === tx.id ? (
                            <input className="form-control form-control-sm accumul8-month-table-input" type="date" value={ledgerDraftById[tx.id]?.due_date ?? tx.due_date ?? ''} onChange={(e) => setLedgerRowDraft(tx, { due_date: e.target.value })} disabled={busy} />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineDate(tx.due_date)}</button>
                          )}
                        </td>
                        <td>
                          {activeLedgerRowId === tx.id ? (
                            <input className="form-control form-control-sm accumul8-month-table-input" value={ledgerDraftById[tx.id]?.description ?? tx.description} onChange={(e) => setLedgerRowDraft(tx, { description: e.target.value })} disabled={busy} />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{tx.account_name ? `${tx.description} (${tx.account_name})` : tx.description}</button>
                          )}
                        </td>
                        <td>{tx.debtor_name || '-'}</td>
                        <td>
                          {activeLedgerRowId === tx.id ? (
                            <input className="form-control form-control-sm accumul8-month-table-input" value={ledgerDraftById[tx.id]?.memo ?? tx.memo} onChange={(e) => setLedgerRowDraft(tx, { memo: e.target.value })} disabled={busy} />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineText(tx.memo || tx.contact_name, '-')}</button>
                          )}
                        </td>
                        <td className="text-end">
                          {activeLedgerRowId === tx.id ? (
                            <input className="form-control form-control-sm accumul8-month-table-input" type="number" step="0.01" value={ledgerDraftById[tx.id]?.amount ?? tx.amount} onChange={(e) => setLedgerRowDraft(tx, { amount: Number(e.target.value) })} disabled={busy} />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{tx.amount.toFixed(2)}</button>
                          )}
                        </td>
                        <td className="text-end">{tx.running_balance.toFixed(2)}</td>
                        <td>
                          {activeLedgerRowId === tx.id ? (
                            <select className="form-select form-select-sm accumul8-month-table-select" value={String(ledgerDraftById[tx.id]?.is_paid ?? tx.is_paid)} onChange={(e) => setLedgerRowDraft(tx, { is_paid: Number(e.target.value) })} disabled={busy}>
                              <option value="0">No</option>
                              <option value="1">Yes</option>
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{tx.is_paid ? 'Yes' : 'No'}</button>
                          )}
                        </td>
                        <td>
                          {activeLedgerRowId === tx.id ? (
                            <select className="form-select form-select-sm accumul8-month-table-select" value={String(ledgerDraftById[tx.id]?.is_reconciled ?? tx.is_reconciled)} onChange={(e) => setLedgerRowDraft(tx, { is_reconciled: Number(e.target.value) })} disabled={busy}>
                              <option value="0">No</option>
                              <option value="1">Yes</option>
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{tx.is_reconciled ? 'Yes' : 'No'}</button>
                          )}
                        </td>
                        <td>
                          {activeLedgerRowId === tx.id ? (
                            <select className="form-select form-select-sm accumul8-month-table-select" value={String(ledgerDraftById[tx.id]?.is_budget_planner ?? tx.is_budget_planner)} onChange={(e) => setLedgerRowDraft(tx, { is_budget_planner: Number(e.target.value) })} disabled={busy || tx.source_kind === 'plaid' || Number(tx.debtor_id || 0) > 0}>
                              <option value="1">Included</option>
                              <option value="0">Excluded</option>
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{tx.is_budget_planner ? 'Included' : 'Excluded'}</button>
                          )}
                        </td>
                        <td className="text-end is-compact-actions">
                          <div className="accumul8-row-actions accumul8-row-actions--always-on">
                            <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => void saveLedgerRow(tx)} disabled={busy || !ledgerDraftById[tx.id]} aria-label={`Save ${tx.description}`} title={`Save ${tx.description}`}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button>
                            <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => handleDeleteTransaction(tx.id, tx.description)} disabled={busy} aria-label={`Delete ${tx.description}`}><i className="bi bi-trash"></i></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'spreadsheet' && (
            <div className="accumul8-panel">
              <Accumul8SpreadsheetView
                busy={busy}
                selectedMonth={budgetMonth}
                recurringPayments={budgetPlannerRecurringPayments}
                contacts={contacts}
                accounts={visibleAccounts}
                onSelectedMonthChange={setBudgetMonth}
                onCreateContact={createContact}
                onUpdateRecurring={updateRecurring}
                onDeleteRecurring={handleDeleteRecurring}
              />
            </div>
          )}
          {tab === 'debtors' && (
            <div className="accumul8-panel">
              <div className="accumul8-panel-toolbar mb-3">
                <h3 className="mb-0">Personal Balances</h3>
                <button type="button" className="btn btn-success btn-sm" onClick={openCreateDebtorModal} disabled={busy}>Add Person</button>
              </div>
              <div className="table-responsive mt-3 accumul8-scroll-area accumul8-scroll-area--bills">
                <table className="table table-sm accumul8-sticky-head">
                  <thead><tr><th>Person</th><th>Linked Contact</th><th className="text-end">Charges</th><th className="text-end">Credits</th><th className="text-end">Net Balance</th><th>Last Activity</th><th className="text-end">Actions</th></tr></thead>
                  <tbody>
                    {debtors.map((debtor) => (
                      <tr key={debtor.id} className={['accumul8-list-item', activeDebtorRowId === debtor.id ? 'is-editing' : '', debtorDraftById[debtor.id] ? 'has-draft' : ''].filter(Boolean).join(' ')}>
                        <td>
                          {activeDebtorRowId === debtor.id ? (
                            <input className="form-control form-control-sm accumul8-month-table-input" value={debtorDraftById[debtor.id]?.debtor_name ?? debtor.debtor_name} onChange={(e) => setDebtorRowDraft(debtor, { debtor_name: e.target.value })} disabled={busy} />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateDebtorRow(debtor.id)} disabled={busy}>{debtor.debtor_name}</button>
                          )}
                        </td>
                        <td>
                          {activeDebtorRowId === debtor.id ? (
                            <select
                              className="form-select form-select-sm accumul8-month-table-select"
                              value={String(debtorDraftById[debtor.id]?.contact_id ?? debtor.contact_id ?? '')}
                              onChange={(e) => {
                                const nextContactId = e.target.value === '' ? null : Number(e.target.value);
                                const nextContact = contacts.find((contact) => contact.id === nextContactId) || null;
                                setDebtorRowDraft(debtor, {
                                  contact_id: nextContactId,
                                  contact_name: nextContact?.contact_name || '',
                                });
                              }}
                              disabled={busy}
                            >
                              <option value="">None</option>
                              {contacts.map((contact) => (
                                <option key={contact.id} value={contact.id}>{contact.contact_name}</option>
                              ))}
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateDebtorRow(debtor.id)} disabled={busy}>{formatInlineText(debtor.contact_name, '-')}</button>
                          )}
                        </td>
                        <td className="text-end">{Number(debtor.total_loaned || 0).toFixed(2)}</td>
                        <td className="text-end">{Number(debtor.total_repaid || 0).toFixed(2)}</td>
                        <td className="text-end fw-bold">{Number(debtor.outstanding_balance || 0).toFixed(2)}</td>
                        <td>
                          {activeDebtorRowId === debtor.id ? (
                            <input className="form-control form-control-sm accumul8-month-table-input" value={debtorDraftById[debtor.id]?.notes ?? debtor.notes ?? ''} onChange={(e) => setDebtorRowDraft(debtor, { notes: e.target.value })} disabled={busy} placeholder="Notes" />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateDebtorRow(debtor.id)} disabled={busy}>{formatInlineText(debtor.last_activity_date, '-')}</button>
                          )}
                        </td>
                        <td className="text-end is-compact-actions">
                          <div className="accumul8-row-actions accumul8-row-actions--always-on">
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedDebtorId(String(debtor.id))}>View Ledger</button>
                            <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => void saveDebtorRow(debtor)} disabled={busy || !debtorDraftById[debtor.id]} aria-label={`Save ${debtor.debtor_name}`} title={`Save ${debtor.debtor_name}`}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button>
                            <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => { if (window.confirm('Delete this debtor? Linked ledger rows will remain but be unassigned.')) { void deleteDebtor(debtor.id); if (selectedDebtorId === String(debtor.id)) setSelectedDebtorId(''); } }} disabled={busy} aria-label={`Delete ${debtor.debtor_name}`}><i className="bi bi-trash"></i></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="accumul8-panel mt-3">
                <div className="d-flex justify-content-between align-items-center gap-2 mb-2 flex-wrap">
                  <h4 className="h6 mb-0">Balance Ledger</h4>
                  <div className="d-flex gap-2">
                    <select className="form-select form-select-sm" value={selectedDebtorId} onChange={(e) => setSelectedDebtorId(e.target.value)}>
                      <option value="">All People</option>
                      {debtors.map((debtor) => <option key={debtor.id} value={debtor.id}>{debtor.debtor_name}</option>)}
                    </select>
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openCreateTransactionModal({ debtorId: selectedDebtorId })} disabled={busy}>Add Charge / Credit</button>
                  </div>
                </div>
                <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--ledger">
                  <table className="table table-sm accumul8-sticky-head">
                    <thead><tr><th>Date</th><th>Person</th><th>Description</th><th>Memo</th><th className="text-end">Amount</th><th className="text-end">Running Balance</th><th className="text-end">Actions</th></tr></thead>
                    <tbody>
                      {selectedDebtorEntries.map((tx) => (
                        <tr
                          key={tx.id}
                          className={[
                            'accumul8-list-item',
                            tx.amount < 0 ? 'is-outflow' : 'is-inflow',
                            activeLedgerRowId === tx.id ? 'is-editing' : '',
                            ledgerDraftById[tx.id] ? 'has-draft' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          <td>
                            {activeLedgerRowId === tx.id ? (
                              <input
                                className="form-control form-control-sm accumul8-month-table-input"
                                type="date"
                                value={ledgerDraftById[tx.id]?.transaction_date ?? tx.transaction_date}
                                onChange={(e) => setLedgerRowDraft(tx, { transaction_date: e.target.value })}
                                disabled={busy}
                              />
                            ) : (
                              <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineDate(tx.transaction_date)}</button>
                            )}
                          </td>
                          <td>
                            {activeLedgerRowId === tx.id ? (
                              <select
                                className="form-select form-select-sm accumul8-month-table-select"
                                value={String(ledgerDraftById[tx.id]?.debtor_id ?? tx.debtor_id ?? '')}
                                onChange={(e) => {
                                  const nextDebtorId = e.target.value === '' ? null : Number(e.target.value);
                                  const nextDebtor = debtors.find((debtor) => debtor.id === nextDebtorId) || null;
                                  setLedgerRowDraft(tx, {
                                    debtor_id: nextDebtorId,
                                    debtor_name: nextDebtor?.debtor_name || '',
                                  });
                                }}
                                disabled={busy}
                              >
                                <option value="">Unassigned</option>
                                {debtors.map((debtor) => (
                                  <option key={debtor.id} value={debtor.id}>{debtor.debtor_name}</option>
                                ))}
                              </select>
                            ) : (
                              <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineText(tx.debtor_name, '-')}</button>
                            )}
                          </td>
                          <td>
                            {activeLedgerRowId === tx.id ? (
                              <input
                                className="form-control form-control-sm accumul8-month-table-input"
                                value={ledgerDraftById[tx.id]?.description ?? tx.description}
                                onChange={(e) => setLedgerRowDraft(tx, { description: e.target.value })}
                                disabled={busy}
                              />
                            ) : (
                              <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineText(tx.description, '-')}</button>
                            )}
                          </td>
                          <td>
                            {activeLedgerRowId === tx.id ? (
                              <input
                                className="form-control form-control-sm accumul8-month-table-input"
                                value={ledgerDraftById[tx.id]?.memo ?? tx.memo ?? ''}
                                onChange={(e) => setLedgerRowDraft(tx, { memo: e.target.value })}
                                disabled={busy}
                              />
                            ) : (
                              <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineText(tx.memo, '-')}</button>
                            )}
                          </td>
                          <td className="text-end">
                            {activeLedgerRowId === tx.id ? (
                              <input
                                className="form-control form-control-sm accumul8-month-table-input"
                                type="number"
                                step="0.01"
                                value={ledgerDraftById[tx.id]?.amount ?? tx.amount}
                                onChange={(e) => setLedgerRowDraft(tx, { amount: Number(e.target.value) })}
                                disabled={busy}
                              />
                            ) : (
                              <button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{Number(tx.amount || 0).toFixed(2)}</button>
                            )}
                          </td>
                          <td className="text-end">{Number(tx.running_balance || 0).toFixed(2)}</td>
                          <td className="text-end is-compact-actions">
                            <div className="accumul8-row-actions accumul8-row-actions--always-on">
                              <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => void saveLedgerRow(tx)} disabled={busy || !ledgerDraftById[tx.id]} aria-label={`Save ${tx.description}`} title={`Save ${tx.description}`}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button>
                              <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => handleDeleteTransaction(tx.id, tx.description)} disabled={busy} aria-label={`Delete ${tx.description}`}><i className="bi bi-trash"></i></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {tab === 'pay_bills' && (
            <div className="accumul8-panel">
              <div className="accumul8-panel-toolbar mb-3">
                <h3 className="mb-0">Pay Bills Queue</h3>
              </div>
              <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--bills mb-4">
                <table className="table table-striped table-sm accumul8-sticky-head">
                  <thead><tr><th>Next Due</th><th>Recurring Payment</th><th>Payment Method</th><th className="text-end">Amount</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
                  <tbody>
                    {upcomingRecurringPayBills.map((bill) => {
                      const contactLabel = formatInlineText(bill.contact_name);
                      const accountLabel = formatInlineText(bill.account_name);
                      const recurringStatus = bill.next_due_date < todayDate ? 'Past due' : 'Upcoming';
                      return (
                        <tr key={`recurring-${bill.id}`} className="accumul8-list-item">
                          <td>{bill.next_due_date}</td>
                          <td>
                            <div className="fw-semibold">{formatInlineText(bill.title, 'Untitled recurring payment')}</div>
                            <div className="small text-muted">{contactLabel} • {accountLabel}</div>
                          </td>
                          <td>{RECURRING_PAYMENT_METHOD_LABELS[bill.payment_method] || 'Unspecified'}</td>
                          <td className="text-end">{Math.abs(Number(bill.amount || 0)).toFixed(2)}</td>
                          <td>{recurringStatus}</td>
                          <td className="text-end">
                            <div className="accumul8-row-actions">
                              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => beginEditRecurring(bill.id)} disabled={busy} aria-label={`Edit recurring payment ${bill.title || bill.contact_name || bill.id}`} title={`Edit recurring payment ${bill.title || bill.contact_name || bill.id}`}><span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span></button>
                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteRecurring(bill.id, bill.title || bill.contact_name)} disabled={busy} aria-label={`Delete recurring payment ${bill.title || bill.contact_name || bill.id}`}><i className="bi bi-trash"></i></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {upcomingRecurringPayBills.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">No active recurring payments with a next due date.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--bills">
                <table className="table table-striped table-sm accumul8-sticky-head">
                  <thead><tr><th>Due Date</th><th>Paid Date</th><th>Description</th><th className="text-end">Amount</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
                  <tbody>
                    {payBillRows.map((billTx) => (
                      <tr key={billTx.id} className={['accumul8-list-item', activePayBillRowId === billTx.id ? 'is-editing' : '', payBillDraftById[billTx.id] ? 'has-draft' : ''].filter(Boolean).join(' ')}>
                        <td>
                          {activePayBillRowId === billTx.id ? (
                            <input
                              className="form-control form-control-sm accumul8-month-table-input"
                              type="date"
                              value={payBillDraftById[billTx.id]?.due_date ?? billTx.due_date ?? billTx.transaction_date}
                              onChange={(e) => setPayBillRowDraft(billTx, { due_date: e.target.value })}
                              disabled={busy}
                            />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activatePayBillRow(billTx.id)} disabled={busy}>{formatInlineDate(billTx.due_date || billTx.transaction_date)}</button>
                          )}
                        </td>
                        <td>
                          {activePayBillRowId === billTx.id ? (
                            <input
                              className="form-control form-control-sm accumul8-month-table-input"
                              type="date"
                              value={payBillDraftById[billTx.id]?.transaction_date ?? billTx.transaction_date}
                              onChange={(e) => setPayBillRowDraft(billTx, { transaction_date: e.target.value })}
                              disabled={busy}
                            />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activatePayBillRow(billTx.id)} disabled={busy}>{formatInlineDate(billTx.transaction_date)}</button>
                          )}
                        </td>
                        <td>
                          {activePayBillRowId === billTx.id ? (
                            <input
                              className="form-control form-control-sm accumul8-month-table-input"
                              value={payBillDraftById[billTx.id]?.description ?? billTx.description}
                              onChange={(e) => setPayBillRowDraft(billTx, { description: e.target.value })}
                              disabled={busy}
                            />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activatePayBillRow(billTx.id)} disabled={busy}>{formatInlineText(billTx.description, '-')}</button>
                          )}
                        </td>
                        <td className="text-end">
                          {activePayBillRowId === billTx.id ? (
                            <input
                              className="form-control form-control-sm accumul8-month-table-input"
                              type="number"
                              step="0.01"
                              value={payBillDraftById[billTx.id]?.amount ?? billTx.amount}
                              onChange={(e) => setPayBillRowDraft(billTx, { amount: Number(e.target.value) })}
                              disabled={busy}
                            />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => activatePayBillRow(billTx.id)} disabled={busy}>{Number(billTx.amount || 0).toFixed(2)}</button>
                          )}
                        </td>
                        <td>
                          {activePayBillRowId === billTx.id ? (
                            <select
                              className="form-select form-select-sm accumul8-month-table-select"
                              value={String(payBillDraftById[billTx.id]?.is_paid ?? billTx.is_paid)}
                              onChange={(e) => setPayBillRowDraft(billTx, { is_paid: Number(e.target.value) })}
                              disabled={busy}
                            >
                              <option value="0">Upcoming</option>
                              <option value="1">Paid</option>
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activatePayBillRow(billTx.id)} disabled={busy}>{Number(billTx.is_paid || 0) === 1 ? 'Paid' : ((billTx.due_date || billTx.transaction_date) < todayDate ? 'Past due' : 'Upcoming')}</button>
                          )}
                        </td>
                        <td className="text-end">
                          <div className="accumul8-row-actions">
                            <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => void savePayBillRow(billTx)} disabled={busy || !payBillDraftById[billTx.id]} aria-label={`Save ${billTx.description}`} title={`Save ${billTx.description}`}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => { if (window.confirm('Delete this bill item?')) { void deleteTransaction(billTx.id); } }} disabled={busy} aria-label={`Delete ${billTx.description}`}><i className="bi bi-trash"></i></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {payBillRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">No unpaid upcoming or past-due bills.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'contacts' && (
            <div className="accumul8-panel">
              <div className="accumul8-panel-toolbar mb-3">
                <h3 className="mb-0">Manage Payees and Payers</h3>
                <button type="button" className="btn btn-success btn-sm" onClick={openCreateContactModal} disabled={busy}>Add Payee / Payer</button>
              </div>
              <ul className="list-group mt-3 accumul8-scroll-area accumul8-scroll-area--list">
                {contacts.map((c) => (
                  <li key={c.id} className="list-group-item d-flex justify-content-between align-items-start gap-3 accumul8-list-item">
                    <div className="accumul8-contact-card-copy">
                      <div className="fw-semibold">
                        {c.contact_name} <small className="text-muted">({c.contact_type})</small>
                      </div>
                      <div className="small text-muted">
                        {[
                          c.phone_number || '',
                          c.email || '',
                          [c.city || '', c.state || '', c.zip || ''].filter(Boolean).join(', ').replace(/, ([^,]+)$/, ' $1'),
                        ].filter(Boolean).join(' | ') || 'No phone, email, or city/state/zip yet.'}
                      </div>
                      {c.street_address ? <div className="small text-muted">{c.street_address}</div> : null}
                      {Number(c.default_amount || 0) !== 0 ? <div className="small text-muted">Default amount: {Number(c.default_amount || 0).toFixed(2)}</div> : null}
                      {c.notes ? <div className="small text-muted">{c.notes}</div> : null}
                    </div>
                    <div className="accumul8-row-actions">
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => beginEditContact(c.id)} disabled={busy} aria-label={`Edit ${c.contact_name}`}><i className="bi bi-pencil"></i></button>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => { if (window.confirm('Delete this payee/payer?')) { void deleteContact(c.id); } }} disabled={busy} aria-label={`Delete ${c.contact_name}`}><i className="bi bi-trash"></i></button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tab === 'recurring' && (
            <div className="accumul8-panel">
              <div className="accumul8-panel-toolbar mb-3">
                <h3 className="mb-0">Recurring Payments</h3>
                <button type="button" className="btn btn-success btn-sm" onClick={openCreateRecurringModal} disabled={busy}>Add Recurring Payment</button>
              </div>
              <div className="table-responsive mt-3 accumul8-scroll-area accumul8-scroll-area--recurring">
                <table className="table table-sm accumul8-sticky-head">
                  <thead><tr><th>Title</th><th>Next Due</th><th className="text-end">Amount</th><th>Frequency</th><th>Payment Method</th><th>Planner</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
                  <tbody>
                    {filteredRecurringPayments.map((rp) => (
                      <tr key={rp.id} className="accumul8-list-item">
                        <td>{formatInlineText(rp.title, 'Untitled recurring payment')}</td>
                        <td>{formatInlineDate(rp.next_due_date)}</td>
                        <td className="text-end">{Number(rp.amount || 0).toFixed(2)}</td>
                        <td>{formatInlineText(rp.frequency)}</td>
                        <td>{RECURRING_PAYMENT_METHOD_LABELS[(rp.payment_method || 'unspecified') as Accumul8PaymentMethod]}</td>
                        <td>{rp.is_budget_planner ? 'Shown' : 'Hidden'}</td>
                        <td>{rp.is_active ? 'Active' : 'Paused'}</td>
                        <td className="text-end is-compact-actions">
                          <div className="accumul8-row-actions accumul8-row-actions--always-on">
                            <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => beginEditRecurring(rp.id)} disabled={busy} aria-label={`Edit ${rp.title}`} title={`Edit ${rp.title}`}><span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span></button>
                            <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => { if (window.confirm('Delete this recurring payment?')) { void deleteRecurring(rp.id); } }} disabled={busy} aria-label={`Delete ${rp.title}`}><i className="bi bi-trash"></i></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'notifications' && (
            <div className="accumul8-panel">
              <h3>Notification Rules</h3>
              <form className="row g-2" onSubmit={(e) => {
                e.preventDefault();
                const payload = {
                  ...notificationForm,
                  days_before_due: Number(notificationForm.days_before_due),
                  custom_user_ids: parseCustomUserIds(notificationForm.custom_user_ids),
                };
                if (editingNotificationRuleId) {
                  void updateNotificationRule(editingNotificationRuleId, payload).then(() => resetNotificationForm());
                  return;
                }
                void createNotificationRule(payload).then(() => resetNotificationForm());
              }}>
                <div className="col-md-3"><input className="form-control" placeholder="Rule Name" value={notificationForm.rule_name} onChange={(e) => setNotificationForm((v) => ({ ...v, rule_name: e.target.value }))} required /></div>
                <div className="col-md-2"><select className="form-select" value={notificationForm.target_scope} onChange={(e) => setNotificationForm((v) => ({ ...v, target_scope: e.target.value as 'group' | 'custom' }))}><option value="group">Accumul8 Users + Admins</option><option value="custom">Custom user IDs</option></select></div>
                <div className="col-md-1"><input className="form-control" type="number" min={0} max={90} value={notificationForm.days_before_due} onChange={(e) => setNotificationForm((v) => ({ ...v, days_before_due: Number(e.target.value) }))} /></div>
                <div className="col-md-2"><input className="form-control" placeholder="User IDs (1,2,3)" value={notificationForm.custom_user_ids} onChange={(e) => setNotificationForm((v) => ({ ...v, custom_user_ids: e.target.value }))} /></div>
                <div className="col-md-4"><input className="form-control" placeholder="Email Subject" value={notificationForm.email_subject_template} onChange={(e) => setNotificationForm((v) => ({ ...v, email_subject_template: e.target.value }))} required /></div>
                <div className="col-md-10"><textarea className="form-control" rows={2} placeholder="Email Body" value={notificationForm.email_body_template} onChange={(e) => setNotificationForm((v) => ({ ...v, email_body_template: e.target.value }))} required /></div>
                <div className="col-md-2 d-grid">
                  <button
                    className="btn btn-success"
                    type="submit"
                    disabled={busy}
                    aria-label={editingNotificationRuleId ? 'Save notification rule' : 'Create notification rule'}
                    title={editingNotificationRuleId ? 'Save notification rule' : 'Create notification rule'}
                  >
                    <span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span>
                  </button>
                </div>
                {editingNotificationRuleId ? <div className="col-md-2 d-grid"><button className="btn btn-outline-secondary" type="button" onClick={resetNotificationForm} disabled={busy}>Cancel</button></div> : null}
              </form>
              <div className="mt-3 d-flex flex-column gap-2 accumul8-scroll-area accumul8-scroll-area--cards">
                {notificationRules.map((r) => (
                  <div key={r.id} className="catn8-card p-2 d-flex justify-content-between align-items-center gap-2 accumul8-list-item">
                    <div>
                      <div className="fw-bold">{r.rule_name}</div>
                      <div className="text-muted small">{r.target_scope === 'group' ? 'Group recipients' : 'Custom recipients'} | {r.days_before_due} day lead</div>
                    </div>
                    <div className="d-flex gap-2">
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void sendNotification({ rule_id: r.id })} disabled={busy}>Send Now</button>
                      <button type="button" className={`btn btn-sm ${r.is_active ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => void toggleNotificationRule(r.id)}>{r.is_active ? 'Active' : 'Paused'}</button>
                      <div className="accumul8-row-actions">
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => beginEditNotificationRule(r.id)} disabled={busy} aria-label={`Edit ${r.rule_name}`}><i className="bi bi-pencil"></i></button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => { if (window.confirm('Delete this notification rule?')) { void deleteNotificationRule(r.id); } }} disabled={busy} aria-label={`Delete ${r.rule_name}`}><i className="bi bi-trash"></i></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === 'sync' && (
            <div className="accumul8-panel">
              <h3>Bank Sync Groundwork</h3>
              <p className="mb-2">Provider: <strong>{syncProvider.provider}</strong> ({syncProvider.env}). Configuration status: <strong>{syncProvider.configured ? 'Configured' : 'Missing API keys'}</strong>.</p>
              <div className="d-flex gap-2 flex-wrap mb-3">
                <button type="button" className="btn btn-outline-primary" onClick={() => void runPlaidLink()} disabled={busy || !syncProvider.configured}>Connect Bank via Plaid</button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => openSyncHelp()}>Show Setup Guide</button>
              </div>
              <h4 className="h6">Connected Institutions</h4>
              <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--sync">
                <table className="table table-sm accumul8-sticky-head">
                  <thead><tr><th>Institution</th><th>Status</th><th>Last Sync</th><th></th></tr></thead>
                  <tbody>
                    {bankConnections.map((c: any) => (
                      <tr key={c.id}>
                        <td>{c.institution_name || c.institution_id || 'Unknown'}</td>
                        <td>{c.status}</td>
                        <td>{c.last_sync_at || '-'}</td>
                        <td className="text-end"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void syncBankConnection(Number(c.id || 0))} disabled={busy}>Sync</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small text-muted mb-0">Target institutions include Capital One, Navy Federal Credit Union, Barclays, Fifth Third, and Truist via the Plaid institution network.</p>
            </div>
          )}
          {syncHelpOpen && (
            <div className="accumul8-help-overlay" role="dialog" aria-modal="true" aria-label="Plaid setup guide">
              <div className="accumul8-help-modal">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h4 className="h6 mb-0">Plaid Sync Setup Guide</h4>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSyncHelpOpen(false)}>Close</button>
                </div>
                {syncHelpError ? <div className="alert alert-warning py-2"><strong>Current error:</strong> {syncHelpError}</div> : null}
                {syncHelpToken ? <div className="alert alert-success py-2"><strong>Link token generated:</strong> <code>{syncHelpToken.slice(0, 40)}...</code></div> : null}
                <ol className="mb-2 ps-3">
                  <li>Create/get your Plaid credentials in <a href="https://dashboard.plaid.com/team/keys" target="_blank" rel="noreferrer">Plaid Dashboard Keys</a>.</li>
                  <li>Set `accumul8.plaid.client_id`, `accumul8.plaid.secret`, and optional `accumul8.plaid.env` in your server secret store.</li>
                  <li>Click <strong>Connect Bank via Plaid</strong> in this tab.</li>
                  <li>Complete Plaid Link and authorize your institution.</li>
                  <li>Accumul8 will automatically exchange token, save the connection, and sync transactions.</li>
                </ol>
                <div className="small">
                  Quick references: <a href="https://plaid.com/docs/quickstart/" target="_blank" rel="noreferrer">Plaid Quickstart</a> | <a href="https://plaid.com/docs/api/items/#itempublic_tokenexchange" target="_blank" rel="noreferrer">Public Token Exchange API</a>
                </div>
              </div>
            </div>
          )}
          <Accumul8ContactModal
            open={contactModalOpen}
            busy={busy}
            initialForm={contactForm}
            editing={editingContactId !== null}
            onClose={closeContactModal}
            onSave={submitContactForm}
          />
        <Accumul8DebtorModal
            open={debtorModalOpen}
            busy={busy}
            initialForm={debtorForm}
            editing={false}
            contacts={contacts}
            onClose={closeDebtorModal}
            onSave={submitDebtorModal}
        />
        <Accumul8RecurringModal
          open={recurringModalOpen}
          busy={busy}
          initialForm={editingRecurringForm}
          contacts={contacts}
          accounts={visibleAccounts}
          onClose={closeRecurringModal}
          onSave={submitRecurringModal}
        />
        <Accumul8TransactionModal
            open={transactionModalOpen}
            busy={busy}
            initialForm={ledgerForm}
            editing={false}
            contacts={contacts}
            accounts={visibleAccounts}
            debtors={debtors}
            onClose={closeTransactionModal}
            onSave={submitTransactionModal}
          />
          <BankingOrganizationManagerModal
            open={bankingOrganizationManagerOpen}
            onClose={() => setBankingOrganizationManagerOpen(false)}
            mode="banking_organization"
            busy={busy}
            bankingOrganizations={bankingOrganizations}
            accounts={accounts}
            createBankingOrganization={createBankingOrganization}
            updateBankingOrganization={updateBankingOrganization}
            deleteBankingOrganization={deleteBankingOrganization}
            createAccount={createAccount}
            updateAccount={updateAccount}
            deleteAccount={deleteAccount}
          />
          <BankingOrganizationManagerModal
            open={accountManagerOpen}
            onClose={() => setAccountManagerOpen(false)}
            mode="account"
            busy={busy}
            bankingOrganizations={bankingOrganizations}
            accounts={accounts}
            createBankingOrganization={createBankingOrganization}
            updateBankingOrganization={updateBankingOrganization}
            deleteBankingOrganization={deleteBankingOrganization}
            createAccount={createAccount}
            updateAccount={updateAccount}
            deleteAccount={deleteAccount}
          />
          {!loaded && <div className="text-muted mt-2">Loading Accumul8...</div>}
        </div>
      </section>
    </PageLayout>
  );
}

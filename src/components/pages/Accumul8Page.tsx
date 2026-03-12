import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { Accumul8StatementsPanel } from '../accumul8/Accumul8StatementsPanel';
import { BankingOrganizationManagerModal } from '../modals/BankingOrganizationManagerModal';
import { Accumul8ContactModal } from '../modals/Accumul8ContactModal';
import { Accumul8DebtorModal } from '../modals/Accumul8DebtorModal';
import { Accumul8EntityModal } from '../modals/Accumul8EntityModal';
import { Accumul8RecurringModal } from '../modals/Accumul8RecurringModal';
import { Accumul8EntityAliasEditor } from '../accumul8/Accumul8EntityAliasEditor';
import { Accumul8SpreadsheetView } from '../accumul8/Accumul8SpreadsheetView';
import { Accumul8TableHeaderCell } from '../accumul8/Accumul8TableHeaderCell';
import { Accumul8TransactionModal } from '../modals/Accumul8TransactionModal';
import {
  ACCUMUL8_EDIT_BUTTON_EMOJI,
  ACCUMUL8_SAVE_BUTTON_EMOJI,
  ACCUMUL8_STATEMENT_BUTTON_EMOJI,
  ACCUMUL8_VIEW_BUTTON_EMOJI,
} from '../accumul8/accumul8Ui';
import { WebpImage } from '../common/WebpImage';
import { StandardIconButton } from '../common/StandardIconButton';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { useAccumul8 } from '../../hooks/useAccumul8';
import { PriorityTableColumn, usePriorityTableLayout } from '../../hooks/usePriorityTableLayout';
import { ApiClient } from '../../core/ApiClient';
import { openTellerConnect } from '../../core/tellerConnect';
import { resolveAccumul8StatementLink } from '../../utils/accumul8StatementLink';
import { resolveAccumul8BankingOrganizationIconPath } from '../../utils/accumul8BankingOrganizationBranding';
import { getAccumul8TransactionEditPolicy } from '../../utils/accumul8TransactionPolicy';
import {
  Accumul8TellerConnectTokenResponse,
  Accumul8TellerEnrollmentResponse,
  Accumul8TellerSyncResponse,
  Accumul8TellerSyncAccountSummary,
  Accumul8Account,
  Accumul8ContactType,
  Accumul8Direction,
  Accumul8EntryType,
  Accumul8Frequency,
  Accumul8PaymentMethod,
  Accumul8RecurringPayment,
  Accumul8Transaction,
  Accumul8Debtor,
  Accumul8Entity,
  Accumul8EntityAliasDraft,
  Accumul8EntityEndexGuide,
  Accumul8EntityUpsertRequest,
} from '../../types/accumul8';
import './Accumul8Page.css';
interface Accumul8PageProps extends AppShellPageProps {
  onToast?: (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}
type TabKey = 'ledger' | 'spreadsheet' | 'debtors' | 'pay_bills' | 'contacts' | 'entity_endex' | 'recurring' | 'notifications' | 'sync' | 'statements';
type SearchableListTabKey = 'ledger' | 'debtors' | 'pay_bills' | 'contacts' | 'recurring';
type LedgerFilterPreset =
  | 'all'
  | 'hide_upcoming_recurring'
  | 'hide_reconciled'
  | 'hide_paid'
  | 'hide_pending_bank'
  | 'show_late_payments'
  | 'show_paid_not_reconciled'
  | 'show_reconciled_not_paid'
  | 'show_unpaid_only'
  | 'show_upcoming_unpaid';
type Accumul8HeaderSummary = {
  currentBalance: number;
  projectedBalance: number;
  unpaidBills: number;
  upcomingWindfalls: number;
};
type Accumul8SyncReport = {
  connectionId: number;
  institutionName: string;
  syncedAt: string;
  result: Accumul8TellerSyncResponse;
};
const ACCUMUL8_OWNER_STORAGE_KEY = 'accumul8.selected_owner_user_id';
const RECURRING_PAYMENT_METHOD_LABELS: Record<Accumul8PaymentMethod, string> = {
  unspecified: 'Unspecified',
  autopay: 'Auto debit / autopay',
  manual: 'Manual payment',
};
const LEDGER_FILTER_PRESET_OPTIONS: Array<{ value: LedgerFilterPreset; label: string }> = [
  { value: 'all', label: 'All transactions' },
  { value: 'hide_upcoming_recurring', label: 'Hide upcoming recurring payments' },
  { value: 'hide_reconciled', label: 'Hide reconciled transactions' },
  { value: 'hide_paid', label: 'Hide paid transactions' },
  { value: 'hide_pending_bank', label: 'Hide pending bank transactions' },
  { value: 'show_late_payments', label: 'Show late payments' },
  { value: 'show_paid_not_reconciled', label: 'Show paid, not reconciled' },
  { value: 'show_reconciled_not_paid', label: 'Show reconciled, not paid' },
  { value: 'show_unpaid_only', label: 'Show unpaid only' },
  { value: 'show_upcoming_unpaid', label: 'Show upcoming unpaid' },
];
type RecurringFormState = {
  title: string;
  direction: Accumul8Direction;
  amount: number;
  frequency: Accumul8Frequency;
  payment_method: Accumul8PaymentMethod;
  interval_count: number;
  next_due_date: string;
  entity_id: string;
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
  paid_date: string;
  entry_type: Accumul8EntryType;
  description: string;
  memo: string;
  amount: number;
  rta_amount: number;
  is_paid: number;
  is_reconciled: number;
  is_budget_planner: number;
  entity_id: string;
  account_id: string;
  balance_entity_id: string;
};
type LedgerInlineDraft = Partial<Pick<Accumul8Transaction, 'transaction_date' | 'due_date' | 'paid_date' | 'description' | 'memo' | 'amount' | 'rta_amount' | 'is_paid' | 'is_reconciled' | 'is_budget_planner' | 'entity_id' | 'entity_name' | 'account_id' | 'balance_entity_id' | 'balance_entity_name'>>;
type DebtorInlineDraft = Partial<Pick<Accumul8Debtor, 'debtor_name' | 'contact_id' | 'contact_name' | 'notes' | 'is_active'>>;
type EntityInlineDraft = Partial<Pick<Accumul8Entity, 'display_name' | 'notes' | 'entity_kind' | 'contact_type' | 'is_vendor' | 'phone_number' | 'email' | 'street_address' | 'city' | 'state' | 'zip' | 'default_amount' | 'is_active'>>;
type RecurringInlineDraft = Partial<Pick<Accumul8RecurringPayment, 'title' | 'next_due_date' | 'amount' | 'frequency' | 'payment_method' | 'is_budget_planner' | 'is_active' | 'notes' | 'account_id'>>;
type EntityFormState = {
  display_name: string;
  entity_kind: string;
  contact_type: Accumul8ContactType;
  is_vendor: number;
  default_amount: number;
  email: string;
  phone_number: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  is_active: number;
};
type DateRangeFilter = 'all_dates' | '7_days' | '30_days' | '60_days' | '90_days' | 'eoy' | 'custom';
type LedgerPaginationMode = '100' | 'all';
const DEFAULT_CONTACT_FORM = {
  contact_name: '',
  contact_type: 'payee' as Accumul8ContactType,
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
  entity_id: '',
  account_id: '',
  is_budget_planner: 0,
  notes: '',
};
const DEFAULT_ENTITY_FORM: EntityFormState = {
  display_name: '',
  entity_kind: 'business',
  contact_type: 'payee',
  is_vendor: 0,
  default_amount: 0,
  email: '',
  phone_number: '',
  street_address: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
  is_active: 1,
};
const DEFAULT_ENTITY_ALIAS_DRAFT: Accumul8EntityAliasDraft = {
  alias_name: '',
  merge_entity_id: null,
  pending_alias_names: [],
};
const DATE_RANGE_FILTER_OPTIONS: Array<{ value: Exclude<DateRangeFilter, 'all_dates'>; label: string }> = [
  { value: '7_days', label: '7 Days' },
  { value: '30_days', label: '30 Days' },
  { value: '60_days', label: '60 Days' },
  { value: '90_days', label: '90 Days' },
  { value: 'eoy', label: 'EOY' },
  { value: 'custom', label: 'Custom' },
];
function createDefaultDebtorForm(): DebtorFormState {
  return { debtor_name: '', contact_id: '', notes: '', is_active: 1 };
}
function createDefaultLedgerForm(defaults?: { accountId?: string; balanceEntityId?: string }): LedgerFormState {
  return {
    transaction_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    paid_date: '',
    entry_type: 'manual',
    description: '',
    memo: '',
    amount: 0,
    rta_amount: 0,
    is_paid: 0,
    is_reconciled: 0,
    is_budget_planner: defaults?.balanceEntityId ? 0 : 1,
    entity_id: '',
    account_id: defaults?.accountId || '',
    balance_entity_id: defaults?.balanceEntityId || '',
  };
}
function buildRecurringPayload(form: RecurringFormState) {
  return {
    ...form,
    amount: Number(form.amount),
    interval_count: Number(form.interval_count),
    entity_id: form.entity_id ? Number(form.entity_id) : null,
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

function formatAccountOptionLabel(account: Pick<Accumul8Account, 'account_name' | 'account_nickname' | 'banking_organization_name' | 'mask_last4'>): string {
  const primaryName = formatInlineText(account.account_nickname || account.account_name, 'Unnamed account');
  const bankingName = formatInlineText(account.banking_organization_name, '');
  const maskLast4 = formatInlineText(account.mask_last4, '');
  return [primaryName, bankingName, maskLast4 ? `••••${maskLast4}` : ''].filter(Boolean).join(' • ');
}

function getActiveFilterClass(baseClassName: string, isActive: boolean): string {
  return isActive ? `${baseClassName} accumul8-filter-control--active` : baseClassName;
}

function isLaunchableHttpUrl(value: string | null | undefined): boolean {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function getLedgerDescriptionLabel(
  transaction: Pick<Accumul8Transaction, 'description' | 'entity_name'>,
  draft?: Pick<LedgerInlineDraft, 'description' | 'entity_name'>,
): string {
  const preferredEntityName = formatInlineText(draft?.entity_name ?? transaction.entity_name, '');
  const fallbackDescription = draft?.description ?? transaction.description;
  return formatInlineText(preferredEntityName || fallbackDescription, '-');
}

function isOpeningBalanceTransaction(transaction: Accumul8Transaction): boolean {
  const normalizedDescription = String(transaction.description || '').trim().toLowerCase();
  const normalizedMemo = String(transaction.memo || '').trim().toLowerCase();
  return (
    transaction.source_kind === 'statement_pdf'
    && normalizedDescription === 'opening balance'
    && (normalizedMemo === '' || normalizedMemo.includes('opening balance'))
  );
}

function buildLedgerFormFromTransaction(tx: Accumul8Transaction): LedgerFormState {
  return {
    transaction_date: tx.transaction_date || new Date().toISOString().slice(0, 10),
    due_date: tx.due_date || '',
    paid_date: tx.paid_date || '',
    entry_type: (tx.entry_type || 'manual') as Accumul8EntryType,
    description: tx.description || '',
    memo: tx.memo || '',
    amount: Number(tx.amount || 0),
    rta_amount: Number(tx.rta_amount || 0),
    is_paid: Number(tx.is_paid || 0),
    is_reconciled: Number(tx.is_reconciled || 0),
    is_budget_planner: Number(tx.is_budget_planner || 0),
    entity_id: tx.entity_id ? String(tx.entity_id) : '',
    account_id: tx.account_id ? String(tx.account_id) : '',
    balance_entity_id: tx.balance_entity_id ? String(tx.balance_entity_id) : '',
  };
}

function normalizeSearchQuery(value: string): string {
  return value.trim().toLowerCase();
}

function matchesSearchQuery(query: string, fields: Array<string | number | null | undefined>): boolean {
  if (!query) {
    return true;
  }
  return fields.some((field) => String(field || '').toLowerCase().includes(query));
}

function normalizeEntityAliasKey(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function toEntityEndexGuideKey(guide: Pick<Accumul8EntityEndexGuide, 'parent_name'>): string {
  return normalizeEntityAliasKey(guide.parent_name);
}

function normalizeEntityContactType(entity: Pick<Accumul8Entity, 'contact_type' | 'is_payee' | 'is_payer' | 'is_balance_person'>): Accumul8ContactType {
  const raw = String(entity.contact_type || '').trim().toLowerCase();
  if (raw === 'repayment' || Number(entity.is_balance_person || 0) === 1) {
    return 'repayment';
  }
  if (raw === 'payer' || (Number(entity.is_payer || 0) === 1 && Number(entity.is_payee || 0) === 0)) {
    return 'payer';
  }
  return 'payee';
}

function normalizeEntityKind(value: string | null | undefined, isVendor = 0): 'business' | 'contact' {
  return String(value || '').trim().toLowerCase() === 'business' || Number(isVendor || 0) === 1 ? 'business' : 'contact';
}

function formatEntityTypeLabel(contactType: Accumul8ContactType): string {
  if (contactType === 'repayment') {
    return 'Repayment';
  }
  return contactType === 'payer' ? 'Payer' : 'Payee';
}

function formatEntityRoles(entity: Pick<Accumul8Entity, 'contact_type' | 'entity_kind' | 'is_payee' | 'is_payer' | 'is_vendor' | 'is_balance_person'>): string {
  const roles: string[] = [];
  roles.push(formatEntityTypeLabel(normalizeEntityContactType(entity)));
  if (normalizeEntityKind(entity.entity_kind, entity.is_vendor) === 'business') {
    roles.push('Business');
  }
  return roles.join(' • ') || 'Unassigned';
}

function formatEntityContactSummary(entity: Pick<Accumul8Entity, 'phone_number' | 'email' | 'street_address' | 'city' | 'state' | 'zip'>): string[] {
  const lines: string[] = [];
  const primary = [entity.phone_number || '', entity.email || ''].filter(Boolean).join(' | ');
  if (primary) {
    lines.push(primary);
  }
  if (entity.street_address) {
    lines.push(entity.street_address);
  }
  const locality = [entity.city || '', entity.state || '', entity.zip || ''].filter(Boolean).join(', ');
  if (locality) {
    lines.push(locality);
  }
  return lines;
}

function addUtcDays(baseDate: string, days: number): string {
  const parsed = new Date(`${baseDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return baseDate;
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function endOfUtcMonth(baseDate: string): string {
  const parsed = new Date(`${baseDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return baseDate;
  }
  parsed.setUTCMonth(parsed.getUTCMonth() + 1, 0);
  return parsed.toISOString().slice(0, 10);
}

function isDateInRange(value: string, range: { startDate: string; endDate: string }): boolean {
  if (!value) {
    return false;
  }
  if (range.startDate && value < range.startDate) {
    return false;
  }
  if (range.endDate && value > range.endDate) {
    return false;
  }
  return true;
}

function getLedgerEffectiveDate(transaction: Pick<Accumul8Transaction, 'transaction_date' | 'due_date'>): string {
  return String(transaction.due_date || transaction.transaction_date || '');
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function formatCurrencyAmount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

type EntityTransactionSummary = {
  count: number;
  lastAmount: number | null;
  lastDate: string;
};

function formatSyncConnectionStatus(status: string): string {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'connected') return 'Connected';
  if (normalized === 'setup_pending') return 'Setup Pending';
  if (normalized === 'sync_error') return 'Sync Error';
  if (normalized === '') return 'Unknown';
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function isTellerRateLimited(message: string): boolean {
  const normalized = String(message || '').trim().toLowerCase();
  return normalized.includes('too_many_requests')
    || normalized.includes('request rate limit exceeded')
    || normalized.includes('http 429')
    || normalized.includes('status of 429');
}

function formatSyncStatusLabel(status: string, lastError: string): string {
  if (isTellerRateLimited(lastError)) return 'Wait And Retry';
  return formatSyncConnectionStatus(status);
}

function formatSyncStatusMessage(lastError: string): string {
  if (!String(lastError || '').trim()) return '';
  if (isTellerRateLimited(lastError)) {
    return 'Teller asked us to pause before the next sync. Give it a little time, then retry.';
  }
  return String(lastError);
}

function formatAccountMappingLabel(account: Accumul8Account): string {
  const parts = [
    account.account_name || 'Unnamed account',
    account.account_subtype || account.account_type || '',
    account.mask_last4 ? `...${account.mask_last4}` : (account.account_number_mask || ''),
  ].filter(Boolean);
  return parts.join(' | ');
}

function formatSyncSummaryAccountLabel(account: Accumul8TellerSyncAccountSummary): string {
  const parts = [
    account.remote_account_name || 'Unnamed account',
    account.remote_account_subtype || account.remote_account_type || '',
    account.mask_last4 ? `...${account.mask_last4}` : '',
  ].filter(Boolean);
  return parts.join(' | ');
}

function formatTellerCoverageLabel(startDate: string, endDate: string): string {
  if (startDate && endDate) {
    return `${startDate} to ${endDate}`;
  }
  if (endDate) {
    return `through ${endDate}`;
  }
  if (startDate) {
    return `starting ${startDate}`;
  }
  return 'No Teller history saved yet';
}

function formatAccountBackfillNote(account: Accumul8Account): string {
  const coverage = formatTellerCoverageLabel(account.teller_history_start_date, account.teller_history_end_date);
  if (account.teller_backfill_complete) {
    return `Backfill complete. Coverage: ${coverage}.`;
  }
  if (account.teller_backfill_cursor_id || account.teller_history_start_date || account.teller_history_end_date) {
    return `Backfill in progress. Coverage so far: ${coverage}.`;
  }
  if (account.teller_sync_anchor_date) {
    return `Recent sync checkpoint saved at ${account.teller_sync_anchor_date}. Historical backfill starts on the next sync.`;
  }
  return 'Waiting for first Teller sync.';
}

function formatSyncSummaryBackfillNote(account: Accumul8TellerSyncAccountSummary): string {
  const coverage = formatTellerCoverageLabel(account.history_start_date, account.history_end_date);
  if (account.backfill_complete) {
    return `Backfill complete. Coverage: ${coverage}.`;
  }
  if (account.backfill_pages_fetched > 0) {
    return `Backfill in progress. Coverage so far: ${coverage}. Pulled ${account.backfill_pages_fetched} older page${account.backfill_pages_fetched === 1 ? '' : 's'} this sync and will resume next time.`;
  }
  return `Backfill not finished yet. Recent refresh window: ${account.recent_window_start_date} to ${account.recent_window_end_date}. Coverage so far: ${coverage}.`;
}

function formatEntityTransactionSummaryLabel(summary: EntityTransactionSummary): string {
  if (!summary.lastDate) {
    return `${summary.count} tx`;
  }
  const amountLabel = summary.lastAmount === null ? '-' : Number(summary.lastAmount || 0).toFixed(2);
  return `${amountLabel} ${formatInlineDate(summary.lastDate)} ${summary.count} tx`;
}

function formatPayBillStatusLabel(transaction: Pick<Accumul8Transaction, 'is_paid' | 'due_date' | 'transaction_date'>, todayDate: string): string {
  if (Number(transaction.is_paid || 0) === 1) {
    return 'Paid';
  }
  return ((transaction.due_date || transaction.transaction_date) < todayDate) ? 'Past due' : 'Upcoming';
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
    entities,
    entityAliases,
    entityEndexGuides,
    contacts,
    recurringPayments,
    transactions,
    bankingOrganizations,
    accounts,
    notificationRules,
    debtors,
    debtorLedger,
    budgetRows,
    bankConnections,
    statementUploads,
    archivedStatementUploads,
    statementAuditRuns,
    syncProvider,
    load,
    createEntity,
    updateEntity,
    createEntityAlias,
    deleteEntityAlias,
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
    uploadStatement,
    rescanStatementUpload,
    updateStatementUploadMetadata,
    archiveStatementUpload,
    restoreStatementUpload,
    deleteArchivedStatementUpload,
    confirmStatementImport,
    reconcileStatementUpload,
    importStatementReviewRow,
    linkStatementReviewRow,
    searchStatementUploads,
    auditStatementUploads,
    auditImportedTransactionCleanup,
    purgeImportedTransactionCleanup,
    purgeAllImportedStatementTransactions,
    purgeAllStatementUploads,
  } = useAccumul8(onToast, selectedOwnerUserId > 0 ? selectedOwnerUserId : undefined);
  const [tab, setTab] = React.useState<TabKey>('ledger');
  const [entityForm, setEntityForm] = React.useState<EntityFormState>(DEFAULT_ENTITY_FORM);
  const [contactForm, setContactForm] = React.useState(DEFAULT_CONTACT_FORM);
  const [debtorForm, setDebtorForm] = React.useState<DebtorFormState>(createDefaultDebtorForm);
  const [ledgerForm, setLedgerForm] = React.useState<LedgerFormState>(createDefaultLedgerForm);
  const [budgetForm, setBudgetForm] = React.useState<{ category_name: string; monthly_budget: number; match_pattern: string; row_order: number; is_active: number }>({ category_name: '', monthly_budget: 0, match_pattern: '', row_order: 0, is_active: 1 });
  const [budgetMonth, setBudgetMonth] = React.useState<string>(new Date().toISOString().slice(0, 7));
  const [ledgerDateFilter, setLedgerDateFilter] = React.useState<DateRangeFilter>('all_dates');
  const [customLedgerStartDate, setCustomLedgerStartDate] = React.useState<string>('');
  const [customLedgerEndDate, setCustomLedgerEndDate] = React.useState<string>('');
  const [ledgerArchivePage, setLedgerArchivePage] = React.useState<number>(1);
  const [ledgerPaginationMode, setLedgerPaginationMode] = React.useState<LedgerPaginationMode>('100');
  const [lastSyncReport, setLastSyncReport] = React.useState<Accumul8SyncReport | null>(null);
  const [syncingConnectionId, setSyncingConnectionId] = React.useState<number | null>(null);
  const [payBillsDateFilter, setPayBillsDateFilter] = React.useState<DateRangeFilter>('30_days');
  const [customPayBillsStartDate, setCustomPayBillsStartDate] = React.useState<string>('');
  const [customPayBillsEndDate, setCustomPayBillsEndDate] = React.useState<string>('');
  const [notificationForm, setNotificationForm] = React.useState({ rule_name: '', trigger_type: 'upcoming_due', days_before_due: 3, target_scope: 'group' as 'group' | 'custom', custom_user_ids: '', email_subject_template: '', email_body_template: '' });
  const [editingContactId, setEditingContactId] = React.useState<number | null>(null);
  const [editingEntityId, setEditingEntityId] = React.useState<number | null>(null);
  const [editingDebtorId, setEditingDebtorId] = React.useState<number | null>(null);
  const [editingRecurringId, setEditingRecurringId] = React.useState<number | null>(null);
  const [editingRecurringForm, setEditingRecurringForm] = React.useState<RecurringFormState>(DEFAULT_RECURRING_FORM);
  const [editingTransactionId, setEditingTransactionId] = React.useState<number | null>(null);
  const [viewingTransactionId, setViewingTransactionId] = React.useState<number | null>(null);
  const [editingBudgetRowId, setEditingBudgetRowId] = React.useState<number | null>(null);
  const [editingNotificationRuleId, setEditingNotificationRuleId] = React.useState<number | null>(null);
  const [activeLedgerRowId, setActiveLedgerRowId] = React.useState<number | null>(null);
  const [activePayBillRowId, setActivePayBillRowId] = React.useState<number | null>(null);
  const [activeDebtorRowId, setActiveDebtorRowId] = React.useState<number | null>(null);
  const [activeEntityRowId, setActiveEntityRowId] = React.useState<number | null>(null);
  const [activeRecurringRowId, setActiveRecurringRowId] = React.useState<number | null>(null);
  const [ledgerDraftById, setLedgerDraftById] = React.useState<Record<number, LedgerInlineDraft>>({});
  const [payBillDraftById, setPayBillDraftById] = React.useState<Record<number, LedgerInlineDraft>>({});
  const [debtorDraftById, setDebtorDraftById] = React.useState<Record<number, DebtorInlineDraft>>({});
  const [entityDraftById, setEntityDraftById] = React.useState<Record<number, EntityInlineDraft>>({});
  const [entityAliasDraftById, setEntityAliasDraftById] = React.useState<Record<number, Accumul8EntityAliasDraft>>({});
  const [recurringDraftById, setRecurringDraftById] = React.useState<Record<number, RecurringInlineDraft>>({});
  const [contactModalOpen, setContactModalOpen] = React.useState(false);
  const [entityModalOpen, setEntityModalOpen] = React.useState(false);
  const [debtorModalOpen, setDebtorModalOpen] = React.useState(false);
  const [recurringModalOpen, setRecurringModalOpen] = React.useState(false);
  const [transactionModalOpen, setTransactionModalOpen] = React.useState(false);
  const [transactionModalMode, setTransactionModalMode] = React.useState<'create' | 'view' | 'edit'>('create');
  const [entityHistoryEntityId, setEntityHistoryEntityId] = React.useState<number | null>(null);
  const [selectedDebtorId, setSelectedDebtorId] = React.useState<string>('');
  const [selectedBankingOrganizationId, setSelectedBankingOrganizationId] = React.useState<string>('');
  const [selectedBankAccountId, setSelectedBankAccountId] = React.useState<string>('');
  const [bankingOrganizationManagerOpen, setBankingOrganizationManagerOpen] = React.useState(false);
  const [accountManagerOpen, setAccountManagerOpen] = React.useState(false);
  const [syncHelpOpen, setSyncHelpOpen] = React.useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = React.useState(false);
  const [settingsMenuPosition, setSettingsMenuPosition] = React.useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 240 });
  const [syncHelpToken, setSyncHelpToken] = React.useState('');
  const [syncHelpError, setSyncHelpError] = React.useState('');
  const [entityEndexQuery, setEntityEndexQuery] = React.useState('');
  const launchableBankingOrganizations = React.useMemo(() => {
    const filtered = bankingOrganizations.filter((organization) => isLaunchableHttpUrl(organization.login_url));
    if (!selectedBankingOrganizationId) {
      return filtered;
    }
    return [...filtered].sort((a, b) => {
      const aSelected = String(a.id) === selectedBankingOrganizationId ? 1 : 0;
      const bSelected = String(b.id) === selectedBankingOrganizationId ? 1 : 0;
      return bSelected - aSelected || a.banking_organization_name.localeCompare(b.banking_organization_name) || a.id - b.id;
    });
  }, [bankingOrganizations, selectedBankingOrganizationId]);
  const openBankingOrganizationPopup = React.useCallback((loginUrl: string, organizationName: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    const targetUrl = String(loginUrl || '').trim();
    if (!isLaunchableHttpUrl(targetUrl)) {
      onToast?.({ tone: 'warning', message: `No valid login URL configured for ${organizationName}.` });
      return;
    }
    const screenWidth = Math.max(window.screen.availWidth || window.innerWidth || 1440, 1024);
    const screenHeight = Math.max(window.screen.availHeight || window.innerHeight || 900, 720);
    const popupWidth = Math.max(Math.floor(screenWidth / 2), 720);
    const popupHeight = Math.max(screenHeight - 80, 640);
    const popupLeft = Math.max((window.screenX || 0) + screenWidth - popupWidth, 0);
    const popupTop = Math.max(window.screenY || 0, 0);
    const popupName = `accumul8-bank-${organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'login'}`;
    const popupFeatures = [
      `width=${popupWidth}`,
      `height=${popupHeight}`,
      `left=${popupLeft}`,
      `top=${popupTop}`,
      'popup=yes',
      'noopener=yes',
      'noreferrer=yes',
      'menubar=no',
      'toolbar=no',
      'location=no',
      'status=no',
      'personalbar=no',
      'resizable=yes',
      'scrollbars=yes',
    ].join(',');
    const popupWindow = window.open(targetUrl, popupName, popupFeatures);
    if (!popupWindow) {
      onToast?.({ tone: 'warning', message: `Popup blocked while opening ${organizationName}. Allow popups for catn8.us and try again.` });
      return;
    }
    popupWindow.focus();
  }, [onToast]);
  const [listSearchQueryByTab, setListSearchQueryByTab] = React.useState<Record<SearchableListTabKey, string>>({
    ledger: '',
    debtors: '',
    pay_bills: '',
    contacts: '',
    recurring: '',
  });
  const [ledgerFilterPreset, setLedgerFilterPreset] = React.useState<LedgerFilterPreset>('all');
  const [flashingSaveButtonKey, setFlashingSaveButtonKey] = React.useState<string>('');
  const settingsMenuRef = React.useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const inlineRowRefs = React.useRef<Record<string, HTMLTableRowElement | null>>({});
  const flashSaveButtonTimeoutRef = React.useRef<number | null>(null);
  const ledgerTableRef = React.useRef<HTMLTableElement | null>(null);
  const debtorsTableRef = React.useRef<HTMLTableElement | null>(null);
  const balanceLedgerTableRef = React.useRef<HTMLTableElement | null>(null);
  const payBillsTableRef = React.useRef<HTMLTableElement | null>(null);
  const entitiesTableRef = React.useRef<HTMLTableElement | null>(null);
  const recurringTableRef = React.useRef<HTMLTableElement | null>(null);
  const syncTableRef = React.useRef<HTMLTableElement | null>(null);
  const aliasRowsByEntityId = React.useMemo(() => {
    const next: Record<number, typeof entityAliases> = {};
    entityAliases.forEach((alias) => {
      const entityId = Number(alias.entity_id || 0);
      if (entityId <= 0) {
        return;
      }
      if (!next[entityId]) {
        next[entityId] = [];
      }
      next[entityId].push(alias);
    });
    return next;
  }, [entityAliases]);
  const entitiesWithResolvedAliases = React.useMemo(() => (
    entities.map((entity) => ({
      ...entity,
      aliases: aliasRowsByEntityId[entity.id] || entity.aliases || [],
    }))
  ), [aliasRowsByEntityId, entities]);
  const editingEntity = React.useMemo(() => (
    editingEntityId !== null ? (entitiesWithResolvedAliases.find((entity) => entity.id === editingEntityId) || null) : null
  ), [editingEntityId, entitiesWithResolvedAliases]);
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
  const scopedAccounts = React.useMemo(() => {
    const bankAccountId = Number(selectedBankAccountId || 0);
    if (bankAccountId > 0) {
      return visibleAccounts.filter((account) => account.id === bankAccountId);
    }
    return visibleAccounts;
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
  const todayDate = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const ledgerDateRange = React.useMemo(() => {
    if (ledgerDateFilter === 'all_dates') {
      return { startDate: '', endDate: '' };
    }
    if (ledgerDateFilter === 'custom') {
      return {
        startDate: customLedgerStartDate || '',
        endDate: customLedgerEndDate || '',
      };
    }
    if (ledgerDateFilter === '7_days') {
      return { startDate: '', endDate: addUtcDays(todayDate, 7) };
    }
    if (ledgerDateFilter === '30_days') {
      return { startDate: '', endDate: addUtcDays(todayDate, 30) };
    }
    if (ledgerDateFilter === '60_days') {
      return { startDate: '', endDate: addUtcDays(todayDate, 60) };
    }
    if (ledgerDateFilter === '90_days') {
      return { startDate: '', endDate: addUtcDays(todayDate, 90) };
    }
    return {
      startDate: '',
      endDate: `${todayDate.slice(0, 4)}-12-31`,
    };
  }, [customLedgerEndDate, customLedgerStartDate, ledgerDateFilter, todayDate]);
  const ledgerSearchQuery = React.useMemo(() => normalizeSearchQuery(listSearchQueryByTab.ledger), [listSearchQueryByTab.ledger]);
  const ledgerRowsBase = React.useMemo(() => (
    filteredTransactions.filter((tx) => {
      const effectiveDate = getLedgerEffectiveDate(tx);
      const isPaid = Number(tx.is_paid || 0) === 1;
      const isReconciled = Number(tx.is_reconciled || 0) === 1;
      const isPendingBank = Number(tx.pending_status || 0) === 1;
      const isUpcomingRecurring = String(tx.source_kind || '') === 'recurring' && effectiveDate >= todayDate && !isPaid;
      const isLate = !isPaid && Boolean(effectiveDate) && effectiveDate < todayDate;
      const isUpcomingUnpaid = !isPaid && Boolean(effectiveDate) && effectiveDate >= todayDate;
      if (!isDateInRange(effectiveDate, ledgerDateRange)) {
        return false;
      }
      switch (ledgerFilterPreset) {
        case 'hide_upcoming_recurring':
          return !isUpcomingRecurring;
        case 'hide_reconciled':
          return !isReconciled;
        case 'hide_paid':
          return !isPaid;
        case 'hide_pending_bank':
          return !isPendingBank;
        case 'show_late_payments':
          return isLate;
        case 'show_paid_not_reconciled':
          return isPaid && !isReconciled;
        case 'show_reconciled_not_paid':
          return isReconciled && !isPaid;
        case 'show_unpaid_only':
          return !isPaid;
        case 'show_upcoming_unpaid':
          return isUpcomingUnpaid;
        case 'all':
        default:
          return true;
      }
    })
  ), [filteredTransactions, ledgerDateRange, ledgerFilterPreset, todayDate]);
  const ledgerRows = React.useMemo(() => (
    ledgerRowsBase.filter((tx) => matchesSearchQuery(ledgerSearchQuery, [
      tx.transaction_date,
      tx.due_date,
      tx.description,
      tx.memo,
      tx.account_name,
      tx.contact_name,
      tx.entity_name,
      tx.balance_entity_name,
      tx.entry_type,
      tx.source_kind,
      tx.amount,
      tx.running_balance,
      Number(tx.is_paid || 0) === 1 ? 'paid' : 'unpaid',
      Number(tx.is_reconciled || 0) === 1 ? 'reconciled' : 'unreconciled',
    ]))
  ), [ledgerRowsBase, ledgerSearchQuery]);
  const payBillsAccountOptions = React.useMemo(() => (
    accounts
      .filter((account) => Number(account.is_active || 0) === 1)
      .slice()
      .sort((a, b) => formatAccountOptionLabel(a).localeCompare(formatAccountOptionLabel(b)))
  ), [accounts]);
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
  const recurringSearchQuery = React.useMemo(() => normalizeSearchQuery(listSearchQueryByTab.recurring), [listSearchQueryByTab.recurring]);
  const recurringRows = React.useMemo(() => (
    filteredRecurringPayments.filter((item) => matchesSearchQuery(recurringSearchQuery, [
      item.title,
      item.notes,
      item.next_due_date,
      item.frequency,
      item.payment_method,
      item.direction,
      item.entity_name,
      item.account_name,
      item.amount,
      Number(item.is_budget_planner || 0) === 1 ? 'shown' : 'hidden',
      Number(item.is_active || 0) === 1 ? 'active' : 'paused',
    ]))
  ), [filteredRecurringPayments, recurringSearchQuery]);
  const payBillRows = React.useMemo(() => {
    return filteredTransactions
      .filter((tx) => {
        if (Number(tx.amount || 0) >= 0) {
          return false;
        }
        if (Number(tx.is_paid || 0) !== 0) {
          return false;
        }
        const sourceKind = String(tx.source_kind || 'manual');
        const entryType = String(tx.entry_type || 'manual');
        const matchesSource = sourceKind === 'recurring' || sourceKind === 'manual' || sourceKind === 'plaid' || sourceKind === 'teller';
        const matchesEntryType = entryType === 'bill' || entryType === 'auto' || entryType === 'manual';
        if (!matchesSource && !matchesEntryType) {
          return false;
        }
        return String(tx.due_date || tx.transaction_date || '').trim() !== '';
      })
      .slice()
      .sort((a, b) => {
        const aDate = String(a.due_date || a.transaction_date || '');
        const bDate = String(b.due_date || b.transaction_date || '');
        const aPastDue = aDate < todayDate;
        const bPastDue = bDate < todayDate;
        if (aPastDue !== bPastDue) {
          return aPastDue ? -1 : 1;
        }
        const dateCompare = aDate.localeCompare(bDate);
        if (dateCompare !== 0) {
          return dateCompare;
        }
        return a.id - b.id;
      });
  }, [filteredTransactions]);
  const payBillsDateRange = React.useMemo(() => {
    const startDate = '';
    if (payBillsDateFilter === 'all_dates') {
      return { startDate, endDate: '' };
    }
    if (payBillsDateFilter === 'custom') {
      return {
        startDate: customPayBillsStartDate || '',
        endDate: customPayBillsEndDate || '',
      };
    }
    if (payBillsDateFilter === '7_days') {
      return { startDate, endDate: addUtcDays(todayDate, 7) };
    }
    if (payBillsDateFilter === '30_days') {
      return { startDate, endDate: addUtcDays(todayDate, 30) };
    }
    if (payBillsDateFilter === '60_days') {
      return { startDate, endDate: addUtcDays(todayDate, 60) };
    }
    if (payBillsDateFilter === '90_days') {
      return { startDate, endDate: addUtcDays(todayDate, 90) };
    }
    return {
      startDate,
      endDate: `${todayDate.slice(0, 4)}-12-31`,
    };
  }, [customPayBillsEndDate, customPayBillsStartDate, payBillsDateFilter, todayDate]);
  const filteredPayBillRows = React.useMemo(() => (
    payBillRows.filter((tx) => {
      const effectiveDate = String(tx.due_date || tx.transaction_date || '');
      if (!effectiveDate) {
        return false;
      }
      if (effectiveDate < todayDate) {
        return true;
      }
      if (payBillsDateRange.startDate && effectiveDate < payBillsDateRange.startDate) {
        return false;
      }
      if (payBillsDateRange.endDate && effectiveDate > payBillsDateRange.endDate) {
        return false;
      }
      return true;
    })
  ), [payBillRows, payBillsDateRange]);
  const payBillsSearchQuery = React.useMemo(() => normalizeSearchQuery(listSearchQueryByTab.pay_bills), [listSearchQueryByTab.pay_bills]);
  const payBillsRows = React.useMemo(() => (
    filteredPayBillRows.filter((tx) => matchesSearchQuery(payBillsSearchQuery, [
      tx.due_date,
      tx.transaction_date,
      tx.paid_date,
      tx.description,
      tx.memo,
      tx.account_name,
      tx.contact_name,
      tx.entity_name,
      tx.amount,
      Number(tx.is_paid || 0) === 1 ? 'paid' : ((tx.due_date || tx.transaction_date) < todayDate ? 'past due' : 'upcoming'),
    ]))
  ), [filteredPayBillRows, payBillsSearchQuery, todayDate]);
  const currentVisibleBalance = React.useMemo(() => (
    roundCurrency(scopedAccounts.reduce((sum, account) => sum + Number(account.current_balance || 0), 0))
  ), [scopedAccounts]);
  const defaultProjectedTransactions = React.useMemo(() => (
    filteredTransactions.filter((tx) => {
      const effectiveDate = String(tx.due_date || tx.transaction_date || '');
      if (!effectiveDate || effectiveDate < todayDate) {
        return false;
      }
      return Number(tx.is_paid || 0) === 0;
    })
  ), [filteredTransactions, todayDate]);
  const payBillsProjectedTransactions = React.useMemo(() => (
    filteredTransactions.filter((tx) => {
      const effectiveDate = String(tx.due_date || tx.transaction_date || '');
      if (!effectiveDate) {
        return false;
      }
      if (payBillsDateRange.startDate && effectiveDate < payBillsDateRange.startDate) {
        return false;
      }
      if (payBillsDateRange.endDate && effectiveDate > payBillsDateRange.endDate) {
        return false;
      }
      return Number(tx.is_paid || 0) === 0;
    })
  ), [filteredTransactions, payBillsDateRange]);
  const budgetPlannerSummaryPayments = React.useMemo(() => (
    filteredRecurringPayments.filter((rp) => Number(rp.is_budget_planner || 0) === 1)
  ), [filteredRecurringPayments]);
  const spreadsheetProjectedSummary = React.useMemo(() => {
    const monthRows = budgetPlannerSummaryPayments.filter((payment) => String(payment.next_due_date || '').slice(0, 7) === budgetMonth);
    let projectedDelta = 0;
    let unpaidBills = 0;
    let upcomingWindfalls = 0;
    monthRows.forEach((payment) => {
      const amount = Number(payment.amount || 0);
      const normalizedAmount = String(payment.direction || 'outflow') === 'inflow' ? Math.abs(amount) : -Math.abs(amount);
      projectedDelta += normalizedAmount;
      if (normalizedAmount < 0) {
        unpaidBills += Math.abs(normalizedAmount);
      } else if (normalizedAmount > 0) {
        upcomingWindfalls += normalizedAmount;
      }
    });
    return {
      projectedDelta: roundCurrency(projectedDelta),
      unpaidBills: roundCurrency(unpaidBills),
      upcomingWindfalls: roundCurrency(upcomingWindfalls),
    };
  }, [budgetMonth, budgetPlannerSummaryPayments]);
  const headerSummary = React.useMemo<Accumul8HeaderSummary>(() => {
    if (tab === 'spreadsheet') {
      return {
        currentBalance: currentVisibleBalance,
        projectedBalance: roundCurrency(currentVisibleBalance + spreadsheetProjectedSummary.projectedDelta),
        unpaidBills: spreadsheetProjectedSummary.unpaidBills,
        upcomingWindfalls: spreadsheetProjectedSummary.upcomingWindfalls,
      };
    }

    const projectedTransactions = tab === 'pay_bills' ? payBillsProjectedTransactions : defaultProjectedTransactions;
    let projectedDelta = 0;
    let unpaidBills = 0;
    let upcomingWindfalls = 0;

    projectedTransactions.forEach((tx) => {
      const amount = Number(tx.amount || 0);
      projectedDelta += amount;
      if (amount < 0) {
        unpaidBills += Math.abs(amount);
      } else if (amount > 0) {
        upcomingWindfalls += amount;
      }
    });

    return {
      currentBalance: currentVisibleBalance,
      projectedBalance: roundCurrency(currentVisibleBalance + projectedDelta),
      unpaidBills: roundCurrency(unpaidBills),
      upcomingWindfalls: roundCurrency(upcomingWindfalls),
    };
  }, [currentVisibleBalance, defaultProjectedTransactions, payBillsProjectedTransactions, spreadsheetProjectedSummary, tab]);
  const debtorsSearchQuery = React.useMemo(() => normalizeSearchQuery(listSearchQueryByTab.debtors), [listSearchQueryByTab.debtors]);
  const debtorRows = React.useMemo(() => (
    debtors.filter((debtor) => matchesSearchQuery(debtorsSearchQuery, [
      debtor.debtor_name,
      debtor.contact_name,
      debtor.entity_name,
      debtor.notes,
      debtor.last_activity_date,
      debtor.total_loaned,
      debtor.total_repaid,
      debtor.outstanding_balance,
      Number(debtor.is_active || 0) === 1 ? 'active' : 'paused',
    ]))
  ), [debtors, debtorsSearchQuery]);
  const ledgerTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8Transaction>>>(() => ([
    { key: 'date', header: 'Date', minWidth: 110, maxAutoWidth: 126, sortable: true, sortAccessor: (tx) => tx.transaction_date || '', contentAccessor: (tx) => formatInlineDate(tx.transaction_date) },
    { key: 'due', header: 'Due', minWidth: 110, maxAutoWidth: 126, sortable: true, sortAccessor: (tx) => tx.due_date || '', contentAccessor: (tx) => formatInlineDate(tx.due_date) },
    { key: 'account', header: 'Account', minWidth: 168, maxAutoWidth: 260, priority: 2, sortable: true, sortAccessor: (tx) => tx.account_name || tx.banking_organization_name || '', contentAccessor: (tx) => tx.account_name || tx.banking_organization_name || '-' },
    { key: 'description', header: 'Description', minWidth: 240, maxAutoWidth: 560, priority: 6, sortable: true, sortAccessor: (tx) => getLedgerDescriptionLabel(tx), contentAccessor: (tx) => getLedgerDescriptionLabel(tx) },
    { key: 'memo', header: 'Memo', minWidth: 150, maxAutoWidth: 360, priority: 3, sortable: true, sortAccessor: (tx) => tx.memo || '', contentAccessor: (tx) => tx.memo || '-' },
    { key: 'amount', header: 'Amount', minWidth: 126, maxAutoWidth: 150, sortable: true, defaultSortDirection: 'desc', sortAccessor: (tx) => Number(tx.amount || 0), contentAccessor: (tx) => Number(tx.amount || 0).toFixed(2) },
    { key: 'balance', header: 'Balance', minWidth: 136, maxAutoWidth: 160, sortable: true, defaultSortDirection: 'desc', sortAccessor: (tx) => Number(tx.running_balance || 0), contentAccessor: (tx) => Number(tx.running_balance || 0).toFixed(2) },
    { key: 'paid', header: 'Paid', minWidth: 92, maxAutoWidth: 106, sortable: true, sortAccessor: (tx) => Number(tx.is_paid || 0), contentAccessor: (tx) => Number(tx.is_paid || 0) === 1 ? 'Paid' : 'Unpaid' },
    { key: 'reconciled', header: 'Reconciled', minWidth: 138, maxAutoWidth: 156, sortable: true, sortAccessor: (tx) => Number(tx.is_reconciled || 0), contentAccessor: (tx) => Number(tx.is_reconciled || 0) === 1 ? 'Reconciled' : 'Open' },
    { key: 'actions', header: 'Actions', minWidth: 184, maxAutoWidth: 210, sortable: false, contentAccessor: () => 'Statement View Edit Delete Save' },
  ]), []);
  const debtorsTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8Debtor>>>(() => ([
    { key: 'person', header: 'Person', minWidth: 180, maxAutoWidth: 300, priority: 4, sortable: true, sortAccessor: (debtor) => debtor.entity_name || debtor.debtor_name || '', contentAccessor: (debtor) => debtor.entity_name || debtor.debtor_name || '-' },
    { key: 'linkedEntity', header: 'Linked Entity', minWidth: 170, maxAutoWidth: 280, priority: 3, sortable: true, sortAccessor: (debtor) => debtor.contact_name || '', contentAccessor: (debtor) => debtor.contact_name || '-' },
    { key: 'charges', header: 'Charges', minWidth: 120, maxAutoWidth: 142, sortable: true, defaultSortDirection: 'desc', sortAccessor: (debtor) => Number(debtor.total_loaned || 0), contentAccessor: (debtor) => Number(debtor.total_loaned || 0).toFixed(2) },
    { key: 'credits', header: 'Credits', minWidth: 120, maxAutoWidth: 142, sortable: true, defaultSortDirection: 'desc', sortAccessor: (debtor) => Number(debtor.total_repaid || 0), contentAccessor: (debtor) => Number(debtor.total_repaid || 0).toFixed(2) },
    { key: 'net', header: 'Net IOU', minWidth: 132, maxAutoWidth: 152, sortable: true, defaultSortDirection: 'desc', sortAccessor: (debtor) => Number(debtor.outstanding_balance || 0), contentAccessor: (debtor) => Number(debtor.outstanding_balance || 0).toFixed(2) },
    { key: 'activity', header: 'Last Activity', minWidth: 136, maxAutoWidth: 170, priority: 1, sortable: true, defaultSortDirection: 'desc', sortAccessor: (debtor) => debtor.last_activity_date || '', contentAccessor: (debtor) => debtor.last_activity_date || '-' },
    { key: 'actions', header: 'Actions', minWidth: 228, maxAutoWidth: 250, sortable: false, contentAccessor: () => 'View Edit Delete Save' },
  ]), []);
  const payBillsTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8Transaction>>>(() => ([
    { key: 'due', header: 'Due Date', minWidth: 124, maxAutoWidth: 140, sortable: true, sortAccessor: (tx) => tx.due_date || tx.transaction_date || '', contentAccessor: (tx) => formatInlineDate(tx.due_date || tx.transaction_date) },
    { key: 'paidDate', header: 'Paid Date', minWidth: 124, maxAutoWidth: 140, sortable: true, sortAccessor: (tx) => tx.paid_date || '', contentAccessor: (tx) => formatInlineDate(tx.paid_date) },
    { key: 'description', header: 'Description', minWidth: 250, maxAutoWidth: 520, priority: 6, sortable: true, sortAccessor: (tx) => tx.description || '', contentAccessor: (tx) => tx.description || '-' },
    { key: 'account', header: 'Account', minWidth: 170, maxAutoWidth: 260, priority: 2, sortable: true, sortAccessor: (tx) => tx.account_name || '', contentAccessor: (tx) => tx.account_name || 'No account' },
    { key: 'amount', header: 'Amount', minWidth: 120, maxAutoWidth: 144, sortable: true, defaultSortDirection: 'asc', sortAccessor: (tx) => Number(tx.amount || 0), contentAccessor: (tx) => Number(tx.amount || 0).toFixed(2) },
    { key: 'status', header: 'Status', minWidth: 116, maxAutoWidth: 132, sortable: true, sortAccessor: (tx) => formatPayBillStatusLabel(tx, todayDate), contentAccessor: (tx) => formatPayBillStatusLabel(tx, todayDate) },
    { key: 'actions', header: 'Actions', minWidth: 184, maxAutoWidth: 210, sortable: false, contentAccessor: () => 'Statement View Edit Delete Save' },
  ]), [todayDate]);
  const recurringTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8RecurringPayment>>>(() => ([
    { key: 'title', header: 'Title', minWidth: 230, maxAutoWidth: 520, priority: 6, sortable: true, sortAccessor: (item) => item.title || '', contentAccessor: (item) => [item.title || 'Untitled recurring payment', item.notes || ''] },
    { key: 'nextDue', header: 'Next Due', minWidth: 126, maxAutoWidth: 144, sortable: true, sortAccessor: (item) => item.next_due_date || '', contentAccessor: (item) => formatInlineDate(item.next_due_date) },
    { key: 'amount', header: 'Amount', minWidth: 118, maxAutoWidth: 144, sortable: true, defaultSortDirection: 'desc', sortAccessor: (item) => Number(item.amount || 0), contentAccessor: (item) => Number(item.amount || 0).toFixed(2) },
    { key: 'frequency', header: 'Frequency', minWidth: 122, maxAutoWidth: 150, sortable: true, sortAccessor: (item) => item.frequency || '', contentAccessor: (item) => item.frequency || '-' },
    { key: 'account', header: 'Account', minWidth: 180, maxAutoWidth: 300, priority: 2, sortable: true, sortAccessor: (item) => item.account_name || '', contentAccessor: (item) => item.account_name || 'No account' },
    { key: 'paymentMethod', header: 'Payment Method', minWidth: 170, maxAutoWidth: 220, priority: 1, sortable: true, sortAccessor: (item) => RECURRING_PAYMENT_METHOD_LABELS[(item.payment_method || 'unspecified') as Accumul8PaymentMethod], contentAccessor: (item) => RECURRING_PAYMENT_METHOD_LABELS[(item.payment_method || 'unspecified') as Accumul8PaymentMethod] },
    { key: 'planner', header: 'Planner', minWidth: 108, maxAutoWidth: 120, sortable: true, sortAccessor: (item) => Number(item.is_budget_planner || 0), contentAccessor: (item) => Number(item.is_budget_planner || 0) === 1 ? 'Shown' : 'Hidden' },
    { key: 'status', header: 'Status', minWidth: 104, maxAutoWidth: 118, sortable: true, sortAccessor: (item) => Number(item.is_active || 0), contentAccessor: (item) => Number(item.is_active || 0) === 1 ? 'Active' : 'Paused' },
    { key: 'actions', header: 'Actions', minWidth: 184, maxAutoWidth: 210, sortable: false, contentAccessor: () => 'View Edit Delete Save' },
  ]), []);
  const ledgerTable = usePriorityTableLayout({
    tableRef: ledgerTableRef,
    rows: ledgerRows,
    columns: ledgerTableColumns,
  });
  const ledgerPaginationCutoffDate = React.useMemo(() => addUtcDays(todayDate, -60), [todayDate]);
  const ledgerPagination = React.useMemo(() => {
    const allRows = ledgerTable.rows;
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

    return {
      rows: currentPage === 1 ? [...recentRows, ...archivedSlice] : archivedSlice,
      recentCount: recentRows.length,
      archivedCount: archivedRows.length,
      totalRows: allRows.length,
      currentPage,
      totalPages,
      hasArchivedPages: archivedRows.length > 100,
    };
  }, [ledgerArchivePage, ledgerPaginationCutoffDate, ledgerPaginationMode, ledgerTable.rows]);
  const debtorsTable = usePriorityTableLayout({
    tableRef: debtorsTableRef,
    rows: debtorRows,
    columns: debtorsTableColumns,
  });
  const payBillsTable = usePriorityTableLayout({
    tableRef: payBillsTableRef,
    rows: payBillsRows,
    columns: payBillsTableColumns,
  });
  const recurringTable = usePriorityTableLayout({
    tableRef: recurringTableRef,
    rows: recurringRows,
    columns: recurringTableColumns,
  });
  React.useEffect(() => {
    setLedgerArchivePage(1);
  }, [
    ledgerDateFilter,
    customLedgerStartDate,
    customLedgerEndDate,
    ledgerFilterPreset,
    ledgerSearchQuery,
    selectedBankingOrganizationId,
    selectedBankAccountId,
    ledgerPaginationMode,
    ledgerTable.sortState?.key,
    ledgerTable.sortState?.direction,
  ]);
  React.useEffect(() => {
    if (ledgerPaginationMode === 'all') {
      if (ledgerArchivePage !== 1) {
        setLedgerArchivePage(1);
      }
      return;
    }
    if (ledgerArchivePage > ledgerPagination.totalPages) {
      setLedgerArchivePage(ledgerPagination.totalPages);
    }
  }, [ledgerArchivePage, ledgerPagination.totalPages, ledgerPaginationMode]);
  const linkedAccountsByConnectionId = React.useMemo(() => {
    const next: Record<number, Accumul8Account[]> = {};
    accounts.forEach((account) => {
      const connectionId = Number(account.bank_connection_id || 0);
      if (connectionId <= 0) {
        return;
      }
      if (!next[connectionId]) {
        next[connectionId] = [];
      }
      next[connectionId].push(account);
    });
    return next;
  }, [accounts]);
  const syncTableColumns = React.useMemo<Array<PriorityTableColumn<any>>>(() => ([
    {
      key: 'institution',
      header: 'Institution',
      minWidth: 300,
      maxAutoWidth: 580,
      priority: 6,
      sortable: true,
      sortAccessor: (connection) => connection.institution_name || connection.institution_id || '',
      contentAccessor: (connection) => [
        connection.institution_name || connection.institution_id || 'Unknown',
        connection.teller_enrollment_id || 'Not stored yet',
        ...(linkedAccountsByConnectionId[Number(connection.id || 0)] || []).map((account) => formatAccountMappingLabel(account)),
      ],
    },
    { key: 'status', header: 'Status', minWidth: 166, maxAutoWidth: 196, sortable: true, sortAccessor: (connection) => formatSyncStatusLabel(connection.status || '', connection.last_error || ''), contentAccessor: (connection) => formatSyncStatusLabel(connection.status || '', connection.last_error || '') },
    { key: 'lastSync', header: 'Last Sync', minWidth: 188, maxAutoWidth: 214, sortable: true, defaultSortDirection: 'desc', sortAccessor: (connection) => connection.last_synced_at || '', contentAccessor: (connection) => formatInlineDate(connection.last_synced_at) },
    { key: 'actions', header: 'Actions', minWidth: 138, maxAutoWidth: 160, sortable: false, contentAccessor: () => 'Sync Reconnect Delete' },
  ]), [linkedAccountsByConnectionId]);
  const syncTable = usePriorityTableLayout({
    tableRef: syncTableRef,
    rows: bankConnections,
    columns: syncTableColumns,
  });
  const runConnectionSync = React.useCallback(async (connectionId: number, institutionName: string) => {
    setSyncingConnectionId(connectionId);
    try {
      const result = await syncBankConnection(connectionId);
      if (!result || !result.success) {
        return;
      }
      setLastSyncReport({
        connectionId,
        institutionName,
        syncedAt: new Date().toISOString(),
        result,
      });
    } finally {
      setSyncingConnectionId((current) => (current === connectionId ? null : current));
    }
  }, [syncBankConnection]);
  const renderDateRangeControls = React.useCallback((
    prefix: 'ledger' | 'pay-bills',
    filter: DateRangeFilter,
    setFilter: (value: DateRangeFilter) => void,
    customStartDate: string,
    setCustomStartDate: (value: string) => void,
    customEndDate: string,
    setCustomEndDate: (value: string) => void,
    includeAllDates = false,
  ) => (
    <div className="accumul8-panel-toolbar-range d-flex flex-wrap align-items-end gap-2">
      <div className="accumul8-toolbar-field accumul8-toolbar-field--compact">
        <label className="visually-hidden" htmlFor={`accumul8-${prefix}-range`}>Date Range</label>
        <select
          id={`accumul8-${prefix}-range`}
          className={getActiveFilterClass('form-select form-select-sm accumul8-panel-toolbar-range-select', includeAllDates ? filter !== 'all_dates' : filter !== '30_days')}
          value={filter}
          onChange={(e) => setFilter(e.target.value as DateRangeFilter)}
          aria-label="Date range"
        >
          {includeAllDates ? <option value="all_dates">All Dates</option> : null}
          {DATE_RANGE_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      {filter === 'custom' && (
        <>
          <div className="accumul8-toolbar-field accumul8-toolbar-field--compact">
            <label className="visually-hidden" htmlFor={`accumul8-${prefix}-start`}>Start date</label>
            <input
              id={`accumul8-${prefix}-start`}
              className={getActiveFilterClass('form-control form-control-sm', customStartDate.trim() !== '')}
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              aria-label="Start date"
            />
          </div>
          <div className="accumul8-toolbar-field accumul8-toolbar-field--compact">
            <label className="visually-hidden" htmlFor={`accumul8-${prefix}-end`}>End date</label>
            <input
              id={`accumul8-${prefix}-end`}
              className={getActiveFilterClass('form-control form-control-sm', customEndDate.trim() !== '')}
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              aria-label="End date"
            />
          </div>
        </>
      )}
    </div>
  ), []);
  const openSyncHelp = React.useCallback((opts?: { token?: string; error?: string }) => {
    setSyncHelpToken(String(opts?.token || ''));
    setSyncHelpError(String(opts?.error || ''));
    setSyncHelpOpen(true);
  }, []);
  const resetContactForm = React.useCallback(() => {
    setEditingContactId(null);
    setContactForm(DEFAULT_CONTACT_FORM);
  }, []);
  const resetEntityForm = React.useCallback(() => {
    setEditingEntityId(null);
    setEntityForm(DEFAULT_ENTITY_FORM);
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
    setViewingTransactionId(null);
    setTransactionModalMode('create');
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
  const setInlineRowRef = React.useCallback((key: string, node: HTMLTableRowElement | null) => {
    if (node) {
      inlineRowRefs.current[key] = node;
      return;
    }
    delete inlineRowRefs.current[key];
  }, []);
  const flashSaveButton = React.useCallback((key: string) => {
    setFlashingSaveButtonKey(key);
    if (flashSaveButtonTimeoutRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(flashSaveButtonTimeoutRef.current);
    }
    if (typeof window !== 'undefined') {
      flashSaveButtonTimeoutRef.current = window.setTimeout(() => {
        setFlashingSaveButtonKey((current) => (current === key ? '' : current));
        flashSaveButtonTimeoutRef.current = null;
      }, 900);
    }
  }, []);
  const parseCustomUserIds = React.useCallback((raw: string): number[] => (
    raw.split(',').map((v) => Number(v.trim())).filter((n) => Number.isFinite(n) && n > 0)
  ), []);
  const beginEditTransaction = React.useCallback((id: number) => {
    const tx = transactions.find((v) => v.id === id);
    if (!tx) return;
    setEditingTransactionId(tx.id);
    setViewingTransactionId(null);
    setTransactionModalMode('edit');
    setLedgerForm(buildLedgerFormFromTransaction(tx));
    setTransactionModalOpen(true);
  }, [transactions]);
  const beginViewTransaction = React.useCallback((id: number) => {
    const tx = transactions.find((v) => v.id === id);
    if (!tx) return;
    setEditingTransactionId(null);
    setViewingTransactionId(tx.id);
    setTransactionModalMode('view');
    setLedgerForm(buildLedgerFormFromTransaction(tx));
    setTransactionModalOpen(true);
  }, [transactions]);
  const beginEditContact = React.useCallback((id: number) => {
    const contact = contacts.find((v) => v.id === id);
    if (!contact) return;
    setEditingContactId(contact.id);
    setContactForm({
      contact_name: contact.contact_name || '',
      contact_type: ((String(contact.contact_type || '').trim().toLowerCase() === 'payer'
        ? 'payer'
        : String(contact.contact_type || '').trim().toLowerCase() === 'repayment'
          ? 'repayment'
          : 'payee') as Accumul8ContactType),
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
  const beginEditEntity = React.useCallback((id: number) => {
    const entity = entities.find((v) => v.id === id);
    if (!entity) return;
    setEditingEntityId(entity.id);
    setEntityAliasDraftById((prev) => ({
      ...prev,
      [entity.id]: DEFAULT_ENTITY_ALIAS_DRAFT,
    }));
    setEntityForm({
      display_name: entity.display_name || '',
      entity_kind: normalizeEntityKind(entity.entity_kind, entity.is_vendor),
      contact_type: normalizeEntityContactType(entity),
      is_vendor: normalizeEntityKind(entity.entity_kind, entity.is_vendor) === 'business' ? 1 : 0,
      default_amount: Number(entity.default_amount || 0),
      email: entity.email || '',
      phone_number: entity.phone_number || '',
      street_address: entity.street_address || '',
      city: entity.city || '',
      state: entity.state || '',
      zip: entity.zip || '',
      notes: entity.notes || '',
      is_active: Number(entity.is_active || 0),
    });
    setEntityModalOpen(true);
  }, [entities]);
  const openCreateEntityModal = React.useCallback((defaults?: Partial<EntityFormState>) => {
    setEditingEntityId(null);
    setEntityForm({ ...DEFAULT_ENTITY_FORM, ...defaults });
    setEntityModalOpen(true);
  }, []);
  const closeEntityModal = React.useCallback(() => {
    setEntityAliasDraftById((prev) => {
      if (editingEntityId === null || !prev[editingEntityId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[editingEntityId];
      return next;
    });
    setEntityModalOpen(false);
    resetEntityForm();
  }, [editingEntityId, resetEntityForm]);
  const openCreateContactModal = React.useCallback(() => {
    resetContactForm();
    setContactModalOpen(true);
  }, [resetContactForm]);
  const closeContactModal = React.useCallback(() => {
    setContactModalOpen(false);
    resetContactForm();
  }, [resetContactForm]);
  const openCreateDebtorModal = React.useCallback(() => {
    openCreateEntityModal({
      entity_kind: 'contact',
      contact_type: 'repayment',
      is_vendor: 0,
    });
  }, [openCreateEntityModal]);
  const closeDebtorModal = React.useCallback(() => {
    setDebtorModalOpen(false);
    resetDebtorForm();
  }, [resetDebtorForm]);
  const openCreateTransactionModal = React.useCallback((defaults?: { balanceEntityId?: string }) => {
    setEditingTransactionId(null);
    setViewingTransactionId(null);
    setTransactionModalMode('create');
    setLedgerForm(createDefaultLedgerForm({ accountId: selectedBankAccountId, balanceEntityId: defaults?.balanceEntityId || '' }));
    setTransactionModalOpen(true);
  }, [selectedBankAccountId]);
  const closeTransactionModal = React.useCallback(() => {
    setTransactionModalOpen(false);
    resetLedgerForm();
  }, [resetLedgerForm]);
  const collectEntityAliasNames = React.useCallback((entityId: number, entityDisplayName: string) => {
    const draft = entityAliasDraftById[entityId] || DEFAULT_ENTITY_ALIAS_DRAFT;
    const entity = entities.find((item) => item.id === entityId) || null;
    const blockedKeys = new Set<string>([
      normalizeEntityAliasKey(entityDisplayName),
      ...((entity?.aliases || []).map((alias) => normalizeEntityAliasKey(alias.alias_name))),
    ]);
    const seenKeys = new Set<string>();
    const names: string[] = [];
    const candidates = [
      ...((draft.pending_alias_names || []).map((value) => String(value || '').trim()).filter(Boolean)),
      String(draft.alias_name || '').trim(),
    ];

    candidates.forEach((value) => {
      const aliasKey = normalizeEntityAliasKey(value);
      if (!value || !aliasKey || blockedKeys.has(aliasKey) || seenKeys.has(aliasKey)) {
        return;
      }
      seenKeys.add(aliasKey);
      names.push(value);
    });

    return names;
  }, [entities, entityAliasDraftById]);
  const persistEntityAliases = React.useCallback(async (entityId: number, entityDisplayName: string, aliasNames?: string[]) => {
    const namesToSave = aliasNames || collectEntityAliasNames(entityId, entityDisplayName);
    if (namesToSave.length === 0) {
      return;
    }
    for (const aliasName of namesToSave) {
      await createEntityAlias({
        entity_id: entityId,
        alias_name: aliasName,
        merge_entity_id: null,
      });
    }
    setEntityAliasDraftById((prev) => {
      const next = { ...prev };
      next[entityId] = DEFAULT_ENTITY_ALIAS_DRAFT;
      return next;
    });
  }, [collectEntityAliasNames, createEntityAlias]);
  const submitContactForm = React.useCallback(async (form: typeof DEFAULT_CONTACT_FORM) => {
    const payload = { ...form, default_amount: Number(form.default_amount) };
    if (editingContactId) {
      await updateContact(editingContactId, payload);
    } else {
      await createContact(payload);
    }
    closeContactModal();
  }, [closeContactModal, createContact, editingContactId, updateContact]);
  const submitEntityForm = React.useCallback(async (form: Accumul8EntityUpsertRequest) => {
    const payload = {
      display_name: form.display_name,
      entity_kind: form.entity_kind || 'business',
      contact_type: form.contact_type,
      is_payee: form.contact_type === 'payee' ? 1 : 0,
      is_payer: form.contact_type === 'payer' ? 1 : 0,
      is_vendor: (form.entity_kind || 'business') === 'business' ? 1 : 0,
      is_balance_person: form.contact_type === 'repayment' ? 1 : 0,
      default_amount: Number(form.default_amount || 0),
      email: form.email || '',
      phone_number: form.phone_number || '',
      street_address: form.street_address || '',
      city: form.city || '',
      state: form.state || '',
      zip: form.zip || '',
      notes: form.notes || '',
      is_active: Number(form.is_active ?? 1),
    };
    if (editingEntityId) {
      const aliasNames = collectEntityAliasNames(editingEntityId, payload.display_name);
      await updateEntity(editingEntityId, payload);
      await persistEntityAliases(editingEntityId, payload.display_name, aliasNames);
    } else {
      await createEntity(payload);
    }
    closeEntityModal();
  }, [closeEntityModal, collectEntityAliasNames, createEntity, editingEntityId, persistEntityAliases, updateEntity]);
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
      entity_id: recurring.entity_id ? String(recurring.entity_id) : '',
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
    paid_date?: string;
    entry_type: Accumul8EntryType;
    description: string;
    memo?: string;
    amount: number;
    rta_amount: number;
    is_paid: number;
    is_reconciled: number;
    is_budget_planner: number;
    entity_id?: number | null;
    account_id?: number | null;
    balance_entity_id?: number | null;
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
  const runTellerConnect = React.useCallback(async () => {
    if (!onToast) return;
    if (!syncProvider.configured) {
      onToast({ tone: 'error', message: 'Teller is not configured. Save credentials in Settings first.' });
      return;
    }

    try {
      const tokenRes = await ApiClient.post<Accumul8TellerConnectTokenResponse>(scopedActionUrl('teller_connect_token'), {});
      const applicationId = String(tokenRes?.application_id || '');
      const environment = String(tokenRes?.environment || syncProvider.env || 'sandbox') as 'sandbox' | 'development' | 'production';
      if (!applicationId) {
        throw new Error('No Teller application id returned');
      }

      setSyncHelpError('');
      setSyncHelpToken(applicationId);

      const linkResult = await openTellerConnect(applicationId, environment);

      if (linkResult.outcome === 'cancelled') {
        onToast({ tone: 'info', message: 'Teller Connect was closed before connecting an account.' });
        return;
      }

      const exchangeRes = await ApiClient.post<Accumul8TellerEnrollmentResponse>(scopedActionUrl('teller_enroll'), {
        access_token: String(linkResult.payload?.accessToken || ''),
        enrollment_id: String(linkResult.payload?.enrollment?.id || ''),
        user_id: String(linkResult.payload?.user?.id || ''),
        institution_id: String(linkResult.payload?.enrollment?.institution?.id || ''),
        institution_name: String(linkResult.payload?.enrollment?.institution?.name || ''),
      });
      const connectionId = Number(exchangeRes?.connection_id || 0);
      if (connectionId <= 0) {
        throw new Error('Teller enrollment did not return a valid connection id');
      }
      const syncRes = await ApiClient.post<Accumul8TellerSyncResponse>(scopedActionUrl('teller_sync_transactions'), {
        connection_id: connectionId,
      });
      setLastSyncReport({
        connectionId,
        institutionName: String(linkResult.payload?.enrollment?.institution?.name || 'Connected institution'),
        syncedAt: new Date().toISOString(),
        result: syncRes,
      });
      const added = Number(syncRes?.added || 0);
      onToast({ tone: 'success', message: `Teller connected and synced (${added} transaction${added === 1 ? '' : 's'} imported).` });
      await load();
    } catch (error: any) {
      const message = String(error?.message || 'Failed to start Teller Connect');
      openSyncHelp({ error: message });
      onToast({ tone: 'error', message });
    }
  }, [load, onToast, openSyncHelp, scopedActionUrl, syncProvider.configured, syncProvider.env]);
  const budgetRowsSorted = React.useMemo(() => (
    [...budgetRows].sort((a, b) => (a.row_order - b.row_order) || (a.id - b.id))
  ), [budgetRows]);
  const linkedAliasEntityIds = React.useMemo(() => {
    const hiddenIds = new Set<number>();
    const entityIdsByNameKey = new Map<string, number[]>();

    entitiesWithResolvedAliases.forEach((entity) => {
      const nameKey = normalizeEntityAliasKey(entity.display_name);
      if (!nameKey) {
        return;
      }
      const bucket = entityIdsByNameKey.get(nameKey) || [];
      bucket.push(entity.id);
      entityIdsByNameKey.set(nameKey, bucket);
    });

    entitiesWithResolvedAliases.forEach((entity) => {
      entity.aliases.forEach((alias) => {
        const aliasKey = normalizeEntityAliasKey(alias.alias_name);
        if (!aliasKey) {
          return;
        }
        (entityIdsByNameKey.get(aliasKey) || []).forEach((matchedEntityId) => {
          if (matchedEntityId !== entity.id) {
            hiddenIds.add(matchedEntityId);
          }
        });
      });
    });

    return hiddenIds;
  }, [entitiesWithResolvedAliases]);
  const entitiesSorted = React.useMemo(() => (
    [...entitiesWithResolvedAliases]
      .filter((entity) => !linkedAliasEntityIds.has(entity.id))
      .sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || '')) || (a.id - b.id))
  ), [entitiesWithResolvedAliases, linkedAliasEntityIds]);
  const contactsSearchQuery = React.useMemo(() => normalizeSearchQuery(listSearchQueryByTab.contacts), [listSearchQueryByTab.contacts]);
  const entityRows = React.useMemo(() => (
    entitiesSorted.filter((entity) => matchesSearchQuery(contactsSearchQuery, [
      entity.display_name,
      entity.notes,
      entity.phone_number,
      entity.email,
      entity.street_address,
      entity.city,
      entity.state,
      entity.zip,
      entity.contact_type,
      entity.entity_kind,
      entity.aliases.map((alias) => alias.alias_name).join(' '),
      Number(entity.is_active || 0) === 1 ? 'active' : 'paused',
      Number(entity.is_balance_person || 0) === 1 ? 'iou person' : '',
      formatEntityRoles(entity),
    ]))
  ), [contactsSearchQuery, entitiesSorted]);
  const linkedAliasEntitiesByParentId = React.useMemo(() => {
    const next: Record<number, Accumul8Entity[]> = {};
    entitiesWithResolvedAliases.forEach((parentEntity) => {
      parentEntity.aliases.forEach((alias) => {
        const aliasKey = normalizeEntityAliasKey(alias.alias_name);
        if (!aliasKey) {
          return;
        }
        entitiesWithResolvedAliases.forEach((candidate) => {
          if (candidate.id === parentEntity.id) {
            return;
          }
          if (normalizeEntityAliasKey(candidate.display_name) !== aliasKey) {
            return;
          }
          if (!next[parentEntity.id]) {
            next[parentEntity.id] = [];
          }
          if (!next[parentEntity.id].some((row) => row.id === candidate.id)) {
            next[parentEntity.id].push(candidate);
          }
        });
      });
    });
    Object.values(next).forEach((rows) => rows.sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || '')) || (a.id - b.id)));
    return next;
  }, [entitiesWithResolvedAliases]);
  const entityEndexParents = React.useMemo(() => {
    const query = String(entityEndexQuery || '').trim().toLowerCase();
    return entitiesSorted.filter((entity) => {
      const importedBudgetParent = Number(entity.legacy_contact_id || 0) > 0 || Number(entity.legacy_debtor_id || 0) > 0;
      const aliases = entity.aliases || [];
      const linkedChildren = linkedAliasEntitiesByParentId[entity.id] || [];
      if (!importedBudgetParent && aliases.length === 0 && linkedChildren.length === 0) {
        return false;
      }
      if (query === '') {
        return true;
      }
      const haystack = [
        entity.display_name,
        entity.notes,
        ...aliases.map((alias) => alias.alias_name),
        ...linkedChildren.map((child) => child.display_name),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [entitiesSorted, entityEndexQuery, linkedAliasEntitiesByParentId]);
  const entityEndexGuideByParentKey = React.useMemo(() => (
    entityEndexGuides.reduce<Record<string, Accumul8EntityEndexGuide>>((acc, guide) => {
      const key = toEntityEndexGuideKey(guide);
      if (key) {
        acc[key] = guide;
      }
      return acc;
    }, {})
  ), [entityEndexGuides]);
  const entityTransactionsById = React.useMemo(() => {
    const grouped: Record<number, Accumul8Transaction[]> = {};
    for (const tx of transactions) {
      const entityId = Number(tx.entity_id || 0);
      if (entityId <= 0) {
        continue;
      }
      if (!grouped[entityId]) {
        grouped[entityId] = [];
      }
      grouped[entityId].push(tx);
    }
    return grouped;
  }, [transactions]);
  const entityTransactionSummaryById = React.useMemo(() => {
    const summary: Record<number, EntityTransactionSummary> = {};
    Object.entries(entityTransactionsById).forEach(([entityId, rows]) => {
      const latest = rows[0] || null;
      summary[Number(entityId)] = {
        count: rows.length,
        lastAmount: latest ? Number(latest.amount || 0) : null,
        lastDate: latest?.transaction_date || latest?.due_date || '',
      };
    });
    return summary;
  }, [entityTransactionsById]);
  const selectedEntityHistory = React.useMemo(() => (
    entityHistoryEntityId ? entities.find((entity) => entity.id === entityHistoryEntityId) || null : null
  ), [entities, entityHistoryEntityId]);
  const selectedEntityTransactions = React.useMemo(() => (
    entityHistoryEntityId ? entityTransactionsById[entityHistoryEntityId] || [] : []
  ), [entityHistoryEntityId, entityTransactionsById]);
  const contactEntities = React.useMemo(() => (
    entitiesSorted.filter((entity) => Number(entity.is_balance_person || 0) === 0)
  ), [entitiesSorted]);
  const balanceEntities = React.useMemo(() => (
    entitiesSorted.filter((entity) => Number(entity.is_balance_person || 0) === 1)
  ), [entitiesSorted]);
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
  const entitiesTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8Entity>>>(() => ([
    {
      key: 'name',
      header: 'Name',
      minWidth: 240,
      maxAutoWidth: 520,
      priority: 5,
      sortable: true,
      sortAccessor: (entity) => entity.display_name || '',
      contentAccessor: (entity) => [
        entity.display_name || 'Unnamed entity',
        entity.notes || '',
        entity.aliases.map((alias) => alias.alias_name).join(' | '),
      ],
    },
    { key: 'roles', header: 'Roles', minWidth: 126, maxAutoWidth: 180, priority: 1, sortable: true, sortAccessor: (entity) => formatEntityRoles(entity), contentAccessor: (entity) => formatEntityRoles(entity) },
    {
      key: 'contactInfo',
      header: 'Contact Info',
      minWidth: 220,
      maxAutoWidth: 420,
      priority: 4,
      sortable: true,
      sortAccessor: (entity) => formatEntityContactSummary(entity).join(' | '),
      contentAccessor: (entity) => formatEntityContactSummary(entity),
    },
    {
      key: 'lastTransaction',
      header: 'Last Transaction',
      minWidth: 172,
      maxAutoWidth: 220,
      sortable: true,
      defaultSortDirection: 'desc',
      sortAccessor: (entity) => (entityTransactionSummaryById[entity.id]?.lastDate || ''),
      contentAccessor: (entity) => formatEntityTransactionSummaryLabel(entityTransactionSummaryById[entity.id] || { count: 0, lastAmount: null, lastDate: '' }),
    },
    { key: 'status', header: 'Status', minWidth: 98, maxAutoWidth: 118, sortable: true, sortAccessor: (entity) => Number(entity.is_active || 0), contentAccessor: (entity) => Number(entity.is_active || 0) === 1 ? 'Active' : 'Paused' },
    { key: 'actions', header: 'Actions', minWidth: 218, maxAutoWidth: 240, sortable: false, contentAccessor: () => 'View Edit Delete Save' },
  ]), [entityTransactionSummaryById]);
  const balanceLedgerTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8Transaction>>>(() => ([
    { key: 'date', header: 'Date', minWidth: 110, maxAutoWidth: 126, sortable: true, defaultSortDirection: 'desc', sortAccessor: (tx) => tx.transaction_date || '', contentAccessor: (tx) => formatInlineDate(tx.transaction_date) },
    { key: 'person', header: 'Person', minWidth: 156, maxAutoWidth: 230, priority: 2, sortable: true, sortAccessor: (tx) => tx.balance_entity_name || tx.entity_name || '', contentAccessor: (tx) => tx.balance_entity_name || tx.entity_name || '-' },
    { key: 'description', header: 'Description', minWidth: 220, maxAutoWidth: 520, priority: 5, sortable: true, sortAccessor: (tx) => tx.description || '', contentAccessor: (tx) => tx.description || '-' },
    { key: 'memo', header: 'Memo', minWidth: 148, maxAutoWidth: 340, priority: 3, sortable: true, sortAccessor: (tx) => tx.memo || '', contentAccessor: (tx) => tx.memo || '-' },
    { key: 'amount', header: 'Amount', minWidth: 118, maxAutoWidth: 144, sortable: true, defaultSortDirection: 'desc', sortAccessor: (tx) => Number(tx.amount || 0), contentAccessor: (tx) => Number(tx.amount || 0).toFixed(2) },
    { key: 'running', header: 'Running IOU', minWidth: 166, maxAutoWidth: 196, sortable: true, defaultSortDirection: 'desc', sortAccessor: (tx) => Number(tx.running_balance || 0), contentAccessor: (tx) => Number(tx.running_balance || 0).toFixed(2) },
    { key: 'actions', header: 'Actions', minWidth: 182, maxAutoWidth: 204, sortable: false, contentAccessor: () => 'View Edit Delete Save' },
  ]), []);
  const entitiesTable = usePriorityTableLayout({
    tableRef: entitiesTableRef,
    rows: entityRows,
    columns: entitiesTableColumns,
  });
  const balanceLedgerTable = usePriorityTableLayout({
    tableRef: balanceLedgerTableRef,
    rows: selectedDebtorEntries,
    columns: balanceLedgerTableColumns,
  });
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
  const activateEntityRow = React.useCallback((id: number) => {
    setActiveEntityRowId(id);
  }, []);
  const activateRecurringRow = React.useCallback((id: number) => {
    setActiveRecurringRowId(id);
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
  const setEntityRowDraft = React.useCallback((row: Accumul8Entity, patch: EntityInlineDraft) => {
    setEntityDraftById((prev) => ({
      ...prev,
      [row.id]: {
        ...prev[row.id],
        ...patch,
      },
    }));
  }, []);
  const setPayBillRowDraft = React.useCallback((tx: Accumul8Transaction, patch: LedgerInlineDraft) => {
    const normalizedPatch: LedgerInlineDraft = { ...patch };
    if (Object.prototype.hasOwnProperty.call(patch, 'paid_date')) {
      normalizedPatch.is_paid = String(patch.paid_date || '').trim() ? 1 : 0;
    }
    setPayBillDraftById((prev) => ({
      ...prev,
      [tx.id]: {
        ...prev[tx.id],
        ...normalizedPatch,
      },
    }));
  }, []);
  const setRecurringRowDraft = React.useCallback((row: Accumul8RecurringPayment, patch: RecurringInlineDraft) => {
    setRecurringDraftById((prev) => ({
      ...prev,
      [row.id]: {
        ...prev[row.id],
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
      paid_date: draft.paid_date ?? tx.paid_date,
      entry_type: tx.entry_type,
      description: draft.description ?? tx.description,
      memo: draft.memo ?? tx.memo,
      amount: Number(draft.amount ?? tx.amount ?? 0),
      rta_amount: Number(draft.rta_amount ?? tx.rta_amount ?? 0),
      is_paid: Number(draft.is_paid ?? tx.is_paid ?? 0),
      is_reconciled: Number(draft.is_reconciled ?? tx.is_reconciled ?? 0),
      is_budget_planner: Number(draft.is_budget_planner ?? tx.is_budget_planner ?? 0),
      entity_id: draft.entity_id ?? tx.entity_id ?? null,
      account_id: draft.account_id ?? tx.account_id ?? null,
      balance_entity_id: draft.balance_entity_id ?? tx.balance_entity_id ?? null,
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
      paid_date: draft.paid_date ?? tx.paid_date,
      entry_type: tx.entry_type,
      description: draft.description ?? tx.description,
      memo: draft.memo ?? tx.memo,
      amount: Number(draft.amount ?? tx.amount ?? 0),
      rta_amount: Number(draft.rta_amount ?? tx.rta_amount ?? 0),
      is_paid: Number(draft.is_paid ?? tx.is_paid ?? 0),
      is_reconciled: Number(draft.is_reconciled ?? tx.is_reconciled ?? 0),
      is_budget_planner: Number(draft.is_budget_planner ?? tx.is_budget_planner ?? 0),
      entity_id: draft.entity_id ?? tx.entity_id ?? null,
      account_id: draft.account_id ?? tx.account_id ?? null,
      balance_entity_id: draft.balance_entity_id ?? tx.balance_entity_id ?? null,
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
  const saveEntityRow = React.useCallback(async (entity: Accumul8Entity) => {
    const draft = entityDraftById[entity.id];
    if (!draft) {
      return;
    }
    await updateEntity(entity.id, {
      display_name: draft.display_name ?? entity.display_name,
      entity_kind: draft.entity_kind ?? normalizeEntityKind(entity.entity_kind, entity.is_vendor),
      contact_type: draft.contact_type ?? normalizeEntityContactType(entity),
      is_payee: (draft.contact_type ?? normalizeEntityContactType(entity)) === 'payee' ? 1 : 0,
      is_payer: (draft.contact_type ?? normalizeEntityContactType(entity)) === 'payer' ? 1 : 0,
      is_vendor: (draft.entity_kind ?? normalizeEntityKind(entity.entity_kind, entity.is_vendor)) === 'business' ? 1 : 0,
      is_balance_person: (draft.contact_type ?? normalizeEntityContactType(entity)) === 'repayment' ? 1 : 0,
      default_amount: Number(draft.default_amount ?? entity.default_amount ?? 0),
      email: draft.email ?? entity.email ?? '',
      phone_number: draft.phone_number ?? entity.phone_number ?? '',
      street_address: draft.street_address ?? entity.street_address ?? '',
      city: draft.city ?? entity.city ?? '',
      state: draft.state ?? entity.state ?? '',
      zip: draft.zip ?? entity.zip ?? '',
      notes: draft.notes ?? entity.notes ?? '',
      is_active: Number(draft.is_active ?? entity.is_active ?? 0),
    });
    setEntityDraftById((prev) => {
      const next = { ...prev };
      delete next[entity.id];
      return next;
    });
    setActiveEntityRowId((current) => (current === entity.id ? null : current));
  }, [entityDraftById, updateEntity]);
  const saveEntityAlias = React.useCallback(async (entity: Accumul8Entity) => {
    await persistEntityAliases(entity.id, entity.display_name);
  }, [persistEntityAliases]);
  const removeEntityAlias = React.useCallback(async (aliasId: number) => {
    await deleteEntityAlias(aliasId);
  }, [deleteEntityAlias]);
  const saveRecurringRow = React.useCallback(async (row: Accumul8RecurringPayment) => {
    const draft = recurringDraftById[row.id];
    if (!draft) {
      return;
    }
    await updateRecurring(row.id, {
      title: draft.title ?? row.title,
      direction: row.direction,
      amount: Number(draft.amount ?? row.amount ?? 0),
      frequency: (draft.frequency ?? row.frequency) as Accumul8Frequency,
      payment_method: (draft.payment_method ?? row.payment_method) as Accumul8PaymentMethod,
      interval_count: Number(row.interval_count || 1),
      next_due_date: draft.next_due_date ?? row.next_due_date,
      entity_id: row.entity_id ?? null,
      account_id: draft.account_id ?? row.account_id ?? null,
      is_budget_planner: Number(draft.is_budget_planner ?? row.is_budget_planner ?? 0),
      notes: draft.notes ?? row.notes ?? '',
    });
    setRecurringDraftById((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
    setActiveRecurringRowId((current) => (current === row.id ? null : current));
  }, [recurringDraftById, updateRecurring]);
  React.useEffect(() => {
    return () => {
      if (flashSaveButtonTimeoutRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(flashSaveButtonTimeoutRef.current);
      }
    };
  }, []);
  React.useLayoutEffect(() => {
    if (!settingsMenuOpen || typeof window === 'undefined' || !settingsButtonRef.current) {
      return undefined;
    }

    const updateMenuPosition = () => {
      const buttonRect = settingsButtonRef.current?.getBoundingClientRect();
      if (!buttonRect) {
        return;
      }
      const menuWidth = Math.min(320, Math.max(220, Math.round(buttonRect.width + 48)));
      const viewportPadding = 12;
      const nextLeft = Math.min(
        Math.max(viewportPadding, buttonRect.left),
        Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding),
      );

      setSettingsMenuPosition({
        top: Math.round(buttonRect.bottom + 8),
        left: Math.round(nextLeft),
        width: menuWidth,
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [settingsMenuOpen]);
  React.useEffect(() => {
    if (!settingsMenuOpen || typeof document === 'undefined') {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!settingsMenuRef.current?.contains(event.target as Node)) {
        setSettingsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSettingsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [settingsMenuOpen]);
  React.useEffect(() => {
    const activeRows = [
      activeLedgerRowId !== null ? {
        key: `ledger-${activeLedgerRowId}`,
        hasDraft: Boolean(ledgerDraftById[activeLedgerRowId]),
        clear: () => setActiveLedgerRowId((current) => (current === activeLedgerRowId ? null : current)),
      } : null,
      activePayBillRowId !== null ? {
        key: `paybill-${activePayBillRowId}`,
        hasDraft: Boolean(payBillDraftById[activePayBillRowId]),
        clear: () => setActivePayBillRowId((current) => (current === activePayBillRowId ? null : current)),
      } : null,
      activeDebtorRowId !== null ? {
        key: `debtor-${activeDebtorRowId}`,
        hasDraft: Boolean(debtorDraftById[activeDebtorRowId]),
        clear: () => setActiveDebtorRowId((current) => (current === activeDebtorRowId ? null : current)),
      } : null,
      activeEntityRowId !== null ? {
        key: `entity-${activeEntityRowId}`,
        hasDraft: Boolean(entityDraftById[activeEntityRowId]),
        clear: () => setActiveEntityRowId((current) => (current === activeEntityRowId ? null : current)),
      } : null,
      activeRecurringRowId !== null ? {
        key: `recurring-${activeRecurringRowId}`,
        hasDraft: Boolean(recurringDraftById[activeRecurringRowId]),
        clear: () => setActiveRecurringRowId((current) => (current === activeRecurringRowId ? null : current)),
      } : null,
    ].filter(Boolean) as Array<{ key: string; hasDraft: boolean; clear: () => void }>;
    if (activeRows.length === 0 || typeof document === 'undefined') {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      for (const row of activeRows) {
        const node = inlineRowRefs.current[row.key];
        if (!node || node.contains(target)) {
          continue;
        }
        if (row.hasDraft) {
          flashSaveButton(row.key);
        }
        row.clear();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [activeDebtorRowId, activeEntityRowId, activeLedgerRowId, activePayBillRowId, activeRecurringRowId, debtorDraftById, entityDraftById, flashSaveButton, ledgerDraftById, payBillDraftById, recurringDraftById]);
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
              <h1 className="section-title mb-0 accumul8-title-mark">
                <span className="visually-hidden">ACCUMUL8</span>
                <picture className="accumul8-title-mark-picture" aria-hidden="true">
                  <source srcSet="/images/branding/accumul8-title.webp" type="image/webp" />
                  <img className="accumul8-title-mark-image" src="/images/branding/accumul8-title.png" alt="" />
                </picture>
              </h1>
              <div className="accumul8-header-control-deck">
                <div className="accumul8-header-primary-row">
                  <div className="accumul8-tabs accumul8-tabs--header">
                    <div className="accumul8-tabs accumul8-tabs--header-buttons">
                      {[
                        ['debtors', 'IOU'],
                        ['spreadsheet', 'Budget'],
                        ['ledger', 'Ledger'],
                        ['pay_bills', 'Pay Bills'],
                      ].map(([key, label]) => (
                        <button key={key} type="button" className={`btn ${tab === key ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab(key as TabKey)}>{label}</button>
                      ))}
                      <div className="accumul8-settings-menu-anchor" ref={settingsMenuRef}>
                        <button
                          ref={settingsButtonRef}
                          type="button"
                          className={`btn ${settingsMenuOpen ? 'btn-primary' : 'btn-outline-primary'}`}
                          aria-haspopup="dialog"
                          aria-expanded={settingsMenuOpen}
                          onClick={() => setSettingsMenuOpen((current) => !current)}
                        >
                          Settings
                        </button>
                        {settingsMenuOpen ? (
                          <div
                            className="accumul8-settings-modal"
                            role="dialog"
                            aria-label="Accumul8 settings sections"
                            style={{
                              top: `${settingsMenuPosition.top}px`,
                              left: `${settingsMenuPosition.left}px`,
                              width: `${settingsMenuPosition.width}px`,
                            }}
                          >
                            <div className="accumul8-settings-modal-actions">
                              <button
                                type="button"
                                className="btn btn-outline-primary"
                                onClick={() => {
                                  setTab('statements');
                                  setSettingsMenuOpen(false);
                                }}
                              >
                                Bank Statements
                              </button>
                              {[
                                ['contacts', 'Entities'],
                                ['entity_endex', 'Entity Endex'],
                                ['notifications', 'Notifications'],
                                ['recurring', 'Recurring'],
                                ['sync', 'Sync'],
                              ].map(([key, label]) => (
                                <button
                                  key={key}
                                  type="button"
                                  className={`btn ${tab === key ? 'btn-primary' : 'btn-outline-primary'}`}
                                  onClick={() => {
                                    setTab(key as TabKey);
                                    setSettingsMenuOpen(false);
                                  }}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="accumul8-owner-selector">
                    <select
                      id="accumul8-owner-select"
                      className="form-select form-select-sm"
                      aria-label="Viewing owner"
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
                <div className="accumul8-page-toolbar accumul8-page-toolbar--embedded">
                  <div className="accumul8-page-filters">
                    <div className="accumul8-filter-stack">
                      <div className="accumul8-toolbar-field accumul8-toolbar-field--banking-org">
                        <div className="accumul8-filter-control-row">
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm accumul8-filter-gear"
                            onClick={() => setBankingOrganizationManagerOpen(true)}
                            aria-label="Manage banking organizations"
                            title="Manage banking organizations"
                          >
                            <i className="bi bi-gear"></i>
                          </button>
                          <select
                            id="accumul8-group-filter"
                            className={getActiveFilterClass('form-select form-select-sm', selectedBankingOrganizationId !== '')}
                            aria-label="Banking Organization"
                            value={selectedBankingOrganizationId}
                            onChange={(e) => setSelectedBankingOrganizationId(e.target.value)}
                          >
                            <option value="">All Banking Organizations</option>
                            {bankingOrganizations.map((organization) => (
                              <option key={organization.id} value={organization.id}>{organization.banking_organization_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="accumul8-toolbar-field accumul8-toolbar-field--bank-account">
                        <div className="accumul8-filter-control-row">
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm accumul8-filter-gear"
                            onClick={() => setAccountManagerOpen(true)}
                            aria-label="Manage bank accounts"
                            title="Manage bank accounts"
                          >
                            <i className="bi bi-gear"></i>
                          </button>
                          <select
                            id="accumul8-bank-filter"
                            className={getActiveFilterClass('form-select form-select-sm', selectedBankAccountId !== '')}
                            aria-label="Bank account"
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
                    </div>
                    {launchableBankingOrganizations.length ? (
                      <div className="accumul8-bank-launcher-panel">
                        <div className="accumul8-bank-launcher-group" aria-label="Banking organization quick links">
                          {launchableBankingOrganizations.map((organization) => {
                            const organizationIconPath = resolveAccumul8BankingOrganizationIconPath(
                              organization.banking_organization_name,
                              organization.icon_path,
                            );

                            return (
                              <button
                                key={organization.id}
                                type="button"
                                className={`btn btn-outline-secondary btn-sm accumul8-bank-launcher${selectedBankingOrganizationId === String(organization.id) ? ' accumul8-bank-launcher--selected' : ''}`}
                                onClick={() => openBankingOrganizationPopup(organization.login_url, organization.banking_organization_name)}
                                aria-label={`Open ${organization.banking_organization_name}`}
                                title={`Open ${organization.banking_organization_name}`}
                              >
                                {organizationIconPath ? (
                                  <img
                                    className="accumul8-bank-launcher-icon"
                                    src={organizationIconPath}
                                    alt=""
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <span className="accumul8-bank-launcher-emoji" aria-hidden="true">🏦</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {tab === 'contacts' && (
                      <div className="accumul8-toolbar-summary" aria-label="Entity summary">
                        <div className="accumul8-summary-card"><span>Total</span><strong>{entitiesSorted.length}</strong></div>
                        <div className="accumul8-summary-card"><span>Payees/Payers</span><strong>{entitiesSorted.filter((entity) => Number(entity.is_payee || 0) === 1 || Number(entity.is_payer || 0) === 1).length}</strong></div>
                        <div className="accumul8-summary-card"><span>Businesses</span><strong>{entitiesSorted.filter((entity) => normalizeEntityKind(entity.entity_kind, entity.is_vendor) === 'business').length}</strong></div>
                        <div className="accumul8-summary-card"><span>Balance People</span><strong>{entitiesSorted.filter((entity) => Number(entity.is_balance_person || 0) === 1).length}</strong></div>
                      </div>
                    )}
                  </div>
                  <div className="accumul8-summary-grid">
                    <div className="accumul8-summary-card"><span>Current Balance</span><strong>{formatCurrencyAmount(headerSummary.currentBalance)}</strong></div>
                    <div className="accumul8-summary-card"><span>Projected Balance</span><strong>{formatCurrencyAmount(headerSummary.projectedBalance)}</strong></div>
                    <div className="accumul8-summary-card"><span>Unpaid Bills</span><strong>{formatCurrencyAmount(headerSummary.unpaidBills)}</strong></div>
                    <div className="accumul8-summary-card"><span>Upcoming Windfalls</span><strong>{formatCurrencyAmount(headerSummary.upcomingWindfalls)}</strong></div>
                  </div>
                </div>
              </div>
              <a
                className={`accumul8-header-brand-logo${syncingConnectionId !== null ? ' accumul8-header-brand-logo--syncing' : ''}`}
                href="https://catn8.us"
                aria-label="Go to catn8.us"
              >
                <WebpImage className="accumul8-header-brand-logo-image" src="/images/catn8_logo.png" alt="catn8.us Logo" />
              </a>
            </div>
          </div>
          <div className={`accumul8-tab-shell accumul8-tab-shell--${tab}`}>
          {tab === 'ledger' && (
            <div className="accumul8-panel accumul8-panel--viewport-fill">
              <div className="accumul8-panel-toolbar accumul8-panel-toolbar--ledger">
                <h3 className="mb-0">Ledger</h3>
                <div className="accumul8-panel-toolbar-controls accumul8-panel-toolbar-controls--ledger">
                  {renderDateRangeControls(
                    'ledger',
                    ledgerDateFilter,
                    setLedgerDateFilter,
                    customLedgerStartDate,
                    setCustomLedgerStartDate,
                    customLedgerEndDate,
                    setCustomLedgerEndDate,
                    true,
                  )}
                  <div className="accumul8-panel-toolbar-search">
                    <select
                      className={getActiveFilterClass('form-select form-select-sm', ledgerFilterPreset !== 'all')}
                      value={ledgerFilterPreset}
                      onChange={(e) => setLedgerFilterPreset(e.target.value as LedgerFilterPreset)}
                      aria-label="Ledger quick filter"
                    >
                      {LEDGER_FILTER_PRESET_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className={getActiveFilterClass('form-control form-control-sm', listSearchQueryByTab.ledger.trim() !== '')}
                      value={listSearchQueryByTab.ledger}
                      onChange={(e) => setListSearchQueryByTab((prev) => ({ ...prev, ledger: e.target.value }))}
                      placeholder="Search visible ledger rows"
                      aria-label="Search visible ledger rows"
                    />
                  </div>
                  <div className="accumul8-ledger-pagination-toolbar" aria-label="Ledger pagination controls">
                    <label className="visually-hidden" htmlFor="accumul8-ledger-page-mode">Ledger page size</label>
                    <select
                      id="accumul8-ledger-page-mode"
                      className={getActiveFilterClass('form-select form-select-sm', ledgerPaginationMode !== '100')}
                      value={ledgerPaginationMode}
                      onChange={(e) => setLedgerPaginationMode(e.target.value as LedgerPaginationMode)}
                      aria-label="Ledger page size"
                    >
                      <option value="100">100 older rows per page</option>
                      <option value="all">Show all on one page</option>
                    </select>
                    {ledgerPaginationMode !== 'all' && ledgerPagination.archivedCount > 0 ? (
                      <div className="accumul8-ledger-pagination-nav">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => setLedgerArchivePage((current) => Math.max(current - 1, 1))}
                          disabled={ledgerPagination.currentPage <= 1}
                        >
                          Prev
                        </button>
                        <span className="accumul8-ledger-pagination-status">
                          Older pages {ledgerPagination.currentPage} / {ledgerPagination.totalPages}
                        </span>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => setLedgerArchivePage((current) => Math.min(current + 1, ledgerPagination.totalPages))}
                          disabled={ledgerPagination.currentPage >= ledgerPagination.totalPages}
                        >
                          Next
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <button type="button" className="btn btn-success btn-sm" onClick={() => openCreateTransactionModal()} disabled={busy}>Add Ledger Entry</button>
              </div>
              <div className="accumul8-ledger-pagination-summary">
                {ledgerPaginationMode === 'all'
                  ? `Showing all ${ledgerPagination.totalRows} filtered ledger transaction${ledgerPagination.totalRows === 1 ? '' : 's'} on one page.`
                  : `Showing ${ledgerPagination.rows.length} filtered ledger transaction${ledgerPagination.rows.length === 1 ? '' : 's'} on this page, including ${ledgerPagination.recentCount} from the last 60 days and ${ledgerPagination.archivedCount} older transaction${ledgerPagination.archivedCount === 1 ? '' : 's'} split into ${ledgerPagination.totalPages} page${ledgerPagination.totalPages === 1 ? '' : 's'}.`}
              </div>
              <div className="table-responsive mt-3 accumul8-scroll-area accumul8-scroll-area--ledger">
                <table
                  ref={ledgerTableRef}
                  className="table table-sm accumul8-table accumul8-table--measured accumul8-table--ledger accumul8-ledger-table accumul8-sticky-head"
                  style={ledgerTable.tableStyle}
                >
                  <colgroup>
                    <col style={ledgerTable.getColumnStyle('date')} />
                    <col style={ledgerTable.getColumnStyle('due')} />
                    <col style={ledgerTable.getColumnStyle('account')} />
                    <col style={ledgerTable.getColumnStyle('description')} />
                    <col style={ledgerTable.getColumnStyle('memo')} />
                    <col style={ledgerTable.getColumnStyle('amount')} />
                    <col style={ledgerTable.getColumnStyle('balance')} />
                    <col style={ledgerTable.getColumnStyle('paid')} />
                    <col style={ledgerTable.getColumnStyle('reconciled')} />
                    <col style={ledgerTable.getColumnStyle('actions')} />
                  </colgroup>
                  <thead><tr>
                    <Accumul8TableHeaderCell label="Date" columnKey="date" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
                    <Accumul8TableHeaderCell label="Due" columnKey="due" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
                    <Accumul8TableHeaderCell label="Account" columnKey="account" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
                    <Accumul8TableHeaderCell label="Description" columnKey="description" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
                    <Accumul8TableHeaderCell label="Memo" columnKey="memo" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
                    <Accumul8TableHeaderCell label="Amount" columnKey="amount" className="text-end" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
                    <Accumul8TableHeaderCell label="Balance" columnKey="balance" className="text-end" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
                    <Accumul8TableHeaderCell label="Paid" columnKey="paid" className="text-center" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
                    <Accumul8TableHeaderCell label="Reconciled" columnKey="reconciled" className="text-center" sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
                    <Accumul8TableHeaderCell label="Actions" columnKey="actions" className="text-end" sortable={false} sortState={ledgerTable.sortState} onSort={ledgerTable.requestSort} onResizeStart={ledgerTable.startResize} />
                  </tr></thead>
                  <tbody>
                    {ledgerPagination.rows.map((tx) => (
                      (() => {
                        const txEditPolicy = getAccumul8TransactionEditPolicy(tx);
                        const statementLink = resolveAccumul8StatementLink(tx, statementUploads, selectedOwnerUserId || activeOwnerUserId || 0);
                        return (
                      <tr
                        key={tx.id}
                        ref={(node) => setInlineRowRef(`ledger-${tx.id}`, node)}
                        className={[
                          'accumul8-list-item',
                          tx.amount < 0 ? 'is-outflow' : 'is-inflow',
                          isOpeningBalanceTransaction(tx) ? 'is-opening-balance' : '',
                          activeLedgerRowId === tx.id ? 'is-editing' : '',
                          ledgerDraftById[tx.id] ? 'has-draft' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <td>
                          {activeLedgerRowId === tx.id ? (
                            <input className="form-control form-control-sm accumul8-month-table-input" type="date" value={ledgerDraftById[tx.id]?.transaction_date ?? tx.transaction_date} onChange={(e) => setLedgerRowDraft(tx, { transaction_date: e.target.value })} disabled={busy || !txEditPolicy.canEditCoreFields} />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineDate(tx.transaction_date)}</button>
                          )}
                        </td>
                        <td>
                          {activeLedgerRowId === tx.id ? (
                            <input className="form-control form-control-sm accumul8-month-table-input" type="date" value={ledgerDraftById[tx.id]?.due_date ?? tx.due_date ?? ''} onChange={(e) => setLedgerRowDraft(tx, { due_date: e.target.value })} disabled={busy || !txEditPolicy.canEditCoreFields} />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineDate(tx.due_date)}</button>
                          )}
                        </td>
                        <td>
                          <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineText(tx.account_name || tx.banking_organization_name, '-')}</button>
                        </td>
                        <td>
                          {activeLedgerRowId === tx.id ? (
                            <input className="form-control form-control-sm accumul8-month-table-input" value={ledgerDraftById[tx.id]?.description ?? tx.description} onChange={(e) => setLedgerRowDraft(tx, { description: e.target.value })} disabled={busy || !txEditPolicy.canEditCoreFields} />
                          ) : (
                            <button
                              type="button"
                              className={`accumul8-inline-cell-trigger${isOpeningBalanceTransaction(tx) ? ' accumul8-inline-cell-trigger--ledger-description' : ''}`}
                              onClick={() => activateLedgerRow(tx.id)}
                              disabled={busy}
                            >
                              {isOpeningBalanceTransaction(tx) && (
                                <span className="accumul8-opening-balance-pin">Pinned</span>
                              )}
                              <span>{getLedgerDescriptionLabel(tx, ledgerDraftById[tx.id])}</span>
                            </button>
                          )}
                        </td>
                        <td>
                          {activeLedgerRowId === tx.id ? (
                            <input className="form-control form-control-sm accumul8-month-table-input" value={ledgerDraftById[tx.id]?.memo ?? tx.memo} onChange={(e) => setLedgerRowDraft(tx, { memo: e.target.value })} disabled={busy} />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineText(tx.memo || tx.contact_name || tx.entity_name, '-')}</button>
                          )}
                        </td>
                        <td className="text-end">
                          {activeLedgerRowId === tx.id ? (
                            <input className="form-control form-control-sm accumul8-month-table-input" type="number" step="0.01" value={ledgerDraftById[tx.id]?.amount ?? tx.amount} onChange={(e) => setLedgerRowDraft(tx, { amount: Number(e.target.value) })} disabled={busy || !txEditPolicy.canEditCoreFields} />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{tx.amount.toFixed(2)}</button>
                          )}
                        </td>
                        <td className="text-end">{tx.running_balance.toFixed(2)}</td>
                        <td className="text-center accumul8-ledger-toggle-cell">
                          <input
                            className="form-check-input accumul8-ledger-checkbox"
                            type="checkbox"
                            checked={Number(ledgerDraftById[tx.id]?.is_paid ?? tx.is_paid) === 1}
                            onChange={(e) => setLedgerRowDraft(tx, { is_paid: e.target.checked ? 1 : 0 })}
                            disabled={busy || !txEditPolicy.canEditPaidState}
                            aria-label={`Mark ${tx.description} as paid`}
                          />
                        </td>
                        <td className="text-center accumul8-ledger-toggle-cell">
                          <input
                            className="form-check-input accumul8-ledger-checkbox"
                            type="checkbox"
                            checked={Number(ledgerDraftById[tx.id]?.is_reconciled ?? tx.is_reconciled) === 1}
                            onChange={(e) => setLedgerRowDraft(tx, { is_reconciled: e.target.checked ? 1 : 0 })}
                            disabled={busy}
                            aria-label={`Mark ${tx.description} as reconciled`}
                          />
                        </td>
                        <td className="text-end is-compact-actions">
                          <div className="accumul8-row-actions accumul8-row-actions--always-on">
                            {statementLink ? (
                              <a className="btn btn-sm btn-outline-primary accumul8-icon-action" href={statementLink.href} target="_blank" rel="noreferrer" aria-label={`Open statement for ${tx.description}`} title={statementLink.label}><span aria-hidden="true">{ACCUMUL8_STATEMENT_BUTTON_EMOJI}</span></a>
                            ) : null}
                            <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => beginViewTransaction(tx.id)} disabled={busy} aria-label={`View ${tx.description}`} title={`View ${tx.description}`}><span aria-hidden="true">{ACCUMUL8_VIEW_BUTTON_EMOJI}</span></button>
                            <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => activateLedgerRow(tx.id)} disabled={busy} aria-label={`Edit ${tx.description}`} title={`Edit ${tx.description}`}><span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span></button>
                            <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => handleDeleteTransaction(tx.id, tx.description)} disabled={busy || !txEditPolicy.canDelete} aria-label={`Delete ${tx.description}`} title={txEditPolicy.canDelete ? `Delete ${tx.description}` : `${txEditPolicy.sourceLabel} transactions cannot be deleted here`}><i className="bi bi-trash"></i></button>
                            {ledgerDraftById[tx.id] ? <button type="button" className={`btn btn-sm btn-outline-primary accumul8-icon-action${flashingSaveButtonKey === `ledger-${tx.id}` ? ' is-flashing' : ''}`} onClick={() => void saveLedgerRow(tx)} disabled={busy} aria-label={`Save ${tx.description}`} title={`Save ${tx.description}`}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button> : null}
                          </div>
                        </td>
                      </tr>
                        );
                      })()
                    ))}
                    {ledgerPagination.rows.length === 0 && (
                      <tr>
                        <td colSpan={11} className="text-center text-muted py-4">No ledger entries matched the current filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'spreadsheet' && (
            <div className="accumul8-panel accumul8-panel--viewport-fill">
              <Accumul8SpreadsheetView
                busy={busy}
                selectedMonth={budgetMonth}
                recurringPayments={budgetPlannerRecurringPayments}
                entities={contactEntities}
                accounts={scopedAccounts}
                onSelectedMonthChange={setBudgetMonth}
                onUpdateRecurring={updateRecurring}
                onDeleteRecurring={handleDeleteRecurring}
                onOpenRecurring={beginEditRecurring}
              />
            </div>
          )}
          {tab === 'debtors' && (
            <div className="accumul8-panel">
              <div className="accumul8-panel-toolbar mb-3">
                <h3 className="mb-0">Personal IOUs</h3>
                <div className="accumul8-panel-toolbar-search">
                  <input
                    type="text"
                    className={getActiveFilterClass('form-control form-control-sm', listSearchQueryByTab.debtors.trim() !== '')}
                    value={listSearchQueryByTab.debtors}
                    onChange={(e) => setListSearchQueryByTab((prev) => ({ ...prev, debtors: e.target.value }))}
                    placeholder="Filter IOU fields"
                    aria-label="Filter personal IOU fields"
                  />
                </div>
                <button type="button" className="btn btn-success btn-sm" onClick={openCreateDebtorModal} disabled={busy}>Add Person</button>
              </div>
              <div className="table-responsive mt-3 accumul8-scroll-area accumul8-scroll-area--debtors-list">
                <table
                  ref={debtorsTableRef}
                  className="table table-sm accumul8-table accumul8-table--measured accumul8-table--debtors accumul8-sticky-head"
                  style={debtorsTable.tableStyle}
                >
                  <colgroup>
                    <col style={debtorsTable.getColumnStyle('person')} />
                    <col style={debtorsTable.getColumnStyle('linkedEntity')} />
                    <col style={debtorsTable.getColumnStyle('charges')} />
                    <col style={debtorsTable.getColumnStyle('credits')} />
                    <col style={debtorsTable.getColumnStyle('net')} />
                    <col style={debtorsTable.getColumnStyle('activity')} />
                    <col style={debtorsTable.getColumnStyle('actions')} />
                  </colgroup>
                  <thead><tr>
                    <Accumul8TableHeaderCell label="Person" columnKey="person" sortState={debtorsTable.sortState} onSort={debtorsTable.requestSort} onResizeStart={debtorsTable.startResize} />
                    <Accumul8TableHeaderCell label="Linked Entity" columnKey="linkedEntity" sortState={debtorsTable.sortState} onSort={debtorsTable.requestSort} onResizeStart={debtorsTable.startResize} />
                    <Accumul8TableHeaderCell label="Charges" columnKey="charges" className="text-end" sortState={debtorsTable.sortState} onSort={debtorsTable.requestSort} onResizeStart={debtorsTable.startResize} />
                    <Accumul8TableHeaderCell label="Credits" columnKey="credits" className="text-end" sortState={debtorsTable.sortState} onSort={debtorsTable.requestSort} onResizeStart={debtorsTable.startResize} />
                    <Accumul8TableHeaderCell label="Net IOU" columnKey="net" className="text-end" sortState={debtorsTable.sortState} onSort={debtorsTable.requestSort} onResizeStart={debtorsTable.startResize} />
                    <Accumul8TableHeaderCell label="Last Activity" columnKey="activity" sortState={debtorsTable.sortState} onSort={debtorsTable.requestSort} onResizeStart={debtorsTable.startResize} />
                    <Accumul8TableHeaderCell label="Actions" columnKey="actions" className="text-end" sortable={false} sortState={debtorsTable.sortState} onSort={debtorsTable.requestSort} onResizeStart={debtorsTable.startResize} />
                  </tr></thead>
                  <tbody>
                    {debtorsTable.rows.map((debtor) => (
                      <tr ref={(node) => setInlineRowRef(`debtor-${debtor.id}`, node)} key={debtor.id} className={['accumul8-list-item', activeDebtorRowId === debtor.id ? 'is-editing' : '', debtorDraftById[debtor.id] ? 'has-draft' : ''].filter(Boolean).join(' ')}>
                        <td>
                          {activeDebtorRowId === debtor.id ? (
                            <input className="form-control form-control-sm accumul8-month-table-input" value={debtorDraftById[debtor.id]?.debtor_name ?? debtor.debtor_name} onChange={(e) => setDebtorRowDraft(debtor, { debtor_name: e.target.value })} disabled={busy} />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateDebtorRow(debtor.id)} disabled={busy}>{formatInlineText(debtor.entity_name || debtor.debtor_name, '-')}</button>
                          )}
                        </td>
                        <td>
                          {activeDebtorRowId === debtor.id ? (
                            <select
                              className="form-select form-select-sm accumul8-month-table-select"
                              value={String(debtorDraftById[debtor.id]?.contact_id ?? debtor.contact_id ?? '')}
                              onChange={(e) => {
                                const nextEntityId = e.target.value === '' ? null : Number(e.target.value);
                                const nextEntity = contactEntities.find((entity) => entity.id === nextEntityId) || null;
                                setDebtorRowDraft(debtor, {
                                  contact_id: nextEntity?.contact_id ?? null,
                                  contact_name: nextEntity?.display_name || '',
                                });
                              }}
                              disabled={busy}
                            >
                              <option value="">None</option>
                              {contactEntities.map((entity) => (
                                <option key={entity.id} value={entity.id}>{entity.display_name}</option>
                              ))}
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateDebtorRow(debtor.id)} disabled={busy}>{formatInlineText(debtor.contact_name, '-')}</button>
                          )}
                        </td>
                        <td className="text-end">{Number(debtor.total_loaned || 0).toFixed(2)}</td>
                        <td className="text-end">{Number(debtor.total_repaid || 0).toFixed(2)}</td>
                        <td className="text-end">{Number(debtor.outstanding_balance || 0).toFixed(2)}</td>
                        <td>
                          {activeDebtorRowId === debtor.id ? (
                            <input className="form-control form-control-sm accumul8-month-table-input" value={debtorDraftById[debtor.id]?.notes ?? debtor.notes ?? ''} onChange={(e) => setDebtorRowDraft(debtor, { notes: e.target.value })} disabled={busy} placeholder="Notes" />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateDebtorRow(debtor.id)} disabled={busy}>{formatInlineText(debtor.last_activity_date, '-')}</button>
                          )}
                        </td>
                        <td className="text-end is-compact-actions">
                          <div className="accumul8-row-actions accumul8-row-actions--always-on">
                            <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => setSelectedDebtorId(String(debtor.id))} disabled={busy} aria-label={`View ledger for ${debtor.debtor_name}`} title={`View ledger for ${debtor.debtor_name}`}><span aria-hidden="true">{ACCUMUL8_VIEW_BUTTON_EMOJI}</span></button>
                            <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => activateDebtorRow(debtor.id)} disabled={busy} aria-label={`Edit ${debtor.debtor_name}`} title={`Edit ${debtor.debtor_name}`}><span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span></button>
                            <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => { if (window.confirm('Delete this debtor? Linked ledger rows will remain but be unassigned.')) { void deleteDebtor(debtor.id); if (selectedDebtorId === String(debtor.id)) setSelectedDebtorId(''); } }} disabled={busy} aria-label={`Delete ${debtor.debtor_name}`}><i className="bi bi-trash"></i></button>
                            {debtorDraftById[debtor.id] ? <button type="button" className={`btn btn-sm btn-outline-primary accumul8-icon-action${flashingSaveButtonKey === `debtor-${debtor.id}` ? ' is-flashing' : ''}`} onClick={() => void saveDebtorRow(debtor)} disabled={busy} aria-label={`Save ${debtor.debtor_name}`} title={`Save ${debtor.debtor_name}`}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {debtorsTable.rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-4">No personal IOUs matched the current filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="accumul8-panel mt-3">
                <div className="d-flex justify-content-between align-items-center gap-2 mb-2 flex-wrap">
                  <h4 className="h6 mb-0">IOU Ledger</h4>
                  <div className="d-flex gap-2 accumul8-iou-ledger-controls">
                    <select className="form-select form-select-sm accumul8-iou-ledger-controls__select" value={selectedDebtorId} onChange={(e) => setSelectedDebtorId(e.target.value)}>
                      <option value="">All People</option>
                      {debtors.map((debtor) => <option key={debtor.id} value={debtor.id}>{debtor.debtor_name}</option>)}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary accumul8-iou-ledger-controls__button"
                      onClick={() => {
                        const selectedDebtor = debtors.find((debtor) => String(debtor.id) === selectedDebtorId) || null;
                        openCreateTransactionModal({ balanceEntityId: selectedDebtor?.entity_id ? String(selectedDebtor.entity_id) : '' });
                      }}
                      disabled={busy}
                    >
                      Add Charge / Credit
                    </button>
                  </div>
                </div>
                <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--ledger">
                  <table
                    ref={balanceLedgerTableRef}
                    className="table table-sm accumul8-table accumul8-table--measured accumul8-table--balance-ledger accumul8-sticky-head"
                    style={balanceLedgerTable.tableStyle}
                  >
                    <colgroup>
                      <col style={balanceLedgerTable.getColumnStyle('date')} />
                      <col style={balanceLedgerTable.getColumnStyle('person')} />
                      <col style={balanceLedgerTable.getColumnStyle('description')} />
                      <col style={balanceLedgerTable.getColumnStyle('memo')} />
                      <col style={balanceLedgerTable.getColumnStyle('amount')} />
                      <col style={balanceLedgerTable.getColumnStyle('running')} />
                      <col style={balanceLedgerTable.getColumnStyle('actions')} />
                    </colgroup>
                    <thead><tr>
                      <Accumul8TableHeaderCell label="Date" columnKey="date" sortState={balanceLedgerTable.sortState} onSort={balanceLedgerTable.requestSort} onResizeStart={balanceLedgerTable.startResize} />
                      <Accumul8TableHeaderCell label="Person" columnKey="person" sortState={balanceLedgerTable.sortState} onSort={balanceLedgerTable.requestSort} onResizeStart={balanceLedgerTable.startResize} />
                      <Accumul8TableHeaderCell label="Description" columnKey="description" sortState={balanceLedgerTable.sortState} onSort={balanceLedgerTable.requestSort} onResizeStart={balanceLedgerTable.startResize} />
                      <Accumul8TableHeaderCell label="Memo" columnKey="memo" sortState={balanceLedgerTable.sortState} onSort={balanceLedgerTable.requestSort} onResizeStart={balanceLedgerTable.startResize} />
                      <Accumul8TableHeaderCell label="Amount" columnKey="amount" className="text-end" sortState={balanceLedgerTable.sortState} onSort={balanceLedgerTable.requestSort} onResizeStart={balanceLedgerTable.startResize} />
                      <Accumul8TableHeaderCell label="Running IOU" columnKey="running" className="text-end" sortState={balanceLedgerTable.sortState} onSort={balanceLedgerTable.requestSort} onResizeStart={balanceLedgerTable.startResize} />
                      <Accumul8TableHeaderCell label="Actions" columnKey="actions" className="text-end" sortable={false} sortState={balanceLedgerTable.sortState} onSort={balanceLedgerTable.requestSort} onResizeStart={balanceLedgerTable.startResize} />
                    </tr></thead>
                    <tbody>
                      {balanceLedgerTable.rows.map((tx) => (
                        <tr
                          key={tx.id}
                          ref={(node) => setInlineRowRef(`ledger-${tx.id}`, node)}
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
                                value={String(ledgerDraftById[tx.id]?.balance_entity_id ?? tx.balance_entity_id ?? '')}
                                onChange={(e) => {
                                  const nextEntityId = e.target.value === '' ? null : Number(e.target.value);
                                  const nextEntity = balanceEntities.find((entity) => entity.id === nextEntityId) || null;
                                  setLedgerRowDraft(tx, {
                                    balance_entity_id: nextEntityId,
                                    balance_entity_name: nextEntity?.display_name || '',
                                  });
                                }}
                                disabled={busy}
                              >
                                <option value="">Unassigned</option>
                                {balanceEntities.map((entity) => (
                                  <option key={entity.id} value={entity.id}>{entity.display_name}</option>
                                ))}
                              </select>
                            ) : (
                              <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{formatInlineText(tx.balance_entity_name || tx.debtor_name, '-')}</button>
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
                              <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateLedgerRow(tx.id)} disabled={busy}>{getLedgerDescriptionLabel(tx, ledgerDraftById[tx.id])}</button>
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
                            {(() => {
                              const statementLink = resolveAccumul8StatementLink(tx, statementUploads, selectedOwnerUserId || activeOwnerUserId || 0);
                              return (
                                <div className="accumul8-row-actions accumul8-row-actions--always-on">
                                  {statementLink ? (
                                    <a className="btn btn-sm btn-outline-primary accumul8-icon-action" href={statementLink.href} target="_blank" rel="noreferrer" aria-label={`Open statement for ${tx.description}`} title={statementLink.label}><span aria-hidden="true">{ACCUMUL8_STATEMENT_BUTTON_EMOJI}</span></a>
                                  ) : null}
                                  <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => beginViewTransaction(tx.id)} disabled={busy} aria-label={`View ${tx.description}`} title={`View ${tx.description}`}><span aria-hidden="true">{ACCUMUL8_VIEW_BUTTON_EMOJI}</span></button>
                                  <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => activateLedgerRow(tx.id)} disabled={busy} aria-label={`Edit ${tx.description}`} title={`Edit ${tx.description}`}><span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span></button>
                                  <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => handleDeleteTransaction(tx.id, tx.description)} disabled={busy} aria-label={`Delete ${tx.description}`}><i className="bi bi-trash"></i></button>
                                  {ledgerDraftById[tx.id] ? <button type="button" className={`btn btn-sm btn-outline-primary accumul8-icon-action${flashingSaveButtonKey === `ledger-${tx.id}` ? ' is-flashing' : ''}`} onClick={() => void saveLedgerRow(tx)} disabled={busy} aria-label={`Save ${tx.description}`} title={`Save ${tx.description}`}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button> : null}
                                </div>
                              );
                            })()}
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
            <div className="accumul8-panel accumul8-panel--viewport-fill">
              <div className="accumul8-panel-toolbar mb-3">
                <h3 className="mb-0">Pay Bills</h3>
                {renderDateRangeControls(
                  'pay-bills',
                  payBillsDateFilter,
                  setPayBillsDateFilter,
                  customPayBillsStartDate,
                  setCustomPayBillsStartDate,
                  customPayBillsEndDate,
                  setCustomPayBillsEndDate,
                )}
                <div className="accumul8-panel-toolbar-search">
                  <input
                    type="text"
                    className={getActiveFilterClass('form-control form-control-sm', listSearchQueryByTab.pay_bills.trim() !== '')}
                    value={listSearchQueryByTab.pay_bills}
                    onChange={(e) => setListSearchQueryByTab((prev) => ({ ...prev, pay_bills: e.target.value }))}
                    placeholder="Filter bill fields"
                    aria-label="Filter pay bills fields"
                  />
                </div>
              </div>
              <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--bills">
                <table
                  ref={payBillsTableRef}
                  className="table table-sm accumul8-table accumul8-table--measured accumul8-table--pay-bills accumul8-sticky-head"
                  style={payBillsTable.tableStyle}
                >
                  <colgroup>
                    <col style={payBillsTable.getColumnStyle('due')} />
                    <col style={payBillsTable.getColumnStyle('paidDate')} />
                    <col style={payBillsTable.getColumnStyle('description')} />
                    <col style={payBillsTable.getColumnStyle('account')} />
                    <col style={payBillsTable.getColumnStyle('amount')} />
                    <col style={payBillsTable.getColumnStyle('status')} />
                    <col style={payBillsTable.getColumnStyle('actions')} />
                  </colgroup>
                  <thead><tr>
                    <Accumul8TableHeaderCell label="Due Date" columnKey="due" sortState={payBillsTable.sortState} onSort={payBillsTable.requestSort} onResizeStart={payBillsTable.startResize} />
                    <Accumul8TableHeaderCell label="Paid Date" columnKey="paidDate" sortState={payBillsTable.sortState} onSort={payBillsTable.requestSort} onResizeStart={payBillsTable.startResize} />
                    <Accumul8TableHeaderCell label="Description" columnKey="description" sortState={payBillsTable.sortState} onSort={payBillsTable.requestSort} onResizeStart={payBillsTable.startResize} />
                    <Accumul8TableHeaderCell label="Account" columnKey="account" sortState={payBillsTable.sortState} onSort={payBillsTable.requestSort} onResizeStart={payBillsTable.startResize} />
                    <Accumul8TableHeaderCell label="Amount" columnKey="amount" className="text-end" sortState={payBillsTable.sortState} onSort={payBillsTable.requestSort} onResizeStart={payBillsTable.startResize} />
                    <Accumul8TableHeaderCell label="Status" columnKey="status" sortState={payBillsTable.sortState} onSort={payBillsTable.requestSort} onResizeStart={payBillsTable.startResize} />
                    <Accumul8TableHeaderCell label="Actions" columnKey="actions" className="text-end" sortable={false} sortState={payBillsTable.sortState} onSort={payBillsTable.requestSort} onResizeStart={payBillsTable.startResize} />
                  </tr></thead>
                  <tbody>
                    {payBillsTable.rows.map((billTx) => (
                      (() => {
                        const billEditPolicy = getAccumul8TransactionEditPolicy(billTx);
                        const statementLink = resolveAccumul8StatementLink(billTx, statementUploads, selectedOwnerUserId || activeOwnerUserId || 0);
                        return (
                      <tr ref={(node) => setInlineRowRef(`paybill-${billTx.id}`, node)} key={billTx.id} className={['accumul8-list-item', activePayBillRowId === billTx.id ? 'is-editing' : '', payBillDraftById[billTx.id] ? 'has-draft' : ''].filter(Boolean).join(' ')}>
                        <td>
                          {activePayBillRowId === billTx.id ? (
                            <input
                              className="form-control form-control-sm accumul8-month-table-input"
                              type="date"
                              value={payBillDraftById[billTx.id]?.due_date ?? billTx.due_date ?? billTx.transaction_date}
                              onChange={(e) => setPayBillRowDraft(billTx, { due_date: e.target.value })}
                              disabled={busy || !billEditPolicy.canEditCoreFields}
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
                              value={payBillDraftById[billTx.id]?.paid_date ?? billTx.paid_date ?? ''}
                              onChange={(e) => setPayBillRowDraft(billTx, { paid_date: e.target.value })}
                              disabled={busy || !billEditPolicy.canEditPaidState}
                            />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activatePayBillRow(billTx.id)} disabled={busy}>{formatInlineDate(billTx.paid_date)}</button>
                          )}
                        </td>
                        <td>
                          {activePayBillRowId === billTx.id ? (
                            <input
                              className="form-control form-control-sm accumul8-month-table-input"
                              value={payBillDraftById[billTx.id]?.description ?? billTx.description}
                              onChange={(e) => setPayBillRowDraft(billTx, { description: e.target.value })}
                              disabled={busy || !billEditPolicy.canEditCoreFields}
                            />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activatePayBillRow(billTx.id)} disabled={busy}>{formatInlineText(billTx.description, '-')}</button>
                          )}
                        </td>
                        <td>
                          {activePayBillRowId === billTx.id ? (
                            <select
                              className="form-select form-select-sm accumul8-month-table-select"
                              value={String(payBillDraftById[billTx.id]?.account_id ?? billTx.account_id ?? '')}
                              onChange={(e) => setPayBillRowDraft(billTx, { account_id: e.target.value ? Number(e.target.value) : null })}
                              disabled={busy || !billEditPolicy.canEditCoreFields}
                            >
                              <option value="">No account</option>
                              {payBillsAccountOptions.map((account) => (
                                <option key={account.id} value={account.id}>{formatAccountOptionLabel(account)}</option>
                              ))}
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activatePayBillRow(billTx.id)} disabled={busy}>{formatInlineText(billTx.account_name, 'No account')}</button>
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
                              disabled={busy || !billEditPolicy.canEditCoreFields}
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
                              disabled={busy || !billEditPolicy.canEditPaidState}
                            >
                              <option value="0">Upcoming</option>
                              <option value="1">Paid</option>
                            </select>
                          ) : (
                            <button
                              type="button"
                              className={`accumul8-inline-cell-trigger${Number(billTx.is_paid || 0) !== 1 && (billTx.due_date || billTx.transaction_date) < todayDate ? ' accumul8-inline-cell-trigger--past-due' : ''}`}
                              onClick={() => activatePayBillRow(billTx.id)}
                              disabled={busy}
                            >
                              {Number(billTx.is_paid || 0) === 1 ? 'Paid' : ((billTx.due_date || billTx.transaction_date) < todayDate ? 'Past due' : 'Upcoming')}
                            </button>
                          )}
                        </td>
                        <td className="text-end">
                          <div className="accumul8-row-actions">
                            {statementLink ? (
                              <a className="btn btn-sm btn-outline-primary accumul8-icon-action" href={statementLink.href} target="_blank" rel="noreferrer" aria-label={`Open statement for ${billTx.description}`} title={statementLink.label}><span aria-hidden="true">{ACCUMUL8_STATEMENT_BUTTON_EMOJI}</span></a>
                            ) : null}
                            <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => beginViewTransaction(billTx.id)} disabled={busy} aria-label={`View ${billTx.description}`} title={`View ${billTx.description}`}><span aria-hidden="true">{ACCUMUL8_VIEW_BUTTON_EMOJI}</span></button>
                            <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => activatePayBillRow(billTx.id)} disabled={busy} aria-label={`Edit ${billTx.description}`} title={`Edit ${billTx.description}`}><span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span></button>
                            <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => { if (window.confirm('Delete this bill item?')) { void deleteTransaction(billTx.id); } }} disabled={busy || !billEditPolicy.canDelete} aria-label={`Delete ${billTx.description}`} title={billEditPolicy.canDelete ? `Delete ${billTx.description}` : `${billEditPolicy.sourceLabel} transactions cannot be deleted here`}><i className="bi bi-trash"></i></button>
                            {payBillDraftById[billTx.id] ? <button type="button" className={`btn btn-sm btn-outline-primary accumul8-icon-action${flashingSaveButtonKey === `paybill-${billTx.id}` ? ' is-flashing' : ''}`} onClick={() => void savePayBillRow(billTx)} disabled={busy} aria-label={`Save ${billTx.description}`} title={`Save ${billTx.description}`}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button> : null}
                          </div>
                        </td>
                      </tr>
                        );
                      })()
                    ))}
                    {payBillsTable.rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-4">No unpaid upcoming or past-due bills matched the current filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'contacts' && (
            <div className="accumul8-panel accumul8-panel--entity-manager accumul8-panel--viewport-fill">
              <div className="accumul8-panel-toolbar mb-3">
                <h3 className="mb-0">Entity Manager</h3>
                <div className="accumul8-panel-toolbar-search">
                  <input
                    type="text"
                    className={getActiveFilterClass('form-control form-control-sm', listSearchQueryByTab.contacts.trim() !== '')}
                    value={listSearchQueryByTab.contacts}
                    onChange={(e) => setListSearchQueryByTab((prev) => ({ ...prev, contacts: e.target.value }))}
                    placeholder="Filter entity fields"
                    aria-label="Filter entity fields"
                  />
                </div>
                <button type="button" className="btn btn-success btn-sm" onClick={() => openCreateEntityModal()} disabled={busy}>Add Entity</button>
              </div>
              <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--list">
                <table
                  ref={entitiesTableRef}
                  className={[
                    'table table-sm accumul8-table accumul8-table--measured accumul8-table--entities accumul8-sticky-head',
                    activeEntityRowId !== null ? 'has-active-inline-edit' : '',
                  ].filter(Boolean).join(' ')}
                  style={entitiesTable.tableStyle}
                >
                  <colgroup>
                    <col style={entitiesTable.getColumnStyle('name')} />
                    <col style={entitiesTable.getColumnStyle('roles')} />
                    <col style={entitiesTable.getColumnStyle('contactInfo')} />
                    <col style={entitiesTable.getColumnStyle('lastTransaction')} />
                    <col style={entitiesTable.getColumnStyle('status')} />
                    <col style={entitiesTable.getColumnStyle('actions')} />
                  </colgroup>
                  <thead>
                    <tr>
                      <Accumul8TableHeaderCell label="Name" columnKey="name" sortState={entitiesTable.sortState} onSort={entitiesTable.requestSort} onResizeStart={entitiesTable.startResize} />
                      <Accumul8TableHeaderCell label="Roles" columnKey="roles" sortState={entitiesTable.sortState} onSort={entitiesTable.requestSort} onResizeStart={entitiesTable.startResize} />
                      <Accumul8TableHeaderCell label="Contact Info" columnKey="contactInfo" sortState={entitiesTable.sortState} onSort={entitiesTable.requestSort} onResizeStart={entitiesTable.startResize} />
                      <Accumul8TableHeaderCell label="Last Transaction" columnKey="lastTransaction" className="text-end" sortState={entitiesTable.sortState} onSort={entitiesTable.requestSort} onResizeStart={entitiesTable.startResize} />
                      <Accumul8TableHeaderCell label="Status" columnKey="status" sortState={entitiesTable.sortState} onSort={entitiesTable.requestSort} onResizeStart={entitiesTable.startResize} />
                      <Accumul8TableHeaderCell label="Actions" columnKey="actions" className="text-end" sortable={false} sortState={entitiesTable.sortState} onSort={entitiesTable.requestSort} onResizeStart={entitiesTable.startResize} />
                    </tr>
                  </thead>
                  <tbody>
                    {entitiesTable.rows.map((entity) => {
                      const entityDraft = entityDraftById[entity.id];
                      const entitySummary = entityTransactionSummaryById[entity.id] || { count: 0, lastAmount: null, lastDate: '' };
                      const entityContactSummary = formatEntityContactSummary({
                        phone_number: entityDraft?.phone_number ?? entity.phone_number,
                        email: entityDraft?.email ?? entity.email,
                        street_address: entityDraft?.street_address ?? entity.street_address,
                        city: entityDraft?.city ?? entity.city,
                        state: entityDraft?.state ?? entity.state,
                        zip: entityDraft?.zip ?? entity.zip,
                      });
                      return (
                      <tr
                        key={entity.id}
                        ref={(node) => setInlineRowRef(`entity-${entity.id}`, node)}
                        className={[
                          'accumul8-list-item',
                          activeEntityRowId === entity.id ? 'is-editing' : '',
                          entityDraft ? 'has-draft' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <td>
                          {activeEntityRowId === entity.id ? (
                            <div className="accumul8-inline-stack">
                              <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text" value={entityDraft?.display_name ?? entity.display_name} onChange={(e) => setEntityRowDraft(entity, { display_name: e.target.value })} disabled={busy} />
                              <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={entityDraft?.notes ?? entity.notes ?? ''} onChange={(e) => setEntityRowDraft(entity, { notes: e.target.value })} disabled={busy} placeholder="Notes" />
                              <Accumul8EntityAliasEditor
                                entity={entity}
                                entities={entities}
                                draft={entityAliasDraftById[entity.id] || DEFAULT_ENTITY_ALIAS_DRAFT}
                                busy={busy}
                                onDraftChange={(draft) => setEntityAliasDraftById((prev) => ({ ...prev, [entity.id]: draft }))}
                                onAddAlias={() => saveEntityAlias(entity)}
                                onRemoveAlias={removeEntityAlias}
                              />
                            </div>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateEntityRow(entity.id)} disabled={busy}>
                              <span>{formatInlineText(entity.display_name, 'Unnamed entity')}</span>
                              {entity.notes ? <span className="small text-muted d-block">{entity.notes}</span> : null}
                              {entity.aliases.length > 0 ? (
                                <span className="small text-muted d-block accumul8-entity-alias-summary">
                                  Aliases: {entity.aliases.map((alias) => alias.alias_name).join(' | ')}
                                </span>
                              ) : null}
                            </button>
                          )}
                        </td>
                        <td>
                          {activeEntityRowId === entity.id ? (
                            <div className="accumul8-inline-stack">
                              <select
                                className="form-select form-select-sm accumul8-inline-editor accumul8-inline-editor--select"
                                value={entityDraft?.contact_type ?? normalizeEntityContactType(entity)}
                                onChange={(e) => setEntityRowDraft(entity, { contact_type: e.target.value as Accumul8ContactType })}
                                disabled={busy}
                              >
                                <option value="payee">Payee</option>
                                <option value="payer">Payer</option>
                                <option value="repayment">Repayment</option>
                              </select>
                              <div className="accumul8-inline-check-grid">
                                <label className="accumul8-inline-check">
                                  <input
                                    type="checkbox"
                                    checked={normalizeEntityKind(entityDraft?.entity_kind ?? entity.entity_kind, entityDraft?.is_vendor ?? entity.is_vendor) === 'business'}
                                    onChange={(e) => setEntityRowDraft(entity, {
                                      entity_kind: e.target.checked ? 'business' : 'contact',
                                      is_vendor: e.target.checked ? 1 : 0,
                                    })}
                                    disabled={busy}
                                  />
                                  <span>Business</span>
                                </label>
                              </div>
                            </div>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateEntityRow(entity.id)} disabled={busy}>{formatEntityRoles(entity)}</button>
                          )}
                        </td>
                        <td>
                          {activeEntityRowId === entity.id ? (
                            <div className="accumul8-inline-stack">
                              <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={entityDraft?.phone_number ?? entity.phone_number ?? ''} onChange={(e) => setEntityRowDraft(entity, { phone_number: e.target.value })} disabled={busy} placeholder="Phone" />
                              <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={entityDraft?.email ?? entity.email ?? ''} onChange={(e) => setEntityRowDraft(entity, { email: e.target.value })} disabled={busy} placeholder="Email" />
                              <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={entityDraft?.street_address ?? entity.street_address ?? ''} onChange={(e) => setEntityRowDraft(entity, { street_address: e.target.value })} disabled={busy} placeholder="Street address" />
                              <div className="accumul8-inline-grid accumul8-inline-grid--triple">
                                <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={entityDraft?.city ?? entity.city ?? ''} onChange={(e) => setEntityRowDraft(entity, { city: e.target.value })} disabled={busy} placeholder="City" />
                                <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={entityDraft?.state ?? entity.state ?? ''} onChange={(e) => setEntityRowDraft(entity, { state: e.target.value })} disabled={busy} placeholder="State" />
                                <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={entityDraft?.zip ?? entity.zip ?? ''} onChange={(e) => setEntityRowDraft(entity, { zip: e.target.value })} disabled={busy} placeholder="ZIP" />
                              </div>
                            </div>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateEntityRow(entity.id)} disabled={busy}>
                              {entityContactSummary.length > 0 ? entityContactSummary.map((line) => (
                                <span key={line} className="small text-muted d-block">{line}</span>
                              )) : <span className="small text-muted">No phone or email</span>}
                            </button>
                          )}
                        </td>
                        <td className="text-end">
                          <button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => setEntityHistoryEntityId(entity.id)} disabled={busy}>
                            {entitySummary.lastAmount === null ? '-' : Number(entitySummary.lastAmount || 0).toFixed(2)}
                            <span className="small text-muted d-block accumul8-inline-cell-meta">
                              {entitySummary.lastDate ? `${formatInlineDate(entitySummary.lastDate)} · ${entitySummary.count} tx` : `${entitySummary.count} tx`}
                            </span>
                          </button>
                        </td>
                        <td>
                          {activeEntityRowId === entity.id ? (
                            <select className="form-select form-select-sm accumul8-inline-editor accumul8-inline-editor--select" value={String(entityDraft?.is_active ?? entity.is_active)} onChange={(e) => setEntityRowDraft(entity, { is_active: Number(e.target.value) })} disabled={busy}>
                              <option value="1">Active</option>
                              <option value="0">Paused</option>
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateEntityRow(entity.id)} disabled={busy}>{Number(entity.is_active || 0) === 1 ? 'Active' : 'Paused'}</button>
                          )}
                        </td>
                        <td className="text-end is-compact-actions">
                          <div className="accumul8-row-actions accumul8-row-actions--always-on">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary accumul8-icon-action"
                              onClick={() => setEntityHistoryEntityId(entity.id)}
                              disabled={busy}
                              aria-label={`View transactions for ${entity.display_name}`}
                              title={`View transactions for ${entity.display_name}`}
                            >
                              <span aria-hidden="true">{ACCUMUL8_VIEW_BUTTON_EMOJI}</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary accumul8-icon-action"
                              onClick={() => activateEntityRow(entity.id)}
                              disabled={busy}
                              aria-label={`Edit ${entity.display_name}`}
                              title={`Edit ${entity.display_name}`}
                            >
                              <span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span>
                            </button>
                            {entityDraft ? (
                              <button
                                type="button"
                                className={`btn btn-sm btn-outline-primary accumul8-icon-action${flashingSaveButtonKey === `entity-${entity.id}` ? ' is-flashing' : ''}`}
                                onClick={() => void saveEntityRow(entity)}
                                disabled={busy}
                                aria-label={`Save ${entity.display_name}`}
                                title={`Save ${entity.display_name}`}
                              >
                                <span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span>
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )})}
                    {entitiesTable.rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">No entities matched the current filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
	          )}
	          {tab === 'entity_endex' && (
	            <div className="accumul8-panel accumul8-panel--entity-endex accumul8-panel--viewport-fill">
	              <div className="accumul8-panel-toolbar mb-3">
	                <div>
	                  <h3 className="mb-0">Entity Endex</h3>
	                  <p className="small text-muted mb-0">Search parent entities, inspect aliases, and jump straight into cleanup.</p>
	                </div>
	                <div className="accumul8-entity-endex-search">
	                  <input
	                    className="form-control form-control-sm"
	                    value={entityEndexQuery}
	                    onChange={(event) => setEntityEndexQuery(event.target.value)}
	                    placeholder="Search parents or aliases"
	                  />
	                </div>
	              </div>
	              <div className="accumul8-entity-endex-guide mb-3">
	                <div className="accumul8-entity-endex-guide-head">
	                  <h4>Grouping Guide</h4>
	                  <span className="small text-muted">Use these parent names when new statement imports create messy merchant variants.</span>
	                </div>
	                <div className="accumul8-entity-endex-guide-grid">
	                  {entityEndexGuides.map((guide) => (
	                    <div key={guide.parent_name} className="accumul8-entity-endex-guide-card">
	                      <strong>{guide.parent_name}</strong>
	                      <div className="accumul8-entity-endex-guide-rule">{guide.match_rule}</div>
	                      <div className="accumul8-entity-endex-guide-examples">
	                        {guide.examples.map((example) => (
	                          <span key={example} className="accumul8-entity-endex-chip">{example}</span>
	                        ))}
	                      </div>
	                    </div>
	                  ))}
	                </div>
	              </div>
	              <div className="accumul8-entity-endex-grid">
	                {entityEndexParents.map((entity) => {
	                  const linkedChildren = linkedAliasEntitiesByParentId[entity.id] || [];
	                  const summary = entityTransactionSummaryById[entity.id] || { count: 0, lastAmount: null, lastDate: '' };
	                  const matchingGuide = entityEndexGuideByParentKey[normalizeEntityAliasKey(entity.display_name)] || null;
	                  return (
	                    <article key={entity.id} className="accumul8-entity-endex-card">
	                      <div className="accumul8-entity-endex-card-head">
	                        <div>
	                          <h4>{entity.display_name}</h4>
	                          <div className="accumul8-entity-endex-meta">
	                            {Number(entity.legacy_contact_id || 0) > 0 || Number(entity.legacy_debtor_id || 0) > 0 ? 'Budget parent' : 'Alias parent'}
	                            {summary.count > 0 ? ` · ${summary.count} tx` : ''}
	                            {summary.lastDate ? ` · ${formatInlineDate(summary.lastDate)}` : ''}
	                          </div>
	                        </div>
	                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => beginEditEntity(entity.id)} disabled={busy}>Edit</button>
	                      </div>
	                      <div className="accumul8-entity-endex-section">
	                        <span className="accumul8-entity-endex-label">Aliases</span>
	                        <div className="accumul8-entity-endex-chip-row">
	                          {entity.aliases.length > 0 ? entity.aliases.map((alias) => (
	                            <span key={alias.id} className="accumul8-entity-endex-chip">{alias.alias_name}</span>
	                          )) : <span className="small text-muted">No aliases yet.</span>}
	                        </div>
	                      </div>
	                      {matchingGuide ? (
	                        <div className="accumul8-entity-endex-section">
	                          <span className="accumul8-entity-endex-label">Import Rule</span>
	                          <div className="small text-muted mb-2">{matchingGuide.match_rule}</div>
	                          <div className="accumul8-entity-endex-chip-row">
	                            {matchingGuide.examples.map((example) => (
	                              <span key={example} className="accumul8-entity-endex-chip">{example}</span>
	                            ))}
	                          </div>
	                        </div>
	                      ) : null}
	                      <div className="accumul8-entity-endex-section">
	                        <span className="accumul8-entity-endex-label">Hidden Linked Records</span>
	                        <div className="accumul8-entity-endex-linked-list">
	                          {linkedChildren.length > 0 ? linkedChildren.map((child) => {
	                            const childSummary = entityTransactionSummaryById[child.id] || { count: 0, lastAmount: null, lastDate: '' };
	                            return (
	                              <button key={child.id} type="button" className="accumul8-entity-endex-linked-item" onClick={() => beginEditEntity(child.id)} disabled={busy}>
	                                <span>{child.display_name}</span>
	                                <span className="small text-muted">{childSummary.count} tx</span>
	                              </button>
	                            );
	                          }) : <span className="small text-muted">No hidden linked records.</span>}
	                        </div>
	                      </div>
	                    </article>
	                  );
	                })}
	                {entityEndexParents.length === 0 ? (
	                  <div className="text-muted">No parent entities matched the current search.</div>
	                ) : null}
	              </div>
	            </div>
	          )}
          {tab === 'recurring' && (
            <div className="accumul8-panel accumul8-panel--viewport-fill">
              <div className="accumul8-panel-toolbar mb-3">
                <h3 className="mb-0">Recurring Payments</h3>
                <div className="accumul8-panel-toolbar-search">
                  <input
                    type="text"
                    className={getActiveFilterClass('form-control form-control-sm', listSearchQueryByTab.recurring.trim() !== '')}
                    value={listSearchQueryByTab.recurring}
                    onChange={(e) => setListSearchQueryByTab((prev) => ({ ...prev, recurring: e.target.value }))}
                    placeholder="Filter recurring fields"
                    aria-label="Filter recurring payment fields"
                  />
                </div>
                <button type="button" className="btn btn-success btn-sm" onClick={openCreateRecurringModal} disabled={busy}>Add Recurring Payment</button>
              </div>
              <div className="table-responsive mt-3 accumul8-scroll-area accumul8-scroll-area--recurring">
                <table
                  ref={recurringTableRef}
                  className="table table-sm accumul8-table accumul8-table--measured accumul8-table--recurring accumul8-sticky-head"
                  style={recurringTable.tableStyle}
                >
                    <colgroup>
                      <col style={recurringTable.getColumnStyle('title')} />
                      <col style={recurringTable.getColumnStyle('nextDue')} />
                      <col style={recurringTable.getColumnStyle('amount')} />
                      <col style={recurringTable.getColumnStyle('frequency')} />
                      <col style={recurringTable.getColumnStyle('account')} />
                      <col style={recurringTable.getColumnStyle('paymentMethod')} />
                      <col style={recurringTable.getColumnStyle('planner')} />
                      <col style={recurringTable.getColumnStyle('status')} />
                      <col style={recurringTable.getColumnStyle('actions')} />
                    </colgroup>
                  <thead><tr>
                    <Accumul8TableHeaderCell label="Title" columnKey="title" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
                    <Accumul8TableHeaderCell label="Next Due" columnKey="nextDue" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
                    <Accumul8TableHeaderCell label="Amount" columnKey="amount" className="text-end" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
                    <Accumul8TableHeaderCell label="Frequency" columnKey="frequency" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
                    <Accumul8TableHeaderCell label="Account" columnKey="account" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
                    <Accumul8TableHeaderCell label="Payment Method" columnKey="paymentMethod" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
                    <Accumul8TableHeaderCell label="Planner" columnKey="planner" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
                    <Accumul8TableHeaderCell label="Status" columnKey="status" sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
                    <Accumul8TableHeaderCell label="Actions" columnKey="actions" className="text-end" sortable={false} sortState={recurringTable.sortState} onSort={recurringTable.requestSort} onResizeStart={recurringTable.startResize} />
                  </tr></thead>
                  <tbody>
                    {recurringTable.rows.map((rp) => {
                      const recurringDraft = recurringDraftById[rp.id];
                      return (
                      <tr ref={(node) => setInlineRowRef(`recurring-${rp.id}`, node)} key={rp.id} className={['accumul8-list-item', activeRecurringRowId === rp.id ? 'is-editing' : '', recurringDraft ? 'has-draft' : ''].filter(Boolean).join(' ')}>
                        <td>
                          {activeRecurringRowId === rp.id ? (
                            <div className="accumul8-inline-stack">
                              <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text" value={recurringDraft?.title ?? rp.title} onChange={(e) => setRecurringRowDraft(rp, { title: e.target.value })} disabled={busy} />
                              <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--text accumul8-inline-editor--muted" value={recurringDraft?.notes ?? rp.notes ?? ''} onChange={(e) => setRecurringRowDraft(rp, { notes: e.target.value })} disabled={busy} placeholder="Notes" />
                            </div>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateRecurringRow(rp.id)} disabled={busy}>
                              {formatInlineText(rp.title, 'Untitled recurring payment')}
                              {rp.notes ? <span className="small text-muted d-block">{rp.notes}</span> : null}
                            </button>
                          )}
                        </td>
                        <td>
                          {activeRecurringRowId === rp.id ? (
                            <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--date" type="date" value={recurringDraft?.next_due_date ?? rp.next_due_date} onChange={(e) => setRecurringRowDraft(rp, { next_due_date: e.target.value })} disabled={busy} />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateRecurringRow(rp.id)} disabled={busy}>{formatInlineDate(rp.next_due_date)}</button>
                          )}
                        </td>
                        <td className="text-end">
                          {activeRecurringRowId === rp.id ? (
                            <input className="form-control form-control-sm accumul8-inline-editor accumul8-inline-editor--numeric" type="number" step="0.01" value={recurringDraft?.amount ?? rp.amount} onChange={(e) => setRecurringRowDraft(rp, { amount: Number(e.target.value) })} disabled={busy} />
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger accumul8-inline-cell-trigger--numeric" onClick={() => activateRecurringRow(rp.id)} disabled={busy}>{Number(rp.amount || 0).toFixed(2)}</button>
                          )}
                        </td>
                        <td>
                          {activeRecurringRowId === rp.id ? (
                            <select className="form-select form-select-sm accumul8-inline-editor accumul8-inline-editor--select" value={recurringDraft?.frequency ?? rp.frequency} onChange={(e) => setRecurringRowDraft(rp, { frequency: e.target.value as Accumul8Frequency })} disabled={busy}>
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="biweekly">Biweekly</option>
                              <option value="monthly">Monthly</option>
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateRecurringRow(rp.id)} disabled={busy}>{formatInlineText(rp.frequency)}</button>
                          )}
                        </td>
                        <td>
                          {activeRecurringRowId === rp.id ? (
                            <select
                              className="form-select form-select-sm accumul8-inline-editor accumul8-inline-editor--select"
                              value={String(recurringDraft?.account_id ?? rp.account_id ?? '')}
                              onChange={(e) => setRecurringRowDraft(rp, { account_id: e.target.value ? Number(e.target.value) : null })}
                              disabled={busy}
                            >
                              <option value="">No account</option>
                              {payBillsAccountOptions.map((account) => (
                                <option key={account.id} value={account.id}>{formatAccountOptionLabel(account)}</option>
                              ))}
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateRecurringRow(rp.id)} disabled={busy}>{formatInlineText(rp.account_name, 'No account')}</button>
                          )}
                        </td>
                        <td>
                          {activeRecurringRowId === rp.id ? (
                            <select className="form-select form-select-sm accumul8-inline-editor accumul8-inline-editor--select" value={recurringDraft?.payment_method ?? rp.payment_method} onChange={(e) => setRecurringRowDraft(rp, { payment_method: e.target.value as Accumul8PaymentMethod })} disabled={busy}>
                              {Object.entries(RECURRING_PAYMENT_METHOD_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateRecurringRow(rp.id)} disabled={busy}>{RECURRING_PAYMENT_METHOD_LABELS[(rp.payment_method || 'unspecified') as Accumul8PaymentMethod]}</button>
                          )}
                        </td>
                        <td>
                          {activeRecurringRowId === rp.id ? (
                            <select className="form-select form-select-sm accumul8-inline-editor accumul8-inline-editor--select" value={String(recurringDraft?.is_budget_planner ?? rp.is_budget_planner)} onChange={(e) => setRecurringRowDraft(rp, { is_budget_planner: Number(e.target.value) })} disabled={busy}>
                              <option value="1">Shown</option>
                              <option value="0">Hidden</option>
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateRecurringRow(rp.id)} disabled={busy}>{rp.is_budget_planner ? 'Shown' : 'Hidden'}</button>
                          )}
                        </td>
                        <td>
                          {activeRecurringRowId === rp.id ? (
                            <select className="form-select form-select-sm accumul8-inline-editor accumul8-inline-editor--select" value={String(recurringDraft?.is_active ?? rp.is_active)} onChange={(e) => setRecurringRowDraft(rp, { is_active: Number(e.target.value) })} disabled={busy}>
                              <option value="1">Active</option>
                              <option value="0">Paused</option>
                            </select>
                          ) : (
                            <button type="button" className="accumul8-inline-cell-trigger" onClick={() => activateRecurringRow(rp.id)} disabled={busy}>{rp.is_active ? 'Active' : 'Paused'}</button>
                          )}
                        </td>
                        <td className="text-end is-compact-actions">
                          <div className="accumul8-row-actions accumul8-row-actions--always-on">
                            <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => beginEditRecurring(rp.id)} disabled={busy} aria-label={`View ${rp.title}`} title={`View ${rp.title}`}><span aria-hidden="true">{ACCUMUL8_VIEW_BUTTON_EMOJI}</span></button>
                            <button type="button" className="btn btn-sm btn-outline-primary accumul8-icon-action" onClick={() => activateRecurringRow(rp.id)} disabled={busy} aria-label={`Edit ${rp.title}`} title={`Edit ${rp.title}`}><span aria-hidden="true">{ACCUMUL8_EDIT_BUTTON_EMOJI}</span></button>
                            <button type="button" className="btn btn-sm btn-outline-danger accumul8-icon-action" onClick={() => { if (window.confirm('Delete this recurring payment?')) { void deleteRecurring(rp.id); } }} disabled={busy} aria-label={`Delete ${rp.title}`}><i className="bi bi-trash"></i></button>
                            {recurringDraft ? <button type="button" className={`btn btn-sm btn-outline-primary accumul8-icon-action${flashingSaveButtonKey === `recurring-${rp.id}` ? ' is-flashing' : ''}`} onClick={() => void saveRecurringRow(rp)} disabled={busy} aria-label={`Save ${rp.title}`} title={`Save ${rp.title}`}><span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span></button> : null}
                          </div>
                        </td>
                      </tr>
                    )})}
                    {recurringTable.rows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center text-muted py-4">No recurring payments matched the current filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'notifications' && (
            <div className="accumul8-panel accumul8-panel--viewport-fill">
              <div className="accumul8-panel-toolbar">
                <div>
                  <h3 className="mb-1">Notification Rules</h3>
                  <p className="small text-muted mb-0">Build due-date alerts with the same ledger styling as the rest of Accumul8.</p>
                </div>
              </div>
              <form className="row g-2 accumul8-notification-form" onSubmit={(e) => {
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
                <div className="col-md-2">
                  <div className="accumul8-notification-actions">
                    <button
                      className="btn btn-success flex-fill"
                      type="submit"
                      disabled={busy}
                      aria-label={editingNotificationRuleId ? 'Save notification rule' : 'Create notification rule'}
                      title={editingNotificationRuleId ? 'Save notification rule' : 'Create notification rule'}
                    >
                      <span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span>
                    </button>
                  </div>
                </div>
                {editingNotificationRuleId ? <div className="col-md-2"><div className="accumul8-notification-actions"><button className="btn btn-outline-secondary flex-fill" type="button" onClick={resetNotificationForm} disabled={busy}>Cancel</button></div></div> : null}
              </form>
              <div className="mt-3 d-flex flex-column gap-2 accumul8-scroll-area accumul8-scroll-area--cards">
                {notificationRules.map((r) => (
                  <div key={r.id} className="catn8-card d-flex justify-content-between align-items-center gap-2 accumul8-list-item accumul8-notification-card">
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
            <div className="accumul8-panel accumul8-panel--viewport-fill">
              <h3>Bank Sync Groundwork</h3>
              <p className="mb-2">Provider: <strong>{syncProvider.provider}</strong> ({syncProvider.env}). Configuration status: <strong>{syncProvider.configured ? 'Configured' : 'Missing API keys'}</strong>.</p>
              <div className="d-flex gap-2 flex-wrap mb-3">
                <button type="button" className="btn btn-outline-primary" onClick={() => void runTellerConnect()} disabled={busy || !syncProvider.configured}>Connect Bank via Teller</button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => openSyncHelp()}>Show Setup Guide</button>
              </div>
              <h4 className="h6">Connected Institutions</h4>
              <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--sync">
                <table
                  ref={syncTableRef}
                  className="table table-sm accumul8-table accumul8-table--measured accumul8-table--sync-list accumul8-sticky-head"
                  style={syncTable.tableStyle}
                >
                  <colgroup>
                    <col style={syncTable.getColumnStyle('institution')} />
                    <col style={syncTable.getColumnStyle('status')} />
                    <col style={syncTable.getColumnStyle('lastSync')} />
                    <col style={syncTable.getColumnStyle('actions')} />
                  </colgroup>
                  <thead><tr>
                    <Accumul8TableHeaderCell label="Institution" columnKey="institution" sortState={syncTable.sortState} onSort={syncTable.requestSort} onResizeStart={syncTable.startResize} />
                    <Accumul8TableHeaderCell label="Status" columnKey="status" sortState={syncTable.sortState} onSort={syncTable.requestSort} onResizeStart={syncTable.startResize} />
                    <Accumul8TableHeaderCell label="Last Sync" columnKey="lastSync" sortState={syncTable.sortState} onSort={syncTable.requestSort} onResizeStart={syncTable.startResize} />
                    <Accumul8TableHeaderCell label="Actions" columnKey="actions" sortable={false} sortState={syncTable.sortState} onSort={syncTable.requestSort} onResizeStart={syncTable.startResize} />
                  </tr></thead>
                  <tbody>
                    {syncTable.rows.map((c: any) => (
                      <tr key={c.id}>
                        <td>
                          <div className="accumul8-sync-institution-name">{c.institution_name || c.institution_id || 'Unknown'}</div>
                          <div className="accumul8-sync-meta">
                            Enrollment: {c.teller_enrollment_id || 'Not stored yet'}
                          </div>
                          <div className="accumul8-sync-linked-accounts">
                            {(linkedAccountsByConnectionId[Number(c.id || 0)] || []).length > 0 ? (
                              (linkedAccountsByConnectionId[Number(c.id || 0)] || []).map((account) => (
                                <div key={account.id} className="accumul8-sync-linked-account">
                                  {formatAccountMappingLabel(account)}
                                  <div className="accumul8-sync-meta">
                                    {formatAccountBackfillNote(account)}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="accumul8-sync-empty">No local account mappings yet. Run Sync to import and map Teller accounts.</div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className={`accumul8-sync-status${isTellerRateLimited(String(c.last_error || '')) ? ' is-rate-limited' : ''}`}>
                            {formatSyncStatusLabel(String(c.status || ''), String(c.last_error || ''))}
                          </div>
                          {c.last_error ? <div className="accumul8-sync-error">{formatSyncStatusMessage(String(c.last_error || ''))}</div> : null}
                        </td>
                        <td>{c.last_sync_at || '-'}</td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => void runConnectionSync(Number(c.id || 0), String(c.institution_name || c.institution_id || 'Unknown'))}
                            disabled={busy}
                          >
                            {syncingConnectionId === Number(c.id || 0) ? 'Syncing...' : 'Sync'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lastSyncReport ? (
                <div className="accumul8-sync-report mt-3">
                  <div className="accumul8-sync-report__header">
                    <strong>Last Sync Report:</strong> {lastSyncReport.institutionName} at {lastSyncReport.syncedAt.replace('T', ' ').slice(0, 19)}
                  </div>
                  <div className="accumul8-sync-report__summary">
                    Added {lastSyncReport.result.added}, modified {lastSyncReport.result.modified}, unchanged {lastSyncReport.result.unchanged}, removed {lastSyncReport.result.removed}.
                  </div>
                  <div className="accumul8-sync-report__accounts">
                    {lastSyncReport.result.accounts.length > 0 ? (
                      lastSyncReport.result.accounts.map((account) => (
                        <div key={`${account.remote_account_id}-${account.local_account_id}`} className="accumul8-sync-report__account">
                          <div className="accumul8-sync-report__account-title">
                            {formatSyncSummaryAccountLabel(account)}
                          </div>
                          <div className="accumul8-sync-report__account-meta">
                            {account.mapping_action === 'created' ? 'Created' : 'Updated'} local account #{account.local_account_id}: {account.local_account_name || 'Unnamed local account'}
                          </div>
                          {account.history_start_date && account.history_end_date ? (
                            <div className="accumul8-sync-report__account-meta">
                              Teller history returned: {account.history_start_date} to {account.history_end_date}.
                            </div>
                          ) : null}
                          <div className="accumul8-sync-report__account-meta">
                            {formatSyncSummaryBackfillNote(account)}
                          </div>
                          <div className="accumul8-sync-report__account-meta">
                            Transactions added: {account.transactions_added}; modified: {account.transactions_modified}; unchanged: {account.transactions_unchanged}; removed: {account.transactions_removed}.
                          </div>
                          <div className="accumul8-sync-report__account-meta">
                            Cleanup removed {account.stale_teller_removed} stale Teller row{account.stale_teller_removed === 1 ? '' : 's'} and {account.statement_imports_removed} statement import row{account.statement_imports_removed === 1 ? '' : 's'} inside Teller's returned history window.
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="accumul8-sync-empty">No Teller accounts were returned in the most recent sync.</div>
                    )}
                  </div>
                </div>
              ) : null}
              <p className="small text-muted mb-0">Teller accounts are matched by Teller’s stable account IDs and enrollment IDs. On sync, Accumul8 creates or updates a local account record for each returned Teller account and then attaches transactions to that mapped local account.</p>
            </div>
          )}
          {tab === 'statements' && (
            <div className="accumul8-panel accumul8-panel--viewport-fill">
              <Accumul8StatementsPanel
                busy={busy}
                accounts={accounts}
                bankingOrganizations={bankingOrganizations}
                statementUploads={statementUploads}
                archivedStatementUploads={archivedStatementUploads}
                statementAuditRuns={statementAuditRuns}
                transactions={transactions}
                ownerUserId={selectedOwnerUserId || activeOwnerUserId || 0}
                onUpload={uploadStatement}
                onRescan={rescanStatementUpload}
                onUpdateMetadata={updateStatementUploadMetadata}
                onArchiveStatement={archiveStatementUpload}
                onRestoreStatement={restoreStatementUpload}
                onDeleteArchivedStatement={deleteArchivedStatementUpload}
                onConfirmImport={confirmStatementImport}
                onReconcile={reconcileStatementUpload}
                onImportReviewRow={importStatementReviewRow}
                onLinkReviewRow={linkStatementReviewRow}
                onSearch={searchStatementUploads}
                onAuditStatements={auditStatementUploads}
                onAuditImportedCleanup={auditImportedTransactionCleanup}
                onPurgeImportedCleanup={purgeImportedTransactionCleanup}
                onPurgeAllImportedTransactions={purgeAllImportedStatementTransactions}
                onPurgeAllStatementUploads={purgeAllStatementUploads}
                onOpenTransaction={beginViewTransaction}
                onDeleteTransaction={handleDeleteTransaction}
              />
            </div>
          )}
          </div>
          {syncHelpOpen && (
            <div className="accumul8-help-overlay" role="dialog" aria-modal="true" aria-label="Teller setup guide">
              <div className="accumul8-help-modal">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h4 className="h6 mb-0">Teller Sync Setup Guide</h4>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSyncHelpOpen(false)}>Close</button>
                </div>
                {syncHelpError ? <div className="alert alert-warning py-2"><strong>Current error:</strong> {syncHelpError}</div> : null}
                {syncHelpToken ? <div className="alert alert-success py-2"><strong>Teller application loaded:</strong> <code>{syncHelpToken.slice(0, 40)}...</code></div> : null}
                <ol className="mb-2 ps-3">
                  <li>Create your Teller application credentials in <a href="https://teller.io/dashboard" target="_blank" rel="noreferrer">Teller Dashboard</a>.</li>
                  <li>Save your Teller Application ID, certificate PEM, private key PEM, and environment in Settings.</li>
                  <li>Click <strong>Connect Bank via Teller</strong> in this tab.</li>
                  <li>Complete Teller Connect and authorize your institution.</li>
                  <li>Accumul8 will automatically exchange token, save the connection, and sync transactions.</li>
                </ol>
                <div className="small">
                  Quick references: <a href="https://teller.io/docs/connect" target="_blank" rel="noreferrer">Teller Connect</a> | <a href="https://teller.io/docs/api" target="_blank" rel="noreferrer">Teller API</a>
                </div>
              </div>
            </div>
          )}
          {selectedEntityHistory && (
            <div className="accumul8-help-overlay" role="dialog" aria-modal="true" aria-label={`${selectedEntityHistory.display_name} transactions`} onClick={() => setEntityHistoryEntityId(null)}>
              <div className="accumul8-help-modal accumul8-entity-history-modal" onClick={(e) => e.stopPropagation()}>
                <div className="accumul8-settings-modal-header">
                  <div>
                    <h2 className="accumul8-settings-modal-title mb-0">{selectedEntityHistory.display_name}</h2>
                    <div className="small text-muted">
                      {selectedEntityTransactions.length} linked transaction{selectedEntityTransactions.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <StandardIconButton
                      iconKey="edit"
                      ariaLabel={`Edit ${selectedEntityHistory.display_name}`}
                      title={`Edit ${selectedEntityHistory.display_name}`}
                      className="btn btn-outline-primary btn-sm catn8-action-icon-btn"
                      onClick={() => {
                        setEntityHistoryEntityId(null);
                        beginEditEntity(selectedEntityHistory.id);
                      }}
                    />
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEntityHistoryEntityId(null)}>Close</button>
                  </div>
                </div>
                <div className="table-responsive accumul8-scroll-area accumul8-scroll-area--cards">
                  <table className="table table-sm accumul8-table accumul8-entity-history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Memo</th>
                        <th>Account</th>
                        <th className="text-end">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEntityTransactions.map((tx) => (
                        <tr key={tx.id} className={Number(tx.amount || 0) < 0 ? 'is-outflow' : 'is-inflow'}>
                          <td>{formatInlineDate(tx.transaction_date || tx.due_date)}</td>
                          <td>{getLedgerDescriptionLabel(tx)}</td>
                          <td>{formatInlineText(tx.memo, '-')}</td>
                          <td>{formatInlineText(tx.account_name || tx.banking_organization_name, '-')}</td>
                          <td className="text-end">{Number(tx.amount || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                      {selectedEntityTransactions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center text-muted py-4">No transactions are linked to this entity yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        <Accumul8EntityModal
            open={entityModalOpen}
            busy={busy}
            initialForm={entityForm}
            entity={editingEntity}
            entities={entities}
            aliasDraft={editingEntity && entityAliasDraftById[editingEntity.id] ? entityAliasDraftById[editingEntity.id] : DEFAULT_ENTITY_ALIAS_DRAFT}
            entitySummary={editingEntity ? (entityTransactionSummaryById[editingEntity.id] || { count: 0, lastAmount: null, lastDate: '' }) : null}
            editing={editingEntityId !== null}
            onClose={closeEntityModal}
            onAliasDraftChange={(draft) => {
              if (!editingEntity) return;
              setEntityAliasDraftById((prev) => ({ ...prev, [editingEntity.id]: draft }));
            }}
            onAddAlias={async () => {
              if (!editingEntity) return;
              await saveEntityAlias(editingEntity);
            }}
            onDeleteAlias={removeEntityAlias}
            onSave={submitEntityForm}
        />
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
          entities={contactEntities}
          accounts={visibleAccounts}
          onClose={closeRecurringModal}
          onSave={submitRecurringModal}
        />
        <Accumul8TransactionModal
            open={transactionModalOpen}
            busy={busy}
            initialForm={ledgerForm}
            mode={transactionModalMode}
            transaction={editingTransactionId !== null
              ? (transactions.find((tx) => tx.id === editingTransactionId) || null)
              : viewingTransactionId !== null
                ? (transactions.find((tx) => tx.id === viewingTransactionId) || null)
                : null}
            entities={entitiesSorted}
            accounts={visibleAccounts}
            statementUploads={statementUploads}
            ownerUserId={selectedOwnerUserId || activeOwnerUserId || 0}
            onClose={closeTransactionModal}
            onEdit={transactionModalMode === 'view' && viewingTransactionId !== null ? () => beginEditTransaction(viewingTransactionId) : undefined}
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

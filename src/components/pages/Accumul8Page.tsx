import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { Accumul8AIcountantPanel } from '../accumul8/Accumul8AIcountantPanel';
import { Accumul8TableHeaderCell } from '../accumul8/Accumul8TableHeaderCell';
import {
  ACCUMUL8_EDIT_BUTTON_EMOJI,
  ACCUMUL8_MAP_BUTTON_EMOJI,
  ACCUMUL8_SAVE_BUTTON_EMOJI,
  ACCUMUL8_STATEMENT_BUTTON_EMOJI,
  ACCUMUL8_VIEW_BUTTON_EMOJI,
} from '../accumul8/accumul8Ui';
import { WebpImage } from '../common/WebpImage';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { useAccumul8 } from '../../hooks/useAccumul8';
import { PriorityTableColumn, usePriorityTableLayout } from '../../hooks/usePriorityTableLayout';
import { ApiClient } from '../../core/ApiClient';
import { resolveAccumul8StatementLink } from '../../utils/accumul8StatementLink';
import { resolveAccumul8BankingOrganizationIconPath } from '../../utils/accumul8BankingOrganizationBranding';
import { getAccumul8AccountDisplayName } from '../../utils/accumul8Accounts';
import { getAccumul8TransactionEditPolicy } from '../../utils/accumul8TransactionPolicy';
import {
  OpeningBalanceMessageMeta,
  RECURRING_PAYMENT_METHOD_LABELS,
  addUtcDays,
  formatAccountOptionLabel,
  formatCurrencyAmount,
  formatInlineDate,
  formatInlineDateTime,
  formatInlineText,
  formatPayBillStatusLabel,
  formatSummaryWindowLabel,
  getLedgerEffectiveDate,
  getOpeningBalanceMessageMeta,
  isDateInRange,
  matchesSearchQuery,
  normalizeSearchQuery,
  roundCurrency,
} from './accumul8/accumul8PageDateSearchUtils';
import {
  Accumul8DebtorGroupRow,
  EntityTransactionSummary,
  buildEntityGuideRule,
  formatEntityContactSummary,
  formatEntityRoles,
  formatEntityTransactionSummaryLabel,
  getActiveFilterClass,
  getLedgerDescriptionLabel,
  inferEntityContactTypeForAmount,
  isIouAccount,
  isLaunchableHttpUrl,
  isOpeningBalanceTransaction,
  normalizeDebtorGroupKey,
  normalizeEntityAliasKey,
  normalizeEntityContactType,
  normalizeEntityKind,
  toEntityEndexGuideKey,
  uniqueTextValues,
} from './accumul8/accumul8PageEntityUtils';
import {
  DebtorFormState,
  LedgerFormState,
  LedgerInlineDraft,
  RecurringFormState,
  buildLedgerFormFromTransaction,
  buildRecurringPayload,
  createDefaultDebtorForm,
  createDefaultLedgerForm,
  isProjectedPlanningTransaction,
  normalizePaidStateDraft,
} from './accumul8/accumul8PageFormUtils';
import {
  findRecurringRuleForTransactionMapping,
  formatAccountBackfillNote,
  formatAccountMappingLabel,
  formatSyncConnectionStatus,
  formatSyncStatusLabel,
  formatSyncStatusMessage,
  formatSyncSummaryAccountLabel,
  formatSyncSummaryBackfillNote,
  isTellerRateLimited,
} from './accumul8/accumul8PageRecurringSyncUtils';
import {
  Accumul8AIcountantHousekeepingResponse,
  Accumul8AIcountantWatchlistResponse,
  Accumul8BalanceBooksResponse,
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
  Accumul8EntityEndexGuideUpsertRequest,
  Accumul8BootstrapResponse,
  Accumul8MessageBoardMessage,
  Accumul8MessageBoardResponse,
  Accumul8IdResponse,
  Accumul8EntityUpsertRequest,
} from '../../types/accumul8';
import { Accumul8PageHeader } from './accumul8/Accumul8PageHeader';
import { useAccumul8EntityEndexActions } from './accumul8/useAccumul8EntityEndexActions';
import { useAccumul8ModalEditorActions } from './accumul8/useAccumul8ModalEditorActions';
import { useAccumul8ModalResetActions } from './accumul8/useAccumul8ModalResetActions';
import { DebtorInlineDraft, EntityInlineDraft, RecurringInlineDraft, useAccumul8InlineRowActions } from './accumul8/useAccumul8InlineRowActions';
import { useAccumul8SyncActions } from './accumul8/useAccumul8SyncActions';
import { Accumul8PageModalAssembly } from './accumul8/Accumul8PageModalAssembly';
import { Accumul8PageOverlays } from './accumul8/Accumul8PageOverlays';
import { Accumul8PageModals } from './accumul8/Accumul8PageModals';
import { Accumul8PageTabContent } from './accumul8/Accumul8PageTabContent';
import './Accumul8Page.css';

interface Accumul8PageProps extends AppShellPageProps {
  onToast?: (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}
type TabKey = 'aicountant' | 'ledger' | 'calendar' | 'spreadsheet' | 'debtors' | 'pay_bills' | 'contacts' | 'entity_endex' | 'recurring' | 'notifications' | 'sync' | 'statements';
type SearchableListTabKey = 'ledger' | 'debtors' | 'pay_bills' | 'contacts' | 'recurring';
type LedgerFilterPreset =
  | 'all'
  | 'planning'
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
  unpaidBills: number;
  windfalls: number;
};
type Accumul8SyncReport = {
  connectionId: number;
  institutionName: string;
  syncedAt: string;
  result: Accumul8TellerSyncResponse;
};
const ACCUMUL8_OWNER_STORAGE_KEY = 'accumul8.selected_owner_user_id';
const LEDGER_FILTER_PRESET_OPTIONS: Array<{ value: LedgerFilterPreset; label: string }> = [
  { value: 'all', label: 'All transactions' },
  { value: 'planning', label: 'Planning' },
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
  is_budget_planner: 1,
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
const SUMMARY_WINDOW_OPTIONS = ['current', 7, 30, 60, 90] as const;
type SummaryWindowOption = typeof SUMMARY_WINDOW_OPTIONS[number];

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
  const accumul8ActionUrl = React.useCallback((action: string) => {
    const params = new URLSearchParams({ action });
    if (selectedOwnerUserId > 0) {
      params.set('owner_user_id', String(selectedOwnerUserId));
    }
    return `/api/accumul8.php?${params.toString()}`;
  }, [selectedOwnerUserId]);
  const {
    busy,
    loaded,
    statementsLoaded,
    activeOwnerUserId,
    accessibleAccountOwners,
    entities,
    entityAliases,
    entityEndexGuides,
    entityEndexScanLogs,
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
    loadStatementWorkspace,
    createEntity,
    updateEntity,
    createEntityAlias,
    deleteEntityAlias,
    findEntityAliases,
    findAllEntityAliases,
    createEntityEndexGuide,
    updateEntityEndexGuide,
    deleteEntityEndexGuide,
    createBankingOrganization,
    updateBankingOrganization,
    deleteBankingOrganization,
    createBankConnection,
    updateBankConnection,
    deleteBankConnection,
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
    ensureBudgetMonth,
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
  const [transactionModalVariant, setTransactionModalVariant] = React.useState<'ledger' | 'iou'>('ledger');
  const [ledgerEntityModalTransactionId, setLedgerEntityModalTransactionId] = React.useState<number | null>(null);
  const [ledgerEntityModalSaving, setLedgerEntityModalSaving] = React.useState(false);
  const [entityHistoryEntityId, setEntityHistoryEntityId] = React.useState<number | null>(null);
  const [selectedDebtorId, setSelectedDebtorId] = React.useState<string>('');
  const [selectedBankingOrganizationId, setSelectedBankingOrganizationId] = React.useState<string>('');
  const [selectedBankAccountId, setSelectedBankAccountId] = React.useState<string>('');
  const [bankingOrganizationManagerOpen, setBankingOrganizationManagerOpen] = React.useState(false);
  const [accountManagerOpen, setAccountManagerOpen] = React.useState(false);
  const [syncHelpOpen, setSyncHelpOpen] = React.useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = React.useState(false);
  const [settingsMenuPosition, setSettingsMenuPosition] = React.useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 240 });
  const [summaryWindow, setSummaryWindow] = React.useState<SummaryWindowOption>(90);
  const [syncHelpToken, setSyncHelpToken] = React.useState('');
  const [syncHelpError, setSyncHelpError] = React.useState('');
  const [entityEndexQuery, setEntityEndexQuery] = React.useState('');
  const [entityEndexFindingAll, setEntityEndexFindingAll] = React.useState(false);
  const [entityEndexLogOpen, setEntityEndexLogOpen] = React.useState(false);
  const [entityEndexGuideModalOpen, setEntityEndexGuideModalOpen] = React.useState(false);
  const [editingEntityEndexGuideId, setEditingEntityEndexGuideId] = React.useState<number | null>(null);
  const [messageBoardOpen, setMessageBoardOpen] = React.useState(false);
  const [messageBoardLoading, setMessageBoardLoading] = React.useState(false);
  const [messageBoardMessages, setMessageBoardMessages] = React.useState<Accumul8MessageBoardMessage[]>([]);
  const [messageBoardUnacknowledgedCount, setMessageBoardUnacknowledgedCount] = React.useState(0);
  const [runningAIcountantHousekeeping, setRunningAIcountantHousekeeping] = React.useState(false);
  const [balancingBooks, setBalancingBooks] = React.useState(false);
  const [runningAIcountantWatchlist, setRunningAIcountantWatchlist] = React.useState(false);
  const isHeaderLogoSpinning = busy
    || syncingConnectionId !== null
    || entityEndexFindingAll
    || runningAIcountantHousekeeping
    || balancingBooks
    || runningAIcountantWatchlist;
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
  React.useEffect(() => {
    if (tab !== 'statements' || statementsLoaded) {
      return;
    }
    void loadStatementWorkspace();
  }, [loadStatementWorkspace, statementsLoaded, tab]);
  const selectedOwnerProfile = React.useMemo(() => (
    accessibleAccountOwners.find((owner) => owner.owner_user_id === (selectedOwnerUserId || activeOwnerUserId || 0)) || null
  ), [accessibleAccountOwners, activeOwnerUserId, selectedOwnerUserId]);
  const loadMessageBoard = React.useCallback(async () => {
    const ownerUserId = Number(selectedOwnerUserId || activeOwnerUserId || 0);
    if (ownerUserId <= 0) {
      setMessageBoardMessages([]);
      setMessageBoardUnacknowledgedCount(0);
      return;
    }
    setMessageBoardLoading(true);
    try {
      const response = await ApiClient.get<Accumul8MessageBoardResponse>(scopedActionUrl('list_message_board_messages'));
      setMessageBoardMessages(Array.isArray(response?.messages) ? response.messages : []);
      setMessageBoardUnacknowledgedCount(Number(response?.unacknowledged_count || 0));
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to load the message board') });
    } finally {
      setMessageBoardLoading(false);
    }
  }, [activeOwnerUserId, onToast, scopedActionUrl, selectedOwnerUserId]);
  React.useEffect(() => {
    void loadMessageBoard();
  }, [loadMessageBoard]);
  const acknowledgeMessageBoardMessage = React.useCallback(async (messageId: number) => {
    if (messageId <= 0) {
      return;
    }
    setMessageBoardLoading(true);
    try {
      const response = await ApiClient.post<Accumul8MessageBoardResponse>(
        scopedActionUrl('acknowledge_message_board_messages'),
        { ids: [messageId] },
      );
      setMessageBoardMessages(Array.isArray(response?.messages) ? response.messages : []);
      setMessageBoardUnacknowledgedCount(Number(response?.unacknowledged_count || 0));
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to acknowledge message') });
    } finally {
      setMessageBoardLoading(false);
    }
  }, [onToast, scopedActionUrl]);
  const acknowledgeAllMessageBoardMessages = React.useCallback(async () => {
    if (messageBoardUnacknowledgedCount <= 0) {
      return;
    }
    setMessageBoardLoading(true);
    try {
      const response = await ApiClient.post<Accumul8MessageBoardResponse>(
        scopedActionUrl('acknowledge_message_board_messages'),
        { all: 1 },
      );
      setMessageBoardMessages(Array.isArray(response?.messages) ? response.messages : []);
      setMessageBoardUnacknowledgedCount(Number(response?.unacknowledged_count || 0));
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Failed to acknowledge all messages') });
    } finally {
      setMessageBoardLoading(false);
    }
  }, [messageBoardUnacknowledgedCount, onToast, scopedActionUrl]);
  const handleRunAIcountantHousekeeping = React.useCallback(async () => {
    if (runningAIcountantHousekeeping || balancingBooks || runningAIcountantWatchlist) {
      return;
    }
    setRunningAIcountantHousekeeping(true);
    try {
      const response = await ApiClient.post<Accumul8AIcountantHousekeepingResponse>(
        scopedActionUrl('run_aicountant_housekeeping'),
        {
          send_email: 0,
          create_notification_rule: 1,
          email_on_attention_only: 1,
          run_entity_maintenance: 0,
        },
      );
      setMessageBoardMessages(Array.isArray(response?.messages) ? response.messages : []);
      setMessageBoardUnacknowledgedCount(Number(response?.unacknowledged_count || 0));
      await load();
      const ledgerSyncResult = response?.ledger_sync;
      const balanceResult = response?.balance_books;
      const openingBalanceResult = response?.opening_balance_reconciliation;
      const watchlistResult = response?.watchlist;
      const createdLedgerRows = Number(ledgerSyncResult?.created || 0);
      const reconciledCount = Number(openingBalanceResult?.reconciled_count || 0);
      const overdueCount = Number(watchlistResult?.overdue_count || 0);
      const dueSoonCount = Number(watchlistResult?.due_soon_count || 0);
      const recurringSoonCount = Number(watchlistResult?.recurring_soon_count || 0);
      const tone = Number(balanceResult?.error_connection_count || 0) > 0 || Number(response?.attention_needed || 0) === 1
        ? 'warning'
        : 'success';
      const summaryParts = [
        `Synced ${Number(balanceResult?.synced_connection_count || 0)} bank connection${Number(balanceResult?.synced_connection_count || 0) === 1 ? '' : 's'}`,
        `created ${createdLedgerRows} recurring ledger item${createdLedgerRows === 1 ? '' : 's'} through ${String(ledgerSyncResult?.window_end || '').trim() || 'the 90-day window'}`,
        reconciledCount > 0
          ? `adjusted ${reconciledCount} opening balance${reconciledCount === 1 ? '' : 's'}`
          : 'did not need opening-balance adjustments',
        `flagged ${overdueCount + dueSoonCount + recurringSoonCount} upcoming risk${overdueCount + dueSoonCount + recurringSoonCount === 1 ? '' : 's'}`,
      ];
      onToast?.({
        tone,
        message: `AIcountant housekeeping finished: ${summaryParts.join(', ')}. Check Alerts for the full run log.`,
      });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'AIcountant housekeeping failed') });
    } finally {
      setRunningAIcountantHousekeeping(false);
    }
  }, [balancingBooks, load, onToast, runningAIcountantHousekeeping, runningAIcountantWatchlist, scopedActionUrl]);

  const handleBalanceBooks = React.useCallback(async () => {
    if (balancingBooks || runningAIcountantHousekeeping) {
      return;
    }
    setBalancingBooks(true);
    try {
      const response = await ApiClient.post<Accumul8BalanceBooksResponse>(
        scopedActionUrl('balance_books'),
        {},
      );
      setMessageBoardMessages(Array.isArray(response?.messages) ? response.messages : []);
      setMessageBoardUnacknowledgedCount(Number(response?.unacknowledged_count || 0));
      await load();
      if (Number(response?.synced_connection_count || 0) <= 0) {
        onToast?.({ tone: 'warning', message: 'No Teller bank connections were available to sync.' });
        return;
      }
      const openingBalanceResult = response?.opening_balance_reconciliation;
      onToast?.({
        tone: Number(response?.error_connection_count || 0) > 0 || Number(openingBalanceResult?.review_needed_count || 0) > 0 ? 'warning' : 'success',
        message: Number(openingBalanceResult?.reconciled_count || 0) > 0
          ? `Balance the Books finished and adjusted ${Number(openingBalanceResult?.reconciled_count || 0)} opening balance${Number(openingBalanceResult?.reconciled_count || 0) === 1 ? '' : 's'}. Check the message board for dates and ledger links.`
          : 'Balance the Books finished. Check the message board for the full run log.',
      });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'Balance the Books failed') });
    } finally {
      setBalancingBooks(false);
    }
  }, [balancingBooks, load, onToast, runningAIcountantHousekeeping, scopedActionUrl]);
  const handleRunAIcountantWatchlist = React.useCallback(async () => {
    if (runningAIcountantWatchlist || runningAIcountantHousekeeping) {
      return;
    }
    setRunningAIcountantWatchlist(true);
    try {
      const response = await ApiClient.post<Accumul8AIcountantWatchlistResponse>(
        scopedActionUrl('run_aicountant_watchlist'),
        { send_email: 0, create_notification_rule: 1 },
      );
      setMessageBoardMessages(Array.isArray(response?.messages) ? response.messages : []);
      setMessageBoardUnacknowledgedCount(Number(response?.unacknowledged_count || 0));
      onToast?.({
        tone: Number(response?.overdue_count || 0) > 0 ? 'warning' : 'success',
        message: 'AIcountant watchlist posted to the message board.',
      });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: String(error?.message || 'AIcountant watchlist failed') });
    } finally {
      setRunningAIcountantWatchlist(false);
    }
  }, [onToast, runningAIcountantHousekeeping, runningAIcountantWatchlist, scopedActionUrl]);
  const visibleAccounts = React.useMemo(() => {
    const bankingOrganizationId = Number(selectedBankingOrganizationId || 0);
    if (bankingOrganizationId <= 0) {
      return accounts;
    }
    return accounts.filter((account) => Number(account.banking_organization_id || 0) === bankingOrganizationId);
  }, [accounts, selectedBankingOrganizationId]);
  const accountDisplayNameById = React.useMemo(() => {
    const next: Record<number, string> = {};
    accounts.forEach((account) => {
      next[account.id] = getAccumul8AccountDisplayName(account);
    });
    return next;
  }, [accounts]);
  const getAccountDisplayName = React.useCallback((
    accountId: number | null | undefined,
    fallbackName?: string | null,
    bankingOrganizationName?: string | null,
    emptyFallback = '-',
  ): string => {
    const resolved = accountId ? accountDisplayNameById[accountId] : '';
    if (resolved) {
      return resolved;
    }
    const fallback = String(fallbackName || '').trim() || String(bankingOrganizationName || '').trim();
    return fallback || emptyFallback;
  }, [accountDisplayNameById]);
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
        case 'all':
          return !effectiveDate || effectiveDate <= todayDate;
        case 'planning':
          return true;
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
      getAccountDisplayName(tx.account_id, tx.account_name, tx.banking_organization_name),
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
  ), [getAccountDisplayName, ledgerRowsBase, ledgerSearchQuery]);
  const ledgerDisplayBalanceById = React.useMemo(() => {
    if (ledgerFilterPreset === 'planning') {
      return new Map<number, number>();
    }

    const sortedTransactions = filteredTransactions.slice().sort((a, b) => {
      const accountDelta = Number(a.account_id || 0) - Number(b.account_id || 0);
      if (accountDelta !== 0) {
        return accountDelta;
      }
      const dateDelta = String(b.transaction_date || '').localeCompare(String(a.transaction_date || ''));
      if (dateDelta !== 0) {
        return dateDelta;
      }
      return Number(b.id || 0) - Number(a.id || 0);
    });

    const runningByAccount = new Map<number, number>(
      scopedAccounts.map((account) => [Number(account.id || 0), roundCurrency(Number(account.current_balance || 0))])
    );
    const balancesById = new Map<number, number>();

    sortedTransactions.forEach((tx) => {
      const txId = Number(tx.id || 0);
      if (txId <= 0) {
        return;
      }

      const accountId = Number(tx.account_id || 0);
      if (accountId <= 0) {
        balancesById.set(txId, roundCurrency(Number(tx.running_balance || 0)));
        return;
      }

      const currentBalance = roundCurrency(runningByAccount.get(accountId) || 0);
      const isPlannerOnly = Number(tx.is_budget_planner || 0) === 1 && String(tx.source_kind || '') !== 'teller';
      const isFutureDated = String(tx.transaction_date || '') > todayDate;
      if (isPlannerOnly || isFutureDated || String(tx.source_kind || '') === 'statement_pdf') {
        balancesById.set(txId, currentBalance);
        return;
      }

      const delta = roundCurrency(Number(tx.amount || 0) + Number(tx.rta_amount || 0));
      balancesById.set(txId, currentBalance);
      runningByAccount.set(accountId, roundCurrency(currentBalance - delta));
    });

    return balancesById;
  }, [filteredTransactions, ledgerFilterPreset, scopedAccounts, todayDate]);
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
      getAccountDisplayName(item.account_id, item.account_name),
      item.amount,
      Number(item.is_budget_planner || 0) === 1 ? 'shown' : 'hidden',
      Number(item.is_active || 0) === 1 ? 'active' : 'paused',
    ]))
  ), [filteredRecurringPayments, getAccountDisplayName, recurringSearchQuery]);
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
      getAccountDisplayName(tx.account_id, tx.account_name),
      tx.contact_name,
      tx.entity_name,
      tx.amount,
      Number(tx.is_paid || 0) === 1 ? 'paid' : ((tx.due_date || tx.transaction_date) < todayDate ? 'past due' : 'upcoming'),
    ]))
  ), [filteredPayBillRows, getAccountDisplayName, payBillsSearchQuery, todayDate]);
  const currentVisibleBalance = React.useMemo(() => (
    roundCurrency(scopedAccounts.reduce((sum, account) => sum + Number(account.current_balance || 0), 0))
  ), [scopedAccounts]);
  const summaryWindowEndDate = React.useMemo(
    () => (summaryWindow === 'current' ? todayDate : addUtcDays(todayDate, summaryWindow)),
    [summaryWindow, todayDate],
  );
  const projectedBalanceForWindow = React.useMemo(() => {
    const projectedDelta = filteredTransactions.reduce((sum, tx) => {
      const effectiveDate = String(tx.due_date || tx.transaction_date || '');
      if (!effectiveDate || effectiveDate < todayDate || effectiveDate > summaryWindowEndDate) {
        return sum;
      }
      if (Number(tx.is_paid || 0) === 1) {
        return sum;
      }
      if (!isProjectedPlanningTransaction(tx, todayDate)) {
        return sum;
      }

      return sum + Number(tx.amount || 0);
    }, 0);

    return roundCurrency(currentVisibleBalance + projectedDelta);
  }, [currentVisibleBalance, filteredTransactions, summaryWindowEndDate, todayDate]);
  const summaryWindowTotals = React.useMemo(() => {
    let unpaidBills = 0;
    let windfalls = 0;

    filteredTransactions.forEach((tx) => {
      const effectiveDate = String(tx.due_date || tx.transaction_date || '');
      if (!effectiveDate || effectiveDate < todayDate || effectiveDate > summaryWindowEndDate) {
        return;
      }
      if (!isProjectedPlanningTransaction(tx, todayDate)) {
        return;
      }

      const amount = Number(tx.amount || 0);
      const isPaid = Number(tx.is_paid || 0) === 1;
      const isNonRecurringDeposit = tx.entry_type === 'deposit' && String(tx.source_kind || '') !== 'recurring';

      if (!isPaid && amount < 0) {
        unpaidBills += Math.abs(amount);
      }

      if (isNonRecurringDeposit && amount > 0) {
        windfalls += amount;
      }
    });

    return {
      unpaidBills: roundCurrency(unpaidBills),
      windfalls: roundCurrency(windfalls),
    };
  }, [filteredTransactions, summaryWindowEndDate]);
  const headerSummary = React.useMemo<Accumul8HeaderSummary>(() => {
    return {
      currentBalance: currentVisibleBalance,
      unpaidBills: summaryWindowTotals.unpaidBills,
      windfalls: summaryWindowTotals.windfalls,
    };
  }, [currentVisibleBalance, summaryWindowTotals]);
  const handleProjectedBalanceCardClick = React.useCallback(() => {
    setSummaryWindow((currentWindow) => {
      const currentIndex = SUMMARY_WINDOW_OPTIONS.indexOf(currentWindow);
      const nextIndex = currentIndex >= 0
        ? (currentIndex + 1) % SUMMARY_WINDOW_OPTIONS.length
        : SUMMARY_WINDOW_OPTIONS.length - 1;

      return SUMMARY_WINDOW_OPTIONS[nextIndex];
    });
  }, []);
  const debtorsSearchQuery = React.useMemo(() => normalizeSearchQuery(listSearchQueryByTab.debtors), [listSearchQueryByTab.debtors]);
  const groupedDebtors = React.useMemo<Accumul8DebtorGroupRow[]>(() => {
    const grouped = new Map<string, Accumul8DebtorGroupRow>();
    debtors.forEach((debtor) => {
      const normalizedName = normalizeDebtorGroupKey(debtor.debtor_name);
      const groupKey = normalizedName || `debtor:${debtor.id}`;
      const existing = grouped.get(groupKey);
      if (!existing) {
        grouped.set(groupKey, {
          ...debtor,
          group_key: groupKey,
          member_ids: [debtor.id],
          has_duplicate_members: false,
        });
        return;
      }

      existing.total_loaned = roundCurrency(Number(existing.total_loaned || 0) + Number(debtor.total_loaned || 0));
      existing.total_repaid = roundCurrency(Number(existing.total_repaid || 0) + Number(debtor.total_repaid || 0));
      existing.outstanding_balance = roundCurrency(Number(existing.outstanding_balance || 0) + Number(debtor.outstanding_balance || 0));
      existing.transaction_count = Number(existing.transaction_count || 0) + Number(debtor.transaction_count || 0);
      existing.last_activity_date = [existing.last_activity_date, debtor.last_activity_date].filter(Boolean).sort().at(-1) || '';
      existing.notes = existing.notes || debtor.notes;
      existing.contact_name = existing.contact_name || debtor.contact_name;
      existing.entity_name = existing.entity_name || debtor.entity_name;
      existing.entity_id = existing.entity_id ?? debtor.entity_id;
      existing.contact_id = existing.contact_id ?? debtor.contact_id;
      existing.is_active = Number(existing.is_active || 0) === 1 || Number(debtor.is_active || 0) === 1 ? 1 : 0;
      existing.member_ids.push(debtor.id);
      existing.has_duplicate_members = existing.member_ids.length > 1;
    });

    return Array.from(grouped.values()).sort((a, b) => (
      a.debtor_name.localeCompare(b.debtor_name, undefined, { sensitivity: 'base' }) || a.id - b.id
    ));
  }, [debtors]);
  const debtorGroupKeyByDebtorId = React.useMemo(() => {
    const next = new Map<number, string>();
    groupedDebtors.forEach((debtor) => {
      debtor.member_ids.forEach((memberId) => {
        next.set(memberId, debtor.group_key);
      });
    });
    return next;
  }, [groupedDebtors]);
  const debtorRunningBalanceByTxId = React.useMemo(() => {
    const runningByGroupKey = new Map<string, number>();
    const next = new Map<number, number>();
    const chronologicalRows = [...debtorLedger].sort((a, b) => (
      String(a.transaction_date || '').localeCompare(String(b.transaction_date || ''))
      || a.id - b.id
    ));

    chronologicalRows.forEach((tx) => {
      const debtorId = Number(tx.debtor_id || 0);
      const fallbackKey = debtorId > 0 ? `debtor:${debtorId}` : normalizeDebtorGroupKey(tx.debtor_name);
      const groupKey = debtorGroupKeyByDebtorId.get(debtorId) || fallbackKey || `tx:${tx.id}`;
      const runningBalance = roundCurrency((runningByGroupKey.get(groupKey) || 0) + Number(tx.amount || 0));
      runningByGroupKey.set(groupKey, runningBalance);
      next.set(tx.id, runningBalance);
    });

    return next;
  }, [debtorGroupKeyByDebtorId, debtorLedger]);
  const debtorRows = React.useMemo(() => (
    groupedDebtors.filter((debtor) => matchesSearchQuery(debtorsSearchQuery, [
      debtor.debtor_name,
      debtor.notes,
      debtor.last_activity_date,
      debtor.total_loaned,
      debtor.total_repaid,
      debtor.outstanding_balance,
      Number(debtor.is_active || 0) === 1 ? 'active' : 'paused',
    ]))
  ), [debtorsSearchQuery, groupedDebtors]);
  const ledgerTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8Transaction>>>(() => ([
    { key: 'date', header: 'Date', minWidth: 110, maxAutoWidth: 126, sortable: true, sortAccessor: (tx) => tx.transaction_date || '', contentAccessor: (tx) => formatInlineDate(tx.transaction_date) },
    { key: 'due', header: 'Due', minWidth: 110, maxAutoWidth: 126, sortable: true, sortAccessor: (tx) => tx.due_date || '', contentAccessor: (tx) => formatInlineDate(tx.due_date) },
    { key: 'account', header: 'Acct', minWidth: 138, maxAutoWidth: 220, priority: 2, sortable: true, sortAccessor: (tx) => getAccountDisplayName(tx.account_id, tx.account_name, tx.banking_organization_name, ''), contentAccessor: (tx) => getAccountDisplayName(tx.account_id, tx.account_name, tx.banking_organization_name) },
    { key: 'description', header: 'Description', minWidth: 240, maxAutoWidth: 560, priority: 6, sortable: true, sortAccessor: (tx) => getLedgerDescriptionLabel(tx), contentAccessor: (tx) => getLedgerDescriptionLabel(tx) },
    { key: 'memo', header: 'Memo', minWidth: 150, maxAutoWidth: 360, priority: 3, sortable: true, sortAccessor: (tx) => tx.memo || '', contentAccessor: (tx) => tx.memo || '-' },
    { key: 'amount', header: 'Amt', minWidth: 102, maxAutoWidth: 128, sortable: true, defaultSortDirection: 'desc', sortAccessor: (tx) => Number(tx.amount || 0), contentAccessor: (tx) => Number(tx.amount || 0).toFixed(2) },
    { key: 'balance', header: 'Bal', minWidth: 108, maxAutoWidth: 136, sortable: true, defaultSortDirection: 'desc', sortAccessor: (tx) => Number(ledgerDisplayBalanceById.get(tx.id) ?? tx.running_balance ?? 0), contentAccessor: (tx) => Number(ledgerDisplayBalanceById.get(tx.id) ?? tx.running_balance ?? 0).toFixed(2) },
    { key: 'paid', header: 'Paid', minWidth: 92, maxAutoWidth: 106, sortable: true, sortAccessor: (tx) => Number(tx.is_paid || 0), contentAccessor: (tx) => Number(tx.is_paid || 0) === 1 ? 'Paid' : 'Unpaid' },
    { key: 'reconciled', header: "Rec'd", minWidth: 92, maxAutoWidth: 116, sortable: true, sortAccessor: (tx) => Number(tx.is_reconciled || 0), contentAccessor: (tx) => Number(tx.is_reconciled || 0) === 1 ? 'Reconciled' : 'Open' },
    { key: 'actions', header: 'Actions', minWidth: 122, maxAutoWidth: 132, sortable: false, contentAccessor: () => 'Actions' },
  ]), [getAccountDisplayName, ledgerDisplayBalanceById]);
  const debtorsTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8DebtorGroupRow>>>(() => ([
    { key: 'person', header: 'Person', minWidth: 220, maxAutoWidth: 320, priority: 4, sortable: true, sortAccessor: (debtor) => debtor.debtor_name || '', contentAccessor: (debtor) => debtor.debtor_name || '-' },
    { key: 'charges', header: 'Charges', minWidth: 120, maxAutoWidth: 142, sortable: true, defaultSortDirection: 'desc', sortAccessor: (debtor) => Number(debtor.total_loaned || 0), contentAccessor: (debtor) => Number(debtor.total_loaned || 0).toFixed(2) },
    { key: 'credits', header: 'Credits', minWidth: 120, maxAutoWidth: 142, sortable: true, defaultSortDirection: 'desc', sortAccessor: (debtor) => Number(debtor.total_repaid || 0), contentAccessor: (debtor) => Number(debtor.total_repaid || 0).toFixed(2) },
    { key: 'net', header: 'Net IOU', minWidth: 132, maxAutoWidth: 152, sortable: true, defaultSortDirection: 'desc', sortAccessor: (debtor) => Number(debtor.outstanding_balance || 0), contentAccessor: (debtor) => Number(debtor.outstanding_balance || 0).toFixed(2) },
    { key: 'activity', header: 'Last Activity', minWidth: 136, maxAutoWidth: 170, priority: 1, sortable: true, defaultSortDirection: 'desc', sortAccessor: (debtor) => debtor.last_activity_date || '', contentAccessor: (debtor) => debtor.last_activity_date || '-' },
    { key: 'actions', header: 'Actions', minWidth: 148, maxAutoWidth: 156, sortable: false, contentAccessor: () => 'Actions' },
  ]), []);
  const payBillsTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8Transaction>>>(() => ([
    { key: 'due', header: 'Due', minWidth: 96, maxAutoWidth: 114, sortable: true, sortAccessor: (tx) => tx.due_date || tx.transaction_date || '', contentAccessor: (tx) => formatInlineDate(tx.due_date || tx.transaction_date) },
    { key: 'paidDate', header: 'Paid', minWidth: 96, maxAutoWidth: 114, sortable: true, sortAccessor: (tx) => tx.paid_date || '', contentAccessor: (tx) => formatInlineDate(tx.paid_date) },
    { key: 'description', header: 'Description', minWidth: 250, maxAutoWidth: 520, priority: 6, sortable: true, sortAccessor: (tx) => tx.description || '', contentAccessor: (tx) => tx.description || '-' },
    { key: 'account', header: 'Acct', minWidth: 132, maxAutoWidth: 220, priority: 2, sortable: true, sortAccessor: (tx) => getAccountDisplayName(tx.account_id, tx.account_name, '', ''), contentAccessor: (tx) => getAccountDisplayName(tx.account_id, tx.account_name, '', 'No account') },
    { key: 'amount', header: 'Amt', minWidth: 100, maxAutoWidth: 126, sortable: true, defaultSortDirection: 'asc', sortAccessor: (tx) => Number(tx.amount || 0), contentAccessor: (tx) => Number(tx.amount || 0).toFixed(2) },
    { key: 'status', header: 'Status', minWidth: 92, maxAutoWidth: 112, sortable: true, sortAccessor: (tx) => formatPayBillStatusLabel(tx, todayDate), contentAccessor: (tx) => formatPayBillStatusLabel(tx, todayDate) },
    { key: 'actions', header: 'Actions', minWidth: 148, maxAutoWidth: 156, sortable: false, contentAccessor: () => 'Actions' },
  ]), [getAccountDisplayName, todayDate]);
  const recurringTableColumns = React.useMemo<Array<PriorityTableColumn<Accumul8RecurringPayment>>>(() => ([
    { key: 'title', header: 'Title', minWidth: 230, maxAutoWidth: 520, priority: 6, sortable: true, sortAccessor: (item) => item.title || '', contentAccessor: (item) => [item.title || 'Untitled recurring item', item.notes || ''] },
    { key: 'nextDue', header: 'Next Due', minWidth: 126, maxAutoWidth: 144, sortable: true, sortAccessor: (item) => item.next_due_date || '', contentAccessor: (item) => formatInlineDate(item.next_due_date) },
    { key: 'amount', header: 'Amt', minWidth: 100, maxAutoWidth: 126, sortable: true, defaultSortDirection: 'desc', sortAccessor: (item) => Number(item.amount || 0), contentAccessor: (item) => Number(item.amount || 0).toFixed(2) },
    { key: 'frequency', header: 'Frequency', minWidth: 96, maxAutoWidth: 118, sortable: true, sortAccessor: (item) => item.frequency || '', contentAccessor: (item) => item.frequency || '-' },
    { key: 'account', header: 'Acct', minWidth: 132, maxAutoWidth: 220, priority: 2, sortable: true, sortAccessor: (item) => getAccountDisplayName(item.account_id, item.account_name, '', ''), contentAccessor: (item) => getAccountDisplayName(item.account_id, item.account_name, '', 'No account') },
    { key: 'paymentMethod', header: 'Method', minWidth: 98, maxAutoWidth: 136, priority: 1, sortable: true, sortAccessor: (item) => RECURRING_PAYMENT_METHOD_LABELS[(item.payment_method || 'unspecified') as Accumul8PaymentMethod], contentAccessor: (item) => RECURRING_PAYMENT_METHOD_LABELS[(item.payment_method || 'unspecified') as Accumul8PaymentMethod] },
    { key: 'planner', header: 'Planner', minWidth: 108, maxAutoWidth: 120, sortable: true, sortAccessor: (item) => Number(item.is_budget_planner || 0), contentAccessor: (item) => Number(item.is_budget_planner || 0) === 1 ? 'Shown' : 'Hidden' },
    { key: 'status', header: 'Status', minWidth: 92, maxAutoWidth: 108, sortable: true, sortAccessor: (item) => Number(item.is_active || 0), contentAccessor: (item) => Number(item.is_active || 0) === 1 ? 'Active' : 'Paused' },
    { key: 'actions', header: 'Actions', minWidth: 148, maxAutoWidth: 156, sortable: false, contentAccessor: () => 'Actions' },
  ]), [getAccountDisplayName]);
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
  const { openStatementImportFallback, openSyncHelp, runConnectionSync, runTellerConnect } = useAccumul8SyncActions({
    load,
    onToast,
    scopedActionUrl,
    setLastSyncReport,
    setSyncHelpError,
    setSyncHelpOpen,
    setSyncHelpToken,
    setSyncingConnectionId,
    setTab,
    syncBankConnection,
    syncProvider,
  });
  const {
    resetBudgetForm,
    resetContactForm,
    resetDebtorForm,
    resetEntityForm,
    resetLedgerForm,
    resetNotificationForm,
    resetRecurringEditor,
  } = useAccumul8ModalResetActions({
    DEFAULT_CONTACT_FORM,
    DEFAULT_ENTITY_FORM,
    DEFAULT_RECURRING_FORM,
    selectedBankAccountId,
    setBudgetForm,
    setContactForm,
    setDebtorForm,
    setEditingBudgetRowId,
    setEditingContactId,
    setEditingDebtorId,
    setEditingEntityId,
    setEditingNotificationRuleId,
    setEditingRecurringForm,
    setEditingRecurringId,
    setEditingTransactionId,
    setEntityForm,
    setLedgerForm,
    setNotificationForm,
    setRecurringModalOpen,
    setTransactionModalMode,
    setTransactionModalVariant,
    setViewingTransactionId,
  });
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
  const closeContactModal = React.useCallback(() => {
    setContactModalOpen(false);
    resetContactForm();
  }, [resetContactForm]);
  const closeDebtorModal = React.useCallback(() => {
    setDebtorModalOpen(false);
    resetDebtorForm();
  }, [resetDebtorForm]);
  const closeTransactionModal = React.useCallback(() => {
    setTransactionModalOpen(false);
    setTransactionModalVariant('ledger');
    resetLedgerForm();
  }, [resetLedgerForm]);
  const closeEntityModal = React.useCallback(() => {
    setEntityAliasDraftById((prev) => {
      if (editingEntityId === null || !prev[editingEntityId]) return prev;
      const next = { ...prev };
      delete next[editingEntityId];
      return next;
    });
    setEntityModalOpen(false);
    resetEntityForm();
  }, [editingEntityId, resetEntityForm]);
  const closeLedgerEntityModal = React.useCallback(() => {
    setLedgerEntityModalTransactionId(null);
  }, []);
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
  const {
    beginEditBudgetRow,
    beginEditContact,
    beginEditEntity,
    beginEditNotificationRule,
    beginEditRecurring,
    beginEditTransaction,
    beginViewTransaction,
    openCreateContactModal,
    openCreateDebtorModal,
    openCreateEntityModal,
    openCreateIouTransactionModal,
    openCreateRecurringModal,
    openCreateTransactionModal,
    openLedgerEntityModal,
    submitContactForm,
    submitDebtorModal,
    submitEntityForm,
    submitRecurringModal,
    submitTransactionModal,
  } = useAccumul8ModalEditorActions({
    closeContactModal,
    closeDebtorModal,
    closeEntityModal,
    closeRecurringModal: React.useCallback(() => { resetRecurringEditor(); }, [resetRecurringEditor]),
    closeTransactionModal,
    collectEntityAliasNames,
    contacts,
    createContact,
    createDebtor,
    createEntity,
    createRecurring,
    createTransaction,
    DEFAULT_CONTACT_FORM,
    DEFAULT_ENTITY_ALIAS_DRAFT,
    DEFAULT_ENTITY_FORM,
    DEFAULT_RECURRING_FORM,
    editingContactId,
    editingDebtorId,
    editingEntityId,
    editingRecurringId,
    editingTransactionId,
    entities,
    notificationRules,
    persistEntityAliases,
    recurringPayments,
    selectedBankAccountId,
    setBudgetForm,
    setContactForm,
    setContactModalOpen,
    setDebtorForm,
    setDebtorModalOpen,
    setEditingBudgetRowId,
    setEditingContactId,
    setEditingDebtorId,
    setEditingEntityId,
    setEditingNotificationRuleId,
    setEditingRecurringForm,
    setEditingRecurringId,
    setEditingTransactionId,
    setEntityAliasDraftById,
    setEntityForm,
    setEntityModalOpen,
    setLedgerEntityModalTransactionId,
    setLedgerForm,
    setNotificationForm,
    setRecurringModalOpen,
    setTransactionModalMode,
    setTransactionModalOpen,
    setTransactionModalVariant,
    setViewingTransactionId,
    transactions,
    updateContact,
    updateDebtor,
    updateEntity,
    updateRecurring,
    updateTransaction,
  });
  const saveLedgerEntityRule = React.useCallback(async (payload: { mode: 'existing' | 'new'; entityId: number | null; newEntityName: string }) => {
    const transaction = transactions.find((row) => row.id === ledgerEntityModalTransactionId) || null;
    if (!transaction) {
      return;
    }

    try {
      setLedgerEntityModalSaving(true);
      let targetEntityId = payload.entityId ?? 0;
      let targetEntityName = '';

      if (payload.mode === 'new') {
        const createResponse = await ApiClient.post<Accumul8IdResponse>(accumul8ActionUrl('create_entity'), {
          display_name: payload.newEntityName,
          entity_kind: 'business',
          contact_type: inferEntityContactTypeForAmount(Number(transaction.amount || 0)),
          is_active: 1,
          default_amount: Math.abs(Number(transaction.amount || 0)),
          notes: String(transaction.memo || '').trim(),
        });
        targetEntityId = Number(createResponse?.id || 0);
        targetEntityName = payload.newEntityName;
      } else {
        const selectedEntity = entities.find((entity) => entity.id === Number(payload.entityId || 0)) || null;
        targetEntityId = Number(selectedEntity?.id || 0);
        targetEntityName = String(selectedEntity?.display_name || '');
      }

      if (targetEntityId <= 0) {
        throw new Error('Choose an entity before saving this rule.');
      }

      const description = String(transaction.description || '').trim();
      const aliasKey = normalizeEntityAliasKey(description);
      const conflictingAlias = entityAliases.find((alias) => (
        normalizeEntityAliasKey(alias.alias_name) === aliasKey && Number(alias.entity_id || 0) !== targetEntityId
      ));
      if (conflictingAlias) {
        await ApiClient.post(accumul8ActionUrl('delete_entity_alias'), { id: conflictingAlias.id });
      }

      if (aliasKey && normalizeEntityAliasKey(targetEntityName) !== aliasKey) {
        try {
          await ApiClient.post(accumul8ActionUrl('create_entity_alias'), {
            entity_id: targetEntityId,
            alias_name: description,
            merge_entity_id: null,
            reassign_if_conflict: true,
          });
        } catch (error: any) {
          const message = String(error?.message || '');
          if (!message.toLowerCase().includes('alias matches the entity name after normalization')) {
            throw error;
          }
        }
      }

      const guide = entityEndexGuides.find((item) => (
        Number(item.parent_entity_id || 0) === targetEntityId
          || toEntityEndexGuideKey(item) === normalizeEntityAliasKey(targetEntityName)
      )) || null;
      const guidePayload: Accumul8EntityEndexGuideUpsertRequest = {
        parent_name: targetEntityName,
        parent_entity_id: targetEntityId,
        match_rule: buildEntityGuideRule(description, targetEntityName),
        examples: uniqueTextValues([
          ...(guide?.examples || []),
          description,
          transaction.entity_name || '',
        ], (value) => value.trim().toLowerCase()),
        match_contains: uniqueTextValues([
          ...(guide?.match_contains || []),
          description,
          targetEntityName,
        ], (value) => value.trim().toLowerCase()),
        match_fragments: uniqueTextValues([
          ...(guide?.match_fragments || []),
          description,
          targetEntityName,
        ], normalizeEntityAliasKey),
        is_active: 1,
      };

      if (guide?.id) {
        await ApiClient.post(accumul8ActionUrl('update_entity_endex_guide'), { id: guide.id, ...guidePayload });
      } else {
        await ApiClient.post(accumul8ActionUrl('create_entity_endex_guide'), guidePayload);
      }

      const recurringRule = findRecurringRuleForTransactionMapping(transaction, recurringPayments, targetEntityId);
      if (recurringRule) {
        await ApiClient.post(accumul8ActionUrl('update_recurring'), {
          id: recurringRule.id,
          title: recurringRule.title,
          direction: recurringRule.direction,
          amount: Number(recurringRule.amount || 0),
          frequency: recurringRule.frequency,
          payment_method: recurringRule.payment_method,
          interval_count: Number(recurringRule.interval_count || 1),
          next_due_date: recurringRule.next_due_date,
          paid_date: recurringRule.paid_date || '',
          entity_id: targetEntityId,
          account_id: recurringRule.account_id ?? null,
          is_budget_planner: Number(recurringRule.is_budget_planner ?? 1),
          notes: recurringRule.notes || '',
          recurring_bank_aliases: uniqueTextValues([
            ...(recurringRule.recurring_bank_aliases || []),
            description,
            transaction.entity_name || '',
            targetEntityName,
          ], normalizeEntityAliasKey),
        });
      }

      await ApiClient.post(accumul8ActionUrl('update_transaction'), {
        id: transaction.id,
        transaction_date: transaction.transaction_date,
        due_date: transaction.due_date,
        paid_date: transaction.paid_date,
        entry_type: transaction.entry_type,
        description: transaction.description,
        memo: transaction.memo,
        amount: Number(transaction.amount || 0),
        rta_amount: Number(transaction.rta_amount || 0),
        is_paid: Number(transaction.is_paid || 0),
        is_reconciled: Number(transaction.is_reconciled || 0),
        is_budget_planner: Number(transaction.is_budget_planner || 0),
        entity_id: targetEntityId,
        account_id: transaction.account_id ?? null,
        balance_entity_id: transaction.balance_entity_id ?? null,
      });
      let aliasScanWarning = false;
      try {
        await ApiClient.post(accumul8ActionUrl('scan_entity_aliases'), { entity_id: targetEntityId });
      } catch (_error) {
        aliasScanWarning = true;
      }
      if (recurringRule) {
        try {
          await ApiClient.post(accumul8ActionUrl('materialize_due_recurring'), {});
        } catch (_error) {
          aliasScanWarning = true;
        }
      }
      await load();
      closeLedgerEntityModal();
      onToast?.({
        tone: aliasScanWarning ? 'warning' : 'success',
        message: aliasScanWarning
          ? `Updated ${targetEntityName || 'entity'} for "${description}", but the follow-up alias scan could not finish.`
          : `Updated ${targetEntityName || 'entity'} for "${description}" and refreshed its matching rule.`,
      });
    } catch (error: any) {
      onToast?.({
        tone: 'error',
        message: String(error?.message || 'Failed to update the entity name rule.'),
      });
    } finally {
      setLedgerEntityModalSaving(false);
    }
  }, [
    accumul8ActionUrl,
    closeLedgerEntityModal,
    entityAliases,
    entityEndexGuides,
    entities,
    ledgerEntityModalTransactionId,
    recurringPayments,
    load,
    onToast,
    transactions,
  ]);
  const closeRecurringModal = React.useCallback(() => {
    resetRecurringEditor();
  }, [resetRecurringEditor]);
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
  const entityEndexGuideById = React.useMemo(() => (
    entityEndexGuides.reduce<Record<number, Accumul8EntityEndexGuide>>((acc, guide) => {
      if (guide.id > 0) {
        acc[guide.id] = guide;
      }
      return acc;
    }, {})
  ), [entityEndexGuides]);
  const selectedEntityEndexGuide = React.useMemo(() => (
    editingEntityEndexGuideId !== null ? (entityEndexGuideById[editingEntityEndexGuideId] || null) : null
  ), [editingEntityEndexGuideId, entityEndexGuideById]);
  const selectedEntityEndexParentEntity = React.useMemo(() => {
    if (!selectedEntityEndexGuide) {
      return null;
    }
    if (selectedEntityEndexGuide.parent_entity_id) {
      return entitiesWithResolvedAliases.find((entity) => entity.id === selectedEntityEndexGuide.parent_entity_id) || null;
    }
    const parentKey = normalizeEntityAliasKey(selectedEntityEndexGuide.parent_name);
    return entitiesWithResolvedAliases.find((entity) => normalizeEntityAliasKey(entity.display_name) === parentKey) || null;
  }, [entitiesWithResolvedAliases, selectedEntityEndexGuide]);
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
  const iouVisibleAccounts = React.useMemo(() => (
    visibleAccounts.filter((account) => isIouAccount(account))
  ), [visibleAccounts]);
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
    filteredRecurringPayments.filter((rp) => Number(rp.is_budget_planner || 0) === 1)
  ), [filteredRecurringPayments]);
  const selectedDebtorEntries = React.useMemo(() => {
    if (!selectedDebtorId) {
      return debtorLedger;
    }
    const selectedDebtor = groupedDebtors.find((debtor) => debtor.group_key === selectedDebtorId) || null;
    if (!selectedDebtor) {
      return debtorLedger;
    }
    const memberIds = new Set(selectedDebtor.member_ids);
    return debtorLedger.filter((tx) => memberIds.has(Number(tx.debtor_id || 0)));
  }, [debtorLedger, groupedDebtors, selectedDebtorId]);
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
  const closeEntityEndexGuideModal = React.useCallback(() => {
    setEditingEntityEndexGuideId(null);
    setEntityEndexGuideModalOpen(false);
  }, []);
  const {
    activateDebtorRow,
    activateEntityRow,
    activateLedgerRow,
    activatePayBillRow,
    activateRecurringRow,
    handleDeleteRecurring,
    handleDeleteTransaction,
    removeEntityAlias,
    saveDebtorRow,
    saveEntityAlias,
    saveEntityRow,
    saveLedgerRow,
    savePayBillRow,
    saveRecurringRow,
    setDebtorRowDraft,
    setEntityRowDraft,
    setLedgerRowDraft,
    setPayBillRowDraft,
    setRecurringRowDraft,
  } = useAccumul8InlineRowActions({
    debtorDraftById,
    deleteEntityAlias,
    deleteRecurring,
    deleteTransaction,
    entityDraftById,
    ledgerDraftById,
    payBillDraftById,
    persistEntityAliases,
    recurringDraftById,
    setActiveDebtorRowId,
    setActiveEntityRowId,
    setActiveLedgerRowId,
    setActivePayBillRowId,
    setActiveRecurringRowId,
    setDebtorDraftById,
    setEntityDraftById,
    setLedgerDraftById,
    setPayBillDraftById,
    setRecurringDraftById,
    updateDebtor,
    updateEntity,
    updateRecurring,
    updateTransaction,
  });
  const {
    openEntityEndexGuideModal,
    removeEntityEndexGuide,
    runEntityEndexGuideFinder,
    runEntityMaintenanceAliasScan,
    saveEntityEndexGuide,
  } = useAccumul8EntityEndexActions({
    closeEntityEndexGuideModal,
    createEntityEndexGuide,
    deleteEntityEndexGuide,
    editingEntityEndexGuideId,
    findAllEntityAliases,
    findEntityAliases,
    setEditingEntityEndexGuideId,
    setEntityEndexFindingAll,
    setEntityEndexGuideModalOpen,
    updateEntityEndexGuide,
  });
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
          <Accumul8PageHeader
            accessibleAccountOwners={accessibleAccountOwners}
            activeOwnerUserId={activeOwnerUserId}
            bankingOrganizations={bankingOrganizations}
            busy={busy}
            entitiesSorted={entitiesSorted}
            formatAccountOptionLabel={formatAccountOptionLabel}
            formatCurrencyAmount={formatCurrencyAmount}
            formatSummaryWindowLabel={formatSummaryWindowLabel}
            getActiveFilterClass={getActiveFilterClass}
            handleProjectedBalanceCardClick={handleProjectedBalanceCardClick}
            headerSummary={headerSummary}
            isHeaderLogoSpinning={isHeaderLogoSpinning}
            launchableBankingOrganizations={launchableBankingOrganizations}
            messageBoardUnacknowledgedCount={messageBoardUnacknowledgedCount}
            normalizeEntityKind={normalizeEntityKind}
            onOpenAccountManager={() => setAccountManagerOpen(true)}
            onOpenBankingOrganizationManager={() => setBankingOrganizationManagerOpen(true)}
            onOpenMessageBoard={() => setMessageBoardOpen(true)}
            onOpenPopup={openBankingOrganizationPopup}
            onSelectBankAccount={setSelectedBankAccountId}
            onSelectBankingOrganization={setSelectedBankingOrganizationId}
            onSelectOwner={(next) => {
              setSelectedOwnerUserId(next);
              if (typeof window !== 'undefined') {
                window.localStorage.setItem(ACCUMUL8_OWNER_STORAGE_KEY, String(next));
              }
            }}
            onSelectTab={(nextTab) => setTab(nextTab as TabKey)}
            projectedBalanceForWindow={projectedBalanceForWindow}
            selectedBankAccountId={selectedBankAccountId}
            selectedBankingOrganizationId={selectedBankingOrganizationId}
            settingsButtonRef={settingsButtonRef}
            settingsMenuOpen={settingsMenuOpen}
            settingsMenuPosition={settingsMenuPosition}
            settingsMenuRef={settingsMenuRef}
            setSettingsMenuOpen={setSettingsMenuOpen}
            summaryWindow={summaryWindow}
            tab={tab}
            visibleAccounts={visibleAccounts}
          />
          <Accumul8PageTabContent
            aiPanelProps={{
              ownerUserId: selectedOwnerUserId || activeOwnerUserId || 0,
              ownerUsername: selectedOwnerProfile?.username || viewer?.username || 'You',
              runningHousekeeping: runningAIcountantHousekeeping,
              balancingBooks,
              runningWatchlist: runningAIcountantWatchlist,
              messageBoardPendingCount: messageBoardUnacknowledgedCount,
              onRunHousekeeping: handleRunAIcountantHousekeeping,
              onBalanceBooks: handleBalanceBooks,
              onRunWatchlist: handleRunAIcountantWatchlist,
              onOpenMessageBoard: () => setMessageBoardOpen(true),
              onDataChanged: load,
              onToast,
            }}
            calendarViewProps={{
              accounts: scopedAccounts,
              transactions: filteredTransactions,
              onTransactionSelect: beginViewTransaction,
            }}
            contactsTabProps={{
              activeEntityRowId,
              activateEntityRow,
              busy,
              defaultEntityAliasDraft: DEFAULT_ENTITY_ALIAS_DRAFT,
              entities,
              entitiesTable,
              entitiesTableRef,
              entityAliasDraftById,
              entityDraftById,
              entityTransactionSummaryById,
              flashingSaveButtonKey,
              listSearchQuery: listSearchQueryByTab.contacts,
              openCreateEntityModal,
              removeEntityAlias,
              saveEntityAlias,
              saveEntityRow,
              setEntityAliasDraftById,
              setEntityHistoryEntityId,
              setEntityRowDraft,
              setInlineRowRef,
              setListSearchQuery: (value) => setListSearchQueryByTab((prev) => ({ ...prev, contacts: value })),
            }}
            debtorsTabProps={{
              activateDebtorRow,
              activeDebtorRowId,
              activeLedgerRowId,
              activeOwnerUserId,
              balanceLedgerTable,
              balanceLedgerTableRef,
              beginEditTransaction,
              beginViewTransaction,
              busy,
              debtorDraftById,
              debtorRunningBalanceByTxId,
              debtorsTable,
              debtorsTableRef,
              deleteDebtor,
              flashingSaveButtonKey,
              groupedDebtors,
              handleDeleteTransaction,
              ledgerDraftById,
              listSearchQuery: listSearchQueryByTab.debtors,
              openCreateDebtorModal,
              openCreateIouTransactionModal,
              openLedgerEntityModal,
              saveDebtorRow,
              saveLedgerRow,
              selectedDebtorId,
              selectedOwnerUserId,
              setDebtorRowDraft,
              setInlineRowRef,
              setListSearchQuery: (value) => setListSearchQueryByTab((prev) => ({ ...prev, debtors: value })),
              setSelectedDebtorId,
              statementUploads,
            }}
            entityEndexTabProps={{
              beginEditEntity,
              busy,
              entityEndexFindingAll,
              entityEndexGuideByParentKey,
              entityEndexGuides,
              entityEndexParents,
              entityEndexQuery,
              entityEndexScanLogs,
              entityTransactionSummaryById,
              linkedAliasEntitiesByParentId,
              openEntityEndexGuideModal,
              runEntityMaintenanceAliasScan,
              setEntityEndexLogOpen,
              setEntityEndexQuery,
            }}
            ledgerTabProps={{
              activeLedgerRowId,
              activateLedgerRow,
              beginEditTransaction,
              beginViewTransaction,
              busy,
              customLedgerEndDate,
              customLedgerStartDate,
              filterPresetOptions: LEDGER_FILTER_PRESET_OPTIONS,
              flashingSaveButtonKey,
              getAccountDisplayName,
              handleDeleteTransaction,
              ledgerDateFilter,
              ledgerDisplayBalanceById,
              ledgerDraftById,
              ledgerFilterPreset,
              ledgerPagination,
              ledgerPaginationMode,
              ledgerTable,
              ledgerTableRef,
              listSearchQuery: listSearchQueryByTab.ledger,
              openCreateTransactionModal,
              openLedgerEntityModal,
              renderDateRangeControls,
              saveLedgerRow,
              setCustomLedgerEndDate,
              setCustomLedgerStartDate,
              setInlineRowRef,
              setLedgerArchivePage,
              setLedgerDateFilter: (value) => setLedgerDateFilter(value as DateRangeFilter),
              setLedgerFilterPreset: (value) => setLedgerFilterPreset(value as LedgerFilterPreset),
              setLedgerPaginationMode,
              setLedgerRowDraft,
              setListSearchQuery: (value) => setListSearchQueryByTab((prev) => ({ ...prev, ledger: value })),
            }}
            notificationsTabProps={{
              beginEditNotificationRule,
              busy,
              createNotificationRule,
              deleteNotificationRule,
              editingNotificationRuleId,
              notificationForm,
              notificationRules,
              parseCustomUserIds,
              resetNotificationForm,
              sendNotification,
              setNotificationForm,
              toggleNotificationRule,
              updateNotificationRule,
            }}
            payBillsTabProps={{
              activatePayBillRow,
              activeOwnerUserId,
              activePayBillRowId,
              beginViewTransaction,
              busy,
              customPayBillsEndDate,
              customPayBillsStartDate,
              deleteTransaction,
              flashingSaveButtonKey,
              getAccountDisplayName,
              listSearchQuery: listSearchQueryByTab.pay_bills,
              openLedgerEntityModal,
              payBillsAccountOptions,
              payBillsDateFilter,
              payBillsTable,
              payBillsTableRef,
              payBillDraftById,
              renderDateRangeControls,
              savePayBillRow,
              selectedOwnerUserId,
              setCustomPayBillsEndDate,
              setCustomPayBillsStartDate,
              setInlineRowRef,
              setListSearchQuery: (value) => setListSearchQueryByTab((prev) => ({ ...prev, pay_bills: value })),
              setPayBillRowDraft,
              setPayBillsDateFilter: (value) => setPayBillsDateFilter(value as DateRangeFilter),
              statementUploads,
              todayDate,
            }}
            recurringTabProps={{
              activeRecurringRowId,
              beginEditRecurring,
              busy,
              deleteRecurring,
              flashingSaveButtonKey,
              getAccountDisplayName,
              listSearchQuery: listSearchQueryByTab.recurring,
              openCreateRecurringModal,
              payBillsAccountOptions,
              recurringDraftById,
              recurringTable,
              recurringTableRef,
              saveRecurringRow,
              setInlineRowRef,
              setListSearchQuery: (value) => setListSearchQueryByTab((prev) => ({ ...prev, recurring: value })),
              setRecurringRowDraft,
            }}
            spreadsheetViewProps={{
              busy,
              selectedMonth: budgetMonth,
              recurringPayments: budgetPlannerRecurringPayments,
              transactions: filteredTransactions,
              entities: contactEntities,
              accounts: scopedAccounts,
              onSelectedMonthChange: setBudgetMonth,
              onEnsureBudgetMonth: async (monthValue) => { await ensureBudgetMonth({ month_value: monthValue }); },
              onUpdateTransaction: updateTransaction,
              onDeleteRecurring: handleDeleteRecurring,
              onOpenRecurring: beginEditRecurring,
            }}
            statementsPanelProps={{
              busy,
              accounts,
              bankingOrganizations,
              statementUploads,
              archivedStatementUploads,
              statementAuditRuns,
              transactions,
              ownerUserId: selectedOwnerUserId || activeOwnerUserId || 0,
              onUpload: uploadStatement,
              onRescan: rescanStatementUpload,
              onUpdateMetadata: updateStatementUploadMetadata,
              onArchiveStatement: archiveStatementUpload,
              onRestoreStatement: restoreStatementUpload,
              onDeleteArchivedStatement: deleteArchivedStatementUpload,
              onConfirmImport: confirmStatementImport,
              onReconcile: reconcileStatementUpload,
              onImportReviewRow: importStatementReviewRow,
              onLinkReviewRow: linkStatementReviewRow,
              onSearch: searchStatementUploads,
              onAuditStatements: auditStatementUploads,
              onAuditImportedCleanup: auditImportedTransactionCleanup,
              onPurgeImportedCleanup: purgeImportedTransactionCleanup,
              onPurgeAllImportedTransactions: purgeAllImportedStatementTransactions,
              onPurgeAllStatementUploads: purgeAllStatementUploads,
              onOpenTransaction: beginViewTransaction,
              onDeleteTransaction: handleDeleteTransaction,
            }}
            syncTabProps={{
              bankConnections,
              busy,
              createBankConnection,
              deleteBankConnection,
              formatAccountBackfillNote,
              formatAccountMappingLabel,
              formatSyncStatusLabel,
              formatSyncStatusMessage,
              isTellerRateLimited,
              lastSyncReport,
              linkedAccountsByConnectionId,
              openSyncHelp,
              runConnectionSync,
              runTellerConnect,
              summaryFormatAccountBackfillNote: formatSyncSummaryBackfillNote,
              summaryFormatAccountLabel: formatSyncSummaryAccountLabel,
              syncProvider,
              syncingConnectionId,
              updateBankConnection,
            }}
            tab={tab}
          />
          <Accumul8PageOverlays
            acknowledgeAllMessageBoardMessages={acknowledgeAllMessageBoardMessages}
            acknowledgeMessageBoardMessage={acknowledgeMessageBoardMessage}
            beginEditEntity={beginEditEntity}
            beginViewTransaction={beginViewTransaction}
            entityEndexLogOpen={entityEndexLogOpen}
            entityEndexScanLogs={entityEndexScanLogs}
            formatAccountDisplayName={getAccountDisplayName}
            loadMessageBoard={loadMessageBoard}
            messageBoardLoading={messageBoardLoading}
            messageBoardMessages={messageBoardMessages}
            messageBoardOpen={messageBoardOpen}
            messageBoardUnacknowledgedCount={messageBoardUnacknowledgedCount}
            onCloseEntityEndexLog={() => setEntityEndexLogOpen(false)}
            onCloseEntityHistory={() => setEntityHistoryEntityId(null)}
            onCloseMessageBoard={() => setMessageBoardOpen(false)}
            onCloseSyncHelp={() => setSyncHelpOpen(false)}
            onOpenStatementImportFallback={openStatementImportFallback}
            onOpenTransactionFromMessageBoard={beginViewTransaction}
            selectedEntityHistory={selectedEntityHistory}
            selectedEntityTransactions={selectedEntityTransactions}
            setTabToLedger={() => setTab('ledger')}
            syncHelpError={syncHelpError}
            syncHelpOpen={syncHelpOpen}
            syncHelpToken={syncHelpToken}
          />
          <Accumul8PageModalAssembly
            props={{
              entityModalProps: {
                open: entityModalOpen,
                busy,
                initialForm: entityForm,
                entity: editingEntity,
                entities,
                aliasDraft: editingEntity && entityAliasDraftById[editingEntity.id] ? entityAliasDraftById[editingEntity.id] : DEFAULT_ENTITY_ALIAS_DRAFT,
                entitySummary: editingEntity ? (entityTransactionSummaryById[editingEntity.id] || { count: 0, lastAmount: null, lastDate: '' }) : null,
                editing: editingEntityId !== null,
                onClose: closeEntityModal,
                onAliasDraftChange: (draft) => {
                  if (!editingEntity) return;
                  setEntityAliasDraftById((prev) => ({ ...prev, [editingEntity.id]: draft }));
                },
                onAddAlias: async () => {
                  if (!editingEntity) return;
                  await saveEntityAlias(editingEntity);
                },
                onDeleteAlias: removeEntityAlias,
                onSave: submitEntityForm,
              },
              ledgerEntityModalProps: {
                open: ledgerEntityModalTransactionId !== null,
                busy: busy || ledgerEntityModalSaving,
                transaction: ledgerEntityModalTransactionId !== null
                  ? (transactions.find((tx) => tx.id === ledgerEntityModalTransactionId) || null)
                  : null,
                entities: entitiesSorted,
                onClose: closeLedgerEntityModal,
                onSave: saveLedgerEntityRule,
              },
              entityEndexModalProps: {
                open: entityEndexGuideModalOpen,
                busy,
                guide: selectedEntityEndexGuide,
                parentEntity: selectedEntityEndexParentEntity,
                entities: entitiesWithResolvedAliases,
                aliasDraft: selectedEntityEndexParentEntity && entityAliasDraftById[selectedEntityEndexParentEntity.id]
                  ? entityAliasDraftById[selectedEntityEndexParentEntity.id]
                  : DEFAULT_ENTITY_ALIAS_DRAFT,
                onClose: closeEntityEndexGuideModal,
                onSave: saveEntityEndexGuide,
                onDelete: removeEntityEndexGuide,
                onFindRelated: runEntityEndexGuideFinder,
                onAliasDraftChange: (draft) => {
                  if (!selectedEntityEndexParentEntity) return;
                  setEntityAliasDraftById((prev) => ({ ...prev, [selectedEntityEndexParentEntity.id]: draft }));
                },
                onAddAlias: async () => {
                  if (!selectedEntityEndexParentEntity) return;
                  await saveEntityAlias(selectedEntityEndexParentEntity);
                },
                onRemoveAlias: removeEntityAlias,
              },
              contactModalProps: {
                open: contactModalOpen,
                busy,
                initialForm: contactForm,
                editing: editingContactId !== null,
                onClose: closeContactModal,
                onSave: submitContactForm,
              },
              debtorModalProps: {
                open: debtorModalOpen,
                busy,
                initialForm: debtorForm,
                editing: editingDebtorId !== null,
                onClose: closeDebtorModal,
                onSave: submitDebtorModal,
              },
              recurringModalProps: {
                open: recurringModalOpen,
                busy,
                initialForm: editingRecurringForm,
                entities: contactEntities,
                accounts: visibleAccounts,
                onClose: closeRecurringModal,
                onSave: submitRecurringModal,
              },
              transactionModalProps: {
                open: transactionModalOpen,
                busy,
                initialForm: ledgerForm,
                mode: transactionModalMode,
                variant: transactionModalVariant,
                transaction: editingTransactionId !== null
                  ? (transactions.find((tx) => tx.id === editingTransactionId) || null)
                  : viewingTransactionId !== null
                    ? (transactions.find((tx) => tx.id === viewingTransactionId) || null)
                    : null,
                entities: entitiesSorted,
                debtors: groupedDebtors,
                accounts: transactionModalVariant === 'iou' ? iouVisibleAccounts : visibleAccounts,
                statementUploads,
                ownerUserId: selectedOwnerUserId || activeOwnerUserId || 0,
                onClose: closeTransactionModal,
                onEdit: transactionModalMode === 'view' && viewingTransactionId !== null ? () => beginEditTransaction(viewingTransactionId) : undefined,
                onSave: submitTransactionModal,
              },
              bankingOrganizationManagerProps: {
                open: bankingOrganizationManagerOpen,
                onClose: () => setBankingOrganizationManagerOpen(false),
                mode: 'banking_organization',
                busy,
                bankingOrganizations,
                accounts,
                createBankingOrganization,
                updateBankingOrganization,
                deleteBankingOrganization,
                createAccount,
                updateAccount,
                deleteAccount,
              },
              accountManagerProps: {
                open: accountManagerOpen,
                onClose: () => setAccountManagerOpen(false),
                mode: 'account',
                busy,
                bankingOrganizations,
                accounts,
                createBankingOrganization,
                updateBankingOrganization,
                deleteBankingOrganization,
                createAccount,
                updateAccount,
                deleteAccount,
              },
            }}
          />
          {!loaded && <div className="text-muted mt-2">Loading Accumul8...</div>}
        </div>
      </section>
    </PageLayout>
  );
}

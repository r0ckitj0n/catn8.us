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
import { usePriorityTableLayout } from '../../hooks/usePriorityTableLayout';
import { ApiClient } from '../../core/ApiClient';
import { resolveAccumul8StatementLink } from '../../utils/accumul8StatementLink';
import { resolveAccumul8BankingOrganizationIconPath } from '../../utils/accumul8BankingOrganizationBranding';
import { getAccumul8AccountDisplayName } from '../../utils/accumul8Accounts';
import { getAccumul8TransactionEditPolicy } from '../../utils/accumul8TransactionPolicy';
import {
  OpeningBalanceMessageMeta,
  addUtcDays,
  formatAccountOptionLabel,
  formatCurrencyAmount,
  formatInlineDateTime,
  formatInlineText,
  formatSummaryWindowLabel,
  getLedgerEffectiveDate,
  getOpeningBalanceMessageMeta,
  isDateInRange,
  matchesSearchQuery,
  normalizeSearchQuery,
  roundCurrency,
} from './accumul8/accumul8PageDateSearchUtils';
import {
  formatEntityRoles,
  getActiveFilterClass,
  getLedgerDescriptionLabel,
  isIouAccount,
  isLaunchableHttpUrl,
  isOpeningBalanceTransaction,
  normalizeDebtorGroupKey,
  normalizeEntityAliasKey,
  normalizeEntityContactType,
  normalizeEntityKind,
  toEntityEndexGuideKey,
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
  Accumul8TellerSyncResponse,
  Accumul8TellerSyncAccountSummary,
  Accumul8ContactType,
  Accumul8Direction,
  Accumul8EntryType,
  Accumul8Frequency,
  Accumul8RecurringPayment,
  Accumul8Transaction,
  Accumul8Debtor,
  Accumul8Entity,
  Accumul8EntityAliasDraft,
  Accumul8EntityEndexGuide,
  Accumul8BootstrapResponse,
  Accumul8MessageBoardMessage,
} from '../../types/accumul8';
import { Accumul8PageHeader } from './accumul8/Accumul8PageHeader';
import { useAccumul8EntityEndexActions } from './accumul8/useAccumul8EntityEndexActions';
import { useAccumul8DebtorPayBillData } from './accumul8/useAccumul8DebtorPayBillData';
import { useAccumul8EntityDerivedData } from './accumul8/useAccumul8EntityDerivedData';
import { useAccumul8EntityListData } from './accumul8/useAccumul8EntityListData';
import { useAccumul8EntityTables } from './accumul8/useAccumul8EntityTables';
import { useAccumul8LedgerData } from './accumul8/useAccumul8LedgerData';
import { useAccumul8LedgerEntityRuleActions } from './accumul8/useAccumul8LedgerEntityRuleActions';
import { useAccumul8LedgerTable } from './accumul8/useAccumul8LedgerTable';
import { useAccumul8MessageBoardActions } from './accumul8/useAccumul8MessageBoardActions';
import { useAccumul8ModalHelperActions } from './accumul8/useAccumul8ModalHelperActions';
import { useAccumul8ModalEditorActions } from './accumul8/useAccumul8ModalEditorActions';
import { useAccumul8ModalResetActions } from './accumul8/useAccumul8ModalResetActions';
import { useAccumul8PageUiHelpers } from './accumul8/useAccumul8PageUiHelpers';
import { useAccumul8SecondaryTables } from './accumul8/useAccumul8SecondaryTables';
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
  const {
    acknowledgeAllMessageBoardMessages,
    acknowledgeMessageBoardMessage,
    handleBalanceBooks,
    handleRunAIcountantHousekeeping,
    handleRunAIcountantWatchlist,
    loadMessageBoard,
  } = useAccumul8MessageBoardActions({
    activeOwnerUserId,
    balancingBooks,
    load,
    onToast,
    runningAIcountantHousekeeping,
    runningAIcountantWatchlist,
    scopedActionUrl,
    selectedOwnerUserId,
    setBalancingBooks,
    setMessageBoardLoading,
    setMessageBoardMessages,
    setMessageBoardUnacknowledgedCount,
    setRunningAIcountantHousekeeping,
    setRunningAIcountantWatchlist,
  });
  React.useEffect(() => {
    void loadMessageBoard();
  }, [loadMessageBoard]);
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
  const { currentVisibleBalance, ledgerDisplayBalanceById, ledgerRows, ledgerSearchQuery } = useAccumul8LedgerData({
    customLedgerEndDate,
    customLedgerStartDate,
    filteredTransactions,
    getAccountDisplayName,
    ledgerDateFilter,
    ledgerFilterPreset,
    listSearchQueryByTab,
    scopedAccounts,
    todayDate,
  });
  const {
    debtorRows,
    debtorRunningBalanceByTxId,
    filteredRecurringPayments,
    groupedDebtors,
    payBillsAccountOptions,
    payBillsRows,
    projectedBalanceForWindow,
    recurringRows,
    selectedDebtorEntries,
    summaryWindowEndDate,
    summaryWindowTotals,
  } = useAccumul8DebtorPayBillData({
    accounts,
    currentVisibleBalance,
    customPayBillsEndDate,
    customPayBillsStartDate,
    debtors,
    debtorLedger,
    filteredTransactions,
    getAccountDisplayName,
    listSearchQueryByTab,
    payBillsDateFilter,
    recurringPayments,
    selectedBankAccountId,
    selectedBankingOrganizationId,
    selectedDebtorId,
    summaryWindow,
    todayDate,
  });
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
  const { ledgerPagination, ledgerTable } = useAccumul8LedgerTable({
    customLedgerEndDate,
    customLedgerStartDate,
    getAccountDisplayName,
    ledgerArchivePage,
    ledgerDateFilter,
    ledgerDisplayBalanceById,
    ledgerFilterPreset,
    ledgerPaginationMode,
    ledgerRows,
    ledgerSearchQuery,
    ledgerTableRef,
    selectedBankAccountId,
    selectedBankingOrganizationId,
    setLedgerArchivePage,
    todayDate,
  });
  const { debtorsTable, payBillsTable, recurringTable } = useAccumul8SecondaryTables({
    debtorsTableRef,
    debtorRows,
    getAccountDisplayName,
    payBillsRows,
    payBillsTableRef,
    recurringRows,
    recurringTableRef,
    todayDate,
  });
  const { flashSaveButton, linkedAccountsByConnectionId, parseCustomUserIds, renderDateRangeControls, setInlineRowRef } = useAccumul8PageUiHelpers({
    accounts,
    dateRangeFilterOptions: DATE_RANGE_FILTER_OPTIONS,
    flashSaveButtonTimeoutRef,
    getActiveFilterClass,
    inlineRowRefs,
    setFlashingSaveButtonKey,
  });
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
  const {
    closeContactModal,
    closeDebtorModal,
    closeEntityModal,
    closeLedgerEntityModal,
    closeRecurringModal,
    closeTransactionModal,
    collectEntityAliasNames,
    persistEntityAliases,
  } = useAccumul8ModalHelperActions({
    createEntityAlias,
    defaultEntityAliasDraft: DEFAULT_ENTITY_ALIAS_DRAFT,
    editingEntityId,
    entities,
    entityAliasDraftById,
    resetContactForm,
    resetDebtorForm,
    resetEntityForm,
    resetLedgerForm,
    resetRecurringEditor,
    setContactModalOpen,
    setDebtorModalOpen,
    setEntityAliasDraftById,
    setEntityModalOpen,
    setLedgerEntityModalTransactionId,
    setTransactionModalOpen,
    setTransactionModalVariant,
  });
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
    closeRecurringModal,
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
  const { saveLedgerEntityRule } = useAccumul8LedgerEntityRuleActions({
    accumul8ActionUrl,
    closeLedgerEntityModal,
    entities,
    entityAliases,
    entityEndexGuides,
    ledgerEntityModalTransactionId,
    load,
    onToast,
    recurringPayments,
    setLedgerEntityModalSaving,
    transactions,
  });
  const budgetRowsSorted = React.useMemo(() => (
    [...budgetRows].sort((a, b) => (a.row_order - b.row_order) || (a.id - b.id))
  ), [budgetRows]);
  const { entitiesSorted, entityRows } = useAccumul8EntityListData({
    entitiesWithResolvedAliases,
    listSearchQueryByTab,
  });
  const {
    balanceEntities,
    budgetActualByRowId,
    budgetPlannerRecurringPayments,
    contactEntities,
    entityEndexParents,
    entityTransactionSummaryById,
    iouVisibleAccounts,
    linkedAliasEntitiesByParentId,
    selectedEntityEndexGuide,
    selectedEntityEndexParentEntity,
    selectedEntityHistory,
    selectedEntityTransactions,
    spreadsheetTotals,
  } = useAccumul8EntityDerivedData({
    budgetMonth,
    budgetRowsSorted,
    editingEntityEndexGuideId,
    entities,
    entitiesSorted,
    entitiesWithResolvedAliases,
    entityEndexGuides,
    entityEndexQuery,
    entityHistoryEntityId,
    filteredRecurringPayments,
    filteredTransactions,
    transactions,
    visibleAccounts,
  });
  const entityEndexGuideByParentKey = React.useMemo(() => (
    entityEndexGuides.reduce<Record<string, Accumul8EntityEndexGuide>>((acc, guide) => {
      const key = toEntityEndexGuideKey(guide);
      if (key) {
        acc[key] = guide;
      }
      return acc;
    }, {})
  ), [entityEndexGuides]);
  const { balanceLedgerTable, entitiesTable } = useAccumul8EntityTables({
    balanceLedgerTableRef,
    debtorRunningBalanceByTxId,
    entitiesTableRef,
    entityRows,
    entityTransactionSummaryById,
    selectedDebtorEntries,
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

import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { useAccumul8 } from '../../hooks/useAccumul8';
import { usePriorityTableLayout } from '../../hooks/usePriorityTableLayout';
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
import { Accumul8AccessState } from './accumul8/Accumul8AccessState';
import { Accumul8PageContent } from './accumul8/Accumul8PageContent';
import { useAccumul8DebtorPayBillData } from './accumul8/useAccumul8DebtorPayBillData';
import { useAccumul8EntityDerivedData } from './accumul8/useAccumul8EntityDerivedData';
import { useAccumul8EntityListData } from './accumul8/useAccumul8EntityListData';
import { useAccumul8EntityTables } from './accumul8/useAccumul8EntityTables';
import { useAccumul8LedgerData } from './accumul8/useAccumul8LedgerData';
import { useAccumul8LedgerEntityRuleActions } from './accumul8/useAccumul8LedgerEntityRuleActions';
import { useAccumul8LedgerTable } from './accumul8/useAccumul8LedgerTable';
import { useAccumul8MessageBoardActions } from './accumul8/useAccumul8MessageBoardActions';
import { useAccumul8PageEffects } from './accumul8/useAccumul8PageEffects';
import { useAccumul8PageActionSetup } from './accumul8/useAccumul8PageActionSetup';
import { useAccumul8PageUiHelpers } from './accumul8/useAccumul8PageUiHelpers';
import { useAccumul8ResolvedEntityData } from './accumul8/useAccumul8ResolvedEntityData';
import { useAccumul8ScopeData } from './accumul8/useAccumul8ScopeData';
import { useAccumul8SecondaryTables } from './accumul8/useAccumul8SecondaryTables';
import { useAccumul8PageUiState } from './accumul8/useAccumul8PageUiState';
import { useAccumul8PageDerivedState } from './accumul8/useAccumul8PageDerivedState';
import { useAccumul8PageComposedProps } from './accumul8/useAccumul8PageComposedProps';
import { DebtorInlineDraft, EntityInlineDraft, RecurringInlineDraft } from './accumul8/useAccumul8InlineRowActions';
import {
  ACCUMUL8_OWNER_STORAGE_KEY,
  DATE_RANGE_FILTER_OPTIONS,
  DEFAULT_CONTACT_FORM,
  DEFAULT_ENTITY_ALIAS_DRAFT,
  DEFAULT_ENTITY_FORM,
  DEFAULT_RECURRING_FORM,
  LEDGER_FILTER_PRESET_OPTIONS,
  SUMMARY_WINDOW_OPTIONS,
} from './accumul8/accumul8PageDefaults';
import {
  Accumul8HeaderSummary,
  Accumul8SyncReport,
  DateRangeFilter,
  EntityFormState,
  LedgerFilterPreset,
  LedgerPaginationMode,
  SearchableListTabKey,
  TabKey,
} from './accumul8/accumul8PageTypes';
import './Accumul8Page.css';

interface Accumul8PageProps extends AppShellPageProps {
  onToast?: (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}
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
  const [entityAliasDraftById, setEntityAliasDraftById] = React.useState<Record<number, Accumul8EntityAliasDraft>>({});
  const [activeLedgerRowId, setActiveLedgerRowId] = React.useState<number | null>(null);
  const [activePayBillRowId, setActivePayBillRowId] = React.useState<number | null>(null);
  const [activeDebtorRowId, setActiveDebtorRowId] = React.useState<number | null>(null);
  const [activeEntityRowId, setActiveEntityRowId] = React.useState<number | null>(null);
  const [activeRecurringRowId, setActiveRecurringRowId] = React.useState<number | null>(null);
  const [ledgerDraftById, setLedgerDraftById] = React.useState<Record<number, LedgerInlineDraft>>({});
  const [payBillDraftById, setPayBillDraftById] = React.useState<Record<number, LedgerInlineDraft>>({});
  const [debtorDraftById, setDebtorDraftById] = React.useState<Record<number, DebtorInlineDraft>>({});
  const [entityDraftById, setEntityDraftById] = React.useState<Record<number, EntityInlineDraft>>({});
  const [recurringDraftById, setRecurringDraftById] = React.useState<Record<number, RecurringInlineDraft>>({});
  const {
    accountManagerOpen,
    balanceLedgerTableRef,
    balancingBooks,
    bankingOrganizationManagerOpen,
    contactModalOpen,
    debtorsTableRef,
    debtorModalOpen,
    editingEntityEndexGuideId,
    entitiesTableRef,
    entityEndexFindingAll,
    entityEndexGuideModalOpen,
    entityEndexLogOpen,
    entityEndexQuery,
    entityHistoryEntityId,
    entityModalOpen,
    flashSaveButtonTimeoutRef,
    flashingSaveButtonKey,
    inlineRowRefs,
    isHeaderLogoSpinning,
    launchableBankingOrganizations,
    ledgerEntityModalSaving,
    ledgerEntityModalTransactionId,
    ledgerFilterPreset,
    ledgerTableRef,
    listSearchQueryByTab,
    messageBoardLoading,
    messageBoardMessages,
    messageBoardOpen,
    messageBoardUnacknowledgedCount,
    openBankingOrganizationPopup,
    payBillsTableRef,
    recurringModalOpen,
    recurringTableRef,
    runningAIcountantHousekeeping,
    runningAIcountantWatchlist,
    scopedActionUrl,
    selectedBankAccountId,
    selectedBankingOrganizationId,
    selectedDebtorId,
    setAccountManagerOpen,
    setBalancingBooks,
    setBankingOrganizationManagerOpen,
    setContactModalOpen,
    setDebtorModalOpen,
    setEditingEntityEndexGuideId,
    setEntityEndexFindingAll,
    setEntityEndexGuideModalOpen,
    setEntityEndexLogOpen,
    setEntityEndexQuery,
    setEntityHistoryEntityId,
    setEntityModalOpen,
    setFlashingSaveButtonKey,
    setLedgerEntityModalSaving,
    setLedgerEntityModalTransactionId,
    setLedgerFilterPreset,
    setListSearchQueryByTab,
    setMessageBoardLoading,
    setMessageBoardMessages,
    setMessageBoardOpen,
    setMessageBoardUnacknowledgedCount,
    setRecurringModalOpen,
    setRunningAIcountantHousekeeping,
    setRunningAIcountantWatchlist,
    setSelectedBankAccountId,
    setSelectedBankingOrganizationId,
    setSelectedDebtorId,
    setSettingsMenuOpen,
    setSettingsMenuPosition,
    setSummaryWindow,
    setSyncHelpError,
    setSyncHelpOpen,
    setSyncHelpToken,
    setTransactionModalMode,
    setTransactionModalOpen,
    setTransactionModalVariant,
    settingsButtonRef,
    settingsMenuOpen,
    settingsMenuPosition,
    settingsMenuRef,
    summaryWindow,
    syncHelpError,
    syncHelpOpen,
    syncHelpToken,
    transactionModalMode,
    transactionModalOpen,
    transactionModalVariant,
  } = useAccumul8PageUiState({
    activeOwnerUserId,
    bankingOrganizations,
    busy,
    initialLedgerFilterPreset: 'all' as LedgerFilterPreset,
    initialListSearchQueryByTab: {
      ledger: '',
      debtors: '',
      pay_bills: '',
      contacts: '',
      recurring: '',
    } as Record<SearchableListTabKey, string>,
    initialMessageBoardMessages: [] as Accumul8MessageBoardMessage[],
    initialSummaryWindow: 90 as SummaryWindowOption,
    onToast,
    ownerStorageKey: ACCUMUL8_OWNER_STORAGE_KEY,
    selectedOwnerUserId,
    setSelectedOwnerUserId,
    syncingConnectionId,
  });
  React.useEffect(() => {
    if (tab !== 'statements' || statementsLoaded) {
      return;
    }
    void loadStatementWorkspace();
  }, [loadStatementWorkspace, statementsLoaded, tab]);
  const scopeData = useAccumul8ScopeData({
    accounts,
    accessibleAccountOwners,
    activeOwnerUserId,
    selectedBankAccountId,
    selectedBankingOrganizationId,
    selectedOwnerUserId,
    setSelectedBankAccountId,
    transactions,
  });
  const messageBoardActions = useAccumul8MessageBoardActions({
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
    void messageBoardActions.loadMessageBoard();
  }, [messageBoardActions]);
  const todayDate = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const ledgerData = useAccumul8LedgerData({
    customLedgerEndDate,
    customLedgerStartDate,
    filteredTransactions: scopeData.filteredTransactions,
    getAccountDisplayName: scopeData.getAccountDisplayName,
    ledgerDateFilter,
    ledgerFilterPreset,
    listSearchQueryByTab,
    scopedAccounts: scopeData.scopedAccounts,
    todayDate,
  });
  const debtorPayBillData = useAccumul8DebtorPayBillData({
    accounts,
    currentVisibleBalance: ledgerData.currentVisibleBalance,
    customPayBillsEndDate,
    customPayBillsStartDate,
    debtors,
    debtorLedger,
    filteredTransactions: scopeData.filteredTransactions,
    getAccountDisplayName: scopeData.getAccountDisplayName,
    listSearchQueryByTab,
    payBillsDateFilter,
    recurringPayments,
    selectedBankAccountId,
    selectedBankingOrganizationId,
    selectedDebtorId,
    summaryWindow,
    todayDate,
  });
  const resolvedEntityData = useAccumul8ResolvedEntityData({
    currentVisibleBalance: ledgerData.currentVisibleBalance,
    editingEntityId,
    entities,
    entityAliases,
    summaryWindowTotals: debtorPayBillData.summaryWindowTotals,
  });
  const ledgerTableData = useAccumul8LedgerTable({
    customLedgerEndDate,
    customLedgerStartDate,
    getAccountDisplayName: scopeData.getAccountDisplayName,
    ledgerArchivePage,
    ledgerDateFilter,
    ledgerDisplayBalanceById: ledgerData.ledgerDisplayBalanceById,
    ledgerFilterPreset,
    ledgerPaginationMode,
    ledgerRows: ledgerData.ledgerRows,
    ledgerSearchQuery: ledgerData.ledgerSearchQuery,
    ledgerTableRef,
    selectedBankAccountId,
    selectedBankingOrganizationId,
    setLedgerArchivePage,
    todayDate,
  });
  const secondaryTables = useAccumul8SecondaryTables({
    debtorsTableRef,
    debtorRows: debtorPayBillData.debtorRows,
    getAccountDisplayName: scopeData.getAccountDisplayName,
    payBillsRows: debtorPayBillData.payBillsRows,
    payBillsTableRef,
    recurringRows: debtorPayBillData.recurringRows,
    recurringTableRef,
    todayDate,
  });
  const pageUiHelpers = useAccumul8PageUiHelpers({
    accounts,
    dateRangeFilterOptions: DATE_RANGE_FILTER_OPTIONS,
    flashSaveButtonTimeoutRef,
    getActiveFilterClass,
    inlineRowRefs,
    setFlashingSaveButtonKey,
  });
  const pageActions = useAccumul8PageActionSetup({
    contacts,
    createContact,
    createDebtor,
    createEntity,
    createEntityAlias,
    createEntityEndexGuide,
    createRecurring,
    createTransaction,
    DEFAULT_CONTACT_FORM,
    DEFAULT_ENTITY_ALIAS_DRAFT,
    DEFAULT_ENTITY_FORM,
    DEFAULT_RECURRING_FORM,
    debtorDraftById,
    deleteEntityAlias,
    deleteEntityEndexGuide,
    deleteRecurring,
    deleteTransaction,
    editingContactId,
    editingDebtorId,
    editingEntityEndexGuideId,
    editingEntityId,
    editingNotificationRuleId,
    editingRecurringForm,
    editingRecurringId,
    editingTransactionId,
    entities,
    entityAliasDraftById,
    entityDraftById,
    findAllEntityAliases,
    findEntityAliases,
    load,
    notificationRules,
    onToast,
    payBillDraftById,
    recurringDraftById,
    recurringPayments,
    scopedActionUrl,
    selectedBankAccountId,
    setActiveDebtorRowId,
    setActiveEntityRowId,
    setActiveLedgerRowId,
    setActivePayBillRowId,
    setActiveRecurringRowId,
    setBudgetForm,
    setContactForm,
    setContactModalOpen,
    setDebtorDraftById,
    setDebtorForm,
    setDebtorModalOpen,
    setEditingBudgetRowId,
    setEditingContactId,
    setEditingDebtorId,
    setEditingEntityEndexGuideId,
    setEditingEntityId,
    setEditingNotificationRuleId,
    setEditingRecurringForm,
    setEditingRecurringId,
    setEditingTransactionId,
    setEntityAliasDraftById,
    setEntityDraftById,
    setEntityEndexFindingAll,
    setEntityEndexGuideModalOpen,
    setEntityForm,
    setEntityModalOpen,
    setLastSyncReport,
    setLedgerDraftById,
    setLedgerEntityModalTransactionId,
    setLedgerForm,
    setNotificationForm,
    setPayBillDraftById,
    setRecurringDraftById,
    setRecurringModalOpen,
    setSyncHelpError,
    setSyncHelpOpen,
    setSyncHelpToken,
    setSyncingConnectionId,
    setTab,
    setTransactionModalMode,
    setTransactionModalOpen,
    setTransactionModalVariant,
    setViewingTransactionId,
    syncBankConnection,
    syncProvider,
    transactions,
    updateContact,
    updateDebtor,
    updateEntity,
    updateEntityEndexGuide,
    updateRecurring,
    updateTransaction,
  });
  const closeEntityEndexGuideModal = React.useCallback(() => {
    setEditingEntityEndexGuideId(null);
    setEntityEndexGuideModalOpen(false);
  }, [setEditingEntityEndexGuideId, setEntityEndexGuideModalOpen]);
  const { saveLedgerEntityRule } = useAccumul8LedgerEntityRuleActions({
    accumul8ActionUrl,
    closeLedgerEntityModal: pageActions.closeLedgerEntityModal,
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
  const pageDerivedState = useAccumul8PageDerivedState({
    activeDebtorRowId,
    activeEntityRowId,
    activeLedgerRowId,
    activePayBillRowId,
    activeRecurringRowId,
    budgetRows,
    debtorDraftById,
    entityDraftById,
    entityEndexGuides,
    ledgerDraftById,
    payBillDraftById,
    recurringDraftById,
    setActiveDebtorRowId,
    setActiveEntityRowId,
    setActiveLedgerRowId,
    setActivePayBillRowId,
    setActiveRecurringRowId,
    setSummaryWindow,
    summaryWindowOptions: SUMMARY_WINDOW_OPTIONS,
  });
  const entityListData = useAccumul8EntityListData({
    entitiesWithResolvedAliases: resolvedEntityData.entitiesWithResolvedAliases,
    listSearchQueryByTab,
  });
  const entityDerivedData = useAccumul8EntityDerivedData({
    budgetMonth,
    budgetRowsSorted: pageDerivedState.budgetRowsSorted,
    editingEntityEndexGuideId,
    entities,
    entitiesSorted: entityListData.entitiesSorted,
    entitiesWithResolvedAliases: resolvedEntityData.entitiesWithResolvedAliases,
    entityEndexGuides,
    entityEndexQuery,
    entityHistoryEntityId,
    filteredRecurringPayments: debtorPayBillData.filteredRecurringPayments,
    filteredTransactions: scopeData.filteredTransactions,
    transactions,
    visibleAccounts: scopeData.visibleAccounts,
  });
  const entityTables = useAccumul8EntityTables({
    balanceLedgerTableRef,
    debtorRunningBalanceByTxId: debtorPayBillData.debtorRunningBalanceByTxId,
    entitiesTableRef,
    entityRows: entityListData.entityRows,
    entityTransactionSummaryById: entityDerivedData.entityTransactionSummaryById,
    selectedDebtorEntries: debtorPayBillData.selectedDebtorEntries,
  });
  useAccumul8PageEffects({
    activeRows: pageDerivedState.activeInlineRows,
    flashSaveButton: pageUiHelpers.flashSaveButton,
    flashSaveButtonTimeoutRef,
    inlineRowRefs,
    setSettingsMenuOpen,
    setSettingsMenuPosition,
    settingsButtonRef,
    settingsMenuOpen,
    settingsMenuRef,
  });
  const composedConstants = {
    ACCUMUL8_OWNER_STORAGE_KEY, DEFAULT_ENTITY_ALIAS_DRAFT, LEDGER_FILTER_PRESET_OPTIONS,
    formatAccountBackfillNote, formatAccountMappingLabel, formatAccountOptionLabel, formatCurrencyAmount, formatSummaryWindowLabel,
    formatSyncStatusLabel, formatSyncStatusMessage, formatSyncSummaryAccountLabel, formatSyncSummaryBackfillNote,
    getActiveFilterClass, isTellerRateLimited, normalizeEntityKind,
  };
  const composedData = {
    accessibleAccountOwners, accounts, activeEntityRowId, activeLedgerRowId, activeOwnerUserId, activePayBillRowId, activeRecurringRowId,
    archiveStatementUpload, archivedStatementUploads, auditImportedTransactionCleanup, auditStatementUploads, bankConnections, bankingOrganizations,
    budgetMonth, busy, confirmStatementImport, createAccount, createBankConnection, createBankingOrganization, createNotificationRule,
    customLedgerEndDate, customLedgerStartDate, customPayBillsEndDate, customPayBillsStartDate, debtorDraftById, debtorForm,
    debtorRunningBalanceByTxId: debtorPayBillData.debtorRunningBalanceByTxId, deleteBankConnection, deleteDebtor, deleteNotificationRule, deleteRecurring, deleteTransaction,
    editingContactId, editingDebtorId, editingEntity: resolvedEntityData.editingEntity, editingEntityId, editingNotificationRuleId, editingRecurringForm, editingRecurringId,
    editingTransactionId, entities, entitiesSorted: entityListData.entitiesSorted, entitiesWithResolvedAliases: resolvedEntityData.entitiesWithResolvedAliases, entityAliasDraftById, entityDraftById, entityEndexGuides,
    entityEndexScanLogs, entityForm, groupedDebtors: debtorPayBillData.groupedDebtors, headerSummary: resolvedEntityData.headerSummary, importStatementReviewRow, lastSyncReport, ledgerDateFilter,
    ledgerDisplayBalanceById: ledgerData.ledgerDisplayBalanceById, ledgerDraftById, ledgerForm, ledgerPagination: ledgerTableData.ledgerPagination, ledgerPaginationMode, ledgerTable: ledgerTableData.ledgerTable, linkStatementReviewRow, load,
    notificationForm, notificationRules, onToast, payBillsAccountOptions: debtorPayBillData.payBillsAccountOptions, payBillsDateFilter, payBillDraftById, projectedBalanceForWindow: debtorPayBillData.projectedBalanceForWindow,
    purgeImportedTransactionCleanup, purgeAllImportedStatementTransactions, purgeAllStatementUploads, reconcileStatementUpload,
    recurringDraftById, saveLedgerEntityRule, searchStatementUploads, selectedOwnerUserId, sendNotification, setBudgetMonth,
    setCustomLedgerEndDate, setCustomLedgerStartDate, setCustomPayBillsEndDate, setCustomPayBillsStartDate, setEntityAliasDraftById,
    setEntityRowDraft: pageActions.setEntityRowDraft, setLedgerArchivePage, setLedgerDateFilter, setLedgerPaginationMode, setLedgerRowDraft: pageActions.setLedgerRowDraft, setNotificationForm,
    setPayBillsDateFilter, setSelectedOwnerUserId, setTab, statementAuditRuns, statementUploads, syncProvider, syncingConnectionId, tab,
    todayDate, toggleNotificationRule, transactions, updateAccount, updateBankConnection, updateBankingOrganization, updateNotificationRule,
    updateStatementUploadMetadata, updateTransaction, uploadStatement, viewer, viewingTransactionId, closeEntityEndexGuideModal,
    contactForm,
  };
  const composedTables = { balanceLedgerTable: entityTables.balanceLedgerTable, debtorsTable: secondaryTables.debtorsTable, entitiesTable: entityTables.entitiesTable, payBillsTable: secondaryTables.payBillsTable, recurringTable: secondaryTables.recurringTable };
  const composedUi = {
    accountManagerOpen, balanceLedgerTableRef, balancingBooks, bankingOrganizationManagerOpen, contactModalOpen, debtorsTableRef,
    debtorModalOpen, editingEntityEndexGuideId, entitiesTableRef, entityEndexFindingAll, entityEndexGuideModalOpen, entityEndexLogOpen,
    entityEndexQuery, entityModalOpen, flashingSaveButtonKey, isHeaderLogoSpinning, launchableBankingOrganizations,
    ledgerEntityModalSaving, ledgerEntityModalTransactionId, ledgerFilterPreset, ledgerTableRef, listSearchQueryByTab,
    messageBoardLoading, messageBoardMessages, messageBoardOpen, messageBoardUnacknowledgedCount, openBankingOrganizationPopup,
    payBillsTableRef, recurringModalOpen, recurringTableRef, runningAIcountantHousekeeping, runningAIcountantWatchlist,
    selectedBankAccountId, selectedBankingOrganizationId, selectedDebtorId, setAccountManagerOpen, setBankingOrganizationManagerOpen,
    setEntityEndexLogOpen, setEntityEndexQuery, setEntityHistoryEntityId, setLedgerFilterPreset, setListSearchQueryByTab,
    setMessageBoardOpen, setSelectedBankAccountId, setSelectedBankingOrganizationId, setSelectedDebtorId, setSettingsMenuOpen,
    settingsButtonRef, settingsMenuOpen, settingsMenuPosition, settingsMenuRef, summaryWindow, syncHelpError, syncHelpOpen,
    syncHelpToken, transactionModalMode, transactionModalOpen, transactionModalVariant,
  };
  const composedProps = useAccumul8PageComposedProps({
    actions: pageActions,
    constants: composedConstants,
    data: composedData,
    derived: pageDerivedState,
    entityDerived: entityDerivedData,
    helpers: pageUiHelpers,
    messageBoard: messageBoardActions,
    scope: scopeData,
    tables: composedTables,
    ui: composedUi,
  });
  if (!isAuthed) {
    return <Accumul8AccessState viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle} mode="login" />;
  }
  if (!canAccess) {
    return <Accumul8AccessState viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle} mode="forbidden" />;
  }
  return (
    <Accumul8PageContent
      viewer={viewer}
      onLoginClick={onLoginClick}
      onLogout={onLogout}
      onAccountClick={onAccountClick}
      mysteryTitle={mysteryTitle}
      headerProps={composedProps.headerProps}
      tabContentProps={composedProps.tabContentProps}
      overlayProps={composedProps.overlayProps}
      modalProps={composedProps.modalProps}
      loaded={loaded}
    />
  );
}

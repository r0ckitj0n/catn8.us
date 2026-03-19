import React from 'react';

import { DATE_RANGE_FILTER_OPTIONS, DEFAULT_CONTACT_FORM, DEFAULT_ENTITY_ALIAS_DRAFT, DEFAULT_ENTITY_FORM, DEFAULT_RECURRING_FORM, SUMMARY_WINDOW_OPTIONS } from './accumul8PageDefaults';
import { getActiveFilterClass, normalizeEntityKind } from './accumul8PageEntityUtils';
import { formatAccountBackfillNote, formatAccountMappingLabel, formatSyncStatusLabel, formatSyncStatusMessage, formatSyncSummaryAccountLabel, formatSyncSummaryBackfillNote, isTellerRateLimited } from './accumul8PageRecurringSyncUtils';
import { formatAccountOptionLabel, formatCurrencyAmount, formatSummaryWindowLabel } from './accumul8PageDateSearchUtils';
import { useAccumul8DebtorPayBillData } from './useAccumul8DebtorPayBillData';
import { useAccumul8EntityDerivedData } from './useAccumul8EntityDerivedData';
import { useAccumul8EntityListData } from './useAccumul8EntityListData';
import { useAccumul8EntityTables } from './useAccumul8EntityTables';
import { useAccumul8LedgerData } from './useAccumul8LedgerData';
import { useAccumul8LedgerEntityRuleActions } from './useAccumul8LedgerEntityRuleActions';
import { useAccumul8LedgerTable } from './useAccumul8LedgerTable';
import { useAccumul8MessageBoardActions } from './useAccumul8MessageBoardActions';
import { useAccumul8PageActionSetup } from './useAccumul8PageActionSetup';
import { useAccumul8PageDerivedState } from './useAccumul8PageDerivedState';
import { useAccumul8PageEffects } from './useAccumul8PageEffects';
import { useAccumul8PageUiHelpers } from './useAccumul8PageUiHelpers';
import { useAccumul8ResolvedEntityData } from './useAccumul8ResolvedEntityData';
import { useAccumul8ScopeData } from './useAccumul8ScopeData';
import { useAccumul8SecondaryTables } from './useAccumul8SecondaryTables';

export function useAccumul8PageDataSetup(session: any, state: any, onToast?: (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void) {
  const ownerScopeKey = React.useMemo(() => String(session.selectedOwnerUserId || session.activeOwnerUserId || 0), [session.activeOwnerUserId, session.selectedOwnerUserId]);
  const pendingTransactionsRequestRef = React.useRef<string>('');

  React.useEffect(() => {
    if (state.tab !== 'statements' || session.statementsLoaded) return;
    void session.loadStatementWorkspace();
  }, [session.statementsLoaded, session.selectedOwnerUserId, state.tab]);

  const shouldHydrateFullTransactions = React.useMemo(() => (
    state.tab !== 'ledger'
    || state.ledgerPaginationMode === 'all'
    || state.ledgerDateFilter !== 'all_dates'
    || state.ledgerFilterPreset !== 'all'
    || state.listSearchQueryByTab.ledger.trim() !== ''
    || state.selectedBankAccountId !== ''
    || state.selectedBankingOrganizationId !== ''
  ), [
    state.ledgerDateFilter,
    state.ledgerFilterPreset,
    state.ledgerPaginationMode,
    state.listSearchQueryByTab.ledger,
    state.selectedBankAccountId,
    state.selectedBankingOrganizationId,
    state.tab,
  ]);

  React.useEffect(() => {
    if (!shouldHydrateFullTransactions) return;
    if (session.transactionsPagination?.is_full_dataset) return;
    const requestKey = `all:${ownerScopeKey}`;
    if (pendingTransactionsRequestRef.current === requestKey) return;
    pendingTransactionsRequestRef.current = requestKey;
    void session.loadAllTransactions().finally(() => {
      if (pendingTransactionsRequestRef.current === requestKey) {
        pendingTransactionsRequestRef.current = '';
      }
    });
  }, [ownerScopeKey, session.transactionsPagination?.is_full_dataset, shouldHydrateFullTransactions]);

  React.useEffect(() => {
    if (shouldHydrateFullTransactions) return;
    if (state.tab !== 'ledger') return;
    if (session.transactionsPagination?.is_full_dataset) return;
    const currentPage = Number(session.transactionsPagination?.current_page || 1);
    if (currentPage === state.ledgerArchivePage) return;
    const requestKey = `page:${ownerScopeKey}:${state.ledgerArchivePage}:${Number(session.transactionsPagination?.page_size || 250)}`;
    if (pendingTransactionsRequestRef.current === requestKey) return;
    pendingTransactionsRequestRef.current = requestKey;
    void session.loadTransactionsPage(state.ledgerArchivePage, Number(session.transactionsPagination?.page_size || 250)).finally(() => {
      if (pendingTransactionsRequestRef.current === requestKey) {
        pendingTransactionsRequestRef.current = '';
      }
    });
  }, [
    ownerScopeKey,
    session.transactionsPagination?.current_page,
    session.transactionsPagination?.is_full_dataset,
    session.transactionsPagination?.page_size,
    shouldHydrateFullTransactions,
    state.ledgerArchivePage,
    state.tab,
  ]);

  const scopeData = useAccumul8ScopeData({
    accounts: session.accounts,
    accessibleAccountOwners: session.accessibleAccountOwners,
    activeOwnerUserId: session.activeOwnerUserId,
    selectedBankAccountId: state.selectedBankAccountId,
    selectedBankingOrganizationId: state.selectedBankingOrganizationId,
    selectedOwnerUserId: session.selectedOwnerUserId,
    setSelectedBankAccountId: state.setSelectedBankAccountId,
    transactions: session.transactions,
  });
  const messageBoardActions = useAccumul8MessageBoardActions({
    activeOwnerUserId: session.activeOwnerUserId, balancingBooks: state.balancingBooks, load: session.load, onToast,
    runningAIcountantHousekeeping: state.runningAIcountantHousekeeping, runningAIcountantWatchlist: state.runningAIcountantWatchlist, scopedActionUrl: state.scopedActionUrl,
    selectedOwnerUserId: session.selectedOwnerUserId, setBalancingBooks: state.setBalancingBooks, setMessageBoardLoading: state.setMessageBoardLoading,
    setMessageBoardMessages: state.setMessageBoardMessages, setMessageBoardUnacknowledgedCount: state.setMessageBoardUnacknowledgedCount,
    setRunningAIcountantHousekeeping: state.setRunningAIcountantHousekeeping, setRunningAIcountantWatchlist: state.setRunningAIcountantWatchlist,
  });
  React.useEffect(() => { void messageBoardActions.loadMessageBoard(); }, [messageBoardActions.loadMessageBoard]);
  const todayDate = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const ledgerData = useAccumul8LedgerData({
    customLedgerEndDate: state.customLedgerEndDate, customLedgerStartDate: state.customLedgerStartDate, filteredTransactions: scopeData.filteredTransactions,
    getAccountDisplayName: scopeData.getAccountDisplayName, ledgerDateFilter: state.ledgerDateFilter, ledgerFilterPreset: state.ledgerFilterPreset,
    listSearchQueryByTab: state.listSearchQueryByTab, scopedAccounts: scopeData.scopedAccounts, todayDate,
  });
  const debtorPayBillData = useAccumul8DebtorPayBillData({
    accounts: session.accounts, currentVisibleBalance: ledgerData.currentVisibleBalance, customPayBillsEndDate: state.customPayBillsEndDate,
    customPayBillsStartDate: state.customPayBillsStartDate, debtors: session.debtors, debtorLedger: session.debtorLedger,
    filteredTransactions: scopeData.filteredTransactions, getAccountDisplayName: scopeData.getAccountDisplayName, listSearchQueryByTab: state.listSearchQueryByTab,
    payBillsDateFilter: state.payBillsDateFilter, recurringPayments: session.recurringPayments, selectedBankAccountId: state.selectedBankAccountId,
    selectedBankingOrganizationId: state.selectedBankingOrganizationId, selectedDebtorId: state.selectedDebtorId, summaryWindow: state.summaryWindow, todayDate,
  });
  const resolvedEntityData = useAccumul8ResolvedEntityData({
    currentVisibleBalance: ledgerData.currentVisibleBalance, editingEntityId: state.editingEntityId, entities: session.entities, entityAliases: session.entityAliases,
    summaryWindowTotals: debtorPayBillData.summaryWindowTotals,
  });
  const ledgerTableData = useAccumul8LedgerTable({
    customLedgerEndDate: state.customLedgerEndDate, customLedgerStartDate: state.customLedgerStartDate, getAccountDisplayName: scopeData.getAccountDisplayName,
    ledgerArchivePage: state.ledgerArchivePage, ledgerDateFilter: state.ledgerDateFilter, ledgerDisplayBalanceById: ledgerData.ledgerDisplayBalanceById,
    ledgerFilterPreset: state.ledgerFilterPreset, ledgerPaginationMode: state.ledgerPaginationMode, ledgerRows: ledgerData.ledgerRows, ledgerSearchQuery: ledgerData.ledgerSearchQuery,
    ledgerTableRef: state.ledgerTableRef, selectedBankAccountId: state.selectedBankAccountId, selectedBankingOrganizationId: state.selectedBankingOrganizationId,
    setLedgerArchivePage: state.setLedgerArchivePage, todayDate, transactionsPagination: session.transactionsPagination,
  });
  const secondaryTables = useAccumul8SecondaryTables({
    debtorsTableRef: state.debtorsTableRef, debtorRows: debtorPayBillData.debtorRows, getAccountDisplayName: scopeData.getAccountDisplayName, payBillsRows: debtorPayBillData.payBillsRows,
    payBillsTableRef: state.payBillsTableRef, recurringRows: debtorPayBillData.recurringRows, recurringTableRef: state.recurringTableRef, todayDate,
  });
  const pageUiHelpers = useAccumul8PageUiHelpers({
    accounts: session.accounts, dateRangeFilterOptions: DATE_RANGE_FILTER_OPTIONS, flashSaveButtonTimeoutRef: state.flashSaveButtonTimeoutRef,
    getActiveFilterClass, inlineRowRefs: state.inlineRowRefs, setFlashingSaveButtonKey: state.setFlashingSaveButtonKey,
  });
  const pageActions = useAccumul8PageActionSetup({
    contacts: session.contacts, createContact: session.createContact, createDebtor: session.createDebtor, createEntity: session.createEntity, createEntityAlias: session.createEntityAlias,
    createEntityEndexGuide: session.createEntityEndexGuide, createRecurring: session.createRecurring, createTransaction: session.createTransaction, DEFAULT_CONTACT_FORM, DEFAULT_ENTITY_ALIAS_DRAFT,
    DEFAULT_ENTITY_FORM, DEFAULT_RECURRING_FORM, debtorDraftById: state.debtorDraftById, deleteEntityAlias: session.deleteEntityAlias, deleteEntityEndexGuide: session.deleteEntityEndexGuide,
    deleteRecurring: session.deleteRecurring, deleteTransaction: session.deleteTransaction, editingContactId: state.editingContactId, editingDebtorId: state.editingDebtorId,
    editingEntityEndexGuideId: state.editingEntityEndexGuideId, editingEntityId: state.editingEntityId, editingNotificationRuleId: state.editingNotificationRuleId,
    editingRecurringForm: state.editingRecurringForm, editingRecurringId: state.editingRecurringId, editingTransactionId: state.editingTransactionId, entities: session.entities,
    entityAliasDraftById: state.entityAliasDraftById, entityDraftById: state.entityDraftById, findAllEntityAliases: session.findAllEntityAliases, findEntityAliases: session.findEntityAliases,
    load: session.load, notificationRules: session.notificationRules, onToast, payBillDraftById: state.payBillDraftById, recurringDraftById: state.recurringDraftById,
    recurringPayments: session.recurringPayments, scopedActionUrl: state.scopedActionUrl, selectedBankAccountId: state.selectedBankAccountId, setActiveDebtorRowId: state.setActiveDebtorRowId,
    setActiveEntityRowId: state.setActiveEntityRowId, setActiveLedgerRowId: state.setActiveLedgerRowId, setActivePayBillRowId: state.setActivePayBillRowId,
    setActiveRecurringRowId: state.setActiveRecurringRowId, setBudgetForm: state.setBudgetForm, setContactForm: state.setContactForm, setContactModalOpen: state.setContactModalOpen,
    setDebtorDraftById: state.setDebtorDraftById, setDebtorForm: state.setDebtorForm, setDebtorModalOpen: state.setDebtorModalOpen, setEditingBudgetRowId: state.setEditingBudgetRowId,
    setEditingContactId: state.setEditingContactId, setEditingDebtorId: state.setEditingDebtorId, setEditingEntityEndexGuideId: state.setEditingEntityEndexGuideId, setEditingEntityId: state.setEditingEntityId,
    setEditingNotificationRuleId: state.setEditingNotificationRuleId, setEditingRecurringForm: state.setEditingRecurringForm, setEditingRecurringId: state.setEditingRecurringId,
    setEditingTransactionId: state.setEditingTransactionId, setEntityAliasDraftById: state.setEntityAliasDraftById, setEntityDraftById: state.setEntityDraftById,
    setEntityEndexFindingAll: state.setEntityEndexFindingAll, setEntityEndexGuideModalOpen: state.setEntityEndexGuideModalOpen, setEntityForm: state.setEntityForm, setEntityModalOpen: state.setEntityModalOpen,
    setLastSyncReport: state.setLastSyncReport, setLedgerDraftById: state.setLedgerDraftById, setLedgerEntityModalTransactionId: state.setLedgerEntityModalTransactionId, setLedgerForm: state.setLedgerForm,
    setNotificationForm: state.setNotificationForm, setPayBillDraftById: state.setPayBillDraftById, setRecurringDraftById: state.setRecurringDraftById, setRecurringModalOpen: state.setRecurringModalOpen,
    setSyncHelpError: state.setSyncHelpError, setSyncHelpOpen: state.setSyncHelpOpen, setSyncHelpToken: state.setSyncHelpToken, setSyncingConnectionId: state.setSyncingConnectionId, setTab: state.setTab,
    setTransactionModalMode: state.setTransactionModalMode, setTransactionModalOpen: state.setTransactionModalOpen, setTransactionModalVariant: state.setTransactionModalVariant,
    setViewingTransactionId: state.setViewingTransactionId, syncBankConnection: session.syncBankConnection, syncProvider: session.syncProvider, transactions: session.transactions,
    updateContact: session.updateContact, updateDebtor: session.updateDebtor, updateEntity: session.updateEntity, updateEntityEndexGuide: session.updateEntityEndexGuide, updateRecurring: session.updateRecurring, updateTransaction: session.updateTransaction,
  });
  const closeEntityEndexGuideModal = React.useCallback(() => {
    state.setEditingEntityEndexGuideId(null);
    state.setEntityEndexGuideModalOpen(false);
  }, [state.setEditingEntityEndexGuideId, state.setEntityEndexGuideModalOpen]);
  const { saveLedgerEntityRule } = useAccumul8LedgerEntityRuleActions({
    accumul8ActionUrl: session.accumul8ActionUrl, closeLedgerEntityModal: pageActions.closeLedgerEntityModal, entities: session.entities, entityAliases: session.entityAliases, entityEndexGuides: session.entityEndexGuides,
    ledgerEntityModalTransactionId: state.ledgerEntityModalTransactionId, load: session.load, onToast, recurringPayments: session.recurringPayments, setLedgerEntityModalSaving: state.setLedgerEntityModalSaving, transactions: session.transactions,
  });
  const pageDerivedState = useAccumul8PageDerivedState({
    activeDebtorRowId: state.activeDebtorRowId, activeEntityRowId: state.activeEntityRowId, activeLedgerRowId: state.activeLedgerRowId, activePayBillRowId: state.activePayBillRowId, activeRecurringRowId: state.activeRecurringRowId,
    budgetRows: session.budgetRows, debtorDraftById: state.debtorDraftById, entityDraftById: state.entityDraftById, entityEndexGuides: session.entityEndexGuides, ledgerDraftById: state.ledgerDraftById,
    payBillDraftById: state.payBillDraftById, recurringDraftById: state.recurringDraftById, setActiveDebtorRowId: state.setActiveDebtorRowId, setActiveEntityRowId: state.setActiveEntityRowId,
    setActiveLedgerRowId: state.setActiveLedgerRowId, setActivePayBillRowId: state.setActivePayBillRowId, setActiveRecurringRowId: state.setActiveRecurringRowId, setSummaryWindow: state.setSummaryWindow, summaryWindowOptions: SUMMARY_WINDOW_OPTIONS,
  });
  const entityListData = useAccumul8EntityListData({ entitiesWithResolvedAliases: resolvedEntityData.entitiesWithResolvedAliases, listSearchQueryByTab: state.listSearchQueryByTab });
  const entityDerivedData = useAccumul8EntityDerivedData({
    budgetMonth: state.budgetMonth, budgetRowsSorted: pageDerivedState.budgetRowsSorted, editingEntityEndexGuideId: state.editingEntityEndexGuideId, entities: session.entities,
    entitiesSorted: entityListData.entitiesSorted, entitiesWithResolvedAliases: resolvedEntityData.entitiesWithResolvedAliases, entityEndexGuides: session.entityEndexGuides, entityEndexQuery: state.entityEndexQuery,
    entityHistoryEntityId: state.entityHistoryEntityId, filteredRecurringPayments: debtorPayBillData.filteredRecurringPayments, filteredTransactions: scopeData.filteredTransactions,
    transactions: session.transactions, visibleAccounts: scopeData.visibleAccounts,
  });
  const entityTables = useAccumul8EntityTables({
    balanceLedgerTableRef: state.balanceLedgerTableRef, debtorRunningBalanceByTxId: debtorPayBillData.debtorRunningBalanceByTxId, entitiesTableRef: state.entitiesTableRef, entityRows: entityListData.entityRows,
    entityTransactionSummaryById: entityDerivedData.entityTransactionSummaryById, selectedDebtorEntries: debtorPayBillData.selectedDebtorEntries,
  });
  useAccumul8PageEffects({
    activeRows: pageDerivedState.activeInlineRows, flashSaveButton: pageUiHelpers.flashSaveButton, flashSaveButtonTimeoutRef: state.flashSaveButtonTimeoutRef,
    inlineRowRefs: state.inlineRowRefs, setSettingsMenuOpen: state.setSettingsMenuOpen, setSettingsMenuPosition: state.setSettingsMenuPosition, settingsButtonRef: state.settingsButtonRef,
    settingsMenuOpen: state.settingsMenuOpen, settingsMenuRef: state.settingsMenuRef,
  });

  return {
    composedConstants: {
      ACCUMUL8_OWNER_STORAGE_KEY: session.ACCUMUL8_OWNER_STORAGE_KEY, DEFAULT_ENTITY_ALIAS_DRAFT, LEDGER_FILTER_PRESET_OPTIONS: state.LEDGER_FILTER_PRESET_OPTIONS,
      formatAccountBackfillNote, formatAccountMappingLabel, formatAccountOptionLabel, formatCurrencyAmount, formatSummaryWindowLabel,
      formatSyncStatusLabel, formatSyncStatusMessage, formatSyncSummaryAccountLabel, formatSyncSummaryBackfillNote, getActiveFilterClass, isTellerRateLimited, normalizeEntityKind,
    },
    closeEntityEndexGuideModal,
    debtorPayBillData,
    entityDerivedData,
    entityListData,
    entityTables,
    ledgerData,
    ledgerTableData,
    messageBoardActions,
    pageActions,
    pageDerivedState,
    pageUiHelpers,
    resolvedEntityData,
    saveLedgerEntityRule,
    scopeData,
    secondaryTables,
    todayDate,
  };
}

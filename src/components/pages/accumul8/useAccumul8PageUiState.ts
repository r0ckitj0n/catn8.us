import React from 'react';

import { isLaunchableHttpUrl } from './accumul8PageEntityUtils';

export function useAccumul8PageUiState(options: any) {
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
  const [selectedDebtorId, setSelectedDebtorId] = React.useState('');
  const [selectedBankingOrganizationId, setSelectedBankingOrganizationId] = React.useState('');
  const [selectedBankAccountId, setSelectedBankAccountId] = React.useState('');
  const [bankingOrganizationManagerOpen, setBankingOrganizationManagerOpen] = React.useState(false);
  const [accountManagerOpen, setAccountManagerOpen] = React.useState(false);
  const [syncHelpOpen, setSyncHelpOpen] = React.useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = React.useState(false);
  const [settingsMenuPosition, setSettingsMenuPosition] = React.useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 240 });
  const [summaryWindow, setSummaryWindow] = React.useState(options.initialSummaryWindow);
  const [syncHelpToken, setSyncHelpToken] = React.useState('');
  const [syncHelpError, setSyncHelpError] = React.useState('');
  const [entityEndexQuery, setEntityEndexQuery] = React.useState('');
  const [entityEndexFindingAll, setEntityEndexFindingAll] = React.useState(false);
  const [entityEndexLogOpen, setEntityEndexLogOpen] = React.useState(false);
  const [entityEndexGuideModalOpen, setEntityEndexGuideModalOpen] = React.useState(false);
  const [editingEntityEndexGuideId, setEditingEntityEndexGuideId] = React.useState<number | null>(null);
  const [messageBoardOpen, setMessageBoardOpen] = React.useState(false);
  const [messageBoardLoading, setMessageBoardLoading] = React.useState(false);
  const [messageBoardMessages, setMessageBoardMessages] = React.useState(options.initialMessageBoardMessages);
  const [messageBoardUnacknowledgedCount, setMessageBoardUnacknowledgedCount] = React.useState(0);
  const [runningAIcountantHousekeeping, setRunningAIcountantHousekeeping] = React.useState(false);
  const [balancingBooks, setBalancingBooks] = React.useState(false);
  const [runningAIcountantWatchlist, setRunningAIcountantWatchlist] = React.useState(false);
  const [listSearchQueryByTab, setListSearchQueryByTab] = React.useState(options.initialListSearchQueryByTab);
  const [ledgerFilterPreset, setLedgerFilterPreset] = React.useState(options.initialLedgerFilterPreset);
  const [flashingSaveButtonKey, setFlashingSaveButtonKey] = React.useState('');
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

  const isHeaderLogoSpinning = options.busy
    || options.syncingConnectionId !== null
    || entityEndexFindingAll
    || runningAIcountantHousekeeping
    || balancingBooks
    || runningAIcountantWatchlist;

  const launchableBankingOrganizations = React.useMemo(() => {
    const filtered = options.bankingOrganizations.filter((organization: any) => isLaunchableHttpUrl(organization.login_url));
    if (!selectedBankingOrganizationId) {
      return filtered;
    }
    return [...filtered].sort((a, b) => {
      const aSelected = String(a.id) === selectedBankingOrganizationId ? 1 : 0;
      const bSelected = String(b.id) === selectedBankingOrganizationId ? 1 : 0;
      return bSelected - aSelected || a.banking_organization_name.localeCompare(b.banking_organization_name) || a.id - b.id;
    });
  }, [options.bankingOrganizations, selectedBankingOrganizationId]);

  const openBankingOrganizationPopup = React.useCallback((loginUrl: string, organizationName: string) => {
    if (typeof window === 'undefined') return;
    const targetUrl = String(loginUrl || '').trim();
    if (!isLaunchableHttpUrl(targetUrl)) {
      options.onToast?.({ tone: 'warning', message: `No valid login URL configured for ${organizationName}.` });
      return;
    }
    const screenWidth = Math.max(window.screen.availWidth || window.innerWidth || 1440, 1024);
    const screenHeight = Math.max(window.screen.availHeight || window.innerHeight || 900, 720);
    const popupWidth = Math.max(Math.floor(screenWidth / 2), 720);
    const popupHeight = Math.max(screenHeight - 80, 640);
    const popupLeft = Math.max((window.screenX || 0) + screenWidth - popupWidth, 0);
    const popupName = `accumul8-bank-${organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'login'}`;
    const popupWindow = window.open(targetUrl, popupName, [`width=${popupWidth}`, `height=${popupHeight}`, `left=${popupLeft}`, `top=${Math.max(window.screenY || 0, 0)}`, 'popup=yes', 'noopener=yes', 'noreferrer=yes', 'menubar=no', 'toolbar=no', 'location=no', 'status=no', 'personalbar=no', 'resizable=yes', 'scrollbars=yes'].join(','));
    if (!popupWindow) {
      options.onToast?.({ tone: 'warning', message: `Popup blocked while opening ${organizationName}. Allow popups for catn8.us and try again.` });
      return;
    }
    popupWindow.focus();
  }, [options.onToast]);

  const scopedActionUrl = React.useCallback((action: string) => {
    const params = new URLSearchParams({ action });
    const ownerUserId = Number(options.selectedOwnerUserId || options.activeOwnerUserId || 0);
    if (ownerUserId > 0) params.set('owner_user_id', String(ownerUserId));
    return `/api/accumul8.php?${params.toString()}`;
  }, [options.activeOwnerUserId, options.selectedOwnerUserId]);

  React.useEffect(() => {
    if (options.activeOwnerUserId <= 0) return;
    options.setSelectedOwnerUserId((prev: number) => (prev === options.activeOwnerUserId ? prev : options.activeOwnerUserId));
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(options.ownerStorageKey, String(options.activeOwnerUserId));
    }
  }, [options.activeOwnerUserId, options.ownerStorageKey, options.setSelectedOwnerUserId]);

  return {
    accountManagerOpen,
    balanceLedgerTableRef,
    balancingBooks,
    bankingOrganizationManagerOpen,
    contactModalOpen,
    debtorsTableRef,
    debtorModalOpen,
    entityModalOpen,
    editingEntityEndexGuideId,
    entitiesTableRef,
    entityEndexFindingAll,
    entityEndexGuideModalOpen,
    entityEndexLogOpen,
    entityEndexQuery,
    entityHistoryEntityId,
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
    setEntityModalOpen,
    setEditingEntityEndexGuideId,
    setEntityEndexFindingAll,
    setEntityEndexGuideModalOpen,
    setEntityEndexLogOpen,
    setEntityEndexQuery,
    setEntityHistoryEntityId,
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
  };
}

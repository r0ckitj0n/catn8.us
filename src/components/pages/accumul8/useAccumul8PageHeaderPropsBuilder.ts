import React from 'react';

import { Accumul8PageHeader } from './Accumul8PageHeader';

export function useAccumul8PageHeaderPropsBuilder(options: any): React.ComponentProps<typeof Accumul8PageHeader> {
  return React.useMemo(() => ({
    accessibleAccountOwners: options.accessibleAccountOwners,
    activeOwnerUserId: options.activeOwnerUserId,
    bankingOrganizations: options.bankingOrganizations,
    busy: options.busy,
    entitiesSorted: options.entitiesSorted,
    formatAccountOptionLabel: options.formatAccountOptionLabel,
    formatCurrencyAmount: options.formatCurrencyAmount,
    formatSummaryWindowLabel: options.formatSummaryWindowLabel,
    getActiveFilterClass: options.getActiveFilterClass,
    handleProjectedBalanceCardClick: options.handleProjectedBalanceCardClick,
    headerSummary: options.headerSummary,
    isHeaderLogoSpinning: options.isHeaderLogoSpinning,
    launchableBankingOrganizations: options.launchableBankingOrganizations,
    messageBoardUnacknowledgedCount: options.messageBoardUnacknowledgedCount,
    normalizeEntityKind: options.normalizeEntityKind,
    onOpenAccountManager: () => options.setAccountManagerOpen(true),
    onOpenBankingOrganizationManager: () => options.setBankingOrganizationManagerOpen(true),
    onOpenMessageBoard: () => options.setMessageBoardOpen(true),
    onOpenPopup: options.openBankingOrganizationPopup,
    onSelectBankAccount: options.setSelectedBankAccountId,
    onSelectBankingOrganization: options.setSelectedBankingOrganizationId,
    onSelectOwner: (next) => {
      options.setSelectedOwnerUserId(next);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(options.ACCUMUL8_OWNER_STORAGE_KEY, String(next));
      }
    },
    onSelectTab: options.setTab,
    projectedBalanceForWindow: options.projectedBalanceForWindow,
    selectedBankAccountId: options.selectedBankAccountId,
    selectedBankingOrganizationId: options.selectedBankingOrganizationId,
    settingsButtonRef: options.settingsButtonRef,
    settingsMenuOpen: options.settingsMenuOpen,
    settingsMenuPosition: options.settingsMenuPosition,
    settingsMenuRef: options.settingsMenuRef,
    setSettingsMenuOpen: options.setSettingsMenuOpen,
    summaryWindow: options.summaryWindow,
    tab: options.tab,
    visibleAccounts: options.visibleAccounts,
  }), [options]);
}

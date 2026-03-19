import React from 'react';

import { Accumul8Account, Accumul8Transaction } from '../../../types/accumul8';
import { getAccumul8AccountDisplayName } from '../../../utils/accumul8Accounts';

interface UseAccumul8ScopeDataOptions {
  accounts: Accumul8Account[];
  accessibleAccountOwners: Array<{ owner_user_id: number; username?: string | null }>;
  activeOwnerUserId: number;
  selectedBankAccountId: string;
  selectedBankingOrganizationId: string;
  selectedOwnerUserId: number;
  setSelectedBankAccountId: React.Dispatch<React.SetStateAction<string>>;
  transactions: Accumul8Transaction[];
}

export function useAccumul8ScopeData({
  accounts,
  accessibleAccountOwners,
  activeOwnerUserId,
  selectedBankAccountId,
  selectedBankingOrganizationId,
  selectedOwnerUserId,
  setSelectedBankAccountId,
  transactions,
}: UseAccumul8ScopeDataOptions) {
  const selectedOwnerProfile = React.useMemo(() => (
    accessibleAccountOwners.find((owner) => owner.owner_user_id === (selectedOwnerUserId || activeOwnerUserId || 0)) || null
  ), [accessibleAccountOwners, activeOwnerUserId, selectedOwnerUserId]);

  const visibleAccounts = React.useMemo(() => {
    const bankingOrganizationId = Number(selectedBankingOrganizationId || 0);
    return bankingOrganizationId <= 0 ? accounts : accounts.filter((account) => Number(account.banking_organization_id || 0) === bankingOrganizationId);
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
  ) => {
    const resolved = accountId ? accountDisplayNameById[accountId] : '';
    if (resolved) return resolved;
    const fallback = String(fallbackName || '').trim() || String(bankingOrganizationName || '').trim();
    return fallback || emptyFallback;
  }, [accountDisplayNameById]);

  React.useEffect(() => {
    const bankAccountId = Number(selectedBankAccountId || 0);
    if (bankAccountId > 0 && !visibleAccounts.some((account) => account.id === bankAccountId)) {
      setSelectedBankAccountId('');
    }
  }, [selectedBankAccountId, setSelectedBankAccountId, visibleAccounts]);

  const scopedAccounts = React.useMemo(() => {
    const bankAccountId = Number(selectedBankAccountId || 0);
    return bankAccountId > 0 ? visibleAccounts.filter((account) => account.id === bankAccountId) : visibleAccounts;
  }, [selectedBankAccountId, visibleAccounts]);

  const filteredTransactions = React.useMemo(() => {
    const bankingOrganizationId = Number(selectedBankingOrganizationId || 0);
    const bankAccountId = Number(selectedBankAccountId || 0);
    return transactions.filter((tx) => {
      if (bankingOrganizationId > 0 && Number(tx.banking_organization_id || 0) !== bankingOrganizationId) return false;
      if (bankAccountId > 0 && Number(tx.account_id || 0) !== bankAccountId) return false;
      return true;
    });
  }, [selectedBankAccountId, selectedBankingOrganizationId, transactions]);

  return { filteredTransactions, getAccountDisplayName, scopedAccounts, selectedOwnerProfile, visibleAccounts };
}

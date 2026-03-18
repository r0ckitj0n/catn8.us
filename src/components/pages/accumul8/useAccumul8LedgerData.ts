import React from 'react';

import { Accumul8Account, Accumul8Transaction } from '../../../types/accumul8';
import { addUtcDays, getLedgerEffectiveDate, isDateInRange, matchesSearchQuery, normalizeSearchQuery, roundCurrency } from './accumul8PageDateSearchUtils';

interface UseAccumul8LedgerDataOptions {
  customLedgerEndDate: string;
  customLedgerStartDate: string;
  filteredTransactions: Accumul8Transaction[];
  getAccountDisplayName: (accountId: number | null | undefined, accountName?: string | null, bankingOrganizationName?: string | null, emptyLabel?: string) => string;
  ledgerDateFilter: 'all_dates' | '7_days' | '30_days' | '60_days' | '90_days' | 'eoy' | 'custom';
  ledgerFilterPreset: string;
  listSearchQueryByTab: Record<'ledger' | 'debtors' | 'pay_bills' | 'contacts' | 'recurring', string>;
  scopedAccounts: Accumul8Account[];
  todayDate: string;
}

export function useAccumul8LedgerData({
  customLedgerEndDate,
  customLedgerStartDate,
  filteredTransactions,
  getAccountDisplayName,
  ledgerDateFilter,
  ledgerFilterPreset,
  listSearchQueryByTab,
  scopedAccounts,
  todayDate,
}: UseAccumul8LedgerDataOptions) {
  const ledgerDateRange = React.useMemo(() => {
    if (ledgerDateFilter === 'all_dates') return { startDate: '', endDate: '' };
    if (ledgerDateFilter === 'custom') return { startDate: customLedgerStartDate || '', endDate: customLedgerEndDate || '' };
    if (ledgerDateFilter === '7_days') return { startDate: '', endDate: addUtcDays(todayDate, 7) };
    if (ledgerDateFilter === '30_days') return { startDate: '', endDate: addUtcDays(todayDate, 30) };
    if (ledgerDateFilter === '60_days') return { startDate: '', endDate: addUtcDays(todayDate, 60) };
    if (ledgerDateFilter === '90_days') return { startDate: '', endDate: addUtcDays(todayDate, 90) };
    return { startDate: '', endDate: `${todayDate.slice(0, 4)}-12-31` };
  }, [customLedgerEndDate, customLedgerStartDate, ledgerDateFilter, todayDate]);

  const ledgerSearchQuery = React.useMemo(() => normalizeSearchQuery(listSearchQueryByTab.ledger), [listSearchQueryByTab.ledger]);

  const ledgerRows = React.useMemo(() => filteredTransactions.filter((tx) => {
    const effectiveDate = getLedgerEffectiveDate(tx);
    const isPaid = Number(tx.is_paid || 0) === 1;
    const isReconciled = Number(tx.is_reconciled || 0) === 1;
    const isPendingBank = Number(tx.pending_status || 0) === 1;
    const isUpcomingRecurring = String(tx.source_kind || '') === 'recurring' && effectiveDate >= todayDate && !isPaid;
    const isLate = !isPaid && Boolean(effectiveDate) && effectiveDate < todayDate;
    const isUpcomingUnpaid = !isPaid && Boolean(effectiveDate) && effectiveDate >= todayDate;
    if (!isDateInRange(effectiveDate, ledgerDateRange)) return false;
    switch (ledgerFilterPreset) {
      case 'all': return !effectiveDate || effectiveDate <= todayDate;
      case 'planning': return true;
      case 'hide_upcoming_recurring': return !isUpcomingRecurring;
      case 'hide_reconciled': return !isReconciled;
      case 'hide_paid': return !isPaid;
      case 'hide_pending_bank': return !isPendingBank;
      case 'show_late_payments': return isLate;
      case 'show_paid_not_reconciled': return isPaid && !isReconciled;
      case 'show_reconciled_not_paid': return isReconciled && !isPaid;
      case 'show_unpaid_only': return !isPaid;
      case 'show_upcoming_unpaid': return isUpcomingUnpaid;
      default: return true;
    }
  }).filter((tx) => matchesSearchQuery(ledgerSearchQuery, [
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
  ])), [filteredTransactions, getAccountDisplayName, ledgerDateRange, ledgerFilterPreset, ledgerSearchQuery, todayDate]);

  const ledgerDisplayBalanceById = React.useMemo(() => {
    if (ledgerFilterPreset === 'planning') {
      return new Map<number, number>();
    }
    const sortedTransactions = filteredTransactions.slice().sort((a, b) => {
      const accountDelta = Number(a.account_id || 0) - Number(b.account_id || 0);
      if (accountDelta !== 0) return accountDelta;
      const dateDelta = String(b.transaction_date || '').localeCompare(String(a.transaction_date || ''));
      return dateDelta !== 0 ? dateDelta : Number(b.id || 0) - Number(a.id || 0);
    });
    const runningByAccount = new Map<number, number>(scopedAccounts.map((account) => [Number(account.id || 0), roundCurrency(Number(account.current_balance || 0))]));
    const balancesById = new Map<number, number>();
    sortedTransactions.forEach((tx) => {
      const txId = Number(tx.id || 0);
      if (txId <= 0) return;
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

  const currentVisibleBalance = React.useMemo(() => roundCurrency(scopedAccounts.reduce((sum, account) => sum + Number(account.current_balance || 0), 0)), [scopedAccounts]);

  return { currentVisibleBalance, ledgerDisplayBalanceById, ledgerRows, ledgerSearchQuery };
}

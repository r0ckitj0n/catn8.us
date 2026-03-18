import React from 'react';

import { addUtcDays, formatAccountOptionLabel, matchesSearchQuery, normalizeSearchQuery, roundCurrency } from './accumul8PageDateSearchUtils';
import { Accumul8DebtorGroupRow, normalizeDebtorGroupKey } from './accumul8PageEntityUtils';
import { isProjectedPlanningTransaction } from './accumul8PageFormUtils';
import { Accumul8Account, Accumul8Debtor, Accumul8RecurringPayment, Accumul8Transaction } from '../../../types/accumul8';

interface UseAccumul8DebtorPayBillDataOptions {
  accounts: Accumul8Account[];
  currentVisibleBalance: number;
  customPayBillsEndDate: string;
  customPayBillsStartDate: string;
  debtors: Accumul8Debtor[];
  debtorLedger: Accumul8Transaction[];
  filteredTransactions: Accumul8Transaction[];
  getAccountDisplayName: (accountId: number | null | undefined, fallbackName?: string | null, bankingOrganizationName?: string | null, emptyFallback?: string) => string;
  listSearchQueryByTab: Record<string, string>;
  payBillsDateFilter: 'all_dates' | '7_days' | '30_days' | '60_days' | '90_days' | 'eoy' | 'custom';
  recurringPayments: Accumul8RecurringPayment[];
  selectedBankAccountId: string;
  selectedBankingOrganizationId: string;
  selectedDebtorId: string;
  summaryWindow: number | 'current';
  todayDate: string;
}

export function useAccumul8DebtorPayBillData({
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
}: UseAccumul8DebtorPayBillDataOptions) {
  const payBillsAccountOptions = React.useMemo(() => (
    accounts.filter((account) => Number(account.is_active || 0) === 1).slice().sort((a, b) => formatAccountOptionLabel(a).localeCompare(formatAccountOptionLabel(b)))
  ), [accounts]);
  const filteredRecurringPayments = React.useMemo(() => {
    const bankingOrganizationId = Number(selectedBankingOrganizationId || 0);
    const bankAccountId = Number(selectedBankAccountId || 0);
    return recurringPayments.filter((item) => {
      if (bankingOrganizationId > 0 && Number(item.banking_organization_id || 0) !== bankingOrganizationId) return false;
      if (bankAccountId > 0 && Number(item.account_id || 0) !== bankAccountId) return false;
      return true;
    });
  }, [recurringPayments, selectedBankAccountId, selectedBankingOrganizationId]);
  const recurringSearchQuery = React.useMemo(() => normalizeSearchQuery(listSearchQueryByTab.recurring), [listSearchQueryByTab.recurring]);
  const recurringRows = React.useMemo(() => (
    filteredRecurringPayments.filter((item) => matchesSearchQuery(recurringSearchQuery, [
      item.title, item.notes, item.next_due_date, item.frequency, item.payment_method, item.direction, item.entity_name,
      getAccountDisplayName(item.account_id, item.account_name), item.amount,
      Number(item.is_budget_planner || 0) === 1 ? 'shown' : 'hidden',
      Number(item.is_active || 0) === 1 ? 'active' : 'paused',
    ]))
  ), [filteredRecurringPayments, getAccountDisplayName, recurringSearchQuery]);
  const payBillRowsBase = React.useMemo(() => (
    filteredTransactions.filter((tx) => {
      if (Number(tx.amount || 0) >= 0 || Number(tx.is_paid || 0) !== 0) return false;
      const sourceKind = String(tx.source_kind || 'manual');
      const entryType = String(tx.entry_type || 'manual');
      const matchesSource = sourceKind === 'recurring' || sourceKind === 'manual' || sourceKind === 'plaid' || sourceKind === 'teller';
      const matchesEntryType = entryType === 'bill' || entryType === 'auto' || entryType === 'manual';
      if (!matchesSource && !matchesEntryType) return false;
      return String(tx.due_date || tx.transaction_date || '').trim() !== '';
    }).slice().sort((a, b) => {
      const aDate = String(a.due_date || a.transaction_date || '');
      const bDate = String(b.due_date || b.transaction_date || '');
      const aPastDue = aDate < todayDate;
      const bPastDue = bDate < todayDate;
      if (aPastDue !== bPastDue) return aPastDue ? -1 : 1;
      return aDate.localeCompare(bDate) || a.id - b.id;
    })
  ), [filteredTransactions, todayDate]);
  const payBillsDateRange = React.useMemo(() => {
    const startDate = '';
    if (payBillsDateFilter === 'all_dates') return { startDate, endDate: '' };
    if (payBillsDateFilter === 'custom') return { startDate: customPayBillsStartDate || '', endDate: customPayBillsEndDate || '' };
    if (payBillsDateFilter === '7_days') return { startDate, endDate: addUtcDays(todayDate, 7) };
    if (payBillsDateFilter === '30_days') return { startDate, endDate: addUtcDays(todayDate, 30) };
    if (payBillsDateFilter === '60_days') return { startDate, endDate: addUtcDays(todayDate, 60) };
    if (payBillsDateFilter === '90_days') return { startDate, endDate: addUtcDays(todayDate, 90) };
    return { startDate, endDate: `${todayDate.slice(0, 4)}-12-31` };
  }, [customPayBillsEndDate, customPayBillsStartDate, payBillsDateFilter, todayDate]);
  const filteredPayBillRows = React.useMemo(() => (
    payBillRowsBase.filter((tx) => {
      const effectiveDate = String(tx.due_date || tx.transaction_date || '');
      if (!effectiveDate) return false;
      if (effectiveDate < todayDate) return true;
      if (payBillsDateRange.startDate && effectiveDate < payBillsDateRange.startDate) return false;
      if (payBillsDateRange.endDate && effectiveDate > payBillsDateRange.endDate) return false;
      return true;
    })
  ), [payBillRowsBase, payBillsDateRange, todayDate]);
  const payBillsSearchQuery = React.useMemo(() => normalizeSearchQuery(listSearchQueryByTab.pay_bills), [listSearchQueryByTab.pay_bills]);
  const payBillsRows = React.useMemo(() => (
    filteredPayBillRows.filter((tx) => matchesSearchQuery(payBillsSearchQuery, [
      tx.due_date, tx.transaction_date, tx.paid_date, tx.description, tx.memo,
      getAccountDisplayName(tx.account_id, tx.account_name), tx.contact_name, tx.entity_name, tx.amount,
      Number(tx.is_paid || 0) === 1 ? 'paid' : ((tx.due_date || tx.transaction_date) < todayDate ? 'past due' : 'upcoming'),
    ]))
  ), [filteredPayBillRows, getAccountDisplayName, payBillsSearchQuery, todayDate]);
  const summaryWindowEndDate = React.useMemo(() => (summaryWindow === 'current' ? todayDate : addUtcDays(todayDate, summaryWindow)), [summaryWindow, todayDate]);
  const projectedBalanceForWindow = React.useMemo(() => {
    const projectedDelta = filteredTransactions.reduce((sum, tx) => {
      const effectiveDate = String(tx.due_date || tx.transaction_date || '');
      if (!effectiveDate || effectiveDate < todayDate || effectiveDate > summaryWindowEndDate) return sum;
      if (Number(tx.is_paid || 0) === 1 || !isProjectedPlanningTransaction(tx, todayDate)) return sum;
      return sum + Number(tx.amount || 0);
    }, 0);
    return roundCurrency(currentVisibleBalance + projectedDelta);
  }, [currentVisibleBalance, filteredTransactions, summaryWindowEndDate, todayDate]);
  const summaryWindowTotals = React.useMemo(() => {
    let unpaidBills = 0;
    let windfalls = 0;
    filteredTransactions.forEach((tx) => {
      const effectiveDate = String(tx.due_date || tx.transaction_date || '');
      if (!effectiveDate || effectiveDate < todayDate || effectiveDate > summaryWindowEndDate) return;
      if (!isProjectedPlanningTransaction(tx, todayDate)) return;
      const amount = Number(tx.amount || 0);
      const isPaid = Number(tx.is_paid || 0) === 1;
      const isNonRecurringDeposit = tx.entry_type === 'deposit' && String(tx.source_kind || '') !== 'recurring';
      if (!isPaid && amount < 0) unpaidBills += Math.abs(amount);
      if (isNonRecurringDeposit && amount > 0) windfalls += amount;
    });
    return { unpaidBills: roundCurrency(unpaidBills), windfalls: roundCurrency(windfalls) };
  }, [filteredTransactions, summaryWindowEndDate, todayDate]);
  const debtorsSearchQuery = React.useMemo(() => normalizeSearchQuery(listSearchQueryByTab.debtors), [listSearchQueryByTab.debtors]);
  const groupedDebtors = React.useMemo<Accumul8DebtorGroupRow[]>(() => {
    const grouped = new Map<string, Accumul8DebtorGroupRow>();
    debtors.forEach((debtor) => {
      const normalizedName = normalizeDebtorGroupKey(debtor.debtor_name);
      const groupKey = normalizedName || `debtor:${debtor.id}`;
      const existing = grouped.get(groupKey);
      if (!existing) {
        grouped.set(groupKey, { ...debtor, group_key: groupKey, member_ids: [debtor.id], has_duplicate_members: false });
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
    return Array.from(grouped.values()).sort((a, b) => a.debtor_name.localeCompare(b.debtor_name, undefined, { sensitivity: 'base' }) || a.id - b.id);
  }, [debtors]);
  const debtorGroupKeyByDebtorId = React.useMemo(() => {
    const next = new Map<number, string>();
    groupedDebtors.forEach((debtor) => debtor.member_ids.forEach((memberId) => next.set(memberId, debtor.group_key)));
    return next;
  }, [groupedDebtors]);
  const debtorRunningBalanceByTxId = React.useMemo(() => {
    const runningByGroupKey = new Map<string, number>();
    const next = new Map<number, number>();
    [...debtorLedger].sort((a, b) => String(a.transaction_date || '').localeCompare(String(b.transaction_date || '')) || a.id - b.id).forEach((tx) => {
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
      debtor.debtor_name, debtor.notes, debtor.last_activity_date, debtor.total_loaned, debtor.total_repaid, debtor.outstanding_balance,
      Number(debtor.is_active || 0) === 1 ? 'active' : 'paused',
    ]))
  ), [debtorsSearchQuery, groupedDebtors]);
  const selectedDebtorEntries = React.useMemo(() => {
    if (!selectedDebtorId) return debtorLedger;
    const selectedDebtor = groupedDebtors.find((debtor) => debtor.group_key === selectedDebtorId) || null;
    if (!selectedDebtor) return debtorLedger;
    const memberIds = new Set(selectedDebtor.member_ids);
    return debtorLedger.filter((tx) => memberIds.has(Number(tx.debtor_id || 0)));
  }, [debtorLedger, groupedDebtors, selectedDebtorId]);
  return { debtorRows, debtorRunningBalanceByTxId, filteredRecurringPayments, groupedDebtors, payBillsAccountOptions, payBillsRows, projectedBalanceForWindow, recurringRows, selectedDebtorEntries, summaryWindowEndDate, summaryWindowTotals };
}

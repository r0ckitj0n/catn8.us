import React from 'react';

import { EntityTransactionSummary, normalizeEntityAliasKey, isIouAccount } from './accumul8PageEntityUtils';
import { Accumul8Account, Accumul8Entity, Accumul8EntityEndexGuide, Accumul8RecurringPayment, Accumul8Transaction } from '../../../types/accumul8';

interface UseAccumul8EntityDerivedDataOptions {
  budgetMonth: string;
  budgetRowsSorted: Array<{ id: number; match_pattern: string; monthly_budget: number; is_active: number }>;
  editingEntityEndexGuideId: number | null;
  entities: Accumul8Entity[];
  entitiesSorted: Accumul8Entity[];
  entitiesWithResolvedAliases: Accumul8Entity[];
  entityEndexGuides: Accumul8EntityEndexGuide[];
  entityEndexQuery: string;
  entityHistoryEntityId: number;
  filteredRecurringPayments: Accumul8RecurringPayment[];
  filteredTransactions: Accumul8Transaction[];
  transactions: Accumul8Transaction[];
  visibleAccounts: Accumul8Account[];
}

export function useAccumul8EntityDerivedData({
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
}: UseAccumul8EntityDerivedDataOptions) {
  const linkedAliasEntitiesByParentId = React.useMemo(() => {
    const next: Record<number, Accumul8Entity[]> = {};
    entitiesWithResolvedAliases.forEach((parentEntity) => {
      parentEntity.aliases.forEach((alias) => {
        const aliasKey = normalizeEntityAliasKey(alias.alias_name);
        if (!aliasKey) return;
        entitiesWithResolvedAliases.forEach((candidate) => {
          if (candidate.id === parentEntity.id) return;
          if (normalizeEntityAliasKey(candidate.display_name) !== aliasKey) return;
          if (!next[parentEntity.id]) next[parentEntity.id] = [];
          if (!next[parentEntity.id].some((row) => row.id === candidate.id)) next[parentEntity.id].push(candidate);
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
      if (!importedBudgetParent && aliases.length === 0 && linkedChildren.length === 0) return false;
      if (query === '') return true;
      return [entity.display_name, entity.notes, ...aliases.map((alias) => alias.alias_name), ...linkedChildren.map((child) => child.display_name)].join(' ').toLowerCase().includes(query);
    });
  }, [entitiesSorted, entityEndexQuery, linkedAliasEntitiesByParentId]);
  const entityEndexGuideById = React.useMemo(() => entityEndexGuides.reduce<Record<number, Accumul8EntityEndexGuide>>((acc, guide) => {
    if (guide.id > 0) acc[guide.id] = guide;
    return acc;
  }, {}), [entityEndexGuides]);
  const selectedEntityEndexGuide = React.useMemo(() => (
    editingEntityEndexGuideId !== null ? (entityEndexGuideById[editingEntityEndexGuideId] || null) : null
  ), [editingEntityEndexGuideId, entityEndexGuideById]);
  const selectedEntityEndexParentEntity = React.useMemo(() => {
    if (!selectedEntityEndexGuide) return null;
    if (selectedEntityEndexGuide.parent_entity_id) return entitiesWithResolvedAliases.find((entity) => entity.id === selectedEntityEndexGuide.parent_entity_id) || null;
    const parentKey = normalizeEntityAliasKey(selectedEntityEndexGuide.parent_name);
    return entitiesWithResolvedAliases.find((entity) => normalizeEntityAliasKey(entity.display_name) === parentKey) || null;
  }, [entitiesWithResolvedAliases, selectedEntityEndexGuide]);
  const entityTransactionsById = React.useMemo(() => {
    const grouped: Record<number, Accumul8Transaction[]> = {};
    transactions.forEach((tx) => {
      const entityId = Number(tx.entity_id || 0);
      if (entityId <= 0) return;
      if (!grouped[entityId]) grouped[entityId] = [];
      grouped[entityId].push(tx);
    });
    return grouped;
  }, [transactions]);
  const entityTransactionSummaryById = React.useMemo(() => {
    const summary: Record<number, EntityTransactionSummary> = {};
    Object.entries(entityTransactionsById).forEach(([entityId, rows]) => {
      const latest = rows[0] || null;
      summary[Number(entityId)] = { count: rows.length, lastAmount: latest ? Number(latest.amount || 0) : null, lastDate: latest?.transaction_date || latest?.due_date || '' };
    });
    return summary;
  }, [entityTransactionsById]);
  const selectedEntityHistory = React.useMemo(() => (
    entityHistoryEntityId ? entities.find((entity) => entity.id === entityHistoryEntityId) || null : null
  ), [entities, entityHistoryEntityId]);
  const selectedEntityTransactions = React.useMemo(() => (
    entityHistoryEntityId ? entityTransactionsById[entityHistoryEntityId] || [] : []
  ), [entityHistoryEntityId, entityTransactionsById]);
  const contactEntities = React.useMemo(() => entitiesSorted.filter((entity) => Number(entity.is_balance_person || 0) === 0), [entitiesSorted]);
  const balanceEntities = React.useMemo(() => entitiesSorted.filter((entity) => Number(entity.is_balance_person || 0) === 1), [entitiesSorted]);
  const iouVisibleAccounts = React.useMemo(() => visibleAccounts.filter((account) => isIouAccount(account)), [visibleAccounts]);
  const ledgerRowsForBudgetMonth = React.useMemo(() => (
    filteredTransactions.filter((tx) => String(tx.transaction_date || '').slice(0, 7) === budgetMonth)
  ), [budgetMonth, filteredTransactions]);
  const budgetActualByRowId = React.useMemo(() => {
    const map: Record<number, number> = {};
    budgetRowsSorted.forEach((row) => {
      const pattern = String(row.match_pattern || '').trim().toLowerCase();
      if (pattern === '') {
        map[row.id] = 0;
        return;
      }
      let total = 0;
      ledgerRowsForBudgetMonth.forEach((tx) => {
        const haystack = `${tx.description || ''} ${tx.memo || ''} ${tx.contact_name || ''} ${tx.debtor_name || ''}`.toLowerCase();
        if (haystack.includes(pattern)) total += Math.abs(Number(tx.amount || 0));
      });
      map[row.id] = Number(total.toFixed(2));
    });
    return map;
  }, [budgetRowsSorted, ledgerRowsForBudgetMonth]);
  const spreadsheetTotals = React.useMemo(() => {
    let budget = 0;
    let actual = 0;
    budgetRowsSorted.forEach((row) => {
      if (!row.is_active) return;
      budget += Number(row.monthly_budget || 0);
      actual += Number(budgetActualByRowId[row.id] || 0);
    });
    return { budget: Number(budget.toFixed(2)), actual: Number(actual.toFixed(2)), remaining: Number((budget - actual).toFixed(2)) };
  }, [budgetActualByRowId, budgetRowsSorted]);
  const budgetPlannerRecurringPayments = React.useMemo(() => (
    filteredRecurringPayments.filter((rp) => Number(rp.is_budget_planner || 0) === 1)
  ), [filteredRecurringPayments]);
  return { balanceEntities, budgetActualByRowId, budgetPlannerRecurringPayments, contactEntities, entityEndexParents, entityTransactionSummaryById, iouVisibleAccounts, linkedAliasEntitiesByParentId, selectedEntityEndexGuide, selectedEntityEndexParentEntity, selectedEntityHistory, selectedEntityTransactions, spreadsheetTotals };
}

import React from 'react';

import { Accumul8Entity, Accumul8EntityAlias } from '../../../types/accumul8';
import { Accumul8HeaderSummary } from './accumul8PageTypes';

export function useAccumul8ResolvedEntityData(options: {
  currentVisibleBalance: number;
  editingEntityId: number | null;
  entities: Accumul8Entity[];
  entityAliases: Accumul8EntityAlias[];
  summaryWindowTotals: { unpaidBills: number; windfalls: number };
}) {
  const aliasRowsByEntityId = React.useMemo(() => {
    const next: Record<number, typeof options.entityAliases> = {};
    options.entityAliases.forEach((alias) => {
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
  }, [options.entityAliases]);

  const entitiesWithResolvedAliases = React.useMemo(() => (
    options.entities.map((entity) => ({
      ...entity,
      aliases: aliasRowsByEntityId[entity.id] || entity.aliases || [],
    }))
  ), [aliasRowsByEntityId, options.entities]);

  const editingEntity = React.useMemo(() => (
    options.editingEntityId !== null
      ? (entitiesWithResolvedAliases.find((entity) => entity.id === options.editingEntityId) || null)
      : null
  ), [entitiesWithResolvedAliases, options.editingEntityId]);

  const headerSummary = React.useMemo<Accumul8HeaderSummary>(() => ({
    currentBalance: options.currentVisibleBalance,
    unpaidBills: options.summaryWindowTotals.unpaidBills,
    windfalls: options.summaryWindowTotals.windfalls,
  }), [options.currentVisibleBalance, options.summaryWindowTotals]);

  return {
    aliasRowsByEntityId,
    editingEntity,
    entitiesWithResolvedAliases,
    headerSummary,
  };
}

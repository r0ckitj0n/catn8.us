import React from 'react';

import { Accumul8Entity } from '../../../types/accumul8';
import { matchesSearchQuery, normalizeSearchQuery } from './accumul8PageDateSearchUtils';
import { formatEntityRoles, normalizeEntityAliasKey } from './accumul8PageEntityUtils';

interface UseAccumul8EntityListDataOptions {
  entitiesWithResolvedAliases: Accumul8Entity[];
  listSearchQueryByTab: Record<'ledger' | 'debtors' | 'pay_bills' | 'contacts' | 'recurring', string>;
}

export function useAccumul8EntityListData({ entitiesWithResolvedAliases, listSearchQueryByTab }: UseAccumul8EntityListDataOptions) {
  const linkedAliasEntityIds = React.useMemo(() => {
    const hiddenIds = new Set<number>();
    const entityIdsByNameKey = new Map<string, number[]>();
    entitiesWithResolvedAliases.forEach((entity) => {
      const nameKey = normalizeEntityAliasKey(entity.display_name);
      if (!nameKey) return;
      const bucket = entityIdsByNameKey.get(nameKey) || [];
      bucket.push(entity.id);
      entityIdsByNameKey.set(nameKey, bucket);
    });
    entitiesWithResolvedAliases.forEach((entity) => {
      entity.aliases.forEach((alias) => {
        const aliasKey = normalizeEntityAliasKey(alias.alias_name);
        if (!aliasKey) return;
        (entityIdsByNameKey.get(aliasKey) || []).forEach((matchedEntityId) => {
          if (matchedEntityId !== entity.id) hiddenIds.add(matchedEntityId);
        });
      });
    });
    return hiddenIds;
  }, [entitiesWithResolvedAliases]);

  const entitiesSorted = React.useMemo(() => [...entitiesWithResolvedAliases].filter((entity) => !linkedAliasEntityIds.has(entity.id)).sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || '')) || (a.id - b.id)), [entitiesWithResolvedAliases, linkedAliasEntityIds]);
  const entityRows = React.useMemo(() => {
    const contactsSearchQuery = normalizeSearchQuery(listSearchQueryByTab.contacts);
    return entitiesSorted.filter((entity) => matchesSearchQuery(contactsSearchQuery, [
      entity.display_name,
      entity.notes,
      entity.phone_number,
      entity.email,
      entity.street_address,
      entity.city,
      entity.state,
      entity.zip,
      entity.contact_type,
      entity.entity_kind,
      entity.aliases.map((alias) => alias.alias_name).join(' '),
      Number(entity.is_active || 0) === 1 ? 'active' : 'paused',
      Number(entity.is_balance_person || 0) === 1 ? 'iou person' : '',
      formatEntityRoles(entity),
    ]));
  }, [entitiesSorted, listSearchQueryByTab.contacts]);

  return { entitiesSorted, entityRows };
}

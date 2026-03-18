import React from 'react';

import { ApiClient } from '../../../core/ApiClient';
import {
  Accumul8EntityEndexGuideUpsertRequest,
  Accumul8IdResponse,
} from '../../../types/accumul8';
import {
  buildEntityGuideRule,
  inferEntityContactTypeForAmount,
  normalizeEntityAliasKey,
  toEntityEndexGuideKey,
  uniqueTextValues,
} from './accumul8PageEntityUtils';
import { findRecurringRuleForTransactionMapping } from './accumul8PageRecurringSyncUtils';
import { UseAccumul8LedgerEntityRuleActionsOptions } from './useAccumul8LedgerEntityRuleActionTypes';

export function useAccumul8LedgerEntityRuleActions({
  accumul8ActionUrl,
  closeLedgerEntityModal,
  entities,
  entityAliases,
  entityEndexGuides,
  ledgerEntityModalTransactionId,
  load,
  onToast,
  recurringPayments,
  setLedgerEntityModalSaving,
  transactions,
}: UseAccumul8LedgerEntityRuleActionsOptions) {
  const saveLedgerEntityRule = React.useCallback(async (payload: { mode: 'existing' | 'new'; entityId: number | null; newEntityName: string }) => {
    const transaction = transactions.find((row) => row.id === ledgerEntityModalTransactionId) || null;
    if (!transaction) {
      return;
    }

    try {
      setLedgerEntityModalSaving(true);
      let targetEntityId = payload.entityId ?? 0;
      let targetEntityName = '';

      if (payload.mode === 'new') {
        const createResponse = await ApiClient.post<Accumul8IdResponse>(accumul8ActionUrl('create_entity'), {
          display_name: payload.newEntityName,
          entity_kind: 'business',
          contact_type: inferEntityContactTypeForAmount(Number(transaction.amount || 0)),
          is_active: 1,
          default_amount: Math.abs(Number(transaction.amount || 0)),
          notes: String(transaction.memo || '').trim(),
        });
        targetEntityId = Number(createResponse?.id || 0);
        targetEntityName = payload.newEntityName;
      } else {
        const selectedEntity = entities.find((entity) => entity.id === Number(payload.entityId || 0)) || null;
        targetEntityId = Number(selectedEntity?.id || 0);
        targetEntityName = String(selectedEntity?.display_name || '');
      }

      if (targetEntityId <= 0) {
        throw new Error('Choose an entity before saving this rule.');
      }

      const description = String(transaction.description || '').trim();
      const aliasKey = normalizeEntityAliasKey(description);
      const conflictingAlias = entityAliases.find((alias) => (
        normalizeEntityAliasKey(alias.alias_name) === aliasKey && Number(alias.entity_id || 0) !== targetEntityId
      ));
      if (conflictingAlias) {
        await ApiClient.post(accumul8ActionUrl('delete_entity_alias'), { id: conflictingAlias.id });
      }

      if (aliasKey && normalizeEntityAliasKey(targetEntityName) !== aliasKey) {
        try {
          await ApiClient.post(accumul8ActionUrl('create_entity_alias'), {
            entity_id: targetEntityId,
            alias_name: description,
            merge_entity_id: null,
            reassign_if_conflict: true,
          });
        } catch (error: any) {
          const message = String(error?.message || '');
          if (!message.toLowerCase().includes('alias matches the entity name after normalization')) {
            throw error;
          }
        }
      }

      const guide = entityEndexGuides.find((item) => (
        Number(item.parent_entity_id || 0) === targetEntityId
          || toEntityEndexGuideKey(item) === normalizeEntityAliasKey(targetEntityName)
      )) || null;
      const guidePayload: Accumul8EntityEndexGuideUpsertRequest = {
        parent_name: targetEntityName,
        parent_entity_id: targetEntityId,
        match_rule: buildEntityGuideRule(description, targetEntityName),
        examples: uniqueTextValues([
          ...(guide?.examples || []),
          description,
          transaction.entity_name || '',
        ], (value) => value.trim().toLowerCase()),
        match_contains: uniqueTextValues([
          ...(guide?.match_contains || []),
          description,
          targetEntityName,
        ], (value) => value.trim().toLowerCase()),
        match_fragments: uniqueTextValues([
          ...(guide?.match_fragments || []),
          description,
          targetEntityName,
        ], normalizeEntityAliasKey),
        is_active: 1,
      };

      if (guide?.id) {
        await ApiClient.post(accumul8ActionUrl('update_entity_endex_guide'), { id: guide.id, ...guidePayload });
      } else {
        await ApiClient.post(accumul8ActionUrl('create_entity_endex_guide'), guidePayload);
      }

      const recurringRule = findRecurringRuleForTransactionMapping(transaction, recurringPayments, targetEntityId);
      if (recurringRule) {
        await ApiClient.post(accumul8ActionUrl('update_recurring'), {
          id: recurringRule.id,
          title: recurringRule.title,
          direction: recurringRule.direction,
          amount: Number(recurringRule.amount || 0),
          frequency: recurringRule.frequency,
          payment_method: recurringRule.payment_method,
          interval_count: Number(recurringRule.interval_count || 1),
          next_due_date: recurringRule.next_due_date,
          paid_date: recurringRule.paid_date || '',
          entity_id: targetEntityId,
          account_id: recurringRule.account_id ?? null,
          is_budget_planner: Number(recurringRule.is_budget_planner ?? 1),
          notes: recurringRule.notes || '',
          recurring_bank_aliases: uniqueTextValues([
            ...(recurringRule.recurring_bank_aliases || []),
            description,
            transaction.entity_name || '',
            targetEntityName,
          ], normalizeEntityAliasKey),
        });
      }

      await ApiClient.post(accumul8ActionUrl('update_transaction'), {
        id: transaction.id,
        transaction_date: transaction.transaction_date,
        due_date: transaction.due_date,
        paid_date: transaction.paid_date,
        entry_type: transaction.entry_type,
        description: transaction.description,
        memo: transaction.memo,
        amount: Number(transaction.amount || 0),
        rta_amount: Number(transaction.rta_amount || 0),
        is_paid: Number(transaction.is_paid || 0),
        is_reconciled: Number(transaction.is_reconciled || 0),
        is_budget_planner: Number(transaction.is_budget_planner || 0),
        entity_id: targetEntityId,
        account_id: transaction.account_id ?? null,
        balance_entity_id: transaction.balance_entity_id ?? null,
      });

      let aliasScanWarning = false;
      try {
        await ApiClient.post(accumul8ActionUrl('scan_entity_aliases'), { entity_id: targetEntityId });
      } catch (_error) {
        aliasScanWarning = true;
      }
      if (recurringRule) {
        try {
          await ApiClient.post(accumul8ActionUrl('materialize_due_recurring'), {});
        } catch (_error) {
          aliasScanWarning = true;
        }
      }

      await load();
      closeLedgerEntityModal();
      onToast?.({
        tone: aliasScanWarning ? 'warning' : 'success',
        message: aliasScanWarning
          ? `Updated ${targetEntityName || 'entity'} for "${description}", but the follow-up alias scan could not finish.`
          : `Updated ${targetEntityName || 'entity'} for "${description}" and refreshed its matching rule.`,
      });
    } catch (error: any) {
      onToast?.({
        tone: 'error',
        message: String(error?.message || 'Failed to update the entity name rule.'),
      });
    } finally {
      setLedgerEntityModalSaving(false);
    }
  }, [
    accumul8ActionUrl,
    closeLedgerEntityModal,
    entities,
    entityAliases,
    entityEndexGuides,
    ledgerEntityModalTransactionId,
    load,
    onToast,
    recurringPayments,
    setLedgerEntityModalSaving,
    transactions,
  ]);

  return { saveLedgerEntityRule };
}

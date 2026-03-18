import React from 'react';

import { Accumul8Entity, Accumul8EntityAliasDraft } from '../../../types/accumul8';
import { normalizeEntityAliasKey } from './accumul8PageEntityUtils';

interface UseAccumul8ModalHelperActionsOptions {
  createEntityAlias: (payload: { entity_id: number; alias_name: string; merge_entity_id: number | null }) => Promise<unknown>;
  defaultEntityAliasDraft: Accumul8EntityAliasDraft;
  editingEntityId: number | null;
  entities: Accumul8Entity[];
  entityAliasDraftById: Record<number, Accumul8EntityAliasDraft>;
  resetContactForm: () => void;
  resetDebtorForm: () => void;
  resetEntityForm: () => void;
  resetLedgerForm: () => void;
  resetRecurringEditor: () => void;
  setContactModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDebtorModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEntityAliasDraftById: React.Dispatch<React.SetStateAction<Record<number, Accumul8EntityAliasDraft>>>;
  setEntityModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLedgerEntityModalTransactionId: React.Dispatch<React.SetStateAction<number | null>>;
  setTransactionModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTransactionModalVariant: React.Dispatch<React.SetStateAction<'ledger' | 'iou'>>;
}

export function useAccumul8ModalHelperActions({
  createEntityAlias,
  defaultEntityAliasDraft,
  editingEntityId,
  entities,
  entityAliasDraftById,
  resetContactForm,
  resetDebtorForm,
  resetEntityForm,
  resetLedgerForm,
  resetRecurringEditor,
  setContactModalOpen,
  setDebtorModalOpen,
  setEntityAliasDraftById,
  setEntityModalOpen,
  setLedgerEntityModalTransactionId,
  setTransactionModalOpen,
  setTransactionModalVariant,
}: UseAccumul8ModalHelperActionsOptions) {
  const closeContactModal = React.useCallback(() => {
    setContactModalOpen(false);
    resetContactForm();
  }, [resetContactForm, setContactModalOpen]);

  const closeDebtorModal = React.useCallback(() => {
    setDebtorModalOpen(false);
    resetDebtorForm();
  }, [resetDebtorForm, setDebtorModalOpen]);

  const closeTransactionModal = React.useCallback(() => {
    setTransactionModalOpen(false);
    setTransactionModalVariant('ledger');
    resetLedgerForm();
  }, [resetLedgerForm, setTransactionModalOpen, setTransactionModalVariant]);

  const closeEntityModal = React.useCallback(() => {
    setEntityAliasDraftById((prev) => {
      if (editingEntityId === null || !prev[editingEntityId]) return prev;
      const next = { ...prev };
      delete next[editingEntityId];
      return next;
    });
    setEntityModalOpen(false);
    resetEntityForm();
  }, [editingEntityId, resetEntityForm, setEntityAliasDraftById, setEntityModalOpen]);

  const closeLedgerEntityModal = React.useCallback(() => {
    setLedgerEntityModalTransactionId(null);
  }, [setLedgerEntityModalTransactionId]);

  const closeRecurringModal = React.useCallback(() => {
    resetRecurringEditor();
  }, [resetRecurringEditor]);

  const collectEntityAliasNames = React.useCallback((entityId: number, entityDisplayName: string) => {
    const draft = entityAliasDraftById[entityId] || defaultEntityAliasDraft;
    const entity = entities.find((item) => item.id === entityId) || null;
    const blockedKeys = new Set<string>([
      normalizeEntityAliasKey(entityDisplayName),
      ...((entity?.aliases || []).map((alias) => normalizeEntityAliasKey(alias.alias_name))),
    ]);
    const seenKeys = new Set<string>();
    const names: string[] = [];
    const candidates = [
      ...((draft.pending_alias_names || []).map((value) => String(value || '').trim()).filter(Boolean)),
      String(draft.alias_name || '').trim(),
    ];

    candidates.forEach((value) => {
      const aliasKey = normalizeEntityAliasKey(value);
      if (!value || !aliasKey || blockedKeys.has(aliasKey) || seenKeys.has(aliasKey)) {
        return;
      }
      seenKeys.add(aliasKey);
      names.push(value);
    });

    return names;
  }, [defaultEntityAliasDraft, entities, entityAliasDraftById]);

  const persistEntityAliases = React.useCallback(async (entityId: number, entityDisplayName: string, aliasNames?: string[]) => {
    const namesToSave = aliasNames || collectEntityAliasNames(entityId, entityDisplayName);
    if (namesToSave.length === 0) {
      return;
    }
    for (const aliasName of namesToSave) {
      await createEntityAlias({
        entity_id: entityId,
        alias_name: aliasName,
        merge_entity_id: null,
      });
    }
    setEntityAliasDraftById((prev) => ({
      ...prev,
      [entityId]: defaultEntityAliasDraft,
    }));
  }, [collectEntityAliasNames, createEntityAlias, defaultEntityAliasDraft, setEntityAliasDraftById]);

  return {
    closeContactModal,
    closeDebtorModal,
    closeEntityModal,
    closeLedgerEntityModal,
    closeRecurringModal,
    closeTransactionModal,
    collectEntityAliasNames,
    persistEntityAliases,
  };
}

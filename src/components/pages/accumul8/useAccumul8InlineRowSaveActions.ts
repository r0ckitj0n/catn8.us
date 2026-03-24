import React from 'react';

import {
  Accumul8Debtor,
  Accumul8Entity,
  Accumul8EntityUpsertRequest,
  Accumul8Frequency,
  Accumul8PaymentMethod,
  Accumul8RecurringPayment,
  Accumul8RecurringUpsertRequest,
  Accumul8Transaction,
  Accumul8TransactionUpsertRequest,
} from '../../../types/accumul8';
import { getAccumul8TransactionEditPolicy } from '../../../utils/accumul8TransactionPolicy';
import { LedgerInlineDraft } from './accumul8PageFormUtils';
import { normalizeEntityContactType, normalizeEntityKind } from './accumul8PageEntityUtils';
import { DebtorInlineDraft, EntityInlineDraft, RecurringInlineDraft } from './useAccumul8InlineRowActions';

interface UseAccumul8InlineRowSaveActionsOptions {
  debtorDraftById: Record<number, DebtorInlineDraft>;
  deleteEntityAlias: (aliasId: number) => Promise<unknown>;
  entityDraftById: Record<number, EntityInlineDraft>;
  ledgerDraftById: Record<number, LedgerInlineDraft>;
  payBillDraftById: Record<number, LedgerInlineDraft>;
  persistEntityAliases: (entityId: number, entityDisplayName: string, aliasNames?: string[]) => Promise<void>;
  recurringDraftById: Record<number, RecurringInlineDraft>;
  setActiveDebtorRowId: React.Dispatch<React.SetStateAction<number | null>>;
  setActiveEntityRowId: React.Dispatch<React.SetStateAction<number | null>>;
  setActiveLedgerRowId: React.Dispatch<React.SetStateAction<number | null>>;
  setActivePayBillRowId: React.Dispatch<React.SetStateAction<number | null>>;
  setActiveRecurringRowId: React.Dispatch<React.SetStateAction<number | null>>;
  setDebtorDraftById: React.Dispatch<React.SetStateAction<Record<number, DebtorInlineDraft>>>;
  setEntityDraftById: React.Dispatch<React.SetStateAction<Record<number, EntityInlineDraft>>>;
  setLedgerDraftById: React.Dispatch<React.SetStateAction<Record<number, LedgerInlineDraft>>>;
  setPayBillDraftById: React.Dispatch<React.SetStateAction<Record<number, LedgerInlineDraft>>>;
  setRecurringDraftById: React.Dispatch<React.SetStateAction<Record<number, RecurringInlineDraft>>>;
  updateDebtor: (id: number, payload: { debtor_name: string; notes?: string; is_active?: number }) => Promise<unknown>;
  updateEntity: (id: number, payload: Accumul8EntityUpsertRequest) => Promise<unknown>;
  updateRecurring: (id: number, payload: Accumul8RecurringUpsertRequest) => Promise<unknown>;
  updateTransaction: (id: number, payload: Accumul8TransactionUpsertRequest) => Promise<unknown>;
}

export function useAccumul8InlineRowSaveActions({
  debtorDraftById,
  deleteEntityAlias,
  entityDraftById,
  ledgerDraftById,
  payBillDraftById,
  persistEntityAliases,
  recurringDraftById,
  setActiveDebtorRowId,
  setActiveEntityRowId,
  setActiveLedgerRowId,
  setActivePayBillRowId,
  setActiveRecurringRowId,
  setDebtorDraftById,
  setEntityDraftById,
  setLedgerDraftById,
  setPayBillDraftById,
  setRecurringDraftById,
  updateDebtor,
  updateEntity,
  updateRecurring,
  updateTransaction,
}: UseAccumul8InlineRowSaveActionsOptions) {
  const shouldSkipRecurringTemplateSync = React.useCallback((tx: Accumul8Transaction): number => {
    const isRecurringLinked = Number(tx.recurring_payment_id || 0) > 0;
    if (!isRecurringLinked) {
      return 0;
    }
    return getAccumul8TransactionEditPolicy(tx).isImported ? 0 : 1;
  }, []);

  const saveLedgerRow = React.useCallback(async (tx: Accumul8Transaction) => {
    const draft = ledgerDraftById[tx.id];
    if (!draft) return;
    await updateTransaction(tx.id, {
      transaction_date: draft.transaction_date ?? tx.transaction_date,
      due_date: draft.due_date ?? tx.due_date,
      paid_date: draft.paid_date ?? tx.paid_date,
      entry_type: tx.entry_type,
      description: draft.description ?? tx.description,
      memo: draft.memo ?? tx.memo,
      amount: Number(draft.amount ?? tx.amount ?? 0),
      rta_amount: Number(draft.rta_amount ?? tx.rta_amount ?? 0),
      is_paid: Number(draft.is_paid ?? tx.is_paid ?? 0),
      is_reconciled: Number(draft.is_reconciled ?? tx.is_reconciled ?? 0),
      is_budget_planner: Number(draft.is_budget_planner ?? tx.is_budget_planner ?? 0),
      entity_id: draft.entity_id ?? tx.entity_id ?? null,
      account_id: draft.account_id ?? tx.account_id ?? null,
      balance_entity_id: draft.balance_entity_id ?? tx.balance_entity_id ?? null,
      skip_recurring_template_sync: shouldSkipRecurringTemplateSync(tx),
    });
    setLedgerDraftById((prev) => { const next = { ...prev }; delete next[tx.id]; return next; });
    setActiveLedgerRowId((current) => (current === tx.id ? null : current));
  }, [ledgerDraftById, setActiveLedgerRowId, setLedgerDraftById, shouldSkipRecurringTemplateSync, updateTransaction]);
  const savePayBillRow = React.useCallback(async (tx: Accumul8Transaction) => {
    const draft = payBillDraftById[tx.id];
    if (!draft) return;
    await updateTransaction(tx.id, {
      transaction_date: draft.transaction_date ?? tx.transaction_date,
      due_date: draft.due_date ?? tx.due_date,
      paid_date: draft.paid_date ?? tx.paid_date,
      entry_type: tx.entry_type,
      description: draft.description ?? tx.description,
      memo: draft.memo ?? tx.memo,
      amount: Number(draft.amount ?? tx.amount ?? 0),
      rta_amount: Number(draft.rta_amount ?? tx.rta_amount ?? 0),
      is_paid: Number(draft.is_paid ?? tx.is_paid ?? 0),
      is_reconciled: Number(draft.is_reconciled ?? tx.is_reconciled ?? 0),
      is_budget_planner: Number(draft.is_budget_planner ?? tx.is_budget_planner ?? 0),
      entity_id: draft.entity_id ?? tx.entity_id ?? null,
      account_id: draft.account_id ?? tx.account_id ?? null,
      balance_entity_id: draft.balance_entity_id ?? tx.balance_entity_id ?? null,
      skip_recurring_template_sync: shouldSkipRecurringTemplateSync(tx),
    });
    setPayBillDraftById((prev) => { const next = { ...prev }; delete next[tx.id]; return next; });
    setActivePayBillRowId((current) => (current === tx.id ? null : current));
  }, [payBillDraftById, setActivePayBillRowId, setPayBillDraftById, shouldSkipRecurringTemplateSync, updateTransaction]);
  const saveDebtorRow = React.useCallback(async (row: Accumul8Debtor) => {
    const draft = debtorDraftById[row.id];
    if (!draft) return;
    await updateDebtor(row.id, {
      debtor_name: draft.debtor_name ?? row.debtor_name,
      notes: draft.notes ?? row.notes ?? '',
      is_active: Number(draft.is_active ?? row.is_active ?? 0),
    });
    setDebtorDraftById((prev) => { const next = { ...prev }; delete next[row.id]; return next; });
    setActiveDebtorRowId((current) => (current === row.id ? null : current));
  }, [debtorDraftById, setActiveDebtorRowId, setDebtorDraftById, updateDebtor]);
  const saveEntityRow = React.useCallback(async (entity: Accumul8Entity) => {
    const draft = entityDraftById[entity.id];
    if (!draft) return;
    await updateEntity(entity.id, {
      display_name: draft.display_name ?? entity.display_name,
      entity_kind: draft.entity_kind ?? normalizeEntityKind(entity.entity_kind, entity.is_vendor),
      contact_type: draft.contact_type ?? normalizeEntityContactType(entity),
      is_payee: (draft.contact_type ?? normalizeEntityContactType(entity)) === 'payee' ? 1 : 0,
      is_payer: (draft.contact_type ?? normalizeEntityContactType(entity)) === 'payer' ? 1 : 0,
      is_vendor: (draft.entity_kind ?? normalizeEntityKind(entity.entity_kind, entity.is_vendor)) === 'business' ? 1 : 0,
      is_balance_person: (draft.contact_type ?? normalizeEntityContactType(entity)) === 'repayment' ? 1 : 0,
      default_amount: Number(draft.default_amount ?? entity.default_amount ?? 0),
      email: draft.email ?? entity.email ?? '',
      phone_number: draft.phone_number ?? entity.phone_number ?? '',
      street_address: draft.street_address ?? entity.street_address ?? '',
      city: draft.city ?? entity.city ?? '',
      state: draft.state ?? entity.state ?? '',
      zip: draft.zip ?? entity.zip ?? '',
      notes: draft.notes ?? entity.notes ?? '',
      is_active: Number(draft.is_active ?? entity.is_active ?? 0),
    });
    setEntityDraftById((prev) => { const next = { ...prev }; delete next[entity.id]; return next; });
    setActiveEntityRowId((current) => (current === entity.id ? null : current));
  }, [entityDraftById, setActiveEntityRowId, setEntityDraftById, updateEntity]);
  const saveEntityAlias = React.useCallback(async (entity: Accumul8Entity) => {
    await persistEntityAliases(entity.id, entity.display_name);
  }, [persistEntityAliases]);
  const removeEntityAlias = React.useCallback(async (aliasId: number) => {
    await deleteEntityAlias(aliasId);
  }, [deleteEntityAlias]);
  const saveRecurringRow = React.useCallback(async (row: Accumul8RecurringPayment) => {
    const draft = recurringDraftById[row.id];
    if (!draft) return;
    await updateRecurring(row.id, {
      title: draft.title ?? row.title,
      direction: row.direction,
      amount: Number(draft.amount ?? row.amount ?? 0),
      frequency: (draft.frequency ?? row.frequency) as Accumul8Frequency,
      payment_method: (draft.payment_method ?? row.payment_method) as Accumul8PaymentMethod,
      interval_count: Number(row.interval_count || 1),
      next_due_date: draft.next_due_date ?? row.next_due_date,
      entity_id: row.entity_id ?? null,
      account_id: draft.account_id ?? row.account_id ?? null,
      is_budget_planner: Number(draft.is_budget_planner ?? row.is_budget_planner ?? 0),
      notes: draft.notes ?? row.notes ?? '',
    });
    setRecurringDraftById((prev) => { const next = { ...prev }; delete next[row.id]; return next; });
    setActiveRecurringRowId((current) => (current === row.id ? null : current));
  }, [recurringDraftById, setActiveRecurringRowId, setRecurringDraftById, updateRecurring]);

  return {
    removeEntityAlias,
    saveDebtorRow,
    saveEntityAlias,
    saveEntityRow,
    saveLedgerRow,
    savePayBillRow,
    saveRecurringRow,
  };
}

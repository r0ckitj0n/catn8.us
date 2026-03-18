import React from 'react';

import {
  Accumul8Debtor,
  Accumul8RecurringPayment,
  Accumul8Entity,
  Accumul8EntityUpsertRequest,
  Accumul8RecurringUpsertRequest,
  Accumul8TransactionUpsertRequest,
} from '../../../types/accumul8';
import { LedgerInlineDraft } from './accumul8PageFormUtils';
import { useAccumul8InlineRowSaveActions } from './useAccumul8InlineRowSaveActions';
import { useAccumul8InlineRowStateActions } from './useAccumul8InlineRowStateActions';

export type DebtorInlineDraft = Partial<Pick<Accumul8Debtor, 'debtor_name' | 'notes' | 'is_active'>>;
export type EntityInlineDraft = Partial<Pick<Accumul8Entity, 'display_name' | 'notes' | 'entity_kind' | 'contact_type' | 'is_vendor' | 'phone_number' | 'email' | 'street_address' | 'city' | 'state' | 'zip' | 'default_amount' | 'is_active'>>;
export type RecurringInlineDraft = Partial<Pick<Accumul8RecurringPayment, 'title' | 'next_due_date' | 'amount' | 'frequency' | 'payment_method' | 'is_budget_planner' | 'is_active' | 'notes' | 'account_id'>>;

interface UseAccumul8InlineRowActionsOptions {
  debtorDraftById: Record<number, DebtorInlineDraft>;
  deleteRecurring: (id: number) => Promise<unknown>;
  deleteTransaction: (id: number) => Promise<unknown>;
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
  deleteEntityAlias: (aliasId: number) => Promise<unknown>;
}

export function useAccumul8InlineRowActions({
  debtorDraftById,
  deleteEntityAlias,
  deleteRecurring,
  deleteTransaction,
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
}: UseAccumul8InlineRowActionsOptions) {
  const stateActions = useAccumul8InlineRowStateActions({
    deleteRecurring,
    deleteTransaction,
    ledgerDraftById,
    payBillDraftById,
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
  });
  const saveActions = useAccumul8InlineRowSaveActions({
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
  });

  return {
    ...stateActions,
    ...saveActions,
  };
}

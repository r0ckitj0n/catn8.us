import React from 'react';

import { Accumul8Debtor, Accumul8Entity, Accumul8RecurringPayment, Accumul8Transaction } from '../../../types/accumul8';
import { LedgerInlineDraft, normalizePaidStateDraft } from './accumul8PageFormUtils';
import { DebtorInlineDraft, EntityInlineDraft, RecurringInlineDraft } from './useAccumul8InlineRowActions';

interface UseAccumul8InlineRowStateActionsOptions {
  deleteRecurring: (id: number) => Promise<unknown>;
  deleteTransaction: (id: number) => Promise<unknown>;
  ledgerDraftById: Record<number, LedgerInlineDraft>;
  payBillDraftById: Record<number, LedgerInlineDraft>;
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
}

export function useAccumul8InlineRowStateActions({
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
}: UseAccumul8InlineRowStateActionsOptions) {
  const handleDeleteTransaction = React.useCallback((id: number, description: string) => {
    if (window.confirm(`Delete "${description || 'this ledger item'}"?`)) {
      void deleteTransaction(id);
    }
  }, [deleteTransaction]);
  const handleDeleteRecurring = React.useCallback((id: number, description: string) => {
    if (window.confirm(`Delete "${description || 'this recurring item'}"?`)) {
      void deleteRecurring(id);
    }
  }, [deleteRecurring]);
  const activateLedgerRow = React.useCallback((id: number) => setActiveLedgerRowId(id), [setActiveLedgerRowId]);
  const activatePayBillRow = React.useCallback((id: number) => setActivePayBillRowId(id), [setActivePayBillRowId]);
  const activateDebtorRow = React.useCallback((id: number) => setActiveDebtorRowId(id), [setActiveDebtorRowId]);
  const activateEntityRow = React.useCallback((id: number) => setActiveEntityRowId(id), [setActiveEntityRowId]);
  const activateRecurringRow = React.useCallback((id: number) => setActiveRecurringRowId(id), [setActiveRecurringRowId]);
  const setLedgerRowDraft = React.useCallback((tx: Accumul8Transaction, patch: LedgerInlineDraft) => {
    setLedgerDraftById((prev) => {
      const draftById = prev || {};
      const normalizedPatch = normalizePaidStateDraft(tx, draftById[tx.id], patch);
      return { ...draftById, [tx.id]: { ...draftById[tx.id], ...normalizedPatch } };
    });
  }, [setLedgerDraftById]);
  const setDebtorRowDraft = React.useCallback((row: Accumul8Debtor, patch: DebtorInlineDraft) => {
    setDebtorDraftById((prev) => ({ ...prev, [row.id]: { ...prev[row.id], ...patch } }));
  }, [setDebtorDraftById]);
  const setEntityRowDraft = React.useCallback((row: Accumul8Entity, patch: EntityInlineDraft) => {
    setEntityDraftById((prev) => ({ ...prev, [row.id]: { ...prev[row.id], ...patch } }));
  }, [setEntityDraftById]);
  const setPayBillRowDraft = React.useCallback((tx: Accumul8Transaction, patch: LedgerInlineDraft) => {
    setPayBillDraftById((prev) => {
      const draftById = prev || {};
      const normalizedPatch = normalizePaidStateDraft(tx, draftById[tx.id], patch);
      return { ...draftById, [tx.id]: { ...draftById[tx.id], ...normalizedPatch } };
    });
  }, [setPayBillDraftById]);
  const setRecurringRowDraft = React.useCallback((row: Accumul8RecurringPayment, patch: RecurringInlineDraft) => {
    setRecurringDraftById((prev) => ({ ...prev, [row.id]: { ...prev[row.id], ...patch } }));
  }, [setRecurringDraftById]);

  return {
    activateDebtorRow,
    activateEntityRow,
    activateLedgerRow,
    activatePayBillRow,
    activateRecurringRow,
    handleDeleteRecurring,
    handleDeleteTransaction,
    setDebtorRowDraft,
    setEntityRowDraft,
    setLedgerRowDraft,
    setPayBillRowDraft,
    setRecurringRowDraft,
  };
}

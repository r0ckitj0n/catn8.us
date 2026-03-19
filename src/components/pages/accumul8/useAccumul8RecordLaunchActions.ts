import React from 'react';

import { Accumul8Direction, Accumul8Frequency, Accumul8PaymentMethod, Accumul8RecurringPayment, Accumul8Transaction } from '../../../types/accumul8';
import { createDefaultLedgerForm, RecurringFormState, buildLedgerFormFromTransaction } from './accumul8PageFormUtils';

interface UseAccumul8RecordLaunchActionsOptions {
  DEFAULT_RECURRING_FORM: RecurringFormState;
  recurringPayments: Accumul8RecurringPayment[];
  selectedBankAccountId: string;
  setEditingRecurringForm: React.Dispatch<React.SetStateAction<RecurringFormState>>;
  setEditingRecurringId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingTransactionId: React.Dispatch<React.SetStateAction<number | null>>;
  setLedgerEntityModalTransactionId: React.Dispatch<React.SetStateAction<number | null>>;
  setLedgerForm: React.Dispatch<React.SetStateAction<ReturnType<typeof createDefaultLedgerForm>>>;
  setRecurringLinkModalRecurringId: React.Dispatch<React.SetStateAction<number | null>>;
  setRecurringModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTransactionModalMode: React.Dispatch<React.SetStateAction<'create' | 'edit' | 'view'>>;
  setTransactionModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTransactionModalVariant: React.Dispatch<React.SetStateAction<'ledger' | 'iou'>>;
  setViewingTransactionId: React.Dispatch<React.SetStateAction<number | null>>;
  transactions: Accumul8Transaction[];
}

export function useAccumul8RecordLaunchActions({
  DEFAULT_RECURRING_FORM,
  recurringPayments,
  selectedBankAccountId,
  setEditingRecurringForm,
  setEditingRecurringId,
  setEditingTransactionId,
  setLedgerEntityModalTransactionId,
  setLedgerForm,
  setRecurringLinkModalRecurringId,
  setRecurringModalOpen,
  setTransactionModalMode,
  setTransactionModalOpen,
  setTransactionModalVariant,
  setViewingTransactionId,
  transactions,
}: UseAccumul8RecordLaunchActionsOptions) {
  const beginEditTransaction = React.useCallback((id: number) => {
    const tx = transactions.find((v) => v.id === id);
    if (!tx) return;
    setEditingTransactionId(tx.id);
    setViewingTransactionId(null);
    setTransactionModalMode('edit');
    setTransactionModalVariant(Number(tx.debtor_id || 0) > 0 ? 'iou' : 'ledger');
    setLedgerForm(buildLedgerFormFromTransaction(tx));
    setTransactionModalOpen(true);
  }, [setEditingTransactionId, setLedgerForm, setTransactionModalMode, setTransactionModalOpen, setTransactionModalVariant, setViewingTransactionId, transactions]);
  const beginViewTransaction = React.useCallback((id: number) => {
    const tx = transactions.find((v) => v.id === id);
    if (!tx) return;
    setEditingTransactionId(null);
    setViewingTransactionId(tx.id);
    setTransactionModalMode('view');
    setTransactionModalVariant(Number(tx.debtor_id || 0) > 0 ? 'iou' : 'ledger');
    setLedgerForm(buildLedgerFormFromTransaction(tx));
    setTransactionModalOpen(true);
  }, [setEditingTransactionId, setLedgerForm, setTransactionModalMode, setTransactionModalOpen, setTransactionModalVariant, setViewingTransactionId, transactions]);
  const openCreateTransactionModal = React.useCallback((defaults?: { balanceEntityId?: string }) => { setEditingTransactionId(null); setViewingTransactionId(null); setTransactionModalMode('create'); setTransactionModalVariant('ledger'); setLedgerForm(createDefaultLedgerForm({ accountId: selectedBankAccountId, balanceEntityId: defaults?.balanceEntityId || '' })); setTransactionModalOpen(true); }, [selectedBankAccountId, setEditingTransactionId, setLedgerForm, setTransactionModalMode, setTransactionModalOpen, setTransactionModalVariant, setViewingTransactionId]);
  const openCreateIouTransactionModal = React.useCallback((defaults?: { debtorId?: string }) => { setEditingTransactionId(null); setViewingTransactionId(null); setTransactionModalMode('create'); setTransactionModalVariant('iou'); setLedgerForm(createDefaultLedgerForm({ accountId: selectedBankAccountId, debtorId: defaults?.debtorId || '' })); setTransactionModalOpen(true); }, [selectedBankAccountId, setEditingTransactionId, setLedgerForm, setTransactionModalMode, setTransactionModalOpen, setTransactionModalVariant, setViewingTransactionId]);
  const openLedgerEntityModal = React.useCallback((transactionId: number) => { const transaction = transactions.find((row) => row.id === transactionId) || null; if (!transaction || Number(transaction.debtor_id || 0) > 0) return; setLedgerEntityModalTransactionId(transaction.id); }, [setLedgerEntityModalTransactionId, transactions]);
  const openRecurringLinkModal = React.useCallback((recurringId: number) => {
    const recurring = recurringPayments.find((row) => row.id === recurringId) || null;
    if (!recurring) return;
    setRecurringLinkModalRecurringId(recurring.id);
  }, [recurringPayments, setRecurringLinkModalRecurringId]);
  const beginEditRecurring = React.useCallback((id: number) => {
    const recurring = recurringPayments.find((v) => v.id === id);
    if (!recurring) return;
    setEditingRecurringId(recurring.id);
    setEditingRecurringForm({ title: recurring.title || '', direction: (recurring.direction || 'outflow') as Accumul8Direction, amount: Number(recurring.amount || 0), frequency: (recurring.frequency || 'monthly') as Accumul8Frequency, payment_method: (recurring.payment_method || 'unspecified') as Accumul8PaymentMethod, interval_count: Number(recurring.interval_count || 1), next_due_date: recurring.next_due_date || '', entity_id: recurring.entity_id ? String(recurring.entity_id) : '', account_id: recurring.account_id ? String(recurring.account_id) : '', is_budget_planner: Number(recurring.is_budget_planner || 0), notes: recurring.notes || '' });
    setRecurringModalOpen(true);
  }, [recurringPayments, setEditingRecurringForm, setEditingRecurringId, setRecurringModalOpen]);
  const openCreateRecurringModal = React.useCallback(() => { setEditingRecurringId(null); setEditingRecurringForm(DEFAULT_RECURRING_FORM); setRecurringModalOpen(true); }, [DEFAULT_RECURRING_FORM, setEditingRecurringForm, setEditingRecurringId, setRecurringModalOpen]);

  return { beginEditRecurring, beginEditTransaction, beginViewTransaction, openCreateIouTransactionModal, openCreateRecurringModal, openCreateTransactionModal, openLedgerEntityModal, openRecurringLinkModal };
}

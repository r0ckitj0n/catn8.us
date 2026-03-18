import React from 'react';

import {
  Accumul8ContactType,
  Accumul8ContactUpsertRequest,
  Accumul8DebtorUpsertRequest,
  Accumul8EntityUpsertRequest,
  Accumul8RecurringUpsertRequest,
  Accumul8TransactionUpsertRequest,
} from '../../../types/accumul8';

interface UseAccumul8ModalSubmitActionsOptions {
  closeContactModal: () => void;
  closeDebtorModal: () => void;
  closeEntityModal: () => void;
  closeRecurringModal: () => void;
  closeTransactionModal: () => void;
  collectEntityAliasNames: (entityId: number, entityDisplayName: string) => string[];
  createContact: (payload: Accumul8ContactUpsertRequest) => Promise<unknown>;
  createDebtor: (payload: Accumul8DebtorUpsertRequest) => Promise<unknown>;
  createEntity: (payload: Accumul8EntityUpsertRequest) => Promise<unknown>;
  createRecurring: (payload: Accumul8RecurringUpsertRequest) => Promise<unknown>;
  createTransaction: (payload: Accumul8TransactionUpsertRequest) => Promise<unknown>;
  defaultContactForm: {
    contact_name: string;
    contact_type: Accumul8ContactType;
    default_amount: number;
    email: string;
    phone_number: string;
    street_address: string;
    city: string;
    state: string;
    zip: string;
    notes: string;
  };
  editingContactId: number | null;
  editingDebtorId: number | null;
  editingEntityId: number | null;
  editingRecurringId: number | null;
  editingTransactionId: number | null;
  persistEntityAliases: (entityId: number, entityDisplayName: string, aliasNames?: string[]) => Promise<void>;
  updateContact: (id: number, payload: Accumul8ContactUpsertRequest) => Promise<unknown>;
  updateDebtor: (id: number, payload: Accumul8DebtorUpsertRequest) => Promise<unknown>;
  updateEntity: (id: number, payload: Accumul8EntityUpsertRequest) => Promise<unknown>;
  updateRecurring: (id: number, payload: Accumul8RecurringUpsertRequest) => Promise<unknown>;
  updateTransaction: (id: number, payload: Accumul8TransactionUpsertRequest) => Promise<unknown>;
}

export function useAccumul8ModalSubmitActions({
  closeContactModal,
  closeDebtorModal,
  closeEntityModal,
  closeRecurringModal,
  closeTransactionModal,
  collectEntityAliasNames,
  createContact,
  createDebtor,
  createEntity,
  createRecurring,
  createTransaction,
  defaultContactForm,
  editingContactId,
  editingDebtorId,
  editingEntityId,
  editingRecurringId,
  editingTransactionId,
  persistEntityAliases,
  updateContact,
  updateDebtor,
  updateEntity,
  updateRecurring,
  updateTransaction,
}: UseAccumul8ModalSubmitActionsOptions) {
  const submitContactForm = React.useCallback(async (form: typeof defaultContactForm) => {
    const payload = { ...form, default_amount: Number(form.default_amount) };
    if (editingContactId) await updateContact(editingContactId, payload);
    else await createContact(payload);
    closeContactModal();
  }, [closeContactModal, createContact, defaultContactForm, editingContactId, updateContact]);
  const submitEntityForm = React.useCallback(async (form: Accumul8EntityUpsertRequest) => {
    const payload: Accumul8EntityUpsertRequest = { ...form, entity_kind: form.entity_kind || 'business', is_active: Number(form.is_active ?? 1), default_amount: Number(form.default_amount || 0), email: form.email || '', phone_number: form.phone_number || '', street_address: form.street_address || '', city: form.city || '', state: form.state || '', zip: form.zip || '', notes: form.notes || '' };
    if (editingEntityId) {
      const aliasNames = collectEntityAliasNames(editingEntityId, payload.display_name);
      await updateEntity(editingEntityId, payload);
      await persistEntityAliases(editingEntityId, payload.display_name, aliasNames);
    } else await createEntity(payload);
    closeEntityModal();
  }, [closeEntityModal, collectEntityAliasNames, createEntity, editingEntityId, persistEntityAliases, updateEntity]);
  const submitDebtorModal = React.useCallback(async (form: Accumul8DebtorUpsertRequest) => { if (editingDebtorId) await updateDebtor(editingDebtorId, form); else await createDebtor(form); closeDebtorModal(); }, [closeDebtorModal, createDebtor, editingDebtorId, updateDebtor]);
  const submitTransactionModal = React.useCallback(async (form: Accumul8TransactionUpsertRequest) => { if (editingTransactionId) await updateTransaction(editingTransactionId, form); else await createTransaction(form); closeTransactionModal(); }, [closeTransactionModal, createTransaction, editingTransactionId, updateTransaction]);
  const submitRecurringModal = React.useCallback(async (form: Accumul8RecurringUpsertRequest) => { if (editingRecurringId) await updateRecurring(editingRecurringId, form); else await createRecurring(form); closeRecurringModal(); }, [closeRecurringModal, createRecurring, editingRecurringId, updateRecurring]);

  return { submitContactForm, submitDebtorModal, submitEntityForm, submitRecurringModal, submitTransactionModal };
}

import React from 'react';

import { useAccumul8EntityContactLaunchActions } from './useAccumul8EntityContactLaunchActions';
import { useAccumul8ModalLaunchAuxActions } from './useAccumul8ModalLaunchAuxActions';
import { useAccumul8RecordLaunchActions } from './useAccumul8RecordLaunchActions';
import { useAccumul8ModalSubmitActions } from './useAccumul8ModalSubmitActions';
import { UseAccumul8ModalEditorActionsOptions } from './useAccumul8ModalEditorActionTypes';

export function useAccumul8ModalEditorActions(options: UseAccumul8ModalEditorActionsOptions) {
  const {
    closeContactModal, closeDebtorModal, closeEntityModal, closeRecurringModal, closeTransactionModal,
    collectEntityAliasNames, contacts, createContact, createDebtor, createEntity, createRecurring, createTransaction,
    DEFAULT_CONTACT_FORM, DEFAULT_ENTITY_ALIAS_DRAFT, DEFAULT_ENTITY_FORM, DEFAULT_RECURRING_FORM,
    editingContactId, editingDebtorId, editingEntityId, editingRecurringId, editingTransactionId,
    entities, notificationRules, persistEntityAliases, recurringPayments,
    selectedBankAccountId, setBudgetForm, setContactForm, setContactModalOpen, setDebtorForm, setDebtorModalOpen,
    setEditingBudgetRowId, setEditingContactId, setEditingDebtorId, setEditingEntityId, setEditingNotificationRuleId,
    setEditingRecurringForm, setEditingRecurringId, setEditingTransactionId, setEntityAliasDraftById, setEntityForm,
    setEntityModalOpen, setLedgerEntityModalTransactionId, setLedgerForm, setNotificationForm, setRecurringModalOpen,
    setTransactionModalMode, setTransactionModalOpen, setTransactionModalVariant, setViewingTransactionId,
    transactions, updateContact, updateDebtor, updateEntity, updateRecurring, updateTransaction,
  } = options;

  const { beginEditContact, beginEditEntity, openCreateEntityModal } = useAccumul8EntityContactLaunchActions({
    contacts,
    defaultEntityAliasDraft: DEFAULT_ENTITY_ALIAS_DRAFT,
    defaultEntityForm: DEFAULT_ENTITY_FORM,
    entities,
    setContactForm,
    setContactModalOpen,
    setEditingContactId,
    setEditingEntityId,
    setEntityAliasDraftById,
    setEntityForm,
    setEntityModalOpen,
  });
  const {
    beginEditBudgetRow,
    beginEditNotificationRule,
    openCreateContactModal,
    openCreateDebtorModal,
  } = useAccumul8ModalLaunchAuxActions({
    DEFAULT_CONTACT_FORM,
    notificationRules,
    setBudgetForm,
    setContactForm,
    setContactModalOpen,
    setDebtorForm,
    setDebtorModalOpen,
    setEditingBudgetRowId,
    setEditingContactId,
    setEditingDebtorId,
    setEditingNotificationRuleId,
    setNotificationForm,
  });
  const {
    beginEditRecurring,
    beginEditTransaction,
    beginViewTransaction,
    openCreateIouTransactionModal,
    openCreateRecurringModal,
    openCreateTransactionModal,
    openLedgerEntityModal,
  } = useAccumul8RecordLaunchActions({
    DEFAULT_RECURRING_FORM,
    recurringPayments,
    selectedBankAccountId,
    setEditingRecurringForm,
    setEditingRecurringId,
    setEditingTransactionId,
    setLedgerEntityModalTransactionId,
    setLedgerForm,
    setRecurringModalOpen,
    setTransactionModalMode,
    setTransactionModalOpen,
    setTransactionModalVariant,
    setViewingTransactionId,
    transactions,
  });
  const {
    submitContactForm,
    submitDebtorModal,
    submitEntityForm,
    submitRecurringModal,
    submitTransactionModal,
  } = useAccumul8ModalSubmitActions({
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
    defaultContactForm: DEFAULT_CONTACT_FORM,
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
  });
  return {
    beginEditBudgetRow,
    beginEditContact,
    beginEditEntity,
    beginEditNotificationRule,
    beginEditRecurring,
    beginEditTransaction,
    beginViewTransaction,
    openCreateContactModal,
    openCreateDebtorModal,
    openCreateEntityModal,
    openCreateIouTransactionModal,
    openCreateRecurringModal,
    openCreateTransactionModal,
    openLedgerEntityModal,
    submitContactForm,
    submitDebtorModal,
    submitEntityForm,
    submitRecurringModal,
    submitTransactionModal,
  };
}

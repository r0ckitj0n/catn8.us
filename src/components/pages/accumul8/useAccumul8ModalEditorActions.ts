import React from 'react';

import {
  Accumul8Contact,
  Accumul8ContactUpsertRequest,
  Accumul8ContactType,
  Accumul8Debtor,
  Accumul8DebtorUpsertRequest,
  Accumul8Direction,
  Accumul8Entity,
  Accumul8EntityAliasDraft,
  Accumul8EntityUpsertRequest,
  Accumul8EntryType,
  Accumul8Frequency,
  Accumul8PaymentMethod,
  Accumul8RecurringPayment,
  Accumul8RecurringUpsertRequest,
  Accumul8Transaction,
  Accumul8TransactionUpsertRequest,
} from '../../../types/accumul8';
import { createDefaultLedgerForm, RecurringFormState } from './accumul8PageFormUtils';
import { normalizeEntityContactType, normalizeEntityKind } from './accumul8PageEntityUtils';
import { useAccumul8ModalLaunchAuxActions } from './useAccumul8ModalLaunchAuxActions';
import { useAccumul8RecordLaunchActions } from './useAccumul8RecordLaunchActions';
import { useAccumul8ModalSubmitActions } from './useAccumul8ModalSubmitActions';

type EntityFormState = {
  display_name: string;
  entity_kind: string;
  contact_type: Accumul8ContactType;
  is_vendor: number;
  default_amount: number;
  email: string;
  phone_number: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  is_active: number;
};

interface UseAccumul8ModalEditorActionsOptions {
  closeContactModal: () => void;
  closeDebtorModal: () => void;
  closeEntityModal: () => void;
  closeRecurringModal: () => void;
  closeTransactionModal: () => void;
  collectEntityAliasNames: (entityId: number, entityDisplayName: string) => string[];
  contacts: Accumul8Contact[];
  createContact: (payload: Accumul8ContactUpsertRequest) => Promise<unknown>;
  createDebtor: (payload: Accumul8DebtorUpsertRequest) => Promise<unknown>;
  createEntity: (payload: Accumul8EntityUpsertRequest) => Promise<unknown>;
  createRecurring: (payload: Accumul8RecurringUpsertRequest) => Promise<unknown>;
  createTransaction: (payload: Accumul8TransactionUpsertRequest) => Promise<unknown>;
  DEFAULT_CONTACT_FORM: {
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
  DEFAULT_ENTITY_ALIAS_DRAFT: Accumul8EntityAliasDraft;
  DEFAULT_ENTITY_FORM: EntityFormState;
  DEFAULT_RECURRING_FORM: RecurringFormState;
  editingContactId: number | null;
  editingDebtorId: number | null;
  editingEntityId: number | null;
  editingRecurringId: number | null;
  editingTransactionId: number | null;
  entities: Accumul8Entity[];
  persistEntityAliases: (entityId: number, entityDisplayName: string, aliasNames?: string[]) => Promise<void>;
  recurringPayments: Accumul8RecurringPayment[];
  notificationRules: Array<{ id: number; rule_name: string; trigger_type: string; days_before_due: number; target_scope: string; custom_user_ids?: number[]; email_subject_template?: string; email_body_template?: string }>;
  selectedBankAccountId: string;
  setBudgetForm: React.Dispatch<React.SetStateAction<{ category_name: string; monthly_budget: number; match_pattern: string; row_order: number; is_active: number }>>;
  setContactForm: React.Dispatch<React.SetStateAction<typeof optionsPlaceholder.contactForm>>;
  setContactModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDebtorForm: React.Dispatch<React.SetStateAction<{ debtor_name: string; notes: string; is_active: number }>>;
  setDebtorModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingBudgetRowId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingContactId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingDebtorId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingEntityId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingNotificationRuleId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingRecurringForm: React.Dispatch<React.SetStateAction<RecurringFormState>>;
  setEditingRecurringId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingTransactionId: React.Dispatch<React.SetStateAction<number | null>>;
  setEntityAliasDraftById: React.Dispatch<React.SetStateAction<Record<number, Accumul8EntityAliasDraft>>>;
  setEntityForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  setEntityModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLedgerEntityModalTransactionId: React.Dispatch<React.SetStateAction<number | null>>;
  setLedgerForm: React.Dispatch<React.SetStateAction<ReturnType<typeof createDefaultLedgerForm>>>;
  setNotificationForm: React.Dispatch<React.SetStateAction<{ rule_name: string; trigger_type: string; days_before_due: number; target_scope: 'group' | 'custom'; custom_user_ids: string; email_subject_template: string; email_body_template: string }>>;
  setRecurringModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTransactionModalMode: React.Dispatch<React.SetStateAction<'create' | 'edit' | 'view'>>;
  setTransactionModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTransactionModalVariant: React.Dispatch<React.SetStateAction<'ledger' | 'iou'>>;
  setViewingTransactionId: React.Dispatch<React.SetStateAction<number | null>>;
  transactions: Accumul8Transaction[];
  updateContact: (id: number, payload: Accumul8ContactUpsertRequest) => Promise<unknown>;
  updateDebtor: (id: number, payload: Accumul8DebtorUpsertRequest) => Promise<unknown>;
  updateEntity: (id: number, payload: Accumul8EntityUpsertRequest) => Promise<unknown>;
  updateRecurring: (id: number, payload: Accumul8RecurringUpsertRequest) => Promise<unknown>;
  updateTransaction: (id: number, payload: Accumul8TransactionUpsertRequest) => Promise<unknown>;
}

const optionsPlaceholder = {
  contactForm: {
    contact_name: '',
    contact_type: 'payee' as Accumul8ContactType,
    default_amount: 0,
    email: '',
    phone_number: '',
    street_address: '',
    city: '',
    state: '',
    zip: '',
    notes: '',
  },
};

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

  const beginEditContact = React.useCallback((id: number) => {
    const contact = contacts.find((v) => v.id === id);
    if (!contact) return;
    setEditingContactId(contact.id);
    setContactForm({ contact_name: contact.contact_name || '', contact_type: ((String(contact.contact_type || '').trim().toLowerCase() === 'payer' ? 'payer' : String(contact.contact_type || '').trim().toLowerCase() === 'repayment' ? 'repayment' : 'payee') as Accumul8ContactType), default_amount: Number(contact.default_amount || 0), email: contact.email || '', phone_number: contact.phone_number || '', street_address: contact.street_address || '', city: contact.city || '', state: contact.state || '', zip: contact.zip || '', notes: contact.notes || '' });
    setContactModalOpen(true);
  }, [contacts, setContactForm, setContactModalOpen, setEditingContactId]);
  const beginEditEntity = React.useCallback((id: number) => {
    const entity = entities.find((v) => v.id === id);
    if (!entity) return;
    setEditingEntityId(entity.id);
    setEntityAliasDraftById((prev) => ({ ...prev, [entity.id]: DEFAULT_ENTITY_ALIAS_DRAFT }));
    setEntityForm({ display_name: entity.display_name || '', entity_kind: normalizeEntityKind(entity.entity_kind, entity.is_vendor), contact_type: normalizeEntityContactType(entity), is_vendor: normalizeEntityKind(entity.entity_kind, entity.is_vendor) === 'business' ? 1 : 0, default_amount: Number(entity.default_amount || 0), email: entity.email || '', phone_number: entity.phone_number || '', street_address: entity.street_address || '', city: entity.city || '', state: entity.state || '', zip: entity.zip || '', notes: entity.notes || '', is_active: Number(entity.is_active || 0) });
    setEntityModalOpen(true);
  }, [DEFAULT_ENTITY_ALIAS_DRAFT, entities, setEditingEntityId, setEntityAliasDraftById, setEntityForm, setEntityModalOpen]);
  const openCreateEntityModal = React.useCallback((defaults?: Partial<EntityFormState>) => { setEditingEntityId(null); setEntityForm({ ...DEFAULT_ENTITY_FORM, ...defaults }); setEntityModalOpen(true); }, [DEFAULT_ENTITY_FORM, setEditingEntityId, setEntityForm, setEntityModalOpen]);
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

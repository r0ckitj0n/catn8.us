import React from 'react';

import {
  Accumul8Contact,
  Accumul8ContactType,
  Accumul8DebtorUpsertRequest,
  Accumul8Entity,
  Accumul8EntityAliasDraft,
  Accumul8EntityUpsertRequest,
  Accumul8RecurringPayment,
  Accumul8RecurringUpsertRequest,
  Accumul8Transaction,
  Accumul8TransactionUpsertRequest,
  Accumul8ContactUpsertRequest,
} from '../../../types/accumul8';
import { createDefaultLedgerForm, RecurringFormState } from './accumul8PageFormUtils';
import { Accumul8EntityFormState } from './useAccumul8EntityContactLaunchActions';

export interface UseAccumul8ModalEditorActionsOptions {
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
  DEFAULT_ENTITY_FORM: Accumul8EntityFormState;
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
  setContactForm: React.Dispatch<React.SetStateAction<{
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
  }>>;
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
  setEntityForm: React.Dispatch<React.SetStateAction<Accumul8EntityFormState>>;
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

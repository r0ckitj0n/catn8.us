import React from 'react';

import { Accumul8ContactType } from '../../../types/accumul8';
import { createDefaultDebtorForm, createDefaultLedgerForm, RecurringFormState } from './accumul8PageFormUtils';

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

interface UseAccumul8ModalResetActionsOptions {
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
  DEFAULT_ENTITY_FORM: EntityFormState;
  DEFAULT_RECURRING_FORM: RecurringFormState;
  selectedBankAccountId: string;
  setBudgetForm: React.Dispatch<React.SetStateAction<{ category_name: string; monthly_budget: number; match_pattern: string; row_order: number; is_active: number }>>;
  setContactForm: React.Dispatch<React.SetStateAction<UseAccumul8ModalResetActionsOptions['DEFAULT_CONTACT_FORM']>>;
  setEditingBudgetRowId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingContactId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingDebtorId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingEntityId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingNotificationRuleId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingRecurringForm: React.Dispatch<React.SetStateAction<RecurringFormState>>;
  setEditingRecurringId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingTransactionId: React.Dispatch<React.SetStateAction<number | null>>;
  setEntityForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  setLedgerForm: React.Dispatch<React.SetStateAction<ReturnType<typeof createDefaultLedgerForm>>>;
  setNotificationForm: React.Dispatch<React.SetStateAction<{ rule_name: string; trigger_type: string; days_before_due: number; target_scope: 'group' | 'custom'; custom_user_ids: string; email_subject_template: string; email_body_template: string }>>;
  setRecurringModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTransactionModalMode: React.Dispatch<React.SetStateAction<'create' | 'edit' | 'view'>>;
  setTransactionModalVariant: React.Dispatch<React.SetStateAction<'ledger' | 'iou'>>;
  setViewingTransactionId: React.Dispatch<React.SetStateAction<number | null>>;
  setDebtorForm: React.Dispatch<React.SetStateAction<{ debtor_name: string; notes: string; is_active: number }>>;
}

export function useAccumul8ModalResetActions({
  DEFAULT_CONTACT_FORM,
  DEFAULT_ENTITY_FORM,
  DEFAULT_RECURRING_FORM,
  selectedBankAccountId,
  setBudgetForm,
  setContactForm,
  setDebtorForm,
  setEditingBudgetRowId,
  setEditingContactId,
  setEditingDebtorId,
  setEditingEntityId,
  setEditingNotificationRuleId,
  setEditingRecurringForm,
  setEditingRecurringId,
  setEditingTransactionId,
  setEntityForm,
  setLedgerForm,
  setNotificationForm,
  setRecurringModalOpen,
  setTransactionModalMode,
  setTransactionModalVariant,
  setViewingTransactionId,
}: UseAccumul8ModalResetActionsOptions) {
  const resetContactForm = React.useCallback(() => { setEditingContactId(null); setContactForm(DEFAULT_CONTACT_FORM); }, [DEFAULT_CONTACT_FORM, setContactForm, setEditingContactId]);
  const resetEntityForm = React.useCallback(() => { setEditingEntityId(null); setEntityForm(DEFAULT_ENTITY_FORM); }, [DEFAULT_ENTITY_FORM, setEditingEntityId, setEntityForm]);
  const resetDebtorForm = React.useCallback(() => { setEditingDebtorId(null); setDebtorForm(createDefaultDebtorForm()); }, [setDebtorForm, setEditingDebtorId]);
  const resetRecurringEditor = React.useCallback(() => { setEditingRecurringId(null); setEditingRecurringForm(DEFAULT_RECURRING_FORM); setRecurringModalOpen(false); }, [DEFAULT_RECURRING_FORM, setEditingRecurringForm, setEditingRecurringId, setRecurringModalOpen]);
  const resetLedgerForm = React.useCallback(() => { setEditingTransactionId(null); setViewingTransactionId(null); setTransactionModalMode('create'); setTransactionModalVariant('ledger'); setLedgerForm(createDefaultLedgerForm({ accountId: selectedBankAccountId })); }, [selectedBankAccountId, setEditingTransactionId, setLedgerForm, setTransactionModalMode, setTransactionModalVariant, setViewingTransactionId]);
  const resetBudgetForm = React.useCallback(() => { setEditingBudgetRowId(null); setBudgetForm({ category_name: '', monthly_budget: 0, match_pattern: '', row_order: 0, is_active: 1 }); }, [setBudgetForm, setEditingBudgetRowId]);
  const resetNotificationForm = React.useCallback(() => { setEditingNotificationRuleId(null); setNotificationForm({ rule_name: '', trigger_type: 'upcoming_due', days_before_due: 3, target_scope: 'group', custom_user_ids: '', email_subject_template: '', email_body_template: '' }); }, [setEditingNotificationRuleId, setNotificationForm]);
  return { resetBudgetForm, resetContactForm, resetDebtorForm, resetEntityForm, resetLedgerForm, resetNotificationForm, resetRecurringEditor };
}

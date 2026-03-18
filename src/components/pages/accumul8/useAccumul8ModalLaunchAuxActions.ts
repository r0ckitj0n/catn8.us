import React from 'react';

import { Accumul8ContactType } from '../../../types/accumul8';
import { createDefaultDebtorForm } from './accumul8PageFormUtils';

interface UseAccumul8ModalLaunchAuxActionsOptions {
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
  notificationRules: Array<{ id: number; rule_name: string; trigger_type: string; days_before_due: number; target_scope: string; custom_user_ids?: number[]; email_subject_template?: string; email_body_template?: string }>;
  setBudgetForm: React.Dispatch<React.SetStateAction<{ category_name: string; monthly_budget: number; match_pattern: string; row_order: number; is_active: number }>>;
  setContactForm: React.Dispatch<React.SetStateAction<UseAccumul8ModalLaunchAuxActionsOptions['DEFAULT_CONTACT_FORM']>>;
  setContactModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDebtorForm: React.Dispatch<React.SetStateAction<{ debtor_name: string; notes: string; is_active: number }>>;
  setDebtorModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingBudgetRowId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingContactId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingDebtorId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingNotificationRuleId: React.Dispatch<React.SetStateAction<number | null>>;
  setNotificationForm: React.Dispatch<React.SetStateAction<{ rule_name: string; trigger_type: string; days_before_due: number; target_scope: 'group' | 'custom'; custom_user_ids: string; email_subject_template: string; email_body_template: string }>>;
}

export function useAccumul8ModalLaunchAuxActions({
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
}: UseAccumul8ModalLaunchAuxActionsOptions) {
  const openCreateContactModal = React.useCallback(() => { setEditingContactId(null); setContactForm(DEFAULT_CONTACT_FORM); setContactModalOpen(true); }, [DEFAULT_CONTACT_FORM, setContactForm, setContactModalOpen, setEditingContactId]);
  const openCreateDebtorModal = React.useCallback(() => { setEditingDebtorId(null); setDebtorForm(createDefaultDebtorForm()); setDebtorModalOpen(true); }, [setDebtorForm, setDebtorModalOpen, setEditingDebtorId]);
  const beginEditBudgetRow = React.useCallback((id: number, budgetRows: Array<{ id: number; category_name: string; monthly_budget: number; match_pattern: string; row_order: number; is_active: number }>) => {
    const row = budgetRows.find((v) => v.id === id);
    if (!row) return;
    setEditingBudgetRowId(row.id);
    setBudgetForm({ category_name: row.category_name || '', monthly_budget: Number(row.monthly_budget || 0), match_pattern: row.match_pattern || '', row_order: Number(row.row_order || 0), is_active: Number(row.is_active || 0) });
  }, [setBudgetForm, setEditingBudgetRowId]);
  const beginEditNotificationRule = React.useCallback((id: number) => {
    const rule = notificationRules.find((v) => v.id === id);
    if (!rule) return;
    setEditingNotificationRuleId(rule.id);
    setNotificationForm({ rule_name: rule.rule_name || '', trigger_type: rule.trigger_type || 'upcoming_due', days_before_due: Number(rule.days_before_due || 0), target_scope: rule.target_scope === 'custom' ? 'custom' : 'group', custom_user_ids: Array.isArray(rule.custom_user_ids) ? rule.custom_user_ids.join(',') : '', email_subject_template: rule.email_subject_template || '', email_body_template: rule.email_body_template || '' });
  }, [notificationRules, setEditingNotificationRuleId, setNotificationForm]);
  return { beginEditBudgetRow, beginEditNotificationRule, openCreateContactModal, openCreateDebtorModal };
}

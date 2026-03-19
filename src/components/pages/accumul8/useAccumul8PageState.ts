import React from 'react';

import { Accumul8EntityAliasDraft, Accumul8MessageBoardMessage } from '../../../types/accumul8';
import { DebtorFormState, LedgerFormState, LedgerInlineDraft, RecurringFormState, createDefaultDebtorForm, createDefaultLedgerForm } from './accumul8PageFormUtils';
import { DEFAULT_CONTACT_FORM, DEFAULT_ENTITY_FORM, DEFAULT_RECURRING_FORM, SUMMARY_WINDOW_OPTIONS } from './accumul8PageDefaults';
import { DebtorInlineDraft, EntityInlineDraft, RecurringInlineDraft } from './useAccumul8InlineRowActions';
import { useAccumul8PageUiState } from './useAccumul8PageUiState';
import { Accumul8SyncReport, DateRangeFilter, EntityFormState, LedgerFilterPreset, LedgerPaginationMode, SearchableListTabKey, TabKey } from './accumul8PageTypes';

type SummaryWindowOption = typeof SUMMARY_WINDOW_OPTIONS[number];

export function useAccumul8PageState(session: any, onToast?: (toast: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void) {
  const [tab, setTab] = React.useState<TabKey>('ledger');
  const [entityForm, setEntityForm] = React.useState<EntityFormState>(DEFAULT_ENTITY_FORM);
  const [contactForm, setContactForm] = React.useState(DEFAULT_CONTACT_FORM);
  const [debtorForm, setDebtorForm] = React.useState<DebtorFormState>(createDefaultDebtorForm);
  const [ledgerForm, setLedgerForm] = React.useState<LedgerFormState>(createDefaultLedgerForm);
  const [budgetForm, setBudgetForm] = React.useState({ category_name: '', monthly_budget: 0, match_pattern: '', row_order: 0, is_active: 1 });
  const [budgetMonth, setBudgetMonth] = React.useState<string>(new Date().toISOString().slice(0, 7));
  const [ledgerDateFilter, setLedgerDateFilter] = React.useState<DateRangeFilter>('all_dates');
  const [customLedgerStartDate, setCustomLedgerStartDate] = React.useState<string>('');
  const [customLedgerEndDate, setCustomLedgerEndDate] = React.useState<string>('');
  const [ledgerArchivePage, setLedgerArchivePage] = React.useState<number>(1);
  const [ledgerPaginationMode, setLedgerPaginationMode] = React.useState<LedgerPaginationMode>('100');
  const [lastSyncReport, setLastSyncReport] = React.useState<Accumul8SyncReport | null>(null);
  const [syncingConnectionId, setSyncingConnectionId] = React.useState<number | null>(null);
  const [payBillsDateFilter, setPayBillsDateFilter] = React.useState<DateRangeFilter>('30_days');
  const [customPayBillsStartDate, setCustomPayBillsStartDate] = React.useState<string>('');
  const [customPayBillsEndDate, setCustomPayBillsEndDate] = React.useState<string>('');
  const [notificationForm, setNotificationForm] = React.useState({ rule_name: '', trigger_type: 'upcoming_due', days_before_due: 3, target_scope: 'group' as 'group' | 'custom', custom_user_ids: '', email_subject_template: '', email_body_template: '' });
  const [editingContactId, setEditingContactId] = React.useState<number | null>(null);
  const [editingEntityId, setEditingEntityId] = React.useState<number | null>(null);
  const [editingDebtorId, setEditingDebtorId] = React.useState<number | null>(null);
  const [editingRecurringId, setEditingRecurringId] = React.useState<number | null>(null);
  const [editingRecurringForm, setEditingRecurringForm] = React.useState<RecurringFormState>(DEFAULT_RECURRING_FORM);
  const [editingTransactionId, setEditingTransactionId] = React.useState<number | null>(null);
  const [viewingTransactionId, setViewingTransactionId] = React.useState<number | null>(null);
  const [editingBudgetRowId, setEditingBudgetRowId] = React.useState<number | null>(null);
  const [editingNotificationRuleId, setEditingNotificationRuleId] = React.useState<number | null>(null);
  const [entityAliasDraftById, setEntityAliasDraftById] = React.useState<Record<number, Accumul8EntityAliasDraft>>({});
  const [activeLedgerRowId, setActiveLedgerRowId] = React.useState<number | null>(null);
  const [activePayBillRowId, setActivePayBillRowId] = React.useState<number | null>(null);
  const [activeDebtorRowId, setActiveDebtorRowId] = React.useState<number | null>(null);
  const [activeEntityRowId, setActiveEntityRowId] = React.useState<number | null>(null);
  const [activeRecurringRowId, setActiveRecurringRowId] = React.useState<number | null>(null);
  const [ledgerDraftById, setLedgerDraftById] = React.useState<Record<number, LedgerInlineDraft>>({});
  const [payBillDraftById, setPayBillDraftById] = React.useState<Record<number, LedgerInlineDraft>>({});
  const [debtorDraftById, setDebtorDraftById] = React.useState<Record<number, DebtorInlineDraft>>({});
  const [entityDraftById, setEntityDraftById] = React.useState<Record<number, EntityInlineDraft>>({});
  const [recurringDraftById, setRecurringDraftById] = React.useState<Record<number, RecurringInlineDraft>>({});

  return {
    activeDebtorRowId, activeEntityRowId, activeLedgerRowId, activePayBillRowId, activeRecurringRowId, budgetForm, budgetMonth,
    contactForm, customLedgerEndDate, customLedgerStartDate, customPayBillsEndDate, customPayBillsStartDate, debtorDraftById, debtorForm,
    editingBudgetRowId, editingContactId, editingDebtorId, editingEntityId, editingNotificationRuleId, editingRecurringForm, editingRecurringId,
    editingTransactionId, entityAliasDraftById, entityDraftById, entityForm, lastSyncReport, ledgerArchivePage, ledgerDateFilter, ledgerDraftById,
    ledgerForm, ledgerPaginationMode, notificationForm, payBillsDateFilter, payBillDraftById, recurringDraftById, setActiveDebtorRowId,
    setActiveEntityRowId, setActiveLedgerRowId, setActivePayBillRowId, setActiveRecurringRowId, setBudgetForm, setBudgetMonth, setContactForm,
    setCustomLedgerEndDate, setCustomLedgerStartDate, setCustomPayBillsEndDate, setCustomPayBillsStartDate, setDebtorDraftById, setDebtorForm,
    setEditingBudgetRowId, setEditingContactId, setEditingDebtorId, setEditingEntityId, setEditingNotificationRuleId, setEditingRecurringForm,
    setEditingRecurringId, setEditingTransactionId, setEntityAliasDraftById, setEntityDraftById, setEntityForm, setLastSyncReport,
    setLedgerArchivePage, setLedgerDateFilter, setLedgerDraftById, setLedgerForm, setLedgerPaginationMode, setNotificationForm, setPayBillsDateFilter,
    setPayBillDraftById, setRecurringDraftById, setSyncingConnectionId, setTab, setViewingTransactionId, syncingConnectionId, tab, viewingTransactionId,
    ...useAccumul8PageUiState({
      activeOwnerUserId: session.activeOwnerUserId,
      bankingOrganizations: session.bankingOrganizations,
      busy: session.busy,
      initialLedgerFilterPreset: 'all' as LedgerFilterPreset,
      initialListSearchQueryByTab: { ledger: '', debtors: '', pay_bills: '', contacts: '', recurring: '' } as Record<SearchableListTabKey, string>,
      initialMessageBoardMessages: [] as Accumul8MessageBoardMessage[],
      initialSummaryWindow: 90 as SummaryWindowOption,
      onToast,
      ownerStorageKey: session.ACCUMUL8_OWNER_STORAGE_KEY,
      selectedOwnerUserId: session.selectedOwnerUserId,
      setSelectedOwnerUserId: session.setSelectedOwnerUserId,
      syncingConnectionId,
    }),
  };
}

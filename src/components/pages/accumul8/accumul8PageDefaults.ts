import { Accumul8ContactType, Accumul8EntityAliasDraft } from '../../../types/accumul8';
import { RecurringFormState } from './accumul8PageFormUtils';
import { DateRangeFilter, EntityFormState, LedgerFilterPreset } from './accumul8PageTypes';

export const ACCUMUL8_OWNER_STORAGE_KEY = 'accumul8.selected_owner_user_id';

export const LEDGER_FILTER_PRESET_OPTIONS: Array<{ value: LedgerFilterPreset; label: string }> = [
  { value: 'all', label: 'All transactions' },
  { value: 'planning', label: 'Planning' },
  { value: 'hide_upcoming_recurring', label: 'Hide upcoming recurring payments' },
  { value: 'hide_reconciled', label: 'Hide reconciled transactions' },
  { value: 'hide_paid', label: 'Hide paid transactions' },
  { value: 'hide_pending_bank', label: 'Hide pending bank transactions' },
  { value: 'show_late_payments', label: 'Show late payments' },
  { value: 'show_paid_not_reconciled', label: 'Show paid, not reconciled' },
  { value: 'show_reconciled_not_paid', label: 'Show reconciled, not paid' },
  { value: 'show_unpaid_only', label: 'Show unpaid only' },
  { value: 'show_upcoming_unpaid', label: 'Show upcoming unpaid' },
];

export const DEFAULT_CONTACT_FORM = {
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
};

export const DEFAULT_RECURRING_FORM: RecurringFormState = {
  title: '',
  direction: 'outflow',
  amount: 0,
  frequency: 'monthly',
  payment_method: 'unspecified',
  interval_count: 1,
  next_due_date: '',
  entity_id: '',
  account_id: '',
  is_budget_planner: 1,
  notes: '',
};

export const DEFAULT_ENTITY_FORM: EntityFormState = {
  display_name: '',
  entity_kind: 'business',
  contact_type: 'payee',
  is_vendor: 0,
  default_amount: 0,
  email: '',
  phone_number: '',
  street_address: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
  is_active: 1,
};

export const DEFAULT_ENTITY_ALIAS_DRAFT: Accumul8EntityAliasDraft = {
  alias_name: '',
  merge_entity_id: null,
  pending_alias_names: [],
};

export const DATE_RANGE_FILTER_OPTIONS: Array<{ value: Exclude<DateRangeFilter, 'all_dates'>; label: string }> = [
  { value: '7_days', label: '7 Days' },
  { value: '30_days', label: '30 Days' },
  { value: '60_days', label: '60 Days' },
  { value: '90_days', label: '90 Days' },
  { value: 'eoy', label: 'EOY' },
  { value: 'custom', label: 'Custom' },
];

export const SUMMARY_WINDOW_OPTIONS = ['current', 7, 30, 60, 90] as const;

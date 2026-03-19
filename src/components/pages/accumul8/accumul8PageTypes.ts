import { Accumul8ContactType, Accumul8TellerSyncResponse } from '../../../types/accumul8';

export type TabKey = 'aicountant' | 'ledger' | 'calendar' | 'spreadsheet' | 'debtors' | 'pay_bills' | 'contacts' | 'entity_endex' | 'recurring' | 'notifications' | 'sync' | 'statements';

export type SearchableListTabKey = 'ledger' | 'debtors' | 'pay_bills' | 'contacts' | 'recurring';

export type LedgerFilterPreset =
  | 'all'
  | 'planning'
  | 'hide_upcoming_recurring'
  | 'hide_reconciled'
  | 'hide_paid'
  | 'hide_pending_bank'
  | 'show_late_payments'
  | 'show_paid_not_reconciled'
  | 'show_reconciled_not_paid'
  | 'show_unpaid_only'
  | 'show_upcoming_unpaid';

export type Accumul8HeaderSummary = {
  currentBalance: number;
  unpaidBills: number;
  windfalls: number;
};

export type Accumul8SyncReport = {
  connectionId: number;
  institutionName: string;
  syncedAt: string;
  result: Accumul8TellerSyncResponse;
};

export type EntityFormState = {
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

export type DateRangeFilter = 'all_dates' | '7_days' | '30_days' | '60_days' | '90_days' | 'eoy' | 'custom';

export type LedgerPaginationMode = '100' | 'all';

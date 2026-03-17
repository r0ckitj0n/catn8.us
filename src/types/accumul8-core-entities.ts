import type { Accumul8ContactType } from './accumul8-core';

export interface Accumul8Debtor {
  id: number;
  entity_id: number | null;
  entity_name: string;
  contact_id: number | null;
  debtor_name: string;
  notes: string;
  is_active: number;
  total_loaned: number;
  total_repaid: number;
  outstanding_balance: number;
  transaction_count: number;
  last_activity_date: string;
  contact_name: string;
}

export interface Accumul8Entity {
  id: number;
  owner_user_id: number;
  display_name: string;
  entity_kind: string;
  contact_type: Accumul8ContactType;
  is_payee: number;
  is_payer: number;
  is_vendor: number;
  is_balance_person: number;
  default_amount: number;
  email: string;
  phone_number: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  is_active: number;
  legacy_contact_id: number | null;
  legacy_debtor_id: number | null;
  contact_id: number | null;
  debtor_id: number | null;
  contact_name: string;
  debtor_name: string;
  aliases: Accumul8EntityAlias[];
}

export interface Accumul8EntityAlias {
  id: number;
  entity_id: number;
  alias_name: string;
}

export interface Accumul8EntityEndexGuide {
  id: number;
  parent_entity_id: number | null;
  parent_name: string;
  match_rule: string;
  examples: string[];
  match_fragments: string[];
  match_contains: string[];
  is_active: number;
}

export interface Accumul8EntityEndexGuideUpsertRequest {
  parent_name: string;
  parent_entity_id?: number | null;
  match_rule?: string;
  examples: string[];
  match_fragments: string[];
  match_contains: string[];
  is_active?: number;
}

export interface Accumul8EntityAliasDraft {
  alias_name: string;
  merge_entity_id: number | null;
  pending_alias_names: string[];
}

export interface Accumul8EntityUpsertRequest {
  display_name: string;
  entity_kind?: string;
  contact_type: Accumul8ContactType;
  is_payee?: number;
  is_payer?: number;
  is_vendor?: number;
  is_balance_person?: number;
  default_amount?: number;
  email?: string;
  phone_number?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  is_active?: number;
}

export interface Accumul8EntityAliasUpsertRequest {
  entity_id: number;
  alias_name: string;
  merge_entity_id?: number | null;
}

export interface Accumul8EntityAliasScanRequest {
  entity_id: number;
}

export interface Accumul8EntityAliasScanResponse {
  success: boolean;
  entity_id: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  conflict_count: number;
  reviewed_count: number;
  approved_count: number;
  rejected_count: number;
  protected_skip_count: number;
  alias_names: string[];
}

export interface Accumul8IdResponse {
  success: boolean;
  id: number;
}

export interface Accumul8EntityAliasGlobalScanResponse {
  success: boolean;
  scanned_entity_count: number;
  touched_entity_count: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  conflict_count: number;
  reviewed_count: number;
  approved_count: number;
  rejected_count: number;
  protected_skip_count: number;
}

export interface Accumul8EntityEndexScanLogItem {
  parent_entity_id: number;
  parent_name: string;
  alias_name: string;
  status: 'created' | 'updated';
}

export interface Accumul8EntityEndexScanLog {
  id: number;
  scanned_entity_count: number;
  touched_entity_count: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  conflict_count: number;
  summary_text: string;
  items: Accumul8EntityEndexScanLogItem[];
  created_at: string;
}

export interface Accumul8DebtorUpsertRequest {
  debtor_name: string;
  contact_id?: number | null;
  notes?: string;
  is_active?: number;
}

export interface Accumul8BudgetRow {
  id: number;
  row_order: number;
  category_name: string;
  monthly_budget: number;
  match_pattern: string;
  is_active: number;
}

export interface Accumul8BudgetRowUpsertRequest {
  category_name: string;
  monthly_budget: number;
  match_pattern?: string;
  row_order?: number;
  is_active?: number;
}

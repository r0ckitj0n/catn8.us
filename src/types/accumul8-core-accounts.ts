export interface Accumul8BankingOrganization {
  id: number;
  banking_organization_name: string;
  institution_name: string;
  website_url: string;
  login_url: string;
  support_url: string;
  support_phone: string;
  support_email: string;
  routing_number: string;
  mailing_address: string;
  icon_path: string;
  access_group_id: number | null;
  access_group_slug: string;
  access_group_title: string;
  notes: string;
  is_active: number;
}

export interface Accumul8BankingOrganizationUpsertRequest {
  banking_organization_name: string;
  institution_name?: string;
  website_url?: string;
  login_url?: string;
  support_url?: string;
  support_phone?: string;
  support_email?: string;
  routing_number?: string;
  mailing_address?: string;
  icon_path?: string;
  access_group_id?: number | null;
  notes?: string;
  is_active?: number;
}

export interface Accumul8Account {
  id: number;
  banking_organization_id: number | null;
  bank_connection_id: number | null;
  provider_name: string;
  teller_account_id: string;
  teller_enrollment_id: string;
  account_name: string;
  account_nickname: string;
  banking_organization_name: string;
  account_type: string;
  account_subtype: string;
  institution_name: string;
  account_number_mask: string;
  mask_last4: string;
  routing_number: string;
  currency_code: string;
  teller_sync_anchor_date: string;
  teller_backfill_cursor_id: string;
  teller_backfill_complete: number;
  teller_history_start_date: string;
  teller_history_end_date: string;
  statement_day_of_month: number | null;
  payment_due_day_of_month: number | null;
  autopay_enabled: number;
  credit_limit: number;
  interest_rate: number;
  minimum_payment: number;
  opened_on: string;
  closed_on: string;
  notes: string;
  current_balance: number;
  available_balance: number;
  is_active: number;
}

export interface Accumul8AccountUpsertRequest {
  banking_organization_id?: number | null;
  account_name: string;
  account_nickname?: string;
  account_type?: string;
  account_subtype?: string;
  institution_name?: string;
  account_number_mask?: string;
  mask_last4?: string;
  routing_number?: string;
  currency_code?: string;
  statement_day_of_month?: number | null;
  payment_due_day_of_month?: number | null;
  autopay_enabled?: number;
  credit_limit?: number;
  interest_rate?: number;
  minimum_payment?: number;
  opened_on?: string | null;
  closed_on?: string | null;
  notes?: string;
  is_active?: number;
}

export interface Accumul8AccountDeleteRequest {
  id: number;
  delete_associated_records?: number;
}

export interface Accumul8AccessibleOwner {
  owner_user_id: number;
  username: string;
  email: string;
  is_self: number;
}

export interface Accumul8AccessUser {
  id: number;
  username: string;
  email: string;
  is_active: number;
}

export interface Accumul8AccessGrant {
  id: number;
  grantee_user_id: number;
  owner_user_id: number;
  granted_by_user_id: number | null;
  grantee_username: string;
  grantee_email: string;
  owner_username: string;
  owner_email: string;
  granted_by_username: string;
  created_at: string;
  updated_at: string;
}

export interface Accumul8AccessListResponse {
  success: boolean;
  users: Accumul8AccessUser[];
  grants: Accumul8AccessGrant[];
}

export interface Accumul8NotificationRule {
  id: number;
  rule_name: string;
  trigger_type: string;
  days_before_due: number;
  target_scope: 'group' | 'custom';
  custom_user_ids: number[];
  email_subject_template: string;
  email_body_template: string;
  is_active: number;
  last_triggered_at: string;
}

export interface Accumul8NotificationRuleUpsertRequest {
  rule_name: string;
  trigger_type: string;
  days_before_due: number;
  target_scope: 'group' | 'custom';
  custom_user_ids: number[];
  email_subject_template: string;
  email_body_template: string;
}

export interface Accumul8BillItem {
  id: number;
  transaction_date: string;
  due_date: string;
  paid_date: string;
  description: string;
  amount: number;
  is_paid: number;
  source_kind: string;
}

export interface Accumul8BankConnection {
  id: number;
  provider_name: string;
  institution_id: string;
  institution_name: string;
  teller_enrollment_id: string;
  teller_user_id: string;
  status: string;
  last_sync_at: string;
  last_error: string;
}

export interface Accumul8BankConnectionUpsertRequest {
  provider_name?: string;
  institution_id?: string;
  institution_name?: string;
  teller_enrollment_id?: string;
  teller_user_id?: string;
  status?: string;
}

export interface Accumul8BankConnectionDeleteRequest {
  id: number;
}

export interface Accumul8Summary {
  net_amount: number;
  inflow_total: number;
  outflow_total: number;
  unpaid_outflow_total: number;
}

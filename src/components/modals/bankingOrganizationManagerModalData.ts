import {
  Accumul8Account,
  Accumul8AccountUpsertRequest,
  Accumul8BankingOrganization,
  Accumul8BankingOrganizationUpsertRequest,
} from '../../types/accumul8';

export const DEFAULT_BANKING_ORGANIZATION_FORM: Accumul8BankingOrganizationUpsertRequest = {
  banking_organization_name: '',
  institution_name: '',
  website_url: '',
  login_url: '',
  support_url: '',
  support_phone: '',
  support_email: '',
  routing_number: '',
  mailing_address: '',
  icon_path: '',
  access_group_id: null,
  notes: '',
  is_active: 1,
};

export const DEFAULT_ACCOUNT_FORM: Accumul8AccountUpsertRequest = {
  banking_organization_id: null,
  account_name: '',
  account_nickname: '',
  account_type: 'checking',
  account_subtype: '',
  institution_name: '',
  account_number_mask: '',
  mask_last4: '',
  routing_number: '',
  currency_code: 'USD',
  statement_day_of_month: null,
  payment_due_day_of_month: null,
  autopay_enabled: 0,
  credit_limit: 0,
  interest_rate: 0,
  minimum_payment: 0,
  opened_on: '',
  closed_on: '',
  notes: '',
  is_active: 1,
};

export function toBankingOrganizationPayload(form: Accumul8BankingOrganizationUpsertRequest): Accumul8BankingOrganizationUpsertRequest {
  return {
    banking_organization_name: String(form.banking_organization_name || '').trim(),
    institution_name: String(form.institution_name || '').trim(),
    website_url: String(form.website_url || '').trim(),
    login_url: String(form.login_url || '').trim(),
    support_url: String(form.support_url || '').trim(),
    support_phone: String(form.support_phone || '').trim(),
    support_email: String(form.support_email || '').trim(),
    routing_number: String(form.routing_number || '').trim(),
    mailing_address: String(form.mailing_address || '').trim(),
    icon_path: String(form.icon_path || '').trim(),
    access_group_id: Number(form.access_group_id || 0) > 0 ? Number(form.access_group_id) : null,
    notes: String(form.notes || '').trim(),
    is_active: Number(form.is_active || 0) ? 1 : 0,
  };
}

export function toAccountPayload(form: Accumul8AccountUpsertRequest): Accumul8AccountUpsertRequest {
  return {
    banking_organization_id: Number(form.banking_organization_id || 0) > 0 ? Number(form.banking_organization_id) : null,
    account_name: String(form.account_name || '').trim(),
    account_nickname: String(form.account_nickname || '').trim(),
    account_type: String(form.account_type || 'checking').trim().toLowerCase(),
    account_subtype: String(form.account_subtype || '').trim(),
    institution_name: String(form.institution_name || '').trim(),
    account_number_mask: String(form.account_number_mask || '').trim(),
    mask_last4: String(form.mask_last4 || '').trim(),
    routing_number: String(form.routing_number || '').trim(),
    currency_code: String(form.currency_code || 'USD').trim().toUpperCase(),
    statement_day_of_month: Number(form.statement_day_of_month || 0) > 0 ? Number(form.statement_day_of_month) : null,
    payment_due_day_of_month: Number(form.payment_due_day_of_month || 0) > 0 ? Number(form.payment_due_day_of_month) : null,
    autopay_enabled: Number(form.autopay_enabled || 0) ? 1 : 0,
    credit_limit: Number(form.credit_limit || 0),
    interest_rate: Number(form.interest_rate || 0),
    minimum_payment: Number(form.minimum_payment || 0),
    opened_on: String(form.opened_on || '').trim() || null,
    closed_on: String(form.closed_on || '').trim() || null,
    notes: String(form.notes || '').trim(),
    is_active: Number(form.is_active || 0) ? 1 : 0,
  };
}

export function toBankingOrganizationForm(bankingOrganization: Accumul8BankingOrganization): Accumul8BankingOrganizationUpsertRequest {
  return {
    banking_organization_name: bankingOrganization.banking_organization_name || '',
    institution_name: bankingOrganization.institution_name || '',
    website_url: bankingOrganization.website_url || '',
    login_url: bankingOrganization.login_url || '',
    support_url: bankingOrganization.support_url || '',
    support_phone: bankingOrganization.support_phone || '',
    support_email: bankingOrganization.support_email || '',
    routing_number: bankingOrganization.routing_number || '',
    mailing_address: bankingOrganization.mailing_address || '',
    icon_path: bankingOrganization.icon_path || '',
    access_group_id: bankingOrganization.access_group_id ?? null,
    notes: bankingOrganization.notes || '',
    is_active: Number(bankingOrganization.is_active || 0),
  };
}

export function toAccountForm(account: Accumul8Account): Accumul8AccountUpsertRequest {
  return {
    banking_organization_id: account.banking_organization_id ?? null,
    account_name: account.account_name || '',
    account_nickname: account.account_nickname || '',
    account_type: account.account_type || 'checking',
    account_subtype: account.account_subtype || '',
    institution_name: account.institution_name || '',
    account_number_mask: account.account_number_mask || '',
    mask_last4: account.mask_last4 || '',
    routing_number: account.routing_number || '',
    currency_code: account.currency_code || 'USD',
    statement_day_of_month: account.statement_day_of_month ?? null,
    payment_due_day_of_month: account.payment_due_day_of_month ?? null,
    autopay_enabled: Number(account.autopay_enabled || 0),
    credit_limit: Number(account.credit_limit || 0),
    interest_rate: Number(account.interest_rate || 0),
    minimum_payment: Number(account.minimum_payment || 0),
    opened_on: account.opened_on || '',
    closed_on: account.closed_on || '',
    notes: account.notes || '',
    is_active: Number(account.is_active || 0),
  };
}

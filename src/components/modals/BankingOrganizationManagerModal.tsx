import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { useBrandedConfirm } from '../../hooks/useBrandedConfirm';
import {
  Accumul8Account,
  Accumul8BankingOrganization,
  Accumul8BankingOrganizationUpsertRequest,
  Accumul8AccountUpsertRequest,
} from '../../types/accumul8';
import { getAccumul8AccountDisplayName } from '../../utils/accumul8Accounts';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';

type Mode = 'banking_organization' | 'account';

interface BankingOrganizationManagerModalProps {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  busy: boolean;
  bankingOrganizations: Accumul8BankingOrganization[];
  accounts: Accumul8Account[];
  createBankingOrganization: (form: Accumul8BankingOrganizationUpsertRequest) => Promise<void>;
  updateBankingOrganization: (id: number, form: Accumul8BankingOrganizationUpsertRequest) => Promise<void>;
  deleteBankingOrganization: (id: number) => Promise<void>;
  createAccount: (form: Accumul8AccountUpsertRequest) => Promise<void>;
  updateAccount: (id: number, form: Accumul8AccountUpsertRequest) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;
}

const DEFAULT_BANKING_ORGANIZATION_FORM: Accumul8BankingOrganizationUpsertRequest = {
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
  notes: '',
  is_active: 1,
};

const DEFAULT_ACCOUNT_FORM: Accumul8AccountUpsertRequest = {
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

export function BankingOrganizationManagerModal({
  open,
  onClose,
  mode,
  busy,
  bankingOrganizations,
  accounts,
  createBankingOrganization,
  updateBankingOrganization,
  deleteBankingOrganization,
  createAccount,
  updateAccount,
  deleteAccount,
}: BankingOrganizationManagerModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const { confirm, confirmDialog } = useBrandedConfirm();
  const [editingBankingOrganizationId, setEditingBankingOrganizationId] = React.useState<number | null>(null);
  const [editingAccountId, setEditingAccountId] = React.useState<number | null>(null);
  const [bankingOrganizationForm, setBankingOrganizationForm] = React.useState<Accumul8BankingOrganizationUpsertRequest>(DEFAULT_BANKING_ORGANIZATION_FORM);
  const [accountForm, setAccountForm] = React.useState<Accumul8AccountUpsertRequest>(DEFAULT_ACCOUNT_FORM);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [modalApiRef, open]);

  React.useEffect(() => {
    if (!open) {
      setEditingBankingOrganizationId(null);
      setEditingAccountId(null);
      setBankingOrganizationForm(DEFAULT_BANKING_ORGANIZATION_FORM);
      setAccountForm(DEFAULT_ACCOUNT_FORM);
    }
  }, [open]);

  const resetBankingOrganizationForm = React.useCallback(() => {
    setEditingBankingOrganizationId(null);
    setBankingOrganizationForm(DEFAULT_BANKING_ORGANIZATION_FORM);
  }, []);

  const resetAccountForm = React.useCallback(() => {
    setEditingAccountId(null);
    setAccountForm(DEFAULT_ACCOUNT_FORM);
  }, []);

  const title = mode === 'banking_organization' ? 'Manage Banking Organizations' : 'Manage Bank Accounts';
  const visibleBankingOrganizations = React.useMemo(
    () => [...bankingOrganizations].sort((a, b) => a.banking_organization_name.localeCompare(b.banking_organization_name) || a.id - b.id),
    [bankingOrganizations],
  );
  const visibleAccounts = React.useMemo(
    () => [...accounts].sort((a, b) => getAccumul8AccountDisplayName(a).localeCompare(getAccumul8AccountDisplayName(b)) || a.id - b.id),
    [accounts],
  );

  const handleBankingOrganizationDelete = React.useCallback(async (bankingOrganization: Accumul8BankingOrganization) => {
    const confirmed = await confirm({
      title: 'Delete Banking Organization?',
      message: `Delete "${bankingOrganization.banking_organization_name}"? This will be blocked if bank accounts are still attached.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    await deleteBankingOrganization(bankingOrganization.id);
    resetBankingOrganizationForm();
  }, [confirm, deleteBankingOrganization, resetBankingOrganizationForm]);

  const handleAccountDelete = React.useCallback(async (account: Accumul8Account) => {
    const confirmed = await confirm({
      title: 'Delete Bank Account?',
      message: `Delete "${getAccumul8AccountDisplayName(account)}"? This will be blocked if ledger or recurring records exist.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    await deleteAccount(account.id);
    resetAccountForm();
  }, [confirm, deleteAccount, resetAccountForm]);

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <ModalCloseIconButton />
          </div>
          <div className="modal-body">
            {mode === 'banking_organization' ? (
              <>
                <p className="text-muted small mb-3">Create, rename, disable, or remove banking organizations. Deletion is blocked while bank accounts still belong to the organization.</p>
                <form
                  className="row g-2 mb-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const payload: Accumul8BankingOrganizationUpsertRequest = {
                      banking_organization_name: String(bankingOrganizationForm.banking_organization_name || '').trim(),
                      institution_name: String(bankingOrganizationForm.institution_name || '').trim(),
                      website_url: String(bankingOrganizationForm.website_url || '').trim(),
                      login_url: String(bankingOrganizationForm.login_url || '').trim(),
                      support_url: String(bankingOrganizationForm.support_url || '').trim(),
                      support_phone: String(bankingOrganizationForm.support_phone || '').trim(),
                      support_email: String(bankingOrganizationForm.support_email || '').trim(),
                      routing_number: String(bankingOrganizationForm.routing_number || '').trim(),
                      mailing_address: String(bankingOrganizationForm.mailing_address || '').trim(),
                      icon_path: String(bankingOrganizationForm.icon_path || '').trim(),
                      notes: String(bankingOrganizationForm.notes || '').trim(),
                      is_active: Number(bankingOrganizationForm.is_active || 0) ? 1 : 0,
                    };
                    if (editingBankingOrganizationId) {
                      void updateBankingOrganization(editingBankingOrganizationId, payload).then(() => resetBankingOrganizationForm());
                      return;
                    }
                    void createBankingOrganization(payload).then(() => resetBankingOrganizationForm());
                  }}
                >
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="accumul8-banking-organization-name">Banking organization name</label>
                    <input
                      id="accumul8-banking-organization-name"
                      className="form-control"
                      value={bankingOrganizationForm.banking_organization_name || ''}
                      onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, banking_organization_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="accumul8-banking-organization-institution">Institution</label>
                    <input
                      id="accumul8-banking-organization-institution"
                      className="form-control"
                      value={bankingOrganizationForm.institution_name || ''}
                      onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, institution_name: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="accumul8-banking-organization-active">Status</label>
                    <select
                      id="accumul8-banking-organization-active"
                      className="form-select"
                      value={String(Number(bankingOrganizationForm.is_active || 0))}
                      onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, is_active: Number(e.target.value) }))}
                    >
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </select>
                  </div>
                  <div className="col-md-2 d-grid">
                    <label className="form-label invisible">Save</label>
                    <button type="submit" className="btn btn-success" disabled={busy}>{editingBankingOrganizationId ? 'Update' : 'Add'}</button>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="accumul8-banking-organization-website-url">Website URL</label>
                    <input
                      id="accumul8-banking-organization-website-url"
                      className="form-control"
                      type="url"
                      placeholder="https://www.example.com"
                      value={bankingOrganizationForm.website_url || ''}
                      onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, website_url: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="accumul8-banking-organization-login-url">Login URL</label>
                    <input
                      id="accumul8-banking-organization-login-url"
                      className="form-control"
                      type="url"
                      placeholder="https://example.com/sign-in"
                      value={bankingOrganizationForm.login_url || ''}
                      onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, login_url: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="accumul8-banking-organization-support-url">Support URL</label>
                    <input
                      id="accumul8-banking-organization-support-url"
                      className="form-control"
                      type="url"
                      placeholder="https://example.com/support"
                      value={bankingOrganizationForm.support_url || ''}
                      onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, support_url: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="accumul8-banking-organization-support-phone">Support phone</label>
                    <input
                      id="accumul8-banking-organization-support-phone"
                      className="form-control"
                      value={bankingOrganizationForm.support_phone || ''}
                      onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, support_phone: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="accumul8-banking-organization-support-email">Support email</label>
                    <input
                      id="accumul8-banking-organization-support-email"
                      className="form-control"
                      type="email"
                      value={bankingOrganizationForm.support_email || ''}
                      onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, support_email: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="accumul8-banking-organization-routing-number">Routing number</label>
                    <input
                      id="accumul8-banking-organization-routing-number"
                      className="form-control"
                      value={bankingOrganizationForm.routing_number || ''}
                      onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, routing_number: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="accumul8-banking-organization-icon-path">Icon asset path</label>
                    <input
                      id="accumul8-banking-organization-icon-path"
                      className="form-control"
                      placeholder="/images/bank-organizations/example-1024.png"
                      value={bankingOrganizationForm.icon_path || ''}
                      onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, icon_path: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-9">
                    <label className="form-label" htmlFor="accumul8-banking-organization-mailing-address">Mailing address</label>
                    <input
                      id="accumul8-banking-organization-mailing-address"
                      className="form-control"
                      value={bankingOrganizationForm.mailing_address || ''}
                      onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, mailing_address: e.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="accumul8-banking-organization-notes">Notes</label>
                    <textarea
                      id="accumul8-banking-organization-notes"
                      className="form-control"
                      rows={2}
                      value={bankingOrganizationForm.notes || ''}
                      onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                  {editingBankingOrganizationId ? (
                    <div className="col-md-2 d-grid">
                      <button type="button" className="btn btn-outline-secondary" onClick={resetBankingOrganizationForm} disabled={busy}>Cancel</button>
                    </div>
                  ) : null}
                </form>
                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Institution</th>
                        <th>Web / Launch</th>
                        <th>Support</th>
                        <th>Status</th>
                        <th>Notes</th>
                        <th className="text-end catn8-actions-column">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleBankingOrganizations.map((bankingOrganization) => (
                        <tr key={bankingOrganization.id}>
                          <td>{bankingOrganization.banking_organization_name}</td>
                          <td>{bankingOrganization.institution_name || '-'}</td>
                          <td>
                            <div>{bankingOrganization.website_url || '-'}</div>
                            <div>{bankingOrganization.login_url || '-'}</div>
                            <div className="small text-muted">{bankingOrganization.icon_path || 'No icon asset'}</div>
                          </td>
                          <td>
                            <div>{bankingOrganization.support_phone || bankingOrganization.support_email || '-'}</div>
                            <div className="small text-muted">{bankingOrganization.support_url || bankingOrganization.routing_number || bankingOrganization.mailing_address || '-'}</div>
                          </td>
                          <td>{bankingOrganization.is_active ? 'Active' : 'Inactive'}</td>
                          <td>{bankingOrganization.notes || '-'}</td>
                          <td className="text-end catn8-actions-column">
                            <div className="d-inline-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => {
                                  setEditingBankingOrganizationId(bankingOrganization.id);
                                  setBankingOrganizationForm({
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
                                    notes: bankingOrganization.notes || '',
                                    is_active: Number(bankingOrganization.is_active || 0),
                                  });
                                }}
                                disabled={busy}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => void handleBankingOrganizationDelete(bankingOrganization)}
                                disabled={busy}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {visibleBankingOrganizations.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-muted">No banking organizations created yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted small mb-3">Create, rename, reassign, disable, or remove bank accounts. Deletion is blocked once ledger or recurring records reference the account.</p>
                <form
                  className="row g-2 mb-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const payload: Accumul8AccountUpsertRequest = {
                      banking_organization_id: Number(accountForm.banking_organization_id || 0) > 0 ? Number(accountForm.banking_organization_id) : null,
                      account_name: String(accountForm.account_name || '').trim(),
                      account_nickname: String(accountForm.account_nickname || '').trim(),
                      account_type: String(accountForm.account_type || 'checking').trim().toLowerCase(),
                      account_subtype: String(accountForm.account_subtype || '').trim(),
                      institution_name: String(accountForm.institution_name || '').trim(),
                      account_number_mask: String(accountForm.account_number_mask || '').trim(),
                      mask_last4: String(accountForm.mask_last4 || '').trim(),
                      routing_number: String(accountForm.routing_number || '').trim(),
                      currency_code: String(accountForm.currency_code || 'USD').trim().toUpperCase(),
                      statement_day_of_month: Number(accountForm.statement_day_of_month || 0) > 0 ? Number(accountForm.statement_day_of_month) : null,
                      payment_due_day_of_month: Number(accountForm.payment_due_day_of_month || 0) > 0 ? Number(accountForm.payment_due_day_of_month) : null,
                      autopay_enabled: Number(accountForm.autopay_enabled || 0) ? 1 : 0,
                      credit_limit: Number(accountForm.credit_limit || 0),
                      interest_rate: Number(accountForm.interest_rate || 0),
                      minimum_payment: Number(accountForm.minimum_payment || 0),
                      opened_on: String(accountForm.opened_on || '').trim() || null,
                      closed_on: String(accountForm.closed_on || '').trim() || null,
                      notes: String(accountForm.notes || '').trim(),
                      is_active: Number(accountForm.is_active || 0) ? 1 : 0,
                    };
                    if (editingAccountId) {
                      void updateAccount(editingAccountId, payload).then(() => resetAccountForm());
                      return;
                    }
                    void createAccount(payload).then(() => resetAccountForm());
                  }}
                >
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="accumul8-account-name">Bank account name</label>
                    <input
                      id="accumul8-account-name"
                      className="form-control"
                      value={accountForm.account_name || ''}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, account_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="accumul8-account-nickname">Nickname</label>
                    <input
                      id="accumul8-account-nickname"
                      className="form-control"
                      value={accountForm.account_nickname || ''}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, account_nickname: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="accumul8-account-banking-organization">Banking organization</label>
                    <select
                      id="accumul8-account-banking-organization"
                      className="form-select"
                      value={Number(accountForm.banking_organization_id || 0) > 0 ? String(accountForm.banking_organization_id) : ''}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, banking_organization_id: e.target.value ? Number(e.target.value) : null }))}
                    >
                      <option value="">No banking organization</option>
                      {visibleBankingOrganizations.map((bankingOrganization) => (
                        <option key={bankingOrganization.id} value={bankingOrganization.id}>{bankingOrganization.banking_organization_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-type">Type</label>
                    <input
                      id="accumul8-account-type"
                      className="form-control"
                      value={accountForm.account_type || 'checking'}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, account_type: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-subtype">Subtype</label>
                    <input
                      id="accumul8-account-subtype"
                      className="form-control"
                      value={accountForm.account_subtype || ''}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, account_subtype: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="accumul8-account-institution">Institution</label>
                    <input
                      id="accumul8-account-institution"
                      className="form-control"
                      value={accountForm.institution_name || ''}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, institution_name: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-number-mask">Account mask</label>
                    <input
                      id="accumul8-account-number-mask"
                      className="form-control"
                      maxLength={32}
                      value={accountForm.account_number_mask || ''}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, account_number_mask: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-last4">Last 4</label>
                    <input
                      id="accumul8-account-last4"
                      className="form-control"
                      maxLength={8}
                      value={accountForm.mask_last4 || ''}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, mask_last4: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-routing-number">Routing</label>
                    <input
                      id="accumul8-account-routing-number"
                      className="form-control"
                      value={accountForm.routing_number || ''}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, routing_number: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-currency-code">Currency</label>
                    <input
                      id="accumul8-account-currency-code"
                      className="form-control"
                      maxLength={3}
                      value={accountForm.currency_code || 'USD'}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, currency_code: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-statement-day">Statement day</label>
                    <input
                      id="accumul8-account-statement-day"
                      className="form-control"
                      type="number"
                      min={1}
                      max={31}
                      value={accountForm.statement_day_of_month ?? ''}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, statement_day_of_month: e.target.value ? Number(e.target.value) : null }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-payment-due-day">Due day</label>
                    <input
                      id="accumul8-account-payment-due-day"
                      className="form-control"
                      type="number"
                      min={1}
                      max={31}
                      value={accountForm.payment_due_day_of_month ?? ''}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, payment_due_day_of_month: e.target.value ? Number(e.target.value) : null }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-autopay-enabled">Autopay</label>
                    <select
                      id="accumul8-account-autopay-enabled"
                      className="form-select"
                      value={String(Number(accountForm.autopay_enabled || 0))}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, autopay_enabled: Number(e.target.value) }))}
                    >
                      <option value="0">No</option>
                      <option value="1">Yes</option>
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-active">Status</label>
                    <select
                      id="accumul8-account-active"
                      className="form-select"
                      value={String(Number(accountForm.is_active || 0))}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, is_active: Number(e.target.value) }))}
                    >
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-credit-limit">Credit limit</label>
                    <input
                      id="accumul8-account-credit-limit"
                      className="form-control"
                      type="number"
                      step="0.01"
                      value={accountForm.credit_limit ?? 0}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, credit_limit: Number(e.target.value || 0) }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-interest-rate">APR %</label>
                    <input
                      id="accumul8-account-interest-rate"
                      className="form-control"
                      type="number"
                      step="0.0001"
                      value={accountForm.interest_rate ?? 0}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, interest_rate: Number(e.target.value || 0) }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-minimum-payment">Min payment</label>
                    <input
                      id="accumul8-account-minimum-payment"
                      className="form-control"
                      type="number"
                      step="0.01"
                      value={accountForm.minimum_payment ?? 0}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, minimum_payment: Number(e.target.value || 0) }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-opened-on">Opened</label>
                    <input
                      id="accumul8-account-opened-on"
                      className="form-control"
                      type="date"
                      value={typeof accountForm.opened_on === 'string' ? accountForm.opened_on : ''}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, opened_on: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label" htmlFor="accumul8-account-closed-on">Closed</label>
                    <input
                      id="accumul8-account-closed-on"
                      className="form-control"
                      type="date"
                      value={typeof accountForm.closed_on === 'string' ? accountForm.closed_on : ''}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, closed_on: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-2 d-grid">
                    <label className="form-label invisible">Save</label>
                    <button type="submit" className="btn btn-success" disabled={busy}>{editingAccountId ? 'Update' : 'Add'}</button>
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="accumul8-account-notes">Notes</label>
                    <textarea
                      id="accumul8-account-notes"
                      className="form-control"
                      rows={2}
                      value={typeof accountForm.notes === 'string' ? accountForm.notes : ''}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                  {editingAccountId ? (
                    <div className="col-md-2 d-grid">
                      <label className="form-label invisible">Cancel</label>
                      <button type="button" className="btn btn-outline-secondary" onClick={resetAccountForm} disabled={busy}>Cancel</button>
                    </div>
                  ) : null}
                </form>
                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Banking Organization</th>
                        <th>Institution / Type</th>
                        <th>Servicing</th>
                        <th>Status</th>
                        <th className="text-end catn8-actions-column">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAccounts.map((account) => (
                        <tr key={account.id}>
                          <td>
                            {getAccumul8AccountDisplayName(account)}
                            {account.account_nickname ? <div className="small text-muted">{account.account_name}</div> : null}
                            {account.mask_last4 ? <span className="text-muted"> • {account.mask_last4}</span> : null}
                          </td>
                          <td>{account.banking_organization_name || '-'}</td>
                          <td>
                            <div>{account.institution_name || '-'}</div>
                            <div className="small text-muted">{account.account_type || '-'}{account.account_subtype ? ` / ${account.account_subtype}` : ''}</div>
                          </td>
                          <td>
                            <div>{account.currency_code || 'USD'}{account.account_number_mask ? ` • ${account.account_number_mask}` : ''}</div>
                            <div className="small text-muted">
                              {account.statement_day_of_month ? `Stmt ${account.statement_day_of_month}` : ''}
                              {account.payment_due_day_of_month ? `${account.statement_day_of_month ? ' • ' : ''}Due ${account.payment_due_day_of_month}` : ''}
                              {account.autopay_enabled ? `${account.statement_day_of_month || account.payment_due_day_of_month ? ' • ' : ''}Autopay` : ''}
                            </div>
                          </td>
                          <td>{account.is_active ? 'Active' : 'Inactive'}</td>
                          <td className="text-end catn8-actions-column">
                            <div className="d-inline-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => {
                                  setEditingAccountId(account.id);
                                  setAccountForm({
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
                                  });
                                }}
                                disabled={busy}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => void handleAccountDelete(account)}
                                disabled={busy}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {visibleAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-muted">No bank accounts created yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

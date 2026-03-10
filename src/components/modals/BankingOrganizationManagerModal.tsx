import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { useBrandedConfirm } from '../../hooks/useBrandedConfirm';
import {
  Accumul8Account,
  Accumul8BankingOrganization,
  Accumul8BankingOrganizationUpsertRequest,
  Accumul8AccountUpsertRequest,
} from '../../types/accumul8';
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
  login_url: '',
  icon_path: '',
  notes: '',
  is_active: 1,
};

const DEFAULT_ACCOUNT_FORM: Accumul8AccountUpsertRequest = {
  banking_organization_id: null,
  account_name: '',
  account_type: 'checking',
  institution_name: '',
  mask_last4: '',
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
    () => [...accounts].sort((a, b) => a.account_name.localeCompare(b.account_name) || a.id - b.id),
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
      message: `Delete "${account.account_name}"? This will be blocked if ledger or recurring records exist.`,
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
                      login_url: String(bankingOrganizationForm.login_url || '').trim(),
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
                    <label className="form-label" htmlFor="accumul8-banking-organization-icon-path">Icon asset path</label>
                    <input
                      id="accumul8-banking-organization-icon-path"
                      className="form-control"
                      placeholder="/images/bank-organizations/example-1024.png"
                      value={bankingOrganizationForm.icon_path || ''}
                      onChange={(e) => setBankingOrganizationForm((prev) => ({ ...prev, icon_path: e.target.value }))}
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
                        <th>Launch</th>
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
                            <div>{bankingOrganization.login_url || '-'}</div>
                            <div className="small text-muted">{bankingOrganization.icon_path || 'No icon asset'}</div>
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
                                    login_url: bankingOrganization.login_url || '',
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
                          <td colSpan={6} className="text-muted">No banking organizations created yet.</td>
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
                      account_type: String(accountForm.account_type || 'checking').trim().toLowerCase(),
                      institution_name: String(accountForm.institution_name || '').trim(),
                      mask_last4: String(accountForm.mask_last4 || '').trim(),
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
                  <div className="col-md-2 d-grid">
                    <label className="form-label invisible">Save</label>
                    <button type="submit" className="btn btn-success" disabled={busy}>{editingAccountId ? 'Update' : 'Add'}</button>
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
                        <th>Institution</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th className="text-end catn8-actions-column">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAccounts.map((account) => (
                        <tr key={account.id}>
                          <td>
                            {account.account_name}
                            {account.mask_last4 ? <span className="text-muted"> • {account.mask_last4}</span> : null}
                          </td>
                          <td>{account.banking_organization_name || '-'}</td>
                          <td>{account.institution_name || '-'}</td>
                          <td>{account.account_type || '-'}</td>
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
                                    account_type: account.account_type || 'checking',
                                    institution_name: account.institution_name || '',
                                    mask_last4: account.mask_last4 || '',
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

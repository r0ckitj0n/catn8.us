import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { useBrandedConfirm } from '../../hooks/useBrandedConfirm';
import {
  Accumul8Account,
  Accumul8AccountGroup,
  Accumul8AccountGroupUpsertRequest,
  Accumul8AccountUpsertRequest,
} from '../../types/accumul8';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';

type Mode = 'group' | 'account';

interface Accumul8AccountManagerModalProps {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  busy: boolean;
  accountGroups: Accumul8AccountGroup[];
  accounts: Accumul8Account[];
  createAccountGroup: (form: Accumul8AccountGroupUpsertRequest) => Promise<void>;
  updateAccountGroup: (id: number, form: Accumul8AccountGroupUpsertRequest) => Promise<void>;
  deleteAccountGroup: (id: number) => Promise<void>;
  createAccount: (form: Accumul8AccountUpsertRequest) => Promise<void>;
  updateAccount: (id: number, form: Accumul8AccountUpsertRequest) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;
}

const DEFAULT_GROUP_FORM: Accumul8AccountGroupUpsertRequest = {
  group_name: '',
  institution_name: '',
  notes: '',
  is_active: 1,
};

const DEFAULT_ACCOUNT_FORM: Accumul8AccountUpsertRequest = {
  account_group_id: null,
  account_name: '',
  account_type: 'checking',
  institution_name: '',
  mask_last4: '',
  is_active: 1,
};

export function Accumul8AccountManagerModal({
  open,
  onClose,
  mode,
  busy,
  accountGroups,
  accounts,
  createAccountGroup,
  updateAccountGroup,
  deleteAccountGroup,
  createAccount,
  updateAccount,
  deleteAccount,
}: Accumul8AccountManagerModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const { confirm, confirmDialog } = useBrandedConfirm();
  const [editingGroupId, setEditingGroupId] = React.useState<number | null>(null);
  const [editingAccountId, setEditingAccountId] = React.useState<number | null>(null);
  const [groupForm, setGroupForm] = React.useState<Accumul8AccountGroupUpsertRequest>(DEFAULT_GROUP_FORM);
  const [accountForm, setAccountForm] = React.useState<Accumul8AccountUpsertRequest>(DEFAULT_ACCOUNT_FORM);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [modalApiRef, open]);

  React.useEffect(() => {
    if (!open) {
      setEditingGroupId(null);
      setEditingAccountId(null);
      setGroupForm(DEFAULT_GROUP_FORM);
      setAccountForm(DEFAULT_ACCOUNT_FORM);
    }
  }, [open]);

  const resetGroupForm = React.useCallback(() => {
    setEditingGroupId(null);
    setGroupForm(DEFAULT_GROUP_FORM);
  }, []);

  const resetAccountForm = React.useCallback(() => {
    setEditingAccountId(null);
    setAccountForm(DEFAULT_ACCOUNT_FORM);
  }, []);

  const title = mode === 'group' ? 'Manage Accumul8 Accounts' : 'Manage Bank Accounts';
  const visibleGroups = React.useMemo(
    () => [...accountGroups].sort((a, b) => a.group_name.localeCompare(b.group_name) || a.id - b.id),
    [accountGroups],
  );
  const visibleAccounts = React.useMemo(
    () => [...accounts].sort((a, b) => a.account_name.localeCompare(b.account_name) || a.id - b.id),
    [accounts],
  );

  const handleGroupDelete = React.useCallback(async (group: Accumul8AccountGroup) => {
    const confirmed = await confirm({
      title: 'Delete Accumul8 Account?',
      message: `Delete "${group.group_name}"? This will be blocked if bank accounts are still attached.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    await deleteAccountGroup(group.id);
    resetGroupForm();
  }, [confirm, deleteAccountGroup, resetGroupForm]);

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
            {mode === 'group' ? (
              <>
                <p className="text-muted small mb-3">Create, rename, disable, or remove Accumul8 account groups. Deletion is blocked while bank accounts still belong to the group.</p>
                <form
                  className="row g-2 mb-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const payload: Accumul8AccountGroupUpsertRequest = {
                      group_name: String(groupForm.group_name || '').trim(),
                      institution_name: String(groupForm.institution_name || '').trim(),
                      notes: String(groupForm.notes || '').trim(),
                      is_active: Number(groupForm.is_active || 0) ? 1 : 0,
                    };
                    if (editingGroupId) {
                      void updateAccountGroup(editingGroupId, payload).then(() => resetGroupForm());
                      return;
                    }
                    void createAccountGroup(payload).then(() => resetGroupForm());
                  }}
                >
                  <div className="col-md-4">
                    <label className="form-label" htmlFor="accumul8-group-name">Accumul8 account name</label>
                    <input
                      id="accumul8-group-name"
                      className="form-control"
                      value={groupForm.group_name || ''}
                      onChange={(e) => setGroupForm((prev) => ({ ...prev, group_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="accumul8-group-institution">Institution</label>
                    <input
                      id="accumul8-group-institution"
                      className="form-control"
                      value={groupForm.institution_name || ''}
                      onChange={(e) => setGroupForm((prev) => ({ ...prev, institution_name: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label" htmlFor="accumul8-group-active">Status</label>
                    <select
                      id="accumul8-group-active"
                      className="form-select"
                      value={String(Number(groupForm.is_active || 0))}
                      onChange={(e) => setGroupForm((prev) => ({ ...prev, is_active: Number(e.target.value) }))}
                    >
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </select>
                  </div>
                  <div className="col-md-2 d-grid">
                    <label className="form-label invisible">Save</label>
                    <button type="submit" className="btn btn-success" disabled={busy}>{editingGroupId ? 'Update' : 'Add'}</button>
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="accumul8-group-notes">Notes</label>
                    <textarea
                      id="accumul8-group-notes"
                      className="form-control"
                      rows={2}
                      value={groupForm.notes || ''}
                      onChange={(e) => setGroupForm((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                  {editingGroupId ? (
                    <div className="col-md-2 d-grid">
                      <button type="button" className="btn btn-outline-secondary" onClick={resetGroupForm} disabled={busy}>Cancel</button>
                    </div>
                  ) : null}
                </form>
                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Institution</th>
                        <th>Status</th>
                        <th>Notes</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleGroups.map((group) => (
                        <tr key={group.id}>
                          <td>{group.group_name}</td>
                          <td>{group.institution_name || '-'}</td>
                          <td>{group.is_active ? 'Active' : 'Inactive'}</td>
                          <td>{group.notes || '-'}</td>
                          <td className="text-end">
                            <div className="d-inline-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => {
                                  setEditingGroupId(group.id);
                                  setGroupForm({
                                    group_name: group.group_name || '',
                                    institution_name: group.institution_name || '',
                                    notes: group.notes || '',
                                    is_active: Number(group.is_active || 0),
                                  });
                                }}
                                disabled={busy}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => void handleGroupDelete(group)}
                                disabled={busy}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {visibleGroups.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-muted">No Accumul8 accounts created yet.</td>
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
                      account_group_id: Number(accountForm.account_group_id || 0) > 0 ? Number(accountForm.account_group_id) : null,
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
                    <label className="form-label" htmlFor="accumul8-account-group">Accumul8 account</label>
                    <select
                      id="accumul8-account-group"
                      className="form-select"
                      value={Number(accountForm.account_group_id || 0) > 0 ? String(accountForm.account_group_id) : ''}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, account_group_id: e.target.value ? Number(e.target.value) : null }))}
                    >
                      <option value="">No Accumul8 account</option>
                      {visibleGroups.map((group) => (
                        <option key={group.id} value={group.id}>{group.group_name}</option>
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
                        <th>Accumul8 Account</th>
                        <th>Institution</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAccounts.map((account) => (
                        <tr key={account.id}>
                          <td>
                            {account.account_name}
                            {account.mask_last4 ? <span className="text-muted"> • {account.mask_last4}</span> : null}
                          </td>
                          <td>{account.account_group_name || '-'}</td>
                          <td>{account.institution_name || '-'}</td>
                          <td>{account.account_type || '-'}</td>
                          <td>{account.is_active ? 'Active' : 'Inactive'}</td>
                          <td className="text-end">
                            <div className="d-inline-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => {
                                  setEditingAccountId(account.id);
                                  setAccountForm({
                                    account_group_id: account.account_group_id ?? null,
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

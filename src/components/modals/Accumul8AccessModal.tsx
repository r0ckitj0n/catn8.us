import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { StandardIconButton } from '../common/StandardIconButton';
import { useBrandedConfirm } from '../../hooks/useBrandedConfirm';
import { useAccumul8Access } from './hooks/useAccumul8Access';

interface Accumul8AccessModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

export function Accumul8AccessModal({ open, onClose, onToast }: Accumul8AccessModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const { confirm, confirmDialog } = useBrandedConfirm();
  const state = useAccumul8Access(open, confirm, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [modalApiRef, open]);

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Accumul8 Access</h5>
            <ModalCloseIconButton />
          </div>
          <div className="modal-body">
            <p className="text-muted small mb-3">Grant one login access to another person&apos;s Accumul8 account data.</p>

            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="accumul8-user-search">Search users</label>
                <input
                  id="accumul8-user-search"
                  className="form-control"
                  type="search"
                  placeholder="Username, email, or ID"
                  value={state.userSearch}
                  onChange={(e) => state.setUserSearch(e.target.value)}
                  disabled={state.busy}
                />
              </div>
            </div>

            <form className="row g-2 mb-3" onSubmit={(e) => void state.grantAccess(e)}>
              <div className="col-md-5">
                <label className="form-label" htmlFor="accumul8-grantee-user">User receiving access</label>
                <select
                  id="accumul8-grantee-user"
                  className="form-select"
                  value={state.granteeUserId}
                  onChange={(e) => state.setGranteeUserId(e.target.value)}
                  disabled={state.busy}
                  required
                >
                  <option value="">Select user…</option>
                  {state.filteredUsers.map((u) => (
                    <option key={`grantee-${u.id}`} value={u.id}>{u.username} (#{u.id})</option>
                  ))}
                </select>
              </div>
              <div className="col-md-5">
                <label className="form-label" htmlFor="accumul8-owner-user">Account owner</label>
                <select
                  id="accumul8-owner-user"
                  className="form-select"
                  value={state.ownerUserId}
                  onChange={(e) => state.setOwnerUserId(e.target.value)}
                  disabled={state.busy}
                  required
                >
                  <option value="">Select owner…</option>
                  {state.filteredUsers.map((u) => (
                    <option key={`owner-${u.id}`} value={u.id}>{u.username} (#{u.id})</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2 d-grid">
                <label className="form-label invisible">Grant</label>
                <button type="submit" className="btn btn-success" disabled={state.busy}>Grant Access</button>
              </div>
            </form>

            <div className="d-flex justify-content-end mb-2">
              <StandardIconButton
                iconKey="refresh"
                ariaLabel="Refresh Accumul8 grants"
                title={state.busy ? 'Refreshing...' : 'Refresh'}
                className="btn btn-outline-secondary btn-sm catn8-action-icon-btn"
                onClick={() => void state.load()}
                disabled={state.busy}
              />
            </div>

            <div className="row g-2 mb-2">
              <div className="col-md-5">
                <label className="form-label" htmlFor="accumul8-grant-search">Search grants</label>
                <input
                  id="accumul8-grant-search"
                  className="form-control"
                  type="search"
                  placeholder="User, owner, email, grant ID"
                  value={state.grantSearch}
                  onChange={(e) => state.setGrantSearch(e.target.value)}
                  disabled={state.busy}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="accumul8-owner-filter">Filter owner</label>
                <select
                  id="accumul8-owner-filter"
                  className="form-select"
                  value={state.grantOwnerFilter}
                  onChange={(e) => state.setGrantOwnerFilter(e.target.value)}
                  disabled={state.busy}
                >
                  <option value="">All owners</option>
                  {state.users.map((u) => (
                    <option key={`owner-filter-${u.id}`} value={u.id}>{u.username} (#{u.id})</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="accumul8-grantee-filter">Filter user</label>
                <select
                  id="accumul8-grantee-filter"
                  className="form-select"
                  value={state.grantGranteeFilter}
                  onChange={(e) => state.setGrantGranteeFilter(e.target.value)}
                  disabled={state.busy}
                >
                  <option value="">All users</option>
                  {state.users.map((u) => (
                    <option key={`grantee-filter-${u.id}`} value={u.id}>{u.username} (#{u.id})</option>
                  ))}
                </select>
              </div>
              <div className="col-md-1 d-grid">
                <label className="form-label invisible">Clear</label>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    state.setGrantSearch('');
                    state.setGrantOwnerFilter('');
                    state.setGrantGranteeFilter('');
                  }}
                  disabled={state.busy}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Can Access Owner</th>
                    <th>Granted By</th>
                    <th>Updated</th>
                    <th className="text-end catn8-actions-column">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.filteredGrants.map((grant) => (
                    <tr key={grant.id}>
                      <td>{grant.id}</td>
                      <td>{grant.grantee_username} <span className="text-muted">(#{grant.grantee_user_id})</span></td>
                      <td>{grant.owner_username} <span className="text-muted">(#{grant.owner_user_id})</span></td>
                      <td>{grant.granted_by_username || '-'}</td>
                      <td>{grant.updated_at || grant.created_at || '-'}</td>
                      <td className="text-end catn8-actions-column">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => void state.revokeAccess(grant)}
                          disabled={state.busy}
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                  {state.filteredGrants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-muted">No grants match the current filters.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

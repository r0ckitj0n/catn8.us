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
                  {state.users.map((u) => (
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
                  {state.users.map((u) => (
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

            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Can Access Owner</th>
                    <th>Granted By</th>
                    <th>Updated</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.grants.map((grant) => (
                    <tr key={grant.id}>
                      <td>{grant.id}</td>
                      <td>{grant.grantee_username} <span className="text-muted">(#{grant.grantee_user_id})</span></td>
                      <td>{grant.owner_username} <span className="text-muted">(#{grant.owner_user_id})</span></td>
                      <td>{grant.granted_by_username || '-'}</td>
                      <td>{grant.updated_at || grant.created_at || '-'}</td>
                      <td className="text-end">
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
                  {state.grants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-muted">No active grants yet.</td>
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

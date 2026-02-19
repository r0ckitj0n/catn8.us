import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { useUserAccounts } from './hooks/useUserAccounts';
import { UserCreateSection } from './sections/UserCreateSection';
import { UserEditSection } from './sections/UserEditSection';
import { UserPasswordSection } from './sections/UserPasswordSection';

interface UserAccountsModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

/**
 * UserAccountsModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function UserAccountsModal({ open, onClose, onToast }: UserAccountsModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const state = useUserAccounts(open, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">User Accounts</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <UserCreateSection 
              busy={state.busy}
              createUsername={state.createUsername}
              setCreateUsername={state.setCreateUsername}
              createEmail={state.createEmail}
              setCreateEmail={state.setCreateEmail}
              createPassword={state.createPassword}
              setCreatePassword={state.setCreatePassword}
              createIsActive={state.createIsActive}
              setCreateIsActive={state.setCreateIsActive}
              createIsAdmin={state.createIsAdmin}
              setCreateIsAdmin={state.setCreateIsAdmin}
              createUser={state.createUser}
            />

            <UserEditSection 
              busy={state.busy}
              editUserId={state.editUserId}
              editUsername={state.editUsername}
              setEditUsername={state.setEditUsername}
              editEmail={state.editEmail}
              setEditEmail={state.setEditEmail}
              cancelEdit={state.cancelEdit}
              saveEdit={state.saveEdit}
            />

            <UserPasswordSection 
              busy={state.busy}
              pwUserId={state.pwUserId}
              pwValue={state.pwValue}
              setPwValue={state.setPwValue}
              cancelPassword={state.cancelPassword}
              savePassword={state.savePassword}
            />

            <div className="d-flex justify-content-end mb-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={state.load} disabled={state.busy}>
                Refresh
              </button>
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Active</th>
                    <th>Admin</th>
                    <th>Verified</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {state.users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.username}</td>
                      <td>{u.email}</td>
                      <td>
                        <button
                          type="button"
                          className={'btn btn-sm ' + (u.is_active ? 'btn-success' : 'btn-outline-secondary')}
                          onClick={() => state.toggle(u.id, 'is_active', u.is_active ? 0 : 1)}
                          disabled={state.busy}
                        >
                          {u.is_active ? 'Yes' : 'No'}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={'btn btn-sm ' + (u.is_admin ? 'btn-success' : 'btn-outline-secondary')}
                          onClick={() => state.toggle(u.id, 'is_admin', u.is_admin ? 0 : 1)}
                          disabled={state.busy}
                        >
                          {u.is_admin ? 'Yes' : 'No'}
                        </button>
                      </td>
                      <td>{u.email_verified ? 'Yes' : 'No'}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => state.startEdit(u)} disabled={state.busy}>Edit</button>
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => state.startPassword(u)} disabled={state.busy}>Set Password</button>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => state.deleteUser(u)} disabled={state.busy}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { PlaidEnvironment } from '../../types/plaidSettings';
import { usePlaidConfig } from './hooks/usePlaidConfig';

interface PlaidConfigModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

const saveSvg = (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.5a1 1 0 0 0-.293-.707l-2.5-2.5A1 1 0 0 0 11.5 1H2zm1 1h8v4H3V2zm0 6h10v6H3V8zm2 1v4h6V9H5z"
    />
  </svg>
);

export function PlaidConfigModal({ open, onClose, onToast }: PlaidConfigModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const state = usePlaidConfig(open, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  const confirmDelete = (field: 'client_id' | 'secret' | 'all') => {
    const target = field === 'all' ? 'client id and secret' : field.replace('_', ' ');
    const ok = window.confirm(`Delete stored Plaid ${target}?`);
    if (!ok) return;
    void state.removeCredential(field);
  };

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Plaid Configuration</h5>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={'btn btn-sm btn-primary catn8-dirty-save' + (state.isDirty ? ' catn8-dirty-save--visible' : '')}
                onClick={(e) => void state.save(e)}
                disabled={state.busy || !state.isDirty}
                aria-label="Save"
                title={state.isDirty ? 'Save changes' : 'No changes to save'}
              >
                {saveSvg}
                <span className="ms-1">Save</span>
              </button>
              <ModalCloseIconButton />
            </div>
          </div>

          <div className="modal-body">
            <div className="catn8-card p-2 mb-3">
              <div className="fw-bold">Plaid Keys For Accumul8</div>
              Configure, rotate, delete, and verify Plaid credentials used by bank sync.
              <div>Current source: {state.source}.</div>
              <div>
                Secrets set:
                <span className="fw-bold"> Client ID</span> {state.status.has_client_id ? 'yes' : 'no'};
                <span className="fw-bold"> Secret</span> {state.status.has_secret ? 'yes' : 'no'}.
              </div>
              <div className="mt-1">
                <span className="fw-bold">Last test:</span> {state.lastPlaidTest || 'Not run yet'}
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void state.save(e); }}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label" htmlFor="plaid-env">Environment</label>
                  <select
                    id="plaid-env"
                    className="form-select"
                    value={state.form.env}
                    onChange={(e) => state.setForm((prev) => ({ ...prev, env: e.target.value as PlaidEnvironment }))}
                    disabled={state.busy}
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="development">Development</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                <div className="col-md-8">
                  <label className="form-label" htmlFor="plaid-client-id">Client ID</label>
                  <input
                    id="plaid-client-id"
                    className="form-control"
                    value={state.form.client_id}
                    onChange={(e) => state.setForm((prev) => ({ ...prev, client_id: e.target.value }))}
                    disabled={state.busy}
                    placeholder="Plaid client id"
                  />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="plaid-secret">Secret</label>
                  <input
                    id="plaid-secret"
                    className="form-control"
                    type="password"
                    value={state.form.secret}
                    onChange={(e) => state.setForm((prev) => ({ ...prev, secret: e.target.value }))}
                    disabled={state.busy}
                    placeholder={state.status.has_secret ? '•••••••• (set)' : 'Plaid secret'}
                  />
                  <div className="form-text">Leave secret blank to keep the existing secret.</div>
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-between mt-4">
                <div className="d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline-danger btn-sm" disabled={state.busy || !state.status.has_client_id} onClick={() => confirmDelete('client_id')}>
                    Delete Client ID
                  </button>
                  <button type="button" className="btn btn-outline-danger btn-sm" disabled={state.busy || !state.status.has_secret} onClick={() => confirmDelete('secret')}>
                    Delete Secret
                  </button>
                  <button type="button" className="btn btn-outline-danger btn-sm" disabled={state.busy || (!state.status.has_client_id && !state.status.has_secret)} onClick={() => confirmDelete('all')}>
                    Delete Both
                  </button>
                </div>

                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-outline-secondary" disabled={state.busy} onClick={() => void state.load()}>
                    Reload
                  </button>
                  <button type="button" className="btn btn-outline-primary" disabled={state.busy} onClick={(e) => void state.test(e)}>
                    Test Plaid
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

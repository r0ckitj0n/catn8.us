import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { useDbConfig } from './hooks/useDbConfig';

interface DbConfigModalProps {
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

/**
 * DbConfigModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function DbConfigModal({ open, onClose, onToast }: DbConfigModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const state = useDbConfig(open, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  const profileCfg = state.cfgByProfile[state.selectedProfile] || state.emptyCfg;

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Database Connection</h5>
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void state.load()} disabled={state.busy} title="Reload from server">
                Reload
              </button>
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
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            <div className="catn8-card p-2 mb-3">
              <div className="fw-bold">Database Connection</div>
              You can test the connection and save credentials (local requests only).
              <div>Current source: {state.source}.</div>
              <div>Active profile (auto-selected): <span className="fw-bold">{state.activeProfile}</span>.</div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void state.test(); }}>
              <div className="mb-3">
                <label className="form-label" htmlFor="db-profile">Profile to test</label>
                <select
                  id="db-profile"
                  className="form-select"
                  value={state.selectedProfile}
                  onChange={(e) => state.setSelectedProfile(e.target.value)}
                  disabled={state.busy}
                >
                  <option value="dev">Dev</option>
                  <option value="live">Live</option>
                </select>
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="db-host">Host</label>
                  <input
                    id="db-host"
                    className="form-control"
                    value={profileCfg.host}
                    onChange={(e) => state.setCfgByProfile(all => ({ ...all, [state.selectedProfile]: { ...profileCfg, host: e.target.value } }))}
                    disabled={state.busy}
                    placeholder="127.0.0.1"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="db-socket">Socket (optional)</label>
                  <input
                    id="db-socket"
                    className="form-control"
                    value={profileCfg.socket}
                    onChange={(e) => state.setCfgByProfile(all => ({ ...all, [state.selectedProfile]: { ...profileCfg, socket: e.target.value } }))}
                    disabled={state.busy}
                    placeholder="/tmp/mysql.sock"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="db-name">Database</label>
                  <input
                    id="db-name"
                    className="form-control"
                    value={profileCfg.db}
                    onChange={(e) => state.setCfgByProfile(all => ({ ...all, [state.selectedProfile]: { ...profileCfg, db: e.target.value } }))}
                    disabled={state.busy}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="db-port">Port</label>
                  <input
                    id="db-port"
                    className="form-control"
                    type="number"
                    value={String(profileCfg.port)}
                    onChange={(e) => state.setCfgByProfile(all => ({ ...all, [state.selectedProfile]: { ...profileCfg, port: Number(e.target.value || 0) || 3306 } }))}
                    disabled={state.busy}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="db-user">User</label>
                  <input
                    id="db-user"
                    className="form-control"
                    value={profileCfg.user}
                    onChange={(e) => state.setCfgByProfile(all => ({ ...all, [state.selectedProfile]: { ...profileCfg, user: e.target.value } }))}
                    disabled={state.busy}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="db-pass">Password</label>
                  <input
                    id="db-pass"
                    className="form-control"
                    type="password"
                    value={profileCfg.pass}
                    onChange={(e) => state.setCfgByProfile(all => ({ ...all, [state.selectedProfile]: { ...profileCfg, pass: e.target.value } }))}
                    disabled={state.busy}
                    placeholder="(not loaded)"
                  />
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-3">
                {state.lastDbTest && (
                  <div className="text-muted small d-flex align-items-center">Last result: {state.lastDbTest}</div>
                )}
                <button type="submit" className="btn btn-primary" disabled={state.busy}>
                  Test Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

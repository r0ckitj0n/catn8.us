import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { useDeployConfig } from './hooks/useDeployConfig';

interface DeployConfigModalProps {
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
 * DeployConfigModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function DeployConfigModal({ open, onClose, onToast }: DeployConfigModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const state = useDeployConfig(open, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  const copyAdminToken = async () => {
    const token = String(state.secrets.admin_token || '').trim();
    if (!token) {
      if (onToast) onToast({ tone: 'error', message: 'Nothing to copy (Admin Token is empty)' });
      return;
    }
    try {
      await navigator.clipboard.writeText(token);
      if (onToast) onToast({ tone: 'success', message: 'Admin token copied to clipboard' });
    } catch (e: any) {
      if (onToast) onToast({ tone: 'error', message: e?.message || 'Failed to copy to clipboard' });
    }
  };

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Deployment Configuration</h5>
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
              <div className="fw-bold">Deploy Secrets & Parameters</div>
              This updates <code>.env.local</code> on this machine (local requests only). Password/token fields are never shown after saving.
              <div>Current source: {state.source}.</div>
              <div>
                Secrets set: 
                <span className="fw-bold"> Deploy Pass</span> {state.secretStatus.CATN8_DEPLOY_PASS_set ? 'yes' : 'no'}; 
                <span className="fw-bold"> Admin Token</span> {state.secretStatus.CATN8_ADMIN_TOKEN_set ? 'yes' : 'no'}.
              </div>
              <div className="mt-2">
                <span className="fw-bold">Last test:</span> {state.lastDeployTest || 'Not run yet'}
              </div>
            </div>

            {state.testChecks.length > 0 && (
              <div className="mb-3">
                <div className="fw-semibold mb-2">Test Results</div>
                <div className="list-group">
                  {state.testChecks.map((c, idx) => (
                    <div key={`${c?.key || 'check'}-${idx}`} className="list-group-item d-flex justify-content-between align-items-start">
                      <div className="me-3">
                        <div className="fw-semibold">{String(c?.key || 'check')}</div>
                        <div className="text-muted small">{String(c?.message || '')}</div>
                      </div>
                      <div className={c?.ok ? 'text-success fw-semibold' : 'text-danger fw-semibold'}>{c?.ok ? 'OK' : 'FAIL'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); void state.save(e); }}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Deploy Host (CATN8_DEPLOY_HOST)</label>
                  <input className="form-control" value={state.cfg.deploy_host} onChange={(e) => state.setCfg(prev => ({ ...prev, deploy_host: e.target.value }))} disabled={state.busy} placeholder="home123.1and1-data.host" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Deploy User (CATN8_DEPLOY_USER)</label>
                  <input className="form-control" value={state.cfg.deploy_user} onChange={(e) => state.setCfg(prev => ({ ...prev, deploy_user: e.target.value }))} disabled={state.busy} placeholder="acc123456" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Deploy Base URL (CATN8_DEPLOY_BASE_URL)</label>
                  <input className="form-control" value={state.cfg.deploy_base_url} onChange={(e) => state.setCfg(prev => ({ ...prev, deploy_base_url: e.target.value }))} disabled={state.busy} placeholder="https://catn8.us" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Public Base (CATN8_PUBLIC_BASE)</label>
                  <input className="form-control" value={state.cfg.public_base} onChange={(e) => state.setCfg(prev => ({ ...prev, public_base: e.target.value }))} disabled={state.busy} placeholder="/subdir (optional)" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Remote SQL Dir (CATN8_REMOTE_SQL_DIR)</label>
                  <input className="form-control" value={state.cfg.remote_sql_dir} onChange={(e) => state.setCfg(prev => ({ ...prev, remote_sql_dir: e.target.value }))} disabled={state.busy} placeholder="backups/sql" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Upload Live Env (CATN8_UPLOAD_LIVE_ENV)</label>
                  <input className="form-control" value={state.cfg.upload_live_env} onChange={(e) => state.setCfg(prev => ({ ...prev, upload_live_env: e.target.value }))} disabled={state.busy} placeholder="1 to enable .env.live upload" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Deploy Pass (CATN8_DEPLOY_PASS)</label>
                  <input type="password" className="form-control" value={state.secrets.deploy_pass} onChange={(e) => state.setSecrets(prev => ({ ...prev, deploy_pass: e.target.value }))} disabled={state.busy} placeholder={state.secretStatus.CATN8_DEPLOY_PASS_set ? '•••••••• (set)' : 'enter password'} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Admin Token (CATN8_ADMIN_TOKEN)</label>
                  <input type="password" className="form-control" value={state.secrets.admin_token} onChange={(e) => state.setSecrets(prev => ({ ...prev, admin_token: e.target.value }))} disabled={state.busy} placeholder={state.secretStatus.CATN8_ADMIN_TOKEN_set ? '•••••••• (set)' : 'enter token'} />
                  <div className="mt-2 d-flex gap-2">
                    <button type="button" className="btn btn-outline-secondary btn-sm" disabled={state.busy} onClick={state.generateAdminToken}>Generate Admin Token</button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" disabled={state.busy || !state.secrets.admin_token.trim()} onClick={copyAdminToken}>Copy token</button>
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-between mt-4">
                <div className="text-muted">{state.busy ? 'Working…' : state.isDirty ? 'Unsaved changes' : 'Up to date'}</div>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-outline-primary" disabled={state.busy} onClick={(e) => void state.testDeployment(e)}>Test Deployment</button>
                  <button type="button" className="btn btn-outline-secondary" disabled={state.busy} onClick={() => void state.load()}>Reload</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

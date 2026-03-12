import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { TellerEnvironment } from '../../types/tellerSettings';
import { useTellerConfig } from './hooks/useTellerConfig';

interface TellerConfigModalProps {
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

export function TellerConfigModal({ open, onClose, onToast }: TellerConfigModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const state = useTellerConfig(open, onToast);
  const certificateInputRef = React.useRef<HTMLInputElement | null>(null);
  const privateKeyInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  const confirmDelete = (field: 'application_id' | 'certificate' | 'private_key' | 'all') => {
    const target = field === 'all' ? 'application id, certificate, and private key' : field.replace('_', ' ');
    const ok = window.confirm(`Delete stored Teller ${target}?`);
    if (!ok) return;
    void state.removeCredential(field);
  };

  const loadPemFile = React.useCallback(async (
    file: File | null | undefined,
    field: 'certificate' | 'private_key',
    label: string,
  ) => {
    if (!file) return;

    try {
      const text = await file.text();
      state.setForm((prev) => ({ ...prev, [field]: text }));
      onToast?.({ tone: 'success', message: `${label} loaded from ${file.name}.` });
    } catch (error: any) {
      onToast?.({ tone: 'error', message: error?.message || `Failed to read ${label.toLowerCase()} file.` });
    }
  }, [onToast, state]);

  const handlePemFileChange = React.useCallback((
    event: React.ChangeEvent<HTMLInputElement>,
    field: 'certificate' | 'private_key',
    label: string,
  ) => {
    const input = event.target;
    const file = input.files?.[0];
    void loadPemFile(file, field, label);
    input.value = '';
  }, [loadPemFile]);

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Teller Configuration</h5>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-primary"
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
              <div className="fw-bold">Teller Credentials For Accumul8</div>
              Configure, rotate, delete, and verify the Teller credentials used by bank sync.
              <div>Current source: {state.source}.</div>
              <div>
                Secrets set:
                <span className="fw-bold"> Application ID</span> {state.status.has_application_id ? 'yes' : 'no'};
                <span className="fw-bold"> Certificate</span> {state.status.has_certificate ? 'yes' : 'no'};
                <span className="fw-bold"> Private Key</span> {state.status.has_private_key ? 'yes' : 'no'}.
              </div>
              <div className="mt-1">
                <span className="fw-bold">Last test:</span> {state.lastTellerTest || 'Not run yet'}
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void state.save(e); }}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label" htmlFor="teller-env">Environment</label>
                  <select
                    id="teller-env"
                    className="form-select"
                    value={state.form.env}
                    onChange={(e) => state.setForm((prev) => ({ ...prev, env: e.target.value as TellerEnvironment }))}
                    disabled={state.busy}
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="development">Development</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                <div className="col-md-8">
                  <label className="form-label" htmlFor="teller-application-id">Application ID</label>
                  <input
                    id="teller-application-id"
                    className="form-control"
                    value={state.form.application_id}
                    onChange={(e) => state.setForm((prev) => ({ ...prev, application_id: e.target.value }))}
                    disabled={state.busy}
                    placeholder="Teller application id"
                    autoComplete="off"
                  />
                </div>
                <div className="col-12">
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <label className="form-label mb-0" htmlFor="teller-certificate">Certificate (PEM)</label>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      disabled={state.busy}
                      onClick={() => certificateInputRef.current?.click()}
                    >
                      Choose Certificate PEM
                    </button>
                  </div>
                  <input
                    ref={certificateInputRef}
                    type="file"
                    accept=".pem,.crt,.cer,.txt"
                    className="d-none"
                    tabIndex={-1}
                    autoComplete="off"
                    onChange={(event) => handlePemFileChange(event, 'certificate', 'Certificate PEM')}
                  />
                  <textarea
                    id="teller-certificate"
                    className="form-control"
                    rows={6}
                    value={state.form.certificate}
                    onChange={(e) => state.setForm((prev) => ({ ...prev, certificate: e.target.value }))}
                    disabled={state.busy}
                    placeholder={state.status.has_certificate ? '-----BEGIN CERTIFICATE-----\n(set)\n-----END CERTIFICATE-----' : '-----BEGIN CERTIFICATE-----'}
                  />
                  <div className="form-text">Paste the PEM contents or choose a local file. Leave blank to keep the existing certificate.</div>
                </div>
                <div className="col-12">
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <label className="form-label mb-0" htmlFor="teller-private-key">Private Key (PEM)</label>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      disabled={state.busy}
                      onClick={() => privateKeyInputRef.current?.click()}
                    >
                      Choose Private Key PEM
                    </button>
                  </div>
                  <input
                    ref={privateKeyInputRef}
                    type="file"
                    accept=".pem,.key,.txt"
                    className="d-none"
                    tabIndex={-1}
                    autoComplete="off"
                    onChange={(event) => handlePemFileChange(event, 'private_key', 'Private key PEM')}
                  />
                  <textarea
                    id="teller-private-key"
                    className="form-control"
                    rows={7}
                    value={state.form.private_key}
                    onChange={(e) => state.setForm((prev) => ({ ...prev, private_key: e.target.value }))}
                    disabled={state.busy}
                    placeholder={state.status.has_private_key ? '-----BEGIN PRIVATE KEY-----\n(set)\n-----END PRIVATE KEY-----' : '-----BEGIN PRIVATE KEY-----'}
                  />
                  <div className="form-text">Paste the PEM contents or choose a local file. Leave blank to keep the existing private key.</div>
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-between mt-4">
                <div className="d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline-danger btn-sm" disabled={state.busy || !state.status.has_application_id} onClick={() => confirmDelete('application_id')}>
                    Delete Application ID
                  </button>
                  <button type="button" className="btn btn-outline-danger btn-sm" disabled={state.busy || !state.status.has_certificate} onClick={() => confirmDelete('certificate')}>
                    Delete Certificate
                  </button>
                  <button type="button" className="btn btn-outline-danger btn-sm" disabled={state.busy || !state.status.has_private_key} onClick={() => confirmDelete('private_key')}>
                    Delete Private Key
                  </button>
                  <button type="button" className="btn btn-outline-danger btn-sm" disabled={state.busy || (!state.status.has_application_id && !state.status.has_certificate && !state.status.has_private_key)} onClick={() => confirmDelete('all')}>
                    Delete All
                  </button>
                </div>

                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-primary" disabled={state.busy || !state.isDirty} onClick={(e) => void state.save(e)}>
                    Save Changes
                  </button>
                  <button type="button" className="btn btn-outline-secondary" disabled={state.busy} onClick={() => void state.load()}>
                    Reload
                  </button>
                  <button type="button" className="btn btn-outline-primary" disabled={state.busy} onClick={(e) => void state.test(e)}>
                    Test Teller
                  </button>
                  <button type="button" className="btn btn-success" disabled={state.busy} onClick={() => void state.connectBank()}>
                    Connect Bank via Teller
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

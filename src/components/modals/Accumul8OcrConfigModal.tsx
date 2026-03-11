import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { useAccumul8OcrConfig } from './hooks/useAccumul8OcrConfig';

interface Accumul8OcrConfigModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

export function Accumul8OcrConfigModal({ open, onClose, onToast }: Accumul8OcrConfigModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const state = useAccumul8OcrConfig(open, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  const handleClear = () => {
    if (!window.confirm('Remove the stored Accumul8 OCR service account?')) return;
    void state.clear();
  };

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Accumul8 OCR</h5>
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn btn-sm btn-primary" disabled={state.busy || !state.isDirty} onClick={() => void state.save()}>
                Save
              </button>
              <ModalCloseIconButton />
            </div>
          </div>

          <div className="modal-body">
            <div className="catn8-card p-2 mb-3">
              <div className="fw-bold">Google Cloud OCR Credential</div>
              Save a Google service account JSON here for Accumul8 statement OCR.
              <div>Stored: {state.settings.has_service_account_json ? 'yes' : 'no'}.</div>
              <div>Project: {state.settings.project_id || 'Not set'}.</div>
              <div>Client: {state.settings.client_email_hint || 'Not set'}.</div>
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="accumul8-ocr-service-account-json">Service Account JSON</label>
              <textarea
                id="accumul8-ocr-service-account-json"
                className="form-control"
                rows={14}
                value={state.serviceAccountJson}
                onChange={(event) => state.setServiceAccountJson(event.target.value)}
                disabled={state.busy}
                placeholder={state.settings.has_service_account_json ? 'Paste a replacement JSON credential to rotate it' : 'Paste the Google service account JSON for Accumul8 OCR'}
              />
              <div className="form-text">This is stored encrypted in the site secret store and used only for backend statement OCR.</div>
            </div>

            <div className="d-flex justify-content-between gap-2">
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary" disabled={state.busy} onClick={() => void state.load()}>
                  Reload
                </button>
                <button type="button" className="btn btn-outline-danger" disabled={state.busy || !state.settings.has_service_account_json} onClick={handleClear}>
                  Remove Stored Credential
                </button>
              </div>
              <button type="button" className="btn btn-primary" disabled={state.busy || !state.isDirty} onClick={() => void state.save()}>
                Save Credential
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { ApiClient } from '../../core/ApiClient';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IBuildWizardPdfThumbnailDiagnosticsResponse } from '../../types/buildWizard';
import { IToast } from '../../types/common';

interface DocumentSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

export function DocumentSettingsModal({ open, onClose, onToast }: DocumentSettingsModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [busy, setBusy] = React.useState(false);
  const [reportJson, setReportJson] = React.useState<string>('');

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  const runDiagnostics = React.useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const res = await ApiClient.get<IBuildWizardPdfThumbnailDiagnosticsResponse>('/api/build_wizard.php?action=pdf_thumbnail_diagnostics');
      const diagnostics = res?.diagnostics || null;
      if (!diagnostics) {
        throw new Error('Missing diagnostics payload');
      }
      setReportJson(JSON.stringify(diagnostics, null, 2));
      onToast?.({
        tone: diagnostics.pdf_thumbnail_supported ? 'success' : 'warning',
        message: diagnostics.pdf_thumbnail_supported
          ? 'PDF thumbnail rendering is available.'
          : 'PDF thumbnail rendering is not fully available on this server.',
      });
    } catch (err: any) {
      onToast?.({ tone: 'error', message: err?.message || 'Failed to fetch PDF thumbnail diagnostics' });
    } finally {
      setBusy(false);
    }
  }, [busy, onToast]);

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Document Settings</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="catn8-card p-2 mb-3">
              <div className="fw-bold">PDF Thumbnail Diagnostics</div>
              Checks server support for PDF first-page thumbnail rendering.
            </div>
            <div className="d-flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void runDiagnostics()}
                disabled={busy}
              >
                {busy ? 'Checking...' : 'Run Diagnostics'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(reportJson || '');
                    onToast?.({ tone: 'success', message: 'Diagnostics copied.' });
                  } catch (_) {
                    onToast?.({ tone: 'warning', message: 'Could not copy to clipboard.' });
                  }
                }}
                disabled={!reportJson}
              >
                Copy JSON
              </button>
            </div>
            {reportJson ? (
              <pre className="bg-light border rounded p-2 mb-0 small">{reportJson}</pre>
            ) : (
              <div className="text-muted">Run diagnostics to view report.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

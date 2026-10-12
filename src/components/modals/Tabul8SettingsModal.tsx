import React from 'react';

import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { useTabul8Settings } from './hooks/useTabul8Settings';

interface Props {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

export function Tabul8SettingsModal({ open, onClose, onToast }: Props) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const s = useTabul8Settings(open, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  const models = s.settings.allowed_models?.length
    ? s.settings.allowed_models
    : ['gpt-4o-mini', 'gpt-4o'];

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Tabul8 / AI Labels</h5>
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn btn-sm btn-primary" disabled={s.busy} onClick={() => void s.save()}>
                Save
              </button>
              <ModalCloseIconButton />
            </div>
          </div>
          <div className="modal-body">
            <p className="text-muted small">
              When a contestant is snapped, catn8 can call OpenAI directly (fast vision model) for a short fun label.
              If AI is off, the key is missing, or the call fails/times out (~{s.settings.timeout_seconds || 8}s),
              it falls back to Celebr8r (<code>tabul8_label</code>) or manual labeling. The camera snap always succeeds.
            </p>

            <div className="catn8-card p-2 mb-3">
              <div className="fw-bold">OpenAI API key</div>
              <div className="small">
                Stored: {Number(s.settings.has_api_key) === 1
                  ? `yes — ${s.settings.api_key_masked || ('••••' + (s.settings.api_key_last4 || ''))}`
                  : 'no (Jon pastes it here; never stored in the repo)'}
              </div>
              <label className="form-label mt-2" htmlFor="tabul8-openai-key">
                {Number(s.settings.has_api_key) === 1 ? 'Replace / rotate key' : 'Paste OpenAI API key'}
              </label>
              <input
                id="tabul8-openai-key"
                className="form-control"
                type="password"
                autoComplete="off"
                value={s.apiKeyDraft}
                onChange={(e) => s.setApiKeyDraft(e.target.value)}
                disabled={s.busy}
                placeholder={Number(s.settings.has_api_key) === 1 ? 'Leave blank to keep current key' : 'sk-…'}
              />
              <div className="form-text">Encrypted in catn8 secret store. After save, only the last 4 characters are shown.</div>
              <div className="d-flex flex-wrap gap-2 mt-2">
                <button type="button" className="btn btn-sm btn-outline-primary" disabled={s.busy} onClick={() => void s.testConnection()}>
                  Test connection
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  disabled={s.busy || Number(s.settings.has_api_key) !== 1}
                  onClick={() => {
                    if (!window.confirm('Remove the stored OpenAI API key?')) return;
                    void s.clearKey();
                  }}
                >
                  Clear key
                </button>
              </div>
              {s.testResult ? (
                <div className={`small mt-2 ${s.testResult.startsWith('OK') ? 'text-success' : 'text-danger'}`}>
                  {s.testResult}
                </div>
              ) : null}
            </div>

            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <div className="form-check">
                  <input id="tabul8-ai-enabled" className="form-check-input" type="checkbox" checked={s.enabled} onChange={(e) => s.setEnabled(e.target.checked)} disabled={s.busy} />
                  <label className="form-check-label" htmlFor="tabul8-ai-enabled">AI labels on</label>
                </div>
                <div className="form-check">
                  <input id="tabul8-ai-auto" className="form-check-input" type="checkbox" checked={s.autoLabel} onChange={(e) => s.setAutoLabel(e.target.checked)} disabled={s.busy} />
                  <label className="form-check-label" htmlFor="tabul8-ai-auto">Auto-label on every snap</label>
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="tabul8-fallback">On failure / no key</label>
                <select id="tabul8-fallback" className="form-select" value={s.fallback} onChange={(e) => s.setFallback(e.target.value as 'celebr8r' | 'manual')} disabled={s.busy}>
                  <option value="celebr8r">Queue Celebr8r (tabul8_label)</option>
                  <option value="manual">Leave blank for manual labeling</option>
                </select>
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="tabul8-model">Model</label>
                <select
                  id="tabul8-model"
                  className="form-select"
                  value={models.includes(s.model) ? s.model : (s.settings.default_model || 'gpt-4o-mini')}
                  onChange={(e) => s.setModel(e.target.value)}
                  disabled={s.busy}
                >
                  {models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <label className="form-label mt-2" htmlFor="tabul8-model-custom">Custom model (optional override)</label>
                <input id="tabul8-model-custom" className="form-control" value={s.customModel} onChange={(e) => s.setCustomModel(e.target.value)} disabled={s.busy} placeholder="e.g. gpt-4o-mini" />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="tabul8-cap">Monthly spend cap (USD)</label>
                <input id="tabul8-cap" className="form-control" value={s.monthlyCap} onChange={(e) => s.setMonthlyCap(e.target.value)} disabled={s.busy} />
                <div className="form-text">0 = no cap</div>
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="tabul8-party-limit">Per-party request limit</label>
                <input id="tabul8-party-limit" className="form-control" value={s.partyLimit} onChange={(e) => s.setPartyLimit(e.target.value)} disabled={s.busy} />
                <div className="form-text">0 = no limit</div>
              </div>
            </div>

            <div className="catn8-card p-2">
              <div className="fw-bold">Usage ({s.settings.usage?.month || '—'})</div>
              <div className="small">
                Requests: {s.settings.usage?.request_count ?? 0}
                {' · '}Est. spend: ${Number(s.settings.usage?.estimated_spend_usd || 0).toFixed(4)}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" disabled={s.busy} onClick={() => void s.load()}>Reload</button>
            <button type="button" className="btn btn-primary" disabled={s.busy} onClick={() => void s.save()}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

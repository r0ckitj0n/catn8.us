import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { useAIConfig } from './hooks/useAIConfig';
import { GeneralAIProviderSection } from './sections/GeneralAIProviderSection';
import { GeneralAISettingsSection } from './sections/GeneralAISettingsSection';
import { GeneralAISecretsSection } from './sections/GeneralAISecretsSection';

interface AIConfigModalProps {
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
 * AIConfigModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function AIConfigModal({ open, onClose, onToast }: AIConfigModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const state = useAIConfig(open, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  return (
    <div className="modal fade catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">AI Configuration</h5>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={'btn btn-sm btn-primary catn8-dirty-save' + (state.isDirty ? ' catn8-dirty-save--visible' : '')}
                onClick={() => void state.save()}
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
            <form onSubmit={(e) => { e.preventDefault(); void state.save(); }}>
              <datalist id="ai-location-options">
                <option value="global" />
                <option value="us-central1" />
                <option value="us-east1" />
                <option value="us-west1" />
                <option value="europe-west4" />
              </datalist>

              <GeneralAIProviderSection 
                config={state.config}
                setConfig={state.setConfig}
                modelChoices={state.modelChoices}
                providerKey={state.providerKey}
                busy={state.busy}
                refreshModelChoices={state.refreshModelChoices}
                isRefreshingModels={state.isRefreshingModels}
                modelChoicesSource={state.modelChoicesSource}
              />

              <div className="border rounded p-3 mb-3">
                <GeneralAISettingsSection 
                  temperature={state.config.temperature}
                  setTemperature={(v) => state.setConfig(prev => ({ ...prev, temperature: v }))}
                  busy={state.busy}
                  lastAiProviderTest={state.lastAiProviderTest}
                  testAiProvider={state.testAiProvider}
                />

                <GeneralAISecretsSection 
                  providerKey={state.providerKey}
                  hasSecrets={state.hasSecrets}
                  secretsByProvider={state.secretsByProvider}
                  setSecretsByProvider={state.setSecretsByProvider}
                  busy={state.busy}
                />

                <div className="col-12 mt-3">
                  <label className="form-label" htmlFor="ai-system-prompt">System Prompt</label>
                  <textarea
                    id="ai-system-prompt"
                    className="form-control"
                    rows={6}
                    value={state.config.system_prompt}
                    onChange={(e) => state.setConfig(prev => ({ ...prev, system_prompt: e.target.value }))}
                    disabled={state.busy}
                    placeholder="(stub)"
                  />
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

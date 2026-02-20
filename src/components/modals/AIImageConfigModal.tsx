import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { useAIImageConfig } from './hooks/useAIImageConfig';
import { AIImageParamsSection } from './sections/AIImageParamsSection';
import { AIImageProviderSection } from './sections/AIImageProviderSection';
import { AIImageSecretsSection } from './sections/AIImageSecretsSection';

interface AIImageConfigModalProps {
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
 * AIImageConfigModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function AIImageConfigModal({ open, onClose, onToast }: AIImageConfigModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const state = useAIImageConfig(open, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">AI Image Configuration</h5>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={'btn btn-sm btn-primary catn8-dirty-save' + (state.isDirty ? ' catn8-dirty-save--visible' : '')}
                onClick={state.save}
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
            <form onSubmit={state.save}>
              <div className="row g-3">
                <div className="col-lg-6">
                  <AIImageParamsSection 
                    config={state.config}
                    setConfig={state.setConfig}
                    paramOptions={state.paramOptions}
                    providerKey={state.providerKey}
                    busy={state.busy}
                  />
                  <AIImageProviderSection 
                    config={state.config}
                    setConfig={state.setConfig}
                    modelChoices={state.modelChoices}
                    providerKey={state.providerKey}
                    busy={state.busy}
                    lastAiImageProviderTest={state.lastAiImageProviderTest}
                    testAiImageProvider={state.testAiImageProvider}
                  />
                </div>
                <div className="col-lg-6">
                  <AIImageSecretsSection 
                    providerKey={state.providerKey}
                    config={state.config}
                    setConfig={state.setConfig}
                    hasSecrets={state.hasSecrets}
                    secretsByProvider={state.secretsByProvider}
                    setSecretsByProvider={state.setSecretsByProvider}
                    lastAiImageLocationRefTest={state.lastAiImageLocationRefTest}
                    setLastAiImageLocationRefTest={state.setLastAiImageLocationRefTest}
                    busy={state.busy}
                    setBusy={state.setBusy}
                    onToast={onToast}
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

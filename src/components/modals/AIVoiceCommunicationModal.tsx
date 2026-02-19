import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IViewer, IToast } from '../../types/common';
import { useAIVoiceCommunication } from './hooks/useAIVoiceCommunication';
import { GcpServiceAccountSection } from './sections/GcpServiceAccountSection';
import { GeminiLiveStudioSection } from './sections/GeminiLiveStudioSection';
import { TtsDefaultsSection } from './sections/TtsDefaultsSection';

interface AIVoiceCommunicationModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
  viewer?: IViewer | null;
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
 * AIVoiceCommunicationModal - Refactored Component
 * COMPLIANCE: File size < 250 lines
 */
export function AIVoiceCommunicationModal({ open, onClose, onToast, viewer }: AIVoiceCommunicationModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const state = useAIVoiceCommunication(open, onToast);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl catn8-modal-wide">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">AI Voice Configuration</h5>
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
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            <form onSubmit={(e) => { e.preventDefault(); void state.save(); }}>
              <div className="row g-3">
                <div className="col-xl-4 col-lg-6">
                  <GcpServiceAccountSection 
                    hasMysteryServiceAccount={state.hasMysteryServiceAccount}
                    mysteryServiceAccountJson={state.mysteryServiceAccountJson}
                    setMysteryServiceAccountJson={state.setMysteryServiceAccountJson}
                    busy={state.busy}
                    lastGcpServiceAccountTest={state.lastGcpServiceAccountTest}
                    testMysteryGcpServiceAccount={state.testMysteryGcpServiceAccount}
                  />
                </div>

                <div className="col-xl-4 col-lg-6">
                  <GeminiLiveStudioSection 
                    hasMysteryGeminiKey={state.hasMysteryGeminiKey}
                    mysteryGeminiApiKey={state.mysteryGeminiApiKey}
                    setMysteryGeminiApiKey={state.setMysteryGeminiApiKey}
                    mysteryGeminiKeyName={state.mysteryGeminiKeyName}
                    setMysteryGeminiKeyName={state.setMysteryGeminiKeyName}
                    mysteryGeminiProjectName={state.mysteryGeminiProjectName}
                    setMysteryGeminiProjectName={state.setMysteryGeminiProjectName}
                    mysteryGeminiProjectNumber={state.mysteryGeminiProjectNumber}
                    setMysteryGeminiProjectNumber={state.setMysteryGeminiProjectNumber}
                    busy={state.busy}
                    lastGeminiLiveTokenTest={state.lastGeminiLiveTokenTest}
                    testGeminiLiveToken={state.testGeminiLiveToken}
                  />
                </div>

                <div className="col-xl-4 col-lg-12">
                  <TtsDefaultsSection 
                    ttsVoiceMapActive={state.ttsVoiceMapActive}
                    setTtsVoiceMapActive={state.setTtsVoiceMapActive}
                    ttsOutputFormat={state.ttsOutputFormat}
                    setTtsOutputFormat={state.setTtsOutputFormat}
                    ttsLanguageCode={state.ttsLanguageCode}
                    setTtsLanguageCode={state.setTtsLanguageCode}
                    ttsVoiceName={state.ttsVoiceName}
                    setTtsVoiceName={state.setTtsVoiceName}
                    ttsSpeakingRate={state.ttsSpeakingRate}
                    setTtsSpeakingRate={state.setTtsSpeakingRate}
                    ttsPitch={state.ttsPitch}
                    setTtsPitch={state.setTtsPitch}
                    busy={state.busy}
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

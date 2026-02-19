import React from 'react';

import { WebpImage } from '../../common/WebpImage';
import './InterrogationModal.css';

interface InterrogationModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  interrogationEntityName: string;
  interrogationImageUrlFinal: string;
  interrogationTypedQuestion: string;
  setInterrogationTypedQuestion: (val: string) => void;
  interrogationStatus: string;
  interrogationInputText: string;
  interrogationOutputText: string;
  interrogationTypedAudioUrl: string;
  interrogationTypedAudioRef: React.RefObject<HTMLAudioElement>;
  busy: boolean;
  scenarioId: string;
  interrogationEntityId: number;
  onAskTyped: (e: React.FormEvent) => void;
  onOpenRapSheet: () => void;
  onStartStreaming: () => void;
  onStopStreaming: () => void;
}

export function InterrogationModal({
  modalRef,
  interrogationEntityName,
  interrogationImageUrlFinal,
  interrogationTypedQuestion,
  setInterrogationTypedQuestion,
  interrogationStatus,
  interrogationInputText,
  interrogationOutputText,
  interrogationTypedAudioUrl,
  interrogationTypedAudioRef,
  busy,
  scenarioId,
  interrogationEntityId,
  onAskTyped,
  onOpenRapSheet,
  onStartStreaming,
  onStopStreaming,
}: InterrogationModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered catn8-mystery-interrogation-dialog">
        <div className="modal-content catn8-mystery-interrogation-content">
          <div className="modal-header">
            <div className="fw-bold">Interrogation: {interrogationEntityName || '(unknown)'}</div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={onOpenRapSheet}
                disabled={busy || !scenarioId}
              >
                RAP Sheet
              </button>
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body catn8-mystery-interrogation-body">
            <div className="catn8-mystery-interrogation-left">
              <div className="catn8-mystery-interrogation-image-wrap">
                <WebpImage className="catn8-mystery-interrogation-image" src={interrogationImageUrlFinal} alt={interrogationEntityName || 'Interrogation'} />
              </div>

              <form className="catn8-mystery-interrogation-typed-form" onSubmit={onAskTyped}>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    value={interrogationTypedQuestion}
                    onChange={(e) => setInterrogationTypedQuestion(e.target.value)}
                    placeholder="Type a question for the suspect…"
                    disabled={busy || !scenarioId || !interrogationEntityId}
                    aria-label="Type a question for the suspect"
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={busy || !scenarioId || !interrogationEntityId || !String(interrogationTypedQuestion || '').trim()}
                  >
                    Send
                  </button>
                </div>
              </form>

              <audio
                ref={interrogationTypedAudioRef}
                className="catn8-mystery-interrogation-typed-audio"
                src={interrogationTypedAudioUrl ? interrogationTypedAudioUrl : undefined}
                preload="auto"
              />
            </div>
            <div className="catn8-mystery-interrogation-right">
              <div className="d-flex align-items-center gap-2">
                <div className="text-muted small">Status: {interrogationStatus}</div>
              </div>

              <div className="catn8-mystery-interrogation-transcripts">
                <div className="catn8-mystery-interrogation-transcript">
                  <div className="catn8-mystery-interrogation-transcript-title">You (live)</div>
                  <div className="catn8-mystery-interrogation-transcript-body" role="textbox" aria-label="Your speech transcript">
                    {interrogationInputText || <span className="text-muted">…</span>}
                  </div>
                </div>

                <div className="catn8-mystery-interrogation-transcript">
                  <div className="catn8-mystery-interrogation-transcript-title">Agent</div>
                  <div className="catn8-mystery-interrogation-transcript-body" role="textbox" aria-label="Agent speech transcript">
                    {interrogationOutputText || <span className="text-muted">…</span>}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={(interrogationStatus === 'idle' || interrogationStatus === 'closed')
                  ? 'btn catn8-mystery-talk-btn catn8-mystery-interrogation-voice-fab'
                  : 'btn btn-outline-danger catn8-mystery-interrogation-voice-fab'}
                onClick={() => {
                  if (interrogationStatus === 'idle' || interrogationStatus === 'closed') onStartStreaming();
                  else onStopStreaming();
                }}
                disabled={busy || !scenarioId || !interrogationEntityId}
              >
                {interrogationStatus === 'idle' || interrogationStatus === 'closed' ? 'Voice Talk' : 'Stop'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

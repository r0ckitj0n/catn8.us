import React from 'react';

import { WebpImage } from '../../common/WebpImage';

interface SheriffTalkModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  sheriffName: string;
  sheriffImageUrl: string;
  sheriffStatus: string;
  sheriffInputText: string;
  sheriffOutputText: string;
  busy: boolean;
  onStartStreaming: () => void;
  onStopStreaming: () => void;
}

export function SheriffTalkModal({
  modalRef,
  sheriffName,
  sheriffImageUrl,
  sheriffStatus,
  sheriffInputText,
  sheriffOutputText,
  busy,
  onStartStreaming,
  onStopStreaming,
}: SheriffTalkModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered catn8-mystery-interrogation-dialog">
        <div className="modal-content catn8-mystery-interrogation-content">
          <div className="modal-header">
            <div className="fw-bold">Talking to Sheriff {sheriffName || ''}</div>
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body catn8-mystery-interrogation-body">
            <div className="catn8-mystery-interrogation-left">
              <div className="catn8-mystery-interrogation-image-wrap">
                <WebpImage 
                  className="catn8-mystery-interrogation-image" 
                  src={sheriffImageUrl || '/images/mystery/sheriff.png'} 
                  alt={sheriffName || 'Sheriff'} 
                />
              </div>
            </div>
            <div className="catn8-mystery-interrogation-right">
              <div className="d-flex align-items-center gap-2 mb-2">
                <div className="text-muted small">Status: {sheriffStatus}</div>
              </div>

              <div className="catn8-mystery-interrogation-transcripts">
                <div className="catn8-mystery-interrogation-transcript">
                  <div className="catn8-mystery-interrogation-transcript-title">You (live)</div>
                  <div className="catn8-mystery-interrogation-transcript-body">
                    {sheriffInputText || <span className="text-muted">…</span>}
                  </div>
                </div>

                <div className="catn8-mystery-interrogation-transcript">
                  <div className="catn8-mystery-interrogation-transcript-title">Sheriff</div>
                  <div className="catn8-mystery-interrogation-transcript-body">
                    {sheriffOutputText || <span className="text-muted">…</span>}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={(sheriffStatus === 'idle' || sheriffStatus === 'closed')
                  ? 'btn catn8-mystery-talk-btn catn8-mystery-interrogation-voice-fab'
                  : 'btn btn-outline-danger catn8-mystery-interrogation-voice-fab'}
                onClick={() => {
                  if (sheriffStatus === 'idle' || sheriffStatus === 'closed') onStartStreaming();
                  else onStopStreaming();
                }}
                disabled={busy}
              >
                {sheriffStatus === 'idle' || sheriffStatus === 'closed' ? 'Voice Talk' : 'Stop'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

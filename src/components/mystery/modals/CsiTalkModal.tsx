import React from 'react';

interface CsiTalkModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  csiName: string;
  csiImageUrl: string;
  csiStatus: string;
  csiInputText: string;
  csiOutputText: string;
  busy: boolean;
  onStartStreaming: () => void;
  onStopStreaming: () => void;
}

export function CsiTalkModal({
  modalRef,
  csiName,
  csiImageUrl,
  csiStatus,
  csiInputText,
  csiOutputText,
  busy,
  onStartStreaming,
  onStopStreaming,
}: CsiTalkModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered catn8-mystery-interrogation-dialog">
        <div className="modal-content catn8-mystery-interrogation-content">
          <div className="modal-header">
            <div className="fw-bold">Talking to CSI Detective {csiName || ''}</div>
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body catn8-mystery-interrogation-body">
            <div className="catn8-mystery-interrogation-left">
              <div className="catn8-mystery-interrogation-image-wrap">
                <img 
                  className="catn8-mystery-interrogation-image" 
                  src={csiImageUrl || '/images/mystery/interrogation_room_empty.png'} 
                  alt={csiName || 'CSI Detective'} 
                />
              </div>
            </div>
            <div className="catn8-mystery-interrogation-right">
              <div className="d-flex align-items-center gap-2 mb-2">
                <div className="text-muted small">Status: {csiStatus}</div>
              </div>

              <div className="catn8-mystery-interrogation-transcripts">
                <div className="catn8-mystery-interrogation-transcript">
                  <div className="catn8-mystery-interrogation-transcript-title">You (live)</div>
                  <div className="catn8-mystery-interrogation-transcript-body">
                    {csiInputText || <span className="text-muted">…</span>}
                  </div>
                </div>

                <div className="catn8-mystery-interrogation-transcript">
                  <div className="catn8-mystery-interrogation-transcript-title">CSI Detective</div>
                  <div className="catn8-mystery-interrogation-transcript-body">
                    {csiOutputText || <span className="text-muted">…</span>}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={(csiStatus === 'idle' || csiStatus === 'closed')
                  ? 'btn catn8-mystery-talk-btn catn8-mystery-interrogation-voice-fab'
                  : 'btn btn-outline-danger catn8-mystery-interrogation-voice-fab'}
                onClick={() => {
                  if (csiStatus === 'idle' || csiStatus === 'closed') onStartStreaming();
                  else onStopStreaming();
                }}
                disabled={busy}
              >
                {csiStatus === 'idle' || csiStatus === 'closed' ? 'Voice Talk' : 'Stop'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

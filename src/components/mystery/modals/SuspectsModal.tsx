import React from 'react';
import './SuspectsModal.css';

interface SuspectsModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  scenarioCast: {
    entityId: string | number;
    agentId: number;
    role: string;
    name: string;
    thumbUrl: string;
    irImageUrl: string;
    blurb: string;
  }[];
  onInterrogate: (id: string | number, name: string, agentId: number) => void;
  onViewRapSheet: (id: string | number, name: string) => void;
}

export function SuspectsModal({
  modalRef,
  busy,
  scenarioCast,
  onInterrogate,
  onViewRapSheet,
}: SuspectsModalProps) {
  const suspects = scenarioCast.filter(c => c.role === 'suspect' || c.role === 'killer');

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Interrogation Room</div>
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="catn8-card p-3">
              <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                <div className="text-muted small">Click a suspect's photo to begin interrogation.</div>
              </div>

              <div className="catn8-mystery-suspects-list">
                {suspects.map((c, idx) => {
                  console.log(`[SuspectsModal] Rendering suspect: ${c.name}, agentId: ${c.agentId}, irImageUrl: ${c.irImageUrl}`);
                  return (
                    <div key={`suspect-${c.entityId}-${c.role}-${idx}`} className="catn8-mystery-suspect-card">
                      <button
                        type="button"
                        className="catn8-mystery-suspect-thumb-btn"
                        onClick={() => {
                          console.log(`[SuspectsModal] Clicked suspect: ${c.name}, agentId: ${c.agentId}`);
                          onInterrogate(c.entityId, c.name, c.agentId);
                        }}
                        disabled={busy}
                        title={`Question ${c.name}`}
                      >
                        <div className="catn8-mystery-suspect-thumb">
                          <img 
                            className="catn8-mystery-suspect-thumb-img" 
                            src={c.irImageUrl || '/images/mystery/interrogation_room_empty.png'} 
                            alt={c.name} 
                            loading="lazy" 
                          />
                          <div className="catn8-mystery-suspect-thumb-overlay">
                            <i className="bi bi-chat-dots-fill"></i>
                            <span>QUESTION</span>
                          </div>
                        </div>
                      </button>
                      
                      <div className="catn8-mystery-suspect-details">
                        <div className="d-flex flex-column align-items-start mb-2">
                          <h5 className="catn8-mystery-suspect-name mb-1">{c.name}</h5>
                          
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <button
                              type="button"
                              className="btn btn-xs btn-outline-info py-0 px-2"
                              style={{ fontSize: '10px', height: '18px', lineHeight: '16px' }}
                              onClick={() => onViewRapSheet(c.entityId, c.name)}
                              disabled={busy}
                            >
                              RAP SHEET
                            </button>
                            <span className="catn8-mystery-suspect-role text-uppercase">{c.role}</span>
                          </div>
                        </div>
                        
                        <div className="catn8-mystery-suspect-blurb">
                          {c.blurb ? (
                            <p className="mb-0 text-muted small">{c.blurb}</p>
                          ) : (
                            <p className="mb-0 text-muted small italic">No specific questioning details available.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {suspects.length === 0 && (
                  <div className="col-12 text-center py-5 text-muted">
                    No suspects identified for this scenario yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

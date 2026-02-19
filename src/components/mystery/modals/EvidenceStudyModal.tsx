import React from 'react';
import './EvidenceStudyModal.css';

import { IEvidence } from '../../../types/game';

interface EvidenceStudyModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  isAdmin: boolean;
  evidenceList: IEvidence[];
  busy: boolean;
  onGenerateEvidence: () => void;
  onAddNote: (evidenceId: number, noteText: string) => void;
}

export function EvidenceStudyModal({
  modalRef,
  isAdmin,
  evidenceList,
  busy,
  onGenerateEvidence,
  onAddNote,
}: EvidenceStudyModalProps) {
  const [newNoteText, setNewNoteText] = React.useState<Record<number, string>>({});

  const handleAddNote = (evidenceId: number) => {
    const text = newNoteText[evidenceId] || '';
    if (!text.trim()) return;
    onAddNote(evidenceId, text);
    setNewNoteText(prev => ({ ...prev, [evidenceId]: '' }));
  };

  const handleGenerate = () => {
    onGenerateEvidence();
  };

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content catn8-mystery-modal-content">
          <div className="modal-header">
            <div className="fw-bold">Evidence Locker</div>
            <div className="d-flex gap-2">
              {isAdmin && (
                <button 
                  type="button" 
                  className="btn btn-sm btn-primary" 
                  onClick={handleGenerate}
                  disabled={busy}
                >
                  {evidenceList.length > 0 ? 'Regenerate Evidence' : 'Generate Evidence'}
                </button>
              )}
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            {evidenceList.length === 0 ? (
              <div className="text-center p-5 text-muted">
                No evidence has been collected yet.
              </div>
            ) : (
              <div className="row g-4">
                {evidenceList.map((item) => (
                  <div key={item.id} className="col-md-6">
                    <div className="catn8-card catn8-evidence-report-card p-4 h-100">
                      <div className="catn8-evidence-report-header">
                        <div className="catn8-evidence-report-title">Forensic Evidence Report</div>
                        <div className="catn8-evidence-report-meta d-flex justify-content-between">
                          <span>CASE ID: #{item.id}</span>
                          <span>TAGGED: {item.type}</span>
                        </div>
                      </div>

                      <div className="d-flex gap-3 mb-3">
                        {item.image_url && (
                          <div className="catn8-evidence-thumb">
                            <img src={item.image_url} alt={item.title} className="img-fluid rounded" />
                          </div>
                        )}
                        <div className="flex-grow-1">
                          <h5 className="mb-1 text-uppercase fw-bold">{item.title}</h5>
                          <div className="catn8-evidence-report-body">
                            {item.description}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-auto">
                        <div className="fw-bold small mb-2 text-uppercase text-muted" style={{ fontSize: '0.65rem' }}>Field Analyst Notes:</div>
                        <div className="catn8-evidence-notes-list mb-3">
                          {Array.isArray(item.notes) && item.notes.length > 0 ? (
                            item.notes.map((note, idx) => (
                              <div key={idx} className="catn8-evidence-note mb-2 p-2 rounded">
                                <div className="d-flex justify-content-between border-bottom mb-1 pb-1">
                                  <span className="small fw-bold text-uppercase" style={{ fontSize: '0.6rem' }}>{note.author_role}</span>
                                </div>
                                <div className="small" style={{ fontSize: '0.75rem' }}>{note.note_text}</div>
                              </div>
                            ))
                          ) : (
                            <div className="small text-muted italic p-2">No analyst notes recorded.</div>
                          )}
                        </div>
                        
                        <div className="input-group input-group-sm">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Append case note..."
                            value={newNoteText[Number(item.id)] || ''}
                            onChange={(e) => setNewNoteText(prev => ({ ...prev, [Number(item.id)]: e.target.value }))}
                          />
                          <button 
                            className="btn btn-dark btn-sm" 
                            type="button"
                            onClick={() => handleAddNote(Number(item.id))}
                            disabled={busy}
                          >
                            RECORD
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

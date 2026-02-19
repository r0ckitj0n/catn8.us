import React from 'react';

interface Deposition {
  id: number;
  entity_name: string;
  deposition_text: string;
  created_at: string;
}

interface DepositionsModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  depositions: Deposition[];
  busy: boolean;
}

export function DepositionsModal({
  modalRef,
  depositions,
  busy,
}: DepositionsModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content catn8-mystery-modal-content">
          <div className="modal-header">
            <div className="fw-bold">Depositions</div>
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            {depositions.length === 0 ? (
              <div className="text-center p-5 text-muted">
                No depositions have been recorded yet.
              </div>
            ) : (
              <div className="accordion" id="depositionsAccordion">
                {depositions.map((dep) => (
                  <div key={dep.id} className="accordion-item bg-dark border-secondary">
                    <h2 className="accordion-header">
                      <button 
                        className="accordion-button collapsed bg-dark text-white" 
                        type="button" 
                        data-bs-toggle="collapse" 
                        data-bs-target={`#dep-${dep.id}`}
                      >
                        {dep.entity_name} - {new Date(dep.created_at).toLocaleDateString()}
                      </button>
                    </h2>
                    <div id={`#dep-${dep.id}`} className="accordion-collapse collapse" data-bs-parent="#depositionsAccordion">
                      <div className="accordion-body text-white">
                        <div className="catn8-case-file-text">
                          {dep.deposition_text}
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

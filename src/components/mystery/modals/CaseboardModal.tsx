import React from 'react';

interface CaseboardModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
}

export function CaseboardModal({ modalRef }: CaseboardModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Caseboard</div>
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="text-muted">Use Start / Resume to access Caseboard.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

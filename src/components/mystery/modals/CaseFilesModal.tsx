import React from 'react';
import './CaseFilesModal.css';

interface CaseFilesModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  backstoryText: string;
  coldHardFacts: string;
  busy: boolean;
}

export function CaseFilesModal({
  modalRef,
  backstoryText,
  coldHardFacts,
  busy,
}: CaseFilesModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content catn8-mystery-modal-content">
          <div className="modal-header">
            <div className="fw-bold">Case Files</div>
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <ul className="nav nav-tabs mb-3" role="tablist">
              <li className="nav-item" role="presentation">
                <button className="nav-link active" id="backstory-tab" data-bs-toggle="tab" data-bs-target="#backstory" type="button" role="tab">Backstory</button>
              </li>
              <li className="nav-item" role="presentation">
                <button className="nav-link" id="facts-tab" data-bs-toggle="tab" data-bs-target="#facts" type="button" role="tab">Cold Hard Facts</button>
              </li>
            </ul>
            <div className="tab-content">
              <div className="tab-pane fade show active" id="backstory" role="tabpanel">
                <div className="catn8-card p-3 catn8-case-file-text">
                  {backstoryText || 'No backstory available.'}
                </div>
              </div>
              <div className="tab-pane fade" id="facts" role="tabpanel">
                <div className="catn8-card p-3 catn8-case-file-text">
                  {coldHardFacts || 'No cold hard facts available yet.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

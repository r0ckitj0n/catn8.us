import React from 'react';

import { ToolsControlsPane } from './tools/ToolsControlsPane';
import { ToolsLogPane } from './tools/ToolsLogPane';
import { ToolsModalProps } from './tools/types';

export function ToolsModal(props: ToolsModalProps) {
  const { modalRef, jobs, busy, caseId, loadJobs, deleteQueuedJob } = props;

  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Darkroom</div>
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-12 col-lg-6">
                <ToolsControlsPane {...props} />
              </div>
              <div className="col-12 col-lg-6">
                <ToolsLogPane jobs={jobs} busy={busy} caseId={caseId} loadJobs={loadJobs} deleteQueuedJob={deleteQueuedJob} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

interface MysteriesModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  scenarioId: string;
  onOpenScenarios: () => void;
}

export function MysteriesModal({
  modalRef,
  busy,
  scenarioId,
  onOpenScenarios,
}: MysteriesModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Back Stories</div>
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            {!scenarioId ? (
              <div className="catn8-card p-2">
                Select a crime scene first.
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={onOpenScenarios}
                    disabled={busy}
                  >
                    Open Crime Scenes
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-muted">Use the Dossier to manage Backstories and spawn Cases.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

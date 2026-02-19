import React from 'react';

interface AdvancedModalProps {
  modalRef: React.RefObject<HTMLDivElement>;
  busy: boolean;
  isAdmin: boolean;
  scenarioId: string;
  caseId: string;
  constraintsDraft: string;
  setConstraintsDraft: (val: string) => void;
  jobSpecText: string;
  setJobSpecText: (val: string) => void;
  onOpenScenarios: () => void;
  loadScenario: (sid: string) => Promise<void>;
  saveConstraints: () => Promise<void>;
}

export function AdvancedModal({
  modalRef,
  busy,
  isAdmin,
  scenarioId,
  caseId,
  constraintsDraft,
  setConstraintsDraft,
  jobSpecText,
  setJobSpecText,
  onOpenScenarios,
  loadScenario,
  saveConstraints,
}: AdvancedModalProps) {
  return (
    <div className="modal fade catn8-mystery-modal catn8-stacked-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <div className="fw-bold">Advanced</div>
            <button type="button" className="btn-close catn8-mystery-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            {!scenarioId ? (
              <div className="catn8-card p-2">
                Select a scenario first.
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={onOpenScenarios}
                    disabled={busy}
                  >
                    Open Scenarios
                  </button>
                </div>
              </div>
            ) : null}

            <div className="row g-3">
              <div className="col-lg-6">
                <div className="catn8-card p-3 h-100">
                  <div>
                    <div className="fw-bold">Scenario Constraints (JSON)</div>
                    <div className="form-text mb-2">
                      This is your scenario constraint pack (killer/alibis/relationships/etc). Save is JSON-validated.
                    </div>
                  </div>
                  <textarea
                    className="form-control"
                    rows={12}
                    value={constraintsDraft}
                    onChange={(e) => setConstraintsDraft(e.target.value)}
                    disabled={busy || !scenarioId}
                    spellCheck={false}
                  />
                  <div className="d-flex justify-content-end gap-2 mt-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => loadScenario(scenarioId)} disabled={busy || !scenarioId}>
                      Reload
                    </button>
                    {isAdmin && (
                      <button type="button" className="btn btn-primary" onClick={saveConstraints} disabled={busy || !scenarioId}>
                        Save
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="col-lg-6">
                <div className="catn8-card p-3 h-100">
                  <div>
                    <div className="fw-bold">Job Spec (JSON)</div>
                    <div className="form-text mb-2">Optional extra parameters for generation jobs.</div>
                  </div>
                  <textarea
                    className="form-control"
                    rows={12}
                    value={jobSpecText}
                    onChange={(e) => setJobSpecText(e.target.value)}
                    disabled={busy || !caseId}
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

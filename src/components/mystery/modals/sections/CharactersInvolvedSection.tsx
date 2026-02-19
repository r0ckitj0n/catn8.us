import React from 'react';

interface CharactersInvolvedSectionProps {
  busy: boolean;
  isAdmin: boolean;
  caseMgmtScenarioId: string;
  caseMgmtInvolvedCharacters: any[];
  caseMgmtExpandedEntityIds: number[];
  setCaseMgmtExpandedEntityIds: React.Dispatch<React.SetStateAction<number[]>>;
  caseMgmtDepositionBusyByEntityId: Record<string, boolean>;
  caseMgmtDepositionByEntityId: Record<string, { text: string; updated_at: string }>;
  loadCaseMgmtDepositionForEntity: (eid: number) => Promise<void>;
  enqueueCaseMgmtGenerateDeposition: (eid: number) => Promise<void>;
  enqueueSpecificJob: (opts: { action: string; spec: any; requireScenario: boolean }) => Promise<void>;
}

export function CharactersInvolvedSection({
  busy,
  isAdmin,
  caseMgmtScenarioId,
  caseMgmtInvolvedCharacters,
  caseMgmtExpandedEntityIds,
  setCaseMgmtExpandedEntityIds,
  caseMgmtDepositionBusyByEntityId,
  caseMgmtDepositionByEntityId,
  loadCaseMgmtDepositionForEntity,
  enqueueCaseMgmtGenerateDeposition,
  enqueueSpecificJob,
}: CharactersInvolvedSectionProps) {
  return (
    <div className="col-12">
      <div className="catn8-card p-2">
        <div className="d-flex justify-content-between align-items-center gap-2">
          <div className="fw-bold">Characters Involved</div>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              onClick={() => enqueueSpecificJob({ action: 'generate_missing_depositions', spec: {}, requireScenario: true })}
              disabled={busy || !caseMgmtScenarioId}
            >
              Generate Missing Depositions
            </button>
          )}
        </div>
        {!caseMgmtScenarioId ? (
          <div className="text-muted mt-1">Select a scenario to view involved characters.</div>
        ) : null}
        {caseMgmtScenarioId && !caseMgmtInvolvedCharacters.length ? (
          <div className="text-muted mt-1">No characters are attached to this scenario yet.</div>
        ) : null}
        {caseMgmtScenarioId && caseMgmtInvolvedCharacters.length ? (
          <div className="mt-2">
            {caseMgmtInvolvedCharacters.map((ch) => {
              const eid = Number(ch?.entity_id || 0);
              const isExpanded = caseMgmtExpandedEntityIds.includes(eid);
              const role = String(ch?.role || '').trim().toLowerCase();
              const depBusy = Boolean(caseMgmtDepositionBusyByEntityId?.[String(eid)]);
              const depObj = caseMgmtDepositionByEntityId?.[String(eid)] || { text: '', updated_at: '' };
              
              return (
                <div key={'case-mgmt-char-' + String(eid)} className="catn8-card p-2 mb-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary w-100 d-flex justify-content-between align-items-center"
                    onClick={() => {
                      setCaseMgmtExpandedEntityIds((prev) => {
                        if (prev.includes(eid)) return prev.filter((x) => x !== eid);
                        void loadCaseMgmtDepositionForEntity(eid);
                        return [...prev, eid];
                      });
                    }}
                    disabled={busy}
                  >
                    <span className="text-start">
                      <span className="fw-bold">{String(ch?.name || 'Character')}</span>
                      <span className="text-muted">{' — '}{role}</span>
                    </span>
                    <span className="text-muted">{isExpanded ? 'Hide' : 'Show'}</span>
                  </button>

                  {isExpanded && (
                    <div className="mt-2">
                      <div className="row g-2">
                        <div className="col-12">
                          <hr className="my-2" />
                          <div className="d-flex align-items-center justify-content-between gap-2">
                            <div>
                              <div className="fw-bold">Deposition</div>
                              <div className="form-text">Scenario-specific sworn statement.</div>
                            </div>
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => loadCaseMgmtDepositionForEntity(eid)}
                                disabled={busy || depBusy}
                              >
                                Refresh
                              </button>
                              {isAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => enqueueCaseMgmtGenerateDeposition(eid)}
                                  disabled={busy || depBusy}
                                >
                                  Generate
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="catn8-card p-2 mt-1">
                            {depObj.text ? <div className="catn8-prewrap">{depObj.text}</div> : <div className="text-muted">No deposition yet.</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

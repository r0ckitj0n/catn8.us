import React from 'react';

interface DarkroomSectionProps {
  busy: boolean;
  isAdmin: boolean;
  mysteryId: string | number;
  caseId: string;
  setCaseId: (val: string) => void;
  setScenarioId: (val: string) => void;
  cases: any[];
  imageStyleMasterDraft: string;
  setImageStyleMasterDraft: (val: string) => void;
  saveImageStyleSetting: (opts: { key: 'master' | 'location' | 'mugshot' | 'weapon', value: string }) => Promise<void>;
  jobs: any[];
  loadJobs: (cid: string) => Promise<void>;
  deleteQueuedJob: (id: number) => Promise<void>;
}

export function DarkroomSection({
  busy, isAdmin, mysteryId, caseId, setCaseId, setScenarioId, cases,
  imageStyleMasterDraft, setImageStyleMasterDraft, saveImageStyleSetting,
  jobs, loadJobs, deleteQueuedJob
}: DarkroomSectionProps) {
  return (
    <div className="mt-1">
      <div className="row g-3">
        <div className="col-12">
          <label className="form-label" htmlFor="mystery-darkroom-case">Case</label>
          <select
            id="mystery-darkroom-case"
            className="form-select"
            value={String(caseId || '')}
            onChange={(e) => {
              const next = String(e.target.value || '');
              setCaseId(next);
              setScenarioId('');
            }}
            disabled={busy || !mysteryId}
          >
            <option value="">Select a case…</option>
            {(Array.isArray(cases) ? cases : []).map((c: any) => (
              <option key={'darkroom-case-' + String(c?.id || '')} value={String(c?.id || '')}>
                {String(c?.title || c?.slug || ('Case #' + String(c?.id || '')))}
              </option>
            ))}
          </select>
        </div>
      </div>

      {caseId && (
        <div className="mt-3">
          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <div className="catn8-card p-3">
                <div className="catn8-card p-2">
                  <div className="fw-bold">Image Style Master</div>
                  <textarea
                    className="form-control mt-2"
                    rows={3}
                    value={imageStyleMasterDraft}
                    onChange={(e) => setImageStyleMasterDraft(e.target.value)}
                    onBlur={() => saveImageStyleSetting({ key: 'master', value: imageStyleMasterDraft })}
                    disabled={busy || !isAdmin}
                  />
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-6">
              <div className="catn8-card p-3 h-100">
                <div className="d-flex justify-content-between align-items-center gap-2">
                  <div className="fw-bold">Log</div>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadJobs(caseId)} disabled={busy || !caseId}>
                    Refresh
                  </button>
                </div>
                <div className="table-responsive mt-2">
                  <table className="table table-sm">
                    <tbody>
                      {jobs.map((j) => (
                        <tr key={j.id}>
                          <td>{j.action}</td>
                          <td>{j.status}</td>
                          <td className="text-end">
                            {j.status === 'queued' && (
                              <button className="btn btn-sm btn-outline-danger" onClick={() => deleteQueuedJob(j.id)}>Delete</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

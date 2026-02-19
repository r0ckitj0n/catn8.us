import React from 'react';

interface StartResumeSectionProps {
  playResumables: any[];
  resumeScenarioNow: (opts: { caseId: number; scenarioId: number; title: string }) => Promise<void>;
  playBackstories: any[];
  takeCaseSelect: (cid: number) => Promise<void>;
}

export function StartResumeSection({
  playResumables,
  resumeScenarioNow,
  playBackstories,
  takeCaseSelect
}: StartResumeSectionProps) {
  return (
    <div className="mt-3">
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="catn8-card p-3 h-100">
            <div className="fw-bold">Resume</div>
            <div className="table-responsive">
              <table className="table table-sm">
                <tbody>
                  {playResumables.map((it) => (
                    <tr key={String(it.scenario_id)}>
                      <td>{it.case_title}</td>
                      <td>{it.scenario_title}</td>
                      <td className="text-end">
                        <button 
                          className="btn btn-sm btn-primary" 
                          onClick={() => resumeScenarioNow({ caseId: it.case_id, scenarioId: it.scenario_id, title: 'Resumed.' })}
                        >
                          Resume
                        </button>
                      </td>
                    </tr>
                  ))}
                  {playResumables.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-muted text-center">No resumable sessions.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="catn8-card p-3 h-100">
            <div className="fw-bold">Backstories</div>
            <div className="table-responsive">
              <table className="table table-sm">
                <tbody>
                  {playBackstories.filter((b: any) => !b.is_archived).map((b: any) => (
                    <tr key={String(b.id)}>
                      <td>{b.title}</td>
                      <td className="text-end">
                        {b.spawned_case_id ? (
                          <button className="btn btn-sm btn-primary" onClick={() => takeCaseSelect(b.spawned_case_id)}>Take</button>
                        ) : (
                          <span className="text-muted">No case</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {playBackstories.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-muted text-center">No backstories available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

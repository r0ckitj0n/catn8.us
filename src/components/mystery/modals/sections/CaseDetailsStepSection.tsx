import React from 'react';

interface CaseDetailsStepSectionProps {
  busy: boolean;
  isAdmin: boolean;
  caseId: string;
  scenarioId: string;
  onOpenScenariosModal: () => void;
  onOpenCaseSetupModal: () => void;
  scenario: any;
  scenarioCrimeScene: any;
  entityNameById: Record<string, string>;
  scenarioEntities: any[];
  csiDetectiveEntityIdDraft: string;
  setCsiDetectiveEntityIdDraft: (val: string) => void;
  csiReportTextDraft: string;
  setCsiReportTextDraft: (val: string) => void;
  csiReportJsonDraft: string;
  setCsiReportJsonDraft: (val: string) => void;
  saveCsiReport: () => Promise<void>;
  generateCsiReport: (sid?: string | number) => Promise<void>;
}

export function CaseDetailsStepSection({
  busy, isAdmin, caseId, scenarioId, onOpenScenariosModal, onOpenCaseSetupModal,
  scenario, scenarioCrimeScene, entityNameById, scenarioEntities,
  csiDetectiveEntityIdDraft, setCsiDetectiveEntityIdDraft,
  csiReportTextDraft, setCsiReportTextDraft,
  csiReportJsonDraft, setCsiReportJsonDraft,
  saveCsiReport, generateCsiReport
}: CaseDetailsStepSectionProps) {
  if (!caseId) return null;

  return (
    <div className="catn8-card p-3">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div className="fw-bold">Step 3 — Case Details</div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onOpenScenariosModal}>
            {isAdmin ? 'Crime Scenes' : 'View Scenarios'}
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onOpenCaseSetupModal}>
            {isAdmin ? 'Case Setup' : 'View Case Setup'}
          </button>
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-12">
          <div className="catn8-card p-2">
            <div className="fw-bold">CSI Report</div>
            <div className="row g-2 mt-1">
              <div className="col-lg-6">
                <label className="form-label" htmlFor="case-mgmt-csi-detective">CSI Detective</label>
                <select
                  id="case-mgmt-csi-detective"
                  className="form-select"
                  value={csiDetectiveEntityIdDraft}
                  onChange={(e) => setCsiDetectiveEntityIdDraft(e.target.value)}
                  disabled={busy || !isAdmin}
                >
                  <option value="">Select Detective...</option>
                  {scenarioEntities.map((e: any) => (
                    <option key={'csi-det-' + String(e.entity_id)} value={String(e.entity_id)}>
                      {e.entity_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="case-mgmt-csi-report">Report Text</label>
                <textarea
                  id="case-mgmt-csi-report"
                  className="form-control"
                  rows={5}
                  value={csiReportTextDraft}
                  onChange={(e) => setCsiReportTextDraft(e.target.value)}
                  disabled={busy || !isAdmin}
                />
              </div>
              <div className="col-12 d-flex justify-content-end gap-2">
                {isAdmin && (
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline-primary" 
                    onClick={() => generateCsiReport(scenarioId)} 
                    disabled={busy || !scenarioId}
                  >
                    Generate AI Report
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-primary" onClick={saveCsiReport} disabled={busy || !isAdmin || !scenarioId}>
                  Save Report
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

interface CaseBriefingSectionProps {
  busy: boolean;
  isAdmin: boolean;
  caseMgmtCaseId: string;
  caseMgmtScenarioId: string;
  caseMgmtBriefingDraft: string;
  setCaseMgmtBriefingDraft: (val: string) => void;
  loadCaseMgmtScenariosAndBriefing: () => Promise<void>;
  saveCaseMgmtCaseDetails: () => Promise<void>;
  saveCaseMgmtBriefing: () => Promise<void>;
}

export function CaseBriefingSection({
  busy,
  isAdmin,
  caseMgmtCaseId,
  caseMgmtScenarioId,
  caseMgmtBriefingDraft,
  setCaseMgmtBriefingDraft,
  loadCaseMgmtScenariosAndBriefing,
  saveCaseMgmtCaseDetails,
  saveCaseMgmtBriefing,
}: CaseBriefingSectionProps) {
  return (
    <div className="catn8-card p-3 catn8-mystery-modal-card mb-3">
      <div className="d-flex align-items-center justify-content-between gap-2">
        <div>
          <div className="fw-bold">Case Briefing</div>
          <div className="form-text">This briefing is case-specific and stored on the scenario constraints.</div>
        </div>
        <div className="d-flex gap-2">
          <button 
            type="button" 
            className="btn btn-sm btn-outline-secondary" 
            onClick={loadCaseMgmtScenariosAndBriefing} 
            disabled={busy || !caseMgmtCaseId}
          >
            Refresh
          </button>
          <button 
            type="button" 
            className="btn btn-sm btn-primary" 
            onClick={saveCaseMgmtCaseDetails} 
            disabled={busy || !caseMgmtCaseId || !isAdmin}
          >
            Save Case
          </button>
          <button 
            type="button" 
            className="btn btn-sm btn-primary" 
            onClick={saveCaseMgmtBriefing} 
            disabled={busy || !caseMgmtScenarioId || !isAdmin}
          >
            Save Briefing
          </button>
        </div>
      </div>

      <div className="mt-3">
        <label className="form-label" htmlFor="case-mgmt-briefing">Briefing Content</label>
        <textarea
          id="case-mgmt-briefing"
          className="form-control"
          rows={10}
          value={caseMgmtBriefingDraft}
          onChange={(e) => setCaseMgmtBriefingDraft(e.target.value)}
          disabled={busy || !caseMgmtScenarioId}
          placeholder="Enter the case briefing details for this scenario..."
        />
      </div>
    </div>
  );
}

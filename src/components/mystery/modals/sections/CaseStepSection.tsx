import React from 'react';

interface CaseStepSectionProps {
  busy: boolean;
  isAdmin: boolean;
  mysteryId: string | number;
  backstoryId: string;
  caseId: string;
  setCaseId: (val: string) => void;
  cases: any[];
  loadCases: (mid: string | number) => Promise<any[]>;
  spawnCaseFromBackstory: () => Promise<void>;
}

export function CaseStepSection({
  busy, isAdmin, mysteryId, backstoryId, caseId, setCaseId, cases,
  loadCases, spawnCaseFromBackstory
}: CaseStepSectionProps) {
  if (!backstoryId) return null;

  return (
    <div className="catn8-card p-3 mb-3">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div className="fw-bold">Step 2 — Case</div>
          <div className="form-text">Connect this backstory to a specific case or create a new one.</div>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void loadCases(mysteryId)} disabled={busy || !mysteryId}>
            Refresh
          </button>
          {isAdmin && (
            <button type="button" className="btn btn-sm btn-primary" onClick={spawnCaseFromBackstory} disabled={busy || !mysteryId || !backstoryId}>
              Create Case
            </button>
          )}
        </div>
      </div>

      <div className="mt-2">
        <label className="form-label" htmlFor="mystery-case-select">Case</label>
        <div className="d-flex gap-2">
          <select
            id="mystery-case-select"
            className="form-select"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            disabled={busy || !mysteryId}
          >
            <option value="">Select a Case</option>
            {cases.filter(c => String(c.backstory_id) === backstoryId).map((c: any) => (
              <option key={'case-opt-' + String(c?.id || '')} value={String(c?.id || '')}>
                {String(c?.title || c?.slug || ('Case #' + String(c?.id || '')))}{Number(c?.is_archived || 0) === 1 ? ' (archived)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

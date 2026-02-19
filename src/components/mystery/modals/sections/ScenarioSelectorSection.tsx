import React from 'react';

import { IMasterCharacter, IMasterLocation, IMasterWeapon, IMasterMotive } from '../../../../types/game';

interface ScenarioSelectorSectionProps {
  busy: boolean;
  isAdmin: boolean;
  caseId: string;
  setCaseId: (val: string) => void;
  mysteryId: string | number;
  cases: any[];
  scenarios: any[];
  scenarioId: string;
  setScenarioId: (val: string) => void;
  scenario: any;
  newScenario: { title: string };
  setNewScenario: React.Dispatch<React.SetStateAction<{ title: string }>>;
  deleteScenarioArmed: boolean;
  setDeleteScenarioArmed: (val: boolean) => void;
  loadCases: (mid: string | number) => Promise<any[]>;
  createScenario: (e: React.FormEvent) => Promise<void>;
  deleteScenario: () => Promise<void>;
  ensureDefaultScenarioForCase: () => Promise<void>;
  reassignScenarioCase: (cid: string) => Promise<void>;
  loadCaseMgmtBriefingForScenarioId: (sid: number) => Promise<void>;
  setCaseMgmtExpandedEntityIds: (val: number[]) => void;
}

export function ScenarioSelectorSection({
  busy, isAdmin, caseId, setCaseId, mysteryId, cases, scenarios, scenarioId, setScenarioId,
  scenario, newScenario, setNewScenario, deleteScenarioArmed, setDeleteScenarioArmed,
  loadCases, createScenario, deleteScenario, ensureDefaultScenarioForCase, reassignScenarioCase,
  loadCaseMgmtBriefingForScenarioId, setCaseMgmtExpandedEntityIds
}: ScenarioSelectorSectionProps) {
  return (
    <div className="catn8-card p-3 h-100">
      <div>
        <div className="fw-bold">Case Crime Scene</div>
        <div className="form-text">Select an existing crime scene or create a new one for this case.</div>
      </div>

      {isAdmin && caseId && !scenarios.length && (
        <div className="catn8-card p-2 mt-3">
          This case has no scenarios yet. Create one to unlock the full cast and Case File.
          <div className="mt-2">
            <button type="button" className="btn btn-sm btn-primary" onClick={ensureDefaultScenarioForCase} disabled={busy || !caseId}>
              Create Matching Scenario
            </button>
          </div>
        </div>
      )}

      <form className="row g-2 align-items-end mt-2" onSubmit={createScenario}>
        <div className="col-lg-12">
          <label className="form-label" htmlFor="mystery-scenario-case">Case (for filtering)</label>
          <div className="d-flex align-items-end gap-2">
            <select
              id="mystery-scenario-case"
              className="form-select"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              disabled={busy || !mysteryId || !isAdmin}
            >
              <option value="">Select a case…</option>
              {cases.filter((c) => Number(c?.is_archived || 0) !== 1).map((c) => (
                <option key={c.id} value={String(c.id)} title={c.slug ? ('Slug: ' + String(c.slug)) : ''}>
                  {c.title}
                </option>
              ))}
            </select>
            {isAdmin && (
              <button type="button" className="btn btn-outline-secondary" onClick={() => loadCases(mysteryId)} disabled={busy || !mysteryId}>
                Refresh
              </button>
            )}
          </div>
        </div>

        <div className="col-lg-6">
          <label className="form-label" htmlFor="mystery-scenario">Crime Scene</label>
          <select 
            id="mystery-scenario" 
            className="form-select" 
            value={scenarioId} 
            onChange={(e) => {
              const next = e.target.value;
              setScenarioId(next);
              if (setCaseMgmtExpandedEntityIds) setCaseMgmtExpandedEntityIds([]);
              if (loadCaseMgmtBriefingForScenarioId) void loadCaseMgmtBriefingForScenarioId(Number(next || 0));
            }} 
            disabled={busy || !caseId}
          >
            <option value="">Select a crime scene…</option>
            {scenarios.map((s) => (
              <option key={s.id} value={String(s.id)} title={s.slug ? ('Slug: ' + String(s.slug)) : ''}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        <div className="col-lg-6">
          <label className="form-label" htmlFor="mystery-scenario-connected-case">Connected Case</label>
          <select
            id="mystery-scenario-connected-case"
            className="form-select"
            value={String(scenario?.case_id || caseId || '')}
            onChange={(e) => reassignScenarioCase(e.target.value)}
            disabled={busy || !scenarioId || !isAdmin}
          >
            <option value="">Select a case…</option>
            {cases.filter((c) => Number(c?.is_archived || 0) !== 1).map((c) => (
              <option key={c.id} value={String(c.id)} title={c.slug ? ('Slug: ' + String(c.slug)) : ''}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {isAdmin && (
          <>
            <div className="col-lg-6">
              <label className="form-label" htmlFor="mystery-new-scenario-title">Title</label>
              <input
                id="mystery-new-scenario-title"
                className="form-control"
                value={newScenario.title}
                onChange={(e) => setNewScenario((s) => ({ ...s, title: e.target.value }))}
                disabled={busy || !caseId}
                placeholder="The Alleyway Call"
              />
            </div>

            <div className="col-lg-12 d-flex justify-content-between align-items-center">
              <div className="form-check">
                <input
                  id="mystery-delete-crime-scene-armed"
                  className="form-check-input"
                  type="checkbox"
                  checked={deleteScenarioArmed}
                  onChange={(e) => setDeleteScenarioArmed(e.target.checked)}
                  disabled={busy || !scenarioId}
                />
                <label className="form-check-label" htmlFor="mystery-delete-crime-scene-armed">Arm delete</label>
              </div>

              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-danger" disabled={busy || !scenarioId || !deleteScenarioArmed} onClick={deleteScenario}>
                  Delete Crime Scene
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy || !caseId}>
                  Create Crime Scene
                </button>
              </div>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

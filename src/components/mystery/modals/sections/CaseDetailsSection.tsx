import React from 'react';

interface CaseDetailsSectionProps {
  busy: boolean;
  isAdmin: boolean;
  mysteryId: string | number;
  mysteries: any[];
  onMysteryIdChange: (val: string) => void;
  cases: any[];
  caseMgmtCaseId: string;
  setCaseMgmtCaseId: (val: string) => void;
  caseMgmtScenarioId: string;
  setCaseMgmtScenarioId: (val: string) => void;
  caseMgmtScenarios: any[];
  loadCaseMgmtBriefingForScenarioId: (sid: number) => Promise<void>;
  setCaseMgmtExpandedEntityIds: React.Dispatch<React.SetStateAction<number[]>>;
  caseMgmtCaseTitleDraft: string;
  setCaseMgmtCaseTitleDraft: (val: string) => void;
  caseMgmtCaseSlugDraft: string;
  setCaseMgmtCaseSlugDraft: (val: string) => void;
  caseMgmtCaseDescriptionDraft: string;
  setCaseMgmtCaseDescriptionDraft: (val: string) => void;
  caseMgmtCaseArchivedDraft: boolean;
  setCaseMgmtCaseArchivedDraft: (val: boolean) => void;
  caseMgmtCaseTemplateDraft: boolean;
  setCaseMgmtCaseTemplateDraft: (val: boolean) => void;
}

export function CaseDetailsSection({
  busy,
  isAdmin,
  mysteryId,
  mysteries,
  onMysteryIdChange,
  cases,
  caseMgmtCaseId,
  setCaseMgmtCaseId,
  caseMgmtScenarioId,
  setCaseMgmtScenarioId,
  caseMgmtScenarios,
  loadCaseMgmtBriefingForScenarioId,
  setCaseMgmtExpandedEntityIds,
  caseMgmtCaseTitleDraft,
  setCaseMgmtCaseTitleDraft,
  caseMgmtCaseSlugDraft,
  setCaseMgmtCaseSlugDraft,
  caseMgmtCaseDescriptionDraft,
  setCaseMgmtCaseDescriptionDraft,
  caseMgmtCaseArchivedDraft,
  setCaseMgmtCaseArchivedDraft,
  caseMgmtCaseTemplateDraft,
  setCaseMgmtCaseTemplateDraft
}: CaseDetailsSectionProps) {
  return (
    <div className="catn8-card p-3 catn8-mystery-modal-card mb-3">
      <div className="row g-3">
        <div className="col-lg-6">
          <label className="form-label" htmlFor="case-mgmt-mystery">Mystery</label>
          <select
            id="case-mgmt-mystery"
            className="form-select"
            value={mysteryId}
            onChange={(e) => onMysteryIdChange(e.target.value)}
            disabled={busy || !isAdmin}
          >
            <option value="">Select a mystery…</option>
            {(Array.isArray(mysteries) ? mysteries : []).map((m: any) => (
              <option key={'case-mgmt-mystery-' + String(m?.id || '')} value={String(m?.id || '')}>
                {String(m?.title || ('Mystery #' + String(m?.id || '')))}
              </option>
            ))}
          </select>
        </div>

        <div className="col-lg-6">
          <label className="form-label" htmlFor="case-mgmt-case">Case</label>
          <div className="d-flex gap-2">
            <select
              id="case-mgmt-case"
              className="form-select"
              value={caseMgmtCaseId}
              onChange={(e) => setCaseMgmtCaseId(e.target.value)}
              disabled={busy || !mysteryId || !isAdmin}
            >
              <option value="">Select a case…</option>
              {(Array.isArray(cases) ? cases : []).map((c: any) => (
                <option key={'case-mgmt-case-' + String(c?.id || '')} value={String(c?.id || '')}>
                  {String(c?.title || c?.slug || ('Case #' + String(c?.id || '')))}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="col-lg-6">
          <label className="form-label" htmlFor="case-mgmt-scenario">Scenario</label>
          <select
            id="case-mgmt-scenario"
            className="form-select"
            value={caseMgmtScenarioId}
            onChange={(e) => {
              const next = e.target.value;
              setCaseMgmtScenarioId(next);
              setCaseMgmtExpandedEntityIds([]);
              void loadCaseMgmtBriefingForScenarioId(Number(next || 0));
            }}
            disabled={busy || !caseMgmtCaseId}
          >
            <option value="">Select…</option>
            {(Array.isArray(caseMgmtScenarios) ? caseMgmtScenarios : []).map((s: any) => (
              <option key={'case-mgmt-scenario-' + String(s?.id || '')} value={String(s?.id || '')}>
                {String(s?.title || s?.slug || ('Scenario #' + String(s?.id || '')))}
              </option>
            ))}
          </select>
          <div className="form-text">Choose which scenario to attach the briefing to (usually the crime scene).</div>
        </div>

        <div className="col-lg-6">
          <label className="form-label" htmlFor="case-mgmt-case-title">Case Title</label>
          <input
            id="case-mgmt-case-title"
            className="form-control"
            value={caseMgmtCaseTitleDraft}
            onChange={(e) => setCaseMgmtCaseTitleDraft(e.target.value)}
            disabled={busy || !caseMgmtCaseId || !isAdmin}
          />
        </div>
        <div className="col-lg-6">
          <label className="form-label" htmlFor="case-mgmt-case-slug">Case Slug</label>
          <input
            id="case-mgmt-case-slug"
            className="form-control"
            value={caseMgmtCaseSlugDraft}
            onChange={(e) => setCaseMgmtCaseSlugDraft(e.target.value)}
            disabled={busy || !caseMgmtCaseId || !isAdmin}
          />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="case-mgmt-case-description">Case Description</label>
          <textarea
            id="case-mgmt-case-description"
            className="form-control"
            rows={3}
            value={caseMgmtCaseDescriptionDraft}
            onChange={(e) => setCaseMgmtCaseDescriptionDraft(e.target.value)}
            disabled={busy || !caseMgmtCaseId || !isAdmin}
          />
        </div>
        <div className="col-12">
          <div className="d-flex flex-wrap gap-4">
            <div className="form-check">
              <input
                id="case-mgmt-case-archived"
                className="form-check-input"
                type="checkbox"
                checked={caseMgmtCaseArchivedDraft}
                onChange={(e) => setCaseMgmtCaseArchivedDraft(Boolean(e.target.checked))}
                disabled={busy || !caseMgmtCaseId || !isAdmin}
              />
              <label className="form-check-label" htmlFor="case-mgmt-case-archived">Archived</label>
            </div>
            <div className="form-check">
              <input
                id="case-mgmt-case-template"
                className="form-check-input"
                type="checkbox"
                checked={caseMgmtCaseTemplateDraft}
                onChange={(e) => setCaseMgmtCaseTemplateDraft(Boolean(e.target.checked))}
                disabled={busy || !caseMgmtCaseId || !isAdmin}
              />
              <label className="form-check-label" htmlFor="case-mgmt-case-template">Template</label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

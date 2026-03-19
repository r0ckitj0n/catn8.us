import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';
import { BUILD_TABS } from '../../components/pages/build-wizard/buildWizardConstants';
import { calculateDurationDays, prettyPhaseLabel, stepPhaseBucket, toNumberOrNull, toStringOrNull } from '../../components/pages/build-wizard/buildWizardUtils';
import { IBuildWizardStep } from '../../types/buildWizard';

interface BuildWizardStepEditModalProps {
  activeTabStepNumbers: Map<number, number>;
  closeStepEditModal: () => void;
  dependencyCandidateByStepId: Record<number, string>;
  setDependencyCandidateByStepId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  open: boolean;
  saveStepEditModal: () => Promise<void>;
  saving: boolean;
  step: IBuildWizardStep | null;
  stepById: Map<number, IBuildWizardStep>;
  stepDraft: IBuildWizardStep | null;
  stepEditModalDependencyIds: number[];
  stepEditModalDependencyOptions: IBuildWizardStep[];
  updateStepDraft: (stepId: number, patch: Partial<IBuildWizardStep>) => void;
}

export function BuildWizardStepEditModal({
  activeTabStepNumbers,
  closeStepEditModal,
  dependencyCandidateByStepId,
  setDependencyCandidateByStepId,
  open,
  saveStepEditModal,
  saving,
  step,
  stepById,
  stepDraft,
  stepEditModalDependencyIds,
  stepEditModalDependencyOptions,
  updateStepDraft,
}: BuildWizardStepEditModalProps) {
  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeStepEditModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeStepEditModal, open]);

  if (!open || !step || !stepDraft) {
    return null;
  }

  const dependencyCount = stepEditModalDependencyIds.length;
  const summaryEstimatedCost = stepDraft.estimated_cost ?? null;
  const summaryActualCost = stepDraft.actual_cost ?? null;

  return (
    <div
      className="build-wizard-doc-manager"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeStepEditModal();
        }
      }}
    >
      <div
        className="build-wizard-doc-manager-inner build-wizard-step-edit-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`build-wizard-step-edit-title-${step.id}`}
      >
        <div className="build-wizard-doc-manager-head build-wizard-step-edit-head">
          <div className="build-wizard-step-edit-head-copy">
            <span className="build-wizard-step-edit-kicker">{prettyPhaseLabel(step.phase_key)}</span>
            <h3 id={`build-wizard-step-edit-title-${step.id}`}>Edit Step #{activeTabStepNumbers.get(step.id) || step.step_order}</h3>
            <p>Update timeline, dependencies, and costs from a single editor.</p>
          </div>
          <div className="build-wizard-doc-manager-actions">
            <StandardIconButton
              iconKey="close"
              ariaLabel="Close step editor"
              title="Close"
              className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
              onClick={closeStepEditModal}
            />
          </div>
        </div>

        <fieldset className="build-wizard-step-fields build-wizard-step-edit-fields">
          <div className="build-wizard-step-edit-summary">
            <div className="build-wizard-step-edit-summary-card">
              <span>Dependencies</span>
              <strong>{dependencyCount}</strong>
            </div>
            <div className="build-wizard-step-edit-summary-card">
              <span>Estimated</span>
              <strong>{summaryEstimatedCost ?? '-'}</strong>
            </div>
            <div className="build-wizard-step-edit-summary-card">
              <span>Actual</span>
              <strong>{summaryActualCost ?? '-'}</strong>
            </div>
            <div className="build-wizard-step-edit-summary-card">
              <span>Window</span>
              <strong>{stepDraft.expected_start_date || 'TBD'} to {stepDraft.expected_end_date || 'TBD'}</strong>
            </div>
          </div>

          <section className="build-wizard-step-edit-section">
            <div className="build-wizard-step-edit-section-head">
              <h4>Dependencies</h4>
              <p>Track prerequisite work before this step moves forward.</p>
            </div>
            <div className="build-wizard-step-grid">
              <div className={`build-wizard-type-note build-wizard-dependency-note build-wizard-step-edit-dependency-panel ${stepEditModalDependencyIds.length > 0 ? '' : 'is-empty-inline'}`}>
              <div className="build-wizard-dependency-head">
                <span>Depends on:</span>
                {stepEditModalDependencyIds.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-link btn-sm"
                    onClick={() => updateStepDraft(step.id, { depends_on_step_ids: [] })}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              {stepEditModalDependencyIds.length > 0 ? (
                <div className="build-wizard-dependency-chip-list">
                  {stepEditModalDependencyIds.map((dependencyId) => {
                    const dependency = stepById.get(dependencyId) || null;
                    const phaseId = dependency ? stepPhaseBucket(dependency) : null;
                    const phase = phaseId ? BUILD_TABS.find((tab) => tab.id === phaseId) : null;
                    const label = dependency
                      ? `#${activeTabStepNumbers.get(dependency.id) || dependency.step_order} ${dependency.title} (${phase ? phase.label : prettyPhaseLabel(dependency.phase_key)})`
                      : `#${dependencyId} (missing step)`;
                    return (
                      <span key={`step-edit-dependency-${dependencyId}`} className="build-wizard-dependency-chip">
                        {label}
                        <button
                          type="button"
                          className="build-wizard-dependency-chip-remove"
                          aria-label={`Remove dependency ${label}`}
                          title="Remove dependency"
                          onClick={() => updateStepDraft(step.id, {
                            depends_on_step_ids: stepEditModalDependencyIds.filter((id) => id !== dependencyId),
                          })}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="build-wizard-dependency-empty">No dependencies set.</div>
              )}
              <div className="build-wizard-dependency-controls">
                <select
                  value={dependencyCandidateByStepId[step.id] || ''}
                  onChange={(e) => setDependencyCandidateByStepId((prev) => ({ ...prev, [step.id]: e.target.value }))}
                >
                  <option value="">Add dependency step...</option>
                  {stepEditModalDependencyOptions.map((candidate) => {
                    const phaseId = stepPhaseBucket(candidate);
                    const phase = BUILD_TABS.find((tab) => tab.id === phaseId);
                    const label = `#${activeTabStepNumbers.get(candidate.id) || candidate.step_order} ${candidate.title} (${phase ? phase.label : prettyPhaseLabel(candidate.phase_key)})`;
                    return <option key={candidate.id} value={String(candidate.id)}>{label}</option>;
                  })}
                </select>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  disabled={Number(dependencyCandidateByStepId[step.id] || 0) <= 0}
                  onClick={() => {
                    const selectedId = Number(dependencyCandidateByStepId[step.id] || 0);
                    if (selectedId <= 0 || stepEditModalDependencyIds.includes(selectedId)) {
                      return;
                    }
                    updateStepDraft(step.id, {
                      depends_on_step_ids: [...stepEditModalDependencyIds, selectedId],
                    });
                    setDependencyCandidateByStepId((prev) => ({ ...prev, [step.id]: '' }));
                  }}
                >
                  Add
                </button>
              </div>
            </div>
            </div>
          </section>

          <section className="build-wizard-step-edit-section">
            <div className="build-wizard-step-edit-section-head">
              <h4>Step Details</h4>
              <p>Set the title, dates, budget, and description for this work item.</p>
            </div>
            <div className="build-wizard-doc-manager-grid build-wizard-step-edit-grid">
              <label className="is-wide">
                Title
                <input
                  type="text"
                  value={stepDraft.title || ''}
                  onChange={(e) => updateStepDraft(step.id, { title: e.target.value })}
                />
              </label>
              <label>
                Start Date
                <input
                  type="date"
                  value={stepDraft.expected_start_date || ''}
                  onChange={(e) => {
                    const nextStartDate = toStringOrNull(e.target.value);
                    const nextDuration = calculateDurationDays(nextStartDate, stepDraft.expected_end_date)
                      ?? stepDraft.expected_duration_days;
                    updateStepDraft(step.id, {
                      expected_start_date: nextStartDate,
                      expected_duration_days: nextDuration,
                    });
                  }}
                />
              </label>
              <label>
                End Date
                <input
                  type="date"
                  value={stepDraft.expected_end_date || ''}
                  onChange={(e) => {
                    const nextEndDate = toStringOrNull(e.target.value);
                    const nextDuration = calculateDurationDays(stepDraft.expected_start_date, nextEndDate)
                      ?? stepDraft.expected_duration_days;
                    updateStepDraft(step.id, {
                      expected_end_date: nextEndDate,
                      expected_duration_days: nextDuration,
                    });
                  }}
                />
              </label>
              <label>
                Estimated Cost
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={stepDraft.estimated_cost ?? ''}
                  onChange={(e) => updateStepDraft(step.id, { estimated_cost: toNumberOrNull(e.target.value) })}
                />
              </label>
              <label>
                Actual Cost
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={stepDraft.actual_cost ?? ''}
                  onChange={(e) => updateStepDraft(step.id, { actual_cost: toNumberOrNull(e.target.value) })}
                />
              </label>
              <label className="is-wide">
                Step Description
                <textarea
                  rows={5}
                  value={stepDraft.description || ''}
                  onChange={(e) => updateStepDraft(step.id, { description: e.target.value })}
                />
              </label>
            </div>
          </section>
        </fieldset>

        <div className="build-wizard-doc-manager-actions build-wizard-step-edit-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saving}
            onClick={() => { void saveStepEditModal(); }}
          >
            {saving ? 'Saving...' : 'Save Step'}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={closeStepEditModal}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

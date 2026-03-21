import React from 'react';

import { IBuildWizardStep } from '../../types/buildWizard';

interface BuildWizardEditableStepCardHeaderProps {
  changeCurrencyEdit: (key: string, text: string) => void;
  commitStep: (stepId: number, patch: Partial<IBuildWizardStep>) => Promise<void>;
  completionLocked: boolean;
  durationDays: number | null;
  effectiveActualCost: number | null;
  estimatedCost: number | null;
  finishCurrencyEdit: (key: string, onCommit: (value: number | null) => void) => void;
  hasStepTasks: boolean;
  incompleteTaskCount: number;
  incompleteDescendantCount: number;
  isActualCostVerified: boolean;
  isExpanded: boolean;
  isRefreshingActualCost: boolean;
  onDeleteStep: () => void;
  onOpenMoveStepModal: (stepId: number) => void;
  onRefreshActualCost: () => void;
  onSetExpanded: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onSetStepInfoModalStepId: React.Dispatch<React.SetStateAction<number>>;
  onTimelineStepChange: (stepId: number, patch: {
    expected_start_date: string | null;
    expected_end_date: string | null;
    expected_duration_days: number | null;
  }) => void;
  openStepEditModal: (step: IBuildWizardStep) => void;
  renderCurrencyInputValue: (key: string, value: number | null | undefined) => string;
  rowLevel: number;
  step: IBuildWizardStep;
  stepDraft: IBuildWizardStep;
  stepAttachmentCount: number;
  stepDisplayNumber: number;
  stepTaskCount: number;
  stepReadOnly: boolean;
  startCurrencyEdit: (key: string, value: number | null | undefined) => void;
  toggleStep: (step: IBuildWizardStep, completed: boolean) => Promise<unknown>;
  updateStepDraft: (stepId: number, patch: Partial<IBuildWizardStep>) => void;
}

export function BuildWizardEditableStepCardHeader({
  completionLocked,
  durationDays,
  effectiveActualCost,
  estimatedCost,
  hasStepTasks,
  incompleteTaskCount,
  incompleteDescendantCount,
  isActualCostVerified,
  isExpanded,
  isRefreshingActualCost,
  onDeleteStep,
  onOpenMoveStepModal,
  onRefreshActualCost,
  onSetExpanded,
  onSetStepInfoModalStepId,
  onTimelineStepChange,
  openStepEditModal,
  renderCurrencyInputValue,
  rowLevel,
  step,
  stepDraft,
  stepAttachmentCount,
  stepDisplayNumber,
  stepTaskCount,
  stepReadOnly,
  toggleStep,
}: BuildWizardEditableStepCardHeaderProps) {
  const openEditor = React.useCallback(() => {
    if (!stepReadOnly) {
      openStepEditModal(step);
    }
  }, [openStepEditModal, step, stepReadOnly]);
  const attachmentLabel = `${stepAttachmentCount} attachment${stepAttachmentCount === 1 ? '' : 's'} on this step`;

  return (
    <div className="build-wizard-step-header">
      <div className="build-wizard-step-header-left">
        <div className="build-wizard-step-handle-stack">
          <button type="button" className="build-wizard-step-drag-handle-btn" draggable={!stepReadOnly} disabled={stepReadOnly} aria-label={stepReadOnly ? 'Step is read-only' : 'Drag to reorder step'} title={stepReadOnly ? 'Read-only step' : 'Drag to reorder'}>⋮⋮</button>
          {hasStepTasks ? <span className="build-wizard-step-task-indicator" aria-label={`Step has ${stepTaskCount} task${stepTaskCount === 1 ? '' : 's'}`} title={`Has ${stepTaskCount} task${stepTaskCount === 1 ? '' : 's'}`} /> : null}
          <button type="button" className="build-wizard-step-expand-btn" onClick={() => onSetExpanded((prev) => ({ ...prev, [step.id]: !isExpanded }))} aria-label={isExpanded ? 'Collapse step card' : 'Expand step card'} title={isExpanded ? 'Collapse step' : 'Expand step'}>
            {isExpanded ? '▾' : '▸'}
          </button>
        </div>
        {rowLevel > 0 ? <span className="build-wizard-child-glyph" aria-hidden="true">↳</span> : null}
        <div className="build-wizard-inline-check">
          <label className="build-wizard-inline-complete-toggle">
            <input type="checkbox" checked={Number(step.is_completed) === 1} disabled={completionLocked} onChange={(e) => void toggleStep(step, e.target.checked)} />
            <span>Complete</span>
          </label>
          <span className="build-wizard-step-order-pill" title="Step number is automatically set from timeline order">#{stepDisplayNumber}</span>
        </div>
        <div className="build-wizard-step-metrics-panel">
          <div className="build-wizard-step-title-row">
            <div className="build-wizard-step-title-display">{stepDraft.title || 'Untitled Step'}</div>
            <div className="build-wizard-inline-metrics">
              <label className="build-wizard-date-inline">
                <span className="build-wizard-inline-metric-label">Start:</span>
                <button
                  type="button"
                  className="build-wizard-inline-edit-trigger"
                  disabled={stepReadOnly}
                  onClick={openEditor}
                >
                  {stepDraft.expected_start_date || '-'}
                </button>
              </label>
              <label className="build-wizard-date-inline">
                <span className="build-wizard-inline-metric-label">End:</span>
                <button
                  type="button"
                  className="build-wizard-inline-edit-trigger"
                  disabled={stepReadOnly}
                  onClick={openEditor}
                >
                  {stepDraft.expected_end_date || '-'}
                </button>
              </label>
              <label className="build-wizard-date-inline">
                <span className="build-wizard-inline-metric-label">Estimated Cost:</span>
                <button
                  type="button"
                  className="build-wizard-inline-edit-trigger"
                  disabled={stepReadOnly}
                  onClick={openEditor}
                >
                  {estimatedCost !== null ? renderCurrencyInputValue(`step-${step.id}-estimated_cost`, estimatedCost) : '-'}
                </button>
              </label>
              <div className="build-wizard-date-inline">
                <span className="build-wizard-cost-label-row">
                  <span className="build-wizard-inline-metric-label">Actual Cost:</span>
                  <span className="build-wizard-cost-actions">
                    <button type="button" className="build-wizard-actual-cost-refresh-btn" disabled={stepReadOnly || isRefreshingActualCost} aria-label="Recalculate actual cost from tasks" title="Recalculate actual cost from tasks" onClick={onRefreshActualCost}>
                      {isRefreshingActualCost ? '⏳' : '🔄'}
                    </button>
                    {isActualCostVerified ? <span className="build-wizard-actual-cost-check" aria-label="Actual cost is up to date" title="Actual cost is up to date">✓</span> : null}
                  </span>
                </span>
                <button
                  type="button"
                  className="build-wizard-inline-edit-trigger"
                  disabled={stepReadOnly}
                  onClick={openEditor}
                >
                  {effectiveActualCost !== null ? renderCurrencyInputValue(`step-${step.id}-actual_cost`, effectiveActualCost) : '-'}
                </button>
              </div>
            </div>
            <div className="build-wizard-step-header-right">
              <button type="button" className="build-wizard-step-icon-btn" aria-label="Edit step" title="Edit step" disabled={stepReadOnly} onClick={openEditor}>✏️</button>
              {stepAttachmentCount > 0 ? (
                <span className="build-wizard-step-icon-badge" aria-label={attachmentLabel} title={attachmentLabel}>
                  📎<span>{stepAttachmentCount}</span>
                </span>
              ) : null}
              <button type="button" className="build-wizard-step-icon-btn" aria-label="Move step to another phase" title="Move step to another phase" disabled={stepReadOnly} onClick={() => onOpenMoveStepModal(step.id)}>↔️</button>
              <button type="button" className="build-wizard-step-icon-btn" aria-label="Step information" title="Step information" onClick={() => onSetStepInfoModalStepId(step.id)}>ℹ️</button>
              <button type="button" className="build-wizard-step-icon-btn is-danger" aria-label="Delete step" title="Delete step" disabled={stepReadOnly} onClick={onDeleteStep}>🗑️</button>
            </div>
            {durationDays !== null ? <span className="build-wizard-step-duration-chip">Duration: {durationDays}</span> : null}
          </div>
        </div>
        {completionLocked ? (
          <span className="build-wizard-parent-lock-note">
            {incompleteDescendantCount > 0 ? `Complete ${incompleteDescendantCount} child step${incompleteDescendantCount === 1 ? '' : 's'} first` : null}
            {incompleteDescendantCount > 0 && incompleteTaskCount > 0 ? ' • ' : null}
            {incompleteTaskCount > 0 ? `Complete ${incompleteTaskCount} task${incompleteTaskCount === 1 ? '' : 's'} first` : null}
          </span>
        ) : null}
        {stepReadOnly ? <span className="build-wizard-step-readonly-note">Read-only (completed)</span> : null}
      </div>
    </div>
  );
}

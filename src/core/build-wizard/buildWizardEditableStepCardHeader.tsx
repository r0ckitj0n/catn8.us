import React from 'react';

import { IBuildWizardStep } from '../../types/buildWizard';

interface BuildWizardEditableStepCardHeaderProps {
  completionLocked: boolean;
  durationDays: number | null;
  effectiveActualCost: number | null;
  estimatedCost: number | null;
  formatCurrency: (value: number) => string;
  hasStepTasks: boolean;
  incompleteDescendantCount: number;
  isActualCostVerified: boolean;
  isExpanded: boolean;
  isRefreshingActualCost: boolean;
  onDeleteStep: () => void;
  onOpenMoveStepModal: (stepId: number) => void;
  onRefreshActualCost: () => void;
  onSetExpanded: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onSetStepInfoModalStepId: React.Dispatch<React.SetStateAction<number>>;
  openStepEditModal: (step: IBuildWizardStep) => void;
  rowLevel: number;
  step: IBuildWizardStep;
  stepAttachmentCount: number;
  stepDisplayNumber: number;
  stepTaskCount: number;
  stepReadOnly: boolean;
  toggleStep: (step: IBuildWizardStep, completed: boolean) => Promise<unknown>;
}

export function BuildWizardEditableStepCardHeader({
  completionLocked,
  durationDays,
  effectiveActualCost,
  estimatedCost,
  formatCurrency,
  hasStepTasks,
  incompleteDescendantCount,
  isActualCostVerified,
  isExpanded,
  isRefreshingActualCost,
  onDeleteStep,
  onOpenMoveStepModal,
  onRefreshActualCost,
  onSetExpanded,
  onSetStepInfoModalStepId,
  openStepEditModal,
  rowLevel,
  step,
  stepAttachmentCount,
  stepDisplayNumber,
  stepTaskCount,
  stepReadOnly,
  toggleStep,
}: BuildWizardEditableStepCardHeaderProps) {
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
          <div className="build-wizard-step-title-display">{step.title || 'Untitled Step'}</div>
          <div className="build-wizard-inline-metrics">
            <div className="build-wizard-date-inline"><span>Duration (Days)</span><strong>{durationDays ?? '-'}</strong></div>
            <div className="build-wizard-date-inline"><span>Start</span><strong>{step.expected_start_date || '-'}</strong></div>
            <div className="build-wizard-date-inline"><span>End</span><strong>{step.expected_end_date || '-'}</strong></div>
            <div className="build-wizard-date-inline"><span>Estimated Cost</span><strong>{estimatedCost !== null ? formatCurrency(Number(estimatedCost || 0)) : '-'}</strong></div>
            <div className="build-wizard-date-inline">
              <span className="build-wizard-cost-label-row">
                <span>Actual Cost</span>
                <span className="build-wizard-cost-actions">
                  <button type="button" className="build-wizard-actual-cost-refresh-btn" disabled={stepReadOnly || isRefreshingActualCost} aria-label="Recalculate actual cost from tasks" title="Recalculate actual cost from tasks" onClick={onRefreshActualCost}>
                    {isRefreshingActualCost ? '⏳' : '🔄'}
                  </button>
                  {isActualCostVerified ? <span className="build-wizard-actual-cost-check" aria-label="Actual cost is up to date" title="Actual cost is up to date">✓</span> : null}
                </span>
              </span>
              <strong>{effectiveActualCost !== null ? formatCurrency(Number(effectiveActualCost || 0)) : '-'}</strong>
            </div>
          </div>
        </div>
        {completionLocked ? <span className="build-wizard-parent-lock-note">Complete {incompleteDescendantCount} child step{incompleteDescendantCount === 1 ? '' : 's'} first</span> : null}
        {stepReadOnly ? <span className="build-wizard-step-readonly-note">Read-only (completed)</span> : null}
      </div>
      <div className="build-wizard-step-header-right">
        <button type="button" className="btn btn-outline-primary btn-sm" aria-label="Edit step" title="Edit step" disabled={stepReadOnly} onClick={() => openStepEditModal(step)}>Edit</button>
        {stepAttachmentCount > 0 ? (
          <span className="build-wizard-step-attachment-indicator" aria-label={`${stepAttachmentCount} attachment${stepAttachmentCount === 1 ? '' : 's'} on this step`} title={`${stepAttachmentCount} attachment${stepAttachmentCount === 1 ? '' : 's'}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12.5l6.2-6.2a3.5 3.5 0 0 1 5 5l-8.4 8.4a5.5 5.5 0 1 1-7.8-7.8L13.1 1.8" /></svg>
          </span>
        ) : null}
        <button type="button" className="btn btn-outline-primary btn-sm" aria-label="Move step" title="Move step to another phase" disabled={stepReadOnly} onClick={() => onOpenMoveStepModal(step.id)}>Move</button>
        <button type="button" className="build-wizard-step-info-btn" aria-label="Step information" title="Step information" onClick={() => onSetStepInfoModalStepId(step.id)}>i</button>
        <button type="button" className="build-wizard-step-delete" aria-label="Delete step" title="Delete step" disabled={stepReadOnly} onClick={onDeleteStep}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>
    </div>
  );
}
